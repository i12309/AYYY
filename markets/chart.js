/* Local SVG renderer. Coordinates come only from validated daily observations. */
(function(root){
 'use strict';
 const M=root.AYYYMarkets;
 const number=v=>Number(v).toLocaleString('ru-RU',{maximumFractionDigits:2});
 function plot(points,history,options={}){
  if(!points.length)return null;
  const W=Math.max(560,Math.min(2400,options.width||960)),H=Math.max(180,Math.min(600,options.height||264)),L=18,R=W-72,T=16,B=H-40;
  const minDate=points[0].date, maxDate=points[points.length-1].date;
  const select=list=>list.filter(p=>p.date>=minDate&&p.date<=maxDate);
  const overlays=[];
  if(options.sma20)overlays.push({key:'sma20',points:select(M.sma(history,20))});
  if(options.sma50)overlays.push({key:'sma50',points:select(M.sma(history,50))});
  const band=options.bb?select(M.bands(history)):[];
  const values=points.map(p=>p.value).concat(overlays.flatMap(o=>o.points.filter(p=>p.value!==null).map(p=>p.value)),band.flatMap(p=>[p.lower,p.upper]).filter(v=>v!==null));
  const low=Math.min(...values),high=Math.max(...values),pad=Math.max((high-low)*.13,Math.abs(high)*.001,.0001),min=low-pad,max=high+pad;
  const x=i=>L+(R-L)*i/Math.max(1,points.length-1), y=v=>B-(v-min)/(max-min)*(B-T);
  const index=new Map(points.map((p,i)=>[p.date,i]));
  const path=list=>{let started=false;return list.map(p=>{if(p.value===null||!index.has(p.date)){started=false;return '';}const out=(started?'L':'M')+x(index.get(p.date)).toFixed(2)+','+y(p.value).toFixed(2);started=true;return out;}).join(' ');};
  let svg=`<svg viewBox="0 0 ${W} ${H}" style="width:${W}px;height:${H}px" role="img" aria-label="График дневных справочных курсов"><defs><linearGradient id="fm-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#315e8a" stop-opacity=".15"/><stop offset="1" stop-color="#315e8a" stop-opacity=".01"/></linearGradient></defs>`;
  for(let i=0;i<=4;i++){const value=min+(max-min)*i/4,yy=y(value);svg+=`<path d="M${L} ${yy}H${R}" class="fm-grid"/><text x="${R+13}" y="${yy+4}" class="fm-axis">${number(value)}</text>`;}
  const ticks=[...new Set(Array.from({length:Math.min(6,points.length)},(_,i)=>Math.round(i*(points.length-1)/Math.max(1,Math.min(6,points.length)-1))))];
  for(const i of ticks){const xx=x(i);svg+=`<path d="M${xx} ${T}V${B}" class="fm-grid vertical"/><text x="${xx}" y="${B+26}" text-anchor="${i===0?'start':i===points.length-1?'end':'middle'}" class="fm-axis">${points[i].date.slice(8)}.${points[i].date.slice(5,7)}</text>`;}
  const good=band.filter(p=>p.upper!==null&&index.has(p.date));
  if(good.length>1)svg+=`<path d="${good.map((p,i)=>(i?'L':'M')+x(index.get(p.date))+','+y(p.upper)).join(' ')} ${good.slice().reverse().map(p=>'L'+x(index.get(p.date))+','+y(p.lower)).join(' ')}Z" class="fm-band"/>`;
  const main=path(points);
  if(options.area&&points.length>1)svg+=`<path d="${main} L${x(points.length-1)} ${B} L${x(0)} ${B}Z" fill="url(#fm-area)"/>`;
  for(const o of overlays)svg+=`<path d="${path(o.points)}" class="fm-line ${o.key}"/>`;
  svg+=`<path d="${main}" class="fm-line primary"/><circle cx="${x(points.length-1)}" cy="${y(points[points.length-1].value)}" r="3.5" fill="#315e8a"/><g id="fm-crosshair" hidden><path id="fm-cross-line" class="fm-cross"/><circle id="fm-cross-dot" r="4" fill="#e28b45" stroke="#fff" stroke-width="2"/></g></svg>`;
  return {html:svg,x,y,W,H,L,R,T,B,points};
 }
 function spark(points){
  if(points.length<2)return '<span class="fm-spark-empty">Нет истории</span>';
  const values=points.map(p=>p.value),low=Math.min(...values),range=Math.max(Math.max(...values)-low,Math.abs(low)*.001,.0001);
  const d=values.map((v,i)=>(i?'L':'M')+(2+i/(values.length-1)*88).toFixed(1)+','+(28-(v-low)/range*24).toFixed(1)).join(' ');
  return `<svg viewBox="0 0 92 32" class="fm-spark" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
 }
 root.AYYYMarketChart={plot,spark};
 if(typeof module!=='undefined')module.exports=root.AYYYMarketChart;
})(typeof window==='undefined'?globalThis:window);
