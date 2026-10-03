'use strict';
// The world of the film: two rails that are the two repositories, commit bricks in their real
// daily counts, three regions whose look changes at real commits, HUD, cards and captions.
// World x is time: one day = DX logical units, day 0 = 2026-02-04. Everything snaps to whole units.

const DX = 48, RU = 470, RL = 830;                 // day width; rail heights at normal view
const dayX = d => d * DX;
const D0 = Date.UTC(2026, 1, 4);
const dateOf = d => { const t = new Date(D0 + Math.floor(d) * 864e5); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`; };
const PXF = '"Press Start 2P",monospace';
{ const face = new FontFace('Press Start 2P', `url('fonts/PressStart2P-Regular.ttf')`);
  _photoLoads.push(face.load().then(f => document.fonts.add(f)).catch(e => { window.__error = 'font failed to load: PressStart2P'; throw e; })); }

// Regions. Seams sit just after the day they belong to: 3 月 4 日 the move into CatsCompany,
// 5 月 9 日 the CatsCo productization.
const SEAM1 = dayX(28) + 24, SEAM2 = dayX(94) + 24;
const LOOK = {
  terminal: {bg: '#050b07', dot: '#0f2a1b', rail: '#46f29b', railDim: '#1f6b44', U: '#46f29b', L: '#2fae70', ink: '#46f29b', dim: '#2a8a57', panel: '#07140c', edge: '#46f29b', cat: 'terminal'},
  chat:     {bg: '#eceeec', dot: '#d5dad7', rail: '#9aa39f', railDim: '#c3c9c6', U: '#e9a23b', L: '#07c160', ink: '#1b1f1d', dim: '#7b8580', panel: '#ffffff', edge: '#1b1f1d', cat: 'chat'},
  catsco:   {bg: '#0e1110', dot: '#1b2220', rail: '#5d6b67', railDim: '#2e3835', U: '#f2c14e', L: '#29bc95', ink: '#e8efe9', dim: '#7d8a85', panel: '#151a19', edge: '#29bc95', cat: 'catsco'},
};
const lookAtX = x => x < SEAM1 ? LOOK.terminal : x < SEAM2 ? LOOK.chat : LOOK.catsco;

// ---------- the view ----------
// Normal view: screen x = world x - camL. The pull-back at the end zooms x (and y less) about a centre.
let VW = {camL: 0, zx: 1, zy: 1, cx: 0, yU: RU, yL: RL, pull: 0};
const sxOf = wx => Math.round(VW.pull ? W / 2 + (wx - VW.cx) * VW.zx : wx - VW.camL);
const wxOf = sx => VW.pull ? VW.cx + (sx - W / 2) / VW.zx : sx + VW.camL;   // screen x back to world x
const syOf = y => Math.round(lerp(VW.yU, VW.yL, (y - RU) / (RL - RU)));       // maps normal-view y through the moving rails

// ---------- text and panels ----------
function wText(c, s, x, y, {font = 'wk', size = 32, col = '#fff', align = 'left', base = 'alphabetic', al = 1} = {}) {
  c.save(); c.globalAlpha *= al; c.font = font === 'px' ? `${size}px ${PXF}` : `${size}px ${XB_FONT}`; c.fillStyle = col; c.textAlign = align; c.textBaseline = base; c.fillText(s, Math.round(x), Math.round(y)); c.restore();
}
function wMeasure(c, s, font, size) { c.save(); c.font = font === 'px' ? `${size}px ${PXF}` : `${size}px ${XB_FONT}`; const w = c.measureText(s).width; c.restore(); return w; }
// A pixel panel: square corners cut by one unit block, a 3-unit border and a hard drop shadow.
function wPanel(c, x, y, w, h, {bg, edge, shadow = 'rgba(0,0,0,.35)', u = 4} = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  c.fillStyle = shadow; c.fillRect(x + u, y + h, w, u); c.fillRect(x + w, y + u, u, h);
  c.fillStyle = edge; c.fillRect(x + u, y, w - 2 * u, h); c.fillRect(x, y + u, w, h - 2 * u);
  c.fillStyle = bg; c.fillRect(x + u, y + u, w - 2 * u, h - 2 * u);
}
// Steps an appearance in three hard frames, the way a pixel UI pops.
const wStep = (t, t0, d = .18) => t < t0 ? 0 : t >= t0 + d ? 1 : Math.ceil((t - t0) / d * 3) / 3;

// ---------- regions ----------
function wRegions(c, t) {
  resetT(c);
  const cuts = [-1e9, SEAM1, SEAM2, 1e9].map(sxOf), looks = [LOOK.terminal, LOOK.chat, LOOK.catsco];
  for (let i = 0; i < 3; i++) {
    const a = clamp(cuts[i], -10, W + 10), b = clamp(cuts[i + 1], -10, W + 10); if (b <= a) continue;
    const L = looks[i]; c.fillStyle = L.bg; c.fillRect(a, 0, b - a, H);
    // a dot grid fixed to the world, one column per day, so the ground reads as moving
    c.fillStyle = L.dot; const step = Math.max(6, Math.round(DX * VW.zx / 2));
    if (!VW.pull || VW.zx > .4) { const w0 = VW.pull ? VW.cx - W / 2 / VW.zx : VW.camL; const k0 = Math.floor(w0 / (DX / 2));
      for (let k = k0; ; k++) { const x = sxOf(k * DX / 2); if (x > b) break; if (x < a) continue; for (let y = 36; y < H; y += 48) c.fillRect(x, y, 2, 2); } }
  }
  // seams: a dithered band three blocks wide, so one look breaks into the next pixel by pixel
  [[SEAM1, LOOK.terminal, LOOK.chat], [SEAM2, LOOK.chat, LOOK.catsco]].forEach(([wx, A, B]) => {
    const x = sxOf(wx); if (x < -30 || x > W + 30) return; const u = 6;
    for (let y = 0; y < H; y += u) for (let k = -2; k <= 2; k++) { const on = hash(Math.floor(y / u) * 7 + k, 11) < (k + 2.5) / 5; c.fillStyle = on ? B.bg : A.bg; c.fillRect(x + k * u, y, u, u); }
  });
}
function wScanlines(c) {
  const x1 = clamp(sxOf(SEAM1), 0, W); if (x1 <= 0) return;
  resetT(c); c.fillStyle = 'rgba(0,0,0,.28)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, x1, 2);
}

// ---------- rails and bricks ----------
// reveal(d, rail) in 0..1: how much of that day's bricks are up (they rise as 小八 passes).
function wBricks(c, reveal, lowerFrom) {
  const pitch = 6 * VW.zy, bh = Math.max(1, Math.round(5 * VW.zy)), bw = Math.max(2, Math.round(Math.min(12, DX * VW.zx * .72)));
  for (let d = 0; d <= DATA.last; d++) {
    const x = sxOf(dayX(d)) - (bw >> 1); if (x < -20 || x > W + 20) continue;
    const L = lookAtX(dayX(d));
    for (const [arr, r, col, y0] of [[DATA.U, 'U', L.U, VW.yU], [DATA.L, 'L', L.L, VW.yL]]) {
      const n = arr[d]; if (!n || (r === 'L' && d < lowerFrom)) continue;
      const k = Math.floor(n * reveal(d, r) + 1e-6); if (!k) continue;
      c.fillStyle = col;
      for (let i = 0; i < k; i++) c.fillRect(x, Math.round(y0 - 3 - (i + 1) * pitch), bw, bh);
    }
  }
}
// A rail: solid where the story has been, dotted where it has not been yet.
function wRail(c, y, from, today, {label, show = 1} = {}) {
  if (show <= 0) return;
  resetT(c); const u = 6, x0 = Math.max(-10, sxOf(from)), xt = clamp(sxOf(today), -10, W + 10), end = W + 10;
  for (let x = x0; x < end; x += u) {
    const wx = VW.pull ? VW.cx + (x - W / 2) / VW.zx : x + VW.camL, L = lookAtX(wx), past = x <= xt;
    if (!past && Math.floor((x - x0) / u) % 3) continue;
    c.fillStyle = past ? L.rail : L.railDim; c.fillRect(x, y, u, past ? u : u / 2 + 1);
  }
}
// Month ticks under the upper rail.
function wMonths(c) {
  for (let m = 2; m <= 9; m++) { const d = Math.round((Date.UTC(2026, m - 1, 1) - D0) / 864e5); if (d < 0) continue;
    const x = sxOf(dayX(d) - DX / 2); if (x < -60 || x > W + 60) continue; const L = lookAtX(dayX(d));
    resetT(c); c.fillStyle = L.dim; c.fillRect(x, VW.yU + 10, 3, 14); if (!VW.pull || VW.zx > .3) wText(c, `${m} 月`, x + 8, VW.yU + 26, {size: 22, col: L.dim}); }
}

// ---------- world props (pixel drawn, in world space) ----------
function wPix(c, rows, pal, x, y, u = 6) { rows.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) { c.fillStyle = pal[ch]; c.fillRect(x + i * u, y + j * u, u, u); } })); }
// A release flag planted on the upper rail.
function wFlag(c, d, text, t, t0, {big = false, cats = false} = {}) {
  const e = wStep(t, t0, .24); if (!e) return;
  const x = sxOf(dayX(d)), y = VW.yU, L = lookAtX(dayX(d)), h = Math.round((big ? 150 : 96) * e * VW.zy);
  resetT(c); c.fillStyle = L.ink; c.fillRect(x, y - h, 4, h);
  if (e < 1) return;
  const tw = Math.ceil(wMeasure(c, text, 'px', big ? 16 : 10)) + (big ? 20 : 12), fh = big ? 34 : 22;
  c.fillStyle = big || cats ? '#29bc95' : L.U; c.fillRect(x + 4, y - h, tw, fh);
  wText(c, text, x + 4 + (big ? 10 : 6), y - h + fh / 2 + 1, {font: 'px', size: big ? 16 : 10, col: '#0b1612', base: 'middle'});
}
// A thread stitching the two rails on a day both repositories moved together.
function wStitch(c, dU, dL, t, t0) {
  const e = clamp((t - t0) / .8, 0, 1); if (!e) return;
  const xa = sxOf(dayX(dU)), xb = sxOf(dayX(dL)), ya = VW.yU + 6, yb = VW.yL, n = Math.max(2, Math.round((yb - ya) / 12));
  resetT(c); c.fillStyle = '#ffffff';
  for (let i = 0; i <= n * e; i++) { const u = i / n; const x = Math.round(lerp(xa, xb, u)), y = Math.round(lerp(ya, yb, u)); c.fillStyle = i % 2 ? '#ff5a5f' : '#ffffff'; c.fillRect(x - 3, y - 3, 6, 6); }
  if (e >= 1) for (const [x, y] of [[xa, ya], [xb, yb]]) { c.fillStyle = '#ff5a5f'; c.fillRect(x - 6, y - 6, 12, 12); c.fillStyle = '#ffffff'; c.fillRect(x - 3, y - 3, 6, 6); }
}
// A chat bubble standing on a rail: the product speaking.
function wBubble(c, d, rail, lift, text, t, t0, {col = '#07c160', fg = '#0b1612', icon = null, al = 1} = {}) {
  const e = wStep(t, t0); if (!e || al <= 0) return;
  const x = sxOf(dayX(d)), y = syOf(rail === 'U' ? RU - lift : RL - lift), w = Math.ceil(wMeasure(c, text, 'wk', 26)) + 32 + (icon ? 34 : 0), h = 52;
  c.save(); c.globalAlpha *= al; resetT(c);
  const hh = Math.round(h * e); wPanel(c, x - 12, y - hh, w, hh, {bg: col, edge: shade(col, .35), u: 4});
  c.fillStyle = col; c.fillRect(x + 4, y, 8, 6); c.fillRect(x + 4, y + 6, 4, 4);
  if (e >= 1) { if (icon) icon(c, x + 4, y - h + 12); wText(c, text, x + 4 + (icon ? 34 : 0), y - h / 2 + 2, {size: 26, col: fg, base: 'middle'}); }
  c.restore();
}
const ICON = {
  clip: (c, x, y) => wPix(c, ['.kk.', 'k..k', 'k.kk', 'k.k.', 'kkk.'], {k: '#0b1612'}, x, y, 5),
  bot: (c, x, y) => wPix(c, ['..k..', 'kkkkk', 'kwkwk', 'kkkkk', 'k...k'], {k: '#0b1612', w: '#ffffff'}, x, y, 5),
  group: (c, x, y) => wPix(c, ['.k..k.', 'kkkkkk', 'kkkkkk', '......', 'k.kk.k'], {k: '#0b1612'}, x, y, 4),
  wechat: (c, x, y) => wPix(c, ['.kkk..', 'kwkwk.', 'kkkkkk', '.k.kwk', '...kkk'], {k: '#0b1612', w: '#ffffff'}, x, y, 5),
  lark: (c, x, y) => wPix(c, ['k....', 'kk...', 'kkk.k', '.kkkk', '..kk.'], {k: '#0b1612'}, x, y, 5),
  file: (c, x, y) => wPix(c, ['kkk.', 'kwkk', 'kwwk', 'kwwk', 'kkkk'], {k: '#0b1612', w: '#ffffff'}, x, y, 5),
};
// A computer on the lower rail. Its screen is drawn by the caller (inner), clipped to the glass.
const MON = {w: 216, h: 144, stand: 30};
function wMonitor(c, d, label, t, t0, inner) {
  const e = wStep(t, t0, .3); if (!e) return null;
  const x = sxOf(dayX(d)) - MON.w / 2, y = VW.yL - MON.stand - Math.round(MON.h * e);
  resetT(c); const u = 6;
  c.fillStyle = '#5d6b67'; c.fillRect(x + MON.w / 2 - 18, VW.yL - MON.stand, 36, MON.stand); c.fillRect(x + MON.w / 2 - 48, VW.yL - 6, 96, 6);
  c.fillStyle = '#8a9994'; c.fillRect(x, y, MON.w, Math.round(MON.h * e)); c.fillStyle = '#5d6b67'; c.fillRect(x, y + Math.round(MON.h * e) - u, MON.w, u);
  const g = {x: x + u * 2, y: y + u * 2, w: MON.w - u * 4, h: Math.round(MON.h * e) - u * 4};
  c.fillStyle = XB_LOOKS.device.bg; c.fillRect(g.x, g.y, g.w, Math.max(0, g.h));
  if (e >= 1) {
    if (inner) { c.save(); c.beginPath(); c.rect(g.x, g.y, g.w, g.h); c.clip(); inner(c, g); c.restore(); }
    const lw = Math.ceil(wMeasure(c, label, 'wk', 22)) + 20; wPanel(c, x + MON.w / 2 - lw / 2, y - 40, lw, 34, {bg: '#10204a', edge: '#8fd8ff', u: 3});
    wText(c, label, x + MON.w / 2, y - 23, {size: 22, col: '#d6f3ff', align: 'center', base: 'middle'});
    c.fillStyle = '#46f29b'; c.fillRect(x + MON.w - 18, y + MON.h - 12, 6, 6);   // online: the Connector's green light
  }
  return g;
}
// A cloud with a desk on it: the cloud-hosted worker.
function wCloud(c, d, y, t, t0) {
  const e = wStep(t, t0, .3); if (!e) return null;
  const x = sxOf(dayX(d)) - 120, yy = y + Math.round((1 - e) * 40);
  resetT(c);
  wPix(c, ['.....wwwww..........', '...wwwwwwwww.www....', '..wwwwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwwwww', '.wwwwwwwwwwwwwwwwww.'], {w: '#d6f3ff'}, x, yy, 12);
  return {x: x + 120, y: yy + 12};
}
// A browser address bar popping up on the lower rail.
function wBrowser(c, d, text, t, t0) {
  const e = wStep(t, t0, .24); if (!e) return;
  const w = 470, h = Math.round(96 * e), x = sxOf(dayX(d)) - 40, y = VW.yL - 40 - h;
  resetT(c); wPanel(c, x, y, w, h, {bg: '#f4f6f5', edge: '#29bc95', u: 4});
  if (e < 1) return;
  c.fillStyle = '#29bc95'; c.fillRect(x + 4, y + 4, w - 8, 26); for (const [i, col] of [[0, '#ff5a5f'], [1, '#ffe27a'], [2, '#46f29b']]) { c.fillStyle = col; c.fillRect(x + 14 + i * 16, y + 13, 8, 8); }
  wPanel(c, x + 16, y + 42, w - 32, 40, {bg: '#ffffff', edge: '#b5bcb8', shadow: 'rgba(0,0,0,0)', u: 3});
  wText(c, text, x + 30, y + 63, {font: 'px', size: 16, col: '#0b1612', base: 'middle'});
}
// The desktop app arriving on the upper rail: a window with 小八's face on it.
function wDesktop(c, d, t, t0) {
  if (t < t0) return; const drop = easeOutBack(clamp((t - t0) / .5, 0, 1)), x = sxOf(dayX(d)) - 78, y = Math.round(lerp(-200, VW.yU - 120, drop));
  resetT(c); wPanel(c, x, y, 156, 114, {bg: '#ffffff', edge: '#1b1f1d', u: 4});
  c.fillStyle = '#e9a23b'; c.fillRect(x + 4, y + 4, 148, 18); wText(c, 'CatsCo', x + 12, y + 14, {font: 'px', size: 8, col: '#0b1612', base: 'middle'});
  drawXiaoba(c, {eyes: 'happy'}, {x: x + 78, y: y + 96, px: 3, look: 'chat'});
}
// A platform block in the air: the integration that gets reverted.
function wBlock(c, d, lift, text, e, col = '#3f7fd1') {
  if (e <= 0) return; const x = sxOf(dayX(d)) - 66, y = syOf(RL - lift), w = 132, h = 42;
  resetT(c);
  for (let j = 0; j < h; j += 6) for (let i = 0; i < w; i += 6) { if (hash(i * 31 + j, 5) > e) continue; c.fillStyle = (i === 0 || j === 0 || i === w - 6 || j === h - 6) ? shade(col, .4) : col; c.fillRect(x + i, y + j, 6, 6); }
  if (e > .95) wText(c, text, x + w / 2, y + h / 2 + 1, {size: 22, col: '#ffffff', align: 'center', base: 'middle'});
}

// ---------- HUD ----------
function wHud(c, today, counts, showLower, t) {
  resetT(c);
  const L = lookAtX(wxOf(140));
  wText(c, dateOf(clamp(today, 0, DATA.last)), 48, 64, {font: 'px', size: 24, col: L.ink});
  wText(c, `第 ${Math.floor(clamp(today, 0, DATA.last)) + 1} 天`, 48, 104, {size: 26, col: L.dim});
  const row = (y, name, n, col, al) => { if (al <= 0) return; c.save(); c.globalAlpha *= al; c.fillStyle = col; c.fillRect(48, y - 16, 12, 12);
    wText(c, name, 70, y - 10, {size: 24, col: L.ink, base: 'middle'}); wText(c, n.toLocaleString('en-US'), 70 + wMeasure(c, name, 'wk', 24) + 16, y - 10, {font: 'px', size: 16, col, base: 'middle'}); c.restore(); };
  row(VW.yU + 52 + 14, 'XiaoBa-CLI · Runtime', counts.U, L.U, 1);
  row(VW.yL + 52 + 14, 'cats-company · Platform', counts.L, L.L, showLower);
}
// The feature card, top right: a name, one line of benefit, and the commit it rests on.
function wCard(c, card, t) {
  if (!card) return; const e = Math.min(wStep(t, card.t0), 1 - wStep(t, card.t1 - .18)); if (e <= 0) return;
  const L = lookAtX(wxOf(W - 400)), w = 700, h = Math.round((card.sub ? 176 : 124) * e), x = W - w - 44, y = 40;
  resetT(c); wPanel(c, x, y, w, h, {bg: L.panel, edge: L.edge, u: 4}); if (e < 1) return;
  wText(c, card.title, x + 28, y + 58, {size: 44, col: L.ink});
  if (card.sub) wText(c, card.sub, x + 28, y + 104, {size: 26, col: L.dim});
  wText(c, card.meta, x + 28, y + h - 30, {font: 'px', size: 12, col: L.edge === '#1b1f1d' ? '#05934a' : L.edge});
}
// 小八's caption, bottom centre, typed on at 20 characters a second.
function wCaption(c, cap, t, {center = false} = {}) {
  if (!cap) return; const e = Math.min(wStep(t, cap.t0), 1 - wStep(t, cap.t1 - .18)); if (e <= 0) return;
  const L = lookAtX(wxOf(W / 2)), n = Math.floor(clamp((t - cap.t0 - .15) * 20, 0, cap.text.length)), size = center ? 58 : 38;
  const tw = Math.ceil(wMeasure(c, cap.text, 'wk', size)), w = tw + 120, h = Math.round((center ? 120 : 84) * e), x = W / 2 - w / 2, y = center ? H / 2 - 60 : 936;
  resetT(c); wPanel(c, x, y, w, h, {bg: L.panel, edge: L.edge, u: 4}); if (e < 1) return;
  drawXiaoba(c, {eyes: n < cap.text.length && Math.floor(t * 8) % 2 ? 'n' : 'happy', mouth: n < cap.text.length && Math.floor(t * 8) % 2 ? 'open' : 'smile'}, {x: x + 50, y: y + h / 2 + 18, px: 3, look: L.cat});
  wText(c, cap.text.slice(0, n), x + 90, y + h / 2 + 2, {size, col: L.ink, base: 'middle'});
}
