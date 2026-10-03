#!/usr/bin/env python3
"""The CatsCo promo soundtrack: original music + sound design, synthesised from promo/comp/timeline.js.

    python3 promo/tools/score.py            → promo/out/mix.wav (+ music.wav, sfx.wav stems)

Everything is generated here, so there is nothing to license. The music follows the film's sections
(120 BPM, D major: Dmaj9 · Bm9 · Gmaj7 · Asus4→A, two seconds a chord); the sound effects are placed
from the timeline's events, so a retimed cue takes its sound with it. SFX and music share one room
(a convolution reverb), the music ducks under the kick and under every hit, and the mix is mastered
to about -16 LUFS integrated with a -1.5 dBTP ceiling.
"""
import json
import re
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, lfilter, resample_poly, sosfilt
from scipy.ndimage import minimum_filter1d, uniform_filter1d

ROOT = Path(__file__).resolve().parents[1]
SR = 48000
TL = json.loads(re.search(r"window\.TL\s*=\s*(\{.*\});", (ROOT / "comp" / "timeline.js").read_text(), re.S).group(1))
DUR, BPM = TL["dur"], TL["bpm"]
BEAT = 60 / BPM
N = int(DUR * SR)
C = TL["cues"]
rng = np.random.default_rng(7)


def sec(name):
    s = next(x for x in TL["sections"] if x["name"] == name)
    return s["start"], s["end"]


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def env(dur, a=0.005, d=0.3, s=0.0, r=0.05, curve=4.0):
    """Attack / exponential decay to sustain / release, as one array."""
    t = tt(dur)
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-curve * (t - a) / max(d, 1e-6)))
    rel = np.clip((dur - t) / max(r, 1e-6), 0, 1)
    return e * rel


def lp(x, f, order=2):
    return sosfilt(butter(order, min(f, SR / 2 * 0.95), "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, f0, f1, order=2):
    return sosfilt(butter(order, [f0, min(f1, SR / 2 * 0.95)], "band", fs=SR, output="sos"), x)


def saw(f, t, phase=0.0):
    p = (f * t + phase) % 1.0
    return 2 * p - 1


def sweep_bp(x, f0, f1, q=2.0, steps=48):
    """Band-pass whose centre glides f0→f1 (done in blocks; smooth enough for noise)."""
    out = np.zeros_like(x)
    idx = np.linspace(0, len(x), steps + 1).astype(int)
    for i in range(steps):
        f = f0 * (f1 / f0) ** (i / max(1, steps - 1))
        lo, hi = f / (1 + 1 / q), f * (1 + 1 / q)
        seg = bp(x, lo, hi, 2)
        w = np.zeros(len(x))
        a, b = idx[i], idx[i + 1]
        w[a:b] = 1
        out += seg * w
    return out


class Bus:
    def __init__(self):
        self.L = np.zeros(N + SR * 4)
        self.R = np.zeros(N + SR * 4)
        self.send = np.zeros(N + SR * 4)

    def add(self, sig, t, gain=1.0, pan=0.0, send=0.0, pan_to=None):
        i = int(round(t * SR))
        if i >= len(self.L):
            return
        sig = sig[: len(self.L) - i] * gain
        if pan_to is None:
            p = np.full(len(sig), pan)
        else:
            p = np.linspace(pan, pan_to, len(sig))
        th = (np.clip(p, -1, 1) + 1) * np.pi / 4
        self.L[i:i + len(sig)] += sig * np.cos(th)
        self.R[i:i + len(sig)] += sig * np.sin(th)
        self.send[i:i + len(sig)] += sig * send


def room_ir(t60=1.5, pre=0.014, seed=3):
    r = np.random.default_rng(seed)
    t = tt(t60 * 1.2)
    decay = np.exp(-6.9 * t / t60)
    irs = []
    for ch in range(2):
        n = r.standard_normal(len(t)) * decay
        n = lp(n, 7000) * 0.7 + lp(n, 2500) * 0.3
        early = np.zeros(len(t))
        for d, g in [(0.011, 0.5), (0.019, 0.35), (0.031, 0.25)]:
            early[int((d + 0.003 * ch) * SR)] += g
        ir = np.concatenate([np.zeros(int(pre * SR)), n * 0.12 + early])
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return irs


# ─────────────────────────────────── instruments ───────────────────────────────────
def pad_voice(m, dur, bright=1.0):
    t = tt(dur)
    f = mtof(m)
    x = sum(saw(f * (1 + d), t, ph) for d, ph in [(-0.006, 0.1), (0.0, 0.5), (0.0055, 0.8)]) / 3
    x = lp(x, 900 + 1400 * bright, 2)
    a = np.minimum(1, t / 0.35) * np.minimum(1, (dur - t) / 0.5).clip(0, 1)
    return x * a


def ep(m, dur=0.5, vel=1.0):
    """Soft electric-piano-ish bell: FM sine."""
    t = tt(dur)
    f = mtof(m)
    mod = np.sin(2 * np.pi * f * 2 * t) * 1.6 * np.exp(-9 * t)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-5 * t)
    x += 0.25 * np.sin(2 * np.pi * f * 4.01 * t) * np.exp(-14 * t)
    return x * vel * np.minimum(1, t / 0.003) * np.clip((dur - t) / 0.04, 0, 1)


def kick(vel=1.0, dur=0.42):
    t = tt(dur)
    f = 46 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 300) * 0.25
    return np.tanh(1.6 * (x + click)) * vel


def clap(vel=1.0):
    t = tt(0.35)
    n = bp(rng.standard_normal(len(t)), 900, 5200)
    e = np.zeros(len(t))
    for d in (0, 0.011, 0.022):
        e += np.where(t >= d, np.exp(-(t - d) * 180), 0) * 0.5
    e += np.where(t >= 0.03, np.exp(-(t - 0.03) * 16), 0)
    return n * e * vel * 0.6


def hat(vel=1.0, open_=False):
    t = tt(0.25 if open_ else 0.06)
    x = hp(rng.standard_normal(len(t)), 7000, 2)
    return x * np.exp(-t * (14 if open_ else 70)) * vel


def shaker(vel=1.0):
    t = tt(0.09)
    x = bp(rng.standard_normal(len(t)), 4000, 11000)
    e = np.sin(np.pi * np.clip(t / 0.09, 0, 1)) ** 2
    return x * e * vel


def bass(m, dur):
    t = tt(dur)
    f = mtof(m)
    x = np.sin(2 * np.pi * f * t) + 0.35 * lp(saw(f, t), 700)
    return np.tanh(1.4 * x) * env(dur, 0.006, dur * 0.9, 0.55, 0.05, 2.0)


def sub(f=52, dur=1.1):
    t = tt(dur)
    fr = f * (1 + 1.2 * np.exp(-t * 20))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR)
    return np.tanh(1.8 * x) * np.exp(-t * 3.2) * np.minimum(1, t / 0.002)


def noise(dur):
    return rng.standard_normal(int(dur * SR))


# ─────────────────────────────────── the music ───────────────────────────────────
# (root midi, chord tones for the pad, arp notes, bass note)
PROG = [
    ("Dmaj9", [50, 57, 61, 64, 66], [62, 66, 69, 73, 76, 73, 69, 66], 38),
    ("Bm9",   [47, 54, 57, 61, 62], [59, 62, 66, 69, 73, 69, 66, 62], 35),
    ("Gmaj7", [43, 50, 54, 57, 59], [55, 59, 62, 66, 71, 66, 62, 59], 31),
    ("Asus4", [45, 52, 57, 59, 62], [57, 62, 64, 69, 74, 69, 64, 62], 33),
]
A_MAJ = [45, 52, 56, 59, 64]


def chord_at(t):
    bar = int(t // 2) % 4
    return PROG[bar]


def music():
    m = Bus()
    kicks = []
    i0, i1 = sec("intro")
    b0, b1 = sec("build")
    g0, g1 = sec("groove")
    k0, k1 = sec("breakdown")
    h0, h1 = sec("hits")
    l0, l1 = sec("lockup")

    # pad: whole film except the hit gap; each chord two seconds, overlapping a little
    t = 0.0
    while t < h0:
        name, tones, _, _ = chord_at(t)
        if name == "Asus4" and (t % 8) >= 6.0:
            tones = tones if (t % 2) < 1 else A_MAJ
        bright = 0.35 if t < b0 else 0.6 if t < k0 else 0.25
        for j, n in enumerate(tones):
            m.add(pad_voice(n, 2.3, bright), t, 0.075 if t < k0 else 0.06, pan=(-0.35 + 0.18 * j), send=0.45)
        t += 2.0
    # final chord at the logo: Dmaj9 with an added high A, long
    for j, n in enumerate([38, 50, 57, 61, 64, 66, 69, 76]):
        m.add(pad_voice(n, l1 - l0 + 0.2, 0.45), l0, 0.07, pan=(-0.4 + 0.11 * j), send=0.55)

    # a bell under each hook line
    for tq, n in [(C["line1"], 69), (C["line2"], 71), (C["line3"], 73)]:
        m.add(ep(n, 1.4, 0.9), tq, 0.16, pan=0.1, send=0.5)
        m.add(ep(n - 12, 1.4, 0.6), tq, 0.10, pan=-0.1, send=0.5)

    # drums
    def bars(a, b):
        return np.arange(a, b - 1e-6, BEAT)

    for tb in bars(b0, b1):
        v = 0.45 + 0.35 * (tb - b0) / (b1 - b0)
        m.add(kick(v), tb, 0.55, send=0.05)
        kicks.append((tb, v * 0.6))
    for tb in np.arange(b0, b1 - 1e-6, BEAT / 4):
        v = 0.25 + 0.2 * (((tb - b0) / (BEAT / 4)) % 2)
        m.add(shaker(v), tb, 0.10, pan=0.25, send=0.15)
    groove_end = k0
    for tb in bars(g0, groove_end):
        m.add(kick(1.0), tb, 0.6, send=0.05)
        kicks.append((tb, 1.0))
        beat_in_bar = int(round((tb - g0) / BEAT)) % 4
        if beat_in_bar in (1, 3):
            m.add(clap(0.9), tb, 0.30, pan=0.05, send=0.35)
        m.add(hat(0.5, open_=True), tb + BEAT / 2, 0.07, pan=-0.2, send=0.2)
    for tb in np.arange(g0, groove_end - 1e-6, BEAT / 4):
        step = int(round((tb - g0) / (BEAT / 4))) % 4
        m.add(hat(0.35 if step % 2 else 0.2), tb, 0.08, pan=0.3, send=0.1)
    # bass: off-beat eighths on the chord's root, octave on the last
    for tb in np.arange(g0, groove_end - 1e-6, BEAT / 2):
        name, _, _, root = chord_at(tb)
        step = int(round((tb - g0) / (BEAT / 2))) % 8
        n = root + (12 if step == 7 else 0)
        m.add(lp(bass(n, BEAT / 2 * 0.92), 900), tb, 0.30 if step % 2 else 0.22, send=0.0)
    # arp: 16ths from the chord, brighter over the section
    for tb in np.arange(g0, groove_end - 1e-6, BEAT / 4):
        name, _, arp, _ = chord_at(tb)
        step = int(round((tb - g0) / (BEAT / 4))) % 8
        prog_ = (tb - g0) / (groove_end - g0)
        m.add(lp(ep(arp[step], 0.28, 0.8), 2500 + 3000 * prog_), tb, 0.055, pan=0.45 * np.sin(tb * 1.3), send=0.35)

    # breakdown → hits: riser (noise sweep + rising tone) into the logo
    r_dur = l0 - k0
    rise = sweep_bp(noise(r_dur), 300, 7000, q=3.0) * np.linspace(0, 1, int(r_dur * SR)) ** 2
    m.add(rise, k0, 0.20, send=0.3)
    tr = tt(r_dur)
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (2 * tr / r_dur)) / SR) * (tr / r_dur) ** 3 * 0.5
    m.add(lp(tone, 3000), k0, 0.10, send=0.4)

    # lockup: a light groove returns under the name, then leaves the chord ringing alone
    for tb in bars(l0, l0 + 3.0):
        m.add(kick(0.7), tb, 0.45, send=0.05)
        kicks.append((tb, 0.7))
        m.add(hat(0.3, open_=True), tb + BEAT / 2, 0.05, pan=-0.2, send=0.2)
    for j, (dt, n) in enumerate([(0, 74), (0.25, 78), (0.5, 81), (0.75, 85), (1.0, 88)]):
        m.add(ep(n, 1.8, 0.8), l0 + 0.4 + dt, 0.07, pan=-0.3 + 0.15 * j, send=0.6)
    m.add(sub(36.7, 2.4), l0, 0.55)
    return m, kicks


# ─────────────────────────────────── the sound design ───────────────────────────────────
def glass(f, dur=0.9, bright=0.6):
    t = tt(dur)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 5)
    x += 0.45 * bright * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 11)
    x += 0.25 * bright * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 20)
    x += 0.2 * hp(noise(dur), 2000) * np.exp(-t * 120)
    return x * np.minimum(1, t / 0.002)


def wood(f=180, dur=0.12):
    t = tt(dur)
    fr = f * (1 + 0.4 * np.exp(-t * 60))
    body = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 45)
    snap = bp(noise(dur), 2500, 5000) * np.exp(-t * 260) * 0.5
    return body + snap


def key_click(v=1.0):
    t = tt(0.05)
    x = bp(noise(0.05), 1800, 6500) * np.exp(-t * 180) + 0.4 * np.sin(2 * np.pi * 420 * t) * np.exp(-t * 90)
    return x * v


def air(dur, f0, f1, q=1.6):
    x = sweep_bp(noise(dur), f0, f1, q)
    return lp(x, 6500) * np.sin(np.pi * np.linspace(0, 1, int(dur * SR))) ** 1.5


def bubble(f=520, dur=0.14):
    t = tt(dur)
    fr = f * (1 + 1.1 * t / dur)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.sin(np.pi * t / dur) ** 0.7 * np.exp(-t * 14)


def sfx(kicks):
    s = Bus()
    hits = []  # (t, depth) for music ducking
    for e in TL["events"]:
        t, k, pan = e["t"], e["kind"], e.get("pan", 0.0)
        if k == "key":
            s.add(key_click(1.0), t, 0.75, pan, 0.15)
            s.add(wood(140, 0.14), t, 0.40, pan, 0.2)
            hits.append((t, 0.25))
        elif k == "suck":
            s.add(air(0.32, 5000, 700, 2.2), t - 0.05, 0.35, pan, 0.4)
        elif k == "open":
            s.add(bubble(300, 0.25), t, 0.35, pan, 0.4)
            s.add(air(0.5, 600, 2400, 1.8), t, 0.20, pan, 0.4)
            hits.append((t, 0.35))
        elif k == "pop":
            s.add(bubble(620, 0.13), t, 0.34, pan, 0.25)
        elif k == "typing":
            tk = t
            i = 0
            while tk < e["until"]:
                v = 0.55 + 0.45 * rng.random()
                s.add(key_click(v), tk, 0.36 if i % 3 else 0.5, pan + 0.1 * (rng.random() - 0.5), 0.1)
                tk += 0.07 + 0.06 * rng.random()
                i += 1
        elif k == "tap":
            s.add(wood(210, 0.1), t, 0.36, pan, 0.15)
            s.add(wood(260, 0.08), t + 0.06, 0.18, pan, 0.15)
        elif k == "send":
            s.add(air(0.35, 900, 4200, 2.0), t, 0.28, pan, 0.3, pan_to=pan + 0.2)
        elif k == "glass":
            s.add(glass(e.get("f", 1760), 0.9, 0.5), t, 0.16, pan, 0.45)
        elif k == "token":
            s.add(glass(1175, 1.4, 0.7), t, 0.16, pan, 0.55)
            s.add(glass(1760, 1.2, 0.5), t + 0.06, 0.10, pan, 0.55)
        elif k == "whoosh":
            d = e.get("dur", 0.8)
            s.add(air(d, 250, 2800, 1.4), t, 0.40, pan, 0.45, pan_to=e.get("pan_to", pan))
            s.add(air(d, 1200, 7000, 2.5), t + d * 0.15, 0.14, pan, 0.45, pan_to=e.get("pan_to", pan))
        elif k == "land":
            s.add(sub(62, 0.5), t, 0.34, pan, 0.1)
            s.add(wood(120, 0.16), t, 0.30, pan, 0.3)
            hits.append((t, 0.5))
        elif k == "node":
            s.add(glass(880, 1.0, 0.6), t, 0.18, pan, 0.5)
            s.add(bubble(440, 0.18), t, 0.22, pan, 0.3)
        elif k == "lines":
            tk = t
            while tk < e["until"]:
                s.add(key_click(0.8), tk, 0.45, pan, 0.1)
                s.add(wood(300, 0.05), tk, 0.12, pan, 0.1)
                tk += 0.13
        elif k == "error":
            s.add(glass(587, 0.6, 0.9), t, 0.18, pan, 0.35)
            s.add(glass(554, 0.6, 0.9), t + 0.08, 0.16, pan, 0.35)
            s.add(wood(100, 0.2), t, 0.25, pan, 0.2)
        elif k == "pass":
            for j, f in enumerate([1175, 1480, 1760]):
                s.add(glass(f, 1.3, 0.55), t + 0.045 * j, 0.14, pan, 0.5)
            hits.append((t, 0.3))
        elif k == "ticks":
            tk, j = t, 0
            steps = [1175, 1319, 1480, 1568, 1760, 1976]
            while tk < e["until"]:
                s.add(glass(steps[j % len(steps)], 0.35, 0.3), tk, 0.08, pan, 0.3)
                tk += 0.21
                j += 1
        elif k == "split":
            s.add(air(0.45, 500, 3500, 2.0), t, 0.26, pan - 0.2, 0.4, pan_to=pan + 0.3)
            s.add(bubble(700, 0.12), t + 0.2, 0.22, pan + 0.3, 0.3)
        elif k == "found":
            s.add(glass(1568, 1.2, 0.6), t, 0.18, pan, 0.5)
            s.add(glass(2093, 1.0, 0.4), t + 0.07, 0.12, pan, 0.5)
        elif k == "merge":
            s.add(air(0.35, 3000, 600, 2.0), t, 0.24, pan, 0.35, pan_to=pan - 0.3)
            s.add(bubble(520, 0.15), t + 0.3, 0.26, pan - 0.3, 0.3)
        elif k == "hit":
            s.add(sub(49, 1.0), t, 0.60, 0, 0.15)
            s.add(clap(1.0), t, 0.14, 0, 0.5)
            s.add(hp(noise(0.25), 3000) * np.exp(-tt(0.25) * 28), t, 0.10, 0, 0.5)
            hits.append((t, 0.8))
        elif k == "logo":
            for j, f in enumerate([587, 880, 1175, 1480, 1760]):
                s.add(glass(f, 2.6, 0.5), t + 0.02 * j, 0.11, -0.3 + 0.15 * j, 0.6)
            s.add(wood(90, 0.3), t, 0.3, 0, 0.3)
            hits.append((t, 0.6))
    for e in TL["events"]:
        if e["kind"] in ("typing", "lines"):
            tk = e["t"]
            while tk < e["until"]:
                hits.append((tk, 0.3))
                tk += 0.12
    return s, hits


# ─────────────────────────────────── mix & master ───────────────────────────────────
def duck_curve(events, n, release=0.16):
    g = np.ones(n)
    t = np.arange(n) / SR
    for th, depth in events:
        i = int(th * SR)
        j = min(n, i + int(release * 6 * SR))
        if i >= n:
            continue
        seg = t[i:j] - th
        g[i:j] = np.minimum(g[i:j], 1 - depth * np.exp(-seg / release))
    # 3 ms attack so the duck does not click
    return uniform_filter1d(g, int(0.003 * SR))


def k_weight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return lfilter(b2, a2, lfilter(b1, a1, x))


def lufs(L, R):
    kl, kr = k_weight(L), k_weight(R)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([np.mean(kl[i:i + blk] ** 2) + np.mean(kr[i:i + blk] ** 2) for i in range(0, len(L) - blk, hop)])
    ld = -0.691 + 10 * np.log10(ms + 1e-12)
    g = ms[ld > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g = ms[ld > max(-70, rel)]
    return -0.691 + 10 * np.log10(np.mean(g))


def true_peak(x):
    return np.max(np.abs(resample_poly(x, 4, 1)))


def limit(L, R, ceil):
    win = int(0.004 * SR)
    def peaks(x):  # inter-sample peak per original sample (4x oversampled)
        u = np.abs(resample_poly(x, 4, 1))[: 4 * len(x)]
        return u.reshape(-1, 4).max(1)

    for _ in range(4):
        pk = np.maximum(peaks(L), peaks(R))
        g = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
        g = minimum_filter1d(g, 2 * win)
        g = uniform_filter1d(g, win)
        L, R = L * g, R * g
    return L, R


def main():
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    mbus, kicks = music()
    sbus, hits = sfx(kicks)
    n = len(mbus.L)

    irL, irR = room_ir()
    def wet(bus):
        return fftconvolve(bus.send, irL)[:n], fftconvolve(bus.send, irR)[:n]

    mwL, mwR = wet(mbus)
    swL, swR = wet(sbus)
    # music: ducked by the kick (a gentle pump on the pad/arp) and harder under the hits
    pump = duck_curve([(t, 0.28 * v) for t, v in kicks], n, 0.12)
    duck = duck_curve(hits, n, 0.35)
    mL = (mbus.L + 0.9 * mwL) * pump * duck
    mR = (mbus.R + 0.9 * mwR) * pump * duck
    sL, sR = sbus.L + 0.8 * swL, sbus.R + 0.8 * swR
    # glue: gentle high-pass on everything, keep the sub under 30 Hz out
    mL, mR = hp(mL, 28), hp(mR, 28)
    L, R = mL * 0.9 + sL, mR * 0.9 + sR
    # fade the tail to the film's end
    T = np.arange(n) / SR
    fade = np.clip((DUR - T) / 1.2, 0, 1) ** 1.5
    L, R, mL, mR, sL, sR = [x * fade for x in (L, R, mL, mR, sL, sR)]
    L, R, mL, mR, sL, sR = [x[:N] for x in (L, R, mL, mR, sL, sR)]

    target, ceil = -16.0, 10 ** (-1.5 / 20)
    for _ in range(3):
        g = 10 ** ((target - lufs(L, R)) / 20)
        L, R = limit(L * g, R * g, ceil)
    loud = lufs(L, R)
    tp = 20 * np.log10(max(true_peak(L), true_peak(R)))

    def write(name, a, b, norm=None):
        st = np.stack([a, b], 1)
        if norm:
            st = st / max(1e-9, np.max(np.abs(st))) * norm
        wavfile.write(out / name, SR, (np.clip(st, -1, 1) * 32767).astype(np.int16))

    write("mix.wav", L, R)
    write("music.wav", mL, mR, 0.7)
    write("sfx.wav", sL, sR, 0.7)
    print(f"mix.wav  {DUR:.1f}s  integrated {loud:.1f} LUFS  true peak {tp:.1f} dBTP")
    # per-section loudness, so the arc can be checked by number
    for s in TL["sections"]:
        a, b = int(s["start"] * SR), int(s["end"] * SR)
        if b - a > int(0.5 * SR):
            print(f"  {s['name']:<10} {s['start']:>5.1f}–{s['end']:<5.1f} {lufs(L[a:b], R[a:b]):6.1f} LUFS")


if __name__ == "__main__":
    main()
