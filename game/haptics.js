/* GENDER WARFARE shared haptics — one owner for main and mech. */
(function(root){
'use strict';
if(root.GW_HAPTICS)return;
let enabled=true,holdUntil=0,holdPriority=-1,lastRequest=-1000,pending=null;
const state={code:'idle',message:'진동 테스트를 눌러 주세요',accepted:0,rejected:0,lastPattern:[],returned:null};
const clock=()=>performance.now();
function environment(){let embedded=false,crossOrigin=null;try{embedded=!!root.top&&root.top!==root;if(embedded){void root.top.location.href;crossOrigin=false;}}catch(_){embedded=true;crossOrigin=true;}
 const activation=navigator.userActivation;const nativeApi=!!(root.GWBridge&&typeof root.GWBridge.vibrate==='function');return {api:nativeApi||typeof navigator.vibrate==='function',nativeApi,activated:activation?!!activation.hasBeenActive:null,hidden:!!document.hidden,embedded,crossOrigin,protocol:typeof location==='object'?location.protocol||'':''};}
function mark(code,message,returned=null){state.code=code;state.message=message;state.returned=returned;return false;}
function normalise(input){const list=Array.isArray(input)?input:[input];return list.slice(0,99).map(n=>Math.max(0,Math.min(10000,Math.floor(Number(n)||0))));}
function failure(env,error){if(error)return mark('error','진동 호출 오류: '+String(error.message||error).slice(0,90),false);
 if(env.activated===false)return mark('activation','손을 뗄 때 진동을 다시 요청합니다',false);
 const context=env.embedded?' · 내장 화면':'';return mark('rejected','진동 API가 false 반환'+context+' · 활성화 '+(env.activated===null?'확인 불가':env.activated?'됨':'안 됨'),false);}
function request(input,priority=0,options={}){const pattern=normalise(input),duration=pattern.reduce((a,b)=>a+b,0),env=environment(),now=clock();
 if(!duration)return stop();
 if(!enabled)return mark('off','진동 OFF');
 if(env.hidden)return mark('hidden','백그라운드에서는 진동을 멈춥니다');
 if(!env.api)return mark('unsupported','이 화면에는 진동 API가 없습니다');
 priority=Math.max(0,Math.min(3,Math.floor(Number(priority)||0)));
 // Repeated shots/kills may not cancel a skill, hit, or test already in progress.
 if(!options.force&&now<holdUntil&&priority<=holdPriority)return false;
 if(!options.force&&priority===0&&now-lastRequest<120)return false;
 state.lastPattern=pattern.slice();
 try{let returned=false;state.backend='web';state.nativeResult=null;
  if(env.nativeApi){try{state.nativeResult=root.GWBridge.vibrate(pattern.join(','));if(state.nativeResult==='ok'){returned=true;state.backend='native';}}catch(error){state.nativeResult='error:'+String(error.message||error);}}
  if(!returned&&typeof navigator.vibrate==='function')returned=navigator.vibrate(Array.isArray(input)?pattern:pattern[0]);state.returned=returned;
  if(returned!==true){state.rejected++;if(env.activated===false||options.test){if(!pending||priority>=pending.priority)pending={input:pattern,priority,test:!!options.test};}return failure(env);}
  state.accepted++;state.code='accepted';state.message=(state.backend==='native'?'안드로이드 직접 진동':'웹 진동')+(options.test?' 테스트':'')+' 요청 수락 · 실제 모터 동작은 확인이 필요합니다';
  pending=null;lastRequest=now;holdPriority=priority;holdUntil=now+duration;return true;
 }catch(error){state.rejected++;return failure(env,error);}}
function stop(){pending=null;holdUntil=0;holdPriority=-1;try{root.GWBridge?.vibrate?.('0');}catch(_){}try{if(typeof navigator.vibrate==='function')navigator.vibrate(0);}catch(_){}return true;}
function setEnabled(value){enabled=!!value;if(!enabled){stop();mark('off','진동 OFF');}return enabled;}
function test(){setEnabled(true);return request([500,120,650],3,{force:true,test:true});}
function trustedInput(event){if(!event.isTrusted)return;
 if(pending){const job=pending;pending=null;request(job.input,job.priority,{force:true,test:job.test});}}
// Window capture runs before the options window's stopImmediatePropagation.
root.addEventListener?.('pointerup',trustedInput,true);
root.addEventListener?.('touchend',trustedInput,true);
root.addEventListener?.('keydown',trustedInput,true);
document.addEventListener?.('visibilitychange',()=>{if(document.hidden)stop();});
root.GW_HAPTICS={request,stop,test,setEnabled,onUserInput:trustedInput,get enabled(){return enabled;},get status(){return {...state,lastPattern:state.lastPattern.slice(),...environment()};}};
})(window);
