/* HUMAN UI primitives: all user-supplied text is rendered as DOM text, never HTML. */
(() => {
  'use strict';
  const M=window.HumanModel;
  function icon(name,size=18){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),use=document.createElementNS(ns,'use');svg.setAttribute('width',size);svg.setAttribute('height',size);svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');use.setAttribute('href','./icons.svg#'+name);svg.append(use);return svg;}
  function brand(){
    return h('div',{class:'health-brand-pair'},
      h('a',{class:'ayyy-wordmark',href:'../#home',target:'_top','aria-label':'AYYY · на главную портала'},'ayyy',h('span',{},'.')),
      h('span',{class:'health-brand-divider','aria-hidden':'true'}),
      h('a',{class:'brand',href:'./','data-tab':'overview','aria-label':'HUMAN · обзор журнала здоровья'},
        h('img',{src:'./icon.svg',width:32,height:32,alt:''}),
        h('span',{class:'brand-copy'},h('span',{},'HUMAN'),h('small',{},'ЖУРНАЛ ЗДОРОВЬЯ'))));
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
      kind==='normal'?'В референсе':kind==='abnormal'?'Вне референса':'Без оценки');
  }
  function date(value){
    if(!value)return '—';
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
  function buttons(kind,item,editable=true){
    return h('div',{class:'health-actions'},
      editable?button('Редактировать','edit',{class:'small','data-kind':kind,'data-id':item.id}):null,
      button('Удалить','remove',{class:'small danger','data-kind':kind,'data-id':item.id}));
  }
  function stats(state){
    const d=state.doc,groups=M.groups(d.observations);
    const overview=h('div',{});
    overview.append(title('Обзор здоровья','Показатели, документы и события — всё под рукой.'));
    overview.append(h('div',{class:'diary-overview'},
      h('button',{class:'button','data-tab':'vital'},icon('HeartPulse',16),'Показатели · '+d.vitals.length),
      h('button',{class:'button','data-tab':'medical'},icon('NotebookTabs',16),'Медкарта · '+d.medical.length),
      h('button',{class:'button','data-tab':'diary'},icon('BookOpen',16),'Дневник · '+d.diary.length)));
    const cards=h('div',{class:'metrics'});
    for(const [name,count,desc,tone,glyph,tab] of [
      ['Анализы',d.observations.length,'Сохранённые результаты','blue','FlaskConical','lab'],
      ['Измерения',d.vitals.length,'Домашние показатели','green','HeartPulse','vital'],
      ['Документы',d.documents.length,'Файлы и заключения','red','FileText','document'],
      ['Записи дневника',d.diary.length,'Самочувствие и события','yellow','Clock','diary']
    ])cards.append(h('button',{type:'button',class:'metric tone-'+tone,'data-tab':tab},
      h('span',{class:'metric-icon'},icon(glyph,20)),h('div',{class:'metric-copy'},
      h('span',{class:'metric-label'},name),h('strong',{class:'metric-number'},count),
      h('span',{class:'metric-hint'},desc)),icon('ChevronRight',16)));
    overview.append(cards);
    const recent=card('Последние анализы');recent.classList.add('overview-latest');
    recent.querySelector('.section-heading').append(h('button',{class:'button text-link','data-tab':'lab'},'Все анализы',icon('ArrowRight',13)));
    const latest=M.recent(d.observations,6);
    if(latest.length){
      const rows=latest.map(x=>h('tr',{},
        h('td',{class:'observation-name'},h('button',{class:'table-name','data-action':'edit','data-kind':'lab','data-id':x.id},x.name),h('small',{class:'mobile-lab-meta'},date(x.date))),
        h('td',{class:'observation-value'},h('strong',{},x.value),h('span',{class:'unit'},x.unit)),
        h('td',{class:'observation-status'},status(x)),h('td',{class:'observation-date'},date(x.date)),h('td',{class:'observation-source'},x.source||'—')));
      recent.append(h('div',{class:'table-wrap'},h('table',{class:'observations-table overview-table'},h('thead',{},h('tr',{},['Показатель','Результат','Статус','Дата','Источник'].map(s=>h('th',{scope:'col'},s)))),h('tbody',{},rows))),h('p',{class:'table-summary'},h('span',{},'Последний результат: '+date(latest[0].date)),h('span',{},latest.length+' из '+d.observations.length)));
    }
    if(!d.observations.length)recent.append(empty('Пока нет лабораторных данных','new-lab'));
    const attention=card('Требует внимания');attention.classList.add('overview-attention','tone-red');
    const abnormal=groups.filter(x=>x.status==='abnormal');
    for(const g of abnormal.slice(0,3))attention.append(h('button',{class:'data-row','data-action':'open-group','data-key':g.key},h('span',{class:'attention-icon'},icon('Activity',16)),h('div',{},h('strong',{},g.name),h('small',{},date(g.latest.date))),h('div',{class:'row-result'},status(g.latest),h('strong',{},g.latest.value,h('small',{class:'unit'},g.unit)))));
    if(!abnormal.length)attention.append(empty('Нет записей, отмеченных по введённым референсам.'));
    attention.append(h('p',{class:'table-caption'},'Значения за пределами референсов, сохранённых вместе с результатами. Это не диагноз.'));
    const events=card('Последние события');events.classList.add('overview-events','tone-yellow');
    const timeline=[...d.observations.map(x=>({...x,label:x.name,tab:'lab'})),...d.vitals.map(x=>({...x,label:x.type,tab:'vital'})),...d.medical.map(x=>({...x,label:x.title,tab:'medical'})),...d.diary.map(x=>({...x,label:x.title,tab:'diary'}))];
    for(const x of M.recent(timeline,4))events.append(h('button',{class:'data-row','data-tab':x.tab},icon('Clock',17),h('div',{},h('strong',{},x.label),h('small',{},date(x.date))),icon('ChevronRight',14)));
    if(!timeline.length)events.append(empty('События появятся после добавления записей.'));
    const trend=card('Динамика показателя');trend.classList.add('overview-trend','tone-green');
    const selected=groups.find(g=>g.key===state.trendKey)||groups.find(g=>M.chartRows(g.rows).length>1);
    if(groups.length)trend.append(h('label',{class:'trend-picker'},h('span',{class:'sr-only'},'Показатель для графика'),h('select',{'data-trend':'overview','aria-label':'Показатель для графика'},groups.map(g=>h('option',{value:g.key,selected:g===selected},g.name+' · '+g.unit)))));
    if(selected){trend.append(h('p',{class:'trend-name'},selected.name),h('div',{class:'trend-summary'},h('strong',{},selected.latest.value,h('small',{class:'unit'},selected.unit)),h('small',{},date(selected.latest.date))),chart(selected),h('button',{class:'button text-link','data-action':'open-group','data-key':selected.key},'Все измерения',icon('ArrowRight',13)));}
    else trend.append(empty('Динамика появится после двух сопоставимых измерений.'));
    const docs=card('Документы');docs.classList.add('overview-documents','tone-red');
    for(const x of M.recent(d.documents,2))docs.append(h('button',{class:'data-row','data-action':'file-download','data-id':x.id},icon('FileText',20),h('div',{},h('strong',{},x.title||x.name),h('small',{},date(x.date)))));
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
      document:['Документы','Файлы медицинских исследований','Новый документ','documents']
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
    if(kind==='document')section.append(banner('Вложения первой версии',
      'PDF, JPG, PNG, CSV и TXT — максимум 2 МиБ на файл; файлы входят в зашифрованный архив.'));
    const items=card(kind==='vital'?'История · '+data.length:null);
    if(!data.length)items.append(empty('Записей пока нет','new-'+kind));
    else if(kind==='document'){
      const rows=data.map(item=>{
        const extension=item.name.includes('.')?item.name.split('.').pop().slice(0,5).toUpperCase():'ФАЙЛ';
        const size=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(item.size/(item.size>=1048576?1048576:1024))+(item.size>=1048576?' МБ':' КБ');
        return h('tr',{},h('td',{class:'document-main'},h('div',{class:'document-cell'},h('span',{class:'file-stamp tone-'+(extension==='PDF'?'red':'blue')},icon('FileText',21),h('span',{},extension)),h('div',{},h('button',{class:'table-name','data-action':'file-download','data-id':item.id},item.title||item.name),h('span',{class:'table-subline'},item.name),h('span',{class:'mobile-document-date'},date(item.date)+' · '+size)))),h('td',{class:'document-type'},h('span',{class:'badge info'},extension)),h('td',{class:'document-date'},date(item.date)),h('td',{class:'document-size'},size),h('td',{class:'document-actions'},button('Скачать','file-download',{class:'small','data-id':item.id}),buttons(kind,item,false)));
      });
      items.append(h('div',{class:'table-wrap'},h('table',{class:'documents-table'},h('thead',{},h('tr',{},['Документ','Формат','Добавлен','Размер','Действия'].map(label=>h('th',{scope:'col'},label)))),h('tbody',{},rows))));
    }else{
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
  function labSection(state){
    const all=M.groups(state.doc.observations);
    const query=(state.search||'').toLocaleLowerCase('ru-RU');
    const filtered=all.filter(x=>(x.name+' '+x.unit+' '+x.latest.source)
      .toLocaleLowerCase('ru-RU').includes(query));
    const selected=filtered.find(x=>x.key===state.groupKey)||filtered[0];
    const section=h('div',{});
    section.append(title(state.groupKey?'История показателя':'Анализы',
      'История результатов с единицами, референсами и первоисточниками.',
      [button('Импорт CSV','csv'),button('Добавить','new-lab',{class:'primary'})]));
    section.append(h('input',{type:'search',class:'health-search','data-search':'labs',
      placeholder:'Найти показатель…',value:state.search||''}));
    if(!state.groupKey){
      const box=card(null);box.classList.add('health-labs-card');
      const search=section.querySelector('[data-search=labs]');if(search){search.remove();box.append(h('div',{class:'filters'},icon('Search',15),search));}
      const grouped=h('table',{class:'analyte-groups'},h('thead',{},h('tr',{},['Показатель','Последний результат','Среднее','Референс','Измерений','Дата последнего'].map(label=>h('th',{scope:'col'},label)))));
      const body=h('tbody',{});
      for(const g of filtered){const values=g.rows.map(x=>M.number(x.value)).filter(x=>x!==null);const average=values.length?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(values.reduce((a,b)=>a+b,0)/values.length):'—';
        body.append(h('tr',{},h('td',{},h('button',{class:'group-name','data-action':'open-group','data-key':g.key},h('strong',{},g.name),icon('ChevronRight',14))),h('td',{},h('strong',{},g.latest.value),h('span',{class:'unit'},g.unit),h('div',{},status(g.latest))),h('td',{},h('strong',{},average),h('small',{},values.length+' из '+g.rows.length)),h('td',{},g.latest.low||g.latest.high?(g.latest.low||'—')+' — '+(g.latest.high||'—'):'—'),h('td',{},h('span',{class:'measurement-count'},g.rows.length)),h('td',{},date(g.latest.date))));
      }
      grouped.append(body);box.append(filtered.length?h('div',{class:'table-wrap'},grouped):empty('Показателей по этим условиям нет.'));
      box.append(h('p',{class:'table-summary'},'Показателей: '+filtered.length+' · измерений: '+filtered.reduce((a,g)=>a+g.rows.length,0)),h('p',{class:'summary-footnote'},'Среднее — арифметическое числовых результатов сопоставимой группы. Разные единицы, материалы и методы не смешиваются. Референс в списке — из последней записи.'));
      section.append(box);return section;
    }
    section.append(h('button',{class:'button text-link','data-tab':'lab'},'← Все анализы'));
    const left=card('Показатели');
    const groupList=h('div',{class:'health-group-list'});
    filtered.forEach((group,index)=>{
      groupList.append(h('button',{type:'button','data-action':'select-group','data-index':index,
        class:'health-group-button '+(group===selected?'is-selected':'')},
        h('span',{},h('strong',{},group.name),h('br'),
          h('small',{},group.rows.length+' измер. · '+group.unit)),
        h('span',{},group.latest.value,status(group.latest))));
    });
    if(!filtered.length)groupList.append(empty('Ничего не найдено'));
    left.append(groupList);
    const right=card(selected?selected.name:'История показателя');
    if(selected){
      right.append(h('div',{class:'health-row'},
        h('span',{class:'health-muted health-small'},'Единица: '+(selected.unit||'не указана')),
        status(selected.latest)));
      right.append(chart(selected));
      right.append(table(['Дата','Значение','Референс','Источник',''],selected.rows.map(x=>[
        date(x.date),h('strong',{},x.value+' '+x.unit),
        x.low||x.high?(x.low||'—')+' — '+(x.high||'—'):'—',
        x.source||'—',buttons('lab',x)
      ])));
    }else right.append(empty('Нет показателей','new-lab'));
    section.append(h('div',{class:'health-two-panel'},left,right));
    return section;
  }
  function chart(group){
    const points=M.chartRows(group.rows);
    if(!points.length)return empty('Для графика нужны числовые измерения');
    const values=points.map(x=>M.number(x.value));
    const refs=points.flatMap(x=>[M.number(x.low),M.number(x.high)]).filter(x=>x!==null);
    const min=Math.min(...values,...refs),max=Math.max(...values,...refs);
    const spread=max-min||Math.abs(max)*.1||1,lo=min-.12*spread,hi=max+.12*spread;
    const coords=values.map((value,index)=>[
      values.length===1?355:48+615*index/(values.length-1),169-135*(value-lo)/(hi-lo)]);
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 720 200');svg.classList.add('health-spark');
    svg.setAttribute('role','img');svg.setAttribute('aria-label','График '+group.name);
    function svgNode(tag,attrs,text){
      const n=document.createElementNS(ns,tag);
      for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
      if(text!==undefined)n.textContent=String(text);
      svg.append(n);return n;
    }
    const yFor=n=>169-135*(n-lo)/(hi-lo);
    for(let i=0;i<points.length;i++){
      const low=M.number(points[i].low),high=M.number(points[i].high);
      if(low===null||high===null||low>high)continue;
      const left=points.length===1?48:i===0?48:(coords[i-1][0]+coords[i][0])/2;
      const right=points.length===1?665:i===points.length-1?665:(coords[i][0]+coords[i+1][0])/2;
      svgNode('rect',{x:left,y:yFor(high),width:right-left,height:yFor(low)-yFor(high),fill:'#edf8f2'});
    }
    [38,103,169].forEach(y=>{svgNode('line',{x1:48,x2:665,y1:y,y2:y,stroke:'#dce4ee','stroke-dasharray':'4 5'});svgNode('text',{x:37,y:y+4,'text-anchor':'end',fill:'#667080','font-size':11},new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(lo+(169-y)/135*(hi-lo)));});
    svgNode('polyline',{points:coords.map(x=>x.join(',')).join(' '),
      fill:'none',stroke:'#2674ca','stroke-width':3,'stroke-linejoin':'round'});
    coords.forEach((xy,i)=>{
      const dot=svgNode('circle',{cx:xy[0],cy:xy[1],r:4,fill:'white',
        stroke:'#2674ca','stroke-width':2});
      const hint=document.createElementNS(ns,'title');
      hint.textContent=date(points[i].date)+' · '+points[i].value;
      dot.append(hint);
    });
    svgNode('text',{x:48,y:194,fill:'#627889','font-size':11},date(points[0].date));
    svgNode('text',{x:665,y:194,'text-anchor':'end',fill:'#627889','font-size':11},
      date(points[points.length-1].date));
    return h('div',{class:'health-chart-wrap'},svg,refs.length?h('p',{class:'health-chart-note'},h('span',{class:'health-reference-key'}),'Референсы исходных записей'):null);
  }
  window.HumanView={h,icon,brand,button,card,title,empty,banner,status,date,form,field,row,table,
    buttons,stats,listSection,labSection,category:{
      allergy:'Аллергия',condition:'Состояние',vaccine:'Прививка',surgery:'Операция',other:'Другое'}};
})();
