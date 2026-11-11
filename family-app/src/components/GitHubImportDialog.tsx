import {useState} from 'react';
import {setAutoSync} from '../lib/browserStore';
import {CloudDownload,KeyRound,LockKeyhole} from 'lucide-react';
import type {TreeSummary} from '../types';
import {Dialog} from './Dialog';
import {
  hasSessionToken,listRemoteTrees,parseRepo,restoreFromGitHub,setSessionToken
} from '../lib/githubSync';

export function GitHubImportDialog({
  onClose,onImported
}:{
  onClose:()=>void;
  onImported:(tree:TreeSummary)=>Promise<void>;
}) {
  const [repository,setRepository]=useState('');
  const [branch,setBranch]=useState('main');
  const [token,setToken]=useState('');
  const [options,setOptions]=useState<string[]>([]);
  const [chosen,setChosen]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [authenticated,setAuthenticated]=useState(hasSessionToken());
  const [autoSync,setAutoSyncEnabled]=useState(true);
  async function discover(event:React.FormEvent) {
    event.preventDefault();
    setBusy(true);setError('');
    try {
      if(token.trim()){setSessionToken(token);setToken('');setAuthenticated(true);}
      const list=await listRemoteTrees(parseRepo(repository,branch));
      setOptions(list);setChosen(list[0] || '');
      if(!list.length)setError('В репозитории нет семейных деревьев в family-data/trees/.');
    }catch(cause){setError(cause instanceof Error?cause.message:'Не удалось прочитать GitHub.');}
    finally{setBusy(false);}
  }
  async function restore() {
    if(!chosen)return;
    setBusy(true);setError('');
    try {
      const doc=await restoreFromGitHub(parseRepo(repository,branch),chosen);
      if(autoSync)await setAutoSync(doc.tree.id,true);
      await onImported({...doc.tree,person_count:doc.persons.length,family_count:doc.families.length});
    }catch(cause){setError(cause instanceof Error?cause.message:'Не удалось загрузить дерево.');}
    finally{setBusy(false);}
  }
  return (
    <Dialog title="Открыть дерево из GitHub" onClose={onClose} wide>
      <form className="dialog-form" onSubmit={discover}>
        <p className="form-description">
          Дерево и фотографии будут загружены из вашего приватного репозитория
          в локальное хранилище браузера. Данные не передаются на сервер AYYY.
        </p>
        <label className="field">
          Репозиторий GitHub
          <input required value={repository} onChange={event=>setRepository(event.target.value)}
            placeholder="username/family-archive" autoComplete="off" />
        </label>
        <label className="field">
          Ветка
          <input required value={branch} onChange={event=>setBranch(event.target.value)}
            placeholder="main" autoComplete="off" />
        </label>
        <label className="field">
          <span><KeyRound size={15}/> GitHub personal access token</span>
          <input type="password" value={token} onChange={event=>setToken(event.target.value)}
            placeholder={authenticated?'Ключ подключён на время вкладки':'Токен с Contents: Read and write'}
            autoComplete="off" />
        </label>
        <p className="field-hint">GitHub fine-grained token: Repository access → Only select repositories → выберите приватный репозиторий. Repository permissions → Contents → Read and write для синхронизации (для одного только чтения достаточно Read-only); Metadata → Read-only (автоматически). Другие разрешения не нужны. Нажмите Generate token. Запись разрешена во весь выбранный репозиторий. <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Создать fine-grained token ↗</a></p>
        <p className="field-hint">
          <LockKeyhole size={13}/> Только приватный репозиторий. Токен остаётся в памяти вкладки
          и не записывается в файлы или браузерное хранилище.
        </p>
        <button type="submit" className="button secondary" disabled={busy || !repository.trim()}>
          {busy?'Проверяем GitHub…':'Найти семейные деревья'}
        </button>
        {options.length>0 && (
          <label className="field">
            Дерево
            <select value={chosen} onChange={event=>setChosen(event.target.value)}>
              {options.map(slug=><option key={slug} value={slug}>{slug}</option>)}
            </select>
          </label>
        )}
        <label className="checkbox-label gen-storage-auto">
          <input type="checkbox" checked={autoSync} disabled={busy}
            onChange={event=>setAutoSyncEnabled(event.target.checked)}/>
          <span><strong>Включить автоматическую синхронизацию</strong>
            <small>При открытии проверять свежую версию; после правок отправлять через ~22 секунды</small></span>
        </label>
        <p className="field-hint">Токен хранится только в памяти текущей вкладки. После повторного входа потребуется ввести его снова.</p>
        {error && <p role="alert" className="error-banner">{error}</p>}
        <footer className="dialog-footer">
          <button className="button secondary" type="button" onClick={onClose}>Отмена</button>
          <button type="button" className="button primary" disabled={busy || !chosen}
            onClick={()=>void restore()}>
            <CloudDownload size={17}/> {busy?'Загружаем…':'Открыть дерево'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
