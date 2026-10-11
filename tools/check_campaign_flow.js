const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');process.chdir(path.join(__dirname,'..'));const read=p=>fs.readFileSync(p,'utf8');let now=1000;
const noop=()=>{},gradient={addColorStop:noop};const context=new Proxy({measureText:s=>({width:String(s).length*9}),createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
function makeBox(){const storage=new Map(),canvas={style:{},width:1280,height:720,getContext:()=>context,addEventListener:noop,getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720}),setPointerCapture:noop};
 const audioInstances=[];class Audio{constructor(src=''){this.src=src;this.paused=true;this.volume=0;audioInstances.push(this);}pause(){this.paused=true}play(){this.paused=false;return Promise.resolve()}load(){}}
 const c={audioInstances,console,Math,Date,URL,URLSearchParams,Audio,performance:{now:()=>now},navigator:{},document:{hidden:false,body:{style:{},appendChild:noop},documentElement:{style:{}},querySelector:()=>canvas,getElementById:()=>canvas,createElement:()=>({...canvas}),addEventListener:noop},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},Image:class{width=400;height=400;naturalWidth=400;naturalHeight=400;},innerWidth:1280,innerHeight:720,devicePixelRatio:1,addEventListener:noop,requestAnimationFrame:noop,location:{href:'https://game/index.html',hash:'#f=F',protocol:'https:'},fetch:async()=>({ok:false,json:async()=>({}),arrayBuffer:async()=>new ArrayBuffer(0)}),setTimeout:noop,clearTimeout:noop};c.window=c;c.parent=c;c.top=c;vm.createContext(c);return c;}
const main=makeBox();for(const f of ['game/csets.js','game/haptics.js'])vm.runInContext(read(f),main);
for(const m of read('game/index.html').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],main);
for(const f of ['game/dialogue_bundle.js','game/mission_data.js','game/combat_missions.js','game/meta.js','game/presentation.js','game/audio_options.js','game/purification_integration.js'])vm.runInContext(read(f),main);
const gw=main.GW;assert.equal(gw.ticketCount('F'),0);assert.equal(gw.spendTicket('F'),false);
gw.SV.clr['F1-10']=1;assert.equal(gw.slotCap('F'),2);gw.SV.clr['F2-10']=1;assert.equal(gw.slotCap('F'),3);gw.SV.clr['F3-10']=1;assert.equal(gw.slotCap('F'),4);gw.SV.clr['F5-10']=1;assert.equal(gw.slotCap('F'),5);assert.equal(gw.slotCap('M'),1);
gw.syncMechaMerit({human:60000,mlizard:60000});assert.equal(gw.equipmentSlots('human'),5);assert.equal(gw.equipmentSlots('mlizard'),1);
for(const faction of ['F','M']){const ch=faction+'1';gw.SV.seen[ch+'-1b']=1;gw.openParty(faction,0,ch,1);const pool=gw.poolOf(faction);gw.PS.sel=pool.slice(0,3);gw.beginStage();gw.win(3);assert.equal(gw.ticketCount(faction),1);gw.win(3);assert.equal(gw.ticketCount(faction),1,'duplicate settlement');gw.openParty(faction,0,ch,1);gw.PS.sel=pool.slice(0,3);gw.beginStage();gw.win(3);assert.equal(gw.ticketCount(faction),2,'replay earns ticket');}
assert(gw.spendTicket('F'));assert.equal(gw.ticketCount('F'),1);gw.save();assert(JSON.parse(main.localStorage.getItem('gw_save_v1')).sortieTickets.M===2);
// Actual demon roster and enemy attack paths, including cover-compatible damage packets.
vm.runInContext("side='C';setEnemies('C');",main);assert(vm.runInContext('KN.every(k=>k.demon)&&MK[1].queen',main));vm.runInContext('for(let i=0;i<50;i++)if(pickElite().queen)throw Error("queen elite")',main);
vm.runInContext("ebul=[];const q={k:MK[1],x:500,d:.5,bs:1};demonAttack(q,heroes[0]);if(ebul[0].kind!=='whip')throw Error('whip');demonAttack(q,heroes[0]);if(ebul.filter(b=>b.kind==='magic').length!==3)throw Error('magic volley');drawDemonMagic();drawDemonWhips();",main);
const flight=makeBox();flight.parent={GW:gw,GW_AUDIO_OPTIONS:main.GW_AUDIO_OPTIONS,GW_DOMINANCE:main.GW_DOMINANCE};vm.runInContext(read('game/presentation.js'),flight);
for(const m of read('game/mecha.html').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],flight);
vm.runInContext(read('game/flight_missions.js'),flight);
vm.runInContext('loaded=true;openDeploy(1);draw();launchSortie();',flight);assert.equal(vm.runInContext('state',flight),'playing');assert.equal(gw.ticketCount('F'),0);
vm.runInContext("state='won';objectives.forEach(o=>o.done=true);settleVictory();",flight);const earned=vm.runInContext('JSON.stringify(campaign.meritThirds)',flight);assert(Object.values(JSON.parse(earned)).some(n=>n>0));
vm.runInContext("state='deploy';launchSortie();",flight);assert.equal(vm.runInContext('state',flight),'deploy','empty tickets blocks launch');
vm.runInContext('practice=true;launchSortie();',flight);assert.equal(vm.runInContext('state',flight),'playing');vm.runInContext('objectives.forEach(o=>o.done=true);settleVictory();',flight);assert.equal(vm.runInContext('JSON.stringify(campaign.meritThirds)',flight),earned,'practice grants no merit');
vm.runInContext("state='deploy';draw();openFlightOptions();draw();closeFlightOptions();",flight);
// BGM holds the battle briefly, then uses the theme while the stinger plays.
vm.runInContext("menu=false;side='F';over=false;",main);main.GW_AUDIO_OPTIONS.syncMusic();assert.equal(main.GW_AUDIO_OPTIONS.track,'female_battle');main.GW_PRESENTATION.finish(true,false,{sound:false});vm.runInContext('over=true;',main);main.GW_AUDIO_OPTIONS.syncMusic();assert.equal(main.GW_AUDIO_OPTIONS.track,'female_battle');now+=900;main.GW_AUDIO_OPTIONS.syncMusic();assert.equal(main.GW_AUDIO_OPTIONS.track,'female_theme');
console.log('PASS actual main and flight VM: ticket wins/replays/dedup/save/consume; 5 story caps; legacy merit; demon mixed soldiers/queen whip/3 spells; paid sortie/empty block/free practice; options; result BGM hold/theme');

// Defeat consumes the launched ticket, awards no merit, and freezes into results.
gw.SV.sortieTickets.F=2;vm.runInContext("practice=false;state='deploy';launchSortie();hero.inv=0;roster.forEach(r=>r.hp=0);roster[active].hp=1;hostile=[{x:hero.x,y:hero.y,vx:0,vy:0,r:5,t:2,damage:1000}];update(.016);draw();",flight);
assert.equal(vm.runInContext('state',flight),'lost');assert.equal(gw.ticketCount('F'),1);assert.equal(vm.runInContext('JSON.stringify(campaign.meritThirds)',flight),earned);assert.equal(vm.runInContext('resultStarted',flight),now);
const synth=makeBox();vm.runInContext(read('game/presentation.js'),synth);
const resultAudio=synth.audioInstances;
for(const key of ['victory','defeat','finale']){const wav=fs.readFileSync('game/audio/results/'+key+'.wav');assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');let peak=0;for(let i=44;i+1<wav.length;i+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(i)));assert(peak>25000,'audible normalized WAV: '+key);}
synth.GW_PRESENTATION.finish(true,false,{sound:false});assert(resultAudio.every(a=>a.paused));
synth.GW_PRESENTATION.finish(true,false,{sound:true,sfx:.4});assert.equal(resultAudio[0].paused,false);assert.equal(resultAudio[0].volume,.38);
synth.GW_PRESENTATION.setVolume(false);assert.equal(resultAudio[0].volume,0);
synth.GW_PRESENTATION.finish(false,false,{sound:true});assert.equal(resultAudio[0].paused,true);assert.equal(resultAudio[1].paused,false);
synth.GW_PRESENTATION.finish(true,true,{sound:true});assert.equal(resultAudio[1].paused,true);assert.equal(resultAudio[2].paused,false);assert.equal(resultAudio[2].volume,.95);
const player=synth.GW_PRESENTATION.musicPlayer();player.set('battle','a.mp3',.24,true);const a=player.current;now+=1500;player.set('battle','a.mp3',.24,true);player.set('theme','b.mp3',.24,true);assert(!a.paused,'old music continues during the fade');now+=500;player.set('theme','b.mp3',.24,true);assert(player.current.volume>0&&player.current.volume<.24);player.pause();assert(a.paused&&player.current.paused);
console.log('PASS defeat ticket/no merit/result hold; real WAV victory/loss/finale wiring; continuous music crossfade');

// Exercise actual main bullets and flight damage with the current, consuming buff.
vm.runInContext(`GW.SV.dominance.human=50;t=0;
 const testRoster=Object.assign({},ROSTER.F.find(r=>r.k==='human'),{gm:{atk:.5,crit:0}});
 const buffHero=mkHero(testRoster,0);buffHero.x=300;buffHero.y=400;buffHero.ht=180;
 const shootAt=()=>{bullets=[];shoot(buffHero,{x:600,y:400,d:.5,k:KN[0]},false,false);return bullets[0].dmg};
 const buffDamage=shootAt();t=1499;if(Math.abs(shootAt()-buffDamage)>1e-9)throw Error('early expiry');
 GW_DOMINANCE.consume(['human'],25);t=1500;const plainDamage=shootAt();if(Math.abs(buffDamage/plainDamage-1.2)>1e-9)throw Error('bullet buff');
 if(GW.SV.dominance.human!==0)throw Error('stored consumption');
`,main);
vm.runInContext(`window.parent.GW.SV.dominance.human=50;practice=true;reset();const buffFlight=roster.find(r=>r.id==='human');if(!buffFlight)throw Error('human missing');
 time=0;const boosted= buffFlight.damage;window.parent.GW_DOMINANCE.consume(['human'],25);time=25;const plain= buffFlight.damage;
 if(Math.abs(boosted/plain-1.2)>1e-9)throw Error('flight buff');`,flight);
assert(read('android/app/src/main/AndroidManifest.xml').includes('screenOrientation="sensorLandscape"'));
console.log('PASS actual main bullet +20%, 25-second consumption, stored value zero; flight damage +20%; landscape manifest');

function launchMission(ch,no){gw.SV.seen[ch+'-'+no+'b']=1;gw.openParty(ch.startsWith('M')?'M':ch==='C11'?'C':'F',Number(ch.slice(1))-1,ch,no);const c=main.GW_MISSIONS.config(ch,no),pool=gw.poolOf(gw.PS.side);gw.PS.sel=c.required.length?c.required.map(k=>pool.find(r=>r.k===k)):pool.slice(0,3);if(c.mixed)gw.PS.sel=[pool[0],pool[1],pool.find(r=>r.k==='mdwarf')];gw.beginStage();assert.equal(gw.scene,'battle',ch+'-'+no);vm.runInContext('heroes.forEach(h=>{h.hp=h.max=1e7;});',main);}
function resumeMission(){if(gw.scene==='dialogue')gw.skipDialogue();for(let i=0;i<61;i++)main.update();}
assert.equal(Object.keys(main.GW_MISSION_DATA).length,110);
for(const ch of ['F1','F2','F3','F4','F5','M1','M2','M3','M4','M5','C11'])for(let no=1;no<=10;no++)launchMission(ch,no);
launchMission('F1',4);const ticketBefore=gw.ticketCount('F');vm.runInContext('t=1500;',main);main.update();assert.equal(gw.scene,'dialogue');const frozen=vm.runInContext('t',main);gw.SV.dominance.human=100;for(let i=0;i<60;i++)main.update();assert.equal(vm.runInContext('t',main),frozen);assert.equal(gw.SV.dominance.human,100,'dialogue consumes no dominance');resumeMission();vm.runInContext('t=5399;',main);main.update();assert.equal(gw.res.won,true);assert.equal(gw.ticketCount('F'),ticketBefore+1);
launchMission('F1',4);main.GW_MISSIONS.run.protected.hp=0;main.update();assert.equal(gw.res.won,false);assert.equal(gw.res.why,'보호 대상 파괴');
launchMission('F2',3);vm.runInContext('for(const e of GW_MISSIONS.run.targets){e.hp=0;killEnemy(e);}',main);main.update();assert.equal(gw.res.won,true,'actual target kill hook completes mission');
launchMission('F5',1);vm.runInContext('t=7799;',main);main.update();resumeMission();main.update();assert(main.GW_MISSIONS.run.protected,'130-second reinforcement');resumeMission();vm.runInContext('t=11999;',main);main.update();assert.equal(gw.res.won,true,'200-second survival');
launchMission('F5',7);vm.runInContext('for(const e of GW_MISSIONS.run.targets){e.hp=0;killEnemy(e);}',main);main.update();resumeMission();assert(main.GW_MISSIONS.run.until>0);const until=main.GW_MISSIONS.run.until;vm.runInContext('t='+ (until-1)+';',main);main.update();assert.equal(gw.res.won,true,'failed rescue narrative still permits successful retreat');
// Boss remains locked until the final core and all actual wave enemies are defeated.
launchMission('F2',10);for(let phase=0;phase<3;phase++){vm.runInContext('for(const e of GW_MISSIONS.run.targets)if(!e.dead){e.hp=0;killEnemy(e);}',main);main.update();resumeMission();}assert.equal(vm.runInContext('over',main),false);vm.runInContext('enemies=[];ST.spawned=ST.goal;',main);main.update();assert.equal(gw.res.won,true);
launchMission('F4',3);assert.equal(gw.PS.sel.map(r=>r.k).join(','),'mmedic,mhuman,mwolf');
// Real protected-target packets damage the ally, not a party member.
launchMission('F1',4);vm.runInContext(`const protectedTarget=GW_MISSIONS.run.protected;const pHP=protectedTarget.hp;ebul=[{p:.999,h:protectedTarget,dm:1,sx:0,sy:0,tx:0,ty:0}];update();if(!(protectedTarget.hp<pHP))throw Error('protected packet damage');`,main);
// Flight pause/dialogue freeze and 200-second completion through the real result wrapper.
gw.SV.sortieTickets.F=5;vm.runInContext('selectedMission=8;variant=0;practice=false;state="deploy";launchSortie();roster.forEach(r=>r.hp=1e7);time=129.99;update(.02);',flight);assert(flight.GW_FLIGHT_MISSIONS.blocked);const flightTime=vm.runInContext('time',flight);vm.runInContext('update(1);',flight);assert.equal(vm.runInContext('time',flight),flightTime);flight.GW_FLIGHT_MISSIONS.dismiss();now+=1100;vm.runInContext('time=199.99;update(.02);',flight);assert.equal(vm.runInContext('state',flight),'won');assert.equal(vm.runInContext('resultStarted',flight),now);
vm.runInContext('selectedMission=9;variant=1;state="deploy";launchSortie();GW_FLIGHT_MISSIONS.run.ally.hp=0;update(.016);',flight);assert.equal(vm.runInContext('state',flight),'lost');
console.log('PASS all 110 launches; real protective damage/win/loss; mid-dialogue freeze/resume and no drain; destruction kill hook; 130s reinforcement/200s survival; rescue retreat; 3 boss parts/wave lock; required party; flight survival/result fade/escort loss');
