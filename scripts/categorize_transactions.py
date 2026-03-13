#!/usr/bin/env python3
"""Categorize transactions using rules, the French Companies API, and an LLM.

Reads a semicolon-delimited CSV, infers a category per row, and writes a new CSV.
Uses a local cache for API and LLM results to avoid redundant network calls.
"""

import argparse
import csv
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

try:
    from scripts.constants import (
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
except ImportError:
    from constants import (
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

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()


# --- Helpers ---


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
        # Ensure directory exists
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with CACHE_FILE.open("w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"Could not save cache: {e}")


# --- LLM Helpers ---


def load_llm_cache() -> dict[str, str]:
    """Load cached LLM classification results (libelle -> category)."""
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


def _build_llm_client():  # noqa: ANN202
    """Create an OpenRouter-compatible OpenAI client. Returns None if key is not set."""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        return None
    try:
        from openai import OpenAI

        return OpenAI(
            api_key=api_key,
            base_url=LLM_BASE_URL,
            timeout=30.0,  # 30s max per request
        )
    except Exception as e:
        logger.warning(f"Could not create OpenAI client: {e}")
        return None


def classify_with_llm(
    labels: list[str], client: Any
) -> dict[str, str]:
    """Send a batch of transaction labels to the LLM and return {label: category}.

    The LLM receives the French "Libellé opération" and assigns a category.
    Results are validated against the allowed CATEGORIES list.
    """
    if not client or not labels:
        return {}

    # Build numbered prompt
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
        raw = response.choices[0].message.content or ""
        logger.debug(f"LLM raw response: {raw[:500]}")
        # Strip markdown code fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        # Parse the JSON response
        parsed = json.loads(raw)
        # Handle both {"results": [...]} and bare [...]
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
    """Classify a list of (row_index, libelle) pairs using the LLM.

    Checks the LLM cache first, then batches uncached labels.
    Returns a mapping {libelle: category} for all resolved labels.
    """
    results: dict[str, str] = {}
    to_query: list[str] = []

    # Check cache first
    for _, libelle in unresolved:
        if libelle in llm_cache:
            results[libelle] = llm_cache[libelle]
        elif libelle not in to_query:
            to_query.append(libelle)

    if not to_query or not client:
        return results

    logger.info(
        f"Sending {len(to_query)} uncategorized transactions to LLM "
        f"(in batches of {LLM_BATCH_SIZE})..."
    )

    # Process in batches
    for batch_start in range(0, len(to_query), LLM_BATCH_SIZE):
        batch = to_query[batch_start : batch_start + LLM_BATCH_SIZE]
        batch_results = classify_with_llm(batch, client)
        results.update(batch_results)
        # Update cache immediately
        llm_cache.update(batch_results)
        save_llm_cache(llm_cache)

        if batch_start + LLM_BATCH_SIZE < len(to_query):
            time.sleep(0.5)  # Brief pause between batches

    return results


def clean_query(text: str) -> str:
    """Extract potential company name from transaction label."""
    # Remove common prefixes
    t = text.upper()
    t = re.sub(r"^(CB|PRLV|VIR|SEPA|INST|DAB|RETRAIT|CHEQUE|FACTURE)\s+", "", t)
    t = re.sub(r"\s+(SA|SAS|SARL|EURL)$", "", t)
    # Remove digits and special chars
    t = re.sub(r"[0-9\.\-\*]+", " ", t)
    # Remove extra spaces
    t = " ".join(t.split())
    return t


def get_company_info(query: str, cache: dict[str, Any]) -> dict[str, str] | None:
    if not query or len(query) < 3:
        return None

    if query in cache:
        return cache[query]

    # API Call
    try:
        # Sleep briefly to be nice
        time.sleep(0.2)
        params = {"q": query, "per_page": 1, "minimal": "true", "include": "siege"}
        resp = requests.get(
            API_URL, params=params, headers={"Accept": "application/json"}, timeout=5
        )
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            if results:
                # Get the first result
                company = results[0]
                # Extract NAF info
                activite = company.get("activite_principale", "")
                section = company.get("section_activite_principale", "")
                # Store in cache
                info = {"activite": activite, "section": section}
                cache[query] = info
                return info
            else:
                # Cache empty result to avoid re-querying
                cache[query] = None
                return None
        else:
            logger.warning(f"API Error {resp.status_code} for {query}")
            return None
    except Exception as e:
        logger.error(f"Request failed for {query}: {e}")
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

    # Refinements based on NAF code or text context
    if section == "G":  # Commerce
        # Check if it's food
        if any(
            x in text_context.lower()
            for x in ["supermarche", "alimentation", "boulangerie", "epicerie"]
        ):
            return "Food & Dining"
        # 47.11 is supermarkets
        if activite.startswith("47.11"):
            return "Food & Dining"
        return "Shopping"

    if section == "I":  # Accommodation & Food
        # 55 is hotels, 56 is restaurants
        if activite.startswith("56"):
            return "Food & Dining"
        return "Leisure & Culture"  # Hotels

    if section == "J":  # Info & Comm
        # 61 is Telecom
        if activite.startswith("61"):
            return "Housing & Utilities"
        return "Leisure & Culture"  # Media, Publishing

    return NAF_MAPPING.get(section, "Other")


def categorize_row(row: dict[str, str], cache: dict[str, Any]) -> tuple[str, str]:
    # 1. Check existing category mapping (if reliable)
    # (Skipping this for now to prioritize our new compact categories,
    # unless the bank category is very specific)

    text = " ".join(
        [
            row.get("Libelle simplifie", ""),
            row.get("Libelle operation", ""),
            row.get("Reference", ""),
            row.get("Informations complementaires", ""),
        ]
    ).lower()

    amount = parse_amount(row.get("Debit", ""), row.get("Credit", ""))

    # 2. High-confidence keywords (Transfers, Bank Fees, etc.)
    for cat, keywords in KEYWORD_MAP.items():
        for kw in keywords:
            if kw in text:
                return cat, "keyword"

    # 3. Amount sign heuristic for Income
    if amount > 0:
        # If it's positive and not matched above, it's likely Income
        # (unless it's a refund, but we can't easily tell without more info)
        return "Income", "amount"

    # 4. API Lookup for Expenses
    libelle = row.get("Libelle simplifie", "")
    if libelle:
        clean_name = clean_query(libelle)
        # Only query if it looks like a company name (not empty, not just numbers)
        if clean_name and len(clean_name) > 2:
            info = get_company_info(clean_name, cache)
            mapped = map_api_result(info, text)
            if mapped:
                return mapped, "api"

    # 5. Fallback
    return "Other", "unknown"


# --- CSV I/O ---


def read_csv(path: Path) -> tuple[list[dict[str, str]], list[str], str]:
    """Read a semicolon-delimited CSV. Returns (rows, fieldnames, encoding)."""
    for enc in ("utf-8", "latin-1"):
        try:
            with path.open(newline="", encoding=enc) as f:
                reader = csv.DictReader(f, delimiter=";")
                rows = list(reader)
                fieldnames = list(reader.fieldnames) if reader.fieldnames else []
                return rows, fieldnames, enc
        except UnicodeDecodeError:
            continue
    logger.error(f"Could not read {path} with utf-8 or latin-1 encoding")
    return [], [], "utf-8"


def _parse_date(date_str: str) -> tuple[int, int, int]:
    """Parse DD/MM/YYYY into a sortable (year, month, day) tuple."""
    try:
        parts = date_str.strip().split("/")
        return int(parts[2]), int(parts[1]), int(parts[0])
    except (IndexError, ValueError):
        return (0, 0, 0)


def _row_signature(row: dict[str, str]) -> tuple[str, ...]:
    """Build a unique signature for a row to detect duplicates."""
    return (
        row.get("Date de comptabilisation", ""),
        row.get("Libelle operation", ""),
        row.get("Debit", ""),
        row.get("Credit", ""),
        row.get("Reference", ""),
    )


def merge_and_sort(
    all_files: list[Path],
) -> tuple[list[dict[str, str]], list[str], str]:
    """Read multiple CSVs, deduplicate rows, and sort by date (newest first)."""
    combined: list[dict[str, str]] = []
    fieldnames: list[str] = []
    encoding = "utf-8"
    seen: set[tuple[str, ...]] = set()

    for path in all_files:
        if not path.exists():
            logger.warning(f"File not found, skipping: {path}")
            continue
        rows, fnames, enc = read_csv(path)
        if not fieldnames:
            fieldnames = fnames
            encoding = enc
        for row in rows:
            sig = _row_signature(row)
            if sig not in seen:
                seen.add(sig)
                combined.append(row)
        logger.info(f"Read {len(rows)} rows from {path.name}")

    # Sort by date descending (newest first)
    combined.sort(
        key=lambda r: _parse_date(r.get("Date de comptabilisation", "")),
        reverse=True,
    )

    logger.info(
        f"Merged total: {len(combined)} unique rows from {len(all_files)} file(s)"
    )
    return combined, fieldnames, encoding


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Categorize transactions using rules, the French Companies API, and an LLM."
    )
    parser.add_argument(
        "input_csvs",
        type=Path,
        nargs="+",
        help="One or more input CSV files to merge and categorize",
    )
    parser.add_argument(
        "--no-llm",
        action="store_true",
        help="Disable LLM classification (rules + API only)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output CSV path (default: <first_input>_with_category.csv)",
    )
    args = parser.parse_args()

    out_path = args.output or args.input_csvs[0].with_name(
        f"{args.input_csvs[0].stem}_with_category.csv"
    )

    cache = load_cache()
    llm_cache = load_llm_cache()

    # --- Step 0: Merge input files ---
    rows, fieldnames, encoding = merge_and_sort(args.input_csvs)

    if not rows:
        logger.error("No rows found in input files.")
        return

    if "predicted_category" not in fieldnames:
        fieldnames.append("predicted_category")
    if "category_source" not in fieldnames:
        fieldnames.append("category_source")

    logger.info(f"Processing {len(rows)} rows...")

    # --- Pass 1: Rules + API ---
    counts = Counter()
    unresolved: list[tuple[int, str]] = []  # (row_index, libelle)

    for i, row in enumerate(rows):
        cat, src = categorize_row(row, cache)
        row["predicted_category"] = cat
        row["category_source"] = src
        counts[cat] += 1

        # Collect rows that fell through to "Other/unknown" for LLM pass
        if src == "unknown":
            libelle = row.get("Libelle operation", "").strip()
            if libelle:
                unresolved.append((i, libelle))

        if (i + 1) % 50 == 0:
            logger.info(f"Processed {i + 1} rows (pass 1)...")
            save_cache(cache)

    save_cache(cache)
    logger.info(
        f"Pass 1 complete: {len(unresolved)} transactions unresolved → sending to LLM"
    )

    # --- Pass 2: LLM classification for unresolved rows ---
    if unresolved and not args.no_llm:
        client = _build_llm_client()
        if client:
            llm_results = classify_batch_with_llm(unresolved, llm_cache, client)
            llm_resolved = 0
            for row_idx, libelle in unresolved:
                if libelle in llm_results:
                    old_cat = rows[row_idx]["predicted_category"]
                    new_cat = llm_results[libelle]
                    rows[row_idx]["predicted_category"] = new_cat
                    rows[row_idx]["category_source"] = "llm"
                    counts[old_cat] -= 1
                    counts[new_cat] += 1
                    llm_resolved += 1
            logger.info(f"LLM resolved {llm_resolved}/{len(unresolved)} transactions")
            save_llm_cache(llm_cache)
        else:
            logger.warning(
                "OPENROUTER_API_KEY not set — skipping LLM classification. "
                "Set it in .env to enable LLM-based categorization."
            )

    with out_path.open("w", newline="", encoding=encoding) as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)

    logger.info(f"Done. Output: {out_path}")
    logger.info("Category Summary:")
    for cat, count in counts.most_common():
        if count > 0:
            logger.info(f"  {cat}: {count}")


if __name__ == "__main__":
    main()
