/* Reviewable, local-only document import. Commit is atomic through the vault controller. */
(() => {
 'use strict';
 const A=window.HumanAnalytes,T=window.HumanImportTable;
 const fields=[['name','Показатель'],['value','Результат'],['date','Дата'],['unit','Единица'],['low','Референс от'],['high','Референс до'],['source','Лаборатория'],['material','Материал'],['method','Метод'],['notes','Примечание']];
 const aliases={name:['name','показатель','название','анализ'],value:['value','result','результат','значение'],date:['date','дата'],unit:['unit','единица','ед.изм.'],low:['low','min','мин','нижняя граница'],high:['high','max','макс','верхняя граница'],source:['source','laboratory','источник','лаборатория'],material:['material','материал'],method:['method','метод'],notes:['notes','комментарий','примечание']};
 async function open(files,{V,M,dialog,commit,getDoc,isCurrent=()=>true}){
  if(!files.length)return;
  if(files.length>100||files.reduce((size,file)=>size+file.size,0)>128*1024*1024)
   throw Error('Выберите до 100 файлов общим размером до 128 МиБ.');
  const identity=getDoc()?.id;if(!identity)throw Error('Сначала откройте журнал.');
  const entries=files.map(file=>({name:file.name,file})),single=entries.length===1,controller=new AbortController();
  const body=document.getElementById('health-dialog-body');dialog.classList.add('health-import-dialog');
  const active=()=>dialog.open&&!controller.signal.aborted&&isCurrent()&&getDoc()?.id===identity;
  window.addEventListener('pagehide',()=>controller.abort(),{once:true,signal:controller.signal});
  dialog.addEventListener('close',()=>{controller.abort();dialog.classList.remove('health-import-dialog');entries.length=0;},{once:true});
  function frame(title){const content=V.h('div',{class:'health-modal-content'});body.replaceChildren(V.h('div',{class:'health-modal-head'},V.h('h2',{},title),V.button('×','close-dialog',{'aria-label':'Закрыть импорт'})),content);return content;}
  function action(label,key,run,attrs={}){
   const button=V.button(label,key,attrs);
   button.addEventListener('click',event=>{event.stopPropagation();if(active())run();});
   return button;
  }
  function queue(){
   const content=frame('Очередь импорта');
   content.append(V.h('p',{class:'health-note'},'Проверяйте и сохраняйте результаты по каждому файлу. При закрытии окна несохранённые черновики удаляются.'),
    V.h('ul',{class:'health-import-queue'},entries.map(entry=>{
     const status=entry.done!=null?[entry.done?`Сохранено результатов: ${entry.done}`:'',entry.linked?`Связано источников: ${entry.linked}`:''].filter(Boolean).join(' · '):entry.skipped?'Пропущен':entry.error||(entry.view?'Готов к проверке':'Ожидает');
     return V.h('li',{},V.h('div',{},V.h('strong',{},entry.name),V.h('small',{},status)),entry.done!=null||entry.skipped?null:
      V.h('div',{class:'health-import-queue-actions'},action(entry.view?'Продолжить':entry.error?'Повторить':'Открыть','import-open-file',()=>void load(entry),{class:'small'}),
       action('Пропустить','import-skip-file',()=>{entry.file=null;entry.view=null;entry.refreshReview=null;entry.error=null;entry.skipped=true;queue();},{class:'small'})));
    })));
  }
  async function load(entry){
   if(entry.view){body.replaceChildren(...entry.view);entry.view=null;entry.refreshReview?.();return;}
   const content=frame('Чтение файла'),status=V.h('p',{class:'health-note',role:'status'},'Чтение '+entry.name);
   content.append(status);
   const reader=new AbortController(),abort=()=>reader.abort();
   controller.signal.addEventListener('abort',abort,{once:true});
   if(!single)content.append(action('Отменить чтение','import-cancel-read',abort));
   try{
    const original=await HumanDocuments.read(entry.file,{signal:reader.signal,onProgress:message=>{status.textContent=message;}});
    reader.signal.throwIfAborted();
    if(!active())return;
    if(!original.tables.length)throw Error('В файле нет таблиц.');
    edit(entry,original);
    entry.file=null;entry.error=null;
   }catch(error){
    if(!active())return;
    if(single){dialog.close();throw error;}
    entry.error=reader.signal.aborted?null:error.message;
    queue();
   }finally{controller.signal.removeEventListener('abort',abort);}
  }
  function edit(entry,original){
  let sheet=0,header=1,mapping,layout,order='',fallbackDate='',drafts=[],busy=false;
  function navigation(content){
   if(!single)content.append(action('К очереди','import-queue',()=>{
    if(busy)return;
    entry.view=[...body.childNodes];queue();
   }));
  }
  function readOptions(form){
   const input=new FormData(form);
   order=String(input.get('dateOrder')||'');
   if(input.has('fallbackDate'))fallbackDate=String(input.get('fallbackDate')||'');
   for(const [key] of fields)if(input.has(key))mapping[key]=Number(input.get(key));
   return input;
  }
  function choose(){
   entry.refreshReview=null;
   const table=original.tables[sheet];
   const content=frame('Сопоставление колонок'),labels=table.rows[header-1]||[],width=Math.max(0,...table.rows.map(r=>r.length));
   navigation(content);
   mapping??=Object.fromEntries(fields.map(([key])=>[key,labels.findIndex(x=>(aliases[key]||[]).includes(x.trim().toLocaleLowerCase('ru-RU')))]));
   layout??=T.suggestedLayout(labels,mapping);
   const error=V.h('p',{class:'error',role:'alert',hidden:true});
   const scanStatus=V.h('p',{class:'health-note',role:'status',hidden:true});
   const form=V.form('document-mapping',[
    V.h('p',{class:'health-note'},original.name+' · файл остаётся в этом браузере. Проверьте лист и назначение колонок.'),
    V.row(V.field('Лист','sheet',String(sheet),'select',original.tables.map((t,i)=>[String(i),t.name])),V.field('Строка заголовка в предпросмотре','header',String(header),'number')),
    V.row(V.field('Расположение дат','layout',layout,'select',[['rows','Даты в строках'],['dates_in_columns','Даты в заголовках колонок']]),
     V.field('Порядок дат через /','dateOrder',order,'select',[['','Выберите, если есть такие даты'],['dmy','День / месяц / год'],['mdy','Месяц / день / год']])),
    V.h('div',{class:'health-form-row'},fields.filter(([key])=>layout==='rows'||!['value','date'].includes(key)).map(([key,label])=>V.field(label,key,String(mapping[key]),'select',[['-1','Не указана'],...Array.from({length:width},(_,i)=>[String(i),(i+1)+' · '+(labels[i]||'Без заголовка')])]))),
    layout==='rows'?V.field('Дата для строк без даты (необязательно)','fallbackDate',fallbackDate):null,
    V.h('p',{class:'health-note'},'Поддерживаются даты ГГГГ-ММ-ДД, ДД.ММ.ГГГГ, ГГГГ-ММ и ГГГГ. Из Excel читаются сохранённые результаты формул.'),
    table.ocr?V.h('p',{class:'health-note'},'Текст распознан с изображения. Сверьте колонки, значения и даты с оригиналом.'):null,
    scanStatus,error,V.table(['Строка',...Array.from({length:width},(_,i)=>String(i+1))],table.rows.slice(0,12).map((row,i)=>[i+1,...row]))
   ].filter(Boolean),'Создать черновик');
   content.append(form);if(!table.rows.length){error.hidden=false;error.textContent=table.ocrError||(original.extension==='pdf'?'На листе нет текста. Выберите другой лист или распознайте страницу PDF.':'В файле не найден текст для импорта.');form.querySelector('[type=submit]').disabled=true;}
   if(original.extension==='pdf'&&!table.ocr){
    const recognize=action('Распознать страницу','import-ocr-page',async()=>{
     if(busy)return;
     busy=true;
     for(const control of form.elements)control.disabled=true;
     recognize.disabled=true;scanStatus.hidden=false;scanStatus.textContent='Подготовка страницы';
     try{
      const scanned=await HumanDocuments.recognizePDFPage(original.bytes,sheet+1,{signal:controller.signal,onProgress:text=>{scanStatus.textContent=text;}});
      if(!active())return;
      if(!scanned.rows.length)throw Error('На странице не удалось распознать текст.');
      original.tables[sheet]=scanned;header=1;mapping=layout=undefined;choose();
     }catch(err){if(active()){error.hidden=false;error.textContent=err.message;}}
     finally{busy=false;scanStatus.hidden=true;recognize.disabled=false;for(const control of form.elements)control.disabled=control.type==='submit'&&!table.rows.length;}
    });
    content.insertBefore(recognize,form);
   }
   form.elements.namedItem('sheet').addEventListener('change',e=>{readOptions(form);sheet=Number(e.target.value);header=1;mapping=layout=undefined;choose();});
   form.elements.namedItem('header').addEventListener('change',e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=table.rows.length){readOptions(form);header=n;mapping=layout=undefined;choose();}});
   form.elements.namedItem('layout').addEventListener('change',e=>{readOptions(form);layout=e.target.value;choose();});
   form.addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();try{
    if(!active()||busy)return;
    const input=readOptions(form);
    if(Number(input.get('header'))!==header)throw Error('Укажите строку заголовка из предпросмотра.');
    const imported=T.importedCoordinates(getDoc());
    drafts=T.draft(table,{hash:original.hash,sheet,header,mapping,layout,order,fallbackDate:layout==='rows'?fallbackDate:''},fields.map(([key])=>key),imported);
    review();
   }catch(err){error.hidden=false;error.textContent=err.message;}});
  }
  function review(){
   const content=frame('Проверка перед сохранением'),error=V.h('p',{class:'error',role:'alert',hidden:true});
   navigation(content);
   const table=original.tables[sheet];
   const doc=getDoc(),documentId=doc.documents.find(file=>file.sha256===original.hash)?.id;
   let indexOfResults=T.duplicateIndex(doc.observations),coordinates=T.importedCoordinates(doc);
   const choices=[],refreshRows=[];
   const rows=drafts.map((draft,index)=>{
    const controls=new Map(fields.map(([key,label])=>[key,V.h('input',{
      name:index+':'+key,value:draft.item[key],'aria-label':label+' · строка '+draft.row,
    })]));
    const caption=V.h('small',{class:'import-classification'});
    const checked=V.h('input',{type:'checkbox',name:'selected',value:String(index),disabled:draft.duplicate,
      'aria-label':`Сохранить строку ${draft.row}, колонка ${draft.column}`});
    const hint=V.h('small',{},draft.duplicate?'Уже импортирована':draft.problem||draft.sourceDate);
    const decision=V.h('select',{name:index+':decision',hidden:true,'aria-label':`Действие при совпадении, строка ${draft.row}, колонка ${draft.column}`});
    let candidates=[],withinFile=false;
    function showDecision(){
     const value=decision.value;
     const possible=candidates.length>0||withinFile;
     hint.textContent=draft.duplicate?'Уже импортирована':possible?(candidates.length?'Возможный дубль в журнале':'Совпадение требует проверки'):draft.problem||draft.sourceDate;
     decision.hidden=!(checked.checked&&possible);
     decision.replaceChildren();
     if(decision.hidden)return;
     decision.append(V.h('option',{value:''},'Выберите действие'),V.h('option',{value:'separate'},'Сохранить отдельно'));
     for(const candidate of candidates){
      const label=[candidate.name,candidate.value+' '+(candidate.unit||''),V.date(candidate.date),candidate.provenance?.filename||candidate.source].filter(Boolean).join(' · ');
      decision.append(V.h('option',{value:'link:'+candidate.id},'Связать с записью «'+label+'»'));
     }
     decision.value=Array.from(decision.options).some(option=>option.value===value)?value:'';
    }
    function refreshMatches(resetRepeated=true){
     if(draft.duplicate)return;
     const row=Object.fromEntries(Array.from(controls,([key,input])=>[key,input.value]));
     try{Object.assign(row,T.checkedDate(row.date,order));candidates=indexOfResults.matches(row,checked.checked?Infinity:1);}catch{candidates=[];}
     if(resetRepeated)withinFile=false;
     showDecision();
    }
    refreshMatches();
    checked.checked=!table.ocr&&!draft.problem&&!draft.duplicate&&!candidates.length;
    checked.addEventListener('change',()=>refreshMatches(false));
    for(const key of ['name','value','date','unit','low','high','source','material','method'])controls.get(key).addEventListener('input',()=>refreshMatches());
    choices[index]=(matches,repeated)=>{candidates=matches;withinFile=repeated;showDecision();};
    refreshRows.push(()=>{
     draft.duplicate=coordinates.has(draft.importKey)||coordinates.has(draft.previousKey);
     checked.disabled=draft.duplicate;
     if(draft.duplicate){checked.checked=false;showDecision();return;}
     refreshMatches(false);
    });
    function showClassification(){
     const name=controls.get('name').value,unit=controls.get('unit').value;
     const match=A.classify({name,unit,documentId},doc.analyteAliases);
     caption.textContent=!name.trim()?'':match.basis==='source'?'Название из бланка':match.name;
    }
    controls.get('name').addEventListener('input',showClassification);
    controls.get('unit').addEventListener('input',showClassification);
    showClassification();
    return [
     checked,
     V.h('span',{},draft.row,' / ',draft.column,hint,decision),
     ...fields.map(([key])=>key==='name'?V.h('div',{},controls.get(key),caption):controls.get(key)),
    ];
   });
   entry.refreshReview=()=>{
    const current=getDoc();indexOfResults=T.duplicateIndex(current.observations);coordinates=T.importedCoordinates(current);
    refreshRows.forEach(refresh=>refresh());
   };
   const form=V.form('document-review',[
    V.h('p',{class:'health-note'},original.name+' · '+original.tables[sheet].name+' · '+drafts.length+' строк. Исправьте значения и отметьте строки для сохранения. Исходный файл и происхождение каждой строки сохранятся в зашифрованном журнале.'),
    table.ocr?V.h('p',{class:'health-note'},'Отметьте каждый результат, который вы сверили с оригиналом.'):null,
    V.h('div',{class:'health-import-review'},V.table(['Сохранить','Строка / колонка',...fields.map(x=>x[1])],rows)),error
   ].filter(Boolean),'Сохранить выбранные результаты');content.append(action('Вернуться к колонкам','import-back',()=>{if(!busy)choose();}),form);
   form.addEventListener('submit',async e=>{e.preventDefault();e.stopPropagation();if(busy||!active())return;busy=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;try{
    const input=new FormData(form),indices=input.getAll('selected').map(Number),records=[];
    if(!indices.length)throw Error('Выберите хотя бы одну строку.');
    for(const i of indices){const draft=drafts[i];if(!draft||draft.duplicate)throw Error('Неверная строка импорта.');const item=Object.fromEntries(fields.map(([key])=>[key,String(input.get(i+':'+key)||'')]));
     try{
      Object.assign(item,T.checkedDate(item.date,order));
      records.push({index:i,decision:String(input.get(i+':decision')||''),record:{...M.checkLab(item),importKey:draft.importKey,provenance:{filename:original.name,sha256:original.hash,sheet:table.name,
       row:draft.row,column:draft.column,sourceCell:draft.importKey,sourceDate:draft.sourceDate,headerCell:draft.headerCell,
       raw:draft.raw,rawCells:draft.rawCells,method:table.ocr?'ocr-tesseract':original.extension}}});
     }catch(err){throw Error('Строка '+draft.row+': '+err.message);}}
    const mime={pdf:'application/pdf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'}[original.extension];
    const attachment={id:M.id(),name:M.text(original.name,255),title:M.text(original.name,255),date:new Date().toISOString().slice(0,10),mime,sha256:original.hash,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    let created=0,linked=0;
    await commit(async(doc,stageDocument)=>{
     if(!active()||doc.id!==identity)throw Error('Импорт закрыт или журнал сменился.');
     const imported=T.importedCoordinates(doc);
     if(indices.some(i=>imported.has(drafts[i].importKey)||imported.has(drafts[i].previousKey)))
      throw Error('Эти строки уже импортированы. Откройте проверку заново.');
     const duplicates=T.duplicateIndex(doc.observations),existing=new Set(doc.observations.map(row=>row.id));
     const accepted=records.map(({index,decision,record})=>{
      const candidates=duplicates.matches(record),saved=candidates.filter(row=>existing.has(row.id));
      const target=decision.startsWith('link:')?decision.slice(5):'';
      if(target?!saved.some(row=>row.id===target):candidates.length&&decision!=='separate'){
       choices[index](saved,!!target||candidates.length>saved.length);
       throw Error(`Строка ${drafts[index].row}, колонка ${drafts[index].column}. Проверьте совпадение и выберите действие.`);
      }
      if(!target)duplicates.add(record);
      return {record,target};
     });
     let saved=doc.documents.find(d=>d.sha256===original.hash);
     if(!saved){
      saved=await stageDocument(attachment,original.bytes);
      doc.documents.push(saved);
     }
     for(const {record,target} of accepted){
      if(target){
       (saved.importLinks??=[]).push({...record.provenance,observationId:target,verifiedAt:new Date().toISOString()});
       linked++;
       continue;
      }
      record.documentId=saved.id;
      record.provenance.classification=A.classify(record,doc.analyteAliases);
      doc.observations.push(record);
      created++;
     }
    });
    if(active()){
     if(single)dialog.close();
     else{entry.done=created;entry.linked=linked;entry.refreshReview=null;entry.error=null;queue();}
    }
   }catch(err){error.hidden=false;error.textContent=err.message;}finally{busy=false;if(submit.isConnected)submit.disabled=false;}});
  }
  choose();
  }
  if(!dialog.open)dialog.showModal();
  if(single)await load(entries[0]);else queue();
 }
 window.HumanImport={open};
})();
