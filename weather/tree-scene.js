
/* Full-bleed scene renderer. One immutable tree structure; no seasonal photographs.
   Background, artwork, clouds and flash all share viewport coordinates and lighting. */
(function(root){'use strict';
const S=root.AYYYTreePalette;
const createCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const files=['tree-structure.png','leaves-autumn.png','leaves-summer.png','leaves-spring.png','leaves-buds.png','tree-legacy-mask.png','terrain.png','mountains.png','cloud-field-0.png','cloud-field-1.png','cloud-field-2.png'];
let preparedArtwork=null;
const rgba=(rgb,a=1)=>`rgba(${rgb.join(',')},${a})`;
/* Prepare once. All seasons share the same high-resolution, connected wood. */
function prepareTreeArtwork(assets, createCanvas) {
  const W = 500, H = 380, SCALE = 2, N = W * H;
  const smooth = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const hash = value => {
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return (value ^ (value >>> 16)) >>> 0;
  };
  const raster = (image, width = W, height = H) => {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    if (image) context.drawImage(image, 0, 0, width, height);
    return canvas;
  };
  const pixels = canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const dataContext = raster(null).getContext('2d');
  const empty = () => dataContext.createImageData(W, H);
  const finish = data => {
    const canvas = raster(null);
    canvas.getContext('2d').putImageData(data, 0, 0);
    return raster(canvas, W * SCALE, H * SCALE);
  };
  const mass = data => {
    let sum = 0;
    for (let i = 3; i < data.data.length; i += 4) sum += data.data[i];
    return sum;
  };

  const wood = raster(assets['tree-structure.png'], W * SCALE, H * SCALE);
  const woodData = pixels(wood), woodPixels = woodData.data;
  // Discard invisible matte residue, preserving the antialiasing of fine twigs.
  for (let i = 0; i < woodPixels.length; i += 4) {
    const alpha = woodPixels[i + 3];
    woodPixels[i + 3] = alpha <= 3 ? 0 : alpha * smooth(3, 14, alpha);
  }
  wood.getContext('2d').putImageData(woodData, 0, 0);
  const woodLow = pixels(raster(wood)).data;
  const stats = { logicalSize: [W, H], rasterSize: [W * SCALE, H * SCALE], attachments: {} };

  // One nearest-wood field serves every leaf. Distances are logical pixels.
  const distance = new Float32Array(N).fill(1e6);
  const nearest = new Int32Array(N).fill(-1);
  let woodCount = 0;
  for (let p = 0; p < N; p++) if (woodLow[p * 4 + 3] >= 32) {
    distance[p] = 0; nearest[p] = p; woodCount++;
  }
  if (!woodCount) throw new Error('Tree artwork contains no visible wood.');
  const relax = (p, q) => {
    const root = nearest[q];
    if (root < 0) return;
    const dx = p % W - root % W, dy = (p / W | 0) - (root / W | 0);
    const d = dx * dx + dy * dy;
    if (d < distance[p]) { distance[p] = d; nearest[p] = root; }
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (x) relax(p, p - 1);
    if (y) { relax(p, p - W); if (x) relax(p, p - W - 1); if (x + 1 < W) relax(p, p - W + 1); }
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const p = y * W + x;
    if (x + 1 < W) relax(p, p + 1);
    if (y + 1 < H) { relax(p, p + W); if (x) relax(p, p + W - 1); if (x + 1 < W) relax(p, p + W + 1); }
  }
  stats.woodPixels = woodCount;

  const legacy = pixels(raster(assets['tree-legacy-mask.png'])).data;
  const autumn = pixels(raster(assets['leaves-autumn.png']));
  const summer = pixels(raster(assets['leaves-summer.png']));
  const originalMass = { autumn: mass(autumn), summer: mass(summer) };
  // The summer asset recoloured the old bark green. Identify that bark from
  // the original autumn RGB and remove the SAME mask from both leaf layers.
  for (let i = 0; i < autumn.data.length; i += 4) {
    const a = autumn.data, r = a[i], g = a[i + 1], b = a[i + 2];
    const high = Math.max(r, g, b), saturation = (high - Math.min(r, g, b)) / Math.max(1, high);
    const difference = Math.max(Math.abs(r - legacy[i]), Math.abs(g - legacy[i + 1]), Math.abs(b - legacy[i + 2]));
    const oldBark = smooth(2, 24, legacy[i + 3]) * (1 - smooth(12, 32, difference)) * (1 - smooth(.50, .64, saturation));
    a[i + 3] *= 1 - oldBark;
    summer.data[i + 3] *= 1 - oldBark;
  }
  // Keep real painted components intact, including their soft edge pixels.
  const components = data => {
    const rgba = data.data, seen = new Uint8Array(N), queue = new Int32Array(N), result = [];
    for (let start = 0; start < N; start++) {
      if (seen[start] || rgba[start * 4 + 3] <= 6) continue;
      let head = 0, tail = 1, peak = 0, sum = 0;
      const points = []; queue[0] = start; seen[start] = 1;
      while (head < tail) {
        const p = queue[head++], x = p % W, y = p / W | 0, alpha = rgba[p * 4 + 3];
        points.push(p); sum += alpha; peak = Math.max(peak, alpha);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox, ny = y + oy;
          if ((!ox && !oy) || nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const q = ny * W + nx;
          if (!seen[q] && rgba[q * 4 + 3] > 6) { seen[q] = 1; queue[tail++] = q; }
        }
      }
      if (peak >= 24 && sum >= 48) result.push({ points, peak, mass: sum });
    }
    return result;
  };
  const placement = (cluster, data) => {
    let best = -1, bestDistance = 1e6;
    const coreAlpha = Math.min(80, cluster.peak * .5);
    for (let k = 0; k < cluster.points.length; k++) {
      const p = cluster.points[k], alpha = cluster.alphas ? cluster.alphas[k] : data.data[p * 4 + 3];
      if (alpha >= coreAlpha && distance[p] < bestDistance) { best = p; bestDistance = distance[p]; }
    }
    if (best < 0 || bestDistance > 15 * 15) return null;
    const target = nearest[best];
    return bestDistance <= 1 ? { dx: 0, dy: 0 } : { dx: target % W - best % W, dy: (target / W | 0) - (best / W | 0) };
  };
  const paint = (output, source, cluster, offset, commit = true) => {
    let gain = 0;
    const dst = output.data, src = source.data;
    for (let sample = 0; sample < cluster.points.length; sample++) {
      const p = cluster.points[sample];
      const x = p % W + offset.dx, y = (p / W | 0) + offset.dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const a = p * 4, b = (y * W + x) * 4, sourceAlpha = cluster.alphas ? cluster.alphas[sample] : src[a + 3];
      const retained = dst[b + 3] * (1 - sourceAlpha / 255), alpha = Math.round(sourceAlpha + retained);
      gain += alpha - dst[b + 3];
      if (commit && alpha) {
        for (let k = 0; k < 3; k++) dst[b + k] = (src[a + k] * sourceAlpha + dst[b + k] * retained) / alpha;
        dst[b + 3] = alpha;
      }
    }
    return gain;
  };
  const attach = (data, name) => {
    const output = empty(), groups = components(data);
    const counts = { clusters: groups.length, moved: 0, removed: 0, maxShift: 0 };
    for (const group of groups) {
      const offset = placement(group, data);
      if (!offset) { counts.removed++; continue; }
      if (offset.dx || offset.dy) counts.moved++;
      counts.maxShift = Math.max(counts.maxShift, Math.hypot(offset.dx, offset.dy));
      paint(output, data, group, offset);
    }
    counts.maxShift = +counts.maxShift.toFixed(2); stats.attachments[name] = counts;
    return output;
  };
  // A pale bark highlight below the crown was absent from the legacy wood
  // mask and was mistakenly included in both old leaf exports. Remove those
  // small low-chroma chips in the lower stem area, including their soft edge.
  let trunkChips = 0;
  for (const group of components(autumn)) {
    let minX = W, maxX = 0, minY = H, saturation = 0;
    for (const p of group.points) {
      minX = Math.min(minX, p % W); maxX = Math.max(maxX, p % W); minY = Math.min(minY, p / W | 0);
      const i = p * 4, high = Math.max(autumn.data[i], autumn.data[i + 1], autumn.data[i + 2]);
      saturation += (high - Math.min(autumn.data[i], autumn.data[i + 1], autumn.data[i + 2])) / Math.max(1, high);
    }
    if (minY < H * .74 || minX < W * .42 || maxX > W * .58 || saturation / group.points.length > .48) continue;
    trunkChips++;
    for (const p of group.points) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const x = p % W + ox, y = (p / W | 0) + oy;
      if (x >= 0 && x < W && y >= 0 && y < H) autumn.data[(y * W + x) * 4 + 3] = summer.data[(y * W + x) * 4 + 3] = 0;
    }
  }
  stats.removedTrunkChips = trunkChips;
  stats.removedBarkPercent = {
    autumn: +(100 * (1 - mass(autumn) / originalMass.autumn)).toFixed(2),
    summer: +(100 * (1 - mass(summer) / originalMass.summer)).toFixed(2)
  };
  const springSource = pixels(raster(assets['leaves-spring.png']));
  const buds = attach(pixels(raster(assets['leaves-buds.png'])), 'buds');
  const spring = attach(springSource, 'spring');
  // The connected dense crown stays in place; isolated outer leaf groups can
  // move a few pixels to their branch without thinning the summer canopy.
  const summerDense = attach(summer, 'summer');
  const autumnDense = attach(autumn, 'autumn');

  // November uses whole small leaf silhouettes filled with autumn paint.
  // The silhouettes come from actual spring leaf groups, never a screen-space
  // sine cut through the full crown. Each chosen group is attached as a unit.
  const candidates = [];
  for (const group of components(springSource)) {
    const stencil = new Map();
    for (const p of group.points) {
      const x = p % W, y = p / W | 0, alpha = springSource.data[p * 4 + 3];
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
        const radius = ox * ox + oy * oy, nx = x + ox, ny = y + oy;
        if (radius > 5 || nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const q = ny * W + nx, value = Math.min(255, alpha * 1.4) * (radius > 2 ? .8 : 1);
        stencil.set(q, Math.max(stencil.get(q) || 0, value));
      }
    }
    const points = [], alphas = []; let peak = 0, sum = 0;
    for (const [p, mask] of stencil) {
      const i = p * 4, alpha = Math.round(autumn.data[i + 3] * mask / 255);
      if (alpha <= 6) continue;
      points.push(p); alphas.push(alpha); peak = Math.max(peak, alpha); sum += alpha;
    }
    if (peak < 32 || sum < 100) continue;
    const cluster = { points, alphas, peak, mass: sum }, offset = placement(cluster, autumn);
    if (offset) candidates.push({ cluster, offset, data: autumn, rank: hash(group.points[0] + 7321) });
  }
  candidates.sort((a, b) => a.rank - b.rank);
  const sparse = empty(), denseMass = mass(autumnDense), targetMass = denseMass * .17;
  let sparseMass = 0, sparseGroups = 0, sparseMoved = 0, sparseMaxShift = 0;
  for (const candidate of candidates) {
    const { data, cluster, offset } = candidate;
    const gain = paint(sparse, data, cluster, offset, false);
    if (sparseMass + gain > targetMass * 1.015) continue;
    sparseMass += paint(sparse, data, cluster, offset); sparseGroups++;
    if (offset.dx || offset.dy) sparseMoved++;
    sparseMaxShift = Math.max(sparseMaxShift, Math.hypot(offset.dx, offset.dy));
    if (sparseMass >= targetMass * .995) break;
  }
  stats.attachments.sparse = { clusters: sparseGroups, candidates: candidates.length, moved: sparseMoved, maxShift: +sparseMaxShift.toFixed(2) };
  stats.sparseDensity = +(sparseMass / denseMass).toFixed(4);

  // Snow is the upward-facing edge of the NEW wood, clipped inside its alpha.
  const snow = raster(null, W * SCALE, H * SCALE), snowContext = snow.getContext('2d');
  const snowData = snowContext.createImageData(snow.width, snow.height), sw = snow.width;
  for (let y = 0; y < snow.height; y++) for (let x = 0; x < sw; x++) {
    const p = y * sw + x, i = p * 4, alpha = woodPixels[i + 3];
    if (alpha < 14) continue;
    const above = y >= 3 ? woodPixels[(p - sw * 3) * 4 + 3] : 0;
    const branchZone = 1 - smooth(288 * SCALE, 332 * SCALE, y);
    const rootZone = smooth(352 * SCALE, 368 * SCALE, y);
    const coating = Math.max(0, alpha - above) * .68 * alpha / 255 * Math.max(branchZone, rootZone);
    snowData.data[i] = 231; snowData.data[i + 1] = 242; snowData.data[i + 2] = 246;
    snowData.data[i + 3] = coating * (.88 + (hash(p) % 101) / 100 * .12);
  }
  snowContext.putImageData(snowData, 0, 0);
  return { wood, leaves: { buds: finish(buds), spring: finish(spring), summer: finish(summerDense), autumn: finish(autumnDense), sparse: finish(sparse) }, snow, stats };
}

class Scene{
 constructor(host,layout,assetBase){
  this.layout=layout;this.assetBase=assetBase;
  this.host=host;this.canvases=['sky','world','atmosphere'].map(id=>host.querySelector('[data-layer="'+id+'"]'));this.ctx=this.canvases.map(c=>c.getContext('2d'));
  this.alive=true;this.ready=false;this.raf=0;this.last=0;this.time=0;this.seed=33201;this.month=-1;this.bolt=null;this.nextBolt=6;this.lightningCount=0;this.renderCount=0;
  this.assets={};this.key='';this.params={weather:'clear',rainPercent:50,wind:7,night:0,stars:0,season:'autumn',month:9,paused:false,flashes:true,light:S.atmosphere(S.lighting(840),'clear')};
  this.motion=matchMedia('(prefers-reduced-motion:reduce)');this.tick=this.tick.bind(this);this.sync=this.sync.bind(this);this.onResize=this.resize.bind(this);
  this.particles=Array.from({length:520},()=>({x:this.rand(),y:this.rand(),z:.25+this.rand()*.75,r:this.rand()*6.283}));
  this.stars=Array.from({length:70},()=>({x:this.rand(),y:this.rand(),r:.45+this.rand()*.8,a:.3+this.rand()*.6}));
  this.observer=new ResizeObserver(this.onResize);this.observer.observe(this.layout);
  window.addEventListener('resize',this.onResize);this.motion.addEventListener('change',this.sync);document.addEventListener('visibilitychange',this.sync);
  this.hide=()=>{cancelAnimationFrame(this.raf);this.raf=0;this.last=0;};window.addEventListener('pagehide',this.hide);window.addEventListener('pageshow',this.sync);
  this.readyPromise=Promise.all(files.map(async name=>{const img=new Image();img.src=new URL(name,this.assetBase).href;await img.decode();this.assets[name]=img;})).then(()=>{if(!this.alive)return;this.artwork=preparedArtwork||(preparedArtwork=prepareTreeArtwork(this.assets,createCanvas));this.ready=true;this.prepareSeason();this.renderTreePreviews();this.resize();this.sync();}).catch(error=>{this.error=String(error);console.error('Scene artwork',error);});
  this.resize();
 }
 rand(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 get still(){return !this.alive||this.params.paused||this.motion.matches||document.hidden;}
 geometry(){
  const origin=this.host.getBoundingClientRect();
  const bounds=e=>{const r=e.getBoundingClientRect();return {x:r.left-origin.left,y:r.top-origin.top,w:r.width,h:r.height,bottom:r.bottom-origin.top};};
  const spacer=bounds(this.layout.querySelector('.ww-center')),controls=bounds(this.layout.querySelector('.ww-scene-controls')),hourly=bounds(this.layout.querySelector('.ww-hourly'));
  const w=this.host.clientWidth,small=w<=1100;
  const top=small?spacer.y+4:Math.max(controls.bottom+12,spacer.y+30);
  const baseY=small?spacer.bottom-70:hourly.y-81;
  const scale=Math.max(.38,Math.min((baseY-top)/368,(small?w-30:spacer.w+92)/500,1.28));
  return {w,h:Math.max(window.innerHeight,hourly.bottom+90),rootX:small?w*.5:spacer.x+spacer.w*.48,baseY,scale,artBottom:small?baseY+100*scale:Math.min(hourly.y+40,baseY+145*(w/1672)),skyBottom:baseY+50,small};
 }
 resize(){
  if(!this.alive)return;const g=this.geometry();this.g=g;this.w=g.w;this.h=g.h;this.host.style.height=g.h+'px';const d=Math.min(devicePixelRatio||1,1.5);this.dpr=d;
  this.canvases.forEach((canvas,i)=>{canvas.width=Math.round(g.w*d);canvas.height=Math.round(g.h*d);this.ctx[i]?.setTransform(d,0,0,d,0,0);});
  this.key='';this.drawWorld();this.draw(0);
 }
 composeTree(month,snowCover=this.params.snowCover){
  const s=S.season(month),a=this.artwork,c=createCanvas(1000,760),ctx=c.getContext('2d');
  ctx.drawImage(a.wood,0,0);
  if(s.asset==='spring'){
   ctx.drawImage(a.leaves.buds,0,0);
   if(s.stage!=='buds')ctx.drawImage(a.leaves.spring,0,0);
   if(s.stage==='young'){ctx.globalAlpha=.54;ctx.drawImage(a.leaves.summer,0,0);}
  }else if(s.asset==='summer')ctx.drawImage(a.leaves.summer,0,0);
  else if(s.asset==='autumn'){
   if(s.stage==='gold'){ctx.drawImage(a.leaves.summer,0,0);ctx.globalAlpha=.72;ctx.drawImage(a.leaves.autumn,0,0);}
   else ctx.drawImage(s.stage==='sparse'?a.leaves.sparse:a.leaves.autumn,0,0);
  }else if(snowCover)ctx.drawImage(a.snow,0,0);
  ctx.globalAlpha=1;return c;
 }
 preview(season){
  if(!this.ready)return null;
  const months={spring:3,summer:6,autumn:9,winter:0};
  if(!Object.prototype.hasOwnProperty.call(months,season))return null;
  this.previews??=Object.create(null);
  if(!this.previews[season]){
   const canvas=createCanvas(256,194);
   canvas.getContext('2d').drawImage(this.composeTree(months[season],season==='winter'),0,0,256,194);
   this.previews[season]=canvas.toDataURL('image/png');
  }
  return this.previews[season];
 }
 renderTreePreviews(){
  this.layout.querySelectorAll('img[data-tree-preview]').forEach(img=>{
   const source=this.preview(img.dataset.treePreview);if(source)img.src=source;
  });
 }
 prepareSeason(){
  if(!this.ready)return;const m=this.params.month,s=S.season(m);this.month=m;
  this.tree=this.composeTree(m);
  const terrain=createCanvas(1672,760),tc=terrain.getContext('2d');tc.drawImage(this.assets['terrain.png'],0,0);const d=tc.getImageData(0,0,1672,760),p=d.data;
  for(let i=0;i<p.length;i+=4){if(!p[i+3])continue;const r=p[i],g=p[i+1],b=p[i+2],l=r*.25+g*.6+b*.15;
   if(s.asset==='winter'&&this.params.snowCover){
    const rock=Math.min(1,l/145);p[i]=128+rock*111;p[i+1]=148+rock*96;p[i+2]=161+rock*87;
   }else if(s.asset==='summer'||s.asset==='spring'){
    if(r>b*1.12&&g>b*1.05){p[i]=r*.79;p[i+1]=Math.min(240,g*1.04+5);p[i+2]=b*.9+5;}
    if(s.stage==='buds'){p[i]=p[i]*.88+24;p[i+1]=p[i+1]*.88+25;p[i+2]=p[i+2]*.88+26;}
   }
  }tc.putImageData(d,0,0);this.terrain=terrain;this.key='';
 }
 tint(image,light,opacity=1){
  const c=createCanvas(image.width,image.height),x=c.getContext('2d');
  const sat=1-light.night*.4-light.severity*.15;
  x.filter=`brightness(${light.brightness.toFixed(3)}) saturate(${sat.toFixed(3)})`;x.drawImage(image,0,0);x.filter='none';
  x.globalCompositeOperation='source-atop';
  if(light.night>0){x.fillStyle=rgba([15,32,53],light.night*.22);x.fillRect(0,0,c.width,c.height);}
  if(light.warm>0){x.fillStyle=rgba([219,136,75],light.warm*.11);x.fillRect(0,0,c.width,c.height);}
  x.globalCompositeOperation='source-over';return c;
 }
 drawWorld(){
  if(!this.ready||!this.ctx[1])return;const l=this.params.light,g=this.g;
  const key=[this.params.month,l.night.toFixed(2),l.brightness.toFixed(2),l.warm.toFixed(2),this.w,this.h,this.params.weather,this.params.snowCover].join(':');if(this.key===key)return;this.key=key;this.renderCount++;
  const ctx=this.ctx[1],w=this.w,h=this.h;ctx.clearRect(0,0,w,h);
  // One shared transformation for all landscape layers. No image of a bright sky.
  const envScale=Math.max(w/1450,g.scale),envW=1672*envScale,envX=Math.max(w-envW,Math.min(0,g.rootX-736*envScale)),y=g.baseY-578*envScale;
  const mountains=this.tint(this.assets['mountains.png'],l),terrain=this.tint(this.terrain,l),tree=this.tint(this.tree,l);
  ctx.globalAlpha=.54;ctx.drawImage(mountains,envX,y,envW,760*envScale);ctx.globalAlpha=.94;ctx.drawImage(terrain,envX,y,envW,760*envScale);ctx.globalAlpha=1;
  ctx.drawImage(tree,g.rootX-226*g.scale,g.baseY-368*g.scale,500*g.scale,380*g.scale);
  // Full-width fade into the surrounding paper, not four feathered image edges.
  ctx.globalCompositeOperation='destination-out';const mask=ctx.createLinearGradient(0,g.artBottom-42,0,g.artBottom+42);mask.addColorStop(0,'rgba(0,0,0,0)');mask.addColorStop(1,'rgba(0,0,0,1)');ctx.fillStyle=mask;ctx.fillRect(0,g.artBottom-42,w,h);ctx.globalCompositeOperation='source-over';
  this.cloudTints=[0,1,2].map(i=>{const img=this.assets['cloud-field-'+i+'.png'],c=createCanvas(img.width,img.height),x=c.getContext('2d');x.drawImage(img,0,0);x.globalCompositeOperation='source-in';
   let col=l.night>.65?S.mix([45,59,77],[20,32,48],l.severity):S.mix([175,193,204],[33,50,73],l.severity);col=col.map(v=>Math.max(0,Math.min(255,v+(k=>k===0?-9:k===1?13:-6)(i))));
   x.fillStyle=rgba(col);x.fillRect(0,0,c.width,c.height);return c;});
 }
 update(p){
  const prev=this.params;this.params={...prev,...p};
  if(this.params.month!==this.month||prev.snowCover!==this.params.snowCover)this.prepareSeason();
  if(prev.weather!==this.params.weather){this.bolt=null;this.nextBolt=this.time+4+this.rand()*3;}
  if(!this.params.flashes||this.params.weather!=='storm')this.bolt=null;
  this.drawWorld();if(prev.paused!==this.params.paused)this.sync();else if(this.still)this.draw(0);
 }
 sync(){if(!this.alive)return;cancelAnimationFrame(this.raf);this.raf=0;this.last=0;this.layout.dataset.treeMotion=this.still?'still':'animated';if(this.still)this.bolt=null;this.draw(0);if(!this.still&&!this.raf)this.raf=requestAnimationFrame(this.tick);}
 tick(stamp){this.raf=0;if(this.still)return;const dt=this.last?Math.min(.05,(stamp-this.last)/1000):0;this.last=stamp;this.time+=dt;this.onTick?.(dt);this.drawWorld();this.draw(dt);if(!this.still&&!this.raf)this.raf=requestAnimationFrame(this.tick);}
 drawSky(){
  const c=this.ctx[0];if(!c||!this.g)return;const p=this.params,l=p.light,g=this.g,w=this.w,h=this.h,skyEnd=Math.max(480,g.skyBottom+180);
  c.clearRect(0,0,w,h);const bg=c.createLinearGradient(0,0,0,skyEnd);bg.addColorStop(0,rgba(l.sky));bg.addColorStop(.54,rgba(l.horizon));bg.addColorStop(1,rgba(l.paper));c.fillStyle=bg;c.fillRect(0,0,w,h);
  const clearFactor=Math.max(0,1-l.cloudCover*.96),stars=l.stars*clearFactor;
  if(stars>.02){c.fillStyle='#e1e9ed';for(const s of this.stars){c.globalAlpha=stars*s.a;c.beginPath();c.arc(s.x*w,s.y*g.baseY*.82,s.r,0,Math.PI*2);c.fill();}c.globalAlpha=1;}
  const sunX=g.rootX+180*g.scale,sunY=g.baseY-(l.warm>.45?235:302)*g.scale;
  if(l.night<.9){const opacity=(1-l.night)*clearFactor;const radius=56*g.scale,halo=c.createRadialGradient(sunX,sunY,radius*.55,sunX,sunY,radius*1.8);halo.addColorStop(0,rgba([250,200,117],opacity*.57));halo.addColorStop(1,rgba([249,206,141],0));c.fillStyle=halo;c.fillRect(sunX-radius*2,sunY-radius*2,radius*4,radius*4);c.fillStyle=rgba([249,203,121],opacity*.7);c.beginPath();c.arc(sunX,sunY,radius,0,Math.PI*2);c.fill();}
  if(l.moon>.05){const mx=g.rootX+192*g.scale,my=g.baseY-324*g.scale,r=25*Math.max(.75,g.scale),alpha=l.moon*(1-l.severity*.9);c.fillStyle=rgba([206,221,232],alpha*.9);c.beginPath();c.arc(mx,my,r,0,Math.PI*2);c.fill();c.fillStyle=rgba([168,189,204],alpha*.33);for(const [dx,dy,rr] of [[-.28,.12,.17],[.3,-.22,.12],[.14,.4,.10]]){c.beginPath();c.arc(mx+dx*r,my+dy*r,rr*r,0,6.283);c.fill();}}
  if(!this.ready)return;
  // Two independently advected continuous cloud fields. Motion is in ONE direction.
  // The texture itself is horizontally periodic; there are no visible rectangles.
  for(let k=0;k<3;k++){
   const tile=this.cloudTints?.[k];if(!tile)continue;
   const width=w*(1.16+k*.24),height=Math.min(g.baseY*.91,620)*(1-k*.13),speed=(.7+p.wind*.16)*(1+k*.47),offset=(this.time*speed+width*(.24+k*.19))%width;
   const top=-90+k*57;c.globalAlpha=l.cloudCover*(k===0?.66:k===1?.40:.30);
   c.drawImage(tile,offset-width,top,width,height);c.drawImage(tile,offset,top,width,height);
  }c.globalAlpha=1;
 }
 makeBolt(){
  const g=this.g,x=g.rootX+(this.rand()>.5?1:-1)*(190+this.rand()*100)*g.scale,y=Math.max(80,g.baseY-420*g.scale);let px=x,py=y;const main=[[px,py]],branches=[];
  for(let i=0;i<13;i++){px+=(this.rand()-.51)*28*g.scale;py+=(10+this.rand()*13)*g.scale;main.push([px,py]);if(i===4||i===8){let bx=px,by=py,arr=[[bx,by]];for(let j=0;j<4;j++){bx+=(this.rand()>.5?1:-1)*18*g.scale;by+=11*g.scale;arr.push([bx,by]);}branches.push(arr);}}
  this.bolt={main,branches,age:0};this.nextBolt=this.time+9+this.rand()*8;this.lightningCount++;
 }
 draw(dt){
  if(!this.g)return;this.drawSky();const c=this.ctx[2];if(!c)return;const p=this.params,g=this.g,w=this.w,h=this.h;c.clearRect(0,0,w,h);
  const wet=['rain','storm','snow'].includes(p.weather),snow=p.weather==='snow',fall=!wet&&p.season==='autumn',rain=S.rain(p.rainPercent),maxH=g.artBottom+20;
  const count=Math.min(490,Math.round((wet?rain.density:fall?11:0)*Math.min(1.4,w/1400)));this.particleCount=count;
  for(let i=0;i<count;i++){
   const q=this.particles[i],speed=fall?23:snow?21+q.z*37:rain.speed*(.53+q.z*.7);q.y=(q.y+dt*speed/Math.max(1,maxH))%1;q.x=(q.x+dt*(fall?.015:snow?.009+p.wind*.0012:.018+p.wind*.003)*q.z)%1;
   let x=q.x*w,y=q.y*maxH;const alpha=.4+q.z*.6;
   if(fall){x=g.rootX-125*g.scale+q.x*360*g.scale;y=g.baseY-290*g.scale+q.y*350*g.scale;c.save();c.translate(x,y);c.rotate(q.r+this.time*.7);c.fillStyle=i%2?'#bb7c32':'#d6a14d';c.globalAlpha=.6*(1-p.night*.7);c.beginPath();c.ellipse(0,0,(1.5+q.z)*g.scale,(3+q.z)*g.scale,0,0,6.283);c.fill();c.restore();}
   else if(snow){c.globalAlpha=alpha*.75;c.fillStyle=p.night>.5?'#c5d9e6':'#fcfdfe';c.beginPath();c.arc(x+Math.sin(this.time*.55+q.r)*7,y,.7+q.z*(1+p.rainPercent/60),0,6.283);c.fill();}
   else{c.globalAlpha=rain.opacity*alpha;c.strokeStyle=p.night>.6?'#a7c0d4':'#4a6b82';c.lineWidth=rain.width*(.6+q.z*.5);const len=rain.length*(.5+q.z*.7);c.beginPath();c.moveTo(x,y);c.lineTo(x+len*(.1+p.wind*.025),y+len);c.stroke();if(rain.splash&&i%12===0){const t=(this.time*1.3+q.r)%1;c.globalAlpha=(1-t)*.18;c.beginPath();c.ellipse(x,g.baseY+20+q.z*70,1+t*9,.5+t*1.5,0,0,6.283);c.stroke();}}
  }c.globalAlpha=1;
  if(p.weather==='fog'||(wet&&rain.percent>60)){
   const a=p.weather==='fog'?.29:rain.veil,base=p.light.night>.5?[67,86,106]:[208,221,228];
   const grad=c.createLinearGradient(0,g.baseY-170,0,g.baseY+100);grad.addColorStop(0,rgba(base,0));grad.addColorStop(.6,rgba(base,a));grad.addColorStop(1,rgba(base,0));c.fillStyle=grad;c.fillRect(0,g.baseY-170,w,270);
  }
  if(p.weather==='storm'&&p.flashes&&!this.still){if(this.time>=this.nextBolt&&!this.bolt)this.makeBolt();if(this.bolt){this.bolt.age+=dt;const t=this.bolt.age/.62;if(t>=1){this.bolt=null;return;}
   const strength=Math.sin(Math.PI*t)**2,[x,y]=this.bolt.main[0];
   // Continuous atmospheric illumination: covers viewport, not a blurred rectangle.
   const glow=c.createRadialGradient(x,y,0,x,y,w*.63);glow.addColorStop(0,rgba([211,226,251],.20*strength));glow.addColorStop(.45,rgba([183,210,242],.06*strength));glow.addColorStop(1,rgba([183,210,242],0));c.fillStyle=glow;c.fillRect(0,0,w,h);
   c.save();c.strokeStyle='#daeafa';c.lineCap='round';c.shadowColor='#9cc9ef';c.shadowBlur=6;
   const stroke=(points,width,alpha)=>{c.lineWidth=width;c.globalAlpha=alpha;c.beginPath();points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.stroke();};stroke(this.bolt.main,1.4,strength*.94);this.bolt.branches.forEach(b=>stroke(b,.7,strength*.63));c.restore();c.globalAlpha=1;
  }}
 }
 inspect(){return {ready:this.ready,error:this.error||null,active:!!this.raf,still:this.still,particles:this.particleCount||0,lightningCount:this.lightningCount,flashActive:!!this.bolt,cloudOffset:this.time*(.7+this.params.wind*.16),weather:this.params.weather,season:this.params.season,month:this.params.month,treeSource:'tree-structure.png',treeArtwork:this.artwork?.stats||null,treeGeometry:this.g?{x:this.g.rootX,y:this.g.baseY,scale:this.g.scale}:null,width:this.w,height:this.h};}
 destroy(){this.alive=false;cancelAnimationFrame(this.raf);this.raf=0;this.bolt=null;this.observer.disconnect();window.removeEventListener('resize',this.onResize);this.motion.removeEventListener('change',this.sync);document.removeEventListener('visibilitychange',this.sync);window.removeEventListener('pagehide',this.hide);window.removeEventListener('pageshow',this.sync);}
}
root.AYYYTreeScene=Scene;
})(window);

