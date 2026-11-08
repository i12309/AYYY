/* Fit the complete weather composition, including its visible controls and footer.
   Tree canvases keep viewport CSS coordinates; the existing lighthouse DOM
   shares the UI scale and its renderer measures the final visible dimensions. */
(function(root){
 'use strict';
 class ViewportFit{
  constructor(app,onResize){
   this.app=app;this.frame=app.querySelector('.ww-viewport');this.page=app.querySelector('.ww-page');this.onResize=onResize;this.alive=true;this.raf=0;this.scale=1;
   this.schedule=this.schedule.bind(this);
   this.resizeObserver=new ResizeObserver(this.schedule);this.resizeObserver.observe(this.page);
   this.themeObserver=new MutationObserver(this.schedule);this.themeObserver.observe(app,{attributes:true,attributeFilter:['data-scene-theme']});
   root.addEventListener('resize',this.schedule);document.fonts?.ready.then(this.schedule);this.schedule();
  }
  schedule(){if(this.alive&&!this.raf)this.raf=requestAnimationFrame(()=>{this.raf=0;this.fit();});}
  setScale(value){
   const scale=Math.floor(value*1e6)/1e6;
   if(this.scale!==scale){this.scale=scale;this.app.style.setProperty('--ww-ui-scale',String(scale));}
  }
  fit(){
   if(!this.alive||!this.app.isConnected)return;
   const width=this.app.clientWidth,height=root.innerHeight;
   // Below these dimensions keep a readable, naturally scrolling mobile page.
   const fitted=width>=960&&height>=540;
   const mode=fitted?'fit':'scroll';
   if(this.app.dataset.viewportFit!==mode)this.app.dataset.viewportFit=mode;
   if(!fitted){this.setScale(1);this.onResize();return;}
   const upper=width>=1920?width/1920:Math.min(1,width/1440),available=height-2;
   this.setScale(Math.min(this.scale,upper));
   // Width changes can cross a container breakpoint; measure again after zoom.
   // The last pass only reduces scale, so fractional layout cannot add a scrollbar.
   for(let pass=0;pass<4;pass++){
    const natural=this.page.getBoundingClientRect().height/this.scale;
    const next=Math.min(upper,available/Math.max(1,natural));
    // Font/grid rounding moves by fractions of a pixel under zoom. A half-pixel
    // dead band prevents our own ResizeObserver from endlessly refitting it.
    if(Math.abs(next-this.scale)*natural<.5)break;
    this.setScale(next);
   }
   const actual=this.page.getBoundingClientRect().height;
   if(actual>height-1)this.setScale(this.scale*available/actual);
   this.onResize();
  }
  destroy(){
   this.alive=false;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();this.themeObserver.disconnect();root.removeEventListener('resize',this.schedule);
   delete this.app.dataset.viewportFit;this.app.style.removeProperty('--ww-ui-scale');
  }
 }
 root.AYYYWeatherViewport=ViewportFit;
})(window);
