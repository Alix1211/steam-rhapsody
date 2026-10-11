const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
let time=1000,result='ok',webAllowed=true;
const native=[],web=[],events={};
const ctx={performance:{now:()=>time},GWBridge:{vibrate:p=>{native.push(p);return result;}},navigator:{userActivation:{hasBeenActive:false},vibrate:p=>{web.push(p);return webAllowed;}},document:{hidden:false,addEventListener:(k,f)=>events[k]=f},location:{protocol:'https:'},addEventListener:(k,f)=>events[k]=f};
ctx.window=ctx;ctx.top=ctx;vm.createContext(ctx);vm.runInContext(read('game/haptics.js'),ctx);
const h=ctx.GW_HAPTICS;
assert(h.test());assert.equal(native.at(-1),'500,120,650');assert.equal(web.length,0);assert.equal(h.status.backend,'native');
const n=native.length;time+=20;assert.equal(h.request(48),false);assert.equal(native.length,n,'shots cannot interrupt test');
h.setEnabled(false);assert.equal(native.at(-1),'0');assert.equal(web.at(-1),0);assert.equal(h.request(48),false);
h.setEnabled(true);delete ctx.navigator.vibrate;time+=2000;assert(h.request([120,40,200],2));assert.equal(native.at(-1),'120,40,200');
ctx.document.hidden=true;events.visibilitychange();assert.equal(native.at(-1),'0');assert.equal(h.test(),false);
ctx.document.hidden=false;result='error:SecurityException';ctx.navigator.vibrate=p=>{web.push(p);return webAllowed;};assert(h.test());assert.equal(h.status.backend,'web');
webAllowed=false;assert.equal(h.test(),false);assert.equal(h.status.returned,false);
ctx.navigator.userActivation.hasBeenActive=true;webAllowed=true;events.pointerup({isTrusted:true});assert.equal(h.status.code,'accepted');
const index=read('game/index.html'),mini=read('game/mecha.html');
const roster=vm.runInNewContext('('+index.match(/const ROSTER=(.*?);/s)[1]+')');
const rows=JSON.parse(mini.match(/const CHARACTER_ROWS=(.*?);/s)[1]);
for(const faction of ['F','M']){
 assert.deepEqual([0,1,2,3].map(c=>roster[faction].filter(r=>r.c===c).length),[2,2,2,2]);
 for(const r of roster[faction])assert.equal(rows[faction].find(x=>x[0]===r.k)[2],['rifle','shotgun','sniper','medic'][r.c]);
}
assert.equal(roster.M.find(r=>r.k==='mlizard').c,0);assert.equal(rows.M.find(r=>r[0]==='mlizard')[2],'rifle');
assert(index.indexOf('<script src="save_sync.js"')<index.indexOf('<script src="meta.js"'));
assert(read('game/meta.js').includes('equipmentSlots:meritRank'));
assert(read('android/app/src/main/AndroidManifest.xml').includes('android.permission.VIBRATE'));
for(const key of ['ASSETS','AUDIO_DATA']){
 const bank=JSON.parse(mini.match(new RegExp('const '+key+'=(.*?);','s'))[1]);
 for(const file of Object.values(bank))assert(fs.existsSync(path.join(__dirname,'../game',file)),file);
}
console.log('PASS native/web haptics, priority, cancel, OFF, hidden, retry, matching 16 classes, merit slots, save order, all mech media');
