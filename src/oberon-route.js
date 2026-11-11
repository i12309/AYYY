/* AYYY · OBERON keeps its Markdown workspace and styles in a static app. */
(() => {
  'use strict';
  const app=window.AYYY;if(!app)return;
  const source=new URL('oberon/',document.baseURI).href;
  const version='oberon-20d7ce75b03e';
  if(!document.getElementById('ayyy-oberon-shell')){
    const style=document.createElement('style');style.id='ayyy-oberon-shell';
    style.textContent=[
      'body[data-shell="oberon"]{background:#20262a}',
      'body[data-shell="oberon"]>.sidebar,body[data-shell="oberon"]>.nav-scrim,',
      'body[data-shell="oberon"]>.mobile-nav,body[data-shell="oberon"] .main-wrap>.topbar,',
      'body[data-shell="oberon"] .main-content>.footer{display:none!important}',
      'body[data-shell="oberon"] .main-wrap{margin:0;min-height:100svh}',
      'body[data-shell="oberon"] .main-content{padding:0!important;max-width:none;margin:0}',
      'body[data-shell="oberon"] #view{margin:0;padding:0;animation:none;outline:none}',
      '.ayyy-oberon-frame{display:block;border:0;width:100%;height:100svh;background:#20262a}'
    ].join('');
    document.head.appendChild(style);
  }
  app.register('oberon',{
    title:'OBERON',
    render(){
      const href=source+'?v='+version+(app.param==='demo'?'&demo=1':'');
      return '<iframe class="ayyy-oberon-frame" id="ayyy-oberon-frame" title="OBERON · заметки Markdown" src="'+app.escape(href)+'" loading="eager"></iframe>';
    },
    mount(){
      const frame=document.getElementById('ayyy-oberon-frame');
      return ()=>{if(frame)frame.src='about:blank';};
    }
  });
})();
