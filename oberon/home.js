/* The entry screen has no persistence or credentials; actions belong to app.js. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const drawings = {
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    diagonal:'<path d="M6 18 18 6M6 6h12v12"/>',
    plus:'<path d="M12 4v16M4 12h16"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/>',
    file:'<path d="M6 3h8l4 4v14H6Z M14 3v5h4M9 12h6M9 16h6"/>',
    branch:'<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10m0-4h5a7 7 0 0 0 7-6"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    moon:'<path d="M20.8 13.5A9 9 0 1 1 10.5 3a7 7 0 0 0 10.3 10.5Z"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
    github:'<path d="M9 19c-5 1-5-2-7-2M15 22v-4c0-1-.2-2-1-2 3-.5 6-1.5 6-6 0-1.3-.5-2.6-1.5-3.5.2-1 .2-2.5-.5-3.5-2 0-3.5 1-4 1a14 14 0 0 0-4 0C9 3.5 7.5 3 6 3c-.6 1-.7 2.5-.5 3.5A5 5 0 0 0 4 10c0 4.5 3 5.5 6 6-.7.5-1 1-1 2v4"/>',
    spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',
    warning:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17v.1"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[name] || drawings.file}</svg>`;
  function plural(number, words) { return `${number} ${words[number % 10 === 1 && number % 100 !== 11 ? 0 : number % 10 >= 2 && number % 10 <= 4 && (number % 100 < 12 || number % 100 > 14) ? 1 : 2]}`; }
  function date(value) {
    const d = new Date(value);
    return value && Number.isFinite(d.getTime()) ? d.toLocaleDateString('ru-RU', {day:'numeric', month:'short'}) : '';
  }
  function status(row) {
    if (row.kind === 'demo') return {label:'Локальный пример', kind:'demo'};
    if (row.error) return {label:'Нужно внимание', kind:'error'};
    if (row.dirty) return {label:'Есть локальные изменения', kind:'pending'};
    if (row.lastSync) return {label:'Проверено в GitHub · '+date(row.lastSync), kind:'synced'};
    return {label:'Репозиторий подключён', kind:'connected'};
  }
  function card(row, options) {
    const demo = row.kind === 'demo', state = status(row), busy = options.busyId === row.id;
    const notes = Math.max(0, Number(row.noteCount) || 0), folders = Math.max(0, Number(row.folderCount) || 0);
    const repository = row.connection ? `${row.connection.owner}/${row.connection.repo}` : '';
    return `<article class="ob-home-card${demo ? ' ob-home-card-demo' : ''}${busy ? ' ob-home-card-busy' : ''}">
      <button class="ob-home-card-manage" type="button" data-ob-home-action="manage" data-ob-vault="${escape(row.id)}" title="${demo ? 'Настройки демо' : 'Настройки подключения'}" aria-label="${escape((demo ? 'Настройки демо' : 'Настройки подключения')+': '+row.name)}"${busy ? ' disabled' : ''}>${icon('more')}</button>
      <button class="ob-home-card-open" type="button" data-ob-home-action="open" data-ob-vault="${escape(row.id)}"${options.loading || options.busyId ? ' disabled' : ''} aria-label="${escape('Открыть '+(demo ? 'демонстрационное пространство' : row.name))}">
        <span class="ob-home-card-top"><span class="ob-home-card-symbol">${icon(demo ? 'spark' : 'github')}</span><span class="ob-home-card-label">${demo ? 'ДЕМО' : 'GITHUB / OBERON'}</span></span>
        <span class="ob-home-card-title">${escape(demo ? 'Первая орбита' : row.name)}</span>
        <span class="ob-home-card-description">${demo ? 'Небольшая вселенная идей, заметок и связей. Можно всё попробовать.' : escape(repository)}</span>
        <span class="ob-home-card-details"><span>${icon('file')}${plural(notes,['заметка','заметки','заметок'])}</span><span>${icon('folder')}${plural(folders,['папка','папки','папок'])}</span>${demo ? '' : `<span class="ob-home-branch" title="${escape(row.connection?.branch || '')}">${icon('branch')}${escape(row.connection?.branch || '')}</span>`}</span>
        <span class="ob-home-card-divider"></span>
        <span class="ob-home-card-bottom"><span class="ob-home-card-status ob-home-state-${state.kind}" title="${escape(row.error || '')}"><i></i>${escape(busy ? 'Открываю пространство…' : state.label)}</span><span class="ob-home-open-arrow">${icon('arrow')}</span></span>
      </button>
      ${demo ? '<span class="ob-home-demo-orbit" aria-hidden="true"></span>' : `<span class="ob-home-card-visibility" title="${row.connection?.private ? 'Приватный репозиторий' : 'Публичный репозиторий'}">${icon(row.connection?.private ? 'lock' : 'globe')}</span>`}
    </article>`;
  }
  function mount(element, callbacks = {}) {
    if (!element || typeof element.replaceChildren !== 'function') throw Error('Не найден экран пространств OBERON.');
    element.classList.add('oberon-home');
    element.setAttribute('aria-label', 'Пространства заметок OBERON');
    let currentRows = [], currentOptions = {};
    const onClick = event => {
      const button = event.target.closest('[data-ob-home-action]');
      if (!button || !element.contains(button) || button.disabled) return;
      const action = button.dataset.obHomeAction, id = button.dataset.obVault;
      if (action === 'open') callbacks.onOpen?.(id);
      else if (action === 'manage') callbacks.onManage?.(id);
      else if (action === 'connect') callbacks.onConnect?.();
      else if (action === 'theme') callbacks.onTheme?.();
      else if (action === 'top') element.scrollTo({top:0,behavior:'smooth'});
    };
    element.addEventListener('click', onClick);
    function render(rows = currentRows, options = {}) {
      currentRows = Array.isArray(rows) ? rows : [];
      currentOptions = options;
      // The registry guarantees a single demo; deduping here also avoids duplicate cards during refresh.
      const unique = [...new Map(currentRows.map(row => [row.id, row])).values()];
      const ordered = [...unique.filter(row => row.kind === 'demo'), ...unique.filter(row => row.kind !== 'demo')];
      const count = ordered.filter(row => row.kind === 'github').length;
      const loading = !!options.loading;
      element.setAttribute('aria-busy', String(loading));
      element.innerHTML = `<header class="ob-home-header"><div class="ob-home-header-inner">
        <button class="ob-home-brand" type="button" data-ob-home-action="top" aria-label="OBERON — список пространств"><img src="./oberon-mark.svg" width="48" height="48" alt=""><span><strong>OBERON<span>.</span></strong><small>пространство для мыслей</small></span></button>
        <div class="ob-home-header-right"><span class="ob-home-header-caption">ВАША ЛИЧНАЯ ОРБИТА</span><button class="ob-home-theme" type="button" data-ob-home-action="theme" title="Переключить тему" aria-label="Переключить тему">${icon('moon')}</button><span class="ob-home-header-divider"></span><a class="ob-home-ayyy" href="../#home" target="_top" aria-label="AYYY — на главную портала">ayyy<span>.</span></a></div>
      </div></header>
      <section class="ob-home-hero"><div class="ob-home-hero-inner"><div class="ob-home-hero-copy"><p class="ob-home-eyebrow"><span></span>ЗАМЕТКИ · MARKDOWN · GITHUB</p><h1>Мыслям нужно<br><em>своё пространство.</em></h1><p class="ob-home-intro">Собирайте идеи, находите связи и возвращайтесь<br class="ob-home-desktop-break"> к главному. Ваши заметки — в вашей орбите.</p><div class="ob-home-path"><span>ВАШ РЕПОЗИТОРИЙ</span><b>/</b><code>OBERON</code><span class="ob-home-path-line"></span></div></div><div class="ob-home-planet" aria-hidden="true"><span class="ob-home-planet-orbit"></span><span class="ob-home-planet-axis"></span><img src="./oberon-mark.svg" width="278" height="278" alt=""><span class="ob-home-planet-label">OBERON<span>01 / PERSONAL SPACE</span></span><span class="ob-home-star ob-home-star-one">+</span><span class="ob-home-star ob-home-star-two">+</span></div></div></section>
      <main class="ob-home-main"><div class="ob-home-section-head"><div><p class="ob-home-eyebrow">БЛИЗКОЕ И ВАЖНОЕ</p><h2>Ваши пространства<span class="ob-home-vault-count">${ordered.length}</span></h2><p>${count ? `${plural(count,['подключённый репозиторий','подключённых репозитория','подключённых репозиториев'])} и демо для экспериментов.` : 'Начните с демо или подключите свой репозиторий.'}</p></div><div class="ob-home-connect-actions"><button class="ob-home-connect" type="button" data-ob-home-action="connect"${loading || options.busyId ? ' disabled' : ''}>${icon('plus')}Подключить репозиторий</button><a class="ob-home-help-link" href="../help/github/" target="_blank" rel="noopener noreferrer">Как подключить GitHub? ↗</a></div></div>
      ${options.error ? `<div class="ob-home-error" role="alert">${icon('warning')}<span>${escape(options.error)}</span></div>` : ''}
      <div class="ob-home-grid">${loading && !ordered.length ? '<div class="ob-home-loading" role="status"><span class="ob-home-loading-orbit"></span>Открываю ваши пространства…</div>' : ordered.map(row => card(row, options)).join('')}<button class="ob-home-add-card" type="button" data-ob-home-action="connect"${loading || options.busyId ? ' disabled' : ''}><span class="ob-home-add-symbol">${icon('plus')}</span><strong>Ещё одно пространство</strong><span>Подключите репозиторий GitHub.<br>Заметки будут жить в папке <code>OBERON</code>.</span><span class="ob-home-add-link">Добавить репозиторий${icon('diagonal')}</span></button></div>
      <div class="ob-home-footnote"><span class="ob-home-footnote-symbol">${icon('folder')}</span><p>Обычные папки. Обычные <code>.md</code> файлы.<br><span>Каждое пространство хранит свои заметки, вкладки и локальные изменения.</span></p><span class="ob-home-footnote-orbit" aria-hidden="true"></span></div></main>
      <footer class="ob-home-footer"><span>OBERON<span class="ob-home-footer-dot">·</span>У каждой мысли своя орбита.</span><a href="../#home" target="_top">Все сервисы AYYY${icon('diagonal')}</a></footer>`;
    }
    render([], {loading:true});
    return {render, destroy() {element.removeEventListener('click', onClick);element.replaceChildren();}, get options() {return currentOptions;}};
  }
  window.OberonHome = Object.freeze({mount});
})();
