/* Pure helpers for educational modules; no DOM, analytics or timers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LearningCore=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function rng(seed){let s=Number(seed)>>>0;return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function shuffle(items,random){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  const integer=(random,min,max)=>min+Math.floor(random()*(max-min+1));
  function options(answer,min,max,random){const others=[];for(let n=min;n<=max;n++)if(n!==answer)others.push(n);return shuffle([answer,...shuffle(others,random).slice(0,3)],random);}
  const bounded=(n,min,max,fallback)=>Number.isInteger(n)&&n>=min&&n<=max?n:fallback;
  function initial(seed){return {seed:seed>>>0,index:0,done:false,wrong:0,aided:false,results:[],draft:null};}
  function restore(raw,seed,count){
    if(!raw||!Number.isInteger(raw.seed)||raw.seed<0||raw.seed>0xffffffff||!Number.isInteger(raw.index)||raw.index<0||raw.index>count||!Array.isArray(raw.results))return initial(seed);
    const valid=r=>r&&typeof r.independent==='boolean'&&Number.isInteger(r.wrong)&&r.wrong>=0&&r.wrong<=999;
    if(raw.results.length!==raw.index||!raw.results.every(valid)||typeof raw.done!=='boolean'||typeof raw.aided!=='boolean'||!Number.isInteger(raw.wrong)||raw.wrong<0||raw.wrong>999)return initial(seed);
    return {seed:raw.seed,index:raw.index,done:raw.index<count&&raw.done,wrong:raw.wrong,aided:raw.aided,results:raw.results.map(r=>({independent:r.independent,wrong:r.wrong})),draft:raw.draft??null};
  }
  function answer(state,correct){if(state.done)return false;if(correct)state.done=true;else state.wrong=Math.min(999,state.wrong+1);return true;}
  function advance(state,count){if(!state.done||state.index>=count)return false;state.results.push({independent:state.wrong===0&&!state.aided,wrong:state.wrong});state.index++;state.done=false;state.wrong=0;state.aided=false;state.draft=null;return true;}
  return Object.freeze({rng,shuffle,integer,options,bounded,initial,restore,answer,advance});
});
