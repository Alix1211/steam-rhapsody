/* Star-synced slap results with existing faction voices and continuous music fades. */
(function(root){
'use strict';
let ctx=null,finishAt=-Infinity,holdUntil=0,stingerBus=null,resultTimer=null;
// Adopt the game's context, unlocked by the launch tap, instead of creating one at settlement.
function unlock(existing){
 if(existing&&existing.state!=='closed')ctx=existing;
 try{if(!ctx){const C=root.AudioContext||root.webkitAudioContext;if(C)ctx=new C();}ctx?.resume()?.catch(()=>{});}catch(_){}
}
const stingers={};
for(const key of ['victory','defeat','finale']){const a=new Audio('audio/results/'+key+'.wav');a.preload='auto';stingers[key]=a;}
const comic={};
for(const faction of ['F','M'])for(let n=1;n<=3;n++){const a=new Audio('audio/results/victory_'+faction+'_'+n+'.wav');a.preload='auto';comic[faction+'_'+n]=a;}
function finish(won,finale=false,settings={}){
 finishAt=performance.now();clearTimeout(resultTimer);
 for(const a of [...Object.values(stingers),...Object.values(comic)])a.pause();
 const n=Math.max(1,Math.min(3,Math.round(settings.resultStars||1))),faction=settings.faction==='M'?'M':'F';
 const delay=won?(settings.resultDelay??1.25):0;
 holdUntil=finishAt+(delay+(won?(n-1)*.45+1.7:1.65))*1000;
 if(settings.sound===false)return;
 const a=won?comic[faction+'_'+n]:stingers.defeat;stingerBus=a;
 a.currentTime=0;a.volume=Math.max(0,Math.min(1,.95*(settings.sfx??1)));
 resultTimer=setTimeout(()=>{if(!document.hidden&&a.volume>0)a.play().catch(()=>{});},delay*1000);
}
function musicPlayer(){
 let current=null,old=null,key='',transitionAt=0,volume=0,enabled=false,duck=1,lastVolumeAt=0;
 function tick(){const q=Math.min(1,(performance.now()-transitionAt)/1000),v=enabled?volume*duck:0;
  if(current)current.volume=Math.max(0,Math.min(1,v*q));
  if(old){old.volume=Math.max(0,Math.min(1,(old._fadeVolume||0)*(1-q)));if(q>=1){old.pause();old=null;}}
  if(q<1)requestAnimationFrame(tick);
 }
 return {set(next,src,v,on){volume=v;enabled=!!on;duck=performance.now()<holdUntil?.28:1;
  if(!enabled){current?.pause();old?.pause();if(current)current.volume=0;if(old)old.volume=0;return;}
  if(next!==key){old?.pause();old=current;if(old)old._fadeVolume=old.volume;current=new Audio(src);current.loop=true;current.preload='none';current.volume=0;key=next;transitionAt=performance.now();tick();}
  const q=Math.min(1,(performance.now()-transitionAt)/1000);if(current){const desired=Math.max(0,Math.min(1,volume*duck*q)),fade=Math.min(1,Math.max(0,performance.now()-lastVolumeAt)/350);current.volume+=(desired-current.volume)*fade;lastVolumeAt=performance.now();if(current.paused)current.play().catch(()=>{});}
 },pause(){enabled=false;current?.pause();old?.pause();},get key(){return key;},get current(){return current;}};
}
root.GW_PRESENTATION={finish,unlock,musicPlayer,setVolume(on,value=1){if(stingerBus)stingerBus.volume=on?Math.max(0,Math.min(1,.95*value)):0;},get age(){return performance.now()-finishAt;},get active(){return performance.now()<holdUntil;}};
})(window);
