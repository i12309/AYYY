/* AYYY · Остров игр. A lazy route with isolated, local game documents. */
(function () {
  'use strict';
  const STORAGE = 'ayyy:v1:games.portal';
  const session = {shelf:'all',category:'all',query:'',sort:'featured',scroll:0};
  let volatileSaved = null;
  const paths = {
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    star:'<path d="m12 3 2.8 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8l-5.7 3.1 1.1-6.5-4.7-4.6 6.5-.9Z"/>',
    settings:'<path d="M6 3v6m0 4v8M12 3v11m0 4v3M18 3v2m0 4v12"/><path d="M3 9h6v4H3zM9 14h6v4H9zM15 5h6v4h-6z"/>',
    shuffle:'<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6m3-5c1-1 2-1 3-1h3m-4-4 4 4-4 4"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
    works:'<path d="M3 8h18v12H3ZM2 4h20v4H2ZM9 12h6"/>',
    resume:'<path d="m9 6 10 6-10 6Z"/><path d="M5 6v12"/>'
  };
  const icon=(name,filled=false)=>'<svg viewBox="0 0 24 24" fill="'+(filled?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.star)+'</svg>';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value).toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
  function plural(n){return n+' '+(n%10===1&&n%100!==11?'игра':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'игры':'игр');}
  function readSaved(){
    try {const value=JSON.parse(localStorage.getItem(STORAGE)||'null');if(value&&typeof value==='object'&&!Array.isArray(value)){volatileSaved=value;return value;}} catch (_) {}
    return volatileSaved||{};
  }
  function mount(host,options={}) {
    const app=options.app||window.AYYY;
    const base=new URL(options.base||'games/',document.baseURI);
    const runtimeBase=new URL('runtime/',base);
    const games=window.AYYYGamesCatalog||[];
    const byId=new Map(games.map(g=>[g.id,g]));
    const art=id=>window.AYYYGamesArt?.render(id)||'';
    const saved=readSaved();
    const state={...session,favorites:new Set((Array.isArray(saved.favorites)?saved.favorites:[]).filter(id=>byId.has(id))),palette:saved.palette==='sand'?'sand':'paper',quiet:saved.quiet===true,last:saved.last&&typeof saved.last==='object'?saved.last:null};
    const events=new AbortController();
    const on=(element,event,fn,opts={})=>element.addEventListener(event,fn,{...opts,signal:events.signal});
    let destroyed=false,toastTimer=0,loadingTimer=0,legacyCleanup=null,frame=null,current=null,currentPath='',loadedDocumentPath='',ready=false,scrollTask=0;
    host.classList.add('gp-root');
    const $=selector=>host.querySelector(selector);
    const $$=selector=>Array.from(host.querySelectorAll(selector));
    const learnCount=games.filter(g=>g.learn).length;
    host.innerHTML=`
      <header class="gp-header">
        <a class="gp-brand" href="#home" aria-label="AYYY, главная">ayyy<span>.</span></a><span class="gp-brand-note">всегда есть место для игры</span>
        <nav class="gp-nav" aria-label="Разделы AYYY"><a href="#home">Главная</a><a href="#weather">Погода</a><a href="#games" aria-current="page">Игры</a><a class="gp-services" href="#directory">Все сервисы <span aria-hidden="true">↗</span></a></nav>
        <button class="gp-icon gp-settings-trigger" type="button" data-gp-action="settings" aria-label="Оформление игр" aria-haspopup="dialog" aria-expanded="false">${icon('settings')}</button>
        <section class="gp-settings" role="dialog" aria-label="Оформление игр" hidden><div class="gp-popover-head"><strong>Настроение страницы</strong><button class="gp-icon gp-close" type="button" data-gp-action="close-settings" aria-label="Закрыть настройки">×</button></div><div class="gp-palette"><button type="button" data-gp-palette="paper"><i class="gp-swatch gp-swatch-paper"></i>Белая бумага</button><button type="button" data-gp-palette="sand"><i class="gp-swatch gp-swatch-sand"></i>Тёплый песок</button></div><label class="gp-motion"><input type="checkbox" data-gp-motion>Тихий режим — без анимации</label><p>Настройки сохраняются на этом устройстве.</p></section>
      </header>
      <aside class="gp-island" aria-label="Остров игр"><img class="gp-island-art" src="${esc(new URL('assets/island.webp',base).href)}" width="1024" height="1536" alt="Акварельный остров с обсерваторией, шахматной террасой и дорожкой для шариков." decoding="async"><button type="button" class="gp-pin gp-pin-create" data-gp-world="creative"><i></i>Придумывать</button><button type="button" class="gp-pin gp-pin-think" data-gp-world="logic"><i></i>Разгадывать</button><div class="gp-world-caption"><span aria-hidden="true">✧</span>Остров игр<small>У любопытства нет возраста</small></div></aside>
      <div class="gp-main" tabindex="-1">
        <section class="gp-catalog" aria-label="Каталог игр">
          <div class="gp-intro"><div class="gp-eyebrow"><i></i>ВАШ МАЛЕНЬКИЙ ПЕРЕРЫВ</div><h1>Немного игры. <em>Много открытий.</em></h1><p>Разгадать, придумать, научиться новому. Или просто хорошо провести время.</p><div class="gp-seal" aria-hidden="true"><svg viewBox="0 0 96 96"><circle cx="48" cy="48" r="43" fill="none" stroke="currentColor" stroke-dasharray="2 4"/><path d="M48 17v16m0 30v16M17 48h16m30 0h16M26 26l11 11m22 22 11 11M26 70l11-11m22-22 11-11" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M48 34l4 10 11 4-11 4-4 11-4-11-11-4 11-4Z" fill="currentColor" opacity=".7"/></svg><span>без спешки</span></div></div>
          <div class="gp-resume" hidden></div>
          <div class="gp-tools"><div class="gp-search-row"><label class="gp-search">${icon('search')}<input type="search" data-gp-search placeholder="Какая игра вам по настроению?" aria-label="Найти игру" autocomplete="off"><kbd aria-hidden="true">/</kbd></label><button class="gp-random" type="button" data-gp-action="random" aria-label="Выбрать случайную игру">${icon('shuffle')}<span>Удиви меня</span></button></div>
            <div class="gp-shelves" role="group" aria-label="Подборка игр"><button class="gp-shelf" type="button" data-gp-shelf="all">Все игры <span>${games.length}</span></button><button class="gp-shelf" type="button" data-gp-shelf="learn">Учимся играя <span>${learnCount}</span></button><button class="gp-shelf" type="button" data-gp-shelf="rest">Для отдыха <span>${games.length-learnCount}</span></button><button class="gp-shelf gp-favorites" type="button" data-gp-shelf="favorites">${icon('star')}Избранное <span class="gp-favorite-count">0</span></button></div>
            <div class="gp-filter-row"><div class="gp-categories" role="group" aria-label="Категория">${[['all','Всё'],['logic','Логика'],['attention','Внимание'],['creative','Творчество'],['numbers','Счёт и чтение'],['arcade','Аркады']].map(([id,name])=>`<button type="button" data-gp-category="${id}">${name}</button>`).join('')}</div><label class="gp-sort"><span class="gp-sr">Порядок игр</span><select data-gp-sort><option value="featured">Рекомендуем</option><option value="az">По алфавиту</option></select></label></div>
          </div>
          <div class="gp-caption"><span class="gp-results" role="status" aria-live="polite"></span><button type="button" data-gp-open="works">${icon('works')}Мои работы</button></div>
          <div class="gp-grid"></div><div class="gp-empty" hidden><span aria-hidden="true">✧</span><h2>Пока ничего не нашлось</h2><p>Попробуйте другое название или снимите фильтры.</p><button type="button" class="gp-primary" data-gp-action="clear">Показать все игры</button></div>
        </section>
        <section class="gp-play" hidden aria-label="Игра"><div class="gp-play-top"><button type="button" class="gp-back" data-gp-action="catalog">${icon('arrow')}Каталог игр</button><span class="gp-local-note"><i></i>Играем на этом устройстве</span></div><div class="gp-play-head"><div><div class="gp-eyebrow gp-play-category"></div><h1 class="gp-play-title"></h1><p class="gp-play-description"></p></div><div class="gp-play-tools"><button class="gp-details-btn" type="button" data-gp-action="details">Об игре и уровни</button><button class="gp-icon" type="button" data-gp-action="play-favorite" aria-label="Добавить игру в избранное" aria-pressed="false">${icon('star')}</button><button class="gp-icon" type="button" data-gp-action="expand" aria-label="Развернуть игру" aria-pressed="false">${icon('expand')}</button></div></div><div class="gp-play-paper"><div class="gp-frame-loading" role="status" hidden><strong>Готовим игру…</strong><p>Ещё мгновение — и можно начинать.</p></div><div class="gp-game-host"></div></div><div class="gp-play-foot"><span>Маленькие шаги тоже ведут к большим открытиям.</span><button type="button" data-gp-open="works">Мои работы</button></div></section>
        <footer class="gp-footer"><span>ayyy<i>.</i><small>Время, проведённое с удовольствием.</small></span><button type="button" data-gp-action="about">Сделано для любопытных <span aria-hidden="true">✧</span></button></footer>
      </div>
      <dialog class="gp-dialog" aria-labelledby="gp-dialog-title"><button class="gp-icon gp-dialog-close" type="button" data-gp-action="close-dialog" aria-label="Закрыть окно">×</button><div class="gp-dialog-content"></div></dialog>
      <div class="gp-toast" role="status" aria-live="polite" hidden></div>`;

    function persist(){
      const value={favorites:Array.from(state.favorites),palette:state.palette,quiet:state.quiet,last:state.last};
      volatileSaved=value;
      try {localStorage.setItem(STORAGE,JSON.stringify(value));} catch (_) { /* Keep this session usable when storage is unavailable. */ }
    }
    function announce(message){
      clearTimeout(toastTimer);$('.gp-toast').textContent=message;$('.gp-toast').hidden=false;
      toastTimer=setTimeout(()=>{if(!destroyed)$('.gp-toast').hidden=true;},2800);
    }
    function postSettings(){if(frame?.contentWindow)frame.contentWindow.postMessage({type:'ayyy-games:settings',palette:state.palette,quiet:state.quiet},location.origin);}
    function applySettings(){
      host.dataset.palette=state.palette;host.dataset.quiet=String(state.quiet);
      $$('[data-gp-palette]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.gpPalette===state.palette)));
      $('[data-gp-motion]').checked=state.quiet;postSettings();
    }
    function rememberFilters(){Object.assign(session,{shelf:state.shelf,category:state.category,query:state.query,sort:state.sort});}
    function filtered(){
      const query=normalize(state.query);
      return games.filter(g=>(state.shelf==='all'||state.shelf==='learn'&&g.learn||state.shelf==='rest'&&!g.learn||state.shelf==='favorites'&&state.favorites.has(g.id))&&(state.category==='all'||g.categoryKeys.includes(state.category))&&(!query||normalize(g.title+' '+g.short+' '+g.description+' '+g.category).includes(query))).sort((a,b)=>state.sort==='az'?a.title.localeCompare(b.title,'ru'):games.indexOf(a)-games.indexOf(b));
    }
    function updateFavorites(){
      $('.gp-favorite-count').textContent=state.favorites.size;
      $$('[data-gp-favorite]').forEach(button=>{const id=button.dataset.gpFavorite,on=state.favorites.has(id);button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',(on?'Убрать из избранного: ':'В избранное: ')+byId.get(id).title);button.innerHTML=icon('star',on);});
      const playButton=$('[data-gp-action="play-favorite"]');playButton.hidden=!byId.has(current?.id);
      if(current&&byId.has(current.id)){const on=state.favorites.has(current.id);playButton.innerHTML=icon('star',on);playButton.setAttribute('aria-pressed',String(on));playButton.setAttribute('aria-label',on?'Убрать игру из избранного':'Добавить игру в избранное');}
    }
    function toggleFavorite(id){if(!byId.has(id))return;if(state.favorites.has(id))state.favorites.delete(id);else state.favorites.add(id);persist();updateFavorites();if(!current&&state.shelf==='favorites')renderCatalog();announce(state.favorites.has(id)?'Игра добавлена в избранное':'Игра убрана из избранного');}
    function card(g){return `<article class="gp-card${g.featured?' gp-featured':''}" data-gp-card="${g.id}" style="--gp-tint:${g.tint}"><button type="button" class="gp-card-main" data-gp-open="${g.id}" aria-label="Играть: ${esc(g.title)}"><div class="gp-card-visual">${art(g.id)}<span class="gp-badge">${g.featured?'<i></i>':''}${esc(g.id==='coloring'?'48 рисунков':g.category)}</span></div><div class="gp-card-text"><h2>${esc(g.title)}</h2><p>${esc(g.short)}</p></div></button><button type="button" class="gp-card-favorite" data-gp-favorite="${g.id}" aria-label="В избранное: ${esc(g.title)}" aria-pressed="${state.favorites.has(g.id)}">${icon('star',state.favorites.has(g.id))}</button><div class="gp-card-bottom"><span class="gp-meta">${icon('clock')}${esc(g.minutes)}</span><button type="button" class="gp-more" data-gp-details="${g.id}" aria-label="Об игре и уровни: ${esc(g.title)}"><span>${g.levels.length?'Уровни':'Об игре'}</span>${icon('arrow')}</button></div></article>`;}
    function renderResume(){
      const resume=$('.gp-resume'),last=state.last,g=last&&byId.get(last.id);
      if(!g){resume.hidden=true;return;}
      resume.hidden=false;resume.innerHTML=icon('resume')+'<div><strong>'+esc(g.title)+'</strong><small>'+esc(typeof last.label==='string'?last.label.slice(0,120):'Вы недавно играли')+'</small></div><button type="button" data-gp-action="resume">Вернуться <span aria-hidden="true">→</span></button>';
    }
    function renderCatalog(){
      const list=filtered();$('.gp-grid').innerHTML=list.map(card).join('');$('.gp-empty').hidden=list.length>0;
      $('.gp-results').textContent=plural(list.length)+(state.shelf==='all'&&state.category==='all'&&!state.query?' для любопытных':' в подборке');
      $$('.gp-shelf').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gpShelf===state.shelf)));
      $$('[data-gp-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gpCategory===state.category)));
      if(state.shelf==='favorites'&&!list.length){$('.gp-empty h2').textContent=state.favorites.size?'Ничего с такими фильтрами':'Самые любимые — будут здесь';$('.gp-empty p').textContent=state.favorites.size?'Снимите фильтры или попробуйте другое название.':'Нажмите звёздочку на карточке игры, чтобы сохранить её в этой подборке.';}else{$('.gp-empty h2').textContent='Пока ничего не нашлось';$('.gp-empty p').textContent='Попробуйте другое название или снимите фильтры.';}
      updateFavorites();renderResume();rememberFilters();
    }
    function closeSettings(focus=false){if($('.gp-settings').hidden)return;$('.gp-settings').hidden=true;$('.gp-settings-trigger').setAttribute('aria-expanded','false');if(focus)$('.gp-settings-trigger').focus();}
    function dialog(content){closeSettings();$('.gp-dialog-content').innerHTML=content;if(!$('.gp-dialog').open)$('.gp-dialog').showModal();}
    function showDetails(id){
      const g=byId.get(id);if(!g)return;
      dialog(`<div class="gp-dialog-art" style="--gp-tint:${g.tint}">${art(g.id)}</div><div class="gp-dialog-body"><div class="gp-eyebrow">${esc(g.category)}</div><h2 id="gp-dialog-title">${esc(g.title)}</h2><p>${esc(g.description)}</p><div class="gp-dialog-chips"><span>${esc(g.difficulty)}</span><span>${esc(g.minutes)} · ориентир</span><span>Внутри AYYY</span></div>${g.levels.length?`<h3>С чего начнём?</h3><div class="gp-levels">${g.levels.map((level,i)=>`<button type="button" class="gp-level" data-gp-open="${g.id}" data-gp-level="${esc(level.id)}"><span>${String(i+1).padStart(2,'0')}</span><span><strong>${esc(level.title)}</strong><small>${esc(level.detail)}</small></span>${icon('arrow')}</button>`).join('')}</div>`:''}<div class="gp-dialog-actions"><button type="button" class="gp-primary" data-gp-open="${g.id}">Играть ${icon('arrow')}</button>${['coloring','shape-studio','marble-lab'].includes(g.id)?`<button type="button" class="gp-secondary" data-gp-open="works">Мои работы ${icon('works')}</button>`:''}</div><p class="gp-dialog-notice">Игра работает в вашем браузере. Настройки и сохранения остаются на этом устройстве.</p></div>`);
    }
    function showAbout(){dialog(`<div class="gp-dialog-body"><div class="gp-eyebrow">AYYY · ОСТРОВ ИГР</div><h2 id="gp-dialog-title">У любопытства<br>нет возраста.</h2><p class="gp-about-lead">Место для маленького перерыва и больших открытий.</p><p>18 игр живут внутри AYYY: головоломки, рисование, чтение, счёт и собственные мастерские. Выбирайте настроение, сохраняйте любимые игры и возвращайтесь к своим работам.</p><p class="gp-dialog-notice">Избранное и настройки сохраняются в этом браузере. Прогресс хранит сама игра. В «Моих работах» можно сохранять рисунки и конструкции, скачивать их в JSON и открывать снова.</p><div class="gp-dialog-actions"><button class="gp-primary" type="button" data-gp-action="close-dialog">Пойдём играть ${icon('arrow')}</button><button class="gp-secondary" type="button" data-gp-open="works">Мои работы ${icon('works')}</button></div></div>`);}
    function safePath(value){
      if(typeof value!=='string'||value.length>1200)return null;
      try {const url=new URL(value,document.baseURI);if(url.origin!==runtimeBase.origin||url.username||url.password||!url.pathname.startsWith(runtimeBase.pathname))return null;const relative=url.pathname.slice(runtimeBase.pathname.length);if(relative==='works.html')return url;const match=/^games\/([a-z-]+)\/(index|gallery)\.html$/.exec(relative);if(!match||!byId.has(match[1])||byId.get(match[1]).legacy||match[2]==='gallery'&&match[1]!=='coloring')return null;return url;}catch(_){return null;}
    }
    function gamePath(id,level){
      if(id==='works'||id==='coloring'&&level==='workshop')return new URL('works.html',runtimeBase);
      const g=byId.get(id);if(!g||g.legacy)return null;
      const picked=level??g.defaultLevel;
      if(id==='coloring'&&picked==='gallery')return new URL('games/coloring/gallery.html',runtimeBase);
      const url=new URL('games/'+id+'/index.html',runtimeBase);
      if(picked&&picked!=='photo'){if(picked.startsWith('work:'))url.searchParams.set('work',picked.slice(5));else url.searchParams.set('level',picked);}
      return url;
    }
    function paramFromPath(url){
      const path=url.pathname.slice(runtimeBase.pathname.length);
      if(path==='works.html')return 'works';
      const match=/^games\/([a-z-]+)\/(index|gallery)\.html$/.exec(path);
      if(!match)return '';
      const level=match[2]==='gallery'?'gallery':url.searchParams.has('work')?'work:'+url.searchParams.get('work'):url.searchParams.get('level')||'';
      return match[1]+(level?'@'+level:'');
    }
    function navigateGame(id,level){
      if(!byId.has(id)&&id!=='works')return;
      if(!current){session.scroll=window.scrollY;rememberFilters();}
      closeSettings();if($('.gp-dialog').open)$('.gp-dialog').close();
      app.navigate('games',id+(level?'@'+level:''));
    }
    function setHeading(g){
      current=g;$('.gp-play-category').textContent=g.category+' · ОСТРОВ ИГР';$('.gp-play-title').textContent=g.title;$('.gp-play-description').textContent=g.short;
      if(frame)frame.title=g.title;
      $('[data-gp-action="details"]').hidden=!byId.has(g.id);$('.gp-play-foot>[data-gp-open="works"]').hidden=g.id==='works';
      document.title=g.title+' · AYYY';updateFavorites();
    }
    function rememberPath(url,label){
      const param=paramFromPath(url),id=param.split('@')[0],g=byId.get(id);
      currentPath=url.href;
      if(g){
        setHeading(g);const prior=state.last?.id===id?state.last:{};
        state.last={id,param,path:url.pathname+url.search,label:label||prior.label||'Вы недавно играли',at:Date.now()};persist();
      }else if(id==='works')setHeading({id:'works',category:'Мастерская',title:'Мои работы',short:'Рисунки, фигуры и трассы, придуманные вами.'});
      if(param){const hash='#games/'+encodeURIComponent(param);if(location.hash!==hash)history.replaceState(history.state,'',location.pathname+location.search+hash);app.param=param;}
    }
    function resizeFrame(value){if(!frame||!Number.isFinite(value)||value<0)return;frame.style.height=Math.round(Math.min(24000,Math.max(360,value)))+'px';}
    function frameReady(data){
      const url=safePath(data.path);if(!url)return;
      // A gallery/shelf link replaces the iframe document while this route stays
      // mounted. Do not carry a long gallery's parent scroll into a short game.
      const changedDocument=loadedDocumentPath!==url.href;
      loadedDocumentPath=url.href;
      ready=true;clearTimeout(loadingTimer);$('.gp-frame-loading').hidden=true;if(frame){frame.hidden=false;frame.style.visibility='visible';frame.removeAttribute('aria-hidden');frame.removeAttribute('tabindex');}
      rememberPath(url);resizeFrame(data.height);postSettings();
      if(changedDocument){cancelAnimationFrame(scrollTask);scrollTask=requestAnimationFrame(()=>{if(!destroyed)window.scrollTo({top:0,behavior:'instant'});});}
    }
    function showLoadError(){
      if(destroyed||ready)return;
      if(frame)frame.hidden=true;
      $('.gp-frame-loading').hidden=false;
      $('.gp-frame-loading').innerHTML='<strong>Игра пока не открылась</strong><p>Попробуйте загрузить её ещё раз. Ваши сохранения остаются в браузере.</p><div class="gp-loading-actions"><button type="button" class="gp-primary" data-gp-action="retry">Повторить</button><a class="gp-secondary" href="'+esc(currentPath)+'" target="_blank" rel="noopener">Открыть отдельно ↗</a></div>';
    }
    function openFrame(url){
      const stage=$('.gp-game-host');ready=false;currentPath=url.href;
      $('.gp-frame-loading').hidden=false;$('.gp-frame-loading').innerHTML='<strong>Готовим игру…</strong><p>Ещё мгновение — и можно начинать.</p>';
      if(frame)frame.remove();frame=document.createElement('iframe');frame.className='gp-game-frame';frame.title=current?.title||'Игра AYYY';frame.style.visibility='hidden';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
      frame.setAttribute('allow','fullscreen');frame.src=url.href;frame.loading='eager';stage.replaceChildren(frame);
      on(frame,'error',showLoadError);on(frame,'load',()=>{
        // Detect a missing document even after navigation from a gallery or shelf.
        try {if(frame?.contentDocument?.documentElement.dataset.ayyyEmbedded!=='true'){ready=false;showLoadError();return;}}catch(_){ready=false;showLoadError();return;}
        postSettings();
      });clearTimeout(loadingTimer);loadingTimer=setTimeout(showLoadError,14000);
    }
    function showPlay(id,level){
      const g=id==='works'||id==='coloring'&&level==='workshop'?{id:'works',category:'Мастерская',title:'Мои работы',short:'Рисунки, фигуры и трассы, придуманные вами.'}:byId.get(id);
      if(!g)return false;
      host.dataset.mode='play';host.dataset.wide='false';$('.gp-catalog').hidden=true;$('.gp-play').hidden=false;setHeading(g);
      if(g.legacy){
        const legacy=options.legacyGames||app.legacyGames;
        try {if(!legacy)throw new Error('Legacy games are unavailable');$('.gp-game-host').innerHTML=legacy.render(id);legacyCleanup=legacy.mount(id,$('.gp-game-host'));state.last={id,param:id,label:'Вы недавно играли',at:Date.now()};persist();}catch(error){$('.gp-game-host').innerHTML='<div class="gp-frame-loading"><strong>Не удалось открыть игру</strong><p>Вернитесь в каталог и попробуйте ещё раз.</p></div>';console.error('AYYY legacy game failed',error);}
      }else{const url=gamePath(id,level);if(url)openFrame(url);}
      return true;
    }
    function clearFilters(){state.shelf='all';state.category='all';state.query='';state.sort='featured';$('[data-gp-search]').value='';$('[data-gp-sort]').value='featured';renderCatalog();}
    on(host,'input',event=>{if(event.target.matches('[data-gp-search]')){state.query=event.target.value;renderCatalog();}});
    on(host,'change',event=>{if(event.target.matches('[data-gp-sort]')){state.sort=event.target.value==='az'?'az':'featured';renderCatalog();}else if(event.target.matches('[data-gp-motion]')){state.quiet=event.target.checked;applySettings();persist();}});
    on(host,'click',event=>{
      const button=event.target.closest('button');
      if(button&&host.contains(button)){
        if(button.dataset.gpOpen)navigateGame(button.dataset.gpOpen,button.dataset.gpLevel);
        else if(button.dataset.gpDetails)showDetails(button.dataset.gpDetails);
        else if(button.dataset.gpFavorite)toggleFavorite(button.dataset.gpFavorite);
        else if(button.dataset.gpShelf){state.shelf=button.dataset.gpShelf;state.category='all';renderCatalog();}
        else if(button.dataset.gpCategory){state.category=button.dataset.gpCategory;renderCatalog();}
        else if(button.dataset.gpWorld){if(current){state.category=button.dataset.gpWorld;rememberFilters();app.navigate('games');}else{state.shelf='all';state.category=button.dataset.gpWorld;state.query='';$('[data-gp-search]').value='';renderCatalog();$('.gp-tools').scrollIntoView({behavior:state.quiet?'instant':'smooth',block:'start'});}}
        else if(button.dataset.gpPalette){state.palette=button.dataset.gpPalette==='sand'?'sand':'paper';applySettings();persist();}
        else switch(button.dataset.gpAction){
          case 'settings':{const opening=$('.gp-settings').hidden;$('.gp-settings').hidden=!opening;button.setAttribute('aria-expanded',String(opening));if(opening)$('[data-gp-palette]').focus();break;}
          case 'close-settings':closeSettings(true);break;
          case 'clear':clearFilters();break;
          case 'random':{const selected=filtered(),pool=selected.length?selected:games;const g=pool[Math.floor(Math.random()*pool.length)];if(g)navigateGame(g.id);break;}
          case 'catalog':app.navigate('games');break;
          case 'about':showAbout();break;
          case 'details':if(current)showDetails(current.id);break;
          case 'play-favorite':if(current)toggleFavorite(current.id);break;
          case 'close-dialog':$('.gp-dialog').close();break;
          case 'expand':{const wide=host.dataset.wide!=='true';host.dataset.wide=String(wide);button.setAttribute('aria-pressed',String(wide));button.setAttribute('aria-label',wide?'Вернуть обычный размер':'Развернуть игру');if(wide)announce('Больше места для игры. Esc — обычный размер.');break;}
          case 'retry':{const url=safePath(currentPath);if(url)openFrame(url);break;}
          case 'resume':{const last=state.last;if(last&&byId.has(last.id)){const url=safePath(last.path);const param=url?paramFromPath(url):last.id;app.navigate('games',param);}break;}
        }
      }
      if(!event.target.closest('.gp-settings,.gp-settings-trigger'))closeSettings();
      if(event.target===$('.gp-dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}
    });
    on(document,'pointerdown',event=>{if(!host.contains(event.target))closeSettings();});
    on(host,'keydown',event=>{
      if(event.key==='Escape'){
        if($('.gp-dialog').open)return;
        if(!$('.gp-settings').hidden){event.preventDefault();closeSettings(true);return;}
        if(host.dataset.wide==='true'){event.preventDefault();$('[data-gp-action="expand"]').click();}
      }
      if(event.key==='/'&&!current&&!$('.gp-dialog').open&&!event.ctrlKey&&!event.metaKey&&!event.target.closest('input,textarea,select,[contenteditable="true"]')){event.preventDefault();$('[data-gp-search]').focus();}
    });
    // The document may own keyboard focus after a route change, outside the surface.
    on(document,'keydown',event=>{
      if(event.defaultPrevented||app.route!=='games')return;
      const editing=event.target.closest?.('input,textarea,select,[contenteditable="true"]');
      const overlayOpen=$('.gp-dialog').open||!$('.gp-settings').hidden;
      const legacyGameKey=current?.id==='2048'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||current?.id==='math'&&['1','2','3','4'].includes(event.key);
      // Legacy games own document listeners. Keep their game shortcuts behind
      // the portal dialog/popover, while preserving Tab, Escape and form input.
      if(overlayOpen&&legacyGameKey&&!editing){event.stopPropagation();return;}
      if(host.contains(event.target))return;
      if(event.key==='/'&&!current&&!$('.gp-dialog').open&&!event.ctrlKey&&!event.metaKey&&!event.target.closest?.('input,textarea,select,[contenteditable="true"]')){event.preventDefault();$('[data-gp-search]').focus();}
    },{capture:true});
    on(window,'message',event=>{
      if(destroyed||!frame||event.source!==frame.contentWindow||event.origin!==location.origin||!event.data||typeof event.data!=='object')return;
      const data=event.data;
      if(data.type==='ayyy-games:catalog'){app.navigate('games');return;}
      if(data.type==='ayyy-games:escape'){if(host.dataset.wide==='true')$('[data-gp-action="expand"]').click();return;}
      if(data.type==='ayyy-games:ready'){frameReady(data);return;}
      if(data.type==='ayyy-games:height'){resizeFrame(data.height);return;}
      if(data.type==='ayyy-games:location'){const url=safePath(data.path);if(url)rememberPath(url);return;}
      if(data.type==='ayyy-games:progress'){const url=safePath(data.path);if(url)rememberPath(url,typeof data.label==='string'?data.label.slice(0,160):'');}
    });
    on(window,'pagehide',()=>{persist();});
    applySettings();$('[data-gp-search]').value=state.query;$('[data-gp-sort]').value=state.sort;
    const param=String(app.param||''),separator=param.indexOf('@'),id=separator<0?param:param.slice(0,separator),level=separator<0?undefined:param.slice(separator+1);
    if(!showPlay(id,level)){
      host.dataset.mode='catalog';host.dataset.wide='false';current=null;renderCatalog();
      scrollTask=requestAnimationFrame(()=>{if(!destroyed&&session.scroll>0)window.scrollTo({top:session.scroll,behavior:'instant'});});
    }
    return {destroy(){
      if(destroyed)return;destroyed=true;rememberFilters();clearTimeout(toastTimer);clearTimeout(loadingTimer);cancelAnimationFrame(scrollTask);events.abort();
      if($('.gp-dialog')?.open)$('.gp-dialog').close();
      try {if(typeof legacyCleanup==='function')legacyCleanup();else legacyCleanup?.destroy?.();}catch(error){console.error('AYYY game cleanup failed',error);}
      if(frame){frame.remove();frame=null;}
      host.replaceChildren();host.classList.remove('gp-root');delete host.dataset.palette;delete host.dataset.quiet;delete host.dataset.mode;delete host.dataset.wide;
    }};
  }
  window.AYYYGamesPortal={mount};
})();
