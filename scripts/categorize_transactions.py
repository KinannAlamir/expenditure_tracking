#!/usr/bin/env python3
"""Categorize transactions using rules and the French Companies API.

Reads a semicolon-delimited CSV, infers a category per row, and writes a new CSV.
Uses a local cache for API results to avoid redundant network calls.
"""

import argparse
import csv
import json
import logging
import re
import time
from collections import Counter
from pathlib import Path
from typing import Any

import requests

try:
    from scripts.constants import API_URL, CACHE_FILE, KEYWORD_MAP, NAF_MAPPING
except ImportError:
    from constants import API_URL, CACHE_FILE, KEYWORD_MAP, NAF_MAPPING

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


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


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Categorize transactions using rules and the French Companies API."
    )
    parser.add_argument("input_csv", type=Path, help="Path to the input CSV file")
    args = parser.parse_args()

    input_path: Path = args.input_csv
    if not input_path.exists():
        logger.error(f"File not found: {input_path}")
        return

    out_path = input_path.with_name(f"{input_path.stem}_with_category.csv")

    cache = load_cache()

    # Read CSV (handle encoding)
    rows = []
    fieldnames = []
    encoding = "utf-8"
    try:
        with input_path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=";")
            rows = list(reader)
            fieldnames = list(reader.fieldnames) if reader.fieldnames else []
    except UnicodeDecodeError:
        with input_path.open(newline="", encoding="latin-1") as f:
            reader = csv.DictReader(f, delimiter=";")
            rows = list(reader)
            fieldnames = list(reader.fieldnames) if reader.fieldnames else []
            encoding = "latin-1"

    if "predicted_category" not in fieldnames:
        fieldnames.append("predicted_category")
    if "category_source" not in fieldnames:
        fieldnames.append("category_source")

    logger.info(f"Processing {len(rows)} rows...")

    counts = Counter()
    for i, row in enumerate(rows):
        cat, src = categorize_row(row, cache)
        row["predicted_category"] = cat
        row["category_source"] = src
        counts[cat] += 1

        if (i + 1) % 50 == 0:
            logger.info(f"Processed {i + 1} rows...")
            save_cache(cache)  # Periodic save

    save_cache(cache)

    with out_path.open("w", newline="", encoding=encoding) as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)

    logger.info(f"Done. Output: {out_path}")
    logger.info("Category Summary:")
    for cat, count in counts.most_common():
        logger.info(f"  {cat}: {count}")


if __name__ == "__main__":
    main()
