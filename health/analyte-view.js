/* Catalogue controls and evidence shown with one laboratory result. */
(() => {
  'use strict';
  const A=window.HumanAnalytes,V=window.HumanView;
  const names={catalog:'Каталог HUMAN',manual:'Правило профиля',custom:'Имя для группировки',source:'Название из бланка'};
  const error=()=>V.h('p',{class:'error',role:'alert',hidden:true,'data-form-error':'yes'});
  const bind=(form,row)=>{
    form.dataset.id=row.id;
    form.dataset.updated=row.updatedAt||'';
    return form;
  };

  function classification(doc,row){
    const aliases=doc.analyteAliases||{},match=A.classify(row,aliases);
    const shared=A.findRule(aliases,row.name);
    const documentId=doc.documents.some(item=>item.id===row.documentId)?row.documentId:'';
    const file=documentId?A.findRule(aliases,row.name,documentId):null;
    const scopes=[['name','Это название во всём журнале']];
    if(documentId)scopes.push(['document','Это название только в данном файле']);
    const catalog=[...A.catalog].sort((a,b)=>a[1].localeCompare(b[1],'ru'));
    const search=V.field('Поиск по каталогу','catalogSearch','','search');
    const target=V.field('Показатель из каталога','target',file?.target||shared?.target||'','select',[
      ['','По правилам приложения'],...catalog.map(([id,name])=>[id,name]),
    ]);
    const scope=V.field('Область сопоставления','scope',documentId?match.scope:'name','select',scopes);
    const info=V.h('p',{class:'health-note'});
    const form=bind(V.form('analyte-alias',[
      V.h('p',{},'В бланке: ',V.h('strong',{},row.name),' · ',names[match.basis]),
      V.row(scope,search,target),info,
      V.field('Причина сопоставления','reason','','text',null,true),error(),
    ],'Сохранить сопоставление'),row);
    form.dataset.nameVersion=String(shared?.version||0);
    form.dataset.documentVersion=String(file?.version||0);
    const select=target.querySelector('select');
    const refresh=()=>{
      const query=A.normalize(search.querySelector('input').value);
      const current=select.value;
      select.replaceChildren(V.h('option',{value:''},'По правилам приложения'));
      for(const [id,name,spellings] of catalog){
        if(id===current||!query||A.normalize([name,...spellings].join(' ')).includes(query))
          select.append(V.h('option',{value:id},name));
      }
      select.value=current;
    };
    const updateScope=()=>{
      const scoped=scope.querySelector('select').value==='document';
      const selected=scoped?file:shared;
      search.querySelector('input').value='';
      refresh();
      select.value=selected?.target||'';
      const normalized=A.normalize(row.name);
      const count=doc.observations.filter(item=>{
        if(A.normalize(item.name)!==normalized)return false;
        return scoped?item.documentId===documentId:
          !item.documentId||!A.findRule(aliases,item.name,item.documentId)?.target;
      }).length;
      info.textContent=scoped?'Записей из файла с этим названием: '+count+'.'
        :'Записей с этим названием без правила файла: '+count+'. Правило применяется и к новым загрузкам.';
    };
    search.querySelector('input').addEventListener('input',refresh);
    scope.querySelector('select').addEventListener('change',updateScope);
    updateScope();
    const keys=new Set([A.aliasKey(row.name)]);
    if(row.documentId)keys.add(A.aliasKey(row.name,row.documentId));
    const history=[shared,row.documentId?A.findRule(aliases,row.name,row.documentId):null,
      ...doc.revisions.filter(item=>item.kind==='analyte-alias'&&keys.has(item.recordId))
      .map(item=>item.previous)].filter(Boolean).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    const past=history.length?V.h('details',{class:'classification-history'},
      V.h('summary',{},'История сопоставлений ('+history.length+')'),
      history.map(item=>V.h('p',{},V.date(item.updatedAt),' · ',item.documentId?'Из файла':'Во всём журнале',
        ' · ',A.byId.get(item.target)?.name||'По правилам приложения',' · ',item.reason))):null;
    return V.h('details',{class:'classification-settings'},
      V.h('summary',{},'Сопоставить название показателя'),form,past);
  }

  function origin(doc,row){
    const file=row.provenance;
    const match=A.classify(row,doc.analyteAliases);
    const entries=[['Сопоставление',match.name+' · '+names[match.basis]]];
    if(file){
      entries.push(['Источник',[file.filename,file.sheet,file.row?'строка '+file.row:'',file.column?'колонка '+file.column:''].filter(Boolean).join(' · ')]);
      if(file.sourceDate)entries.push(['Дата в источнике',file.sourceDate]);
      if(typeof file.collectionDate?.raw==='string')entries.push(['Дата забора в бланке',file.collectionDate.raw]);
      if(typeof file.originalUnit==='string'&&(row.unitHistory||file.originalUnit.trim()!==row.unit))
        entries.push(['Единица в источнике',file.originalUnit||'Не указана']);
      if(typeof file.originalReference==='string'&&file.originalReference.trim()&&file.originalReference!==row.referenceText)
        entries.push(['Референс в источнике',V.h('div',{class:'preserve'},file.originalReference)]);
      if(file.method==='ocr-tesseract')entries.push(['Способ импорта','Распознавание скана']);
      if(file.method==='manual')entries.push(['Способ импорта','Введено вручную из бланка']);
      if(file.classification)entries.push(['При импорте',file.classification.name+' · '+names[file.classification.basis]]);
    }
    if(row.unitHistory){
      const assigned=row.unitHistory;
      const applied=A.effectiveUnit(row,doc.analyteAliases)===assigned.unit;
      const source=assigned.settingsVersion?'Из настроек, версия '+assigned.settingsVersion
        :'Из измерения '+V.date(assigned.observationDate);
      entries.push(['Подстановка единицы',assigned.unit+' · '+source+(applied?'':' · требуется повторный выбор')]);
      if(assigned.reason)entries.push(['Основание',assigned.reason]);
    }
    const details=V.h('dl',{class:'metadata'},entries.flatMap(([label,value])=>[V.h('dt',{},label),V.h('dd',{},value)]));
    const linked=doc.documents.flatMap(document=>Array.isArray(document.importLinks)?document.importLinks
      .filter(link=>link?.observationId===row.id).map(link=>V.h('li',{},
        V.button('Открыть связанный источник','file-preview',{'data-id':document.id,class:'small'}),
        V.h('p',{},[link.filename,link.sheet,link.row?`строка ${link.row}`:'',link.column?`колонка ${link.column}`:'',link.method==='manual'?'Введено вручную':''].filter(Boolean).join(' · ')),
        Array.isArray(link.raw)&&link.raw.length?V.h('details',{},V.h('summary',{},'Исходные значения'),V.h('p',{},link.raw.join(' · '))):null)):[]);
    return V.h('div',{class:'analyte-origin'},details,
      file?.raw?.length?V.h('details',{},V.h('summary',{},'Строка в исходном файле'),
        V.h('p',{},file.raw.join(' · '))):null,
      linked.length?V.h('details',{},V.h('summary',{},`Связанные источники (${linked.length})`),V.h('ul',{class:'health-linked-sources'},linked)):null);
  }

  function unitChoice(doc,row){
    const rules=doc.analyteAliases||{},current=A.effectiveUnit(row,rules);
    if(row.unit)return null;
    const options=A.unitOptions(doc,row);
    const clear=row.unitHistory?V.button('Снять подстановку','clear-history-unit',{'data-id':row.id,class:'small'}):null;
    if(current||!options.length)return clear;
    const form=bind(V.form('analyte-unit',[
      V.field('Единица для результата без единицы','unit','','select',[
        ['','Выберите единицу'],...options.map(item=>[item.unit,item.unit+
          (item.settingsVersion?' · из настроек':' · из истории')]),
      ]),error(),
    ],'Применить единицу'),row);
    form.dataset.context=A.context(row,rules);
    return V.h('div',{},form,clear);
  }

  function preferredUnit(doc,row){
    const key=A.defaultKey(row,doc.analyteAliases),entry=doc.analytePreferences?.[key];
    const form=bind(V.form('analyte-default-unit',[
      V.row(V.field('Единица для подстановки','unit',entry?.unit||''),
        V.field('Причина изменения','reason','','text',null,true)),
      V.h('p',{class:'health-note'},'Эта единица предлагается для результатов без единицы с тем же материалом и методом.'),
      error(),
    ],'Сохранить единицу'),row);
    form.dataset.version=String(entry?.version||0);
    form.dataset.key=key;
    return form;
  }
  window.HumanAnalyteView={classification,origin,unitChoice,preferredUnit};
})();
