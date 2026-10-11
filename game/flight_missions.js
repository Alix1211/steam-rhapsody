/* Flight objectives, pressure and short mission communications. */
(()=>{'use strict';let run=null,dialog=null,resumeUntil=0;const sprite=new Image();sprite.src='e_mech_golem2.png';const spriteF=new Image();spriteF.src='e_wm_golem2.png';
const originalPlan=currentPlan;currentPlan=function(){const p=originalPlan();return selectedMission===8&&variant===0?{...p,duration:200,boss:[60,135,195],name:'총공세 200초 방어'}:selectedMission===9&&variant===1?{...p,name:'공병 메카 철수 엄호'}:p;};
const resetM=reset;reset=function(){resetM();const survival=selectedMission===8&&variant===0,escort=selectedMission===9&&variant===1;
 run={mode:survival?'survive':escort?'protect':'normal',ally:null,event:false};dialog=null;resumeUntil=0;
 if(survival)plan={...plan,duration:200,boss:[60,135,195],name:'총공세 200초 방어'};
 if(escort){run.ally={x:W*.38,y:445,hp:450,max:450};plan={...plan,name:'공병 메카 철수 엄호'};}
};
function communicate(text){dialog=text;keys={};release();window.parent.GW_DOMINANCE?.flush();}
function dismiss(){dialog=null;resumeUntil=performance.now()+1000;keys={};release();}
const createM=createEnemy;createEnemy=function(boss=false){createM(boss);const e=enemies[enemies.length-1];const rate=selectedMission<=2?1:selectedMission<=4?.85:.75;e.cd*=rate;if(selectedMission>=5&&!boss&&Math.random()<.3)e.pattern='rocket';};
const fireM=enemyFire;enemyFire=function(e){fireM(e);const rate=selectedMission<=2?1:selectedMission<=4?.85:.75;e.cd*=rate;if(e.boss&&selectedMission>=5){const phase=e.hp/e.max<.35?2:e.hp/e.max<.7?1:0;e.cd*=1-phase*.12;if(phase>0){const aim=Math.atan2(hero.y-e.y,hero.x-e.x);for(let j=-phase;j<=phase;j++)pellet(e,aim+j*.20,180+phase*20);}}};
const waveM=advanceWaves;advanceWaves=function(dt){const before=spawn;waveM(dt);if(time>=plan.duration*2/3&&selectedMission>=3&&spawn>before)spawn*=.8;};
const pelletM=pellet;pellet=function(e,a,s,type='normal'){e._missionShots=(e._missionShots||0)+1;const target=run?.ally&&e._missionShots%3===0;if(target)a=Math.atan2(run.ally.y-e.y,run.ally.x-e.x);pelletM(e,a,s,type);if(target)hostile[hostile.length-1].allyShot=true;};
function tick(dt){if(!run||state!=='playing')return;
 if(run.mode==='survive'&&time>=130&&!run.ally){run.ally={x:W*.38,y:445,hp:450,max:450};communicate('아군 메카 도착. 남은 시간 동안 함께 방어선을 지키세요.');}
 if(run.ally){for(const b of hostile)if(b.t>0&&Math.hypot(b.x-run.ally.x,b.y-run.ally.y)<65){run.ally.hp-=b.damage;b.t=0;}if(run.ally.hp<=0){state='lost';note('아군 메카 파괴 · 임무 실패');release();return;}}
 if(!run.event&&time>=25&&run.mode==='protect'){run.event=true;communicate('공병 메카가 철수 중입니다. 접근하는 적을 우선 저지하세요.');}
 if(run.mode==='survive'&&time>=200){state='won';release();settleVictory();syncMusic();}
}
const drawM=draw;draw=function(){drawM();if(state!=='playing')return;g.save();if(run?.ally){const h=run.ally,im=faction==='F'?spriteF:sprite;if(im.naturalWidth)g.drawImage(im,h.x-85,h.y-160,170,200);bar(h.x-80,h.y-180,160,9,h.hp/h.max,'#98ffd0');text('아군 메카 보호',h.x,h.y-199,16,'#bdffdb','center');}
 if(run?.mode==='survive')text('200초 방어 · 남은 '+Math.ceil(Math.max(0,200-time))+'초',W/2,106,20,'#ffe7a8','center');
 if(dialog||performance.now()<resumeUntil){box(0,0,W,H,'#08080ce0');text(dialog||'전투 재개',W/2,H*.43,21,'#fff0d0','center');if(dialog)text('터치하면 계속',W/2,H*.54,17,'#b7d7ff','center');menuHits=[];}
 const values=roster.map(r=>Math.ceil(window.parent.GW_DOMINANCE?.value(r.id)||0));if(values.some(n=>n>0))text('지배욕 +20% · '+values.join(' / '),W-28,143,15,'#ffe5a2','right');g.restore();};
cv.addEventListener('pointerdown',e=>{if(dialog||performance.now()<resumeUntil){e.preventDefault();e.stopImmediatePropagation();if(dialog)dismiss();}},true);
addEventListener('keydown',e=>{if(dialog||performance.now()<resumeUntil){e.preventDefault();e.stopImmediatePropagation();if(dialog&&['Enter','Space'].includes(e.code))dismiss();}},true);
window.GW_FLIGHT_MISSIONS={tick,permitsWin:()=>run?.mode!=='survive',get blocked(){return !!dialog||performance.now()<resumeUntil;},get run(){return run;},dismiss};
})();
