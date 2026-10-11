/* Scenario objectives share the existing bullets, cover, damage and settlement. */
(()=>{'use strict';
let run=null;const images={},blurred={};
function image(name){return images[name]||(images[name]=loadImg(name));}
function config(ch,no){return window.GW_MISSION_DATA?.[ch+'-'+no]||{mode:'normal',label:'섬멸',required:[],targets:[]};}
function split(e,c){const n=c.mid?Math.max(1,Math.floor(e.before.length/2)):e.before.length;return {before:e.before.slice(0,n),mid:e.before.slice(n)};}
function begin(cs){let c={...config(cs.ch,cs.no)};const chapter=cs.ch==='C11'?6:Number(cs.ch.slice(1));
 run={c,cs,stage:0,destroyed:0,event:false,resuming:0,protected:null,targets:[],broken:[],oldBg:bgB};
 const rate=chapter<=1?1:chapter===2?.85:.75;
 ST.fMin=Math.round(ST.fMin*rate);ST.fVar=Math.round(ST.fVar*rate);ST.maxAlive+=chapter>=3?Math.min(2,chapter-2):0;
 if(c.duration)ST.limit=(c.duration+(['capture','rescue','engineer'].includes(c.mode)?120:0))*60;
 cs.P.st.limit=ST.limit;
 if(c.mode==='normal'&&['정밀 저지','저격수 저지','옥상 추적','옛 전우 대치','방어선 돌파'].includes(c.label)){c={...c,mode:'destroy',targets:c.label==='옛 전우 대치'?['old_mhuman','old_mwolf']:['officer'],duration:180};run.c=c;ST.limit=180*60;}
 if(c.mode==='protect')addProtected(c.hangar?'mecha':'facility');
 if(c.mode==='destroy'||c.mode==='rescue'||c.mode==='capture')addTargets(c.targets);
 if(c.mode==='boss'&&c.id!=='C11-10')addTargets([c.targets[0]]);
 if(c.mode==='capture'&&c.forbidden){const r=ROSTER.F.concat(ROSTER.M).find(r=>r.k===c.forbidden);if(r){EI['mission_person']=r.face;run.targets[0].k={...run.targets[0].k,img:'mission_person',h:400};}}
 cs.P.st.limit=ST.limit;
 if(c.hangar){image('hangar_'+cs.side+'.webp');image('e_'+(cs.side==='F'?'mech_golem2':'wm_golem2')+'.png');}
}
function addProtected(kind){const max=ST.edmg*(kind==='mecha'?32:26);run.protected={kind,x:WW*.55,y:H*.78,ht:160,hp:max,max,hit:0,m:{eva:0,def:.2},cv:null};}
function addTargets(names){for(let i=0;i<names.length;i++){const name=names[i],f=run.cs.side==='M'?'M':'F',n=['turret','cooler','core'].includes(name)?name+'_normal':name+'_'+f;
 let k={img:'mission_'+n,h:360,f:.65,cyf:.5,r:70,nocv:true,target:true,hov:0};if(name==='officer'){k={...KN[1%KN.length],target:false};}else if(name.startsWith('old_')){const r=ROSTER.F.concat(ROSTER.M).find(r=>r.k===name.slice(4));if(r){EI['mission_'+name]=r.face;k={...k,img:'mission_'+name,target:false};}}const max=ST.ehp*(run.c.mode==='boss'?8:4);
 const e={k,x:WW*(names.length>1?.35+i*.16:.5),d:.5,dj:0,tier:0,tn:1e9,fireCd:1e9,hp:max,max,bs:1,cv:null,tele:0,missionTarget:true};if(name==='officer'||name.startsWith('old_'))e.fireCd=90;run.targets.push(e);enemies.push(e);eimg(k.img);}}
function targetKilled(e){if(!run)return;if(e.boss)run.bossDefeated=true;if(!e.missionTarget)return;run.destroyed++;run.broken.push({name:e.k.img.replace('_normal','_broken'),x:e.x});}
function endless(){return !!run&&['protect','survive','engineer','capture','rescue'].includes(run.c.mode);}
function permitsCoreWin(){return !run||run.c.mode==='normal';}
function success(){over=true;won=true;}
function failure(why){over=true;won=false;run.failure=why;}
function event(force=false,message='목표가 변경되었습니다. 다음 작전을 진행하세요.'){if(run.event&&!force)return;const lines=run.event?[{who:'작전 통신',text:message}]:split(window.GW.epData(run.cs.ch,run.cs.no),run.c).mid;run.event=true;
 fireHeld=false;stick.on=false;stick.dx=stick.dy=0;Object.keys(key).forEach(k=>delete key[k]);window.GW_DOMINANCE?.flush();
 run.dialogue=true;window.GW_MISSION_DIALOGUE(lines,()=>{run.dialogue=false;run.resuming=60;fireHeld=false;prevFire=false;Object.keys(key).forEach(k=>delete key[k]);});}
function beforeStep(){if(run?.resuming>0){run.resuming--;return false;}return true;}
function tick(){if(!run||over)return;const c=run.c,secs=t/60;
 if(!run.event&&c.mid&&(secs>=Math.min(25,(c.duration||120)*.25)||score>=ST.goal*.4))event();
 if(menu)return;
 if(c.mode==='survive'&&secs>=130&&!run.protected){addProtected('mecha');event(true,'아군 메카 도착. 적의 집중 공격으로부터 보호하세요.');}
 if(c.mode==='engineer'&&secs>=90&&!run.protected){addProtected('mecha');event(true,'아군 메카 도착. 적의 집중 공격으로부터 보호하세요.');}
 if(run.protected?.hp<=0)return failure('보호 대상 파괴');
 if(run.protected&&t%180===0&&heroes.some(h=>h.hp>0&&h.c===3))run.protected.hp=Math.min(run.protected.max,run.protected.hp+run.protected.max*.015);
 if(c.id==='C11-10'&&!run.targets.length&&run.bossDefeated){addTargets(['core']);event(true,'여왕의 방어가 무너졌습니다. 노출된 코어를 파괴하세요.');}
 if(c.mode==='boss'&&run.targets.length&&run.targets.every(e=>e.dead)){if(c.id==='C11-10'){success();return;}if(run.stage<c.targets.length)run.stage++;if(run.stage<c.targets.length){addTargets([c.targets[run.stage]]);event(true,'부위 파괴 확인. 다음 구역으로 이동합니다.');}else if(ST.spawned>=ST.goal&&enemies.every(e=>e.dead)){success();}}
 if(c.mode==='destroy'&&run.destroyed>=c.targets.length)success();
 if(['capture','rescue'].includes(c.mode)&&run.destroyed>=c.targets.length&&!run.protected){addProtected('capsule');run.until=t+c.duration*60;event(true,c.mode==='rescue'?'포로 위치 확인. 추격대를 막으며 철수하세요.':'이송 준비 완료. 보호 대상을 엄호하세요.');}
 if(['capture','rescue'].includes(c.mode)&&run.until&&t>=run.until)success();
 if(c.mode==='engineer'&&secs>=c.duration&&!run.stage){run.stage=1;addTargets(['core']);event(true,'해체 완료. 노출된 본체를 파괴하세요.');}if(c.mode==='engineer'&&run.destroyed>0)success();
 if(['protect','survive'].includes(c.mode)&&secs>=c.duration)success();
 const progress=c.mode==='normal'?score/ST.goal:Math.min(1,secs/(c.duration||ST.limit/60));run.pressure=progress>=2/3&&Number(run.cs.ch.slice(1))>=2?.8:1;
}
function redirect(e){if(!run?.protected||e.k.target||run.protected.hp<=0)return false;e._missionShots=(e._missionShots||0)+1;if(e._missionShots%3!==0)return false;
 const h=run.protected,mz=emz(e,e.k.fire||e.k.img);ebul.push({sx:mz.x,sy:mz.y,tx:h.x,ty:h.y-80,p:0,h,dm:.8});e.ff=6;return true;}
function background(c,x,w,h){if(!run?.c.hangar)return false;const src=image('hangar_'+run.cs.side+'.webp');if(!src.ok)return false;
 let bg=blurred[run.cs.side];if(!bg){bg=document.createElement('canvas');bg.width=src.width;bg.height=src.height;const b=bg.getContext('2d');b.filter='blur(3px)';b.drawImage(src,0,0);blurred[run.cs.side]=bg;}
 const level=Math.min(2,run.stage),shift=(1-level)*45;c.drawImage(bg,x,-60+shift,w,h+120);
 const im=image('e_'+(run.cs.side==='F'?'mech_golem2':'wm_golem2')+'.png');if(im.ok){const sy=Math.max(0,im.height*(2-level)/3-im.height*.04),sh=Math.min(im.height-sy,im.height*.41);c.drawImage(im,0,sy,im.width,sh,x+w*.31,h*.10,w*.40,h*.65);}return true;}
function draw(){if(!run||menu||window.GW?.paused)return;g.save();g.textAlign='left';g.textBaseline='alphabetic';g.shadowColor='rgba(0,0,0,.9)';g.shadowBlur=3;g.shadowOffsetY=1;
 const objective=run.c.mode==='normal'?'적 '+ST.goal+'명 처치':run.c.mode==='boss'?'부위 '+Math.min(run.stage+1,run.c.targets.length)+'/'+run.c.targets.length+' 파괴 · 잔여 적 격퇴':run.protected?'보호 대상을 지키세요':run.c.targets.length?'목표 '+Math.min(run.destroyed,run.c.targets.length)+'/'+run.c.targets.length+' 확보·파괴':'시설을 지키세요';
 g.fillStyle='#ffe3a5';g.font='bold 16px sans-serif';g.fillText(run.c.label,20,124);
 g.fillStyle='#fff';g.font='14px sans-serif';g.fillText(objective,20,144);g.shadowBlur=0;g.shadowOffsetY=0;
 for(const part of run.broken){const im=eimg(part.name);if(im.ok)g.drawImage(im,part.x-camX-75,H*.35,150,120);}
 const h=run.protected;if(h){const x=h.x-camX,y=h.y;const src=image(h.kind==='mecha'?'e_'+(run.cs.side==='F'?'wm_golem':'mech_golem')+'.png':'e_mission_capsule_'+(run.cs.side==='M'?'M':'F')+'.png');if(src.ok)g.drawImage(src,x-90,y-190,180,190);g.fillStyle='#102e28';g.fillRect(x-85,y-204,170,9);g.fillStyle='#83f7ae';g.fillRect(x-85,y-204,170*Math.max(0,h.hp/h.max),9);g.fillStyle='#beffd1';g.fillText('보호 대상',x-36,y-215);}
 if(run.resuming){g.fillStyle='rgba(0,0,0,.4)';g.fillRect(0,0,W,H);g.fillStyle='#fff';g.font='bold 32px sans-serif';g.fillText('전투 재개',W/2-70,H*.35);}
 const remaining=heroes.map(h=>h.dominanceKey?window.GW_DOMINANCE?.value(h.dominanceKey)||0:0);if(remaining.some(v=>v>0)){g.font='15px sans-serif';g.fillStyle='#ffd479';g.fillText('지배욕 강화 +20% · '+remaining.map(v=>Math.ceil(v)).join(' / '),24,175);}g.restore();}
function stars(){if(!run||run.c.mode==='normal'||['destroy','boss'].includes(run.c.mode))return null;const hp=run.protected?run.protected.hp/run.protected.max:Math.min(...heroes.filter(h=>h.hp>0).map(h=>h.hp/h.max));return hp>=.7&&heroes.every(h=>h.hp>0)?3:hp>=.35?2:1;}
function finish(){window.GW_DOMINANCE?.flush();}
window.GW_MISSIONS={config,split,begin,tick,beforeStep,targetKilled,endless,permitsCoreWin,redirect,background,draw,stars,finish,get remainingFrames(){return run?.until?Math.max(0,run.until-t):Math.max(0,ST.limit-t);},get pressure(){return run?.pressure||1;},get failure(){return run?.failure;},get run(){return run;}};
})();
