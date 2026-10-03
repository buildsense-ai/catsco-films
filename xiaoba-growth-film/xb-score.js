'use strict';
// An original chiptune score, synthesized with Web Audio on the film's own timeline (T from xb-film.js),
// so every cue sits on the route and cannot drift. 120 BPM. Sections follow the looks:
// terminal (sparse square arpeggio) → chat (triangle bass + pulse lead) → CatsCo (full band) →
// devices (drums drop to a pulse while 小八 works) → pull-back (the chords open) → logo (a last chord).
function xbScore(ac, t0, destination) {
  const END = FILM_DUR, master = ac.createGain(), comp = ac.createDynamicsCompressor(), makeup = ac.createGain();
  master.gain.value = 1.5; comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2;
  makeup.gain.setValueAtTime(1.3, t0); makeup.gain.setValueAtTime(1.3, t0 + END - 1.5); makeup.gain.linearRampToValueAtTime(0, t0 + END);
  master.connect(comp); comp.connect(makeup); makeup.connect(destination);
  const echo = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain(); echo.delayTime.value = .375; fb.gain.value = .28; wet.gain.value = .18;
  echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(master);
  const out = (node, send = .2, pan = 0) => { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(master); if (send) { const s = ac.createGain(); s.gain.value = send; p.connect(s); s.connect(echo); } };
  const hz = n => 440 * 2 ** ((n - 69) / 12), at = t => t0 + Math.max(0, t);
  const waves = {};
  const pulseWave = duty => { if (waves[duty]) return waves[duty]; const N = 32, re = new Float32Array(N), im = new Float32Array(N); for (let k = 1; k < N; k++) im[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty); return waves[duty] = ac.createPeriodicWave(re, im); };
  function tone(n, t, d, v, {type = 'square', duty = .5, pan = 0, send = .15, slide = 0, a = .004} = {}) {
    if (t + d < 0 || t > END) return;
    const o = ac.createOscillator(), g = ac.createGain();
    if (type === 'pulse') o.setPeriodicWave(pulseWave(duty)); else o.type = type;
    o.frequency.setValueAtTime(hz(n), at(t)); if (slide) o.frequency.exponentialRampToValueAtTime(hz(n + slide), at(t) + d);
    g.gain.setValueAtTime(0, at(t)); g.gain.linearRampToValueAtTime(v, at(t) + a); g.gain.setValueAtTime(v * .8, at(t) + d * .6); g.gain.linearRampToValueAtTime(0, at(t) + d);
    o.connect(g); out(g, send, pan); o.start(at(t)); o.stop(at(t) + d + .02);
  }
  const NB = (() => { const n = ac.sampleRate, b = ac.createBuffer(1, n, ac.sampleRate), x = b.getChannelData(0), r = rng(7); for (let i = 0; i < n; i++) x[i] = r() * 2 - 1; return b; })();
  function noise(t, d, v, f = 6000, q = .8, type = 'highpass') {
    if (t < 0 || t > END) return;
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = NB; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(v, at(t)); g.gain.exponentialRampToValueAtTime(.0001, at(t) + d); s.connect(fl); fl.connect(g); out(g, 0); s.start(at(t), hash(Math.round(t * 100), 3) * .5); s.stop(at(t) + d + .02);
  }
  const kick = (t, v = .5) => { if (t < 0 || t > END) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, at(t)); o.frequency.exponentialRampToValueAtTime(42, at(t) + .12); g.gain.setValueAtTime(v, at(t)); g.gain.exponentialRampToValueAtTime(.0001, at(t) + .2); o.connect(g); out(g, 0); o.start(at(t)); o.stop(at(t) + .22); };
  const snare = (t, v = .16) => { noise(t, .14, v, 1800, .7, 'bandpass'); tone(50, t, .06, v * .5, {type: 'triangle', send: 0}); };
  const hat = (t, v = .04) => noise(t, .035, v, 8000);

  // ---- music ----
  const B = .5;                                  // one beat
  const CH = {C: [48, 52, 55, 59], Am: [45, 48, 52, 55], F: [41, 45, 48, 52], G: [43, 47, 50, 55], Em: [40, 43, 47, 50], Dm: [38, 41, 45, 48]};
  const PROG = ['C', 'Am', 'F', 'G'], PROG2 = ['F', 'G', 'Em', 'Am'], PROG3 = ['F', 'G', 'C', 'C'];
  // lead motif (scale degrees over C major), one bar of eighths
  const MOTIF = [[0, 72], [1, 76], [2, 79], [3, 76], [4, 81], [6, 79], [7, 76]], MOTIF2 = [[0, 74], [1, 77], [2, 81], [4, 79], [5, 77], [6, 76], [7, 74]];
  function bars(t1, t2, fn) { const b0 = Math.ceil(t1 / (4 * B)); for (let b = b0; b * 4 * B < t2 - .01; b++) fn(b * 4 * B, b); }
  const sec = [
    // [start, end, style]
    [0, T.office, 'intro'], [T.office, T.move, 'term'], [T.move, T.hopUp, 'chat'], [T.hopUp, T.badge, 'fall'],
    [T.badge, T.dive1, 'band'], [T.dive1, T.walk5, 'work'], [T.walk5, T.pull, 'band2'], [T.pull, T.logo, 'open'], [T.logo, END, 'end'],
  ];
  for (const [s0, s1, style] of sec) bars(s0, s1, (tb, b) => {
    const pr = style === 'band2' ? PROG2 : style === 'open' ? PROG3 : PROG, ch = CH[pr[b % 4]], root = ch[0];
    if (style === 'intro') { tone(root - 12, tb, 4 * B, .07, {type: 'triangle', send: 0}); ch.forEach((n, i) => tone(n + 12, tb + i * .02, 4 * B, .012, {type: 'pulse', duty: .5, send: .5, a: .6}));
      if (tb < 2.4) return; for (let i = 0; i < 8; i++) tone(ch[i % 4] + 24, tb + i * B / 2, .1, .03, {type: 'pulse', duty: .125, send: .35}); return; }
    if (style === 'term') { for (let i = 0; i < 8; i++) tone(ch[i % 4] + 24, tb + i * B / 2, .11, .035, {type: 'pulse', duty: .125, send: .35, pan: -.2});
      tone(root - 12, tb, B * 1.8, .09, {type: 'triangle', send: 0}); tone(root - 12, tb + 2 * B, B * 1.8, .09, {type: 'triangle', send: 0}); return; }
    if (style === 'fall') { tone(root - 12, tb, 4 * B, .08, {type: 'triangle', send: 0}); for (let i = 0; i < 4; i++) tone(ch[i] + 12, tb + i * B, B * .9, .025, {type: 'pulse', duty: .25, send: .3}); return; }
    if (style === 'end') { if (tb > T.logo + .1) return; ch.concat(ch.map(n => n + 12)).forEach((n, i) => tone(n + 12, tb + i * .04, 3.8, .03, {type: 'pulse', duty: .25, send: .4, pan: (i % 2 ? .3 : -.3)})); tone(root - 12, tb, 4, .12, {type: 'triangle', send: 0}); return; }
    // bass: root-fifth eighths on triangle
    for (let i = 0; i < 8; i++) tone((i % 4 === 2 ? ch[2] : root) - 12, tb + i * B / 2, B / 2 * .8, style === 'work' ? .07 : .1, {type: 'triangle', send: 0});
    // harmony: an arpeggio on a thin pulse
    for (let i = 0; i < 8; i++) tone(ch[(i * 2) % 4] + 24, tb + i * B / 2, .09, style === 'work' ? .02 : .025, {type: 'pulse', duty: .125, send: .3, pan: .25});
    if (style === 'chat' && b % 2 === 1) MOTIF.forEach(([k, n]) => tone(n, tb + k * B / 2, B / 2 * .85, .035, {type: 'pulse', duty: .25, send: .2, pan: -.15}));
    if (style === 'band' || style === 'band2') (b % 2 ? MOTIF2 : MOTIF).forEach(([k, n]) => tone(n + (style === 'band2' ? 2 : 0) - (style === 'band2' && pr[b % 4] === 'Am' ? 2 : 0), tb + k * B / 2, B / 2 * .85, .04, {type: 'pulse', duty: .25, send: .2, pan: -.15}));
    if (style === 'open') ch.forEach((n, i) => tone(n + 12, tb + i * .03, 4 * B * .95, .022, {type: 'pulse', duty: .5, send: .4, pan: (i - 1.5) * .25}));
    // drums
    if (style === 'chat') { for (let i = 0; i < 4; i++) { if (i % 2 === 0) kick(tb + i * B, .35); hat(tb + i * B + B / 2, .03); } }
    if (style === 'band' || style === 'band2') for (let i = 0; i < 4; i++) { kick(tb + i * B, i % 2 ? .3 : .45); if (i % 2) snare(tb + i * B); hat(tb + i * B + B / 2); hat(tb + i * B, .02); }
    if (style === 'work') for (let i = 0; i < 4; i++) { kick(tb + i * B, .25); hat(tb + i * B + B / 2, .025); }
    if (style === 'open') { kick(tb, .4); snare(tb + 2 * B, .1); }
  });

  // ---- effects on the route ----
  const blip = (t, n = 84, v = .05) => tone(n, t, .06, v, {type: 'square', send: .1, slide: 12});
  const coin = (t, v = .05) => { tone(83, t, .06, v, {type: 'square', send: .15}); tone(88, t + .06, .16, v, {type: 'square', send: .15}); };
  const jump = (t, v = .05) => tone(64, t, .18, v, {type: 'square', slide: 12, send: .1});
  const land = (t, v = .06) => { tone(40, t, .06, v, {type: 'triangle', send: 0, slide: -8}); noise(t, .05, v * .6, 900, .8, 'lowpass'); };
  const powerup = (t, v = .05) => [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(n, t + i * .05, .07, v, {type: 'square', send: .2}));
  const buzz = (t, v = .06) => tone(40, t, .28, v, {type: 'sawtooth', send: 0, slide: -5});
  const whoosh = (t, up = true, v = .06) => { noise(t, .35, v, up ? 1200 : 3000, 1.2, 'bandpass'); tone(up ? 60 : 84, t, .3, v * .5, {type: 'square', slide: up ? 24 : -24, send: .1}); };
  const key = (t, v = .03) => noise(t, .02, v, 5000, 2, 'bandpass');
  // typing the prompt, the cursor blinking, the kitten
  for (let i = 0; i < 8; i++) key(.4 + i * .12, .05);
  [1.8, 2.2].forEach(t => blip(t, 96, .02)); powerup(2.6, .04); tone(88, 3.3, .1, .04, {type: 'square'}); tone(91, 3.42, .14, .04, {type: 'square'});
  // every hop and every step is a tick
  const hopTicks = (t1, t2, per) => { for (let t = t1 + per * .8; t < t2; t += per) blip(t, 79 + Math.round(hash(Math.round(t * 10), 2) * 5), .025); };
  hopTicks(T.hop1, T.office, .42); hopTicks(T.hop2, T.bots, .42); hopTicks(T.hop3, T.move, .42);
  for (const [a, b] of [[T.walk1, T.desktop], [T.walk2, T.release], [T.run1, T.look], [T.run2, T.stitch], [T.walk4, T.dive2], [T.walk5, T.bring], [T.run3, T.skills], [T.walk6, T.cloud], [T.run4, T.site], [T.walk7, T.v160], [T.walk8, T.pull]])
    for (let t = a + .12; t < b - .05; t += 1 / 6) noise(t, .03, .018, 2500, 1, 'bandpass');
  coin(T.office + .9); coin(T.bots + .5); coin(T.bots + 1.1);
  // the move: stitch, jump down, grow
  for (let i = 0; i < 10; i++) blip(T.move + .2 + i * .08, 72 + i * 2, .02);
  jump(T.jumpDown); land(T.grow + .02, .09); powerup(T.grow + .5, .05); coin(T.grow + 1.0, .05);
  land(T.desktop + .8, .08); coin(T.desktop + 1.0); coin(T.release + .3); coin(T.release + .9);
  // the revert: jump up, two blocks crumble, the fall, climb back further right
  jump(T.hopUp); land(T.revert, .05); buzz(T.revert + 1.0); buzz(T.revert + 2.1);
  noise(T.revert + 1.0, .3, .08, 700, .7, 'lowpass'); noise(T.revert + 2.1, .3, .08, 700, .7, 'lowpass');
  tone(76, T.fall, .9, .05, {type: 'square', slide: -24, send: .2}); land(T.fall + .7, .1);
  jump(T.climb + .1); land(T.climb + .9, .07);
  // the badge
  powerup(T.badge + 1.9, .05); coin(T.badge + 2.3, .06);
  // devices: stitch, dive in, typing, the fix, back out
  for (let i = 0; i < 10; i++) blip(T.stitch + i * .08, 72 + i * 2, .02);
  whoosh(T.dive1, false); for (let t = T.office1 + .2; t < T.office1 + 5.8; t += .125) key(t, .02 + hash(Math.round(t * 8), 5) * .015);
  tone(52, T.office1 + 1.1, .25, .05, {type: 'square', send: .1}); coin(T.office1 + 4.1, .05); whoosh(T.out1, true); land(T.out1 + .78, .06);
  whoosh(T.dive2, false); for (let t = T.home + .2; t < T.home + 1.4; t += .125) key(t, .025);
  buzz(T.home + 1.45, .05); tone(58, T.home + 1.6, .5, .04, {type: 'square', slide: -3, send: .2});
  jump(T.home + 2.6); land(T.home + 3.3, .05); coin(T.home + 3.7, .05); coin(T.home + 4.3, .05); whoosh(T.home + 4.8, false, .04);
  powerup(T.home + 5.6, .05); coin(T.home + 6.0, .06); whoosh(T.out2, true); land(T.out2 + .78, .06);
  // bring it back, skills, cloud, site, v1.6.0
  coin(T.bring + .3); jump(T.bring + 1.4, .04); coin(T.bring + 2.0, .06);
  [0, 1, 2].forEach(i => { tone(90, T.skills + .1 + i * .6, .3, .02, {type: 'square', slide: -12, send: .1}); coin(T.skills + .55 + i * .6, .05); });
  powerup(T.cloud + .2, .04); coin(T.cloud + 1.2);
  for (let i = 0; i < 6; i++) key(T.site + .4 + i * .09, .04); coin(T.site + 1.1, .06);
  powerup(T.v160 + .2, .06); for (let i = 0; i < 6; i++) tone([84, 88, 91, 96, 91, 96][i], T.v160 + .6 + i * .1, .12, .04, {type: 'square', send: .3});
  // the pull-back, the signature typing, the fold into the logo, the blink
  noise(T.pull + .2, 3.8, .025, 1200, .5, 'bandpass');
  for (let i = 0; i < 14; i++) key(T.sign + .25 + i * .05, .03);
  whoosh(T.sign + 4.3, true, .05); for (let i = 0; i < 12; i++) blip(T.sign + 5.0 + i * .06, 96 - i * 2, .02);
  coin(T.sign + 6.0, .06); blip(T.sign + 8.9, 100, .03);
}
