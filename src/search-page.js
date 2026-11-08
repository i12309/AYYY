/* AYYY search: the same paper, ink and controls as the public home page. */
(() => {
  'use strict';
  const a=window.AYYY,e=a.escape;
  a.register('search',{title:'Поиск',render(){return `<div class="shore-page shore-search sp-app" id="search-page">
    ${a.shoreChrome.navigation('search')}
    <main class="sp-main" id="search-content">
      <div class="sp-content">
        <section class="sp-intro" aria-labelledby="search-heading">
          <h1 id="search-heading">Поиск</h1>
          <p class="sp-lead">Найдётся нужное направление.</p>
        </section>
        <section class="sp-workspace" aria-label="Поисковая система">
          <form class="sp-form" id="sp-search-form" autocomplete="off" role="search">
            <label class="sp-visually-hidden" for="search-query">Поисковый запрос</label>
            <div class="shore-search-box sp-search-box">
              ${a.icon('search',21)}
              <input id="search-query" name="query" value="${e(a.param)}" maxlength="500" placeholder="Что хочется найти?" spellcheck="false" aria-describedby="sp-hint">
              <button type="submit" class="shore-search-submit sp-search-submit" aria-label="Начать поиск" title="Искать (Enter)">Найти ${a.icon('arrow-right',16)}</button>
            </div>
          </form>
      <div class="sp-modes" id="sp-modes" role="group" aria-label="Тип поиска">
        <button type="button" class="sp-mode is-active" data-mode="web" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18"/></svg>Веб</button>
        <button type="button" class="sp-mode" data-mode="images" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="9" cy="9" r="1.4"/><path d="m4 18 6-6 4 4 3-3 4 5"/></svg>Картинки</button>
        <button type="button" class="sp-mode" data-mode="video" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8Z"/></svg>Видео</button>
        <button type="button" class="sp-mode" data-mode="maps" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2ZM9 3v15M15 6v15"/></svg>Карты</button>
        <button type="button" class="sp-mode" data-mode="wiki" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 5v15M20 5v15M4 20h16M8 8h8M8 12h8M8 16h5"/></svg>Знания</button>
        <button type="button" class="sp-mode" data-mode="code" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 6-6 6 6 6M16 6l6 6-6 6m-3-14-4 20"/></svg>Код</button>
      </div>

      <fieldset class="sp-providers" id="sp-providers">
        <legend class="sp-visually-hidden">Выберите поисковую систему</legend>
        <span class="sp-provider-caption" aria-hidden="true">Поисковик</span>
        <button type="button" class="sp-provider" data-provider="Google" aria-pressed="false"><span class="sp-provider-icon google">G</span><span>Google</span><span class="sp-provider-check" aria-hidden="true"></span></button>
        <button type="button" class="sp-provider is-active" data-provider="Яндекс" aria-pressed="true"><span class="sp-provider-icon yandex">Я</span><span>Яндекс</span><span class="sp-provider-check" aria-hidden="true"></span></button>
        <button type="button" class="sp-provider" data-provider="DuckDuckGo" aria-pressed="false"><span class="sp-provider-icon duck">D</span><span>DuckDuckGo</span><span class="sp-provider-check" aria-hidden="true"></span></button>
        <button type="button" class="sp-provider" data-provider="Bing" aria-pressed="false"><span class="sp-provider-icon bing">b</span><span>Bing</span><span class="sp-provider-check" aria-hidden="true"></span></button>
      </fieldset>

          <p id="sp-hint" class="sp-hint">${a.icon('external',14)}<span id="sp-hint-text">Результаты откроются в новой вкладке выбранного поисковика.</span></p>
          <div class="sp-content-grid">
            <section class="shore-widget sp-info-panel sp-history" aria-labelledby="sp-history-heading">
              <div class="sp-panel-heading">
                <h2 id="sp-history-heading">Недавно искали</h2>
                <button class="sp-icon-button" id="sp-clear-history" type="button" aria-label="Очистить историю поиска" title="Очистить историю">${a.icon('trash',17)}</button>
              </div>
              <div class="sp-history-list" id="sp-history-list"></div>
              <div class="sp-panel-footer"><span>На этом устройстве</span><span id="sp-history-count">0 / 10</span></div>
            </section>
            <section class="shore-widget sp-info-panel sp-alternatives" aria-labelledby="sp-help-heading">
              <div class="sp-panel-heading"><h2 id="sp-help-heading">Нужен другой подход?</h2></div>
              <p>Попросите помощника объяснить сложную тему или найдите инструмент в каталоге.</p>
              <div class="sp-panel-actions">
                <a class="sp-action sp-action-ai" href="#ai">${a.icon('sparkles',18)} Спросить ИИ</a>
                <a class="sp-action sp-action-directory" href="#directory">${a.icon('grid',17)} Сервисы ${a.icon('arrow-right',13)}</a>
              </div>
            </section>
          </div>
          <p class="sp-command-tip"><kbd>/</kbd> — начать поиск <span>·</span> <kbd>Enter</kbd> — найти</p>
        </section>
      </div>
    </main>
    ${a.shoreChrome.footer()}
  </div>`;},mount:mountSearch});
  function mountSearch(){
    const root=document.querySelector('#search-page');
    const query=root.querySelector('#search-query');
    const form=root.querySelector('#sp-search-form');
    const list=root.querySelector('#sp-history-list');
    const hints={web:'Результаты откроются в новой вкладке выбранного поисковика.',images:'Картинки откроются в Google Images.',video:'Видео откроются на YouTube.',maps:'Результаты откроются в Google Maps.',wiki:'Статьи откроются в Википедии.',code:'Код откроется в поиске GitHub.'};
    let type='web',provider=a.get('searchEngine','Google');
    if(!Object.hasOwn(a.searchProviders,provider))provider='Google';
    const history=()=>{const saved=a.get('recentSearches',[]);return Array.isArray(saved)?saved.filter(q=>typeof q==='string').slice(0,10):[];};
    function renderHistory(){
      const recent=history();
      list.innerHTML=recent.length?recent.slice(0,6).map((q,n)=>`<button type="button" class="sp-history-item" data-history-index="${n}">${a.icon('clock',20)}<span>${e(q)}</span>${a.icon('arrow-right',20)}</button>`).join(''):'<p class="sp-history-empty">Здесь появятся ваши запросы.<br>История хранится только в этом браузере.</p>';
      root.querySelector('#sp-history-count').textContent=`${recent.length} / 10`;
      root.querySelector('#sp-clear-history').disabled=!recent.length;
    }
    function update(){
      root.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===type;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});
      root.querySelectorAll('[data-provider]').forEach(b=>{const active=b.dataset.provider===provider;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));b.disabled=type!=='web';});
      root.querySelector('#sp-hint-text').textContent=hints[type];
    }
    function submit(event){event.preventDefault();a.performSearch(query.value,'web',provider,type);renderHistory();}
    function click(event){
      const target=event.target.closest('button,a');if(!target||!root.contains(target))return;
      if(target.dataset.mode&&Object.hasOwn(hints,target.dataset.mode)){type=target.dataset.mode;update();}
      if(target.dataset.provider&&!target.disabled&&Object.hasOwn(a.searchProviders,target.dataset.provider)){provider=target.dataset.provider;a.set('searchEngine',provider);update();}
      if(target.dataset.historyIndex!==undefined){query.value=history()[Number(target.dataset.historyIndex)]||'';query.focus();}
      if(target.id==='sp-clear-history'){a.set('recentSearches',[]);renderHistory();a.toast('История поиска очищена');}
      // The existing document handler opens portal dialogs; prevent only the link's navigation.
      if(target.dataset.action)event.preventDefault();
    }
    form.addEventListener('submit',submit);root.addEventListener('click',click);
    update();renderHistory();
    return ()=>{form.removeEventListener('submit',submit);root.removeEventListener('click',click);};
  }
})();
