
/* Pure model: one coordinate system/tree, four seasons and four time-of-day phases. */
(function(root){'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(+v)?+v:a));
 const lerp=(a,b,t)=>a+(b-a)*t;
 const mix=(a,b,t)=>a.map((v,i)=>Math.round(lerp(v,b[i],t)));
 const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
 const months=[
  ['winter','snow',0,'Голые ветви и снег'],['winter','snow',0,'Те же ветви под инеем'],
  ['spring','buds',0,'Почки на концах тех же ветвей'],['spring','small',0,'Почки и первые маленькие листья'],['spring','young',.5,'Молодая светло-зелёная листва'],
  ['summer','full',1,'Густая зелень'],['summer','full',1,'Полная летняя крона'],['summer','late',1,'Позднее лето'],
  ['autumn','gold',.7,'Переход от зелени к золоту'],['autumn','orange',1,'Золотая крона и листопад'],['autumn','sparse',.17,'Последние листья'],['winter','snow',0,'Снег на неизменных ветвях']
 ];
 function season(m){m=Math.floor(clamp(m,0,11));const [asset,stage,density,description]=months[m];return {asset,stage,density,description,month:m,name:{spring:'Весна',summer:'Лето',autumn:'Осень',winter:'Зима'}[asset],structure:'tree-structure.png'};}
 function rain(p){p=clamp(p,0,100);const t=p/100;return {percent:p,label:p===0?'Без осадков':p<21?'Морось':p<46?'Слабый дождь':p<71?'Умеренный дождь':p<91?'Сильный дождь':'Ливень',density:p?Math.round(16+360*t**1.45):0,speed:lerp(190,1000,t),length:lerp(3,23,t),width:lerp(.45,1.2,t),opacity:lerp(.16,.43,t),splash:t>.42,veil:Math.max(0,(t-.65)*.18)};}
 const palettes={
  night:{paper:[13,25,37],sky:[12,24,38],horizon:[19,35,50],ink:[231,239,245],muted:[164,187,202],night:1,warm:0,moon:1,brightness:.30},
  blue:{paper:[44,54,74],sky:[36,48,70],horizon:[101,86,109],ink:[239,241,245],muted:[192,203,217],night:.70,warm:.24,moon:.5,brightness:.53},
  gold:{paper:[246,239,226],sky:[220,219,219],horizon:[247,196,146],ink:[25,46,57],muted:[82,108,123],night:.14,warm:1,moon:0,brightness:.94},
  day:{paper:[247,250,248],sky:[226,237,242],horizon:[242,247,243],ink:[25,50,63],muted:[80,110,125],night:0,warm:0,moon:0,brightness:1}
 };
 function lighting(minutes,sunrise=452,sunset=1007){
  const t=clamp(minutes,0,1439),sr=sunrise,ss=sunset;
  const points=[[0,'night'],[sr-90,'night'],[sr-48,'blue'],[sr+2,'gold'],[sr+70,'day'],[ss-65,'day'],[ss-5,'gold'],[ss+45,'blue'],[ss+110,'night'],[1439,'night']].sort((a,b)=>a[0]-b[0]);
  let l=points[0],r=points.at(-1);for(let i=1;i<points.length;i++){if(t<=points[i][0]){l=points[i-1];r=points[i];break;}}
  const a=palettes[l[1]],b=palettes[r[1]],u=smooth((t-l[0])/Math.max(1,r[0]-l[0])),o={};
  for(const k of ['paper','sky','horizon','ink','muted'])o[k]=mix(a[k],b[k],u);
  for(const k of ['night','warm','moon','brightness'])o[k]=lerp(a[k],b[k],u);
  o.stars=smooth((o.night-.58)/.42);o.phase=t<sr-90||t>=ss+110?'night':t<sr+70?'dawn':t<ss-65?'day':'dusk';
  o.title={dawn:'Утро',day:'День',dusk:'Сумерки',night:'Ночь'}[o.phase];
  o.time=String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');
  return o;
 }
 function atmosphere(light,weather){
  const severity={clear:0,cloudy:.30,rain:.52,storm:.88,snow:.22,fog:.22}[weather]||0;
  const wet=weather==='storm'||weather==='rain';
  let paper=mix(light.paper,light.night>.6?[14,26,38]:[157,175,190],severity*(1-light.night)*.65);
  let sky=mix(light.sky,light.night>.6?[12,23,36]:[68,88,109],severity*.84);
  let horizon=mix(light.horizon,light.night>.6?[18,33,48]:[161,179,191],severity*.62);
  if(weather==='storm'){paper=mix([53,70,87],[12,24,37],light.night);sky=mix([27,42,62],[10,22,35],light.night);horizon=mix([69,88,106],[17,33,48],light.night);}
  const dark=light.night>.58||weather==='storm';
  const brightness=light.brightness*(1-severity*(weather==='storm'?.43:.27));
  return {...light,paper,sky,horizon,dark,brightness,cloudCover:({clear:.12,cloudy:.65,rain:.82,storm:1,snow:.68,fog:.53})[weather],weather,wet,severity,ink:dark?[234,241,245]:[23,44,56],muted:dark?[171,192,207]:[68,96,113]};
 }
 root.AYYYTreePalette={clamp,lerp,mix,smooth,season,rain,lighting,atmosphere,palettes};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.AYYYTreePalette;
})(typeof window!=='undefined'?window:globalThis);

