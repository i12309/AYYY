/* AYYY Weather · mountable static view. Does not depend on the portal shell. */
(function(root){
  'use strict';
  const M=root.AYYYWeatherModel;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths={
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',left:'<path d="m14 5-7 7 7 7"/>',right:'<path d="m10 5 7 7-7 7"/>',down:'<path d="m6 9 6 6 6-6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',
    refresh:'<path d="M20 8a8 8 0 1 0 .3 7M20 3v5h-5"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    wind:'<path d="M2 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M5 16h5a3 3 0 1 1-3 3"/>',
    drop:'<path d="M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/><path d="M8 16a4 4 0 0 0 4 4"/>',
    thermometer:'<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M12 7v11"/><circle cx="12" cy="18" r="1.3"/>',
    gauge:'<path d="M5 20a9 9 0 1 1 14 0H5Z"/><path d="m12 13 4-6M5 12h1m12 0h1M8 6l1 2m3-4v2"/><circle cx="12" cy="13" r="1"/>',
    umbrella:'<path d="M3 12a9 9 0 0 1 18 0c-3-2-3 1-6 0s-3-1-6 0-3-2-6 0ZM12 3v18a2 2 0 0 0 4 0"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    sunrise:'<path d="M2 19h20M4 16h16M7 16a5 5 0 0 1 10 0M12 2v6M9 5l3-3 3 3M3 10l2 2m16-2-2 2"/>',
    sunset:'<path d="M2 19h20M4 16h16M7 16a5 5 0 0 1 10 0M12 2v6M9 5l3 3 3-3M3 10l2 2m16-2-2 2"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1"/>',
    pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m7 4 13 8-13 8Z"/>',
    layers:'<path d="m2 8 10-6 10 6-10 6ZM2 12l10 6 10-6M2 16l10 6 10-6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
    settings:'<path d="M5 3v4m0 6v8M12 3v10m0 6v2M19 3v2m0 6v10"/><rect x="2" y="7" width="6" height="6" rx="1"/><rect x="9" y="13" width="6" height="6" rx="1"/><rect x="16" y="5" width="6" height="6" rx="1"/>',
    lighthouse:'<path d="m8 9-2 13h12L16 9M7 9h10M8 4h8v5H8ZM7 4l5-3 5 3M10 14h4m-5 4h6"/>',check:'<path d="m4 12 5 5L20 6"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>'
  };
  const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.info}</svg>`;
  function weatherIcon(code,isDay=true){
    const k=M.condition(code,isDay).key;
    const rays='<g stroke="#dc963f" stroke-width="1.8"><path d="M37 3v5m0 32v5M16 24h5m32 0h5M22 9l4 4m23 23 4 4M22 39l4-4M49 12l4-4"/></g>';
    const sun='<path d="M23 21c-1-18 27-21 31-3 4 18-25 25-31 3Z" fill="#f9cb73" opacity=".5"/><circle cx="37" cy="24" r="11" fill="#f6bd5d" opacity=".68" stroke="#dca154" stroke-width="1"/>'+rays;
    const moon='<path d="M42 5c-18 0-27 27-5 32 12 2 19-7 20-12-18 7-28-9-15-20Z" fill="#dcbf83" fill-opacity=".3" stroke="#ac995f" stroke-width="1.3"/>';
    const cloud='<path d="M12 44C0 41 7 24 18 29c3-15 23-18 29-4 16-2 21 20 5 24H16Z" fill="currentColor" fill-opacity=".17"/><path d="M13 43C3 40 8 26 19 30c3-14 21-15 26-2 14-5 21 15 7 19H16Z" fill="currentColor" fill-opacity=".15" stroke="currentColor" stroke-width="1.3"/><path d="M20 30q9-6 13 4M41 31q6-6 11-1M13 43q4 3 10 2" fill="none" stroke="currentColor" stroke-width=".65" opacity=".5"/>';
    let s='';
    if(k==='clear')s=isDay?sun:moon;
    else if(k==='partly')s=(isDay?sun:moon)+cloud;
    else if(k==='cloudy'||k==='unknown')s='<path d="M21 25c3-16 23-17 28-3 11-1 17 11 8 18" fill="currentColor" opacity=".11"/>'+cloud;
    else if(k==='rain')s=cloud+'<g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m20 51-3 6m15-6-3 6m15-6-3 6"/></g>';
    else if(k==='snow')s=cloud+'<g stroke="currentColor" stroke-width="1.2"><path d="M21 50v10m-4-7 8 5m0-5-8 5M43 50v10m-4-7 8 5m0-5-8 5"/></g>';
    else if(k==='storm')s=cloud+'<path d="m34 42-8 12h7l-5 9 15-15h-9l5-6" fill="#e4ab51"/>';
    else s=cloud+'<g stroke="currentColor" stroke-width="1.3" opacity=".6"><path d="M8 51h43M17 57h41M7 61h28"/></g>';
    return `<svg viewBox="0 0 64 66" fill="none" aria-hidden="true">${s}</svg>`;
  }
  const knownDays=[['day','День'],['dawn','Рассвет'],['dusk','Закат'],['night','Ночь']];
  const previewTypes=[['','По данным',2],['clear','Ясно',0],['partly','Облака',2],['cloudy','Пасмурно',3],['rain','Дождь',61],['snow','Снег',71],['storm','Гроза',95],['fog','Туман',45]];
  const REFRESH_INTERVAL=15*60*1000, RETRY_INTERVAL=5*60*1000;
  function mount(host,options={}){
    if(!host)throw new Error('Weather mount target required.');
    let city=options.city||M.read('weather.city',M.CITIES[0]);city=M.validCity(city)?M.cleanCity(city):M.CITIES[0];
    const initial=M.cached(city)||M.demo(city);
    const state={city,data:initial,unit:M.read('weather.scene.unit','C')==='F'?'F':'C',period:7,metric:'temp',selectedDay:M.dateKey(initial.current.time,initial.timezone),selectedTime:null,
      override:{},paused:options.motionEnabled===false||M.read('weather.scene.paused',false)===true,busy:false,error:'',request:0,found:M.CITIES.slice(),searchBusy:false};
    let active=true,weatherController=null,searchController=null,searchTicket=0,weatherTimer=null,searchTimer=null,nextAttempt=0;
    const app=document.createElement('div');app.className='ww-app';host.replaceChildren(app);
    const homeURL=options.homeURL||'../#home',directoryURL=options.directoryURL||'../#directory';
    app.innerHTML=`<header class="ww-header"><a class="ww-brand" data-ww-nav="home" href="${esc(homeURL)}" aria-label="AYYY — главная"><span class="ww-logo">ayyy<span>.</span></span><small>всегда есть ориентир</small></a><nav class="ww-nav" aria-label="Разделы портала"><a href="${esc(homeURL)}" data-ww-nav="home">Главная</a><a href="${esc(directoryURL)}" data-ww-nav="directory">Все сервисы</a><a href="#" class="ww-active" data-action="now" aria-current="page">Погода</a><button class="ww-icon-button" data-action="settings" aria-label="Настройки погоды" title="Настройки погоды">${icon('settings')}</button></nav></header>
      <main class="ww-shell"><div class="ww-topline"><div class="ww-title"><h1>Погода</h1><span>У каждого дня — своё настроение.</span></div><div class="ww-location-tools"><button class="ww-city-search" data-action="city">${icon('search')}<span>Найти другой город</span><kbd>/</kbd></button><div class="ww-units" role="group" aria-label="Единицы температуры"><button data-unit="C" aria-pressed="true">°C</button><button data-unit="F" aria-pressed="false">°F</button></div></div></div>
      <div class="ww-sourcebar"><div class="ww-data-status" id="ww-source-status" role="status"><i class="ww-data-dot"></i><span id="ww-source-text"></span></div><div class="ww-source-actions"><span class="ww-source-label">Open-Meteo</span><button class="ww-link" data-action="refresh">${icon('refresh')}<span id="ww-refresh-text">Обновить</span></button></div></div>
      <div class="ww-error" id="ww-error" role="alert" hidden>${icon('info')}<span></span><button data-action="refresh">Повторить</button></div>
      <div class="ww-main"><section class="ww-current" id="ww-current" aria-label="Погода в выбранный момент"></section>
        <section class="ww-center" aria-label="Живой маяк"><div class="ww-scene-title ww-screenreader">Маяк вашего дня<span id="ww-scene-subtitle"></span></div><div class="ww-scene" id="ww-scene" role="img"></div><div class="ww-scene-controls"><div class="ww-scene-context" id="ww-scene-context"></div><div class="ww-scene-buttons"><button data-action="now" id="ww-now-button">${icon('clock')}Сейчас</button><button data-action="pause" id="ww-pause-button">${icon('pause')}Пауза</button><button data-action="settings" id="ww-scenes-button">${icon('layers')}Сцены</button></div><p class="ww-override-note" id="ww-override-note" hidden>Предпросмотр оформления. Показатели не изменены.</p><p class="ww-art-caption">Свет, небо и море — в ритме прогноза.</p></div></section>
        <section class="ww-period" id="ww-period" aria-label="Прогноз на период"></section></div>
      <section class="ww-hourly" aria-labelledby="ww-hourly-title"><div class="ww-hourly-heading"><div class="ww-hourly-title"><h2 id="ww-hourly-title">В течение дня</h2><span id="ww-hourly-date"></span></div><div class="ww-chart-toolbar"><div class="ww-chart-tabs" role="group" aria-label="Показатель графика"><button data-metric="temp" aria-pressed="true">Температура</button><button data-metric="pop" aria-pressed="false">Осадки</button><button data-metric="wind" aria-pressed="false">Ветер</button></div><div class="ww-chart-arrows"><button data-action="hours-back" aria-label="Предыдущие часы">${icon('left')}</button><button data-action="hours-next" aria-label="Следующие часы">${icon('right')}</button></div></div></div><div class="ww-hour-scroll" id="ww-hour-scroll"><div class="ww-hours" id="ww-hours"></div></div><div class="ww-hourly-foot"><span>${icon('info')}Выберите час: маяк покажет этот момент прогноза.</span><span id="ww-timezone-note"></span></div></section>
      <footer class="ww-footer"><span>Прогноз: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> · <span id="ww-footer-date"></span></span><button data-action="about">Море — художественный образ, не морской прогноз</button></footer></main>
      <dialog id="ww-city-dialog" aria-labelledby="ww-city-dialog-title"><div class="ww-dialog-head"><h2 id="ww-city-dialog-title">Где ваш маяк?</h2><button class="ww-icon-button" data-close aria-label="Закрыть выбор города">${icon('close')}</button></div><p class="ww-dialog-description">Выберите город. Местное время и прогноз изменятся вместе с ним.</p><form class="ww-search-form" id="ww-city-form"><input class="ww-input" id="ww-city-input" aria-label="Название города" placeholder="Город или населённый пункт" minlength="2" maxlength="100" autocomplete="off" required><button class="ww-primary" type="submit">${icon('search')}Найти</button></form><p class="ww-search-status" id="ww-search-status" role="status">Популярные города. Поиск отправляется только по кнопке.</p><div class="ww-city-options" id="ww-city-options"></div></dialog>
      <dialog id="ww-settings-dialog" aria-labelledby="ww-settings-title"><div class="ww-dialog-head"><h2 id="ww-settings-title">Настройки погоды</h2><button class="ww-icon-button" data-close aria-label="Закрыть настройки сцены">${icon('close')}</button></div><section class="ww-proxy-settings" aria-labelledby="ww-proxy-title"><h3 id="ww-proxy-title">Резервное подключение</h3><p class="ww-dialog-description">Если Open-Meteo недоступен напрямую, запрос будет отправлен через corsproxy.io. Прокси получит координаты выбранного города.</p><p class="ww-dialog-description">Резервное подключение уже настроено и включается автоматически. Вводить ключ не нужно.</p></section><p class="ww-dialog-description">Обычно сцена следует прогнозу. Здесь можно посмотреть, как она выглядит в другой погоде — цифры прогноза не меняются.</p><p class="ww-dialog-section">Погода в сцене</p><div class="ww-scene-presets" id="ww-scene-presets" role="group" aria-label="Предпросмотр погоды">${previewTypes.map(([key,label,code])=>`<button class="ww-scene-preset" data-scene-weather="${key}" aria-pressed="${key===''}">${weatherIcon(code)}${label}</button>`).join('')}</div><p class="ww-dialog-section">Время суток</p><div class="ww-phase-presets" role="group" aria-label="Предпросмотр времени суток"><button data-scene-phase="" aria-pressed="true">По прогнозу</button>${knownDays.map(([k,n])=>`<button data-scene-phase="${k}" aria-pressed="false">${n}</button>`).join('')}</div><label class="ww-toggle-row"><input type="checkbox" id="ww-animate-toggle" checked>Облака, волны, луч и осадки в движении</label><p class="ww-dialog-description">Системная настройка уменьшения движения имеет приоритет. В скрытой вкладке анимация приостанавливается.</p><div class="ww-dialog-footer"><button class="ww-link" data-action="reset-scene">${icon('refresh')}Вернуть погоду из прогноза</button><button class="ww-primary" data-close>Готово</button></div></dialog>
      <dialog id="ww-about-dialog" aria-labelledby="ww-about-title"><div class="ww-dialog-head"><h2 id="ww-about-title">Как живёт эта страница</h2><button class="ww-icon-button" data-close aria-label="Закрыть информацию">${icon('close')}</button></div><div class="ww-about-text"><p>Маяк — художественный образ. Цвет неба, облака, дождь, снег, освещение и движение воды определяются прогнозом выбранного города. Высота волн не является морским прогнозом.</p><p>Погода и поиск города поступают от Open-Meteo. Для реального прогноза нажмите «Обновить». До первого успешного запроса показан явно обозначенный демонстрационный пример.</p><p>Время указано для выбранного города, а не для вашего устройства. Выбор дня или часа переключает режим на просмотр прогноза; кнопка «Сейчас» возвращает текущие условия.</p><p>Последний успешный прогноз сохраняется локально. После 90 минут он помечается устаревшим. Координаты геолокации устройства не запрашиваются.</p><p>Ключей API, регистрации и внешних шрифтов нет. <a href="https://open-meteo.com/en/docs" target="_blank" rel="noopener noreferrer">Документация источника</a>.</p></div></dialog>`;
    const $=s=>app.querySelector(s),$$=s=>[...app.querySelectorAll(s)];
    // The atmosphere belongs to the whole page, not to the center column.
    app.prepend($('#ww-scene'));
    const scene=new root.AYYYWeatherScene($('#ww-scene'),options.assetURL||'assets/lighthouse.webp');
    const temp=n=>M.temperature(n,state.unit),val=M.value;
    const selectedPoint=()=>state.selectedTime===null?state.data.current:state.data.hours.find(h=>h.time===state.selectedTime)||state.data.current;
    const selectedDay=()=>state.data.days.find(d=>d.date===state.selectedDay)||state.data.days[0];
    function insight(p){
      const k=M.condition(p.code,p.isDay).key;
      if(k==='storm')return ['Гроза в прогнозе','Проверьте местные предупреждения о погоде.'];
      if(k==='snow')return ['День с зимним настроением','Снег меняет и пейзаж, и освещение маяка.'];
      if(k==='fog')return ['Горизонт в тумане',p.visibility!==null?`Видимость по модели — ${val(p.visibility/1000,1)} км.`:'Контуры берега становятся мягче.'];
      if(k==='rain'||p.pop>=60)return ['Зонт будет кстати',p.pop!==null?`Вероятность осадков в этот час — ${val(p.pop)}%.`:'В прогнозе есть осадки.'];
      if(p.wind>=9)return ['Ветер набирает силу',`Скорость ${val(p.wind,1)} м/с${p.gust!==null?`, порывы до ${val(p.gust,1)} м/с`:''}.`];
      if(p.isDay===false)return ['Ночь на берегу','В окнах загорается свет, а луч становится ярче.'];
      return ['У дня свой ритм','Выберите час внизу — и загляните вперёд.'];
    }
    function renderStatus(){
      const d=state.data,isStale=M.stale(d),status=state.busy?'pending':state.error?'error':!d.live?'demo':isStale?'saved':'live';
      $('#ww-source-status').dataset.status=status;
      $('#ww-source-text').textContent=state.busy?'Получаем прогноз…':!d.live?'Демо-прогноз · нет актуальных данных':state.error||isStale?`Сохранённый прогноз · ${M.time(d.updatedAt/1000,d.timezone)}`:`Обновлено ${M.time(d.updatedAt/1000,d.timezone)} · модельный прогноз`;
      $('#ww-refresh-text').textContent=state.busy?'Обновляем…':'Обновить';$$('[data-action="refresh"]').forEach(b=>b.disabled=state.busy);
      const error=$('#ww-error');error.hidden=!state.error;error.querySelector('span').textContent=state.error;
      $('#ww-footer-date').textContent=d.live?`получено ${M.dateLabel(M.dateKey(d.updatedAt/1000,d.timezone),{day:'numeric',month:'short'})}, ${M.time(d.updatedAt/1000,d.timezone)}`:'демонстрационные данные';
      $('#ww-timezone-note').textContent='Время города · '+d.timezone;
    }
    function renderCurrent(){
      const d=state.data,p=selectedPoint(),day=selectedDay(),c=M.condition(p.code,p.isDay),preview=state.selectedTime!==null;
      const localClock=d.live?Date.now()/1000:d.current.time;
      const note=insight(p);
      const duration=day.sunrise!==null&&day.sunset!==null?Math.max(0,day.sunset-day.sunrise):null;
      const daylight=duration===null?'Нет данных':`${Math.floor(duration/3600)} ч ${Math.round(duration%3600/60)} мин`;
      const progress=duration>0?M.clamp((p.time-day.sunrise)/duration,0,1):0;
      const cx=16+228*progress,cy=57-186*progress*(1-progress);
      const metric=(name,label,value,suffix='')=>`<div class="ww-metric">${icon(name)}<label>${label}</label><strong>${value}${suffix?` <small>${suffix}</small>`:''}</strong></div>`;
      $('#ww-current').innerHTML=`<p class="ww-eyebrow">${preview?'Выбранный момент':!d.live?'Пример прогноза':'Сейчас в городе'}</p><h2 class="ww-place"><button class="ww-place-button" data-action="city">${esc(d.city.name)}${icon('down')}</button></h2><p class="ww-local-time">${esc(d.city.country)} · <time id="ww-city-clock">${M.time(localClock,d.timezone)}</time></p>
        <div class="ww-current-main"><strong class="ww-temperature">${temp(p.temp)}</strong><span class="ww-current-icon">${weatherIcon(p.code,p.isDay)}</span></div><p class="ww-condition">${c.label}</p><p class="ww-range-note"><span>Днём <strong>${temp(day.max)}</strong></span><span>Ночью <strong>${temp(day.min)}</strong></span></p>
        <div class="ww-observation-label">${preview?`${M.dateLabel(state.selectedDay,{day:'numeric',month:'short'})} · ${M.time(p.time,d.timezone)} · прогноз`:!d.live?'Пример оформления · не текущая погода':`Данные на ${M.time(p.time,d.timezone)}`}</div>
        <div class="ww-metrics">${metric('thermometer','Ощущается',temp(p.feels))}${metric('wind','Ветер',val(p.wind,1),'м/с · '+M.direction(p.direction))}${metric('drop','Влажность',val(p.humidity),' %')}${metric('gauge','Давление',val(p.pressure),'гПа')}${metric('umbrella','Вероятность осадков',val(p.pop),'%')}${metric('eye','Видимость',p.visibility!==null?val(p.visibility/1000,1):'—','км')}</div>
        <section class="ww-daylight" aria-label="Световой день"><div class="ww-card-heading"><h3>Световой день</h3><small>${daylight}</small></div><svg class="ww-sun-path" viewBox="0 0 260 68" aria-hidden="true"><path d="M16 57Q130-36 244 57" fill="none" stroke="var(--ww-line)" stroke-width="1.4" stroke-dasharray="3 5"/><path d="M16 57Q130-36 244 57" fill="none" stroke="var(--ww-accent)" stroke-width="1.6" pathLength="100" stroke-dasharray="${(progress*100).toFixed(1)} 100"/><path d="M10 58h240" stroke="var(--ww-line)"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8" fill="var(--ww-accent)" opacity=".12"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="var(--ww-accent)"/></svg><div class="ww-sun-times"><div>${icon('sunrise')}<span><small>Восход</small><strong>${M.time(day.sunrise,d.timezone)}</strong></span></div><div>${icon('sunset')}<span><small>Закат</small><strong>${M.time(day.sunset,d.timezone)}</strong></span></div></div></section>
        <div class="ww-day-note">${icon(c.key==='rain'?'umbrella':c.key==='storm'?'info':p.wind>=9?'wind':'lighthouse')}<span><b>${note[0]}</b>${note[1]}</span></div>`;
    }
    function renderPeriod(){
      const d=state.data,days=d.days.slice(0,state.period),min=Math.min(...days.map(d=>d.min)),max=Math.max(...days.map(d=>d.max)),span=Math.max(1,max-min),today=M.dateKey(d.current.time,d.timezone),sel=selectedDay();
      $('#ww-period').innerHTML=`<div class="ww-period-top"><h2>За горизонтом</h2><div class="ww-segments" role="group" aria-label="Период прогноза"><button data-period="7" aria-pressed="${state.period===7}">7 дней</button><button data-period="14" aria-pressed="${state.period===14}">14 дней</button></div></div><div class="ww-forecast-labels"><span>День · температура</span><span>Осадки</span><span>Ветер</span></div><div class="ww-days" id="ww-days">${days.map((day,index)=>{
        const weekend=[0,6].includes(new Date(day.date+'T12:00:00Z').getUTCDay()),name=day.date===today?'Сегодня':index===1&&days[0].date===today?'Завтра':M.dateLabel(day.date,{weekday:'short'});
        return `<button class="ww-day" data-day="${day.date}" aria-pressed="${state.selectedDay===day.date}" aria-label="${esc(name)}, ${M.dateLabel(day.date)}, ${M.condition(day.code).label}, от ${temp(day.min)} до ${temp(day.max)}"><span class="ww-day-label"><b class="${weekend?'ww-weekend':''}">${esc(name[0].toUpperCase()+name.slice(1))}</b><small>${M.dateLabel(day.date,{day:'numeric',month:'short'}).replace('.','')}</small></span><span class="ww-day-icon">${weatherIcon(day.code)}</span><span class="ww-day-temperatures"><small>${temp(day.min)}</small><span class="ww-temperature-track"><i style="left:${((day.min-min)/span*100).toFixed(1)}%;width:${Math.max(9,(day.max-day.min)/span*100).toFixed(1)}%"></i></span><b>${temp(day.max)}</b></span><span class="ww-day-pop">${icon('drop')}${val(day.pop)}<small>%</small></span><span class="ww-day-wind">${val(day.wind,1)}<span>м/с</span></span></button>`;
      }).join('')}</div><div class="ww-period-detail"><h3>${M.dateLabel(sel.date,{day:'numeric',month:'long'})}</h3><div class="ww-period-detail-grid"><div><span>Осадки за день</span><strong>${val(sel.precip,1)} мм</strong></div><div><span>УФ-индекс, макс.</span><strong>${val(sel.uv,1)}</strong></div><div><span>Ветер, макс.</span><strong>${val(sel.wind,1)} м/с</strong></div></div><p class="ww-period-caption">Выберите день, чтобы увидеть его по часам. Чем дальше дата, тем менее определён прогноз.</p></div>`;
    }
    function visibleHours(){return state.data.hours.filter(h=>M.dateKey(h.time,state.data.timezone)===state.selectedDay);}
    function selectedHour(){return state.selectedTime===null?Math.floor(state.data.current.time/3600)*3600:state.selectedTime;}
    function renderHours(){
      const scroller=$('#ww-hour-scroll'),scroll=scroller.scrollLeft,hours=visibleHours(),n=hours.length||1;
      const values=hours.map(h=>h[state.metric]);const numbers=values.filter(v=>M.number(v)!==null);const low=numbers.length?Math.min(...numbers):0,high=numbers.length?Math.max(...numbers):1,span=Math.max(1,high-low);
      const x=i=>(i+.5)*70,y=v=>M.number(v)===null?null:39-(v-low)/span*31;
      let path='',prev=false;
      values.forEach((v,i)=>{if(v===null){prev=false;return;}path+=(prev?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)+' ';prev=true;});
      const bars=state.metric==='pop'?hours.map((h,i)=>h.pop===null?'':`<rect x="${x(i)-9}" y="${45-h.pop/100*36}" width="18" height="${h.pop/100*36}" rx="3" fill="var(--ww-sea)" opacity=".28"/>`).join(''):'';
      $('#ww-hourly-date').textContent=M.dateLabel(state.selectedDay,{day:'numeric',month:'long'});
      const hourRoot=$('#ww-hours');hourRoot.style.gridTemplateColumns=`repeat(${n},minmax(68px,1fr))`;hourRoot.style.minWidth=`${n*70}px`;
      hourRoot.innerHTML=`<svg class="ww-hour-line" viewBox="0 0 ${n*70} 48" preserveAspectRatio="none" aria-hidden="true">${bars}${state.metric!=='pop'?`<path d="${path}" fill="none" stroke="${state.metric==='wind'?'var(--ww-sea)':'var(--ww-accent)'}" stroke-width="1.3" vector-effect="non-scaling-stroke"/>${values.map((v,i)=>v===null?'':`<circle cx="${x(i)}" cy="${y(v)}" r="2.5" fill="var(--ww-paper)" stroke="var(--ww-accent)"/>`).join('')}`:''}</svg>${hours.map(h=>`<button class="ww-hour" data-hour="${h.time}" aria-pressed="${h.time===selectedHour()}" aria-label="${M.time(h.time,state.data.timezone)}, ${temp(h.temp)}, ${M.condition(h.code,h.isDay).label}, осадки ${val(h.pop)} процентов, ветер ${val(h.wind,1)} метров в секунду"><span class="ww-hour-label">${M.time(h.time,state.data.timezone)}</span><span class="ww-hour-icon">${weatherIcon(h.code,h.isDay)}</span><span class="ww-hour-temp">${state.metric==='temp'?temp(h.temp):state.metric==='pop'?val(h.pop)+'%':val(h.wind,1)+' м/с'}</span><span class="ww-hour-value">${icon(state.metric==='wind'?'wind':'drop')}${state.metric==='wind'?M.direction(h.direction):val(h.pop)+'%'}</span></button>`).join('')}`;
      scroller.scrollLeft=scroll;$$('[data-metric]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.metric===state.metric)));
    }
    function renderScene(){
      const p=selectedPoint(),data=state.data,day=selectedDay();
      const scenePoint=state.selectedTime===null&&data.live?{...p,time:Date.now()/1000}:p;
      const sceneDay=data.days.find(d=>d.date===M.dateKey(scenePoint.time,data.timezone))||day;
      scene.update(scenePoint,sceneDay,state.override);scene.setPaused(state.paused);
      const phase=state.override.phase||M.phase(scenePoint,sceneDay),phrases={day:'День на светлой стороне.',night:'Свет остаётся с вами.',dawn:'Утро начинается с горизонта.',dusk:'День оставляет тёплый след.'};
      $('#ww-scene-subtitle').textContent=phrases[phase];
      $('#ww-scene-context').textContent=`${M.dateLabel(M.dateKey(scenePoint.time,data.timezone),{weekday:'short',day:'numeric',month:'short'})} · ${M.time(scenePoint.time,data.timezone)}${state.selectedTime!==null?' · прогноз':''}`;
      const override=!!(state.override.weather||state.override.phase);$('#ww-override-note').hidden=!override;$('#ww-scenes-button').dataset.override=String(override);
      $('#ww-pause-button').innerHTML=icon(state.paused?'play':'pause')+(state.paused?'Движение':'Пауза');$('#ww-pause-button').setAttribute('aria-pressed',String(state.paused));
      $('#ww-animate-toggle').checked=!state.paused;
      $$('[data-scene-weather]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sceneWeather===(state.override.weather||''))));
      $$('[data-scene-phase]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenePhase===(state.override.phase||''))));
    }
    function render({hours=true}={}){
      if(!active)return;const daysScroll=$('#ww-days')?.scrollTop||0;
      renderStatus();renderCurrent();renderPeriod();if(hours)renderHours();else $$('[data-hour]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.hour)===selectedHour())));
      const daysEl=$('#ww-days');if(daysEl)daysEl.scrollTop=daysScroll;
      $$('[data-unit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.unit===state.unit)));renderScene();
    }
    function resetTime(){state.selectedTime=null;state.selectedDay=M.dateKey(state.data.current.time,state.data.timezone);state.override={};render();scrollToCurrent();}
    function scrollToCurrent(){const b=$(`[data-hour="${selectedHour()}"]`),container=$('#ww-hour-scroll');if(b)container.scrollLeft=Math.max(0,b.offsetLeft-container.clientWidth/3);}
    async function refresh(){
      nextAttempt=Date.now()+RETRY_INTERVAL;
      weatherController?.abort();clearTimeout(weatherTimer);const controller=new AbortController();weatherController=controller;const request=++state.request,city={...state.city};let timeout=false;
      state.busy=true;state.error='';renderStatus();weatherTimer=setTimeout(()=>{timeout=true;controller.abort();},15000);
      try{
        const data=await M.forecast(city,controller.signal);if(!active||request!==state.request)return;
        state.data=data;state.city=data.city;const saved=M.save(data);
        if(!data.days.some(d=>d.date===state.selectedDay)){state.selectedDay=M.dateKey(data.current.time,data.timezone);state.selectedTime=null;}
        if(state.selectedTime!==null&&!data.hours.some(h=>h.time===state.selectedTime))state.selectedTime=null;
        if(!saved)state.error='Прогноз загружен, но браузер не разрешил сохранить его. При закрытии он не останется на устройстве.';
        const snapshot=M.homeSnapshot(data);if(snapshot){M.write('weather.cache.'+M.cityKey(data.city),snapshot);options.onData?.(data.city,snapshot);}
      }catch(error){
        if(!active||request!==state.request)return;
        if(error.name==='AbortError'&&!timeout)return;
        state.error=(timeout?'Источник не ответил за 15 секунд.':error instanceof TypeError?'Не удалось подключиться к погодному сервису. Проверьте интернет и повторите запрос.':error.message)+' '+(state.data.live?'Показан последний сохранённый прогноз.':'Пока показан демонстрационный пример.');
      }finally{clearTimeout(weatherTimer);if(active&&request===state.request){state.busy=false;render();}}
    }
    function checkForUpdates(){
      if(!active||state.busy||document.hidden||navigator.onLine===false||Date.now()<nextAttempt)return;
      if(!state.data.live||Date.now()-state.data.updatedAt>=REFRESH_INTERVAL)refresh();
    }
    function reconnect(){nextAttempt=0;checkForUpdates();}
    function renderCityOptions(){
      $('#ww-city-options').innerHTML=state.found.map((c,i)=>`<button class="ww-city-option" data-city-index="${i}"><span><strong>${esc(c.name)}</strong><small>${esc(c.country)}</small></span>${icon(M.cityKey(c)===M.cityKey(state.city)?'check':'arrow')}</button>`).join('');
    }
    function openDialog(id){const d=$(id);if(!d.open)d.showModal();}
    function openCity(){state.found=M.CITIES.slice();$('#ww-city-input').value='';$('#ww-search-status').textContent='Популярные города. Поиск отправляется только по кнопке.';renderCityOptions();openDialog('#ww-city-dialog');$('#ww-city-input').focus();}
    function chooseCity(c){
      state.request++;weatherController?.abort();searchController?.abort();clearTimeout(weatherTimer);clearTimeout(searchTimer);searchTicket++;
      state.city=M.cleanCity(c);state.data=M.cached(state.city)||M.demo(state.city);M.write('weather.city',state.city);state.error='';state.selectedTime=null;state.selectedDay=M.dateKey(state.data.current.time,state.data.timezone);state.override={};$('#ww-city-dialog').close();render();refresh();
    }
    async function searchCities(event){
      event.preventDefault();const q=$('#ww-city-input').value.trim();if(q.length<2)return;
      searchController?.abort();clearTimeout(searchTimer);const controller=new AbortController();searchController=controller;const ticket=++searchTicket;let timeout=false;
      $('#ww-search-status').textContent='Ищем город…';state.searchBusy=true;$('#ww-city-form button').disabled=true;
      searchTimer=setTimeout(()=>{timeout=true;controller.abort();},12000);
      try{const found=await M.search(q,controller.signal);if(!active||ticket!==searchTicket||!$('#ww-city-dialog').open)return;state.found=found;renderCityOptions();$('#ww-search-status').textContent=found.length?'Выберите город из результатов.':'Город не найден. Уточните название.';}
      catch(error){if(active&&ticket===searchTicket&&$('#ww-city-dialog').open){$('#ww-search-status').textContent=timeout?'Поиск не ответил. Выберите один из популярных городов.':'Поиск недоступен. Можно выбрать город из списка ниже.';state.found=M.CITIES.filter(c=>c.name.toLocaleLowerCase('ru').includes(q.toLocaleLowerCase('ru')));if(!state.found.length)state.found=M.CITIES.slice();renderCityOptions();}}
      finally{clearTimeout(searchTimer);if(active&&ticket===searchTicket){state.searchBusy=false;$('#ww-city-form button').disabled=false;}}
    }
    function click(event){
      const nav=event.target.closest('[data-ww-nav]');if(nav&&options.onNavigate){event.preventDefault();event.stopPropagation();options.onNavigate(nav.dataset.wwNav);return;}
      const b=event.target.closest('button,a[data-action]');if(!b||!app.contains(b))return;
      // Do not invoke the legacy portal's delegated data-action handlers.
      event.stopPropagation();
      if(b.hasAttribute('data-close')){b.closest('dialog')?.close();return;}
      if(b.dataset.cityIndex!==undefined){const c=state.found[Number(b.dataset.cityIndex)];if(c)chooseCity(c);return;}
      if(b.dataset.unit){state.unit=b.dataset.unit==='F'?'F':'C';M.write('weather.scene.unit',state.unit);render();$(`[data-unit="${state.unit}"]`)?.focus({preventScroll:true});return;}
      if(b.dataset.period){state.period=Number(b.dataset.period)===14?14:7;renderPeriod();$(`[data-period="${state.period}"]`)?.focus({preventScroll:true});return;}
      if(b.dataset.metric){state.metric=['temp','pop','wind'].includes(b.dataset.metric)?b.dataset.metric:'temp';renderHours();return;}
      if(b.dataset.day){const day=state.data.days.find(d=>d.date===b.dataset.day);if(!day)return;state.selectedDay=day.date;const hours=visibleHours();const noon=hours.find(h=>M.parts(h.time,state.data.timezone).hour==='12')||hours[0];state.selectedTime=noon?.time??null;state.override={};const scroll=$('#ww-days')?.scrollLeft||0;render();$('#ww-days').scrollLeft=scroll;$(`[data-day="${day.date}"]`)?.focus({preventScroll:true});scrollToCurrent();return;}
      if(b.dataset.hour){const stamp=Number(b.dataset.hour);if(!state.data.hours.some(h=>h.time===stamp))return;state.selectedTime=stamp;state.override={};render({hours:false});return;}
      if(b.dataset.sceneWeather!==undefined){state.override.weather=b.dataset.sceneWeather;renderScene();return;}
      if(b.dataset.scenePhase!==undefined){state.override.phase=b.dataset.scenePhase;renderScene();return;}
      const action=b.dataset.action;
      if(action==='city'){openCity();return;}
      if(action==='refresh'){if(!state.busy)refresh();return;}
      if(action==='settings'){openDialog('#ww-settings-dialog');return;}
      if(action==='about'){openDialog('#ww-about-dialog');return;}
      if(action==='pause'){state.paused=!state.paused;M.write('weather.scene.paused',state.paused);renderScene();return;}
      if(action==='now'){event.preventDefault();resetTime();return;}
      if(action==='reset-scene'){state.override={};renderScene();return;}
      if(action==='hours-back'||action==='hours-next'){const box=$('#ww-hour-scroll');box.scrollBy({left:box.clientWidth*.75*(action==='hours-next'?1:-1),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}
    }
    function key(event){
      if(!active||!app.isConnected||!(event.target===document.body||app.contains(event.target)))return;
      if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)&&!app.querySelector('dialog[open]')){event.preventDefault();event.stopPropagation();openCity();}
      const b=event.target.closest('[data-hour]');if(b&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const buttons=$$('[data-hour]'),idx=buttons.indexOf(b),to=event.key==='Home'?0:event.key==='End'?buttons.length-1:M.clamp(idx+(event.key==='ArrowLeft'?-1:1),0,buttons.length-1);buttons[to]?.focus({preventScroll:true});buttons[to]?.click();const box=$('#ww-hour-scroll'),target=buttons[to];if(target&&(target.offsetLeft<box.scrollLeft||target.offsetLeft>box.scrollLeft+box.clientWidth-70))box.scrollLeft=Math.max(0,target.offsetLeft-box.clientWidth/2);}
    }
    function animateChange(){state.paused=!$('#ww-animate-toggle').checked;M.write('weather.scene.paused',state.paused);renderScene();}
    function closeSearch(){searchTicket++;searchController?.abort();clearTimeout(searchTimer);state.searchBusy=false;$('#ww-city-form button').disabled=false;}
    app.addEventListener('click',click);document.addEventListener('keydown',key,true);$('#ww-city-form').addEventListener('submit',searchCities);$('#ww-animate-toggle').addEventListener('change',animateChange);$('#ww-city-dialog').addEventListener('close',closeSearch);
    document.addEventListener('visibilitychange',checkForUpdates);window.addEventListener('online',reconnect);
    const clock=setInterval(()=>{if(!active||document.hidden)return;checkForUpdates();if(state.data.live){const el=$('#ww-city-clock');if(el)el.textContent=M.time(Date.now()/1000,state.data.timezone);renderStatus();if(state.selectedTime===null)renderScene();}},30000);
    render();scrollToCurrent();checkForUpdates();
    return {
      refresh,
      destroy(){active=false;state.request++;searchTicket++;weatherController?.abort();searchController?.abort();clearTimeout(weatherTimer);clearTimeout(searchTimer);clearInterval(clock);document.removeEventListener('visibilitychange',checkForUpdates);window.removeEventListener('online',reconnect);scene.destroy();app.querySelectorAll('dialog[open]').forEach(d=>d.close());app.removeEventListener('click',click);document.removeEventListener('keydown',key,true);host.replaceChildren();},
      // Read-only state summary used by the regression suite, without private data.
      inspect(){return {city:state.city.name,live:state.data.live,selectedTime:state.selectedTime,selectedDay:state.selectedDay,phase:scene.phase,weather:scene.mode,paused:state.paused,unit:state.unit,period:state.period,busy:state.busy,error:state.error};}
    };
  }
  root.AYYYWeather={mount};
})(window);
