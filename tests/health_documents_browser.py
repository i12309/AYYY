"""Synthetic local document import, OCR, queue and provenance regression tests."""
import io, zipfile, mimetypes, base64
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from health_browser_support import launch_browser,capture,fill_home_value

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
 return pdf_objects(objects)
def pdf_objects(objects):
 output=b'%PDF-1.4\n';offsets=[]
 for i,obj in enumerate(objects):offsets.append(len(output));output+=f'{i+1} 0 obj\n'.encode()+obj+b'\nendobj\n'
 at=len(output);output+=f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()+b''.join(f'{o:010} 00000 n \n'.encode() for o in offsets)+f'trailer << /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{at}\n%%EOF'.encode()
 return output
def scan_pdf(jpeg):
 commands=b'q 600 0 0 210 0 0 cm /Scan Do Q'
 def stream(attributes,data):
  return b'<< '+attributes+b' /Length '+str(len(data)).encode()+b' >>\nstream\n'+data+b'\nendstream'
 return pdf_objects([
  b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 210] /Resources << /XObject << /Scan 4 0 R >> >> /Contents 5 0 R >>',
  stream(b'/Type /XObject /Subtype /Image /Width 1200 /Height 420 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode',jpeg),
  stream(b'',commands),
 ])
with sync_playwright() as pw:
 browser=launch_browser(pw);ctx=browser.new_context(viewport={'width':1440,'height':1000});errors=[];remote=[]
 def serve(route):
  if route.request.url.startswith('blob:'+BASE):route.continue_();return
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
  p.locator('[data-form=document-mapping] [type=submit]').click()
  p.wait_for_function('''()=>document.querySelector('[data-form=document-review]')||document.querySelector('[data-form=document-mapping] [role=alert]:not([hidden])')''')
  assert p.locator('[data-form=document-review]').count(),p.locator('[data-form=document-mapping]').inner_text()
 def save():
  p.locator('[data-form=document-review] [type=submit]').click();p.locator('#health-dialog').wait_for(state='hidden')
 baseline=p.locator('.analyte-groups tbody tr').count();payload=workbook();upload('synthetic.xlsx',payload,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
 check('XLSX cached formula read without execution','Synthetic XLSX marker' in p.locator('[data-form=document-mapping]').inner_text())
 draft();check('review uses wide workspace',p.locator('#health-dialog').bounding_box()['width']>=1100);check('table scroll stays inside dialog',p.locator('#health-dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth'));(ROOT/'docs/health-ui').mkdir(parents=True,exist_ok=True);capture(p,path=str(ROOT/'docs/health-ui/import-review-1440.png'),full_page=True);check('source file not committed before confirmation',p.locator('.analyte-groups tbody tr').count()==baseline)
 p.locator('[name="0:value"]').fill('3.5');save();check('XLSX confirmed editable value saved','Synthetic XLSX marker' in p.locator('.analyte-groups').inner_text())
 upload('synthetic.xlsx',payload,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');draft();check('reimport identifies source row duplicates',p.locator('[name=selected]:disabled').count()==1);p.locator('#health-dialog [data-action=close-dialog]').click()
 upload('synthetic.pdf',pdf(),'application/pdf');p.locator('[data-form=document-mapping] [name=sheet]').select_option('1');check('blank PDF page has no automatic mapping',p.locator('[data-form=document-mapping] [type=submit]').is_disabled())
 p.get_by_text('Показать оригинал',exact=True).click()
 p.get_by_role('img',name='Страница 2 из 2').wait_for()
 p.locator('[data-action=import-manual]').click()
 manual=p.locator('[data-form=document-review]')
 manual.locator('[name="0:name"]').fill('Synthetic manual PDF marker')
 manual.locator('[name="0:value"]').fill('4.2')
 p.locator('[data-action=import-add-manual]').click()
 check('adding a manual row preserves edits and leaves both rows unselected',manual.locator('[name="0:value"]').input_value()=='4.2' and manual.locator('[name=selected]').count()==2 and manual.locator('[name=selected]:checked').count()==0)
 manual.locator('[name=selected]').first.check();save()
 p.locator('.group-name').filter(has_text='Synthetic manual PDF marker').click()
 origin=p.locator('.analyte-origin').inner_text()
 check('manual PDF import retains the page without fabricated coordinates','Страница 2' in origin and 'Введено вручную из бланка' in origin and 'колонка' not in origin)
 p.locator('.sidebar button[data-tab=lab]').click()
 upload('synthetic.pdf',pdf(),'application/pdf');draft();save();check('PDF text columns become confirmed record','Synthetic PDF marker' in p.locator('.analyte-groups').inner_text())
 p.locator('.group-name').filter(has_text='Synthetic PDF marker').click();p.locator('.analyte-source [data-action=file-preview]').click();p.locator('.health-pdf-pages canvas').wait_for()
 capture(p,path=str(ROOT/'docs/health-ui/pdf-preview-1440.png'),full_page=True)
 check('PDF preview renders locally','Страница 1 из 2' in p.locator('.health-document-preview').inner_text())
 p.get_by_role('button',name='Вперёд →').click();p.get_by_text('Страница 2 из 2',exact=True).wait_for();check('PDF page navigation',p.locator('.health-pdf-pages canvas').count()==1);p.locator('#health-dialog [data-action=close-dialog]').click()
 p.locator('.sidebar button[data-tab=lab]').click()
 matching=b'name;value;date;unit\nSYNTHETIC PDF MARKER;4,00;01.11.2026;mg\n'
 upload('another-format.csv',matching,'text/csv');draft()
 review=p.locator('[data-form=document-review]')
 check('cross-format matches require review',review.locator('[name=selected]:checked').count()==0 and 'Возможный дубль' in review.inner_text())
 review.locator('[name=selected]').check();review.locator('[type=submit]').click()
 check('possible duplicate cannot be confirmed without a decision',review.get_by_role('alert').is_visible())
 link=review.locator('[name="0:decision"] option').last.get_attribute('value')
 check('possible duplicate identifies an existing measurement',link.startswith('link:'))
 review.locator('[name="0:decision"]').select_option(link);save()
 p.locator('.group-name').filter(has_text='Synthetic PDF marker').click()
 p.get_by_text('Связанные источники (1)',exact=True).click()
 check('link preserves source without creating a measurement',p.locator('.analyte-history tbody tr').count()==1 and 'another-format.csv' in p.locator('.health-linked-sources').inner_text())
 p.locator('.health-linked-sources [data-action=file-preview]').click()
 check('linked original is readable',matching.decode().strip() in p.locator('.health-document-preview pre').inner_text())
 p.locator('#health-dialog [data-action=close-dialog]').click();p.locator('.sidebar button[data-tab=lab]').click()
 upload('linked-copy.csv',matching,'text/csv');draft()
 check('a linked source coordinate is idempotent',review.locator('[name=selected]:disabled').count()==1)
 p.locator('#health-dialog [data-action=close-dialog]').click()
 upload('same-measurement.csv',matching+b'\n','text/csv');draft()
 review.locator('[name=selected]').check();review.locator('[name="0:decision"]').select_option('separate');save()
 p.locator('.group-name').filter(has_text='Synthetic PDF marker').click()
 check('an explicit separate decision creates a second measurement',p.locator('.analyte-history tbody tr').count()==2)
 check('matching respects known units, dates and lab context',p.evaluate('''()=>{
  const row={name:'Marker',value:'≤ 2,5',date:'2026-11',unit:'mM',source:'Alpha',material:'Serum',method:'A'};
  const index=HumanImportTable.duplicateIndex([row]);
  return index.matches({...row,value:'<=2.50',source:''}).length===1&&
   [{unit:'MM'},{date:'2026-11-01'},{source:'Beta'},{material:'Plasma'},{method:'B'},{value:'<2.5'}]
    .every(change=>index.matches({...row,...change}).length===0);
 }'''))
 p.locator('.sidebar button[data-tab=lab]').click()
 repeated=b'name;value;date;unit\nSynthetic in-file marker;4;2026-11-02;mg\nSynthetic in-file marker;4;2026-11-02;mg'
 upload('repeated-rows.csv',repeated,'text/csv');draft();review.locator('[type=submit]').click()
 check('two matching rows cannot slip through the same confirmation',review.get_by_role('alert').is_visible() and not p.locator('.analyte-groups').get_by_text('Synthetic in-file marker').count())
 review.locator('[name="1:decision"]').select_option('separate');save()
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
 p.locator('.sidebar button[data-tab=lab]').click()
 wide=b'name;unit;05/06/2026;2026-06-08\nSynthetic wide;mg;12;15\nSynthetic sparse;mg;;8'
 with p.expect_file_chooser() as chooser:p.locator('[data-action=csv]').click()
 chooser.value.set_files([
  {'name':'wide.csv','mimeType':'text/csv','buffer':wide},
  {'name':'broken.csv','mimeType':'text/csv','buffer':b'name;value\n"unfinished'},
  {'name':'wide-copy.csv','mimeType':'text/csv','buffer':wide},
 ])
 queue=p.locator('.health-import-queue');queue.wait_for()
 p.set_viewport_size({'width':360,'height':900})
 check('batch queue fits phone',p.locator('#health-dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth'))
 p.set_viewport_size({'width':1440,'height':1000})
 def queue_entry(name):return queue.locator('li').filter(has=p.get_by_text(name,exact=True))
 def open_entry(name):queue_entry(name).locator('[data-action=import-open-file]').click()
 open_entry('wide.csv')
 mapping=p.locator('[data-form=document-mapping]')
 check('date headers are auto-detected',mapping.locator('[name=layout]').input_value()=='dates_in_columns')
 mapping.locator('[type=submit]').click()
 check('slash dates require explicit order',mapping.get_by_role('alert').is_visible())
 mapping.locator('[name=dateOrder]').select_option('dmy');draft()
 check('wide dates expand source cells and skip blanks',p.locator('[name=selected]:checked').count()==3 and
       [p.locator(f'[name="{i}:date"]').input_value() for i in range(3)]==['2026-06-05','2026-06-08','2026-06-08'])
 p.locator('[name="0:value"]').fill('12.25');p.locator('[data-action=import-queue]').click()
 open_entry('broken.csv');queue.wait_for()
 check('invalid file is isolated in the queue','Незакрытая кавычка CSV' in queue_entry('broken.csv').inner_text())
 queue_entry('broken.csv').locator('[data-action=import-skip-file]').click()
 open_entry('wide.csv')
 check('batch retains unsaved edits',p.locator('[name="0:value"]').input_value()=='12.25')
 p.locator('[data-form=document-review] [type=submit]').click();queue.wait_for()
 check('batch marks confirmed results per file','Сохранено результатов: 3' in queue_entry('wide.csv').inner_text())
 open_entry('wide-copy.csv');mapping.locator('[name=dateOrder]').select_option('dmy');draft()
 check('wide results are deduplicated by source cell',p.locator('[name=selected]:disabled').count()==3)
 p.locator('#health-dialog [data-action=close-dialog]').click()
 encoded=p.evaluate('''()=>{
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=420;
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,420);
  ctx.font='44px Arial';ctx.fillStyle='black';
  [['name','value','date'],['Глюкоза','54','2026-11-01']].forEach((row,y)=>row.forEach((text,x)=>ctx.fillText(text,[65,570,820][x],120+y*130)));
  return [canvas.toDataURL('image/png'),canvas.toDataURL('image/jpeg',.95)].map(url=>url.split(',')[1]);
 }''')
 png,jpeg=[base64.b64decode(value) for value in encoded]
 upload('synthetic.png',png,'image/png');mapping.locator('[name=name]').select_option('0');draft()
 check('local PNG OCR recognizes Russian and a result',p.locator('[name="0:name"]').input_value()=='Глюкоза' and p.locator('[name="0:value"]').input_value()=='54')
 check('OCR requires explicit per-result selection',p.locator('[name=selected]:checked').count()==0)
 p.locator('[name=selected]').first.check();save()
 check('standalone JPEG is recognized',p.evaluate('''async encoded=>{
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  const table=(await HumanDocuments.read(new File([bytes],'local.jpeg',{type:'image/jpeg'}))).tables[0];
  return table.ocr&&table.rows[1][1]==='54'&&table.provenance[1][1].kind==='ocr';
 }''',encoded[1]))
 upload('synthetic-scan.pdf',scan_pdf(jpeg),'application/pdf');mapping.locator('[name=name]').select_option('0');draft()
 check('image-only PDF is recognized with the same confirmation gate',p.locator('[name="0:value"]').input_value()=='54' and p.locator('[name=selected]:checked').count()==0)
 p.locator('#health-dialog [data-action=close-dialog]').click()
 p.locator('.sidebar button[data-tab=document]').click()
 p.locator('[data-action=new-document]').first.click()
 with p.expect_file_chooser() as camera:p.locator('[data-action=capture-document]').click()
 check('document camera offers a rear-facing image picker',camera.value.element.get_attribute('capture')=='environment' and camera.value.element.get_attribute('accept')=='image/jpeg,image/png')
 camera.value.set_files({'name':'synthetic-camera-doc.png','mimeType':'image/png','buffer':png})
 p.locator('#health-dialog [type=submit]').click();p.locator('#health-dialog').wait_for(state='hidden')
 check('a camera file saves through the existing document form','synthetic-camera-doc.png' in p.locator('.documents-table').inner_text())
 # The same import runs against an actual encrypted IndexedDB vault.
 v=ctx.new_page();v.on('pageerror',lambda e:errors.append(str(e)));v.goto(BASE+'health/')
 v.locator('[data-form=create] [name=password]').fill('synthetic-document-password');v.locator('[name=repeat]').fill('synthetic-document-password');v.locator('[data-form=create] [type=submit]').click();v.locator('.metric').first.wait_for();v.locator('.sidebar button[data-tab=lab]').click()
 with v.expect_file_chooser() as chooser:v.locator('[data-action=csv]').click()
 chooser.value.set_files({'name':'encrypted-source.csv','mimeType':'text/csv','buffer':b'name;value;date;unit\nSynthetic persisted file;5;2026-11-01;mg'})
 v.locator('[data-form=document-mapping] [type=submit]').click();v.locator('[data-form=document-review] [type=submit]').click();v.locator('#health-dialog').wait_for(state='hidden')
 with v.expect_file_chooser() as chooser:v.locator('[data-action=csv]').click()
 chooser.value.set_files({'name':'encrypted-link.csv','mimeType':'text/csv','buffer':b'name;value;date;unit\nSynthetic persisted file;5.0;2026-11-01;mg'})
 v.locator('[data-form=document-mapping] [type=submit]').click();v.locator('[name=selected]').check()
 v.locator('[name="0:decision"]').select_option(v.locator('[name="0:decision"] option').last.get_attribute('value'))
 v.locator('[data-form=document-review] [type=submit]').click();v.locator('#health-dialog').wait_for(state='hidden')
 v.reload();v.locator('[data-form=unlock] [name=passphrase]').fill('synthetic-document-password');v.locator('[data-form=unlock] [type=submit]').click();v.locator('.metric').first.wait_for();v.locator('.sidebar button[data-tab=lab]').click();v.locator('.group-name').click();v.locator('.analyte-source > [data-action=file-preview]').click()
 check('attachment and record link survive encrypted reload','Synthetic persisted file;5;2026-11-01;mg' in v.locator('.health-document-preview pre').inner_text())
 v.locator('#health-dialog [data-action=close-dialog]').click();v.get_by_text('Связанные источники (1)',exact=True).click()
 v.locator('.health-linked-sources [data-action=file-preview]').click()
 check('additional source and original bytes survive encrypted reload',v.locator('.analyte-history tbody tr').count()==1 and 'Synthetic persisted file;5.0;2026-11-01;mg' in v.locator('.health-document-preview pre').inner_text())
 v.locator('#health-dialog [data-action=close-dialog]').click();v.locator('.sidebar button[data-tab=lab]').click()
 v.evaluate("()=>{HumanOCR.recognize=async()=>{throw Error('Synthetic OCR unavailable');};}")
 with v.expect_file_chooser() as camera:v.locator('[data-action=capture-import]').click()
 check('lab camera requests a single image from the rear-facing picker',camera.value.element.get_attribute('capture')=='environment' and camera.value.element.get_attribute('multiple') is None)
 camera.value.set_files({'name':'synthetic-ocr-failure.png','mimeType':'image/png','buffer':png})
 v.get_by_text('Synthetic OCR unavailable',exact=True).wait_for()
 v.get_by_text('Показать оригинал',exact=True).click();v.get_by_role('img',name='Оригинал изображения').wait_for()
 v.locator('[data-action=import-manual]').click()
 v.locator('[name="0:name"]').fill('Synthetic manual camera marker');v.locator('[name="0:value"]').fill('8.5')
 v.locator('[data-action=save-import-draft]').click();v.get_by_text('Черновик зашифрован и сохранён на этом устройстве.',exact=True).wait_for()
 v.reload();v.locator('[name=passphrase]').fill('synthetic-document-password');v.locator('[data-form=unlock] [type=submit]').click()
 v.locator('.sidebar button[data-tab=lab]').click();v.locator('[data-action=open-import-draft]').click()
 check('manual camera draft survives reload without running OCR again',v.locator('[name="0:value"]').input_value()=='8.5' and not v.locator('[name=selected]').is_checked())
 v.locator('[name=selected]').check();v.locator('[data-form=document-review] [type=submit]').click();v.locator('#health-dialog').wait_for(state='hidden')
 v.locator('.group-name').filter(has_text='Synthetic manual camera marker').click();v.locator('.analyte-source > [data-action=file-preview]').click()
 try:v.wait_for_function("()=>document.querySelector('.health-document-preview img')?.naturalWidth>0",timeout=10000)
 except Exception as error:
  raise RuntimeError({'dialog':v.locator('#health-dialog').inner_text(),'image':v.locator('.health-document-preview img').count(),'unexpected_requests':remote,'page_errors':errors}) from error
 check('camera original remains attached after manual import',v.locator('.health-document-preview img').is_visible())
 v.locator('#health-dialog [data-action=close-dialog]').click();v.locator('.sidebar button[data-tab=lab]').click()
 with v.expect_file_chooser() as late:v.locator('[data-action=capture-import]').click()
 v.evaluate("document.querySelector('.sidebar [data-action=lock]').click()")
 late.value.set_files({'name':'synthetic-late-photo.png','mimeType':'image/png','buffer':png})
 check('a camera selection from a locked session cannot open the import',v.locator('[data-form=unlock]').is_visible() and not v.locator('#health-dialog').is_visible())
 check('no external requests',not remote);check('no runtime errors',not errors);browser.close()
print(len(checks),'document checks PASS')
