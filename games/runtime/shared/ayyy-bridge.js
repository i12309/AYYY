/* Same-origin bridge between original Games documents and the AYYY portal. */
(() => {
  'use strict';
  const script = document.currentScript;
  const base = new URL('../', script.src);
  const root = document.documentElement;
  const embedded = window.parent !== window;
  const gameMatch = location.pathname.slice(base.pathname.length).match(/^games\/([a-z-]+)\//);
  const gameId = gameMatch ? gameMatch[1] : 'works';
  let lastHeight = 0, lastProgress = '', lastPath = '', frame = 0, progressTimer = 0;
  let resizeObserver, contentObserver;
  root.dataset.ayyyEmbedded = String(embedded);
  root.dataset.ayyyGame = gameId;

  function send(type, data = {}) {
    if (!embedded) return;
    window.parent.postMessage({type, ...data}, location.origin);
  }
  function path() { return location.pathname + location.search; }
  function title() { return document.title.replace(/\s*[·—]\s*(?:Остров игр AYYY|Игроланд).*$/, ''); }
  function measuredHeight() {
    const shell = document.querySelector('.site-shell');
    return Math.max(200, Math.ceil(shell ? shell.getBoundingClientRect().height + shell.offsetTop + 2 : 500));
  }
  function reportHeight() {
    frame = 0;
    const height = measuredHeight();
    if (Math.abs(height - lastHeight) > 1) {
      lastHeight = height;
      send('ayyy-games:height', {height});
    }
  }
  function queueHeight() { if (!frame) frame = requestAnimationFrame(reportHeight); }
  function reportLocation() {
    const current = path();
    if (current === lastPath) return;
    lastPath = current;
    send('ayyy-games:location', {path:current, title:title()});
  }
  function syncLevelFromUI() {
    // These five upstream games persist a selected level but do not update their
    // URL. Canonicalize the visible selection so a portal resume link cannot
    // override that save with an older explicit query parameter.
    let selected = '';
    if (['memory','maze','hexmerge'].includes(gameId)) {
      const mode=document.querySelector('[data-difficulty][aria-pressed="true"]')?.dataset.difficulty;
      if (['easy','normal','hard'].includes(mode)) selected=mode;
    } else if (gameId === 'nuts' || gameId === 'arrows') {
      const level=Number(document.querySelector('#levelNumber')?.textContent.trim());
      if (Number.isInteger(level) && level>=1 && level<=(gameId==='nuts'?999:100)) selected=String(level);
    }
    if (!selected) return;
    const url=new URL(location.href);
    if (url.searchParams.get('level')===selected) return;
    url.searchParams.set('level',selected);
    try { history.replaceState(history.state,'',url); } catch { /* file:// may restrict history. */ }
  }
  function progressLabel() {
    const value = selector => document.querySelector(selector)?.textContent.trim() || '';
    if (gameId === 'coloring') return value('#progressPercent') ? `${value('#paintingHeading')} · ${value('#progressPercent')}` : '';
    if (gameId === 'memory') return value('#pairCount') ? `${value('#pairCount')} пар · ${value('#moveCount')} ходов` : '';
    if (gameId === 'mahjong') return value('#pairsValue') ? `${value('#pairsValue')} пар` : '';
    if (gameId === 'nuts') return `Уровень ${value('#levelNumber')} · ${value('#sortedCount')} собрано`;
    if (gameId === 'maze') return value('#stepsValue') ? `${value('#stepsValue')} шагов` : '';
    if (gameId === 'hexmerge' || gameId === 'marble-shooter') return value('#scoreValue') ? `${value('#scoreValue')} очков` : '';
    const lesson = value('.learn-badge');
    return lesson || (value('#levelSelect option:checked') ? value('#levelSelect option:checked') : '');
  }
  function reportProgress() {
    progressTimer = 0;
    const label = progressLabel().slice(0,160);
    const signature = path()+'|'+label;
    if (!label || signature === lastProgress) return;
    lastProgress = signature;
    send('ayyy-games:progress', {gameId, label, path:path()});
  }
  function queueProgress() {
    // Timers may update text every second; unchanged summaries are not sent or saved.
    if (!progressTimer) progressTimer = setTimeout(reportProgress, 180);
  }
  function applySettings(data) {
    if (data.palette === 'paper' || data.palette === 'sand') root.dataset.ayyyPalette = data.palette;
    if (typeof data.quiet === 'boolean') root.dataset.ayyyQuiet = String(data.quiet);
    queueHeight();
  }
  window.addEventListener('message', event => {
    if (!embedded || event.source !== window.parent || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || data.type !== 'ayyy-games:settings') return;
    applySettings(data);
  });

  // Several original games update their selected level with replaceState. The
  // wrapper observes their URL and leaves their arguments, result and state intact.
  for (const method of ['replaceState','pushState']) {
    const original = history[method].bind(history);
    history[method] = function (...args) {
      const result = original(...args);
      reportLocation(); queueProgress();
      return result;
    };
  }
  window.addEventListener('popstate', reportLocation);

  document.addEventListener('keydown', event => {
    if (!embedded || event.key !== 'Escape' || event.defaultPrevented) return;
    // Let the child's dialog, native field or game-specific cancel action win.
    if (document.querySelector('dialog[open], .bolt.selected') || gameId === 'arrows') return;
    if (event.target instanceof Element && event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
    setTimeout(() => { if (!event.defaultPrevented) send('ayyy-games:escape'); }, 0);
  });

  document.addEventListener('click', event => {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor || anchor.hasAttribute('download')) return;
    let url;
    try { url = new URL(anchor.href, location.href); } catch { return; }
    if (url.origin !== base.origin) return;
    const catalog = url.pathname === base.pathname || url.pathname === new URL('index.html',base).pathname;
    if (catalog) {
      event.preventDefault();
      if (embedded) send('ayyy-games:catalog');
      else location.href = new URL('../../index.html#games',base).href;
    } else if (embedded && url.pathname.startsWith(base.pathname)) {
      // Normal links stay in this document, preserving the enclosing portal.
      anchor.target = '_self';
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    const brand = document.querySelector('.site-header .brand');
    if (brand) {
      const dot = document.createElement('span'); dot.className='brand-dot'; dot.textContent='.';
      brand.replaceChildren(document.createTextNode('ayyy'),dot);
      brand.setAttribute('aria-label','AYYY — Остров игр');
    }
    if (embedded) {
      const links = [...document.querySelectorAll('.site-header .ws-links a')].filter(a => new URL(a.href).pathname.endsWith('/works.html'));
      if (links.length) {
        const nav=document.createElement('nav'); nav.className='ayyy-runtime-links'; nav.setAttribute('aria-label','Мои работы');
        links.forEach(a=>nav.append(a.cloneNode(true)));
        document.querySelector('.site-shell')?.insertBefore(nav,document.querySelector('.site-shell')?.firstChild);
      }
    }
    const shell=document.querySelector('.site-shell');
    if ('ResizeObserver' in window && shell) { resizeObserver=new ResizeObserver(queueHeight); resizeObserver.observe(shell); }
    contentObserver=new MutationObserver(()=>{syncLevelFromUI();queueHeight();queueProgress();});
    if (shell) contentObserver.observe(shell,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','open','aria-pressed']});
    syncLevelFromUI();
    lastHeight=measuredHeight(); lastPath=path();
    send('ayyy-games:ready',{title:title(),path:lastPath,height:lastHeight});
    queueProgress();
  },{once:true});
  window.addEventListener('load',queueHeight,{once:true});
  window.addEventListener('resize',queueHeight);
  window.addEventListener('pagehide',()=>{
    reportProgress(); resizeObserver?.disconnect(); contentObserver?.disconnect();
    cancelAnimationFrame(frame); clearTimeout(progressTimer);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  });
})();
