/* AYYY · lazy, isolated Project Viewer route. No server and no UI framework. */
(() => {
  'use strict';
  const app=window.AYYY;
  if(!app)return;
  const base=new URL('mpp/',document.baseURI);
  const version='mpp-v1';
  let pending=null;
  let stylesheet=null;
  const escape=value=>app.escape(value);

  function loadStyles() {
    if(stylesheet)return stylesheet;
    stylesheet=new Promise((resolve,reject)=>{
      const el=document.createElement('link');
      el.rel='stylesheet';
      el.href=new URL('style.css?v='+version,base).href;
      el.onload=()=>resolve(el);
      el.onerror=()=>{el.remove();reject(new Error('Стили просмотрщика не загрузились.'));};
      document.head.append(el);
    }).catch(error=>{stylesheet=null;throw error;});
    return stylesheet;
  }
  function ensure() {
    if(pending)return pending;
    pending=Promise.all([
      loadStyles(),
      import(new URL('viewer.mjs?v='+version,base).href)
    ]).then(([,module])=>{
      if(typeof module.mount!=='function')throw new Error('Модуль просмотрщика не найден.');
      return module;
    }).catch(error=>{pending=null;throw error;});
    return pending;
  }
  if(!document.querySelector('#ayyy-mpp-shell')) {
    const style=document.createElement('style');
    style.id='ayyy-mpp-shell';
    style.textContent='body[data-shell="mpp"]>.sidebar,body[data-shell="mpp"]>.nav-scrim,body[data-shell="mpp"]>.mobile-nav,body[data-shell="mpp"] .main-wrap>.topbar,body[data-shell="mpp"] .main-content>.footer{display:none!important}body[data-shell="mpp"] .main-wrap{margin:0}body[data-shell="mpp"] .main-content{margin:0;padding:0!important;max-width:none}body[data-shell="mpp"] #view{padding:0;animation:none}.pv-route-placeholder{min-height:100svh;padding:55px max(20px,4vw);background:#f8faf9;color:#24414b;font:14px/1.7 "Segoe UI",Arial,sans-serif}.pv-route-placeholder h1{font-size:24px}';
    document.head.append(style);
  }
  app.register('mpp',{
    title:'Project Viewer',
    render(){return '<div id="ayyy-mpp-root" class="pv-route-placeholder" role="status"><h1>AYYY · Project Viewer</h1><p>Открываем просмотрщик проектов…</p><a href="#directory">Все сервисы</a></div>';},
    mount(){
      const root=document.querySelector('#ayyy-mpp-root');
      if(!root)return;
      document.body.dataset.shell='mpp';
      let active=true,instance=null;
      function start(){
        ensure().then(module=>{
          if(!active||!root.isConnected||app.route!=='mpp')return;
          root.className='';
          instance=module.mount(root,{app});
        }).catch(error=>{
          if(!active||!root.isConnected)return;
          root.className='pv-route-placeholder';
          root.innerHTML='<h1>Просмотрщик не загрузился</h1><p>'+escape(error.message||'Ошибка загрузки')+'</p><button type="button" id="pv-retry">Повторить</button> <a href="#directory">К сервисам</a>';
          root.querySelector('#pv-retry').onclick=start;
        });
      }
      start();
      return ()=>{active=false;instance?.destroy();};
    }
  });
})();
