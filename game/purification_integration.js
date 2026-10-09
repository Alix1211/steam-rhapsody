/* [gpt] GENDER WARFARE prisoner purification integration. Uses the existing engine; no battle HUD. */
(()=>{
'use strict';
const F=new Set(['mmedic','mhuman','mwolf','morc']);
const M=new Set(['fox','goblin','harpy','lamia']);
const PRISONERS=new Set([...F,...M]);
const UNLOCK={melf:'M5-7',mmedic:'F1-5',mhuman:'F1-7',mwolf:'F3-4',morc:'F4-5',fox:'M1-5',goblin:'M1-7',harpy:'M3-4',lamia:'M4-5'};
function state(){const sv=window.GW?.SV;if(!sv)return null;sv.corrupt=sv.corrupt||{};sv.rampage=sv.rampage||{};return sv;}
function corruption(key){const sv=state();return PRISONERS.has(key)&&sv?Math.max(0,Math.min(45,Number(sv.corrupt[key]||0))):0;}
function percentage(key){return Math.round(corruption(key)*100/45);}
function locked(key){const sv=state();return !!(sv&&sv.rampage[key]>0);}
function stageStarted(){const sv=state();if(!sv)return;for(const key of PRISONERS)if(sv.rampage[key]>0)sv.rampage[key]--;window.GW.save();}
function onKill(enemy){const key=enemy._gwKiller;if(!PRISONERS.has(key))return;const sv=state();if(!sv||sv.rampage[key]>0)return;const before=corruption(key);if(before>=45)return;const gain=enemy.k&&enemy.k.mech?2:1;sv.corrupt[key]=Math.min(45,Math.round((before+gain)*100)/100);if(sv.corrupt[key]>=45){sv.rampage[key]=3;if(typeof toast==='function')toast('☠ '+(enemy._gwKiller||'포로')+' 폭주! 3회 출전 금지');}window.GW.save();}
window.GW_PRISON={is:key=>PRISONERS.has(key),corruption,percentage,locked,stageStarted,side:key=>F.has(key)?'F':M.has(key)?'M':null};
const oldKill=killEnemy;
killEnemy=function(enemy,nx){if(enemy&&!enemy.dead&&enemy.hp<=0)onKill(enemy);return oldKill(enemy,nx);};
const oldShoot=shoot;
shoot=function(hero,target,manual,cont){const old=bullets.length,r=oldShoot(hero,target,manual,cont);const key=ROSTER.F.concat(ROSTER.M).find(x=>x.n===hero.name)?.k||null;for(let i=old;i<bullets.length;i++)bullets[i]._gwKiller=key;return r;};
const oldMkHero=mkHero;
mkHero=function(roster,index){const hero=oldMkHero(roster,index);if(PRISONERS.has(roster.k)){hero.max=Math.round(hero.max*1.2);hero.hp=hero.max;hero.m.atk=(1+hero.m.atk)*1.2-1;hero.m.def=1-(1-hero.m.def)/1.2;}return hero;};
function unlocked(key){return PRISONERS.has(key)&&(window.GW?.DEV?.()||!UNLOCK[key]||!!window.GW?.SV?.clr?.[UNLOCK[key]]);}
function hitKey(p){
 const gw=window.GW;if(!gw)return null;
 if(gw.scene==='party'&&gw.PS){
  const pool=gw.poolOf(gw.PS.side),n=pool.length,cols=n>8?(portrait?4:8):(portrait?2:4),rows=Math.ceil(n/cols),top=92,bot=118,gap=14;
  const rawH=Math.min((H-top-bot-(rows-1)*gap)/rows,330),cw=(W-40-(cols-1)*gap)/cols,cardH=Math.min(rawH,cw*1.36);
  for(let i=0;i<n;i++){
    const r=pool[i];if(!unlocked(r.k))continue;
    const x=20+(i%cols)*(cw+gap),slotY=top+Math.floor(i/cols)*(rawH+gap),y=slotY+Math.max(0,(rawH-cardH)/2);
    const rect={x:x+cw*.15,y:y+cardH*.16,w:cw*.70,h:cardH*.54};
    if(inb(p,rect))return r.k;
  }
 }else if(gw.scene==='inv'){
  const pool=ROSTER.F.concat(ROSTER.M).filter(r=>window.GW?.DEV?.()||!UNLOCK[r.k]||!!window.GW?.SV?.clr?.[UNLOCK[r.k]]),per=portrait?8:pool.length;
  const cs=Math.min(76,(W-40-(per-1)*6)/per);
  for(let i=0;i<pool.length;i++){
    const r=pool[i];if(!unlocked(r.k))continue;
    const x=20+(i%per)*(cs+6),y=74+Math.floor(i/per)*(cs+6);
    if(inb(p,{x,y,w:cs,h:cs}))return r.k;
  }
 }
 return null;
}
let hold=null;
function stopHold(){if(hold?.timer)clearTimeout(hold.timer);const old=hold;hold=null;return old;}
function openRoom(key){
 const gw=window.GW,side=F.has(key)?'F':'M';
 if(!unlocked(key))return;
 const ps=gw.PS||{};
 try{sessionStorage.setItem('gw_purify_return',JSON.stringify({scene:gw.scene,side:ps.side,ci:ps.ci,ch:ps.ch,no:ps.no}))}catch(e){}
 const url=new URL('purification.html',location.href);url.searchParams.set('game','1');url.searchParams.set('side',side);url.searchParams.set('prisoner',key);
 location.href=url.href;
}
cv.addEventListener('pointerdown',e=>{
 const key=hitKey(pos(e));if(!key)return;
 e.preventDefault();e.stopImmediatePropagation();
 stopHold();const x=e.clientX,y=e.clientY;
 hold={id:e.pointerId,key,x,y,done:false,timer:setTimeout(()=>{if(!hold||hold.id!==e.pointerId)return;hold.done=true;openRoom(key)},650)};
},true);
cv.addEventListener('pointermove',e=>{if(!hold||hold.id!==e.pointerId)return;const d=Math.hypot(e.clientX-hold.x,e.clientY-hold.y);if(d>24){hold.done=true;if(hold.timer)clearTimeout(hold.timer);hold.timer=null}},true);
cv.addEventListener('pointerup',e=>{if(!hold||hold.id!==e.pointerId)return;e.stopImmediatePropagation();const h=stopHold();if(!h.done){initAudio();menuTap(pos(e))}},true);
cv.addEventListener('pointercancel',e=>{if(hold&&hold.id===e.pointerId)stopHold()},true);
let back=null;try{back=sessionStorage.getItem('gw_purify_return');if(back)sessionStorage.removeItem('gw_purify_return')}catch(e){}if(back){try{const d=JSON.parse(back);if(d.scene==='party'&&d.side&&d.ch&&d.no)GW.openParty(d.side,d.ci,d.ch,d.no);else if(d.scene==='inv')GW.openInv(()=>GW.go('lines'));}catch(e){}}
})();
