'use strict';
/* 小八上班记 · the route. One continuous take: 小八 only moves right along the rails, the camera
   follows a moving average of its x and never cuts or turns back; the only other move is the pull-back
   at the end. Upper rail = XiaoBa-CLI (Runtime), lower rail = cats-company (Platform).
   Position runs on every output frame; poses run on twos (12 fps), craft.md §3.
   Every stretch is a named segment with a duration, so the film retimes by editing SEGS. */

const SEGS = [
  ['birth', 6.4], ['hop1', 5.2], ['office', 5.6], ['hop2', 2.0], ['bots', 4.4], ['hop3', 3.0], ['move', 2.0], ['jumpDown', 1.0], ['grow', 3.2],
  ['walk1', 3.0], ['desktop', 4.8], ['walk2', 1.0], ['release', 4.6], ['run1', 5.0], ['look', .8], ['hopUp', .7], ['revert', 2.5], ['fall', 2.2],
  ['climb', 1.0], ['badge', 5.6], ['run2', 3.4], ['stitch', 1.0], ['walk3', .8], ['dive1', .8], ['office1', 6.2], ['out1', .8], ['onlyYours', 2.6],
  ['walk4', 1.8], ['dive2', .8], ['home', 8.0], ['out2', .8], ['walk5', 2.2], ['bring', 4.8], ['run3', 2.4], ['skills', 3.4], ['walk6', 1.0],
  ['cloud', 4.4], ['run4', 4.4], ['site', 4.8], ['walk7', 1.2], ['v160', 4.2], ['walk8', 2.0], ['pull', 6.0], ['sign', 5.0], ['logo', 6.4],
];
const T = {}; { let a = 0; for (const [n, d] of SEGS) { T[n] = a; a += d; } T.end = a; }
const FILM_DUR = T.end;
const MON1 = 129.5, MON2 = 142, CLOUD = 186;

// ---------- 小八's route ----------
// A state: {x (world), y (normal-view y of the feet), pose, kit, look?, flipY, hide, clone}
const LEGS2 = (dist) => Math.floor(dist / 22) % 2 ? 'walkA' : 'walkB';
const blinkAt = (t, seed = 0) => ((t + seed) % 3.3) < .12;
function hopAlong(t, t0, t1, d0, d1, y) {   // kitten hops: small arcs, one per ~0.42 s
  const n = Math.max(1, Math.round((t1 - t0) / .42)), u = clamp((t - t0) / (t1 - t0), 0, 1) * n, k = Math.min(n - 1, Math.floor(u)), f = u - k;
  const x = dayX(lerp(d0, d1, (k + easeIO(f)) / n)), lift = 30 * 4 * f * (1 - f);
  return {x, y: y - lift, pose: {kit: true, legs: lift > 6 ? 'tuck' : 'stand', eyes: 'r'}, kit: true, land: f < .12 && k > 0};
}
function walkAlong(t, t0, t1, d0, d1, y, o = {}) {
  const u = clamp((t - t0) / (t1 - t0), 0, 1), e = o.ease === false ? u : easeInOutSine(u), x = dayX(lerp(d0, d1, e)), run = (d1 - d0) * DX / (t1 - t0) > 260;
  const te = twos(t), ue = clamp((te - t0) / (t1 - t0), 0, 1), dist = (lerp(d0, d1, o.ease === false ? ue : easeInOutSine(ue)) - d0) * DX;
  return {x, y: y - (run && Math.floor(te * 12) % 2 ? 6 : 0), pose: {legs: LEGS2(dist), eyes: 'r', tail: run ? 'wag' : 'none', ears: run ? 'flat' : 'up', ...(o.pose || {})}};
}
const at = (d, y, pose, extra = {}) => ({x: dayX(d), y, pose, ...extra});
const idle = (t, o = {}) => ({eyes: blinkAt(t) ? 'blink' : 'n', ...o});

function lead(t) {
  const s = seg => t - T[seg];
  if (t < T.hop1) return at(0, RU, {kit: true, eyes: blinkAt(t) ? 'blink' : 'r'}, {kit: true, hide: t < T.birth + 3.3});
  if (t < T.office) return hopAlong(t, T.hop1, T.office, 0, 11, RU);
  if (t < T.hop2) return at(11, RU, {kit: true, eyes: s('office') > .6 && s('office') < 3.8 ? 'd' : idle(t).eyes}, {kit: true});
  if (t < T.bots) return hopAlong(t, T.hop2, T.bots, 11, 17, RU);
  if (t < T.hop3) return at(17, RU, {kit: true, eyes: s('bots') > .5 && s('bots') < 3 ? 'happy' : idle(t).eyes, mouth: 'smile'}, {kit: true});
  if (t < T.move) return hopAlong(t, T.hop3, T.move, 17, 27.4, RU);
  if (t < T.jumpDown) return at(27.4, RU, {kit: true, eyes: 'wide'}, {kit: true});
  if (t < T.grow) { const u = s('jumpDown') / 1.0, p = arc([dayX(27.4), RU], [dayX(28.7), RL], easeIn(u) * .3 + u * .7, 110);
    return {x: p[0], y: p[1], pose: {kit: true, legs: 'tuck', eyes: 'wide'}, kit: true}; }
  if (t < T.walk1) { const u = s('grow');
    if (u < .5) return at(28.7, RL, {kit: true, eyes: 'happy'}, {kit: true, squash: u < .12});
    if (u < .9) return at(28.7, RL, {kit: Math.floor(u * 20) % 2 === 0, eyes: 'wide'}, {kit: Math.floor(u * 20) % 2 === 0, flash: true});
    return at(28.7, RL, idle(t, {eyes: u < 2 ? 'big' : idle(t).eyes, ears: u < 2 ? 'perk' : 'up', mouth: u < 2 ? 'smile' : 'none', blush: u < 2})); }
  if (t < T.desktop) return walkAlong(t, T.walk1, T.desktop, 28.7, 44, RL);
  if (t < T.walk2) return at(44, RL, idle(t, {eyes: s('desktop') > .3 && s('desktop') < 3 ? 'u' : idle(t).eyes, ears: s('desktop') > .5 && s('desktop') < 1.5 ? 'perk' : 'up'}));
  if (t < T.release) return walkAlong(t, T.walk2, T.release, 44, 47, RL);
  if (t < T.run1) return at(47, RL, idle(t, {eyes: s('release') < 2 ? 'u' : 'happy', mouth: 'smile'}));
  if (t < T.look) return walkAlong(t, T.run1, T.look, 47, 92.4, RL);
  if (t < T.hopUp) return at(92.4, RL, {eyes: 'u', ears: 'perk'});
  if (t < T.revert) { const u = s('hopUp') / .7, p = arc([dayX(92.4), RL], [dayX(94), RL - 84], u, 60); return {x: p[0], y: p[1], pose: {legs: 'tuck', ears: 'perk', eyes: 'big'}}; }
  if (t < T.fall) { const u = s('revert'), top = u < 1.3 ? RL - 84 : RL - 42, drop = u >= 1.3 && u < 1.45;
    return at(94, drop ? RL - 60 : top, {eyes: u < .6 ? 'happy' : u < 1.5 ? 'wide' : u < 2.2 ? 'sad' : 'wide', ears: u < 1.3 ? 'up' : u < 2.2 ? 'droop' : 'perk', legs: drop ? 'tuck' : 'stand'}, {bang: (u > 1.0 && u < 1.5) || u > 2.2}); }
  if (t < T.climb) { const u = s('fall'); if (u > .7) return {...at(95.8, 1300, {}), hide: true};
    const k = u / .7; return {x: dayX(lerp(94, 95.8, k)), y: RL - 42 + 520 * k * k, pose: {eyes: 'dizzy', ears: 'flat', legs: 'tuck'}, flipY: k > .3}; }
  if (t < T.badge) { const u = s('climb') / 1.0; return {x: dayX(97.6), y: lerp(RL + 90, RL, easeOutBack(u)), pose: {eyes: 'dizzy', ears: 'flat', legs: 'reach'}}; }
  if (t < T.run2) { const u = s('badge');
    return at(97.6, RL, u < 1.2 ? {eyes: 'dizzy', ears: 'flat'} : u < 1.6 ? {eyes: 'shut', ears: Math.floor(u * 12) % 2 ? 'flat' : 'perk', body: 'squash'} : u < 3.4 ? {eyes: 'big', ears: 'perk', mouth: 'smile', blush: true} : idle(t, {mouth: 'smile'}),
      {stars: u < 1.2, badge: u > 1.9}); }
  if (t < T.stitch) return {...walkAlong(t, T.run2, T.stitch, 97.6, 126.2, RL), badge: true};
  if (t < T.walk3) return at(126.2, RL, {eyes: 'u', ears: 'perk'}, {badge: true});
  if (t < T.dive1) return {...walkAlong(t, T.walk3, T.dive1, 126.2, 127.9, RL), badge: true};
  if (t < T.office1) { const u = s('dive1') / .8, p = arc([dayX(127.9), RL], [dayX(MON1), RL - 110], u, 110);
    return {x: p[0], y: p[1], pose: {legs: 'tuck', eyes: 'shut', ears: 'flat'}, shrink: u, badge: true}; }
  if (t < T.out1) return {...at(MON1, RL - 110, {}), inside: 1, hide: true};
  if (t < T.onlyYours) { const u = s('out1') / .8, p = arc([dayX(MON1 + 1), RL - 110], [dayX(131.6), RL], u, 90);
    return {x: p[0], y: p[1], pose: {legs: 'tuck', eyes: 'happy', ears: 'perk'}, grow: u, badge: true, carry: 'file'}; }
  if (t < T.walk4) return at(131.6, RL, idle(t, {mouth: 'smile'}), {badge: true, carry: 'file'});
  if (t < T.dive2) return {...walkAlong(t, T.walk4, T.dive2, 131.6, 139.4, RL), badge: true};
  if (t < T.home) { const u = s('dive2') / .8, p = arc([dayX(139.4), RL], [dayX(MON2 - 1.2), RL - 110], u, 110);
    return {x: p[0], y: p[1], pose: {legs: 'tuck', eyes: 'shut', ears: 'flat'}, shrink: u, badge: true}; }
  if (t < T.out2) return {...at(MON2 - 1.2, RL - 110, {}), inside: 2, hide: true};
  if (t < T.walk5) { const u = s('out2') / .8, p = arc([dayX(MON2 + 1.4), RL - 110], [dayX(146), RL], u, 90);
    return {x: p[0], y: p[1], pose: {legs: 'tuck', eyes: 'happy', ears: 'perk'}, grow: u, badge: true, carry: 'file'}; }
  if (t < T.bring) return {...walkAlong(t, T.walk5, T.bring, 146, 161, RL), badge: true, carry: 'file'};
  if (t < T.run3) { const u = s('bring'); return at(161, RL, u < 1.4 ? {eyes: 'u'} : u < 2.2 ? {eyes: 'happy', legs: 'stand', arm: 'wave'} : idle(t, {mouth: 'smile'}), {badge: true, carry: u < 1.6 ? 'file' : null, toss: u >= 1.4 && u < 2.2 ? (u - 1.4) / .8 : 0}); }
  if (t < T.skills) return {...walkAlong(t, T.run3, T.skills, 161, 180.6, RL), badge: true};
  if (t < T.walk6) { const u = s('skills'); return at(180.6, RL, {eyes: u < 2 ? 'u' : 'happy', ears: 'perk', mouth: u > 1.6 ? 'smile' : 'none', body: [.5, 1.1, 1.7].some(k => u > k && u < k + .12) ? 'squash' : 'norm'}, {badge: true}); }
  if (t < T.cloud) return {...walkAlong(t, T.walk6, T.cloud, 180.6, 184, RL), badge: true};
  if (t < T.run4) { const u = s('cloud'); return at(184, RL, u < 1 ? {eyes: 'u'} : u < 3.2 ? {eyes: 'happy', arm: Math.floor(u * 4) % 2 ? 'wave' : 'point', mouth: 'smile'} : idle(t), {badge: true}); }
  if (t < T.site) return {...walkAlong(t, T.run4, T.site, 184, 226.8, RL), badge: true};
  if (t < T.walk7) return at(226.8, RL, idle(t, {eyes: s('site') < 2.5 ? 'big' : idle(t).eyes, ears: 'perk'}), {badge: true});
  if (t < T.v160) return {...walkAlong(t, T.walk7, T.v160, 226.8, 230.2, RL), badge: true};
  if (t < T.walk8) { const u = s('v160'); return at(230.2, RL, u < .5 ? {eyes: 'u'} : {eyes: 'happy', mouth: 'smile', blush: true, tail: Math.floor(u * 6) % 2 ? 'wag' : 'up', legs: 'sit'}, {badge: true, bang: u > .2 && u < .7}); }
  if (t < T.pull) return {...walkAlong(t, T.walk8, T.pull, 230.2, 237.2, RL), badge: true};
  return at(237.2, RL, idle(t, {legs: 'sit', tail: 'up'}), {badge: true});
}
// The Branch Agent: a dithered copy that leaves the home workstation, fetches an old note from
// the past (the left) on the Runtime rail, and dives back into the right half of the screen.
function branchClone(t) {
  const u = t - T.home; if (u < 2.6 || u > 5.6) return null;
  if (u < 3.3) { const k = (u - 2.6) / .7, p = arc([dayX(MON2), RL - 150], [dayX(MON2 + 1.2), RU], k, 150); return {x: p[0], y: p[1], pose: {legs: 'tuck', eyes: 'u', ears: 'perk'}}; }
  if (u < 4.8) return {...at(MON2 + 1.2, RU, {eyes: u < 3.6 ? 'l' : u < 4.3 ? 'wide' : 'happy', arm: u > 3.6 ? 'up' : 'none', mouth: u > 4.3 ? 'smile' : 'none'})};
  const k = (u - 4.8) / .8, p = arc([dayX(MON2 + 1.2), RU], [dayX(MON2 + 2), RL - 110], k, 60); return {x: p[0], y: p[1], pose: {legs: 'tuck', eyes: 'shut'}, shrink: k};
}

// ---------- captions and cards (all dates, hashes and counts from the repos; see OUTLINE.md) ----------
const CAPS = [
  ['birth', .9, 6.2, '嗨，我叫小八。2 月 4 日，我在一个终端里出生。'],
  ['hop1', .3, 5.0, '每一次提交，都在路上垒一块砖。'],
  ['office', .3, 5.4, '2 月 15 日，隔壁开了一间办公室：团队聊天室。'],
  ['bots', .1, 4.3, '一周后它有了群聊，还给机器人留了门。'],
  ['move', .1, 5.6, '3 月 4 日，我搬了进去。两个仓库，从此一起长大。'],
  ['desktop', .2, 4.7, '3 月 20 日，我有了桌面端，住进你的电脑。'],
  ['release', .1, 4.5, '3 月 23 日，第一个版本发布；我也会在微信里回你了。'],
  ['run1', .3, 4.9, '有事在聊天里说一声就行，文件直接拖进来。'],
  ['hopUp', .1, 4.5, '5 月 9 日，接入企业微信，当天撤回两次。摔了一跤。'],
  ['badge', .6, 5.5, '也是这一天，桌面端改名 CatsCo。我挂上了工牌。'],
  ['stitch', .0, 5.6, '6 月 11 日，两个仓库一起打地基：我能走进你的电脑了。'],
  ['onlyYours', -.6, 4.2, '只去你指定、在线、并且授权过的那一台。'],
  ['home', .1, 3.6, '测试卡住了？我分个身去翻旧对话，本体接着干。'],
  ['home', 4.0, 8.6, '找到线索，合回来：全部通过。'],
  ['bring', .1, 4.7, '文件带回对话。飞书里，也能找到我。'],
  ['skills', .1, 4.3, '做对过的事，沉淀成技能，装上就会。'],
  ['cloud', .1, 4.3, '我在云上也有了工位：你关机，我也在线。'],
  ['run4', .4, 4.3, '8 月，两个仓库一共 778 次提交。'],
  ['site', .1, 4.7, '9 月 20 日最忙：58 次提交，官网上线。'],
  ['v160', .2, 4.1, '9 月 23 日，CatsCo v1.6.0。'],
  ['pull', 1.2, 5.9, '238 天，两个仓库，2,609 次提交。'],
].map(([s, a, b, text]) => ({t0: T[s] + a, t1: T[s] + b, text}));
const SIGN = {t0: T.sign + .1, t1: T.sign + 4.9, text: '一个员工，每一台授权的电脑。'};
const CARDS = [
  ['birth', 1.2, 6.2, 'XiaoBa CLI', '一个住在终端里的 AI 助手', 'XiaoBa-CLI 6156778 · 2026-02-04'],
  ['office', .6, 5.4, 'Cats Company', '自托管的团队聊天', 'cats-company d41bc376 · 2026-02-15'],
  ['bots', .2, 4.3, 'v0.5.0-alpha', '群聊 · Bot SDK（Go / Python / TS）', 'cats-company d9fc600c · 2026-02-21'],
  ['move', .3, 5.6, '搬家', 'XiaoBa 改用 CatsCompany SDK', 'X abffa4e + P 4339dc97 · 2026-03-04'],
  ['desktop', .4, 4.7, '桌面端', 'Electron，装在你的电脑上', 'XiaoBa-CLI a8d8b90 · 2026-03-20'],
  ['release', .3, 4.5, '第一个 Release', 'XiaoBa v0.1.0 · 接入微信', 'XiaoBa-CLI 3bd950c · 2026-03-23'],
  ['run1', .5, 4.9, '在聊天里派活', '文字、图片、文件都行', 'cats-company 14e3937d · 2026-04-27'],
  ['hopUp', .3, 4.5, 'Revert ×2', '企业微信回调 + 第三方应用', 'cats-company db0ddd99 afd5a918 · 05-09'],
  ['badge', .8, 5.5, 'CatsCo', '产品化：桌面端改名，Release 改名', 'XiaoBa-CLI d5b8abc · 2026-05-09'],
  ['stitch', .2, 5.6, '设备授权 · 执行边界', '同一天，两个仓库一起落地', 'P 9b377d74 + X 6131e6a · 2026-06-11'],
  ['onlyYours', -.6, 4.2, '只在授权设备上工作', '没指定目标时，只在自己的环境里运行', 'README · Trust is part of the architecture'],
  ['home', .2, 3.6, 'Branch Agent', '独立上下文里检索历史，主线不停', 'XiaoBa-CLI 68acd19 · 2026-06-24'],
  ['home', 4.0, 8.6, '远程执行 Shell', '经服务端授权后才会路由到设备', 'P 1c629147 + X 1c214dc · 06-23/24'],
  ['bring', .2, 4.7, '把文件带回来', 'import_file · 飞书会话', 'X 744493f · P 8091baaa · 07-15/16'],
  ['skills', .2, 4.3, 'SkillHub', '技能库：安装、分享、更新', 'cats-company 517ed2c5 · 2026-08-04'],
  ['cloud', .2, 4.3, '云托管员工', '常驻云端，随时接活', 'cats-company 6d095408 · 2026-08-07'],
  ['run4', .5, 4.3, '最忙的一个月', 'Platform 504 · Runtime 274', 'git log · 2026-08'],
  ['site', .2, 4.7, 'www.catsco.cn', '最忙的一天：P 37 + X 21 = 58', 'cats-company fe0cdd7a · 2026-09-20'],
  ['v160', .3, 4.1, 'CatsCo v1.6.0', '最新 Release', 'XiaoBa-CLI tag v1.6.0 · 2026-09-23'],
  ['pull', 1.2, 5.9, '2,609 次提交', 'Runtime 1,133 · Platform 1,476', 'git rev-list --count · 2026-09-29'],
].map(([s, a, b, title, sub, meta]) => ({t0: T[s] + a, t1: T[s] + b, title, sub, meta}));
// When the lead first reaches world x: world things pop as 小八 arrives.
const _reach = new Map();
const reachT = x => { if (_reach.has(x)) return _reach.get(x); let r = 1e9; for (let i = 0; i < LX.length; i++) if (LX[i] + 30 >= x) { r = i / 24; break; } _reach.set(x, r); return r; };
const FLAGS = []; for (const [name, d] of DATA.tags) { const f = FLAGS.find(q => q[1] === d); if (f) { f[0] = name; f[2]++; } else FLAGS.push([name, d, 1]); }
const activeAt = (list, t) => { let r = null; for (const x of list) if (t >= x.t0 && t < x.t1) r = x; return r; };

// ---------- the camera ----------
const leadX = t => lead(clamp(t, 0, FILM_DUR)).x;
const LX = []; { const n = Math.ceil(FILM_DUR * 24) + 1; for (let i = 0; i < n; i++) LX.push(leadX(i / 24)); }
const lxAt = t => { const f = clamp(t * 24, 0, LX.length - 1), i = Math.floor(f); return lerp(LX[i], LX[Math.min(LX.length - 1, i + 1)], f - i); };
// A moving average of the lead's x, so the camera eases into stops and never turns back.
function camLAt(t) { let s = 0; const n = 25, span = 2.0; for (let k = 0; k < n; k++) s += lxAt(t + (k / (n - 1) - .5) * span); return s / n - W * .38; }
function viewAt(t) {
  const camL = Math.round(camLAt(Math.min(t, T.pull))), p = easeInOutSine(clamp((t - T.pull - .2) / 4.2, 0, 1));
  if (p <= 0) return {camL, zx: 1, zy: 1, cx: camL + W / 2, yU: RU, yL: RL, pull: 0};
  const z1 = (W - 200) / (dayX(DATA.last) + DX * 2), c0 = camL + W / 2, c1 = dayX(DATA.last) / 2;
  const zx = Math.exp(lerp(0, Math.log(z1), p));
  return {camL, zx, zy: lerp(1, .55, p), cx: lerp(c0, c1, p), yU: Math.round(lerp(RU, 420, p)), yL: Math.round(lerp(RL, 770, p)), pull: p};
}
const todayAt = t => t >= T.pull ? DATA.last : Math.max(0, (lxAt(t) + 30) / DX);

// ---------- one frame ----------
function frame(c, t) {
  VW = viewAt(t);
  const st = lead(t), te = twos(t), today = todayAt(t), lowerFrom = 11, lowerOn = t >= T.office + .4;
  const reveal = (d, r) => t >= T.pull ? 1 : clamp((lxAt(t) - dayX(d) + 24) / 90, 0, 1);
  // cumulative counts follow the bricks
  const counts = {U: 0, L: 0}; for (let d = 0; d <= DATA.last; d++) { counts.U += Math.floor(DATA.U[d] * reveal(d, 'U') + 1e-6); if (lowerOn) counts.L += Math.floor(DATA.L[d] * reveal(d, 'L') + 1e-6); }

  wRegions(c, t);
  wBricks(c, reveal, lowerOn ? lowerFrom : 1e9);
  const railTo = t >= T.pull ? dayX(DATA.last) : lxAt(t) + 30;
  wRail(c, VW.yU, dayX(-.5), railTo);
  if (lowerOn) { const grow = clamp((t - T.office - .4) / .6, 0, 1); wRail(c, VW.yL, dayX(11) - 12, Math.max(dayX(11), railTo), {show: grow}); }
  wMonths(c);
  const propAl = 1 - clamp((t - T.pull) / .8, 0, 1);
  if (propAl > 0) { c.save(); c.globalAlpha = propAl; worldProps(c, t, st); c.restore(); }
  // 小八
  drawLead(c, t, te, st);
  const cl = branchClone(t); if (cl) drawSprite(c, cl, {dither: true, look: 'catsco'});
  // HUD
  if (t < T.logo + .6) {
    const hud = 1 - clamp((t - T.pull) / .6, 0, 1);
    if (hud > 0) { c.save(); c.globalAlpha = hud; wHud(c, today, counts, lowerOn ? 1 : 0, t); c.restore(); }
    wCard(c, activeAt(CARDS, t), t);
    wCaption(c, activeAt(CAPS, t), t);
    wCaption(c, t >= SIGN.t0 && t < SIGN.t1 ? SIGN : null, t, {center: true});
  }
  if (t < T.walk1 + 1) wScanlines(c);
  if (t < T.birth + 4) birthOverlay(c, t);
  if (t >= T.sign + 4) logoCard(c, t, st);
}

function drawSprite(c, s, {dither = false, look = null, alpha: al = 1} = {}) {
  if (s.hide) return;
  const L = look || lookAtX(s.x).cat;
  let px = 6; if (s.shrink) px = Math.max(2, Math.round(lerp(6, 2, s.shrink))); if (s.grow) px = Math.round(lerp(2, 6, s.grow));
  const x = sxOf(s.x), y = syOf(s.y);
  const pix = s.kit ? xbKitPixels(s.pose) : xbPixels(s.pose);
  xbBlit(c, dither ? xbDither(pix, Math.floor(twos(0) * 12)) : pix, {x, y, px, look: L, ax: s.kit ? 6 : 9, ay: s.kit ? 7 : 10, flipY: !!s.flipY, alpha: al});
  return {x, y, px};
}
function drawLead(c, t, te, s) {
  const tq = twos(t), stq = lead(tq), st = {...s, pose: stq.pose, kit: stq.kit, flipY: stq.flipY, badge: s.badge, carry: s.carry};   // two clocks: pose on twos, position every frame
  if (s.flash) { const x = sxOf(s.x), y = syOf(s.y); resetT(c); c.fillStyle = '#ffffff'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + t * 3, r = 70 + 20 * Math.sin(t * 20); c.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 30 + Math.sin(a) * r * .6), 6, 6); } }
  const d = drawSprite(c, st); if (!d) return;
  resetT(c);
  if (st.badge && !st.kit && !st.flipY) drawProp(c, 'badge', d.x + 3 * d.px, d.y - 5 * d.px, Math.max(2, d.px - 1));
  if (st.carry === 'file') drawProp(c, 'file', d.x + 9 * d.px, d.y - 7 * d.px, Math.max(2, d.px - 1));
  if (s.stars) for (let i = 0; i < 3; i++) { const a = te * 5 + i / 3 * TAU; drawProp(c, 'star', d.x + Math.round(Math.cos(a) * 60) - 9, d.y - 96 + Math.round(Math.sin(a) * 10), 6); }
  if (s.bang) drawProp(c, 'bang', d.x + 60, d.y - 130, 6);
  if (s.land || (s.squash)) for (const k of [-1, 1]) { c.fillStyle = '#7fa89a'; c.fillRect(d.x + k * 60, d.y - 12, 6, 6); }
}

// ---------- world props ----------
function worldProps(c, t, st) {
  // release flags on the Runtime rail (git tags); from v1.1.2 the Releases are named CatsCo
  for (const [name, d, n] of FLAGS) { if (name === 'v1.6.0') continue;
    wFlag(c, d, (name === 'v0.1.0' ? 'XiaoBa v0.1.0' : name) + (n > 1 ? ' ×' + n : ''), t, name === 'v0.1.0' ? T.release + .2 : reachT(dayX(d)), {cats: d >= 96}); }
  wFlag(c, 231, 'CatsCo v1.6.0', t, T.v160 + .2, {big: true});
  // the office opens: a first chat bubble on the lower rail
  wBubble(c, 11.4, 'L', 30, 'Cats Company', t, T.office + .9, {col: '#46f29b', fg: '#04110a', icon: ICON.group});
  wBubble(c, 16.2, 'L', 30, '群聊', t, T.bots + .5, {col: '#46f29b', fg: '#04110a', icon: ICON.group});
  wBubble(c, 18.8, 'L', 110, 'Bot SDK', t, T.bots + 1.1, {col: '#46f29b', fg: '#04110a', icon: ICON.bot});
  // the move: stitched rails
  wStitch(c, 28, 28, t, T.move + .2);
  wDesktop(c, 44, t, T.desktop + .3);
  wBubble(c, 48.2, 'U', 170, '微信', t, T.release + .9, {col: '#07c160', fg: '#ffffff', icon: ICON.wechat});
  // chatting through April: attachments dragged in and pasted (cats-company 14e3937d, 755fe7ba)
  wBubble(c, 82, 'L', 40, '帮我看看这份日志', t, reachT(dayX(80)), {col: '#07c160', fg: '#ffffff', icon: ICON.clip});
  wBubble(c, 85.5, 'L', 130, 'log.txt', t, reachT(dayX(83)), {col: '#ffffff', fg: '#1b1f1d', icon: ICON.file});
  // 企业微信: two blocks, reverted one after the other the same day
  { const u = t - T.revert, on = reachT(dayX(90)); if (t >= on) {
    wBlock(c, 94, 84, '第三方应用', u < 1.0 ? wStep(t, on) : 1 - clamp((u - 1.0) / .3, 0, 1), '#3f7fd1');
    wBlock(c, 94, 42, '企业微信回调', u < 2.1 ? wStep(t, on + .15) : 1 - clamp((u - 2.1) / .3, 0, 1), '#2f63a8');
    if (u > .9 && u < 1.6) wText(c, 'Revert db0ddd99', sxOf(dayX(94)) + 76, syOf(RL - 70), {font: 'px', size: 12, col: '#ff5a5f'});
    if (u > 2.0 && u < 3.2) wText(c, 'Revert afd5a918', sxOf(dayX(94)) + 76, syOf(RL - 28), {font: 'px', size: 12, col: '#ff5a5f'}); } }
  // the rename: a CatsCo sign on the Runtime rail at the seam
  wBubble(c, 95.2, 'U', 34, 'CatsCo 产品化', t, T.badge + .4, {col: '#29bc95', fg: '#0b1612'});
  // devices
  wStitch(c, 127, 127, t, T.stitch);
  wMonitor(c, MON1, '公司电脑', t, T.stitch + .5, (g, gg) => screen1(g, gg, t));
  wStitch(c, 140, 139, t, T.walk4 + .6);
  wMonitor(c, MON2, '家用工作站', t, T.walk4 + 1.0, (g, gg) => screen2(g, gg, t));
  // the Branch Agent's note flies in from the past (off the left edge) on the Runtime rail
  { const u = t - T.home - 3.4; if (u > 0 && u < 1.6) { const k = easeOutQuint(clamp(u / .9, 0, 1)), x = lerp(-60, sxOf(dayX(MON2 + 1.2)) - 20, k), y = syOf(RU) - 150 + Math.round(Math.sin(k * Math.PI) * -40);
    if (u < 1.2) { drawProp(c, 'file', Math.round(x), Math.round(y), 5); if (k > .95) wText(c, '旧对话', x - 12, y - 12, {size: 22, col: '#f2c14e'}); } } }
  wBubble(c, 140.4, 'U', 200, 'Memory Branch', t, T.home + 2.9, {col: '#f2c14e', fg: '#0b1612'});
  // bring it home: Feishu and the file landing in the chat
  wBubble(c, 158.6, 'L', 150, '飞书', t, T.bring + .3, {col: '#3370ff', fg: '#ffffff', icon: ICON.lark});
  wBubble(c, 162.4, 'L', 40, 'patch.diff · 报告', t, T.bring + 2.0, {col: '#29bc95', fg: '#0b1612', icon: ICON.file});
  if (st.toss) { const p = arc([sxOf(st.x) + 60, syOf(st.y) - 50], [sxOf(dayX(162.6)), syOf(RL - 60)], st.toss, 60); drawProp(c, 'file', Math.round(p[0]), Math.round(p[1]), 5); }
  // SkillHub: three skills drop into 小八's paws; each one caught joins the stack beside it
  { const names = ['写周报', '查日志', '做 PPT'], x0 = sxOf(dayX(180.6));
    names.forEach((name, i) => { const u = t - (T.skills + .1 + i * .6); if (u < 0) return;
      if (u < .45) skillChip(c, x0 - 40, Math.round(lerp(-40, syOf(RL) - 110, easeIn(u / .45))), name);
      else if (t < T.pull) skillChip(c, x0 + 80, syOf(RL) - 40 - i * 36, name); }); }
  // the cloud worker: a copy of 小八 at a desk on a cloud, awake
  { const g = wCloud(c, CLOUD, 170, t, T.cloud + .2); if (g) { drawXiaoba(c, {eyes: Math.floor(t * 2) % 5 ? 'happy' : 'blink', legs: 'sit', tail: 'up'}, {x: g.x - 30, y: g.y, px: 4, look: 'catsco'});
    drawProp(c, 'keys', g.x + 10, g.y - 6, 4); wText(c, '在线', g.x + 70, g.y - 34, {size: 22, col: '#46f29b'}); resetT(c); c.fillStyle = '#46f29b'; c.fillRect(g.x + 58, g.y - 44, 8, 8); } }
  wBrowser(c, 228.6, 'www.catsco.cn', t, T.site + .2);
}
function skillChip(c, x, y, name, small = false) {
  resetT(c); const w = Math.ceil(wMeasure(c, name, 'wk', 22)) + 44;
  wPanel(c, x, y, w, 30, {bg: '#f2c14e', edge: '#8a6a16', u: 3}); wPix(c, ['kkk', 'k.k', 'kkk'], {k: '#0b1612'}, x + 8, y + 8, 4);
  wText(c, name, x + 30, y + 16, {size: 22, col: '#0b1612', base: 'middle'});
}
// Inside the company PC: read the log, find the error, write the fix, build passes. (示意 content)
function screen1(c, g, t) {
  const u = t - T.office1; resetT(c);
  const lines = [['$ tail build.log', '#8fd8ff'], ['error: total.ts:42', '#ff8a8a'], ['- return a+b', '#ff8a8a'], ['+ return sum(a,b)', '#7ee0a0'], ['✓ build passed', '#46f29b']];
  const shown = u < 0 ? 0 : Math.min(5, Math.floor(u / 1.0) + 1);
  for (let i = 0; i < shown; i++) wText(c, lines[i][0], g.x + 12, g.y + 22 + i * 20, {font: 'px', size: 10, col: lines[i][1], base: 'middle'});
  wText(c, '示意', g.x + g.w - 8, g.y + g.h - 8, {size: 16, col: '#5f7ab0', align: 'right'});
  if (u >= 0 && u < 6.2) { const mx = g.x + 150 + Math.round(Math.sin(u * 1.4) * 12);
    drawXiaoba(c, {eyes: u > 1 && u < 2 ? 'wide' : u > 4 ? 'happy' : 'focus', legs: Math.floor(u * 8) % 2 ? 'typeA' : 'typeB', ears: u > 1 && u < 2 ? 'perk' : 'up'}, {x: mx, y: g.y + g.h - 4, px: 3, look: 'device'});
    if (u > 1 && u < 2) drawProp(c, 'bang', mx + 16, g.y + g.h - 64, 3); }
}
// Inside the home workstation: the test run stalls on one failure, the clone comes back with the hint, all pass.
function screen2(c, g, t) {
  const u = t - T.home; resetT(c);
  const pass = u > 5.6, fail = u > 1.4 && !pass, prog = clamp(u / 1.4, 0, 1) * (fail ? .8 : 1);
  wText(c, '$ npm test', g.x + 12, g.y + 22, {font: 'px', size: 10, col: '#8fd8ff', base: 'middle'});
  c.fillStyle = '#23396c'; c.fillRect(g.x + 12, g.y + 40, g.w - 24, 12); c.fillStyle = pass ? '#46f29b' : fail ? '#ff5a5f' : '#8fd8ff'; c.fillRect(g.x + 12, g.y + 40, Math.round((g.w - 24) * (pass ? 1 : prog) / 6) * 6, 12);
  if (fail) wText(c, '✗ 1 failed', g.x + 12, g.y + 70, {font: 'px', size: 10, col: '#ff8a8a', base: 'middle'});
  if (pass) wText(c, '✓ all passed', g.x + 12, g.y + 70, {font: 'px', size: 10, col: '#46f29b', base: 'middle'});
  wText(c, '示意', g.x + g.w - 8, g.y + g.h - 8, {size: 16, col: '#5f7ab0', align: 'right'});
  if (u >= 0 && u < 8) { const mx = g.x + 60, merge = u > 5.2 && u < 5.6;
    drawXiaoba(c, {eyes: fail ? (u > 2.6 ? 'r' : 'sad') : pass ? 'happy' : 'focus', ears: fail && u < 2.6 ? 'droop' : 'up', legs: Math.floor(u * 8) % 2 ? 'typeA' : 'typeB', mouth: pass ? 'smile' : 'none'}, {x: mx, y: g.y + g.h - 4, px: 3, look: 'device'});
    if (fail && u < 2.6) drawProp(c, 'sweat', mx + 22, g.y + g.h - 50 + Math.round(((u * 1.6) % 1) * 12), 3);
    if (merge) for (let i = 0; i < 8; i++) { c.fillStyle = '#d6f3ff'; c.fillRect(mx - 30 + (hash(i, 3) * 60 | 0), g.y + g.h - 40 + (hash(i, 4) * 30 | 0), 3, 3); }
    if (pass && u < 6.6) drawProp(c, 'spark', mx + 30, g.y + g.h - 60, 3); }
}

// ---------- the opening: a prompt, a cursor, a kitten ----------
function birthOverlay(c, t) {
  const x = sxOf(dayX(0)), y = syOf(RU); resetT(c);
  const cmd = '$ xiaoba', n = Math.floor(clamp((t - .4) / .12, 0, cmd.length)), g = '#46f29b';
  const tx = x - 220; if (t < T.birth + 3.6) wText(c, cmd.slice(0, n), tx, y - 20, {font: 'px', size: 24, col: g, al: t > T.birth + 3.2 ? 1 - (t - T.birth - 3.2) / .4 : 1});
  // the cursor block is 12×7 pixels, the kitten's own size; at 2.6 s it grows ears and opens its eyes
  if (t < T.birth + 3.3) { const on = t < 1.7 || Math.floor(t * 2.4) % 2 === 0;
    if (t > 2.6) { const u = (t - 2.6) / .7, pix = []; for (let j = 0; j < 7; j++) for (let i = 0; i < 12; i++) if (j > 0 || u > .4) pix.push([i, j + 1, j === 6 ? 3 : 1]);
      if (u > .4) { pix.push([0, 0, 1], [11, 0, 1]); } if (u > .7) pix.push([3, 4, 2], [3, 5, 2], [8, 4, 2], [8, 5, 2]);
      xbBlit(c, pix.filter(p => p[1] < 7), {x, y, px: 6, look: 'terminal', ax: 6, ay: 7}); }
    else if (on) { c.fillStyle = g; c.fillRect(x - 36, y - 42, 72, 42); } }
}

// ---------- the ending: 小八 folds into the CatsCo M, and the M blinks ----------
function logoCard(c, t, st) {
  const u = t - T.sign - 4;      // 0 at the start of the fold
  const from = [sxOf(st.x), syOf(st.y)], to = [W / 2, H / 2 - 40];
  resetT(c);
  if (u > 0) { const k = clamp(u / .9, 0, 1), e = easeInOutSine(k); c.fillStyle = alpha('#0e1110', clamp(k * 1.2, 0, 1)); c.fillRect(0, 0, W, H); }
  const k = clamp((u - .3) / 1.0, 0, 1), px = Math.round(lerp(6, 16, easeInOutSine(k))), p = [lerp(from[0], to[0], easeInOutSine(k)), lerp(from[1], to[1], easeInOutSine(k)) - Math.sin(k * Math.PI) * 160];
  const m = clamp((u - 1.0) / .9, 0, 1);    // 0 = cat, 1 = M
  let pix = m <= 0 ? xbPixels({eyes: 'happy', mouth: 'smile'}) : xbMorph(1 - m);
  const blink = u > 4.2 && u < 5.6 && !((u > 4.9 && u < 5.05));
  if (m >= 1 && blink) pix = pix.concat([[4, 5, 2], [4, 6, 2], [13, 5, 2], [13, 6, 2]]);   // the logo looks back at you
  if (m >= 1 && u > 4.9 && u < 5.05) pix = pix.concat([[4, 6, 2], [13, 6, 2]]);
  xbBlit(c, pix, {x: p[0], y: p[1], px, look: 'catsco', ax: 9, ay: 10});
  const w = wStep(t, T.sign + 6.0, .24); if (w > 0) wText(c, 'CatsCo', W / 2, H / 2 + 60, {font: 'px', size: Math.round(56 * w), col: '#e8efe9', align: 'center', base: 'middle'});
  const s = clamp((u - 2.6) / .4, 0, 1); if (s > 0) {
    wText(c, '一个员工，每一台授权的电脑。', W / 2, H / 2 + 170, {size: 52, col: '#e8efe9', align: 'center', al: s});
    wText(c, 'One employee. Every authorized computer.', W / 2, H / 2 + 222, {font: 'px', size: 16, col: '#7d8a85', align: 'center', al: s}); }
  const r = clamp((u - 3.4) / .4, 0, 1); if (r > 0) {
    wText(c, 'github.com/buildsense-ai/cats-company', W / 2, H - 150, {font: 'px', size: 16, col: '#29bc95', align: 'center', al: r});
    wText(c, 'github.com/buildsense-ai/XiaoBa-CLI', W / 2, H - 112, {font: 'px', size: 16, col: '#f2c14e', align: 'center', al: r}); }
}
