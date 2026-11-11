/* AYYY · portable, dependency-free browser portal. */
(() => {
  'use strict';
  const paths = {
    home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    sparkles:'m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3 M20 2v4 M18 4h4',
    sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M19 5l-1.5 1.5 M6.5 17.5 5 19',
    moon:'M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5a8.5 8.5 0 1 0 9.7 9.7Z',
    oberon:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0 M11 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0 M17 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M4 2v4 M2 4h4 M21 20h.01',
    cloud:'M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8Z',
    rain:'M6 15a4 4 0 0 1 1-8 5 5 0 0 1 9-1 4.5 4.5 0 1 1 2 9 M7 18l-1 3 M12 18l-1 3 M17 18l-1 3',
    wind:'M3 8h12a3 3 0 1 0-3-3 M2 12h17a3 3 0 1 1-3 3 M4 16h5a3 3 0 1 1-3 3',
    droplet:'M12 3C9 7 5 10 5 14a7 7 0 0 0 14 0c0-4-4-7-7-11Z',
    chart:'M4 3v17h17 M7 14l4-4 4 2 6-7',
    calculator:'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z M8 6h8 M8 10h1 M15 10h1 M8 14h1 M15 14h1 M8 18h1 M15 18h1',
    brush:'m14 5 5-3 3 3-9 9-4-4 5-5ZM10 13c-5-2-4 7-8 7 6 3 10 0 10-4',
    paint:'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a5 5 0 0 0 5-5c0-3-4-5-9-5Z M7 7h.01 M5 12h.01 M10 6h.01 M15 6h.01',
    gamepad:'M7 7h10a4 4 0 0 1 4 4l1 6a3 3 0 0 1-5 2l-3-3h-4l-3 3a3 3 0 0 1-5-2l1-6a4 4 0 0 1 4-4Z M7 10v5 M4.5 12.5h5 M16 11h.01 M19 14h.01',
    note:'M5 3h14v14l-4 4H5V3Z M15 21v-6h4 M8 7h8 M8 11h6',
    star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
    settings:'m10 2-1 3-3 1-3-1-2 4 2 3-1 3 2 4 3-1 3 1 1 3h4l1-3 3-1 3 1 2-4-2-3 1-3-2-4-3 1-3-1-1-3h-4Z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    sliders:'M4 3v5 M4 12v9 M12 3v10 M12 17v4 M20 3v3 M20 10v11 M1 8h6v4H1z M9 13h6v4H9z M17 6h6v4h-6z',
    help:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M9 8a3 3 0 0 1 6 0c0 3-3 2-3 5 M12 17h.01',
    'arrow-right':'M4 12h16 M14 6l6 6-6 6',
    'arrow-left':'M20 12H4 M10 6l-6 6 6 6',
    'arrow-up':'M12 20V4 M6 10l6-6 6 6',
    'arrow-down':'M12 4v16 M6 14l6 6 6-6',
    'chevron-down':'m6 9 6 6 6-6',
    'chevron-right':'m9 6 6 6-6 6',
    external:'M14 3h7v7 M21 3l-11 11 M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6',
    plus:'M12 5v14 M5 12h14', minus:'M5 12h14', x:'m6 6 12 12 M18 6 6 18', check:'m5 12 4 4L19 6',
    clock:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
    focus:'M4 8V4h4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    play:'m8 4 12 8-12 8V4Z', pause:'M8 4v16 M16 4v16',
    refresh:'M21 10a9 9 0 0 0-15-6L3 7 M3 2v5h5 M3 14a9 9 0 0 0 15 6l3-3 M21 22v-5h-5',
    lock:'M6 10V7a6 6 0 0 1 12 0v3 M4 10h16v12H4z M12 14v4',
    shield:'m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Z m-4 10 3 3 5-6',
    globe:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2a20 20 0 0 1 0 20 20 20 0 0 1 0-20',
    map:'m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3V5Z M8 2v17 M16 5v17',
    pin:'M19 9c0 6-7 13-7 13S5 15 5 9a7 7 0 1 1 14 0Z M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    copy:'M8 8h13v13H8z M16 8V3H3v13h5',
    download:'M12 2v13 m-5-5 5 5 5-5 M3 15v6h18v-6',
    upload:'M12 16V3 m-5 5 5-5 5 5 M3 16v5h18v-5',
    trash:'M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
    edit:'m4 16 12-12 4 4L8 20H4v-4Z M14 6l4 4',
    send:'m3 3 19 9-19 9 4-9-4-9Z M7 12h15',
    code:'m8 5-7 7 7 7 M16 5l7 7-7 7 M14 2l-4 20',
    percent:'M4 20 20 4 M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M21 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    coins:'M16 5c0 2-3 3-7 3S2 7 2 5s3-3 7-3 7 1 7 3Z M2 5v5c0 2 3 3 7 3 M2 10v5c0 2 3 3 7 3 M22 12c0 2-3 3-7 3s-7-1-7-3 3-3 7-3 7 1 7 3Z M8 12v6c0 2 3 3 7 3s7-1 7-3v-6',
    calendar:'M3 5h18v16H3z M7 2v6 M17 2v6 M3 10h18 M7 14h2 M13 14h2 M7 18h2',
    type:'M3 4h18 M12 4v16 M7 20h10',
    file:'M5 2h9l5 5v15H5V2Z M14 2v6h5 M8 12h8 M8 16h6',
    ruler:'m3 15 12-12 6 6L9 21l-6-6Z M6 12l3 3 M9 9l3 3 M12 6l3 3',
    image:'M3 3h18v18H3z m0 14 6-6 5 5 3-3 4 4 M17 7h.01',
    eraser:'m9 20-7-7L13 2l9 9-9 9H9Z M8 7l9 9 M13 20h9',
    undo:'M3 10h11a7 7 0 0 1 0 14 M3 10l5-5 M3 10l5 5',
    redo:'M21 10H10a7 7 0 0 0 0 14 M21 10l-5-5 M21 10l-5 5',
    trophy:'M7 3h10v8a5 5 0 0 1-10 0V3Z M7 5H3v3a4 4 0 0 0 4 4 M17 5h4v3a4 4 0 0 1-4 4 M12 16v5 M8 21h8',
    menu:'M3 6h18 M3 12h18 M3 18h18',
    laptop:'M5 3h14v12H5z M2 15h20l1 5H1l1-5Z',
    bell:'M5 17V9a7 7 0 1 1 14 0v8l2 2H3l2-2Z M10 22h4',
    pulse:'M2 12h4l3-6 4 12 3-6h6',
    heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
    volume:'M3 9h4l5-5v16l-5-5H3V9Z M16 8a6 6 0 0 1 0 8 M19 5a10 10 0 0 1 0 14',
    link:'m10 13 4-4 M8 16l-2 2a4 4 0 0 1-6-6l6-6a4 4 0 0 1 6 0 M16 8l2-2a4 4 0 0 1 6 6l-6 6a4 4 0 0 1-6 0',
    translate:'M2 5h12 M8 2v3 M4 8c2 5 5 8 9 10 M12 5C11 11 7 16 2 18 M14 22l4-11 4 11 M16 18h4',
    lightbulb:'M8 16c-7-6-2-14 4-14s11 8 4 14v3H8v-3Z M9 22h6',
    lighthouse:'M10 9h4l3 13H7L10 9Z M8 6l4-4 4 4 M9 6h6v3H9V6Z M4 7 1 5 M20 7l3-2 M9 15h6 M6 22h12',
    archive:'M3 3h18v5H3z M5 8v13h14V8 M9 12h6',
    inbox:'M4 4h16l2 14v3H2v-3L4 4Z M2 15h6l2 3h4l2-3h6'
  };
  const app = window.AYYY = {
    views:{}, param:'', route:'home', cleanup:null, secrets:{key:''},
    escape(value){return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
    icon(name,size=20){return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.grid}"/></svg>`;},
    get(key,fallback){try{const value=localStorage.getItem('ayyy:v1:'+key);return value===null?fallback:JSON.parse(value);}catch{return fallback;}},
    set(key,value){try{localStorage.setItem('ayyy:v1:'+key,JSON.stringify(value));return true;}catch{app.toast('Не удалось сохранить: хранилище браузера недоступно или заполнено.');return false;}},
    register(id,view){this.views[id]=view;},
    navigate(route,param=''){const hash='#'+route+(param?'/'+encodeURIComponent(param):'');if(location.hash===hash)app.render();else location.hash=hash;},
    toast(message){const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.innerHTML=app.icon('check',17)+`<span>${app.escape(message)}</span>`;document.querySelector('#toasts').append(el);setTimeout(()=>el.remove(),4200);},
    download(filename,content,mime='text/plain;charset=utf-8'){const blob=content instanceof Blob?content:new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);},
    async copy(text){try{await navigator.clipboard.writeText(text);app.toast('Скопировано');return true;}catch{app.modal('Скопируйте текст',`<p class="muted">Браузер ограничил доступ к буферу. Выделите текст и нажмите Ctrl+C.</p><textarea class="field" rows="6" id="copy-fallback" readonly>${app.escape(text)}</textarea>`);document.querySelector('#copy-fallback').select();return false;}},
    safeURL(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}},
    modal(title,html,wide=false){const dlg=document.querySelector('#modal');document.querySelector('#modal-title').textContent=title;document.querySelector('#modal-body').innerHTML=html;dlg.classList.toggle('wide',wide);if(!dlg.open)dlg.showModal();},
    closeModal(){document.querySelector('#modal').close();},
    heading(title,description,action=''){return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;},
    external(url,label,icon='external',cls='btn'){return `<a class="${cls}" href="${app.escape(url)}" target="_blank" rel="noopener noreferrer">${label}${app.icon(icon,16)}</a>`;},
    routeButton(route,label,icon='arrow-right',param='',cls='btn'){return `<button class="${cls}" data-route="${route}" data-param="${param}">${label}${app.icon(icon,16)}</button>`;},
    fmt(num,digits=2){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(num);},
    settings:{}, services:[],
    async fetchJSON(url,options={}){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(url,{...options,signal:controller.signal});if(!response.ok)throw new Error('HTTP '+response.status);return await response.json();}finally{clearTimeout(timer);}},
    render(){
      if(app.cleanup){app.cleanup();app.cleanup=null;}
      const [route,param]=location.hash.slice(1).split('/');app.route=app.views[route]?route:'home';try{app.param=decodeURIComponent(param||'');}catch{app.param='';}
      document.body.dataset.page=app.route;
      document.body.dataset.shell=['home','directory'].includes(app.route)?'splash':['tools','search','games','family','health','oberon'].includes(app.route)?app.route:'service';
      const view=app.views[app.route];document.title=`${view.title} · AYYY`;
      document.querySelectorAll('[data-nav]').forEach(el=>{const selected=el.dataset.nav===app.route;el.classList.toggle('active',selected);if(selected)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
      document.querySelector('#page-label').textContent=view.title;
      document.querySelectorAll('.nav-count').forEach(el=>el.textContent=String(app.services.length));
      document.querySelector('#view').innerHTML=view.render();
      const result=view.mount?.();if(typeof result==='function')app.cleanup=result;
      window.AYYYVisits?.route(app.route,app.param);
      document.body.classList.remove('nav-open');document.querySelector('[data-action=menu]')?.setAttribute('aria-expanded','false');window.scrollTo({top:0,behavior:'instant'});
    }
  };
  app.services = [
    {id:'oberon',name:'OBERON',desc:'Заметки Markdown, папки и связи в GitHub',icon:'oberon',color:'amber',group:'personal',kind:'connect',route:'oberon'},
    {id:'ai',name:'Терминал',desc:'Нейронный терминал · локальное демо',icon:'sparkles',color:'purple',group:'everyday',kind:'demo',route:'ai',tag:'CRT'},
    {id:'search',name:'Умный поиск',desc:'Веб, видео, карты и знания',icon:'search',color:'blue',group:'everyday',kind:'link',route:'search'},
    {id:'weather',name:'Погода',desc:'Планы с учётом прогноза',icon:'sun',color:'amber',group:'everyday',kind:'api',route:'weather'},
    {id:'finance',name:'Валюты и рынки',desc:'Курсы, конвертер и индексы',icon:'chart',color:'green',group:'everyday',kind:'api',route:'finance'},
    {id:'mpp',name:'Project Viewer',desc:'Гант из файлов MPP и Project XML',icon:'chart',color:'blue',group:'tools',kind:'local',route:'mpp'},
    {id:'calc',name:'Калькулятор',desc:'Посчитать быстро и точно',icon:'calculator',color:'blue',group:'tools',kind:'local',route:'tools',param:'calc'},
    {id:'percent',name:'Проценты',desc:'Скидки, доли и изменения',icon:'percent',color:'green',group:'tools',kind:'local',route:'tools',param:'percent'},
    {id:'converter',name:'Конвертер величин',desc:'Метры, градусы и мегабайты',icon:'ruler',color:'orange',group:'tools',kind:'local',route:'tools',param:'converter'},
    {id:'dates',name:'Калькулятор дат',desc:'Дни между важными событиями',icon:'calendar',color:'purple',group:'tools',kind:'local',route:'tools',param:'dates'},
    {id:'password',name:'Генератор паролей',desc:'Случайный пароль в браузере',icon:'lock',color:'green',group:'tools',kind:'local',route:'tools',param:'password'},
    {id:'json',name:'JSON-редактор',desc:'Проверить и отформатировать',icon:'code',color:'purple',group:'tools',kind:'local',route:'tools',param:'json'},
    {id:'text',name:'Работа с текстом',desc:'Символы, слова и чистые пробелы',icon:'type',color:'blue',group:'tools',kind:'local',route:'tools',param:'text'},
    {id:'color',name:'Палитра цветов',desc:'HEX, RGB и нужное настроение',icon:'paint',color:'pink',group:'creative',kind:'local',route:'tools',param:'color'},
    {id:'family',name:'Родословная',desc:'Семейное дерево, история семьи и личный архив',icon:'heart',color:'green',group:'personal',kind:'local',route:'family'},
    {id:'health',name:'Здоровье',desc:'Медкарта, анализы, графики',icon:'pulse',color:'blue',group:'personal',kind:'local',route:'health'},
    {id:'games',name:'Игры',desc:'Головоломки, аркады и тренировка памяти',icon:'gamepad',color:'orange',group:'games',kind:'local',route:'games'},
    {id:'translate',name:'Переводчик',desc:'Открыть Google Переводчик',icon:'translate',color:'blue',group:'everyday',kind:'link',url:'https://translate.google.com/'}
  ];
  app.kindLabels={local:'В браузере',api:'Открытый API',link:'Внешний сервис',connect:'Подключаемый',demo:'Демо-экран'};
  app.serviceId=id=>['memory','2048','math'].includes(id)?'games':id;
  app.favorites=()=>{const ids=app.get('favorites',['ai','calc','weather','games','password','translate']);return Array.isArray(ids)?[...new Set(ids.map(app.serviceId))].filter(id=>app.services.some(s=>s.id===id)):[];};
  app.serviceCard=(s,compact=false)=>`<article class="service-card ${compact?'compact':''}"><button class="service-open" ${s.url?`data-external="${app.escape(s.url)}"`:`data-route="${s.route}" data-param="${s.param||''}"`}><span class="service-icon ${s.color}">${app.icon(s.icon,24)}</span><span class="service-title">${s.name}</span><span class="service-desc">${s.desc}</span>${compact?'':`<span class="service-kind"><i class="status-dot ${s.kind==='local'?'green':''}"></i>${app.kindLabels[s.kind]}</span>`}</button><button class="favorite-btn ${app.favorites().includes(s.id)?'selected':''}" data-favorite="${s.id}" title="${app.favorites().includes(s.id)?'Убрать из избранного':'В избранное'}" aria-label="${app.favorites().includes(s.id)?'Убрать из избранного':'В избранное'}: ${s.name}" aria-pressed="${app.favorites().includes(s.id)}">${app.icon('star',15)}</button></article>`;
})();
