#!/usr/bin/env python3
"""Render the film page frame by frame (window.render(t) is pure, so frames go to any worker in any order).

    python3 tools/render.py events                          → events.json (DUR, SECS, EV, SUBS) for sound + subtitles
    python3 tools/render.py stills 1.2,3,8.5 out/s.jpg      → contact sheet (3 per row); one time → full frame
    python3 tools/render.py video out/video.mp4 [--from a --to b --workers 8]

Captures are JPEG (much faster than PNG); one browser per worker; 1920×1080 at window.FPS (24).
Motion blur on whips is drawn inside the page (directional, from the camera speed).
"""
import argparse, io, json, math, os, subprocess, sys, tempfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
PAGE = (HERE / "index.html").as_uri()


def open_page(pw):
    b = pw.chromium.launch(args=["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text"])
    p = b.new_page(viewport={"width": 1920, "height": 1080})
    errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(PAGE)
    try:
        p.wait_for_function("window.READY === true", timeout=20000)
    except Exception:
        sys.exit(f"page failed to become READY: {errors}")
    if errors:
        sys.exit(f"page errors: {errors}")
    return b, p, errors


def shot(p, t, quality=92):
    p.evaluate(f"window.render({t:.5f})")
    return p.screenshot(type="jpeg", quality=quality)


def events():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b, p, _ = open_page(pw)
        d = p.evaluate("({dur: window.DUR, fps: window.FPS, secs: window.SECS, ev: window.EV, subs: window.SUBS, T: window.T})")
        b.close()
    (HERE / "events.json").write_text(json.dumps(d, ensure_ascii=False, indent=1))
    print(f"events.json: {len(d['ev'])} events, {len(d['subs'])} captions, {d['dur']} s")


def stills(times, out):
    from playwright.sync_api import sync_playwright
    from PIL import Image, ImageDraw
    with sync_playwright() as pw:
        b, p, err = open_page(pw)
        ims = [Image.open(io.BytesIO(shot(p, t))) for t in times]
        if err:
            print("page errors:", err)
        b.close()
    if len(ims) == 1:
        ims[0].save(out, quality=92); return
    tw, th, cols = 640, 360, 3
    rows = math.ceil(len(ims) / cols)
    sheet = Image.new("RGB", (cols * tw, rows * (th + 24)), "white")
    d = ImageDraw.Draw(sheet)
    for i, (t, im) in enumerate(zip(times, ims)):
        x, y = (i % cols) * tw, (i // cols) * (th + 24)
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 24))
        d.text((x + 6, y + 5), f"{t:.2f}s", fill=(200, 0, 0))
    sheet.save(out, quality=90)


def worker(a):
    idx, frames, fps, tmp = a
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b, p, err = open_page(pw)
        for k, f in enumerate(frames):
            (Path(tmp) / f"f{f:05d}.jpg").write_bytes(shot(p, f / fps))
            if k % 100 == 0:
                print(f"  [w{idx}] {k}/{len(frames)}", flush=True)
        b.close()
        return err


def video(out, frm, to, workers):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b, p, _ = open_page(pw)
        dur, fps = p.evaluate("[window.DUR, window.FPS]")
        b.close()
    to = dur if to is None else to
    frames = list(range(int(round(frm * fps)), int(round(to * fps))))
    tmp = tempfile.mkdtemp(prefix="frames-", dir=str(HERE / "out"))
    print(f"{len(frames)} frames @ {fps} fps, {workers} workers")
    with ProcessPoolExecutor(workers) as ex:
        errs = [e for r in ex.map(worker, [(i, frames[i::workers], fps, tmp) for i in range(workers)]) for e in r]
    if errs:
        print("page errors during render:", errs[:5])
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-start_number", str(frames[0]), "-i", f"{tmp}/f%05d.jpg",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709",
                    "-colorspace", "bt709", "-movflags", "+faststart", str(out)], check=True)
    for f in Path(tmp).iterdir():
        f.unlink()
    Path(tmp).rmdir()
    print("wrote", out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["events", "stills", "video"])
    ap.add_argument("args", nargs="*")
    ap.add_argument("--from", dest="frm", type=float, default=0)
    ap.add_argument("--to", type=float)
    ap.add_argument("--workers", type=int, default=max(1, min(8, (os.cpu_count() or 4) - 2)))
    a = ap.parse_args()
    (HERE / "out").mkdir(exist_ok=True)
    if a.mode == "events":
        events()
    elif a.mode == "stills":
        stills([float(x) for x in a.args[0].split(",")], a.args[1])
    else:
        video(a.args[0], a.frm, a.to, a.workers)
