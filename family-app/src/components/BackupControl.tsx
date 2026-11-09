import {useCallback,useEffect,useState} from 'react';
import {Cloud,CloudUpload,Download,KeyRound,LockKeyhole,ShieldCheck} from 'lucide-react';
import {appUrl} from '../lib/api';
import {
  disconnectToken,hasSessionToken,parseRepo,pushToGitHub,setSessionToken
} from '../lib/githubSync';
import {getSync,type SyncRecord} from '../lib/browserStore';
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
  const load=useCallback(async()=>{
    try {
      const link=await getSync(tree.id);
      setRecord(link);
      if(link){setRepository(link.owner+'/'+link.repo);setBranch(link.branch);}
    }catch(cause){setError(cause instanceof Error?cause.message:'Не удалось прочитать параметры GitHub.');}
  },[tree.id]);
  useEffect(()=>{void load();},[load,tree.updated_at]);
  const pending=Boolean(record && record.lastLocalSavedAt!==tree.updated_at);
  const state=!record?'Локальное дерево':pending?'GitHub: есть новые изменения':'GitHub: синхронизировано';

  function connect() {
    if(!token.trim())return;
    setSessionToken(token);
    setToken('');
    setConnected(true);
    setMessage('Ключ подключён до закрытия вкладки.');
  }

  async function sync() {
    setError('');setMessage('');setBusy(true);
    try {
      if(token.trim())connect();
      const repo=parseRepo(repository,branch);
      const result=await pushToGitHub(tree.id,repo);
      await load();
      await onSaved();
      setMessage(result.pending
        ?'Версия отправлена в GitHub, но в браузере уже появились новые правки. Повторите отправку.'
        :'Дерево и фотографии сохранены в приватном GitHub-репозитории.');
    }catch(cause){setError(cause instanceof Error?cause.message:'Не удалось сохранить данные в GitHub.');}
    finally{setBusy(false);}
  }

  return <>
    <button className="button secondary backup-status" onClick={()=>{setOpen(true);void load();}}>
      <Cloud size={17}/><span>{state}</span>
    </button>
    {open && <Dialog title="Хранение семейного архива" onClose={()=>setOpen(false)} wide>
      <div className="dialog-form backup-panel">
        <section>
          <h3><ShieldCheck size={18}/> Локальное хранилище</h3>
          <p>Дерево хранится в IndexedDB этого браузера. Последнее изменение: {when(tree.updated_at)}.</p>
          <div className="actions">
            <a className="button secondary" download href={appUrl('/api/trees/'+tree.id+'/tree.json')}>
              <Download size={15}/> JSON
            </a>
            <a className="button secondary" download href={appUrl('/api/trees/'+tree.id+'/backup.zip')}>
              <Download size={15}/> ZIP с фотографиями
            </a>
          </div>
          <p className="field-hint">Экспорт GEDCOM переносится в браузерную версию и пока недоступен.</p>
        </section>
        <section>
          <h3><Cloud size={18}/> Личный GitHub</h3>
          <p>Для синхронизации используется только приватный репозиторий.
            При конфликте или наличии чужого дерева запись блокируется, а не перезаписывается.</p>
          <label className="field">
            Репозиторий
            <input value={repository} onChange={e=>setRepository(e.target.value)}
              placeholder="username/family-archive" autoComplete="off" disabled={Boolean(record)}/>
          </label>
          <label className="field">
            Ветка
            <input value={branch} onChange={e=>setBranch(e.target.value)}
              placeholder="main" autoComplete="off" disabled={Boolean(record)}/>
          </label>
          <label className="field">
            <span><KeyRound size={15}/> GitHub personal access token</span>
            <input type="password" value={token} onChange={e=>setToken(e.target.value)}
              placeholder={connected?'Ключ подключён на время вкладки':'Токен Contents: Read and write'}
              autoComplete="off"/>
          </label>
          <p className="field-hint"><LockKeyhole size={13}/> Токен остаётся только в памяти вкладки.
            Он не попадает в GitHub-коммиты, localStorage, IndexedDB или резервные копии.</p>
          <div className="actions">
            <button type="button" className="button secondary" onClick={connect}
              disabled={!token.trim()||busy}>Подключить ключ</button>
            {connected && <button type="button" className="button secondary" onClick={()=>{
              disconnectToken();setConnected(false);setMessage('Ключ отключён.');}}>Отключить ключ</button>}
            <button type="button" className="button primary" onClick={()=>void sync()}
              disabled={busy||!repository.trim()||(!connected&&!token.trim())}>
              <CloudUpload size={17}/> {busy?'Отправляем…':'Синхронизировать'}
            </button>
          </div>
          {record && <>
            <p>Последняя синхронизация: {when(record.lastSync)}.
              {pending?' Есть несинхронизированные изменения.':' Версии совпадают.'}</p>
            <p>Коммит: <code>{record.lastCommit||'неизвестен'}</code></p>
            <a href={'https://github.com/'+record.owner+'/'+record.repo} target="_blank"
              rel="noopener noreferrer">Открыть репозиторий GitHub</a>
          </>}
          {error && <p role="alert" className="error-banner">{error}</p>}
          {message && <p role="status" className="field-hint">{message}</p>}
        </section>
        <footer className="dialog-footer">
          <button className="button secondary" onClick={()=>setOpen(false)}>Закрыть</button>
        </footer>
      </div>
    </Dialog>}
  </>;
}
