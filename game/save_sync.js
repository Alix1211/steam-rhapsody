/* GENDER WARFARE — 문플로 SAF + Golden Quest baseT 동기화.
 * 웹에서 실행하면 localStorage만 사용. Android GWBridge가 있을 때만 Drive 동기화.
 * 백업은 gw_* 키의 원본 문자열 묶음이며, 적용할 때 저장 시각과 내용은 변형하지 않는다.
 */
(()=>{'use strict';
 if(window.GW_SAVE_SYNC)return;
 const K='gw_save_v1',P='gw_',B=window.GWBridge,ls=window.localStorage;
 const native=!!(B&&typeof B.load==='function');
 const rawSet=Storage.prototype.setItem,rawRemove=Storage.prototype.removeItem;
 let checking=native&&typeof B.syncBackup==='function',restoring=false,conflict=false,dirty=false;
 const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 function valid(input){
  const b=typeof input==='string'?JSON.parse(input):input;
  if(!isObject(b)||Object.keys(b).some(k=>!k.startsWith(P)||typeof b[k]!=='string'))throw Error('GW bundle');
  const s=JSON.parse(b[K]);if(!isObject(s)||s.v!==1||!isObject(s.clr)||!isObject(s.seen)||
    !isObject(s.party)||!Array.isArray(s.gear)||!isObject(s.eq)||
    (s.heroXP!==undefined&&!isObject(s.heroXP))||(s.corrupt!==undefined&&!isObject(s.corrupt))||
    (s.rampage!==undefined&&!isObject(s.rampage))||
    (s.t!==undefined&&(!Number.isSafeInteger(s.t)||s.t<0)))throw Error('GW save');
  return b;
 }
 function time(b){try{return JSON.parse(valid(b)[K]).t||0}catch(e){return -1}}
 function snapshot(){const o={};for(let i=0;i<ls.length;i++){const k=ls.key(i);if(k&&k.startsWith(P))o[k]=ls.getItem(k)}return o}
 function latest(a,b){const at=time(a),bt=time(b);return at<0?(bt<0?null:b):(bt>at?b:a)}
 function apply(raw){
  const b=valid(raw);for(const k of Object.keys(snapshot()))rawRemove.call(ls,k);
  for(const [k,v] of Object.entries(b))rawSet.call(ls,k,v);
 }
 const status=()=>{try{return JSON.parse(B.backupStatus()||'{}')}catch(e){return {}}};
 const desc=raw=>{try{const s=JSON.parse(valid(raw)[K]);const levels=Object.values(s.heroXP||{});
  return '완료 '+Object.keys(s.clr||{}).length+'편 · 장비 '+s.gear.length+'개 · 경험치 '+levels.reduce((a,b)=>a+Math.max(0,Number(b)||0),0).toLocaleString('ko-KR')+
  (s.t?' · '+new Date(s.t).toLocaleString('ko-KR'):' · 이전 형식 저장');
 }catch(e){return '유효한 저장 없음'}};
 function modal(title,body,buttons,persistent){
  document.getElementById('gw-drive-modal')?.remove();
  const shade=document.createElement('div');shade.id='gw-drive-modal';
  shade.style.cssText='position:fixed;z-index:2147483647;inset:0;background:rgba(0,0,0,.83);display:flex;align-items:center;justify-content:center;color:#fcebd0;font:15px/1.55 sans-serif;touch-action:manipulation;';
  const pane=document.createElement('div');pane.style.cssText='width:min(90vw,460px);max-height:88vh;overflow-y:auto;background:#201823;border:2px solid #cba66c;border-radius:12px;padding:19px;box-shadow:0 0 24px #000;box-sizing:border-box;';
  const h=document.createElement('div');h.style.cssText='font-weight:bold;font-size:20px;margin-bottom:14px;color:#ffe1ad;';h.textContent=title;
  const info=document.createElement('div');info.style.cssText='white-space:pre-wrap;margin-bottom:14px;';info.textContent=body;
  pane.append(h,info);
  for(const [label,fn] of buttons){const button=document.createElement('button');button.textContent=label;button.style.cssText='display:block;width:100%;padding:12px 6px;margin:8px 0;color:#fff1d2;background:#503640;border:1px solid #b58d64;border-radius:7px;font-weight:bold;font-size:15px;';button.onclick=()=>fn(shade);pane.appendChild(button)}
  if(!persistent){const close=document.createElement('button');close.textContent='닫기';close.style.cssText='width:100%;padding:11px;margin-top:8px;background:#30292e;color:white;border:1px solid #777;border-radius:7px;';close.onclick=()=>shade.remove();pane.appendChild(close)}
  shade.appendChild(pane);document.body.appendChild(shade);
  return shade;
 }
 function done(){
  if(conflict)return;
  checking=false;document.getElementById('gw-drive-checking')?.remove();
  if(dirty){dirty=false;setTimeout(()=>{if(window.GW?.save)window.GW.save();else{let x=ls.getItem(K);if(x)ls.setItem(K,x)}},0)}
 }
 function hold(){checking=true}
 window.onGwSyncStart=hold;
 window.onGwSyncDone=done;
 window.onGwBackup=text=>{if(text)console.info('GW Drive:',text)};
 window.onGwBackupFail=text=>{done();modal('저장 동기화 알림',text||'동기화 대기',[])};
 window.onGwSyncConflict=(remote,local)=>{
  conflict=true;checking=true;
  modal('다른 기기의 진행이 있습니다',
   '드라이브 파일\n'+desc(remote)+'\n\n이 기기\n'+desc(local)+'\n\n유지할 진행을 선택하세요. 선택하지 않은 쪽은 덮어써집니다.',
   [['드라이브 진행으로 이어서 하기',shade=>{
      if(!confirm('이 기기 진행 대신 드라이브 진행을 사용하시겠습니까?'))return;
      shade.remove();conflict=false;restoring=true;B.resolveConflict(true);
    }],
    ['이 기기 진행으로 파일 덮어쓰기',shade=>{
      if(!confirm('드라이브 파일을 이 기기의 진행으로 덮어쓰시겠습니까?'))return;
      shade.remove();conflict=false;B.resolveConflict(false);
    }]],true);
 };
 window.onGwBackupApplied=text=>{
  try{restoring=true;checking=true;apply(text);location.reload()}
  catch(e){restoring=false;window.onGwBackupFail('불러온 저장을 적용하지 못했습니다.');}
 };
 window.onGwRestore=text=>{try{valid(text);B.applyBackup()}catch(e){B.cancelRestore();window.onGwBackupFail('GENDER WARFARE 저장 파일이 아닙니다.')}};
 function open(){
  if(!native)return modal('Google Drive 저장','Android APK에서 사용할 수 있습니다.',[]);
  const st=status(),linked=!!st.linked;
  modal('Google Drive 저장',
   '백업 파일: '+(linked?'연결됨':'연결 안 됨')+'\n'+
   (st.online===false?'오프라인 · 기기 저장 사용':st.syncing?'동기화 중':st.error?'동기화 대기':'자동 동기화 대기')+
   (st.at?'\n마지막 동기화: '+new Date(st.at).toLocaleString('ko-KR'):'')+
   '\n\n다른 기기에서는 새 파일을 만들지 말고 반드시 기존 파일을 연결하세요.',
   [['백업 파일 만들기 / 기존 파일 연결',sh=>{sh.remove();B.pickBackup()}],
    ...(linked?[['지금 동기화',sh=>{sh.remove();checking=true;B.syncBackup()}]]:[])]);
 }
 window.GW_DRIVE={open,status,valid,snapshot,apply};
 window.GW_SAVE_SYNC={valid,time,snapshot,apply,get checking(){return checking},get restoring(){return restoring},get conflict(){return conflict},open};
 if(!native)return;
 try{
  const local=snapshot(),saved=JSON.parse(B.load()||'{}');
  let chosen=latest(saved,local);
  if(typeof B.reconcileLocal==='function')chosen=latest(JSON.parse(B.reconcileLocal(JSON.stringify(local))||'{}'),chosen);
  if(chosen)apply(chosen);
 }catch(e){console.warn('GW native local cache:',e)}
 // 앱 초기/복구 중 저장 금지. 평소에는 원본 구조 그대로, 누적 t만 단조 증가시킨다.
 Storage.prototype.setItem=function(k,v){
  if(this===ls&&k.startsWith(P)){
   if(restoring||checking){dirty=true;return}
   if(k===K){
    try{const s=JSON.parse(v),old=ls.getItem(K),before=old?JSON.parse(old):null;
      if(s&&s.v===1){const prev=Math.max(Number(before?.t)||0,0);
        if(!Number.isSafeInteger(s.t)||s.t<=prev)s.t=Math.max(Date.now(),prev+1);
        v=JSON.stringify(s);
      }
    }catch(e){}
   }
   rawSet.call(this,k,v);try{B.put(k,String(v))}catch(e){};return;
  }
  rawSet.call(this,k,v);
 };
 Storage.prototype.removeItem=function(k){
  if(this===ls&&k.startsWith(P)){if(restoring||checking){dirty=true;return}rawRemove.call(this,k);try{B.del(k)}catch(e){};return}
  rawRemove.call(this,k);
 };
 // 복구된 데이터는 reload 전에 원본 시각을 보존한다.
 addEventListener('pagehide',()=>{if(restoring||checking)return;const raw=ls.getItem(K);if(raw)try{B.put(K,raw)}catch(e){}});
 addEventListener('online',()=>{try{B.syncBackup()}catch(e){}});
 // native onPageFinished가 room 페이지에도 이 스크립트를 삽입한다.
 try{B.webReady()}catch(e){done()}
 setTimeout(()=>{if(checking&&!conflict){console.warn('GW Drive read pending');done()}},20000);
})();
