/* Homepage data only. Public API clients and caches remain in data.js. */
(() => {
  'use strict';
  const app = window.AYYY;
  const escape = app.escape;
  const money = new Intl.NumberFormat('ru-RU', {minimumFractionDigits:2, maximumFractionDigits:2});
  const temperature = value => Number.isFinite(value) ? `${Math.round(value)>0?'+':''}${Math.round(value)}°` : '—';
  const shortDate = value => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const date = new Date(value+'T12:00:00Z');
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ru-RU', {day:'numeric',month:'short',timeZone:'UTC'}).format(date) : '';
  };
  const savedAt = value => {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ru-RU', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(date) : '';
  };
  const state = data => data.pending ? 'Обновляем…' : !data.live ? 'Демо' : data.stale || data.error ? 'Сохранено' : 'Обновлено';
  const AUTO_TTL = {weather:30*60*1000, rates:6*60*60*1000};
  const AUTO_RETRY_MS = 5*60*1000;
  const lastAutoAttempt = {weather:0, rates:0};

  function weatherHours(data) {
    return (Array.isArray(data.hours) ? data.hours : []).filter(hour => Number.isFinite(hour.temp) && typeof hour.time==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(hour.time)).slice(0,6);
  }

  function forecastHTML(data) {
    return weatherHours(data).map(hour => `<span class="home-forecast-hour"><time datetime="${escape(hour.time)}">${escape(hour.time.slice(11,16))}</time><strong>${temperature(hour.temp)}</strong></span>`).join('');
  }

  function chartHTML(data) {
    const hours = weatherHours(data);
    if (hours.length<2) return '';
    const temperatures = hours.map(hour=>hour.temp), low = Math.min(...temperatures), high = Math.max(...temperatures);
    const range = Math.max(4, high-low), middle = (low+high)/2;
    const points = hours.map((hour,index) => ({x:8+index/(hours.length-1)*264, y:34-(hour.temp-middle)/range*42}));
    const path = points.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const label = `${data.live?'Прогноз':'Демонстрационный прогноз'} температуры: ${hours.map(hour=>`${hour.time.slice(11,16)} — ${temperature(hour.temp)}`).join(', ')}. Время выбранного города.`;
    return `<svg viewBox="0 0 280 64" preserveAspectRatio="none" class="home-weather-chart" role="img" aria-label="${escape(label)}"><path d="${path} L272,64 L8,64 Z" fill="currentColor" opacity=".10"/><path d="${path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${points.map(point=>`<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.6" fill="currentColor"/>`).join('')}</svg>`;
  }

  /**
   * Hydrate the existing homepage; refresh expired API data without replacing its root.
   * Weather fields use data-home-weather; rate fields use data-home-rates.
   * Refresh buttons use data-home-refresh="weather|rates|all".
   * Return the cleanup from the home view's mount() callback.
   */
  app.mountHomeData = (root=document.querySelector('#view')) => {
    if (!root || typeof app.getWeather!=='function' || typeof app.getRates!=='function') return () => {};
    let mounted = true;
    app.homeDataMounted = true;

    function updateWeather() {
      if (!mounted || !root.isConnected) return;
      const data = app.getWeather();
      const source = !data.live ? 'Open-Meteo · пример прогноза' : data.stale || data.error ? `Open-Meteo · сохранено ${savedAt(data.updatedAt)}` : `Open-Meteo · ${shortDate(data.observedAt?.slice(0,10))}, ${data.observedAt?.slice(11,16)||''}`;
      const values = {
        city:data.city, country:data.country, temp:temperature(data.temp), condition:data.condition,
        feels:temperature(data.feels), wind:Number.isFinite(data.wind)?app.fmt(data.wind,1)+' м/с':'—',
        humidity:Number.isFinite(data.humidity)?Math.round(data.humidity)+'%':'—', status:state(data),
        source, error:data.error||''
      };
      root.querySelectorAll('[data-home-weather]').forEach(element => {
        const field = element.dataset.homeWeather;
        if (field==='icon') element.innerHTML=app.icon(data.icon||'cloud',64);
        else if (field==='hours') {
          element.innerHTML=forecastHTML(data);
          element.setAttribute('aria-label', `${data.live?'Прогноз':'Демонстрационный прогноз'} по часам; время выбранного города`);
        }
        else if (field==='chart') element.innerHTML=chartHTML(data);
        else if (Object.hasOwn(values,field)) element.textContent=values[field]||'—';
        if (field==='error') {element.textContent=values.error;element.hidden=!data.error;}
        if (field==='status') {
          element.dataset.state=data.pending?'pending':!data.live?'demo':data.stale||data.error?'saved':'live';
          element.title=!data.live?'Пример прогноза. Нажмите обновление, чтобы получить погоду.':`Прогноз получен ${savedAt(data.updatedAt)}`;
        }
      });
      updateButtons();
    }

    function updateRates() {
      if (!mounted || !root.isConnected) return;
      const data = app.getRates();
      const source = !data.live ? 'Frankfurter · пример курсов' : `Frankfurter · ${data.stale || data.error?'сохранено · ':''}${shortDate(data.date)}`;
      const values = {status:state(data), source, date:shortDate(data.date)||'Демо', error:data.error||''};
      root.querySelectorAll('[data-home-rates]').forEach(element => {
        const field = element.dataset.homeRates, code=field.toUpperCase();
        if (['USD','EUR','GBP','CNY'].includes(code)) {
          element.textContent=Number.isFinite(data[code])?money.format(data[code]):'—';
          element.title=data.live?`1 ${code} в рублях · ${shortDate(data.dates?.[code]||data.date)} · справочный курс`:'Демонстрационный курс, не текущая котировка';
        }
        else if (Object.hasOwn(values,field)) element.textContent=values[field]||'—';
        if (field==='error') {element.textContent=values.error;element.hidden=!data.error;}
        if (field==='status') {
          element.dataset.state=data.pending?'pending':!data.live?'demo':data.stale||data.error?'saved':'live';
          element.title=!data.live?'Пример курсов. Нажмите обновление, чтобы получить справочные курсы.':`Курсы получены ${savedAt(data.updatedAt)}`;
        }
      });
      updateButtons();
    }

    function refreshIfNeeded() {
      if (!mounted || !root.isConnected || document.visibilityState==='hidden') return;
      const now=Date.now();
      const sources=[
        ['weather',app.getWeather(),app.refreshWeather],
        ['rates',app.getRates(),app.refreshRates]
      ];
      sources.forEach(([type,data,refresh])=>{
        const lastUpdated=Date.parse(data.updatedAt||'');
        const isFresh=data.live && Number.isFinite(lastUpdated) && lastUpdated<=now && now-lastUpdated<AUTO_TTL[type];
        if (data.pending || isFresh || now-lastAutoAttempt[type]<AUTO_RETRY_MS) return;
        lastAutoAttempt[type]=now;
        refresh({silent:true});
      });
    }

    function updateButtons() {
      const weather=app.getWeather(), rates=app.getRates();
      root.querySelectorAll('[data-home-refresh]').forEach(button=>{
        const type=button.dataset.homeRefresh;
        const pending=type==='weather'?weather.pending:type==='rates'?rates.pending:weather.pending||rates.pending;
        const label=type==='weather'?'Обновить погоду':type==='rates'?'Обновить курсы':'Обновить погоду и курсы';
        button.disabled=!!pending;
        button.setAttribute('aria-busy',String(!!pending));
        button.setAttribute('aria-label',pending?'Данные обновляются':label);
        button.title=pending?'Данные обновляются':label;
        const caption=button.querySelector('[data-home-refresh-label]');
        if(caption)caption.textContent=pending?'Обновляем…':'Обновить';
      });
    }

    function click(event) {
      const button=event.target.closest('[data-home-refresh]');
      if (!button || !root.contains(button)) return;
      event.preventDefault();
      if (button.disabled) return;
      const type=button.dataset.homeRefresh;
      if (type==='weather'||type==='all') app.refreshWeather();
      if (type==='rates'||type==='all') app.refreshRates();
    }

    root.addEventListener('click',click);
    document.addEventListener('ayyy:weather',updateWeather);
    document.addEventListener('ayyy:rates',updateRates);
    document.addEventListener('visibilitychange',refreshIfNeeded);
    window.addEventListener('pageshow',refreshIfNeeded);
    updateWeather();
    updateRates();
    refreshIfNeeded();

    return () => {
      mounted=false;
      app.homeDataMounted=false;
      root.removeEventListener('click',click);
      document.removeEventListener('ayyy:weather',updateWeather);
      document.removeEventListener('ayyy:rates',updateRates);
      document.removeEventListener('visibilitychange',refreshIfNeeded);
      window.removeEventListener('pageshow',refreshIfNeeded);
    };
  };
})();
