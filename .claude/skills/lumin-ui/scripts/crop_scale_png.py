#!/usr/bin/env python3
"""Crop a region from a PNG and upscale it — standard library only, no installs.

Purpose: the lumin-ui icon-verification step renders candidate glyphs LARGE
(size="xl", ~64px) but the reference `source.png` icon is often only ~30px.
Comparing a big candidate against a tiny source is an invalid comparison and
has produced wrong icon picks. This helper crops the source glyph and upscales
it (nearest-neighbor) so it can be `Read` at the *same* visual size as the
candidates and compared detail-for-detail (open vs. closed flap, dot, arrow).

Nearest-neighbor is intentional: it enlarges without inventing detail, so the
flap/fold topology stays faithful. It does NOT sharpen a genuinely low-res
capture — if the source glyph is tiny and blurry, the enlarged crop will be
blurry too; say the detail is ambiguous rather than guessing.

Usage:
    # crop the icon box (absolute px: x y w h) and upscale 6x
    python3 crop_scale_png.py source.png out.png --region 36 30 30 30 --scale 6

    # fractional region (0..1) — same box as a fraction of W/H
    python3 crop_scale_png.py source.png out.png --region 0.051 0.25 0.043 0.25 --scale 6

    # scale to a target width instead of a factor (height scales proportionally)
    python3 crop_scale_png.py source.png out.png --region 36 30 30 30 --to 256

    # no --region => scale the whole image
    python3 crop_scale_png.py source.png out.png --scale 4

Region coordinates: pass all four as absolute pixels, or all four as fractions
in [0,1) (x,y = top-left; w,h = width,height). Mixing is not supported.
Output is always an 8-bit RGB (colortype 2) PNG.
"""
import argparse
import struct
import sys
import zlib


def load_png(path):
    """Decode a PNG to (W, H, px) where px(x, y) -> (r, g, b). Stdlib only."""
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
        if colort in (2, 6):
            return out[o], out[o + step], out[o + 2 * step]
        if colort == 3:
            idx = out[o]
            return plte[idx * 3], plte[idx * 3 + 1], plte[idx * 3 + 2]
        if colort in (0, 4):
            g = out[o]
            return g, g, g
        raise ValueError("unhandled color type")

    return W, H, px


def write_rgb_png(path, w, h, pixels):
    """Write an 8-bit RGB PNG. `pixels`: flat bytes-like of length w*h*3."""
    def chunk(typ, body):
        return (struct.pack(">I", len(body)) + typ + body
                + struct.pack(">I", zlib.crc32(typ + body) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    raw = bytearray()
    row = w * 3
    for y in range(h):
        raw.append(0)  # filter type 0 (None)
        raw += pixels[y * row:(y + 1) * row]
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n")
        fh.write(chunk(b"IHDR", ihdr))
        fh.write(chunk(b"IDAT", idat))
        fh.write(chunk(b"IEND", b""))


def to_coord(val, size):
    f = float(val)
    return int(round(f * size)) if 0 <= f < 1 else int(round(f))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("img")
    ap.add_argument("out")
    ap.add_argument("--region", nargs=4, metavar=("X", "Y", "W", "H"),
                    help="crop box: four absolute px, or four fractions in [0,1)")
    grp = ap.add_mutually_exclusive_group()
    grp.add_argument("--scale", type=int, help="integer upscale factor (nearest-neighbor)")
    grp.add_argument("--to", type=int, help="target output width in px (height scales to match)")
    args = ap.parse_args()

    W, H, px = load_png(args.img)

    if args.region:
        rx, ry, rw, rh = args.region
        x0 = to_coord(rx, W)
        y0 = to_coord(ry, H)
        cw = to_coord(rw, W)
        ch = to_coord(rh, H)
    else:
        x0 = y0 = 0
        cw, ch = W, H

    x0 = max(0, min(W - 1, x0))
    y0 = max(0, min(H - 1, y0))
    cw = max(1, min(W - x0, cw))
    ch = max(1, min(H - y0, ch))

    if args.to:
        factor = max(1, round(args.to / cw))
    else:
        factor = args.scale if args.scale else 1
    ow, oh = cw * factor, ch * factor

    # Nearest-neighbor upscale.
    pixels = bytearray(ow * oh * 3)
    for oy in range(oh):
        sy = y0 + oy // factor
        for ox in range(ow):
            sx = x0 + ox // factor
            r, g, b = px(sx, sy)
            o = (oy * ow + ox) * 3
            pixels[o] = r
            pixels[o + 1] = g
            pixels[o + 2] = b

    write_rgb_png(args.out, ow, oh, pixels)
    print(f"wrote {args.out}  crop {cw}x{ch} @({x0},{y0})  x{factor} -> {ow}x{oh}")


if __name__ == "__main__":
    sys.exit(main())
