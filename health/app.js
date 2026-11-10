/* HUMAN static application controller. No backend and no plaintext persistence. */
(() => {
  'use strict';
  const V=window.HumanView,M=window.HumanModel,C=window.HumanCrypto;
  const A=window.HumanAnalytes;
  const S=window.HumanStore,G=window.HumanGithub,Merge=window.HumanSyncMerge;
  const root=document.getElementById('health-root');
  const header=document.getElementById('health-header');
  const dialog=document.getElementById('health-dialog');
  const notice=document.getElementById('health-notice');
  const state={local:null,doc:null,key:null,profiles:[],picker:false,tab:'overview',
    globalSearch:'',search:'',groupKey:'',filters:{},syncBusy:false,conflict:false,demo:false};
  const kinds={lab:'observations',episode:'episodes',vital:'vitals',medical:'medical',medication:'medications',intake:'intakes',reminder:'reminders',
    genetic:'findings',diary:'diary',meal:'diary','activity-day':'diary',document:'documents'};
  const tabs=[['overview','Обзор'],['lab','Анализы'],['vital','Показатели'],
    ['medical','Медкарта'],['care','Приёмы и напоминания'],['recommendations','Рекомендации'],['nutrition','Питание'],['activity','Активность'],['genetics','Генетика'],['diary','Дневник'],['document','Документы'],['timeline','История'],['profile','Мой профиль'],['settings','Настройки']];
  const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  let writeQueue=Promise.resolve(),syncTimer,toastTimer,sessionRevision=0,syncRun=0,keyChangeRun=0;
  const clientId=crypto.randomUUID();
  const recordsFor=(doc,kind)=>['meal','activity-day'].includes(kind)?window.HumanDiary.records(doc,kind):kind==='episode'?window.HumanHealth.episodes(doc):['intake','reminder'].includes(kind)?window.HumanCare.records(doc,kind):doc[kinds[kind]]||[];
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel(C.FORMAT):null;
  function toast(message){
    notice.textContent=String(message);
    notice.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>notice.classList.remove('show'),6000);
  }
  function error(e){toast(e instanceof Error?e.message:String(e));}
  async function profileList(){state.profiles=await S.list();}
  const navMeta={overview:['LayoutGrid','blue','Показатели, документы и события — всё под рукой.'],lab:['FlaskConical','blue','Результаты исследований с историей и референсами.'],vital:['HeartPulse','red','Домашние измерения, самочувствие и история.'],medical:['NotebookTabs','green','Аллергии, лекарства, прививки и хронические состояния.'],diary:['BookOpen','yellow','Самочувствие, питание, активность и сон.'],document:['FileText','red','Бланки, заключения и направления в одном месте.'],settings:['Settings','neutral','Профиль, безопасность и синхронизация.']};
  navMeta.nutrition=['Utensils','green','Приёмы пищи и известные нутриенты.'];navMeta.activity=['Dumbbell','yellow','Шаги, сон и упражнения по дням.'];
  navMeta.recommendations=['ClipboardList','green','Анкета, снимки данных и отдельные рецензии.'];
  navMeta.timeline=['History','yellow','Что и когда появилось в вашем журнале.'];navMeta.profile=['UserRound','neutral','Профиль и ваши данные.'];
  navMeta.genetics=['Dna','green','Ваши записи из генетических отчётов.'];
  navMeta.care=['Bell','yellow','Фактические события и ваши расписания.'];
  function nav(){return V.h('nav',{'aria-label':'Разделы'},tabs.filter(([id])=>id!=='profile').map(([id,label])=>V.h('button',{type:'button',class:'tone-'+navMeta[id][1]+(state.tab===id?' active':'')+(id==='settings'?' nav-settings':''),'data-tab':id,'aria-current':state.tab===id?'page':null},V.icon(navMeta[id][0]),label)));}
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
      V.h('p',{class:'health-note'},'Восстановите журнал и вложения из зашифрованной копии HUMAN.'),
      V.form('import-vault',[V.field('Резервная копия .human','file','','file')],'Импортировать')
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
    if(state.rekeyBusy)return 'Обновление защиты…';
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
    sidebar.replaceChildren(V.brand('human'),V.h('button',{class:'workspace profile-entry','data-tab':'profile','aria-current':state.tab==='profile'?'page':null,'aria-label':'Мой профиль'},V.h('span',{class:'avatar'},profile.slice(0,1).toUpperCase()),V.h('div',{},V.h('strong',{},profile),V.h('small',{},'Личное пространство'))),V.h('p',{class:'nav-caption'},'МОЙ ЖУРНАЛ'),nav(),V.h('div',{class:'sidebar-footer'},V.icon('ShieldCheck',16),V.h('span',{},state.demo?'Демонстрационный журнал':'Данные на вашем устройстве'),V.h('button',{'data-action':state.demo?'exit-demo':'lock','aria-label':state.demo?'Выйти из демо':'Закрыть доступ'},V.icon('LogOut',17))));
    const label=tabs.find(([id])=>id===state.tab)?.[1]||'Обзор';
    const search=V.h('div',{class:'global-search'},V.icon('Search',15),V.h('input',{type:'search',id:'health-global-search','aria-label':'Поиск по всем данным',placeholder:'Найти в журнале',value:state.globalSearch||'','data-search':'global'}),V.h('kbd',{},'/'));
    const top=V.h('div',{class:'health-topbar-content'},V.brand('ayyy'),V.h('div',{class:'breadcrumb'},V.h('span',{},'Личное пространство'),V.icon('ChevronRight',13),V.h('strong',{},label)),search,V.h('span',{class:'health-status',role:'status','aria-label':status(),'data-state':state.conflict?'problem':'ok',title:status()},V.icon('ShieldCheck',15)),V.button('Добавить','quick-add',{class:'primary desktop-add'}));
    const dueCount=window.HumanCare.records(state.doc,'reminder').filter(r=>window.HumanCare.due(r)).length;
    top.insertBefore(V.h('button',{type:'button',id:'health-reminder-bell',class:'button reminder-bell','data-action':'care-center','aria-label':'Центр напоминаний: '+dueCount,title:'Открыть напоминания'},V.icon('Bell',18),dueCount?V.h('span',{},dueCount>99?'99+':dueCount):null),top.lastChild);
    header.replaceChildren(top);
    bottom.replaceChildren(...[['overview','Обзор','LayoutGrid'],['lab','Анализы','FlaskConical'],['add','Добавить','Plus'],['vital','Показатели','HeartPulse'],['more','Ещё','Menu']].map(([id,title,glyph])=>V.h('button',{type:'button',...(id==='add'?{'data-action':'quick-add',class:'mobile-add'}:id==='more'?{'data-action':'toggle-menu','aria-expanded':String(document.body.classList.contains('health-menu-open')),'aria-controls':'health-sidebar'}:{'data-tab':id,'aria-current':state.tab===id?'page':null})},V.icon(glyph,20),id==='add'?V.h('span',{class:'sr-only'},title):title)));
    footer.replaceChildren(V.h('span',{},V.icon('Activity',13),'HUMAN · ваш журнал здоровья'),V.h('a',{href:'../#home',target:'_top'},'AYYY · Все сервисы'));
  }
  function searchResults(){
    const q=state.globalSearch.toLocaleLowerCase('ru-RU'),box=V.h('div',{});
    box.append(V.title('Результаты поиска','По всем данным текущего журнала.'));
    const results=V.card(null);let count=0;
    for(const [kind,key] of Object.entries(kinds))for(const x of recordsFor(state.doc,kind)){
      if(kind==='diary'&&(x.kind==='food'||window.HumanDiary.isDaily(x)))continue;
      const extra=['medical','medication'].includes(kind)?M.clinical(x,kind):{};const text=[x.name,x.title,x.result,x.provider,x.test_name,x.genes?.join(', '),x.variants,x.provider_text,x.type,x.value,x.notes,x.medication_name,x.description,x.activity_type,x.steps,x.sleep_minutes,x.exercise_minutes,x.dose,x.source,x.symptoms,x.treatments,x.context,extra.allergy?.reaction,extra.medication?.dose,extra.medication?.schedule,extra.medication?.route,extra.medication?.indication,extra.vaccination?.against,extra.vaccination?.dose_label,extra.vaccination?.lot,extra.vaccination?.place,extra.condition?.description].filter(Boolean).join(' ');
      const rules=state.doc.analyteAliases,labQuery=kind==='lab'&&A.normalize(q);
      if(!text.toLocaleLowerCase('ru-RU').includes(q)&&
         !(labQuery&&A.searchText(x,rules).includes(labQuery)))continue;
      count++;results.append(V.h('button',{class:'data-row','data-action':kind==='genetic'?'open-finding':kind==='document'?'file-preview':kind==='episode'?'open-episode':kind==='vital'?'open-vital':['medical','medication'].includes(kind)?'open-linked-medical':kind==='lab'?'open-group':'edit','data-kind':kind,'data-id':x.id,'data-key':kind==='lab'?M.groupKey(x,rules):null},V.icon(kind==='lab'?'FlaskConical':kind==='document'?'FileText':'NotebookTabs',18),V.h('div',{},V.h('strong',{},x.name||x.title||x.medication_name||x.type||'Запись'),V.h('small',{},V.date(kind==='genetic'?x.test_date:x.date))),V.icon('ChevronRight',14)));
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
    if(state.conflict)box.append(syncConflictCard(state.conflict));
    const profile=V.card('Профиль',[
      V.h('p',{},'Имя: '+(doc.profile.name||'Не указано')),
      V.h('p',{},'Дата рождения: '+V.date(doc.profile.birthDate)),
      V.h('p',{},'Пол: '+(doc.profile.sex||'Не указан')),
      V.button('Редактировать','edit-profile')
    ]);
    const localBox=V.card('Локальное хранение',[
      V.h('p',{},'AES-256-GCM · PBKDF2-SHA256 · 310 000 итераций'),
      V.h('p',{class:'health-note'},'В IndexedDB хранятся только зашифрованные записи.'),
      V.button('Скачать архив','backup'),V.button('Изменить фразу доступа','change-passphrase'),V.button('Другой профиль','picker')
    ]);
    box.append(V.h('div',{class:'health-grid equal'},profile,localBox));
    const form=V.form('connect',[
      V.field('Приватный репозиторий owner/repo','repo',repo?repo.owner+'/'+repo.repo:''),
      V.row(V.field('Ветка','branch',repo?.branch||'main'),
        V.field('Токен с Contents: Read/Write','token','','password'))
    ],'Подключить и проверить');
    box.append(V.card('GitHub · персональное хранилище',[
      V.banner('Тот же репозиторий, что у родословной',
        'Зашифрованный журнал и вложения сохраняются в health-data/v2/. Семейное дерево находится в family-data/trees/.'),
      V.h('p',{},repo?'Подключено: '+VRepo(repo):'Не подключён'),
      form,
      repo?V.button('Синхронизировать сейчас','sync',{class:'small'}):null,
      V.button('Стереть токен из памяти','disconnect-token',{class:'small danger'}),
      V.h('p',{class:'health-note'},
        'Токен не сохраняется на диск. Синхронизация выполняется только пока эта страница открыта.')
    ]));
    box.append(V.card('Резервирование и удаление',[
      V.h('p',{class:'health-note'},'Держите отдельную зашифрованную резервную копию вне GitHub.'),
      V.button('Скачать копию .human','backup'),V.button('Восстановить из файла','restore-file'),
      V.button('Удалить только локальную копию','delete-local',{class:'danger'})
    ]));
    return box;
  }
  let renderedVaultId=null;
  function render(){
    if(!state.doc||state.conflict?.review&&state.conflict.review.snapshot!==state.local)state.conflict=false;
    const vaultId=state.doc?.id||null;if(vaultId!==renderedVaultId){sessionRevision++;syncRun++;keyChangeRun++;state.syncBusy=false;state.rekeyBusy=false;if(dialog.open)dialog.close();document.getElementById('health-dialog-body')?.replaceChildren();state.globalSearch='';state.search='';state.groupKey='';state.observationId='';state.trendKey='';state.labFrom=state.labTo='';state.labOffset=0;state.documentQuery='';state.documentOffset=0;state.filters={};state.medicalId='';state.medicalSearch='';state.medicalStatus='';state.episodeId='';state.vitalId='';state.episodeFilter='all';state.vitalUnit='';state.vitalOffset=0;state.careView='intakes';state.careMedication='';state.careFilter='all';state.careOffset=0;state.diaryDays={};state.diaryQueries={};state.diaryOffsets={};state.diaryAll=false;state.diaryEditor=null;state.diaryMetric='steps';state.geneticQuery='';state.geneticCategory='';state.geneticOffset=0;state.reviewPreview=null;state.reviewPending=null;state.reviewError='';state.reviewBusy=false;state.reviewSelected='';state.reviewSection='assessment';state.reviewOffset=0;state.reviewContextOffset=0;state.reviewTask='';state.timelineKind='';state.timelineQuery='';state.timelineOffset=0;state.abnormalOnly=false;state.favoritesOnly=false;renderedVaultId=vaultId;}
    renderHeader();careDelivery();
    if(!state.doc){root.replaceChildren(locked());return;}
    const reviewDetails=new Map(Array.from(root.querySelectorAll('.recommendations-page details[data-review-details]'),e=>[e.dataset.reviewDetails,e.open])),reviewTask=root.querySelector('[name=reviewTask]'),reviewFocus=reviewTask&&document.activeElement===reviewTask,reviewSelection=reviewFocus?[reviewTask.selectionStart,reviewTask.selectionEnd]:null;
    const previousEditor=root.querySelector('.diary-editor');
    let view;
    if(state.globalSearch.length>=2)view=searchResults();
    else if(state.tab==='overview')view=V.stats(state);
    else if(state.tab==='lab')view=V.labSection(state);
    else if(state.tab==='vital')view=window.HumanHealthView.page(state);
    else if(state.tab==='medical')view=window.HumanMedicalView.page(state);
    else if(state.tab==='genetics')view=window.HumanGeneticsView.page(state);
    else if(state.tab==='care')view=window.HumanCareView.page(state);
    else if(['nutrition','activity'].includes(state.tab))view=window.HumanDiaryView.page(state);
    else if(state.tab==='recommendations')view=window.HumanRecommendationsView.page(state);
    else if(state.tab==='profile')view=window.HumanJournalView.profilePage(state);
    else if(state.tab==='timeline')view=window.HumanJournalView.timelinePage(state);
    else if(state.tab==='settings')view=settings();
    else view=V.listSection(state,state.tab);
    const nextEditor=view.querySelector('.diary-editor');if(nextEditor){if(previousEditor?.dataset.editorKey===nextEditor.dataset.editorKey)nextEditor.replaceWith(previousEditor);else{const form=nextEditor.querySelector('form'),id=form.dataset.id;if(id){const existing=recordsFor(state.doc,form.dataset.kind).find(r=>r.id===id);if(existing)formSnapshots.set(form,JSON.stringify(existing));}}}
    view.querySelectorAll('.health-heading').forEach((heading,index)=>{if(!index){heading.querySelector('.eyebrow')?.replaceChildren(document.createTextNode('ЛИЧНЫЙ ЖУРНАЛ '),V.h('span',{},'/'),document.createTextNode(String(tabs.findIndex(([id])=>id===state.tab)+1).padStart(2,'0')));return;}heading.className='health-section-heading';heading.querySelector('.eyebrow')?.remove();const title=heading.querySelector('h1');if(title)title.replaceWith(V.h('h2',{},title.textContent));});
    const contentClass=state.tab==='lab'&&state.globalSearch.length<2?'content content-labs':'content';
    if(state.demo){
      const label=V.h('div',{class:'health-demo-strip',role:'note'},
        V.h('span',{class:'health-demo-tag'},'ДЕМО'),
        V.h('span',{},'Все сведения вымышлены · изменения не сохраняются'),
        V.button('Сбросить пример','reset-demo',{class:'small'}));
      const heading=view.querySelector('.health-heading');heading?.remove();root.replaceChildren(heading,V.h('div',{class:contentClass},label,view));
    }else {const heading=view.querySelector('.health-heading');heading?.remove();root.replaceChildren(heading,V.h('div',{class:contentClass},view));}
    if(state.tab==='recommendations'){for(const detail of root.querySelectorAll('details[data-review-details]'))if(reviewDetails.has(detail.dataset.reviewDetails))detail.open=reviewDetails.get(detail.dataset.reviewDetails);if(reviewFocus){const next=root.querySelector('[name=reviewTask]');next?.focus();next?.setSelectionRange(...reviewSelection);}refreshReviewPreview();}
  }
  const formSnapshots=new WeakMap();
  function openDiaryEditor(kind,id){state.tab=kind==='meal'?'nutrition':'activity';state.globalSearch='';const item=id?recordsFor(state.doc,kind).find(r=>r.id===id):kind==='activity-day'?recordsFor(state.doc,kind).find(r=>r.date===window.HumanDiaryView.selectedDay(state)):null;if(id&&!item)throw Error('Запись больше не существует.');if(item&&kind==='activity-day'){state.diaryDays??={};state.diaryDays.activity=item.date;}state.diaryEditor={kind,id:item?.id||''};if(dialog.open)dialog.close();render();root.querySelector('.diary-editor input:not([type=hidden])')?.focus();root.querySelector('.diary-editor')?.scrollIntoView({block:'start'});}
  function chooseDiaryDay(day){window.HumanDiary.day(day);state.diaryDays??={};state.diaryDays[state.tab]=day;state.diaryOffsets??={};state.diaryOffsets[state.tab]=0;state.diaryAll=false;state.diaryEditor=null;render();}
  function diaryDateInput(input){if(!input?.dataset?.diaryDay||input.isConnected===false||!input.value||!state.doc||!['nutrition','activity'].includes(state.tab)||input.value===window.HumanDiaryView.selectedDay(state)||input.validity?.valid===false)return;try{const focused=document.activeElement===input;chooseDiaryDay(input.value);if(focused)root.querySelector('[data-diary-day]')?.focus();}catch(e){error(e);}}
  function openFinding(id){const item=state.doc.findings.find(x=>x.id===id);if(!item)throw Error('Результат больше не существует.');careDialog(item.title,window.HumanGeneticsView.detail(state,item));}
  function careDialog(title,content){document.getElementById('health-dialog-body').replaceChildren(V.h('div',{class:'health-modal-head'},V.h('h2',{},title),V.button('×','close-dialog',{'aria-label':'Закрыть окно'})),V.h('div',{class:'health-modal-content'},content));dialog.showModal();}
  function refreshReviewPreview(){
    if(!state.doc)return;const doc=state.doc,day=window.HumanJournal.profileDay(doc.profile),active=sessionFence();
    if(state.reviewPreview?.doc===doc&&state.reviewPreview.day===day||state.reviewPending?.doc===doc&&state.reviewPending.day===day)return;
    state.reviewPending={doc,day};
    void window.HumanRecommendations.preview(doc).then(context=>{if(!active()||state.doc!==doc)return;state.reviewPreview={doc,day,context};if(state.tab==='recommendations')render();}).catch(e=>{if(!active()||state.doc!==doc)return;state.reviewError=e.message;if(state.tab==='recommendations')render();});
  }
  function reviewIntakeDialog(){careDialog('Данные для рекомендаций',window.HumanRecommendationsView.intakeForm(state.doc));}
  function reviewContext(id){const context=state.doc.recommendationContexts.find(c=>c.id===id);if(!context)throw Error('Снимок не найден.');careDialog('Исходный снимок данных',window.HumanRecommendationsView.contextView(context));}
  function downloadReviewContext(context){download('human-review-context-'+context.id+'.json',new TextEncoder().encode(JSON.stringify(context,null,2)+'\n'),'application/json');}
  async function reviewOperation(operation){
    if(state.reviewBusy)return;const active=sessionFence();state.reviewBusy=true;state.reviewError='';render();
    try{await operation(active);}catch(e){if(active())state.reviewError=e.message||String(e);}finally{if(active()){state.reviewBusy=false;render();}}
  }
  async function reviewSnapshot(){
    if(state.demo){toast('Подготовка пакета доступна в личном журнале.');return;}
    const task=state.reviewTask||'';await reviewOperation(async active=>{let context;await mutate(async d=>{context=await window.HumanRecommendations.snapshot(d,task);});if(!active())return;downloadReviewContext(context);state.reviewContextOffset=0;toast('Снимок сохранён. Передавайте файл только выбранному вами исполнителю.');});
  }
  async function reviewUpload(file){
    if(!file)return;if(state.demo){toast('Загрузка рецензий доступна в личном журнале.');return;}
    await reviewOperation(async active=>{if(file.size>900000)throw Error('Рецензия должна быть меньше 900 КБ.');const input=JSON.parse(await file.text());if(!active())return;let report;await mutate(d=>{report=window.HumanRecommendations.addReport(d,input);});if(!active())return;state.reviewSelected=report.id;state.reviewOffset=Math.floor(window.HumanRecommendations.reports(state.doc).findIndex(r=>r.id===report.id)/10)*10;state.reviewSection='assessment';toast('Рецензия добавлена для ознакомления. Измерения не изменены.');});
  }
  function reviewObservation(contextId,id){
    const context=state.doc.recommendationContexts.find(c=>c.id===contextId),row=context?.data.observations.find(r=>r.id===id);if(!row)throw Error('Анализ отсутствует в исходном снимке.');
    const current=state.doc.observations.find(r=>r.id===id);careDialog('Анализ из снимка',V.h('div',{class:'review-observation'},V.h('p',{class:'health-note'},'Сведения на момент подготовки пакета. Последующие исправления и удаление не меняют исходный снимок.'),V.table(['Поле','Сведения'],[['Показатель',row.name],['Дата',V.date(row.date)],['Результат',row.value],['Единица',row.unit||'Неизвестна'],['Материал',row.material||'Не указан'],['Метод',row.method||'Не указан'],['Лаборатория / источник',row.source||'Не указан'],['Нижний референс',row.low||'Не указан'],['Верхний референс',row.high||'Не указан']]),row.notes?V.h('p',{class:'preserve'},row.notes):null,current?V.button('Открыть текущую запись','review-current-observation',{'data-id':id}):V.h('p',{class:'health-note'},'Текущая запись удалена; её исходные сведения сохранены только в снимке.')));
  }
  async function openTimelineEvent(id){
    const event=state.doc.timeline.find(e=>e.id===id);if(!event)throw Error('Событие не найдено.');const row=window.HumanJournal.findRecord(state.doc,event),kind=event.recordKind;
    state.globalSearch='';
    if(!row){careDialog('Событие журнала',V.h('div',{},V.h('p',{},event.title),V.h('p',{class:'health-note'},'Запись удалена. Событие сохранено в истории.'),V.h('p',{class:'health-note'},V.date(event.happenedAt))));return;}
    if(kind==='profile'){state.tab='profile';render();return;}
    if(kind.startsWith('review-')){state.tab='recommendations';state.reviewSelected=kind==='review-report'?row.id:'';state.reviewOffset=kind==='review-report'?Math.floor(window.HumanRecommendations.reports(state.doc).findIndex(r=>r.id===row.id)/10)*10:0;render();if(kind==='review-intake')careDialog('Сохранённая версия анкеты',window.HumanRecommendationsView.intakeVersionView(row));if(kind==='review-context')reviewContext(row.id);return;}
    if(kind==='lab'){state.tab='lab';state.search='';state.abnormalOnly=false;state.favoritesOnly=false;state.groupKey=M.groupKey(row,state.doc.analyteAliases);state.observationId=row.id;render();return;}
    if(kind==='genetic'){openFinding(row.id);return;}
    if(kind==='document'){await previewFile(row.id);return;}
    if(kind==='meal'||kind==='activity-day'){openDiaryEditor(kind,row.id);return;}
    if(kind==='medical'||kind==='medication'){state.tab='medical';state.filters.medical='';state.medicalSearch='';state.medicalStatus='';state.medicalId=row.id;state.medicalKind=kind;render();root.querySelector('.medical-detail')?.scrollIntoView({block:'start'});return;}
    if(kind==='vital'||kind==='episode'){state.tab='vital';state.filters.vital=kind==='episode'?'illness':row.type;state.vitalUnit=kind==='vital'?row.unit:'';state.episodeFilter='all';state.vitalId=kind==='vital'?row.id:'';state.episodeId=kind==='episode'?row.id:'';render();root.querySelector('.health-details')?.scrollIntoView({block:'start'});return;}
    if(kind==='intake'||kind==='reminder'){state.tab='care';state.careView=kind==='intake'?'intakes':'reminders';state.careFilter='all';render();}
    modal(kind,row.id);
  }
  const restoreForms=new WeakMap();
  async function startRestore(file){
    const active=sessionFence(),archive=await HumanBackup.open(file);
    if(!active())return;
    const form=V.form('restore-unlock',[V.h('p',{},'Копия и вложения будут проверены перед восстановлением.'),V.field('Фраза доступа к копии','passphrase','','password',null,true),V.h('p',{class:'error',role:'alert',hidden:true,'data-form-error':'yes'})],'Проверить копию');restoreForms.set(form,{...archive,active});careDialog('Восстановить журнал',form);
  }
  async function inspectRestore(form){
    const context=restoreForms.get(form);if(!context?.active())throw Error('Открытый журнал сменился.');
    const opened=await C.unlock(context.envelope,form.elements.passphrase.value);if(!context.active()||!form.isConnected)return;
    for(const file of opened.doc.documents){
      const object=await context.readObject(file.objectId);
      await C.openFile(opened.doc.id,file,object,opened.key);
      if(!context.active()||!form.isConnected)return;
    }
    const existing=await S.get(opened.doc.id);if(!context.active()||!form.isConnected)return;
    const d=opened.doc,next=V.form('restore-confirm',[V.h('p',{},d.profile.name||'Журнал здоровья'),V.table(['Раздел','Записей'],[['Анализы',d.observations.length],['Показатели',d.vitals.length],['Эпизоды',d.episodes.length],['Медкарта',d.medical.length+d.medications.length],['Генетика',d.findings.length],['Питание и дневник',d.diary.length],['Приёмы',d.intakes.length],['Напоминания',d.reminders.length],['Документы',d.documents.length],['История действий',d.timeline.length],['Анкеты',d.recommendationIntakes.length],['Снимки для разбора',d.recommendationContexts.length],['Рецензии',d.recommendationReports.length]]),V.h('p',{class:'health-note'},existing?'Этот журнал уже есть на устройстве. Будет создана отдельная копия; существующий журнал сохранится.':'Будет восстановлен отдельный журнал на этом устройстве.'),V.h('p',{class:'error',role:'alert',hidden:true,'data-form-error':'yes'})],existing?'Восстановить отдельную копию':'Восстановить журнал');restoreForms.set(next,{...context,opened,clone:!!existing});careDialog('Проверка резервной копии',next);
  }
  async function finishRestore(form){
    const context=restoreForms.get(form);if(!context?.active())throw Error('Открытый журнал сменился.');
    const doc=structuredClone(context.opened.doc);if(context.clone)doc.id=M.id();doc.timeline.push({id:M.id(),kind:'restore',recordKind:'profile',entityId:'profile',operation:'restore',title:context.clone?'Восстановлена отдельная копия журнала':'Восстановлена резервная копия',happenedAt:new Date().toISOString()});
    const objects=[];
    for(const file of doc.documents){
      let object=await context.readObject(file.objectId);
      if(context.clone){
        const bytes=await C.openFile(context.opened.doc.id,file,object,context.opened.key);
        const sealed=await C.sealFile(doc.id,file.id,bytes,context.opened.key);
        Object.assign(file,sealed.reference);
        object=sealed.object;
      }
      if(!context.active()||!form.isConnected)return;
      objects.push(object);
    }
    const envelope=await C.seal(doc,context.opened.key,context.envelope);if(!context.active()||!form.isConnected)return;
    const local=await S.createSelected({id:doc.id,envelope,dirty:true},objects);if(!context.active())return;
    G.disconnect();clearTimeout(syncTimer);state.local=local;state.doc=doc;state.key=context.opened.key;state.demo=false;state.picker=false;state.tab='profile';state.conflict=false;render();const active=sessionFence();await profileList();if(active()){render();toast('Резервная копия восстановлена.');}
  }
  function passphraseDialog(){
    if(state.demo)throw Error('Демо не имеет фразы доступа.');
    const form=V.form('change-passphrase',[V.h('p',{class:'health-note'},'Журнал будет заново зашифрован новой фразой. Скачанные ранее копии сохранят прежнюю фразу доступа.'),V.field('Текущая фраза','current','','password',null,true),V.field('Новая фраза (минимум 12 символов)','next','','password',null,true),V.field('Повторите новую фразу','repeat','','password',null,true),V.h('p',{class:'error',role:'alert',hidden:true,'data-form-error':'yes'})],'Изменить фразу доступа');careDialog('Защита журнала',form);
  }
  async function changePassphrase(form){
    if(state.demo||!state.key)throw Error('Откройте личный журнал.');if(state.syncBusy)throw Error('Дождитесь завершения синхронизации перед сменой фразы.');
    if(state.rekeyBusy)throw Error('Смена фразы уже выполняется.');
    const current=form.elements.current.value,next=form.elements.next.value;if(next.length<12||next!==form.elements.repeat.value)throw Error('Новые фразы не совпадают или короче 12 символов.');
    const active=sessionFence(),id=state.doc.id,runId=++keyChangeRun;state.rekeyBusy=true;clearTimeout(syncTimer);renderHeader();
    const run=writeQueue.then(async()=>{
      if(!active())throw Error('Журнал закрыт.');const before=state.local,doc=structuredClone(state.doc);
      const {key:previousKey}=await C.unlock(before.envelope,current);
      if(!active()||!form.isConnected)throw Error('Журнал закрыт.');
      doc.timeline.push({id:M.id(),kind:'security',recordKind:'profile',entityId:'profile',operation:'rekey',title:'Фраза доступа изменена',happenedAt:new Date().toISOString()});
      const encrypted=await C.newKey(next),objects=[];
      if(!active()||!form.isConnected)throw Error('Журнал закрыт.');
      for(const file of doc.documents){
        const bytes=await C.openFile(id,file,await S.getObject(id,file.objectId),previousKey);
        const sealed=await C.sealFile(id,file.id,bytes,encrypted.key);
        Object.assign(file,sealed.reference);objects.push(sealed.object);
        if(!active()||!form.isConnected)throw Error('Журнал закрыт.');
      }
      const envelope=await C.seal(doc,encrypted.key,encrypted);if(!active()||!form.isConnected)throw Error('Журнал закрыт.');
      const fresh=await S.get(id);if(!active()||!fresh||!S.sameEnvelope(fresh.envelope,before.envelope))throw Error('Журнал изменился во время смены фразы. Повторите действие.');
      const saved=await S.save({...fresh,envelope,dirty:true},fresh,objects);channel?.postMessage({client:clientId,vaultId:id});if(!active())return;
      state.local=saved;state.doc=doc;state.key=encrypted.key;sessionRevision++;syncRun++;keyChangeRun++;state.syncBusy=false;state.rekeyBusy=false;dialog.close();render();if(saved.repo&&G.hasToken())scheduleSync();toast('Журнал зашифрован новой фразой доступа.');
    });writeQueue=run.catch(()=>{});
    try{await run;}finally{if(runId===keyChangeRun&&state.local?.id===id){state.rekeyBusy=false;renderHeader();if(state.doc&&state.local.dirty&&state.local.repo&&G.hasToken())scheduleSync();}}
  }
  function careSnooze(el){const form=V.form('care-action',[V.h('p',{class:'error',role:'alert',hidden:true,'data-form-error':'yes'}),V.field('На сколько отложить','minutes','60','select',[['15','На 15 минут'],['60','На час'],['180','На 3 часа']])],'Подтвердить отсрочку');form.dataset.id=el.dataset.id;form.dataset.version=el.dataset.version;form.dataset.mode='snooze';careDialog('Отложить напоминание',form);}
  async function careAction(id,expected,action,minutes=0){
    await mutate(data=>{const C=window.HumanCare,old=C.records(data,'reminder').find(r=>r.id===id);if(!old)throw Error('Напоминание удалено.');if(old.version!==Number(expected))throw Error('Напоминание изменилось. Обновите список.');const next=action==='toggle'?C.checkReminder({...old,enabled:!old.enabled},old,data):C.act(old,action,{minutes});version(data,'reminder',old,action);const list=data.reminders??=[],index=list.findIndex(r=>r.id===id);if(index<0)list.push(next);else list[index]=next;});
  }
  let notificationVault='',notificationSeen=new Set(),activeNotification=null;
  function careDelivery(){
    const vault=state.doc?.id||'';if(vault!==notificationVault){notificationSeen.clear();notificationVault=vault;activeNotification?.close();activeNotification=null;}
    if(!state.doc||state.demo||!state.doc.carePreferences?.browser_enabled){activeNotification?.close();activeNotification=null;return;}
    const first=window.HumanCare.records(state.doc,'reminder').find(r=>window.HumanCare.due(r));
    if(!first){activeNotification?.close();activeNotification=null;return;}
    if(!window.Notification||window.Notification.permission!=='granted')return;
    const key=first.id+':'+first.scheduled_at+':'+first.next_due_at;if(notificationSeen.has(key))return;
    try{const n=new window.Notification('HUMAN · Есть напоминания',{body:'Откройте центр напоминаний в HUMAN.',tag:'human-reminder'});activeNotification?.close();activeNotification=n;notificationSeen.add(key);if(notificationSeen.size>500)notificationSeen.delete(notificationSeen.values().next().value);n.onclick=()=>{window.focus();if(state.doc?.id===vault){state.tab='care';state.careView='reminders';state.careFilter='due';state.globalSearch='';render();}n.close();};}catch{/* In-app reminders remain available. */}
  }
  async function toggleCareNotifications(){
    if(state.demo)throw Error('Браузерные уведомления доступны в личном журнале.');const id=state.doc.id,enable=!state.doc.carePreferences?.browser_enabled;
    if(enable){if(!window.Notification||!window.isSecureContext)throw Error('На этом адресе браузерные уведомления недоступны. Напоминания остаются в HUMAN.');if(await window.Notification.requestPermission()!=='granted')throw Error('Уведомления браузером не разрешены. Напоминания остаются в HUMAN.');}
    if(state.doc?.id!==id)throw Error('Журнал изменился. Повторите действие.');await mutate(data=>{data.carePreferences={...data.carePreferences,browser_enabled:enable};});
  }
  function episodeReview(id,action){
    const item=window.HumanHealth.episodes(state.doc).find(x=>x.id===id);if(!item)throw Error('Эпизод не найден.');
    const captions={ongoing:'Подтвердить, что ещё болею',ended:'Подтвердить завершение',snooze:'Уточнить позже'};if(!captions[action])throw Error('Неизвестное действие.');
    const fields=[V.h('p',{},item.title),V.h('p',{class:'error',role:'alert',hidden:true,'data-form-error':'yes'})];
    if(action==='ended')fields.push(V.field('Дата окончания, если известна','endDate',item.endDate||'','date'));else fields.push(V.field('Когда снова уточнить','days',action==='ongoing'?'3':'1','select',[['1','Через день'],['3','Через 3 дня'],['7','Через неделю']]));
    const form=V.form('episode-answer',fields,'Подтвердить');form.dataset.id=id;form.dataset.version=String(item.version||0);form.dataset.action=action;
    document.getElementById('health-dialog-body').replaceChildren(V.h('div',{class:'health-modal-head'},V.h('h2',{},captions[action]),V.button('×','close-dialog',{'aria-label':'Закрыть уточнение'})),V.h('div',{class:'health-modal-content'},form));dialog.showModal();
  }
  function modal(kind,id,initial={}){
    const collection=kinds[kind],existing=id&&collection?
      recordsFor(state.doc,kind).find(row=>row.id===id):null;
    const x=kind==='profile'?state.doc.profile:(existing||initial),now=today(),f=V.field,r=V.row;
    let fields=[];
    if(kind==='lab')fields=[
      r(f('Дата (ГГГГ-ММ-ДД, ГГГГ-ММ или ГГГГ)','date',existing?x.date:now),f('Точность даты','datePrecision',x.datePrecision||'day','select',[['day','День'],['exact','Точное время с часовым поясом'],['month','Месяц'],['year','Год'],['unknown','Неизвестна']])),
      f('Результат как в бланке','value',x.value||''),
      f('Показатель в бланке','name',x.name||''),f('Имя для группировки (необязательно)','canonicalName',x.canonicalName||''),
      r(f('Единица','unit',x.unit||''),f('Лаборатория','source',x.source||'')),
      r(f('Референс от','low',x.low||''),f('Референс до','high',x.high||'')),
      r(f('Материал','material',x.material||''),f('Метод','method',x.method||'')),
      f('Комментарий','notes',x.notes||'','textarea')
    ];
    else if(kind==='vital')fields=window.HumanHealthView.vitalFields(x,state.doc);
    else if(kind==='genetic')fields=window.HumanGeneticsView.fields(x,state.doc);
    else if(kind==='episode')fields=window.HumanHealthView.episodeFields(x,state.doc);
    else if(kind==='intake'||kind==='reminder')fields=window.HumanCareView.fields(kind,x,state.doc);
    else if(kind==='medical'||kind==='medication')fields=window.HumanMedicalView.fields(kind,x,state.doc);
    else if(kind==='diary')fields=[
      r(f('Дата','date',x.date||now,'date'),f('Тип','kind',x.kind||'wellbeing','select',
        [['sleep','Сон'],['wellbeing','Самочувствие']])),
      f('Описание','title',x.title||''),f('Подробности','notes',x.notes||'','textarea')
    ];
    else if(kind==='document')fields=[
      f('Файл PDF, JPEG, PNG, XLSX, CSV, TXT, JSON, VCF (до 32 МиБ)','file','','file'),
      f('Название','title',''),f('Дата','date',now,'date')
    ];
    else if(kind==='profile')fields=window.HumanJournalView.profileFields(x);
    const mode=kind==='profile'?'profile':'record';
    const form=V.form(mode,[V.h('p',{class:'error',role:'alert',hidden:true,'data-form-error':'yes'}),...fields],'Сохранить');
    form.dataset.kind=kind;
    if(kind==='profile'){formSnapshots.set(form,JSON.stringify(state.doc.profile));window.HumanJournalView.updateProfileForm(form);for(const name of ['birthDate','timezone'])form.elements.namedItem(name).addEventListener('input',()=>window.HumanJournalView.updateProfileForm(form));}
    if(kind==='genetic'){form.classList.add('genetics-form');window.HumanGeneticsView.updateForm(form);form.querySelector('[name=date_precision]').addEventListener('change',()=>window.HumanGeneticsView.updateForm(form,true));}
    if(kind==='intake'||kind==='reminder'){form.classList.add('care-form');window.HumanCareView.updateForm(form);form.querySelector(kind==='intake'?'[name=outcome]':'[name=frequency]')?.addEventListener('change',()=>window.HumanCareView.updateForm(form));}
    if(existing){form.dataset.id=existing.id;formSnapshots.set(form,JSON.stringify(existing));}
    if(kind==='vital'||kind==='episode'){if(kind==='vital'){form.elements.namedItem('unit').dataset.original=x.unit||'';form.elements.type.disabled=!!existing;}window.HumanHealthView.updateForm(form);form.querySelector(kind==='vital'?'[name=type]':'[name=status]')?.addEventListener('change',()=>window.HumanHealthView.updateForm(form,true));}
    if(kind==='medical'||kind==='medication'){window.HumanMedicalView.updateForm(form);form.querySelector('[name=category]')?.addEventListener('change',()=>window.HumanMedicalView.updateForm(form));}
    const body=document.getElementById('health-dialog-body');
    const close=V.button('×','close-dialog',{class:'ghost'});
    const top=V.h('div',{class:'health-modal-head'},V.h('h2',{},
      kind==='profile'?'Профиль':existing?'Редактировать запись':'Добавить запись'),close);
    body.replaceChildren(top,V.h('div',{class:'health-modal-content'},form));
    dialog.showModal();
  }
  async function mutate(change){
    const session=sessionRevision,id=state.doc?.id,key=state.key,demo=state.demo;
    const active=()=>sessionRevision===session&&state.doc?.id===id&&state.local?.id===id&&state.key===key&&state.demo===demo;
    const requireSession=()=>{if(!active())throw new Error('Журнал был закрыт или изменён. Операция отменена.');};
    const run=writeQueue.then(async()=>{
      requireSession();
      if(!state.doc)throw new Error('Откройте журнал.');
      const objects=[];
      const stageDocument=async(file,bytes)=>{
        if(demo)return {...file,size:bytes.length,data:C.base64(bytes)};
        const {reference,object}=await C.sealFile(id,file.id,bytes,key);
        objects.push(object);
        return {...file,...reference};
      };
      if(state.demo){
        const copy=structuredClone(state.doc);
        await change(copy,stageDocument);
        window.HumanJournal.appendChanges(state.doc,copy);C.assertData(copy);
        requireSession();state.doc=copy;render();
        toast('Демо: изменение действует только до выхода из примера.');
        return;
      }
      if(!state.key)throw new Error('Откройте зашифрованный журнал.');
      const data=structuredClone(state.doc),before=state.local;
      await change(data,stageDocument);
      requireSession();
      window.HumanJournal.appendChanges(state.doc,data);C.assertData(data);
      const envelope=await C.seal(data,key,before.envelope);requireSession();
      const fresh=await S.get(id);requireSession();
      if(!fresh||!S.sameEnvelope(fresh.envelope,before.envelope))throw new Error('Журнал изменился во время сохранения. Откройте его заново; новая версия не перезаписана.');
      const saved=await S.save({...fresh,envelope,dirty:true},fresh,objects);
      channel?.postMessage({client:clientId,vaultId:saved.id});
      if(!active())return;
      state.doc=data;state.local=saved;render();
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
    const active=sessionFence();
    const kind=form.dataset.kind,collection=kinds[kind];
    if(!collection)throw new Error('Неизвестная запись.');
    const old=form.dataset.id?recordsFor(state.doc,kind).find(x=>x.id===form.dataset.id):null;
    if(form.dataset.id&&!old)throw Error('Запись больше не существует.');if(old&&formSnapshots.has(form)&&formSnapshots.get(form)!==JSON.stringify(old))throw Error('Запись изменилась после открытия формы. Откройте редактор заново.');
    const input=Object.fromEntries(new FormData(form).entries());
    let record;
    if(kind==='lab')record=M.checkLab(input,old);
    if(kind==='vital'&&input.secondary!==undefined)input.value+='/'+input.secondary;
    if(kind==='vital')record=M.checkVital(window.HumanHealth.formInput(input,old,window.HumanHealth.zoneName(state.doc.profile.timezone)),old);
    if(kind==='episode')record=window.HumanHealth.checkEpisode(window.HumanHealth.formInput(input,old,window.HumanHealth.zoneName(state.doc.profile.timezone)),old,new Date(),window.HumanHealth.zoneName(state.doc.profile.timezone));
    if(kind==='vital'&&record.episodeId&&!window.HumanHealth.episodes(state.doc).some(x=>x.id===record.episodeId)&&record.episodeId!==old?.episodeId)throw Error('Связанный эпизод не найден.');
    if(kind==='medical')record=M.checkMedical(input,old);
    if(kind==='medication')record=M.checkMedication(input,old);
    if(kind==='genetic'){if(input.date_precision==='unknown')input.test_date='';record=window.HumanGenetics.checkFinding(input,old||{},state.doc);}
    if(kind==='diary')record=M.checkDiary(input,old);
    if(kind==='meal')record=window.HumanDiary.checkMeal(input,old||{},state.doc);
    if(kind==='activity-day')record=window.HumanDiary.checkActivity(input,old||{},state.doc);
    if(kind==='intake'){const H=window.HumanHealth,zone=H.zoneName(state.doc.profile.timezone);input.occurred_at=old&&H.localInput(old.occurred_at,zone)===input.at&&!input.offset?old.occurred_at:H.timestamp(input.at,zone,input.offset||'');record=window.HumanCare.checkIntake({...input,dose:input.outcome==='skipped'?'':input.dose},old||{},state.doc);}
    if(kind==='reminder')record=window.HumanCare.checkReminder(input,old||{},state.doc);
    let documentBytes;
    if(kind==='document'){
      const file=form.elements.namedItem('file').files[0];
      if(!file||file.size>C.MAX_FILE)throw new Error('Размер файла ограничен 32 МиБ.');
      const ext=file.name.toLowerCase().split('.').pop();
      const mimes={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',
        png:'image/png',txt:'text/plain',csv:'text/csv',json:'application/json',vcf:'text/vcf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
      if(!mimes[ext])throw new Error('Разрешены PDF, JPG, PNG, TXT, XLSX, CSV, JSON и VCF.');
      documentBytes=new Uint8Array(await file.arrayBuffer());
      record={id:M.id(),name:M.text(file.name,255),title:M.text(input.title,255)||file.name,
        date:M.isoDate(input.date),mime:mimes[ext],size:file.size,
        createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    }
    if(kind==='medical'||kind==='medication'){const previous=M.clinical(old||{},kind);if(record.documentId&&!state.doc.documents.some(x=>x.id===record.documentId)&&record.documentId!==previous.documentId)throw Error('Документ не найден.');if(record.episodeId&&!window.HumanMedicalView.episodes(state.doc).some(x=>x.id===record.episodeId)&&record.episodeId!==previous.episodeId)throw Error('Эпизод не найден.');}
    if(!active()||!form.isConnected)return;
    await mutate(async(data,stageDocument)=>{
      const list=data[collection]??=[];if(old){const current=recordsFor(data,kind).find(x=>x.id===old.id);if(!current||formSnapshots.has(form)&&formSnapshots.get(form)!==JSON.stringify(current))throw Error('Запись изменилась после открытия формы. Откройте редактор заново.');}
      if(kind==='genetic')record=window.HumanGenetics.checkFinding(input,old||{},data);
      if(kind==='meal')record=window.HumanDiary.checkMeal(input,old||{},data);
      if(kind==='activity-day'){record=window.HumanDiary.checkActivity(input,old||{},data);if(!old){const deleted=window.HumanDiary.deletedActivity(data,record.date);if(deleted)version(data,kind,deleted,'restore');}}
      if(kind==='intake')record=window.HumanCare.checkIntake({...input,dose:input.outcome==='skipped'?'':input.dose},old||{},data);
      if(kind==='reminder')record=window.HumanCare.checkReminder(input,old||{},data);
      if(kind==='document')record=await stageDocument(record,documentBytes);
      if(old){
        const idx=list.findIndex(x=>x.id===old.id);
        if(idx<0)throw new Error('Запись больше не существует.');
        version(data,kind,list[idx],'edit');list[idx]=record;
      }else list.push(record);
    });
    if(!form.isConnected)return;
    if(kind==='meal'||kind==='activity-day'){state.diaryEditor=null;state.diaryOffsets={};render();}
    if(kind==='vital'||kind==='episode'){state.tab='vital';state.globalSearch='';state.vitalOffset=0;state.vitalUnit=record.unit||'';state.filters.vital=kind==='vital'?record.type:'illness';state.vitalId=kind==='vital'?record.id:'';state.episodeId=kind==='episode'?record.id:'';render();}
    if(kind==='intake'||kind==='reminder'){state.careMedication='';state.careOffset=0;render();}
    dialog.close();toast(state.demo?'Демо-запись изменена только в памяти.':'Запись сохранена в зашифрованном хранилище.');
  }
  async function profileSubmit(form){
    const input=Object.fromEntries(new FormData(form).entries());
    const expected=formSnapshots.get(form),oldZone=state.doc.profile.timezone;
    await mutate(data=>{
      if(expected!==JSON.stringify(data.profile))throw Error('Профиль изменился. Откройте форму заново.');
      const next=window.HumanJournal.checkProfile(input,data.profile);
      data.revisions.push({id:M.id(),kind:'profile',operation:'edit',previous:structuredClone(data.profile),changedAt:new Date().toISOString()});data.profile=next;
    });
    if(!form.isConnected)return;
    if(oldZone!==state.doc?.profile.timezone){state.diaryDays={};render();}
    if(form.isConnected)dialog.close();
  }
  async function remove(kind,id){
    const collection=kinds[kind];
    if(!collection)throw new Error('Неизвестная категория.');
    const existing=recordsFor(state.doc,kind).find(x=>x.id===id);
    if(!existing)throw new Error('Запись не найдена.');
    if(!confirm('Удалить запись? Существующие коммиты GitHub могут сохранять старую версию.'))return false;
    await mutate(data=>{
      const list=data[collection]??=[],idx=list.findIndex(x=>x.id===id);if(!recordsFor(data,kind).some(x=>x.id===id))throw Error('Запись уже удалена.');version(data,kind,idx>=0?list[idx]:existing,'delete');if(idx>=0)list.splice(idx,1);
    });
    return true;
  }
  function download(name,bytes,mime){
    const blob=new Blob([bytes],{type:mime}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=name.replace(/[\\/]/g,'_');
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  async function backup(){
    if(state.demo)throw new Error('Демо не экспортируется и не содержит личных данных.');
    const active=sessionFence(),snapshot=await S.snapshot(state.local.id);
    const archive=await HumanBackup.pack(snapshot.envelope,snapshot.objects);
    if(!active())return null;
    download('ayyy-health-'+today()+'.human',archive,'application/octet-stream');
    return snapshot.envelope;
  }
  async function documentBytes(file){
    if(state.demo){
      const bytes=C.unbase64(file.data);
      if(bytes.length!==file.size)throw Error('Документ повреждён.');
      return bytes;
    }
    const id=state.doc.id,key=state.key;
    return C.openFile(id,file,await S.getObject(id,file.objectId),key);
  }
  async function fileDownload(id){
    const active=sessionFence();
    const file=state.doc.documents.find(d=>d.id===id);
    if(!file)throw new Error('Файл не найден.');
    const bytes=await documentBytes(file);
    if(active())download(file.name,bytes,file.mime);
  }
  let previewURL=null;
  async function previewFile(id,returnFinding=''){
    const active=sessionFence();
    const file=state.doc.documents.find(x=>x.id===id);if(!file)return;
    const bytes=await documentBytes(file);
    if(!active()||!state.doc.documents.includes(file))return;
    if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}
    const content=V.h('div',{class:'health-document-preview'});let renderFirst;
    if(file.mime==='application/pdf'){const pages=V.h('div',{class:'health-pdf-pages'}),note=V.h('p',{role:'status'},'Открываю PDF…'),prev=V.h('button',{type:'button',class:'button'},'← Назад'),next=V.h('button',{type:'button',class:'button'},'Вперёд →');let page=1,total=1,busy=false;
      async function render(){if(busy)return;busy=true;prev.disabled=next.disabled=true;try{const result=await HumanDocuments.renderPDF(bytes,page);if(!pages.isConnected||!dialog.open)return;total=result.pages;pages.replaceChildren(result.canvas);note.textContent='Страница '+page+' из '+total;}catch(e){note.textContent=e.message;}finally{busy=false;prev.disabled=page<=1;next.disabled=page>=total;}}
      prev.addEventListener('click',()=>{if(!busy&&page>1){page--;void render();}});next.addEventListener('click',()=>{if(!busy&&page<total){page++;void render();}});content.append(V.h('div',{class:'health-toolbar'},prev,note,next),pages);renderFirst=render;
    }
    else if(['image/png','image/jpeg'].includes(file.mime)){previewURL=URL.createObjectURL(new Blob([bytes],{type:file.mime}));content.append(V.h('img',{src:previewURL,alt:file.title||file.name}));}
    else if(['text/plain','text/csv','application/json','text/vcf'].includes(file.mime)){
      content.append(V.h('pre',{},new TextDecoder().decode(bytes.subarray(0,256*1024))));
      if(bytes.length>256*1024)content.append(V.h('p',{},'Здесь показано начало файла. Полный текст доступен для скачивания.'));
    }
    else content.append(V.h('p',{},'Скачайте оригинал, чтобы открыть этот формат в программе просмотра.'));
    content.append(V.h('p',{class:'health-muted'},file.name+' · '+V.date(file.date)+' · '+new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(file.size/1024)+' КБ'),V.button('Скачать оригинал','file-download',{'data-id':file.id,class:'primary'}));
    document.getElementById('health-dialog-body').replaceChildren(V.h('div',{class:'health-modal-head'},V.h('h2',{},file.title||file.name),returnFinding?V.button('К результату','open-finding',{'data-id':returnFinding,class:'small'}):null,V.button('×','close-dialog',{'aria-label':'Закрыть просмотр'})),V.h('div',{class:'health-modal-content'},content));dialog.showModal();if(renderFirst)await renderFirst();
  }
  dialog.addEventListener('close',()=>{if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}});
  async function switchProfile(id){
    const request=++sessionRevision;
    const chosen=await S.get(id);
    if(request!==sessionRevision)return;
    if(!chosen)throw new Error('Локальный профиль не найден.');
    await S.select(id);if(request!==sessionRevision)return;G.disconnect();state.demo=false;state.local=chosen;state.key=null;state.doc=null;
    state.picker=false;state.conflict=false;state.tab='overview';state.filters={};render();
  }
  function scheduleSync(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>{void syncNow();},3000);
  }
  function sessionFence(){const revision=sessionRevision,id=state.doc?.id,localId=state.local?.id,key=state.key;return ()=>revision===sessionRevision&&id===state.doc?.id&&localId===state.local?.id&&key===state.key;}
  const syncLabels={
    observations:'Анализ',vitals:'Показатель',episodes:'Эпизод',medical:'Медкарта',
    medications:'Препарат',findings:'Генетическая запись',diary:'Дневник',documents:'Документ',
    intakes:'Приём',reminders:'Напоминание',recommendationIntakes:'Версия анкеты',
    recommendationContexts:'Снимок для рекомендаций',recommendationReports:'Рецензия',
    currentQuestionnaire:'Текущая анкета',analytePreferences:'Настройки показателя',analyteAliases:'Сопоставление показателя',
    settings:'Настройки журнала',revisions:'История записи',timeline:'Событие',
  };
  function syncConflictCard(conflict){
    const actions=[V.button('Скачать локальную копию','backup')];
    if(!conflict.review){
      return V.card('Конфликт версий',[
        V.banner('Локальная копия сохранена',conflict.message),...actions,
        V.button('Использовать GitHub-версию','restore-remote',{class:'danger'}),
      ]);
    }
    const review=conflict.review;
    const fields=review.conflicts.map((item,index)=>{
      const display=item.local??item.remote;
      const label=[syncLabels[item.collection],display?.title||display?.name||display?.description||display?.type||display?.date].filter(Boolean).join(' · ');
      function summary(value){
        if(value===undefined)return 'Записи нет';
        const json=JSON.stringify(value,(key,field)=>{
          if(key==='data'&&item.collection==='documents')return 'Содержимое вложения';
          if(key==='data'&&item.collection==='recommendationContexts')return 'Данные снимка';
          return field;
        },2);
        return json.length>16000?json.slice(0,16000)+'…':json;
      }
      function option(side,title,value){
        return V.h('div',{},V.h('label',{},V.h('input',{type:'radio',name:'choice-'+index,value:side,required:true}),' '+title),
          V.h('pre',{class:'health-sync-version'},summary(value)),
          item.collection==='documents'&&value?.objectId
            ? V.button('Скачать оригинал','sync-conflict-file',{'data-index':index,'data-side':side,class:'small'})
            : null);
      }
      return V.h('fieldset',{class:'health-sync-choice'},V.h('legend',{},label),
        V.h('div',{class:'health-grid equal'},option('local','Локальная версия',item.local),option('remote','Версия GitHub',item.remote)),
        item.before===undefined?null:V.h('details',{},V.h('summary',{},'Общая исходная версия'),V.h('pre',{class:'health-sync-version'},summary(item.before))));
    });
    const form=V.form('sync-merge',[
      V.h('p',{class:'error',role:'alert',hidden:true,'data-form-error':'yes'}),
      ...fields,
    ],'Объединить и синхронизировать');
    formSnapshots.set(form,review);
    return V.card('Конфликт версий',[
      V.banner(review.conflicts.length?'Выберите версии записей':'Изменения можно объединить',
        'Журнал сохранит независимые изменения с обоих устройств.'),
      ...actions,form,
    ]);
  }
  function showSyncConflict(message,review=null){
    state.conflict={message,review};
    state.tab='settings';
    state.globalSearch='';
    render();
  }
  async function compareSyncVersions(snapshot,remote,key,active){
    if(!snapshot.remoteSha){
      showSyncConflict('Для этих копий нет сохранённой общей версии. Скачайте локальную копию перед восстановлением из GitHub.');
      return;
    }
    try{
      const baseEnvelope=await G.readBlob(snapshot.repo,snapshot.remoteSha);
      if(!active())return;
      if(!baseEnvelope){
        showSyncConflict('Общая версия больше недоступна в GitHub. Скачайте локальную копию перед восстановлением.');
        return;
      }
      if(baseEnvelope.salt!==snapshot.envelope.salt||remote.envelope.salt!==snapshot.envelope.salt){
        showSyncConflict('Фраза доступа была изменена. Скачайте локальную копию перед восстановлением версии GitHub.');
        return;
      }
      const [base,local,other]=await Promise.all([baseEnvelope,snapshot.envelope,remote.envelope].map(value=>C.openWithKey(value,key)));
      if(!active())return;
      await writeQueue;
      if(!active())return;
      if(state.local!==snapshot){scheduleSync();return;}
      const {conflicts}=Merge.plan(base,local,other);
      showSyncConflict('',{snapshot,remote,base,local,other,conflicts});
    }catch(e){
      if(active())showSyncConflict(e.message);
    }
  }
  async function acceptSyncMerge(form){
    const review=formSnapshots.get(form);
    if(state.syncBusy||state.rekeyBusy||!G.hasToken())throw Error('Подключите GitHub и дождитесь завершения текущей синхронизации.');
    if(!review||review!==state.conflict?.review||state.local!==review.snapshot)
      throw Error('Журнал изменился. Обновите сравнение через синхронизацию.');
    const fields=new FormData(form);
    const choices=review.conflicts.map((_,index)=>fields.get('choice-'+index));
    const active=sessionFence();
    state.syncBusy=true;
    renderHeader();
    const run=writeQueue.then(async()=>{
      if(!active()||!form.isConnected||state.local!==review.snapshot||review!==state.conflict?.review)
        throw Error('Журнал изменился. Обновите сравнение через синхронизацию.');
      const {doc}=Merge.plan(review.base,review.local,review.other,choices);
      if(!doc)throw Error('Выберите версию для каждой конфликтующей записи.');
      doc.timeline.push({id:M.id(),kind:'sync',recordKind:'profile',entityId:'profile',
        operation:'merge',title:'Объединены версии журнала',happenedAt:new Date().toISOString()});
      const objects=await fetchDocuments(review.snapshot.repo,review.remote,review.snapshot.envelope,doc,state.key,active);
      if(!objects)return;
      const envelope=await C.seal(doc,state.key,review.snapshot.envelope);
      if(!active()||!form.isConnected||!G.hasToken())throw Error('Подключение или журнал изменились.');
      const saved=await S.save({...review.snapshot,envelope,remoteSha:review.remote.sha,dirty:true},review.snapshot,objects);
      channel?.postMessage({client:clientId,vaultId:saved.id});
      if(!active())return;
      state.doc=doc;
      state.local=saved;
      state.conflict=false;
      render();
    });
    writeQueue=run.catch(()=>{});
    try{await run;}finally{if(active()){state.syncBusy=false;renderHeader();}}
    if(active())await syncNow();
  }
  async function conflictFile(index,side){
    const active=sessionFence(),review=state.conflict?.review;
    const item=review?.conflicts[index];
    if(!item||item.collection!=='documents'||!['local','remote'].includes(side))return;
    const file=item[side];
    if(!file)return;
    const id=state.doc.id,key=state.key;
    const object=side==='local'?await S.getObject(id,file.objectId)
      :await G.readObject(review.snapshot.repo,file.objectId,review.remote.commit);
    const bytes=await C.openFile(id,file,object,key);
    if(active()&&state.conflict?.review===review)download(file.name,bytes,'application/octet-stream');
  }
  async function fetchDocuments(repo,remote,localEnvelope,doc,key,active){
    const existing=new Set(localEnvelope?.objectIds||[]);
    const files=new Map(doc?.documents.map(file=>[file.objectId,file])||[]);
    const objects=[];
    let size=0;
    for(const id of doc?files.keys():remote.envelope.objectIds){
      if(!active())return null;
      if(existing.has(id))continue;
      const object=await G.readObject(repo,id,remote.commit);
      size+=object.bytes.length-C.FILE_OVERHEAD;
      if(size>C.MAX_FILES)throw Error('Вложения превышают общий предел 128 МиБ.');
      if(doc)await C.openFile(doc.id,files.get(id),object,key);
      objects.push(object);
    }
    return active()?objects:null;
  }
  async function syncNow(){
    if(state.demo){toast('Демо никогда не отправляется в GitHub.');return;}
    if(state.syncBusy||state.rekeyBusy||!state.local?.repo||!state.key){if(!state.local?.repo)toast('Сначала подключите GitHub на вкладке «Настройки».');return;}
    if(!G.hasToken()){state.tab='settings';render();toast('Введите токен GitHub.');return;}
    const fence=sessionFence(),run=++syncRun,active=()=>fence()&&run===syncRun;
    state.syncBusy=true;renderHeader();
    try{
      await writeQueue;if(!active())return;
      const snapshot=state.local,key=state.key;
      await G.verify(snapshot.repo);if(!active())return;
      const remote=await G.read(snapshot.repo);if(!active())return;
      if(remote&&remote.envelope.vaultId!==snapshot.id)throw new Error('В этом репозитории уже хранится другой медицинский профиль.');
      if(remote&&remote.sha!==snapshot.remoteSha){
        const alreadySent=S.sameEnvelope(remote.envelope,snapshot.envelope);
        if(snapshot.dirty&&!alreadySent){await compareSyncVersions(snapshot,remote,key,active);return;}
        if(remote.envelope.salt!==snapshot.envelope.salt){
          showSyncConflict('Версия GitHub зашифрована другой фразой доступа. Скачайте локальную копию перед восстановлением.');
          return;
        }
        const decrypted=await C.openWithKey(remote.envelope,key);if(!active())return;
        const objects=await fetchDocuments(snapshot.repo,remote,snapshot.envelope,decrypted,key,active);
        if(!objects)return;
        await writeQueue;if(!active())return;
        const fresh=await S.get(snapshot.id);if(!active())return;
        if(!fresh)throw Error('Локальный журнал удалён.');
        if(state.local!==snapshot||!S.sameEnvelope(fresh.envelope,snapshot.envelope)){scheduleSync();return;}
        const updated=await S.save({...fresh,envelope:remote.envelope,remoteSha:remote.sha,dirty:false,lastSyncAt:new Date().toISOString()},fresh,objects);
        channel?.postMessage({client:clientId,vaultId:snapshot.id});if(!active())return;
        state.doc=decrypted;state.local=updated;state.conflict=false;render();toast('Загружены изменения из GitHub.');return;
      }
      if(!remote&&snapshot.remoteSha){showSyncConflict('Удалённая версия больше недоступна. Локальная копия сохранена.');return;}
      if(!snapshot.dirty){toast('Все изменения уже синхронизированы.');return;}
      let sha;
      try{
        sha=await G.write(snapshot.repo,snapshot.envelope,remote?.sha||null,
          id=>S.getObject(snapshot.id,id),()=>active()&&G.hasToken());
      }catch(e){
        if(!active())return;
        if(![409,422].includes(e.status))throw e;
        const changed=await G.read(snapshot.repo);
        if(!active())return;
        if(changed?.sha===remote?.sha)throw e;
        if(changed)await compareSyncVersions(snapshot,changed,key,active);
        else showSyncConflict('Удалённая версия больше недоступна. Локальная копия сохранена.');
        return;
      }
      if(!active())return;
      await writeQueue;if(!active())return;
      const fresh=await S.get(snapshot.id);if(!active())return;
      if(!fresh)throw Error('Локальный журнал удалён.');
      if(fresh.remoteSha!==snapshot.remoteSha||['owner','repo','branch'].some(key=>fresh.repo?.[key]!==snapshot.repo[key]))return;
      const unchanged=S.sameEnvelope(fresh.envelope,snapshot.envelope);
      const updated=await S.save({...fresh,remoteSha:sha,dirty:!unchanged,lastSyncAt:new Date().toISOString()},fresh);if(!active())return;
      state.local=updated;state.conflict=false;render();toast(unchanged?'Зашифрованные данные отправлены в GitHub.':'Новые изменения ожидают следующей отправки.');if(updated.dirty)scheduleSync();
    }catch(e){if(active())error(e);}
    finally{if(run===syncRun){state.syncBusy=false;renderHeader();}}
  }
  async function restoreRemote(){
    if(state.syncBusy||state.rekeyBusy)throw new Error('Дождитесь завершения текущей операции.');
    if(!state.local?.repo||!G.hasToken()||!state.key)throw new Error('Сначала подключите токен GitHub и откройте журнал.');
    if(!confirm('Заменить локальную версию архивом из GitHub? Перед заменой будет скачана резервная копия.'))return;
    const active=sessionFence();await writeQueue;if(!active())return;
    const snapshot=state.local;
    await backup();if(!active())return;
    await G.verify(snapshot.repo);if(!active())return;
    const remote=await G.read(snapshot.repo);if(!active())return;
    if(!remote||remote.envelope.vaultId!==snapshot.id)throw new Error('Удалённый архив не найден либо принадлежит другому профилю.');
    const objects=await fetchDocuments(snapshot.repo,remote,snapshot.envelope,null,null,active);
    if(!objects)return;
    const updated=await S.save({...snapshot,envelope:remote.envelope,remoteSha:remote.sha,dirty:false},snapshot,objects);
    channel?.postMessage({client:clientId,vaultId:snapshot.id});if(!active())return;
    state.local=updated;state.key=null;state.doc=null;state.conflict=false;G.disconnect();render();toast('Архив заменён; откройте его фразой доступа.');
  }
  function labFormRow(doc,form){
    const row=doc.observations.find(item=>item.id===form.dataset.id);
    if(!row||(row.updatedAt||'')!==form.dataset.updated)throw Error('Измерение изменилось. Откройте его заново.');
    return row;
  }
  async function submitAnalyte(form){
    const input=Object.fromEntries(new FormData(form).entries()),mode=form.dataset.form;
    await mutate(doc=>{
      const row=labFormRow(doc,form),rules=doc.analyteAliases;
      if(mode==='analyte-alias'){
        const expected=input.scope==='document'?form.dataset.documentVersion:form.dataset.nameVersion;
        const {key,previous}=A.applyAlias(doc,row,{...input,expected});
        doc.revisions.push({id:M.id(),kind:'analyte-alias',recordId:key,operation:'edit',previous,
          changedAt:new Date().toISOString()});
        doc.timeline.push({id:M.id(),kind:'classification',recordKind:'lab',entityId:row.id,
          operation:'edit',title:'Сопоставление показателя: '+row.name,happenedAt:new Date().toISOString()});
      }else if(mode==='analyte-default-unit'){
        if(A.defaultKey(row,rules)!==form.dataset.key)throw Error('Группа показателя изменилась.');
        const {key,previous}=A.setDefault(doc,row,input.unit,input.reason,form.dataset.version);
        doc.revisions.push({id:M.id(),kind:'analyte-preferences',recordId:key,operation:'edit',previous,
          changedAt:new Date().toISOString()});
      }else{
        const context=A.context(row,rules);
        const choice=A.unitOptions(doc,row).find(item=>item.unit===input.unit);
        if(context!==form.dataset.context||!choice)throw Error('Список единиц изменился. Откройте измерение заново.');
        version(doc,'lab',row,'unit-history');
        row.unitHistory={...choice,context,assignedAt:new Date().toISOString()};
        row.updatedAt=new Date().toISOString();
      }
    });
    toast('Настройки показателя сохранены.');
  }
  async function connect(form){
    if(state.demo)throw new Error('Демо не подключается к GitHub.');
    const values=Object.fromEntries(new FormData(form).entries()),repo=G.parseRepo(values.repo,values.branch),active=sessionFence();
    G.token(values.token);
    try{
      await G.verify(repo);if(!active())return;
      await writeQueue;if(!active())return;
      const fresh=await S.get(state.local.id);if(!active())return;if(!fresh)throw Error('Локальный журнал удалён.');
      const old=fresh.repo,equals=old&&old.owner===repo.owner&&old.repo===repo.repo&&old.branch===repo.branch;
      const updated=await S.save({...fresh,repo,remoteSha:equals?fresh.remoteSha:null,dirty:equals?fresh.dirty:true},fresh);if(!active())return;
      syncRun++;state.syncBusy=false;state.local=updated;state.conflict=false;render();await syncNow();
    }catch(e){if(active()){G.disconnect();throw e;}}
  }
  async function onSubmit(event){
    const form=event.target;
    if(!(form instanceof HTMLFormElement)||!form.dataset.form)return;
    event.preventDefault();
    const submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;const inlineError=form.querySelector('[data-form-error]');if(inlineError)inlineError.hidden=true;
    try{
      const mode=form.dataset.form;
      if(mode==='sync-merge'){
        await acceptSyncMerge(form);
      }else if(mode==='create'){
        const active=sessionFence();
        const pass=form.elements.namedItem('password').value;
        if(pass.length<12||pass!==form.elements.namedItem('repeat').value)
          throw new Error('Фразы не совпадают или короче 12 символов.');
        const created=await C.create(pass);
        if(!active())return;const local=await S.createSelected({id:created.doc.id,envelope:created.envelope,dirty:true});if(!active())return;
        await profileList();if(!active())return;
        state.local=local;
        state.doc=created.doc;state.key=created.key;state.picker=false;state.tab='overview';
        render();
        toast('Зашифрованный профиль создан. Не теряйте фразу доступа.');
      }else if(mode==='unlock'){
        const active=sessionFence();
        const opened=await C.unlock(state.local.envelope,form.elements.namedItem('passphrase').value);
        if(!active())return;
        state.doc=opened.doc;state.key=opened.key;state.picker=false;state.tab='overview';
        render();
      }else if(mode==='download'){
        const active=sessionFence();
        const v=Object.fromEntries(new FormData(form).entries()),repo=G.parseRepo(v.repo,v.branch);
        G.token(v.token);await G.verify(repo);if(!active())return;
        const data=await G.read(repo);if(!active())return;
        if(!data)throw new Error('В репозитории нет текущего журнала HUMAN.');
        if(await S.get(data.envelope.vaultId))throw new Error('Этот профиль уже есть на устройстве.');
        if(!active())return;
        const objects=await fetchDocuments(repo,data,null,null,null,active);
        if(!objects)return;
        const local=await S.createSelected({id:data.envelope.vaultId,envelope:data.envelope,
          repo,remoteSha:data.sha,dirty:false},objects);
        if(!active())return;await profileList();if(!active())return;
        state.local=local;state.doc=null;state.key=null;state.picker=false;render();
        toast('Архив загружен. Введите вашу фразу доступа.');
      }else if(mode==='import-vault')await startRestore(form.elements.namedItem('file').files[0]);
      else if(mode==='restore-unlock')await inspectRestore(form);
      else if(mode==='restore-confirm')await finishRestore(form);
      else if(mode==='change-passphrase')await changePassphrase(form);
      else if(mode==='episode-answer'){
        const id=form.dataset.id,expected=Number(form.dataset.version),input=Object.fromEntries(new FormData(form).entries()),H=window.HumanHealth;
        await mutate(data=>{const old=H.episodes(data).find(x=>x.id===id);if(!old)throw Error('Эпизод больше не существует.');if((old.version||0)!==expected)throw Error('Эпизод изменился. Откройте уточнение заново.');const next=H.answerEpisode(old,form.dataset.action,{days:input.days?Number(input.days):0,endDate:input.endDate||'',zone:H.zoneName(data.profile.timezone)});version(data,'episode',old,'episode_'+form.dataset.action);const list=data.episodes??=[],index=list.findIndex(x=>x.id===id);if(index<0)list.push(next);else list[index]=next;});if(form.isConnected)dialog.close();
      }
      else if(mode==='care-action'){await careAction(form.dataset.id,form.dataset.version,form.dataset.mode,Number(form.elements.minutes.value));if(form.isConnected)dialog.close();}
      else if(mode==='record')await recordSubmit(form);
      else if(['analyte-alias','analyte-default-unit','analyte-unit'].includes(mode))await submitAnalyte(form);
      else if(mode==='analyte-preferences'){
        const input=Object.fromEntries(new FormData(form).entries()),key=form.dataset.key;
        await mutate(doc=>{
          const row=labFormRow(doc,form);
          if(M.groupKey(row,doc.analyteAliases)!==key||A.effectiveUnit(row,doc.analyteAliases)!==input.unit)
            throw Error('Группа показателя изменилась. Откройте настройки заново.');
          doc.analytePreferences??={};
          const previous=doc.analytePreferences[key]||{};
          doc.analytePreferences[key]=M.checkPreferences(input,previous);
          doc.revisions.push({id:M.id(),kind:'analyte-preferences',recordId:key,
            operation:'edit',previous,changedAt:new Date().toISOString()});
        });
        toast('Настройки показателя сохранены.');
      }
      else if(mode==='review-intake'){const answers=Object.fromEntries(new FormData(form).entries());await mutate(d=>window.HumanRecommendations.saveIntake(d,answers,form.dataset.version));if(form.isConnected)dialog.close();toast('Ответы сохранены со слов пользователя. Для их учёта нужна новая рецензия.');}
      else if(mode==='profile')await profileSubmit(form);
      else if(mode==='connect')await connect(form);
    }catch(e){if(inlineError){inlineError.textContent=e.message||String(e);inlineError.hidden=false;inlineError.scrollIntoView?.({block:'nearest'});}else error(e);}
    finally{if(submit?.isConnected)submit.disabled=false;}
  }
  let importGeneration=0;
  async function importDocuments(files){
    if(!files.length)return;
    const generation=++importGeneration,tab=state.tab,active=sessionFence();
    await HumanImport.open(files,{V,M,dialog,commit:mutate,getDoc:()=>state.doc,isCurrent:()=>active()&&generation===importGeneration&&state.tab===tab});
  }
  async function deleteLocal(){
    if(state.demo)throw new Error('Демо удаляется при выходе.');
    if(!state.local)return;
    const sameSession=sessionFence();
    const copied=await backup();if(!copied||!sameSession())return;
    if(!confirm('Удалить локальную зашифрованную копию? GitHub останется без изменений.'))return;
    if(!confirm('Подтвердите окончательное удаление с устройства.'))return;
    const id=state.local.id;clearTimeout(syncTimer);G.disconnect();state.doc=null;state.key=null;render();const active=sessionFence();
    try{
      await S.remove(id,copied);
    }catch(e){
      const current=await S.get(id);
      if(active()){state.local=current;render();}
      throw e;
    }
    channel?.postMessage({client:clientId,vaultId:id});
    if(!active())return;
    await profileList();if(!active())return;
    state.local=null;state.picker=true;render();
  }
  function openDemo(){
    sessionRevision++;
    clearTimeout(syncTimer);
    G.disconnect();
    state.demo=true;
    state.doc=window.HumanDemo.create();
    state.local={id:state.doc.id,repo:null,dirty:false};
    state.key=null;
    state.picker=false;state.tab='overview';state.globalSearch='';state.search='';state.groupKey='';state.observationId='';state.trendKey='';state.labFrom=state.labTo='';state.labOffset=0;state.documentQuery='';state.documentOffset=0;state.filters={};state.abnormalOnly=false;state.medicalId='';state.medicalSearch='';state.medicalStatus='';
    state.conflict=false;state.syncBusy=false;
    render();
  }
  async function exitDemo(){
    sessionRevision++;clearTimeout(syncTimer);G.disconnect();
    state.demo=false;state.doc=null;state.key=null;state.local=null;state.picker=true;
    state.tab='overview';state.search='';state.groupKey='';state.conflict=false;render();
    const active=sessionFence();
    try{
      await profileList();if(!active())return;
      const id=await S.current();if(!active())return;
      const local=id?await S.get(id):null;if(!active())return;state.local=local;
    }catch{if(!active())return;state.profiles=[];state.local=null;}
    state.picker=!state.local;render();
  }
  async function onClick(event){
    const el=event.target.closest('[data-action],[data-tab]');
    if(!el)return;
    if(el.dataset.tab){event.preventDefault();state.tab=el.dataset.tab;state.globalSearch='';state.search='';state.groupKey='';state.labOffset=0;document.body.classList.remove('health-menu-open');render();root.focus({preventScroll:true});window.scrollTo(0,0);return;}
    const action=el.dataset.action;
    try{
      if(action==='toggle-menu'){document.body.classList.toggle('health-menu-open');el.setAttribute('aria-expanded',String(document.body.classList.contains('health-menu-open')));}
      else if(action==='close-menu')document.body.classList.remove('health-menu-open');
      else if(action==='diary-shift')chooseDiaryDay(window.HumanHealth.shiftDay(window.HumanDiaryView.selectedDay(state),Number(el.dataset.delta)));
      else if(action==='diary-today')chooseDiaryDay(window.HumanHealth.localInput(new Date(),state.doc.profile.timezone).slice(0,10));
      else if(action==='diary-choose-day')chooseDiaryDay(el.dataset.day);
      else if(action==='close-diary-editor'){state.diaryEditor=null;render();}
      else if(action==='diary-range'){state.diaryAll=el.dataset.all==='true';state.diaryOffsets??={};state.diaryOffsets[state.tab]=0;render();}
      else if(action==='diary-page'){state.diaryOffsets??={};state.diaryOffsets[state.tab]=Number(el.dataset.offset);render();}
      else if(action==='diary-metric'){state.diaryMetric=el.dataset.metric;render();}
      else if(action==='profile-growth'){state.tab='vital';state.filters.vital='Рост';state.globalSearch='';render();}
      else if(action==='timeline-page'){state.timelineOffset=Number(el.dataset.offset);render();}
      else if(action==='review-intake')reviewIntakeDialog();
      else if(action==='review-tab'){state.reviewSection=el.dataset.section;render();}
      else if(action==='review-page'){state.reviewOffset=Number(el.dataset.offset);state.reviewSelected='';state.reviewSection='assessment';render();}
      else if(action==='review-context-page'){state.reviewContextOffset=Number(el.dataset.offset);render();}
      else if(action==='review-context')reviewContext(el.dataset.id);
      else if(action==='review-download-context'){const c=state.doc.recommendationContexts.find(c=>c.id===el.dataset.id);if(!c)throw Error('Снимок не найден.');downloadReviewContext(c);}
      else if(action==='review-snapshot')await reviewSnapshot();
      else if(action==='review-state')await reviewOperation(async()=>{await mutate(d=>window.HumanRecommendations.setState(d,el.dataset.id,el.dataset.state,el.dataset.version));});
      else if(action==='review-observation')reviewObservation(el.dataset.context,el.dataset.id);
      else if(action==='review-current-observation'){const row=state.doc.observations.find(r=>r.id===el.dataset.id);if(!row)throw Error('Текущая запись удалена.');dialog.close();state.globalSearch='';state.tab='lab';state.search='';state.abnormalOnly=false;state.favoritesOnly=false;state.groupKey=M.groupKey(row);state.observationId=row.id;render();}
      else if(action==='timeline-open')await openTimelineEvent(el.dataset.id);
      else if(action==='genetics-reset'){state.geneticQuery='';state.geneticCategory='';state.geneticOffset=0;render();}
      else if(action==='genetics-page'){state.geneticOffset=Number(el.dataset.offset);render();}
      else if(action==='open-finding')openFinding(el.dataset.id);
      else if(action==='care-view'){state.careView=el.dataset.view;state.careOffset=0;render();}
      else if(action==='care-page'){state.careOffset=Number(el.dataset.offset);render();}
      else if(action==='care-all'){state.careMedication='';state.careOffset=0;render();}
      else if(action==='care-center'){state.tab='care';state.careView='reminders';state.careMedication='';state.careFilter='due';state.careOffset=0;state.globalSearch='';render();}
      else if(action==='care-medication'){state.tab='care';state.careView=el.dataset.view;state.careMedication=el.dataset.id;state.careOffset=0;state.globalSearch='';render();modal(el.dataset.view==='reminders'?'reminder':'intake',null,{medication_id:el.dataset.id});}
      else if(action==='care-history')careDialog('История исправлений',window.HumanCareView.history(state.doc,el.dataset.kind,el.dataset.id));
      else if(action==='care-notifications')await toggleCareNotifications();
      else if(action==='care-toggle')await careAction(el.dataset.id,el.dataset.version,'toggle');
      else if(action==='care-act'){if(el.dataset.mode==='snooze')careSnooze(el);else await careAction(el.dataset.id,el.dataset.version,el.dataset.mode);}
      else if(action==='quick-add'){dialog.querySelector('#health-dialog-body').replaceChildren(V.h('div',{class:'health-modal-head'},V.h('h2',{},'Добавить запись'),V.button('×','close-dialog',{'aria-label':'Закрыть окно'})),V.h('div',{class:'health-modal-content health-quick-options'},[['Анализ','lab'],['Домашнее измерение','vital'],['Болезнь или самочувствие','episode'],['Медицинская запись','medical'],['Препарат','medication'],['Приём пищи','meal'],['Активность за день','activity-day'],['Запись дневника','diary'],['Генетический результат','genetic'],['Документ','document']].map(([title,kind])=>V.button(title,'new-'+kind))));dialog.showModal();}
      else if(action==='toggle-favorite'){
        const key=el.dataset.key,group=el.dataset.group;
        await mutate(d=>{
          d.analytePreferences??={};
          const old=d.analytePreferences[key]||{};
          d.analytePreferences[key]={...old,favorite:!(old.favorite??d.analytePreferences[group]?.favorite)};
        });
      }
      else if(action==='clear-history-unit'){
        const id=el.dataset.id;
        await mutate(doc=>{
          const row=doc.observations.find(item=>item.id===id);
          if(!row?.unitHistory)throw Error('Подстановка уже снята.');
          version(doc,'lab',row,'clear-unit-history');
          delete row.unitHistory;
          row.updatedAt=new Date().toISOString();
        });
      }
      else if(action==='filter-favorites'){state.favoritesOnly=!state.favoritesOnly;state.labOffset=0;render();}
      else if(action==='filter-abnormal'){state.abnormalOnly=!state.abnormalOnly;state.groupKey='';state.labOffset=0;render();}
      else if(action==='lab-page'){state.labOffset=Number(el.dataset.offset);render();}
      else if(action==='lab-results'){state.groupKey=state.observationId='';render();window.scrollTo(0,0);}
      else if(action==='lab-reset'){state.search=state.labFrom=state.labTo='';state.abnormalOnly=false;state.labOffset=0;render();}
      else if(action==='document-page'){state.documentOffset=Number(el.dataset.offset);render();}
      else if(action==='document-reset'){state.documentQuery='';state.documentOffset=0;render();root.querySelector('[data-search=documents]')?.focus();}
      else if(action==='select-observation'){state.observationId=el.dataset.id;render();}
      else if(action==='open-group'){state.observationId=el.dataset.id||'';state.tab='lab';state.globalSearch='';state.groupKey=el.dataset.key;render();window.scrollTo(0,0);}
      else if(action==='open-demo'||action==='reset-demo')openDemo();
      else if(action==='exit-demo')await exitDemo();
      else if(action==='filter-records'){state.filters[el.dataset.kind]=el.dataset.value;if(el.dataset.kind==='vital'){state.episodeId='';state.vitalId='';state.vitalUnit='';state.vitalOffset=0;}if(el.dataset.kind==='medical'){state.medicalId='';state.medicalStatus='';}render();}
      else if(['new-meal','new-activity-day'].includes(action))openDiaryEditor(action.slice(4));
      else if(action?.startsWith('new-')){modal(action.slice(4),null,['new-intake','new-reminder'].includes(action)?{medication_id:el.dataset.medication||''}:action==='new-medical'?{category:state.filters.medical||'allergy'}:action==='new-vital'?{type:el.dataset.value&&el.dataset.value!=='illness'?el.dataset.value:'Давление',episodeId:el.dataset.episode||''}:{});}
      else if(action==='edit'){let kind=el.dataset.kind;if(kind==='diary'){const row=state.doc.diary.find(r=>r.id===el.dataset.id);if(row?.kind==='food')kind='meal';else if(row&&window.HumanDiary.isDaily(row))kind='activity-day';}if(['meal','activity-day'].includes(kind))openDiaryEditor(kind,el.dataset.id);else modal(kind,el.dataset.id);}
      else if(action==='edit-profile')modal('profile',null);
      else if(action==='remove'){let kind=el.dataset.kind;if(kind==='diary'){const row=state.doc.diary.find(r=>r.id===el.dataset.id);if(row?.kind==='food')kind='meal';else if(row&&window.HumanDiary.isDaily(row))kind='activity-day';}const removed=await remove(kind,el.dataset.id);if(removed&&kind==='genetic'&&dialog.open)dialog.close();}
      else if(action==='select-group'){
        const query=A.normalize(state.search),rules=state.doc.analyteAliases;
        const all=M.groups(state.doc.observations,state.doc.analytePreferences,rules).filter(group=>
          !query||group.rows.some(row=>A.searchText(row,rules).includes(query)));
        state.groupKey=all[Number(el.dataset.index)]?.key||'';
        render();
      }else if(action==='picker'){
        sessionRevision++;
        clearTimeout(syncTimer);G.disconnect();state.demo=false;
        state.picker=true;state.local=null;state.doc=null;state.key=null;render();
      }else if(action==='select-profile')await switchProfile(el.dataset.id);
      else if(action==='lock'){
        clearTimeout(syncTimer);G.disconnect();state.demo=false;state.doc=null;state.key=null;
        state.picker=false;state.conflict=false;render();
      }else if(action==='sync')await syncNow();
      else if(action==='disconnect-token'){G.disconnect();state.conflict=false;render();}
      else if(action==='sync-conflict-file')await conflictFile(Number(el.dataset.index),el.dataset.side);
      else if(action==='restore-remote')await restoreRemote();
      else if(action==='open-vital'||action==='open-episode'){state.tab='vital';state.globalSearch='';state.vitalId=action==='open-vital'?el.dataset.id:'';state.episodeId=action==='open-episode'?el.dataset.id:'';if(action==='open-episode')state.filters.vital='illness';else state.filters.vital=state.doc.vitals.find(x=>x.id===el.dataset.id)?.type||'Масса';render();const panel=root.querySelector('.health-details');panel?.focus();panel?.scrollIntoView({block:'start'});}
      else if(action==='close-health-detail'){state.vitalId='';state.episodeId='';render();}
      else if(action==='vital-page'){state.vitalOffset=Number(el.dataset.offset);render();root.querySelector('.health-list')?.scrollIntoView({block:'start'});}
      else if(action==='vital-unit'){state.vitalUnit=el.dataset.unit;render();}
      else if(action==='open-linked-medical'){state.tab='medical';state.filters.medical='';state.medicalSearch='';state.medicalStatus='';state.medicalId=el.dataset.id;state.medicalKind=el.dataset.kind;render();const panel=root.querySelector('.medical-detail');panel?.focus();panel?.scrollIntoView({block:'start'});}
      else if(action==='review-episode')episodeReview(el.dataset.id,el.dataset.mode);
      else if(action==='open-medical'){state.medicalId=el.dataset.id;state.medicalKind=el.dataset.kind;render();const panel=root.querySelector('.medical-detail');panel?.focus();panel?.scrollIntoView({block:'start'});}
      else if(action==='close-medical'){state.medicalId='';render();}
      else if(action==='backup')await backup();
      else if(action==='change-passphrase')passphraseDialog();
      else if(action==='restore-file'){const input=document.createElement('input');input.type='file';input.accept='.human';input.hidden=true;input.addEventListener('cancel',()=>input.remove(),{once:true});input.addEventListener('change',()=>{void startRestore(input.files[0]).catch(error).finally(()=>input.remove());});document.body.append(input);input.click();}
      else if(action==='delete-local')await deleteLocal();
      else if(action==='file-download')await fileDownload(el.dataset.id);
      else if(action==='file-preview')await previewFile(el.dataset.id,el.dataset.returnFinding||'');
      else if(action==='close-dialog')dialog.close();
      else if(action==='csv'){
        const input=document.createElement('input');
        input.type='file';input.accept='.csv,.xlsx,.pdf,.png,.jpg,.jpeg';input.hidden=true;input.multiple=true;
        input.addEventListener('cancel',()=>input.remove(),{once:true});
        input.addEventListener('change',()=>{
          const files=Array.from(input.files);
          input.remove();
          void importDocuments(files).catch(error);
        },{once:true});
        document.body.append(input);input.click();
      }
    }catch(e){error(e);}
  }
  document.addEventListener('submit',event=>{void onSubmit(event);});
  document.addEventListener('click',event=>{void onClick(event);});
  function labDateInput(input){
    const field=input?.dataset?.labDate;
    if(field!=='labFrom'&&field!=='labTo')return;
    if(!input.isConnected||!input.validity.valid||input.value===(state[field]||''))return;
    const focused=document.activeElement===input;
    state[field]=input.value;state.labOffset=0;render();
    if(focused)root.querySelector(`[data-lab-date=${field}]`)?.focus({preventScroll:true});
  }
  document.addEventListener('input',event=>{
    diaryDateInput(event.target);
    labDateInput(event.target);
    if(event.target?.name==='reviewTask')state.reviewTask=event.target.value;
    if(event.target?.dataset?.search==='timeline'){const value=event.target.value,position=event.target.selectionStart||0;state.timelineQuery=value;state.timelineOffset=0;render();const next=root.querySelector('[data-search=timeline]');next?.focus();try{next?.setSelectionRange(position,position);}catch{}
    }else if(event.target?.dataset?.search==='genetics'){const value=event.target.value,position=event.target.selectionStart||0;state.geneticQuery=value;state.geneticOffset=0;render();const next=root.querySelector('[data-search=genetics]');next?.focus();try{next?.setSelectionRange(position,position);}catch{}
    }else if(event.target?.dataset?.search==='diary-native'){const value=event.target.value,position=event.target.selectionStart||0;state.diaryQueries??={};state.diaryQueries[state.tab]=value;state.diaryOffsets??={};state.diaryOffsets[state.tab]=0;render();const next=root.querySelector('[data-search=diary-native]');next?.focus();try{next?.setSelectionRange(position,position);}catch{}
    }else if(event.target?.dataset?.search==='medical'){const value=event.target.value,position=event.target.selectionStart||0;state.medicalSearch=value;render();const next=root.querySelector('[data-search=medical]');next?.focus();try{next?.setSelectionRange(position,position);}catch{}
    }else if(event.target?.dataset?.search==='documents'){const value=event.target.value,position=event.target.selectionStart||0;state.documentQuery=value;state.documentOffset=0;render();const next=root.querySelector('[data-search=documents]');next?.focus();next?.setSelectionRange(position,position);
    }else if(event.target?.dataset?.search==='global'){const pos=event.target.selectionStart||0;state.globalSearch=event.target.value;render();const next=document.getElementById('health-global-search');next.focus();try{next.setSelectionRange(pos,pos);}catch{}
    }else if(event.target?.dataset?.search==='labs'){
      const position=event.target.selectionStart||0;
      state.search=event.target.value;state.groupKey='';state.labOffset=0;render();
      const next=root.querySelector('[data-search=labs]');
      if(next){next.focus();try{next.setSelectionRange(position,position);}catch{}}
    }
  });
  document.addEventListener('change',event=>labDateInput(event.target));
  document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('circle[data-action],[role=button][data-action]')){event.preventDefault();void onClick(event);return;}if(event.key==='Escape'&&document.body.classList.contains('health-menu-open')){document.body.classList.remove('health-menu-open');document.querySelector('[data-action=toggle-menu]')?.focus();}if(event.key==='/'&&!dialog.open&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,textarea,select,[contenteditable=true]')){event.preventDefault();document.getElementById('health-global-search')?.focus();}});
  document.addEventListener('change',event=>{if(event.target?.dataset?.reviewSelected){state.reviewSelected=event.target.value;state.reviewSection='assessment';render();}if(event.target?.dataset?.reviewUpload){const file=event.target.files[0];event.target.value='';void reviewUpload(file);}if(event.target?.dataset?.timelineKind){state.timelineKind=event.target.value;state.timelineOffset=0;render();}if(event.target?.dataset?.geneticCategory){state.geneticCategory=event.target.value;state.geneticOffset=0;render();}diaryDateInput(event.target);if(event.target?.dataset?.careFilter){state.careFilter=event.target.value;state.careOffset=0;render();}if(event.target?.dataset?.episodeFilter){state.episodeFilter=event.target.value;state.vitalOffset=0;render();}if(event.target?.dataset?.medicalStatus){state.medicalStatus=event.target.value;render();}if(event.target?.dataset?.trend==='overview'){state.trendKey=event.target.value;render();}});
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{if(!dialog.open)document.getElementById('health-dialog-body').replaceChildren();});
  function refreshCare(){
    if(!state.doc)return;careDelivery();const count=window.HumanCare.records(state.doc,'reminder').filter(r=>window.HumanCare.due(r)).length,bell=document.getElementById('health-reminder-bell');if(bell){bell.setAttribute('aria-label','Центр напоминаний: '+count);bell.querySelector('span')?.remove();if(count)bell.append(V.h('span',{},count>99?'99+':count));}
    if(state.tab==='recommendations'&&!dialog.open)refreshReviewPreview();
    if(state.tab==='care'&&!dialog.open&&!document.activeElement?.matches('input,textarea,select'))render();
  }
  let diaryResize;window.addEventListener?.('resize',()=>{if(state.doc&&['activity','vital'].includes(state.tab)){clearTimeout(diaryResize);diaryResize=setTimeout(render,120);}});
  window.setInterval?.(refreshCare,60000);window.addEventListener?.('focus',refreshCare);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCare();});window.addEventListener?.('pagehide',()=>activeNotification?.close());
  if(channel)channel.onmessage=event=>{
    if(state.demo||!state.local||event.data?.client===clientId||event.data?.vaultId!==state.local.id)return;
    const id=state.local.id;sessionRevision++;clearTimeout(syncTimer);state.doc=null;state.key=null;G.disconnect();render();const revision=sessionRevision;
    const current=()=>revision===sessionRevision&&state.local?.id===id;
    void S.get(id).then(async data=>{
      if(!current())return;
      if(!data){
        const profiles=await S.list();
        if(!current())return;
        state.profiles=profiles;
        state.picker=true;
      }
      state.local=data;
      render();
      toast(data?'Профиль изменён в другой вкладке. Откройте его снова.':'Локальная копия удалена в другой вкладке.');
    }).catch(error);
  };
  root.replaceChildren(V.h('p',{class:'health-muted',role:'status'},'Открываем журнал…'));
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
