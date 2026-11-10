/**
 * Explicit opt-in, in-tab GitHub auto synchronization.
 *
 * Every edit is committed locally first. The remote push is debounced, never
 * force-pushes, and is paused on conflicts or missing credentials. Timers are
 * best effort while the page is open; no service worker holds a bearer token.
 */
import {getSync,listAutoSyncedTrees,readTree} from './browserStore';
import {
  checkAndPullGitHub,hasSessionToken,pushToGitHub,
  type RemoteRepo
} from './githubSync';

export type AutoStatusKind=
  'off'|'waiting-token'|'queued'|'checking'|'saving'|'synced'|
  'updated'|'conflict'|'offline'|'error';

export type AutoStatus={
  kind:AutoStatusKind;
  message:string;
  treeId:string;
};

const SAVE_DELAY_MS=22000;
const CHECK_AGAIN_MS=60000;
const MAX_RETRY_MS=300000;
const states=new Map<string,AutoStatus>();
const timers=new Map<string,number>();
const inFlight=new Set<string>();
const failures=new Map<string,number>();
let started=false;
let currentTree:string|null=null;
const lastCheck=new Map<string,number>();

function emit(treeId:string,kind:AutoStatusKind,message:string){
  const item:AutoStatus={treeId,kind,message};
  states.set(treeId,item);
  window.dispatchEvent(new CustomEvent<AutoStatus>('gen:auto-status',{detail:item}));
}
export function autoSyncStatus(treeId:string):AutoStatus{
  return states.get(treeId)||{treeId,kind:'off',message:'Сохранение только в браузере'};
}
function clear(treeId:string){
  const timer=timers.get(treeId);
  if(timer!==undefined)window.clearTimeout(timer);
  timers.delete(treeId);
}
export async function queueAutoSync(treeId:string,delay=SAVE_DELAY_MS):Promise<void>{
  if(!started)return;
  clear(treeId);
  const link=await getSync(treeId);
  if(!link?.autoSync){
    emit(treeId,'off','Автосинхронизация отключена');
    return;
  }
  if(!hasSessionToken()){
    emit(treeId,'waiting-token','Для синхронизации введите токен GitHub');
    return;
  }
  if(!navigator.onLine){
    emit(treeId,'offline','Нет сети. Дерево сохранено локально.');
    return;
  }
  const document=await readTree(treeId);
  if(link.blobSha && document.tree.updated_at===link.lastLocalSavedAt){
    if(!['conflict','updated'].includes(states.get(treeId)?.kind||'')){
      emit(treeId,'synced','Все изменения сохранены в GitHub');
    }
    return;
  }
  if(states.get(treeId)?.kind==='conflict')return;
  emit(treeId,'queued','Локально сохранено. Отправка в GitHub после паузы.');
  timers.set(treeId,window.setTimeout(()=>{timers.delete(treeId);void pushScheduled(treeId);},delay));
}
async function pushScheduled(treeId:string):Promise<void>{
  if(inFlight.has(treeId)){
    await queueAutoSync(treeId,SAVE_DELAY_MS);
    return;
  }
  inFlight.add(treeId);
  try{
    const link=await getSync(treeId);
    if(!link?.autoSync)return;
    if(!hasSessionToken()){
      emit(treeId,'waiting-token','Токен GitHub не подключён; правки сохранены локально.');
      return;
    }
    if(!navigator.onLine){
      emit(treeId,'offline','Ожидаем интернет. Локальные данные сохранены.');
      return;
    }
    emit(treeId,'saving','Сохраняем дерево в приватный GitHub…');
    const repo:RemoteRepo={owner:link.owner,repo:link.repo,branch:link.branch};
    const result=await pushToGitHub(treeId,repo);
    failures.delete(treeId);
    emit(treeId,result.pending?'queued':'synced',
      result.pending?'Есть новые локальные изменения, отправим их следом.':'Сохранено в GitHub');
  }catch(error){
    const reason=error instanceof Error?error.message:'Не удалось синхронизировать GitHub.';
    if(/Конфликт|изменилась|перезапис|другой|не совпада|удалённ|уже есть дерево/i.test(reason)){
      emit(treeId,'conflict','Обнаружен конфликт версий. Выберите «Сравнить с GitHub».');
    }else if(/токен|401|403|прав|разрешени|доступ/i.test(reason)){
      emit(treeId,'waiting-token','Проверьте токен и права GitHub: '+reason);
    }else if(!navigator.onLine){
      emit(treeId,'offline','Нет подключения. Изменения остаются в браузере.');
    }else{
      emit(treeId,'error','Синхронизация не удалась: '+reason);
      const count=Math.min(4,(failures.get(treeId)||0)+1);
      failures.set(treeId,count);
      const delay=Math.min(MAX_RETRY_MS,30000*2**(count-1));
      // A network error never drops the pending work.
      timers.set(treeId,window.setTimeout(()=>{timers.delete(treeId);void pushScheduled(treeId);},delay));
    }
  }finally{
    inFlight.delete(treeId);
    const link=await getSync(treeId).catch(()=>null);
    if(link?.autoSync&&hasSessionToken()&&
       !['conflict','error','waiting-token','offline'].includes(states.get(treeId)?.kind||'')){
      const latest=await readTree(treeId).catch(()=>null);
      if(latest && latest.tree.updated_at!==link.lastLocalSavedAt){
        void queueAutoSync(treeId,SAVE_DELAY_MS);
      }
    }
  }
}

export function autoSyncSetActiveTree(treeId:string|null):void{
  currentTree=treeId;
}

export async function autoSyncOpened(treeId:string,force=false):Promise<void>{
  currentTree=treeId;
  if(!started)return;
  const link=await getSync(treeId);
  if(!link?.autoSync)return;
  if(!hasSessionToken()){
    emit(treeId,'waiting-token','GitHub подключён, но токен нужно ввести снова.');
    return;
  }
  if(!navigator.onLine){
    emit(treeId,'offline','Нет сети. Работаем с локальной копией.');
    return;
  }
  const stamp=Date.now();
  if(!force && stamp-(lastCheck.get(treeId)||0)<CHECK_AGAIN_MS)return;
  if(inFlight.has(treeId))return;
  lastCheck.set(treeId,stamp);
  inFlight.add(treeId);
  clear(treeId);
  try{
    emit(treeId,'checking','Проверяем изменения GitHub…');
    const result=await checkAndPullGitHub(treeId);
    switch(result){
      case 'updated':
        emit(treeId,'updated','Из GitHub загружена новая версия дерева.');
        break;
      case 'conflict':
      case 'missing':
        emit(treeId,'conflict','Версии различаются. Требуется сравнение перед сохранением.');
        break;
      case 'pending-local':
        emit(treeId,'queued','Локальные изменения ожидают отправки в GitHub.');
        break;
      case 'interrupted':
        emit(treeId,'queued','Дерево изменилось при проверке; повторим синхронизацию.');
        break;
      default:
        emit(treeId,'synced','Версия GitHub актуальна.');
    }
  }catch(error){
    const message=error instanceof Error?error.message:'Не удалось проверить GitHub.';
    if(/токен|доступ|разрешени|401|403/i.test(message))
      emit(treeId,'waiting-token','Проверьте доступ GitHub: '+message);
    else
      emit(treeId,'error','GitHub недоступен: '+message);
  }finally{
    inFlight.delete(treeId);
    const status=states.get(treeId)?.kind;
    if(status==='queued'||status==='updated'){
      // Reloading the current snapshot may have left a newer local edit.
      void queueAutoSync(treeId,SAVE_DELAY_MS);
    }
  }
}

async function onTokenOrNetwork(){
  if(!started)return;
  const ids=await listAutoSyncedTrees().catch(()=>[]);
  for(const id of ids){
    if(id===currentTree)void autoSyncOpened(id,true);
    else void queueAutoSync(id);
  }
}
function onLocalChange(event:Event){
  const id=(event as CustomEvent<{treeId:string}>).detail?.treeId;
  if(id)void queueAutoSync(id);
}
function onSettingsChanged(event:Event){
  const id=(event as CustomEvent<{treeId:string}>).detail?.treeId;
  if(!id)return;
  states.delete(id);
  void queueAutoSync(id);
}
function onFocus(){
  if(document.visibilityState==='visible'&&currentTree){
    void autoSyncOpened(currentTree);
  }
}

/** Mounted once by App. No credentials are persisted in this manager. */
export function startAutoSync():()=>void{
  if(started)return ()=>{};
  started=true;
  window.addEventListener('gen:tree-saved',onLocalChange);
  window.addEventListener('gen:sync-settings',onSettingsChanged);
  window.addEventListener('gen:token-changed',onTokenOrNetwork);
  window.addEventListener('online',onTokenOrNetwork);
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onFocus);
  void onTokenOrNetwork();
  return ()=>{
    started=false;currentTree=null;
    window.removeEventListener('gen:tree-saved',onLocalChange);
    window.removeEventListener('gen:sync-settings',onSettingsChanged);
    window.removeEventListener('gen:token-changed',onTokenOrNetwork);
    window.removeEventListener('online',onTokenOrNetwork);
    window.removeEventListener('focus',onFocus);
    document.removeEventListener('visibilitychange',onFocus);
    for(const id of timers.keys())clear(id);
  };
}
