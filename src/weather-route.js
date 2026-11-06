/* AYYY weather route: lazy assets, isolated layout, and shared home snapshot. */
(() => {
  'use strict';
  const app=window.AYYY;
  if(!app)return;
  const VERSION='coast-1';
  const base=new URL('weather/',document.baseURI);
  const url=name=>new URL(name+'?v='+VERSION,base).href;
  let loading=null,bridgeInstalled=false;
  const requests=new Map();
  function resource(name,css=false){
    if(requests.has(name))return requests.get(name);
    const pending=new Promise((resolve,reject)=>{
      const el=document.createElement(css?'link':'script');let done=false;
      const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);el.onload=el.onerror=null;if(error){el.remove();reject(error);}else resolve();};
      const timer=setTimeout(()=>finish(new Error('Asset timeout: '+name)),15000);
      el.onload=()=>finish();el.onerror=()=>finish(new Error('Asset unavailable: '+name));
      if(css){el.rel='stylesheet';el.href=url(name);}else{el.src=url(name);el.async=false;}
      document.head.appendChild(el);
    }).catch(error=>{requests.delete(name);throw error;});
    requests.set(name,pending);return pending;
  }
  function ensure(){
    if(loading)return loading;
    loading=(async()=>{
      await Promise.all([resource('style.css',true),resource('seamless.css',true)]);
      if(!window.AYYYWeatherModel)await resource('model.js');
      if(!window.AYYYWeatherScene)await resource('scene.js');
      if(!window.AYYYWeather)await resource('view.js');
      if(!window.AYYYWeather?.mount)throw new Error('Weather module incomplete');
      installBridge();
    })().catch(error=>{loading=null;throw error;});
    return loading;
  }
  if(!document.getElementById('ayyy-weather-shell-style')){
    const style=document.createElement('style');style.id='ayyy-weather-shell-style';
    style.textContent=`body[data-shell="weather"]{background:#fffefc}body[data-shell="weather"]>.sidebar,body[data-shell="weather"]>.nav-scrim,body[data-shell="weather"]>.mobile-nav,body[data-shell="weather"] .main-wrap>.topbar,body[data-shell="weather"] .main-content>.footer{display:none!important}body[data-shell="weather"] .main-wrap{margin:0;min-height:100svh}body[data-shell="weather"] .main-content{padding:0!important;max-width:none;margin:0;min-height:100svh}body[data-shell="weather"] #view{animation:none;margin:0;padding:0;outline:none}body[data-shell="weather"] .toasts{bottom:20px}.ww-route-message{min-height:100svh;padding:50px max(24px,6vw);font:15px/1.6 "Segoe UI",sans-serif;color:#203640;background:#fffefc}.ww-route-message h1{font:32px Georgia,serif;margin-bottom:16px}.ww-route-message a{display:inline-block;margin:20px 20px 0 0;text-decoration:underline}.ww-route-message button{font:inherit;color:inherit;border:1px solid #9cb9bc;border-radius:8px;padding:10px 18px;margin:20px 20px 0 0;cursor:pointer;background:#fff}`;
    document.head.appendChild(style);
  }
  function installBridge(){
    if(bridgeInstalled)return;bridgeInstalled=true;
    const M=window.AYYYWeatherModel;
    let inFlight=null,controller=null,ticket=0,pendingKey='',error='';
    const selected=()=>{const c=app.get('weather.city',M.CITIES[0]);return M.validCity(c)?M.cleanCity(c):M.CITIES[0];};
    const notify=()=>document.dispatchEvent(new CustomEvent('ayyy:weather'));
    const decorate=(value,city)=>{
      const weather=M.condition(value.code,value.isDay),kind=weather.key;
      return {...value,city:city.name,country:city.country,condition:weather.label,
        icon:kind==='clear'||kind==='partly'?(value.isDay?'sun':'moon'):['rain','storm'].includes(kind)?'rain':'cloud',
        stale:value.live&&Date.now()-Date.parse(value.updatedAt)>M.TTL,pending:pendingKey===M.cityKey(city),error};
    };
    app.getWeather=()=>{
      const city=selected(),key=M.cityKey(city),saved=app.get('weather.cache.'+key,null);
      if(saved?.schema===2&&saved.live===true&&Number.isFinite(Date.parse(saved.updatedAt))&&Array.isArray(saved.hours)&&saved.hours.length===6&&Array.isArray(saved.days)&&saved.days.length===7)return decorate(saved,city);
      const data=M.demo(city),point=data.current;
      const local=stamp=>M.dateKey(stamp,data.timezone)+'T'+M.time(stamp,data.timezone);
      return decorate({schema:2,live:false,updatedAt:null,observedAt:local(point.time),timezone:data.timezone,
        latitude:city.latitude,longitude:city.longitude,temp:point.temp,feels:point.feels,humidity:point.humidity,wind:point.wind,code:point.code,isDay:point.isDay,
        hours:data.hours.filter(h=>h.time>=point.time).slice(0,6).map(h=>({time:local(h.time),temp:h.temp,code:h.code,rain:h.pop})),
        days:data.days.slice(0,7).map(d=>({date:d.date,min:d.min,max:d.max,code:d.code,rain:d.pop,sunrise:local(d.sunrise),sunset:local(d.sunset)}))},city);
    };
    app.acceptWeatherSnapshot=(city,snapshot)=>{
      if(!M.validCity(city)||!snapshot?.live)return false;
      ticket++;controller?.abort();controller=null;inFlight=null;pendingKey='';error='';
      app.set('weather.city',M.cleanCity(city));app.set('weather.cache.'+M.cityKey(city),snapshot);notify();return true;
    };
    app.refreshWeather=()=>{
      const city=selected(),key=M.cityKey(city);
      if(pendingKey===key&&inFlight)return inFlight;
      controller?.abort();controller=new AbortController();const own=controller,n=++ticket;
      pendingKey=key;error='';notify();const timer=setTimeout(()=>own.abort(),15000);
      inFlight=(async()=>{
        try{const data=await M.forecast(city,own.signal);if(n!==ticket)return false;M.save(data);const snapshot=M.homeSnapshot(data);if(snapshot)app.set('weather.cache.'+key,snapshot);app.set('weather.city',data.city);return true;}
        catch(e){if(n===ticket)error=e.name==='AbortError'?'Источник не ответил за 15 секунд.':'Не удалось обновить погоду. Сохранённые данные не изменены.';return false;}
        finally{clearTimeout(timer);if(n===ticket){pendingKey='';inFlight=null;controller=null;notify();}}
      })();return inFlight;
    };
    // The city picker now belongs to the detailed weather screen, not a second store.
    app.showCityPicker=()=>app.navigate('weather','city');
  }
  app.register('weather',{
    title:'Погода · живой маяк',
    render(){return '<div id="ayyy-weather-root"><div class="ww-route-message" role="status"><h1>Погода у маяка</h1><p>Подготавливаем пейзаж…</p><a href="#home">На главную</a></div></div>';},
    mount(){
      const host=document.getElementById('ayyy-weather-root');if(!host)return;
      document.body.dataset.shell='weather';let active=true,view=null;
      const mount=()=>ensure().then(()=>{
        if(!active||!host.isConnected||app.route!=='weather')return;
        view=window.AYYYWeather.mount(host,{assetURL:url('assets/lighthouse.avif'),homeURL:'#home',directoryURL:'#directory',motionEnabled:app.settings?.motion!==false,
          onNavigate:route=>app.navigate(route),onData:(city,snapshot)=>app.acceptWeatherSnapshot(city,snapshot)});
        if(app.param==='city')host.querySelector('.ww-city-search')?.click();
      }).catch(()=>{
        if(!active||!host.isConnected)return;
        host.innerHTML='<div class="ww-route-message" role="alert"><h1>Не удалось загрузить пейзаж</h1><p>Проверьте соединение. Данные и настройки не потеряны.</p><button id="ww-retry">Повторить</button><a href="weather/">Открыть отдельную страницу</a><a href="#home">На главную</a></div>';
        host.querySelector('#ww-retry').onclick=()=>{host.querySelector('#ww-retry').disabled=true;mount();};
      });
      mount();return ()=>{active=false;view?.destroy();};
    }
  });
})();
