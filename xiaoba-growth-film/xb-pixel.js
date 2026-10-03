'use strict';
// 小八 (XiaoBa), CatsCo's AI employee, as pixel art. Its body is the CatsCo "M" quantised to an
// 18×10 grid: the M's two raised outer corners are the ears. Sprites are data, built from shared
// parts (ears, body, eyes, mouth, legs, arm, tail), so an edit to one part carries through every pose.
// Rendering: each pose is drawn once into a 1:1 bitmap and blitted scaled with smoothing off, at a
// whole number of logical units per sprite pixel and a rounded position (craft.md §8).

// Values: 1 body · 2 eye/dark · 3 belly shade · 4 glint · 5 blush · 6 highlight
const XB_LOOKS = {
  terminal: {name: '终端绿', 1: '#46f29b', 2: '#04110a', 3: '#23a866', 4: '#eafff2', 5: '#8cffc4', 6: '#b8ffd9', bg: '#050b07'},
  chat:     {name: '聊天绿', 1: '#07c160', 2: '#0b1612', 3: '#05934a', 4: '#ffffff', 5: '#ff9a8a', 6: '#6fe3a6', bg: '#ededed'},
  device:   {name: '设备蓝', 1: '#8fd8ff', 2: '#0d1a3a', 3: '#4f9fd6', 4: '#ffffff', 5: '#ffb3d1', 6: '#d6f3ff', bg: '#10204a'},
  catsco:   {name: 'CatsCo', 1: '#29bc95', 2: '#0b1612', 3: '#1f8f72', 4: '#ffffff', 5: '#ff8f7e', 6: '#7ee0c2', bg: '#0e1110'},
};
// The M, sampled from the real logo on the same grid.
const XB_M = ['#................#', '###............###', '######......######', '##.#####..#####.##', '##...########...##',
  '##.##...##...##.##', '##.#.##....##.#.##', '##.#...####...#.##', '##.#..........#.##', '##.#..........#.##'];

const XB_EYES = {
  n: [[4, 4], [4, 5], [13, 4], [13, 5]], r: [[5, 4], [5, 5], [14, 4], [14, 5]], l: [[3, 4], [3, 5], [12, 4], [12, 5]],
  u: [[4, 3], [4, 4], [13, 3], [13, 4]], d: [[4, 5], [4, 6], [13, 5], [13, 6]], blink: [[4, 5], [13, 5]],
  happy: [[3, 5], [4, 4], [5, 5], [12, 5], [13, 4], [14, 5]], shut: [[3, 5], [4, 5], [5, 5], [12, 5], [13, 5], [14, 5]],
  wide: [[4, 3], [4, 4], [4, 5], [13, 3], [13, 4], [13, 5]],
  dizzy: [[3, 3], [5, 3], [4, 4], [3, 5], [5, 5], [12, 3], [14, 3], [13, 4], [12, 5], [14, 5]],
  focus: [[4, 4], [4, 5], [5, 3], [13, 4], [13, 5], [12, 3]],
  sad: [[4, 5], [4, 6], [3, 4], [13, 5], [13, 6], [14, 4]],
  big: [[4, 4], [5, 4], [4, 5], [5, 5], [13, 4], [14, 4], [13, 5], [14, 5]],
};
const XB_GLINT = {big: [[4, 4], [13, 4]]};   // white pixel on top of the eye
const XB_MOUTH = {none: [], smile: [[8, 6], [9, 6]], open: [[8, 6], [9, 6], [8, 7], [9, 7]], o: [[8, 6], [9, 6], [8, 7], [9, 7]], w: [[7, 6], [8, 7], [9, 7], [10, 6]]};
// Legs: [x, height]; a height of 0 hides the leg.
const XB_LEGS = {
  stand: [[2, 2], [4, 2], [13, 2], [15, 2]], walkA: [[2, 2], [4, 1], [13, 2], [15, 1]], walkB: [[2, 1], [4, 2], [13, 1], [15, 2]],
  tuck: [[2, 1], [4, 1], [13, 1], [15, 1]], none: [], sit: [[4, 2], [13, 2]], typeA: [[2, 2], [4, 2], [13, 1], [15, 2]], typeB: [[2, 2], [4, 2], [13, 2], [15, 1]],
  reach: [[2, 3], [4, 3], [13, 3], [15, 3]],
};
const XB_ARM = {none: [], point: [[18, 5], [19, 5]], wave: [[18, 4], [19, 3], [19, 2]], up: [[16, -1], [16, -2], [15, -3]]};
const XB_TAIL = {none: [], up: [[-1, 6], [-2, 5], [-2, 4], [-2, 3], [-1, 2]], wag: [[-1, 6], [-2, 5], [-3, 4], [-3, 3], [-2, 2]], down: [[-1, 6], [-2, 7], [-3, 7]]};

// One pose → pixel list [[x, y, v], ...]. body: 'norm' | 'squash' (one row shorter) | 'tall' (one row taller) | 'long' (stretch)
function xbPixels({eyes = 'n', ears = 'up', mouth = 'none', legs = 'stand', arm = 'none', tail = 'none', body = 'norm', blush = false} = {}) {
  const P = new Map(), put = (x, y, v = 1) => P.set(x + ',' + y, [x, y, v]);
  const top = body === 'squash' ? 3 : body === 'tall' ? 1 : 2, dy = top - 2, wide = body === 'long' ? 4 : 0, R = 17 + wide;
  // ears
  if (ears === 'up') { for (const x of [0, 1, R - 1, R]) put(x, 0 + dy); for (const x of [0, 1, 2, R - 2, R - 1, R]) put(x, 1 + dy); }
  if (ears === 'perk') { for (const x of [0, R]) put(x, -1 + dy); for (const x of [0, 1, R - 1, R]) put(x, 0 + dy); for (const x of [0, 1, 2, R - 2, R - 1, R]) put(x, 1 + dy); }
  if (ears === 'flat') { for (const x of [-1, 0, 1, R - 1, R, R + 1]) put(x, 1 + dy); }
  if (ears === 'droop') { for (const x of [-1, 0, R, R + 1]) put(x, 2 + dy); put(-1, 3 + dy); put(R + 1, 3 + dy); }
  // body and belly
  for (let y = top; y < 8; y++) for (let x = 0; x <= R; x++) put(x, y, y === 7 ? 3 : 1);
  for (let x = 1; x < 4; x++) put(x, top, 6);   // a highlight on the crown
  // face, shifted with the body; a long body keeps the face at the front
  const fx = wide, fy = dy;
  for (const [x, y] of XB_EYES[eyes]) put(x + fx, y + fy, 2);
  for (const [x, y] of XB_GLINT[eyes] || []) put(x + fx, y + fy, 4);
  for (const [x, y] of XB_MOUTH[mouth]) if (y + fy < 8) put(x + fx, y + fy, 2);
  if (blush) { put(2 + fx, 6 + fy, 5); put(15 + fx, 6 + fy, 5); }
  // legs, arm, tail
  for (const [x0, h] of XB_LEGS[legs]) { const x = x0 >= 9 ? x0 + wide : x0; for (let y = 8; y < 8 + h; y++) put(x, y); }
  for (const [x, y] of XB_ARM[arm]) put(x + wide, y + fy, 1);
  for (const [x, y] of XB_TAIL[tail]) put(x, y, 1);
  return [...P.values()];
}
// The kitten (the CLI days): the same design on a 12×7 grid.
function xbKitPixels({eyes = 'n', legs = 'stand', ears = 'up', mouth = 'none'} = {}) {
  const P = new Map(), put = (x, y, v = 1) => P.set(x + ',' + y, [x, y, v]);
  if (ears === 'up') { put(0, 0); put(11, 0); } for (const x of [0, 1, 10, 11]) put(x, 1);
  for (let y = 2; y < 6; y++) for (let x = 0; x < 12; x++) put(x, y, y === 5 ? 3 : 1);
  put(1, 2, 6); put(2, 2, 6);
  const E = {n: [[3, 3], [3, 4], [8, 3], [8, 4]], r: [[4, 3], [4, 4], [9, 3], [9, 4]], happy: [[2, 4], [3, 3], [4, 4], [7, 4], [8, 3], [9, 4]], blink: [[3, 4], [8, 4]], d: [[3, 4], [3, 5], [8, 4], [8, 5]], wide: [[3, 2], [3, 3], [3, 4], [8, 2], [8, 3], [8, 4]]}[eyes];
  for (const [x, y] of E) put(x, y, 2);
  if (mouth === 'smile') { put(5, 4, 2); put(6, 4, 2); }
  const L = {stand: [[1, 1], [3, 1], [8, 1], [10, 1]], walkA: [[1, 1], [8, 1]], walkB: [[3, 1], [10, 1]], tuck: []}[legs];
  for (const [x, h] of L) for (let y = 6; y < 6 + h; y++) put(x, y);
  return [...P.values()];
}
// Logo → cat: each M pixel is paired with a cat pixel by reading order, so the logo visibly becomes the cat.
const XB_MPIX = []; XB_M.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') XB_MPIX.push([x, y, 1]); }));
function xbMorph(u) {
  const cat = xbPixels({eyes: 'n'}).sort((a, b) => a[1] - b[1] || a[0] - b[0]), m = XB_MPIX.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const out = [], used = new Set();
  m.forEach((p, i) => { const j = Math.floor(i * cat.length / m.length), q = cat[j]; used.add(j); const k = easeIO(clamp((u - hash(i, 3) * .3) / .7, 0, 1));
    out.push([Math.round(lerp(p[0], q[0], k)), Math.round(lerp(p[1], q[1], k)), k > .6 ? q[2] : 1]); });
  cat.forEach((q, j) => { if (!used.has(j) && u > .55 + hash(j, 5) * .4) out.push(q); });
  return out;
}

// ---------- props: small pixel sprites of their own ----------
const XB_PROPS = {
  file:   {rows: ['kkkkk..', 'kwwwwk.', 'kwgggwk', 'kwwwwwk', 'kwgggwk', 'kwwwwwk', 'kwgggwk', 'kkkkkkk'], pal: {k: '#0b1612', w: '#ffffff', g: '#29bc95'}},
  badge:  {rows: ['.r...r.', '..r.r..', '.kkkkk.', '.kgggk.', '.kwwwk.', '.kwkwk.', '.kkkkk.'], pal: {r: '#e5484d', k: '#0b1612', g: '#29bc95', w: '#ffffff'}},
  bang:   {rows: ['.kkk.', 'kyyyk', 'kyyyk', 'kyyyk', '.kyk.', '.kkk.', 'kyyyk', '.kkk.'], pal: {y: '#ffe27a', k: '#0b1612'}},
  sweat:  {rows: ['.b.', 'bbb', 'bbb', '.b.'], pal: {b: '#7fc4f0'}},
  heart:  {rows: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], pal: {r: '#ff5a5f'}},
  spark:  {rows: ['..y..', '..y..', 'yy.yy', '..y..', '..y..'], pal: {y: '#ffe27a'}},
  star:   {rows: ['.y.', 'yyy', '.y.'], pal: {y: '#ffe27a'}},
  z:      {rows: ['wwww', '..w.', '.w..', 'wwww'], pal: {w: '#cfe9df'}},
  keys:   {rows: ['kkkkkkkkkkkkkk', 'kwkwkwkwkwkwkk', 'kkkkkkkkkkkkkk', 'kkwkwkwkwkwkwk', 'kkkkkkkkkkkkkk'], pal: {k: '#3a4a45', w: '#9bb5ad'}},
  monitor: {rows: ['kkkkkkkkkkkkkkkk', 'kssssssssssssssk', 'kssssssssssssssk', 'kssssssssssssssk', 'kssssssssssssssk', 'kssssssssssssssk', 'kssssssssssssssk', 'kssssssssssssssk',
    'kkkkkkkkkkkkkkkk', '......kkkk......', '...kkkkkkkkkk...'], pal: {k: '#5d6b67', s: '#10204a'}},
};
function xbPropPixels(name) { const {rows, pal} = XB_PROPS[name], out = []; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) out.push([x, y, pal[ch]]); })); return out; }

// ---------- rendering ----------
const XB_BMP = new Map();
function xbBitmap(pix, look) {
  const key = look + '|' + pix.map(p => p.join(':')).join(';');
  if (XB_BMP.has(key)) return XB_BMP.get(key);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pix) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cv = document.createElement('canvas'); cv.width = x1 - x0 + 1; cv.height = y1 - y0 + 1;
  const g = cv.getContext('2d'), L = XB_LOOKS[look] || XB_LOOKS.catsco;
  for (const [x, y, v] of pix) { g.fillStyle = typeof v === 'string' ? v : L[v]; g.fillRect(x - x0, y - y0, 1, 1); }
  const b = {cv, x0, y0}; XB_BMP.set(key, b); if (XB_BMP.size > 400) XB_BMP.delete(XB_BMP.keys().next().value);
  return b;
}
// Draw pixels with grid point (ax, ay) at logical (x, y). px is logical units per sprite pixel (a whole number).
// flip mirrors horizontally about the anchor; flipY turns it over (a fall onto its back).
function xbBlit(c, pix, {x, y, px = 6, look = 'catsco', ax = 9, ay = 10, flip = false, flipY = false, alpha: al = 1} = {}) {
  const b = xbBitmap(pix, look), w = b.cv.width, h = b.cv.height;
  c.save(); c.imageSmoothingEnabled = false; c.globalAlpha *= al;
  c.translate(Math.round(x), Math.round(y)); c.scale(flip ? -px : px, flipY ? -px : px);
  c.drawImage(b.cv, b.x0 - ax, b.y0 - ay, w, h);
  c.restore();
}
// 小八 standing with its feet at (x, y).
function drawXiaoba(c, pose = {}, o = {}) { xbBlit(c, pose.kit ? xbKitPixels(pose) : xbPixels(pose), {ax: pose.kit ? 6 : 9, ay: pose.kit ? 7 : 10, ...o}); }
function drawProp(c, name, x, y, px = 6, o = {}) { xbBlit(c, xbPropPixels(name), {x, y, px, ax: 0, ay: 0, ...o}); }
// A checker dither: the Branch Agent is 小八's copy, half there.
function xbDither(pix, phase = 0) { return pix.filter(([x, y]) => (x + y + phase) % 2 === 0); }

// Faces are SIL OFL and ship in fonts/ (fetch_fonts.sh).
const XB_FONT = '"LXGW WenKai",cursive';
for (const [family, file, desc] of [['LXGW WenKai', 'LXGWWenKai-Medium.ttf', {weight: '100 900'}]]) {
  const face = new FontFace(family, `url('fonts/${file}')`, desc);
  _photoLoads.push(face.load().then(f => document.fonts.add(f)).catch(e => { window.__error = 'font failed to load: ' + file; throw e; }));
}
