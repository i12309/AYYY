/* AYYY: isolate the HUMAN browser workspace in its own static route. */
(() => {
  'use strict';
  const app=window.AYYY;if(!app)return;
  const source=new URL('health/',document.baseURI).href;
  if(!document.getElementById('ayyy-health-shell')){
    const style=document.createElement('style');style.id='ayyy-health-shell';
    style.textContent=[
      'body[data-shell="health"]{background:#f7f8fa}',
      'body[data-shell="health"]>.sidebar,body[data-shell="health"]>.nav-scrim,',
      'body[data-shell="health"]>.mobile-nav,body[data-shell="health"] .main-wrap>.topbar,',
      'body[data-shell="health"] .main-content>.footer{display:none!important}',
      'body[data-shell="health"] .main-wrap{margin:0;min-height:100svh}',
      'body[data-shell="health"] .main-content{padding:0!important;max-width:none;margin:0}',
      'body[data-shell="health"] #view{margin:0;padding:0;animation:none;outline:none}',
      '.ayyy-health-frame{display:block;border:0;width:100%;height:100svh;background:#f7f8fa}'
    ].join('');
    document.head.appendChild(style);
  }
  app.register('health',{
    title:'Здоровье',
    render(){const href=source+'?v=human-951a33893491'+(app.param==='demo'?'&demo=1':'');return '<iframe class="ayyy-health-frame" id="ayyy-health-frame" title="HUMAN · личный журнал здоровья" src="'+app.escape(href)+'" loading="eager"></iframe>';},
    mount(){const frame=document.getElementById('ayyy-health-frame');return ()=>{if(frame)frame.src='about:blank';};}
  });
})();
