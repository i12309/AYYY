/* AYYY · optional public data, with explicit demo and saved-data states. */
(() => {
  'use strict';
  const app = window.AYYY;
  const esc = app.escape;
  const presets = [
    {name:'Москва', country:'Россия', latitude:55.7558, longitude:37.6173, timezone:'Europe/Moscow'},
    {name:'Wilmington', country:'США · Delaware', latitude:39.7459, longitude:-75.5466, timezone:'America/New_York'},
    {name:'Берлин', country:'Германия', latitude:52.52, longitude:13.405, timezone:'Europe/Berlin'}
  ];
  const codes = ['RUB','USD','EUR','GBP','CNY'];
  const currencies = {RUB:{name:'Российский рубль',symbol:'₽'},USD:{name:'Доллар США',symbol:'$'},EUR:{name:'Евро',symbol:'€'},GBP:{name:'Фунт стерлингов',symbol:'£'},CNY:{name:'Китайский юань',symbol:'¥'}};
  const isFiniteNumber = (value,min=-Infinity,max=Infinity) => typeof value==='number' && Number.isFinite(value) && value>=min && value<=max;
  const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T12:00:00Z'));
  const validLocalTime = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && Number.isFinite(Date.parse(value+'Z'));
  const validStamp = value => typeof value==='string' && Number.isFinite(Date.parse(value));
  const validCity = value => value && typeof value.name==='string' && value.name.trim().length>0 && value.name.length<=150 && isFiniteNumber(value.latitude,-90,90) && isFiniteNumber(value.longitude,-180,180);
  const timeZone = value => {try{new Intl.DateTimeFormat('ru-RU',{timeZone:value}).format();return value;}catch{return 'UTC';}};
  const cleanCity = value => ({name:value.name.trim().slice(0,150),country:String(value.country||'').slice(0,150),latitude:value.latitude,longitude:value.longitude,timezone:timeZone(value.timezone||'UTC')});
  const cityKey = city => city.latitude.toFixed(4)+','+city.longitude.toFixed(4);
  let selectedCity = app.get('weather.city',null);
  selectedCity = validCity(selectedCity) ? cleanCity(selectedCity) : {...presets[0]};
  let weatherTicket = 0, weatherPendingKey = '', weatherPromise = null, weatherError = '';
  let ratesPending = false, ratesPromise = null, ratesError = '';
  let selectedMarket = 'spx', selectedPeriod = 'day';
  const weatherMemory = new Map();

  function dateLabel(date,full=false) {
    if(!validDate(date))return 'дата не указана';
    return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:full?'long':'short',...(full?{year:'numeric'}:{}),timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  }
  function stampLabel(stamp) {
    if(!validStamp(stamp))return '';
    return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(stamp));
  }
  function localClock(zone) {
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timeZone(zone),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }
  function weatherDescription(code,isDay=true) {
    if(code===0)return {condition:isDay?'Ясно':'Ясная ночь',icon:isDay?'sun':'moon'};
    if([1,2].includes(code))return {condition:'Переменная облачность',icon:isDay?'sun':'moon'};
    if(code===3)return {condition:'Облачно',icon:'cloud'};
    if([45,48].includes(code))return {condition:'Туман',icon:'cloud'};
    if([51,53,55,56,57].includes(code))return {condition:'Морось',icon:'rain'};
    if([61,63,65,66,67,80,81,82].includes(code))return {condition:'Дождь',icon:'rain'};
    if([71,73,75,77,85,86].includes(code))return {condition:'Снег',icon:'cloud'};
    if([95,96,99].includes(code))return {condition:'Гроза',icon:'rain'};
    return {condition:'Переменная погода',icon:'cloud'};
  }
  function demoWeather(city) {
    const base=cityKey(city)===cityKey(presets[1])?16:cityKey(city)===cityKey(presets[2])?9:12;
    const local=localClock(city.timezone), date=local.slice(0,10), start=Date.parse(local.slice(0,13)+':00:00Z');
    const dailyCodes=[2,3,61,3,2,0,2];
    return {schema:2,city:city.name,country:city.country,latitude:city.latitude,longitude:city.longitude,timezone:city.timezone,temp:base,feels:base-2,humidity:64,wind:3.2,code:2,isDay:true,...weatherDescription(2),live:false,stale:false,updatedAt:null,observedAt:local,
      hours:Array.from({length:6},(_,i)=>({time:new Date(start+i*3600000).toISOString().slice(0,16),temp:base+[0,1,2,1,0,-1][i],code:[2,2,3,3,61,3][i],rain:[10,10,15,25,60,35][i]})),
      days:Array.from({length:7},(_,i)=>({date:new Date(Date.parse(date+'T12:00:00Z')+i*86400000).toISOString().slice(0,10),min:base-6+[0,1,1,-1,-2,-1,0][i],max:base+[1,2,0,-1,0,2,1][i],code:dailyCodes[i],rain:[10,25,70,30,10,0,15][i],sunrise:date+'T07:20',sunset:date+'T17:05'}))};
  }
  function validWeather(value) {
    return value && value.schema===2 && value.live===true && validStamp(value.updatedAt) && validLocalTime(value.observedAt) && isFiniteNumber(value.temp,-110,70) && isFiniteNumber(value.feels,-130,90) && isFiniteNumber(value.humidity,0,100) && isFiniteNumber(value.wind,0,200) && isFiniteNumber(value.code,0,99) && Array.isArray(value.hours) && value.hours.length===6 && value.hours.every(h=>validLocalTime(h.time)&&isFiniteNumber(h.temp,-110,70)&&isFiniteNumber(h.code,0,99)&&isFiniteNumber(h.rain,0,100)) && Array.isArray(value.days) && value.days.length===7 && value.days.every(d=>validDate(d.date)&&isFiniteNumber(d.min,-110,70)&&isFiniteNumber(d.max,-110,70)&&d.min<=d.max&&isFiniteNumber(d.code,0,99)&&isFiniteNumber(d.rain,0,100));
  }
  app.getWeather = () => {
    const key=cityKey(selectedCity);
    let value=weatherMemory.get(key);
    if(!value){const saved=app.get('weather.cache.'+key,null);if(validWeather(saved)){value=saved;weatherMemory.set(key,value);}}
    if(!value)return {...demoWeather(selectedCity),pending:weatherPendingKey===key,error:weatherError};
    return {...value,city:selectedCity.name,country:selectedCity.country,...weatherDescription(value.code,value.isDay),stale:Date.now()-Date.parse(value.updatedAt)>90*60000,pending:weatherPendingKey===key,error:weatherError};
  };
  function notify(type,refreshHome=false) {
    document.dispatchEvent(new CustomEvent('ayyy:'+type));
    const active=document.activeElement;
    const isEditing=active && (active.matches('input,textarea,select')||active.isContentEditable);
    if(refreshHome && app.route==='home' && !app.homeDataMounted && !isEditing && !document.querySelector('#modal')?.open && app.views.home)app.render();
  }
  function parseWeather(data,city) {
    const current=data?.current, hourly=data?.hourly, daily=data?.daily;
    if(!current||!hourly||!daily||!validLocalTime(current.time))throw new Error('Источник вернул неполный прогноз.');
    if(!Array.isArray(hourly.time)||!Array.isArray(daily.time))throw new Error('Источник вернул неполный прогноз.');
    const start=hourly.time.findIndex(t=>typeof t==='string' && t.slice(0,13)>=current.time.slice(0,13));
    if(start<0)throw new Error('В ответе отсутствует почасовой прогноз.');
    const hours=hourly.time.slice(start,start+6).map((time,i)=>({time,temp:hourly.temperature_2m?.[start+i],code:hourly.weather_code?.[start+i],rain:hourly.precipitation_probability?.[start+i]}));
    const days=daily.time.slice(0,7).map((date,i)=>({date,min:daily.temperature_2m_min?.[i],max:daily.temperature_2m_max?.[i],code:daily.weather_code?.[i],rain:daily.precipitation_probability_max?.[i],sunrise:validLocalTime(daily.sunrise?.[i])?daily.sunrise[i]:null,sunset:validLocalTime(daily.sunset?.[i])?daily.sunset[i]:null}));
    const value={schema:2,city:city.name,country:city.country,latitude:city.latitude,longitude:city.longitude,timezone:timeZone(data.timezone||city.timezone),temp:current.temperature_2m,feels:current.apparent_temperature,humidity:current.relative_humidity_2m,wind:current.wind_speed_10m,code:current.weather_code,isDay:current.is_day!==0,live:true,updatedAt:new Date().toISOString(),observedAt:current.time,hours,days};
    if(!validWeather(value))throw new Error('В прогнозе есть недоступные значения. Попробуйте позже.');
    return value;
  }
  app.refreshWeather = () => {
    const city={...selectedCity}, key=cityKey(city);
    if(weatherPendingKey===key && weatherPromise)return weatherPromise;
    const ticket=++weatherTicket;
    weatherPendingKey=key;weatherError='';notify('weather');
    const query=new URLSearchParams({latitude:String(city.latitude),longitude:String(city.longitude),current:'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m',hourly:'temperature_2m,precipitation_probability,weather_code',daily:'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset',timezone:'auto',wind_speed_unit:'ms',forecast_days:'7'});
    weatherPromise=(async()=>{
      try {
        const value=parseWeather(await app.fetchJSON('https://api.open-meteo.com/v1/forecast?'+query),city);
        weatherMemory.set(key,value);app.set('weather.cache.'+key,value);
        if(ticket===weatherTicket && key===cityKey(selectedCity)){weatherError='';if(['home','weather'].includes(app.route))app.toast('Погода обновлена: '+city.name);}
        return true;
      } catch(error) {
        if(ticket===weatherTicket && key===cityKey(selectedCity)){
          weatherError=error?.name==='AbortError'?'Источник не ответил за 12 секунд. Попробуйте ещё раз.':'Не удалось обновить погоду. Проверьте интернет и повторите запрос.';
          if(error?.message?.startsWith('В прогнозе')||error?.message?.startsWith('Источник вернул')||error?.message?.startsWith('В ответе'))weatherError=error.message;
          if(['home','weather'].includes(app.route))app.toast(weatherError);
        }
        return false;
      } finally {
        if(ticket===weatherTicket){weatherPendingKey='';weatherPromise=null;notify('weather',true);}
      }
    })();
    return weatherPromise;
  };

  function selectCity(city) {
    selectedCity=cleanCity(city);app.set('weather.city',selectedCity);weatherError='';weatherTicket++;weatherPendingKey='';weatherPromise=null;
    app.closeModal();
    if(app.route==='weather' || (app.route==='home' && !app.homeDataMounted))app.render();
    app.refreshWeather();
  }
  app.showCityPicker = () => {
    app.modal('Погода в вашем городе',`<div class="data-city-picker"><p class="muted small">Выберите город или найдите его по названию. Поиск и обновление выполняются только по вашему действию.</p><form class="data-city-form" id="data-city-form"><label class="data-visually-hidden" for="data-city-query">Название города</label><input class="field" id="data-city-query" placeholder="Город, например Казань" maxlength="120" autocomplete="off" required minlength="2"><button class="btn primary" type="submit">${app.icon('search',17)} Найти</button></form><div class="data-city-section">Быстрый выбор</div><div>${presets.map((city,i)=>`<button class="city-option" type="button" data-city-preset="${i}"><span><strong>${esc(city.name)}</strong><small>${esc(city.country)}</small></span>${app.icon(cityKey(city)===cityKey(selectedCity)?'check':'pin',17)}</button>`).join('')}</div><div id="data-city-results" aria-live="polite"></div><div class="market-source">Геокодинг: <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noopener noreferrer">Open-Meteo / GeoNames</a></div></div>`);
    const picker=document.querySelector('.data-city-picker'), form=picker.querySelector('form'), input=picker.querySelector('input'), results=picker.querySelector('#data-city-results');
    let searchTicket=0, found=[];
    const isCurrent=()=>picker.isConnected && document.querySelector('#modal')?.open && document.querySelector('#modal-body')?.contains(picker);
    picker.addEventListener('click',event=>{
      const quick=event.target.closest('[data-city-preset]');if(quick){const city=presets[Number(quick.dataset.cityPreset)];if(city)selectCity(city);return;}
      const result=event.target.closest('[data-city-result]');if(result){const city=found[Number(result.dataset.cityResult)];if(city)selectCity(city);}
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();const name=input.value.trim();if(name.length<2)return;
      const ticket=++searchTicket, button=form.querySelector('button');button.disabled=true;found=[];results.innerHTML='<p class="data-city-message">Ищем город…</p>';
      try {
        const response=await app.fetchJSON('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name,count:'6',language:'ru',format:'json'}));
        if(!isCurrent()||ticket!==searchTicket)return;
        if(response?.error)throw new Error('Invalid geocoding response');
        found=(Array.isArray(response?.results)?response.results:[]).filter(validCity).map(city=>cleanCity({...city,country:[city.country,city.admin1].filter(Boolean).join(' · ')}));
        results.innerHTML=found.length?'<div class="data-city-section">Результаты поиска</div>'+found.map((city,i)=>`<button class="city-option" type="button" data-city-result="${i}"><span><strong>${esc(city.name)}</strong><small>${esc(city.country)}</small></span>${app.icon('arrow-right',17)}</button>`).join(''):'<p class="data-city-message">Город не найден. Попробуйте другое название или добавьте страну.</p>';
      } catch {if(isCurrent()&&ticket===searchTicket)results.innerHTML='<p class="data-city-message data-error" role="alert">Не удалось выполнить поиск. Проверьте соединение или выберите один из городов выше.</p>';}
      finally {if(isCurrent()&&ticket===searchTicket)button.disabled=false;}
    });
    input.focus({preventScroll:true});
  };

  function sourceBadge(data) {
    return `<span class="badge ${data.live?'':'demo'}">${data.live?(data.stale?'Сохранённые данные':'Открытый API'):'Демо-данные'}</span>`;
  }
  function weatherStatus(data) {
    if(data.error)return `<div class="notice amber data-notice" role="alert">${app.icon('cloud',18)}<span>${esc(data.error)} ${data.live?'Показан последний сохранённый прогноз.':'Показан демонстрационный прогноз.'}</span></div>`;
    if(!data.live)return `<div class="notice data-notice">${app.icon('lightbulb',18)}<span>Сейчас показан пример прогноза. Нажмите «Обновить», чтобы получить погоду для выбранного города.</span></div>`;
    if(data.stale)return `<div class="notice amber data-notice">${app.icon('clock',18)}<span>Это сохранённый прогноз от ${esc(stampLabel(data.updatedAt))}. Обновите его перед планированием дня.</span></div>`;
    return '';
  }
  function weatherBody() {
    const data=app.getWeather(), today=data.days[0], minimum=Math.min(...data.days.map(d=>d.min)), maximum=Math.max(...data.days.map(d=>d.max)), span=Math.max(1,maximum-minimum);
    return `${weatherStatus(data)}<div class="weather-layout"><section class="panel weather-main"><div class="weather-place">${app.icon('pin',16)}<strong>${esc(data.city)}</strong><span>${sourceBadge(data)}</span></div><div class="data-weather-country">${esc(data.country)}</div><div class="weather-big-temp">${Math.round(data.temp)}°</div><div class="weather-condition">${esc(data.condition)} <span>· ощущается как ${Math.round(data.feels)}°</span></div><div class="weather-big-icon">${app.icon(data.icon,85)}</div><div class="weather-meta"><span title="Ветер">${app.icon('wind',16)} ${app.fmt(data.wind,1)} м/с</span><span title="Относительная влажность">${app.icon('droplet',16)} ${Math.round(data.humidity)}%</span><span title="Температура за день">${app.icon('sun',16)} ${Math.round(today.min)}° / ${Math.round(today.max)}°</span></div><div class="data-observation">${data.live?`Данные на ${esc(data.observedAt.slice(11,16))} по времени города`:'Иллюстрация прогноза · не фактическая погода'}</div></section><section class="panel"><div class="panel-head"><h2>В ближайшие часы</h2><span class="small muted">${esc(data.timezone)}</span></div><div class="weather-hours">${data.hours.map((hour,i)=>`<div class="weather-hour"><span>${i===0?'Сейчас':esc(hour.time.slice(11,16))}</span>${app.icon(weatherDescription(hour.code).icon,24)}<strong>${Math.round(hour.temp)}°</strong></div>`).join('')}</div><div class="data-rain-heading"><span>${app.icon('droplet',14)} Вероятность осадков</span><span>%</span></div><div class="weather-bars" aria-label="Почасовая вероятность осадков">${data.hours.map(hour=>`<span style="height:${Math.max(7,hour.rain)}%" title="${esc(hour.time.slice(11,16))}: ${Math.round(hour.rain)}%"><i>${Math.round(hour.rain)}%</i></span>`).join('')}</div><p class="data-weather-caption">Время указано для выбранного города.</p></section></div><div class="data-weather-bottom"><section class="panel"><div class="panel-head"><h2>Прогноз на 7 дней</h2><span class="small muted">Минимум / максимум</span></div>${data.days.map((day,i)=>{
      const label=i===0?'Сегодня':i===1?'Завтра':new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(day.date+'T12:00:00Z'));
      const left=(day.min-minimum)/span*100,width=Math.max(6,(day.max-day.min)/span*100);
      return `<div class="weather-day"><span>${esc(label)}<small class="data-day-rain">Осадки ${Math.round(day.rain)}%</small></span><span title="${esc(weatherDescription(day.code).condition)}">${app.icon(weatherDescription(day.code).icon,22)}</span><span class="temp-low">${Math.round(day.min)}°</span><div class="data-temperature-track"><div class="weather-range" style="margin-left:${Math.min(94,left)}%;width:${Math.min(width,100-left)}%"></div></div><strong>${Math.round(day.max)}°</strong></div>`;
    }).join('')}</section><aside class="panel data-weather-details"><div class="panel-head"><h2>Детали дня</h2>${app.icon('sun',19)}</div><div class="data-sun-arc" aria-hidden="true"><svg viewBox="0 0 260 95" fill="none"><path d="M20 82 Q130 -45 240 82" stroke="var(--line)" stroke-width="2" stroke-dasharray="4 5"/><path d="M20 82 Q130 -45 240 82" stroke="#e1bd6b" stroke-width="2" stroke-dasharray="133 150"/><circle cx="130" cy="18" r="13" fill="#fff0c9" stroke="#e1bd6b" stroke-width="2"/><path d="M10 83h240" stroke="var(--line)"/></svg></div><div class="data-sun-times"><span>Восход<strong>${today.sunrise?esc(today.sunrise.slice(11,16)):'—'}</strong></span><span>Закат<strong>${today.sunset?esc(today.sunset.slice(11,16)):'—'}</strong></span></div><div class="data-detail-row"><span>Источник</span><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo ${app.icon('external',12)}</a></div><div class="data-detail-row"><span>Данные</span><strong>${data.live?'Прогноз погодных моделей':'Демонстрационный пример'}</strong></div><div class="data-detail-row"><span>Получено</span><strong>${data.live?esc(stampLabel(data.updatedAt)):'Ещё не запрашивались'}</strong></div><p class="data-weather-caption">Данные погоды — <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>, CC BY 4.0. Обновление выполняется по кнопке.</p></aside></div>`;
  }
  app.register('weather',{
    title:'Погода',
    render(){return `<div class="data-weather">${app.heading('Погода','Пусть планы на день совпадают с прогнозом.',`<button class="btn" data-weather-city>${app.icon('pin',17)} Сменить город</button>`)}<div class="data-toolbar"><div class="data-quick-cities">${presets.map((city,i)=>`<button class="chip ${cityKey(city)===cityKey(selectedCity)?'active':''}" data-weather-preset="${i}">${esc(city.name)}</button>`).join('')}</div><button class="btn soft" data-weather-refresh ${app.getWeather().pending?'disabled':''}>${app.icon('refresh',16)} <span>${app.getWeather().pending?'Обновляем…':'Обновить'}</span></button></div><div id="data-weather-content">${weatherBody()}</div></div>`;},
    mount(){
      const root=document.querySelector('.data-weather');
      const click=event=>{if(event.target.closest('[data-weather-city]'))app.showCityPicker();if(event.target.closest('[data-weather-refresh]'))app.refreshWeather();const preset=event.target.closest('[data-weather-preset]');if(preset){const city=presets[Number(preset.dataset.weatherPreset)];if(city)selectCity(city);}};
      const update=()=>{if(!root.isConnected||app.route!=='weather')return;const data=app.getWeather(), button=root.querySelector('[data-weather-refresh]');button.disabled=data.pending;button.querySelector('span').textContent=data.pending?'Обновляем…':'Обновить';root.querySelector('#data-weather-content').innerHTML=weatherBody();};
      root.addEventListener('click',click);document.addEventListener('ayyy:weather',update);
      return ()=>{root.removeEventListener('click',click);document.removeEventListener('ayyy:weather',update);};
    }
  });

  const demoRates={schema:2,RUB:1,USD:91.45,EUR:99.82,GBP:118.64,CNY:12.78,date:null,dates:{},live:false,updatedAt:null};
  function validRates(value) {return value && value.schema===2 && value.live===true && validStamp(value.updatedAt) && validDate(value.date) && ['USD','EUR','GBP','CNY'].every(code=>isFiniteNumber(value[code],0.000000001,1e9)&&validDate(value.dates?.[code]));}
  let currentRates=app.get('finance.rates',null);
  if(!validRates(currentRates))currentRates={...demoRates};
  app.getRates=()=>({...currentRates,RUB:1,stale:currentRates.live&&Date.now()-Date.parse(currentRates.updatedAt)>36*3600000,pending:ratesPending,error:ratesError});
  function parseRates(rows) {
    if(!Array.isArray(rows))throw new Error('Неверный формат курсов.');
    const rates={schema:2,RUB:1,live:true,updatedAt:new Date().toISOString(),dates:{}};
    for(const code of ['USD','EUR','GBP','CNY']){
      const row=rows.filter(item=>item?.base==='RUB'&&item?.quote===code&&validDate(item.date)&&isFiniteNumber(item.rate,1e-9,1e9)).sort((a,b)=>b.date.localeCompare(a.date))[0];
      if(!row)throw new Error('Источник вернул неполный набор курсов.');
      rates[code]=1/row.rate;rates.dates[code]=row.date;
    }
    rates.date=Object.values(rates.dates).sort()[0];
    if(!validRates(rates))throw new Error('В курсах есть недоступные значения.');
    return rates;
  }
  app.refreshRates=()=>{
    if(ratesPromise)return ratesPromise;
    ratesPending=true;ratesError='';notify('rates');
    ratesPromise=(async()=>{
      try {currentRates=parseRates(await app.fetchJSON('https://api.frankfurter.dev/v2/rates?base=rub&quotes=usd,eur,gbp,cny'));app.set('finance.rates',currentRates);if(['home','finance'].includes(app.route))app.toast('Справочные курсы обновлены');return true;}
      catch(error){ratesError=error?.name==='AbortError'?'Источник не ответил за 12 секунд. Попробуйте ещё раз.':'Не удалось получить курсы. Проверьте интернет и повторите запрос.';if(['home','finance'].includes(app.route))app.toast(ratesError);return false;}
      finally {ratesPending=false;ratesPromise=null;notify('rates',true);}
    })();
    return ratesPromise;
  };
  function ratesStatus() {
    const data=app.getRates();
    if(data.error)return `<div class="notice amber data-notice" role="alert">${app.icon('coins',18)}<span>${esc(data.error)} ${data.live?'Конвертер использует сохранённые курсы.':'Конвертер использует демонстрационные курсы.'}</span></div>`;
    if(!data.live)return `<div class="notice data-notice">${app.icon('lightbulb',18)}<span>Курсы приведены для демонстрации. Нажмите «Обновить курсы», чтобы загрузить данные Frankfurter.</span></div>`;
    if(data.stale)return `<div class="notice amber data-notice">${app.icon('clock',18)}<span>Курсы сохранены ${esc(stampLabel(data.updatedAt))}. Обновите данные для актуального расчёта.</span></div>`;
    return '';
  }
  function rateCards() {
    const data=app.getRates();
    return ['USD','EUR','GBP','CNY'].map(code=>`<article class="panel rate-card"><div class="rate-top"><span class="currency-avatar">${currencies[code].symbol}</span><span><strong>${code} / RUB</strong><small>${currencies[code].name}</small></span></div><div class="rate-value">${app.fmt(data[code],2)} <small>₽</small></div><div class="rate-foot">${data.live?'На '+esc(dateLabel(data.dates[code])):'Пример · не текущий курс'}</div></article>`).join('');
  }

  // The TradingView widget supplies actual market data; no synthetic quotes.
  const markets=[
    {id:'spx',name:'S&P 500',ticker:'SP:SPX',url:'https://www.tradingview.com/symbols/SPX/'},
    {id:'ndx',name:'NASDAQ 100',ticker:'NASDAQ:NDX',url:'https://www.tradingview.com/symbols/NASDAQ-NDX/'},
    {id:'imoex',name:'Индекс Мосбиржи',ticker:'MOEX:IMOEX',url:'https://www.tradingview.com/symbols/MOEX-IMOEX/'}
  ];
  const marketInterval=()=>({day:'15',week:'60',month:'D'})[selectedPeriod]||'D';
  function marketDetail() {
    const market=markets.find(m=>m.id===selectedMarket)||markets[0];
    return `<div class="data-market-head"><div><div class="data-market-name">${esc(market.name)} <span class="badge live">Данные TradingView</span></div><p class="small muted" style="margin-top:8px">График загружается от TradingView. Котировки могут быть задержаны по правилам биржи.</p></div><div class="segmented" aria-label="Интервал графика">${[['day','1Д'],['week','1Н'],['month','1М']].map(([id,label])=>`<button data-market-period="${id}" class="${selectedPeriod===id?'active':''}" aria-pressed="${selectedPeriod===id}">${label}</button>`).join('')}</div></div>
    <div id="ayyy-tv-widget" class="ayyy-tradingview-host" aria-label="График индекса ${esc(market.name)} от TradingView"><p class="muted">Подключение графика TradingView…</p></div>
    <div class="data-market-disclaimer">Источник: <a href="${market.url}" target="_blank" rel="noopener noreferrer">Открыть ${esc(market.name)} на TradingView ${app.icon('external',12)}</a>. Если внешний виджет заблокирован браузером, используйте ссылку.</div>`;
  }
  function marketTable() {
    return `<div class="market-symbol-picker" role="group" aria-label="Выбрать рыночный индекс">${markets.map(m=>`<button type="button" class="market-symbol-choice ${m.id===selectedMarket?'is-active':''}" data-market-index="${m.id}" aria-pressed="${m.id===selectedMarket}">${esc(m.name)} ${app.icon('arrow-right',14)}</button>`).join('')}</div>`;
  }

  function loadTradingView() {
    if(app.route!=='finance')return;
    const target=document.querySelector('#ayyy-tv-widget');
    if(!target||!target.isConnected)return;
    const market=markets.find(m=>m.id===selectedMarket)||markets[0];
    // Third-party code must not run in the portal origin (the user's local data is private).
    // A sandboxed srcdoc iframe gets an opaque origin: no parent DOM or storage access.
    const iframe=document.createElement('iframe');
    iframe.setAttribute('sandbox','allow-scripts allow-popups allow-popups-to-escape-sandbox');
    iframe.setAttribute('referrerpolicy','no-referrer');
    iframe.setAttribute('title','График '+market.name+' от TradingView');
    iframe.className='ayyy-tv-frame';
    iframe.style.width='100%';iframe.style.height='100%';iframe.style.border='0';
    const config={autosize:true,symbol:market.ticker,interval:marketInterval(),timezone:'Etc/UTC',theme:'light',style:'1',locale:'ru',backgroundColor:'#fffefc',gridColor:'rgba(32,54,64,0.07)',allow_symbol_change:false,hide_side_toolbar:true,hide_top_toolbar:false,withdateranges:true,save_image:false,calendar:false,details:false,hotlist:false};
    iframe.srcdoc='<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><style>html,body{margin:0;height:100%;background:#fffefc} .tradingview-widget-container{height:100%;width:100%}</style></head><body><div class="tradingview-widget-container"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div><script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>'+JSON.stringify(config)+'</'+'script></div></body></html>';
    target.replaceChildren(iframe);
  }
  function savedConversion() {
    const saved=app.get('finance.convert',{});
    return {amount:typeof saved?.amount==='string' && saved.amount.length<=30?saved.amount:'100',from:codes.includes(saved?.from)?saved.from:'USD',to:codes.includes(saved?.to)?saved.to:'RUB'};
  }
  function conversionSource() {
    const data=app.getRates();
    return `${sourceBadge(data)}<span>${data.live?'Получено '+esc(stampLabel(data.updatedAt)):'Сейчас используются примерные курсы'}</span>`;
  }
  app.register('finance',{
    title:'Валюты и рынки',
    render(){
      const data=app.getRates(),conversion=savedConversion();
      const options=selected=>codes.map(code=>`<option value="${code}" ${code===selected?'selected':''}>${code} · ${currencies[code].name}</option>`).join('');
      return `<div class="data-finance">${app.heading('Валюты и рынки','Справочные курсы и удобный пересчёт в одном месте.',`<button class="btn" data-rates-refresh ${data.pending?'disabled':''}>${app.icon('refresh',17)} <span>${data.pending?'Обновляем…':'Обновить курсы'}</span></button>`)}<div id="data-rates-status">${ratesStatus()}</div><div class="rate-cards" id="data-rate-cards">${rateCards()}</div><div class="data-finance-layout"><section class="panel data-market-panel"><div class="panel-head"><h2>Биржевые индексы</h2><span class="badge live">TradingView</span></div><div id="data-market-detail">${marketDetail()}</div><div id="data-market-table">${marketTable()}</div><p class="data-market-note">Котировки и графики получаем из официального виджета TradingView. Возможна задержка данных.</p></section><aside class="panel data-converter"><div class="panel-head"><h2>Конвертер валют</h2>${app.icon('coins',20)}</div><label class="data-field-label" for="data-amount">Сумма</label><input class="field data-amount" id="data-amount" value="${esc(conversion.amount)}" inputmode="decimal" maxlength="30" autocomplete="off"><div class="data-currency-pair"><label><span class="data-field-label">Из</span><select class="field" id="data-from">${options(conversion.from)}</select></label><button class="icon-btn data-currency-swap" id="data-swap" title="Поменять валюты местами" aria-label="Поменять валюты местами">${app.icon('refresh',17)}</button><label><span class="data-field-label">В</span><select class="field" id="data-to">${options(conversion.to)}</select></label></div><div class="convert-result" id="data-convert-result" aria-live="polite"></div><div class="market-source" id="data-conversion-source">${conversionSource()}</div><p class="data-converter-note">Пересчёт по справочным курсам. Курс банка и комиссии могут отличаться.</p><div class="data-rate-provider"><span class="data-provider-icon">${app.icon('globe',19)}</span><div><strong>Frankfurter</strong><p>Дневные курсы из официальных источников.</p><a href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer">О данных ${app.icon('external',12)}</a></div></div></aside></div><div class="market-source data-finance-foot">${app.icon('shield',14)} <span>Конвертер работает в браузере. При обновлении запрашиваются только курсы, введённая сумма никуда не передаётся.</span></div></div>`;
    },
    mount(){
      const root=document.querySelector('.data-finance'),amount=root.querySelector('#data-amount'),from=root.querySelector('#data-from'),to=root.querySelector('#data-to'),result=root.querySelector('#data-convert-result');
      function calculate(save=true) {
        const text=amount.value.replace(/[\s\u00a0]/g,'').replace(',','.');
        const valid=/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text),value=valid?Number(text):NaN,data=app.getRates();
        if(!isFiniteNumber(value,0,1e15)){
          result.innerHTML='<span class="data-error">Введите сумму от 0 до 1 000 000 000 000 000. Используйте цифры и запятую.</span>';amount.setAttribute('aria-invalid','true');return;
        }
        amount.removeAttribute('aria-invalid');
        const ratio=data[from.value]/data[to.value],total=value*ratio;
        if(!Number.isFinite(total)){result.innerHTML='<span class="data-error">Сумма слишком большая для пересчёта.</span>';return;}
        result.innerHTML=`<span>${app.fmt(value,4)} ${from.value} =</span><strong>${app.fmt(total,2)} ${currencies[to.value].symbol}</strong><span>1 ${from.value} = ${app.fmt(ratio,6)} ${to.value}</span>`;
        if(save)app.set('finance.convert',{amount:amount.value,from:from.value,to:to.value});
      }
      const click=event=>{
        if(event.target.closest('[data-rates-refresh]'))app.refreshRates();
        if(event.target.closest('#data-swap')){const temp=from.value;from.value=to.value;to.value=temp;calculate();}
        const period=event.target.closest('[data-market-period]');if(period&&['day','week','month'].includes(period.dataset.marketPeriod)){selectedPeriod=period.dataset.marketPeriod;root.querySelector('#data-market-detail').innerHTML=marketDetail();root.querySelector('#data-market-table').innerHTML=marketTable();loadTradingView();}
        const market=event.target.closest('[data-market-index]');if(market&&markets.some(m=>m.id===market.dataset.marketIndex)){selectedMarket=market.dataset.marketIndex;root.querySelector('#data-market-detail').innerHTML=marketDetail();root.querySelector('#data-market-table').innerHTML=marketTable();loadTradingView();}
      };
      const input=event=>{if([amount,from,to].includes(event.target))calculate();};
      const update=()=>{
        if(!root.isConnected||app.route!=='finance')return;
        const data=app.getRates(),button=root.querySelector('[data-rates-refresh]');button.disabled=data.pending;button.querySelector('span').textContent=data.pending?'Обновляем…':'Обновить курсы';root.querySelector('#data-rate-cards').innerHTML=rateCards();root.querySelector('#data-rates-status').innerHTML=ratesStatus();root.querySelector('#data-conversion-source').innerHTML=conversionSource();calculate(false);
      };
      root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',input);document.addEventListener('ayyy:rates',update);calculate(false);loadTradingView();
      return ()=>{root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('change',input);document.removeEventListener('ayyy:rates',update);};
    }
  });
})();
