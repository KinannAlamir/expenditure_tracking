"""Core categorization pipeline – no CLI, works on in-memory CSV bytes.

Reuses all the logic from scripts/categorize_transactions.py but accepts
raw file bytes instead of Path objects, so it can be called from FastAPI.
"""

import csv
import io
import json
import logging
import os
import re
import time
from collections import Counter
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

# Make sure the project root is on the path so we can import scripts.constants
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.constants import (  # noqa: E402
    API_URL,
    CACHE_FILE,
    CATEGORIES,
    KEYWORD_MAP,
    LLM_BASE_URL,
    LLM_BATCH_SIZE,
    LLM_CACHE_FILE,
    LLM_MODEL,
    LLM_SYSTEM_PROMPT,
    NAF_MAPPING,
)

load_dotenv()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------


def load_cache() -> dict[str, Any]:
    if CACHE_FILE.exists():
        try:
            with CACHE_FILE.open(encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_cache(cache: dict[str, Any]) -> None:
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with CACHE_FILE.open("w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"Could not save cache: {e}")


def load_llm_cache() -> dict[str, str]:
    if LLM_CACHE_FILE.exists():
        try:
            with LLM_CACHE_FILE.open(encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_llm_cache(llm_cache: dict[str, str]) -> None:
    try:
        LLM_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with LLM_CACHE_FILE.open("w", encoding="utf-8") as f:
            json.dump(llm_cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"Could not save LLM cache: {e}")


# ---------------------------------------------------------------------------
# LLM helpers
# ---------------------------------------------------------------------------


def _build_llm_client() -> Any:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        return None
    try:
        from openai import OpenAI

        return OpenAI(api_key=api_key, base_url=LLM_BASE_URL, timeout=30.0)
    except Exception as e:
        logger.warning(f"Could not create OpenAI client: {e}")
        return None


def classify_with_llm(labels: list[str], client: Any) -> dict[str, str]:
    if not client or not labels:
        return {}
    user_content = "\n".join(f"{i}: {label}" for i, label in enumerate(labels))
    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            temperature=0,
            messages=[
                {"role": "system", "content": LLM_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
        )
        raw = (response.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            items = parsed.get("results", parsed.get("classifications", []))
            if not isinstance(items, list):
                items = list(parsed.values())
                if items and isinstance(items[0], list):
                    items = items[0]
        else:
            items = parsed

        result: dict[str, str] = {}
        for entry in items:
            if not isinstance(entry, dict):
                continue
            idx = entry.get("index")
            cat = entry.get("category", "")
            if idx is not None and 0 <= idx < len(labels) and cat in CATEGORIES:
                result[labels[idx]] = cat
        return result
    except Exception as e:
        logger.warning(f"LLM classification failed: {e}")
        return {}


def classify_batch_with_llm(
    unresolved: list[tuple[int, str]],
    llm_cache: dict[str, str],
    client: Any,
) -> dict[str, str]:
    results: dict[str, str] = {}
    to_query: list[str] = []

    for _, libelle in unresolved:
        if libelle in llm_cache:
            results[libelle] = llm_cache[libelle]
        elif libelle not in to_query:
            to_query.append(libelle)

    if not to_query or not client:
        return results

    logger.info(
        f"Sending {len(to_query)} transactions to LLM (batches of {LLM_BATCH_SIZE})..."
    )
    for batch_start in range(0, len(to_query), LLM_BATCH_SIZE):
        batch = to_query[batch_start : batch_start + LLM_BATCH_SIZE]
        batch_results = classify_with_llm(batch, client)
        results.update(batch_results)
        llm_cache.update(batch_results)
        save_llm_cache(llm_cache)
        if batch_start + LLM_BATCH_SIZE < len(to_query):
            time.sleep(0.5)
    return results


# ---------------------------------------------------------------------------
# French Companies API helpers
# ---------------------------------------------------------------------------


def clean_query(text: str) -> str:
    t = text.upper()
    t = re.sub(r"^(CB|PRLV|VIR|SEPA|INST|DAB|RETRAIT|CHEQUE|FACTURE)\s+", "", t)
    t = re.sub(r"\s+(SA|SAS|SARL|EURL)$", "", t)
    t = re.sub(r"[0-9\.\-\*]+", " ", t)
    return " ".join(t.split())


def get_company_info(query: str, cache: dict[str, Any]) -> dict[str, str] | None:
    if not query or len(query) < 3:
        return None
    if query in cache:
        return cache[query]
    try:
        time.sleep(0.2)
        params = {"q": query, "per_page": 1, "minimal": "true", "include": "siege"}
        resp = requests.get(
            API_URL,
            params=params,
            headers={"Accept": "application/json"},
            timeout=5,
        )
        if resp.status_code == 200:
            results = resp.json().get("results", [])
            if results:
                company = results[0]
                info = {
                    "activite": company.get("activite_principale", ""),
                    "section": company.get("section_activite_principale", ""),
                }
                cache[query] = info
                return info
        cache[query] = None
        return None
    except Exception as e:
        logger.error(f"API request failed for {query!r}: {e}")
        return None


def parse_amount(debit: str, credit: str) -> float:
    s = credit if credit and credit.strip() else debit
    if not s:
        return 0.0
    s = s.strip().replace("\xa0", "").replace(" ", "")
    m = re.search(r"([+-]?)[0-9\s\.,]+", s)
    if not m:
        return 0.0
    token = m.group(0).replace("+", "").replace("\u202f", "").replace("\u00a0", "")
    if token.count(",") == 1 and token.count(".") == 0:
        token = token.replace(".", "").replace(",", ".")
    else:
        token = token.replace(",", "")
    try:
        return float(token)
    except ValueError:
        return 0.0


def map_api_result(info: dict[str, str] | None, text_context: str) -> str | None:
    if not info:
        return None
    section = info.get("section")
    activite = info.get("activite", "")
    if section == "G":
        if any(
            x in text_context.lower()
            for x in ["supermarche", "alimentation", "boulangerie", "epicerie"]
        ):
            return "Food & Dining"
        if activite.startswith("47.11"):
            return "Food & Dining"
        return "Shopping"
    if section == "I":
        return "Food & Dining" if activite.startswith("56") else "Leisure & Culture"
    if section == "J":
        return "Housing & Utilities" if activite.startswith("61") else "Leisure & Culture"
    return NAF_MAPPING.get(section, "Other")


def categorize_row(row: dict[str, str], cache: dict[str, Any]) -> tuple[str, str]:
    text = " ".join(
        [
            row.get("Libelle simplifie", ""),
            row.get("Libelle operation", ""),
            row.get("Reference", ""),
            row.get("Informations complementaires", ""),
        ]
    ).lower()

    amount = parse_amount(row.get("Debit", ""), row.get("Credit", ""))

    for cat, keywords in KEYWORD_MAP.items():
        for kw in keywords:
            if kw in text:
                return cat, "keyword"

    if amount > 0:
        return "Income", "amount"

    libelle = row.get("Libelle simplifie", "")
    if libelle:
        clean_name = clean_query(libelle)
        if clean_name and len(clean_name) > 2:
            info = get_company_info(clean_name, cache)
            mapped = map_api_result(info, text)
            if mapped:
                return mapped, "api"

    return "Other", "unknown"


# ---------------------------------------------------------------------------
# CSV parsing (from bytes, not Path)
# ---------------------------------------------------------------------------


def read_csv_bytes(
    content: bytes, filename: str
) -> tuple[list[dict[str, str]], list[str], str]:
    for enc in ("utf-8", "latin-1"):
        try:
            text = content.decode(enc)
            reader = csv.DictReader(io.StringIO(text), delimiter=";")
            rows = list(reader)
            fieldnames = list(reader.fieldnames) if reader.fieldnames else []
            return rows, fieldnames, enc
        except UnicodeDecodeError:
            continue
    logger.error(f"Could not decode {filename}")
    return [], [], "utf-8"


def _parse_date(date_str: str) -> tuple[int, int, int]:
    try:
        parts = date_str.strip().split("/")
        return int(parts[2]), int(parts[1]), int(parts[0])
    except (IndexError, ValueError):
        return (0, 0, 0)


def _row_signature(row: dict[str, str]) -> tuple[str, ...]:
    return (
        row.get("Date de comptabilisation", ""),
        row.get("Libelle operation", ""),
        row.get("Debit", ""),
        row.get("Credit", ""),
        row.get("Reference", ""),
    )


# ---------------------------------------------------------------------------
# Main pipeline entry point
# ---------------------------------------------------------------------------


def process_uploads(
    file_contents: list[tuple[str, bytes]],
    use_llm: bool = True,
) -> dict[str, Any]:
    """Parse uploaded CSV bytes, merge, categorize, and return JSON-serialisable dict."""

    # Step 1: Parse & merge all files
    combined: list[dict[str, str]] = []
    fieldnames: list[str] = []
    seen: set[tuple[str, ...]] = set()

    for filename, content in file_contents:
        rows, fnames, _ = read_csv_bytes(content, filename)
        if not fieldnames and fnames:
            fieldnames = fnames
        for row in rows:
            sig = _row_signature(row)
            if sig not in seen:
                seen.add(sig)
                combined.append(row)
        logger.info(f"Parsed {len(rows)} rows from {filename!r}")

    combined.sort(
        key=lambda r: _parse_date(r.get("Date de comptabilisation", "")),
        reverse=True,
    )

    # Step 2: Filter DEBIT DIFFERE
    debit_differe_total = 0.0
    clean_rows: list[dict[str, str]] = []
    for row in combined:
        libelle = row.get("Libelle operation", "") + row.get("Libelle simplifie", "")
        if "DEBIT DIFFERE" in libelle.upper():
            raw = row.get("Debit", "").replace(",", ".").strip()
            try:
                debit_differe_total += abs(float(raw))
            except ValueError:
                pass
        else:
            clean_rows.append(row)

    removed = len(combined) - len(clean_rows)
    if removed:
        logger.info(
            f"Filtered {removed} DEBIT DIFFERE row(s) totalling {debit_differe_total:,.2f} €"
        )
    rows = clean_rows

    if "predicted_category" not in fieldnames:
        fieldnames.append("predicted_category")
    if "category_source" not in fieldnames:
        fieldnames.append("category_source")

    # Step 3: Load caches
    cache = load_cache()
    llm_cache = load_llm_cache()

    # Step 4: Pass 1 — rules + API
    counts: Counter[str] = Counter()
    unresolved: list[tuple[int, str]] = []

    for i, row in enumerate(rows):
        cat, src = categorize_row(row, cache)
        row["predicted_category"] = cat
        row["category_source"] = src
        counts[cat] += 1
        if src == "unknown":
            libelle = row.get("Libelle operation", "").strip()
            if libelle:
                unresolved.append((i, libelle))
        if (i + 1) % 50 == 0:
            save_cache(cache)

    save_cache(cache)
    logger.info(f"Pass 1 done: {len(unresolved)} unresolved → LLM")

    # Step 5: Pass 2 — LLM
    llm_resolved = 0
    if unresolved and use_llm:
        client = _build_llm_client()
        if client:
            llm_results = classify_batch_with_llm(unresolved, llm_cache, client)
            for row_idx, libelle in unresolved:
                if libelle in llm_results:
                    old_cat = rows[row_idx]["predicted_category"]
                    new_cat = llm_results[libelle]
                    rows[row_idx]["predicted_category"] = new_cat
                    rows[row_idx]["category_source"] = "llm"
                    counts[old_cat] -= 1
                    counts[new_cat] += 1
                    llm_resolved += 1
            save_llm_cache(llm_cache)
        else:
            logger.warning("OPENROUTER_API_KEY not set — skipping LLM classification")

    return {
        "transactions": rows,
        "stats": {
            "total_rows": len(rows),
            "debit_differe_removed": removed,
            "debit_differe_total": round(debit_differe_total, 2),
            "llm_resolved": llm_resolved,
            "llm_unresolved": len(unresolved),
        },
        "category_summary": dict(counts.most_common()),
    }
