/* Migration is isolated in a new vault; no existing local profile is replaced. */
(() => {
 'use strict';
 async function open(file,{V,C,S,dialog,getDoc,onCreated}){
  const identity=getDoc()?.id;if(!identity)throw Error('Откройте журнал перед переносом.');
  const result=await HumanMigration.inspect(file);if(getDoc()?.id!==identity)throw Error('Открытый журнал сменился. Повторите перенос.');
  if(getDoc().humanMigration?.archiveHash===result.archiveHash)throw Error('Этот экспорт уже перенесён в открытый журнал.');
  let busy=false;
  const contents=V.h('div',{class:'health-modal-content'}),message=V.h('p',{class:'error',role:'alert',hidden:true}),close=V.button('×','close-dialog',{'aria-label':'Закрыть перенос'});
  const doc=result.doc,form=V.form('human-migration-confirm',[
   V.h('p',{},'Будет создан отдельный зашифрованный журнал: '+(doc.profile.name||'Профиль HUMAN')),
   V.table(['Раздел','Будет доступно'],[['Анализы',doc.observations.length],['Домашние измерения',doc.vitals.length],['Медкарта',doc.medical.length],['Препараты',doc.medications.length],['Дневник',doc.diary.length],['Документы',doc.documents.length],['История правок',doc.revisions.length]]),
   V.h('details',{},V.h('summary',{},'Все таблицы исходной базы'),V.table(['Таблица','Строк'],Object.entries(result.counts))),
   V.h('p',{class:'health-note'},'Оригинал экспорта, все таблицы, удалённые записи, черновики и точные поля сохранятся внутри нового журнала. Дополнительные разделы доступны в просмотре исходных записей; их полноценное редактирование ещё переносится. Существующие журналы остаются на месте.'),
   V.field('Новая фраза доступа (минимум 12 символов)','password','','password'),V.field('Повторите фразу','repeat','','password'),message
  ],'Создать журнал из экспорта');contents.append(form);
  document.getElementById('health-dialog-body').replaceChildren(V.h('div',{class:'health-modal-head'},V.h('h2',{},'Проверка переноса HUMAN'),close),contents);
  if(!dialog.open)dialog.showModal();
  const preventCancel=e=>{if(busy)e.preventDefault();};dialog.addEventListener('cancel',preventCancel);dialog.addEventListener('close',()=>dialog.removeEventListener('cancel',preventCancel),{once:true});
  form.addEventListener('submit',async e=>{e.preventDefault();e.stopPropagation();if(busy)return;busy=true;const submit=form.querySelector('[type=submit]');submit.disabled=close.disabled=true;
   try{const values=new FormData(form),pass=String(values.get('password')||'');if(pass!==values.get('repeat'))throw Error('Фразы не совпадают.');const created=await C.create(pass);doc.id=created.doc.id;
    const envelope=await C.seal(doc,created.key,created.envelope);if(getDoc()?.id!==identity||!dialog.open)throw Error('Открытый журнал сменился.');
    const local=await S.createSelected({id:doc.id,envelope});await onCreated({local,doc,key:created.key});dialog.close();
   }catch(err){message.hidden=false;message.textContent=err.message;}finally{busy=false;if(submit.isConnected)submit.disabled=close.disabled=false;}
  });
 }
 function raw(doc,{V,dialog}){
  const migration=doc.humanMigration;if(!migration)return;
  let page=0;const select=V.h('select',{'aria-label':'Исходная таблица'},Object.keys(migration.tables).map(name=>V.h('option',{value:name},name))),target=V.h('pre',{}),label=V.h('p',{class:'health-note'}),prev=V.h('button',{type:'button',class:'button'},'← Назад'),next=V.h('button',{type:'button',class:'button'},'Вперёд →');
  function render(){const rows=migration.tables[select.value]||[];target.textContent=JSON.stringify(rows.slice(page*20,page*20+20),null,2);label.textContent='Показаны '+Math.min(rows.length,page*20+1)+'–'+Math.min(rows.length,page*20+20)+' из '+rows.length;prev.disabled=page===0;next.disabled=(page+1)*20>=rows.length;}
  select.addEventListener('change',()=>{page=0;render();});prev.addEventListener('click',()=>{page--;render();});next.addEventListener('click',()=>{page++;render();});
  document.getElementById('health-dialog-body').replaceChildren(V.h('div',{class:'health-modal-head'},V.h('h2',{},'Исходные записи HUMAN'),V.button('×','close-dialog',{'aria-label':'Закрыть исходные записи'})),V.h('div',{class:'health-modal-content health-document-preview'},select,V.h('div',{class:'health-toolbar'},prev,label,next),target));render();dialog.showModal();
 }
 window.HumanMigrationUI={open,raw};
})();
