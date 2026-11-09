/* Number honeycomb game rules. No DOM, usable in browser and Node. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.HexRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MODES={easy:{rows:5,cols:5,target:64},normal:{rows:6,cols:6,target:128},hard:{rows:7,cols:7,target:256}};
function rng(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let z=x;z=Math.imul(z^(z>>>15),z|1);z^=z+Math.imul(z^(z>>>7),z|61);return((z^(z>>>14))>>>0)/4294967296;};}
function neighbors(r,c,rows,cols){
 const d=r%2===0?[[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]]:[[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]];
 return d.map(([dy,dx])=>[r+dy,c+dx]).filter(([y,x])=>y>=0&&y<rows&&x>=0&&x<cols);
}
function findPairs(board){const result=[];for(let r=0;r<board.length;r++)for(let c=0;c<board[0].length;c++){for(const [rr,cc] of neighbors(r,c,board.length,board[0].length))if((rr>r||(rr===r&&cc>c))&&board[r][c]===board[rr][cc])result.push([[r,c],[rr,cc]]);}return result;}
function newTile(rand,mode){
 const roll=rand();
 if(mode==='easy')return roll<.40?2:roll<.73?4:8;
 if(mode==='normal')return roll<.29?2:roll<.55?4:roll<.81?8:16;
 return roll<.24?2:roll<.46?4:roll<.69?8:roll<.87?16:32;
}
function ensurePair(board,rand){
 if(findPairs(board).length)return board;
 const r=Math.floor(rand()*board.length), c=Math.floor(rand()*board[0].length),n=neighbors(r,c,board.length,board[0].length)[0];
 board[n[0]][n[1]]=board[r][c];return board;
}
function create(mode='easy',seed=1){const d=MODES[mode]||MODES.easy,rand=rng(seed);const board=Array.from({length:d.rows},()=>Array.from({length:d.cols},()=>newTile(rand,mode)));
 ensurePair(board,rand);return {board,score:0,moves:0,bestTile:Math.max(...board.flat()),won:false};}
function gravityAndRefill(board,mode,rand){
 const rows=board.length,cols=board[0].length;
 for(let c=0;c<cols;c++){
  const keep=[];for(let r=rows-1;r>=0;r--)if(board[r][c])keep.push(board[r][c]);
  for(let r=rows-1;r>=0;r--){board[r][c]=keep[rows-1-r]||newTile(rand,mode);}
 }
 ensurePair(board,rand);
}
function merge(input,r,c,mode,seed){
 const d=MODES[mode];if(!d||!input||input.won||!Number.isInteger(r)||!Number.isInteger(c)||!input.board[r]||!input.board[r][c])return null;
 const board=input.board.map(row=>row.slice()),rand=rng(seed);
 const value=board[r][c];const matching=neighbors(r,c,d.rows,d.cols).find(([rr,cc])=>board[rr][cc]===value);
 if(!matching)return null;
 let merged=0,earned=0,chain=[];
 function absorb(other){board[other[0]][other[1]]=0;board[r][c]*=2;earned+=board[r][c];merged++;chain.push(board[r][c]);}
 absorb(matching);
 // Chain-combining available adjacent equals creates small, satisfying combos.
 for(let i=0;i<12;i++){
  const next=neighbors(r,c,d.rows,d.cols).find(([rr,cc])=>board[rr][cc]===board[r][c]);
  if(!next)break;absorb(next);
 }
 const bestTile=Math.max(input.bestTile,board[r][c]);
 gravityAndRefill(board,mode,rand);
 return {board,score:input.score+earned,moves:input.moves+1,bestTile,won:bestTile>=d.target,merged,earned,chain,at:[r,c]};
}
function validate(state,mode){
 const d=MODES[mode];if(!d||!state||!Array.isArray(state.board)||state.board.length!==d.rows||!state.board.every(row=>Array.isArray(row)&&row.length===d.cols&&row.every(v=>Number.isInteger(v)&&v>=2&&v<=32768&&(v&(v-1))===0)))return false;
 return Number.isSafeInteger(state.score)&&state.score>=0&&Number.isInteger(state.moves)&&state.moves>=0&&Number.isInteger(state.bestTile)&&state.bestTile>=2&&state.bestTile<=32768&&typeof state.won==='boolean';
}
return{MODES,rng,neighbors,findPairs,create,merge,validate};
});
