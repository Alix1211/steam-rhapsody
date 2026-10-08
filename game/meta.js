/* meta.js — 캠페인 · 장면 · 저장 · 대사 · 별 판정   [Claude 전담 — GPT는 수정 금지, 요청은 inbox/for_claude.md]
   전투 엔진은 index.html. 이 파일은 index.html 뒤에 로드되어 빈 껍데기 함수(drawMenu, menuTap, onOverTap, onBattleTap, drawOver)를 덮어쓰고
   update/draw를 감싼다. 숫자 값(난이도·시간·별 기준)은 모두 가안이며 아래 DIFF / STAR_T / HERO_UNLOCK 에 모여 있다. */
(function () {
'use strict';
const FONT = 'sans-serif';
const nowMs = () => performance.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ================= 가안 값 (한 곳에 모음) =================
const DIFF = { hpMul: 1.6, atkMul: 1.35, heroHp: 1.2, heroDmg: 1.3, cover: 1.25, ecover: 1.3 };   // 장(章)마다 곱해지는 배율
const STAR_T = [0.5, 0.25];            // 남은 시간 비율: ≥50% ★3, ≥25% ★2, 그 외 클리어 ★1
const HERO_UNLOCK = { human: 1, dwarf: 1, elf: 1, fox: 1, goblin: 2, harpy: 3, lamia: 4, fmedic: 5,
                      mhuman: 1, mdwarf: 1, melf: 1, mmedic: 1, mwolf: 2, morc: 3, mlizard: 4, mgoblin: 5 };   // 몇 장에 도달하면 사용 가능한가
const LINES = {
  F: { id: 'F', name: '여존 연방 도미나리아', short: '여존 연방', col: '#b0243a', hi: '#f0c860', chs: ['F1', 'F2', 'F3', 'F4', 'F5'], foe: '남존 제국군' },
  M: { id: 'M', name: '남존 제국 발할리온', short: '남존 제국', col: '#2a3f78', hi: '#7fb2ff', chs: ['M1', 'M2', 'M3', 'M4', 'M5'], foe: '여존 연방군' },
  C: { id: 'C', name: '마계', short: '마계', col: '#5a2a6a', hi: '#d9a8ff', chs: ['C11'], foe: '마계 병사' } };
const chNo = ch => parseInt(ch.slice(1), 10);
const tier = ch => { const n = chNo(ch); return n >= 11 ? 5 : n - 1; };       // 0~5 (11장 = 5)
function params(ch, no) {
  const c = tier(ch), boss = no === 10, f = 1 + 0.07 * (no - 1);
  const goal = Math.round(14 + no * 1.2 + c * 0.8);
  const lim = Math.round(70 + goal * 3.2 + (boss ? 25 : 0)) * 60;
  return { boss, goal, st: {
    ehp: Math.round(40 * Math.pow(DIFF.hpMul, c) * f), edmg: +(6 * Math.pow(DIFF.atkMul, c) * (1 + 0.04 * (no - 1))).toFixed(1),
    goal, limit: lim, boss, bossHp: 9, maxAlive: 5 + (no >= 4 ? 1 : 0) + (no >= 8 ? 1 : 0) + (c >= 3 ? 1 : 0),
    spB: Math.max(60, 86 - no * 2 - c * 2), spMin: Math.max(36, 54 - no - c * 2), eliteP: Math.min(0.45, 0.08 + 0.03 * no + 0.03 * c),
    fMin: Math.max(60, 100 - c * 4 - no), fVar: 70, mechHp: 1.5,
    cvHp: Math.round(220 * Math.pow(DIFF.cover, c)), ecv: Math.round(30 * Math.pow(DIFF.ecover, c)), bombCv: Math.round(250 * Math.pow(DIFF.ecover, c)),
    bombDmg: Math.round(140 * Math.pow(DIFF.heroDmg, c)), hhp: Math.round(100 * Math.pow(DIFF.heroHp, c)), heal: +(6 * Math.pow(DIFF.heroHp, c)).toFixed(1) } };
}
const mmss = fr => { const s = Math.max(0, Math.ceil(fr / 60)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// ================= 저장 =================
const SAVE_KEY = 'gw_save_v1';
const defSave = () => ({ v: 1, clr: {}, seen: {}, party: {}, opt: { dev: false }, gear: [], eq: {}, parts: 0, nid: 1, last: { side: 'F', ch: {} } });
let SV = defSave();
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); if (s) { const o = JSON.parse(s); SV = Object.assign(defSave(), o); SV.opt = Object.assign({ dev: false }, o.opt); } } catch (e) {} }
function saveNow() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SV)); } catch (e) {} }
loadSave();

// ================= 진행도 =================
const epId = (ch, no) => ch + '-' + no;
const starsOf = (ch, no) => SV.clr[epId(ch, no)] || 0;
const cleared = (ch, no) => starsOf(ch, no) > 0;
const DEV = () => !!SV.opt.dev || /[#?&]dev/.test(location.href);
const c11Open = () => DEV() || (cleared('F5', 10) && cleared('M5', 10));
function chOpen(side, ci) { if (DEV()) return true; if (side === 'C') return c11Open(); return ci === 0 || cleared(LINES[side].chs[ci - 1], 10); }
function epOpen(side, ci, no) { if (DEV()) return true; if (!chOpen(side, ci)) return false; return no === 1 || cleared(LINES[side].chs[ci], no - 1); }
function reach(side) { if (side === 'C') return 6; let r = 1; LINES[side].chs.forEach((c, i) => { if (chOpen(side, i)) r = i + 1; }); return r; }
const heroLine = r => ROSTER.F.includes(r) ? 'F' : 'M';
const heroAvail = r => DEV() || reach(heroLine(r)) >= HERO_UNLOCK[r.k];
const poolOf = side => side === 'C' ? ROSTER.F.concat(ROSTER.M) : ROSTER[side];
function lineStats(side) { let n = 0, s = 0, tot = 0; for (const ch of LINES[side].chs) for (let no = 1; no <= 10; no++) { tot++; const v = starsOf(ch, no); if (v) { n++; s += v; } } return { n, s, tot }; }
const hasProgress = () => Object.keys(SV.clr).length > 0;

// ================= 대사 데이터 =================
const DATA = {}; let REACT = null;
function loadData() {
  for (const side of ['F', 'M', 'C']) for (const ch of LINES[side].chs)
    fetch(new URL('../data/dialogue/' + ch + '.json', location.href)).then(r => r.json()).then(j => { DATA[ch] = j; }).catch(() => { DATA[ch] = null; });
  fetch(new URL('../data/dialogue/C11_reactions.json', location.href)).then(r => r.json()).then(j => { REACT = j; }).catch(() => {});
}
function epData(ch, no) {
  const d = DATA[ch]; const e = d && d.episodes && d.episodes[no - 1];
  return e || { id: epId(ch, no), no, title: d === undefined ? '불러오는 중…' : '(대사 데이터 없음)', boss: no === 10, before: [], after: [], stars: {} };
}
const chTitle = ch => (DATA[ch] && DATA[ch].title) || '';
loadData();

// ================= 그리기 도구 =================
const UI = {}; const ui = n => UI[n] || (UI[n] = loadImg('ui/' + n + '.webp'));
function spr(n, x, y, w, h) { const i = ui(n); if (!i.ok) return false; g.drawImage(i, x, y, w, h); return true; }
function sprFit(n, cx, cy, sz) { const i = ui(n); if (!i.ok) return; const k = sz / Math.max(i.naturalWidth, i.naturalHeight), w = i.naturalWidth * k, h = i.naturalHeight * k; g.drawImage(i, cx - w / 2, cy - h / 2, w, h); }
function plate3(n, x, y, w, h, capR) {
  const i = ui(n); if (!i.ok) return; const sw = i.naturalWidth, sh = i.naturalHeight, k = h / sh, cap = Math.min(sw * 0.4, sh * (capR || 0.95)), cw = cap * k;
  if (w <= cw * 2) { g.drawImage(i, x, y, w, h); return; }
  g.drawImage(i, 0, 0, cap, sh, x, y, cw, h); g.drawImage(i, cap, 0, sw - 2 * cap, sh, x + cw, y, w - 2 * cw, h); g.drawImage(i, sw - cap, 0, cap, sh, x + w - cw, y, cw, h);
}
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function panel(x, y, w, h, o) {
  o = o || {}; g.save(); rr(x, y, w, h, 8); g.fillStyle = o.fill || 'rgba(16,11,18,.9)'; g.fill();
  const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, o.e1 || '#e8b86a'); gr.addColorStop(0.5, o.e2 || '#9a6a34'); gr.addColorStop(1, o.e1 || '#e8b86a');
  g.lineWidth = o.lw || 3; g.strokeStyle = gr; g.stroke(); rr(x + 5, y + 5, w - 10, h - 10, 5); g.lineWidth = 1; g.strokeStyle = 'rgba(255,230,170,.28)'; g.stroke();
  if (o.gem !== false && w > 90 && h > 60) for (const [gx, gy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) sprFit('gem04', gx, gy, 22);
  g.restore();
}
function txt(s, x, y, o) {
  o = o || {}; g.font = (o.b ? 'bold ' : '') + (o.s || 20) + 'px ' + FONT; g.textAlign = o.a || 'left'; g.textBaseline = 'alphabetic';
  if (o.sh) { g.fillStyle = 'rgba(0,0,0,.85)'; g.fillText(s, x + 2, y + 2); } g.fillStyle = o.c || '#fff'; g.fillText(s, x, y);
}
function wrap(s, maxW, size, bold) {
  g.font = (bold ? 'bold ' : '') + size + 'px ' + FONT; const out = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w; if (g.measureText(t).width <= maxW) { line = t; continue; }
      if (line) out.push(line); line = ''; let tmp = '';
      for (const ch of w) { if (g.measureText(tmp + ch).width > maxW && tmp) { out.push(tmp); tmp = ch; } else tmp += ch; }
      line = tmp;
    }
    out.push(line);
  }
  return out;
}
const HIT = [];
function addHit(x, y, w, h, fn) { HIT.push({ x, y, w, h, fn }); }
function button(label, x, y, w, h, fn, o) {
  o = o || {}; g.save(); if (o.dis) g.globalAlpha = 0.45;
  plate3(o.red ? 'plate_red_a' : (o.gold ? 'plate_parch_a' : 'plate_dark_s'), x, y, w, h);
  txt(label, x + w / 2, y + h / 2 + (o.s || 22) * 0.35, { b: true, s: o.s || 22, a: 'center', c: o.gold ? '#3a2410' : '#fff', sh: !o.gold }); g.restore();
  if (!o.dis) addHit(x, y, w, h, fn);
}
function star(cx, cy, r, on, pop) {
  g.save(); g.translate(cx, cy); if (pop) g.scale(pop, pop); g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } g.closePath();
  if (on) { g.fillStyle = '#ffd24a'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff3b0'; g.stroke(); } else { g.fillStyle = 'rgba(255,255,255,.07)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.28)'; g.stroke(); }
  g.restore();
}
function starRow(cx, cy, r, n, gap) { for (let i = 0; i < 3; i++) star(cx + (i - 1) * (r * 2 + (gap || 4)), cy, r, i < n); }
function coverImg(im, fx, fy) { if (!im || !im.ok) return false; const iw = im.naturalWidth, ih = im.naturalHeight, s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s; g.drawImage(im, -(dw - W) * fx, -(dh - H) * fy, dw, dh); return true; }
function dim(a) { g.fillStyle = 'rgba(6,4,10,' + a + ')'; g.fillRect(0, 0, W, H); }
let toastMsg = '', toastT = 0;
const toast = m => { toastMsg = m; toastT = nowMs() + 2200; };
function drawToast() {
  if (nowMs() > toastT) return; g.font = 'bold 22px ' + FONT; const w = Math.min(W - 40, g.measureText(toastMsg).width + 50), x = (W - w) / 2, y = H - 120;
  g.save(); g.globalAlpha = clamp((toastT - nowMs()) / 400, 0, 1); g.fillStyle = 'rgba(0,0,0,.8)'; rr(x, y, w, 46, 10); g.fill(); g.strokeStyle = '#e8b86a'; g.lineWidth = 2; g.stroke();
  txt(toastMsg, W / 2, y + 31, { b: true, s: 22, a: 'center' }); g.restore();
}
function header(title, back, sub) {
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, W, 64); g.fillStyle = 'rgba(232,184,106,.55)'; g.fillRect(0, 63, W, 2);
  if (back) { sprFit('arrow_l_md', 38, 32, 54); addHit(0, 0, 80, 64, back); }
  txt(title, W / 2, sub ? 34 : 43, { b: true, s: portrait ? 24 : 28, a: 'center', c: '#ffe9b0', sh: true });
  if (sub) txt(sub, W / 2, 56, { s: 16, a: 'center', c: '#cbb890' });
}

// ================= 장면 상태 =================
let scene = 'title', MODAL = null, PS = null, DL = null, curStage = null, res = null, paused = false, timeUp = false, devTaps = 0, devT = 0;
function go(s) { scene = s; menu = true; MODAL = null; }

// ---------- 타이틀 ----------
function drawTitle() {
  g.fillStyle = '#0d0a10'; g.fillRect(0, 0, W, H);
  const ph = Math.sin(nowMs() / 7000) * 0.5 + 0.5; coverImg(ui('keyart'), portrait ? 0.3 + ph * 0.4 : 0.5, portrait ? 0.5 : 0.2 + ph * 0.35);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(8,6,12,.5)'); gr.addColorStop(0.45, 'rgba(8,6,12,.12)'); gr.addColorStop(1, 'rgba(8,6,12,.88)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const lg = ui('logo'); if (lg.ok) { const lw = Math.min(W * (portrait ? 0.96 : 0.5), 820), lh = lw * lg.naturalHeight / lg.naturalWidth; g.drawImage(lg, (W - lw) / 2, portrait ? 110 : 26, lw, lh); }
  const bw = portrait ? 440 : 380, bh = portrait ? 90 : 80, bx = (W - bw) / 2, by = portrait ? H - 360 : H - 210;
  button(hasProgress() ? '이어하기' : '시작하기', bx, by, bw, bh, () => openLines(), { red: true, s: 32 });
  button('처음부터', bx + bw / 2 - 90, by + bh + 14, 180, 52, () => { MODAL = { kind: 'confirm', title: '처음부터 시작할까요?', msg: '저장된 진행도·장비가 모두 지워집니다.', yes: () => { SV = defSave(); saveNow(); toast('초기화했습니다'); } }; }, { s: 20 });
  const vt = '프로토타입 v32 · 개인 플레이용' + (DEV() ? ' · 개발자 모드' : ''); txt(vt, W / 2, H - 18, { s: 15, a: 'center', c: 'rgba(255,255,255,.55)' }); addHit(W / 2 - 150, H - 40, 300, 40, () => {
    if (nowMs() - devT > 1200) devTaps = 0; devT = nowMs(); if (++devTaps >= 5) { devTaps = 0; SV.opt.dev = !SV.opt.dev; saveNow(); toast(SV.opt.dev ? '개발자 모드 켬 (전부 열림)' : '개발자 모드 끔'); } });
}

// ---------- 전선 선택 ----------
function openLines() { go('lines'); }
function lineCard(side, x, y, w, h) {
  const Ln = LINES[side], st = lineStats(side), pool = poolOf(side);
  panel(x, y, w, h, { fill: 'rgba(14,10,18,.82)', e1: Ln.hi, e2: Ln.col });
  g.fillStyle = Ln.col; g.globalAlpha = 0.85; g.fillRect(x + 8, y + 8, w - 16, 62); g.globalAlpha = 1;
  txt(Ln.name, x + w / 2, y + 48, { b: true, s: portrait ? 26 : 28, a: 'center', sh: true });
  const nv = side === 'F' ? '진행 ' : '진행 ';
  txt(nv + st.n + '/' + st.tot + '편 · ★ ' + st.s + '/' + (st.tot * 3), x + w / 2, y + 100, { s: 18, a: 'center', c: '#e8d8b0' });
  // 장 진행 칩
  const cw = (w - 40 - 4 * 8) / 5; for (let i = 0; i < 5; i++) {
    const ch = Ln.chs[i], op = chOpen(side, i), cx = x + 20 + i * (cw + 8), cy = y + 118; let done = 0; for (let no = 1; no <= 10; no++) if (cleared(ch, no)) done++;
    g.fillStyle = op ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.45)'; g.fillRect(cx, cy, cw, 44); g.strokeStyle = done === 10 ? '#ffd24a' : 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.strokeRect(cx, cy, cw, 44);
    txt((i + 1) + '장', cx + cw / 2, cy + 20, { b: true, s: 17, a: 'center', c: op ? '#fff' : '#777' }); txt(op ? done + '/10' : '잠김', cx + cw / 2, cy + 38, { s: 13, a: 'center', c: op ? '#cfc' : '#777' });
  }
  // 영웅 얼굴
  const n = pool.length, fy = y + 186, avail = h - 186 - 90, rowsN = Math.ceil(n / 4), perRow = Math.ceil(n / rowsN), fh = Math.min((avail - (rowsN - 1) * 6) / rowsN, 230), fw = (w - 40 - (perRow - 1) * 6) / perRow;
  txt('동료', x + 20, fy - 8, { s: 15, c: '#cbb890' });
  pool.forEach((r, i) => { const fx = x + 20 + (i % perRow) * (fw + 6), fyy = fy + Math.floor(i / perRow) * (fh + 6), av = heroAvail(r); g.save(); if (!av) g.globalAlpha = 0.28; g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(fx, fyy, fw, fh);
    if (r.face.ok) { const k = Math.min(fw / r.face.naturalWidth, fh / r.face.naturalHeight); const dw = r.face.naturalWidth * k, dh = r.face.naturalHeight * k; g.drawImage(r.face, fx + (fw - dw) / 2, fyy + (fh - dh) / 2, dw, dh); } g.restore();
    if (!av) sprFit('ic_lock', fx + fw / 2, fyy + fh / 2, Math.min(fw * 0.6, 40)); });
  button('출격 준비', x + w / 2 - 130, y + h - 78, 260, 60, () => openStages(side), { red: true, s: 24 });
}
function drawLines() {
  coverImg(bg, 0.5, 0.5); dim(0.72); header('전선 선택', () => go('title'));
  const c11 = c11Open(), bot = 80, top = 78, gap = 14;
  if (!portrait) { const cw = (W - 40 - gap) / 2, ch = H - top - bot - (c11 ? 0 : -10); lineCard('F', 20, top, cw, ch - 10); lineCard('M', 20 + cw + gap, top, cw, ch - 10); }
  else { const ch = (H - top - bot - gap - 20) / 2; lineCard('F', 20, top, W - 40, ch); lineCard('M', 20, top + ch + gap, W - 40, ch); }
  const by = H - 72;
  if (c11) { button('마계 · 11장', W / 2 - 230, by, 300, 58, () => openStages('C'), { gold: true, s: 24 }); }
  else { g.save(); g.globalAlpha = 0.55; plate3('plate_dark_s', W / 2 - 230, by, 300, 58); g.restore(); sprFit('ic_lock', W / 2 - 205, by + 29, 34); txt('???', W / 2 - 70, by + 38, { b: true, s: 24, a: 'center', c: '#9a8a70' }); }
  button('장비', W / 2 + 90, by, 140, 58, () => openInv(() => go('lines')), { s: 22 });
}

// ---------- 스테이지 목록 ----------
let SG = { side: 'F', ci: 0 };
function openStages(side, ci) {
  if (ci === undefined) { const m = SV.last.ch[side]; ci = m !== undefined && chOpen(side, m) ? m : Math.max(0, reach(side) - 1); if (side === 'C') ci = 0; }
  SG = { side, ci }; SV.last.side = side; go('stages');
}
function drawStages() {
  const side = SG.side, Ln = LINES[side], ci = SG.ci, ch = Ln.chs[ci];
  coverImg(bg, 0.5, 0.5); dim(0.72); header(Ln.name, () => go('lines'), chNo(ch) + '장 · ' + chTitle(ch));
  const n = Ln.chs.length, tw = Math.min(110, (W - 40 - (n - 1) * 8) / n);
  if (n > 1) for (let i = 0; i < n; i++) {
    const op = chOpen(side, i), x = 20 + i * (tw + 8), y = 72; g.fillStyle = i === ci ? Ln.col : 'rgba(0,0,0,.5)'; g.fillRect(x, y, tw, 44); g.strokeStyle = i === ci ? '#ffe27a' : 'rgba(255,255,255,.3)'; g.lineWidth = i === ci ? 3 : 2; g.strokeRect(x, y, tw, 44);
    txt(op ? (i + 1) + '장' : '', x + tw / 2, y + 30, { b: true, s: 20, a: 'center', c: op ? '#fff' : '#777' }); if (!op) sprFit('ic_lock', x + tw / 2, y + 22, 30);
    addHit(x, y, tw, 44, () => { if (!op) { toast('이전 장의 마지막 편을 클리어하세요'); return; } SG.ci = i; SV.last.ch[side] = i; });
  }
  const top = n > 1 ? 128 : 76, cols = portrait ? 2 : 5, rows = portrait ? 5 : 2, gx = 12, bot = 16;
  const cw = (W - 40 - (cols - 1) * gx) / cols, chh = (H - top - bot - (rows - 1) * gx) / rows;
  for (let no = 1; no <= 10; no++) {
    const e = epData(ch, no), i = no - 1, x = 20 + (i % cols) * (cw + gx), y = top + Math.floor(i / cols) * (chh + gx), op = epOpen(side, ci, no), sv = starsOf(ch, no), boss = no === 10;
    panel(x, y, cw, chh, { fill: op ? 'rgba(20,14,22,.88)' : 'rgba(10,8,12,.8)', e1: boss ? '#ff7a6a' : (sv ? '#ffd24a' : '#c89a5a'), e2: boss ? '#8a2a2a' : '#7a5230', gem: false });
    txt(chNo(ch) + '-' + no, x + 14, y + 34, { b: true, s: 26, c: boss ? '#ff9a8a' : '#ffe27a' });
    if (boss) { plate3('plate_red_a', x + cw - 92, y + 8, 84, 30); txt('BOSS', x + cw - 50, y + 29, { b: true, s: 16, a: 'center' }); }
    const lines = wrap(e.title, cw - 28, portrait ? 22 : 20, true).slice(0, 2); lines.forEach((l, k) => txt(l, x + 14, y + 66 + k * 26, { b: true, s: portrait ? 22 : 20, c: op ? '#fff' : '#666' }));
    starRow(x + cw / 2, y + chh - 28, 15, sv, 4);
    if (!op) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x + 4, y + 4, cw - 8, chh - 8); sprFit('ic_lock', x + cw / 2, y + chh / 2, 58); }
    addHit(x, y, cw, chh, () => { if (!op) { toast(no === 1 ? '이전 장을 먼저 끝내야 합니다' : '이전 편을 먼저 클리어하세요'); return; } MODAL = { kind: 'brief', side, ci, ch, no }; });
  }
}
function drawBrief() {
  const m = MODAL, e = epData(m.ch, m.no), P = params(m.ch, m.no), w = Math.min(W - 40, 620), h = portrait ? 540 : 500, x = (W - w) / 2, y = (H - h) / 2;
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, W, H); panel(x, y, w, h, { fill: 'rgba(16,11,18,.96)', e1: P.boss ? '#ff7a6a' : '#e8b86a' });
  txt(chNo(m.ch) + '-' + m.no + (P.boss ? '  BOSS' : ''), x + w / 2, y + 48, { b: true, s: 28, a: 'center', c: P.boss ? '#ff9a8a' : '#ffe27a' });
  wrap(e.title, w - 50, 26, true).slice(0, 2).forEach((l, i) => txt(l, x + w / 2, y + 86 + i * 32, { b: true, s: 26, a: 'center' }));
  const sv = starsOf(m.ch, m.no); starRow(x + w / 2, y + 140, 20, sv, 8);
  const rows = [['목표', '적 ' + P.goal + '명 처치' + (P.boss ? ' (보스 포함)' : '')], ['제한 시간', mmss(P.st.limit)], ['별 3개', '남은 시간 ' + Math.round(STAR_T[0] * 100) + '% 이상'], ['별 2개', '남은 시간 ' + Math.round(STAR_T[1] * 100) + '% 이상'], ['별 1개', '클리어'], ['적', LINES[m.side].foe]];
  rows.forEach((r, i) => { const yy = y + 196 + i * 36; txt(r[0], x + 40, yy, { s: 20, c: '#cbb890' }); txt(r[1], x + w - 40, yy, { s: 20, a: 'right', b: true }); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 36, yy + 10, w - 72, 1); });
  const by = y + h - 76, hasSeen = SV.seen[epId(m.ch, m.no) + 'b'] || sv;
  button('출격', x + w - 200, by, 170, 56, () => { MODAL = null; openParty(m.side, m.ci, m.ch, m.no); }, { red: true, s: 24 });
  if (hasSeen) button('대사 보기', x + w / 2 - 80, by, 150, 56, () => { MODAL = null; replayStory(m.ch, m.no); }, { s: 20 });
  button('닫기', x + 30, by, 110, 56, () => { MODAL = null; }, { s: 20 });
}
function replayStory(ch, no) { const e = epData(ch, no); const back = () => { openStages(SG.side, SG.ci); }; playDialogue(e.before.concat(e.after), back); }

// ---------- 출격(파티) ----------
function openParty(side, ci, ch, no) {
  const pool = poolOf(side), saved = SV.party[side] || []; let sel = saved.map(k => pool.find(r => r.k === k)).filter(r => r && heroAvail(r)).slice(0, 3);
  PS = { side, ci, ch, no, sel }; go('party');
}
function drawParty() {
  const { side, ch, no } = PS, pool = poolOf(side), n = pool.length;
  coverImg(bg, 0.5, 0.5); dim(0.78); header('출격 편성', () => openStages(side, PS.ci), chNo(ch) + '-' + no + ' · ' + epData(ch, no).title);
  const cols = n > 8 ? (portrait ? 4 : 8) : (portrait ? 2 : 4), rows = Math.ceil(n / cols), top = 80, bot = 110, gx = 12, cw = (W - 40 - (cols - 1) * gx) / cols, chh = Math.min((H - top - bot - (rows - 1) * gx) / rows, 330), small = cw < 200;
  pool.forEach((r, i) => {
    const x = 20 + (i % cols) * (cw + gx), y = top + Math.floor(i / cols) * (chh + gx), j = PS.sel.indexOf(r), on = j >= 0, av = heroAvail(r);
    g.fillStyle = on ? 'rgba(255,226,122,.2)' : 'rgba(0,0,0,.55)'; g.fillRect(x, y, cw, chh); g.strokeStyle = on ? '#ffe27a' : 'rgba(255,255,255,.25)'; g.lineWidth = on ? 4 : 2; g.strokeRect(x, y, cw, chh);
    const ih = chh - (small ? 46 : 62), fi = r.face;
    g.save(); if (!av) g.globalAlpha = 0.3; if (fi.ok) { const k = Math.min((cw - 12) / fi.naturalWidth, ih / fi.naturalHeight), dw = fi.naturalWidth * k, dh = fi.naturalHeight * k; g.drawImage(fi, x + (cw - dw) / 2, y + 6, dw, dh); } g.restore();
    txt(r.n, x + 10, y + chh - (small ? 22 : 30), { b: true, s: small ? 18 : 24, c: av ? '#fff' : '#777' }); txt(CLS[r.c], x + 10, y + chh - (small ? 6 : 8), { b: true, s: small ? 14 : 18, c: CCOL[r.c] });
    if (!av) { sprFit('ic_lock', x + cw / 2, y + ih / 2, 46); txt(HERO_UNLOCK[r.k] + '장 해금', x + cw / 2, y + ih / 2 + 44, { b: true, s: 16, a: 'center', c: '#ffd0a0', sh: true }); }
    if (on) { sprFit('ring_dark_s1', x + cw - 26, y + 26, 40); txt(String(j + 1), x + cw - 26, y + 35, { b: true, s: 22, a: 'center', c: '#ffe27a' }); }
    addHit(x, y, cw, chh, () => { if (!av) { toast(HERO_UNLOCK[r.k] + '장에 도달하면 사용할 수 있습니다'); return; } if (on) PS.sel.splice(j, 1); else if (PS.sel.length < 3) PS.sel.push(r); else toast('3명까지 고를 수 있습니다'); });
  });
  const rd = PS.sel.length === 3;
  txt('출격할 3명을 고르세요 (' + PS.sel.length + '/3)', 24, H - 52, { b: true, s: 22, c: '#ffe27a', sh: true });
  button('장비', W - 440, H - 88, 190, 68, () => openInv(() => go('party')), { s: 24 });
  button('출격', W - 230, H - 88, 200, 68, () => { SV.party[side] = PS.sel.map(r => r.k); saveNow(); beginStage(); }, { red: true, s: 30, dis: !rd });
}

// ---------- 대사 ----------
const NAMEMAP = {}; for (const r of ROSTER.F.concat(ROSTER.M)) NAMEMAP[r.n] = r;
function heroOf(who) { if (!who) return null; if (NAMEMAP[who]) return NAMEMAP[who]; const p = who.split(/[·,]/)[0].trim(); return NAMEMAP[p] || null; }
function playDialogue(lines, onEnd) { if (!lines || !lines.length) { onEnd(); return; } DL = { lines, i: 0, t0: nowMs(), onEnd }; go('dialogue'); }
const DL_MS = 24;
function dlShown() { const l = DL.lines[DL.i]; return Math.min(l.text.length, Math.floor((nowMs() - DL.t0) / DL_MS)); }
function dlAdvance() {
  if (!DL) return; const l = DL.lines[DL.i]; if (dlShown() < l.text.length) { DL.t0 = nowMs() - l.text.length * DL_MS; return; }
  DL.i++; if (DL.i >= DL.lines.length) { const f = DL.onEnd; DL = null; f(); } else DL.t0 = nowMs();
}
function dlSkip() { if (!DL) return; const f = DL.onEnd; DL = null; f(); }
function drawDialogue() {
  if (!DL) return; const l = DL.lines[DL.i], narr = l.kind === 'stage' || !l.who, hero = heroOf(l.who);
  g.fillStyle = '#0d0a10'; g.fillRect(0, 0, W, H); coverImg(bg, 0.5, 0.5); dim(0.5);
  const bh = portrait ? 330 : 210, bx = portrait ? 20 : 40, bw = W - bx * 2, by = H - bh - (portrait ? 30 : 22);
  if (hero && hero.face.ok) {
    const right = heroLine(hero) === 'M', ph = portrait ? H * 0.46 : H * 0.7, k = ph / hero.face.naturalHeight, pw = hero.face.naturalWidth * k;
    g.save(); g.globalAlpha = 0.97; g.drawImage(hero.face, right ? W - pw - (portrait ? 10 : 70) : (portrait ? 10 : 70), by - ph + 40, pw, ph); g.restore();
  }
  panel(bx, by, bw, bh, { fill: 'rgba(12,8,16,.9)' });
  if (!narr) { plate3('plate_red_a', bx + 26, by - 34, 250, 68); txt(l.who, bx + 26 + 125, by + 10, { b: true, s: 26, a: 'center', sh: true }); }
  const size = portrait ? 27 : 28, shown = l.text.slice(0, dlShown()), full = wrap(l.text, bw - 80, size, false), lines = wrap(shown, bw - 80, size, false);
  const off = narr ? Math.max(0, (bh - 60 - full.length * 40) / 2) : 0;
  lines.forEach((s, i) => txt(s, narr ? W / 2 : bx + 40, by + (narr ? 60 : 78) + off + i * 40, { s: size, a: narr ? 'center' : 'left', c: narr ? '#ffd9a0' : '#fff' }));
  if (dlShown() >= l.text.length && Math.sin(nowMs() / 180) > -0.2) txt('▼', bx + bw - 40, by + bh - 24, { b: true, s: 22, a: 'center', c: '#ffe27a' });
  txt((DL.i + 1) + '/' + DL.lines.length, bx + bw - 14, by + 22, { s: 14, a: 'right', c: 'rgba(255,255,255,.45)' });
  addHit(0, 0, W, H, dlAdvance); button('건너뛰기', W - 178, 8, 116, 40, dlSkip, { s: 17 });
}

// ---------- 전투 시작 ----------
SETS.C = () => { const a = SETS.F(), b = SETS.M(); return { K: a.K.concat(b.K), M: a.M.concat(b.M) }; };
function beginStage() {
  const { side, ch, no, sel } = PS, e = epData(ch, no), id = epId(ch, no);
  const go2 = () => launch(side, ch, no, sel);
  if (!SV.seen[id + 'b']) { SV.seen[id + 'b'] = 1; saveNow(); playDialogue(e.before, go2); } else go2();
}
function launch(side0, ch, no, sel) {
  const P = params(ch, no), c = tier(ch); Object.assign(ST, P.st);
  picks = sel.map(r => Object.assign({}, r, { gm: gmFor(r, c) })); side = side0 === 'C' ? 'C' : side0;
  curStage = { side: side0, ch, no, sel, P, bannerT: 0 }; paused = false; res = null; timeUp = false; fireHeld = false;
  scene = 'battle'; MODAL = null; startGame();
}
function backToStages(adv) { curStage = null; res = null; paused = false; over = false; if (adv && SG.side !== 'C' && SG.ci < 4 && chOpen(SG.side, SG.ci + 1)) { SG.ci++; SV.last.ch[SG.side] = SG.ci; } openStages(SG.side, SG.ci); }

// ---------- 전투 결과 ----------
function starsFor(frac) { return frac >= STAR_T[0] ? 3 : frac >= STAR_T[1] ? 2 : 1; }
function onBattleEnd() {
  const cs = curStage; if (!cs) return;
  if (won) {
    const remain = Math.max(0, ST.limit - t), frac = remain / ST.limit, sv = starsFor(frac), id = epId(cs.ch, cs.no), before = SV.clr[id] || 0;
    SV.clr[id] = Math.max(before, sv); res = { won: true, stars: sv, remain, first: !before, t0: nowMs() };
    const e = epData(cs.ch, cs.no); res.line = e.stars && e.stars[String(sv)] || null; saveNow();
  } else res = { won: false, why: timeUp ? '시간 초과' : '전멸', t0: nowMs() };
}
function drawResult() {
  if (!res) return; const cs = curStage, el = nowMs() - res.t0, w = Math.min(W - 40, 640), h = res.won ? (portrait ? 560 : 500) : 330, x = (W - w) / 2, y = (H - h) / 2;
  g.fillStyle = 'rgba(0,0,0,' + clamp(el / 300, 0, 0.72) + ')'; g.fillRect(0, 0, W, H); if (el < 200) return;
  panel(x, y, w, h, { fill: 'rgba(14,10,18,.95)', e1: res.won ? '#ffd24a' : '#a86a6a' });
  txt(res.won ? 'STAGE CLEAR' : '임무 실패', x + w / 2, y + 66, { b: true, s: 46, a: 'center', c: res.won ? '#ffe27a' : '#ff9a8a', sh: true });
  txt(chNo(cs.ch) + '-' + cs.no + ' · ' + epData(cs.ch, cs.no).title, x + w / 2, y + 100, { s: 20, a: 'center', c: '#cbb890' });
  if (res.won) {
    for (let i = 0; i < 3; i++) { const on = i < res.stars, sh = el - 450 - i * 380, pop = on ? (sh < 0 ? 0 : sh < 220 ? 0.4 + sh / 220 * 0.9 : 1.3 - Math.min(0.3, (sh - 220) / 600)) : 1; star(x + w / 2 + (i - 1) * 84, y + 175, 36, on && sh >= 0, on ? Math.max(0.01, pop) : 1); }
    txt('처치 ' + score + '/' + ST.goal + ' · 남은 시간 ' + mmss(res.remain), x + w / 2, y + 250, { b: true, s: 22, a: 'center' });
    if (res.first) txt('첫 클리어!', x + w / 2, y + 282, { b: true, s: 18, a: 'center', c: '#9fe6a8' });
    if (res.line && el > 450 + 3 * 380) { const lh = wrap(res.line.text, w - 80, 21, false); panel(x + 26, y + 300, w - 52, 28 + lh.length * 30 + 28, { fill: 'rgba(40,24,30,.8)', gem: false, lw: 2 }); txt(res.line.who, x + 46, y + 328, { b: true, s: 18, c: '#ffe27a' }); lh.forEach((s, i) => txt(s, x + 46, y + 358 + i * 30, { s: 21 })); }
    if (el > 450 + 3 * 380) button('계속', x + w / 2 - 110, y + h - 74, 220, 58, () => afterWin(), { red: true, s: 26 });
  } else {
    txt('처치 ' + score + '/' + ST.goal + ' · ' + res.why, x + w / 2, y + 160, { b: true, s: 24, a: 'center' });
    button('재도전', x + w / 2 - 230, y + h - 84, 210, 58, () => launch(cs.side, cs.ch, cs.no, cs.sel), { red: true, s: 24 });
    button('철수', x + w / 2 + 20, y + h - 84, 210, 58, backToStages, { s: 24 });
  }
}
function afterWin() {
  const cs = curStage, e = epData(cs.ch, cs.no), id = epId(cs.ch, cs.no), stars = res ? res.stars : 1, fin = () => { startRewards(cs, stars, () => backToStages(cs.no === 10)); };
  curStage = Object.assign({}, cs); over = false; menu = true;
  if (!SV.seen[id + 'a']) { SV.seen[id + 'a'] = 1; saveNow(); playDialogue(e.after, fin); } else fin();
}

// ---------- 전투 HUD / 일시정지 ----------
function drawHud() {
  const cs = curStage; if (!cs || over || menu) return;
  const rem = Math.max(0, ST.limit - t), frac = rem / ST.limit, bw = 190, bx = W - bw - 62, by = 58;
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(bx, by, bw, 34); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.strokeRect(bx, by, bw, 34);
  const col = frac >= STAR_T[0] ? '#ffd24a' : frac >= STAR_T[1] ? '#d8e0ff' : '#ff7a6a';
  g.fillStyle = col; g.globalAlpha = 0.35; g.fillRect(bx + 2, by + 2, (bw - 4) * frac, 30); g.globalAlpha = 1;
  for (const th of STAR_T) { g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(bx + 2 + (bw - 4) * th, by + 2, 2, 30); }
  txt(mmss(rem), bx + 12, by + 25, { b: true, s: 22, c: col }); txt('★'.repeat(starsFor(frac)), bx + bw - 10, by + 25, { b: true, s: 18, a: 'right', c: '#ffd24a' });
  const pb = { x: W - 54, y: 58, w: 46, h: 34 }; g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(pb.x, pb.y, pb.w, pb.h); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; g.strokeRect(pb.x, pb.y, pb.w, pb.h);
  g.fillStyle = '#fff'; g.fillRect(pb.x + 15, pb.y + 8, 5, 18); g.fillRect(pb.x + 26, pb.y + 8, 5, 18); addHit(pb.x, pb.y, pb.w, pb.h, () => { paused = true; fireHeld = false; });
  if (t < 150 && !paused) { g.save(); g.globalAlpha = clamp(Math.min(t / 20, (150 - t) / 40), 0, 1); const lb = chNo(cs.ch) + '-' + cs.no + '  ' + epData(cs.ch, cs.no).title; txt(cs.P.boss ? 'BOSS STAGE' : 'STAGE', W / 2, H * 0.3 - 40, { b: true, s: 22, a: 'center', c: cs.P.boss ? '#ff9a8a' : '#cbb890', sh: true }); txt(lb, W / 2, H * 0.3, { b: true, s: portrait ? 34 : 42, a: 'center', c: '#fff', sh: true }); g.restore(); }
  if (paused) {
    HIT.length = 0; addHit(0, 0, W, H, () => {}); g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(0, 0, W, H); const w = 420, h = 300, x = (W - w) / 2, y = (H - h) / 2; panel(x, y, w, h);
    txt('일시정지', x + w / 2, y + 66, { b: true, s: 38, a: 'center', c: '#ffe9b0', sh: true });
    button('계속', x + w / 2 - 110, y + 100, 220, 60, () => { paused = false; }, { red: true, s: 26 });
    button('포기하고 나가기', x + w / 2 - 110, y + 180, 220, 60, () => { MODAL = { kind: 'confirm', title: '포기할까요?', msg: '이번 전투 진행이 사라집니다.', yes: backToStages }; }, { s: 20 });
  }
}

// ---------- 모달 ----------
function drawModal() {
  const m = MODAL; HIT.length = 0; addHit(0, 0, W, H, () => {});
  if (m.kind === 'brief') { drawBrief(); return; }
  g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(0, 0, W, H); const w = Math.min(W - 40, 480), h = 250, x = (W - w) / 2, y = (H - h) / 2; panel(x, y, w, h);
  txt(m.title, x + w / 2, y + 60, { b: true, s: 28, a: 'center', c: '#ffe9b0', sh: true });
  wrap(m.msg || '', w - 60, 20).forEach((s, i) => txt(s, x + w / 2, y + 100 + i * 28, { s: 20, a: 'center', c: '#e8d8b0' }));
  button('확인', x + w - 190, y + h - 78, 160, 54, () => { const f = m.yes; MODAL = null; f && f(); }, { red: true, s: 22 }); button('취소', x + 30, y + h - 78, 140, 54, () => { MODAL = null; }, { s: 20 });
}

// ================= 장비 · 보상 카드 · 인벤토리 (B단계) =================
const RARN = ['일반', '레어', '신화', '전설'], RARC = ['#c8c8c8', '#5ab0ff', '#c870ff', '#ffb030'], PARTS_GET = [1, 3, 8, 20];
const LVF = [1, 1.35, 1.8, 2.4, 3.2, 4.2];                       // 장(tier)별 옵션 수치 배율 (가안)
const OPT_KEY = { atk: 'atk', aim: 'aim', eva: 'eva', def: 'def', auto: 'auto', reload: 'rel', mag: 'mag', crit: 'crit', heal: 'heal', cover: 'cov' };
const OPT_ICON = { atk: 'badge_atk', aim: 'ic_aim', eva: 'badge_eva', def: 'ic_shield', auto: 'ic_lock', reload: 'badge_rel', mag: 'ic_mag', crit: 'badge_flame', heal: 'badge_heal', cover: 'badge_hand' };
const OPT_CAP = { eva: 0.6, def: 0.6, rel: 0.6, aim: 0.85 };
let ITEMS = { options: [], bases: [] }, BLANKS = [];
const FALLBACK_OPTS = [['atk', '공격력', 5, 25], ['aim', '조준', 5, 20], ['eva', '회피', 3, 15], ['def', '방어', 3, 15], ['auto', '자동조준', 5, 20], ['reload', '장전', 5, 25], ['mag', '탄창', 10, 30], ['crit', '치명타', 3, 15], ['heal', '회복력', 5, 25], ['cover', '엄폐물 내구', 10, 40]].map(a => ({ id: a[0], name: a[1], min: a[2], max: a[3] }));
const FALLBACK_BASES = ['쫀득 채찍', '방울 재갈', '핑크 패들', '마도 족쇄', '하트 초커', '훈도시 장갑복', '페로몬 연막탄', '증기 가죽끈'].map((n, i) => ({ id: 'tmp' + i, name: n, flavor: '' }));   // 임시 — G2 완료 시 items.json이 대체
function loadItems() {
  fetch(new URL('../data/items.json', location.href)).then(r => r.json()).then(j => { ITEMS = j; }).catch(() => {});
  fetch(new URL('../data/blank_cards.json', location.href)).then(r => r.json()).then(j => { BLANKS = Array.isArray(j) ? j : []; }).catch(() => {});
}
loadItems();
const optDefs = () => (ITEMS.options && ITEMS.options.length ? ITEMS.options : FALLBACK_OPTS);
const optName = id => { const o = optDefs().find(x => x.id === id); return o ? o.name : id; };
const baseList = () => (ITEMS.bases && ITEMS.bases.length ? ITEMS.bases : FALLBACK_BASES);
function rollVals(opts, lv) { return opts.map(o => { const d = optDefs().find(x => x.id === o.k) || { min: 5, max: 20 }; return { k: o.k, v: Math.round((d.min + (d.max - d.min) * Math.random()) * LVF[clamp(lv - 1, 0, 5)] * 10) / 10 }; }); }
function rollGear(tierN, boss) {
  const w = boss ? [28, 38, 25, 9] : [60, 28, 10, 2]; let r = Math.random() * 100, rar = 1; for (let i = 0; i < 4; i++) { r -= w[i]; if (r < 0) { rar = i + 1; break; } if (i === 3) rar = 4; }
  const ids = optDefs().map(o => o.id).sort(() => Math.random() - 0.5).slice(0, rar), base = baseList()[Math.floor(Math.random() * baseList().length)], lv = tierN + 1;
  return { id: SV.nid++, base: base.name, flavor: base.flavor || '', rar, lv, opts: rollVals(ids.map(k => ({ k })), lv) };
}
const gearById = id => SV.gear.find(x => x.id === id);
const gearOwner = gid => { for (const k in SV.eq) if (SV.eq[k] === gid) return k; return null; };
const heroByKey = k => ROSTER.F.concat(ROSTER.M).find(r => r.k === k);
function sumMods(key) {
  const m = { atk: 0, aim: 0, eva: 0, def: 0, auto: 0, rel: 0, mag: 0, crit: 0, heal: 0, cov: 0 }, g0 = gearById(SV.eq[key]);
  if (g0) for (const o of g0.opts) m[OPT_KEY[o.k]] += o.v / 100;
  for (const k in OPT_CAP) m[k] = Math.min(OPT_CAP[k], m[k]); return m;
}
function gmFor(r, c) { const m = sumMods(r.k); m.atk = (1 + m.atk) * Math.pow(DIFF.heroDmg, c) - 1; return m; }
const optLine = o => optName(o.k) + ' +' + (Math.round(o.v * 10) / 10) + '%';
const gearIconKey = g0 => OPT_ICON[g0.opts[0].k] || 'badge_gear';
function gearIcon(g0, cx, cy, sz) { g.save(); g.fillStyle = RARC[g0.rar - 1]; g.globalAlpha = 0.28; g.beginPath(); g.arc(cx, cy, sz * 0.52, 0, 7); g.fill(); g.globalAlpha = 1; g.restore(); sprFit(gearIconKey(g0), cx, cy, sz); }
function equip(gid, key) { for (const k in SV.eq) if (SV.eq[k] === gid) delete SV.eq[k]; if (key) SV.eq[key] = gid; saveNow(); }
function dismantle(gid) { const g0 = gearById(gid); if (!g0) return 0; equip(gid, null); SV.gear = SV.gear.filter(x => x.id !== gid); const p = PARTS_GET[g0.rar - 1]; SV.parts += p; saveNow(); return p; }
const rerollCost = g0 => 3 * g0.rar;
function reroll(gid) { const g0 = gearById(gid); if (!g0) return; const c = rerollCost(g0); if (SV.parts < c) { toast('부품이 부족합니다 (' + c + ' 필요)'); return; } SV.parts -= c; g0.opts = rollVals(g0.opts, g0.lv); saveNow(); toast('옵션 수치를 다시 굴렸습니다'); }

// ---------- 보상 카드 ----------
let RW = null;
function startRewards(cs, stars, then) {
  const n = [0, 2, 4, 6][stars], pick = [0, 1, 2, 3][stars], tN = tier(cs.ch), cards = [];
  for (let i = 0; i < n / 2; i++) cards.push({ kind: 'gear', gear: rollGear(tN, cs.P.boss) });
  for (let i = 0; i < n / 2; i++) { const b = BLANKS.length ? BLANKS[Math.floor(Math.random() * BLANKS.length)] : { title: '꽝', caption: '다음 기회에.', parts: 1 }; cards.push({ kind: 'blank', blank: b }); }
  cards.sort(() => Math.random() - 0.5); RW = { cards, pick, left: pick, then, doneT: 0, label: chNo(cs.ch) + '-' + cs.no }; go('cards');
}
function cardGeo() {
  const n = RW.cards.length, cols = n >= 6 ? 3 : (portrait ? 2 : n), rows = Math.ceil(n / cols), top = 120, bot = 110, gap = 16;
  const cw = Math.min(230, (W - 40 - (cols - 1) * gap) / cols), ch = Math.min(cw * 1.5, (H - top - bot - (rows - 1) * gap) / rows), tw = cols * cw + (cols - 1) * gap, th = rows * ch + (rows - 1) * gap, x0 = (W - tw) / 2, y0 = top + (H - top - bot - th) / 2;
  return RW.cards.map((c, i) => ({ c, x: x0 + (i % cols) * (cw + gap), y: y0 + Math.floor(i / cols) * (ch + gap), w: cw, h: ch }));
}
function cardFront(c, x, y, w, h, dimmed) {
  const big = w > 150;
  if (c.kind === 'gear') {
    const g0 = c.gear, col = RARC[g0.rar - 1]; panel(x, y, w, h, { fill: 'rgba(18,12,22,.96)', e1: col, e2: col, lw: 4 });
    gearIcon(g0, x + w / 2, y + h * 0.17, w * 0.3); txt(RARN[g0.rar - 1], x + w / 2, y + h * 0.38, { b: true, s: big ? 18 : 14, a: 'center', c: col });
    wrap(g0.base, w - 20, big ? 21 : 16, true).slice(0, 2).forEach((l, i) => txt(l, x + w / 2, y + h * 0.48 + i * (big ? 24 : 19), { b: true, s: big ? 21 : 16, a: 'center' }));
    g0.opts.forEach((o, i) => txt(optLine(o), x + w / 2, y + h * 0.68 + i * (big ? 24 : 19), { s: big ? 18 : 14, a: 'center', c: '#cfe8ff' }));
    txt('Lv.' + g0.lv, x + w / 2, y + h - 12, { s: 14, a: 'center', c: '#cbb890' });
  } else {
    panel(x, y, w, h, { fill: 'rgba(24,20,24,.96)', e1: '#8a7a6a', e2: '#5a4a3a' }); sprFit('ic_warn', x + w / 2, y + h * 0.18, w * 0.28);
    txt('꽝', x + w / 2, y + h * 0.5, { b: true, s: big ? 40 : 28, a: 'center', c: '#bba' });
    wrap(c.blank.title || '', w - 20, 16, true).slice(0, 2).forEach((l, i) => txt(l, x + w / 2, y + h * 0.6 + i * 20, { b: true, s: 16, a: 'center', c: '#ddd' }));
    wrap(c.blank.caption || '', w - 24, 14).slice(0, 3).forEach((l, i) => txt(l, x + w / 2, y + h * 0.74 + i * 18, { s: 14, a: 'center', c: '#aaa' }));
    txt('부품 +' + (c.blank.parts || 1), x + w / 2, y + h - 12, { s: 14, a: 'center', c: '#cbb890' });
  }
  if (dimmed) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x + 3, y + 3, w - 6, h - 6); }
}
function drawCards() {
  coverImg(bg, 0.5, 0.5); dim(0.8); header('보상 카드 · ' + RW.label, null, RW.left > 0 ? '카드 ' + RW.left + '장을 고르세요' : '획득 완료');
  const geo = cardGeo(), now = nowMs();
  geo.forEach(q => {
    const c = q.c, tt = c.t0 ? clamp((now - c.t0) / 420, 0, 1) : 0, face = tt > 0.5 || c.shown; let sx = 1;
    if (c.t0 && tt < 1) sx = Math.abs(Math.cos(tt * Math.PI)); else sx = 1;
    g.save(); g.translate(q.x + q.w / 2, q.y + q.h / 2); g.scale(Math.max(0.02, sx), 1); g.translate(-q.w / 2, -q.h / 2);
    if (face) cardFront(c, 0, 0, q.w, q.h, c.dim); else {
      panel(0, 0, q.w, q.h, { fill: 'rgba(60,14,24,.95)', e1: '#e8b86a', e2: '#8a5a2a', lw: 4 }); sprFit('ic_wings_big', q.w / 2, q.h / 2, q.w * 0.6); txt('?', q.w / 2, q.h * 0.88, { b: true, s: 30, a: 'center', c: '#ffe27a' });
    }
    g.restore();
    if (c.picked && tt >= 1) { sprFit('ok_sm', q.x + q.w - 8, q.y + 8, 34); }
    if (!c.t0 && RW.left > 0) addHit(q.x, q.y, q.w, q.h, () => {
      if (RW.left <= 0 || c.t0) return; c.t0 = nowMs(); c.picked = true; RW.left--;
      if (c.kind === 'gear') SV.gear.push(c.gear); else SV.parts += c.blank.parts || 1; saveNow();
      if (RW.left === 0) { RW.doneT = nowMs() + 900; setTimeout(() => { for (const k of RW.cards) if (!k.t0) { k.t0 = nowMs(); k.dim = true; } }, 700); }
    });
  });
  if (RW.left === 0 && nowMs() > RW.doneT) button('확인', W / 2 - 110, H - 90, 220, 62, () => { const f = RW.then; RW = null; f(); }, { red: true, s: 26 });
  txt('부품 ' + SV.parts, W - 70, 96, { b: true, s: 18, a: 'right', c: '#cbb890' });
}

// ---------- 인벤토리 ----------
let INV = { hero: null, page: 0, sel: null, back: null };
function openInv(back) {
  const pool = ROSTER.F.concat(ROSTER.M).filter(heroAvail); INV = { hero: (INV.hero && pool.find(r => r.k === INV.hero)) ? INV.hero : (pool[0] ? pool[0].k : null), page: 0, sel: null, back: back || (() => go('lines')) }; go('inv');
}
const sortedGear = () => SV.gear.slice().sort((a, b) => b.rar - a.rar || b.lv - a.lv || b.id - a.id);
function statLines(key) { const m = sumMods(key), out = []; for (const o of optDefs()) { const v = m[OPT_KEY[o.id]]; if (v > 0) out.push(o.name + ' +' + Math.round(v * 1000) / 10 + '%'); } return out; }
function drawInv() {
  coverImg(bg, 0.5, 0.5); dim(0.8); header('장비', INV.back); txt('부품 ' + SV.parts, W - 70, 40, { b: true, s: 20, a: 'right', c: '#ffe27a', sh: true });
  const pool = ROSTER.F.concat(ROSTER.M).filter(heroAvail), per = portrait ? 8 : pool.length, rowsN = Math.ceil(pool.length / per), cs = Math.min(76, (W - 40 - (per - 1) * 6) / per), top = 74;
  pool.forEach((r, i) => { const x = 20 + (i % per) * (cs + 6), y = top + Math.floor(i / per) * (cs + 6), on = INV.hero === r.k, eq = SV.eq[r.k];
    g.fillStyle = on ? 'rgba(255,226,122,.25)' : 'rgba(0,0,0,.5)'; g.fillRect(x, y, cs, cs); g.strokeStyle = on ? '#ffe27a' : 'rgba(255,255,255,.25)'; g.lineWidth = on ? 3 : 1.5; g.strokeRect(x, y, cs, cs);
    if (r.face.ok) { const k = Math.max(cs / r.face.naturalWidth, cs / r.face.naturalHeight) * 1.0; g.save(); g.beginPath(); g.rect(x, y, cs, cs); g.clip(); g.drawImage(r.face, x + (cs - r.face.naturalWidth * k) / 2, y, r.face.naturalWidth * k, r.face.naturalHeight * k); g.restore(); }
    if (eq) { const g0 = gearById(eq); if (g0) { g.fillStyle = RARC[g0.rar - 1]; g.fillRect(x, y + cs - 6, cs, 6); } }
    addHit(x, y, cs, cs, () => { INV.hero = r.k; });
  });
  const lt = top + rowsN * (cs + 6) + 6, hero = heroByKey(INV.hero), eqG = gearById(SV.eq[INV.hero]);
  const listW = portrait ? W - 40 : W - 40 - 360, listH = portrait ? 6 * 74 + 100 : H - lt - 14;
  // 가방 목록
  const gs = sortedGear(), rowH = 74, perPage = Math.max(1, Math.floor((listH - 100) / rowH)), pages = Math.max(1, Math.ceil(gs.length / perPage)); INV.page = clamp(INV.page, 0, pages - 1);
  panel(20, lt, listW, listH, { gem: false }); txt('가방 ' + gs.length + '개', 36, lt + 34, { b: true, s: 22, c: '#ffe9b0' });
  if (!gs.length) txt('아직 장비가 없습니다. 스테이지를 클리어하고 카드를 고르세요.', 20 + listW / 2, lt + listH / 2, { s: 20, a: 'center', c: '#9a8a70' });
  gs.slice(INV.page * perPage, INV.page * perPage + perPage).forEach((g0, i) => {
    const x = 32, y = lt + 48 + i * rowH, w = listW - 24, on = INV.sel === g0.id, own = gearOwner(g0.id);
    g.fillStyle = on ? 'rgba(255,226,122,.18)' : 'rgba(255,255,255,.05)'; g.fillRect(x, y, w, rowH - 6); g.strokeStyle = on ? '#ffe27a' : RARC[g0.rar - 1]; g.lineWidth = on ? 3 : 1.5; g.strokeRect(x, y, w, rowH - 6);
    gearIcon(g0, x + 38, y + (rowH - 6) / 2, 52); txt(g0.base, x + 78, y + 28, { b: true, s: 21, c: RARC[g0.rar - 1] }); txt(RARN[g0.rar - 1] + ' · Lv.' + g0.lv, x + w - 12, y + 28, { s: 16, a: 'right', c: '#cbb890' });
    txt(g0.opts.map(optLine).join('  '), x + 78, y + 54, { s: portrait ? 15 : 17, c: '#cfe8ff' });
    if (own) { const h2 = heroByKey(own); txt('착용: ' + (h2 ? h2.n : own), x + w - 12, y + 54, { b: true, s: 15, a: 'right', c: '#9fe6a8' }); }
    addHit(x, y, w, rowH - 6, () => { INV.sel = on ? null : g0.id; });
  });
  if (pages > 1) { button('◀', 20 + listW / 2 - 110, lt + listH - 46, 70, 38, () => { INV.page = Math.max(0, INV.page - 1); }, { s: 18 }); txt((INV.page + 1) + ' / ' + pages, 20 + listW / 2, lt + listH - 20, { b: true, s: 18, a: 'center' }); button('▶', 20 + listW / 2 + 40, lt + listH - 46, 70, 38, () => { INV.page = Math.min(pages - 1, INV.page + 1); }, { s: 18 }); }
  button('일반 일괄 분해', 20 + listW - 190, lt + 6, 176, 36, () => { const n = SV.gear.filter(x => x.rar === 1 && !gearOwner(x.id)).length; if (!n) { toast('분해할 일반 장비가 없습니다'); return; } MODAL = { kind: 'confirm', title: '일반 장비 ' + n + '개를 분해할까요?', msg: '착용 중인 장비는 제외됩니다.', yes: () => { let p = 0; for (const x of SV.gear.slice()) if (x.rar === 1 && !gearOwner(x.id)) p += dismantle(x.id); toast('부품 +' + p); INV.sel = null; } }; }, { s: 15 });
  // 영웅 / 상세 패널
  const px = portrait ? 20 : 20 + listW + 12, pw = portrait ? W - 40 : 348, py = portrait ? lt + listH + 10 : lt, ph = portrait ? H - py - 10 : listH;
  panel(px, py, pw, ph, { gem: false }); if (!hero) return;
  txt(hero.n + ' · ' + CLS[hero.c], px + 16, py + 32, { b: true, s: 22, c: CCOL[hero.c] });
  let yy = py + 58; if (eqG) { gearIcon(eqG, px + 34, yy + 22, 46); txt(eqG.base, px + 66, yy + 18, { b: true, s: 18, c: RARC[eqG.rar - 1] }); txt(eqG.opts.map(optLine).join(' '), px + 66, yy + 40, { s: 13, c: '#cfe8ff' }); button('해제', px + pw - 86, yy, 70, 38, () => { equip(eqG.id, null); }, { s: 16 }); } else txt('착용 장비 없음', px + 16, yy + 28, { s: 18, c: '#9a8a70' });
  yy += 62; const sl = statLines(INV.hero); txt('합계(장비)', px + 16, yy, { s: 15, c: '#cbb890' }); (sl.length ? sl : ['—']).forEach((s, i) => txt(s, px + 16 + (portrait ? (i % 3) * (pw / 3) : 0), yy + 24 + (portrait ? Math.floor(i / 3) * 22 : i * 22), { s: 16, c: '#e8f0ff' }));
  const sg = gearById(INV.sel); if (sg) {
    const by = py + ph - 156; g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(px + 12, by - 8, pw - 24, 1); txt(sg.base, px + 16, by + 16, { b: true, s: 18, c: RARC[sg.rar - 1] }); if (sg.flavor) wrap(sg.flavor, pw - 32, 14).slice(0, 2).forEach((l, i) => txt(l, px + 16, by + 38 + i * 18, { s: 14, c: '#bbb' }));
    const bw = (pw - 44) / 3; button('장착', px + 12, by + 70, bw, 50, () => { equip(sg.id, INV.hero); toast(hero.n + '에게 장착'); }, { red: true, s: 18 });
    button('분해', px + 22 + bw, by + 70, bw, 50, () => { MODAL = { kind: 'confirm', title: '분해할까요?', msg: sg.base + ' → 부품 +' + PARTS_GET[sg.rar - 1], yes: () => { const p = dismantle(sg.id); INV.sel = null; toast('부품 +' + p); } }; }, { s: 18 });
    button('재설정', px + 32 + bw * 2, by + 70, bw, 50, () => { MODAL = { kind: 'confirm', title: '옵션 재설정', msg: '부품 ' + rerollCost(sg) + '개를 써서 수치를 다시 굴립니다.', yes: () => reroll(sg.id) }; }, { s: 16 });
  } else txt('목록에서 장비를 눌러 선택하세요', px + pw / 2, py + ph - 40, { s: 16, a: 'center', c: '#9a8a70' });
}


// ================= 조준선 / 조준경 렌즈 (PNG: docs/reticle_index.png 번호로 교체 가능) =================
const RET = { idle: 3, scope: 3 }; ui('ret' + String(RET.idle).padStart(2, '0')); ui('ret' + String(RET.scope).padStart(2, '0'));
const TINT = {};
function tinted(n, col) {
  const k = n + col; if (TINT[k]) return TINT[k]; const im = ui(n); if (!im.ok) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d');
  x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return (TINT[k] = c);
}
function retDraw(n, col, cx, cy, size, a) { const c = tinted('ret' + String(n).padStart(2, '0'), col); if (!c || a <= 0.01) return; g.save(); g.globalAlpha = a; g.drawImage(c, cx - size / 2, cy - size / 2, size, size * c.height / c.width); g.restore(); }
drawReticle = function (vx, vy, ringR) {
  const k = clamp(scope * 1.6, 0, 1), used = cross.used > 0;
  retDraw(RET.idle, used ? '#ff4a4a' : '#ff9a9a', vx, vy, 92, (1 - k) * (used ? 1 : 0.7));
  if (k > 0.01) {
    retDraw(RET.scope, '#ffffff', vx, vy, ringR * 2 * 1.02, k);
    g.save(); g.globalAlpha = k * 0.85; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath();
    const a0 = ringR * 0.12, a1 = ringR * 0.86; g.moveTo(vx - a1, vy); g.lineTo(vx - a0, vy); g.moveTo(vx + a0, vy); g.lineTo(vx + a1, vy); g.moveTo(vx, vy - a1); g.lineTo(vx, vy - a0); g.moveTo(vx, vy + a0); g.lineTo(vx, vy + a1); g.stroke();
    g.fillStyle = '#ff4a4a'; g.beginPath(); g.arc(vx, vy, 3, 0, 7); g.fill(); g.restore();
  }
};
lensFx = function (vx, vy, ringR) {
  if (scope < 0.03) return; g.save(); g.globalAlpha = clamp(scope * 1.3, 0, 1);
  const gr = g.createRadialGradient(vx, vy, ringR * 0.55, vx, vy, ringR); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.5)');
  g.fillStyle = gr; g.beginPath(); g.arc(vx, vy, ringR, 0, 7); g.fill();
  g.lineWidth = 9; g.strokeStyle = 'rgba(12,9,14,.9)'; g.beginPath(); g.arc(vx, vy, ringR + 4, 0, 7); g.stroke();
  g.lineWidth = 2; g.strokeStyle = '#c89a5a'; g.beginPath(); g.arc(vx, vy, ringR + 0.5, 0, 7); g.stroke(); g.restore();
};

// ================= 코어 연결 =================
function sceneDraw() {
  switch (scene) {
    case 'title': drawTitle(); break; case 'lines': drawLines(); break; case 'stages': drawStages(); break;
    case 'party': drawParty(); break; case 'dialogue': drawDialogue(); break; case 'cards': drawCards(); break; case 'inv': drawInv(); break; default: drawTitle();
  }
  if (MODAL) drawModal(); drawToast();
}
drawMenu = function () { sceneDraw(); };
menuTap = function (p) { for (let i = HIT.length - 1; i >= 0; i--) { const h = HIT[i]; if (inb(p, h)) { sfx('switch'); h.fn(); return; } } };
drawOver = function () { drawResult(); if (MODAL) drawModal(); drawToast(); };
onOverTap = function (p) { menuTap(p); };
onBattleTap = function (p) { if (paused || MODAL) { menuTap(p); return true; } for (let i = HIT.length - 1; i >= 0; i--) if (inb(p, HIT[i])) { HIT[i].fn(); return true; } return false; };
const _update = update, _draw = draw;
update = function () {
  if (menu || paused) return; const was = over; _update();
  if (!over && ST.limit && t >= ST.limit) { over = true; won = false; timeUp = true; sfx('over'); vib([100, 60, 200]); }
  if (over && !was) onBattleEnd();
};
draw = function () {
  HIT.length = 0; _draw(); if (!menu && !over) { drawHud(); if (MODAL) drawModal(); drawToast(); }
};
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (menu && scene === 'dialogue' && (k === 'enter' || k === ' ')) { dlAdvance(); e.preventDefault(); }
  if (!menu && !over && (k === 'p' || k === 'escape')) { paused = !paused; fireHeld = false; }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && !menu && !over && curStage) { paused = true; fireHeld = false; } });
window.GW = { get SV() { return SV; }, save: saveNow, go, openLines, openStages, params, DIFF, STAR_T, DATA, epData, get scene() { return scene; }, get res() { return res; }, get paused() { return paused; }, rollGear, openInv, equip, sumMods, get RW() { return RW; },
  win(n) { won = true; over = true; t = Math.round(ST.limit * (n === 3 ? 0.3 : n === 2 ? 0.6 : 0.9)); onBattleEnd(); }, DEV };
})();
