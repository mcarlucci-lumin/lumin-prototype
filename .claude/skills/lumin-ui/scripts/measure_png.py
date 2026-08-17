#!/usr/bin/env python3
"""Measure a PNG with the standard library only — no Pillow, no installs.

Use this to get *measured* pixel dimensions from a reference design image
(e.g. a progress-bar height) instead of inferring a size from a ratio, which
the lumin-ui skill forbids because it is unreliable.

Usage:
    python3 measure_png.py <img.png>                 # print size / bitdepth / colortype
    python3 measure_png.py <img.png> --col X          # RLE scan down column X
    python3 measure_png.py <img.png> --row Y          # RLE scan across row Y
    python3 measure_png.py <img.png> --col X --tol 16 # merge colors within tolerance

A column scan prints contiguous same-color runs as:
    <start>-<end> (len=<n>) rgb(r,g,b)
so a horizontal bar shows up as a run whose length IS the bar's pixel height.
Use fractional coordinates too: --col 0.10 means 10% across.

Supports 8-bit PNGs, color types 0 (gray), 2 (RGB), 3 (palette), 4 (gray+A),
6 (RGBA). 16-bit is downsampled to 8-bit.
"""
import argparse
import struct
import sys
import zlib


def load_png(path):
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    pos = 8
    W = H = bitd = colort = None
    idat = b""
    plte = None
    while pos < len(data):
        (ln,) = struct.unpack(">I", data[pos:pos + 4])
        typ = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        if typ == b"IHDR":
            W, H, bitd, colort = struct.unpack(">IIBB", chunk[:10])
        elif typ == b"PLTE":
            plte = chunk
        elif typ == b"IDAT":
            idat += chunk
        elif typ == b"IEND":
            break
        pos += 12 + ln
    if bitd not in (8, 16):
        raise ValueError(f"unsupported bit depth {bitd}")
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[colort]
    bpp = channels * (bitd // 8)
    stride = W * bpp
    raw = zlib.decompress(idat)

    def paeth(a, b, c):
        p = a + b - c
        pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
        return a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)

    out = bytearray()
    prev = bytearray(stride)
    i = 0
    for _ in range(H):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            v = line[x]
            if f == 1:
                v = (v + a) & 255
            elif f == 2:
                v = (v + b) & 255
            elif f == 3:
                v = (v + ((a + b) >> 1)) & 255
            elif f == 4:
                v = (v + paeth(a, b, c)) & 255
            line[x] = v
        out += line
        prev = line

    step = bitd // 8

    def px(x, y):
        o = (y * stride) + x * bpp
        if colort == 2:
            return out[o], out[o + step], out[o + 2 * step]
        if colort == 6:
            return out[o], out[o + step], out[o + 2 * step]
        if colort == 3:
            idx = out[o]
            return plte[idx * 3], plte[idx * 3 + 1], plte[idx * 3 + 2]
        if colort in (0, 4):
            g = out[o]
            return g, g, g
        raise ValueError("unhandled color type")

    return W, H, bitd, colort, px


def rle(seq, tol):
    """seq: list of (r,g,b). Yield (start,end,len,(r,g,b)) merging within tol."""
    if not seq:
        return
    start = 0
    base = seq[0]
    for i in range(1, len(seq) + 1):
        if i < len(seq) and all(abs(seq[i][k] - base[k]) <= tol for k in range(3)):
            continue
        yield start, i - 1, i - start, base
        if i < len(seq):
            start = i
            base = seq[i]


def coord(val, size):
    f = float(val)
    return int(round(f * size)) if 0 <= f < 1 else int(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("img")
    ap.add_argument("--col")
    ap.add_argument("--row")
    ap.add_argument("--tol", type=int, default=12)
    ap.add_argument("--min", type=int, default=1, help="only print runs at least this long")
    args = ap.parse_args()

    W, H, bitd, colort, px = load_png(args.img)
    print(f"size: {W} x {H}  bitdepth {bitd}  colortype {colort}")

    if args.col is not None:
        x = coord(args.col, W)
        x = max(0, min(W - 1, x))
        seq = [px(x, y) for y in range(H)]
        print(f"-- column x={x} (top->bottom) --")
        for s, e, n, col in rle(seq, args.tol):
            if n >= args.min:
                print(f"{s}-{e} (len={n}) rgb{col}")

    if args.row is not None:
        y = coord(args.row, H)
        y = max(0, min(H - 1, y))
        seq = [px(x, y) for x in range(W)]
        print(f"-- row y={y} (left->right) --")
        for s, e, n, col in rle(seq, args.tol):
            if n >= args.min:
                print(f"{s}-{e} (len={n}) rgb{col}")


if __name__ == "__main__":
    sys.exit(main())
