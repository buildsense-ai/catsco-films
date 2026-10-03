#!/usr/bin/env python3
"""Narration via MiniMax (China) speech-2.8-hd: one WAV per line plus per-character timestamps.

    MINIMAX_API_KEY=... python3 tools/tts.py            # only lines whose text changed are regenerated
    → voices/<id>.wav (44.1 kHz mono, leading/trailing silence trimmed)
    → voices/words.json  {id: [[char, t0, t1], ...]}  (seconds, relative to the trimmed WAV)
    → voices/dur.json    {id: seconds}

The key is read from $MINIMAX_API_KEY (or ~/.config/catsco-promo/minimax.key); it never enters the project.
"""
import hashlib, json, os, sys, urllib.request
from pathlib import Path
import numpy as np
from scipy.io import wavfile

HERE = Path(__file__).resolve().parents[1]
API = "https://api.minimaxi.com/v1/t2a_v2"


def key():
    k = os.environ.get("MINIMAX_API_KEY")
    if not k:
        p = Path.home() / ".config/catsco-promo/minimax.key"
        k = p.read_text().strip() if p.exists() else None
    if not k:
        sys.exit("set MINIMAX_API_KEY")
    return k


def synth(text, voice, model, k):
    body = {"model": model, "text": text, "stream": False,
            "voice_setting": {"voice_id": voice, "speed": 0.98, "vol": 1, "pitch": 0},
            "audio_setting": {"sample_rate": 44100, "bitrate": 256000, "format": "wav", "channel": 1},
            "subtitle_enable": True, "subtitle_type": "word"}
    req = urllib.request.Request(API, json.dumps(body).encode(), {"Authorization": f"Bearer {k}", "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=120))
    if d.get("base_resp", {}).get("status_code") != 0:
        sys.exit(f"MiniMax error: {d.get('base_resp')}")
    subs = json.load(urllib.request.urlopen(d["data"]["subtitle_file"], timeout=60))
    return bytes.fromhex(d["data"]["audio"]), subs


def main():
    cfg = json.loads((HERE / "lines.json").read_text())
    out = HERE / "voices"; out.mkdir(exist_ok=True)
    wj, dj, mj = out / "words.json", out / "dur.json", out / ".hash.json"
    words = json.loads(wj.read_text()) if wj.exists() else {}
    dur = json.loads(dj.read_text()) if dj.exists() else {}
    hashes = json.loads(mj.read_text()) if mj.exists() else {}
    k = None
    for ln in cfg["lines"]:
        say = ln.get("say", ln["text"])
        h = hashlib.sha1(f'{cfg["model"]}|{cfg["voice"]}|{say}'.encode()).hexdigest()[:12]
        if hashes.get(ln["id"]) == h and (out / f'{ln["id"]}.wav').exists():
            continue
        k = k or key()
        audio, subs = synth(say, cfg["voice"], cfg["model"], k)
        raw = out / f'{ln["id"]}.raw.wav'; raw.write_bytes(audio)
        sr, x = wavfile.read(raw); raw.unlink()
        x = x.astype(np.float32) / 32768.0
        # trim silence: first/last sample above -45 dBFS, keep 30 ms of air
        env = np.abs(x) > 10 ** (-45 / 20)
        a = max(0, int(np.argmax(env)) - int(0.03 * sr)); b = min(len(x), len(x) - int(np.argmax(env[::-1])) + int(0.06 * sr))
        x = x[a:b]; off = a / sr
        wavfile.write(out / f'{ln["id"]}.wav', sr, (x * 32767).astype(np.int16))
        ws = []
        for seg in subs:
            base = seg.get("time_begin", 0) / 1000
            for w in seg.get("timestamped_words", []):
                ws.append([w["word"], round(w["time_begin"] / 1000 - off, 3), round(w["time_end"] / 1000 - off, 3)])
        words[ln["id"]] = ws; dur[ln["id"]] = round(len(x) / sr, 3); hashes[ln["id"]] = h
        print(f'{ln["id"]}  {dur[ln["id"]]:.2f}s  {ln["text"]}')
    wj.write_text(json.dumps(words, ensure_ascii=False, indent=0))
    dj.write_text(json.dumps(dur, indent=1)); mj.write_text(json.dumps(hashes, indent=1))
    # the page loads this as a script (file:// can't fetch JSON)
    (out / "voices.js").write_text("window.VOICES = " + json.dumps({"words": words, "dur": dur}, ensure_ascii=False) + ";\n")


if __name__ == "__main__":
    main()
