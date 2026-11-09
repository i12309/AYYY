/* AYYY · lazy island catalogue and isolated local game runtimes. */
(() => {
  'use strict';
  const app = window.AYYY;
  if (!app) return;
  const base = new URL('games/', document.baseURI);
  const version = 'island-20261109-1';
  const requests = new Map();
  let pending = null;

  function resource(name, stylesheet = false) {
    if (requests.has(name)) return requests.get(name);
    const request = new Promise((resolve, reject) => {
      const element = document.createElement(stylesheet ? 'link' : 'script');
      let finished = false;
      const finish = error => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        element.onload = element.onerror = null;
        if (error) { element.remove(); reject(error); }
        else resolve();
      };
      const timeout = setTimeout(() => finish(new Error('Game asset timeout: ' + name)), 15000);
      const url = new URL(name, base);
      url.searchParams.set('v', version);
      element.onload = () => finish();
      element.onerror = () => finish(new Error('Game asset unavailable: ' + name));
      if (stylesheet) { element.rel = 'stylesheet'; element.href = url.href; }
      else { element.src = url.href; element.async = false; }
      document.head.appendChild(element);
    }).catch(error => { requests.delete(name); throw error; });
    requests.set(name, request);
    return request;
  }

  function ensure() {
    if (pending) return pending;
    pending = (async () => {
      await resource('portal.css', true);
      await resource('catalog.js');
      await resource('card-art.js');
      await resource('portal.js');
      if (!window.AYYYGamesPortal?.mount) throw new Error('Games portal unavailable');
    })().catch(error => { pending = null; throw error; });
    return pending;
  }

  // Keep this tiny shell available before the lazy catalogue stylesheet arrives.
  if (!document.getElementById('ayyy-games-shell-style')) {
    const style = document.createElement('style');
    style.id = 'ayyy-games-shell-style';
    style.textContent = `
      body[data-shell="games"]{background:#fffefc;color:#203640}
      body[data-shell="games"]>.sidebar,body[data-shell="games"]>.nav-scrim,
      body[data-shell="games"]>.mobile-nav,body[data-shell="games"] .main-wrap>.topbar,
      body[data-shell="games"] .main-content>.footer{display:none!important}
      body[data-shell="games"] .main-wrap{margin:0;min-height:100svh}
      body[data-shell="games"] .main-content{padding:0!important;max-width:none;margin:0;min-height:100svh}
      body[data-shell="games"] #view{animation:none;margin:0;padding:0;outline:none}
      .gp-route-status{min-height:100svh;padding:52px max(24px,4vw);font:14px/1.7 "Segoe UI",sans-serif;color:#203640;background:#fffefc}
      .gp-route-status h1{font:36px/1.2 Georgia,serif;margin:0 0 14px}
      .gp-route-status p{margin:0 0 20px}
      .gp-route-status a,.gp-route-status button{display:inline-block;color:inherit;margin:0 20px 0 0;font:inherit}
      .gp-route-status button{background:#fff;border:1px solid #b6ccc8;border-radius:8px;padding:9px 16px;cursor:pointer}
      .gp-route-status a{text-decoration:underline}
    `;
    document.head.appendChild(style);
  }

  app.register('games', {
    title: 'Остров игр',
    render() {
      return '<div id="ayyy-games-root"><div class="gp-route-status" role="status"><h1>Остров игр</h1><p>Открываем каталог…</p><a href="#home">На главную</a></div></div>';
    },
    mount() {
      const host = document.getElementById('ayyy-games-root');
      if (!host) return;
      document.body.dataset.shell = 'games';
      let active = true, portal = null;
      const mount = () => ensure().then(() => {
        if (!active || !host.isConnected || app.route !== 'games') return;
        portal = window.AYYYGamesPortal.mount(host, {app, base, legacyGames: app.legacyGames});
      }).catch(() => {
        if (!active || !host.isConnected) return;
        host.innerHTML = '<div class="gp-route-status" role="alert"><h1>Остров пока не загрузился</h1><p>Проверьте соединение и попробуйте ещё раз. Сохранённые игры остаются на этом устройстве.</p><button type="button" id="gp-route-retry">Повторить</button><a href="#home">На главную</a></div>';
        host.querySelector('#gp-route-retry').onclick = event => { event.currentTarget.disabled = true; mount(); };
      });
      mount();
      return () => { active = false; portal?.destroy(); };
    }
  });
})();
