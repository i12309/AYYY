/* Игроланд — раскраска по номерам. Только браузерные API, без внешних сервисов. */
(() => {
  'use strict';
  const STORAGE_PREFIX = 'igroland-pixel-paint-v1:';
  const $ = (s) => document.querySelector(s);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const els = {
    canvas: $('#paintCanvas'), stage: $('#canvasStage'), levels: $('#levelList'), palette: $('#palette'),
    title: $('#paintingHeading'), percent: $('#progressPercent'), progress: $('#progressBar'),
    bar: $('#progressFill'), summary: $('#filledSummary'), zoom: $('#zoomValue'),
    preview: $('#showPreview'), undo: $('#undoButton'), reset: $('#resetButton'),
    complete: $('#completeBanner'), next: $('#nextLevel'), toast: $('#toast'),
    file: $('#imageFile'), size: $('#sizeSelect'), colors: $('#colorsSelect'),
    white: $('#ignoreWhite'), rebuild: $('#rebuildButton'), settings: $('#uploadSettings'),
    dialog: $('#helpDialog')
  };
  const ctx = els.canvas.getContext('2d', {alpha:true});
  const rawLevels = window.PIXEL_LEVELS || [];
  const baseDefs = rawLevels.map(parseLevel);
  let definitions = [...baseDefs];
  let current = null;
  let painted = new Uint8Array(0);
  let filledCount = 0, totalCount = 0;
  let selectedColor = 0, zoom = 1, panX = 0, panY = 0;
  let preview = false, history = [], saveTimer = null;
  let vw = 1, vh = 1, cellBase = 20, scheduled = false;
  let sourceImage = null, sourceFileName = '', sourceUrl = null;
  let toastTimer = null, hudScheduled = false;
  let remainingCounts = new Uint32Array(0);
  const difficultyLabels = {easy:'Легко',medium:'Средне',hard:'Сложно',expert:'Очень сложно',master:'Эксперт',custom:'Моя загрузка'};
  const pointers = new Map();
  let draggingMode = '', lastPointer = null, gesture = null, suppressTouchPaint = false;

  function parseLevel(raw) {
    const characters = Object.keys(raw.palette);
    const map = Object.fromEntries(characters.map((c,i)=>[c,i]));
    const width = raw.rows[0].length;
    if (!raw.rows.every(row => row.length === width)) throw new Error('Неправильная сетка уровня: ' + raw.id);
    return {
      id:raw.id, title:raw.title, difficulty:raw.difficulty, short:raw.short,
      width, height:raw.rows.length,
      colors:characters.map(c=>raw.palette[c]),
      cells:raw.rows.flatMap(row=>[...row].map(ch=>ch==='.'?-1:map[ch]))
    };
  }
  function safeRead(key) {try {return window.localStorage.getItem(STORAGE_PREFIX+key);} catch {return null;}}
  function safeWrite(key,value) {try {window.localStorage.setItem(STORAGE_PREFIX+key,value);} catch { /* file:// или отключённое хранилище */ }}
  function safeRemove(key) {try {window.localStorage.removeItem(STORAGE_PREFIX+key);} catch {}}
  function storedCustom() {
    try {
      const v=JSON.parse(safeRead('custom-def') || 'null');
      if (!v || v.id!=='custom' || !Array.isArray(v.cells) || !Array.isArray(v.colors)) return null;
      if (!Number.isInteger(v.width) || !Number.isInteger(v.height) || v.width<1 || v.height<1 || v.width*v.height!==v.cells.length || v.width*v.height>1800) return null;
      if (v.colors.length<1 || v.colors.length>10 || v.cells.some(n=> !Number.isInteger(n) || n < -1 || n >= v.colors.length)) return null;
      if (v.colors.some(c=>!/^(#[0-9a-fA-F]{6})$/.test(c))) return null;
      return {id:'custom',title:'Моя картинка',difficulty:'custom',short:'Загружено с устройства',width:v.width,height:v.height,colors:v.colors,cells:v.cells};
    } catch {return null;}
  }
  const previousCustom=storedCustom();
  if (previousCustom) definitions.push(previousCustom);

  function saveNow() {
    clearTimeout(saveTimer);saveTimer=null;
    if (!current) return;
    safeWrite('progress:'+current.id,JSON.stringify(Array.from(painted)));
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer=setTimeout(saveNow,160);
  }
  window.addEventListener('pagehide',saveNow);
  function loadPainted(def) {
    try {
      const a=JSON.parse(safeRead('progress:'+def.id) || 'null');
      if (Array.isArray(a) && a.length===def.cells.length) {
        return Uint8Array.from(a.map((v,i)=>def.cells[i]>=0&&v===1?1:0));
      }
    } catch {}
    return new Uint8Array(def.cells.length);
  }
  function progressOf(def) {
    const values=loadPainted(def);let count=0,all=0;
    def.cells.forEach((c,i)=>{if(c>=0){all++;count+=values[i]}});
    return all?Math.floor(100*count/all):0;
  }
  function toast(message) {
    els.toast.textContent=message;
    els.toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>els.toast.classList.remove('visible'),2100);
  }

  function drawThumb(canvas,def) {
    const bounds=canvas.getBoundingClientRect();
    const w=Math.max(20,bounds.width), h=Math.max(20,bounds.height);
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const g=canvas.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
    g.clearRect(0,0,w,h);
    const cell=Math.min((w-8)/def.width,(h-8)/def.height);
    const offX=(w-cell*def.width)/2,offY=(h-cell*def.height)/2;
    def.cells.forEach((color,i)=>{
      if(color<0) return;
      g.fillStyle=def.colors[color];
      g.fillRect(offX+(i%def.width)*cell,offY+Math.floor(i/def.width)*cell,Math.ceil(cell),Math.ceil(cell));
    });
  }
  function renderLevelList() {
    els.levels.replaceChildren();
    const filter = $('#difficultyFilter')?.value || 'all';
    const visibleDefs = definitions.filter(def => filter==='all' || def.difficulty===filter || def.id===current?.id);
    for(const def of visibleDefs) {
      const button=document.createElement('button');
      button.className='level-button'+(current?.id===def.id?' active':'');
      button.type='button';button.dataset.id=def.id;button.title=`${def.title} · ${def.width}×${def.height} · ${def.colors.length} цветов`;
      button.setAttribute('aria-pressed',String(current?.id===def.id));
      const image=document.createElement('div');image.className='level-image';
      const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');image.append(canvas);
      const body=document.createElement('span');body.className='level-text';
      const name=document.createElement('span');name.className='level-name';name.textContent=def.title;
      const status=document.createElement('span');status.className='level-meta';
      const percent=progressOf(def);
      status.textContent=percent ? `Раскрашено ${percent}%` : (difficultyLabels[def.difficulty] || 'Средне');
      if (percent===100) status.classList.add('level-finished');
      body.append(name,status);button.append(image,body);
      button.addEventListener('click',()=>chooseLevel(def.id));
      els.levels.append(button);
    }
    requestAnimationFrame(()=>{
      els.levels.querySelectorAll('canvas').forEach((canvas,i)=>drawThumb(canvas,visibleDefs[i]));
      const active=els.levels.querySelector('.active');
      if(active){
        if(els.levels.scrollWidth>els.levels.clientWidth+2)els.levels.scrollLeft=Math.max(0,active.offsetLeft-(els.levels.clientWidth-active.offsetWidth)/2);
        else els.levels.scrollTop=Math.max(0,active.offsetTop-(els.levels.clientHeight-active.offsetHeight)/2);
      }
    });
  }
  function updateLevelProgress() {
    const button=els.levels.querySelector(`[data-id="${current.id}"]`);
    if (!button) return;
    const el=button.querySelector('.level-meta');
    if (el) {
      el.textContent=`Раскрашено ${Math.floor(100*filledCount/Math.max(1,totalCount))}%`;
      el.classList.toggle('level-finished',filledCount===totalCount);
    }
  }

  function chooseLevel(id, savePrevious = true) {
    const next=definitions.find(def=>def.id===id) || definitions[0];
    if (!next) return;
    if(savePrevious) saveNow();
    else {clearTimeout(saveTimer);saveTimer=null;}
    current=next;
    painted=loadPainted(current);
    totalCount=0;filledCount=0;
    current.cells.forEach((c,i)=>{if(c>=0){totalCount++;if(painted[i])filledCount++;}});
    rebuildRemaining();
    if ($('#paintingDetails')) $('#paintingDetails').textContent=`${difficultyLabels[current.difficulty] || ''} · ${current.width}×${current.height} · ${current.colors.length} цветов · ${totalCount} клеток`;
    selectedColor=Math.max(0,current.colors.findIndex((_,i)=>remainingColor(i)>0));
    zoom=1;panX=0;panY=0;preview=false;history=[];
    els.complete.hidden=true;
    els.title.textContent=current.title;
    document.title=current.title+' — Раскраска по номерам';
    els.preview.setAttribute('aria-pressed','false');
    els.preview.title='Показать готовую картинку';
    renderLevelList();renderPalette();updateStatus();
    recalcSize();queueDraw();
    try {const url=new URL(location.href);url.searchParams.set('level',current.id);historyReplace(url.href);} catch {}
    els.zoom.textContent='100%';
  }
  function historyReplace(href) {try {window.history.replaceState(null,'',href);}catch{}}
  function rebuildRemaining() {
    remainingCounts = new Uint32Array(current.colors.length);
    current.cells.forEach((color,index)=>{if(color>=0 && !painted[index]) remainingCounts[color]++;});
  }
  function remainingColor(colorIndex) { return remainingCounts[colorIndex] || 0; }
  function queueHUD() {
    if(hudScheduled)return;
    hudScheduled=true;
    requestAnimationFrame(()=>{hudScheduled=false;updateStatus();renderPalette();});
  }
  function renderPalette() {
    els.palette.replaceChildren();
    current.colors.forEach((color,index)=>{
      const button=document.createElement('button');button.type='button';
      button.className='color-button';button.dataset.color=String(index);
      const left=remainingColor(index);
      if(selectedColor===index) button.classList.add('active');
      if (left===0) button.classList.add('done');
      button.disabled=left===0;
      button.setAttribute('aria-label',`Краска номер ${index+1}, осталось ${left} клеток`);
      button.setAttribute('aria-pressed',String(index===selectedColor));
      const dot=document.createElement('span');dot.className='color-dot';dot.style.backgroundColor=color;
      const text=document.createElement('span');text.className='color-num';text.textContent=left===0?'✓':index+1;
      const rgb=hexToRgb(color);
      const brightness=(rgb[0]*.299+rgb[1]*.587+rgb[2]*.114);
      if(brightness>168){text.style.color='#293548';text.style.textShadow='none';}
      const count=document.createElement('span');count.className='color-count';count.textContent=left===0?'Готово':`ещё ${left}`;
      button.append(dot,text,count);button.addEventListener('click',()=>{
        selectedColor=index;renderPalette();queueDraw();
      });
      els.palette.append(button);
    });
  }
  function updateStatus() {
    const percent=totalCount?Math.floor(filledCount/totalCount*100):0;
    els.percent.textContent=percent+'%';
    els.progress.setAttribute('aria-valuenow',String(percent));
    els.bar.style.width=percent+'%';
    els.summary.textContent=filledCount===totalCount?'Все клеточки раскрашены!':`${filledCount} из ${totalCount} клеточек`;
    els.undo.disabled=history.length===0;
    updateLevelProgress();
  }
  function nextColorIfFinished() {
    if(remainingColor(selectedColor)===0) {
      const next=current.colors.findIndex((_,i)=>remainingColor(i)>0);
      if(next>=0){selectedColor=next;renderPalette();queueDraw();}
    }
  }
  function fillIndex(idx) {
    if(preview || idx<0 || current.cells[idx]<0 || painted[idx]) return;
    if(current.cells[idx]!==selectedColor){
      // Цвет не совпал: ребёнок не может случайно испортить рисунок.
      return;
    }
    painted[idx]=1;history.push(idx);
    if(history.length>Math.max(5000,current.cells.length))history.shift();
    filledCount++;
    remainingCounts[current.cells[idx]]--;
    queueHUD();
    scheduleSave();
    queueDraw();
    if(filledCount===totalCount) {
      els.complete.hidden=false;
      toast('Ура! Картинка готова!');
    }
  }
  function undo() {
    const idx=history.pop();
    if(idx===undefined)return;
    if(painted[idx]) {painted[idx]=0;filledCount--;remainingCounts[current.cells[idx]]++;}
    els.complete.hidden=true;
    selectedColor=current.cells[idx];
    updateStatus();renderPalette();scheduleSave();queueDraw();
  }

  function recalcSize() {
    const r=els.canvas.getBoundingClientRect();
    vw=Math.max(1,r.width);vh=Math.max(1,r.height);
    const dpr=Math.min(window.devicePixelRatio||1,3);
    const bw=Math.round(vw*dpr),bh=Math.round(vh*dpr);
    if(els.canvas.width!==bw || els.canvas.height!==bh){els.canvas.width=bw;els.canvas.height=bh;}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(current) cellBase=Math.max(1,Math.min((vw-36)/current.width,(vh-36)/current.height,43));
    clampPan();
  }
  function boundsForZoom(z=zoom) {
    const size=cellBase*z;
    const w=current.width*size, h=current.height*size;
    return {size,w,h,left:(vw-w)/2+panX,top:(vh-h)/2+panY};
  }
  function clampOffset(pan,grid,view) {
    const margin=20;
    if(grid<=view-2*margin) return clamp(pan,-24,24);
    const centered=(view-grid)/2;
    return clamp(pan,view-grid-margin-centered,margin-centered);
  }
  function clampPan() {
    if(!current) return;
    const w=current.width*cellBase*zoom,h=current.height*cellBase*zoom;
    panX=clampOffset(panX,w,vw);panY=clampOffset(panY,h,vh);
  }
  function queueDraw() {
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;draw();});
  }
  function draw() {
    if(!current)return;
    ctx.clearRect(0,0,vw,vh);
    const b=boundsForZoom();
    const s=b.size;
    const labelSize=clamp(s*.52,9,20);
    ctx.font=`800 ${labelSize}px system-ui,-apple-system,"Segoe UI",sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    for(let y=0;y<current.height;y++){
      for(let x=0;x<current.width;x++){
        const i=y*current.width+x,color=current.cells[i];
        if(color<0)continue;
        const px=b.left+x*s,py=b.top+y*s;
        if(px+s<0 || px>vw || py+s<0 || py>vh)continue;
        const isDone=Boolean(painted[i]);
        ctx.fillStyle=(preview||isDone)?current.colors[color]:(selectedColor===color?'#e8e7f1':'#e9edf3');
        ctx.fillRect(px,py,s+.25,s+.25);
        if(s>7){ctx.lineWidth=Math.min(1.3,Math.max(.5,s*.025));ctx.strokeStyle='rgba(159,171,192,.57)';ctx.strokeRect(px+.4,py+.4,s-.8,s-.8);}
        if(!preview && !isDone && s>=12){
          ctx.fillStyle='#5d6980';ctx.fillText(String(color+1),px+s*.5,py+s*.53);
        }
      }
    }
    els.zoom.textContent=Math.round(zoom*100)+'%';
  }
  function pointInCanvas(clientX,clientY) {
    const b=els.canvas.getBoundingClientRect();
    return {x:clientX-b.left,y:clientY-b.top};
  }
  function hitCell(p) {
    const b=boundsForZoom();
    const x=Math.floor((p.x-b.left)/b.size),y=Math.floor((p.y-b.top)/b.size);
    if(x<0 || y<0 || x>=current.width || y>=current.height)return -1;
    return y*current.width+x;
  }
  function paintAt(clientX,clientY) {
    const idx=hitCell(pointInCanvas(clientX,clientY));
    fillIndex(idx);
    return idx;
  }
  function paintStroke(fromX,fromY,toX,toY) {
    const distance=Math.hypot(toX-fromX,toY-fromY);
    const steps=Math.min(180,Math.max(1,Math.ceil(distance/Math.max(5,cellBase*zoom/3))));
    for(let step=1;step<=steps;step++){
      const t=step/steps;
      paintAt(fromX+(toX-fromX)*t,fromY+(toY-fromY)*t);
    }
  }
  function zoomAt(nextZoom,at) {
    if(!current)return;
    const z=clamp(nextZoom,1,24);
    const b=boundsForZoom();
    const px=(at.x-b.left)/b.size, py=(at.y-b.top)/b.size;
    zoom=z;
    const s=cellBase*z;
    panX=at.x-px*s-(vw-current.width*s)/2;
    panY=at.y-py*s-(vh-current.height*s)/2;
    clampPan();els.zoom.textContent=Math.round(zoom*100)+'%';queueDraw();
  }
  function zoomBy(factor) {zoomAt(zoom*factor,{x:vw/2,y:vh/2});}
  function fit() {zoom=1;panX=panY=0;els.zoom.textContent='100%';queueDraw();}
  function midpoint(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function initGesture(){
    const [a,b]=[...pointers.values()];
    const mid=midpoint(a,b);
    const canvasMid=pointInCanvas(mid.x,mid.y);
    const bb=boundsForZoom();
    gesture={distance:Math.max(1,distance(a,b)),zoom,
      gx:(canvasMid.x-bb.left)/bb.size,gy:(canvasMid.y-bb.top)/bb.size};
    suppressTouchPaint=true;draggingMode='gesture';
  }
  function updateGesture(){
    if(pointers.size<2 || !gesture)return;
    const [a,b]=[...pointers.values()];
    const halfway=midpoint(a,b);
    const mid=pointInCanvas(halfway.x,halfway.y);
    zoom=clamp(gesture.zoom*distance(a,b)/gesture.distance,1,24);
    const s=cellBase*zoom;
    panX=mid.x-gesture.gx*s-(vw-current.width*s)/2;
    panY=mid.y-gesture.gy*s-(vh-current.height*s)/2;
    clampPan();queueDraw();
  }
  els.canvas.addEventListener('pointerdown',e=>{
    if(!current)return;
    if(e.pointerType==='mouse' && e.button!==0 && e.button!==2) return;
    e.preventDefault();
    try{els.canvas.setPointerCapture(e.pointerId);}catch{}
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){initGesture();return;}
    if(pointers.size>2)return;
    lastPointer={x:e.clientX,y:e.clientY};
    draggingMode=(e.button===2||e.shiftKey)?'pan':'paint';
    if(draggingMode==='paint' && !suppressTouchPaint){
      if(preview)toast('Выключи образец, чтобы красить');
      else {
        const hit=paintAt(e.clientX,e.clientY);
        if(hit>=0 && current.cells[hit]>=0 && current.cells[hit]!==selectedColor && !painted[hit])
          toast(`Здесь номер ${current.cells[hit]+1}. Выбери клетку с номером ${selectedColor+1}`);
      }
    }
  });
  els.canvas.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    e.preventDefault();
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>=2){updateGesture();return;}
    if(draggingMode==='pan' && lastPointer){
      panX+=e.clientX-lastPointer.x;panY+=e.clientY-lastPointer.y;
      lastPointer={x:e.clientX,y:e.clientY};clampPan();queueDraw();
    }else if(draggingMode==='paint' && !suppressTouchPaint && !preview){
      // Заполняем также промежуточные клетки, если палец движется быстро.
      const from=lastPointer || {x:e.clientX,y:e.clientY};
      paintStroke(from.x,from.y,e.clientX,e.clientY);
      lastPointer={x:e.clientX,y:e.clientY};
    }
  });
  function releasePointer(e){
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);
    if(pointers.size===0){gesture=null;lastPointer=null;draggingMode='';suppressTouchPaint=false;nextColorIfFinished();}
    else if(pointers.size===1){gesture=null;draggingMode='gesture';}
  }
  els.canvas.addEventListener('pointerup',releasePointer);
  els.canvas.addEventListener('pointercancel',releasePointer);
  els.canvas.addEventListener('lostpointercapture',releasePointer);
  els.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  els.canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const next=zoom*Math.exp(-e.deltaY*.00145);
    zoomAt(next,pointInCanvas(e.clientX,e.clientY));
  },{passive:false});
  els.canvas.addEventListener('keydown',e=>{
    if(e.key==='+' || e.key==='='){e.preventDefault();zoomBy(1.25);}
    if(e.key==='-'){e.preventDefault();zoomBy(.8);}
    if(e.key==='0'){e.preventDefault();fit();}
    if(/^[1-9]$/.test(e.key)){const next=Number(e.key)-1;if(next<current.colors.length && remainingColor(next)>0){selectedColor=next;renderPalette();queueDraw();}}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();
      if(e.key==='ArrowUp')panY+=30;
      if(e.key==='ArrowDown')panY-=30;
      if(e.key==='ArrowLeft')panX+=30;
      if(e.key==='ArrowRight')panX-=30;
      clampPan();queueDraw();
    }
  });

  function hexToRgb(h){return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));}
  function toHex(r,g,b){return '#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');}
  function dist2(a,b){return (a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;}
  function quantize(pixels,k){
    if(!pixels.length)return {colors:[],assignments:[]};
    const bins=new Map();
    pixels.forEach(rgb=>{
      const key=rgb.map(x=>Math.min(7,Math.floor(x/32))).join('/');
      let bin=bins.get(key);
      if(!bin){bin={rgb:[0,0,0],count:0};bins.set(key,bin);}
      bin.count++;bin.rgb.forEach((_,i)=>bin.rgb[i]+=rgb[i]);
    });
    const buckets=[...bins.values()].sort((a,b)=>b.count-a.count);
    const candidates=buckets.map(b=>({rgb:b.rgb.map(x=>x/b.count),weight:b.count}));
    const centers=[candidates[0].rgb.slice()];
    const numCenters=Math.min(k,candidates.length);
    for(let i=1;i<numCenters;i++){
      let best=candidates[0],score=-1;
      for(const b of candidates){
        const near=Math.min(...centers.map(c=>dist2(b.rgb,c)));
        const s=near*Math.sqrt(b.weight);
        if(s>score){score=s;best=b;}
      }
      centers.push(best.rgb.slice());
    }
    const assignments=new Array(pixels.length).fill(0);
    for(let iteration=0;iteration<12;iteration++){
      const sums=centers.map(()=>[0,0,0,0]);
      pixels.forEach((rgb,i)=>{
        let best=0,score=Infinity;
        centers.forEach((c,j)=>{const d=dist2(c,rgb);if(d<score){score=d;best=j;}});
        assignments[i]=best;
        sums[best][0]+=rgb[0];sums[best][1]+=rgb[1];sums[best][2]+=rgb[2];sums[best][3]++;
      });
      sums.forEach((sum,j)=>{if(sum[3])centers[j]=sum.slice(0,3).map(n=>n/sum[3]);});
    }
    const count=new Array(centers.length).fill(0);
    assignments.forEach(i=>count[i]++);
    const ordered=centers.map((rgb,i)=>({rgb,count:count[i],old:i})).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
    const old2new=new Map(ordered.map((entry,i)=>[entry.old,i]));
    return {colors:ordered.map(o=>toHex(...o.rgb)),assignments:assignments.map(i=>old2new.get(i))};
  }
  function buildFromImage(image,name) {
    const size=Number(els.size.value), aspect=image.naturalWidth/image.naturalHeight;
    const width=aspect>=1?size:clamp(Math.round(size*aspect),6,size);
    const height=aspect>=1?clamp(Math.round(size/aspect),6,size):size;
    const hidden=document.createElement('canvas');hidden.width=width;hidden.height=height;
    const g=hidden.getContext('2d',{willReadFrequently:true});
    g.clearRect(0,0,width,height);
    g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    g.drawImage(image,0,0,width,height);
    const bytes=g.getImageData(0,0,width,height).data;
    const rgb=[],positions=[],cells=new Array(width*height).fill(-1);
    for(let i=0;i<width*height;i++){
      const r=bytes[i*4],gr=bytes[i*4+1],b=bytes[i*4+2],a=bytes[i*4+3];
      if(a<110)continue;
      if(els.white.checked && r>=245 && gr>=245 && b>=245)continue;
      // Полупрозрачные участки смешиваем с белым фоном.
      const alpha=a/255;
      rgb.push([r*alpha+255*(1-alpha),gr*alpha+255*(1-alpha),b*alpha+255*(1-alpha)]);
      positions.push(i);
    }
    if(!rgb.length)throw new Error('На рисунке нет цветных клеток. Снимите галочку «Белый фон».');
    const quantized=quantize(rgb,Number(els.colors.value));
    positions.forEach((pos,index)=>cells[pos]=quantized.assignments[index]);
    return {id:'custom',title:'Моя картинка',short:name.slice(0,35),difficulty:'custom',width,height,colors:quantized.colors,cells};
  }
  function installCustom(def){
    saveNow();
    safeWrite('custom-def',JSON.stringify(def));
    safeRemove('progress:custom');
    definitions=[...baseDefs,def];
    // chooseLevel() сохраняет предыдущий уровень, затем открывает новую раскраску.
    chooseLevel('custom',false);
    toast(`Картинка готова: ${def.width} × ${def.height} клеток`);
  }
  async function loadFile(file){
    if(!file)return;
    if(!file.type.startsWith('image/')){toast('Нужен файл изображения');return;}
    if(file.size>20*1024*1024){toast('Изображение слишком большое (максимум 20 МБ)');return;}
    const url=URL.createObjectURL(file);
    const image=new Image();
    try{
      await new Promise((resolve,reject)=>{
        image.onload=resolve;image.onerror=()=>reject(new Error('Не удалось прочитать изображение'));
        image.src=url;
      });
      if(!image.naturalWidth || !image.naturalHeight)throw new Error('Неподдерживаемый формат изображения');
      if(sourceUrl)URL.revokeObjectURL(sourceUrl);
      sourceUrl=url;
      sourceImage=image;sourceFileName=file.name;
      els.rebuild.disabled=false;
      const def=buildFromImage(image,file.name);
      installCustom(def);
      els.settings.open=true;
    }catch(err){URL.revokeObjectURL(url);toast(err.message || 'Не удалось открыть файл');}
  }

  $('#zoomIn').addEventListener('click',()=>zoomBy(1.25));
  $('#zoomOut').addEventListener('click',()=>zoomBy(.8));
  $('#zoomFit').addEventListener('click',fit);
  $('#zoomReadable')?.addEventListener('click',()=>zoomAt(Math.max(1,32/cellBase),{x:vw/2,y:vh/2}));
  $('#difficultyFilter')?.addEventListener('change',renderLevelList);
  els.preview.addEventListener('click',()=>{
    preview=!preview;
    els.preview.setAttribute('aria-pressed',String(preview));
    els.preview.title=preview?'Вернуться к раскрашиванию':'Показать готовую картинку';
    els.complete.hidden=true;
    queueDraw();
  });
  els.undo.addEventListener('click',undo);
  els.reset.addEventListener('click',()=>{
    if(!current || filledCount===0)return;
    if(!confirm('Очистить все раскрашенные клетки этой картинки?'))return;
    painted.fill(0);filledCount=0;history=[];selectedColor=0;preview=false;rebuildRemaining();
    els.preview.setAttribute('aria-pressed','false');els.complete.hidden=true;
    updateStatus();renderPalette();queueDraw();saveNow();
    toast('Можно раскрашивать сначала');
  });
  $('#helpButton').addEventListener('click',()=>els.dialog.showModal());
  $('#closeHelp').addEventListener('click',()=>els.dialog.close());
  els.dialog.addEventListener('click',e=>{if(e.target===els.dialog)els.dialog.close();});
  els.next.addEventListener('click',()=>{
    const index=baseDefs.findIndex(l=>l.id===current.id);
    chooseLevel(baseDefs[(index+1)%baseDefs.length].id);
  });
  els.file.addEventListener('change',e=>{
    loadFile(e.target.files?.[0]).finally(()=>{e.target.value='';});
  });
  els.rebuild.addEventListener('click',()=>{
    if(!sourceImage)return;
    if(current?.id==='custom' && filledCount>0 && !confirm('Создать новую сетку? Прогресс текущей картинки будет сброшен.'))return;
    try{installCustom(buildFromImage(sourceImage,sourceFileName));}
    catch(err){toast(err.message);}
  });
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{recalcSize();queueDraw();}):null;
  if(observer)observer.observe(els.stage);
  window.addEventListener('resize',()=>{recalcSize();queueDraw();renderLevelList();});
  const requested=new URLSearchParams(location.search).get('level') || 'heart';
  chooseLevel(requested);
})();
