"""Extract the approved v5 PNGs and adapted renderer without regenerating artwork."""
from pathlib import Path
import base64, hashlib, json, re, shutil, sys
ROOT=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'prototypes/weather-tree-v5/reference.html'
raw=source.read_bytes()
if hashlib.sha256(raw).hexdigest()!='4e7eb0cf62c3faf7606ea55b9bc5cbda2fb3d3ff7bf125df98d04cf6057dcc05':
    raise ValueError('Expected approved v5 reference checksum')
reference=ROOT/'prototypes/weather-tree-v5/reference.html';reference.parent.mkdir(parents=True,exist_ok=True)
if source.resolve()!=reference.resolve():shutil.copyfile(source,reference)
scripts=re.findall(r'<script[^>]*>(.*?)</script>',raw.decode('utf-8'),re.S)
assets=json.loads(scripts[0].split('=',1)[1].rstrip(';\r\n '))
out=ROOT/'weather/assets/tree';out.mkdir(parents=True,exist_ok=True)
for name,uri in assets.items():
    (out/name).write_bytes(base64.b64decode(uri.split(',',1)[1]))
palette=scripts[1].replace('AYYYSceneModel','AYYYTreePalette').replace('clamp(sunrise,100,900)','sunrise').replace('Math.max(sr+150,clamp(sunset,300,1320))','sunset').replace('{clamp,lerp,mix,smooth,season,rain,lighting,atmosphere}','{clamp,lerp,mix,smooth,season,rain,lighting,atmosphere,palettes}')
(ROOT/'weather/tree-palette.js').write_text(palette,encoding='utf-8',newline='\n')
scene=scripts[2].replace('root.AYYYSceneModel','root.AYYYTreePalette')
scene=scene.replace('constructor(host,onTick){','constructor(host,layout,assetBase){\n  this.layout=layout;this.assetBase=assetBase;')
scene=scene.replace('this.onTick=onTick;','')
scene=scene.replace("host.querySelector('#'+id)","host.querySelector('[data-layer=\"'+id+'\"]')")
scene=scene.replace("document.querySelector('.page')","this.layout")
scene=scene.replace("document.querySelector('.center-spacer')","this.layout.querySelector('.ww-center')").replace("document.querySelector('.scene-controls')","this.layout.querySelector('.ww-scene-anchor')").replace("document.querySelector('.hourly')","this.layout.querySelector('.ww-hourly')")
# The canvas belongs to the app, not the document. Translate every anchor to
# its local origin once so embedding/scrolling cannot shift the artwork.
scene=scene.replace("const bounds=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,w:r.width,h:r.height,bottom:r.bottom+scrollY};};", "const origin=this.host.getBoundingClientRect();\n  const bounds=e=>{const r=e.getBoundingClientRect();return {x:r.left-origin.left,y:r.top-origin.top,w:r.width,h:r.height,bottom:r.bottom-origin.top};};")
scene=scene.replace('document.documentElement.clientWidth','this.host.clientWidth')
# UI is zoomed independently; the canvas keeps physical viewport coordinates.
scene=scene.replace("const w=this.host.clientWidth,small=w<=1100;", "const frame=this.layout.querySelector('.ww-viewport'),page=bounds(this.layout.querySelector('.ww-page'));\n  const uiScale=parseFloat(this.layout.style.getPropertyValue('--ww-ui-scale'))||1;\n  const w=this.host.clientWidth,small=(frame?.clientWidth||w/uiScale)<=1100;")
scene=scene.replace('spacer.y+4:Math.max(controls.bottom+12,spacer.y+30)', 'spacer.y+4*uiScale:Math.max(controls.bottom+12*uiScale,spacer.y+30*uiScale)')
scene=scene.replace('spacer.bottom-70:hourly.y-81', 'spacer.bottom-70*uiScale:hourly.y-81*uiScale')
scene=scene.replace('Math.max(.38,Math.min((baseY-top)/368,(small?w-30:spacer.w+92)/500,1.28))', 'Math.max(.38*uiScale,Math.min((baseY-top)/368,(small?w-30*uiScale:spacer.w+92*uiScale)/500,1.28*uiScale))')
scene=scene.replace('Math.max(window.innerHeight,hourly.bottom+90)', 'Math.max(window.innerHeight,page.bottom)')
scene=scene.replace('Math.min(hourly.y+40,baseY+145*(w/1672))', 'Math.min(hourly.y+40*uiScale,baseY+145*(w/1672))')
scene=scene.replace('skyBottom:baseY+50,small', 'skyBottom:baseY+50*uiScale,small,uiScale')
scene=scene.replace('Math.min(devicePixelRatio||1,1.5)', 'Math.min(devicePixelRatio||1,2,Math.sqrt((3840*2160)/(g.w*g.h)))')
# Atmospheric heights and soft fades follow the same scale as the composition.
scene=scene.replace('const mask=ctx.createLinearGradient(0,g.artBottom-42,0,g.artBottom+42)', 'const fade=42*(g.uiScale||1),mask=ctx.createLinearGradient(0,g.artBottom-fade,0,g.artBottom+fade)')
scene=scene.replace('ctx.fillRect(0,g.artBottom-42,w,h)', 'ctx.fillRect(0,g.artBottom-fade,w,h)')
scene=scene.replace('skyEnd=Math.max(480,g.skyBottom+180)', 'uiScale=g.uiScale||1,skyEnd=Math.max(480*uiScale,g.skyBottom+180*uiScale)')
scene=scene.replace('Math.min(g.baseY*.91,620)', 'Math.min(g.baseY*.91,620*uiScale)')
scene=scene.replace('const top=-90+k*57;', 'const top=(-90+k*57)*uiScale;')

scene=scene.replace('document.body.dataset.motion','this.layout.dataset.treeMotion')
scene=scene.replace("root.AYYY_PROTOTYPE_ASSETS?.[name]||'assets/'+name","new URL(name,this.assetBase).href")
scene=scene.replace('this.artwork=prepareTreeArtwork(this.assets,createCanvas);','this.artwork=preparedArtwork||(preparedArtwork=prepareTreeArtwork(this.assets,createCanvas));')
scene=scene.replace('const rgba=', 'let preparedArtwork=null,preparedBackgrounds=null;\nconst rgba=')
scene=scene.replace("document.querySelectorAll('img[data-tree-preview]')","this.layout.querySelectorAll('img[data-tree-preview]')")
# Preview winter is the canonical seasonal illustration. The live scene still
# takes its snow coverage from weather data; generating a preview never mutates it.
scene=scene.replace('composeTree(month){','composeTree(month,snowCover=this.params.snowCover){')
scene=scene.replace('else ctx.drawImage(a.snow,0,0);','else if(snowCover)ctx.drawImage(a.snow,0,0);')
preview_start=scene.index(' renderTreePreviews(){')
preview_end=scene.index(' prepareSeason(){',preview_start)
scene=scene[:preview_start]+''' preview(season){
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
'''+scene[preview_end:]
scene=scene.replace("if(s.asset==='winter'){","if(s.asset==='winter'&&this.params.snowCover){")
scene=scene.replace('if(this.params.month!==this.month)this.prepareSeason();','if(this.params.month!==this.month||prev.snowCover!==this.params.snowCover)this.prepareSeason();')
scene=scene.replace('this.params.weather].join', 'this.params.weather,this.params.snowCover].join')
scene=scene.replace('this.drawWorld();this.sync();', 'this.drawWorld();if(prev.paused!==this.params.paused)this.sync();else if(this.still)this.draw(0);')
scene=scene.replace('if(!this.still)this.raf=requestAnimationFrame(this.tick);}', 'if(!this.still&&!this.raf)this.raf=requestAnimationFrame(this.tick);}')
# Retain the approved PNG files while removing baked panorama/cloud boundaries.
background_preparation = '''/* The approved background PNGs contain baked side joins and non-periodic cloud
   edges. Repair only those source boundaries once, before seasonal colouring.
   Blend premultiplied colour so transparent matte pixels cannot add dark halos. */
function prepareSceneBackgrounds(assets, createCanvas) {
  const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  const raster = image => {
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return { canvas, context, pixels: context.getImageData(0, 0, canvas.width, canvas.height) };
  };
  const landscape = image => {
    const { canvas, context, pixels } = raster(image), p = pixels.data, source = p.slice();
    const radius = 48;
    // These are the two joins in the reference's extended 1672px panorama.
    // The central hill, mountains and tree attachment remain pixel-identical.
    for (const join of [150, 1300]) {
      for (let y = 0; y < canvas.height; y++) for (let x = join - radius; x < join + radius; x++) {
        const mirrored = 2 * join - 1 - x;
        const a = (y * canvas.width + Math.min(x, mirrored)) * 4;
        const b = (y * canvas.width + Math.max(x, mirrored)) * 4;
        const target = (y * canvas.width + x) * 4, t = smooth((x - join + radius) / (radius * 2 - 1));
        const left = source[a + 3] * (1 - t), right = source[b + 3] * t, alpha = left + right;
        for (let channel = 0; channel < 3; channel++) p[target + channel] = alpha ? (source[a + channel] * left + source[b + channel] * right) / alpha : 0;
        p[target + 3] = alpha;
      }
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
  };
  const cloud = image => {
    const { canvas, context, pixels } = raster(image), p = pixels.data;
    const band = 64;
    for (let y = 0; y < canvas.height; y++) {
      // Every cloud may cross the viewport top; no opaque rectangular edge.
      const top = smooth(y / band);
      for (let x = 0; x < canvas.width; x++) p[(y * canvas.width + x) * 4 + 3] *= top;
      // Match both sides of the repeating field without a dark transparent gap.
      for (let x = 0; x < band; x++) {
        const a = (y * canvas.width + x) * 4 + 3, b = (y * canvas.width + canvas.width - 1 - x) * 4 + 3;
        const left = p[a], right = p[b], t = (1 - smooth(x / (band - 1))) * .5;
        p[a] = left * (1 - t) + right * t;
        p[b] = right * (1 - t) + left * t;
      }
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
  };
  return {
    mountains: landscape(assets['mountains.png']), terrain: landscape(assets['terrain.png']),
    clouds: [0, 1, 2].map(i => cloud(assets['cloud-field-' + i + '.png']))
  };
}
'''
scene=scene.replace('/* Prepare once.',background_preparation+'/* Prepare once.')
scene=scene.replace('this.artwork=preparedArtwork||(preparedArtwork=prepareTreeArtwork(this.assets,createCanvas));','this.artwork=preparedArtwork||(preparedArtwork=prepareTreeArtwork(this.assets,createCanvas));this.backgrounds=preparedBackgrounds||(preparedBackgrounds=prepareSceneBackgrounds(this.assets,createCanvas));')
scene=scene.replace("tc.drawImage(this.assets['terrain.png'],0,0)","tc.drawImage(this.backgrounds.terrain,0,0)")
scene=scene.replace("this.tint(this.assets['mountains.png'],l)","this.tint(this.backgrounds.mountains,l)")
scene=scene.replace("const img=this.assets['cloud-field-'+i+'.png']","const img=this.backgrounds.clouds[i]")
scene=scene.replace('root.AYYYAtmosphere=Scene;','root.AYYYTreeScene=Scene;')
(ROOT/'weather/tree-scene.js').write_text(scene,encoding='utf-8',newline='\n')
print('Extracted',len(assets),'approved PNGs and renderer')
