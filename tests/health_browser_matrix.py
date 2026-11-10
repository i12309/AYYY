"""All current screens, keyboard navigation and form labels in three browser engines."""
from pathlib import Path
from urllib.parse import urlsplit
import mimetypes
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='http://localhost:8877/';checks=[]
TABS=['overview','lab','vital','medical','care','nutrition','activity','diary','genetics','document','timeline','profile','recommendations','settings']
def check(label,result):
 assert result,label
 checks.append(label);print('PASS',label,flush=True)
with sync_playwright() as pw:
 for engine in ['chromium','firefox','webkit']:
  b=getattr(pw,engine).launch();ctx=b.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce');errors=[];remote=[]
  def serve(route):
   if not route.request.url.startswith(BASE):remote.append(route.request.url);route.abort();return
   file=(ROOT/urlsplit(route.request.url).path.lstrip('/')).resolve()
   if file.is_dir():file=file/'index.html'
   if ROOT in file.parents and file.is_file():route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'text/plain')
   else:route.fulfill(status=404,body='Missing')
  ctx.route('**/*',serve);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(BASE+'health/?demo=1');p.locator('.health-demo-strip').wait_for()
  for width in [360,768,1440]:
   p.set_viewport_size({'width':width,'height':900})
   for tab in TABS:
    if width<768:p.locator('[data-action=toggle-menu]').click()
    p.locator('.sidebar button[data-tab='+tab+']').click();p.locator('.health-heading h1').wait_for();check(engine+' '+str(width)+' '+tab+' fits',p.evaluate('document.documentElement.scrollWidth<=innerWidth') and p.locator('.health-demo-strip').is_visible())
    missing=p.evaluate('''()=>Array.from(document.querySelectorAll('#health-root input:not([type=hidden]):not([type=submit]),#health-root select,#health-root textarea')).filter(e=>e.getClientRects().length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.closest('label')&&!(e.id&&document.querySelector('label[for="'+e.id+'"]'))).map(e=>e.name||e.dataset.search||e.type)''')
    check(engine+' '+str(width)+' '+tab+' labels controls'+(' MISSING '+','.join(missing) if missing else ''),not missing)
  p.set_viewport_size({'width':1440,'height':900});p.locator('.sidebar button[data-tab=recommendations]').click();p.keyboard.press('/');check(engine+' shortcut focuses global search',p.locator('#health-global-search').evaluate('(e)=>e===document.activeElement'));p.locator('.recommendation-stats [data-action=review-intake]').focus();p.keyboard.press('Enter');p.locator('[data-form=review-intake]').wait_for();check(engine+' keyboard opens questionnaire',p.locator('#health-dialog [name=measurements]').is_visible());p.keyboard.press('Escape');p.locator('#health-dialog').wait_for(state='hidden');check(engine+' escape clears private modal fields',p.locator('#health-dialog textarea').count()==0)
  p.set_viewport_size({'width':360,'height':800});p.locator('[data-action=toggle-menu]').focus();p.keyboard.press('Enter');p.locator('.sidebar').wait_for();p.keyboard.press('Escape');check(engine+' escape closes mobile menu and restores focus',not p.locator('.sidebar').is_visible() and p.locator('[data-action=toggle-menu]').evaluate('(e)=>e===document.activeElement'))
  check(engine+' no remote calls',not remote);check(engine+' no runtime errors',not errors);b.close()
print(len(checks),'browser matrix checks PASS')
