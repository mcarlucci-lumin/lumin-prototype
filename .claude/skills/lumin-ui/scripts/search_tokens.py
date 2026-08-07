#!/usr/bin/env python3
"""
Search design tokens (CSS variables) by name or category.
Usage: python3 search_tokens.py <query> [--category <cat>]

Examples:
  python3 search_tokens.py color
  python3 search_tokens.py --category layout
  python3 search_tokens.py border
"""

import json
import sys
import argparse
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / "references" / "tokens-registry.json"


def load_data():
    with open(DATA_FILE) as f:
        return json.load(f)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Search Lumin design tokens")
    parser.add_argument("query", nargs="?", default="", help="Search term (name or description)")
    parser.add_argument("--category", help="Filter by category")
    args = parser.parse_args()

    data = load_data()
    tokens = data.get("tokens", [])
    q = args.query.lower()

    results = []
    for tok in tokens:
        if args.category and tok.get("category", "").lower() != args.category.lower():
            continue
        if q and q not in tok["name"].lower() and q not in tok.get("description", "").lower():
            continue
        results.append(tok)

    if not results:
        print("No tokens found.")
        sys.exit(0)

    # Group by category
    from collections import defaultdict
    by_cat = defaultdict(list)
    for tok in results:
        by_cat[tok.get("category", "other")].append(tok)

    print(f"Found {len(results)} token(s):\n")
    for cat, toks in sorted(by_cat.items()):
        print(f"  [{cat}]")
        for tok in toks:
            desc = f"  — {tok['description']}" if tok.get("description") else ""
            print(f"    {tok['name']}: {tok['value']}{desc}")
        print()
