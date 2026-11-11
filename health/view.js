/* HUMAN UI primitives: all user-supplied text is rendered as DOM text, never HTML. */
(() => {
  'use strict';
  const M=window.HumanModel,A=window.HumanAnalytes;
  function icon(name,size=18){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),use=document.createElementNS(ns,'use');svg.setAttribute('width',size);svg.setAttribute('height',size);svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');use.setAttribute('href','./icons.svg?v=3434fab979f5#'+name);svg.append(use);return svg;}
  function brand(mode='pair'){
    const portal=h('a',{class:'ayyy-wordmark',href:'../#home',target:'_top','aria-label':'AYYY · на главную портала'},'ayyy',h('span',{},'.'));
    const human=h('a',{class:'brand',href:'./','data-tab':'overview','aria-label':'HUMAN · обзор журнала здоровья'},
      h('img',{src:'./icon.svg',width:32,height:32,alt:''}),
      h('span',{class:'brand-copy'},h('span',{},'HUMAN'),h('small',{},'ЖУРНАЛ ЗДОРОВЬЯ')));
    if(mode==='human')return human;
    if(mode==='ayyy')return portal;
    return h('div',{class:'health-brand-pair'},portal,
      h('span',{class:'health-brand-divider','aria-hidden':'true'}),human);
  }
  function h(tag,attrs={},...children) {
    const node=document.createElement(tag);
    for(const [key,value] of Object.entries(attrs)) {
      if(value===null||value===undefined||value===false)continue;
      if(key==='class')node.className=value;
      else if(key==='value')node.value=value;
      else node.setAttribute(key,value===true?'':String(value));
    }
    function append(child) {
      if(child===null||child===undefined||child===false)return;
      if(Array.isArray(child)){child.forEach(append);return;}
      node.append(child instanceof Node?child:document.createTextNode(String(child)));
    }
    children.forEach(append);
    return node;
  }
  function button(text,action,attrs={}){
    const glyph=action==='quick-add'||action?.startsWith('new-')?'Plus':({csv:'FileText',backup:'FileText','edit-profile':'UserRound','file-download':'FileText'})[action];
    return h('button',{type:'button',...attrs,class:'button health-btn '+(attrs.class||''),
      'data-action':action},glyph?icon(glyph,15):null,text);
  }
  function importFolder(label,attrs){
    return typeof HTMLInputElement!=='undefined'&&'webkitdirectory' in HTMLInputElement.prototype?button(label,'import-folder',attrs):null;
  }
  function card(title,items=[]){
    const box=h('section',{class:'health-card card'});
    if(title)box.append(h('div',{class:'section-heading'},h('h2',{},title)));
    for(const item of items)if(item)box.append(item);
    return box;
  }
  function title(text,description,buttons=[]){
    return h('div',{class:'health-heading'},
      h('div',{},h('p',{class:'eyebrow'},'ЛИЧНЫЙ ЖУРНАЛ',h('span',{},'/'),'HUMAN'),h('h1',{},h('span',{class:'title-underline'},text)),h('p',{class:'page-description'},description)),
      buttons.length?h('div',{class:'health-toolbar'},buttons):h('span',{class:'page-note'},icon('CalendarDays',14),new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})));
  }
  function empty(text,action){
    return h('div',{class:'health-empty'},h('strong',{},text),
      action?button('Добавить запись',action,{class:'small'}):null);
  }
  function banner(label,message){
    return h('div',{class:'health-banner info'},h('div',{},h('strong',{},label),h('p',{},message)));
  }
  function status(row){
    const kind=M.status(row);
    return h('span',{class:'health-pill badge '+(kind==='normal'?'ok success':kind==='abnormal'?'bad danger':'')},
      row.reviewStatus==='draft'?'Черновик':kind==='normal'?'В референсе':kind==='abnormal'?'Вне референса':'Без оценки');
  }
  function date(value){
    if(!value)return 'Дата неизвестна';
    if(/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value)))return new Date(value).toLocaleString('ru-RU',{timeZone:'UTC'})+' UTC';
    if(/^\d{4}$/.test(value))return value+' г.';
    if(/^\d{4}-\d{2}$/.test(value))return value.slice(5)+'.'+value.slice(0,4);
    if(!/^\d{4}-\d\d-\d\d$/.test(value))return value;
    const parsed=new Date(value+'T12:00:00');
    return Number.isNaN(+parsed)?value:parsed.toLocaleDateString('ru-RU');
  }
  function form(mode,children,label){
    const box=h('form',{class:'health-form','data-form':mode});
    for(const child of children)box.append(child);
    box.append(h('div',{class:'health-form-actions'},
      h('button',{type:'submit',class:'health-btn primary'},label)));
    return box;
  }
  function field(label,name,value='',type='text',choices=null,required=false) {
    let input;
    if(type==='textarea')input=h('textarea',{name,rows:3},value);
    else if(type==='select'){
      input=h('select',{name},(choices||[]).map(x=>
        h('option',{value:x[0],selected:x[0]===value?true:null},x[1])));
      input.value=value;
    }else input=h('input',{name,type,required,value:type==='file'?null:value,autocomplete:'off'});
    return h('label',{class:'field'},h('span',{},label),input);
  }
  function row(...children){return h('div',{class:'health-form-row'},children);}
  function table(labels,rows){
    const head=h('tr',{},labels.map(x=>h('th',{},x)));
    const body=h('tbody',{},rows.map(cells=>h('tr',{},cells.map(x=>h('td',{},x)))));
    return h('div',{class:'health-table-wrap'},
      h('table',{class:'health-table'},h('thead',{},head),body));
  }
  function referenceLabel(row,empty='—'){
    return row.low||row.high?`${row.low||'—'} — ${row.high||'—'}`:row.referenceText?'Условия из бланка':empty;
  }
  function referenceCell(row){
    if(!row.referenceText)return referenceLabel(row);
    return h('div',{},row.low||row.high?referenceLabel(row):null,
      h('details',{class:'measurement-reference-text'},h('summary',{},'Условия из бланка'),h('p',{class:'preserve'},row.referenceText)));
  }
  function buttons(kind,item,editable=true){
    return h('div',{class:'health-actions'},
      editable?button('Редактировать','edit',{class:'small','data-kind':kind,'data-id':item.id}):null,
      button('Удалить','remove',{class:'small danger','data-kind':kind,'data-id':item.id}));
  }
  function stats(state){
    const d=state.doc,groups=M.groups(d.observations,d.analytePreferences,d.analyteAliases);
    const J=window.HumanJournal,today=J.profileDay(d.profile),timeline=J.events(d);
    const dayInZone=new Intl.DateTimeFormat('sv-SE',{timeZone:window.HumanHealth.zoneName(d.profile.timezone),year:'numeric',month:'2-digit',day:'2-digit'});
    const datedEvents=timeline.filter(event=>Number.isFinite(Date.parse(event.happenedAt)));
    const todayCount=datedEvents.filter(event=>dayInZone.format(new Date(event.happenedAt))===today).length;
    const overview=h('div',{});
    const heading=title('Обзор здоровья','Показатели, документы и события — всё под рукой.');
    heading.querySelector('h1').replaceChildren(document.createTextNode('Обзор '),h('span',{class:'title-underline'},'здоровья'));
    overview.append(heading);
    overview.append(h('div',{class:'diary-overview'},
      h('button',{class:'button','data-tab':'care'},'Приёмы и напоминания'),
      h('button',{class:'button','data-tab':'vital'},'Показатели · '+(d.vitals.length+d.episodes.length)),
      h('button',{class:'button','data-tab':'medical'},'Медкарта · '+(d.medical.length+d.medications.length))));
    const cards=h('div',{class:'metrics'});
    for(const [name,count,desc,tone,glyph,tab] of [
      ['Анализы',d.observations.length,'Сохранённые результаты','blue','FlaskConical','lab'],
      ['Генетические записи',d.findings.length,'Результаты из отчётов','green','Dna','genetics'],
      ['Документы',d.documents.length,'Файлы и заключения','red','FileText','document'],
      ['Записи сегодня',todayCount,date(today),'yellow','History','timeline']
    ])cards.append(h('button',{type:'button',class:'metric tone-'+tone,'data-tab':tab},
      h('span',{class:'metric-icon'},icon(glyph,20)),h('div',{class:'metric-copy'},
      h('span',{class:'metric-label'},name),h('strong',{class:'metric-number'},count),
      h('span',{class:'metric-hint'},desc)),icon('ChevronRight',16)));
    overview.append(cards,h('div',{class:'diary-overview'},
      h('button',{class:'button','data-tab':'nutrition'},icon('Utensils',16),'Питание · '+d.diary.filter(row=>row.kind==='food').length+' записей'),
      h('button',{class:'button','data-tab':'activity'},icon('Dumbbell',16),'Активность · '+d.diary.filter(row=>row.kind==='activity').length+' дней')));
    const recent=card('Последние анализы');recent.classList.add('overview-latest');
    recent.querySelector('.section-heading').append(h('button',{class:'button text-link','data-tab':'lab'},'Все анализы',icon('ArrowRight',13)));
    const latest=M.recent(d.observations,6);
    if(latest.length){
      const rows=latest.map(x=>h('tr',{},
        h('td',{class:'observation-name'},h('button',{class:'table-name','data-action':'edit','data-kind':'lab','data-id':x.id},x.name),h('small',{class:'mobile-lab-meta'},date(x.date))),
        h('td',{class:'observation-value'},h('strong',{},x.value),h('span',{class:'unit'},x.unit)),
        h('td',{class:'observation-reference'},referenceLabel(x,'Не указан')),
        h('td',{class:'observation-status'},status(x))));
      recent.append(h('div',{class:'table-wrap'},h('table',{class:'observations-table overview-table'},h('thead',{},h('tr',{},['Показатель','Результат','Референс','Статус'].map((s,i)=>h('th',{scope:'col',class:i===2?'observation-reference':null},s)))),h('tbody',{},rows))),h('p',{class:'table-summary'},h('span',{},'Последний результат: '+date(latest[0].date)),h('span',{},latest.length+' из '+d.observations.length)));
    }
    if(!d.observations.length)recent.append(empty('Пока нет лабораторных данных','new-lab'));
    const attention=card('Требует внимания');attention.classList.add('overview-attention','tone-red');
    const abnormal=groups.filter(x=>x.status==='abnormal');
    for(const g of abnormal.slice(0,3))attention.append(h('button',{class:'data-row','data-action':'open-group','data-key':g.key},h('span',{class:'attention-icon'},icon('Activity',16)),h('div',{},h('strong',{},g.name),h('small',{},date(g.latest.date))),h('div',{class:'row-result'},status(g.effectiveLatest),h('strong',{},g.latest.value,h('small',{class:'unit'},g.unit)))));
    if(!abnormal.length)attention.append(empty('Нет записей, отмеченных по введённым референсам.'));
    else attention.append(h('p',{class:'table-caption'},'Значения за пределами референсов, сохранённых вместе с результатами.'));
    const events=card('Последние события');events.classList.add('overview-events','tone-yellow');
    events.querySelector('.section-heading').append(h('button',{class:'button text-link','data-tab':'timeline'},'Вся история',icon('ArrowRight',13)));
    for(const event of datedEvents.slice(0,4))events.append(h('button',{class:'data-row','data-action':'timeline-open','data-id':event.id},
      icon(event.recordKind==='lab'?'FlaskConical':'History',17),h('div',{},h('strong',{},event.title),h('small',{},J.labels[event.kind]||event.kind)),
      h('small',{},date(dayInZone.format(new Date(event.happenedAt))))));
    if(!datedEvents.length)events.append(empty('События появятся после добавления записей.'));
    const trend=card('Динамика показателя');trend.classList.add('overview-trend','tone-green');
    const series=groups.filter(g=>M.chartRows(g.rows).length);
    const selected=series.find(g=>g.key===state.trendKey)||series[0];
    if(series.length)trend.append(h('label',{class:'trend-picker'},h('span',{class:'sr-only'},'Показатель для графика'),h('select',{'data-trend':'overview','aria-label':'Показатель для графика'},series.map(g=>h('option',{value:g.key,selected:g===selected},g.name+' · '+g.unit)))));
    if(selected){trend.append(h('div',{class:'trend-summary'},h('strong',{},selected.latest.value,h('small',{class:'unit'},selected.unit)),h('small',{},date(selected.latest.date))),chart(selected,{compact:true}),h('button',{class:'button text-link','data-action':'open-group','data-key':selected.key},'Все измерения',icon('ArrowRight',13)));}
    else trend.append(empty('Динамика появится после первого числового измерения с точной датой.'));
    const docs=card('Документы');docs.classList.add('overview-documents','tone-red');
    docs.querySelector('.section-heading').append(h('button',{class:'button text-link','data-tab':'document'},'Все',icon('ArrowRight',13)));
    for(const x of M.recent(d.documents,2))docs.append(h('button',{class:'data-row','data-action':'file-preview','data-id':x.id},icon('FileText',20),h('div',{},h('strong',{},x.title||x.name),h('small',{},date(x.date)))));
    if(!d.documents.length)docs.append(empty('Документов пока нет','new-document'));
    overview.append(h('div',{class:'overview-grid'},h('div',{class:'overview-main'},recent,events),h('aside',{class:'overview-aside'},attention,trend,docs)));
    return overview;
  }
  function listSection(state,kind){
    const definitions={
      vital:['Показатели','Домашние измерения, самочувствие и история.','Новое измерение','vitals'],
      medical:['Медицинская карта','Аллергии, заболевания, операции и прививки','Новая запись','medical'],
      medication:['Лекарства','Препараты и их схемы','Новый препарат','medications'],
      diary:['Дневник','Питание, активность, сон и самочувствие','Новая запись','diary'],
      document:['Документы','Бланки, заключения и направления в одном месте.','Новый документ','documents']
    };
    const [name,desc,action,property]=definitions[kind];
    let data=M.recent(state.doc[property],1000);
    const section=h('div',{});
    section.append(title(name,desc,kind==='vital'?[]:[button(action,'new-'+kind,{class:'primary'})]));
    const categories={allergy:'Аллергии',condition:'Заболевания',vaccine:'Прививки',surgery:'Операции',other:'Другое'};
    const diaryKinds={food:'Питание',activity:'Активность',sleep:'Сон',wellbeing:'Самочувствие'};
    let selected=state.filters?.[kind]||'';
    const vitalIcons={'Масса':'Scale','Давление':'HeartPulse','Пульс':'Activity','Температура':'Thermometer','Глюкоза':'TestTubeDiagonal','Сон':'Clock','Шаги':'Footprints','Рост':'Ruler'};
    const filters=(choices,label)=>h('div',{class:'health-kind-tabs',role:'group','aria-label':label},choices.map(([value,label])=>h('button',{type:'button',class:'button','data-action':'filter-records','data-kind':kind,'data-value':value,'aria-pressed':String(value===selected)},kind==='vital'?icon(vitalIcons[value],15):null,label)));
    if(kind==='vital'){
      const types=['Масса','Давление','Пульс','Температура','Глюкоза','Сон','Шаги','Рост'];
      selected=selected||(types.find(type=>data.some(x=>x.type===type))||types[0]);
      section.append(filters(types.map(type=>[type,type]),'Виды домашних показателей'));
      data=data.filter(x=>x.type===selected);
      const latest=data[0];
      section.append(h('section',{class:'card health-card health-vital-summary'},h('div',{},h('small',{},selected),h('strong',{},latest?latest.value+' '+latest.unit:'Пока нет записей'),h('small',{},latest?date(latest.date):'Добавьте первое измерение')),button('Добавить измерение','new-vital',{class:'primary','data-value':selected})));
      if(data.some(x=>M.number(x.value)!==null))section.append(card('Динамика · '+selected,[chart({name:selected,unit:latest.unit,rows:data.filter(x=>x.unit===latest.unit)})]));
    }else if(kind==='medical'||kind==='diary'){
      const labels=kind==='medical'?categories:diaryKinds;
      section.append(filters([['','Все записи'],...Object.entries(labels)],kind==='medical'?'Разделы медкарты':'Виды дневников'));
      if(selected)data=data.filter(x=>(kind==='medical'?x.category:x.kind)===selected);
    }
    const items=card(kind==='vital'?'История · '+data.length:null);
    if(kind==='document'){
      const search=state.documentQuery||'',query=search.trim().toLocaleLowerCase('ru-RU');
      if(query)data=data.filter(item=>[item.name,item.title].some(value=>value?.toLocaleLowerCase('ru-RU').includes(query)));
      const offset=Math.min(state.documentOffset||0,Math.floor(Math.max(0,data.length-1)/50)*50);
      items.append(h('div',{class:'filters'},h('label',{class:'filter-search'},icon('Search',16),
        h('input',{type:'search','data-search':'documents','aria-label':'Поиск документов',placeholder:'Название файла…',value:search})),
        search?button('Сбросить','document-reset'):null));
      const rows=data.slice(offset,offset+50).map(item=>{
        const extension=item.name.includes('.')?item.name.split('.').pop().slice(0,5).toUpperCase():'ФАЙЛ';
        const size=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(item.size/(item.size>=1048576?1048576:1024))+(item.size>=1048576?' МБ':' КБ');
        return h('tr',{},h('td',{class:'document-main'},h('div',{class:'document-cell'},h('span',{class:'file-stamp tone-'+(extension==='PDF'?'red':'blue')},icon('FileText',21),h('span',{},extension)),h('div',{},h('button',{class:'table-name','data-action':'file-preview','data-id':item.id},item.title||item.name),h('span',{class:'table-subline'},item.name),h('span',{class:'mobile-document-date'},date(item.date)+' · '+size)))),h('td',{class:'document-type'},h('span',{class:'badge info'},extension)),h('td',{class:'document-date'},date(item.date)),h('td',{class:'document-size'},size),h('td',{class:'document-actions'},button('Скачать','file-download',{class:'small','data-id':item.id}),buttons(kind,item,false)));
      });
      if(rows.length)items.append(h('div',{class:'table-wrap'},h('table',{class:'documents-table'},h('thead',{},h('tr',{},['Документ','Формат','Добавлен','Размер','Действия'].map(label=>h('th',{scope:'col'},label)))),h('tbody',{},rows))));
      else items.append(h('div',{class:'health-empty health-documents-empty'},icon('FileText',26),h('strong',{},query?
        'Документы по этому запросу не найдены. Попробуйте другое название.':'Загрузите заключение, лабораторный бланк или исходный файл. Документы сохраняются в зашифрованном журнале.')));
      items.append(h('div',{class:'pager'},h('span',{},data.length?`${offset+1}–${Math.min(offset+50,data.length)} из ${data.length}`:'Нет записей'),
        button('Назад','document-page',{'data-offset':Math.max(0,offset-50),disabled:!offset}),
        button('Далее','document-page',{'data-offset':offset+50,disabled:offset+50>=data.length})));
    }else if(!data.length)items.append(empty('Записей пока нет','new-'+kind));
    else{
      const labels=kind==='vital'?['Дата','Результат','Контекст','Действия']:kind==='medication'?['Препарат','Схема','Начало приёма','Примечание','Действия']:['Запись','Раздел','Дата','Примечание','Действия'];
      items.append(table(labels,data.map(item=>kind==='vital'?[
        date(item.date),h('strong',{},item.value+' '+item.unit),item.notes||'—',buttons(kind,item)
      ]:kind==='medication'?[
        h('strong',{},item.name),[item.dose,item.frequency].filter(Boolean).join(' · ')||'—',date(item.startDate),item.notes||'—',buttons(kind,item)
      ]:[h('button',{class:'table-name','data-action':'edit','data-kind':kind,'data-id':item.id},item.title),
        (kind==='medical'?categories[item.category]:diaryKinds[item.kind])||'—',date(item.date),item.notes||'—',buttons(kind,item)])));
    }
    section.append(items);
    return section;
  }
  function labSection(state,hasImport=false){
    const doc=state.doc,rules=doc.analyteAliases,AV=window.HumanAnalyteView;
    const from=state.labFrom||'',to=state.labTo||'',dateFilter=!!(from||to),invalidPeriod=from&&to&&from>to;
    const dayInZone=new Intl.DateTimeFormat('sv-SE',{timeZone:window.HumanHealth.zoneName(doc.profile.timezone),year:'numeric',month:'2-digit',day:'2-digit'});
    const observations=state.groupKey||!dateFilter?doc.observations:invalidPeriod?[]:doc.observations.filter(row=>{
      const day=row.datePrecision==='exact'&&Number.isFinite(Date.parse(row.date))?dayInZone.format(new Date(row.date)):row.date;
      return day&&(!from||day>=from.slice(0,day.length))&&(!to||day<=to.slice(0,day.length));
    });
    const all=M.groups(observations,doc.analytePreferences,rules);
    const query=A.normalize(state.search);
    const filtered=all.filter(group=>(!query||group.rows.some(row=>A.searchText(row,rules).includes(query)))&&
      (!state.abnormalOnly||group.status==='abnormal')&&(!state.favoritesOnly||group.preferences.favorite));
    const selected=all.find(group=>group.rows.some(row=>row.id===state.observationId))||
      all.find(group=>group.key===state.groupKey)||filtered[0];
    const section=h('div',{});
    const heading=title(state.groupKey&&selected?selected.name:'Анализы','Результаты исследований с историей и референсами.');
    heading.classList.add('page-heading-labs');
    section.append(heading,h('div',{class:'labs-mode actions','aria-label':'Работа с анализами'},
      button('Результаты','lab-results',{'aria-pressed':String(!state.groupKey)}),button('Импорт файлов','csv'),
      button('Добавить вручную','new-lab')));
    if(!state.groupKey)section.append(h('div',{class:'health-import-resume'},
      importFolder('Импорт папки',{class:'small'}),
      button('Снять фото бланка','capture-import',{class:'small'}),
      hasImport?button('Продолжить импорт','continue-import',{class:'small'}):state.demo?null:button('Открыть черновик импорта','open-import-draft',{class:'small'})));
    if(!state.groupKey){
      const box=card(null);box.classList.add('grouped-labs');
      box.append(h('div',{class:'filters'},button('☆ Избранное','filter-favorites',{class:'favorites-filter','aria-pressed':String(!!state.favoritesOnly)}),
        button('Отклонения','filter-abnormal',{class:'abnormal-filter','aria-pressed':String(!!state.abnormalOnly)}),
        h('label',{class:'filter-search'},icon('Search',15),h('input',{type:'search','data-search':'labs','aria-label':'Поиск анализов',
          placeholder:'Показатель или название из бланка…',value:state.search||''})),
        h('label',{},'С ',h('input',{type:'date','data-lab-date':'labFrom','aria-label':'Начало периода',value:from})),
        h('label',{},'По ',h('input',{type:'date','data-lab-date':'labTo','aria-label':'Конец периода',value:to})),
        (query||dateFilter||state.abnormalOnly)?button('Сбросить','lab-reset'):null));
      if(invalidPeriod){box.append(h('p',{class:'health-lab-period-error error',role:'alert'},'Конец периода должен быть не раньше его начала.'));section.append(box);return section;}
      const offset=Math.min(state.labOffset||0,Math.floor(Math.max(0,filtered.length-1)/50)*50);
      const grouped=h('table',{class:'analyte-groups'},h('thead',{},h('tr',{},['Показатель','Последний результат','Среднее','Общий референс','Измерений','Дата последнего'].map(label=>h('th',{scope:'col'},label)))));
      const body=h('tbody',{});
      for(const g of filtered.slice(offset,offset+50)){
        const values=M.numericRows(g.rows).map(row=>M.number(row.value));
        const average=values.length?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(values.reduce((a,b)=>a+b,0)/values.length):'—';
        const technique={direct:'Прямой',friedewald:'По Фридевальду'}[g.match.technique];
        const context=[g.latest.material,g.latest.method,technique].filter(Boolean).join(' · ');
        const favorite=button(g.preferences.favorite?'★':'☆','toggle-favorite',{
          'data-key':g.favoriteKey,'data-group':g.key,class:'favorite-toggle'+(g.preferences.favorite?' is-favorite':''),
          'aria-label':'Избранное: '+g.name,'aria-pressed':String(!!g.preferences.favorite),
        });
        const open=h('button',{class:'group-name','data-action':'open-group','data-key':g.key,'data-id':g.latest.id},
          h('span',{},h('strong',{},g.name),g.match.basis==='source'?h('small',{},'По исходному названию'):null),icon('ChevronRight',14));
        body.append(h('tr',{},
          h('td',{},h('div',{class:'group-name-cell'},favorite,open),context?h('small',{},context):null),
          h('td',{},h('strong',{},g.latest.value),h('span',{class:'unit'},g.unit),h('div',{class:'lab-status'},status(g.effectiveLatest)),
            h('small',{class:'mobile-count'},'Измерений: '+g.rows.length)),
          h('td',{},h('strong',{},average),values.length?h('span',{class:'unit'},g.unit):null,h('small',{},values.length+' из '+g.rows.length)),
          h('td',{},referenceCell(g.effectiveLatest)),
          h('td',{},h('span',{class:'measurement-count'},g.rows.length)),h('td',{},date(g.latest.date))));
      }
      grouped.append(body);box.append(filtered.length?h('div',{class:'table-wrap'},grouped):empty('Показателей по этим условиям нет.'));
      if(filtered.length)box.append(h('div',{class:'pager'},h('span',{},'Показателей: '+filtered.length+' · измерений: '+filtered.reduce((a,g)=>a+g.rows.length,0)),
        button('Назад','lab-page',{'data-offset':Math.max(0,offset-50),disabled:!offset}),
        button('Далее','lab-page',{'data-offset':offset+50,disabled:offset+50>=filtered.length})),
        h('p',{class:'summary-footnote'},'Среднее — арифметическое одной единицы '+(dateFilter?'за выбранный период':'за всё время')+'. Разные единицы, материалы и методы не смешиваются. Откройте показатель для графика и всех измерений.'));
      section.append(box);return section;
    }
    if(!selected){section.append(empty('Нет показателей','new-lab'));return section;}
    const g=selected,current=g.rows.find(x=>x.id===state.observationId)||g.latest;
    const raw=doc.observations.find(row=>row.id===current.id);
    const numeric=M.numericRows(g.rows),average=numeric.length?numeric.reduce((sum,x)=>sum+M.number(x.value),0)/numeric.length:null;
    const fmt=n=>n===null?'—':new Intl.NumberFormat('ru-RU',{maximumSignificantDigits:6}).format(n);
    const page=h('article',{class:'analyte-page','aria-label':'Страница показателя'});
    page.append(h('section',{class:'analyte-statistics','aria-label':'Сводка показателя'},[
      ['blue','Activity','Последний результат',g.latest.value+' '+g.unit,date(g.latest.date)],
      ['green','TrendingUp','Среднее значение',fmt(average)+' '+g.unit,numeric.length+' из '+g.rows.length+' измерений'],
      ['red','ShieldCheck',g.preferences.useReference?'Общий референс':'Референс последней записи',referenceLabel(g.effectiveLatest),g.unit],
      ['yellow','LayoutGrid','Всего измерений',g.rows.length,'Вся история показателя']
    ].map(([tone,glyph,label,value,note])=>{const svg=icon(glyph,22);svg.classList.add('stat-icon');return h('div',{class:'analyte-stat stat-'+tone},svg,h('div',{},h('small',{},label),h('strong',{class:tone==='red'?'reference-summary':''},value),h('small',{},note)));})));
    page.append(h('details',{class:'analyte-explanation'},h('summary',{},'Как читать эти данные'),h('p',{},'Среднее рассчитано по точным числовым результатам этой группы. Разные единицы, материалы и методы не смешиваются. Референсы сохранены у каждого измерения. Выберите точку или дату в таблице, чтобы увидеть её источник.')));
    const preferences=g.preferences,settings=form('analyte-preferences',[
      field('Единица','unit',g.unit,'select',[[g.unit,g.unit||'Не указана']]),
      row(field('Нижняя граница','low',preferences.low??g.latest.low??''),field('Верхняя граница','high',preferences.high??g.latest.high??'')),
      field('Референс графика','useReference',preferences.useReference?'yes':'no','select',[['no','Использовать исходные нормы каждой записи'],['yes','Применить общий референс к этой единице']]),
      field('Пояснение','note',preferences.note||''),
      h('p',{class:'health-note'},'Исходные значения и нормы лабораторий сохраняются. Разные единицы, материалы и методы остаются отдельными группами.'),
      h('p',{class:'error',role:'alert',hidden:true,'data-form-error':'yes'}),
    ],'Применить ко всей истории');
    settings.dataset.key=g.key;
    settings.dataset.id=raw.id;
    settings.dataset.updated=raw.updatedAt||'';
    page.append(h('details',{class:'analyte-settings'},h('summary',{},'Общие настройки показателя'),settings,AV.preferredUnit(doc,raw)));
    const plot=card('Динамика',[chart(g,{selected:current.id,interactive:true}),h('p',{class:'chart-reference-note'},'Среднее: '+fmt(average)+' '+g.unit+' · '+numeric.length+' измерений')]);plot.classList.add('analyte-chart');
    const metadata=h('dl',{class:'metadata'});
    for(const [label,value] of [['Показатель в бланке',current.name],['Дата',date(current.date)],['Результат',raw.value+' '+raw.unit],['Референс',referenceLabel(current)],['Источник',current.source],['Материал',current.material],['Метод',current.method],['Примечание',current.notes]])metadata.append(h('dt',{},label),h('dd',{},value||'Не указан'));
    if(current.referenceText)metadata.append(h('dt',{},'Условия референса из бланка'),h('dd',{class:'preserve'},current.referenceText));
    const source=card('Выбранное измерение',[status(current),metadata,AV.origin(doc,raw),AV.unitChoice(doc,raw),
      button('Редактировать','edit',{'data-kind':'lab','data-id':current.id})]);
    source.classList.add('analyte-source');
    if(doc.documents.some(file=>file.id===current.documentId))
      source.append(button('Открыть источник','file-preview',{'data-id':current.documentId}));
    page.append(h('div',{class:'analyte-chart-layout'},plot,source));
    page.append(AV.classification(doc,raw));
    const history=card('История · '+g.rows.length,[table(['Дата','Значение','Референс','Источник','Действия'],g.rows.map(x=>[
      button(date(x.date),'select-observation',{'data-id':x.id,'aria-pressed':String(x.id===current.id),class:'small'}),h('span',{},h('strong',{},x.value+' '+x.unit),status(x)),referenceCell(x),x.source||'—',buttons('lab',x)
    ]))]);history.classList.add('analyte-history');page.append(history);section.append(page);
    return section;
  }
  function chart(group,options={}){
    const points=M.chartRows(group.rows).map(x=>M.referenceRow(x,group.preferences));
    if(!points.length)return empty('Для графика нужны числовые измерения');
    const values=points.map(x=>M.number(x.value));
    const refs=points.flatMap(x=>[M.number(x.low),M.number(x.high)]).filter(x=>x!==null);
    const min=Math.min(...values,...refs),max=Math.max(...values,...refs);
    const spread=max-min||Math.abs(max)*.1||1,lo=min-.12*spread,hi=max+.12*spread;
    const times=points.map(M.timestamp),span=times[times.length-1]-times[0];
    const width=options.compact?420:720,left=48,right=width-(options.compact?28:55),center=(left+right)/2;
    const coords=values.map((value,index)=>[
      span?left+(right-left)*(times[index]-times[0])/span:center,169-135*(value-lo)/(hi-lo)]);
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox',`0 0 ${width} 200`);svg.classList.add('health-spark');
    svg.setAttribute('role',options.interactive?'group':'img');svg.setAttribute('aria-label','График '+group.name);
    function svgNode(tag,attrs,text){
      const n=document.createElementNS(ns,tag);
      for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
      if(text!==undefined)n.textContent=String(text);
      svg.append(n);return n;
    }
    const yFor=n=>169-135*(n-lo)/(hi-lo);
    for(let i=0;i<points.length;i++){
      const rawLow=M.number(points[i].low),rawHigh=M.number(points[i].high);
      if(rawLow===null&&rawHigh===null)continue;
      const low=rawLow??lo,high=rawHigh??hi;
      if(low>high)continue;
      const start=i===0?left:(coords[i-1][0]+coords[i][0])/2;
      const end=i===points.length-1?right:(coords[i][0]+coords[i+1][0])/2;
      svgNode('rect',{x:start,y:yFor(high),width:end-start,height:yFor(low)-yFor(high),fill:'#edf8f2'});
    }
    [38,103,169].forEach(y=>{svgNode('line',{x1:left,x2:right,y1:y,y2:y,stroke:'#dce4ee','stroke-dasharray':'4 5'});svgNode('text',{x:37,y:y+4,'text-anchor':'end',fill:'#667080','font-size':11},new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(lo+(169-y)/135*(hi-lo)));});
    if(options.interactive){const mean=values.reduce((a,b)=>a+b,0)/values.length;svgNode('line',{x1:left,x2:right,y1:yFor(mean),y2:yFor(mean),stroke:'#c29416','stroke-width':1.5,'stroke-dasharray':'6 4'});}
    svgNode('polyline',{points:coords.map(x=>x.join(',')).join(' '),
      fill:'none',stroke:'#2674ca','stroke-width':3,'stroke-linejoin':'round'});
    coords.forEach((xy,i)=>{
      const color=M.status(points[i])==='abnormal'?'#c3263a':M.status(points[i])==='normal'?'#167346':'#2674ca';
      const dot=svgNode('circle',{cx:xy[0],cy:xy[1],r:options.selected===points[i].id?7:4,fill:options.selected===points[i].id?color:'white',stroke:color,'stroke-width':2});
      if(options.interactive){for(const [k,v] of Object.entries({'data-action':'select-observation','data-id':points[i].id,tabindex:'0',role:'button','aria-label':date(points[i].date)+' · '+points[i].value+' '+group.unit,'aria-pressed':String(options.selected===points[i].id)}))dot.setAttribute(k,v);}
      const hint=document.createElementNS(ns,'title');
      hint.textContent=date(points[i].date)+' · '+points[i].value;
      dot.append(hint);
    });
    if(!span)svgNode('text',{x:center,y:194,'text-anchor':'middle',fill:'#627889','font-size':11},date(points[0].date));
    else{
      svgNode('text',{x:left,y:194,fill:'#627889','font-size':11},date(points[0].date));
      svgNode('text',{x:right,y:194,'text-anchor':'end',fill:'#627889','font-size':11},date(points[points.length-1].date));
    }
    return h('div',{class:'health-chart-wrap'},svg,refs.length?h('p',{class:'health-chart-note'},h('span',{class:'health-reference-key'}),group.preferences?.useReference?'Общий референс показателя':'Референсы исходных записей'):null);
  }
  window.HumanView={h,icon,brand,button,importFolder,card,title,empty,banner,status,date,form,field,row,table,
    buttons,stats,listSection,labSection,category:{
      allergy:'Аллергия',condition:'Состояние',vaccine:'Прививка',surgery:'Операция',other:'Другое'}};
})();
