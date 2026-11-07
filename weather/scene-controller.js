/* One active renderer, generation-safe lazy tree initialization. */
(function(root){
 'use strict';let treeModule;
 function load(url){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>{s.remove();reject(new Error('Не удалось загрузить оформление дерева.'));};document.head.append(s);});}
 class Controller{
  constructor(host,options){this.host=host;this.app=host.closest('.ww-app');this.options=options;this.alive=true;this.generation=0;this.theme='lighthouse';this.renderer=new root.AYYYWeatherScene(host,options.assetURL);this.params=null;this.treeHost=null;}
  update(p){this.params=p;this.app.dataset.weather=p.weather;this.app.dataset.phase=p.phase;if(!this.renderer)return;if(this.theme==='tree'){
    const r=this.renderer;r.update({weather:p.weather,month:p.seasonMonth,season:root.AYYYTreePalette.season(p.seasonMonth).asset,snowCover:p.snowCover,rainPercent:p.precipitationEffect*100,wind:p.windSpeed,night:p.light.night,stars:p.light.stars,paused:p.paused,flashes:p.flashes,light:p.light});
    for(const [key,value] of Object.entries({paper:p.light.paper,ink:p.light.ink,muted:p.light.muted})){this.app.style.setProperty('--ww-'+key,`rgb(${value.join(',')})`);}
   }else{this.renderer.update({time:p.sceneTime,code:0,wind:p.windSpeed,direction:p.windDirection,isDay:p.isDay},{sunrise:p.sunrise,sunset:p.sunset},{weather:p.weather,phase:p.phase,intensity:p.precipitationEffect,flashes:p.flashes,cloudCover:p.cloudCover});this.renderer.setPaused(p.paused);}}
  async select(theme){
   const n=++this.generation;this.pending?.renderer.destroy();this.pending?.node.remove();this.pending=null;if(theme===this.theme)return true;
   if(theme==='lighthouse'){this.renderer.destroy();this.treeHost?.remove();this.treeHost=null;this.app.removeAttribute('data-scene-theme');this.app.removeAttribute('data-tree-motion');['paper','ink','muted'].forEach(k=>this.app.style.removeProperty('--ww-'+k));this.renderer=new root.AYYYWeatherScene(this.host,this.options.assetURL);this.theme=theme;this.update(this.params);return true;}
   let candidate,node;
   try{
    if(!root.AYYYTreeScene){treeModule??=load(this.options.treeURL).catch(e=>{treeModule=null;throw e;});await treeModule;}
    if(!this.alive||n!==this.generation)return false;
    node=document.createElement('div');node.className='ww-tree-scene';node.setAttribute('role','img');node.setAttribute('aria-label','Художественная погодная сцена с деревом');node.style.visibility='hidden';node.innerHTML=['sky','world','atmosphere'].map(name=>`<canvas data-layer="${name}"></canvas>`).join('');this.app.prepend(node);
    candidate=new root.AYYYTreeScene(node,this.app,this.options.treeAssetURL);candidate.params.paused=true;this.pending={renderer:candidate,node};
    await candidate.readyPromise;
    if(candidate.error)throw new Error('Не удалось загрузить изображения дерева. Повторите выбор оформления.');
    if(!this.alive||n!==this.generation){candidate.destroy();node.remove();return false;}
    this.pending=null;this.renderer.destroy();this.renderer=candidate;this.treeHost=node;this.host.hidden=true;this.theme='tree';this.app.dataset.sceneTheme='tree';node.style.visibility='';candidate.resize();this.update(this.params);return true;
   }catch(e){candidate?.destroy();node?.remove();if(this.pending?.renderer===candidate)this.pending=null;if(this.alive&&n===this.generation)throw e;return false;}
  }
  destroy(){this.alive=false;this.generation++;this.pending?.renderer.destroy();this.pending?.node.remove();this.pending=null;this.renderer?.destroy();this.treeHost?.remove();}
 }
 const select=Controller.prototype.select;
 Controller.prototype.select=async function(theme){if(theme==='lighthouse')this.host.hidden=false;return select.call(this,theme);};
 root.AYYYSceneController=Controller;
})(window);
