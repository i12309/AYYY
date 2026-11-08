"""Browser parity with the approved v5 artwork and desktop layout.

The API fixture deliberately matches the prototype's sample numbers, solar times,
wind and cloud coverage. Real production data is not replaced by this fixture.
Canvas pixels are compared in the same Chromium run, so no platform PNG golden
or extra image-library dependency is needed. Mobile's newly visible controls are
covered by weather_themes_browser.py rather than the prototype's hidden controls.
Set CHROMIUM_PATH for a custom browser and AYYY_VISUAL_OUTPUT to save screenshots.
"""
from pathlib import Path
import json, mimetypes, os, sys
from urllib.parse import urlsplit,unquote
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
REF=ROOT/'prototypes/weather-tree-v5/reference.html'
OUT=Path(os.environ['AYYY_VISUAL_OUTPUT']) if os.environ.get('AYYY_VISUAL_OUTPUT') else None
if OUT:OUT.mkdir(parents=True,exist_ok=True)
BASE='https://ayyy.test/AYYY/'
CHROME=os.environ.get('CHROMIUM_PATH') or None
start=int(datetime(2026,11,5,21,tzinfo=timezone.utc).timestamp())
clock=start+14*3600
mins=[7,6,5,9,7,-5,1,3,5,4,3,2,1,2]
maxs=[13,12,11,15,13,1,7,9,10,12,11,8,6,7]
codes=[2,61,3,0,2,71,45,2,61,2,0,3,61,2]
pops=[20,80,20,0,20,80,20,30,65,30,10,20,60,30]
winds=[6,7,8,6,7,8,6,5,7,6,4,5,7,5]
base_hours=[6,6,6,6,6,6,7,8,9,10,11,12,12,12,12,13,13,12,11,10,9,8,7,7]
hourly={k:[] for k in ['time','temperature_2m','apparent_temperature','relative_humidity_2m','pressure_msl','cloud_cover','weather_code','wind_speed_10m','wind_direction_10m','wind_gusts_10m','precipitation_probability','precipitation','uv_index','visibility','is_day']}
for d in range(14):
 for h in range(24):
  temp=base_hours[h]+maxs[d]-13
  row={'time':start+d*86400+h*3600,'temperature_2m':temp,'apparent_temperature':temp-2,'relative_humidity_2m':68,'pressure_msl':1017,'cloud_cover':12,'weather_code':codes[d],'wind_speed_10m':4.1,'wind_direction_10m':225,'wind_gusts_10m':7,'precipitation_probability':0 if h<6 else 72 if h>18 else pops[d],'precipitation':0,'uv_index':2.3,'visibility':18000,'is_day':int(7<=h<18)}
  for k in hourly:hourly[k].append(row[k])
daily={'time':[start+n*86400 for n in range(14)],'temperature_2m_min':mins,'temperature_2m_max':maxs,'weather_code':codes,'sunrise':[start+n*86400+452*60 for n in range(14)],'sunset':[start+n*86400+1007*60 for n in range(14)],'precipitation_probability_max':pops,'precipitation_sum':[0,4.8,0,0,0,4.8,0,0,4.8,0,0,0,4.8,0],'wind_speed_10m_max':winds,'uv_index_max':[2.3]*14}
fixture={'timezone':'Europe/Moscow','utc_offset_seconds':10800,'current':{k:v[14] for k,v in hourly.items()},'hourly':hourly,'daily':daily,'current_units':{'precipitation':'mm'},'hourly_units':{'precipitation':'mm'}}
fixture['current']['interval']=900
city={'name':'Москва','country':'Россия','latitude':55.7558,'longitude':37.6176,'timezone':'Europe/Moscow'}
init='''Date.now=()=>CLOCK;
localStorage.setItem('ayyy:v1:weather.city',JSON.stringify(CITY));
localStorage.setItem('ayyy:v1:weather.scene.theme','"tree"');
localStorage.setItem('ayyy:v1:weather.scene.paused','true');
window.fetch=async()=>new Response(JSON.stringify(FIXTURE));
for(const name of ['AYYYTreeScene','AYYYAtmosphere'])Object.defineProperty(window,name,{configurable:true,set(C){Object.defineProperty(window,name,{configurable:true,writable:true,value:new Proxy(C,{construct(T,args){const obj=Reflect.construct(T,args);window.__tree=obj;return obj;}})});}});
'''.replace('CLOCK',str(clock*1000)).replace('CITY',json.dumps(city)).replace('FIXTURE',json.dumps(fixture))
def attach(p,root):
 def serve(r):
  name=unquote(urlsplit(r.request.url).path).removeprefix('/AYYY/') or 'index.html'
  f=REF if name=='reference.html' else (root/name).resolve()
  if f.is_dir():f=f/'index.html'
  if (root in f.parents or f==REF) and f.is_file():r.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(f)[0] or 'text/plain')
  else:r.fulfill(status=404,body='missing')
 p.route(BASE+'**',serve);p.add_init_script(init)
def capture(p,kind,width,height,scale=1):
 errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE+('reference.html' if kind=='reference' else '#weather'))
 if kind=='reference':
  p.wait_for_function('window.AYYYTreePrototype&&window.__tree?.ready')
  p.evaluate('AYYYTreePrototype.setScene({month:9,weather:"clear",minute:1050,paused:true,rainPercent:50})')
 else:
  p.wait_for_function('document.querySelector(".ww-app")?.dataset.sceneTheme==="tree"&&document.querySelector("#ww-source-status")?.dataset.status==="live"')
  p.locator('[data-scene-weather="clear"]').click()
  p.locator('[data-scene-month="9"]').click()
  p.locator('#ww-scene-minute').fill('1050');p.locator('#ww-scene-minute').dispatch_event('input')
  p.locator('#ww-scene-wind').fill('7');p.locator('#ww-scene-wind').dispatch_event('input')
  p.evaluate('document.querySelector("#ww-hour-scroll").scrollLeft=0')
 p.evaluate('scrollTo(0,0);__tree.time=0;__tree.resize();__tree.draw(0)')
 p.wait_for_timeout(250)
 p.mouse.move(1,1);p.locator('body').click(position={'x':1,'y':1})
 if OUT:p.screenshot(path=str(OUT/f'{kind}-{width}.png'),full_page=True)
 sels=['.header','.scene-controls','.weather-columns','.current','.forecast','.center-spacer','.hourly','.current-temperature','.metrics','.daylight'] if kind=='reference' else ['.ww-header','.ww-scene-controls','.ww-main','.ww-current','.ww-period','.ww-center','.ww-hourly','.ww-current-main','.ww-metrics','.ww-daylight']
 result=p.evaluate('''sels=>({geometry:__tree.inspect().treeGeometry,palette:__tree.params.light,els:sels.map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);return [s,{x:r.x,y:r.y,width:r.width,height:r.height,fontSize:c.fontSize,lineHeight:c.lineHeight,fontWeight:c.fontWeight}]}),overflow:document.documentElement.scrollWidth>innerWidth})''',sels)
 result['hashes']=p.evaluate("""async()=>{const r=__tree,h=Math.floor(r.g.artBottom),hashes=[];for(const c of r.canvases){const data=c.getContext('2d').getImageData(0,0,c.width,Math.floor(h*devicePixelRatio)).data;const hash=await crypto.subtle.digest('SHA-256',data);hashes.push([...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join(''));}return hashes;}""")
 result['errors']=errors
 if OUT:(OUT/f'{kind}-{width}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print(kind,width,'geometry',result['geometry'],'overflow',result['overflow'],'errors',errors,flush=True)
 return result
if __name__=='__main__':
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=CHROME,args=['--no-sandbox','--disable-dev-shm-usage'])
  for width,height,scale in [(1122,1047,1.25),(1440,1000,1),(1920,1080,1)]:
   results={}
   for kind in ['reference','integrated']:
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=scale,reduced_motion='reduce')
    page=context.new_page();page.set_default_timeout(30000);attach(page,ROOT)
    results[kind]=capture(page,kind,width,height,scale);context.close()
   ref,actual=results['reference'],results['integrated']
   assert not actual['errors'] and not actual['overflow'],(width,actual['errors'])
   assert actual['geometry']==ref['geometry'],(width,ref['geometry'],actual['geometry'])
   assert actual['palette']==ref['palette'],(width,'palette differs')
   assert actual['hashes']==ref['hashes'],(width,'sky, tree/landscape or atmosphere pixels differ')
   # The forecast column stretches empty space differently. The hourly
   # section also contains the newly visible extra controls below its chart.
   # Both keep the reference origin/width; all other anchors match in full.
   for index,(expected,found) in enumerate(zip(ref['els'],actual['els'])):
    keys=['x','y','width'] if index in (4,6) else ['x','y','width','height']
    assert all(expected[1][k]==found[1][k] for k in keys),(width,expected,found)
   print('PASS v5 geometry, palette, all three canvas layers and layout:',width,flush=True)
  browser.close()
 print('3 v5 desktop visual parity cases PASS')
