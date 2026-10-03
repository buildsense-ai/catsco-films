// 《小八上班了》: timeline, camera, mascot acting, cursor, UI state and sound events, all f(t).
// Beats hang off spoken characters (MiniMax per-character timestamps, voices/voices.js) through W(id, char, n).
'use strict';
(() => {
const W_ = 1920, H_ = 1080, FPS = 24;
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const eio = (x) => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const eo = (x) => { x = clamp(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
const ei = (x) => { x = clamp(x); return x * x * x; };
const back = (x) => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const whip = (x) => { x = clamp(x); return x < .5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2; };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function spring(t, t0, z = .55, w = 17) {
  const s = t - t0; if (s <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + (z * w / wd) * Math.sin(wd * s));
}

// ─────────────────────────── narration: start times, and beats hung on spoken characters
const V = window.VOICES;
const VO = { v01: 2.75, v02: 5.1, v03: 11.1, v04: 15.9, v05: 21.75, v06: 25.1, v07: 29.85, v08: 34.2, v09: 38.85, v10: 43.7 };
const W = (id, ch, n = 0) => { let k = 0; for (const [c, a] of V.words[id]) if (c === ch && k++ === n) return VO[id] + Math.max(0, a); throw new Error(`${ch} not in ${id}`); };
const WE = (id, ch, n = 0) => { let k = 0; for (const [c, , b] of V.words[id]) if (c === ch && k++ === n) return VO[id] + b; throw new Error(`${ch} not in ${id}`); };
const VEND = (id) => VO[id] + V.dur[id];
const PUN = /[\s，。、,.；;：:！!？?·{}]/;
/** MiniMax per-character timing → absolute [t0, t1] for every non-punctuation character of `text` (in order).
 *  Multi-character chunks (English: "C" "ats" "Co") are spread evenly over their duration. */
function charTimes(id, text) {
  const tm = [];
  for (const [c, a, b] of V.words[id]) {
    const cs = [...c].filter((x) => !PUN.test(x));
    cs.forEach((_, i) => tm.push([VO[id] + Math.max(0, a + (b - a) * i / cs.length), VO[id] + a + (b - a) * (i + 1) / cs.length]));
  }
  const out = []; let k = 0;
  for (const ch of text) out.push(PUN.test(ch) ? null : (tm[Math.min(k++, tm.length - 1)] || [VO[id], VEND(id)]));
  return out;
}
const CAPS = {
  v01: '这是{小八}，你的 AI 员工。', v02: '有什么要做的，{直接说}就好。', v03: '告诉它用哪台电脑，它只在你{授权的设备}上工作。',
  v04: '在{公司电脑}上，读日志，找到问题，改好，重新构建。', v05: '再到{家里的工作站}，跑完整测试。',
  v06: '遇到卡点，它会分出一个{分身}，去翻以前的对话找线索，', v07: '主线的工作，{一刻不停}。', v08: '补丁和报告，最后都回到{你的对话}里。',
};

// ─────────────────────────── timeline (seconds; chapter changes sit on the 100 BPM grid, one beat = 0.6 s)
const BPM = 100, B = 60 / BPM;
const T = {
  land0: 2.4, ch1: 4.8, click: 5.7, typeA: 6.05, send: 10.2, ch2: 10.8, reply1: 10.8,
  toChip: W('v03', '哪') - .1, glow: W('v03', '授'), split: 15.0, intoPane: 15.25,
  read: W('v04', '读'), found: W('v04', '找'), fix: W('v04', '改'), build: W('v04', '构'), built: WE('v04', '建') + .25,
  ch3: 21.0, toTab: 21.15, tests: 21.8, fail: 24.6, stuck: W('v06', '卡'), clone: W('v06', '分', 1),
  cloneGo: W('v06', '翻') - .55, cloneFind: W('v06', '线'), back: 30.6, merge: 31.8, rerun: 32.05, allPass: 32.6,
  ch4: 33.0, close: 33.0, reply2: 33.75, pet: 37.15, end: 38.4,
  k0: W('v09', '一', 0), k1: W('v09', '一', 1), k2: W('v09', '每'), fold: 42.25, chord: 43.0, lockT: 43.35, dur: 48.0,
};
const DUR = T.dur;
const TASK = '读取公司电脑的构建日志，把项目修好；再去家里的工作站跑完整测试，最后把补丁和报告发我。';

// ─────────────────────────── events for sound.py
const EV = [];
const ev = (t, type, o = {}) => EV.push({ t: +t.toFixed(3), type, ...o });
for (const id of Object.keys(VO)) ev(VO[id], 'vo', { id });
const SUBS = [];
{
  const all = { ...CAPS, v09: '一个任务，一个 AI 员工，每一台授权的电脑。', v10: 'CatsCo，你的专业 AI 员工。' };
  const ids = Object.keys(all);
  ids.forEach((id, i) => {
    const ts = charTimes(id, all[id]).filter(Boolean);
    const t0 = ts[0][0] - .12, nxt = i + 1 < ids.length ? charTimes(ids[i + 1], all[ids[i + 1]]).find(Boolean)[0] - .2 : DUR - .5;
    SUBS.push({ id, t0, t1: Math.min(nxt, Math.max(t0 + 1.8, ts[ts.length - 1][1] + .5)), text: all[id], screen: id in CAPS });
  });
}
// typing: human rhythm (deterministic jitter), ~11 chars/s
const TYPE = [];
{ let t = T.typeA; for (let i = 0; i < TASK.length; i++) { const r = hash(i * 7.3 + 1); TYPE.push(t); ev(t, 'key', { v: .55 + r * .45 }); t += .062 + r * .05 + ('，；'.includes(TASK[i]) ? .14 : 0); } }
const typedN = (t) => { let n = 0; while (n < TYPE.length && TYPE[n] <= t) n++; return n; };

// ─────────────────────────── camera: one continuous take, moves chain from the current value; zoom never below 1
const MOVES = [];
const cam = (t0, d, to, e = eio) => MOVES.push({ t0, d, to, e });
const AX = 240, AY = 108, MX = AX + 260;         // app content and main-column origins in world px
const HEAD = [MX + 590, AY + 352];                // empty-state heading
const LOGO_FEET = { x: MX + 590, y: AY + 324 }, LOGO_PX = 280 * (1927 / 2800) / 18;   // the M body of the lockup logo
cam(0, .01, [HEAD[0], HEAD[1] - 40, 2.6]);
cam(1.9, 1.4, [HEAD[0], HEAD[1] + 10, 1.9], eio);
cam(3.2, 1.5, [HEAD[0], AY + 400, 1.3], eio);
cam(5.1, .8, [HEAD[0], AY + 440, 1.75], eio);
cam(10.0, .6, [HEAD[0] - 10, AY + 300, 1.3], eio);
cam(T.toChip - .4, .8, [MX + 470, AY + 300, 1.55], eio);
cam(T.split - .05, .5, [MX + 880, AY + 300, 1.5], whip);
cam(T.found - .25, .6, [MX + 830, AY + 250, 1.95], eio);
cam(T.build - .3, .7, [MX + 880, AY + 300, 1.5], eio);
cam(T.ch3 - .3, .7, [MX + 880, AY + 330, 1.2], eio);
cam(T.tests, .7, [MX + 880, AY + 310, 1.6], eio);
cam(T.clone - .15, .7, [MX + 520, AY + 420, 1.12], eio);
cam(T.cloneGo + .35, .75, [AX + 620, AY + 440, 1.3], eio);
cam(T.back - .9, .55, [MX + 880, AY + 300, 1.6], whip);
cam(T.back, .7, [MX + 540, AY + 400, 1.12], eio);
cam(T.merge + .2, .7, [MX + 880, AY + 380, 1.5], eio);
cam(T.close, .8, [HEAD[0] - 40, AY + 330, 1.45], eio);
cam(T.pet - .45, .6, [HEAD[0] - 250, AY + 360, 1.9], eio);
cam(T.end - .1, .9, [HEAD[0], HEAD[1] - 10, 1.55], eio);
cam(T.fold - .2, .8, [HEAD[0], HEAD[1] - 30, 1.9], eio);
cam(T.lockT + .3, 2.6, [HEAD[0], HEAD[1] + 40, 1.3], eio);
function camRaw(t) {
  let v = [W_ / 2, H_ / 2, 0];
  for (const m of MOVES) { if (t < m.t0) break; const p = m.e((t - m.t0) / m.d); v = [lerp(v[0], m.to[0], p), lerp(v[1], m.to[1], p), lerp(v[2], Math.log(m.to[2]), p)]; }
  return v;
}
function camAt(t) {
  const v = camRaw(t); let z = Math.max(1, Math.exp(v[2]));
  let x = v[0] + Math.sin(t * .7) * 1.4, y = v[1] + Math.sin(t * .53 + 1) * 1.0;   // a trackpad-steady drift
  x = clamp(x, W_ / 2 / z, W_ - W_ / 2 / z); y = clamp(y, H_ / 2 / z, H_ - H_ / 2 / z);
  return { x, y, z };
}

// ─────────────────────────── pixel sprites: the M (sampled from the real logo) and 小八, on one 18×10 grid
const M_ROWS = ['#................#', '###............###', '######......######', '##.#####..#####.##', '##...########...##',
  '##.##...##...##.##', '##.#.##....##.#.##', '##.#...####...#.##', '##.#..........#.##', '##.#..........#.##'];
const M_PIX = []; M_ROWS.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') M_PIX.push([x, y]); }));
const EYES = { n: [[4, 4], [4, 5], [13, 4], [13, 5]], r: [[5, 4], [5, 5], [14, 4], [14, 5]], l: [[3, 4], [3, 5], [12, 4], [12, 5]],
  u: [[4, 3], [4, 4], [13, 3], [13, 4]], d: [[4, 5], [4, 6], [13, 5], [13, 6]], blink: [[4, 5], [13, 5]],
  happy: [[3, 5], [4, 4], [5, 5], [12, 5], [13, 4], [14, 5]], shut: [[3, 5], [4, 5], [5, 5], [12, 5], [13, 5], [14, 5]],
  wide: [[4, 3], [4, 4], [4, 5], [13, 3], [13, 4], [13, 5]] };
const LEGS = { stand: [[2, 2], [4, 2], [13, 2], [15, 2]], walkA: [[2, 2], [4, 1], [13, 2], [15, 1]], walkB: [[2, 1], [4, 2], [13, 1], [15, 2]], tuck: [[2, 1], [4, 1], [13, 1], [15, 1]] };
function catPix({ eyes = 'n', legs = 'stand' } = {}) {
  const P = new Map(), put = (x, y, v = 1) => P.set(x + ',' + y, [x, y, v]);
  for (const x of [0, 1, 16, 17]) put(x, 0); for (const x of [0, 1, 2, 15, 16, 17]) put(x, 1);
  for (let y = 2; y < 8; y++) for (let x = 0; x < 18; x++) put(x, y, y === 7 ? 3 : 1);
  for (const [x, h] of LEGS[legs]) for (let y = 8; y < 8 + h; y++) put(x, y);
  for (const [x, y] of EYES[eyes]) put(x, y, 2);
  if (eyes === 'happy') { put(8, 6, 2); put(9, 6, 2); }
  return [...P.values()];
}
const COL = { 1: '#29BC95', 2: '#0B1612', 3: '#1F8F72' };
/** feet-centre (x, y) in world px; pixels = [[gx, gy, v, op?, s?]] on the 18×10 grid */
function spriteSVG(pix, { x, y, px = 6, sq = 0, flip = false, rot = 0, op = 1 }) {
  const sx = 1 + sq * .7, sy = 1 - sq, w = 18 * px, h = 10 * px;
  let s = '';
  for (const [gx0, gy, v, o = 1, k = 1] of pix) {
    if (o <= .01 || k <= .01) continue;
    const gx = flip ? 17 - gx0 : gx0, d = (1 - k) / 2;
    s += `<rect x="${(gx + d).toFixed(3)}" y="${(gy + d).toFixed(3)}" width="${(1.04 * k).toFixed(3)}" height="${(1.04 * k).toFixed(3)}" fill="${COL[v] || COL[1]}"${o < 1 ? ` opacity="${o.toFixed(3)}"` : ''}/>`;
  }
  return `<svg class="px" viewBox="0 0 18 10" width="${w}" height="${h}" overflow="visible" shape-rendering="crispEdges" style="left:${(x - w / 2).toFixed(2)}px;top:${(y - h).toFixed(2)}px;opacity:${op};transform:scale(${sx.toFixed(3)},${sy.toFixed(3)}) rotate(${rot}rad);transform-origin:50% 100%">${s}</svg>`;
}
function pixart(rows, pal, x, y, px, op = 1) {
  let s = ''; rows.forEach((row, r) => [...row].forEach((ch, c) => { if (pal[ch]) s += `<rect x="${c}" y="${r}" width="1.04" height="1.04" fill="${pal[ch]}"/>`; }));
  const w = rows[0].length, h = rows.length;
  return `<svg class="px" viewBox="0 0 ${w} ${h}" width="${w * px}" height="${h * px}" shape-rendering="crispEdges" style="left:${x.toFixed(2)}px;top:${y.toFixed(2)}px;opacity:${op.toFixed(3)}">${s}</svg>`;
}
const BANG = (x, y, px, op) => pixart(['.kkk.', 'kwwwk', 'kwkwk', 'kwkwk', 'kwwwk', 'kwkwk', 'kwwwk', '.kkk.'], { w: '#FFE27A', k: '#0B1612' }, x - 2.5 * px, y - 8 * px, px, op);
const PENCIL = (x, y, px, op) => pixart(['......kk', '.....yyk', '....yyy.', '...yyy..', '..yyy...', '.pyy....', 'ppy.....', 'k.......'], { y: '#F2C14E', k: '#0B1612', p: '#F4B8A8' }, x, y - 8 * px, px, op);
const SWEAT = (x, y, px, op) => pixart(['.b.', 'bbb', 'bbb', '.b.'], { b: '#7FC4F0' }, x, y, px, op);
const HEART = (x, y, px, op) => pixart(['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], { r: '#FF5A5F' }, x - 3.5 * px, y - 6 * px, px, op);
const SPARK = (x, y, px, op) => pixart(['..y..', '..y..', 'yy.yy', '..y..', '..y..'], { y: '#FFE27A' }, x - 2.5 * px, y - 2.5 * px, px, op);
function dust(x, y, u, px = 4) {
  if (u <= 0 || u >= 1) return ''; let s = '';
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1, k = (i >> 1) + 1, e = 1 - Math.pow(1 - u, 2);
    const dx = side * (16 + k * 15) * e, dy = -(6 + k * 4) * Math.sin(Math.PI * u * .9), sz = px * (1 - u * .7);
    s += `<div class="p" style="left:${(x + dx - sz / 2).toFixed(1)}px;top:${(y + dy - sz).toFixed(1)}px;width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;background:#7FA89A;opacity:${(1 - u).toFixed(2)}"></div>`;
  }
  return s;
}

// ─────────────────────────── actors: segments of stand / walk / jump / hide, positions from live DOM anchors
class Actor {
  constructor(px = 6) { this.px = px; this.segs = []; this.jumps = []; }
  add(s) { this.segs.push(s); return this; }
  stand(t0, t1, at, o = {}) { return this.add({ k: 'stand', t0, t1, at, ...o }); }
  walk(t0, t1, from, to, o = {}) { for (let t = t0 + .05; t < t1; t += .12) ev(t, 'step', { v: .45 }); return this.add({ k: 'walk', t0, t1, from, to, ...o }); }
  jump(t0, t1, from, to, h = 90, o = {}) { this.jumps.push({ t0, t1 }); ev(t0 - .02, 'jump', { d: t1 - t0 }); ev(t1, 'land', { v: o.big ? 1 : .6 }); return this.add({ k: 'jump', t0, t1, from, to, h, ...o }); }
  hide(t0, t1) { return this.add({ k: 'hide', t0, t1 }); }
  seg(t) { let s = null; for (const x of this.segs) { if (x.t0 <= t && t < x.t1) return x; if (x.t0 <= t) s = x; } return s; }
  eval(t) {
    const s = this.seg(t); if (!s || s.k === 'hide') return null;
    let pos, legs = 'stand', flip = s.flip || false, sq = 0, rot = 0, eyes = 'n';
    if (s.k === 'stand') pos = s.at(t);
    if (s.k === 'walk') { const a = s.from(t), b = s.to(t), p = (s.ease || ss)(seg(t, s.t0, s.t1)); pos = { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) };
      legs = Math.floor(t * 9) % 2 ? 'walkA' : 'walkB'; flip = b.x < a.x; }
    if (s.k === 'jump') { const a = s.from(t), b = s.to(t), p = seg(t, s.t0, s.t1), ap = Math.min(a.y, b.y) - s.h, cy = 2 * ap - (a.y + b.y) / 2;
      pos = { x: lerp(a.x, b.x, p), y: (1 - p) ** 2 * a.y + 2 * (1 - p) * p * cy + p * p * b.y }; legs = 'tuck';
      flip = b.x < a.x - 2 ? true : b.x > a.x + 2 ? false : flip; sq = p < .5 ? -.2 * (1 - p * 2) : -.1 * (p * 2 - 1);
      if (s.spin) rot = p * Math.PI * 2 * (b.x < a.x ? -1 : 1); }
    for (const j of this.jumps) {
      if (t >= j.t0 - .14 && t < j.t0) sq = Math.max(sq, .28 * ss(seg(t, j.t0 - .14, j.t0)));
      if (t >= j.t1 && t < j.t1 + .24) { const k = seg(t, j.t1, j.t1 + .24); sq = .32 * (1 - k) * Math.cos(k * 7); }
    }
    if (s.k === 'stand' && !s.still) { const bp = ((t % B) + B) % B; if (bp < .12) sq += .06 * Math.sin(bp / .12 * Math.PI); }   // breathes on the beat
    const bl = Math.floor(t / 2.7), bt = t - bl * 2.7 - hash(bl * 3.7 + this.px) * 1.8;
    if (bt > 0 && bt < .1) eyes = 'blink';
    if (s.eyes) { const e = typeof s.eyes === 'function' ? s.eyes(t) : s.eyes; if (e && !(eyes === 'blink' && 'nlrud'.includes(e))) eyes = e; }
    if (s.sq) sq += s.sq(t);
    const x = Math.round(pos.x / (this.px / 2)) * (this.px / 2);   // position snaps to half-pixels: stepped motion
    return { x, y: pos.y, px: this.px, flip, sq, rot, legs, eyes };
  }
  lands() { return this.segs.filter((s) => s.k === 'jump').map((s) => s.t1); }
}

// DOM anchors: top edge of an element, in world px (through the current camera)
let CAM = { x: 960, y: 540, z: 1 };
function A(el, fx = .5, dx = 0) {
  const r = (typeof el === 'string' ? $(el) : el).getBoundingClientRect();
  return { x: (r.left + fx * r.width - W_ / 2) / CAM.z + CAM.x + dx, y: (r.top - H_ / 2) / CAM.z + CAM.y };
}
const at = (id, fx = .5, dx = 0) => () => A(id, fx, dx);
const caretAt = () => { const c = A('caret', .5), b = A('comp', .5); return { x: c.x + 4, y: b.y }; };

// ─────────────────────────── the cast
const X = new Actor(6), X2 = new Actor(5);
const ROWS = [
  { nm: 'api/auth.spec.ts', n: 32 }, { nm: 'api/billing.spec.ts', n: 41 }, { nm: 'invoice/total.spec.ts', n: 18, tag: '含本次修复' },
  { nm: 'report/export.spec.ts', n: 27 }, { nm: 'utils/timezone.spec.ts', n: 23, fail: '期望 09:00 · 实际 01:00' }, { nm: 'e2e/checkout.spec.ts', n: 73 },
];
{ const t0 = T.tests + .1, dt = (T.fail - t0) / 4.4; ROWS.forEach((r, i) => { r.start = t0 + dt * Math.max(0, i - .3); r.done = t0 + dt * (i + 1); });
  ROWS[4].done = T.fail; ROWS[5].start = T.clone + .2; ROWS[5].done = T.allPass - .08; ROWS[4].fix = T.rerun + .35; }
ROWS.forEach((r) => { if (r.done < 99 && !r.fail) ev(r.done, 'tick', { v: .7 }); });
ev(T.fail, 'fail'); ev(ROWS[4].fix, 'tick', { v: 1 }); ev(T.allPass, 'pass');

const DEV0 = at('dev0', .82);
const gut = (id) => () => ({ x: A('pb0', .88).x, y: A(id).y });          // the log's right-hand gutter: never over text
function progress(t) {   // smooth test progress 0..1: the bar's fill, and where 小八 rides on it
  let p = 0;
  for (const r of ROWS) {
    if (r.fail) p += r.n * (t < r.done ? seg(t, r.start, r.done) * .6 : t < T.rerun ? 0 : seg(t, T.rerun, r.fix));
    else p += r.n * seg(t, r.start, r.done);
  }
  return p / 214;
}
const onBar = (t) => { const b = A('bar', 0), e = A('bar', 1), f = clamp(progress(t), .08, .92); return { x: lerp(b.x, e.x, f), y: b.y }; };
const nearBar = (dx) => (t) => { const p = onBar(t); return { x: p.x + dx, y: p.y }; };
{
  const HEADTOP = at('h1q', .5), R2 = at('mB2', .06, 0);
  X.hide(0, T.land0 - .55)
   .jump(T.land0 - .55, T.land0, () => LOGO_FEET, HEADTOP, 50, { big: true })       // the born cat hops down onto the heading
   .stand(T.land0, T.click - .1, HEADTOP, { eyes: (t) => t < VO.v01 + .3 ? 'n' : t < VEND('v01') ? 'happy' : t < T.click - .4 ? 'n' : 'd' })
   .jump(T.click - .1, T.typeA - .05, HEADTOP, caretAt, 60)                                                   // onto the composer, next to the caret
   .stand(T.typeA - .05, T.send - .05, caretAt, { eyes: (t) => t > T.send - .35 ? 'u' : 'l', still: true, sq: (t) => (typedN(t) % 2) * .03 })
   .stand(T.send - .05, T.toChip, at('bubU', .78), { eyes: (t) => t > T.reply1 + .2 ? 'd' : 'u' })           // rides the message up
   .jump(T.toChip, T.toChip + .5, at('bubU', .78), DEV0, 50)
   .stand(T.toChip + .5, T.split + .12, DEV0, { eyes: (t) => t > T.glow ? 'happy' : 'r' })
   .jump(T.split + .12, T.intoPane + .45, DEV0, gut('l0'), 60, { big: true })                                // into the device pane
   .stand(T.intoPane + .45, T.read + .15, gut('l0'), { eyes: 'l' })
   .walk(T.read + .15, T.found - .15, gut('l0'), gut('l2'), { ease: (x) => x })
   .jump(T.found - .15, T.found + .12, gut('l2'), gut('l3'), 24)
   .stand(T.found + .12, T.fix - .1, gut('l3'), { eyes: (t) => t < T.found + .5 ? 'wide' : 'l', still: true })
   .jump(T.fix - .1, T.fix + .25, gut('l3'), gut('l7'), 34)
   .stand(T.fix + .25, T.build + .05, gut('l7'), { eyes: 'l', still: true })
   .jump(T.build + .05, T.build + .4, gut('l7'), gut('l9'), 26)
   .stand(T.build + .4, T.toTab, gut('l9'), { eyes: (t) => t > T.built ? 'happy' : 'l' })
   .jump(T.toTab, T.toTab + .5, gut('l9'), at('tab1', .5), 10, { big: true })                                 // over to the home workstation
   .stand(T.toTab + .5, T.tests - .1, at('tab1', .5), { eyes: 'd' })
   .jump(T.tests - .1, T.tests + .25, at('tab1', .5), onBar, 30)
   .stand(T.tests + .25, T.clone + .1, onBar, { eyes: (t) => t < T.fail ? 'r' : t < T.stuck ? 'wide' : 'd', still: true })   // rides the progress bar
   .stand(T.clone + .1, T.merge - .05, onBar, { eyes: (t) => ((t * 2.2) | 0) % 3 === 0 ? 'd' : 'r' })
   .stand(T.merge - .05, T.close + .05, onBar, { eyes: (t) => t > T.allPass ? 'happy' : 'd' })
   .jump(T.close + .05, T.reply2 + .15, onBar, R2, 90, { big: true })                                          // out of the closing pane, into the reply
   .stand(T.reply2 + .15, T.end + .2, R2, { eyes: (t) => t > T.pet && t < T.pet + 1 ? 'shut' : t > VO.v08 + 1.5 ? 'happy' : 'r',
     sq: (t) => (t > T.pet + .15 && t < T.pet + .75 ? .16 * Math.abs(Math.sin((t - T.pet) * 9)) : 0) })
   .jump(T.end + .2, T.k0, R2, at('w0', .5), 140, { big: true })
   .stand(T.k0, T.k1 - .3, at('w0', .5), { eyes: 'happy' }).jump(T.k1 - .3, T.k1, at('w0', .5), at('w1', .5), 60)
   .stand(T.k1, T.k2 - .3, at('w1', .5), { eyes: 'happy' }).jump(T.k2 - .3, T.k2, at('w1', .5), at('w2', .5), 60)
   .stand(T.k2, T.fold - .05, at('w2', .5), { eyes: 'happy' })
   .jump(T.fold - .05, T.chord - .3, at('w2', .5), () => LOGO_FEET, 110, { spin: true, big: true })
   .hide(T.chord - .3, 99);
}
{ // the clone: splits off the stuck main line, searches the old conversations, brings the clue back
  const histAt = (i) => at('h' + i, .74);
  const g0 = T.cloneGo, hop = Math.max(.18, (T.cloneFind - g0 - 1.05) / 2);
  X2.hide(0, T.clone)
    .stand(T.clone, g0, nearBar(-110), { eyes: 'l' })
    .jump(g0, g0 + .55, nearBar(-110), at('comp', .5), 120)
    .jump(g0 + .55, g0 + 1.05, at('comp', .5), histAt(1), 130, { big: true })
    .jump(g0 + 1.05, g0 + 1.05 + hop, histAt(1), histAt(2), 30)
    .jump(g0 + 1.05 + hop, T.cloneFind, histAt(2), histAt(3), 30)
    .stand(T.cloneFind, T.back - .05, histAt(3), { eyes: (t) => t < T.cloneFind + .4 ? 'wide' : 'happy' })
    .jump(T.back - .05, T.back + .5, histAt(3), at('comp', .5), 130)
    .jump(T.back + .5, T.merge, at('comp', .5), onBar, 130, { big: true })
    .hide(T.merge, 99);
}
ev(T.clone, 'split'); ev(T.merge, 'merge');

// ─────────────────────────── cursor: the user
const CUR = {
  vis: [[4.9, T.send + .5], [T.pet - .7, T.pet + 1.2]],
  path: [[4.9, () => ({ x: MX + 900, y: AY + 620 })], [T.click, () => A('comp', .35)], [T.send - .6, () => A('comp', .35)],
    [T.pet - .7, () => ({ x: MX + 420, y: AY + 620 })], [T.pet, () => { const p = X.eval(T.pet); return { x: p.x + 6, y: p.y - 58 }; }]],
  clicks: [T.click],
};
ev(T.click, 'click'); ev(T.send, 'enter');
function cursorAt(t) {
  let op = 0; for (const [a, b] of CUR.vis) op = Math.max(op, Math.min(seg(t, a, a + .2), 1 - seg(t, b - .25, b)));
  if (op <= 0) return null;
  let i = 0; while (i + 1 < CUR.path.length && CUR.path[i + 1][0] <= t) i++;
  let p;
  if (i + 1 < CUR.path.length && t > CUR.path[i][0]) {
    const [t0, f0] = CUR.path[i], [t1, f1] = CUR.path[i + 1], a = f0(), b = f1(), dur = Math.min(.6, t1 - t0), k = eio(seg(t, t1 - dur, t1));
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, arc = 40 * Math.sin(Math.PI * k);
    p = { x: lerp(a.x, b.x, k) - dy / L * arc, y: lerp(a.y, b.y, k) + dx / L * arc };
  } else p = CUR.path[i][1]();
  if (t > T.pet && t < T.pet + .8) { p.x += 14 * Math.sin((t - T.pet) * 18); }         // petting strokes
  let sc = 1, ring = 0; for (const c of CUR.clicks) { if (t >= c && t < c + .1) sc = .82; if (t >= c && t < c + .45) ring = seg(t, c, c + .45); }
  return { ...p, op, sc, ring };
}
ev(T.pet + .3, 'heart');

// other sound cues
[T.ch1, T.ch2, T.ch3, T.ch4].forEach((t, i) => ev(t, 'chap', { n: i + 1 }));
ev(T.land0, 'band_in'); ev(T.fail, 'drums_out'); ev(T.merge, 'drums_in'); ev(T.end, 'end'); ev(T.chord, 'chord');
ev(.55, 'morph'); ev(T.chord - .3, 'morph');
ev(T.reply1, 'pop'); ev(T.reply2, 'pop'); ev(T.split, 'pane'); ev(T.close, 'pane', { close: 1 });
ev(T.found + .02, 'bang'); ev(T.fix + .3, 'pencil', { d: .8 }); ev(T.built - .25, 'pass', { v: .7 });
for (let t = T.read + .2; t < T.found - .1; t += .085) ev(t, 'lapse');
ev(T.cloneFind, 'found'); [T.k0, T.k1, T.k2].forEach((t, i) => ev(t, 'note', { n: i }));
ev(T.lockT, 'pop');

// ─────────────────────────── build DOM that depends on data
const EL = {};
function build() {
  EL.rows = $('rows');
  EL.rows.innerHTML = ROWS.map((r, i) => `<div class="row" id="row${i}" style="top:${146 + i * 50}px">
    <div class="ico"><svg viewBox="0 0 22 22" class="i0"><circle cx="11" cy="11" r="8.5" fill="none" stroke="#3A3A3E" stroke-width="2"/></svg>
      <svg viewBox="0 0 22 22" class="i1"><circle cx="11" cy="11" r="8.5" fill="none" stroke="#29BC95" stroke-width="2.2" stroke-dasharray="13 60" stroke-linecap="round"/></svg>
      <svg viewBox="0 0 22 22" class="i2"><circle cx="11" cy="11" r="10" fill="#29BC95"/><path d="M6.5 11.5l3 3 6-6.3" stroke="#062018" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <svg viewBox="0 0 22 22" class="i3"><circle cx="11" cy="11" r="10" fill="#E5484D"/><path d="M7.5 7.5l7 7M14.5 7.5l-7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg></div>
    <div class="nm">${r.nm}</div>${r.tag ? `<div class="tag">${r.tag}</div>` : ''}<div class="rt">${r.n} 项</div>${r.fail ? `<div class="rt e">${r.fail}</div>` : ''}</div>`).join('');
  EL.row = ROWS.map((_, i) => { const e = $('row' + i); return { e, ic: [...e.querySelectorAll('.ico svg')], rt: e.querySelectorAll('.rt') }; });
  EL.lines = [...Array(10)].map((_, i) => $('l' + i));
  EL.lines.forEach((l, i) => { l.style.top = (22 + i * 34 + (i >= 6 ? 8 : 0) + (i >= 8 ? 8 : 0)) + 'px'; });
  $('bubU').textContent = TASK;
  EL.bubW = $('bubU').offsetWidth;
  EL.hist = [...Array(6)].map((_, i) => $('h' + i));
  // captions: one span per character, timed by MiniMax; {…} = accent colour
  EL.caps = SUBS.map((s) => {
    const tms = charTimes(s.id, s.text); let em = false, html = '';
    const spans = [];
    [...s.text].forEach((ch, i) => {
      if (ch === '{') { em = true; return; } if (ch === '}') { em = false; return; }
      html += `<span class="kc${em ? ' em' : ''}">${ch === ' ' ? '&nbsp;' : ch}</span>`; spans.push(tms[i]);
    });
    return { html, spans };
  });
  // the on-screen slogan and the lockup tagline light up the same way
  const kar = (el, id, text) => { el.innerHTML = [...text].map((c) => `<span class="kc">${c === ' ' ? '&nbsp;' : c}</span>`).join(''); return { els: [...el.children], tms: charTimes(id, text) }; };
  const slog = ['一个任务', '一个 AI 员工', '每一台授权的电脑'];
  const v9 = charTimes('v09', '一个任务，一个 AI 员工，每一台授权的电脑。').filter(Boolean);
  let off = 0; EL.slog = slog.map((w, i) => { const el = $('w' + i); el.innerHTML = [...w].map((c) => `<span class="kc">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    const tms = [...w].map((c) => (PUN.test(c) ? null : v9[off++])); return { els: [...el.children], tms }; });
  EL.lockt = kar($('lockt'), 'v10', '你的专业 AI 员工'.padStart(0));
  EL.lockt.tms = charTimes('v10', 'CatsCo，你的专业 AI 员工').slice(7);
  EL.chapName = ['交代目标', '指定设备', '并行检索', '带回结果'];
  EL.tip = document.createElement('div'); EL.tip.id = 'tzchip';
  EL.tip.style.cssText = 'position:absolute;height:30px;padding:0 12px;border-radius:15px;background:#1F2A26;border:1.5px solid #29BC95;color:#29BC95;font:600 13px/27px "SF Mono",Menlo,monospace;white-space:nowrap';
  EL.tip.textContent = 'TZ=Asia/Shanghai';
  $('world').appendChild(EL.tip);
}

// ─────────────────────────── UI state for time t (everything the DOM shows)
const px = (v) => v.toFixed(2) + 'px';
function show(e, op) { e.style.opacity = clamp(op).toFixed(3); e.style.visibility = op <= .002 ? 'hidden' : 'visible'; }
function rise(e, t, t0, dy = 14) { const u = spring(t, t0, .8, 15); e.style.transform = `translateY(${((1 - u) * dy).toFixed(2)}px)`; show(e, seg(t, t0, t0 + .16)); }

function layout(t) {
  // pane opens at the split, closes in chapter 04; the chat column reflows (width is a pure function of t)
  const pw = 600 * (ss(seg(t, T.split, T.split + .45)) - ss(seg(t, T.close, T.close + .5)));
  const cw = 1180 - pw;
  const compW = Math.min(760, cw - 60), compL = (cw - compW) / 2;
  const col = $('col'); col.style.width = px(cw);
  const pane = $('pane'); pane.style.left = px(cw); pane.style.width = px(pw); show(pane, pw > 1 ? 1 : 0);

  // empty state ↔ chat
  const chat = ss(seg(t, T.send, T.send + .45)) * (1 - ss(seg(t, T.end, T.end + .6)));
  const endState = seg(t, T.end + .2, T.end + .6);
  $('empty').style.width = px(cw);
  show($('h1q'), (1 - ss(seg(t, T.typeA - .3, T.typeA + .1))) * (1 - chat));
  const sl = $('slogan'); show(sl, endState * (1 - ss(seg(t, T.fold + .2, T.fold + .5))));
  ['w0', 'w1', 'w2'].forEach((id, i) => { const k = [T.k0, T.k1, T.k2][i]; $(id).style.transform = `translateY(${(Math.max(0, Math.sin(seg(t, k, k + .25) * Math.PI)) * 5).toFixed(2)}px)`; });
  show($('lock'), 1);
  const li = $('lockimg');
  show(li, Math.max(1 - seg(t, .35, .75), seg(t, T.chord - .05, T.chord + .2)));
  rise($('lockw'), t, T.lockT, 22); rise($('lockt'), t, T.lockT + .35, 16); rise($('locku'), t, T.lockT + .75, 12);

  // composer: centred in the empty state, docked at the bottom in chat, gone in the lockup
  const n = typedN(t), sent = t >= T.send;
  $('typed').textContent = sent ? '' : TASK.slice(0, n);
  show($('cph'), (n === 0 || sent) ? 1 : 0);
  show($('caret'), t > T.click && !sent && (Math.floor(t * 2.2) % 2 === 0 || (t > T.typeA && t < TYPE[TYPE.length - 1] + .3)) ? 1 : 0);
  const comp = $('comp'); comp.style.width = px(compW); comp.style.left = px(compL);
  const ch = sent ? 56 : Math.max(56, $('ctext').offsetHeight + 32);
  comp.style.height = px(ch);
  const yEmpty = 407, yChat = 824 - ch;
  const cy = lerp(yEmpty, yChat, chat);
  comp.style.top = px(cy);
  const hint = $('hint'); hint.style.left = px(0); hint.style.width = px(cw); hint.style.top = px(cy + ch + (chat > .5 ? 8 : 26));
  show(comp, 1 - ss(seg(t, T.fold, T.fold + .4))); show(hint, (1 - ss(seg(t, T.fold, T.fold + .4))) * (cw > 900 ? 1 : 0));
  $('send').style.transform = `scale(${(1 - .14 * Math.max(0, Math.sin(seg(t, T.send, T.send + .25) * Math.PI))).toFixed(3)})`;
  $('send').style.background = (n > 0 && !sent) || chat < .01 && t < T.click ? '#29BC95' : '#3A3A3D';

  // timeline
  const tl = $('tl'); tl.style.left = px(compL); tl.style.width = px(compW);
  tl.style.transform = `translateY(${(-60 * ss(seg(t, T.end, T.end + .6))).toFixed(2)}px)`; show(tl, 1 - ss(seg(t, T.end, T.end + .5)));
  // the typed line flies up into the user bubble
  const mU = $('mU'), fly = spring(t, T.send, .78, 13);
  const fromX = 56 - (compW - EL.bubW), fromY = (yEmpty + 16) - (56 + 30 + 13);   // from the composer's text to the bubble's slot
  mU.style.transform = `translate(${((1 - fly) * fromX).toFixed(2)}px,${((1 - fly) * fromY).toFixed(2)}px)`;
  show(mU, sent ? 1 : 0);
  const m1 = $('mB1'); m1.style.top = '150px'; rise(m1, t, T.reply1, 18);
  rise($('dev0'), t, T.reply1 + .18, 8); rise($('dev1'), t, T.reply1 + .28, 8);
  const glow = seg(t, T.glow, T.glow + .2) * (1 - seg(t, T.glow + 1.6, T.glow + 2.1));
  [$('dev0'), $('dev1')].forEach((d) => { d.style.borderColor = glow > .01 ? `rgba(41,188,149,${glow.toFixed(2)})` : '#333336'; d.style.boxShadow = glow > .01 ? `0 0 0 ${(4 * glow).toFixed(1)}px rgba(41,188,149,.18)` : 'none'; });
  const m2 = $('mB2'); m2.style.top = '336px'; rise(m2, t, T.reply2, 18); rise($('f0'), t, T.reply2 + .25, 10); rise($('f1'), t, T.reply2 + .38, 10);
  // rack focus during the time-lapse: the chat goes soft, the pane stays sharp
  const rack = seg(t, T.read, T.read + .25) * (1 - seg(t, T.found - .1, T.found + .15));
  col.style.filter = rack > .01 ? `blur(${(2.2 * rack).toFixed(2)}px)` : 'none';
  $('ttl').textContent = t < T.send ? '新任务 · 小八' : 'billing-web 修复';

  // sidebar: the new task appears in 历史任务; the clone hops the rows; the old conversation lights up
  const ins = spring(t, T.send + .2, .8, 14);
  EL.hist.forEach((e, i) => {
    const y = i === 0 ? 0 : (i - 1) * 38 + 38 * ins;
    e.style.transform = `translateY(${y.toFixed(2)}px)`;
    if (i === 0) show(e, seg(t, T.send + .2, T.send + .4));
  });
  EL.hist[0].style.background = t > T.send ? '#232325' : 'transparent';
  const found = seg(t, T.cloneFind, T.cloneFind + .15) * (1 - seg(t, T.back + .4, T.back + .8));
  EL.hist[3].style.background = found > .01 ? `rgba(41,188,149,${(.16 * found).toFixed(3)})` : 'transparent';
  EL.hist[3].style.boxShadow = found > .01 ? `inset 3px 0 0 rgba(41,188,149,${found.toFixed(2)})` : 'none';
  const clue = $('clue'); const cu = spring(t, T.cloneFind + .15, .75, 15);
  clue.style.transform = `translateY(${((1 - cu) * 14).toFixed(2)}px) scale(${(.96 + .04 * cu).toFixed(3)})`;
  show(clue, seg(t, T.cloneFind + .15, T.cloneFind + .3) * (1 - seg(t, T.back + .2, T.back + .5)));

  // pane: tabs, company log, home tests
  const home = t >= T.toTab + .45;
  [$('tab0'), $('tab1')].forEach((e, i) => { const on = (i === 1) === home; e.style.background = on ? '#232325' : 'transparent'; e.style.color = on ? '#ECECEC' : '#9A9AA0'; });
  const sw = ss(seg(t, T.toTab + .45, T.toTab + .75));
  $('pb0').style.transform = `translateX(${(-40 * sw).toFixed(1)}px)`; show($('pb0'), 1 - sw);
  $('pb1').style.transform = `translateX(${(40 * (1 - sw)).toFixed(1)}px)`; show($('pb1'), sw);
  const lapse = (i, n0) => T.read + .15 + (T.found - .15 - T.read - .15) * (i / n0);
  const LT = [T.intoPane + .5, lapse(1, 2), lapse(2, 2), T.found, T.found + .08, T.fix - .15, T.fix + .2, T.fix + .3, T.build, T.built - .25];
  EL.lines.forEach((l, i) => rise(l, t, LT[i], 8));
  const addLine = EL.lines[7];                 // the + line is written under the pencil
  const wr = seg(t, T.fix + .3, T.fix + 1.1);
  addLine.style.clipPath = `inset(0 ${((1 - wr) * 100).toFixed(1)}% 0 0)`;
  EL.lines[3].style.background = t > T.found && t < T.fix ? 'rgba(229,72,77,.14)' : 'transparent';

  let passed = 0;
  ROWS.forEach((r, i) => {
    const R = EL.row[i];
    const failed = r.fail && t >= r.done && t < T.rerun;
    const running = (t >= r.start && t < r.done) || (r.fix && t >= T.rerun && t < r.fix);
    const ok = !failed && !running && t >= (r.fix || r.done);
    R.ic[0].style.opacity = !running && !ok && !failed ? 1 : 0;
    R.ic[1].style.opacity = running ? 1 : 0; R.ic[1].style.transform = `rotate(${(t * 540) % 360}deg)`;
    R.ic[2].style.opacity = ok ? 1 : 0; R.ic[2].style.transform = `scale(${(.6 + .4 * spring(t, r.fix || r.done, .45, 20)).toFixed(3)})`;
    R.ic[3].style.opacity = failed ? 1 : 0;
    R.e.style.background = failed ? 'rgba(229,72,77,.10)' : 'transparent';
    if (r.fail) { R.rt[0].style.opacity = failed ? 0 : 1; R.rt[1].style.opacity = failed ? 1 : 0; }
    if (ok) passed += r.n;
  });
  $('tcnt').textContent = `${passed} / 214`;
  $('bfill').style.width = `${(passed / 214 * 100).toFixed(2)}%`;
  $('bfill').style.background = t >= T.fail && t < T.rerun ? '#E5484D' : '#29BC95';
  const bn = spring(t, T.allPass, .5, 17);
  $('banner').style.transform = `scale(${(.9 + .1 * bn).toFixed(4)})`; show($('banner'), seg(t, T.allPass, T.allPass + .1));
  return { pw, cw };
}

// ─────────────────────────── the cold open and the fold: M ↔ 小八, pixel by pixel
const CAT0 = catPix({ eyes: 'n' });
const PAIR = (() => {   // pair each M pixel with a cat pixel by position, so the logo visibly becomes the cat
  const m = M_PIX.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const c = CAT0.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const pairs = m.map((p, i) => ({ from: p, to: c[Math.floor(i * c.length / m.length)] }));
  const used = new Set(pairs.map((p) => p.to));
  const extra = c.filter((p) => !used.has(p));
  return { pairs, extra };
})();
function morphPix(u, eyes) {   // u: 0 = M, 1 = cat
  const out = [];
  PAIR.pairs.forEach(({ from, to }, i) => {
    const d = hash(i * 3.1) * .35, k = back(seg(u, d, d + .6));
    const lift = Math.sin(Math.PI * clamp(k)) * -1.2;
    out.push([lerp(from[0], to[0], k), lerp(from[1], to[1], k) + lift, k > .6 ? to[2] : 1]);
  });
  PAIR.extra.forEach((p, i) => { const d = .45 + hash(i * 5.7) * .35; out.push([p[0], p[1], p[2], 1, back(seg(u, d, d + .25))]); });
  if (u > .85) for (const [x, y] of EYES[eyes]) out.push([x, y, 2, seg(u, .85, 1)]);
  return out;
}

/** light each character as it is spoken: dim → full over 90 ms, with a 2 px lift that settles */
function karaoke(els, tms, t, dim = .42) {
  els.forEach((e, i) => {
    const tm = tms[i]; if (!tm) { e.style.opacity = '1'; return; }
    const u = seg(t, tm[0] - .03, tm[0] + .06);
    e.style.opacity = (dim + (1 - dim) * u).toFixed(3);
    e.style.transform = `translateY(${(-2 * Math.sin(Math.PI * seg(t, tm[0] - .03, tm[0] + .18))).toFixed(2)}px)`;
  });
}

// ─────────────────────────── render(t)
let HUD = false;
function render(t) {
  t = clamp(t, 0, DUR);
  CAM = camAt(t);
  const z = CAM.z;
  $('world').style.transform = `matrix(${z},0,0,${z},${(W_ / 2 - CAM.x * z).toFixed(3)},${(H_ / 2 - CAM.y * z).toFixed(3)})`;
  layout(t);

  // actors
  let html = '';
  if (t < T.land0 - .55) {                       // cold open: the real logo → the pixel M → 小八 (shrinking to its own pixel size)
    const q = seg(t, .35, .75), u = seg(t, .95, 1.75);
    html += spriteSVG(morphPix(u, u > .9 ? 'happy' : 'n'), { ...LOGO_FEET, px: lerp(LOGO_PX, 6, eio(u)), op: q, sq: .06 * Math.sin(seg(t, 1.75, 1.85) * Math.PI) });
  }
  if (t >= T.chord - .3 && t < T.chord + .2) {   // the fold: 小八 → the M → the real logo
    const u = 1 - seg(t, T.chord - .3, T.chord), q = seg(t, T.chord - .05, T.chord + .2);
    html += spriteSVG(morphPix(u, 'happy'), { ...LOGO_FEET, px: lerp(LOGO_PX, 6, eio(u)), op: 1 - q });
  }
  const main = X.eval(t), clone = X2.eval(t);
  for (const [a, who] of [[main, X], [clone, X2]]) {
    if (!a) continue;
    html += spriteSVG(catPix(a), a);
    for (const tl of who.lands()) { const u = seg(t, tl, tl + .4); if (u > 0 && u < 1) html += dust(a.x, a.y, u); }
  }
  if (main) {
    const hx = main.x, hy = main.y - 64;
    if (t > T.found && t < T.found + .7) html += BANG(hx + 44, hy + 6, 5, 1 - seg(t, T.found + .5, T.found + .7));
    if (t > T.fix + .2 && t < T.build) { const w = Math.sin(t * 22) * 3; html += PENCIL(hx + 50 + w, main.y - 20, 5, seg(t, T.fix + .2, T.fix + .3)); }
    if (t > T.built && t < T.built + .8) html += SPARK(hx - 50, hy + 10 - 20 * seg(t, T.built, T.built + .8), 5, 1 - seg(t, T.built + .5, T.built + .8));
    if (t > T.fail + .05 && t < T.clone) html += SWEAT(hx + 50, hy + 8 + 16 * ((t * 1.6) % 1), 4, 1);
    if (t > T.pet + .3 && t < T.pet + 1.5) { const u = seg(t, T.pet + .3, T.pet + 1.5); html += HEART(hx + 30, hy - 10 - 40 * eo(u), 5, 1 - seg(u, .7, 1)); }
    if (t > T.allPass && t < T.allPass + .8) html += SPARK(hx + 60, hy - 10 * seg(t, T.allPass, T.allPass + .8), 5, 1 - seg(t, T.allPass + .5, T.allPass + .8));
  }
  // split and merge: a burst of pixels on the grid
  for (const [tb, p0] of [[T.clone, main], [T.merge, main]]) {
    const u = seg(t, tb, tb + .45);
    if (u > 0 && u < 1 && p0) for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + hash(i) * .4, r = 30 + 60 * eo(u), s = 6 * (1 - u);
      html += `<div class="p" style="left:${(p0.x + Math.cos(a) * r - s / 2).toFixed(1)}px;top:${(p0.y - 30 + Math.sin(a) * r - s / 2).toFixed(1)}px;width:${s.toFixed(1)}px;height:${s.toFixed(1)}px;background:#29BC95"></div>`;
    }
  }
  $('actors').innerHTML = html;
  // the clue rides on the clone's head, then drops onto the failing row
  const tip = EL.tip;
  if (clone && t > T.cloneFind + .3) { tip.style.left = px(clone.x - 70); tip.style.top = px(clone.y - 104); show(tip, 1); }
  else if (t >= T.merge && t < T.rerun + .3) { const r = A('row4', .5); const u = eio(seg(t, T.merge, T.rerun)); const c = X.eval(t) || r; tip.style.left = px(lerp(c.x, r.x + 20, u) - 70); tip.style.top = px(lerp(c.y - 104, r.y + 8, u)); show(tip, 1 - seg(t, T.rerun + .1, T.rerun + .3)); }
  else show(tip, 0);

  // cursor
  const cu = cursorAt(t), ce = $('cursor'), cr = $('cring');
  if (cu) { ce.style.transform = `translate(${(cu.x - 5).toFixed(2)}px,${(cu.y - 3).toFixed(2)}px) scale(${cu.sc})`; show(ce, cu.op);
    cr.style.left = px(cu.x); cr.style.top = px(cu.y); cr.style.transform = `scale(${(.4 + 1.1 * eo(cu.ring)).toFixed(3)})`; show(cr, cu.ring > 0 && cu.ring < 1 ? 1 - cu.ring : 0); }
  else { show(ce, 0); show(cr, 0); }

  // spotlight on the promise: "只在你授权的设备上工作"
  const sp = seg(t, T.glow - .1, T.glow + .3) * (1 - seg(t, T.glow + 1.6, T.glow + 2.1));
  if (sp > .01) { const a = A('dev0', 1.0); const sx = (a.x - CAM.x) * z + W_ / 2, sy = (a.y + 17 - CAM.y) * z + H_ / 2;
    $('vig').style.background = `radial-gradient(520px 260px at ${sx.toFixed(0)}px ${sy.toFixed(0)}px, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,${(.55 * sp).toFixed(3)}) 100%)`; }
  else $('vig').style.background = 'none';

  // directional motion blur, only on whips: from the camera's on-screen speed, on the untransformed stage
  const c0 = camAt(t - .5 / FPS), c1 = camAt(t + .5 / FPS);
  const vx = Math.abs(c1.x - c0.x) * z, vy = Math.abs(c1.y - c0.y) * z, vz = Math.abs(Math.log(c1.z / c0.z)) * 700;
  const bx = Math.min(22, Math.max(0, (vx + vz) * .45 - 1.5)), by = Math.min(22, Math.max(0, (vy + vz) * .45 - 1.5));
  $('mbg').setAttribute('stdDeviation', `${bx.toFixed(2)} ${by.toFixed(2)}`);
  $('stage').style.filter = bx + by > .3 ? 'url(#mb)' : 'none';

  // HUD: chapter pill, 4× tag, keystrokes, captions, fades
  const chs = [T.ch1, T.ch2, T.ch3, T.ch4]; let ci = -1; chs.forEach((c, i) => { if (t >= c) ci = i; });
  const chap = $('chap');
  if (ci >= 0 && t < T.end) { $('chapn').textContent = '0' + (ci + 1); $('chapt').textContent = EL.chapName[ci];
    const u = spring(t, chs[ci], .6, 16); chap.style.transform = `scale(${(.7 + .3 * u).toFixed(4)})`; show(chap, seg(t, chs[ci], chs[ci] + .12)); }
  else show(chap, t >= T.end ? 1 - seg(t, T.end, T.end + .3) : 0);
  show($('lapse'), t > T.read + .1 && t < T.found - .1 ? (Math.floor(t * 3) % 2 ? 1 : .55) : 0);
  const keys = $('keys'); const kp = t >= T.send - .05 && t < T.send + .7;
  keys.innerHTML = kp ? '<div class="k">⏎ Enter</div>' : ''; if (kp) { const u = spring(t, T.send - .05, .6, 18); keys.style.transform = `scale(${(.8 + .2 * u).toFixed(3)})`; keys.style.opacity = (1 - seg(t, T.send + .5, T.send + .7)).toFixed(2); }
  const s = SUBS.find((x) => x.screen && t >= x.t0 && t < x.t1);
  const cap = $('capt');
  if (s) { const i = SUBS.indexOf(s); if (cap.dataset.i !== String(i)) { cap.innerHTML = EL.caps[i].html; cap.dataset.i = String(i); }
    karaoke([...cap.children], EL.caps[i].spans, t);
    show($('cap'), seg(t, s.t0, s.t0 + .12) * (1 - seg(t, s.t1 - .12, s.t1))); }
  else show($('cap'), 0);
  for (const w of EL.slog) karaoke(w.els, w.tms, t, .3);
  karaoke(EL.lockt.els, EL.lockt.tms, t, .35);
  show($('fade'), (1 - seg(t, 0, .45)) + seg(t, DUR - .8, DUR));
  if (HUD) $('dbg').textContent = `t ${t.toFixed(3)}  z ${z.toFixed(2)}`;
}

// ─────────────────────────── contract
window.DUR = DUR; window.FPS = FPS; window.EV = EV.sort((a, b) => a.t - b.t); window.SUBS = SUBS; window.T = T;
window.SECS = { bpm: BPM, band: T.land0, chapters: [T.ch1, T.ch2, T.ch3, T.ch4], drumsOut: T.fail, drumsIn: T.merge, end: T.end, chord: T.chord, dur: DUR };
window.render = render;
const q = new URLSearchParams(location.search);
HUD = q.has('hud'); if (HUD) $('dbg').style.display = 'block';
Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]).then(() => {
  build(); render(0);
  if (q.has('t')) render(parseFloat(q.get('t')));
  window.READY = true;
  if (q.has('play')) {
    const au = new Audio('out/mix.wav'); let t0 = null;
    document.addEventListener('click', () => { au.currentTime = parseFloat(q.get('t') || 0); au.play(); t0 = performance.now() - au.currentTime * 1000; }, { once: true });
    const loop = () => { if (t0 !== null) render(au.paused ? (performance.now() - t0) / 1000 : au.currentTime); requestAnimationFrame(loop); }; loop();
  }
});
})();
