/* AYYY service showcase: one editorial row per route. */
(function showcaseModule() {
  'use strict';
  const A = window.AYYY;
  const esc = A.escape;
  const icon = A.icon;
  const groups = [
    ['all', 'Все направления'],
    ['everyday', 'Каждый день'],
    ['tools', 'Работа и инструменты'],
    ['personal', 'Личное'],
    ['games', 'Игры'],
    ['favorites', 'Избранное']
  ];

  const stories = {
    oberon: {
      eyebrow: 'ЗНАНИЯ / ЛИЧНОЕ ПРОСТРАНСТВО',
      overline: 'Мысли обретают форму',
      lead: 'Рабочее пространство для заметок, идей и связанных материалов.',
      detail: 'Пишите в Markdown, собирайте заметки в папки, связывайте документы и возвращайтесь к нужному контексту без лишней навигации.',
      how: 'Заметки открываются в браузере. При желании можно привязать собственный репозиторий GitHub для работы с файлами.',
      features: ['Markdown', 'Папки и связи', 'Свой GitHub'],
      action: 'Открыть OBERON',
      connect: 'GitHub можно настроить',
      keywords: 'заметки записи знание markdown документы файлы github папки'
    },
    ai: {
      eyebrow: 'ИИ / НОВЫЕ ИНСТРУМЕНТЫ',
      overline: 'Диалог с машиной',
      lead: 'Экспериментальный терминал для общения с языковыми моделями.',
      detail: 'Выбирайте доступный способ работы: демонстрационный чат, локальную модель в браузере при поддержке WebGPU или подключаемого провайдера.',
      how: 'Режим зависит от выбранного движка. Демонстрация не выдаёт себя за настоящую модель, а локальная загрузка требует совместимого устройства.',
      features: ['Демо', 'WebLLM', 'Выбор модели'],
      action: 'Запустить терминал',
      status: 'Демо и локальный запуск',
      keywords: 'нейросеть искусственный интеллект чат webllm терминал модель'
    },
    search: {
      eyebrow: 'ПОИСК / ОТКРЫТЫЙ ИНТЕРНЕТ',
      overline: 'Найдите нужное',
      lead: 'От идеи и вопроса до полезной страницы за несколько секунд.',
      detail: 'Один удобный интерфейс для поиска по сайтам, картам, изображениям, видео и справочным материалам.',
      how: 'Запрос направляется в выбранную поисковую систему. AYYY не подменяет результаты внешних сервисов.',
      features: ['Веб и изображения', 'Видео и карты', 'Поисковые системы'],
      action: 'Начать поиск',
      status: 'Внешние поисковые системы',
      keywords: 'поиск google yandex duckduckgo bing видео карты картинки'
    },
    weather: {
      eyebrow: 'ПОГОДА / ПЛАНЫ НА ДЕНЬ',
      overline: 'Чувствовать перемены',
      lead: 'Прогноз, который помогает решить, как провести день.',
      detail: 'Температура, ветер, осадки и почасовые изменения в одном наглядном прогнозе с собственной погодной сценой.',
      how: 'Данные запрашиваются у Open-Meteo. Пока живой прогноз не получен, демонстрационные значения обозначены отдельно.',
      features: ['По часам', 'Погодные сцены', 'Open-Meteo'],
      action: 'Смотреть погоду',
      status: 'Открытый API · без ключа',
      keywords: 'погода температура дождь прогноз ветер климат open-meteo'
    },
    finance: {
      eyebrow: 'ДАННЫЕ / ВАЛЮТЫ И РЫНКИ',
      overline: 'Цифры в контексте',
      lead: 'Справочные курсы валют, история изменений и удобный пересчёт.',
      detail: 'Сравнивайте валютные пары, изучайте графики, рассчитывайте суммы и смотрите рыночные показатели в едином интерфейсе.',
      how: 'Курсы загружаются из открытых источников, включая Frankfurter. Это справочные данные, а не предложение банка.',
      features: ['Курсы валют', 'Графики', 'Конвертация'],
      action: 'Открыть валюты',
      status: 'Открытые рыночные данные',
      keywords: 'валюты рубль доллар евро конвертер курс рынок график frankfurter'
    },
    mpp: {
      eyebrow: 'ПРОЕКТЫ / ПРОСМОТР ФАЙЛОВ',
      overline: 'Увидеть весь план',
      lead: 'Открывайте планы проектов без установленного Microsoft Project.',
      detail: 'Просматривайте задачи, сроки и зависимости, переходите по структуре проекта и изучайте интерактивную диаграмму Ганта.',
      how: 'Файлы MPP и Project XML обрабатываются прямо в браузере. Это просмотрщик, а не редактор проектов.',
      features: ['MPP / XML', 'Диаграмма Ганта', 'Просмотр задач'],
      action: 'Открыть Project Viewer',
      status: 'Локальная обработка файлов',
      keywords: 'project viewer microsoft project mpp gantt гант задачи план график'
    },
    tools: {
      eyebrow: 'ИНСТРУМЕНТЫ / ОДНА МАСТЕРСКАЯ',
      overline: 'Маленькие задачи, точные ответы',
      lead: 'Девять полезных инструментов в одном рабочем пространстве.',
      detail: 'Ипотека и кредит, инженерные расчёты, проценты, конвертер величин, даты, пароли, JSON, текст и палитра цветов.',
      how: 'Выберите нужную вкладку внутри мастерской. Основные расчёты и преобразования выполняются на устройстве.',
      features: ['9 инструментов', 'Расчёты', 'Файлы и текст'],
      action: 'Открыть инструменты',
      status: 'Работает в браузере',
      keywords: 'tools converter калькулятор ипотека кредит инженерный проценты конвертер величин даты пароли json текст цвета палитра'
    },
    family: {
      eyebrow: 'ЛИЧНОЕ / ИСТОРИЯ СЕМЬИ',
      overline: 'Связи сквозь поколения',
      lead: 'Семейное дерево, которое можно дополнять годами.',
      detail: 'Создавайте карточки родственников, добавляйте фотографии и биографии, исследуйте поколения и импортируйте данные GEDCOM.',
      how: 'Ваше дерево хранится локально в браузере. Репозиторий GitHub можно подключить отдельно для синхронизации.',
      features: ['Семейное дерево', 'Фотографии', 'GEDCOM'],
      action: 'Открыть родословную',
      connect: 'GitHub можно настроить',
      keywords: 'родословная семья дерево генеалогия история родственники архив gedcom'
    },
    health: {
      eyebrow: 'ЛИЧНОЕ / ЗАЩИЩЁННЫЕ ДАННЫЕ',
      overline: 'История здоровья в порядке',
      lead: 'Личная медицинская карта с анализами, документами и динамикой.',
      detail: 'Сохраняйте показатели, результаты исследований, записи и события, изучайте графики и историю наблюдений.',
      how: 'Локальный архив шифруется; при настройке синхронизации в приватный GitHub передаются зашифрованные данные.',
      features: ['Анализы', 'Документы', 'Шифрование'],
      action: 'Открыть здоровье',
      connect: 'GitHub можно настроить',
      keywords: 'здоровье медицинская карта human анализы результаты графики лечение документы'
    },
    games: {
      eyebrow: 'ИГРЫ / РАЗВИТИЕ И ОТДЫХ',
      overline: 'Поиграем?',
      lead: 'Небольшие игры для отдыха, внимания и любопытства.',
      detail: 'Головоломки, аркады и развивающие упражнения, собранные в общем каталоге с уровнями и понятным управлением.',
      how: 'Игры запускаются прямо в браузере. Выбирайте игру и уровень — отдельное приложение устанавливать не нужно.',
      features: ['Головоломки', 'Развитие навыков', 'На любом экране'],
      action: 'Выбрать игру',
      status: 'Игры в браузере',
      keywords: 'игры головоломки детские обучение память внимание аркады'
    }
  };

  // The gallery is an illustrated short story for each real service.
  const scenes = {
    oberon: {title:'Орбита ваших идей',text:'Заметки, папки и связи — личное пространство OBERON в его собственных цветах.'},
    health: {title:'История здоровья — в деталях',text:'Двойная спираль ДНК, анализы и наблюдения в единой медицинской карте.'},
    weather: {title:'Небо, которое меняет планы',text:'Дерево, ветер и грозовые облака — погода в акварели и в прогнозе.'},
    family: {title:'Семейная память',text:'Фотографии, документы и связи между поколениями складываются в историю семьи.'},
    games: {title:'Вход в игровые миры',text:'Головоломки, аркады и настольные мотивы — выбирайте своё приключение.'},
    finance: {title:'Валюты, металлы и рынки',text:'Золото, серебро, купюры и графики — финансовые данные в одном месте.'},
    tools: {title:'Архитектура точных решений',text:'Финансовые расчёты и инженерные инструменты в общей мастерской.'},
    mpp: {title:'Проект целиком',text:'Задачи, зависимости и сроки на диаграмме Ганта — без установки Microsoft Project.'},
    search: {title:'Найдите нужное',text:'Документы, изображения, карты и знания — от запроса к результату.'},
    ai: {title:'Нейронный терминал',text:'Зелёное свечение старого монитора и современные модели в браузере.'},
  };

  // Approved artwork: separate full-size scenes and square card thumbnails.
  const artwork = Object.freeze({
    oberon: {hero:'assets/service-art/v2/oberon-hero.webp',card:'assets/service-art/v2/oberon-card.webp',width:900,height:900},
    health: {hero:'assets/service-art/v2/health-hero.webp',card:'assets/service-art/v2/health-card.webp',width:900,height:900},
    weather: {hero:'assets/service-art/v2/weather-hero.webp',card:'assets/service-art/v2/weather-card.webp',width:900,height:900},
    family: {hero:'assets/service-art/v2/family-hero.webp',card:'assets/service-art/v2/family-card.webp',width:900,height:900},
    games: {hero:'assets/service-art/v2/games-hero.webp',card:'assets/service-art/v2/games-card.webp',width:900,height:900},
    finance: {hero:'assets/service-art/v2/finance-hero.webp',card:'assets/service-art/v2/finance-card.webp',width:900,height:900},
    tools: {hero:'assets/service-art/v2/tools-hero.webp',card:'assets/service-art/v2/tools-card.webp',width:900,height:900},
    mpp: {hero:'assets/service-art/v2/mpp-hero.webp',card:'assets/service-art/v2/mpp-card.webp',width:900,height:900},
    search: {hero:'assets/service-art/v2/search-hero.webp',card:'assets/service-art/v2/search-card.webp',width:900,height:900},
    ai: {hero:'assets/service-art/v2/ai-hero.webp',card:'assets/service-art/v2/ai-card.webp',width:900,height:900},
  });

  function linkFor(service) {
    return service.url ? {url:service.url, attributes:'target="_blank" rel="noopener noreferrer"'} :
      {url:'#' + encodeURIComponent(service.route) + (service.param?'/'+encodeURIComponent(service.param):''),attributes:''};
  }

  function serviceRow(service, index) {
    const story=stories[service.id];
    if(!story)return '';
    const link=linkFor(service),favorite=A.favorites().includes(service.id);
    const id=esc(service.id),name=esc(service.name);
    const action=service.id==='ai'?'Запустить':service.id==='games'?'Играть':'Открыть';
    return `<article class="sc-row sc-row--${id}" data-service-id="${id}">
      <a class="sc-card-cover" href="${esc(link.url)}" ${link.attributes} aria-label="${esc('Открыть: '+service.name)}">
        <img src="${esc(artwork[service.id].card)}" width="480" height="480" alt="" loading="lazy" decoding="async">
        <span class="sc-card-number">AYYY / ${String(index+1).padStart(2,'0')}</span>
        <span class="sc-card-visit">${icon('arrow-right',15)}</span>
      </a>
      <div class="sc-card-body">
        <div class="sc-card-head">
          <span class="sc-overline">${esc(story.eyebrow)}</span>
          <button type="button" class="sc-favorite favorite-btn ${favorite?'selected':''}" data-favorite="${id}" aria-pressed="${favorite}" aria-label="${favorite?'Убрать из избранного':'В избранное'}: ${name}" title="${favorite?'Убрать из избранного':'В избранное'}">${icon('star',16)}</button>
        </div>
        <a class="sc-card-name" href="${esc(link.url)}" ${link.attributes}><h2>${name}</h2></a>
        <p class="sc-card-lead">${esc(story.lead)}</p>
        <details class="sc-card-more"><summary>Что умеет и как работает</summary>
          <div class="sc-card-detail-body">
            <p>${esc(story.detail)}</p><p><strong>Как работает.</strong> ${esc(story.how)}</p>
            <div class="sc-card-tags">${story.features.map(feature=>`<span>${esc(feature)}</span>`).join('')}</div>
          </div>
        </details>
        <div class="sc-card-foot">
          <span class="sc-connection ${story.connect?'sc-can-connect':''}" ${story.connect?`data-sc-connection="${id}"`:''} title="${esc(story.connect||story.status)}">${icon(story.connect?'link':'check',13)}<span>${esc(story.connect||story.status)}</span></span>
          <a class="sc-open" href="${esc(link.url)}" ${link.attributes} aria-label="${esc(story.action)}">${action} ${icon('arrow-right',14)}</a>
        </div>
      </div>
    </article>`;
  }

  function readStoreIfExists(database, store) {
    if (!window.indexedDB || typeof indexedDB.databases!=='function') return Promise.resolve([]);
    return indexedDB.databases().then(databases=>{
      if (!databases.some(item=>item.name===database)) return [];
      return new Promise(resolve=>{
        let settled = false;
        const finish = value => {if (!settled) {settled=true;resolve(value);}};
        let request;
        try {request=indexedDB.open(database);} catch {finish([]);return;}
        request.onupgradeneeded=()=>{try {request.transaction.abort();} catch {} finish([]);};
        request.onerror=()=>finish([]);
        request.onblocked=()=>finish([]);
        request.onsuccess=()=>{
          const db=request.result;
          if (!db.objectStoreNames.contains(store)){db.close();finish([]);return;}
          let rows=[];
          try {
            const tx=db.transaction(store,'readonly');
            const get=tx.objectStore(store).getAll();
            get.onsuccess=()=>{rows=Array.isArray(get.result)?get.result:[];};
            tx.oncomplete=()=>{db.close();finish(rows);};
            tx.onerror=tx.onabort=()=>{db.close();finish([]);};
          } catch {db.close();finish([]);}
        };
      });
    }).catch(()=>[]);
  }

  async function updateConnections(root) {
    const specs=[
      ['oberon','ayyy-oberon-v1','vaults',item=>item?.kind==='github'&&item.connection?.owner&&item.connection?.repo ? item.connection : null],
      ['family','ayyy-family-v1','sync',item=>item?.owner&&item?.repo ? item : null],
      ['health','ayyy-health-v2','vaults',item=>item?.repo?.owner&&item?.repo?.repo ? item.repo : null]
    ];
    await Promise.all(specs.map(async ([id,database,store,extract])=>{
      const rows=await readStoreIfExists(database,store);
      if (!root.isConnected) return;
      const connections=rows.map(extract).filter(Boolean);
      const node=root.querySelector(`[data-sc-connection="${id}"]`);
      if (!node || !connections.length) return;
      const names=[...new Set(connections.map(item=>`${item.owner}/${item.repo}`))];
      const text=node.querySelector('span');
      if (!text) return;
      text.textContent=names.length===1?`GitHub настроен · ${names[0]}`:`GitHub настроен · ${names.length} репозитория`;
      node.classList.add('sc-is-connected');
      node.classList.remove('sc-can-connect');
      node.title='Настроен GitHub: '+names.join(', ')+'. Авторизация проверяется при открытии сервиса.';
    }));
  }

  A.register('directory',{
    title:'Все сервисы',
    render(){
      const available=A.services.filter(service=>scenes[service.id]);
      const count=available.length;
      const selection=groups.some(group=>group[0]===A.catalogCategory)?A.catalogCategory:'all';
      A.catalogCategory=selection;
      return `<div class="shore-page shore-directory sc-page">
        ${A.shoreChrome.navigation('directory')}
        <main class="sc-shell">
          <aside class="sc-gallery" aria-label="Иллюстрации сервисов" data-sc-active="default">
            <div class="sc-gallery-sticky">
              <div class="sc-gallery-frame">
              <img class="sc-gallery-image is-visible" data-sc-picture="default" src="assets/lighthouse-watercolor.webp" width="1024" height="1536" alt="" decoding="async">
              ${available.map(service=>`<img class="sc-gallery-image" data-sc-picture="${esc(service.id)}" src="${esc(artwork[service.id].hero)}" width="${artwork[service.id].width}" height="${artwork[service.id].height}" alt="" decoding="async">`).join('')}
            </div>
            <div class="sc-gallery-hint">${icon('sparkles',13)} Наведите на сервис</div>
            <div class="sc-gallery-caption" aria-live="polite" aria-atomic="true">
              <small data-sc-story-index>AYYY / ВАШ МАЯК</small>
              <h2 data-sc-story-title>У каждого дела свой ориентир</h2>
              <p data-sc-story-text>Наведите на сервис — здесь появится его история.</p>
            </div>
            </div>
          </aside>
          <section class="sc-catalog" aria-label="Каталог сервисов AYYY">
            <div class="sc-intro"><div class="sc-kicker"><span></span> КАТАЛОГ AYYY <span class="sc-kicker-dash">/</span> ${count} НАПРАВЛЕНИЙ</div>
              <h1>Все сервисы</h1><p>Каждый сервис — отдельная история. Наведите курсор на карточку, чтобы увидеть её слева.</p>
            </div>
            <div class="sc-toolbar"><label class="sc-search">${icon('search',18)}<input id="catalog-search" type="search" aria-label="Найти сервис" placeholder="Название, задача или идея…" value="${esc(A.param||'')}" maxlength="150" autocomplete="off"><span id="sc-search-count">${count} сервисов</span></label>
              <div class="sc-categories" role="group" aria-label="Категории сервисов">${groups.map(([id,label])=>`<button type="button" data-category="${id}" class="${id===selection?'active':''}" aria-pressed="${id===selection}">${id==='favorites'?icon('star',13):''}${esc(label)}</button>`).join('')}</div>
            </div>
            <div class="sc-list-top"><span id="catalog-count" aria-live="polite"></span><span class="sc-list-tip">${icon('star',12)} Отмечайте любимое</span></div>
            <div id="catalog-grid" class="sc-list"></div>
            <div class="sc-outro">${icon('lighthouse',20)}<div><strong>Ваши любимые направления</strong><span>На главной можно закрепить шесть сервисов; весь каталог всегда доступен здесь.</span></div><a href="#home">На главную ${icon('arrow-right',15)}</a></div>
          </section>
        </main>
        ${A.shoreChrome.footer()}
      </div>`;
    },
    mount(){
      const root=document.querySelector('#view');
      const input=root.querySelector('#catalog-search');
      const count=root.querySelector('#catalog-count');
      const grid=root.querySelector('#catalog-grid');
      const tabs=[...root.querySelectorAll('[data-category]')];
      const visible=()=> {
        const q=input.value.toLocaleLowerCase('ru').trim();
        const fav=A.favorites();
        return A.services.filter(service=>{
          const story=stories[service.id];
          if (!story) return false;
          const category=A.catalogCategory;
          if (category==='favorites'&&!fav.includes(service.id)) return false;
          if (!['all','favorites'].includes(category)&&service.group!==category) return false;
          return !q || [service.name,service.desc,service.id,story.eyebrow,story.lead,story.detail,story.how,story.keywords,...story.features].join(' ').toLocaleLowerCase('ru').includes(q);
        });
      };
      const gallery=root.querySelector('.sc-gallery');
      const galleryPictures=[...gallery.querySelectorAll('[data-sc-picture]')];
      const galleryTitle=gallery.querySelector('[data-sc-story-title]');
      const galleryText=gallery.querySelector('[data-sc-story-text]');
      const galleryIndex=gallery.querySelector('[data-sc-story-index]');
      let activeScene='default';
      const showScene=id=>{
        const next=Object.hasOwn(scenes,id)?id:'default';
        if(next===activeScene || !root.isConnected)return;
        activeScene=next;
        gallery.dataset.scActive=next;
        galleryPictures.forEach(image=>image.classList.toggle('is-visible',image.dataset.scPicture===next));
        galleryTitle.textContent=next==='default'?'У каждого дела свой ориентир':scenes[next].title;
        galleryText.textContent=next==='default'?'Наведите на сервис — здесь появится его история.':scenes[next].text;
        const position=A.services.findIndex(service=>service.id===next);
        galleryIndex.textContent=next==='default'?'AYYY / ВАШ МАЯК':`AYYY / ${String(position+1).padStart(2,'0')} · ИСТОРИЯ СЕРВИСА`;
      };
      const hoveredRow=target=>target instanceof Element?target.closest('.sc-row'):null;
      const pointerOver=event=>{
        if(event.pointerType==='touch')return;
        const row=hoveredRow(event.target);
        if(row && grid.contains(row))showScene(row.dataset.serviceId);
      };
      const pointerOut=event=>{
        if(event.pointerType==='touch')return;
        const row=hoveredRow(event.target);
        if(!row || row.contains(event.relatedTarget))return;
        const next=hoveredRow(event.relatedTarget);
        showScene(next && grid.contains(next)?next.dataset.serviceId:null);
      };
      const focusIn=event=>{
        const row=hoveredRow(event.target);
        if(row && grid.contains(row))showScene(row.dataset.serviceId);
      };
      const focusOut=event=>{
        const row=hoveredRow(event.target);
        if(!row || row.contains(event.relatedTarget))return;
        const next=hoveredRow(event.relatedTarget);
        showScene(next && grid.contains(next)?next.dataset.serviceId:null);
      };
      grid.addEventListener('pointerover',pointerOver);
      grid.addEventListener('pointerout',pointerOut);
      const pointerLeave=()=>showScene(null);
      grid.addEventListener('pointerleave',pointerLeave);
      grid.addEventListener('focusin',focusIn);
      grid.addEventListener('focusout',focusOut);
      const refresh=()=>{
        const list=visible();
        showScene(null);
        const all=A.services.filter(s=>stories[s.id]).length;
        const currentGroup=groups.find(group=>group[0]===A.catalogCategory)?.[1]||'Все направления';
        count.textContent=`${list.length} из ${all} · ${currentGroup}`;
        root.querySelector('#sc-search-count').textContent=`${list.length} ${list.length===1?'сервис':'сервисов'}`;
        grid.innerHTML=list.length?list.map(service=>serviceRow(service,A.services.indexOf(service))).join(''):
          `<div class="sc-empty">${icon('search',32)}<h2>Пока ничего не найдено</h2><p>Попробуйте другое слово или посмотрите все направления.</p><button type="button" id="sc-reset">Показать всё</button></div>`;
        const reset=grid.querySelector('#sc-reset');
        if (reset) reset.addEventListener('click',()=>{A.catalogCategory='all';input.value='';setCategory();refresh();});
        updateConnections(root);
      };
      const setCategory=()=>tabs.forEach(button=>{
        const active=button.dataset.category===A.catalogCategory;
        button.classList.toggle('active',active);
        button.setAttribute('aria-pressed',String(active));
      });
      input.addEventListener('input',refresh);
      tabs.forEach(button=>button.addEventListener('click',()=>{
        A.catalogCategory=button.dataset.category;
        setCategory();
        refresh();
      }));
      const onFavorites=()=>{
        if (A.catalogCategory!=='favorites') return;
        const activeId=document.activeElement?.dataset?.favorite;
        refresh();
        if (activeId) (grid.querySelector(`[data-favorite="${activeId}"]`)||root.querySelector('[data-category="favorites"]'))?.focus();
      };
      const onVisibility=()=>{if (document.visibilityState==='visible') updateConnections(root);};
      document.addEventListener('ayyy:favorites',onFavorites);
      document.addEventListener('visibilitychange',onVisibility);
      refresh();
      return ()=>{
        grid.removeEventListener('pointerover',pointerOver);
        grid.removeEventListener('pointerleave',pointerLeave);
        grid.removeEventListener('pointerout',pointerOut);
        grid.removeEventListener('focusin',focusIn);
        grid.removeEventListener('focusout',focusOut);
        document.removeEventListener('ayyy:favorites',onFavorites);
        document.removeEventListener('visibilitychange',onVisibility);
      };
    }
  });
})();
