/* OBERON workspace lifecycle: durable local drafts, repository selection,
 * in-memory credentials and conflict-aware GitHub synchronization. */
(() => {
  'use strict';
  const S=window.OberonStorage, G=window.OberonGitHub;
  const $=selector=>document.querySelector(selector);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=value=>structuredClone(value);
  const now=()=>new Date().toISOString();
  const empty=()=>({notes:[],folders:[]});
  const signature=value=>JSON.stringify({notes:(value?.notes||[]).map(n=>[n.path,n.content]).sort((a,b)=>a[0].localeCompare(b[0])),folders:[...(value?.folders||[])].sort()});
  let E,home,rows=[],record=null,generation=0,writeQueue=Promise.resolve(),network=null,syncPromise=null;
  let pendingLocal=false,localError=null,networkError='',syncBusy=false,syncTimer,progress='',dialogOperation=0,connectClient=null,localConflict=null;
  let lastSaved=null,syncNotBefore=0;
  // No token enters a snapshot, IndexedDB, localStorage, a URL or an export.
  const tokens=new Map();
  const isGithub=()=>record?.kind==='github';
  const hasToken=()=>record&&tokens.has(record.id);
  const pendingConflict=()=>localConflict||E?.snapshot()?.syncConflict;
  const isDirty=snapshot=>isGithub()&&signature(snapshot)!==signature(record.base||empty());
  const title=(text,description='')=>`<div class="modal-header"><div><h2>${escape(text)}</h2>${description?`<p>${escape(description)}</p>`:''}</div><button class="icon-button" data-ws="close" aria-label="Закрыть">×</button></div>`;
  const button=(label,action,primary=false)=>`<button type="button" class="${primary?'primary':'secondary'}-button" data-ws="${action}">${escape(label)}</button>`;
  function dialog(html){
    closeConnectionAttempt();
    E.dialog(html);
  }
  function closeConnectionAttempt(){dialogOperation++;connectClient?.abort();connectClient=null;}
  function close(){closeConnectionAttempt();E.closeDialog();}
  function humanTime(value){return value?new Date(value).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Ещё не было';}
  function status(){
    if(!E||!record)return;
    const dirty=isDirty(E.snapshot()),conflict=pendingConflict();
    let label,footer,kind='saved';
    if(localError){label=localError.code==='LOCAL_CONFLICT'?'Конфликт вкладок':'Ошибка сохранения';footer='Изменения не сохранены · скачайте копию';kind='error';}
    else if(conflict){label='Выбрать версии';footer='Локальная копия сохранена · есть конфликт';kind='error';}
    else if(pendingLocal){label=record.kind==='demo'?'Демо · локально':syncBusy?'Синхронизация…':'Локальный черновик';footer='Сохраняю в браузере…';kind='pending';}
    else if(record.kind==='demo'){label='Демо · локально';footer='Демо сохранено в браузере';}
    else if(syncBusy){label=progress||'Синхронизация…';footer='Локальная копия сохранена · синхронизирую';kind='pending';}
    else if(networkError){label='Проверить синхронизацию';footer='Сохранено локально · GitHub требует внимания';kind='error';}
    else if(dirty){label=hasToken()?'Есть изменения':'Ввести токен';footer=hasToken()?'Сохранено локально · ожидает GitHub':'Сохранено локально · для GitHub нужен токен';kind='pending';}
    else {label=hasToken()?'GitHub · синхронизировано':record.connection.private?'GitHub · ввести токен':'GitHub · чтение';footer=hasToken()?'Сохранено в браузере и GitHub':'Локальная копия · последняя проверка '+humanTime(record.lastSync);}
    E.context({record,label,footer,kind,detail:networkError||localError?.message||''});
  }
  function scheduleSync(){
    clearTimeout(syncTimer);
    if(!record||!isGithub()||!E.snapshot().autoSync||!isDirty(E.snapshot())||!hasToken()||syncBusy||networkError||localError||pendingConflict())return;
    syncTimer=setTimeout(()=>sync({automatic:true}),Math.max(2000,syncNotBefore-Date.now()));
  }
  function markPending(){pendingLocal=!!record;status();}
  function save(snapshot,announce=false,metadata={}){
    if(!record)return Promise.resolve(true);
    pendingLocal=true;const id=record.id,epoch=generation,captured=clone(snapshot);status();
    const task=writeQueue.then(async()=>{
      if(!record||record.id!==id||generation!==epoch)return false;
      if(localError?.code==='LOCAL_CONFLICT')return false;
      try{
        // Apply remote metadata inside the same serialized transaction as its
        // snapshot. A preceding draft write must not restore an older Git base.
        const next={...record,...metadata,snapshot:captured,dirty:record.kind==='github'&&signature(captured)!==signature(metadata.base||record.base||empty()),error:networkError||(captured.syncConflict?'Есть конфликт версий':'')};
        const saved=await S.save(next,record.revision);
        if(generation!==epoch||record?.id!==id)return true;
        record=saved;lastSaved=clone(captured);localError=null;
        pendingLocal=JSON.stringify(E.snapshot())!==JSON.stringify(captured);
        if(announce)E.toast(record.kind==='demo'?'Демо сохранено в браузере':record.dirty?'Черновик сохранён локально':'Заметки сохранены');
        status();scheduleSync();return true;
      }catch(error){
        if(generation!==epoch)return false;
        localError=error;pendingLocal=true;clearTimeout(syncTimer);status();
        E.toast(error.message||'Не удалось сохранить заметки. Скачайте копию.');return false;
      }
    });
    writeQueue=task.catch(()=>{});return task;
  }
  async function flush(){
    if(!record)return true;
    const id=record.id,epoch=generation;
    // The editor stays responsive during IndexedDB writes. A transition may
    // proceed only after the latest keystroke, including one typed mid-save.
    while(record?.id===id&&generation===epoch){
      E.cancelSaveTimer();const snapshot=E.snapshot();
      if(!(await save(snapshot)))return false;
      if(record?.id!==id||generation!==epoch)return false;
      if(JSON.stringify(E.snapshot())===JSON.stringify(snapshot))return true;
    }
    return false;
  }
  async function refreshHome(options={}){
    try{rows=await S.list();home.render(rows,options);}
    catch(error){home.render(rows,{error:error.message,...options});}
  }
  async function showHome(){
    if(record&&!(await flush())){if(localError?.code==='LOCAL_CONFLICT')await resolveLocalConflict();else E.toast('Сначала сохраните или скачайте изменения.');return;}
    clearTimeout(syncTimer);generation++;network?.abort();network=null;syncBusy=false;syncPromise=null;record=null;localError=null;localConflict=null;pendingLocal=false;networkError='';
    close();E.hide();$('#vault-home').hidden=false;document.title='OBERON — ваши пространства · AYYY';
    // Remove a direct-demo flag without disturbing the parent portal route.
    if(new URLSearchParams(location.search).has('demo'))history.replaceState(null,'',location.pathname);
    await refreshHome();
  }
  function applyData(data,extra={}){
    const current=E.snapshot(),byPath=new Map(current.notes.map(n=>[n.path,n]));
    const notes=data.notes.map(n=>{const old=byPath.get(n.path);return {...n,id:old?.id||n.id,favorite:old?.favorite??n.favorite};});
    const ids=new Set(notes.map(n=>n.id));
    const active=ids.has(current.active)?current.active:notes[0]?.id||null;
    let tabs=(current.tabs||[]).filter(id=>ids.has(id));if(active&&!tabs.includes(active))tabs.push(active);
    E.apply({...current,notes,folders:clone(data.folders),active,tabs,...extra});
  }
  async function openVault(id,{skipRefresh=false}={}){
    if(record&&!(await flush())){if(localError?.code==='LOCAL_CONFLICT')await resolveLocalConflict();return;}
    const epoch=++generation;clearTimeout(syncTimer);network?.abort();network=null;syncBusy=false;syncPromise=null;
    home.render(rows,{busyId:id});
    try{
      const next=await S.get(id);if(epoch!==generation)return;if(!next)throw Error('Это пространство уже удалено в другой вкладке.');
      record=next;record.lastOpened=now();lastSaved=clone(next.snapshot);pendingLocal=false;localError=null;networkError=next.error||'';localConflict=null;
      E.load(next.snapshot);$('#vault-home').hidden=true;E.show();status();
      if(!(await save(E.snapshot())))return;
      if(next.kind==='github'&&!skipRefresh&&!E.snapshot().syncConflict&&(!next.connection.private||hasToken())){
        networkError='';void sync({automatic:true});
      }
    }catch(error){if(epoch!==generation)return;home.render(rows,{error:error.message});E.toast(error.message);}
  }
  async function sync({automatic=false}={}){
    if(!record||record.kind!=='github')return;
    if(localError?.code==='LOCAL_CONFLICT'){if(!automatic)await resolveLocalConflict();return;}
    if(pendingConflict()){if(!automatic)conflictDialog();return;}
    if(syncBusy)return syncPromise;
    const requestedId=record.id,requestedGeneration=generation;
    if(!(await flush()))return;
    if(!record||record.id!==requestedId||generation!==requestedGeneration)return;
    if(syncBusy)return syncPromise;
    if(pendingConflict()||localError)return;
    const local=E.snapshot(),dirty=isDirty(local);
    if((dirty||record.connection.private)&&!hasToken()){
      if(!automatic)authorize();else status();return;
    }
    if(dirty&&record.connection.canWrite===false&&hasToken()){
      networkError='У токена нет разрешения на запись. Проверьте Contents: Read and write.';status();if(!automatic)authorize();return;
    }
    const epoch=generation,id=record.id,base=clone(record.base||empty());
    syncBusy=true;networkError='';progress='Синхронизация…';status();clearTimeout(syncTimer);
    network=G.create(record.connection,tokens.get(id)||'',record.base);const client=network;
    syncPromise=(async()=>{
      try{
        const result=dirty?await client.sync({base,local,onProgress:()=>{}}):{snapshot:await client.load(),changed:0};
        if(generation!==epoch||record?.id!==id)return;
        // Account for edits made while the request was in flight. New local edits
        // are merged against exactly the sent state, never replaced by its result.
        const later=G.merge(local,E.snapshot(),result.snapshot);
        const metadata={base:clone(result.snapshot),lastSync:now(),connection:{...record.connection,...result.snapshot.repository}};
        const conflict=later.conflicts.length?{kind:'remote',conflicts:later.conflicts,remote:clone(result.snapshot),merged:{notes:later.notes,folders:later.folders}}:null;
        applyData(later,{syncConflict:conflict});
        await save(E.snapshot(),false,metadata);
        if(conflict){if(!automatic)conflictDialog();else E.toast('В одной из заметок есть конфликт. Выберите версии перед синхронизацией.');}
        else if(!automatic)E.toast(result.changed?'Изменения сохранены в GitHub':'Актуальная версия загружена из GitHub');
      }catch(error){
        if(generation!==epoch||record?.id!==id||error.code==='ABORTED')return;
        if(error.code==='CONFLICT'){
          // Include edits since the request began. The next sync rechecks GitHub
          // after explicit choices; choosing a version never forces a Git ref.
          const merged=G.merge(base,E.snapshot(),error.remote);
          const conflict=merged.conflicts.length?{kind:'remote',conflicts:merged.conflicts,remote:clone(error.remote),merged:{notes:merged.notes,folders:merged.folders}}:null;
          applyData(merged,{syncConflict:conflict});
          await save(E.snapshot(),false,conflict?{}:{base:clone(error.remote),lastSync:now()});
          if(conflict){if(!automatic)conflictDialog();else E.toast('Конфликт версий: локальные изменения сохранены.');}
          else if(!automatic)E.toast('Версии объединены. Изменения готовы к синхронизации.');
        }else{
          networkError=error.message||'Не удалось синхронизировать GitHub.';
          if(error.code==='AUTH')tokens.delete(id);
          await save(E.snapshot());if(!automatic)E.toast(networkError);
        }
      }finally{
        client.abort();if(generation===epoch&&record?.id===id){network=null;syncBusy=false;syncPromise=null;progress='';status();scheduleSync();}
      }
    })();return syncPromise;
  }
  function githubTokenGuide(){return "<div class=\"connection-help github-token-guide\"><strong>Как создать fine-grained token</strong><br>1. <strong>Repository access → Only select repositories</strong> — выберите нужный репозиторий.<br>2. <strong>Repository permissions → Contents → Read and write</strong>; <strong>Metadata → Read-only</strong> включено автоматически. Остальные разрешения не нужны.<br>3. Нажмите <strong>Generate token</strong> и вставьте его сюда. Права на запись действуют на <strong>весь репозиторий</strong>, не только на OBERON. Токен хранится в памяти открытой страницы. <a href=\"https://github.com/settings/personal-access-tokens/new\" target=\"_blank\" rel=\"noopener noreferrer\">Создать токен ↗</a></div>";}
  function connect(){
    dialog(title('Новое пространство','Подключите свой репозиторий GitHub. Заметки будут жить в папке OBERON.')+`<form id="connect-form"><div class="modal-body"><label class="modal-field"><span>Репозиторий</span><input id="connect-repo" placeholder="owner/repository или ссылка GitHub" autocomplete="off" autofocus required></label><div class="connection-fields"><label class="modal-field"><span>Ветка</span><input id="connect-branch" placeholder="По умолчанию" autocomplete="off"></label><label class="modal-field"><span>Название пространства</span><input id="connect-name" placeholder="Например, Мои заметки" maxlength="100"></label></div><label class="modal-field"><span>Токен GitHub <small>для приватного репозитория и записи</small></span><input id="connect-token" type="password" autocomplete="off" spellcheck="false" placeholder="Fine-grained token"></label>${githubTokenGuide()}<label class="connection-check"><input id="connect-auto" type="checkbox" checked><span>Автоматически сохранять изменения в GitHub</span></label><div class="modal-notice"><p>Без токена можно читать публичный репозиторий. Для отправки изменений понадобится токен. Можно выбрать репозиторий, который уже используется другими сервисами: OBERON работает в своей папке.</p></div><p class="form-error" id="connect-error" role="alert"></p></div><div class="modal-footer">${button('Отмена','close')}<button class="primary-button" id="connect-submit" type="submit">Подключить и открыть</button></div></form>`);
    $('#connect-form').onsubmit=async event=>{
      event.preventDefault();const attempt=++dialogOperation;
      const secret=$('#connect-token').value.trim(),label=$('#connect-name').value.trim(),autoSync=$('#connect-auto').checked;
      const submit=$('#connect-submit'),errorBox=$('#connect-error');submit.disabled=true;submit.textContent='Проверяю репозиторий…';errorBox.textContent='';
      try{
        const parsed=G.parseRepo($('#connect-repo').value,$('#connect-branch').value),client=G.create(parsed,secret);connectClient=client;
        const verified=await client.verify();if(attempt!==dialogOperation)return;
        const all=await S.list(),duplicate=all.find(row=>row.connection&&row.connection.owner.toLowerCase()===verified.owner.toLowerCase()&&row.connection.repo.toLowerCase()===verified.repo.toLowerCase()&&row.connection.branch===verified.branch);
        if(duplicate){
          const existing=await S.get(duplicate.id);if(attempt!==dialogOperation)return;
          if(existing.connection.repoId&&verified.repoId!==existing.connection.repoId)throw Error('По этому адресу находится другой репозиторий. Сначала скачайте локальную копию и уберите прежнее подключение из списка.');
          if(secret){await S.save({...existing,connection:verified},existing.revision);if(attempt!==dialogOperation)return;tokens.set(duplicate.id,secret);}
          close();await openVault(duplicate.id);E.toast('Этот репозиторий уже подключён — открываю его пространство.');return;
        }
        submit.textContent='Загружаю заметки…';const remote=await client.load();if(attempt!==dialogOperation)return;
        const id='github-'+crypto.randomUUID(),snapshot={...E.defaults(),...remote,autoSync,syncConflict:null,active:remote.notes[0]?.id||null,tabs:remote.notes[0]?[remote.notes[0].id]:[]};
        const created=await S.create({id,kind:'github',name:label||verified.repo,connection:verified,snapshot,base:remote,dirty:false,lastSync:now(),createdAt:now()});
        if(secret)tokens.set(id,secret);close();await refreshHome();await openVault(created.id,{skipRefresh:true});
        if(!remote.notes.length)E.toast('Папка OBERON пока пуста. Создайте первую заметку.');
      }catch(error){if(attempt!==dialogOperation)return;errorBox.textContent=error.message||'Не удалось подключить репозиторий.';submit.disabled=false;submit.textContent='Подключить и открыть';}
      finally{if(attempt===dialogOperation){connectClient?.abort();connectClient=null;}}
    };
  }
  function authorize(){
    if(!isGithub())return;const id=record.id;
    dialog(title('Разрешить синхронизацию',record.connection.owner+'/'+record.connection.repo+' · '+record.connection.branch)+`<form id="authorize-form"><div class="modal-body"><p>Локальные заметки уже сохранены. Введите токен с доступом к этому репозиторию и <strong>Contents: Read and write</strong>, чтобы отправить изменения и получить свежую версию.</p><label class="modal-field"><span>Токен GitHub</span><input id="authorize-token" type="password" autocomplete="off" spellcheck="false" autofocus required></label>${githubTokenGuide()}<p class="form-error" id="authorize-error" role="alert"></p></div><div class="modal-footer">${button('Позже','close')}<button class="primary-button" id="authorize-submit" type="submit">Подключить и синхронизировать</button></div></form>`);
    $('#authorize-form').onsubmit=async event=>{
      event.preventDefault();const attempt=++dialogOperation,secret=$('#authorize-token').value.trim(),submit=$('#authorize-submit');submit.disabled=true;
      try{
        connectClient=G.create(record.connection,secret);const verified=await connectClient.verify();if(attempt!==dialogOperation||record?.id!==id)return;
        if(verified.canWrite===false)throw Error('У этого токена нет доступа на запись. Проверьте разрешения репозитория.');
        tokens.set(id,secret);networkError='';close();await save(E.snapshot(),false,{connection:verified});await sync();
      }catch(error){if(attempt===dialogOperation){$('#authorize-error').textContent=error.message;submit.disabled=false;}}
      finally{if(attempt===dialogOperation){connectClient?.abort();connectClient=null;}}
    };
  }
  function connectionDialog(){
    if(!record)return;
    if(localError?.code==='LOCAL_CONFLICT'){void resolveLocalConflict();return;}
    if(pendingConflict()){conflictDialog();return;}
    if(record.kind==='demo'){
      dialog(title('Демо · первая орбита','Постоянное пространство с примерами.')+`<div class="modal-body"><p>Здесь можно редактировать заметки, менять папки и пробовать связи. Изменения сохраняются в этом браузере, а повторное открытие возвращает к тому же демо.</p><p>Для собственных заметок подключите репозиторий на странице пространств.</p></div><div class="modal-footer">${button('Все пространства','home')}${button('Скачать заметки','export')}${button('Понятно','close',true)}</div>`);return;
    }
    const c=record.connection,auto=E.snapshot().autoSync!==false;
    dialog(title(record.name,c.owner+'/'+c.repo)+`<div class="modal-body"><div class="connection-summary"><span>Ветка</span><strong>${escape(c.branch)}</strong><span>Папка</span><strong>OBERON/</strong><span>Последняя синхронизация</span><strong>${escape(humanTime(record.lastSync))}</strong><span>Доступ</span><strong>${hasToken()?'Токен в памяти страницы':'Для записи нужен токен'}</strong></div><label class="connection-check"><input id="autosync-switch" type="checkbox" ${auto?'checked':''}><span>Синхронизировать автоматически после изменений</span></label>${networkError?`<div class="modal-notice connection-error"><p>${escape(networkError)}</p></div>`:''}<p class="connection-help">OBERON изменяет только свои файлы в папке <code>OBERON/</code>. Файлы других сервисов остаются на месте.</p><div class="connection-secondary-actions">${button(hasToken()?'Заменить токен':'Ввести токен','authorize')}${hasToken()?button('Забыть токен','forget-token'):''}${button('Скачать архив','export')}</div></div><div class="modal-footer">${button('Все пространства','home')}${button('Синхронизировать сейчас','sync',true)}</div>`);
    $('#autosync-switch').onchange=event=>{E.patch({autoSync:event.target.checked});void save(E.snapshot());};
  }
  async function manage(id){
    const row=await S.get(id);if(!row){await refreshHome();return;}
    const demo=row.kind==='demo';
    dialog(title(demo?'Демонстрационное пространство':row.name,demo?'Одна постоянная копия для экспериментов.':row.connection.owner+'/'+row.connection.repo+' · '+row.connection.branch)+`<div class="modal-body"><p>${demo?'Вы можете восстановить исходные примеры или скачать свои изменения. Новая копия демо при открытии не создаётся.':'Подключение хранится в этом браузере. Его удаление из списка не удаляет файлы в GitHub.'}</p>${row.dirty?'<div class="modal-notice connection-error"><p>В этом пространстве есть изменения, которые ещё не отправлены в GitHub. Перед удалением подключения скачайте архив.</p></div>':''}<p class="form-error" id="manage-error" role="alert"></p></div><div class="modal-footer"><button class="secondary-button" id="manage-export">Скачать архив</button><button class="secondary-button" id="manage-remove">${demo?'Восстановить демо':'Убрать из списка'}</button><button class="primary-button" id="manage-open">Открыть</button></div>`);
    $('#manage-export').onclick=()=>E.export(row.snapshot);
    $('#manage-open').onclick=()=>{close();void openVault(id);};
    $('#manage-remove').onclick=()=>{
      dialog(title(demo?'Восстановить примеры?':'Убрать подключение?',row.name)+`<div class="modal-body"><p>${demo?'Ваши изменения в демо будут заменены исходными примерами. Скачайте архив, если хотите их сохранить.':row.dirty?'Локальные изменения этого пространства будут удалены вместе с подключением. Файлы в GitHub останутся на месте.':'Из списка будет удалено подключение и локальная копия. Файлы в GitHub останутся на месте.'}</p><p class="form-error" id="remove-error" role="alert"></p></div><div class="modal-footer">${button('Отмена','close')}<button id="remove-confirm" class="primary-button danger-button">${demo?'Восстановить демо':'Убрать подключение'}</button></div>`);
      $('#remove-confirm').onclick=async()=>{
        const b=$('#remove-confirm');b.disabled=true;
        try{if(demo)await S.save({...row,snapshot:{...E.defaults(),...clone(window.OBERON_SEED)},dirty:false,error:''},row.revision);else{await S.remove(id,row.revision);tokens.delete(id);}close();await refreshHome();}
        catch(error){$('#remove-error').textContent=error.message;b.disabled=false;}
      };
    };
  }
  async function resolveLocalConflict(){
    if(!record)return;
    try{
      const fresh=await S.get(record.id);if(!fresh)throw Error('Подключение удалено в другой вкладке. Скачайте текущие заметки перед выходом.');
      const merged=G.merge(lastSaved||empty(),E.snapshot(),fresh.snapshot);
      if(!merged.conflicts.length){record=fresh;lastSaved=clone(fresh.snapshot);localError=null;localConflict=null;applyData(merged,{syncConflict:fresh.snapshot.syncConflict||E.snapshot().syncConflict||null});await save(E.snapshot());E.toast('Изменения вкладок объединены');return;}
      localConflict={kind:'local',conflicts:merged.conflicts,remote:fresh.snapshot,remoteRecord:fresh,merged:{notes:merged.notes,folders:merged.folders}};applyData(merged);conflictDialog();
    }catch(error){E.toast(error.message);}
  }
  function conflictDialog(){
    const pending=pendingConflict();if(!pending)return;
    const liveNotes=new Map(E.snapshot().notes.map(note=>[note.path,note.content]));
    // A deferred conflict can be reopened after more editing. Display the latest
    // local text and preserve all other notes when applying explicit choices.
    const conflict={...pending,conflicts:pending.conflicts.map(c=>({...c,local:liveNotes.has(c.path)?liveNotes.get(c.path):null}))};
    const source=conflict.kind==='local'?'другой вкладке':'GitHub';
    dialog(title('Две версии одной мысли','Выберите, что сохранить. Все варианты можно сначала скачать.')+`<form id="conflict-form"><div class="modal-body"><p>Одни и те же файлы изменились здесь и в ${source}. Остальные изменения уже объединены.</p><div class="conflict-list">${conflict.conflicts.map((c,i)=>`<section class="conflict-file"><strong>${escape(c.path)}</strong><div class="conflict-versions"><div><small>Эта вкладка</small><pre>${escape(c.local===null?'Файл удалён':c.local.slice(0,1800))}</pre></div><div><small>${escape(source)}</small><pre>${escape(c.remote===null?'Файл удалён':c.remote.slice(0,1800))}</pre></div></div><label class="modal-field"><span>Сохранить</span><select data-conflict-index="${i}" required><option value="">Выберите версию…</option value="local">Версию этой вкладки${c.local===null?' (удалить файл)':''}</option><option value="remote">Версию из ${source}${c.remote===null?' (удалить файл)':''}</option>${c.local!==null&&c.remote!==null?'<option value="both">Обе — локальную отдельной копией</option>':''}</select></label></section>`).join('')}</div><p class="form-error" id="conflict-error" role="alert"></p></div><div class="modal-footer"><button class="secondary-button" type="button" id="conflict-export">Скачать обе версии</button>${button('Решить позже','close')}<button class="primary-button" type="submit">Применить выбор</button></div></form>`);
    $('#modal').classList.add('conflict-modal');
    $('#conflict-export').onclick=()=>{
      const notes=[];for(const c of conflict.conflicts)for(const side of ['base','local','remote'])if(c[side]!==null)notes.push({id:side+':'+c.path,path:side+'/'+c.path,content:c[side]});
      E.export({notes,folders:['base','local','remote']});
    };
    $('#conflict-form').onsubmit=async event=>{
      event.preventDefault();const chosen=E.snapshot(),id=record.id,submit=$('#conflict-form button[type=submit]');submit.disabled=true;
      for(const select of document.querySelectorAll('[data-conflict-index]')){
        const c=conflict.conflicts[Number(select.dataset.conflictIndex)],which=select.value;
        chosen.notes=chosen.notes.filter(n=>n.path!==c.path);
        const add=(path,content)=>{if(content!==null)chosen.notes.push({id:'n-'+crypto.randomUUID(),path,content,favorite:false,updated:now()});};
        if(which==='both'){
          add(c.path,c.remote);const ext=c.path.match(/\.(md|markdown)$/i)?.[0]||'.md',stem=c.path.slice(0,-ext.length);let path=stem+' (моя версия)'+ext,n=2;
          const occupied=path=>chosen.notes.some(x=>x.path.toLocaleLowerCase('ru')===path.toLocaleLowerCase('ru'))||chosen.folders.some(folder=>folder.toLocaleLowerCase('ru')===path.toLocaleLowerCase('ru')||folder.toLocaleLowerCase('ru').startsWith(path.toLocaleLowerCase('ru')+'/'));
          while(occupied(path))path=stem+' (моя версия '+n+++')'+ext;
          if(path.length>1024){$('#conflict-error').textContent='Для отдельной копии путь слишком длинный. Скачайте обе версии и выберите одну; вторую можно импортировать с более коротким именем.';submit.disabled=false;return;}
          add(path,c.local);
        }else add(c.path,which==='local'?c.local:c.remote);
      }
      if(conflict.kind==='local'){record=conflict.remoteRecord;lastSaved=clone(record.snapshot);localError=null;localConflict=null;}
      networkError='';applyData(chosen,{syncConflict:null});
      const metadata=conflict.kind==='remote'?{base:clone(conflict.remote)}:{};
      if(await save(E.snapshot(),false,metadata)){close();if(record.id===id&&record.kind==='github'&&hasToken())await sync();else E.toast('Выбранные версии сохранены локально');}
      else {$('#conflict-error').textContent=localError?.message||'Не удалось сохранить выбор.';submit.disabled=false;}
    };
  }
  async function start(editor){
    E=editor;home=window.OberonHome.mount($('#vault-home'),{onOpen:id=>void openVault(id),onConnect:connect,onManage:id=>void manage(id),onTheme:()=>E.toggleTheme()});
    document.addEventListener('click',event=>{
      const action=event.target.closest('[data-ws]');if(action){
        const name=action.dataset.ws;
        if(name==='close')close();else if(name==='home')void showHome();else if(name==='export')E.export(E.snapshot());else if(name==='authorize')authorize();
        else if(name==='sync'){close();void sync();}else if(name==='forget-token'){tokens.delete(record.id);network?.abort();networkError='';close();status();E.toast('Токен удалён из памяти страницы');}
      }
      const portal=event.target.closest('a[target="_top"]');if(portal&&new URL(portal.href).origin===location.origin){event.preventDefault();void flush().then(ok=>{if(ok)window.top.location.href=portal.href;});}
    });
    $('#modal').addEventListener('close',closeConnectionAttempt);
    window.addEventListener('beforeunload',event=>{if(pendingLocal||localError){event.preventDefault();event.returnValue='';}});
    window.addEventListener('online',()=>{if(record?.kind==='github'&&E.snapshot().autoSync){networkError='';scheduleSync();}});
    try{await S.ensureDemo({...E.defaults(),...clone(window.OBERON_SEED)});await refreshHome();document.title='OBERON — ваши пространства · AYYY';if(new URLSearchParams(location.search).get('demo')==='1')await openVault('demo');}
    catch(error){home.render([],{error:error.message});}
  }
  window.OberonWorkspace=Object.freeze({start,save,markPending,flush,home:showHome,connection:connectionDialog,sync,authorize,
    hasActive:()=>!!record,isGithub,activeId:()=>record?.id||null,
    delayDeletion:()=>{syncNotBefore=Date.now()+8000;},status});
})();
