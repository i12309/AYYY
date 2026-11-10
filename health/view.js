/* HUMAN UI primitives: all user-supplied text is rendered as DOM text, never HTML. */
(() => {
  'use strict';
  const M=window.HumanModel;
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
    return h('button',{type:'button',class:'health-btn '+(attrs.class||''),
      'data-action':action,...attrs},text);
  }
  function card(title,items=[]){
    const box=h('section',{class:'health-card'});
    if(title)box.append(h('h2',{},title));
    for(const item of items)if(item)box.append(item);
    return box;
  }
  function title(text,description,buttons=[]){
    return h('div',{class:'health-heading'},
      h('div',{},h('h1',{},text),h('p',{},description)),
      h('div',{class:'health-toolbar'},buttons));
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
    return h('span',{class:'health-pill '+(kind==='normal'?'ok':kind==='abnormal'?'bad':'')},
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
    return h('label',{},h('span',{},label),input);
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
      editable?button('Правка','edit',{class:'small','data-kind':kind,'data-id':item.id}):null,
      button('Удалить','remove',{class:'small danger','data-kind':kind,'data-id':item.id}));
  }
  function stats(state){
    const d=state.doc,groups=M.groups(d.observations);
    const overview=h('div',{});
    overview.append(title(d.profile.name?'Здравствуйте, '+d.profile.name:'Журнал здоровья',
      'Медицинские факты, измерения и документы.',
      [button('Добавить анализ','new-lab',{class:'primary'}),button('Измерение','new-vital')]));
    const cards=h('div',{class:'health-grid stats'});
    for(const [name,count,desc,col] of [
      ['Виды анализов',groups.length,'Сопоставимые показатели',''],
      ['Отклонения',groups.filter(x=>x.status==='abnormal').length,'По указанным референсам','red'],
      ['Измерения',d.vitals.length,'Домашние показатели','green'],
      ['Документы',d.documents.length,'Зашифрованные вложения','yellow']
    ])cards.append(h('article',{class:'health-card accent '+col},
      h('div',{class:'health-overline'},name),h('div',{class:'health-stat-number'},count),
      h('div',{class:'health-card-footer'},desc)));
    overview.append(cards);
    const recent=card('Последние анализы',
      M.recent(d.observations,8).map(x=>
        h('div',{class:'health-list-item'},h('div',{},h('strong',{},x.name),
          h('p',{},date(x.date)+' · '+(x.source||'Источник не указан'))),
          h('div',{class:'health-actions'},h('strong',{},x.value+' '+x.unit),status(x)))));
    if(!d.observations.length)recent.append(empty('Пока нет лабораторных данных','new-lab'));
    const vitals=card('Домашние показатели',M.recent(d.vitals,8).map(x=>
      h('div',{class:'health-list-item'},h('div',{},h('strong',{},x.type),
        h('p',{},date(x.date))),h('strong',{},x.value+' '+x.unit))));
    if(!d.vitals.length)vitals.append(empty('Измерений пока нет','new-vital'));
    overview.append(h('div',{class:'health-grid two'},recent,vitals));
    overview.append(banner('Без медицинских заключений',
      'Отклонение означает только сравнение результата с введёнными границами.'));
    return overview;
  }
  function listSection(state,kind){
    const definitions={
      vital:['Домашние показатели','Давление, вес, сон и другие измерения','Новое измерение','vitals'],
      medical:['Медицинская карта','Аллергии, заболевания, операции и прививки','Новая запись','medical'],
      medication:['Лекарства','Препараты и их схемы','Новый препарат','medications'],
      diary:['Дневник','Питание, активность, сон и самочувствие','Новая запись','diary'],
      document:['Документы','Файлы медицинских исследований','Новый документ','documents']
    };
    const [name,desc,action,property]=definitions[kind];
    const data=M.recent(state.doc[property],1000);
    const section=h('div',{});
    section.append(title(name,desc,[button(action,'new-'+kind,{class:'primary'})]));
    if(kind==='document')section.append(banner('Вложения первой версии',
      'PDF, JPG, PNG, CSV и TXT — максимум 2 МиБ на файл; файлы входят в зашифрованный архив.'));
    const items=card(null);
    if(!data.length)items.append(empty('Записей пока нет','new-'+kind));
    for(const item of data){
      const main=item.name||item.title||item.type||'Запись';
      const details=[
        item.date?date(item.date):null,item.value?item.value+' '+item.unit:null,
        item.dose,item.frequency,item.notes
      ].filter(Boolean).join(' · ');
      items.append(h('div',{class:'health-list-item'},
        h('div',{},h('strong',{},main),h('p',{},details)),
        h('div',{class:'health-actions'},
          kind==='document'?button('Скачать','file-download',{class:'small','data-id':item.id}):null,
          buttons(kind,item,kind!=='document'))));
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
    section.append(title('Лабораторные анализы',
      'История результатов с единицами, референсами и первоисточниками.',
      [button('Импорт CSV','csv'),button('Добавить','new-lab',{class:'primary'})]));
    section.append(h('input',{type:'search',class:'health-search','data-search':'labs',
      placeholder:'Найти показатель…',value:state.search||''}));
    const left=card('Показатели');
    const groupList=h('div',{class:'health-group-list'});
    filtered.forEach((group,index)=>{
      groupList.append(h('button',{type:'button','data-action':'select-group','data-index':index,
        class:'health-group-button '+(group===selected?'is-selected':'')},
        h('span',{},h('strong',{},group.name),h('br'),
          h('small',{},group.rows.length+' измер. · '+group.unit)),
        h('span',{},group.latest.value,status(group))));
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
    if(points.length<2)return empty('График появится после двух числовых измерений');
    const values=points.map(x=>M.number(x.value)),min=Math.min(...values),max=Math.max(...values);
    const spread=max-min||Math.abs(max)*.1||1,lo=min-.12*spread,hi=max+.12*spread;
    const coords=values.map((value,index)=>[
      48+615*index/(values.length-1),169-135*(value-lo)/(hi-lo)]);
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 720 200');svg.classList.add('health-spark');
    svg.setAttribute('role','img');svg.setAttribute('aria-label','График '+group.name);
    function svgNode(tag,attrs,text){
      const n=document.createElementNS(ns,tag);
      for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
      if(text!==undefined)n.textContent=String(text);
      svg.append(n);return n;
    }
    [38,103,169].forEach(y=>svgNode('line',{x1:48,x2:665,y1:y,y2:y,stroke:'#e0eaf2'}));
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
    return h('div',{class:'health-chart-wrap'},svg);
  }
  window.HumanView={h,button,card,title,empty,banner,status,date,form,field,row,table,
    buttons,stats,listSection,labSection,category:{
      allergy:'Аллергия',condition:'Состояние',vaccine:'Прививка',surgery:'Операция',other:'Другое'}};
})();