/* Pure common weather-to-art mapping. No requests or mutation of forecast data. */
(function(root){
 'use strict';const M=root.AYYYWeatherModel,P=root.AYYYTreePalette;
 function build(data,point,selectedTime,override={},settings={},now=Date.now()/1000){
  const stamp=selectedTime===null?now:point.time,parts=M.parts(stamp,data.timezone);
  const day=data.days.find(d=>d.date===M.dateKey(stamp,data.timezone));
  let minute=Number(parts.hour)*60+Number(parts.minute),month=Number(parts.month)-1;
  const weather=M.condition(point.code,point.isDay).key;
  const interval=M.number(point.interval),mm=M.number(point.precip);
  const rate=point.precipUnit==='mm'&&mm!==null&&interval!==null&&interval>0?mm*3600/interval:null;
  const wet=['rain','snow','storm'].includes(weather);
  const effect=!wet?0:rate!==null?Math.min(1,Math.sqrt(Math.max(0,rate)/12)):weather==='storm'?.8:[55,65,67,75,82,86].includes(point.code)?.7:.3;
  let state={source:selectedTime===null?'current':'forecast',dataStatus:!data.live?'demo':M.stale(data)?'stale':'live',cityKey:M.cityKey(data.city),timezone:data.timezone,observedAt:point.time,sceneTime:stamp,calendarMonth:month,seasonMonth:(month+(data.city.latitude<0?6:0))%12,weather,cloudCover:M.number(point.clouds)===null?null:Math.max(0,Math.min(1,point.clouds/100)),precipitationRate:rate,precipitationEffect:effect,windSpeed:M.number(point.wind)??0,windDirection:M.number(point.direction),sunrise:day?.sunrise??null,sunset:day?.sunset??null,isDay:point.isDay,snowCover:weather==='snow',minute};
  if(override.base)state={...override.base,source:'manual'};
  if(override.weather){state.weather=override.weather;state.cloudCover=null;state.precipitationEffect=['rain','snow','storm'].includes(state.weather)?.5:0;state.snowCover=state.weather==='snow';}
  if(Number.isFinite(override.minute))state.minute=override.minute;
  if(Number.isInteger(override.month)){state.calendarMonth=override.month;state.seasonMonth=override.month;state.snowCover=[0,1,11].includes(override.month);}
  if(Number.isFinite(override.wind))state.windSpeed=override.wind;
  if(Number.isFinite(override.intensity))state.precipitationEffect=override.intensity;
  if(override.phase){state.minute={dawn:360,day:840,dusk:1080,night:0}[override.phase];}
  const sunValid=M.number(state.sunrise)!==null&&M.number(state.sunset)!==null&&state.sunset>state.sunrise&&M.time(state.sunset,data.timezone)>M.time(state.sunrise,data.timezone);
  let light;
  if(override.phase&&sunValid){const sr=M.parts(state.sunrise,data.timezone),ss=M.parts(state.sunset,data.timezone);const rise=Number(sr.hour)*60+Number(sr.minute),set=Number(ss.hour)*60+Number(ss.minute);// Match the v5 preset's morning glow and blue dusk around the city's real solar times.
  state.minute={dawn:Math.min(1439,rise+6),day:(rise+set)/2,dusk:Math.min(1439,set+43),night:0}[override.phase];}

  if(sunValid){const a=M.parts(state.sunrise,data.timezone),b=M.parts(state.sunset,data.timezone);light=P.lighting(state.minute,Number(a.hour)*60+Number(a.minute),Number(b.hour)*60+Number(b.minute));}
  else{const phase=override.phase||(state.isDay===false?'night':'day');light={...P.palettes[phase==='night'?'night':phase==='day'?'day':phase==='dawn'?'gold':'blue'],phase,stars:phase==='night'?1:0};}
  if(override.phase)light={...light,phase:override.phase};
  state.phase=light.phase;state.light=P.atmosphere(light,state.weather);
  if(state.cloudCover!==null)state.light.cloudCover=state.cloudCover;
  state.light.cloudCover??=.4;
  state.paused=!!settings.paused;state.flashes=settings.flashes!==false;
  return state;
 }
 root.AYYYSceneState={build};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.AYYYSceneState;
})(typeof window!=='undefined'?window:globalThis);
