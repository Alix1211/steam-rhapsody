/* Punishment / dominance room: faction music, shared sound settings. */
(()=>{'use strict';
 if(window.GW_ROOM_AUDIO)return;
 const music=new Audio();music.loop=true;music.preload='auto';
 const side=new URLSearchParams(location.search).get('side')==='M'?'male':'female';
 music.src=new URL('audio/bgm/'+side+'_theme.mp3',location.href).href;
 function settings(){try{return JSON.parse(localStorage.getItem('gw_audio_settings_v1')||'{}')}catch(_){return {}}}
 function sync(){const cfg=settings(),toggle=document.getElementById('btnSound');const enabled=cfg.sound!==false&&!toggle?.textContent.includes('OFF');music.volume=enabled?Math.max(0,Math.min(1,Number.isFinite(cfg.bgm)?cfg.bgm:.24)):0;
  if(!enabled||document.hidden){music.pause();return;}if(music.paused)music.play().catch(()=>{});
 }
 for(const event of ['pointerdown','keydown'])addEventListener(event,sync,{passive:true});
 addEventListener('pagehide',()=>music.pause());document.addEventListener('visibilitychange',sync);
 document.getElementById('btnSound')?.addEventListener('click',()=>setTimeout(sync,0));
 window.GW_ROOM_AUDIO={sync,get track(){return music.src;}};sync();
})();
