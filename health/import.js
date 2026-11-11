/* Reviewable, local-only document import. Commit is atomic through the vault controller. */
(() => {
 'use strict';
 const A=window.HumanAnalytes,T=window.HumanImportTable;
 const fields=[['name','Показатель'],['value','Результат'],['date','Дата'],['unit','Единица'],['low','Референс от'],['high','Референс до'],['source','Лаборатория'],['material','Материал'],['method','Метод'],['notes','Примечание']];
 const aliases={name:['name','показатель','название','анализ'],value:['value','result','результат','значение'],date:['date','дата'],unit:['unit','единица','ед.изм.'],low:['low','min','мин','нижняя граница'],high:['high','max','макс','верхняя граница'],source:['source','laboratory','источник','лаборатория'],material:['material','материал'],method:['method','метод'],notes:['notes','комментарий','примечание']};
 async function open(files,{V,M,dialog,commit,getDoc,isCurrent=()=>true,persistence,saved,notify}){
  if(!files.length&&!saved?.entries.length)return;
  if(files.length>100||files.reduce((size,file)=>size+file.size,0)>128*1024*1024)
   throw Error('Выберите до 100 файлов общим размером до 128 МиБ.');
  const identity=getDoc()?.id;if(!identity)throw Error('Сначала откройте журнал.');
  const entries=saved?saved.entries.map(({id,name,bytes,parsed,editor})=>parsed
   ?{id,name,original:{...parsed,name,bytes},editor}:{id,name,file:new File([bytes],name)}):files.map(file=>({id:M.id(),name:file.name,file}));
  const single=entries.length===1,controller=new AbortController();
  let checkpoint=saved?.checkpoint??null,persisting=false,draftNotice=saved?'Черновик открыт с этого устройства.':'';
  const body=document.getElementById('health-dialog-body');dialog.classList.add('health-import-dialog');
  const active=()=>dialog.open&&!controller.signal.aborted&&isCurrent()&&getDoc()?.id===identity;
  window.addEventListener('pagehide',()=>controller.abort(),{once:true,signal:controller.signal});
  dialog.addEventListener('close',()=>{controller.abort();dialog.classList.remove('health-import-dialog');entries.length=0;},{once:true});
  function frame(title){const content=V.h('div',{class:'health-modal-content'});body.replaceChildren(V.h('div',{class:'health-modal-head'},V.h('h2',{},title),V.button('×','close-dialog',{'aria-label':'Закрыть импорт'})),content);return content;}
  function action(label,key,run,attrs={}){
   const button=V.button(label,key,attrs);
   button.addEventListener('click',event=>{event.stopPropagation();if(active()&&!persisting)run();});
   return button;
  }
  const pending=()=>entries.filter(entry=>entry.done==null&&!entry.skipped);
  function draftMetadata(entry){
   const source=entry.original;
   return {parsed:source?{hash:source.hash,extension:source.extension,tables:source.tables}:null,
    editor:entry.capture?.()??entry.editor??null};
  }
  async function updateCheckpoint(entry,changes=null){
   if(!checkpoint||!active())return;
   try{checkpoint=await persistence.updateEntry(checkpoint,entry.id,changes,active);}
   catch(error){draftNotice='Сохранённый черновик не обновился: '+error.message;if(active())notify?.(draftNotice);}
  }
  function draftActions(content,canSave=()=>true){
   if(!persistence||(!pending().length&&!checkpoint))return;
   const status=V.h('p',{class:'health-note',role:'status','data-import-draft-status':true},draftNotice);
   const save=action('Сохранить черновик','save-import-draft',async()=>{
    if(!canSave()||!pending().length)return;
    persisting=true;save.disabled=discard.disabled=true;
    status.textContent='Шифрование черновика…';
    let controls=[];
    try{
     const snapshots=pending().map(entry=>({id:entry.id,name:entry.name,entry,...structuredClone(draftMetadata(entry))}));
     controls=[...content.querySelectorAll('input:enabled,select:enabled,textarea:enabled')];
     for(const control of controls)control.disabled=true;
     const data=[];
     for(const {entry,...snapshot} of snapshots){
      if(!active())return;
      if((entry.original?.bytes.byteLength??entry.file.size)>window.HumanCrypto.MAX_FILE)throw Error('В черновике разрешено до 32 МиБ на файл.');
      data.push({...snapshot,bytes:entry.original?.bytes??new Uint8Array(await entry.file.arrayBuffer())});
     }
     if(!active())return;
     const next=await persistence.save(data,checkpoint,active);
     if(next)checkpoint=next;
     draftNotice=next?'Черновик зашифрован и сохранён на этом устройстве.':'Сохранение отменено.';
    }catch(error){draftNotice=error.message;}
    finally{for(const control of controls)control.disabled=false;persisting=false;save.disabled=discard.disabled=false;discard.hidden=!checkpoint;status.textContent=draftNotice;}
   },{class:'small',hidden:!pending().length});
   const discard=action('Удалить сохранённый черновик','discard-import-draft',async()=>{
    if(!canSave()||!checkpoint||!confirm('Удалить сохранённый черновик с этого устройства? Правки в открытом окне останутся до его закрытия.'))return;
    persisting=true;save.disabled=discard.disabled=true;
    try{await persistence.discard(checkpoint,active);checkpoint=null;draftNotice='Сохранённый черновик удалён.';}
    catch(error){draftNotice=error.message;}
    finally{persisting=false;save.disabled=discard.disabled=false;discard.hidden=!checkpoint;status.textContent=draftNotice;}
   },{class:'small',hidden:!checkpoint});
   content.append(V.h('div',{class:'health-import-draft-actions'},save,discard,status));
  }
  function queue(){
   const content=frame('Очередь импорта');
   draftActions(content);
   content.append(V.h('p',{class:'health-note'},persistence?'Проверяйте и сохраняйте результаты по каждому файлу. После закрытия окна доступна сохранённая версия черновика.':'Проверяйте и сохраняйте результаты по каждому файлу. В демо правки черновика доступны в открытом окне.'),
    V.h('ul',{class:'health-import-queue'},entries.map(entry=>{
     const status=entry.done!=null?[entry.done?`Сохранено результатов: ${entry.done}`:'',entry.linked?`Связано источников: ${entry.linked}`:''].filter(Boolean).join(' · '):entry.skipped?'Пропущен':entry.error||(entry.original?'Готов к проверке':'Ожидает');
     return V.h('li',{},V.h('div',{},V.h('strong',{},entry.name),V.h('small',{},status)),entry.done!=null||entry.skipped?null:
      V.h('div',{class:'health-import-queue-actions'},action(entry.original?'Продолжить':entry.error?'Повторить':'Открыть','import-open-file',()=>void load(entry),{class:'small'}),
       action('Пропустить','import-skip-file',async()=>{
        persisting=true;
        try{await updateCheckpoint(entry);}finally{persisting=false;}
        if(!active())return;
        entry.file=entry.view=entry.original=entry.refreshReview=entry.capture=entry.editor=null;
        entry.error=null;entry.skipped=true;queue();
       },{class:'small'})));
    })));
  }
  async function load(entry){
   if(entry.view){body.replaceChildren(...entry.view);entry.view=null;entry.refreshReview?.();return;}
   if(entry.original){
    try{edit(entry,entry.original);}catch(error){
     if(single){dialog.close();throw error;}
     entry.error=error.message;queue();
    }
    return;
   }
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
    entry.original=original;
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
  const restored=entry.editor??{};
  let {sheet=0,header=1,mapping,layout,order='',fallbackDate=''}=restored;
  let manualMode=restored.manualMode===true,manualIds=restored.manualIds??[];
  let drafts=[],busy=false;
  entry.editor=null;
  const editorState=()=>({sheet,header,mapping:{...mapping},layout,order,fallbackDate,manualMode,manualIds:[...manualIds]});
  function manualDraft(id,index,imported){
   const importKey=`${original.hash}:${sheet}:manual:${id}`;
   return {item:Object.fromEntries(fields.map(([key])=>[key,''])),manual:index+1,importKey,previousKey:'',
    duplicate:imported.has(importKey),row:null,column:null,sourceDate:'',raw:[],rawCells:null,headerCell:null};
  }
  function alreadyImported(coordinates,draft){
   return coordinates.has(draft.importKey)||!!draft.previousKey&&coordinates.has(draft.previousKey);
  }
  function createDrafts(){
   const imported=T.importedCoordinates(getDoc());
   const parsed=manualMode?[]:T.draft(original.tables[sheet],{hash:original.hash,sheet,header,mapping,layout,order,
    fallbackDate:layout==='rows'?fallbackDate:''},fields.map(([key])=>key),imported);
   return [...parsed,...manualIds.map((id,index)=>manualDraft(id,index,imported))];
  }
  function sourcePreview(){
   const pdf=original.extension==='pdf';
   if(!pdf&&!['jpg','jpeg','png'].includes(original.extension))return null;
   const page=sheet+1,panel=V.h('div',{class:'health-import-source-content'});
   const details=V.h('details',{class:'health-import-source'},V.h('summary',{},'Показать оригинал'),panel);
   let started=false;
   details.addEventListener('toggle',async()=>{
    if(!details.open||started||!active())return;
    started=true;
    panel.append(V.h('p',{class:'health-note',role:'status'},'Открываю оригинал…'));
    try{
     const signal=controller.signal;
     const canvas=pdf?(await HumanDocuments.renderPDF(original.bytes,page,{signal})).canvas:
      await HumanOCR.imageCanvas(original.bytes,original.extension,{signal,preview:true});
     if(active()){
      canvas.setAttribute('role','img');
      if(!pdf)canvas.setAttribute('aria-label','Оригинал изображения');
      panel.replaceChildren(canvas);
     }
    }catch(error){if(active())panel.replaceChildren(V.h('p',{class:'error'},error.message));}
   });
   return details;
  }
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
   manualMode=false;manualIds=[];
   const table=original.tables[sheet];
   const content=frame('Сопоставление колонок'),labels=table.rows[header-1]||[],width=Math.max(0,...table.rows.map(r=>r.length));
   navigation(content);
   draftActions(content,()=>!busy);
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
    sourcePreview(),scanStatus,error,V.table(['Строка',...Array.from({length:width},(_,i)=>String(i+1))],table.rows.slice(0,12).map((row,i)=>[i+1,...row]))
   ].filter(Boolean),'Создать черновик');
   entry.capture=()=>{readOptions(form);return editorState();};
   content.append(form);if(!table.rows.length){error.hidden=false;error.textContent=table.ocrError||(original.extension==='pdf'?'На листе нет текста. Выберите другой лист или распознайте страницу PDF.':'В файле не найден текст для импорта.');form.querySelector('[type=submit]').disabled=true;}
   content.insertBefore(action('Ввести результат вручную','import-manual',()=>{
    if(busy)return;
    readOptions(form);manualMode=true;manualIds=[M.id()];drafts=createDrafts();review();
   }),form);
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
    if(!active()||busy||persisting)return;
    const input=readOptions(form);
    if(Number(input.get('header'))!==header)throw Error('Укажите строку заголовка из предпросмотра.');
    drafts=createDrafts();
    review();
   }catch(err){error.hidden=false;error.textContent=err.message;}});
  }
  function review(savedRows=[]){
   const content=frame('Проверка перед сохранением'),error=V.h('p',{class:'error',role:'alert',hidden:true});
   const result=V.h('p',{class:'health-note','data-import-result':true,role:'status',hidden:true});
   navigation(content);
   draftActions(content,()=>!busy);
   const table=original.tables[sheet];
   const doc=getDoc(),documentId=doc.documents.find(file=>file.sha256===original.hash)?.id;
   let indexOfResults=T.duplicateIndex(doc.observations),coordinates=T.importedCoordinates(doc);
   const choices=[],refreshRows=[],captureRows=[],selection=[];
   const problems=savedRows.map(row=>row?.problem);
   const selectionStatus=V.h('span',{class:'health-note',role:'status'});
   const updateSelection=()=>{selectionStatus.textContent=`Отмечено: ${selection.filter(row=>row.checked.checked).length}`;};
   const rows=drafts.map((draft,index)=>{
    const savedRow=savedRows[index];
    draft.duplicate=alreadyImported(coordinates,draft);
    const rowLabel=draft.manual?`ручная строка ${draft.manual}`:`строка ${draft.row}, колонка ${draft.column}`;
    const controls=new Map(fields.map(([key,label])=>[key,V.h('input',{
      name:index+':'+key,value:savedRow?.values?.[key]??draft.item[key],disabled:draft.duplicate,'aria-label':label+' · '+rowLabel,
    })]));
    const values=()=>Object.fromEntries(Array.from(controls,([key,input])=>[key,input.value]));
    const caption=V.h('small',{class:'import-classification'});
    const checked=V.h('input',{type:'checkbox',name:'selected',value:String(index),disabled:draft.duplicate,
      'aria-label':`Сохранить · ${rowLabel}`});
    const hint=V.h('small');
    const decision=V.h('select',{name:index+':decision',hidden:true,'aria-label':`Действие при совпадении · ${rowLabel}`});
    let candidates=[],withinFile=false;
    function showDecision(){
     const value=decision.value;
     const possible=candidates.length>0||withinFile;
     const issue=problems[index]??draft.problem;
     hint.textContent=draft.duplicate?'Уже импортирована':issue||(possible?(candidates.length?'Возможный дубль в журнале':'Совпадение требует проверки'):draft.sourceDate);
     hint.classList.toggle('import-row-warning',!draft.duplicate&&!!(issue||possible));
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
     const row=values();
     try{Object.assign(row,T.checkedDate(row.date,order));candidates=indexOfResults.matches(row,checked.checked?Infinity:1);}catch{candidates=[];}
     if(resetRepeated)withinFile=false;
     showDecision();
    }
    refreshMatches();
    checked.checked=!draft.duplicate&&(savedRow?.selected??(!draft.manual&&!table.ocr&&!draft.problem&&!candidates.length));
    if(savedRow&&checked.checked){
     withinFile=savedRow.repeated||savedRow.decision==='separate';refreshMatches(false);
     if(Array.from(decision.options).some(option=>option.value===savedRow.decision))decision.value=savedRow.decision;
    }
    if(draft.duplicate)showDecision();
    checked.addEventListener('change',()=>{refreshMatches(false);updateSelection();});
    decision.addEventListener('change',()=>{problems[index]='';showDecision();});
    for(const key of ['name','value','date','unit','low','high','source','material','method'])controls.get(key).addEventListener('input',()=>{
     problems[index]='';refreshMatches();
    });
    choices[index]=(matches,repeated)=>{candidates=matches;withinFile=repeated;showDecision();};
    captureRows.push(()=>({values:values(),selected:checked.checked,decision:decision.value,repeated:withinFile,problem:problems[index]??draft.problem}));
    selection.push({checked,refresh:()=>refreshMatches(false),eligible:()=>{
     if(draft.duplicate||draft.manual||table.ocr||candidates.length||withinFile||problems[index])return false;
     const row=values();
     try{M.checkLab({...row,...T.checkedDate(row.date,order)});return true;}catch{return false;}
    }});
    refreshRows.push(()=>{
     draft.duplicate=alreadyImported(coordinates,draft);
     checked.disabled=draft.duplicate;
     for(const input of controls.values())input.disabled=draft.duplicate;
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
     V.h('span',{},draft.manual?`Вручную ${draft.manual}`:`${draft.row} / ${draft.column}`,hint,decision),
     ...fields.map(([key])=>key==='name'?V.h('div',{},controls.get(key),caption):controls.get(key)),
    ];
   });
   entry.refreshReview=()=>{
    const current=getDoc();indexOfResults=T.duplicateIndex(current.observations);coordinates=T.importedCoordinates(current);
    refreshRows.forEach(refresh=>refresh());updateSelection();
   };
   entry.capture=()=>({...editorState(),review:captureRows.map(capture=>capture())});
   function selectRows(selectReady){
    if(busy)return;
    for(const row of selection){
     if(selectReady?(row.checked.checked||!row.eligible()):!row.checked.checked)continue;
     row.checked.checked=selectReady;row.refresh();
    }
    updateSelection();
   }
   updateSelection();
   const addRow=action('Добавить строку вручную','import-add-manual',()=>{
    if(busy||drafts.length>=5000)return;
    const edits=captureRows.map(capture=>capture()),id=M.id();
    manualIds.push(id);drafts.push(manualDraft(id,manualIds.length,T.importedCoordinates(getDoc())));
    review(edits);
    body.querySelector(`[name="${drafts.length-1}:name"]`)?.focus();
   },{disabled:drafts.length>=5000});
   const form=V.form('document-review',[
    V.h('p',{class:'health-note'},original.name+' · '+original.tables[sheet].name+' · '+drafts.length+' строк. Исправьте значения и отметьте строки для сохранения. Исходный файл и происхождение каждой строки сохранятся в зашифрованном журнале.'),
    table.ocr||manualIds.length?V.h('p',{class:'health-note'},'Отметьте каждый результат, который вы сверили с оригиналом.'):null,
    sourcePreview(),
    V.h('div',{class:'health-import-selection'},table.ocr||manualMode?null:action('Выбрать готовые','import-select-ready',()=>selectRows(true),{class:'small'}),
     action('Снять выбор','import-clear-selection',()=>selectRows(false),{class:'small'}),selectionStatus),result,
    V.h('div',{class:'health-import-review'},V.table(['Сохранить','Строка / колонка',...fields.map(x=>x[1])],rows)),error
   ].filter(Boolean),'Сохранить выбранные результаты');content.append(action('Вернуться к колонкам','import-back',()=>{if(!busy)choose();}),addRow,form);
   form.addEventListener('submit',async e=>{
    e.preventDefault();e.stopPropagation();
    if(busy||persisting||!active())return;
    busy=true;form.inert=true;error.hidden=true;result.hidden=true;
    const needsReview=Error('Исправьте отмеченные строки или снимите с них выбор.');
    try{
     const edits=captureRows.map(capture=>capture()),records=[];
     if(!edits.some(edit=>edit.selected))throw Error('Выберите хотя бы одну строку.');
     for(const [index,edit] of edits.entries()){
      const draft=drafts[index];
      if(!edit.selected||draft.duplicate)continue;
      try{
       const item={...edit.values,...T.checkedDate(edit.values.date,order)};
       records.push({index,decision:edit.decision,repeated:edit.repeated,record:{...M.checkLab(item),importKey:draft.importKey,
        provenance:{filename:original.name,sha256:original.hash,sheet:table.name,row:draft.row,column:draft.column,
         sourceCell:draft.importKey,sourceDate:draft.sourceDate,headerCell:draft.headerCell,raw:draft.raw,rawCells:draft.rawCells,
         method:draft.manual?'manual':table.ocr?'ocr-tesseract':original.extension}}});
       problems[index]='';
      }catch(err){problems[index]=err.message;}
     }
     if(!records.length)throw needsReview;
     const mime={pdf:'application/pdf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'}[original.extension];
     const attachment={id:M.id(),name:M.text(original.name,255),title:M.text(original.name,255),date:new Date().toISOString().slice(0,10),mime,sha256:original.hash,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
     let created=0,linked=0;
     await commit(async(doc,stageDocument)=>{
      if(!active()||doc.id!==identity)throw Error('Импорт закрыт или журнал сменился.');
      const imported=T.importedCoordinates(doc);
      const duplicates=T.duplicateIndex(doc.observations),existing=new Set(doc.observations.map(row=>row.id));
      const accepted=[];
      for(const {index,decision,repeated,record} of records){
       if(alreadyImported(imported,drafts[index]))continue;
       const candidates=duplicates.matches(record),saved=candidates.filter(row=>existing.has(row.id));
       const target=decision.startsWith('link:')?decision.slice(5):'';
       if(target?!saved.some(row=>row.id===target):(candidates.length||repeated)&&decision!=='separate'){
        problems[index]='Проверьте совпадение и выберите действие.';
        choices[index](saved,repeated||!!target||candidates.length>saved.length);
        continue;
       }
       if(!target)duplicates.add(record);
       accepted.push({record,target});
      }
      if(!accepted.length)throw needsReview;
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
     if(!active())return;
     entry.refreshReview();
     const remaining=drafts.filter((draft,index)=>!draft.duplicate&&(!draft.manual||
      edits[index].selected||Object.values(edits[index].values).some(value=>value.trim()))).length;
     entry.savedCount=(entry.savedCount||0)+created;
     entry.linked=(entry.linked||0)+linked;
     await updateCheckpoint(entry,remaining?draftMetadata(entry):null);
     if(!active())return;
     if(remaining){
      const counts=[created?`Сохранено результатов: ${created}`:'',linked?`Связано источников: ${linked}`:'',`Осталось строк: ${remaining}`];
      result.textContent=counts.filter(Boolean).join(' · ');result.hidden=false;
      const draftStatus=content.querySelector('[data-import-draft-status]');
      if(draftStatus)draftStatus.textContent=draftNotice;
     }else if(single)dialog.close();
     else{
      entry.done=entry.savedCount;entry.original=entry.refreshReview=entry.capture=null;entry.error=null;queue();
     }
    }catch(err){
     if(active()){entry.refreshReview();error.hidden=false;error.textContent=err.message;}
    }finally{busy=false;form.inert=false;}
   });
  }
  if(Array.isArray(restored.review)){
   drafts=createDrafts();review(restored.review);
  }else choose();
  }
  if(!dialog.open)dialog.showModal();
  if(single)await load(entries[0]);else queue();
 }
 window.HumanImport={open};
})();
