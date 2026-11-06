/* AYYY City · shared formatting and accessible SVG charts; no network requests. */
(function(root){
'use strict';
const A=root.AYYY,escape=A.escape;
const fmt=(n,d=2)=>Number.isFinite(n)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d}).format(n):'—';
const short=n=>Math.abs(n)>=1e6?fmt(n/1e6,1)+' млн':Math.abs(n)>=1000?fmt(n/1000,0)+' тыс.':fmt(n,2);
const date=s=>{try{return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T00:00:00Z'));}catch{return s;}};
const input=(name,label,value,attrs='',suffix='')=>`<label class="city-field"><span>${label}</span><div class="city-input-wrap"><input name="${name}" value="${escape(value)}" ${attrs}>${suffix?`<em>${suffix}</em>`:''}</div></label>`;
const select=(name,label,value,options)=>`<label class="city-field"><span>${label}</span><select name="${name}">${options.map(([v,t])=>`<option value="${v}" ${value===v?'selected':''}>${t}</option>`).join('')}</select></label>`;
const button=(action,text,icon,primary=false)=>`<button class="city-button ${primary?'is-primary':''}" type="button" data-city="${action}">${icon?A.icon(icon,16):''}${text}</button>`;
function graph(series,options={}){
 const w=800,h=244,p={l:53,r:20,t:18,b:30};const all=series.flatMap(s=>s.points).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(!all.length)return '<p class="city-empty">Нет значений для графика.</p>';
 const xMin=options.xMin??Math.min(...all.map(p=>p.x)),xMax=options.xMax??Math.max(...all.map(p=>p.x)),yMin=options.yMin??Math.min(0,...all.map(p=>p.y)),yMax=options.yMax??Math.max(...all.map(p=>p.y));
 const dx=xMax-xMin||1,dy=yMax-yMin||1,X=x=>p.l+(x-xMin)/dx*(w-p.l-p.r),Y=y=>h-p.b-(y-yMin)/dy*(h-p.t-p.b);
 const ticks=Array.from({length:5},(_,i)=>{const v=yMin+dy*i/4,y=Y(v);return `<line x1="${p.l}" y1="${y}" x2="${w-p.r}" y2="${y}" class="city-gridline"/><text x="${p.l-10}" y="${y+4}" text-anchor="end">${escape((options.yFormat||short)(v))}</text>`;}).join('');
 const xTicks=Array.from({length:5},(_,i)=>{const x=xMin+dx*i/4;return `<text x="${X(x)}" y="${h-7}" text-anchor="middle">${escape(options.xFormat?options.xFormat(x):fmt(x,1))}</text>`;}).join('');
 const lines=series.map((s,index)=>{let d='',prev=null;for(const q of s.points){if(!Number.isFinite(q.y)){prev=null;continue;}const x=X(q.x),y=Y(q.y);if(!Number.isFinite(x)||!Number.isFinite(y)){prev=null;continue;}const broken=prev&&Math.abs(y-prev.y)>h*.9&&((y>h)!==(prev.y>h));d+=(prev&&!broken?'L':'M')+x.toFixed(2)+','+Math.max(-1e5,Math.min(1e5,y)).toFixed(2)+' ';prev={x,y};}return `<path d="${d}" fill="none" stroke="${s.color||['#325c8d','#bd8551','#4b8c96'][index%3]}" stroke-width="${s.dashed?1.7:2.5}" ${s.dashed?'stroke-dasharray="6 5"':''} vector-effect="non-scaling-stroke"/>`;}).join('');
 const axes=(xMin<0&&xMax>0?`<line x1="${X(0)}" y1="${p.t}" x2="${X(0)}" y2="${h-p.b}" class="city-axis"/>`:'')+(yMin<0&&yMax>0?`<line x1="${p.l}" y1="${Y(0)}" x2="${w-p.r}" y2="${Y(0)}" class="city-axis"/>`:'');
 return `<svg xmlns="http://www.w3.org/2000/svg" class="city-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(options.label||'Расчётный график')}" data-xmin="${xMin}" data-xmax="${xMax}" data-ymin="${yMin}" data-ymax="${yMax}"><defs><clipPath id="city-plot-clip"><rect x="${p.l}" y="${p.t}" width="${w-p.l-p.r}" height="${h-p.t-p.b}"/></clipPath></defs>${ticks}${xTicks}<g clip-path="url(#city-plot-clip)">${axes}${lines}</g><line class="city-crosshair" x1="0" y1="${p.t}" x2="0" y2="${h-p.b}" visibility="hidden"/></svg>`;
}
root.AYYYCity={A,escape,fmt,short,date,input,select,button,graph};
})(window);
