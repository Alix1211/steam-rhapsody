
/* meta.js — 캠페인 · 장면 · 저장 · 대사 · 별 판정   [Claude 전담 — GPT는 수정 금지, 요청은 inbox/for_claude.md]
   전투 엔진은 index.html. 이 파일은 index.html 뒤에 로드되어 빈 껍데기 함수(drawMenu, menuTap, onOverTap, onBattleTap, drawOver)를 덮어쓰고
   update/draw를 감싼다. 숫자 값(난이도·시간·별 기준)은 모두 가안이며 아래 DIFF / STAR_T / HERO_UNLOCK 에 모여 있다. */
(function () {
'use strict';
const FONT = 'sans-serif';
const nowMs = () => performance.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ================= 가안 값 (한 곳에 모음) =================
const DIFF = { hpMul: 1.64, atkMul: 1.39, heroHp: 1.2, heroDmg: 1.3, cover: 1.25, ecover: 1.3 };   // 장(章)마다 곱해지는 배율
const STAR_T = [0.5, 0.25];            // 남은 시간 비율: ≥50% ★3, ≥25% ★2, 그 외 클리어 ★1
const HERO_UNLOCK = { human: null, dwarf: null, elf: null, fmedic: null,
                      mmedic: 'F1-5', mhuman: 'F1-7', mwolf: 'F3-4', morc: 'F4-5',
                      mdwarf: null, mlizard: null, mgoblin: null, melf: 'M5-7',
                      fox: 'M1-5', goblin: 'M1-7', harpy: 'M3-4', lamia: 'M4-5' }; // 기본 영웅은 즉시, 포로는 해당 스테이지 클리어 후 해금
const LINES = {
  F: { id: 'F', name: '여존 연방 도미나리아', short: '여존 연방', col: '#b0243a', hi: '#f0c860', chs: ['F1', 'F2', 'F3', 'F4', 'F5'], foe: '남존 제국군' },
  M: { id: 'M', name: '남존 제국 발할리온', short: '남존 제국', col: '#2a3f78', hi: '#7fb2ff', chs: ['M1', 'M2', 'M3', 'M4', 'M5'], foe: '여존 연방군' },
  C: { id: 'C', name: '마계', short: '마계', col: '#5a2a6a', hi: '#d9a8ff', chs: ['C11'], foe: '마계 병사' } };
const chNo = ch => parseInt(ch.slice(1), 10);
const tier = ch => { const n = chNo(ch); return n >= 11 ? 5 : n - 1; };       // 0~5 (11장 = 5)
function params(ch, no) {
  const c = tier(ch), boss = no === 10, f = 1 + 0.07 * (no - 1), E = c === 0 ? 1 : 1.05;   // E: 초반(1·6장 첫 줄기) 보정 — 가안
  const goal = Math.round((14 + no * 1.2 + c * 0.8) * 2.2);   // 스테이지 길이 2배 이상 (가안)
  const lim = Math.round(80 + goal * 3.4 + (boss ? 40 : 0)) * 60;
  return { boss, goal, st: {
    ehp: Math.round(60 * Math.pow(DIFF.hpMul, c) * f),   // 40→60: 조준 판정 도입 후 아군이 먼저 다 잡아 버려 1.5배 (케인)
    edmg: +(6 * E * Math.pow(DIFF.atkMul, c) * (1 + 0.04 * (no - 1))).toFixed(1),
    goal, limit: lim, boss, bossHp: 6, maxAlive: 5 + (no >= 4 ? 1 : 0) + (no >= 8 ? 1 : 0) + (c >= 3 ? 1 : 0),
    spB: Math.max(60, 86 - no * 2 - c * 2), spMin: Math.max(36, 54 - no - c * 2), eliteP: Math.min(0.45, 0.08 + 0.03 * no + 0.03 * c),
    fMin: Math.max(50, Math.round((100 - c * 4 - no) * (c === 0 ? 1 : 0.95))), fVar: c === 0 ? 70 : 60, mechHp: 4, mechDm: 0.7, droneHp: 0.3, droneDm: 0.5, droneP: 0.55,
    cvHp: Math.round(176 * Math.pow(DIFF.cover, c)), ecv: Math.round(30 * Math.pow(DIFF.ecover, c)), bombCv: Math.round(250 * Math.pow(DIFF.ecover, c)),
    bombDmg: Math.round(140 * Math.pow(DIFF.heroDmg, c)), hhp: Math.round(132 * Math.pow(DIFF.heroHp, c)), heal: +(6 * Math.pow(DIFF.heroHp, c)).toFixed(1) } };
}
const mmss = fr => { const s = Math.max(0, Math.ceil(fr / 60)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// ================= 저장 =================
const SAVE_KEY = 'gw_save_v1';
const defSave = () => ({ v: 1, clr: {}, seen: {}, party: {}, opt: { dev: false }, gear: [], eq: {}, parts: 0, nid: 1, heroXP: {}, corrupt: {}, rampage: {}, purifyDialogue: {}, last: { side: 'F', ch: {} } });
let SV = defSave();
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); if (s) { const o = JSON.parse(s); SV = Object.assign(defSave(), o); SV.opt = Object.assign({ dev: false }, o.opt); } } catch (e) {} }
function saveNow() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SV)); } catch (e) {} }
loadSave();

// ================= 영웅 공통 육성 (오펜스에서도 동일 영웅키·총 경험치 참조) =================
// 레벨 1~99, 공격력·HP 1.5% 복리. 다음 레벨 경험치: 300+60*(현재 레벨-1).
// Lv99 누적 314,580XP = 기준 경험치 100/분으로 약 52.43시간.
const LV_CAP=99, LV_GROWTH=1.015, XP_PER_MIN=100;
const LV_THRESH=[0];
for(let lv=1;lv<LV_CAP;lv++)LV_THRESH.push(LV_THRESH[lv-1]+300+60*(lv-1));
const LV_MAX_XP=LV_THRESH[LV_CAP-1];
const HERO_KEYS=new Set(ROSTER.F.concat(ROSTER.M).map(r=>r.k));
const totalHeroXP=key=>Math.min(LV_MAX_XP,Math.max(0,Math.floor(Number(SV.heroXP?.[key]||0)||0)));
function heroLevel(key){
 const xp=totalHeroXP(key);let lo=0,hi=LV_THRESH.length-1;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(LV_THRESH[mid]<=xp)lo=mid;else hi=mid-1;}
 return lo+1;
}
const levelMultiplier=key=>Math.pow(LV_GROWTH,heroLevel(key)-1);
function stageRecommendedLevel(ch,no){return Math.min(LV_CAP,1+Math.round((tier(ch)*10+Math.max(1,no)-1)*1.6));}
function grantHeroXP(keys,amount){
 const gain=Math.max(0,Math.floor(Number(amount)||0)),out=[],used=new Set();
 for(const key of (Array.isArray(keys)?keys:[keys])){
  if(!HERO_KEYS.has(key)||used.has(key))continue;used.add(key);
  const before=heroLevel(key),xp=totalHeroXP(key),next=Math.min(LV_MAX_XP,xp+gain);
  SV.heroXP=SV.heroXP||{};SV.heroXP[key]=next;
  out.push({key,gained:next-xp,before,after:heroLevel(key)});
 }
 if(out.length)saveNow();return out;
}
function earnBattleXP(cs,victory,kills){
 const list=cs.sel.map(r=>r.k),avg=list.reduce((sum,key)=>sum+heroLevel(key),0)/Math.max(1,list.length);
 const recommended=stageRecommendedLevel(cs.ch,cs.no);
 // 제한시간(프레임→분)을 XP로 환산. 실시간 경과시간에 비례하지 않아 고의 지연 이득 방지.
 const base=Math.round((cs.P.st.limit/3600)*XP_PER_MIN);
 const tierFactor=clamp(1+0.012*(recommended-avg),0.45,1.20);
 const completion=victory?1:Math.min(0.25,0.25*Math.min(1,Math.max(0,kills)/Math.max(1,cs.P.goal)));
 const amount=Math.round(base*tierFactor*completion);
 const awards=grantHeroXP(list,amount);
 return {amount,awards,recommended};
}
function levelCircle(cx,cy,n,r){
 g.save();g.shadowColor='rgba(0,0,0,.82)';g.shadowBlur=7;g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.fillStyle='rgba(19,18,22,.96)';g.fill();
 g.shadowBlur=0;g.lineWidth=2;g.strokeStyle='#e8d3a1';g.stroke();
 g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';g.font='800 '+Math.max(10,Math.floor(r*.91))+'px sans-serif';g.fillText(String(n),cx,cy+1);g.restore();
}

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
const heroAvail = r => DEV() || !HERO_UNLOCK[r.k] || !!SV.clr[HERO_UNLOCK[r.k]];
const poolOf = side => side === 'C' ? ROSTER.F.concat(ROSTER.M) : ROSTER[side];
function lineStats(side) { let n = 0, s = 0, tot = 0; for (const ch of LINES[side].chs) for (let no = 1; no <= 10; no++) { tot++; const v = starsOf(ch, no); if (v) { n++; s += v; } } return { n, s, tot }; }
const hasProgress = () => Object.keys(SV.clr).length > 0;

// ================= 대사 데이터 =================
const DATA = {}; let REACT = null;
function loadData() {
  // index.html이 meta.js보다 먼저 불러온 대사 번들을 최우선 사용한다.
  // 127.0.0.1 서버, GitHub Pages, file:// 모두 동일하게 동작.
  const all = window.GW_DIALOGUE_DATA;
  if (all && LINES.F.chs.concat(LINES.M.chs, LINES.C.chs)
                .every(ch => all[ch] && Array.isArray(all[ch].episodes))) {
    for (const ch of LINES.F.chs.concat(LINES.M.chs, LINES.C.chs)) DATA[ch] = all[ch];
    REACT = all.C11_reactions || null;
    return;
  }
  // 예전 빌드(번들 누락)는 JSON을 비동기로 시도한다.
  const scriptBase = new URL('meta.js', document.baseURI);
  const loadJSON = path => fetch(new URL(path, scriptBase)).then(r => {
    if (!r.ok) throw Error('dialogue HTTP ' + r.status);
    return r.json();
  });
  for (const ch of LINES.F.chs.concat(LINES.M.chs, LINES.C.chs))
    loadJSON('../data/dialogue/' + ch + '.json').then(j => { DATA[ch] = j; }).catch(() => { DATA[ch] = null; });
  loadJSON('../data/dialogue/C11_reactions.json').then(j => { REACT = j; }).catch(() => {});
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
function stretchUi(n, x, y, w, h, alpha) {
  const i = ui(n); if (!i.ok) return false;
  g.save(); if (alpha !== undefined) g.globalAlpha = alpha; g.drawImage(i, x, y, w, h); g.restore(); return true;
}
function panel(x, y, w, h, o) {
  o = o || {};
  const nm = o.kind || ((h > w * 0.82 && h > 220) ? 'goth_panel_tall' : 'goth_panel_big');
  if (w >= 150 && h >= 110 && stretchUi(nm, x, y, w, h, o.alpha)) return;
  g.save(); rr(x, y, w, h, 8); g.fillStyle = o.fill || 'rgba(16,11,18,.9)'; g.fill();
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
function fitWrap(s, maxW, maxS, minS, bold, maxLines) {
  maxLines = maxLines || 1; minS = minS || 12;
  for (let size = maxS; size >= minS; size--) {
    const lines = wrap(s, maxW, size, bold);
    if (lines.length <= maxLines) return { size, lines };
  }
  const size = minS;
  return { size, lines: wrap(s, maxW, size, bold).slice(0, maxLines) };
}
function drawFaceCrop(im, x, y, w, h, o) {
  if (!im || !im.ok) return; o = o || {};
  const sc = Math.max(w / im.naturalWidth, h / im.naturalHeight) * (o.scale || 1);
  const dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
  const ax = o.ax === undefined ? 0.5 : o.ax, ay = o.ay === undefined ? 0.1 : o.ay;
  const dx = x + (w - dw) * ax + (o.dx || 0), dy = y + (h - dh) * ay + (o.dy || 0);
  g.save();
  if (o.clip !== false) { rr(x, y, w, h, o.rad || 0); g.clip(); }
  if (o.gray) g.filter = o.gray;
  g.drawImage(im, dx, dy, dw, dh);
  g.filter = 'none';
  g.restore();
}
const HIT = [];
function addHit(x, y, w, h, fn) { HIT.push({ x, y, w, h, fn }); }
function fitBlock(label, w, h, maxS, minS, bold, maxLines) {
  const limit=Math.max(1,Math.floor((h-5)/(Math.max(10,minS)+3)));
  maxLines=Math.min(maxLines||2,Math.max(1,limit));
  for(let sz=Math.floor(maxS);sz>=minS;sz--){
    const lines=wrap(String(label),Math.max(20,w),sz,!!bold);
    if(lines.length<=maxLines && lines.length*(sz+3)<=h-1)return {size:sz,lines};
  }
  const sz=Math.max(10,minS),ls=wrap(String(label),Math.max(20,w),sz,!!bold);
  // A shortened last line is preferable to painting on the ornamental frame.
  const lines=ls.slice(0,maxLines);
  if(ls.length>maxLines){let tail=lines[maxLines-1];g.font=(bold?'bold ':'')+sz+'px '+FONT;
    while(tail.length>1&&g.measureText(tail+'…').width>w)tail=tail.slice(0,-1);
    lines[maxLines-1]=tail+'…';}
  return {size:sz,lines};
}
// 각 원본 패널 이미지를 Canvas 픽셀로 측정한 결과표.
// l/t/r/b는 원본 이미지 가로·세로에 대한 여백 비율. 이미지 로드 뒤 1회 계산한다.
const PANEL_TEXT_INSETS = Object.create(null);
function pixelTextInsets(name) {
  if (PANEL_TEXT_INSETS[name]) return PANEL_TEXT_INSETS[name];
  const im = ui(name);
  if (!im.ok || !im.naturalWidth || !im.naturalHeight) return null;
  const w = im.naturalWidth, h = im.naturalHeight;
  try {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const p = c.getContext('2d', {willReadFrequently:true});
    p.drawImage(im, 0, 0);
    const rgba = p.getImageData(0, 0, w, h).data;
    const val = (x, y) => { const i = (Math.round(y) * w + Math.round(x)) * 4;
      return [rgba[i], rgba[i+1], rgba[i+2], rgba[i+3]]; };
    const anchor = val(w/2,h/2);
    const matches = (x,y) => {
      const q = val(x,y);
      const delta = Math.abs(q[0]-anchor[0]) + Math.abs(q[1]-anchor[1]) + Math.abs(q[2]-anchor[2]);
      return q[3] >= 175 && delta < 102 && Math.max(q[0],q[1],q[2]) < 193;
    };
    const scan = (x,y,dx,dy,max) => {
      let bad = 0,good = 0;
      for(let i=0;i<max;i++,x+=dx,y+=dy) {
        if(matches(x,y)){bad=0;good=i;}else if(++bad>=4)break;
      }
      return Math.max(0,good-3);
    };
    const cy=[.42,.5,.58],cx=[.42,.5,.58];
    const left = Math.max(...cy.map(v=>scan(w/2,h*v,-1,0,Math.floor(w/2))));
    const right = Math.max(...cy.map(v=>scan(w/2,h*v,1,0,Math.floor(w/2))));
    const top = Math.max(...cx.map(v=>scan(w*v,h/2,0,-1,Math.floor(h/2))));
    const bottom = Math.max(...cx.map(v=>scan(w*v,h/2,0,1,Math.floor(h/2))));
    const l=Math.ceil(w/2-left)+3,r=Math.ceil(w/2-right)+3,t=Math.ceil(h/2-top)+3,b=Math.ceil(h/2-bottom)+3;
    const result={l:l/w,t:t/h,r:r/w,b:b/h,pixels:{w,h,l,t,r,b}};
    if(result.l+result.r<.86 && result.t+result.b<.86){
      PANEL_TEXT_INSETS[name]=result;
      return result;
    }
  } catch(e) { /* 이미지 오류일 때는 임의 측정값을 저장하지 않는다. */ }
  return null;
}
function pixelTextBox(name,x,y,w,h){
  const m=pixelTextInsets(name);
  if(!m) return null;
  return {x:x+w*m.l,y:y+h*m.t,w:w*(1-m.l-m.r),h:h*(1-m.t-m.b)};
}
function drawTextInBox(label,area,maxSize,opt){
  opt=opt||{}; if(!area||area.w<=4||area.h<=4)return;
  const full=String(opt.fitFor===undefined?label:opt.fitFor),shown=String(label===undefined?'':label);
  const minSize=Math.max(9,opt.min||11),bold=opt.bold!==false;
  const usableW=area.w-6,usableH=area.h-5,maxLines=opt.lines||999;
  let size=Math.floor(maxSize||20),chosen=null;
  for(;size>=minSize;size--){
    const lines=wrap(full,usableW,size,bold),lh=size*1.22;
    if(lines.length<=maxLines && lines.length*lh<=usableH) {chosen=lines;break;}
  }
  if(!chosen){size=minSize;chosen=wrap(full,usableW,size,bold);}
  const lh=size*1.22,allowed=Math.max(1,Math.min(maxLines,Math.floor(usableH/lh)));
  const lines=wrap(shown,usableW,size,bold).slice(0,allowed);
  if(opt.fitFor===undefined&&lines.length===allowed){
    const all=wrap(shown,usableW,size,bold);
    if(all.length>allowed){let last=lines[allowed-1];g.font=(bold?'bold ':'')+size+'px '+FONT;
      while(last&&g.measureText(last+'…').width>usableW)last=last.slice(0,-1);
      lines[allowed-1]=last+'…';}
  }
  g.save();g.beginPath();g.rect(area.x,area.y,area.w,area.h);g.clip();
  const align=opt.align||'center',valign=opt.valign||'center',used=lines.length*lh;
  const y0=valign==='top'?area.y+2:(valign==='bottom'?area.y+area.h-used-2:area.y+(area.h-used)/2);
  const xx=align==='left'?area.x+3:align==='right'?area.x+area.w-3:area.x+area.w/2;
  for(let i=0;i<lines.length;i++)txt(lines[i],xx,y0+i*lh+size*.89,
    {b:bold,s:size,a:align,c:opt.color||'#f7e6d0',sh:!!opt.shadow});
  g.restore();
}
function safeText(label,x,y,w,h,opt){
  drawTextInBox(label,{x,y,w,h},(opt&&opt.size)||21,opt||{});
}
function panelText(label,kind,x,y,w,h,opt){
  // 픽셀 측정이 일시적으로 실패해도 텍스트 자체를 숨기지 않는다.
  const measured=pixelTextBox(kind,x,y,w,h);
  const mx=Math.max(7,w*.13),my=Math.max(3,h*.13);
  const area=measured||{x:x+mx,y:y+my,w:w-2*mx,h:h-2*my};
  drawTextInBox(label,area,(opt&&opt.size)||21,opt||{});
}

function titlePlate(label,x,y,w,h,opt){
  opt=opt||{}; const nm=opt.red?'goth_plate_red':'plate_dark_wide';
  stretchUi(nm,x,y,w,h);
  panelText(label,nm,x,y,w,h,{size:opt.size||22,min:opt.min||12,lines:opt.lines||2,color:opt.color,shadow:true});
}
function captionPlate(label,x,y,w,h,opt){
  opt=opt||{}; const nm=opt.red?'goth_plate_red':'plate_dark_wide';
  stretchUi(nm,x,y,w,h);
  panelText(label,nm,x,y,w,h,{size:opt.size||20,min:opt.min||12,lines:opt.lines||2,color:opt.color||'#f6e7d7',shadow:false});
}
function ornateStar(cx,cy,sz,on){
  // Previous Canvas star system. Do not draw the ornate image-based stars.
  star(cx,cy,sz/2,on);
}
function button(label,x,y,w,h,fn,o){
  o=o||{};g.save();if(o.dis)g.globalAlpha=.45;
  const bn=(o.red||o.gold)?'goth_btn_red':'goth_btn_dark';
  if(!stretchUi(bn,x,y,w,h))plate3(o.red?'plate_red_a':(o.gold?'plate_parch_a':'plate_dark_s'),x,y,w,h);
  // 버튼 문구는 패널 픽셀 검출 성공 여부와 무관하게 항상 그린다.
  // 화려한 장식에서 읽기 어려워지는 문제는 글자 뒤 그림자와 자동 줄바꿈으로 처리한다.
  drawTextInBox(label,{x:x+Math.min(16,w*.13),y:y+4,w:w-2*Math.min(16,w*.13),h:h-8},
    o.s||22,{min:Math.max(11,(o.s||22)-9),lines:2,color:(o.red||o.gold)?'#ffe9cd':'#f4e8dc',shadow:true});
  g.restore();if(!o.dis)addHit(x,y,w,h,fn);
}
function star(cx, cy, r, on, pop) {
  g.save(); g.translate(cx, cy); if (pop) g.scale(pop, pop); g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } g.closePath();
  if (on) { g.fillStyle = '#ffd24a'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff3b0'; g.stroke(); } else { g.fillStyle = 'rgba(255,255,255,.07)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.28)'; g.stroke(); }
  g.restore();
}
function starRow(cx, cy, r, n, gap) { for(let i=0;i<3;i++) ornateStar(cx+(i-1)*(r*2+(gap||4)),cy,r*2,i<n); }
function coverImg(im, fx, fy) { if (!im || !im.ok) return false; const iw = im.naturalWidth, ih = im.naturalHeight, s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s; g.drawImage(im, -(dw - W) * fx, -(dh - H) * fy, dw, dh); return true; }
function dim(a) { g.fillStyle = 'rgba(6,4,10,' + a + ')'; g.fillRect(0, 0, W, H); }
let toastMsg = '', toastT = 0;
const toast = m => { toastMsg = m; toastT = nowMs() + 2200; };
function drawToast() {
  if (nowMs() > toastT) return; g.font = 'bold 22px ' + FONT; const w = Math.min(W - 40, g.measureText(toastMsg).width + 50), x = (W - w) / 2, y = H - 120;
  g.save(); g.globalAlpha = clamp((toastT - nowMs()) / 400, 0, 1); g.fillStyle = 'rgba(0,0,0,.8)'; rr(x, y, w, 46, 10); g.fill(); g.strokeStyle = '#e8b86a'; g.lineWidth = 2; g.stroke();
  txt(toastMsg, W / 2, y + 31, { b: true, s: 22, a: 'center' }); g.restore();
}
function header(title,back,sub){
  g.save();g.fillStyle='rgba(0,0,0,.48)';g.fillRect(0,0,W,sub?85:75);
  stretchUi('goth_header',6,0,W-12,72);
  // A dedicated flat dark center plate hides the large heart and spikes that used
  // to run through the title. Subtitle has its own baseline below the title plate.
  const cw=Math.min(portrait?425:530,W-155),cx=(W-cw)/2;
  captionPlate(title,cx,3,cw,sub?49:57,{size:portrait?25:29,min:18,lines:1});
  if(sub){
    g.fillStyle='rgba(16,11,19,.9)';g.fillRect(cx+38,51,cw-76,27);
    safeText(sub,cx+49,52,cw-98,24,{size:16,min:11,lines:1,bold:false,color:'#ead9c6'});
  }
  if(back)button('뒤로가기',12,7,112,54,back,{s:17});
  g.restore();
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
  pool.forEach((r, i) => { const fx = x + 20 + (i % perRow) * (fw + 6), fyy = fy + Math.floor(i / perRow) * (fh + 6), av = heroAvail(r); g.save(); if (!av) g.globalAlpha = 0.28; g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(fx, fyy, fw, fh);
    if (r.face.ok) drawFaceCrop(r.face, fx, fyy, fw, fh, { ay: 0.08, gray: !av ? 'grayscale(1) brightness(.6) saturate(0.2)' : null }); g.restore();
    if (!av) sprFit('ic_lock', fx + fw / 2, fyy + fh / 2, Math.min(fw * 0.6, 40)); });
  button('출격 준비', x + w / 2 - 130, y + h - 78, 260, 60, () => openStages(side), { red: true, s: 24 });
}
function drawLines() {
  // 오프닝 배경은 재사용하되 무채색·저대비 처리해 문장만 선명하게 보이도록 한다.
  g.fillStyle='#100d11';g.fillRect(0,0,W,H);
  g.save();g.filter='grayscale(1) brightness(.46) contrast(.80)';coverImg(ui('keyart'),.5,.34);g.restore();
  dim(.20);header('세력 선택',()=>go('title'));
  const sides=[['F','faction_dominaria'],['M','faction_valhalion']];
  const large=portrait, gap=large?12:52;
  const cw=large?Math.min(W-90,560):Math.min((W-92-gap)/2,550);
  const ch=large?Math.min((H-190-gap)/2,cw*.88):Math.min(H-178,cw*.95);
  const startX=large?(W-cw)/2:(W-(2*cw+gap))/2;
  sides.forEach(([side,nm],i)=>{
    const x=startX+(large?0:i*(cw+gap)),y=large?82+i*(ch+gap):82+(H-178-ch)/2;
    const im=ui(nm);
    if(im.ok){const k=Math.min(cw/im.naturalWidth,ch/im.naturalHeight);const dw=im.naturalWidth*k,dh=im.naturalHeight*k;
      g.save();g.shadowColor='rgba(162,57,86,.48)';g.shadowBlur=23;
      g.drawImage(im,x+(cw-dw)/2,y+(ch-dh)/2,dw,dh);g.restore();}
    else{titlePlate(LINES[side].name,x,y,cw,ch,{size:28,red:side==='F'});}
    addHit(x,y,cw,ch,()=>openStages(side));
  });
  // 기능을 없애지 않으면서 문장 2개의 시각적 우선순위를 유지하는 보조 메뉴.
  button('장비',W-178,H-67,140,52,()=>openInv(()=>go('lines')),{s:20});
  if(c11Open())button('마계 11장',38,H-67,180,52,()=>openStages('C'),{s:20,red:true});
}
// ---------- 스테이지 목록 ----------
let SG = { side: 'F', ci: 0 };
function openStages(side, ci) {
  DLBG = null;
  if (ci === undefined) { const m = SV.last.ch[side]; ci = m !== undefined && chOpen(side, m) ? m : Math.max(0, reach(side) - 1); if (side === 'C') ci = 0; }
  SG = { side, ci }; SV.last.side = side; go('stages');
}
function drawStages() {
  const side=SG.side,Ln=LINES[side],ci=SG.ci,ch=Ln.chs[ci];
  coverImg(bg,.5,.5);dim(.72);header(Ln.name,()=>go('lines'),chNo(ch)+'장 · '+chTitle(ch));
  const n=Ln.chs.length,tw=Math.min(110,(W-40-(n-1)*8)/n);
  if(n>1)for(let i=0;i<n;i++){
    const op=chOpen(side,i),x=20+i*(tw+8),y=73;
    stretchUi(i===ci?'goth_btn_red':'goth_btn_dark',x,y,tw,46,op?1:.42);
    if(op)panelText((i+1)+'장',i===ci?'goth_btn_red':'goth_btn_dark',x,y,tw,46,{size:18,min:12,lines:1,color:'#fff',shadow:true});
    else sprFit('ic_lock',x+tw/2,y+22,27);
    addHit(x,y,tw,44,()=>{if(!op){toast('이전 장의 마지막 편을 클리어하세요');return;}SG.ci=i;SV.last.ch[side]=i;});
  }
  const top=n>1?128:76,cols=portrait?2:5,rows=portrait?5:2,gx=12,bot=16;
  const cw=(W-40-(cols-1)*gx)/cols,chh=(H-top-bot-(rows-1)*gx)/rows;
  const sceneBg=chBg(ch);
  for(let no=1;no<=10;no++){
    const e=epData(ch,no),i=no-1,x=20+(i%cols)*(cw+gx),y=top+Math.floor(i/cols)*(chh+gx),op=epOpen(side,ci,no),sv=starsOf(ch,no),boss=no===10;
    panel(x,y,cw,chh,{kind:'goth_panel_tall',gem:false});
    // 새 플레이트를 배치할 카드 내측 배경을 덜 비어 보이게 낮은 대비로 채운다.
    const ix=x+18,iy=y+26,iw=cw-36,ih=chh-59;
    g.save();rr(ix,iy,iw,ih,3);g.clip();
    if(sceneBg.ok){g.globalAlpha=op?.76:.36;g.filter='grayscale(.22) brightness(.93)';
      const scale=Math.max(iw/sceneBg.naturalWidth,ih/sceneBg.naturalHeight),dw=sceneBg.naturalWidth*scale,dh=sceneBg.naturalHeight*scale;
      g.drawImage(sceneBg,ix+(iw-dw)*.5,iy+(ih-dh)*.4,dw,dh);g.filter='none';}
    g.fillStyle=op?'rgba(9,5,12,.24)':'rgba(7,5,10,.62)';g.fillRect(ix,iy,iw,ih);g.restore();
    titlePlate(chNo(ch)+'-'+no,x+cw/2-58,y+9,116,41,{size:20,min:15,color:boss?'#ffbdad':'#f6dfb9'});
    if(boss)titlePlate('BOSS',x+cw-83,y+11,70,32,{red:true,size:15});
    titlePlate(e.title,x+13,y+54,cw-26,Math.min(chh*.27,78),{size:portrait?19:20,min:13,lines:2});
    starRow(x+cw/2,y+chh-34,15,sv,2);
    if(!op){g.fillStyle='rgba(0,0,0,.35)';g.fillRect(ix,iy+Math.min(chh*.27,78)+43,iw,Math.max(5,ih-Math.min(chh*.27,78)-65));sprFit('ic_lock',x+cw/2,y+chh*.62,56);}
    addHit(x,y,cw,chh,()=>{if(!op){toast(no===1?'이전 장을 먼저 끝내야 합니다':'이전 편을 먼저 클리어하세요');return;}MODAL={kind:'brief',side,ci,ch,no};});
  }
}
function drawBrief(){
  const m=MODAL,e=epData(m.ch,m.no),P=params(m.ch,m.no);
  const w=Math.min(W-40,650),h=portrait?560:500,x=(W-w)/2,y=(H-h)/2;
  g.fillStyle='rgba(0,0,0,.70)';g.fillRect(0,0,W,H);panel(x,y,w,h);
  captionPlate(chNo(m.ch)+'-'+m.no+(P.boss?' BOSS':''),x+w/2-101,y+11,202,53,{size:24,min:16,red:P.boss});
  captionPlate(e.title,x+73,y+69,w-146,56,{size:24,min:14,lines:2});
  starRow(x+w/2,y+145,17,starsOf(m.ch,m.no),8);
  const rows=[['목표','적 '+P.goal+'명 처치'+(P.boss?' (보스 포함)':'')],['제한 시간',mmss(P.st.limit)],['별 3개','남은 시간 '+Math.round(STAR_T[0]*100)+'% 이상'],['별 2개','남은 시간 '+Math.round(STAR_T[1]*100)+'% 이상'],['별 1개','클리어'],['적',LINES[m.side].foe]];
  const insideX=x+57,insideW=w-114,rowsY=y+184,rowH=Math.min(39,(h-280)/6+10);
  rows.forEach(([label,value],i)=>{
    const ry=rowsY+i*rowH,labW=insideW*.32,valX=insideX+labW+10,valW=insideW-labW-10;
    g.fillStyle=i%2?'rgba(31,22,29,.35)':'rgba(22,15,23,.54)';g.fillRect(insideX,ry,insideW,rowH-3);
    safeText(label,insideX+7,ry+3,labW-14,rowH-8,{size:18,min:14,lines:1,color:'#dbc4a5'});
    safeText(value,valX,ry+3,valW-8,rowH-8,{size:18,min:13,lines:1,color:'#fff',bold:true});
  });
  const by=y+h-75,seen=SV.seen[epId(m.ch,m.no)+'b']||starsOf(m.ch,m.no);
  button('닫기',x+32,by,120,54,()=>{MODAL=null;},{s:20});
  if(seen)button('대사 보기',x+w/2-84,by,168,54,()=>{MODAL=null;replayStory(m.ch,m.no);},{s:19});
  button('출격',x+w-202,by,170,54,()=>{MODAL=null;openParty(m.side,m.ci,m.ch,m.no);},{red:true,s:23});
}
function replayStory(ch, no) { const e = epData(ch, no); setBattleBg(ch); const back = () => { openStages(SG.side, SG.ci); }; playDialogue(e.before.concat(e.after), back); }

// ---------- 출격(파티) ----------
function openParty(side, ci, ch, no) {
  const pool = poolOf(side), saved = SV.party[side] || []; let sel = saved.map(k => pool.find(r => r.k === k)).filter(r => r && heroAvail(r) && !(window.GW_PRISON&&window.GW_PRISON.locked(r.k))).slice(0, 3);
  PS = { side, ci, ch, no, sel }; go('party');
}
function drawParty() {
  const { side, ch, no } = PS, pool = poolOf(side), n = pool.length;
  coverImg(bg, 0.5, 0.5); dim(0.82); header('출격 편성', () => openStages(side, PS.ci), chNo(ch) + '-' + no + ' · ' + epData(ch, no).title);
  const cols = n > 8 ? (portrait ? 4 : 8) : (portrait ? 2 : 4), rows = Math.ceil(n / cols), top = 92, bot = 118, gx = 14;
  const rawH = Math.min((H - top - bot - (rows - 1) * gx) / rows, 330), cw = (W - 40 - (cols - 1) * gx) / cols, cardH = Math.min(rawH, cw * 1.36), small = cw < 170;
  const drawCard = (r, x, y, w, h, on, av, idx) => {
    const artX=x+w*.15,artY=y+h*.16,artW=w*.70,artH=h*.54,fi=r.face;
    g.save(); rr(artX, artY, artW, artH, 16); g.clip();
    if(fi.ok){const sh=artH*1.43,sw=sh*fi.naturalWidth/fi.naturalHeight;g.save();if(!av)g.filter='grayscale(1) brightness(.55) saturate(.2)';g.drawImage(fi,artX+(artW-sw)/2,artY-2,sw,sh);g.filter='none';g.restore();}
    g.restore();
    stretchUi(av ? 'goth_frame_open' : 'goth_frame_locked', x, y, w, h);
    if (on) {
      g.save();
      g.shadowColor = 'rgba(237,83,134,.84)'; g.shadowBlur = 22; g.globalAlpha = .96;
      stretchUi(av ? 'goth_frame_open' : 'goth_frame_locked', x + 2, y + 2, w - 4, h - 4);
      g.restore();
      sprFit('num' + String(idx + 1), x + w - 30, y + 32, 54);
    }
    titlePlate(r.n,x+w*.12,y+h*.682,w*.76,Math.min(31,h*.125),{size:small?16:19,min:12,lines:1});
    if(!av)txt(HERO_UNLOCK[r.k]+' 클리어 해금',x+w/2,y+h*.60,{b:true,s:13,a:'center',c:'#f1d6c6',sh:true});
    txt(CLS[r.c],x+w/2,y+h*.866,{b:true,s:small?12:14,a:'center',c:av?CCOL[r.c]:'#998688',sh:true});
  };
  pool.forEach((r, i) => {
    const x = 20 + (i % cols) * (cw + gx), slotY = top + Math.floor(i / cols) * (rawH + gx), y = slotY + Math.max(0, (rawH - cardH) / 2), j = PS.sel.indexOf(r), on = j >= 0, av = heroAvail(r);
    drawCard(r, x, y, cw, cardH, on, av, j);
    levelCircle(x+Math.min(27,cw*.105),y+Math.min(28,cardH*.105),heroLevel(r.k),Math.max(15,Math.min(22,cw*.075)));
    if(window.GW_PRISON&&window.GW_PRISON.is(r.k)){
      const ma=window.GW_PRISON.percentage(r.k),locked=window.GW_PRISON.locked(r.k);
      const label=(locked?'⛔ ':'☠ ')+ma+'%'+(locked?' · 폭주 '+SV.rampage[r.k]+'회':'');
      const tagH=Math.min(25,Math.max(18,cardH*.082)),tagY=y+cardH-tagH-6;
      g.save();rr(x+cw*.16,tagY,cw*.68,tagH,6);g.fillStyle='rgba(0,0,0,.82)';g.fill();g.restore();
      txt(label,x+cw*.5,tagY+tagH*.74,{b:true,s:Math.min(15,Math.max(11,cw*.065)),a:'center',c:locked?'#ffb3b3':'#fff',sh:true});
    }
    addHit(x, y, cw, cardH, () => { if(window.GW_PRISON&&window.GW_PRISON.locked(r.k)){toast('폭주로 '+SV.rampage[r.k]+'회 출전 불가');return;} if (!av) { toast(HERO_UNLOCK[r.k] + ' 클리어 후 사용할 수 있습니다'); return; } if (on) PS.sel.splice(j, 1); else if (PS.sel.length < 3) PS.sel.push(r); else toast('3명까지 고를 수 있습니다'); });
  });
  const rd = PS.sel.length === 3;
  button('장비', W - 440, H - 92, 190, 72, () => openInv(() => go('party')), { s: 24 });
  button('출격', W - 230, H - 92, 200, 72, () => { SV.party[side] = PS.sel.map(r => r.k); saveNow(); beginStage(); }, { red: true, s: 30, dis: !rd });
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
  g.fillStyle = '#0d0a10'; g.fillRect(0, 0, W, H); coverImg(DLBG || bg, 0.5, 0.5); dim(0.5);
  const bh = portrait ? 330 : 210, bx = portrait ? 20 : 40, bw = W - bx * 2, by = H - bh - (portrait ? 30 : 22);
  if (hero && hero.face.ok) {
    const right = heroLine(hero) === 'M', ph = portrait ? H * 0.46 : H * 0.7, k = ph / hero.face.naturalHeight, pw = hero.face.naturalWidth * k;
    g.save(); g.globalAlpha = 0.97; g.drawImage(hero.face, right ? W - pw - (portrait ? 10 : 70) : (portrait ? 10 : 70), by - ph + 40, pw, ph); g.restore();
  }
  panel(bx, by, bw, bh, { fill: 'rgba(12,8,16,.9)' });
  if(!narr){plate3('plate_red_a',bx+26,by-34,250,68);
    panelText(l.who,'plate_red_a',bx+26,by-34,250,68,{size:26,min:13,lines:2,color:'#fff',shadow:true});}
  const inside=pixelTextBox(bh>bw*.82&&bh>220?'goth_panel_tall':'goth_panel_big',bx,by,bw,bh);
  if(inside){
    const body={x:inside.x+25,y:inside.y+40,w:inside.w-30,h:Math.max(20,inside.h-78)};
    drawTextInBox(l.text.slice(0,dlShown()),body,portrait?27:28,{min:14,lines:12,bold:false,
       align:narr?'center':'left',valign:narr?'center':'top',color:narr?'#ffd9a0':'#fff',fitFor:l.text});
    if(dlShown()>=l.text.length&&Math.sin(nowMs()/180)>-.2)
      drawTextInBox('▼',{x:inside.x+inside.w-35,y:inside.y+inside.h-28,w:30,h:23},22,{min:15,color:'#ffe27a'});
    drawTextInBox((DL.i+1)+'/'+DL.lines.length,
      {x:inside.x+inside.w-64,y:inside.y+5,w:62,h:25},14,
      {min:12,bold:false,align:'right',color:'rgba(255,255,255,.45)'});
  }
  addHit(0, 0, W, H, dlAdvance); button('건너뛰기', W - 178, 8, 116, 40, dlSkip, { s: 17 });
}

// ---------- 전투 시작 ----------
SETS.C = () => { const a = SETS.F(), b = SETS.M(); return { K: a.K.concat(b.K), M: a.M.concat(b.M) }; };
function beginStage() {
  const { side, ch, no, sel } = PS, e = epData(ch, no), id = epId(ch, no);
  const go2 = () => launch(side, ch, no, sel);
  setBattleBg(ch);
  if (!SV.seen[id + 'b']) { SV.seen[id + 'b'] = 1; saveNow(); playDialogue(e.before, go2); } else go2();
}
// 장별 전투 배경 (빨간 깃발=여성국, 검정 깃발=남성국, 공장·마계는 구분 없음). M5는 낮 시가지 재사용(가안)
const BGMAP = { F1: 'bg2.jpg', F2: 'bg_F2.jpg', F3: 'bg_F3.jpg', F4: 'bg_F4.jpg', F5: 'bg_F5.jpg', M1: 'bg_M1.jpg', M2: 'bg_M2.jpg', M3: 'bg_M3.jpg', M4: 'bg_M4.jpg', M5: 'bg_M1.jpg', C11: 'bg_C.jpg' };
const BGI = {};
function chBg(ch) { const f = BGMAP[ch]; if (!f) return bg; return BGI[f] || (BGI[f] = loadImg(f)); }
let DLBG = null;
// 배경별 지평선(바닥이 시작되는 높이, 화면 높이 대비 비율 · 가안: 눈대중). 보행 유닛은 이 선 아래에만 선다
const BGHZ = { F1: 0.45, F2: 0.43, F3: 0.37, F4: 0.40, F5: 0.38, M1: 0.35, M2: 0.40, M3: 0.42, M4: 0.39, M5: 0.35, C11: 0.42 };
function syncHz() { HZF = BGHZ[curHzCh] || 0.40; if (L && L.H) L.ey0 = Math.round(L.H * HZF) + (portrait ? 34 : 22); }
let curHzCh = 'F1';
function setBattleBg(ch) { bgB = DLBG = chBg(ch); curHzCh = ch; syncHz(); setCovers(ch); }
function launch(side0, ch, no, sel) {
  const P = params(ch, no), c = tier(ch); Object.assign(ST, P.st);
  picks = sel.map(r => Object.assign({}, r, { gm: gmFor(r, c) })); side = side0 === 'C' ? 'C' : side0;
  curStage = { side: side0, ch, no, sel, P, bannerT: 0 }; paused = false; res = null; timeUp = false; fireHeld = false;
  if(window.GW_PRISON)window.GW_PRISON.stageStarted();setBattleBg(ch); scene = 'battle'; MODAL = null; startGame();
  // 포로 고유 체력 보너스는 mkHero 적용 후, 레벨 성장분과 곱연산.
  heroes.forEach((h,i)=>{const mult=levelMultiplier(sel[i]?.k);h.max=Math.round(h.max*mult);h.hp=h.max;});
  resetBattleSkills();
}
function backToStages(adv) { curStage = null; res = null; paused = false; over = false; if (adv && SG.side !== 'C' && SG.ci < 4 && chOpen(SG.side, SG.ci + 1)) { SG.ci++; SV.last.ch[SG.side] = SG.ci; } openStages(SG.side, SG.ci); }

// ---------- 전투 결과 ----------
function starsFor(frac) { return frac >= STAR_T[0] ? 3 : frac >= STAR_T[1] ? 2 : 1; }
function onBattleEnd() {
  const cs = curStage; if (!cs || cs.xpSettled) return;cs.xpSettled=true;
  const xp=earnBattleXP(cs,won,score);
  if (won) {
    const remain = Math.max(0, ST.limit - t), frac = remain / ST.limit, sv = starsFor(frac), id = epId(cs.ch, cs.no), before = SV.clr[id] || 0;
    SV.clr[id] = Math.max(before, sv); res = { won: true, stars: sv, remain, first: !before, xp, t0: nowMs() };
    const e = epData(cs.ch, cs.no); res.line = e.stars && e.stars[String(sv)] || null; saveNow();
  } else res = { won: false, why: timeUp ? '시간 초과' : '전멸', xp, t0: nowMs() };
}
function drawResult() {
  if (!res) return; const cs = curStage, el = nowMs() - res.t0, w = Math.min(W - 40, 640), h = res.won ? (portrait ? 560 : 500) : 330, x = (W - w) / 2, y = (H - h) / 2;
  g.fillStyle = 'rgba(0,0,0,' + clamp(el / 300, 0, 0.72) + ')'; g.fillRect(0, 0, W, H); if (el < 200) return;
  panel(x, y, w, h, { fill: 'rgba(14,10,18,.95)', e1: res.won ? '#ffd24a' : '#a86a6a' });
  txt(res.won ? 'STAGE CLEAR' : '임무 실패', x + w / 2, y + 66, { b: true, s: 46, a: 'center', c: res.won ? '#ffe27a' : '#ff9a8a', sh: true });
  drawTextInBox(chNo(cs.ch)+'-'+cs.no+' · '+epData(cs.ch,cs.no).title,{x:x+44,y:y+76,w:w-88,h:46},20,{min:12,lines:2,color:'#cbb890',bold:false});
  if (res.won) {
    for (let i = 0; i < 3; i++) { const on = i < res.stars, sh = el - 450 - i * 380, pop = on ? (sh < 0 ? 0 : sh < 220 ? 0.4 + sh / 220 * 0.9 : 1.3 - Math.min(0.3, (sh - 220) / 600)) : 1; g.save();g.translate(x+w/2+(i-1)*84,y+175);g.scale(on?Math.max(.01,pop):1,on?Math.max(.01,pop):1);ornateStar(0,0,72,on&&sh>=0);g.restore(); }
    txt('처치 ' + score + '/' + ST.goal + ' · 남은 시간 ' + mmss(res.remain), x + w / 2, y + 250, { b: true, s: 22, a: 'center' });
    {const up=res.xp?.awards?.filter(a=>a.after>a.before)||[];txt((res.first?'첫 클리어! · ':'')+'경험치 +'+(res.xp?.amount||0)+(up.length?' · 레벨 상승 '+up.length+'명':''),x+w/2,y+282,{b:true,s:18,a:'center',c:up.length?'#fff4b5':'#9fe6a8'});}
    if (res.line && el > 450 + 3 * 380) { const lh = wrap(res.line.text, w - 80, 21, false); panel(x + 26, y + 300, w - 52, 28 + lh.length * 30 + 28, { fill: 'rgba(40,24,30,.8)', gem: false, lw: 2 }); drawTextInBox(res.line.who,{x:x+46,y:y+309,w:w-100,h:30},18,{min:12,lines:1,align:'left',color:'#ffe27a'});drawTextInBox(res.line.text,{x:x+46,y:y+343,w:w-100,h:Math.max(18,lh.length*30)},21,{min:12,lines:5,align:'left',bold:false,valign:'top'}); }
    if (el > 450 + 3 * 380) button('계속', x + w / 2 - 110, y + h - 74, 220, 58, () => afterWin(), { red: true, s: 26 });
  } else {
    txt('처치 ' + score + '/' + ST.goal + ' · ' + res.why, x + w / 2, y + 160, { b: true, s: 24, a: 'center' });
    txt('경험치 +'+(res.xp?.amount||0)+' (출전 3명)',x+w/2,y+207,{b:true,s:17,a:'center',c:'#d9cba7'});
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
  stretchUi('goth_plate_dark',bx-8,by-2,bw+16,39);
  txt(mmss(rem),bx+34,by+25,{b:true,s:20,a:'center',c:'#f6e8dd',sh:true});
  const ns=starsFor(frac);for(let i=0;i<3;i++)ornateStar(bx+104+i*25,by+16,22,i<ns);
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
  drawTextInBox(m.title,{x:x+44,y:y+30,w:w-88,h:55},28,{min:13,lines:2,color:'#ffe9b0',shadow:true});
  drawTextInBox(m.msg||'',{x:x+45,y:y+92,w:w-90,h:62},20,{min:12,lines:3,bold:false,color:'#e8d8b0'});
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
function gmFor(r, c) { const m = sumMods(r.k); m.atk = (1 + m.atk) * Math.pow(DIFF.heroDmg, c) * levelMultiplier(r.k) - 1; return m; }
const optLine = o => optName(o.k) + ' +' + (Math.round(o.v * 10) / 10) + '%';
const GI_N = 78;   // ui/gi_01~78.webp (01~36 기존 장비 아이콘, 37~ GPT 개그 시트). 아이템 이름 → 고정 아이콘(같은 이름=같은 그림, 안 맞는 건 개그)
const giIdx = nm => { const bl = baseList().map(b => b.name), k = bl.indexOf(nm); if (k >= 0) return k % GI_N; let h = 0; for (const ch of nm) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % GI_N; };
const gearIconKey = g0 => 'gi_' + String(giIdx(g0.base) + 1).padStart(2, '0');
function gearIcon(g0, cx, cy, sz) { g.save(); g.fillStyle = RARC[g0.rar - 1]; g.globalAlpha = 0.28; g.beginPath(); g.arc(cx, cy, sz * 0.52, 0, 7); g.fill(); g.globalAlpha = 1; g.restore(); sprFit(gearIconKey(g0), cx, cy, sz * 1.12); }
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
    gearIcon(g0, x + w / 2, y + h * 0.17, w * 0.3); captionPlate(RARN[g0.rar-1]+' · Lv.'+g0.lv,x+w*.13,y+h*.29,w*.74,h*.105,{size:big?16:13,min:11,color:col,lines:1});
    captionPlate(g0.base,x+w*.11,y+h*.40,w*.78,h*.20,{size:big?20:16,min:12,lines:2});
    safeText(g0.opts.map(optLine).join(' · '),x+w*.13,y+h*.63,w*.74,h*.23,{size:big?17:14,min:11,lines:4,bold:false,color:'#cfe8ff'});
  } else {
    panel(x, y, w, h, { fill: 'rgba(24,20,24,.96)', e1: '#8a7a6a', e2: '#5a4a3a' }); sprFit('ic_warn', x + w / 2, y + h * 0.18, w * 0.28);
    captionPlate('꽝',x+w*.18,y+h*.40,w*.64,h*.16,{size:big?32:24,min:18,lines:1,color:'#ccc3b3'});
    if(c.blank.title&&c.blank.title!=='꽝')safeText(c.blank.title,x+w*.13,y+h*.59,w*.74,h*.13,{size:16,min:12,lines:2});
    safeText(c.blank.caption||'',x+w*.13,y+h*.72,w*.74,h*.15,{size:14,min:11,lines:3,bold:false,color:'#c7bdb6'});
    captionPlate('부품 +'+(c.blank.parts||1),x+w*.19,y+h*.85,w*.62,h*.09,{size:13,min:11,lines:1,color:'#cbb890'});
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
      panel(0, 0, q.w, q.h, { fill: 'rgba(60,14,24,.95)', e1: '#e8b86a', e2: '#8a5a2a', lw: 4 }); sprFit('ic_wings_big', q.w / 2, q.h / 2, q.w * 0.6);
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
  captionPlate('부품 '+SV.parts,W-200,77,162,43,{size:16,min:12,lines:1});
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
    g.fillStyle=on?'rgba(148,32,64,.22)':'rgba(0,0,0,.5)';g.fillRect(x,y,cs,cs);
    if(on){g.save();g.shadowColor='rgba(222,85,117,.8)';g.shadowBlur=16;g.fillStyle='rgba(207,70,90,.16)';g.fillRect(x+3,y+3,cs-6,cs-6);g.restore();}
    const prisonThumb=!!(window.GW_PRISON&&window.GW_PRISON.is(r.k));
    if (r.face.ok) drawFaceCrop(r.face, x, y, cs, prisonThumb?cs-19:cs, { ay: 0.08, clip: true });
    if(window.GW_PRISON&&window.GW_PRISON.is(r.k)){
      g.fillStyle='rgba(0,0,0,.76)';g.fillRect(x,y+cs-18,cs,18);
      txt((window.GW_PRISON.locked(r.k)?'⛔':'☠')+window.GW_PRISON.percentage(r.k)+'%',x+cs*.5,y+cs-4,{b:true,s:Math.max(10,Math.min(12,cs*.16)),a:'center',c:'#fff',sh:true});
    }
    if (eq) { const g0 = gearById(eq); if (g0) { g.fillStyle = RARC[g0.rar - 1]; g.fillRect(x, y + cs - (prisonThumb?24:6), cs, 5); } }
    levelCircle(x+Math.max(12,cs*.17),y+Math.max(12,cs*.17),heroLevel(r.k),Math.max(11,Math.min(14,cs*.18)));
    addHit(x, y, cs, cs, () => { INV.hero = r.k; });
  });
  const lt = top + rowsN * (cs + 6) + 6, hero = heroByKey(INV.hero), eqG = gearById(SV.eq[INV.hero]);
  const listW = portrait ? W - 40 : W - 40 - 360, listH = portrait ? 6 * 74 + 100 : H - lt - 14;
  // 가방 목록
  const gs = sortedGear(), rowH = 74, perPage = Math.max(1, Math.floor((listH - 145) / rowH)), pages = Math.max(1, Math.ceil(gs.length / perPage)); INV.page = clamp(INV.page, 0, pages - 1);
  panel(20,lt,listW,listH,{gem:false});titlePlate('가방 '+gs.length+'개',46,lt+54,175,43,{size:20,lines:1});
  if (!gs.length) txt('아직 장비가 없습니다. 스테이지를 클리어하고 카드를 고르세요.', 20 + listW / 2, lt + listH / 2, { s: 20, a: 'center', c: '#9a8a70' });
  gs.slice(INV.page * perPage, INV.page * perPage + perPage).forEach((g0, i) => {
    const x = 46, y = lt + 110 + i * rowH, w = listW - 52, on = INV.sel === g0.id, own = gearOwner(g0.id);
    g.fillStyle=on?'rgba(123,28,52,.32)':'rgba(255,255,255,.04)';g.fillRect(x,y,w,rowH-6);g.save();g.strokeStyle=on?'rgba(224,97,122,.58)':'rgba(255,255,255,.16)';g.lineWidth=1;g.strokeRect(x,y,w,rowH-6);g.restore();
    gearIcon(g0,x+38,y+(rowH-6)/2,52);
    drawTextInBox(g0.base,{x:x+76,y:y+3,w:Math.max(80,w-245),h:39},20,{min:12,lines:2,align:'left',color:RARC[g0.rar-1]});
    txt(RARN[g0.rar-1]+' · Lv.'+g0.lv,x+w-78,y+27,{s:15,a:'right',c:'#cbb890'});
    drawTextInBox(g0.opts.map(optLine).join('  '),{x:x+76,y:y+42,w:Math.max(80,w-(own?255:100)),h:22},portrait?15:17,{min:11,lines:1,align:'left',bold:false,color:'#cfe8ff'});
    if (own) { const h2 = heroByKey(own); txt('착용: ' + (h2 ? h2.n : own), x + w - 78, y + 54, { b: true, s: 15, a: 'right', c: '#9fe6a8' }); }
    addHit(x, y, w, rowH - 6, () => { INV.sel = on ? null : g0.id; });
  });
  if (pages > 1) { button('◀', 20 + listW / 2 - 110, lt + listH - 58, 70, 38, () => { INV.page = Math.max(0, INV.page - 1); }, { s: 18 }); txt((INV.page + 1) + ' / ' + pages, 20 + listW / 2, lt + listH - 32, { b: true, s: 18, a: 'center' }); button('▶', 20 + listW / 2 + 40, lt + listH - 58, 70, 38, () => { INV.page = Math.min(pages - 1, INV.page + 1); }, { s: 18 }); }
  button('일반 일괄 분해', 20 + listW - 213, lt + 57, 176, 40, () => { const n = SV.gear.filter(x => x.rar === 1 && !gearOwner(x.id)).length; if (!n) { toast('분해할 일반 장비가 없습니다'); return; } MODAL = { kind: 'confirm', title: '일반 장비 ' + n + '개를 분해할까요?', msg: '착용 중인 장비는 제외됩니다.', yes: () => { let p = 0; for (const x of SV.gear.slice()) if (x.rar === 1 && !gearOwner(x.id)) p += dismantle(x.id); toast('부품 +' + p); INV.sel = null; } }; }, { s: 15 });
  // 영웅 / 상세 패널
  const px = portrait ? 20 : 20 + listW + 12, pw = portrait ? W - 40 : 348, py = portrait ? lt + listH + 10 : lt, ph = portrait ? H - py - 10 : listH;
  panel(px, py, pw, ph, { gem: false }); if (!hero) return;
  titlePlate(hero.n+' · '+CLS[hero.c],px+38,py+55,pw-64,44,{size:22,lines:1});
  let yy=py+119; if (eqG) { gearIcon(eqG, px + 34, yy + 22, 46); drawTextInBox(eqG.base,{x:px+78,y:yy-3,w:Math.max(80,pw-167),h:27},18,{min:12,lines:1,align:'left',color:RARC[eqG.rar - 1]}); drawTextInBox(eqG.opts.map(optLine).join(' '),{x:px+78,y:yy+27,w:Math.max(80,pw-167),h:24},13,{min:10,lines:1,align:'left',bold:false,color:'#cfe8ff'}); button('해제', px + pw - 86, yy, 70, 38, () => { equip(eqG.id, null); }, { s: 16 }); } else titlePlate('착용 장비 없음',px+55,yy+4,pw-98,46,{size:17,min:13});
  yy += 76; const sl = statLines(INV.hero); titlePlate('장비 효과 합계',px+55,yy-14,pw-98,38,{size:16,min:13}); (sl.length ? sl : ['—']).forEach((s, i) => txt(s, px + 55 + (portrait ? (i % 3) * ((pw - 98) / 3) : 0), yy + 49 + (portrait ? Math.floor(i / 3) * 22 : i * 22), { s: 16, c: '#e8f0ff' }));
  const sg = gearById(INV.sel); if (sg) {
    const by = py + ph - 156; g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(px + 12, by - 8, pw - 24, 1); drawTextInBox(sg.base,{x:px+28,y:by-6,w:pw-44,h:28},18,{min:12,lines:1,align:'left',color:RARC[sg.rar-1]}); if(sg.flavor)drawTextInBox(sg.flavor,{x:px+28,y:by+24,w:pw-44,h:40},14,{min:10,lines:2,align:'left',valign:'top',bold:false,color:'#bbb'});
    const bw = (pw - 44) / 3; button('장착', px + 12, by + 70, bw, 50, () => { equip(sg.id, INV.hero); toast(hero.n + '에게 장착'); }, { red: true, s: 18 });
    button('분해', px + 22 + bw, by + 70, bw, 50, () => { MODAL = { kind: 'confirm', title: '분해할까요?', msg: sg.base + ' → 부품 +' + PARTS_GET[sg.rar - 1], yes: () => { const p = dismantle(sg.id); INV.sel = null; toast('부품 +' + p); } }; }, { s: 18 });
    button('재설정', px + 32 + bw * 2, by + 70, bw, 50, () => { MODAL = { kind: 'confirm', title: '옵션 재설정', msg: '부품 ' + rerollCost(sg) + '개를 써서 수치를 다시 굴립니다.', yes: () => reroll(sg.id) }; }, { s: 16 });
  } else titlePlate('목록에서 장비를 선택하세요',px+30,py+ph-90,pw-48,45,{size:16,min:12});
}


// ================= 조준선 / 조준경 렌즈 (PNG: docs/reticle_index.png 번호로 교체 가능) =================
// 총기 종류별 조준선 (케인 제작 4종, assets_src/reticles_4types.png). 0 연사 · 1 산탄 · 2 저격 · 3 점사(힐러 총). dot=true면 붉은 중심점을 얹는다
const RET = { 0: { n: 'rt_ar', dot: true }, 1: { n: 'rt_sg', dot: false }, 2: { n: 'rt_snipe', dot: true }, 3: { n: 'rt_burst', dot: false } };
for (const k in RET) ui(RET[k].n);
const TINT = {};
function tinted(n, col) {
  const k = n + col; if (TINT[k]) return TINT[k]; const im = ui(n); if (!im.ok) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d');
  x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return (TINT[k] = c);
}
function retDraw(n, col, cx, cy, size, a) { const c = tinted(n, col); if (!c || a <= 0.01) return; g.save(); g.globalAlpha = a; g.drawImage(c, cx - size / 2, cy - size / 2, size, size * c.height / c.width); g.restore(); }
drawReticle = function (vx, vy) {
  // 프레임은 lensFx가 담당한다. 정중앙에는 작은 빨간 '+' 하나만 표시.
  if (scope < 0.03) return;
  const a = clamp(scope * 1.6, 0, 1);
  g.save(); g.globalAlpha = a; g.strokeStyle = '#ff3446'; g.lineWidth = 2.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(vx - 7, vy); g.lineTo(vx + 7, vy);
  g.moveTo(vx, vy - 7); g.lineTo(vx, vy + 7); g.stroke();
  g.restore();
};
const SCH = {"scope_F_0":[0.5069,0.5254,0.2801],"scope_F_1":[0.5131,0.4562,0.3083],"scope_F_2":[0.4984,0.5332,0.2863],"scope_F_3":[0.4835,0.4593,0.2886],"scope_M_0":[0.4966,0.4511,0.3325],"scope_M_1":[0.5344,0.4835,0.3569],"scope_M_2":[0.4668,0.522,0.2762],"scope_M_3":[0.4886,0.4924,0.3]};   // 렌즈 구멍 중심x,y / 반지름(이미지 폭 비율)
lensFx = function (vx, vy, ringR) {
  if (scope < 0.03) return; g.save(); g.globalAlpha = clamp(scope * 1.3, 0, 1);
  const gr = g.createRadialGradient(vx, vy, ringR * 0.55, vx, vy, ringR); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.5)');
  g.fillStyle = gr; g.beginPath(); g.arc(vx, vy, ringR, 0, 7); g.fill();
  const hh = heroes[sel], nm = 'scope_' + (side === 'M' ? 'M' : 'F') + '_' + (hh ? hh.c : 0), im = ui(nm), q = SCH[nm];   // 국가·총기별 스코프 프레임(0연사 1산탄 2저격 3점사)
  if (im.ok && q) { const iw = im.naturalWidth, ih = im.naturalHeight, k = ringR / (q[2] * iw); g.drawImage(im, vx - q[0] * iw * k, vy - q[1] * ih * k, iw * k, ih * k); g.restore(); return; }
  g.lineWidth = 9; g.strokeStyle = 'rgba(12,9,14,.9)'; g.beginPath(); g.arc(vx, vy, ringR + 4, 0, 7); g.stroke();
  g.lineWidth = 2; g.strokeStyle = '#c89a5a'; g.beginPath(); g.arc(vx, vy, ringR + 0.5, 0, 7); g.stroke(); g.restore();
};

// ================= 병과별 필살기 (임시 전투 버튼) =================
// 캐릭터별 50초 재사용. 전투 시작 시 초기화; 전투 밸런스 수치(DIFF/ST)는 건드리지 않는다.
const SKILL_COOLDOWN = 50 * 60, EMP_FRAMES = 11 * 60;
const SKILL_NAMES = ['공습 지원','감전 펄스','사신의 마탄','전체 치료'];
const SKILL_COLORS = ['#efb36b','#8ceeff','#f2a0bd','#9fffd2'];
// 무기별 필살기: 실제 장착한 무기 이름으로 일관되게 구분한다.
function battleSkillType(h) {
  if (!h || !h.w) return -1;
  switch (h.w.n) {
    case '연사': return 0;
    case '산탄': return 1;
    case '저격': return 2;
    case '점사': return 3;
    default: return -1;
  }
}
let skillReady = [0,0,0], skillBombs = [], skillPulse = 0;
let magicChains = [], magicTrails = [], skillCutins = [];
window.GW_SKILL_SNIPER = false;
function resetBattleSkills() {
  skillReady = [0,0,0]; skillBombs = []; skillPulse = 0;
  magicChains = []; magicTrails = []; skillCutins = [];
  window.GW_SKILL_SNIPER = false;
}
function skillButtonRect() {
  const fire = btns.find(b => b.a === 'fire');
  if (!fire) return null;
  const r = portrait ? 51 : 44, gap = portrait ? 186 : 155;
  return { x:fire.x-r, y:fire.y-gap-r, w:r*2, h:r*2, cx:fire.x, cy:fire.y-gap, r };
}
// 공통 스킬 발동 컷인: 캐릭터 자리에서 잔상이 화면 쪽으로 확대되며 사라진다.
function startSkillCutin(h, type) {
  skillCutins.push({ x:h.x, y:h.y, hero:h, color:SKILL_COLORS[type], age:0, life:36 });
  if(skillCutins.length>3)skillCutins.shift(); // 3인 파티의 동시 사용까지만 유지
  shk=Math.max(shk,4);
}
// 사신의 마탄: 한 발이 최대 다섯 대상에 연쇄 이동. 일반 병사 우선, 메카/드론 후순위.
function nextMagicTarget(q) {
  const targets=enemies.filter(e=>!e.dead&&e.hp>0&&!q.used.includes(e));
  targets.sort((a,b)=>{
    const ah=+(!!(a.k.mech||a.k.drone)),bh=+(!!(b.k.mech||b.k.drone));
    return ah-bh || Math.hypot(a.x-q.x,ecy(a)-q.y)-Math.hypot(b.x-q.x,ecy(b)-q.y);
  });
  return targets[0]||null;
}
function fireMagicShot(q) {
  const e=nextMagicTarget(q);
  if(!e)return false;
  const x=e.x,y=ecy(e),heavy=!!(e.k.mech||e.k.drone);
  magicTrails.push({x1:q.x,y1:q.y,x2:x,y2:y,age:0,life:20});
  q.x=x;q.y=y;q.used.push(e);q.count++;
  // 적 엄폐물을 관통하여 본체만 공격. 중장갑은 최대 체력 35%, 일반 병사는 즉사.
  {const owner=ROSTER.F.concat(ROSTER.M).find(r=>r.n===q.hero.name);if(owner)e._gwKiller=owner.k;}e.hp-=heavy?e.max*0.35:e.hp;
  e.flash=10;e.stun=Math.max(e.stun||0,heavy?28:0);
  burst(x,y,heavy?16:11,'#ff75cf');sfx('sn',1.05);
  shk=Math.max(shk,heavy?8:5);bflash=Math.max(bflash,0.07);
  if(e.hp<=0)killEnemy(e,(x-q.hero.x)>=0?0.8:-0.8);
  return true;
}
function drawMagicTrails() {
  if(!magicTrails.length)return;
  g.save();g.globalCompositeOperation='lighter';g.lineCap='round';
  for(const o of magicTrails){
    const p=Math.min(1,o.age/5),x=o.x1+(o.x2-o.x1)*p,y=o.y1+(o.y2-o.y1)*p;
    const a=Math.max(0,1-o.age/o.life);
    g.strokeStyle='rgba(235,53,154,'+(a*0.65)+')';g.lineWidth=17*a+2;
    g.beginPath();g.moveTo(o.x1,o.y1);g.lineTo(x,y);g.stroke();
    g.strokeStyle='rgba(255,248,245,'+(a*.95)+')';g.lineWidth=4*a+1;
    g.beginPath();g.moveTo(o.x1,o.y1);g.lineTo(x,y);g.stroke();
    g.fillStyle='rgba(255,220,240,'+a+')';g.beginPath();g.arc(x,y,Math.max(1,8*a),0,Math.PI*2);g.fill();
    if(p===1){g.strokeStyle='rgba(255,110,206,'+(a*.8)+')';g.lineWidth=3*a;
      g.beginPath();g.arc(o.x2,o.y2,12+(1-a)*46,0,Math.PI*2);g.stroke();}
  }
  g.restore();
}
function drawSkillCutins() {
  for(const o of skillCutins){
    const p=Math.min(1,o.age/o.life),ease=1-(1-p)*(1-p),alpha=Math.pow(1-p,1.25);
    if(alpha<=0.01)continue;
    g.save();g.translate(o.x,o.y);g.globalCompositeOperation='lighter';
    const r=55+380*ease;
    g.strokeStyle=o.color;g.globalAlpha=0.5*alpha;g.lineWidth=8*(1-p)+1;
    g.beginPath();g.arc(0,-150,r,0,Math.PI*2);g.stroke();
    g.beginPath();g.arc(0,-150,r*.68,0,Math.PI*2);g.stroke();
    const img=o.hero.art&&o.hero.art.stand;
    if(img&&img.img&&img.img.ok){
      const k=o.hero.ht/img.h,scale=1+2.3*ease;
      g.globalAlpha=0.75*alpha;
      g.shadowColor=o.color;g.shadowBlur=12;
      g.drawImage(img.img,-img.ax*k*scale,-img.h*k*scale,img.w*k*scale,img.h*k*scale);
    }
    g.restore();
  }
}
function useBattleSkill() {
  if (menu || over || paused || MODAL || !curStage) return;
  const h = heroes[sel], i=sel, skillType=battleSkillType(h);
  if (!h || h.hp<=0 || i>=skillReady.length || t<skillReady[i]) return;
  if (skillType===3) {
    const targets=heroes.filter(a=>a.hp>0 && a.hp<a.max);
    if (!targets.length) { toast('회복할 아군이 없습니다'); return; }
    for(const a of targets){
      const before=a.hp;
      a.hp=Math.min(a.max,a.hp+a.max*.3);
      for(let k=0;k<15;k++)parts.push({x:a.x+(Math.random()-.5)*95,y:a.y-a.ht*(.3+Math.random()*.55),
        vx:(Math.random()-.5)*4,vy:-1.5-Math.random()*3,life:26+Math.random()*24,col:k%3?'#7fffc7':'#ffffff',s:3+Math.random()*3});
      a.hit=0;
    }
    sfx('heal');vib([40,25,75]);banners.push({t:0,txt:'전체 치료 +30%'});
  } else if (skillType===1) {
    for (const e of enemies) if (!e.dead && e.hp>0) {
      e.stun=Math.max(e.stun||0,EMP_FRAMES);
      e.tele=0; e._gwEmpUntil=t+EMP_FRAMES;
    }
    skillPulse=34;sfx('scope');vib([35,35,85]);banners.push({t:0,txt:'전자기 펄스 · 11초'});
  } else if (skillType===2) {
    if(!enemies.some(e=>!e.dead&&e.hp>0)){toast('조준할 적이 없습니다');return;}
    const m=muzzle(h);
    magicChains.push({hero:h,x:m.x,y:m.y,used:[],count:0,next:t+7});
    sfx('scope');vib([60,35,90]);banners.push({t:0,txt:'사신의 마탄 · 5연쇄'});
  } else if (skillType===0) {
    // 전역 5개 구간에 분산 투하하되, 해당 구간의 적에게 가능한 한 가까이 낙하시킨다.
    const targets=enemies.filter(e=>!e.dead&&e.hp>0);
    for(let j=0;j<5;j++){
      const middle=180+(WW-360)*(j+.5)/5;
      let nearest=null,dist=WW*.18;
      for(const e of targets){const d=Math.abs(e.x-middle);if(d<dist){dist=d;nearest=e;}}
      const x=clamp((nearest?nearest.x:middle)+(Math.random()-.5)*66,140,WW-140);
      const y=nearest?ecy(nearest):L.ey0+L.ed*(.48+.28*Math.random());
      {const owner=ROSTER.F.concat(ROSTER.M).find(r=>r.n===h.name);skillBombs.push({x,y,life:48+j*12,max:48+j*12,ownerKey:owner?owner.k:null});}
    }
    sfx('throw');vib(50);banners.push({t:0,txt:'항공 지원 · 5발'});
  } else return;
  startSkillCutin(h,skillType);
  skillReady[i]=t+SKILL_COOLDOWN;
}
function stepBattleSkills() {
  if(skillPulse>0)skillPulse--;
  for(const b of skillBombs){if(--b.life<=0){
    runBlast({x:b.x,y:b.y,R:230,mul:1.6,gy:b.y+20,src:null,ownerKey:b.ownerKey});
  }}
  skillBombs=skillBombs.filter(b=>b.life>0);
  for(const q of magicChains)if(t>=q.next&&q.count<5){
    if(!fireMagicShot(q))q.count=5;
    q.next=t+7;
  }
  magicChains=magicChains.filter(q=>q.count<5);
  for(const o of magicTrails)o.age++;
  magicTrails=magicTrails.filter(o=>o.age<o.life);
  for(const o of skillCutins)o.age++;
  skillCutins=skillCutins.filter(o=>o.age<o.life);
}
function drawBattleSkillWorld(){
  if(menu||over||!curStage)return;
  g.save();g.lineCap='round';
  // 기존 올리브색 수류탄 에셋으로 하늘에서 떨어지는 폭탄 다섯 발
  const sprite=skillBombs.length?fxi('gren'):null;
  for(const b of skillBombs){
    const p=clamp(1-b.life/b.max,0,1),fall=(1-p)**2;
    const yy=b.y-(H*.7+160)*fall,rad=15+22*p;
    g.save();g.strokeStyle='rgba(250,114,84,'+(.3+.55*p)+')';g.lineWidth=3;g.setLineDash([6,7]);
    g.beginPath();g.ellipse(b.x,b.y,rad*2,rad*.65,0,0,Math.PI*2);g.stroke();g.setLineDash([]);
    if(sprite&&sprite.ok){const hh=65,ww=hh*sprite.width/sprite.height;g.translate(b.x,yy);g.rotate(.25*Math.sin(t*.12));g.drawImage(sprite,-ww/2,-hh/2,ww,hh);}
    else{g.fillStyle='#566348';g.translate(b.x,yy);g.beginPath();g.ellipse(0,0,14,29,0,0,Math.PI*2);g.fill();g.fillStyle='#b3a56e';g.fillRect(-12,17,24,8);}
    g.restore();
  }
  // 대상에게 부착된 번개: EMP가 끝나거나 대상이 죽을 때 제거
  const active=enemies.filter(e=>!e.dead&&e.hp>0&&e._gwEmpUntil>t);
  g.globalCompositeOperation='lighter';
  for(const e of active){
    const cx=e.x,cy=ecy(e),radius=clamp(e.k.r*sc(e)*.7,18,65);
    for(let j=0;j<3;j++){
      const a=(t*.22+j*2.1+e.x*.005),r=radius*(.65+.3*Math.sin(t*.27+j));
      const x1=cx+Math.cos(a)*r,y1=cy+Math.sin(a)*r;
      g.strokeStyle=j===0?'rgba(230,252,255,.96)':'rgba(76,195,255,.82)';
      g.lineWidth=j===0?2.7:1.8;g.beginPath();g.moveTo(x1-14,y1-18);
      g.lineTo(x1+8,y1-6);g.lineTo(x1-7,y1+6);g.lineTo(x1+16,y1+18);g.stroke();
    }
  }
  g.restore();
  drawMagicTrails();drawSkillCutins();
}
window.GW_DRAW_SKILL_WORLD=drawBattleSkillWorld;
function drawBattleSkillButton(){
  if(menu||over||paused||MODAL||!curStage)return;
  const h=heroes[sel],b=skillButtonRect();if(!h||!b)return;
  const skillType=battleSkillType(h);if(skillType<0)return;
  const ready=h.hp>0 && t>=skillReady[sel],remain=Math.max(0,skillReady[sel]-t);
  const col=SKILL_COLORS[skillType]||'#eee',percent=clamp(remain/SKILL_COOLDOWN,0,1);
  g.save();
  g.shadowColor=ready?col:'transparent';g.shadowBlur=ready?15:0;
  g.fillStyle=ready?'rgba(27,20,37,.94)':'rgba(20,20,25,.83)';
  g.beginPath();g.arc(b.cx,b.cy,b.r,0,7);g.fill();
  g.shadowBlur=0;g.strokeStyle=ready?col:'#5d5d65';g.lineWidth=4;
  g.beginPath();g.arc(b.cx,b.cy,b.r-2,0,7);g.stroke();
  if(!ready){g.fillStyle='rgba(0,0,0,.55)';g.beginPath();g.moveTo(b.cx,b.cy);
    g.arc(b.cx,b.cy,b.r-4,-Math.PI/2,-Math.PI/2+2*Math.PI*percent);g.closePath();g.fill();}
  // 기존 고딕 아이콘을 현재 임시 버튼 크기에 맞춰 같은 위치에 표시한다.
  // 공습: 사용자가 올린 불꽃 그림과 동일한 ic_flame, 감전/저격/회복은 보유 에셋.
  const iconName=['ic_flame','ic_bolt','ic_aim','ic_cross'][skillType];
  const skillImg=ui(iconName);
  if(skillImg.ok){
    const sz=b.r*2*.94;
    g.drawImage(skillImg,b.cx-sz/2,b.cy-sz/2,sz,sz);
  }else{
    g.fillStyle=ready?'#fff':'#aaa';g.textAlign='center';
    g.font='bold '+(portrait?21:19)+'px sans-serif';g.fillText('필살기',b.cx,b.cy+4);
  }
  if(!ready){
    g.fillStyle='rgba(0,0,0,.42)';
    g.beginPath();g.arc(b.cx,b.cy,b.r-6,0,Math.PI*2);g.fill();
    g.fillStyle='#fff';g.textAlign='center';g.font='bold '+(portrait?21:19)+'px sans-serif';
    g.fillText(String(Math.ceil(remain/60)),b.cx,b.cy+8);
  }
  g.textAlign='center';g.fillStyle=col;
  g.font='bold '+(portrait?14:12)+'px sans-serif';
  g.fillText(SKILL_NAMES[skillType]||'스킬',b.cx,b.cy+b.r+17);
  g.restore();
  addHit(b.x,b.y,b.w,b.h,useBattleSkill);
}
function drawBattleSkillPulse(){
  if(!skillPulse||menu||over)return;
  const p=skillPulse/34;g.save();g.globalCompositeOperation='lighter';
  g.fillStyle='rgba(105,184,255,'+(p*.2)+')';g.fillRect(0,0,W,H);
  g.strokeStyle='rgba(179,234,255,'+(p*.8)+')';g.lineWidth=3;
  for(let i=0;i<8;i++){const y=H*(i+.5)/8;
    g.beginPath();g.moveTo(0,y);for(let x=40;x<=W;x+=40)
      g.lineTo(x,y+Math.sin(x*.06+i+t*.3)*25*p);g.stroke();}
  g.restore();
}

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
  if(!over && curStage)stepBattleSkills();
  if (!over && ST.limit && t >= ST.limit) { over = true; won = false; timeUp = true; sfx('over'); vib([100, 60, 200]); }
  if (over && !was) onBattleEnd();
};
draw = function () {
  HIT.length = 0; _draw(); if (!menu && !over) { drawBattleSkillPulse(); drawHud(); drawBattleSkillButton(); if (MODAL) drawModal(); drawToast(); }
};
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (menu && scene === 'dialogue' && (k === 'enter' || k === ' ')) { dlAdvance(); e.preventDefault(); }
  if (!menu && !over && k === 'q' && !e.repeat) { useBattleSkill(); e.preventDefault(); }
  if (!menu && !over && (k === 'p' || k === 'escape')) { paused = !paused; fireHeld = false; }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && !menu && !over && curStage) { paused = true; fireHeld = false; } });
window.GW = { openParty, get PS() { return PS; }, beginStage, poolOf, LINES,
  leveling:{maxLevel:LV_CAP,growth:LV_GROWTH,level:heroLevel,totalXP:totalHeroXP,thresholds:LV_THRESH,xpToNext:key=>heroLevel(key)>=LV_CAP?0:LV_THRESH[heroLevel(key)]-totalHeroXP(key),multiplier:levelMultiplier,recommended:stageRecommendedLevel,grantXP:grantHeroXP}, get SV() { return SV; }, save: saveNow, go, openLines, openStages, params, DIFF, STAR_T, DATA, epData, get scene() { return scene; }, get res() { return res; }, get paused() { return paused; }, rollGear, openInv, equip, sumMods, get RW() { return RW; },
  get skillCooldowns(){return skillReady.map(v=>Math.max(0,v-t));}, useSkill:useBattleSkill,
  win(n) { won = true; over = true; t = Math.round(ST.limit * (n === 3 ? 0.3 : n === 2 ? 0.6 : 0.9)); onBattleEnd(); }, DEV };
})();

