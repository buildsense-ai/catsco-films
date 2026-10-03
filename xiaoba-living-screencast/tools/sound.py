#!/usr/bin/env python3
"""Score, foley and VO for 《小八上班了》, all placed from events.json (exported from the page's window.EV).

    python3 tools/sound.py          → out/mix.wav (+ out/music.wav, out/fx.wav, out/vo.wav stems)

Two resolutions, as the style asks: a hi-fi band (FM electric piano, bass, synthesized kit, glockenspiel) is the
world; a chiptune square wave is 小八's voice (its steps, jumps, landings, the karaoke notes). 100 BPM, G major:
Gmaj9 · Em9 · Cmaj7 · D6/9, one bar (2.4 s) a chord. The band enters when 小八 lands on the heading; each
chapter gets a tom fill and a crash; the drums drop out when the test fails and return at the merge; the fold
opens a big maj9. Music ducks under the narration (VO ≈ 10 dB over the music) and key clicks are kept off word
onsets. Mastered to -14 LUFS, true peak -1.5 dBTP. Everything is synthesized here: nothing to license.
"""
import json
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, lfilter, resample_poly, sosfilt
from scipy.ndimage import minimum_filter1d, uniform_filter1d

HERE = Path(__file__).resolve().parents[1]
SR = 48000
E = json.loads((HERE / "events.json").read_text())
DUR, SECS, EV = E["dur"], E["secs"], E["ev"]
BPM = SECS["bpm"]; BEAT = 60 / BPM; BAR = 4 * BEAT
N = int(DUR * SR)
WORDS = json.loads((HERE / "voices" / "words.json").read_text())
rng = np.random.default_rng(11)

# ───────────────────────────── DSP
def tt(d): return np.arange(int(d * SR)) / SR
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR * .47), "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, min(b, SR * .47)], "band", fs=SR, output="sos"), x)
def noise(d): return rng.standard_normal(int(d * SR))
def env(d, a=.004, dec=.3): t = tt(d); return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(dec, 1e-4)) * np.clip((d - t) / .02, 0, 1)

class Bus:
    def __init__(s): s.L = np.zeros(N + 4 * SR); s.R = np.zeros(N + 4 * SR); s.send = np.zeros(N + 4 * SR)
    gain = 1.
    def add(s, sig, t, g=1., pan=0., send=0.):
        g *= s.gain
        i = int(round(t * SR))
        if i < 0: sig = sig[-i:]; i = 0
        if i >= len(s.L) or len(sig) == 0: return
        sig = sig[: len(s.L) - i] * g; th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        s.L[i:i + len(sig)] += sig * np.cos(th); s.R[i:i + len(sig)] += sig * np.sin(th); s.send[i:i + len(sig)] += sig * send

def room(t60=1.2, seed=5):
    r = np.random.default_rng(seed); t = tt(t60 * 1.2); out = []
    for ch in range(2):
        n = lp(r.standard_normal(len(t)) * np.exp(-6.9 * t / t60), 6500)
        ir = np.concatenate([np.zeros(int((.012 + .002 * ch) * SR)), n]); out.append(ir / np.sqrt(np.sum(ir ** 2)))
    return out

# ───────────────────────────── the hi-fi band
def epiano(m, d=.9, v=1.):
    t = tt(d); f = mtof(m)
    mod = np.sin(2 * np.pi * f * t) * 1.4 * np.exp(-6 * t)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-3.2 * t) + .18 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-7 * t)
    return x * v * np.minimum(1, t / .003) * np.clip((d - t) / .05, 0, 1)
def glock(m, d=1.2, v=1.):
    t = tt(d); f = mtof(m)
    x = np.sin(2 * np.pi * f * t) * np.exp(-4 * t) + .4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-9 * t) + .2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-16 * t)
    return (x + .15 * hp(noise(d), 3000) * np.exp(-t * 150)) * v * np.minimum(1, t / .002)
def bass(m, d, v=1.):
    t = tt(d); f = mtof(m)
    x = np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2 * f * t) + .12 * np.sin(2 * np.pi * 3 * f * t)   # harmonics so it reads on small speakers
    return np.tanh(1.3 * x) * np.minimum(1, t / .005) * np.exp(-t * 1.6) * np.clip((d - t) / .04, 0, 1) * v
def pad(m, d, bright=.5):
    t = tt(d); f = mtof(m)
    x = sum(np.sin(2 * np.pi * f * (1 + dt) * t + ph) for dt, ph in [(-.004, 0), (0, 1.3), (.0045, 2.1)]) / 3
    x += .25 * lp(2 * ((f * t) % 1) - 1, 800 + 1600 * bright)
    return x * np.minimum(1, t / .6) * np.clip((d - t) / .8, 0, 1)
def kick(v=1.):
    t = tt(.4); f = 48 + 100 * np.exp(-t * 34)
    return np.tanh(1.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) + .2 * hp(noise(.4), 2500) * np.exp(-t * 300)) * v
def snare(v=1.):
    t = tt(.3); body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return (body * .6 + bp(noise(.3), 1500, 8000) * np.exp(-t * 22)) * v
def hat(v=1., op=False):
    t = tt(.3 if op else .06); return hp(noise(len(t) / SR), 7500) * np.exp(-t * (12 if op else 75)) * v
def tom(m, v=1.):
    t = tt(.45); f = mtof(m) * (1 + .5 * np.exp(-t * 20))
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) + .15 * bp(noise(.45), 400, 3000) * np.exp(-t * 30)) * v
def crash(v=1.):
    t = tt(2.2); x = lp(hp(noise(2.2), 4000), 11000) * np.exp(-t * 2.2) + .4 * bp(noise(2.2), 2500, 6000) * np.exp(-t * 4)
    return x * v * np.minimum(1, t / .002)

# ───────────────────────────── 小八's voice: chiptune
def square(f, d, duty=.5, v=1., slide=0., vib=0.):
    t = tt(d); ff = f * (2 ** (slide * t / max(d, 1e-3) / 12)) * (1 + vib * np.sin(2 * np.pi * 7 * t))
    ph = np.cumsum(ff) / SR % 1
    return np.where(ph < duty, 1., -1.) * v * np.minimum(1, t / .003) * np.clip((d - t) / .01, 0, 1)
def chip_blip(m, d=.06, duty=.25, v=1., slide=0.): return lp(square(mtof(m), d, duty, v, slide), 9000) * env(d, .002, d * .8)
def chip_jump(d): return lp(square(mtof(72), min(.16, d * .5), .25, 1., slide=12), 9000) * np.linspace(1, .3, int(min(.16, d * .5) * SR))
def chip_land(v): return lp(square(mtof(52), .07, .5, v, slide=-7), 5000) * env(.07, .002, .05)

# ───────────────────────────── foley
def key_click(v=1.):
    t = tt(.05); thock = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 90)
    return (thock * .6 + bp(noise(.05), 2200, 7000) * np.exp(-t * 200)) * v
def click(v=1.):
    t = tt(.04); return (bp(noise(.04), 1500, 6000) * np.exp(-t * 260) + .5 * np.sin(2 * np.pi * 900 * t) * np.exp(-t * 180)) * v
def swish(d=.45, up=True):
    n = noise(d); out = np.zeros_like(n); steps = 24; idx = np.linspace(0, len(n), steps + 1).astype(int)
    for i in range(steps):
        f = (400 * (6000 / 400) ** (i / steps)) if up else (6000 * (400 / 6000) ** (i / steps))
        out[idx[i]:idx[i + 1]] = bp(n, f / 1.5, f * 1.5)[idx[i]:idx[i + 1]]
    return lp(out, 7000) * np.sin(np.pi * np.linspace(0, 1, len(n))) ** 1.5
def pop(f=640, d=.12):
    t = tt(d); return np.sin(2 * np.pi * np.cumsum(f * (1 + t / d)) / SR) * np.sin(np.pi * t / d) ** .7 * np.exp(-t * 12)
def scribble(d):
    t = tt(d); am = .5 + .5 * np.sin(2 * np.pi * 9 * t) ** 2
    return bp(noise(d), 2500, 7000) * am * np.minimum(1, t / .05) * np.clip((d - t) / .08, 0, 1)
def buzz(d=.35):
    t = tt(d); return lp(np.sign(np.sin(2 * np.pi * 110 * t)) * .6 + np.sin(2 * np.pi * 116 * t) * .4, 1800) * np.exp(-t * 5) * np.minimum(1, t / .005)

# ───────────────────────────── score
CHORDS = [  # (pad voicing, arp, bass root)
    ([55, 59, 62, 66, 69], [67, 71, 74, 78], 43),   # Gmaj9
    ([52, 55, 59, 62, 66], [64, 67, 71, 74], 40),   # Em9
    ([48, 55, 59, 62, 64], [64, 67, 72, 76], 36),   # Cmaj7(9)
    ([50, 54, 57, 59, 64], [62, 66, 69, 71], 38),   # D6/9
]
def chord_at(t): return CHORDS[int((t - SECS["band"]) // BAR) % 4] if t >= SECS["band"] else CHORDS[0]

def music():
    m = Bus(); kicks = []
    band, dout, din, end, chord, dur = SECS["band"], SECS["drumsOut"], SECS["drumsIn"], SECS["end"], SECS["chord"], DUR
    # intro: a soft pad under the logo, a glock sparkle as the M becomes 小八
    for n in [43, 55, 62, 66, 69]: m.add(pad(n, band + .6, .3), 0, .05, send=.5)
    # the band: chords every bar until the fold
    t = band
    while t < chord - 1e-6:
        vo, arp, root = chord_at(t); d = min(BAR + .4, chord - t + .3)
        tense = dout <= t < din
        for j, n in enumerate(vo): m.add(pad(n, d, .25 if tense else .45), t, .035, pan=-.3 + .15 * j, send=.4)
        # e-piano comp: off-beat stabs (the world is hi-fi)
        for k, off in enumerate([BEAT * .5, BEAT * 1.5, BEAT * 2.5, BEAT * 3.5]):
            if t + off >= chord: break
            if end <= t + off: continue
            for n in vo[1:4]: m.add(epiano(n + 12, .45, .6 if k % 2 == 0 else .45), t + off, .045, pan=.15, send=.3)
        # bass: root on 1, fifth on 3, pulsing 8ths under the tension
        if t < end:
            if tense:
                for k in range(8): m.add(lp(bass(root, BEAT * .45), 700), t + k * BEAT / 2, .22)
            else:
                m.add(bass(root, BEAT * 1.9), t, .30); m.add(bass(root + 7, BEAT * .9), t + 2 * BEAT, .24); m.add(bass(root + 12, BEAT * .45), t + 3.5 * BEAT, .18)
        # drums
        for b in range(4):
            tb = t + b * BEAT
            if tb >= end or tb >= chord or (dout <= tb < din): continue
            m.add(kick(.9 if b % 2 == 0 else .6), tb, .5); kicks.append((tb, 1. if b % 2 == 0 else .6))
            if b % 2 == 1: m.add(snare(.8), tb, .22, pan=.05, send=.25)
            m.add(hat(.4), tb + BEAT / 2, .07, pan=.25, send=.1); m.add(hat(.25), tb, .05, pan=.25)
        # glock motif on chapter bars
        t += BAR
    # the tension: a ticking glock (a clock) while the clone searches
    tk = dout + BEAT
    while tk < din - .1: m.add(glock(88, .25, .5), tk, .05, pan=.3, send=.3); tk += BEAT / 2
    # chapter transitions: tom fill into each chapter + crash on it
    for c in SECS["chapters"]:
        for k, n in enumerate([50, 47, 43, 40]): m.add(tom(n, .7 + .1 * k), c - BEAT + k * BEAT / 4, .30, pan=-.3 + .2 * k, send=.25)
        m.add(crash(.9), c, .16, pan=.2, send=.4); m.add(kick(1.), c, .5)
    # the end: slogan over e-piano + glock, chiptune takes the melody (karaoke notes are placed in fx)
    for j, n in enumerate([55, 62, 66, 71]): m.add(pad(n, chord - end + .3, .35), end, .045, pan=-.2 + .13 * j, send=.5)
    # the fold: a big Gmaj9, both resolutions
    for j, n in enumerate([31, 43, 50, 55, 59, 62, 66, 69, 74]): m.add(pad(n, dur - chord, .55), chord, .06 if n > 40 else .09, pan=-.4 + .1 * j, send=.55)
    for j, n in enumerate([67, 71, 74, 78, 81]): m.add(glock(n, 2.5, .8), chord + .06 * j, .07, pan=-.2 + .1 * j, send=.6)
    for j, n in enumerate([79, 83, 86, 90]): m.add(chip_blip(n, .12, .25, 1.), chord + .3 + .09 * j, .05, pan=.2, send=.3)
    m.add(kick(1.1), chord, .55); m.add(crash(1.), chord, .18, send=.5)
    return m, kicks

def fx():
    f = Bus(); duck = []
    onsets = [VO_T[k] + max(0, w[1]) for k, ws in WORDS.items() if k in VO_T for w in ws]
    def off_onset(t): return min((abs(t - o) for o in onsets), default=1) > .045
    # keep effects off word onsets: a chip sound starting just before a syllable masks it (heard as 改好 → 保好)
    def near_onset(t): return any(-.05 <= o - t <= .15 for o in onsets)
    CHIP = {"jump", "land", "step", "lapse", "bang", "note", "heart", "split", "merge", "morph", "click", "pop", "tick"}
    for e in EV:
        t, k = e["t"], e["type"]
        f.gain = .35 if k in CHIP and near_onset(t) else 1.
        if k == "key" and off_onset(t): f.add(key_click(e.get("v", .8)), t + .003 * rng.standard_normal(), .22, .05, .08)
        elif k == "click": f.add(click(1.), t, .5, .1, .1)
        elif k == "enter": f.add(key_click(1.), t, .45, .05, .1); f.add(key_click(.7), t + .05, .25, .05, .1)
        elif k == "pane": f.add(swish(.45, not e.get("close")), t, .30, .3 if not e.get("close") else -.1, .3)
        elif k == "pop": f.add(pop(620), t, .28, 0, .25)
        elif k == "tick": f.add(glock(84 + int(3 * e.get("v", .7)), .4, .7), t, .07, .3, .3)
        elif k == "fail": f.add(buzz(.35), t, .16, .3, .2); duck.append((t, .35))
        elif k == "bang": f.add(chip_blip(84, .07, .25, 1.), t, .10, .2); f.add(chip_blip(91, .1, .25, 1.), t + .07, .10, .2)
        elif k == "pencil": f.add(lp(scribble(e.get("d", .8)), 5000), t, .07, .2, .15)
        elif k == "pass":
            for j, n in enumerate([79, 83, 86]): f.add(glock(n, 1.2, .8), t + .04 * j, .08, .2, .45)
        elif k == "lapse": f.add(chip_blip(96, .02, .5, .6), t, .035, .25)
        elif k == "step": f.add(chip_blip(60, .03, .5, .6), t, .04, 0)
        elif k == "jump": f.add(chip_jump(e.get("d", .4)), t, .055, 0, .1)
        elif k == "land": f.add(chip_land(e.get("v", .6)), t, .09, 0, .1); f.add(key_click(.5) * .5, t, .1, 0, .1)
        elif k == "split":
            for j, n in enumerate([72, 76, 79, 84]): f.add(chip_blip(n, .06, .25, 1.), t + .045 * j, .07, .3)
        elif k == "merge":
            for j, n in enumerate([84, 79, 76, 72, 84]): f.add(chip_blip(n, .06, .25, 1.), t + .045 * j, .07, .2)
        elif k == "found":
            for j, n in enumerate([81, 86]): f.add(glock(n, 1.0, .8), t + .07 * j, .09, -.4, .5)
        elif k == "heart": f.add(chip_blip(88, .08, .5, 1.), t, .07, 0); f.add(chip_blip(93, .14, .5, 1., slide=2), t + .09, .07, 0, .2)
        elif k == "morph": f.add(lp(square(mtof(60), .5, .25, 1., slide=24), 8000) * np.linspace(.2, 1, int(.5 * SR)), t, .05, 0, .3)
        elif k == "note": f.add(chip_blip([74, 78, 81][e["n"]], .3, .5, 1.), t, .07, 0, .25)
    return f, duck

VO_T = {e["id"]: e["t"] for e in EV if e["type"] == "vo"}

def vo_bus():
    v = Bus()
    for k, t in VO_T.items():
        sr, x = wavfile.read(HERE / "voices" / f"{k}.wav"); x = x.astype(np.float64) / 32768
        if sr != SR: x = resample_poly(x, SR, sr)
        # gentle compression (TTS has a high crest factor), then a presence lift
        env_ = uniform_filter1d(np.abs(x), int(.01 * SR)) + 1e-6
        g = np.minimum(1, (env_ / .12) ** -.45); x = x * uniform_filter1d(g, int(.005 * SR))
        x = x + .25 * bp(x, 2500, 6000)
        v.add(x, t, 1., 0, .08)
    return v

# ───────────────────────────── mix
def duck_curve(events, n, rel):
    g = np.ones(n); t = np.arange(n) / SR
    for th, d in events:
        i = int(th * SR); j = min(n, i + int(rel * 6 * SR))
        if 0 <= i < n: g[i:j] = np.minimum(g[i:j], 1 - d * np.exp(-(t[i:j] - th) / rel))
    return uniform_filter1d(g, int(.003 * SR))
def kw(x):
    x = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1., -1.69065929318241, .73248077421585], x)
    return lfilter([1., -2., 1.], [1., -1.99004745483398, .99007225036621], x)
def lufs(L, R):
    a, b = kw(L), kw(R); blk, hop = int(.4 * SR), int(.1 * SR)
    ms = np.array([np.mean(a[i:i + blk] ** 2) + np.mean(b[i:i + blk] ** 2) for i in range(0, len(L) - blk, hop)])
    ld = -.691 + 10 * np.log10(ms + 1e-12); g = ms[ld > -70]
    rel = -.691 + 10 * np.log10(np.mean(g)) - 10
    return -.691 + 10 * np.log10(np.mean(ms[ld > max(-70, rel)]))
def peaks(x): return np.abs(resample_poly(x, 4, 1))[: 4 * len(x)].reshape(-1, 4).max(1)
def limit(L, R, ceil):
    w = int(.004 * SR)
    for _ in range(4):
        g = np.minimum(1, ceil / np.maximum(np.maximum(peaks(L), peaks(R)), 1e-9))
        g = uniform_filter1d(minimum_filter1d(g, 2 * w), w); L, R = L * g, R * g
    return L, R

def main():
    out = HERE / "out"; out.mkdir(exist_ok=True)
    m, kicks = music(); f, fduck = fx(); v = vo_bus(); n = len(m.L)
    irL, irR = room()
    wet = lambda b: (fftconvolve(b.send, irL)[:n], fftconvolve(b.send, irR)[:n])
    (mwl, mwr), (fwl, fwr), (vwl, vwr) = wet(m), wet(f), wet(v)
    # sidechain: the music ducks under the voice (-9 dB while speaking), pumps lightly on the kick, dips under hits
    venv = uniform_filter1d(np.abs(v.L + v.R), int(.05 * SR)); venv = venv / (venv.max() + 1e-9)
    vduck = 1 - .65 * np.clip(uniform_filter1d((venv > .02).astype(float), int(.25 * SR)) * 1.4, 0, 1)
    pump = duck_curve([(t, .2 * a) for t, a in kicks], n, .12) * duck_curve(fduck, n, .3)
    # two designed near-silences: after the failure (before 'stuck'), and the breath before the final chord
    T_ = np.arange(n) / SR; st = E["T"]
    hole = lambda a, b, r=.08: 1 - np.clip(np.minimum((T_ - a) / r, (b - T_) / r), 0, 1)
    pump = pump * np.maximum(.06, hole(st["fail"] + .35, st["stuck"] - .05)) * np.maximum(.04, hole(st["chord"] - .5, st["chord"] - .01, .05))
    mL, mR = hp((m.L + .8 * mwl) * vduck * pump, 30), hp((m.R + .8 * mwr) * vduck * pump, 30)
    # effects duck under the voice too (-7 dB while a line is spoken): the words stay intelligible
    fduckv = 1 - .55 * np.clip(uniform_filter1d((venv > .02).astype(float), int(.2 * SR)) * 1.4, 0, 1)
    fL, fR = (f.L + .7 * fwl) * fduckv, (f.R + .7 * fwr) * fduckv
    vL, vR = v.L + .5 * vwl, v.R + .5 * vwr
    # balance: VO ≈ 10 dB over the music where both play
    spk = uniform_filter1d((venv > .02).astype(float), int(.05 * SR)) > .5
    rms = lambda x: np.sqrt(np.mean(x[spk[: len(x)]] ** 2) + 1e-12)
    g_m = (rms(vL) / rms(mL)) / 10 ** (10 / 20)
    mL, mR = mL * g_m, mR * g_m
    L, R = lp((mL + fL + vL)[:N], 16500, 4), lp((mR + fR + vR)[:N], 16500, 4)   # band-limit: AAC drops it anyway, and HF transients overshoot after encoding
    T = np.arange(N) / SR; fade = np.clip((DUR - T) / 1.0, 0, 1) ** 1.5 * np.clip(T / .3, 0, 1)
    L, R = L * fade, R * fade
    for _ in range(3):
        g = 10 ** ((-14 - lufs(L, R)) / 20); L, R = limit(L * g, R * g, 10 ** (-2.0 / 20))   # -2.0 in the WAV so the AAC stays under -1.5
    tp = 20 * np.log10(max(peaks(L).max(), peaks(R).max()))
    def write(name, a, b, norm=None):
        st = np.stack([a[:N], b[:N]], 1)
        if norm: st = st / (np.abs(st).max() + 1e-9) * norm
        wavfile.write(out / name, SR, (np.clip(st, -1, 1) * 32767).astype(np.int16))
    write("mix.wav", L, R); write("music.wav", mL, mR, .7); write("fx.wav", fL, fR, .7); write("vo.wav", vL, vR, .7)
    # the numbers
    print(f"mix.wav  {DUR:.1f}s  {lufs(L, R):.1f} LUFS  true peak {tp:.1f} dBTP")
    vs = spk[:N]
    print(f"VO over music while speaking: {20 * np.log10(rms(vL) / rms(mL)):.1f} dB")
    low = bp(L + R, 20, 120); rest = hp(L + R, 120)
    print(f"20-120 Hz vs rest: {20 * np.log10(np.sqrt(np.mean(low ** 2)) / np.sqrt(np.mean(rest ** 2))):.1f} dB")
    for a, b, name in [(0, SECS["band"], "intro"), (SECS["band"], SECS["drumsOut"], "band"), (SECS["drumsOut"], SECS["drumsIn"], "tension"),
                       (SECS["drumsIn"], SECS["end"], "resolve"), (SECS["end"], SECS["chord"], "slogan"), (SECS["chord"], DUR, "lockup")]:
        i, j = int(a * SR), int(b * SR); print(f"  {name:<8} {a:5.1f}-{b:<5.1f} {lufs(L[i:j], R[i:j]):6.1f} LUFS")

if __name__ == "__main__":
    main()
