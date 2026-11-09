/* Pure rules of Sort the Nuts, loaded in browser and Node tests. */
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NutsRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CAPACITY = 4;
  function rng(seed) {
    let x = seed >>> 0;
    return () => { x += 0x6D2B79F5; let t=x; t=Math.imul(t ^ (t>>>15),t|1); t ^= t + Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
  }
  function colorsForLevel(level) { return Math.min(8, Math.max(3, 3 + Math.floor((level - 1)/3))); }
  function isSorted(stack) { return stack.length === CAPACITY && stack.every(v=>v===stack[0]); }
  function isWon(state) { return state.every(stack => stack.length === 0 || isSorted(stack)); }
  function canMove(state, from, to) {
    if (!Number.isInteger(from)||!Number.isInteger(to)||from===to||!state[from]||!state[to]) return false;
    const a=state[from], b=state[to];
    return a.length>0 && b.length<CAPACITY && (b.length===0 || b.at(-1)===a.at(-1));
  }
  function move(state, from, to) {
    if (!canMove(state,from,to)) return null;
    const next=state.map(stack=>stack.slice());
    next[to].push(next[from].pop());
    return next;
  }
  function validState(state, colors) {
    if (!Array.isArray(state)||state.length!==colors+2||!state.every(a=>Array.isArray(a)&&a.length<=4&&a.every(v=>Number.isInteger(v)&&v>=0&&v<colors))) return false;
    const seen=Array(colors).fill(0); state.flat().forEach(v=>seen[v]++);
    return seen.every(v=>v===4);
  }
  const encode = a => a.map(s=>s.join('')).sort().join('|');
  function solve(start, maxStates=180000) {
    if (!start || !start.length) return null;
    if (isWon(start)) return [];
    // Prioritize matching stacks and completing colors, but maintain visited-state deduplication.
    const root = start.map(s=>s.slice());
    const visited=new Map(); let explored=0;
    function search(state, depth, previous, route) {
      if (isWon(state)) return route.slice();
      if (depth===0 || explored>=maxStates) return null;
      const key=encode(state);
      const prevDepth=visited.get(key);
      if (prevDepth !== undefined && prevDepth >= depth) return null;
      visited.set(key,depth); explored++;
      let options=[];
      for(let from=0;from<state.length;from++) {
        const stack=state[from]; if (!stack.length) continue;
        for(let to=0;to<state.length;to++) {
          if (!canMove(state,from,to)) continue;
          if (previous&&previous[0]===to&&previous[1]===from) continue;
          if (state[to].length===0) {
            if (isSorted(stack)) continue; // moving a solved color to empty does not help
            if (state.slice(0,to).some(s=>s.length===0)) continue;
          }
          const matching=state[to].length>0;
          let weight=matching?12+state[to].length*2:0;
          if (matching&&state[to].length===3) weight+=25;
          if (stack.length===1) weight+=3;
          options.push([from,to,weight]);
        }
      }
      options.sort((a,b)=>b[2]-a[2]);
      for(const [from,to] of options){
        const next=move(state,from,to);
        route.push([from,to]);
        const solved=search(next,depth-1,[from,to],route);
        if(solved) return solved;
        route.pop();
        if(explored>=maxStates) break;
      }
      return null;
    }
    // Iterative deepening makes each hint the first step of a short solution.
    for(let depth=1;depth<=75&&explored<maxStates;depth+=2){
      visited.clear();
      const found=search(root,depth,null,[]);
      if(found) return found;
    }
    return null;
  }
  function create(level) {
    const colors=colorsForLevel(level);
    const source=typeof globalThis !== 'undefined' && globalThis.NutsPuzzles || (typeof module==='object' && module.exports ? require('./puzzles.js') : null);
    if (!source || !Array.isArray(source[colors])) throw new Error('Layouts unavailable');
    const fixtures=source[colors];
    const chosen=fixtures[(Math.max(1,level)-1)%fixtures.length];
    const rand=rng(Math.imul(Math.max(1,level),2654435761) ^ 0x2345abcd);
    const colorMap=Array.from({length:colors},(_,i)=>i);
    const boltMap=Array.from({length:colors+2},(_,i)=>i);
    function shuffle(a) {for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}}
    shuffle(colorMap);shuffle(boltMap);
    const stacks=Array.from({length:colors+2},()=>[]);
    chosen.stacks.forEach((stack,i)=>{stacks[boltMap[i]]=stack.map(v=>colorMap[v]);});
    const answer=chosen.answer.map(([from,to])=>[boltMap[from],boltMap[to]]);
    return {stacks,answer};
  }
  return { CAPACITY,rng,colorsForLevel,isWon,isSorted,canMove,move,validState,solve,create };
});
