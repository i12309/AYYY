import {useCallback,useEffect,useState} from 'react';
import {
  AlertTriangle,Cloud,CloudUpload,Download,KeyRound,LockKeyhole,
  ShieldCheck,GitCompareArrows,CheckCircle2
} from 'lucide-react';
import {appUrl} from '../lib/api';
import {
  disconnectToken,hasSessionToken,parseRepo,pushToGitHub,setSessionToken,
  previewGitHubConflict,resolveGitHubConflict,verifyGitHubConnection,
  type GitHubConflictPreview
} from '../lib/githubSync';
import {getSync,type SyncRecord} from '../lib/browserStore';
import type {MergeChoice,Side} from '../lib/browserMerge';
import type {TreeSummary} from '../types';
import type {RegisterNavigationGuard} from '../lib/useUnsavedGuard';
import {Dialog} from './Dialog';

const when=(value?:string)=>value?new Date(value).toLocaleString('ru-RU'):'Ещё не было';

export function BackupControl({
  tree,onSaved
}:{
  tree:TreeSummary;
  onSaved:()=>Promise<void>;
  onNavigationGuard?:RegisterNavigationGuard;
}) {
  const [open,setOpen]=useState(false);
  const [record,setRecord]=useState<SyncRecord|null>(null);
  const [repository,setRepository]=useState('');
  const [branch,setBranch]=useState('main');
  const [token,setToken]=useState('');
  const [connected,setConnected]=useState(hasSessionToken());
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [preview,setPreview]=useState<GitHubConflictPreview|null>(null);
  const [choices,setChoices]=useState<MergeChoice>({});
  const [confirmed,setConfirmed]=useState(false);
  const [permission,setPermission]=useState('');

  const load=useCallback(async()=>{
    try{
      const link=await getSync(tree.id);
      setRecord(link);
      if(link){setRepository(link.owner+'/'+link.repo);setBranch(link.branch);}
    }catch(cause){setError(cause instanceof Error?cause.message:'Не удалось прочитать параметры GitHub.');}
  },[tree.id]);
  useEffect(()=>{void load();},[load,tree.updated_at]);
  const pending=Boolean(record && record.lastLocalSavedAt!==tree.updated_at);
  const state=preview?'GitHub: конфликт'
    :!record?'Локальное дерево':pending?'GitHub: есть новые изменения':'GitHub: синхронизировано';

  function connect():void{
    if(!token.trim())return;
    setSessionToken(token);
    setToken('');
    setConnected(true);
  }

  async function checkAccess(){
    setBusy(true);setError('');setPermission('');
    try{
      if(token.trim())connect();
      const repo=parseRepo(repository,branch);
      const result=await verifyGitHubConnection(repo,true);
      setPermission('Проверено: '+result.repository+' · ветка '+result.branch+
        ' · приватный репозиторий · чтение и запись разрешены.');
    }catch(cause){setError(cause instanceof Error?cause.message:'Не удалось проверить токен.');}
    finally{setBusy(false);}
  }
  async function openComparison(){
    setBusy(true);setError('');setMessage('');
    try{
      if(token.trim())connect();
      const p=await previewGitHubConflict(tree.id,parseRepo(repository,branch));
      setPreview(p);setChoices({});setConfirmed(false);
      if(!p.conflicts.length)
        setMessage('Изменения затрагивают разные поля. Можно объединить их автоматически.');
    }catch(cause){setError(cause instanceof Error?cause.message:'Не удалось сравнить версии.');}
    finally{setBusy(false);}
  }
  async function sync(){
    setError('');setMessage('');setBusy(true);
    try{
      if(token.trim())connect();
      const repo=parseRepo(repository,branch);
      const result=await pushToGitHub(tree.id,repo);
      setPreview(null);
      await load();await onSaved();
      setMessage(result.pending
        ?'Версия отправлена, но в браузере появились новые правки. Повторите синхронизацию.'
        :'Дерево, GEDCOM и фотографии сохранены в приватном репозитории.');
    }catch(cause){
      const failure=cause instanceof Error?cause.message:'Не удалось сохранить данные в GitHub.';
      setError(failure);
      if(/Конфликт|изменилась с последней синхронизации/.test(failure)){
        try{
          const p=await previewGitHubConflict(tree.id,parseRepo(repository,branch));
          setPreview(p);setChoices({});setConfirmed(false);
        }catch{/* Original conflict remains visible, local data untouched. */}
      }
    }finally{setBusy(false);}
  }
  async function resolve(){
    if(!preview||!confirmed)return;
    setError('');setMessage('');setBusy(true);
    try{
      const result=await resolveGitHubConflict(preview,choices);
      setPreview(null);setConfirmed(false);setChoices({});
      await load();await onSaved();
      setMessage(result.pending
        ?'Объединение отправлено в GitHub. Во время отправки появились новые локальные изменения: они сохранены, повторите синхронизацию.'
        :'Изменения объединены и сохранены в GitHub. Локальная копия обновлена.');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Не удалось объединить версии. Исходные копии сохранены.');
    }finally{setBusy(false);}
  }
  const selected=preview?.conflicts.filter(item=>choices[item.id]).length||0;
  function chooseAll(side:Side){
    if(!preview)return;
    setChoices(Object.fromEntries(preview.conflicts.map(item=>[item.id,side])));
  }

  return <>
    <button className="button secondary backup-status" onClick={()=>{setOpen(true);void load();}}>
      <Cloud size={17}/><span>{state}</span>
    </button>
    {open && <Dialog title="Хранение семейного архива" onClose={()=>{if(!busy)setOpen(false);}} wide>
      <div className="dialog-form backup-panel">
        <section>
          <h3><ShieldCheck size={18}/> Локальная копия и резервный архив</h3>
          <p>Дерево хранится в IndexedDB этого браузера. Последнее изменение: {when(tree.updated_at)}.</p>
          <div className="actions backup-downloads">
            <a className="button secondary" download href={appUrl('/api/trees/'+tree.id+'/tree.json')}>
              <Download size={15}/> JSON
            </a>
            <a className="button secondary" download href={appUrl('/api/trees/'+tree.id+'/backup.zip')}>
              <Download size={15}/> Полный ZIP с фотографиями
            </a>
            <a className="button secondary" download href={appUrl('/api/trees/'+tree.id+'/export.ged')}>
              <Download size={15}/> GEDCOM
            </a>
          </div>
          <p className="field-hint">ZIP можно затем импортировать в GEN на другом устройстве.
            Скачивайте копию перед разрешением конфликтов.</p>
        </section>
        <section>
          <h3><Cloud size={18}/> Личный приватный GitHub</h3>
          <p>Данные отправляются напрямую в выбранный репозиторий только по вашей команде.
            Никаких принудительных перезаписей или передачи файлов на сервер AYYY.</p>
          <label className="field">Репозиторий
            <input value={repository} onChange={e=>{setRepository(e.target.value);setPermission('');}}
              placeholder="username/family-archive" autoComplete="off" disabled={Boolean(record)||busy}/>
          </label>
          <label className="field">Ветка
            <input value={branch} onChange={e=>{setBranch(e.target.value);setPermission('');}}
              placeholder="main" autoComplete="off" disabled={Boolean(record)||busy}/>
          </label>
          <label className="field">
            <span><KeyRound size={15}/> GitHub personal access token</span>
            <input type="password" value={token} onChange={e=>setToken(e.target.value)}
              placeholder={connected?'Токен подключён на время вкладки':'Fine-grained PAT · Contents: Read and write'}
              autoComplete="off" disabled={busy}/>
          </label>
          <p className="field-hint"><LockKeyhole size={13}/> Токен остаётся только в памяти вкладки,
            не попадает в IndexedDB, localStorage, отчёты или GitHub-коммиты.</p>
          <div className="actions backup-actions">
            <button type="button" className="button secondary" onClick={()=>void checkAccess()}
              disabled={busy||!repository.trim()||(!connected&&!token.trim())}>
              <CheckCircle2 size={15}/> Проверить подключение и запись
            </button>
            {connected && <button type="button" className="button secondary" onClick={()=>{
              disconnectToken();setConnected(false);setPermission('');setMessage('Токен отключён.');
            }}>Отключить токен</button>}
            <button type="button" className="button primary" onClick={()=>void sync()}
              disabled={busy||!repository.trim()||(!connected&&!token.trim())}>
              <CloudUpload size={17}/> {busy?'Выполняется…':'Синхронизировать'}
            </button>
          </div>
          {permission && <p role="status" className="field-hint">{permission}</p>}
          {record && <>
            <p>Последняя синхронизация: {when(record.lastSync)}.
              {pending?' Есть локальные правки.':' Версии были синхронизированы.'}</p>
            <p>Коммит: <code>{record.lastCommit||'неизвестен'}</code></p>
            <div className="actions">
              <button type="button" className="button secondary" onClick={()=>void openComparison()}
                disabled={busy||!connected}><GitCompareArrows size={16}/> Сравнить с GitHub</button>
              <a href={'https://github.com/'+record.owner+'/'+record.repo} target="_blank"
                rel="noopener noreferrer">Открыть репозиторий GitHub</a>
            </div>
          </>}
        </section>
        {preview && <section className="gen-conflict-review" aria-labelledby="merge-title">
          <h3 id="merge-title"><AlertTriangle size={18}/> Сравнение локальной версии и GitHub</h3>
          <p>GEN сохранил обе исходные версии. Независимые изменения: {preview.autoChanges}.
            Спорных изменений: {preview.conflicts.length}.
            Перед продолжением скачайте ZIP локального дерева.</p>
          {preview.conflicts.length>0 && <>
            <div className="actions">
              <button type="button" className="button secondary" disabled={busy}
                onClick={()=>chooseAll('local')}>Выбрать все локальные</button>
              <button type="button" className="button secondary" disabled={busy}
                onClick={()=>chooseAll('remote')}>Выбрать все из GitHub</button>
            </div>
            <div className="gen-conflict-list">
              {preview.conflicts.map(item=><div className="gen-conflict-item" key={item.id}>
                <div><strong>{item.label}</strong> <small>{item.field}</small></div>
                <div className="gen-conflict-versions">
                  <div><span>В браузере</span><p>{item.local}</p></div>
                  <div><span>В GitHub</span><p>{item.remote}</p></div>
                </div>
                <label className="field">
                  Версия для сохранения
                  <select value={choices[item.id]||''} disabled={busy}
                    onChange={event=>setChoices(prev=>({...prev,[item.id]:event.target.value as Side}))}>
                    <option value="">Выберите версию</option>
                    <option value="local">Оставить локальную</option>
                    <option value="remote">Взять из GitHub</option>
                  </select>
                </label>
              </div>)}
            </div>
            <p className="field-hint">Выбрано: {selected} из {preview.conflicts.length}. Незаполненные решения блокируют объединение.</p>
          </>}
          <label className="checkbox-label">
            <input type="checkbox" checked={confirmed} disabled={busy}
              onChange={e=>setConfirmed(e.target.checked)}/>
            Я сохранил локальную резервную копию ZIP и проверил выбор версий.
          </label>
          <div className="actions">
            <button type="button" className="button secondary" onClick={()=>{setPreview(null);setError('');}}
              disabled={busy}>Отменить сравнение</button>
            <button type="button" className="button primary" disabled={busy||!confirmed||
              selected!==(preview.conflicts.length)||!connected}
              onClick={()=>void resolve()}>
              <GitCompareArrows size={16}/> {busy?'Объединяем…':'Объединить и сохранить'}
            </button>
          </div>
        </section>}
        {error && <p role="alert" className="error-banner">{error}</p>}
        {message && <p role="status" className="field-hint">{message}</p>}
        <footer className="dialog-footer">
          <button className="button secondary" disabled={busy} onClick={()=>setOpen(false)}>Закрыть</button>
        </footer>
      </div>
    </Dialog>}
  </>;
}
