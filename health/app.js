/* HUMAN static application controller. No backend and no plaintext persistence. */
(() => {
  'use strict';
  const V=window.HumanView,M=window.HumanModel,C=window.HumanCrypto;
  const S=window.HumanStore,G=window.HumanGithub;
  const root=document.getElementById('health-root');
  const header=document.getElementById('health-header');
  const dialog=document.getElementById('health-dialog');
  const notice=document.getElementById('health-notice');
  const state={local:null,doc:null,key:null,profiles:[],picker:false,tab:'overview',
    globalSearch:'',search:'',groupKey:'',filters:{},syncBusy:false,conflict:false,demo:false};
  const kinds={lab:'observations',vital:'vitals',medical:'medical',medication:'medications',
    diary:'diary',document:'documents'};
  const tabs=[['overview','Обзор'],['lab','Анализы'],['vital','Показатели'],
    ['medical','Медкарта'],['diary','Дневник'],['document','Документы'],['settings','Настройки']];
  const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  let writeQueue=Promise.resolve(),syncTimer,toastTimer;
  const clientId=crypto.randomUUID();
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('ayyy-health-v1'):null;
  function toast(message){
    notice.textContent=String(message);
    notice.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>notice.classList.remove('show'),6000);
  }
  function error(e){toast(e instanceof Error?e.message:String(e));}
  async function profileList(){state.profiles=await S.list();}
  const navMeta={overview:['LayoutGrid','blue','Показатели, документы и события — всё под рукой.'],lab:['FlaskConical','blue','Результаты исследований с историей и референсами.'],vital:['HeartPulse','red','Домашние измерения, самочувствие и история.'],medical:['NotebookTabs','green','Аллергии, лекарства, прививки и хронические состояния.'],diary:['BookOpen','yellow','Самочувствие, питание, активность и сон.'],document:['FileText','red','Бланки, заключения и направления в одном месте.'],settings:['Settings','neutral','Профиль, безопасность и синхронизация.']};
  function nav(){return V.h('nav',{'aria-label':'Разделы'},tabs.map(([id,label])=>V.h('button',{type:'button',class:'tone-'+navMeta[id][1]+(state.tab===id?' active':'')+(id==='settings'?' nav-settings':''),'data-tab':id,'aria-current':state.tab===id?'page':null},V.icon(navMeta[id][0]),label)));}
  function locked(){
    const outer=V.h('section',{class:'health-intro'});
    if(state.local&&!state.picker){
      outer.classList.add('health-intro-unlock');
      outer.append(V.h('div',{class:'health-intro-top'},V.brand()));
      const form=V.form('unlock',[V.field('Фраза доступа','passphrase','', 'password')],'Открыть');
      outer.append(V.card(null,[
        V.h('div',{class:'health-intro-panel'},V.h('span',{class:'health-overline'},'ЗАЩИЩЁННЫЙ ЖУРНАЛ'),
          V.h('h1',{},'Открыть журнал здоровья'),
          V.h('p',{class:'health-muted'},state.local.repo?
            VRepo(state.local.repo):'Данные находятся на этом устройстве.'),
          form,V.button('Посмотреть демо','open-demo',{class:'small success'}),
          V.button('Другой профиль','picker',{class:'small'}),
          V.h('p',{class:'health-security'},'Пароль не хранится в браузере и не отправляется в GitHub.'))
      ]));
      return outer;
    }
    const heading=V.h('div',{class:'health-intro-heading'},
      V.h('span',{class:'health-overline'},'ЛИЧНОЕ ПРОСТРАНСТВО'),
      V.h('h1',{},'Ваш журнал ',V.h('span',{class:'title-underline'},'здоровья')),
      V.h('p',{},'Локальное зашифрованное хранилище с возможностью синхронизации в ваш приватный GitHub.'));
    outer.append(V.h('div',{class:'health-intro-top'},V.brand(),heading));
    const sample=V.card(null,[
      V.h('div',{class:'health-demo-card-body'},
        V.h('div',{},
          V.h('span',{class:'health-demo-overline'},'ИНТЕРАКТИВНЫЙ ПРИМЕР'),
          V.h('h2',{},'Посмотреть заполненный журнал'),
          V.h('p',{},'Анализы с графиками, домашние измерения, медкарта, дневник и документы на полностью вымышленных данных.')),
        V.button('Открыть демо без регистрации','open-demo',{class:'primary health-demo-open'}))
    ]);
    sample.classList.add('health-demo-card');
    outer.append(sample);
    if(state.profiles.length){
      const list=V.h('div',{class:'health-profile-picker'});
      for(const item of state.profiles){
        const entry=V.button((item.repo?VRepo(item.repo):'Локальный журнал')+' · '+item.id.slice(0,8),
          'select-profile',{'data-id':item.id});
        entry.className='health-profile-choice';
        list.append(entry);
      }
      outer.append(V.card('Профили на этом устройстве',[list]));
    }
    const create=V.form('create',[
      V.field('Фраза доступа (минимум 12 символов)','password','', 'password'),
      V.field('Повторите фразу','repeat','', 'password')
    ],'Создать журнал');
    const download=V.form('download',[
      V.field('Приватный GitHub owner/repo','repo'),
      V.row(V.field('Ветка','branch','main'),
        V.field('Токен GitHub','token','', 'password'))
    ],'Загрузить из GitHub');
    outer.append(V.h('div',{class:'health-intro-grid'},
      V.card('Создать новый',[V.h('p',{class:'health-note'},
        'Придумайте фразу, которую будете использовать на других устройствах.'),create]),
      V.card('Продолжить на другом устройстве',[V.h('p',{class:'health-note'},
        'Можно использовать репозиторий родословной — папки данных раздельные.'),download])));
    const restore=V.card('Восстановить зашифрованный файл',[
      V.h('p',{class:'health-note'},'Поддерживается vault.json этого модуля. Экспорт SQLite из HUMAN v2 потребует конвертера.'),
      V.form('import-vault',[V.field('Зашифрованный JSON','file','','file')],'Импортировать')
    ]);
    restore.classList.add('health-restore-card');
    outer.append(restore);
    outer.append(V.h('p',{class:'health-security'},
      'Личные данные не сохраняются в публичном репозитории AYYY.'));
    return outer;
  }
  function VRepo(repo){return repo.owner+'/'+repo.repo+' · '+repo.branch;}
  function status(){
    if(state.demo)return 'Демо · вымышленные данные';
    if(!state.doc)return 'Данные зашифрованы';
    if(state.syncBusy)return 'Синхронизация…';
    if(state.conflict)return 'Конфликт версий';
    if(!state.local.repo)return 'На устройстве';
    if(!G.hasToken())return 'GitHub: нужен токен';
    return state.local.dirty?'Ожидает отправки':'Синхронизировано';
  }
  function renderHeader(){
    const unlocked=!!state.doc;document.body.classList.toggle('health-locked',!unlocked);
    const sidebar=document.getElementById('health-sidebar'),bottom=document.getElementById('health-bottom'),footer=document.getElementById('health-footer');
    sidebar.hidden=bottom.hidden=footer.hidden=!unlocked;
    if(!unlocked){document.body.classList.remove('health-menu-open');header.replaceChildren();return;}
    const profile=state.doc.profile.name||'Мой профиль';
    sidebar.replaceChildren(V.brand('human'),V.h('button',{class:'workspace profile-entry','data-action':'edit-profile','aria-label':'Мой профиль'},V.h('span',{class:'avatar'},profile.slice(0,1).toUpperCase()),V.h('div',{},V.h('strong',{},profile),V.h('small',{},'Личное пространство'))),V.h('p',{class:'nav-caption'},'МОЙ ЖУРНАЛ'),nav(),V.h('div',{class:'sidebar-footer'},V.icon('ShieldCheck',16),V.h('span',{},state.demo?'Демонстрационный журнал':'Данные на вашем устройстве'),V.h('button',{'data-action':state.demo?'exit-demo':'lock','aria-label':state.demo?'Выйти из демо':'Закрыть доступ'},V.icon('LogOut',17))));
    const label=tabs.find(([id])=>id===state.tab)?.[1]||'Обзор';
    const search=V.h('div',{class:'global-search'},V.icon('Search',15),V.h('input',{type:'search',id:'health-global-search','aria-label':'Поиск по всем данным',placeholder:'Найти в журнале',value:state.globalSearch||'','data-search':'global'}),V.h('kbd',{},'/'));
    const top=V.h('div',{class:'health-topbar-content'},V.brand('ayyy'),V.h('div',{class:'breadcrumb'},V.h('span',{},'Личное пространство'),V.icon('ChevronRight',13),V.h('strong',{},label)),search,V.h('span',{class:'health-status',role:'status','aria-label':status(),'data-state':state.conflict?'problem':'ok',title:status()},V.icon('ShieldCheck',15)),V.button('Добавить','quick-add',{class:'primary desktop-add'}));
    header.replaceChildren(top);
    bottom.replaceChildren(...[['overview','Обзор','LayoutGrid'],['lab','Анализы','FlaskConical'],['add','Добавить','Plus'],['vital','Показатели','HeartPulse'],['more','Ещё','Menu']].map(([id,title,glyph])=>V.h('button',{type:'button',...(id==='add'?{'data-action':'quick-add',class:'mobile-add'}:id==='more'?{'data-action':'toggle-menu','aria-expanded':String(document.body.classList.contains('health-menu-open')),'aria-controls':'health-sidebar'}:{'data-tab':id,'aria-current':state.tab===id?'page':null})},V.icon(glyph,20),id==='add'?V.h('span',{class:'sr-only'},title):title)));
    footer.replaceChildren(V.h('span',{},V.icon('Activity',13),'HUMAN · ваш журнал здоровья'),V.h('a',{href:'../#home',target:'_top'},'AYYY · Все сервисы'));
  }
  function searchResults(){
    const q=state.globalSearch.toLocaleLowerCase('ru-RU'),box=V.h('div',{});
    box.append(V.title('Результаты поиска','По всем данным текущего журнала.'));
    const results=V.card(null);let count=0;
    for(const [kind,key] of Object.entries(kinds))for(const x of state.doc[key]){
      const text=[x.name,x.title,x.type,x.value,x.notes,x.source].filter(Boolean).join(' ');
      if(!text.toLocaleLowerCase('ru-RU').includes(q))continue;
      count++;results.append(V.h('button',{class:'data-row','data-action':kind==='document'?'file-download':'edit','data-kind':kind,'data-id':x.id},V.icon(kind==='lab'?'FlaskConical':kind==='document'?'FileText':'NotebookTabs',18),V.h('div',{},V.h('strong',{},x.name||x.title||x.type||'Запись'),V.h('small',{},V.date(x.date))),V.icon('ChevronRight',14)));
    }
    if(!count)results.append(V.empty('По вашему запросу ничего не найдено.'));
    box.append(results);return box;
  }
  function settings(){
    const doc=state.doc,local=state.local,repo=local.repo;
    const box=V.h('div',{});
    if(state.demo){
      box.append(V.title('Настройки демо','Образец журнала без подключения личного аккаунта.'));
      box.append(V.card('Только пример',[
        V.banner('Полностью вымышленные данные',
          'Пример существует исключительно в памяти вкладки. Он не использует IndexedDB, пароль, токен GitHub или синхронизацию.'),
        V.h('p',{},'Профиль: '+doc.profile.name),
        V.h('p',{},'Лабораторных результатов: '+doc.observations.length),
        V.h('p',{},'Домашних измерений: '+doc.vitals.length),
        V.h('p',{},'Документов: '+doc.documents.length),
        V.h('p',{class:'health-note'},
          'Можно менять и добавлять записи для оценки интерфейса. После выхода или перезагрузки эти изменения исчезнут.'),
        V.button('Вернуть исходные демо-данные','reset-demo'),
        V.button('Перейти к личному журналу','exit-demo',{class:'primary'})
      ]));
      return box;
    }
    box.append(V.title('Настройки','Профиль, безопасность и синхронизация.'));
    if(state.conflict){
      box.append(V.card('Конфликт версий',[
        V.banner('Данные не перезаписаны',
          'Скачайте локальный архив, прежде чем вручную заменять его версией из GitHub.'),
        V.button('Сохранить резервную копию','backup'),
        V.button('Использовать GitHub-версию','restore-remote',{class:'danger'})
      ]));
    }
    const profile=V.card('Профиль',[
      V.h('p',{},'Имя: '+(doc.profile.name||'Не указано')),
      V.h('p',{},'Дата рождения: '+V.date(doc.profile.birthDate)),
      V.h('p',{},'Пол: '+(doc.profile.sex||'Не указан')),
      V.button('Редактировать','edit-profile')
    ]);
    const localBox=V.card('Локальное хранение',[
      V.h('p',{},'AES-256-GCM · PBKDF2-SHA256 · 310 000 итераций'),
      V.h('p',{class:'health-note'},'В IndexedDB хранятся только зашифрованные записи.'),
      V.button('Скачать архив','backup'),V.button('Другой профиль','picker')
    ]);
    box.append(V.h('div',{class:'health-grid equal'},profile,localBox));
    const form=V.form('connect',[
      V.field('Приватный репозиторий owner/repo','repo',repo?repo.owner+'/'+repo.repo:''),
      V.row(V.field('Ветка','branch',repo?.branch||'main'),
        V.field('Токен с Contents: Read/Write','token','','password'))
    ],'Подключить и проверить');
    box.append(V.card('GitHub · персональное хранилище',[
      V.banner('Тот же репозиторий, что у родословной',
        'Медицинские данные сохраняются по пути health-data/v1/vault.json. Семейное дерево находится в family-data/trees/. Публичные репозитории запрещены.'),
      V.h('p',{},repo?'Подключено: '+VRepo(repo):'Не подключён'),
      form,V.button('Стереть токен из памяти','disconnect-token',{class:'small danger'}),
      V.h('p',{class:'health-note'},
        'Токен не сохраняется на диск. Синхронизация выполняется только пока эта страница открыта.')
    ]));
    box.append(V.card('Резервирование и удаление',[
      V.h('p',{class:'health-note'},'Держите отдельную зашифрованную резервную копию вне GitHub.'),
      V.button('Экспортировать vault.json','backup'),
      V.button('Удалить только локальную копию','delete-local',{class:'danger'})
    ]));
    return box;
  }
  function render(){
    renderHeader();
    if(!state.doc){root.replaceChildren(locked());return;}
    let view;
    if(state.globalSearch.length>=2)view=searchResults();
    else if(state.tab==='overview')view=V.stats(state);
    else if(state.tab==='lab')view=V.labSection(state);
    else if(state.tab==='medical')view=V.h('div',{},V.listSection(state,'medical'),
      V.listSection(state,'medication'));
    else if(state.tab==='settings')view=settings();
    else view=V.listSection(state,state.tab);
    view.querySelectorAll('.health-heading').forEach((heading,index)=>{if(!index){heading.querySelector('.eyebrow')?.replaceChildren(document.createTextNode('ЛИЧНЫЙ ЖУРНАЛ '),V.h('span',{},'/'),document.createTextNode(String(tabs.findIndex(([id])=>id===state.tab)+1).padStart(2,'0')));return;}heading.className='health-section-heading';heading.querySelector('.eyebrow')?.remove();const title=heading.querySelector('h1');if(title)title.replaceWith(V.h('h2',{},title.textContent));});
    if(state.demo){
      const label=V.h('div',{class:'health-demo-strip',role:'note'},
        V.h('span',{class:'health-demo-tag'},'ДЕМО'),
        V.h('span',{},'Все сведения вымышлены · изменения не сохраняются'),
        V.button('Сбросить пример','reset-demo',{class:'small'}));
      const heading=view.querySelector('.health-heading');heading?.remove();root.replaceChildren(heading,V.h('div',{class:'content'},label,view));
    }else {const heading=view.querySelector('.health-heading');heading?.remove();root.replaceChildren(heading,V.h('div',{class:'content'},view));}
  }
  function modal(kind,id){
    const collection=kinds[kind],existing=id&&collection?
      state.doc[collection].find(row=>row.id===id):null;
    const x=kind==='profile'?state.doc.profile:(existing||{}),now=today(),f=V.field,r=V.row;
    let fields=[];
    if(kind==='lab')fields=[
      r(f('Дата (ГГГГ-ММ-ДД, ГГГГ-ММ или ГГГГ)','date',existing?x.date:now),f('Точность даты','datePrecision',x.datePrecision||'day','select',[['day','День'],['month','Месяц'],['year','Год'],['unknown','Неизвестна']])),
      f('Результат как в бланке','value',x.value||''),
      f('Показатель в бланке','name',x.name||''),f('Показатель в каталоге (необязательно)','canonicalName',x.canonicalName||''),
      r(f('Единица','unit',x.unit||''),f('Лаборатория','source',x.source||'')),
      r(f('Референс от','low',x.low||''),f('Референс до','high',x.high||'')),
      r(f('Материал','material',x.material||''),f('Метод','method',x.method||'')),
      f('Комментарий','notes',x.notes||'','textarea')
    ];
    else if(kind==='vital')fields=[
      r(f('Дата','date',x.date||now,'date'),f('Тип','type',x.type||'Давление','select',
        ['Давление','Пульс','Масса','Температура','Глюкоза','Сон','Шаги','Рост'].map(v=>[v,v]))),
      f('Значение (120/80 или число)','value',x.value||''),f('Комментарий','notes',x.notes||'','textarea')
    ];
    else if(kind==='medical')fields=[
      f('Категория','category',x.category||'allergy','select',
        [['allergy','Аллергия'],['condition','Состояние'],['vaccine','Прививка'],
          ['surgery','Операция'],['other','Другое']]),
      f('Название','title',x.title||''),f('Дата','date',x.date||'','date'),
      f('Сведения / источник','notes',x.notes||'','textarea')
    ];
    else if(kind==='medication')fields=[
      f('Препарат','name',x.name||''),
      r(f('Дозировка','dose',x.dose||''),f('Частота','frequency',x.frequency||'')),
      f('Дата начала','startDate',x.startDate||'','date'),
      f('Заметки','notes',x.notes||'','textarea')
    ];
    else if(kind==='diary')fields=[
      r(f('Дата','date',x.date||now,'date'),f('Тип','kind',x.kind||'wellbeing','select',
        [['food','Питание'],['activity','Активность'],['sleep','Сон'],['wellbeing','Самочувствие']])),
      f('Описание','title',x.title||''),f('Подробности','notes',x.notes||'','textarea')
    ];
    else if(kind==='document')fields=[
      f('Файл PDF, JPEG, PNG, CSV, TXT (до 2 МиБ)','file','','file'),
      f('Название','title',''),f('Дата','date',now,'date')
    ];
    else if(kind==='profile')fields=[
      f('Имя','name',x.name||''),r(f('Дата рождения','birthDate',x.birthDate||'','date'),
        f('Пол','sex',x.sex||'','select',[['','Не указан'],['male','Мужской'],['female','Женский']])),
      f('Дополнительно','notes',x.notes||'','textarea')
    ];
    const mode=kind==='profile'?'profile':'record';
    const form=V.form(mode,fields,'Сохранить');
    form.dataset.kind=kind;
    if(existing)form.dataset.id=existing.id;
    const body=document.getElementById('health-dialog-body');
    const close=V.button('×','close-dialog',{class:'ghost'});
    const top=V.h('div',{class:'health-modal-head'},V.h('h2',{},
      kind==='profile'?'Профиль':existing?'Редактировать запись':'Добавить запись'),close);
    body.replaceChildren(top,V.h('div',{class:'health-modal-content'},form));
    dialog.showModal();
  }
  async function mutate(change){
    const run=writeQueue.then(async()=>{
      if(!state.doc)throw new Error('Откройте журнал.');
      if(state.demo){
        const copy=structuredClone(state.doc);
        await change(copy);
        C.assertData(copy);
        state.doc=copy;render();
        toast('Демо: изменение действует только до выхода из примера.');
        return;
      }
      if(!state.key)throw new Error('Откройте зашифрованный журнал.');
      const data=structuredClone(state.doc);
      await change(data);
      C.assertData(data);
      const envelope=await C.seal(data,state.key,state.local.envelope);
      const saved=await S.save({...state.local,envelope,dirty:true});
      state.doc=data;state.local=saved;render();
      channel?.postMessage({client:clientId,vaultId:saved.id});
      if(saved.repo&&G.hasToken())scheduleSync();
    });
    writeQueue=run.catch(()=>{});
    return run;
  }
  function version(data,kind,record,operation){
    const previous=kind==='document'?{...record,data:undefined}:structuredClone(record);
    data.revisions.push({id:M.id(),kind,recordId:record.id,operation,previous,
      changedAt:new Date().toISOString()});
  }
  async function recordSubmit(form){
    const kind=form.dataset.kind,collection=kinds[kind];
    if(!collection)throw new Error('Неизвестная запись.');
    const old=form.dataset.id?state.doc[collection].find(x=>x.id===form.dataset.id):null;
    const input=Object.fromEntries(new FormData(form).entries());
    let record;
    if(kind==='lab')record=M.checkLab(input,old);
    if(kind==='vital')record=M.checkVital(input,old);
    if(kind==='medical')record=M.checkMedical(input,old);
    if(kind==='medication')record=M.checkMedication(input,old);
    if(kind==='diary')record=M.checkDiary(input,old);
    if(kind==='document'){
      const file=form.elements.namedItem('file').files[0];
      if(!file||file.size>2*1024*1024)throw new Error('Размер файла ограничен 2 МиБ.');
      const ext=file.name.toLowerCase().split('.').pop();
      const mimes={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',
        png:'image/png',txt:'text/plain',csv:'text/csv',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
      if(!mimes[ext])throw new Error('Разрешены PDF, JPG, PNG, TXT, XLSX и CSV.');
      const bytes=new Uint8Array(await file.arrayBuffer()),sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
      record={id:M.id(),sha256,name:M.text(file.name,255),title:M.text(input.title,255)||file.name,
        date:M.isoDate(input.date),mime:mimes[ext],size:file.size,
        data:C.base64(bytes),
        createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    }
    await mutate(data=>{
      const list=data[collection];
      if(old){
        const idx=list.findIndex(x=>x.id===old.id);
        if(idx<0)throw new Error('Запись больше не существует.');
        version(data,kind,list[idx],'edit');list[idx]=record;
      }else list.push(record);
    });
    dialog.close();toast(state.demo?'Демо-запись изменена только в памяти.':'Запись сохранена в зашифрованном хранилище.');
  }
  async function profileSubmit(form){
    const input=Object.fromEntries(new FormData(form).entries());
    const next={name:M.text(input.name,150),birthDate:input.birthDate?M.isoDate(input.birthDate):'',
      sex:['male','female'].includes(input.sex)?input.sex:'',
      notes:M.text(input.notes,3000)};
    await mutate(data=>{
      data.revisions.push({id:M.id(),kind:'profile',operation:'edit',
        previous:structuredClone(data.profile),changedAt:new Date().toISOString()});
      data.profile=next;
    });
    dialog.close();
  }
  async function remove(kind,id){
    const collection=kinds[kind];
    if(!collection)throw new Error('Неизвестная категория.');
    const existing=state.doc[collection].find(x=>x.id===id);
    if(!existing)throw new Error('Запись не найдена.');
    if(!confirm('Удалить запись? Существующие коммиты GitHub могут сохранять старую версию.'))return;
    await mutate(data=>{
      const idx=data[collection].findIndex(x=>x.id===id);
      version(data,kind,data[collection][idx],'delete');
      data[collection].splice(idx,1);
    });
  }
  function download(name,bytes,mime){
    const blob=new Blob([bytes],{type:mime}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=name.replace(/[\\/]/g,'_');
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function backup(){
    if(state.demo)throw new Error('Демо не экспортируется и не содержит личных данных.');
    const bytes=new TextEncoder().encode(JSON.stringify(state.local.envelope,null,2)+'\n');
    download('ayyy-health-'+today()+'.encrypted.json',bytes,'application/json');
  }
  async function fileDownload(id){
    const file=state.doc.documents.find(d=>d.id===id);
    if(!file)throw new Error('Файл не найден.');
    const bytes=C.unbase64(file.data);
    if(bytes.length!==file.size)throw new Error('Документ повреждён.');
    if(file.sha256){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==file.sha256)throw new Error('Не совпадает контрольная сумма документа.');}
    download(file.name,bytes,file.mime);
  }
  let previewURL=null;
  async function previewFile(id){
    const file=state.doc.documents.find(x=>x.id===id);if(!file)return;
    const bytes=C.unbase64(file.data);if(bytes.length!==file.size)throw new Error('Документ повреждён.');
    if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}
    const content=V.h('div',{class:'health-document-preview'});let renderFirst;
    if(file.mime==='application/pdf'){const pages=V.h('div',{class:'health-pdf-pages'}),note=V.h('p',{role:'status'},'Открываю PDF…'),prev=V.h('button',{type:'button',class:'button'},'← Назад'),next=V.h('button',{type:'button',class:'button'},'Вперёд →');let page=1,total=1,busy=false;
      async function render(){if(busy)return;busy=true;prev.disabled=next.disabled=true;try{const result=await HumanDocuments.renderPDF(bytes,page);if(!pages.isConnected||!dialog.open)return;total=result.pages;pages.replaceChildren(result.canvas);note.textContent='Страница '+page+' из '+total;}catch(e){note.textContent=e.message;}finally{busy=false;prev.disabled=page<=1;next.disabled=page>=total;}}
      prev.addEventListener('click',()=>{if(!busy&&page>1){page--;void render();}});next.addEventListener('click',()=>{if(!busy&&page<total){page++;void render();}});content.append(V.h('div',{class:'health-toolbar'},prev,note,next),pages);renderFirst=render;
    }
    else if(['image/png','image/jpeg'].includes(file.mime)){previewURL=URL.createObjectURL(new Blob([bytes],{type:file.mime}));content.append(V.h('img',{src:previewURL,alt:file.title||file.name}));}
    else if(['text/plain','text/csv'].includes(file.mime))content.append(V.h('pre',{},new TextDecoder().decode(bytes)));
    else content.append(V.h('p',{},'Скачайте оригинал, чтобы открыть этот формат в программе просмотра.'));
    content.append(V.h('p',{class:'health-muted'},file.name+' · '+V.date(file.date)+' · '+new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(file.size/1024)+' КБ'),V.button('Скачать оригинал','file-download',{'data-id':file.id,class:'primary'}));
    document.getElementById('health-dialog-body').replaceChildren(V.h('div',{class:'health-modal-head'},V.h('h2',{},file.title||file.name),V.button('×','close-dialog',{'aria-label':'Закрыть просмотр'})),V.h('div',{class:'health-modal-content'},content));dialog.showModal();if(renderFirst)await renderFirst();
  }
  dialog.addEventListener('close',()=>{if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}});
  async function switchProfile(id){
    const chosen=await S.get(id);
    if(!chosen)throw new Error('Локальный профиль не найден.');
    await S.select(id);G.disconnect();state.demo=false;state.local=chosen;state.key=null;state.doc=null;
    state.picker=false;state.conflict=false;state.tab='overview';state.filters={};render();
  }
  function scheduleSync(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>{void syncNow();},3000);
  }
  async function syncNow(){
    if(state.demo){toast('Демо никогда не отправляется в GitHub.');return;}
    if(state.syncBusy||!state.local?.repo||!state.key){
      if(!state.local?.repo)toast('Сначала подключите GitHub на вкладке «Настройки».');
      return;
    }
    if(!G.hasToken()){state.tab='settings';render();toast('Введите токен GitHub.');return;}
    state.syncBusy=true;renderHeader();
    try{
      await writeQueue;
      const snapshot=state.local;
      await G.verify(snapshot.repo);
      const remote=await G.read(snapshot.repo);
      if(remote&&remote.envelope.vaultId!==snapshot.id)
        throw new Error('В этом репозитории уже хранится другой медицинский профиль.');
      if(remote&&remote.sha!==snapshot.remoteSha){
        if(snapshot.dirty){
          state.conflict=true;state.tab='settings';render();
          toast('Локальная и GitHub-версии различаются. Автоматическая перезапись запрещена.');
          return;
        }
        const decrypted=await C.openWithKey(remote.envelope,state.key);
        await writeQueue;
        const fresh=await S.get(snapshot.id);
        if(fresh.dirty){state.conflict=true;state.tab='settings';render();return;}
        const updated=await S.save({...fresh,envelope:remote.envelope,remoteSha:remote.sha,
          dirty:false,lastSyncAt:new Date().toISOString()});
        state.doc=decrypted;state.local=updated;state.conflict=false;render();
        toast('Загружены изменения из GitHub.');return;
      }
      if(!remote&&snapshot.remoteSha){
        state.conflict=true;state.tab='settings';render();
        toast('Удалённая версия исчезла. Автоматическое восстановление заблокировано.');return;
      }
      if(!snapshot.dirty){toast('Все изменения уже синхронизированы.');return;}
      const sha=await G.write(snapshot.repo,snapshot.envelope,remote?.sha||null);
      await writeQueue;
      const fresh=await S.get(snapshot.id);
      const unchanged=fresh.envelope.ciphertext===snapshot.envelope.ciphertext&&
        fresh.envelope.iv===snapshot.envelope.iv;
      const updated=await S.save({...fresh,remoteSha:sha,dirty:!unchanged,
        lastSyncAt:new Date().toISOString()});
      state.local=updated;state.conflict=false;render();
      toast(unchanged?'Зашифрованные данные отправлены в GitHub.':'Новые изменения ожидают следующей отправки.');
      if(updated.dirty)scheduleSync();
    }catch(e){error(e);}
    finally{state.syncBusy=false;renderHeader();}
  }
  async function restoreRemote(){
    if(!state.local?.repo||!G.hasToken())throw new Error('Сначала подключите токен GitHub.');
    if(!confirm('Заменить локальную версию архивом из GitHub? Перед заменой будет скачана резервная копия.'))return;
    backup();
    await G.verify(state.local.repo);
    const remote=await G.read(state.local.repo);
    if(!remote||remote.envelope.vaultId!==state.local.id)
      throw new Error('Удалённый архив не найден либо принадлежит другому профилю.');
    state.local=await S.save({...state.local,envelope:remote.envelope,remoteSha:remote.sha,dirty:false});
    state.key=null;state.doc=null;state.conflict=false;G.disconnect();render();
    toast('Архив заменён; откройте его фразой доступа.');
  }
  async function connect(form){
    if(state.demo)throw new Error('Демо не подключается к GitHub.');
    const values=Object.fromEntries(new FormData(form).entries());
    const repo=G.parseRepo(values.repo,values.branch);
    G.token(values.token);
    try{
      await G.verify(repo);
      const old=state.local.repo,equals=old&&old.owner===repo.owner&&old.repo===repo.repo&&
        old.branch===repo.branch;
      state.local=await S.save({...state.local,repo,
        remoteSha:equals?state.local.remoteSha:null,dirty:equals?state.local.dirty:true});
      state.conflict=false;render();await syncNow();
    }catch(e){G.disconnect();throw e;}
  }
  async function onSubmit(event){
    const form=event.target;
    if(!(form instanceof HTMLFormElement)||!form.dataset.form)return;
    event.preventDefault();
    const submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;
    try{
      const mode=form.dataset.form;
      if(mode==='create'){
        const pass=form.elements.namedItem('password').value;
        if(pass.length<12||pass!==form.elements.namedItem('repeat').value)
          throw new Error('Фразы не совпадают или короче 12 символов.');
        const created=await C.create(pass);
        state.local=await S.save({id:created.doc.id,envelope:created.envelope,dirty:true});
        state.doc=created.doc;state.key=created.key;state.picker=false;state.tab='overview';
        await profileList();await S.select(state.local.id);render();
        toast('Зашифрованный профиль создан. Не теряйте фразу доступа.');
      }else if(mode==='unlock'){
        const opened=await C.unlock(state.local.envelope,form.elements.namedItem('passphrase').value);
        state.doc=opened.doc;state.key=opened.key;state.picker=false;state.tab='overview';
        render();
      }else if(mode==='download'){
        const v=Object.fromEntries(new FormData(form).entries()),repo=G.parseRepo(v.repo,v.branch);
        G.token(v.token);await G.verify(repo);
        const data=await G.read(repo);
        if(!data)throw new Error('В репозитории нет health-data/v1/vault.json.');
        if(await S.get(data.envelope.vaultId))throw new Error('Этот профиль уже есть на устройстве.');
        const local=await S.save({id:data.envelope.vaultId,envelope:data.envelope,
          repo,remoteSha:data.sha,dirty:false});
        await S.select(local.id);await profileList();
        state.local=local;state.doc=null;state.key=null;state.picker=false;render();
        toast('Архив загружен. Введите вашу фразу доступа.');
      }else if(mode==='import-vault'){
        const file=form.elements.namedItem('file').files[0];
        if(!file||file.size>45*1024*1024)throw new Error('Неверный размер файла.');
        const envelope=JSON.parse(await file.text());
        C.assertEnvelope(envelope);
        if(await S.get(envelope.vaultId))throw new Error('Такой профиль уже существует.');
        const local=await S.save({id:envelope.vaultId,envelope,dirty:true});
        await S.select(local.id);await profileList();
        state.local=local;state.doc=null;state.key=null;state.picker=false;render();
      }else if(mode==='record')await recordSubmit(form);
      else if(mode==='analyte-preferences'){const input=Object.fromEntries(new FormData(form).entries()),key=form.dataset.key;await mutate(d=>{d.analytePreferences??={};const old=d.analytePreferences[key]||{};d.revisions.push({id:M.id(),kind:'analyte-preferences',recordId:key,operation:'edit',previous:structuredClone(old),changedAt:new Date().toISOString()});d.analytePreferences[key]=M.checkPreferences(input,old);});toast('Настройки показателя сохранены.');}
      else if(mode==='profile')await profileSubmit(form);
      else if(mode==='connect')await connect(form);
    }catch(e){error(e);}
    finally{if(submit?.isConnected)submit.disabled=false;}
  }
  let importGeneration=0;
  async function importCSV(file){
    if(!file)return;
    const generation=++importGeneration,tab=state.tab;
    await HumanImport.open(file,{V,M,C,dialog,commit:mutate,getDoc:()=>state.doc,isCurrent:()=>generation===importGeneration&&state.tab===tab});
  }
  async function deleteLocal(){
    if(state.demo)throw new Error('Демо удаляется при выходе.');
    if(!state.local)return;
    backup();
    if(!confirm('Удалить локальную зашифрованную копию? GitHub останется без изменений.'))return;
    if(!confirm('Подтвердите окончательное удаление с устройства.'))return;
    clearTimeout(syncTimer);
    await S.remove(state.local.id);await S.select('');await profileList();
    G.disconnect();state.local=null;state.doc=null;state.key=null;state.picker=true;render();
  }
  function openDemo(){
    clearTimeout(syncTimer);
    G.disconnect();
    state.demo=true;
    state.doc=window.HumanDemo.create();
    state.local={id:state.doc.id,repo:null,dirty:false};
    state.key=null;
    state.picker=false;state.tab='overview';state.globalSearch='';state.search='';state.groupKey='';state.filters={};state.abnormalOnly=false;
    state.conflict=false;state.syncBusy=false;
    render();
  }
  async function exitDemo(){
    clearTimeout(syncTimer);
    G.disconnect();
    state.demo=false;state.doc=null;state.key=null;
    state.tab='overview';state.search='';state.groupKey='';state.conflict=false;
    try{
      await profileList();
      const id=await S.current();
      state.local=id?await S.get(id):null;
    }catch{
      // The sample must remain usable even when IndexedDB is unavailable.
      state.profiles=[];state.local=null;
    }
    state.picker=!state.local;
    render();
  }
  async function onClick(event){
    const el=event.target.closest('[data-action],[data-tab]');
    if(!el)return;
    if(el.dataset.tab){event.preventDefault();state.tab=el.dataset.tab;state.globalSearch='';state.search='';state.groupKey='';document.body.classList.remove('health-menu-open');render();root.focus({preventScroll:true});window.scrollTo(0,0);return;}
    const action=el.dataset.action;
    try{
      if(action==='toggle-menu'){document.body.classList.toggle('health-menu-open');el.setAttribute('aria-expanded',String(document.body.classList.contains('health-menu-open')));}
      else if(action==='close-menu')document.body.classList.remove('health-menu-open');
      else if(action==='quick-add'){dialog.querySelector('#health-dialog-body').replaceChildren(V.h('div',{class:'health-modal-head'},V.h('h2',{},'Добавить запись'),V.button('×','close-dialog',{'aria-label':'Закрыть окно'})),V.h('div',{class:'health-modal-content health-quick-options'},[['Анализ','lab'],['Домашнее измерение','vital'],['Медицинская запись','medical'],['Препарат','medication'],['Запись дневника','diary'],['Документ','document']].map(([title,kind])=>V.button(title,'new-'+kind))));dialog.showModal();}
      else if(action==='toggle-favorite'){const key=el.dataset.key;await mutate(d=>{d.analytePreferences??={};const old=d.analytePreferences[key]||{};d.analytePreferences[key]={...old,favorite:!old.favorite};});}
      else if(action==='filter-favorites'){state.favoritesOnly=!state.favoritesOnly;render();}
      else if(action==='filter-abnormal'){state.abnormalOnly=!state.abnormalOnly;state.groupKey='';render();}
      else if(action==='select-observation'){state.observationId=el.dataset.id;render();}
      else if(action==='open-group'){state.abnormalOnly=false;state.observationId='';state.tab='lab';state.globalSearch='';state.search='';state.groupKey=el.dataset.key;render();}
      else if(action==='open-demo'||action==='reset-demo')openDemo();
      else if(action==='exit-demo')await exitDemo();
      else if(action==='filter-records'){state.filters[el.dataset.kind]=el.dataset.value;render();}
      else if(action?.startsWith('new-')){modal(action.slice(4));if(action==='new-vital'&&el.dataset.value)dialog.querySelector('[name=type]').value=el.dataset.value;}
      else if(action==='edit')modal(el.dataset.kind,el.dataset.id);
      else if(action==='edit-profile')modal('profile',null);
      else if(action==='remove')await remove(el.dataset.kind,el.dataset.id);
      else if(action==='select-group'){
        const query=state.search.toLocaleLowerCase('ru-RU');
        const all=M.groups(state.doc.observations,state.doc.analytePreferences).filter(x=>
          (x.name+' '+x.unit+' '+x.latest.source).toLocaleLowerCase('ru-RU').includes(query));
        state.groupKey=all[Number(el.dataset.index)]?.key||'';
        render();
      }else if(action==='picker'){
        clearTimeout(syncTimer);G.disconnect();state.demo=false;
        state.picker=true;state.local=null;state.doc=null;state.key=null;render();
      }else if(action==='select-profile')await switchProfile(el.dataset.id);
      else if(action==='lock'){
        clearTimeout(syncTimer);G.disconnect();state.demo=false;state.doc=null;state.key=null;
        state.picker=false;state.conflict=false;render();
      }else if(action==='sync')await syncNow();
      else if(action==='disconnect-token'){G.disconnect();render();}
      else if(action==='restore-remote')await restoreRemote();
      else if(action==='backup')backup();
      else if(action==='delete-local')await deleteLocal();
      else if(action==='file-download')await fileDownload(el.dataset.id);
      else if(action==='file-preview')await previewFile(el.dataset.id);
      else if(action==='close-dialog')dialog.close();
      else if(action==='csv'){
        const input=document.createElement('input');
        input.type='file';input.accept='.csv,.xlsx,.pdf';input.hidden=true;
        input.addEventListener('change',()=>{
          void importCSV(input.files[0]).catch(error).finally(()=>input.remove());
        });
        document.body.append(input);input.click();
      }
    }catch(e){error(e);}
  }
  document.addEventListener('submit',event=>{void onSubmit(event);});
  document.addEventListener('click',event=>{void onClick(event);});
  document.addEventListener('input',event=>{
    if(event.target?.dataset?.search==='global'){const pos=event.target.selectionStart||0;state.globalSearch=event.target.value;render();const next=document.getElementById('health-global-search');next.focus();try{next.setSelectionRange(pos,pos);}catch{}
    }else if(event.target?.dataset?.search==='labs'){
      const position=event.target.selectionStart||0;
      state.search=event.target.value;state.groupKey='';render();
      const next=root.querySelector('[data-search=labs]');
      if(next){next.focus();try{next.setSelectionRange(position,position);}catch{}}
    }
  });
  document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('circle[data-action]')){event.preventDefault();void onClick(event);return;}if(event.key==='Escape'&&document.body.classList.contains('health-menu-open')){document.body.classList.remove('health-menu-open');document.querySelector('[data-action=toggle-menu]')?.focus();}if(event.key==='/'&&!dialog.open&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,textarea,select,[contenteditable=true]')){event.preventDefault();document.getElementById('health-global-search')?.focus();}});
  document.addEventListener('change',event=>{if(event.target?.dataset?.trend==='overview'){state.trendKey=event.target.value;render();}});
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  if(channel)channel.onmessage=event=>{
    if(state.demo||!state.local||event.data?.client===clientId||event.data?.vaultId!==state.local.id)return;
    clearTimeout(syncTimer);state.doc=null;state.key=null;G.disconnect();
    void S.get(state.local.id).then(data=>{state.local=data;render();
      toast('Профиль изменён в другой вкладке. Откройте его снова.');});
  };
  void (async()=>{
    try{
      if(new URLSearchParams(window.location?.search||'').get('demo')==='1'){
        openDemo();
        return;
      }
      await profileList();
      const selected=await S.current();
      state.local=selected?await S.get(selected):null;
      if(!state.local&&state.profiles.length===1)state.local=await S.get(state.profiles[0].id);
      render();
    }catch(e){root.replaceChildren(V.banner('Ошибка хранилища',e.message));}
  })();
})();
