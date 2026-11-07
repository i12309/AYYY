/* Independent, disposable atmosphere renderer. Reduced-motion and hidden-tab aware. */
(function(root){
  'use strict';
  const M=root.AYYYWeatherModel;
  const cloud=(id)=>`<svg viewBox="0 0 440 210" aria-hidden="true"><defs><filter id="${id}" x="-15%" y="-25%" width="130%" height="150%"><feTurbulence type="fractalNoise" baseFrequency=".018 .03" numOctaves="3" seed="9" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g filter="url(#${id})"><path d="M28 147Q4 119 36 100Q16 66 68 69Q75 26 129 39Q170 10 206 53Q250 32 270 74Q322 42 351 86Q390 72 398 105Q435 99 427 136Q445 168 401 170Q350 199 316 174Q266 198 236 174Q186 195 148 173Q94 194 65 169Q18 177 28 147Z" fill="currentColor" opacity=".56"/><path d="M56 147Q41 96 98 99Q98 54 150 62Q193 55 220 98Q255 78 288 112Q335 82 367 127Q415 124 398 157Q327 173 270 162Q174 181 117 161Q67 172 56 147Z" fill="currentColor" opacity=".28"/></g><path d="M27 155Q72 169 100 161M130 72Q168 52 190 76M241 159q51 19 96-2" fill="none" stroke="currentColor" stroke-width=".8" opacity=".55"/></svg>`;
  function markup(asset){
    return `<div class="ww-scene-canvas" aria-hidden="true">
      <div class="ww-sky-wash"></div><div class="ww-horizon-haze"></div>
      <div class="ww-stars">${Array.from({length:35},(_,i)=>`<i style="--x:${(i*73+19)%99}%;--y:${(i*37+13)%69}%;--s:${i%4===0?3:1.5}px;--delay:-${i%7}s"></i>`).join('')}</div>
      <div class="ww-sun"><svg viewBox="0 0 240 240"><defs><filter id="ww-sun-paint"><feTurbulence type="fractalNoise" baseFrequency=".027" numOctaves="3" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="10"/></filter><radialGradient id="ww-sun-gradient"><stop stop-color="#ffcf65"/><stop offset=".7" stop-color="#ff9b31"/><stop offset="1" stop-color="#f28a34" stop-opacity=".65"/></radialGradient></defs><circle cx="120" cy="120" r="87" fill="#ffc96e" opacity=".19"/><circle cx="120" cy="120" r="69" fill="url(#ww-sun-gradient)" filter="url(#ww-sun-paint)"/><path d="M61 96c5-45 91-71 126-3M65 164c42 40 113 11 120-30M42 68l-14-9m155-18 7-17m21 146 17 9" stroke="#e8883f" fill="none" opacity=".5"/></svg></div>
      <div class="ww-moon"><svg viewBox="0 0 120 120"><defs><mask id="ww-moon-mask"><rect width="120" height="120" fill="#fff"/><circle cx="81" cy="37" r="39" fill="#000"/></mask></defs><circle cx="60" cy="60" r="42" fill="#ffecc4" mask="url(#ww-moon-mask)"/><circle cx="60" cy="60" r="53" fill="none" stroke="#ffebc3" opacity=".1"/></svg></div>
      <div class="ww-cloud ww-cloud-a">${cloud('ww-cloud-filter-a')}</div>
      <div class="ww-cloud ww-cloud-b">${cloud('ww-cloud-filter-b')}</div>
      <div class="ww-cloud ww-cloud-c">${cloud('ww-cloud-filter-c')}</div>
      <div class="ww-distant-shore"><svg viewBox="0 0 600 100" preserveAspectRatio="none"><path d="M0 73 37 62 70 65 120 47 170 61 210 34 275 54 320 46 350 60 403 40 458 64 491 58 544 72 600 69V100H0Z" fill="currentColor"/><path d="M30 76h530" stroke="currentColor" fill="none"/></svg></div>
      <div class="ww-sea"><svg viewBox="0 0 600 250" preserveAspectRatio="none"><defs><filter id="ww-wave-paint"><feTurbulence type="fractalNoise" baseFrequency=".018 .09" numOctaves="2" seed="6" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="12"/></filter><linearGradient id="ww-sea-fade" x2="0" y2="1"><stop stop-color="white" stop-opacity="0"/><stop offset=".2" stop-color="white"/><stop offset=".8" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><mask id="ww-sea-mask"><rect width="600" height="250" fill="url(#ww-sea-fade)"/></mask></defs><g mask="url(#ww-sea-mask)"><g filter="url(#ww-wave-paint)"><path d="M10 40Q130 19 299 38T590 40L600 229Q350 260 0 220Z" fill="currentColor" opacity=".19"/><path class="ww-water-wave ww-water-far" d="M-70 53q100-24 200 0t200 0t200 0t200 0v50H-70Z" fill="currentColor" opacity=".24"/><path class="ww-water-wave ww-water-near" d="M-100 123q100-32 200 0t200 0t200 0t200 0v90H-100Z" fill="currentColor" opacity=".26"/></g><g class="ww-foam ww-water-wave" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M27 66h126m218 4h158M51 111h109m250-6h129M16 156h108m301 12h126M23 202h174m144 5h204" stroke-width="2"/><path d="M59 84h56m306 8h89M21 138h83m360 1h107M39 184h73m357 9h61" stroke-width=".8"/></g></g></svg></div>
      <div class="ww-ripples"><svg viewBox="0 0 1600 350" preserveAspectRatio="none">${Array.from({length:100},(_,n)=>{const x=(n*233+61)%1670-30,y=20+(n*53)%330,w=14+(n*29)%120;return `<path d="M${x} ${y}q${w*.28} ${n%2?-3:3} ${w*.54} 0t${w*.46} -1" stroke="${n%3?'var(--ww-sea)':'var(--ww-paper)'}" stroke-width="${n%4===0?3:1}" opacity="${.14+(n%4)*.08}" fill="none"/>`;}).join('')}</svg></div>
      <div class="ww-coast" aria-hidden="true"><svg viewBox="0 0 1600 350" preserveAspectRatio="none"><defs>
<filter id="ww-rock-paper" x="-4%" y="-9%" width="108%" height="118%"><feTurbulence type="fractalNoise" baseFrequency=".024 .04" numOctaves="3" seed="19" result="rockNoise"/><feDisplacementMap in="SourceGraphic" in2="rockNoise" scale="9" xChannelSelector="R" yChannelSelector="G"/></filter>
<linearGradient id="ww-stone-wash" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="var(--ww-stone-light)"/><stop offset="1" stop-color="var(--ww-stone-dark)"/></linearGradient>
<linearGradient id="ww-foam-wash" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--ww-paper)" stop-opacity=".65"/><stop offset="1" stop-color="var(--ww-paper)" stop-opacity=".02"/></linearGradient>
</defs>
<g fill="var(--ww-sea)" opacity=".16" filter="url(#ww-rock-paper)"><path d="M0 87Q170 126 300 98T620 102 900 100 1250 91 1600 94V350H0Z"/><path d="M0 180Q260 139 390 173T750 164 1160 187 1600 158V350H0Z"/></g>
<g class="ww-coast-foam" fill="none" stroke="var(--ww-paper)" stroke-linecap="round" filter="url(#ww-rock-paper)">
<path d="M-10 119Q90 86 190 115T440 122 590 106M975 114q85-37 165-6t190 2 290 3M-20 224q100-54 205-17t210 1 170 9M985 213q121-43 228-7t145 7 269-7M50 290q140-55 300-6t260-3M995 287q111-24 226 1t360-14" stroke-width="10" opacity=".7"/>
<path d="M0 157q140-42 260-13t240 6M1090 158q170-51 290-9t250-1M100 252q121-21 250 7m775-12q130-23 290-1" stroke-width="3" opacity=".8"/>
</g>


<g class="ww-coast-grass" stroke="var(--ww-grass)" stroke-width="1.7" fill="none">
<path d="M32 284Q9 181 2 141m37 151Q38 184 62 136M45 284q16-68 48-88M24 271Q1 225-12 228m73 77q18-64 49-76M9 212q42 1 51 30m-25-43q20-20 34-17M1519 295q28-91 61-108m-43 118q49-85 68-72m-66 70q-5-87-27-140m32 85q26-30 45-27m-53 73q-38-65-68-69m84 94 40-121"/>
</g>
<g fill="var(--ww-flower)" opacity=".9"><ellipse cx="62" cy="136" rx="6" ry="3" transform="rotate(-30 62 136)"/><ellipse cx="93" cy="196" rx="5" ry="3"/><ellipse cx="110" cy="229" rx="5" ry="3"/><ellipse cx="69" cy="182" rx="5" ry="3"/><ellipse cx="1578" cy="187" rx="6" ry="3"/><ellipse cx="1512" cy="163" rx="5" ry="3"/><ellipse cx="1589" cy="221" rx="5" ry="3"/><ellipse cx="1498" cy="225" rx="5" ry="3"/></g>
</svg></div>
      <div class="ww-boat"><svg viewBox="0 0 100 90"><path d="m17 66 68-1-14 12-40 1Z" fill="currentColor"/><path d="M52 10v59M50 15 24 58h25M56 26l22 34H56" fill="var(--ww-paper)" stroke="currentColor" stroke-width="1.1"/><path d="M17 82h65" stroke="currentColor" opacity=".4"/></svg></div>
      <div class="ww-tower-wrap"><div class="ww-beam"></div><img class="ww-tower" src="${asset}" width="560" height="990" alt="" draggable="false" decoding="async"><div class="ww-lantern"></div><div class="ww-window ww-window-top"></div><div class="ww-window ww-window-low"></div><svg class="ww-snow-cover" viewBox="0 0 560 990" preserveAspectRatio="none"><path d="m210 163 54-45 61 44-30-5-28-25-27 25Z M175 281q88-20 180 1l-5 9q-87-12-172 0ZM190 495q76-18 149 5l2 15q-75-22-152-7ZM120 845q160-20 275 3l5 12q-136-20-282 0ZM68 918l61-40 58 9-39 17-50 13-30 19ZM233 951l40-31 43 3 12 13-44-1-33 27ZM405 922l32-10 54 32-44-12Z" fill="#f6fcff" opacity=".8"/></svg></div>
      <div class="ww-rock-edge ww-rock-edge-left"><img src="${asset}" alt="" draggable="false"></div><div class="ww-rock-edge ww-rock-edge-right"><img src="${asset}" alt="" draggable="false"></div>
      <div class="ww-birds">${[0,1,2].map((n)=>`<svg class="ww-bird ww-bird-${n}" viewBox="0 0 100 40"><path d="M2 25q22-19 46 1Q70 5 98 14L65 17 48 29 23 20Z" fill="var(--ww-paper)" stroke="currentColor" stroke-width="1.3"/><path d="m3 25 22-5 23 9 17-12 33-3" fill="none" stroke="currentColor" stroke-width="2"/></svg>`).join('')}</div>
      <div class="ww-lightning"><svg viewBox="0 0 80 210"><path d="m49 4-24 77 25-13-31 71 20-10-24 75 47-105-22 12 29-63-28 17Z" fill="#f6eaca"/></svg></div>
      <div class="ww-fog ww-fog-back"></div><div class="ww-fog ww-fog-front"></div><canvas class="ww-precipitation"></canvas>
    </div>`;
  }
  class Scene {
    constructor(host,asset){
      this.host=host;host.innerHTML=markup(asset);this.canvas=host.querySelector('canvas');this.ctx=this.canvas.getContext('2d');this.frame=0;this.previous=0;this.time=0;this.alive=true;this.paused=false;this.mode='partly';this.wind=4;this.phase='day';this.tick=this.tick.bind(this);
      this.motion=matchMedia('(prefers-reduced-motion: reduce)');this.onMotion=()=>this.sync();this.onVisibility=()=>this.sync();
      this.motion.addEventListener('change',this.onMotion);document.addEventListener('visibilitychange',this.onVisibility);
      this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
      this.particles=Array.from({length:150},(_,n)=>({x:((n*83+7)%101)/101,y:((n*67+19)%103)/103,s:.6+(n%7)/10}));
    }
    resize(){
      const r=this.host.getBoundingClientRect();this.width=r.width;this.height=r.height;const dpr=Math.min(window.devicePixelRatio||1,2);
      this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.ctx?.setTransform(dpr,0,0,dpr,0,0);this.draw(0);
    }
    update(point,day,override={}){
      const mode=override.weather||M.condition(point.code,point.isDay).key;
      this.intensity=override.intensity??.5;this.host.dataset.flashes=String(override.flashes!==false);this.mode=mode;this.phase=override.phase||M.phase(point,day);this.wind=M.number(point.wind)===null?3:point.wind;
      this.host.querySelectorAll('.ww-cloud').forEach((el,i)=>{el.style.opacity=M.number(override.cloudCover)===null?'':String(override.cloudCover*(i===2?.35:.65));});this.host.dataset.weather=mode;this.host.dataset.phase=this.phase;
      const area=this.host.closest('.ww-app');if(area){area.dataset.weather=mode;area.dataset.phase=this.phase;}
      const duration=Math.max(3,15-this.wind*.55);this.host.style.setProperty('--ww-wave-duration',duration+'s');
      this.host.style.setProperty('--ww-cloud-duration',Math.max(18,75-this.wind*3)+'s');
      this.drift=Math.sin(((point.direction??250)+180)*Math.PI/180);this.host.style.setProperty('--ww-drift',this.drift<0?'-24px':'24px');
      this.host.setAttribute('aria-label',`Художественная сцена: ${M.condition(point.code,point.isDay).label}, ${this.phase==='night'?'ночь':this.phase==='dusk'?'закат':this.phase==='dawn'?'рассвет':'день'}. Море не является морским прогнозом.`);
      this.sync();
    }
    setPaused(paused){this.paused=paused;this.sync();}
    sync(){
      if(!this.alive)return;const still=this.paused||this.motion.matches||document.hidden;this.host.dataset.still=String(still);
      if(still||!['rain','snow','storm'].includes(this.mode)){cancelAnimationFrame(this.frame);this.frame=0;this.previous=0;this.draw(0);}
      else if(!this.frame)this.frame=requestAnimationFrame(this.tick);
    }
    tick(stamp){
      this.frame=0;if(!this.alive||this.paused||this.motion.matches||document.hidden)return;
      const dt=this.previous?Math.min(.05,(stamp-this.previous)/1000):0;this.previous=stamp;this.time+=dt;this.draw(dt);this.frame=requestAnimationFrame(this.tick);
    }
    draw(dt){
      if(!this.ctx||!this.particles)return;const c=this.ctx,w=this.width,h=this.height;c.clearRect(0,0,w,h);if(!['rain','snow','storm'].includes(this.mode))return;
      const snow=this.mode==='snow',count=Math.round((snow?120:150)*this.intensity);
      c.strokeStyle=this.phase==='night'?'rgba(174,212,231,.35)':'rgba(78,133,156,.38)';c.fillStyle=this.phase==='night'?'rgba(231,244,251,.8)':'rgba(255,255,255,.94)';c.lineWidth=1;
      for(let i=0;i<count;i++){
        const p=this.particles[i];p.y=(p.y+dt*(snow?.035:.62)*p.s)%1;p.x=(p.x+dt*this.drift*(snow?.024:.13)+1)%1;
        const x=p.x*w+(snow?Math.sin(this.time+p.s*8)*7:0),y=p.y*h;
        if(snow){c.beginPath();c.arc(x,y,1.4+p.s*1.3,0,Math.PI*2);c.fill();}
        else{c.beginPath();c.moveTo(x,y);c.lineTo(x+this.drift*(4+this.wind*.5),y+13+p.s*8);c.stroke();}
      }
    }
    destroy(){this.alive=false;cancelAnimationFrame(this.frame);this.frame=0;this.resizeObserver.disconnect();this.motion.removeEventListener('change',this.onMotion);document.removeEventListener('visibilitychange',this.onVisibility);this.host.replaceChildren();}
  }
  root.AYYYWeatherScene=Scene;
})(window);
