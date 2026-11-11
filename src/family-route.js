/* AYYY · GEN in a separate, static React app. */
(() => {
  'use strict';
  const a=window.AYYY;
  if(!a)return;
  const source=new URL('family/',document.baseURI).href+'?v=gen-beef01112026';
  if(!document.getElementById('ayyy-family-shell')) {
    const style=document.createElement('style');
    style.id='ayyy-family-shell';
    style.textContent=String.raw`
      body[data-shell="family"]{background:#f8f5ee;color:#203640}
      body[data-shell="family"]>.sidebar,body[data-shell="family"]>.nav-scrim,
      body[data-shell="family"]>.mobile-nav,body[data-shell="family"] .main-wrap>.topbar,
      body[data-shell="family"] .main-content>.footer{display:none!important}
      body[data-shell="family"] .main-wrap{margin:0;min-height:100svh}
      body[data-shell="family"] .main-content{padding:0!important;max-width:none;margin:0}
      body[data-shell="family"] #view{margin:0;padding:0;animation:none;outline:none}
      .ayyy-family-frame{display:block;border:0;width:100%;height:100svh;background:#f8f5ee}
    `;
    document.head.appendChild(style);
  }
  a.register('family',{
    title:'Родословная',
    render(){return '<iframe class="ayyy-family-frame" id="ayyy-family-frame" title="Семейное дерево GEN" src="'+a.escape(source)+'" loading="eager"></iframe>';},
    mount(){const frame=document.getElementById('ayyy-family-frame');return ()=>{if(frame)frame.src='about:blank';};}
  });
})();
