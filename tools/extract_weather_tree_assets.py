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
scene=scene.replace("document.querySelector('.center-spacer')","this.layout.querySelector('.ww-center')").replace("document.querySelector('.scene-controls')","this.layout.querySelector('.ww-scene-controls')").replace("document.querySelector('.hourly')","this.layout.querySelector('.ww-hourly')")
# The canvas belongs to the app, not the document. Translate every anchor to
# its local origin once so embedding/scrolling cannot shift the artwork.
scene=scene.replace("const bounds=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,w:r.width,h:r.height,bottom:r.bottom+scrollY};};", "const origin=this.host.getBoundingClientRect();\n  const bounds=e=>{const r=e.getBoundingClientRect();return {x:r.left-origin.left,y:r.top-origin.top,w:r.width,h:r.height,bottom:r.bottom-origin.top};};")
scene=scene.replace('document.documentElement.clientWidth','this.host.clientWidth')
scene=scene.replace('document.body.dataset.motion','this.layout.dataset.treeMotion')
scene=scene.replace("root.AYYY_PROTOTYPE_ASSETS?.[name]||'assets/'+name","new URL(name,this.assetBase).href")
scene=scene.replace('this.artwork=prepareTreeArtwork(this.assets,createCanvas);','this.artwork=preparedArtwork||(preparedArtwork=prepareTreeArtwork(this.assets,createCanvas));')
scene=scene.replace('const rgba=', 'let preparedArtwork=null;\nconst rgba=')
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
scene=scene.replace('root.AYYYAtmosphere=Scene;','root.AYYYTreeScene=Scene;')
(ROOT/'weather/tree-scene.js').write_text(scene,encoding='utf-8',newline='\n')
print('Extracted',len(assets),'approved PNGs and renderer')
