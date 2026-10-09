/* GENDER WARFARE — 오디오/BGM·사망 음성·옵션창. 원본 소스와 별도 관리. */
(function(){
'use strict';
const AUDIO_SETTINGS_KEY='gw_audio_settings_v1';
const BGM_FILES={female_theme:'female_theme.mp3',female_battle:'female_battle.mp3',
  male_theme:'male_theme.mp3',male_battle:'male_battle.mp3',demon:'demon.mp3'};
const VOICE_FILES={male:'male_deaths.ogg',female:'female_deaths.ogg'};
const SEGMENTS={
 male:[[.446,1.542],[3.904,2.271],[6.886,.556],[8.301,.956],[10.046,2.193],[14.405,1.768],
 [17.386,1.311],[20.299,1.687],[23.825,1.943],[27.53,1.024],[29.806,.604],[31.45,1.136],
 [33.489,1.396],[35.919,1.473],[38.77,.74],[40.345,.765],[42.162,1.448],[44.893,1.143],[47.332,1.609]],
 female:[[.387,.819],[2.05,.736],[3.669,.529],[4.9,1.277],[7.291,.881],[9.339,1.021],[11.642,.972]]
};
const cfg={effects:true,sound:true,vibration:true,sfx:1,bgm:.24};
try{const x=JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY)||'{}');
 for(const k of Object.keys(cfg))if(typeof x[k]===typeof cfg[k])cfg[k]=x[k];
 cfg.sfx=Math.max(0,Math.min(1,cfg.sfx));cfg.bgm=Math.max(0,Math.min(1,cfg.bgm));
}catch(e){}
let optionsOpen=false,sliderDrag=null;
window.GW_EFFECTS_ON=cfg.effects;
soundOn=cfg.sound;vibOn=cfg.vibration;
function persist(){
 try{localStorage.setItem(AUDIO_SETTINGS_KEY,JSON.stringify(cfg));}catch(e){}
}
const music=new Audio();music.loop=true;music.preload='none';
let musicKey='',loadedVoices={},voicePending={},liveVoices=0,lastDeath=0;
function configure(){
 soundOn=cfg.sound;vibOn=cfg.vibration;window.GW_EFFECTS_ON=cfg.effects;
 if(AC&&master)master.gain.value=cfg.sound ? 0.85*cfg.sfx : 0;
 music.volume=cfg.sound?cfg.bgm:0;
 if(!cfg.sound)music.pause();
 else if(musicKey&&music.paused)music.play().catch(()=>{});
}
const originalInitAudio=initAudio;
initAudio=function(){
 originalInitAudio();configure();preloadVoices();syncMusic();
};
function preloadVoices(){
 if(!AC)return;
 for(const sex of Object.keys(VOICE_FILES)){
  if(loadedVoices[sex]||voicePending[sex])continue;
  const path='audio/voice/'+VOICE_FILES[sex];
  voicePending[sex]=fetch(path).then(r=>{if(!r.ok)throw Error('voice '+r.status);return r.arrayBuffer()})
   .then(buf=>AC.decodeAudioData(buf)).then(decoded=>{loadedVoices[sex]=decoded;})
   .catch(()=>{}).finally(()=>{voicePending[sex]=null;});
 }
}
function deathSex(e){
 // F 전선 적(kn/mech)은 남성, M 전선 적(wk/wm)은 여성. 마계 혼성도 적 스프라이트로 구분.
 const img=String(e&&e.k&&e.k.img||'');
 if(img.startsWith('wk_')||img.startsWith('wm_'))return 'female';
 if(img.startsWith('kn_')||img.startsWith('mech_'))return 'male';
 return side==='M'?'female':'male';
}
window.sfxDeath=function(e){
 if(!cfg.sound)return;
 const now=performance.now(),sex=deathSex(e),buf=loadedVoices[sex];
 if(!AC||!buf){sfx('hurt');return;}
 if(liveVoices>=2||now-lastDeath<100)return;
 lastDeath=now;
 const list=SEGMENTS[sex],part=list[Math.floor(Math.random()*list.length)];
 try{
  const src=AC.createBufferSource();src.buffer=buf;
  const vol=AC.createGain();vol.gain.value=.65;
  src.connect(vol);vol.connect(master);
  const duration=Math.min(part[1],Math.max(.01,buf.duration-part[0]));
  liveVoices++;src.onended=()=>{liveVoices=Math.max(0,liveVoices-1);};
  src.start(0,part[0],duration);
 }catch(e){}
};
function chosenBgm(){
 // meta.js의 curStage는 별도 IIFE의 지역 변수라 여기서 직접 참조할 수 없다.
 // 전투 여부는 공개된 GW.scene, 진영은 전투 코어의 side를 기준으로 판단한다.
 const fighting=!menu && !!window.GW && window.GW.scene==='battle';
 const faction=fighting?side:
   (window.GW&&window.GW.SV&&window.GW.SV.last?window.GW.SV.last.side:'F');
 if(faction==='C')return 'demon';
 return (faction==='M'?'male_':'female_')+(fighting?'battle':'theme');
}
function syncMusic(){
 const key=chosenBgm();
 if(key!==musicKey){
  musicKey=key;music.pause();music.src='audio/bgm/'+BGM_FILES[key];music.load();
 }
 configureMusicVolume();
 if(cfg.sound && AC&&music.paused && !optionsOpen)music.play().catch(()=>{});
}
function configureMusicVolume(){music.volume=cfg.sound?cfg.bgm:0;}
const audioDraw=draw,audioUpdate=update;
update=function(){if(optionsOpen)return;audioUpdate();};
let drawCounter=0;
draw=function(){
 audioDraw();
 if((++drawCounter%40)===0)syncMusic();
 drawOptionButton();
 if(optionsOpen)drawOptionWindow();
};
function buttonRect(){return{x:W-166,y:8,w:45,h:34};}
function drawOptionButton(){
 const c=mainG,b=buttonRect();c.save();
 c.fillStyle='rgba(34,27,39,.94)';c.fillRect(b.x,b.y,b.w,b.h);
 c.strokeStyle='#c9a97f';c.lineWidth=1.4;c.strokeRect(b.x,b.y,b.w,b.h);
 c.font='bold 15px sans-serif';c.textAlign='center';c.fillStyle='#fff1d8';c.fillText('설정',b.x+b.w/2,b.y+23);c.restore();
}
function uiGeometry(){
 const w=Math.min(W-40,530),h=Math.min(H-40,514),x=(W-w)/2,y=(H-h)/2;
 const sw=w-240,sx=x+193;
 const rows=[y+91,y+151,y+211];
 return{x,y,w,h,rows,sx,sw,sliderYs:[y+314,y+386],
   close:{x:x+w-59,y:y+15,w:43,h:40},
   done:{x:x+(w-200)/2,y:y+h-68,w:200,h:46}};
}
function boxFill(c,b,col,border){
 c.fillStyle=col;c.fillRect(b.x,b.y,b.w,b.h);
 if(border){c.strokeStyle=border;c.lineWidth=2;c.strokeRect(b.x,b.y,b.w,b.h);}
}
function inBox(p,b){return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;}
function drawOptionWindow(){
 const c=mainG,d=uiGeometry();c.save();
 c.fillStyle='rgba(0,0,0,.84)';c.fillRect(0,0,W,H);
 boxFill(c,d,'rgba(19,15,26,.97)','#c9a073');
 c.fillStyle='#fff0ce';c.textAlign='center';c.font='bold 29px sans-serif';c.fillText('옵션',W/2,d.y+46);
 boxFill(c,d.close,'#502a39','#d6b28d');c.fillStyle='#fff';c.font='bold 23px sans-serif';
 c.fillText('×',d.close.x+d.close.w/2,d.close.y+29);
 const labels=[['시각 효과',cfg.effects],['진동',cfg.vibration],['전체 사운드',cfg.sound]];
 for(let i=0;i<3;i++){
  const yy=d.rows[i];c.font='bold 19px sans-serif';c.textAlign='left';c.fillStyle='#f3e6d5';c.fillText(labels[i][0],d.x+38,yy+15);
  const b={x:d.x+d.w-143,y:yy-14,w:100,h:39};boxFill(c,b,labels[i][1]?'#75503c':'#353039','#c9ad87');
  c.font='bold 17px sans-serif';c.textAlign='center';c.fillStyle='#fff';
  c.fillText(labels[i][1]?'ON':'OFF',b.x+b.w/2,b.y+26);
 }
 const vol=[['효과음 볼륨',cfg.sfx],['배경음 볼륨',cfg.bgm]];
 for(let i=0;i<2;i++){
  const y=d.sliderYs[i],value=vol[i][1];
  c.textAlign='left';c.font='bold 18px sans-serif';c.fillStyle='#f4e6d1';c.fillText(vol[i][0],d.x+38,y+5);
  c.fillStyle='#3c3940';c.fillRect(d.sx,y-11,d.sw,17);
  c.fillStyle=i?'#b7a6e4':'#e7b467';c.fillRect(d.sx,y-11,d.sw*value,17);
  c.beginPath();c.fillStyle='#fff8e3';c.arc(d.sx+d.sw*value,y-2,13,0,7);c.fill();
  c.textAlign='right';c.font='bold 16px sans-serif';c.fillText(Math.round(value*100)+'%',d.x+d.w-26,y+5);
 }
 boxFill(c,d.done,'#6f394a','#ebbc85');
 c.fillStyle='#fff3dc';c.textAlign='center';c.font='bold 21px sans-serif';
 c.fillText('게임으로 돌아가기',d.done.x+d.done.w/2,d.done.y+30);
 c.restore();
}
function sliderSet(i,p){
 const d=uiGeometry(),v=Math.max(0,Math.min(1,(p.x-d.sx)/d.sw));
 cfg[i===0?'sfx':'bgm']=Math.round(v*100)/100;configure();persist();
}
function optionsPointer(p){
 if(inBox(p,uiGeometry().close)||inBox(p,uiGeometry().done)){optionsOpen=false;sliderDrag=null;syncMusic();return;}
 const d=uiGeometry(),ks=['effects','vibration','sound'];
 for(let i=0;i<3;i++)if(p.y>d.rows[i]-19&&p.y<d.rows[i]+34){
   cfg[ks[i]]=!cfg[ks[i]];configure();persist();if(cfg.sound)syncMusic();return;
 }
 for(let i=0;i<2;i++)if(p.y>d.sliderYs[i]-29&&p.y<d.sliderYs[i]+29){
   sliderDrag=i;sliderSet(i,p);return;
 }
}
cv.addEventListener('pointerdown',function(e){
 const p=pos(e);
 if(optionsOpen){e.preventDefault();e.stopImmediatePropagation();sliderDrag=null;optionsPointer(p);return;}
 if(inBox(p,buttonRect())){
  e.preventDefault();e.stopImmediatePropagation();initAudio();optionsOpen=true;fireHeld=false;stick.on=false;stick.dx=stick.dy=0;return;
 }
},true);
cv.addEventListener('pointermove',function(e){
 if(!optionsOpen)return;
 e.stopImmediatePropagation();
 if(sliderDrag!==null)sliderSet(sliderDrag,pos(e));
},true);
for(const event of ['pointerup','pointercancel'])cv.addEventListener(event,function(e){
 if(!optionsOpen)return;e.stopImmediatePropagation();sliderDrag=null;
},true);
addEventListener('keydown',function(e){
 if((e.key==='Escape'||e.key==='Esc')&&optionsOpen){e.stopImmediatePropagation();optionsOpen=false;syncMusic();}
},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)music.pause();else if(cfg.sound)syncMusic();});
window.GW_AUDIO_OPTIONS={get settings(){return Object.assign({},cfg);},get track(){return musicKey;},
 get voiceCounts(){return {female:SEGMENTS.female.length,male:SEGMENTS.male.length};},open(){optionsOpen=true;},syncMusic};
})();