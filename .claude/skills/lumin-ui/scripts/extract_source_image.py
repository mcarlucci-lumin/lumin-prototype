#!/usr/bin/env python3
"""Extract a user-attached image from the current Claude Code session transcript.

Pasted/attached images are not files on disk — they live as base64 inside the
session transcript JSONL. This pulls the earliest user-attached image out and
writes it to a real file so the build can *measure* it (never eyeball / ratio).

Stdlib only — no pip installs.

Usage:
    python3 extract_source_image.py <out_path> [options]

Options:
    --project-dir DIR   Claude projects dir for this repo. Default: derived from
                        cwd as ~/.claude/projects/<abs-cwd-with-slashes-as-dashes>.
    --transcript FILE   Use this transcript instead of the most-recent *.jsonl.
    --index N           Pick the Nth image block (0-based, chronological).
                        Default 0 = the earliest (the user's attachment; later
                        blocks are usually your own browser screenshots).
    --list              List all image blocks found (index, media_type, size) and exit.

Exit codes: 0 ok, 2 no transcript, 3 no image found.
"""
import argparse
import base64
import glob
import json
import os
import sys


def project_dir_from_cwd():
    cwd = os.getcwd()
    slug = cwd.replace("/", "-")
    return os.path.join(os.path.expanduser("~/.claude/projects"), slug)


def most_recent_transcript(pdir):
    files = glob.glob(os.path.join(pdir, "*.jsonl"))
    if not files:
        return None
    return max(files, key=os.path.getmtime)


def walk_images(obj, out):
    """Collect base64 image blocks in document order."""
    if isinstance(obj, dict):
        if obj.get("type") == "image":
            src = obj.get("source", {})
            if src.get("type") == "base64" and src.get("data"):
                out.append((src.get("media_type", "image/png"), src["data"]))
        for v in obj.values():
            walk_images(v, out)
    elif isinstance(obj, list):
        for v in obj:
            walk_images(v, out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out_path", nargs="?")
    ap.add_argument("--project-dir")
    ap.add_argument("--transcript")
    ap.add_argument("--index", type=int, default=0)
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    tx = args.transcript or most_recent_transcript(
        args.project_dir or project_dir_from_cwd()
    )
    if not tx or not os.path.exists(tx):
        print("ERROR: no session transcript found", file=sys.stderr)
        return 2

    images = []
    with open(tx, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                walk_images(json.loads(line), images)
            except (ValueError, TypeError):
                continue

    if not images:
        print("ERROR: no base64 image blocks in transcript", file=sys.stderr)
        return 3

    if args.list:
        for i, (mt, data) in enumerate(images):
            print(f"[{i}] {mt}  ~{len(data) * 3 // 4} bytes")
        return 0

    if not args.out_path:
        print("ERROR: out_path required (or use --list)", file=sys.stderr)
        return 1
    if args.index < 0 or args.index >= len(images):
        print(f"ERROR: --index {args.index} out of range (0..{len(images) - 1})", file=sys.stderr)
        return 3

    media_type, data = images[args.index]
    raw = base64.b64decode(data)
    os.makedirs(os.path.dirname(os.path.abspath(args.out_path)), exist_ok=True)
    with open(args.out_path, "wb") as g:
        g.write(raw)
    print(f"wrote {args.out_path} ({len(raw)} bytes, {media_type}) "
          f"from image block [{args.index}] of {len(images)} in {os.path.basename(tx)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
