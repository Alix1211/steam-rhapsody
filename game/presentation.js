/* Shared result stingers and continuous music fades; no downloaded sound required. */
(function(root){
'use strict';
let ctx=null,finishAt=-Infinity,holdUntil=0,stingerBus=null;
const STINGER_VOLUME=.60;
// Adopt the game's context, unlocked by the launch tap, instead of creating one at settlement.
function unlock(existing){
 if(existing&&existing.state!=='closed')ctx=existing;
 try{if(!ctx){const C=root.AudioContext||root.webkitAudioContext;if(C)ctx=new C();}ctx?.resume()?.catch(()=>{});}catch(_){}
}
function finish(won,finale=false,settings={}){
 finishAt=performance.now();const duration=won?(finale?4.6:2.5):1.65;holdUntil=finishAt+duration*1000;
 if(settings.sound===false)return;
 try{
  if(!ctx)return;ctx.resume()?.catch(()=>{});
  const bus=ctx.createGain();stingerBus=bus;bus.gain.value=STINGER_VOLUME*(settings.sfx??1);bus.connect(ctx.destination);
  const start=ctx.currentTime+.035;
  const notes=won?[[0,60,.22],[.24,64,.22],[.48,67,.28],[.82,72,.55],[1.46,67,.16],[1.66,72,.75]]:[[0,67,.25],[.27,64,.25],[.54,60,.28],[.87,48,.62]];
  if(finale&&won)notes.push([2.6,72,.22],[2.85,76,.22],[3.1,79,.22],[3.4,84,1.1]);
  for(const [offset,midi,length] of notes)for(const interval of (won?[0,-12]:[0])){
   const o=ctx.createOscillator(),gain=ctx.createGain();o.type=won?'triangle':'sine';const at=start+offset,f=440*2**((midi+interval-69)/12);
   o.frequency.setValueAtTime(f,at);if(!won)o.frequency.exponentialRampToValueAtTime(f*.84,at+length);
   gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(interval? .22:.55,at+.035);gain.gain.exponentialRampToValueAtTime(.001,at+length);
   o.connect(gain);gain.connect(bus);o.onended=()=>{o.disconnect();gain.disconnect();};o.start(at);o.stop(at+length+.025);
  }
  setTimeout(()=>bus.disconnect(),duration*1000+400);
 }catch(_){}
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
root.GW_PRESENTATION={finish,unlock,musicPlayer,setVolume(on,value=1){if(stingerBus)stingerBus.gain.value=on?STINGER_VOLUME*value:0;},get age(){return performance.now()-finishAt;},get active(){return performance.now()<holdUntil;}};
})(window);
