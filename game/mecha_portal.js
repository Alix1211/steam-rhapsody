(function(){
'use strict';
let frame=null;
window.GW_GET_MECHA_AVAILABLE=function(side){return window.GW.poolOf(side).filter(r=>window.GW.mechaAvailable(r.k)).map(r=>r.k);};
window.GW_OPEN_MECHA=function(side){
 if(window.GW_MECHA_OPEN)return;
 window.GW_MECHA_OPEN=true;window.GW_AUDIO_OPTIONS?.suspendForMecha?.(true);
 if(frame){frame.style.display='block';frame.style.pointerEvents='auto';frame.inert=false;frame.contentWindow?.GW_MECHA_ENTER?.(side);return;}
 frame=document.createElement('iframe');frame.id='gw-mecha-portal';frame.title='메카 비행 전투';
 frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;z-index:10000;background:#080b12';
 frame.setAttribute('allow','autoplay; fullscreen');frame.setAttribute('allowfullscreen','');
 if(window.GW_MECHA_HTML)frame.srcdoc=window.GW_MECHA_HTML.replace('<script>','<script>window.GW_LINKED_FACTION='+JSON.stringify(side)+';');
 else frame.src='mecha.html#f='+side+'&linked=1';
 document.body.appendChild(frame);
};
window.GW_CLOSE_MECHA=function(){
 if(!frame||!window.GW_MECHA_OPEN)return;
 frame.contentWindow?.GW_MECHA_LEAVE?.();
 if(document.fullscreenElement===frame){try{const p=document.exitFullscreen?.();p?.catch?.(()=>{});}catch(_){}}
 frame.style.display='none';frame.style.pointerEvents='none';frame.inert=true;
 window.GW_MECHA_OPEN=false;
 window.GW?.openLines();window.GW_AUDIO_OPTIONS?.suspendForMecha?.(false);
 window.GW_RESUME_MAIN?.();document.querySelector('canvas')?.focus?.();
};
})();
