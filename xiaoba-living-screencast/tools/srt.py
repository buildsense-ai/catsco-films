#!/usr/bin/env python3
"""events.json captions → catsco-xiaoba.srt (the on-screen captions are drawn by the page itself)."""
import json, re
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
d = json.loads((HERE / "events.json").read_text())
cues = [(s["t0"], s["t1"], re.sub(r"[{}]", "", s["text"])) for s in d["subs"]]   # timed from MiniMax per-character timestamps
ts = lambda t: f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(round((t % 1) * 1000)):03d}"
(HERE / "catsco-xiaoba.srt").write_text("\n".join(f"{i}\n{ts(a)} --> {ts(b)}\n{x}\n" for i, (a, b, x) in enumerate(sorted(cues), 1)), encoding="utf-8")
print(f"catsco-xiaoba.srt: {len(cues)} cues")
