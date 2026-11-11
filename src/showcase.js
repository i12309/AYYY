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

  function art(id) {
    switch (id) {
      case 'oberon': return `<div class="sc-art-scene sc-scene-oberon"><span class="sc-orbit sc-orbit-1"></span><span class="sc-orbit sc-orbit-2"></span><span class="sc-orbit sc-orbit-3"></span><img src="oberon/oberon-mark.svg" alt="" width="86" height="86" loading="lazy"></div>`;
      case 'ai': return `<div class="sc-art-scene sc-scene-ai"><div class="sc-ai-window"><div class="sc-ai-lights"><i></i><i></i><i></i></div><span><b>›</b> ask something<span class="sc-ai-cursor">_</span></span><span><b>◈</b> thinking in tokens</span><span class="sc-ai-code">▰ ▰ ▰ ▰ ▱ ▱</span></div></div>`;
      case 'search': return `<div class="sc-art-scene sc-scene-search"><span class="sc-search-ring sc-search-ring-1"></span><span class="sc-search-ring sc-search-ring-2"></span><span class="sc-search-ring sc-search-ring-3"></span><span class="sc-search-center">${icon('search',52)}</span><span class="sc-search-point sc-search-point-1"></span><span class="sc-search-point sc-search-point-2"></span></div>`;
      case 'weather': return `<div class="sc-art-scene sc-scene-weather"><span class="sc-weather-rays"></span><span class="sc-weather-sun"></span><span class="sc-weather-cloud sc-weather-cloud-1"></span><span class="sc-weather-cloud sc-weather-cloud-2"></span><span class="sc-weather-land"></span></div>`;
      case 'finance': return `<div class="sc-art-scene sc-scene-finance"><span class="sc-finance-symbol">€ / $</span><svg viewBox="0 0 340 155" preserveAspectRatio="none" aria-hidden="true"><path class="sc-finance-grid" d="M0 35H340M0 75H340M0 115H340M42 0V155M122 0V155M202 0V155M282 0V155"/><path class="sc-finance-fill" d="M0 115L43 113L89 95L136 104L177 69L216 76L257 39L300 49L340 19V155H0Z"/><path class="sc-finance-line" d="M0 115L43 113L89 95L136 104L177 69L216 76L257 39L300 49L340 19"/></svg></div>`;
      case 'mpp': return `<div class="sc-art-scene sc-scene-mpp"><div class="sc-gantt"><div><i></i><b></b></div><div><i></i><b></b></div><div><i></i><b></b></div><div><i></i><b></b></div></div></div>`;
      case 'tools': return `<div class="sc-art-scene sc-scene-tools"><span class="sc-tools-formula">f(x) = x² + 1</span><div class="sc-tools-grid"><span>${icon('calculator',24)}</span><span>${icon('ruler',24)}</span><span>${icon('percent',24)}</span><span>${icon('code',24)}</span></div></div>`;
      case 'family': return `<div class="sc-art-scene sc-scene-family"><svg viewBox="0 0 270 160" aria-hidden="true"><path d="M135 27V64M63 91V69H206V91M63 91V122M135 69V122M206 91V122"/><circle cx="135" cy="23" r="17"/><circle cx="63" cy="128" r="17"/><circle cx="135" cy="128" r="17"/><circle cx="206" cy="128" r="17"/></svg></div>`;
      case 'health': return `<div class="sc-art-scene sc-scene-health"><span class="sc-health-disc"></span><svg viewBox="0 0 320 140" aria-hidden="true"><path d="M0 72H62L82 72L104 29L129 118L152 58L169 72H320"/></svg></div>`;
      case 'games': return `<div class="sc-art-scene sc-scene-games"><span class="sc-games-shape sc-games-shape-1"></span><span class="sc-games-shape sc-games-shape-2"></span><span class="sc-games-shape sc-games-shape-3"></span><span class="sc-games-shape sc-games-shape-4"></span><span class="sc-games-spark">✦</span></div>`;
      default: return `<span class="sc-art-scene">${icon('grid',60)}</span>`;
    }
  }

  function linkFor(service) {
    return service.url ? {url:service.url, attributes:'target="_blank" rel="noopener noreferrer"'} :
      {url:'#' + encodeURIComponent(service.route) + (service.param?'/'+encodeURIComponent(service.param):''),attributes:''};
  }

  function serviceRow(service, index) {
    const story = stories[service.id];
    if (!story) return '';
    const link = linkFor(service);
    const favorite = A.favorites().includes(service.id);
    const id = esc(service.id);
    const name = esc(service.name);
    return `<article class="sc-row sc-row--${id}" data-service-id="${id}">
      <div class="sc-visual">
        <a class="sc-visual-link" href="${esc(link.url)}" ${link.attributes} aria-label="${esc('Открыть: '+service.name)}">
          <span class="sc-visual-top"><span>AYYY / ${String(index+1).padStart(2,'0')}</span><span>${icon('arrow-right',17)}</span></span>
          ${art(service.id)}
          <span class="sc-visual-bottom"><span class="sc-visual-mark">${icon(service.icon,30)}</span><span class="sc-visual-word"><strong>${name}</strong><small>${esc(story.overline)}</small></span></span>
        </a>
      </div>
      <div class="sc-info">
        <div class="sc-info-head"><span class="sc-overline">${esc(story.eyebrow)}</span>
          <button type="button" class="sc-favorite favorite-btn ${favorite?'selected':''}" data-favorite="${id}" aria-pressed="${favorite}" aria-label="${favorite?'Убрать из избранного':'В избранное'}: ${name}" title="${favorite?'Убрать из избранного':'В избранное'}">${icon('star',18)}</button>
        </div>
        <div class="sc-copy"><h2>${name}</h2><p class="sc-lead">${esc(story.lead)}</p><p class="sc-detail">${esc(story.detail)}</p><p class="sc-how"><strong>Как работает.</strong> ${esc(story.how)}</p></div>
        <div class="sc-row-bottom"><div class="sc-features">${story.features.map(feature=>`<span>${esc(feature)}</span>`).join('')}</div>
          <div class="sc-actions"><span class="sc-connection ${story.connect?'sc-can-connect':''}" ${story.connect?`data-sc-connection="${id}"`:''}>${icon(story.connect?'link':'check',14)} <span>${esc(story.connect||story.status)}</span></span>
            <a class="sc-open" href="${esc(link.url)}" ${link.attributes}>${esc(story.action)} ${icon('arrow-right',17)}</a>
          </div></div>
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
      node.title='Привязка сохранена на этом устройстве. Текущая авторизация GitHub проверяется при открытии сервиса.';
    }));
  }

  A.register('directory',{
    title:'Все сервисы',
    render(){
      const count=A.services.filter(s=>stories[s.id]).length;
      const selection=groups.some(group=>group[0]===A.catalogCategory)?A.catalogCategory:'all';
      A.catalogCategory=selection;
      return `<div class="shore-page shore-directory sc-page">
        ${A.shoreChrome.navigation('directory')}
        <main class="sc-shell">
          <div class="sc-intro"><div><div class="sc-kicker"><span></span> КАТАЛОГ AYYY <span class="sc-kicker-dash">/</span> ${count} НАПРАВЛЕНИЙ</div>
            <h1>У каждого дела<br><em>свой инструмент.</em></h1>
            <p>Не набор одинаковых плиток, а небольшая коллекция разных по характеру сервисов. Откройте то, что нужно сейчас.</p>
          </div><div class="sc-intro-drawing" aria-hidden="true"><span class="sc-intro-circle"></span><span class="sc-intro-circle"></span><span class="sc-intro-circle"></span><span class="sc-intro-sun">✳</span><span class="sc-intro-caption">FIND YOUR WAY / AYYY</span></div></div>
          <div class="sc-toolbar"><label class="sc-search">${icon('search',20)}<input id="catalog-search" type="search" aria-label="Найти сервис" placeholder="Что хотите сделать? Название, задача или идея…" value="${esc(A.param||'')}" maxlength="150" autocomplete="off"><span id="sc-search-count">${count} сервисов</span></label>
          <div class="sc-categories" role="group" aria-label="Категории сервисов">${groups.map(([id,label])=>`<button type="button" data-category="${id}" class="${id===selection?'active':''}" aria-pressed="${id===selection}">${id==='favorites'?icon('star',14):''}${esc(label)}</button>`).join('')}</div></div>
          <div class="sc-list-top"><span id="catalog-count" aria-live="polite"></span><span class="sc-list-tip">${icon('star',13)} Отмечайте любимое</span></div>
          <div id="catalog-grid" class="sc-list"></div>
          <div class="sc-outro">${icon('lighthouse',23)} <div><strong>Ваш набор сервисов</strong><span>На главной можно закрепить до шести любимых направлений. Весь каталог всегда остаётся здесь.</span></div><a href="#home">На главную ${icon('arrow-right',16)}</a></div>
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
      const refresh=()=>{
        const list=visible();
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
        document.removeEventListener('ayyy:favorites',onFavorites);
        document.removeEventListener('visibilitychange',onVisibility);
      };
    }
  });
})();
