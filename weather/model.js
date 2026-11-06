/* AYYY weather data model. No DOM, no dependencies, no synthetic live values. */
(function (root) {
  'use strict';
  const SCHEMA = 4;
  const TTL = 90 * 60 * 1000;
  const MAX_CACHE = 5;
  const CITIES = [
    {name:'Франкфурт-на-Майне',country:'Германия',latitude:50.1155,longitude:8.6842,timezone:'Europe/Berlin'},
    {name:'Москва',country:'Россия',latitude:55.7558,longitude:37.6173,timezone:'Europe/Moscow'},
    {name:'Wilmington',country:'США · Delaware',latitude:39.7459,longitude:-75.5466,timezone:'America/New_York'},
    {name:'Санкт-Петербург',country:'Россия',latitude:59.9386,longitude:30.3141,timezone:'Europe/Moscow'},
    {name:'Лиссабон',country:'Португалия',latitude:38.7223,longitude:-9.1393,timezone:'Europe/Lisbon'},
    {name:'Токио',country:'Япония',latitude:35.6762,longitude:139.6503,timezone:'Asia/Tokyo'}
  ];
  const formatters = new Map();
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const range = (v,min,max) => number(v) !== null && v >= min && v <= max;
  const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
  function timezone(value) {
    try { new Intl.DateTimeFormat('ru',{timeZone:value}).format(0); return value; }
    catch { return 'UTC'; }
  }
  function parts(epoch,zone) {
    const key=timezone(zone);
    if(!formatters.has(key)) formatters.set(key,new Intl.DateTimeFormat('en-CA',{timeZone:key,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
    return Object.fromEntries(formatters.get(key).formatToParts(new Date(epoch*1000)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  }
  function dateKey(epoch,zone) { const p=parts(epoch,zone); return `${p.year}-${p.month}-${p.day}`; }
  function time(epoch,zone) { if(number(epoch)===null)return '—';const p=parts(epoch,zone);return `${p.hour}:${p.minute}`; }
  function dateLabel(key,options={day:'numeric',month:'long'}) {
    return new Intl.DateTimeFormat('ru-RU',{...options,timeZone:'UTC'}).format(new Date(key+'T12:00:00Z'));
  }
  // Only the explicitly labelled demo generator needs wall-clock -> UTC conversion.
  function localEpoch(key,hour,zone) {
    const target=Date.parse(key+'T'+String(hour).padStart(2,'0')+':00:00Z')/1000;
    let result=target;
    for(let i=0;i<3;i++){const p=parts(result,zone);const represented=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`)/1000;result+=target-represented;}
    return result;
  }
  function validCity(v) {return !!v&&typeof v.name==='string'&&v.name.trim().length>0&&v.name.length<=150&&range(v.latitude,-90,90)&&range(v.longitude,-180,180);}
  function cleanCity(v) {
    if(!validCity(v))throw new Error('Некорректные координаты города.');
    return {name:v.name.trim().slice(0,150),country:String(v.country||'').slice(0,150),latitude:v.latitude,longitude:v.longitude,timezone:timezone(v.timezone||'UTC')};
  }
  function cityKey(city) {return city.latitude.toFixed(4)+','+city.longitude.toFixed(4);}
  function condition(code,isDay=true) {
    if(code===0)return {key:'clear',label:isDay?'Ясно':'Ясная ночь',icon:isDay?'sun':'moon'};
    if(code===1||code===2)return {key:'partly',label:'Переменная облачность',icon:isDay?'partly':'moon-cloud'};
    if(code===3)return {key:'cloudy',label:'Пасмурно',icon:'cloud'};
    if(code===45||code===48)return {key:'fog',label:code===48?'Изморозь и туман':'Туман',icon:'fog'};
    if([51,53,55,56,57].includes(code))return {key:'rain',label:[56,57].includes(code)?'Переохлаждённая морось':'Морось',icon:'rain'};
    if([61,63,65,66,67,80,81,82].includes(code))return {key:'rain',label:[65,67,82].includes(code)?'Сильный дождь':[66,67].includes(code)?'Ледяной дождь':'Дождь',icon:'rain'};
    if([71,73,75,77,85,86].includes(code))return {key:'snow',label:[75,86].includes(code)?'Сильный снег':'Снег',icon:'snow'};
    if([95,96,99].includes(code))return {key:'storm',label:[96,99].includes(code)?'Гроза с градом':'Гроза',icon:'storm'};
    return {key:'unknown',label:'Нет данных об облачности',icon:'cloud'};
  }
  function phase(point,day) {
    if(number(day?.sunrise)!==null&&number(day?.sunset)!==null) {
      if(Math.abs(point.time-day.sunrise)<40*60)return 'dawn';
      if(Math.abs(point.time-day.sunset)<45*60)return 'dusk';
      return point.time>=day.sunrise&&point.time<day.sunset?'day':'night';
    }
    return point.isDay===false?'night':'day';
  }
  function direction(deg) {return number(deg)===null?'—':['С','СВ','В','ЮВ','Ю','ЮЗ','З','СЗ'][Math.round(((deg%360)+360)%360/45)%8];}
  function temperature(v,unit='C',sign=true) {
    if(number(v)===null)return '—';
    const n=Math.round(unit==='F'?v*9/5+32:v);
    return `${sign&&n>0?'+':''}${n}°`;
  }
  function value(v,digits=0) {return number(v)===null?'—':new Intl.NumberFormat('ru',{maximumFractionDigits:digits}).format(v);}
  const row = (data,key,i,min=-Infinity,max=Infinity) => {const v=data?.[key]?.[i];return range(v,min,max)?v:null;};
  function parse(raw,city,now=Date.now()) {
    const h=raw?.hourly,d=raw?.daily,c=raw?.current;
    if(!raw||raw.error||!Array.isArray(h?.time)||!Array.isArray(d?.time)||!range(c?.time,1,1e11))throw new Error('Источник вернул неполный прогноз.');
    const zone=timezone(raw.timezone||city.timezone);
    const hours=h.time.slice(0,16*24+2).map((stamp,i)=>({
      time:stamp,temp:row(h,'temperature_2m',i,-110,70),feels:row(h,'apparent_temperature',i,-140,100),
      humidity:row(h,'relative_humidity_2m',i,0,100),code:row(h,'weather_code',i,0,99),
      pressure:row(h,'pressure_msl',i,800,1150),clouds:row(h,'cloud_cover',i,0,100),
      wind:row(h,'wind_speed_10m',i,0,150),direction:row(h,'wind_direction_10m',i,0,360),gust:row(h,'wind_gusts_10m',i,0,200),
      pop:row(h,'precipitation_probability',i,0,100),precip:row(h,'precipitation',i,0,1000),uv:row(h,'uv_index',i,0,40),
      visibility:row(h,'visibility',i,0,1e6),isDay:h.is_day?.[i]===1
    })).filter(p=>range(p.time,1,1e11)&&p.temp!==null);
    const days=d.time.slice(0,14).map((stamp,i)=>({
      time:stamp,date:dateKey(stamp+(number(raw.utc_offset_seconds)||0),'UTC'),
      min:row(d,'temperature_2m_min',i,-110,70),max:row(d,'temperature_2m_max',i,-110,70),code:row(d,'weather_code',i,0,99),
      sunrise:row(d,'sunrise',i,1,1e11),sunset:row(d,'sunset',i,1,1e11),
      pop:row(d,'precipitation_probability_max',i,0,100),precip:row(d,'precipitation_sum',i,0,2000),
      wind:row(d,'wind_speed_10m_max',i,0,150),uv:row(d,'uv_index_max',i,0,40)
    })).filter(p=>range(p.time,1,1e11)&&p.min!==null&&p.max!==null&&p.min<=p.max);
    const close=hours.reduce((best,p)=>Math.abs(p.time-c.time)<Math.abs(best.time-c.time)?p:best,hours[0]||{time:c.time});
    const read=(key,min,max)=>range(c[key],min,max)?c[key]:null;
    const current={...close,time:c.time,temp:read('temperature_2m',-110,70),feels:read('apparent_temperature',-140,100),
      humidity:read('relative_humidity_2m',0,100),pressure:read('pressure_msl',800,1150),code:read('weather_code',0,99),
      clouds:read('cloud_cover',0,100),wind:read('wind_speed_10m',0,150),direction:read('wind_direction_10m',0,360),gust:read('wind_gusts_10m',0,200),
      precip:read('precipitation',0,1000),isDay:c.is_day===1};
    if(!hours.length||!days.length||current.temp===null)throw new Error('Не получены температура или почасовой прогноз.');
    return {schema:SCHEMA,live:true,city:cleanCity({...city,timezone:zone}),timezone:zone,updatedAt:now,current,hours,days};
  }
  function forecastURL(city) {
    const common='temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover,precipitation';
    const q=new URLSearchParams({latitude:city.latitude,longitude:city.longitude,timezone:'auto',timeformat:'unixtime',wind_speed_unit:'ms',forecast_days:'14',current:common,hourly:common+',precipitation_probability,uv_index,visibility',daily:'temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max'});
    return 'https://api.open-meteo.com/v1/forecast?'+q;
  }
  async function json(url,signal) {
    const response=await fetch(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error(`Источник недоступен (HTTP ${response.status}).`);
    return response.json();
  }
  async function forecast(city,signal) {return parse(await json(forecastURL(city),signal),city);}
  async function search(query,signal) {
    const q=String(query).trim();if(q.length<2)return [];
    const raw=await json('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:q.slice(0,100),count:'8',language:'ru',format:'json'}),signal);
    return (Array.isArray(raw?.results)?raw.results:[]).filter(validCity).map(c=>cleanCity({...c,country:[c.country,c.admin1].filter(Boolean).join(' · ')}));
  }
  function read(key,fallback=null) {try{const raw=root.localStorage?.getItem('ayyy:v1:'+key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
  function write(key,data) {try{root.localStorage?.setItem('ayyy:v1:'+key,JSON.stringify(data));return true;}catch{return false;}}
  function validCache(v,city) {
    const validPoint=p=>p&&range(p.time,1,1e11)&&range(p.temp,-110,70);
    return !!v&&v.schema===SCHEMA&&v.live===true&&range(v.updatedAt,1,Date.now()+60000)&&validCity(v.city)&&cityKey(v.city)===cityKey(city)&&validPoint(v.current)&&Array.isArray(v.hours)&&v.hours.length>0&&v.hours.length<=386&&v.hours.every(validPoint)&&Array.isArray(v.days)&&v.days.length>0&&v.days.length<=14&&v.days.every(d=>d&&typeof d.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&Number.isFinite(Date.parse(d.date+'T12:00:00Z'))&&range(d.min,-110,70)&&range(d.max,-110,70)&&d.min<=d.max);
  }
  function cached(city) {const data=read('weather.scene.cache.'+cityKey(city));return validCache(data,city)?data:null;}
  function save(data) {
    if(!validCache(data,data.city))return false;
    const key=cityKey(data.city),keys=read('weather.scene.cities',[]);
    const list=[key,...(Array.isArray(keys)?keys:[]).filter(v=>typeof v==='string'&&v!==key)];
    const saved=write('weather.scene.cache.'+key,data);
    if(saved){for(const old of list.slice(MAX_CACHE)){try{root.localStorage?.removeItem('ayyy:v1:weather.scene.cache.'+old);}catch{}}
      write('weather.scene.cities',list.slice(0,MAX_CACHE));write('weather.city',data.city);}
    return saved;
  }
  function stale(data,now=Date.now()) {return data.live&&now-data.updatedAt>TTL;}
  function demo(city=CITIES[0],now=Date.now()) {
    const zone=city.timezone,key=dateKey(now/1000,zone),hours=[],days=[];
    const codes=[2,61,3,0,2,71,45,0,3,61,2,0,3,61];
    for(let n=0;n<14;n++){
      const dk=new Date(Date.parse(key+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
      const dailyCode=codes[n],base=[12,11,10,14,12,0,6,10,11,9,12,13,10,11][n];
      const dayHours=[];
      for(let hr=0;hr<24;hr++){
        const code=n===0?(hr>=19?61:hr<7?0:2):dailyCode;
        const p={time:localEpoch(dk,hr,zone),temp:Math.round((base-2+3*Math.cos((hr-15)*Math.PI/12))*10)/10,
          feels:base-3+2*Math.cos((hr-15)*Math.PI/12),humidity:Math.round(62+16*Math.cos(hr*Math.PI/12)),code,
          pressure:1017-n%4*3,clouds:code===0?7:code===2?35:87,wind:3.2+(n%4)*1.2+Math.sin(hr/6),gust:7.4+n%4,
          direction:245+n*9,pop:[61,71].includes(code)?72:code===0?0:20,precip:[61,71].includes(code)?.8:0,
          uv:hr>8&&hr<17?Math.max(0,2.3*Math.cos((hr-12)*Math.PI/10)):0,visibility:code===45?700:18000,
          isDay:hr>=8&&hr<17};hours.push(p);dayHours.push(p);
      }
      days.push({time:localEpoch(dk,0,zone),date:dk,min:Math.min(...dayHours.map(h=>h.temp)),max:Math.max(...dayHours.map(h=>h.temp)),code:dailyCode,
        sunrise:localEpoch(dk,7,zone)+32*60,sunset:localEpoch(dk,16,zone)+47*60,pop:[61,71].includes(dailyCode)?80:dailyCode===0?0:20,
        precip:[61,71].includes(dailyCode)?4.8:0,wind:6+n%3,uv:2.3});
    }
    // The first opening is an illustrative daytime preview, not the device's weather.
    const current={...hours[14],temp:12,feels:10,wind:4.1,humidity:68};
    return {schema:SCHEMA,live:false,city:cleanCity(city),timezone:zone,updatedAt:null,current,hours,days};
  }
  function homeSnapshot(data) {
    if(!data.live)return null;
    const p=data.current,selected=data.hours.filter(h=>h.time>=Math.floor(p.time/3600)*3600).slice(0,6);
    const local=stamp=>dateKey(stamp,data.timezone)+'T'+time(stamp,data.timezone);
    const result={schema:2,live:true,city:data.city.name,country:data.city.country,latitude:data.city.latitude,longitude:data.city.longitude,timezone:data.timezone,
      updatedAt:new Date(data.updatedAt).toISOString(),observedAt:local(p.time),temp:p.temp,feels:p.feels,humidity:p.humidity,wind:p.wind,code:p.code,isDay:p.isDay,
      hours:selected.map(h=>({time:local(h.time),temp:h.temp,code:h.code,rain:h.pop})),days:data.days.slice(0,7).map(d=>({date:d.date,min:d.min,max:d.max,code:d.code,rain:d.pop,sunrise:d.sunrise?local(d.sunrise):null,sunset:d.sunset?local(d.sunset):null}))};
    if(selected.length!==6||result.days.length!==7||[p.temp,p.feels,p.humidity,p.wind,p.code].some(v=>number(v)===null)||selected.some(h=>h.pop===null))return null;
    return result;
  }
  const api={SCHEMA,TTL,CITIES,number,range,clamp,timezone,parts,dateKey,time,dateLabel,localEpoch,validCity,cleanCity,cityKey,condition,phase,direction,temperature,value,parse,forecastURL,forecast,search,read,write,cached,save,stale,demo,validCache,homeSnapshot};
  root.AYYYWeatherModel=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
