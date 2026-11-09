/* Geometry and guaranteed-solvable arrow placement. Browser + Node. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ArrowRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function random(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const DELTAS=[[1,0],[-1,0],[0,1],[0,-1]];
const key=(x,y)=>x+','+y;
function occupancy(pieces){const occupied=new Map();for(const p of pieces)for(const [x,y] of p.path)occupied.set(key(x,y),p.id);return occupied;}
function heading(p){const a=p.path.at(-2),b=p.path.at(-1);return[b[0]-a[0],b[1]-a[1]];}
function blockers(p,pieces,width,height,occ=occupancy(pieces)){
 const result=new Set(),[dx,dy]=heading(p);
 for(const [cx,cy] of p.path){let x=cx+dx,y=cy+dy;while(x>=0&&x<width&&y>=0&&y<height){const found=occ.get(key(x,y));if(found!==undefined&&found!==p.id)result.add(found);x+=dx;y+=dy;}}
 return [...result];
}
function available(p,pieces,width,height){return blockers(p,pieces,width,height).length===0;}
function solution(pieces,width,height){
 const all=new Map(pieces.map(p=>[p.id,p]));const order=[];
 while(all.size){const occ=occupancy([...all.values()]);const open=[...all.values()].filter(p=>blockers(p,[...all.values()],width,height,occ).length===0);if(!open.length)return null;
 open.sort((a,b)=>a.id-b.id);for(const p of open){all.delete(p.id);order.push(p.id);}}
 return order;
}
function makePath(rnd,occ,w,h,minLen=3,maxLen=6){
 const length=minLen+Math.floor(rnd()*(maxLen-minLen+1));
 const x0=Math.floor(rnd()*w),y0=Math.floor(rnd()*h),pts=[[x0,y0]],used=new Set([key(x0,y0)]);
 if(occ.has(key(x0,y0)))return null;
 let lastDir=-1;
 while(pts.length<length){
   const [x,y]=pts.at(-1);
   const dirs=[0,1,2,3].filter(i=>i!==((lastDir^1))&&(()=>{const [dx,dy]=DELTAS[i];const nx=x+dx,ny=y+dy;return nx>=0&&nx<w&&ny>=0&&ny<h&&!occ.has(key(nx,ny))&&!used.has(key(nx,ny));})());
   if(!dirs.length)return null;
   // Prefer a bend to produce more interesting arrow shapes.
   const bend=dirs.filter(d=>d!==lastDir);
   const pool=lastDir>=0&&bend.length&&rnd()<.65?bend:dirs;
   const d=pool[Math.floor(rnd()*pool.length)];const [dx,dy]=DELTAS[d];
   pts.push([x+dx,y+dy]);used.add(key(x+dx,y+dy));lastDir=d;
 }
 return pts;
}
function dimensions(level){const tier=Math.min(6,Math.max(0,Math.floor((level-1)/4)));return {width:11+tier*3,height:10+tier*3,count:Math.min(44,6+level*2)};}
function create(level,variant=0){
 const {width,height,count}=dimensions(level),rnd=random((Math.imul(level,174761393)^Math.imul(variant+1,321324109))>>>0);
 const pieces=[];let attempts=0;
 while(pieces.length<count && attempts++ < count*360){
  const occupied=occupancy(pieces);const path=makePath(rnd,occupied,width,height,2+Math.min(2,Math.floor(level/7)),5+Math.min(2,Math.floor(level/10)));
  if(!path)continue;
  const p={id:pieces.length,color:Math.floor(rnd()*9),path};pieces.push(p);
  if(!solution(pieces,width,height))pieces.pop();
 }
 // Very sparse fallback is still valid; each placed piece stays removable in some order.
 return {width,height,pieces,solution:solution(pieces,width,height)||[]};
}
function validate(data){
 if(!data||!Number.isInteger(data.width)||!Number.isInteger(data.height)||data.width<5||data.width>40||data.height<5||data.height>40||!Array.isArray(data.pieces)||data.pieces.length>100)return false;
 const ids=new Set(),cells=new Set();
 for(const p of data.pieces){
  if(!Number.isInteger(p.id)||ids.has(p.id)||!Number.isInteger(p.color)||p.color<0||p.color>8||!Array.isArray(p.path)||p.path.length<2||p.path.length>12)return false;
  ids.add(p.id);let last=null;
  for(const pt of p.path){if(!Array.isArray(pt)||pt.length!==2||!pt.every(Number.isInteger)||pt[0]<0||pt[0]>=data.width||pt[1]<0||pt[1]>=data.height)return false;
   const k=key(...pt);if(cells.has(k))return false;cells.add(k);
   if(last&&Math.abs(pt[0]-last[0])+Math.abs(pt[1]-last[1])!==1)return false;last=pt;
  }
 }
 return solution(data.pieces,data.width,data.height)!==null;
}
return{random,heading,blockers,available,solution,create,validate,dimensions};
});
