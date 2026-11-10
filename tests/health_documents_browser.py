"""Synthetic local PDF/XLSX/CSV import, preview and provenance regression tests."""
import io, zipfile, mimetypes, base64
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1];BASE='http://localhost:8877/';checks=[]
def check(label,result):
 assert result,label
 checks.append(label);print('PASS',label,flush=True)
def workbook():
 data=io.BytesIO()
 with zipfile.ZipFile(data,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('xl/workbook.xml','<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Synthetic" r:id="r1"/></sheets></workbook>')
  z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>')
  z.writestr('xl/worksheets/sheet1.xml','<worksheet><sheetData><row r="1">'+''.join(f'<c r="{col}1" t="inlineStr"><is><t>{value}</t></is></c>' for col,value in zip('ABCD',['name','value','date','unit']))+'</row><row r="2"><c r="A2" t="inlineStr"><is><t>Synthetic XLSX marker</t></is></c><c r="B2"><f>1+2</f><v>3</v></c><c r="C2" t="inlineStr"><is><t>2026-11</t></is></c><c r="D2" t="inlineStr"><is><t>mg</t></is></c></row></sheetData></worksheet>')
 return data.getvalue()
def pdf():
 objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
 commands=[]
 for y,values in [(750,['name','value','date','unit']),(720,['Synthetic PDF marker','4','2026-11-01','mg'])]:
  for x,value in zip([30,260,350,480],values):commands.append(f'BT /F1 12 Tf 1 0 0 1 {x} {y} Tm ({value}) Tj ET')
 stream='\n'.join(commands).encode();objects.append(b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream')
 objects.append(b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>')
 objects.append(b'<< /Length 0 >>\nstream\n\nendstream')
 output=b'%PDF-1.4\n';offsets=[]
 for i,obj in enumerate(objects):offsets.append(len(output));output+=f'{i+1} 0 obj\n'.encode()+obj+b'\nendobj\n'
 at=len(output);output+=f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()+b''.join(f'{o:010} 00000 n \n'.encode() for o in offsets)+f'trailer << /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{at}\n%%EOF'.encode()
 return output
with sync_playwright() as pw:
 browser=pw.chromium.launch();ctx=browser.new_context(viewport={'width':1440,'height':1000});errors=[];remote=[]
 def serve(route):
  if not route.request.url.startswith(BASE):remote.append(route.request.url);route.abort();return
  file=(ROOT/urlsplit(route.request.url).path.lstrip('/')).resolve()
  if file.is_dir():file=file/'index.html'
  if ROOT in file.parents and file.is_file():route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
  else:route.fulfill(status=404,body='Missing')
 ctx.route('**/*',serve);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(BASE+'health/?demo=1');p.locator('.metric').first.wait_for();p.locator('.sidebar button[data-tab=lab]').click()
 def upload(name,buffer,mime):
  p.locator('#health-notice').evaluate('(e)=>e.classList.remove("show")')
  with p.expect_file_chooser() as chooser:p.locator('[data-action=csv]').click()
  chooser.value.set_files({'name':name,'mimeType':mime,'buffer':buffer})
  p.wait_for_function("()=>document.querySelector('[data-form=document-mapping]')||document.querySelector('#health-notice.show')");assert p.locator('[data-form=document-mapping]').count(),p.locator('#health-notice').inner_text()
  p.set_viewport_size({'width':360,'height':900});check('mapping fits phone',p.evaluate('document.documentElement.scrollWidth<=innerWidth'));p.set_viewport_size({'width':1440,'height':1000})
 def draft():
  p.locator('[data-form=document-mapping] [type=submit]').click();p.locator('[data-form=document-review]').wait_for()
 def save():
  p.locator('[data-form=document-review] [type=submit]').click();p.locator('#health-dialog').wait_for(state='hidden')
 baseline=p.locator('.analyte-groups tbody tr').count();payload=workbook();upload('synthetic.xlsx',payload,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
 check('XLSX cached formula read without execution','Synthetic XLSX marker' in p.locator('[data-form=document-mapping]').inner_text())
 draft();check('review uses wide workspace',p.locator('#health-dialog').bounding_box()['width']>=1100);check('table scroll stays inside dialog',p.locator('#health-dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth'));(ROOT/'docs/health-ui').mkdir(parents=True,exist_ok=True);p.screenshot(path=str(ROOT/'docs/health-ui/import-review-1440.png'),full_page=True);check('source file not committed before confirmation',p.locator('.analyte-groups tbody tr').count()==baseline)
 p.locator('[name="0:value"]').fill('3.5');save();check('XLSX confirmed editable value saved','Synthetic XLSX marker' in p.locator('.analyte-groups').inner_text())
 upload('synthetic.xlsx',payload,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');draft();check('reimport identifies source row duplicates',p.locator('[name=selected]:disabled').count()==1);p.locator('#health-dialog [data-action=close-dialog]').click()
 upload('synthetic.pdf',pdf(),'application/pdf');p.locator('[data-form=document-mapping] [name=sheet]').select_option('1');check('blank PDF page requires another sheet',p.locator('[data-form=document-mapping] [type=submit]').is_disabled());p.locator('[data-form=document-mapping] [name=sheet]').select_option('0');draft();save();check('PDF text columns become confirmed record','Synthetic PDF marker' in p.locator('.analyte-groups').inner_text())
 p.locator('.group-name').filter(has_text='Synthetic PDF marker').click();p.locator('.analyte-source [data-action=file-preview]').click();p.locator('.health-pdf-pages canvas').wait_for()
 p.screenshot(path=str(ROOT/'docs/health-ui/pdf-preview-1440.png'),full_page=True)
 check('PDF preview renders locally','Страница 1 из 2' in p.locator('.health-document-preview').inner_text())
 p.get_by_role('button',name='Вперёд →').click();p.get_by_text('Страница 2 из 2',exact=True).wait_for();check('PDF page navigation',p.locator('.health-pdf-pages canvas').count()==1);p.locator('#health-dialog [data-action=close-dialog]').click()
 p.locator('.sidebar button[data-tab=lab]').click();upload('synthetic.csv',b'name;value;date;unit\nSynthetic censored;<0.1;;mg\nSynthetic invalid;3;2026-02-30;mg','text/csv');draft()
 check('invalid dates require correction before selection',p.locator('[name=selected]:checked').count()==1)
 save();p.locator('.group-name').filter(has_text='Synthetic censored').click();check('unknown date and censoring retained','Дата неизвестна' in p.locator('.analyte-source').inner_text() and '<0.1' in p.locator('.analyte-source').inner_text())
 p.locator('.sidebar button[data-tab=lab]').click();p.locator('.group-name').filter(has_text='Synthetic XLSX marker').click()
 check('Excel partial date retained','11.2026' in p.locator('.analyte-source').inner_text())
 check('raw formula retained by XLSX reader',p.evaluate("async b=>(await HumanDocuments.xlsx(Uint8Array.from(atob(b),c=>c.charCodeAt(0))))[0].provenance[1][1].formula==='1+2'",base64.b64encode(payload).decode()))
 corrupted=bytearray(payload);corrupted[60]^=0x40
 check('corrupt XLSX rejected',p.evaluate("async b=>{try{await HumanDocuments.xlsx(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));return false;}catch{return true;}}",base64.b64encode(corrupted).decode()))
 for width in [360,768,1440]:
  p.set_viewport_size({'width':width,'height':900});check('detail fits '+str(width),p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 # The same import runs against an actual encrypted IndexedDB vault.
 v=ctx.new_page();v.on('pageerror',lambda e:errors.append(str(e)));v.goto(BASE+'health/')
 v.locator('[data-form=create] [name=password]').fill('synthetic-document-password');v.locator('[name=repeat]').fill('synthetic-document-password');v.locator('[data-form=create] [type=submit]').click();v.locator('.metric').first.wait_for();v.locator('.sidebar button[data-tab=lab]').click()
 with v.expect_file_chooser() as chooser:v.locator('[data-action=csv]').click()
 chooser.value.set_files({'name':'encrypted-source.csv','mimeType':'text/csv','buffer':b'name;value;date;unit\nSynthetic persisted file;5;2026-11-01;mg'})
 v.locator('[data-form=document-mapping] [type=submit]').click();v.locator('[data-form=document-review] [type=submit]').click();v.locator('#health-dialog').wait_for(state='hidden')
 v.reload();v.locator('[data-form=unlock] [name=passphrase]').fill('synthetic-document-password');v.locator('[data-form=unlock] [type=submit]').click();v.locator('.metric').first.wait_for();v.locator('.sidebar button[data-tab=lab]').click();v.locator('.group-name').click();v.locator('[data-action=file-preview]').click()
 check('attachment and record link survive encrypted reload','Synthetic persisted file;5;2026-11-01;mg' in v.locator('.health-document-preview pre').inner_text())
 check('no external requests',not remote);check('no runtime errors',not errors);browser.close()
print(len(checks),'document checks PASS')
