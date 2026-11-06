from pathlib import Path
import base64
import sys
base=Path(__file__).resolve().parent
html=(base/'index.html').read_text(encoding='utf-8')
css=(base/'styles.css').read_text(encoding='utf-8')
js=(base/'app.js').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>\n'+css+'\n</style>')
html=html.replace('<script src="app.js" defer></script>','<script>\n'+js.replace('</script','<\\/script')+'\n</script>')
for name in ['magnifier.webp','monitor.webp']:
 source=base/'assets'/name
 uri='data:image/webp;base64,'+base64.b64encode(source.read_bytes()).decode()
 html=html.replace('assets/'+name,uri)
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else base/'standalone.html'
out.write_text(html,encoding='utf-8')
print(str(out),out.stat().st_size)
