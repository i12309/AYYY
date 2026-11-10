/* Portal page views. The Metrika SDK runs only in the sandboxed visit frame. */
(() => {
  'use strict';
  const origin = 'https://i12309.github.io';
  const base = origin + '/AYYY/';
  const frameUrl = base + 'assets/portal-visit-frame.html';
  const channel = 'ayyy:portal-visits';
  const titles = new Map([
    ['', 'Главная'], ['#directory', 'Все сервисы'], ['#search', 'Поиск'],
    ['#weather', 'Погода'], ['#finance', 'Рынки'], ['#ai', 'Нейронный терминал'],
    ['#mpp', 'Просмотр MPP'], ['#family', 'Семейное дерево'],
    ['#health', 'Здоровье'], ['family/help/', 'Справка GEN'], ['#games', 'Остров игр'],
    ['#games/works', 'Мои работы'], ['#games/coloring-gallery', 'Коллекция раскрасок'],
  ]);
  const tools = new Map([
    ['loan', 'Ипотека и кредит'], ['science', 'Инженерный калькулятор'],
    ['percent', 'Проценты'], ['converter', 'Конвертер'], ['dates', 'Даты'],
    ['password', 'Пароли'], ['json', 'JSON'], ['text', 'Текст'], ['color', 'Цвета'],
  ]);
  const games = new Map([
    ['arrows', 'Стрелки'], ['coloring', 'Раскраска по номерам'], ['forest-shop', 'Лесная лавка'],
    ['hexmerge', 'Гексаслияние'], ['logic-lab', 'Лаборатория логики'], ['mahjong', 'Маджонг'],
    ['marble-lab', 'Лаборатория шариков'], ['marble-shooter', 'Шарики'], ['maze', 'Лабиринт'],
    ['memory', 'Найди пару'], ['number-garden', 'Сад чисел'], ['nuts', 'Орехи'],
    ['reading-stories', 'Читаем истории'], ['robot-route', 'Маршрут робота'],
    ['shape-studio', 'Студия фигур'], ['story-post', 'Почта историй'],
    ['2048', '2048'], ['math', 'Математика'],
  ]);
  for (const [id, title] of tools) titles.set('#tools/' + id, title);
  for (const [id, title] of games) titles.set('#games/' + id, title);

  // The frame gets only public page keys. It has no access to the parent DOM,
  // origin storage, or the actual URL (which may contain a private parameter).
  if (location.origin === origin && origin + location.pathname === frameUrl) {
    if (window.parent === window) return;
    const id = 114172368;
    let started = false;
    window.addEventListener('message', ({ source, origin: sender, data }) => {
      if (source !== window.parent || sender !== origin || data?.channel !== channel ||
          !titles.has(data.page) || !(data.previous === null || titles.has(data.previous))) return;
      const url = base + data.page;
      const referrer = data.previous === null ? '' : base + data.previous;
      const title = titles.get(data.page) + ' · AYYY';
      if (!started) {
        started = true;
        document.title = title;
        window.ym = function () { (window.ym.a ||= []).push(arguments); };
        window.ym.l = Date.now();
        window.ym(id, 'init', {
          url, referrer, accurateTrackBounce: false,
          trackHash: false, webvisor: false, clickmap: false,
          trackLinks: false, ecommerce: false, childIframe: false, disableYtm: true,
        });
        const sdk = document.createElement('script');
        sdk.src = 'https://mc.yandex.ru/metrika/tag.js?id=' + id;
        sdk.async = true;
        document.head.append(sdk);
        return;
      }
      window.ym(id, 'hit', url, { title, referer: referrer });
    });
    window.parent.postMessage({ channel, ready: true }, origin);
    return;
  }

  if (window.top !== window || location.origin !== origin || !location.pathname.startsWith('/AYYY/')) return;
  const path = location.pathname.slice('/AYYY/'.length).replace(/(^|\/)index\.html$/, '$1');
  let last = null;
  let frame, ready = false;
  const pending = [];

  function visit(page) {
    if (!titles.has(page) || page === last) return;
    const message = { channel, page, previous: last };
    last = page;
    if (ready) {
      frame.contentWindow.postMessage(message, '*'); // sandboxed frames have an opaque origin
      return;
    }
    pending.push(message);
    if (frame) return;
    frame = document.createElement('iframe');
    frame.hidden = true;
    frame.title = 'Счётчик посещений AYYY';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.referrerPolicy = 'no-referrer';
    window.addEventListener('message', event => {
      if (ready || event.source !== frame.contentWindow || event.origin !== 'null' ||
          event.data?.channel !== channel || event.data.ready !== true) return;
      ready = true;
      for (const item of pending.splice(0)) frame.contentWindow.postMessage(item, '*');
    });
    frame.src = frameUrl;
    document.body.append(frame);
  }

  function route(name, param = '') {
    if (name === 'tools') return visit('#tools/' + (param === 'calc' ? 'science' : tools.has(param) ? param : 'loan'));
    if (name === 'games') {
      const [game, level] = param.split('@');
      if (game === 'works' || game === 'coloring' && level === 'workshop') return visit('#games/works');
      if (game === 'coloring' && (!level || level === 'gallery')) return visit('#games/coloring-gallery');
      return visit(games.has(game) ? '#games/' + game : '#games');
    }
    visit(name === 'home' ? '' : '#' + name);
  }

  if (!path) {
    window.AYYYVisits = { route };
    // The inline build may already have rendered before this deferred script.
    if (document.body.dataset.page && window.AYYY) route(window.AYYY.route, window.AYYY.param);
    return;
  }
  const standalone = new Map([
    ['weather/', '#weather'], ['health/', '#health'], ['family/', '#family'],
    ['family/help/', 'family/help/'], ['terminal/', '#ai'],
    ['games/runtime/works.html', '#games/works'],
    ['games/runtime/games/coloring/gallery.html', '#games/coloring-gallery'],
  ]);
  const game = /^games\/runtime\/games\/([a-z-]+)\/$/.exec(path)?.[1];
  if (game && games.has(game)) visit('#games/' + game);
  else if (standalone.has(path)) visit(standalone.get(path));
})();
