#!/usr/bin/env python3
"""Render promo/comp/comp.html frame by frame.

    python3 promo/tools/render.py stills --times 0.6,3.6,8.6 --out promo/out/stills.png
    python3 promo/tools/render.py video  --out promo/out/catsco-promo.mp4 --audio promo/out/mix.wav
    python3 promo/tools/render.py video  --fps 60 --final ...      (60 fps, more shutter samples)

Every frame is a pure function of time (window.__seek), so frames can be rendered in any order by any
number of browsers. Motion blur: each frame is the average, in linear light, of N captures spread over
an open 180-degree shutter. N comes from window.__motion(t0, t1) -- the farthest anything travels on
screen during the shutter -- so a still frame costs one capture and a whip costs up to --max-samples.
"""
import argparse
import io
import math
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
COMP = ROOT / "comp" / "comp.html"
W, H = 1920, 1080

# sRGB <-> linear lookup tables
_LIN = ((np.arange(256) / 255.0 + 0.055) / 1.055) ** 2.4
_LIN[:11] = np.arange(11) / 255.0 / 12.92


def to_srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def open_page(pw, scale=1):
    browser = pw.chromium.launch(args=["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text"])
    page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=scale)
    page.goto(COMP.as_uri())
    page.wait_for_function("window.__ready !== undefined")
    page.evaluate("window.__ready")
    return browser, page


def capture(page, t):
    page.evaluate(f"window.__seek({t:.6f})")
    png = page.screenshot(type="png", animations="disabled", caret="hide")
    im = Image.open(io.BytesIO(png)).convert("RGB")
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    return np.asarray(im)


def frame(page, t, fps, gap, max_samples, shutter=0.5):
    """One output frame at time t: 1..max_samples captures across the shutter, averaged in linear light."""
    open_ = shutter / fps
    t0, t1 = t - open_ / 2, t + open_ / 2
    travel = page.evaluate(f"window.__motion({max(0, t0):.6f}, {t1:.6f})")
    n = int(min(max_samples, max(1, math.ceil(travel / gap))))
    if n == 1:
        return capture(page, t), 1
    acc = np.zeros((H, W, 3), np.float64)
    for i in range(n):
        ts = t0 + open_ * (i + 0.5) / n
        acc += _LIN[capture(page, max(0.0, ts))]
    return (to_srgb(acc / n) * 255 + 0.5).astype(np.uint8), n


def worker(args):
    idx, frames, fps, gap, max_samples, outdir, scale = args
    from playwright.sync_api import sync_playwright

    total = 0
    with sync_playwright() as pw:
        browser, page = open_page(pw, scale)
        for k, fi in enumerate(frames):
            img, n = frame(page, fi / fps, fps, gap, max_samples)
            total += n
            Image.fromarray(img).save(outdir / f"f{fi:05d}.png", compress_level=1)
            if k % 60 == 0:
                print(f"  [w{idx}] frame {fi} ({k + 1}/{len(frames)}) samples={n}", flush=True)
        browser.close()
    return total


def stills(times, out, cols=3, hud=False):
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser, page = open_page(pw)
        tiles = []
        for t in times:
            img = Image.fromarray(capture(page, t))
            tiles.append(img)
            if len(times) == 1:
                img.save(out)
        browser.close()
    if len(times) == 1:
        return
    tw, th = W // 3, H // 3
    rows = math.ceil(len(tiles) / cols)
    sheet = Image.new("RGB", (cols * tw, rows * (th + 26)), "white")
    from PIL import ImageDraw

    d = ImageDraw.Draw(sheet)
    for i, (t, im) in enumerate(zip(times, tiles)):
        x, y = (i % cols) * tw, (i // cols) * (th + 26)
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 26))
        d.text((x + 8, y + 6), f"t = {t:.2f}s", fill=(200, 0, 0))
    sheet.save(out)


def video(out, fps, audio, gap, max_samples, workers, frm, to, scale, crf):
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        b, page = open_page(pw)
        dur = page.evaluate("window.__meta.dur")
        b.close()
    to = dur if to is None else to
    frames = list(range(int(round(frm * fps)), int(round(to * fps))))
    tmp = Path(tempfile.mkdtemp(prefix="catsco-frames-", dir=str(ROOT / "out")))
    chunks = [frames[i::workers] for i in range(workers)]  # interleaved: every worker gets its share of the whips
    print(f"rendering {len(frames)} frames @ {fps} fps with {workers} workers → {tmp}", flush=True)
    with ProcessPoolExecutor(workers) as ex:
        total = sum(ex.map(worker, [(i, c, fps, gap, max_samples, tmp, scale) for i, c in enumerate(chunks)]))
    print(f"captures: {total} ({total / len(frames):.2f} per frame)", flush=True)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-start_number", str(frames[0]), "-i", str(tmp / "f%05d.png")]
    if audio:
        cmd += ["-ss", f"{frm:.3f}", "-t", f"{to - frm:.3f}", "-i", str(audio)]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"]
    if audio:
        cmd += ["-c:a", "aac", "-b:a", "256k", "-shortest"]
    cmd += [str(out)]
    subprocess.run(cmd, check=True)
    for f in tmp.iterdir():
        f.unlink()
    tmp.rmdir()
    print(f"wrote {out}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["stills", "video"])
    ap.add_argument("--times", default="0.6,1.6,2.8,3.6,5.8,6.8,8.0,10.2,11.4")
    ap.add_argument("--out", required=True)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--audio")
    ap.add_argument("--gap", type=float, default=6.0, help="max px between shutter samples")
    ap.add_argument("--max-samples", type=int, default=16)
    ap.add_argument("--workers", type=int, default=max(1, min(8, (os.cpu_count() or 4) - 2)))
    ap.add_argument("--from", dest="frm", type=float, default=0.0)
    ap.add_argument("--to", type=float)
    ap.add_argument("--scale", type=int, default=1, help="2 = supersample (render at 2x, downsample)")
    ap.add_argument("--crf", type=int, default=16)
    ap.add_argument("--final", action="store_true", help="60 fps, tighter shutter gap")
    a = ap.parse_args()
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    if a.mode == "stills":
        stills([float(x) for x in a.times.split(",")], a.out)
    else:
        if a.final:
            a.fps, a.gap, a.max_samples = 60, 4.0, 24
        video(a.out, a.fps, a.audio, a.gap, a.max_samples, a.workers, a.frm, a.to, a.scale, a.crf)


if __name__ == "__main__":
    sys.exit(main())
