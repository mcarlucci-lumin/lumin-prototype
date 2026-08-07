#!/usr/bin/env python3
"""
Search CSS utility classes from ui-styles.
Usage:
  python3 search_utilities.py <query>               -- search by class name or description
  python3 search_utilities.py --category <cat>      -- list all utilities in a category
  python3 search_utilities.py --categories          -- list all categories with counts
  python3 search_utilities.py --base-only           -- exclude responsive variants, show base classes only

Examples:
  python3 search_utilities.py flex center
  python3 search_utilities.py --category spacing
  python3 search_utilities.py --category grid --base-only
  python3 search_utilities.py --categories
  python3 search_utilities.py p-3
"""

import json
import sys
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / "references" / "utilities-registry.json"


def load_data():
    with open(DATA_FILE) as f:
        return json.load(f)


def fmt(u: dict) -> str:
    bp = f"  [{u['breakpoint']}+]" if u.get('breakpoint') else ""
    return f"  .{u['class']:<40}  {u['description']}{bp}"


if __name__ == "__main__":
    args = sys.argv[1:]

    if not args:
        print(__doc__)
        sys.exit(0)

    data = load_data()
    utilities = data["utilities"]

    base_only = "--base-only" in args
    if base_only:
        args = [a for a in args if a != "--base-only"]
        utilities = [u for u in utilities if not u.get("responsive")]

    if "--categories" in args:
        from collections import Counter
        counts = Counter(u["category"] for u in data["utilities"])
        print(f"Categories ({len(counts)} total):\n")
        for cat in sorted(counts):
            print(f"  {cat:<20}  {counts[cat]} classes")
        sys.exit(0)

    if "--category" in args:
        idx = args.index("--category")
        if idx + 1 >= len(args):
            print("Error: --category requires a value", file=sys.stderr)
            sys.exit(1)
        cat = args[idx + 1].lower()
        matches = [u for u in utilities if u["category"].lower() == cat]
        if not matches:
            all_cats = sorted(set(u["category"] for u in data["utilities"]))
            print(f"Category '{cat}' not found. Available: {', '.join(all_cats)}")
            sys.exit(1)
        print(f"Category: {cat}  ({len(matches)} classes)\n")
        for u in matches:
            print(fmt(u))
        sys.exit(0)

    # Keyword search
    query = " ".join(args).lower()
    tokens = query.split()
    matches = [
        u for u in utilities
        if all(t in u["class"].lower() or t in u["description"].lower() or t in u["category"].lower()
               for t in tokens)
    ]

    if not matches:
        print(f"No utilities found for '{query}'.")
        sys.exit(0)

    print(f"Found {len(matches)} utilities for '{query}':\n")
    current_cat = None
    for u in matches:
        if u["category"] != current_cat:
            current_cat = u["category"]
            print(f"\n  [{current_cat}]")
        print(fmt(u))
    print()
