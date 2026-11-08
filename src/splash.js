/* AYYY · watercolor canvas with a fixed lighthouse. */
(() => {
  'use strict';
  const a = window.AYYY, e = a.escape, icon = a.icon;
  const artwork = 'assets/lighthouse-watercolor.webp';
  const defaults = ['memory', 'ai', 'calc', 'weather', 'focus', 'search'];
  const groups = [['all','Все'],['everyday','Каждый день'],['tools','Инструменты'],['creative','Творчество'],['games','Игры'],['personal','Личное'],['favorites','Избранное']];
  const shortNames = {memory:'Игры',ai:'Спросить ИИ',calc:'Посчитать',weather:'Погода',focus:'Фокус',search:'Поиск'};
  const shortDescriptions = {memory:'Пять минут для себя',ai:'Разобраться вместе',calc:'Сложное — в простое',weather:'Прогноз на день',focus:'Время для важного',search:'Найти направление'};
  a.catalogCategory = 'all';

  const shortcutIds = () => {
    const saved = a.get('home.shortcuts', defaults);
    const available = [...new Set(Array.isArray(saved) ? saved : defaults)].filter(id => a.services.some(s => s.id===id));
    return (available.length ? available : defaults).slice(0,6);
  };

  const navigation = page => `<header class="shore-header">
    <a class="shore-brand" href="#home" aria-label="AYYY — на главную">ayyy<span>.</span></a>
    <span class="shore-brand-note">всегда есть ориентир</span>
    <nav class="shore-nav" aria-label="Навигация портала">
      <a class="shore-nav-home ${page==='home'?'is-current':''}" href="#home" ${page==='home'?'aria-current="page"':''}>Главная</a>
      <a class="shore-catalog-link ${page==='directory'?'is-current':''}" href="#directory" ${page==='directory'?'aria-current="page"':''}>Все сервисы <span>${a.services.length}</span>${icon('arrow-right',16)}</a>
      <button class="shore-settings" data-action="settings" aria-label="Настройки портала" title="Настройки">${icon('sliders',19)}</button>
    </nav>
  </header>`;

  const footer = () => `<footer class="shore-footer"><span>Найти. Придумать. Немного поиграть.</span><span class="shore-footer-links"><button data-action="about">О маяке</button><button data-action="design">Цвета и характер</button><span class="shore-footer-mark">${icon('lighthouse',15)} AYYY</span></span></footer>`;

  // Public pages share one header and footer; search renders after module registration.
  a.shoreChrome = { navigation, footer };

  const beam = id => `<svg class="shore-beam" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0%" y1="50%" x2="100%" y2="50%"><stop stop-color="#ffbf57" stop-opacity=".48"/><stop offset=".48" stop-color="#ffc46c" stop-opacity=".18"/><stop offset="1" stop-color="#ffe6b6" stop-opacity="0"/></linearGradient></defs><path class="shore-beam-fill" fill="url(#${id})"/><path class="shore-beam-edge" fill="none" stroke="#de9a52" stroke-width=".65"/></svg>`;

  const picture = extra => `<img class="shore-lighthouse ${extra||''}" src="${artwork}" width="1024" height="1536" alt="Акварельный маяк на скалистом берегу: оранжевый свет, бирюзовое море и парусники" fetchpriority="high" decoding="async">`;

  function serviceIcon(service, size=32) {
    return `<span class="shore-service-art ${e(service.color)}"><svg class="shore-ink-wash" viewBox="0 0 96 82" aria-hidden="true"><path d="M11 27C1 14 29 4 43 10 59-2 93 13 86 28 104 44 81 67 65 68 49 87 9 73 13 57-4 50 0 35 11 27Z" fill="currentColor" opacity=".18"/><path d="M9 29C14 13 41 7 59 14 81 11 93 37 83 52 81 72 52 76 32 67 9 69 3 46 9 29Z" fill="none" stroke="currentColor" stroke-width=".8" opacity=".24"/><path d="m7 68 9 2m64-55 7-4M86 62l5 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>${icon(service.icon,size)}</span>`;
  }

  function shortcut(service) {
    const destination = service.url ? `href="${e(service.url)}" target="_blank" rel="noopener noreferrer"` : `href="#${e(service.route)}${service.param?'/'+encodeURIComponent(service.param):''}"`;
    return `<a class="shore-shortcut" ${destination}>${serviceIcon(service)}<span class="shore-shortcut-name">${e(shortNames[service.id]||service.name)}</span><small>${e(shortDescriptions[service.id]||service.desc)}</small></a>`;
  }

  const clockFace = () => `<svg class="shore-clock-face" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 7C74 6 94 27 92 51 93 76 73 94 48 92 24 93 6 73 8 49 7 25 26 6 50 7Z" fill="#b9d9d8" fill-opacity=".25" stroke="currentColor" stroke-width="1.4"/><circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width=".5" stroke-dasharray="1 19"/>${[0,90,180,270].map(angle=>`<path d="M50 15v5" stroke="currentColor" stroke-width="1.7" transform="rotate(${angle} 50 50)"/>`).join('')}<path class="shore-clock-hour" d="M50 50V29" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"/><path class="shore-clock-minute" d="M50 53V20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="50" cy="50" r="3" fill="#e9792d"/></svg>`;

  function homeInformation() {
    return `<section class="shore-information" aria-labelledby="shore-information-title">
      <div class="shore-section-line"><h2 id="shore-information-title">Маленькие ориентиры дня</h2><button class="shore-text-button" data-home-refresh="all">${icon('refresh',13)}<span data-home-refresh-label>Обновить</span></button></div>
      <div class="shore-widgets">
        <article class="shore-weather shore-widget">
          <div class="shore-widget-top"><button class="shore-widget-title" data-action="city">${icon('pin',14)}<span data-home-weather="city"></span>${icon('chevron-down',11)}</button><span class="shore-data-status" data-home-weather="status"></span></div>
          <a href="#weather" class="shore-weather-now"><span class="shore-temperature" data-home-weather="temp"></span><span class="shore-weather-drawing" data-home-weather="icon"></span><span class="shore-weather-detail"><span data-home-weather="condition"></span><small>Ощущается <span data-home-weather="feels"></span></small></span></a>
          <div class="shore-weather-graph" data-home-weather="chart"></div><div class="shore-weather-hours" data-home-weather="hours"></div>
          <div class="shore-data-source" data-home-weather="source"></div><p class="shore-data-error" data-home-weather="error" hidden></p>
        </article>
        <article class="shore-rates shore-widget">
          <div class="shore-widget-top"><a class="shore-widget-title" href="#finance">${icon('coins',15)} Валюты</a><span class="shore-data-status" data-home-rates="status"></span></div>
          <a class="shore-rate-line" href="#finance"><span><b>$</b> USD</span><strong><span data-home-rates="USD"></span><small> ₽</small></strong></a>
          <a class="shore-rate-line" href="#finance"><span><b>€</b> EUR</span><strong><span data-home-rates="EUR"></span><small> ₽</small></strong></a>
          <a class="shore-rate-line" href="#finance"><span><b>¥</b> CNY</span><strong><span data-home-rates="CNY"></span><small> ₽</small></strong></a>
          <div class="shore-data-source" data-home-rates="source"></div><p class="shore-data-error" data-home-rates="error" hidden></p>
        </article>
        <article class="shore-time shore-widget"><div class="shore-widget-top"><span class="shore-widget-title">Сейчас у вас</span><span class="shore-clock-dot" title="Время вашего устройства"></span></div>
          <div class="shore-time-main">${clockFace()}<time class="shore-digital-time" data-shore-clock></time></div><p class="shore-day" data-shore-day></p><a class="shore-pause" href="#focus">Найти время для себя ${icon('arrow-right',12)}</a>
        </article>
      </div>
    </section>`;
  }

  a.register('home', {
    title:'Ваш маяк в интернете',
    render() {
      const services=shortcutIds().map(id=>a.services.find(s=>s.id===id));
      const engine=Object.hasOwn(a.searchProviders,a.get('searchEngine','Google'))?a.get('searchEngine','Google'):'Google';
      return `<div class="shore-page shore-home">${navigation('home')}
        <div class="shore-stage">
          <div class="shore-art">${picture()}</div>${beam('home-light')}
          <div class="shore-home-content">
            <section class="shore-shortcuts" aria-labelledby="shore-shortcuts-title"><div class="shore-section-line"><h1 id="shore-shortcuts-title">Ваши сервисы</h1><button class="shore-text-button" id="shore-edit-shortcuts">${icon('sliders',12)} Выбрать свои</button></div><div class="shore-shortcut-grid">${services.length?services.map(shortcut).join(''):`<button class="shore-empty-shortcuts" id="shore-add-shortcuts">${icon('plus',18)} Добавить любимые сервисы</button>`}</div></section>
            <section class="shore-search-section" aria-label="Поиск"><form id="home-search" class="shore-search-form"><div class="shore-search-modes" role="group" aria-label="Режим поиска"><button type="button" class="active" data-searchmode="web" aria-pressed="true">В интернете</button><button type="button" data-searchmode="local" aria-pressed="false">Сервисы AYYY</button><button type="button" data-searchmode="ai" aria-pressed="false">Спросить ИИ ${icon('sparkles',12)}</button><span class="shore-search-key"><kbd>/</kbd> — начать поиск</span></div><div class="shore-search-box">${icon('search',21)}<input id="home-query" aria-label="Поисковый запрос" placeholder="Что хочется найти?" maxlength="500" autocomplete="off"><label class="shore-search-provider"><span class="data-visually-hidden">Поисковая система</span><select id="shore-search-engine">${Object.keys(a.searchProviders).map(name=>`<option ${name===engine?'selected':''}>${e(name)}</option>`).join('')}</select></label><button type="submit" class="shore-search-submit">Найти ${icon('arrow-right',16)}</button></div></form></section>
            ${homeInformation()}
          </div>
        </div>${footer()}</div>`;
    },
    mount() {
      const root=document.querySelector('#view'), form=root.querySelector('#home-search'), input=root.querySelector('#home-query'), provider=root.querySelector('#shore-search-engine');
      let mode='web';
      form.querySelectorAll('[data-searchmode]').forEach(button=>button.addEventListener('click',()=>{
        mode=button.dataset.searchmode;
        form.querySelectorAll('[data-searchmode]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
        input.placeholder=mode==='local'?'Найти сервис, инструмент или игру':mode==='ai'?'Что обсудим с помощником?':'Что хочется найти?';
        provider.closest('label').hidden=mode!=='web';
        input.focus();
      }));
      provider.onchange=()=>a.set('searchEngine',provider.value);
      form.onsubmit=event=>{event.preventDefault();a.performSearch(input.value,mode,provider.value);};
      root.querySelector('#shore-edit-shortcuts').onclick=chooseShortcuts;
      root.querySelector('#shore-add-shortcuts')?.addEventListener('click',chooseShortcuts);
      const updateClock=()=>{
        const now=new Date();
        const clock=root.querySelector('[data-shore-clock]');
        clock.textContent=now.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
        clock.dateTime=now.toISOString();
        root.querySelector('[data-shore-day]').textContent=now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
        root.querySelector('.shore-clock-hour').setAttribute('transform',`rotate(${now.getHours()%12*30+now.getMinutes()/2} 50 50)`);
        root.querySelector('.shore-clock-minute').setAttribute('transform',`rotate(${now.getMinutes()*6+now.getSeconds()/10} 50 50)`);
      };
      updateClock();const clockTimer=setInterval(updateClock,1000);
      const stopData=a.mountHomeData(root), stopBeam=mountBeam(root,'.shore-shortcut-grid');
      return ()=>{clearInterval(clockTimer);stopData();stopBeam();};
    }
  });

  function chooseShortcuts() {
    let selected=shortcutIds();
    a.modal('Ваши близкие направления',`<p class="muted">Выберите до шести сервисов для главной. Все остальные всегда доступны в каталоге.</p><div class="shore-picker-grid">${a.services.map(s=>`<label class="shore-picker-item"><input type="checkbox" value="${e(s.id)}" ${selected.includes(s.id)?'checked':''}>${icon(s.icon,21)}<span>${e(s.name)}</span></label>`).join('')}</div><div class="modal-footer"><span id="shore-picker-count" class="muted"></span><button class="btn" data-close-modal>Отмена</button><button class="btn primary" id="shore-save-shortcuts">Сохранить</button></div>`);
    const items=[...document.querySelectorAll('.shore-picker-item input')];
    const update=()=>{document.querySelector('#shore-picker-count').textContent=`${selected.length} из 6`;items.forEach(input=>input.disabled=!input.checked&&selected.length>=6);};
    items.forEach(input=>input.onchange=()=>{selected=input.checked?[...selected,input.value]:selected.filter(id=>id!==input.value);update();});
    update();document.querySelector('#shore-save-shortcuts').onclick=()=>{if(a.set('home.shortcuts',selected)){a.closeModal();a.render();a.toast('Ваши направления сохранены');}};
  }

  function catalogCard(service) {
    const favorite=a.favorites().includes(service.id);
    const destination=service.url?`href="${e(service.url)}" target="_blank" rel="noopener noreferrer"`:`href="#${e(service.route)}${service.param?'/'+encodeURIComponent(service.param):''}"`;
    return `<article class="shore-service-card"><a class="shore-catalog-open" ${destination}>${serviceIcon(service,29)}<h3>${e(service.name)}</h3><p>${e(service.desc)}</p><span class="shore-service-kind"><i class="${service.kind==='local'?'is-local':''}"></i>${e(a.kindLabels[service.kind])}</span><span class="shore-card-arrow">${icon('arrow-right',16)}</span></a><button class="shore-favorite favorite-btn ${favorite?'selected':''}" data-favorite="${e(service.id)}" data-service-name="${e(service.name)}" aria-pressed="${favorite}" aria-label="${favorite?'Убрать из избранного':'В избранное'}: ${e(service.name)}" title="${favorite?'Убрать из избранного':'В избранное'}">${icon('star',16)}</button></article>`;
  }

  a.register('directory', {
    title:'Все направления',
    render() {
      return `<div class="shore-page shore-directory">${navigation('directory')}
        <div class="shore-directory-stage"><aside class="shore-directory-art" aria-label="Маяк AYYY">${picture()}</aside>
          <div class="shore-catalog-content"><div class="shore-catalog-heading"><h1>Все сервисы</h1></div>
            <div class="shore-catalog-tools"><div class="shore-catalog-search">${icon('search',19)}<input id="catalog-search" aria-label="Найти сервис" placeholder="Название, занятие или идея…" value="${e(a.param)}" maxlength="150"><span>${a.services.length} сервиса</span></div><div class="shore-catalog-filters" role="group" aria-label="Категории сервисов">${groups.map(([id,name])=>`<button type="button" class="${id===a.catalogCategory?'active':''}" data-category="${id}" aria-pressed="${id===a.catalogCategory}">${id==='favorites'?icon('star',13):''}${name}</button>`).join('')}</div></div>
            <div class="shore-catalog-summary"><p id="catalog-count" aria-live="polite"></p><span>Сохраняйте любимое ${icon('star',12)}</span></div><div class="shore-catalog-grid" id="catalog-grid"></div>
            <p class="shore-catalog-note">${icon('lighthouse',17)} На главной — только ваши шесть направлений. Здесь — весь горизонт.</p>
          </div>
        </div>${footer()}</div>`;
    },
    mount() {
      const root=document.querySelector('#view'), input=root.querySelector('#catalog-search');
      const update=()=>{
        const category=a.catalogCategory, query=input.value.toLocaleLowerCase('ru').trim();
        const list=a.services.filter(s=>(category==='all'||category==='favorites'&&a.favorites().includes(s.id)||s.group===category)&&(!query||`${s.name} ${s.desc} ${s.id} ${shortNames[s.id]||''}`.toLocaleLowerCase('ru').includes(query)));
        root.querySelector('#catalog-count').textContent=`${list.length} из ${a.services.length} · ${groups.find(g=>g[0]===category)?.[1]||'Все'}`;
        root.querySelector('#catalog-grid').innerHTML=list.length?list.map(catalogCard).join(''):`<div class="shore-catalog-empty">${icon('search',32)}<h2>В этом направлении пока тихо</h2><p>Попробуйте другое слово или вернитесь ко всем сервисам.</p><button class="shore-small-button" id="shore-reset-catalog">Показать все</button></div>`;
        root.querySelector('#shore-reset-catalog')?.addEventListener('click',()=>{input.value='';a.catalogCategory='all';selectFilter();update();});
      };
      const selectFilter=()=>root.querySelectorAll('[data-category]').forEach(b=>{const active=b.dataset.category===a.catalogCategory;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
      input.oninput=update;
      root.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{a.catalogCategory=b.dataset.category;selectFilter();update();});
      const updateFavorites=()=>{
        if(a.catalogCategory!=='favorites')return;
        const buttons=[...root.querySelectorAll('[data-favorite]')];
        const focused=buttons.indexOf(document.activeElement);
        update();
        if(focused>=0){const remaining=[...root.querySelectorAll('[data-favorite]')];(remaining[Math.min(focused,remaining.length-1)]||root.querySelector('[data-category="favorites"]')).focus();}
      };
      document.addEventListener('ayyy:favorites',updateFavorites);update();
      return ()=>document.removeEventListener('ayyy:favorites',updateFavorites);
    }
  });

  // Both art and beam are fixed to the viewport. Only a resize or image load
  // changes the geometry; pointer movement and content refresh never move them.
  function mountBeam(root, targetSelector) {
    const svg=root.querySelector('.shore-beam'), image=root.querySelector('.shore-lighthouse'), targetElement=root.querySelector(targetSelector);
    if(!svg||!image||!targetElement)return ()=>{};
    let frame=0, alive=true;
    const update=()=>{
      frame=0;if(!alive||!svg.isConnected)return;
      const bounds=svg.getBoundingClientRect(), art=image.getBoundingClientRect(), target=targetElement.getBoundingClientRect();
      if(!bounds.width||!bounds.height)return;
      const x=art.left-bounds.left+art.width*.50390625, y=art.top-bounds.top+art.height*.189453125;
      const right=Math.min(bounds.width,target.right-bounds.left+40), top=target.top-bounds.top-8, bottom=target.bottom-bounds.top+8;
      svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
      svg.querySelector('.shore-beam-fill').setAttribute('d',`M ${x} ${y-5} L ${right} ${top} Q ${right+20} ${(top+bottom)/2} ${right} ${bottom} L ${x} ${y+5} Z`);
      svg.querySelector('.shore-beam-edge').setAttribute('d',`M ${x} ${y} L ${right} ${top} M ${x} ${y} L ${right} ${bottom}`);
    };
    const queue=()=>{if(!frame)frame=requestAnimationFrame(update);};
    const observer=new ResizeObserver(queue);observer.observe(image);observer.observe(targetElement);
    image.addEventListener('load',queue);window.addEventListener('resize',queue);
    queue();
    return ()=>{alive=false;observer.disconnect();cancelAnimationFrame(frame);image.removeEventListener('load',queue);window.removeEventListener('resize',queue);};
  }
})();
