// The iframe uses the main frame's existing save guard and native mirror.
(()=>{'use strict';
 try{
  if(window.parent===window||!window.parent.GW_SAVE_SYNC)return;
  const parentStore=window.parent.localStorage,rawSet=Storage.prototype.setItem,rawRemove=Storage.prototype.removeItem;
  Storage.prototype.setItem=function(k,v){if(this===localStorage&&String(k).startsWith('gw_'))return parentStore.setItem(k,v);return rawSet.call(this,k,v);};
  Storage.prototype.removeItem=function(k){if(this===localStorage&&String(k).startsWith('gw_'))return parentStore.removeItem(k);return rawRemove.call(this,k);};
 }catch(error){console.warn('Mecha save bridge:',error);}
})();
