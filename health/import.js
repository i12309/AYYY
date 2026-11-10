/* Reviewable, local-only document import. Commit is atomic through the vault controller. */
(() => {
 'use strict';
 const fields=[['name','Показатель'],['value','Результат'],['date','Дата'],['unit','Единица'],['low','Референс от'],['high','Референс до'],['source','Лаборатория'],['material','Материал'],['method','Метод'],['notes','Примечание']];
 const aliases={name:['name','показатель','название','анализ'],value:['value','result','результат','значение'],date:['date','дата'],unit:['unit','единица','ед.изм.'],low:['low','min','мин','нижняя граница'],high:['high','max','макс','верхняя граница'],source:['source','laboratory','источник','лаборатория'],material:['material','материал'],method:['method','метод'],notes:['notes','комментарий','примечание']};
 function dateInput(raw){const value=raw.trim(),m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);return m?`${m[3]}-${m[2]}-${m[1]}`:value;}
 async function open(file,{V,M,C,dialog,commit,getDoc,isCurrent=()=>true}){
  const identity=getDoc()?.id;if(!identity)throw Error('Сначала откройте журнал.');
  const original=await HumanDocuments.read(file);if(!isCurrent())return;if(getDoc()?.id!==identity)throw Error('Журнал сменился во время чтения файла. Повторите импорт.');
  let sheet=0,header=1,mapping={},drafts=[],busy=false;const imported=new Set(getDoc().observations.map(x=>x.importKey).filter(Boolean));
  const body=document.getElementById('health-dialog-body');dialog.classList.add('health-import-dialog');
  dialog.addEventListener('close',()=>{dialog.classList.remove('health-import-dialog');drafts=[];},{once:true});
  function frame(title){const content=V.h('div',{class:'health-modal-content'});body.replaceChildren(V.h('div',{class:'health-modal-head'},V.h('h2',{},title),V.button('×','close-dialog',{'aria-label':'Закрыть импорт'})),content);return content;}
  function choose(){
   const table=original.tables[sheet];if(!table)throw Error('В файле не найдены таблицы. Для скана требуется распознавание или ручной ввод.');
   const content=frame('Сопоставление колонок'),labels=table.rows[header-1]||[],width=Math.max(0,...table.rows.map(r=>r.length));
   mapping=Object.fromEntries(fields.map(([key])=>[key,labels.findIndex(x=>(aliases[key]||[]).includes(x.trim().toLocaleLowerCase('ru-RU')))]));
   const error=V.h('p',{class:'error',role:'alert',hidden:true});
   const form=V.form('document-mapping',[
    V.h('p',{class:'health-note'},original.name+' · файл остаётся в этом браузере. Проверьте лист и назначение колонок.'),
    V.row(V.field('Лист','sheet',String(sheet),'select',original.tables.map((t,i)=>[String(i),t.name])),V.field('Строка заголовка','header',String(header),'number')),
    V.h('div',{class:'health-form-row'},fields.map(([key,label])=>V.field(label,key,String(mapping[key]),'select',[['-1','Не указана'],...Array.from({length:width},(_,i)=>[String(i),(i+1)+' · '+(labels[i]||'Без заголовка')])]))),
    V.field('Дата для строк без даты (необязательно)','fallbackDate',''),
    V.h('p',{class:'health-note'},'Форматы даты: ГГГГ-ММ-ДД, ДД.ММ.ГГГГ, ГГГГ-ММ или ГГГГ. Пустая дата останется неизвестной. Формулы Excel не выполняются; используются сохранённые значения.'),
    error,V.table(['Строка',...Array.from({length:width},(_,i)=>String(i+1))],table.rows.slice(0,12).map((row,i)=>[i+1,...row]))
   ],'Создать черновик');
   content.append(form);if(!table.rows.length){error.hidden=false;error.textContent='На листе нет текста. Выберите другой лист. Для скана требуется распознавание или ручной ввод.';form.querySelector('[type=submit]').disabled=true;}
   form.elements.namedItem('sheet').addEventListener('change',e=>{sheet=Number(e.target.value);header=1;choose();});
   form.elements.namedItem('header').addEventListener('change',e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=table.rows.length){header=n;choose();}});
   form.addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();try{
    const input=new FormData(form);mapping=Object.fromEntries(fields.map(([key])=>[key,Number(input.get(key))]));if(mapping.name<0||mapping.value<0||mapping.name===mapping.value)throw Error('Назначьте разные колонки показателя и результата.');
    drafts=table.rows.slice(header).map((row,i)=>{const item=Object.fromEntries(fields.map(([key])=>[key,mapping[key]>=0?(row[mapping[key]]||''):'' ]));item.date=dateInput(item.date||String(input.get('fallbackDate')||''));item.datePrecision=!item.date?'unknown':/^\d{4}$/.test(item.date)?'year':/^\d{4}-\d{2}$/.test(item.date)?'month':'day';
     const importKey=original.hash+':'+sheet+':'+(header+i+1);let problem='';try{M.checkLab(item);}catch(err){problem=err.message;}
     return {item,problem,duplicate:imported.has(importKey),importKey,row:header+i+1,raw:row,rawCells:table.provenance?.[header+i]||null};});
    review();
   }catch(err){error.hidden=false;error.textContent=err.message;}});
  }
  function review(){
   const content=frame('Проверка перед сохранением'),error=V.h('p',{class:'error',role:'alert',hidden:true});
   const rows=drafts.map((d,i)=>[V.h('input',{type:'checkbox',name:'selected',value:String(i),checked:!d.problem&&!d.duplicate,disabled:d.duplicate,'aria-label':'Сохранить строку '+d.row}),V.h('span',{},d.row,V.h('small',{},d.duplicate?'Уже импортирована':d.problem)),...fields.map(([key,label])=>V.h('input',{name:i+':'+key,value:d.item[key],'aria-label':label+' · строка '+d.row}))]);
   const form=V.form('document-review',[
    V.h('p',{class:'health-note'},original.name+' · '+original.tables[sheet].name+' · '+drafts.length+' строк. Исправьте значения и отметьте строки для сохранения. Исходный файл и происхождение каждой строки сохранятся в зашифрованном журнале.'),
    V.h('div',{class:'health-import-review'},V.table(['Сохранить','Строка',...fields.map(x=>x[1])],rows)),error
   ],'Сохранить выбранные результаты');content.append(V.button('Вернуться к колонкам','import-back'),form);
   content.querySelector('[data-action=import-back]').addEventListener('click',e=>{e.stopPropagation();choose();});
   form.addEventListener('submit',async e=>{e.preventDefault();e.stopPropagation();if(busy)return;busy=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;try{
    if(getDoc()?.id!==identity)throw Error('Журнал сменился. Откройте импорт заново.');
    const input=new FormData(form),indices=input.getAll('selected').map(Number),records=[];
    if(!indices.length)throw Error('Выберите хотя бы одну строку.');
    for(const i of indices){const draft=drafts[i];if(!draft||draft.duplicate)throw Error('Неверная строка импорта.');const item=Object.fromEntries(fields.map(([key])=>[key,String(input.get(i+':'+key)||'')]));item.date=dateInput(item.date);item.datePrecision=!item.date?'unknown':/^\d{4}$/.test(item.date)?'year':/^\d{4}-\d{2}$/.test(item.date)?'month':'day';
     try{records.push({...M.checkLab(item),importKey:draft.importKey,provenance:{filename:original.name,sha256:original.hash,sheet:original.tables[sheet].name,row:draft.row,raw:draft.raw,rawCells:draft.rawCells}});}catch(err){throw Error('Строка '+draft.row+': '+err.message);}}
    const mime={pdf:'application/pdf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv'}[original.extension];
    const attachment={id:M.id(),name:M.text(original.name,255),title:M.text(original.name,255),date:new Date().toISOString().slice(0,10),mime,size:original.bytes.length,data:C.base64(original.bytes),sha256:original.hash,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    await commit(doc=>{if(doc.id!==identity)throw Error('Журнал сменился.');if(records.some(r=>doc.observations.some(o=>o.importKey===r.importKey)))throw Error('Эти строки уже импортированы. Откройте проверку заново.');const saved=doc.documents.find(d=>d.sha256===original.hash)||attachment;if(saved===attachment)doc.documents.push(attachment);for(const r of records){r.documentId=saved.id;doc.observations.push(r);}});
    dialog.close();
   }catch(err){error.hidden=false;error.textContent=err.message;}finally{busy=false;if(submit.isConnected)submit.disabled=false;}});
  }
  choose();if(!dialog.open)dialog.showModal();
 }
 window.HumanImport={open};
})();
