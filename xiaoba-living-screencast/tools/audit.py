#!/usr/bin/env python3
"""Framing audit: per sampled frame, where the mascot(s) are on screen, whether they are cut by the frame,
whether they cover readable text, and whether they sit under the caption. Prints only problems + a summary."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
PAGE = (Path(__file__).resolve().parents[1] / "index.html").as_uri()
JS = r'''(t) => { render(t);
  const out = {t, sprites: [], issues: []};
  const cap = document.getElementById('cap'); const cr = +getComputedStyle(cap).opacity > .05 ? document.getElementById('capt').getBoundingClientRect() : null;
  const texts = [...document.querySelectorAll('#app .lb, #app .tx, #app .nm, #app .ln, #app h1, #app .bub, #app .th, #app .rt, #app .dev, #app .file b, #app #clue, #app #banner, #app #ctext, #app .tab')]
     .filter(e => { let p = e, op = 1; while (p && p.id !== 'app') { const cs = getComputedStyle(p); op *= +cs.opacity; if (cs.visibility === 'hidden') op = 0; p = p.parentElement; } return op > .5; })
     .map(e => { const rg = document.createRange(); rg.selectNodeContents(e); return [e, rg.getBoundingClientRect()]; }).filter(([e, q]) => q.width > 2);
  for (const s of document.querySelectorAll('#actors svg.px')) {
    if (s.getAttribute('viewBox') !== '0 0 18 10' || +s.style.opacity < .5) continue;
    const r = s.getBoundingClientRect(); out.sprites.push([r.x|0, r.y|0, r.width|0, r.height|0]);
    if (r.left < 0 || r.top < 0 || r.right > 1920 || r.bottom > 1080) out.issues.push('cut by frame');
    if (cr && r.bottom > cr.top && r.top < cr.bottom && r.right > cr.left && r.left < cr.right) out.issues.push('under caption');
    for (const [e, q] of texts) { const ix = Math.max(0, Math.min(r.right, q.right) - Math.max(r.left, q.left)), iy = Math.max(0, Math.min(r.bottom - r.height*.12, q.bottom) - Math.max(r.top, q.top));
      if (ix * iy > .12 * q.width * q.height && ix * iy > 400) out.issues.push('covers "' + (e.textContent || '').trim().slice(0, 18) + '"'); }
  }
  return out; }'''
with sync_playwright() as pw:
    b = pw.chromium.launch(); p = b.new_page(viewport={'width': 1920, 'height': 1080})
    err = []; p.on('pageerror', lambda e: err.append(str(e)))
    p.goto(PAGE); p.wait_for_function('window.READY === true')
    dur = p.evaluate('window.DUR'); step = float(sys.argv[1]) if len(sys.argv) > 1 else 0.25
    n = 0; bad = 0; t = 0.0
    while t <= dur:
        r = p.evaluate(JS, t); n += 1
        if r['issues']: bad += 1; print(f"{t:6.2f}  {sorted(set(r['issues']))}  {r['sprites']}")
        t = round(t + step, 3)
    print(f"{n} frames checked, {bad} with issues; page errors: {err[:3]}")
    b.close()
