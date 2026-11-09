import { useCallback, useEffect, useState } from 'react';
import { Cloud, ShieldCheck } from 'lucide-react';
import { api, appUrl, errorMessage } from '../lib/api';
import { useUnsavedGuard, type RegisterNavigationGuard } from '../lib/useUnsavedGuard';
import type { TreeSummary } from '../types';
import { Dialog } from './Dialog';

interface SyncStatus {
  state: string;
  message: string;
  pending: boolean;
  last_sync: string | null;
  last_commit: string | null;
  conflicts: string[];
  conflict_head?: string;
  conflict_archive?: string;
}
interface StorageStatus {
  local_saved_at: string;
  slug: string;
  gedcom: { state: string; message: string; generated_at: string | null };
  github: SyncStatus;
}
const labels: Record<string, string> = {
  disabled: 'GitHub не подключён',
  synced: 'GitHub: сохранено',
  pending: 'GitHub: ожидает отправки',
  syncing: 'GitHub: отправка',
  error: 'GitHub: нужен повтор',
  conflict: 'GitHub: конфликт',
};
function moment(value: string | null) {
  return value ? new Date(value).toLocaleString('ru-RU') : 'Ещё не было';
}

export function BackupControl({
  tree,
  onSaved,
  onNavigationGuard,
}: {
  tree: TreeSummary;
  onSaved: () => Promise<void>;
  onNavigationGuard?: RegisterNavigationGuard;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState(tree.slug || '');
  const load = useCallback(async () => {
    try {
      setStatus(await api<StorageStatus>(`/trees/${tree.id}/storage-status`));
      setLoadError('');
    } catch (cause) {
      setLoadError(errorMessage(cause));
    }
  }, [tree.id]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    setSlug(tree.slug || '');
  }, [tree.id, tree.slug]);
  const close = useUnsavedGuard(
    open && slug !== (tree.slug || ''),
    busy,
    () => setOpen(false),
    open ? onNavigationGuard : undefined,
  );
  async function action(path: string, body?: object) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
      await onSaved();
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  const github = status?.github;
  return (
    <>
      <button
        className={`button secondary backup-status backup-${github?.state || 'pending'}`}
        title="Резервные копии и состояние сохранения"
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        <Cloud size={17} />
        <span>{github ? labels[github.state] || github.message : 'Резервные копии'}</span>
      </button>
      {open && (
        <Dialog title="Резервные копии и восстановление" onClose={close} wide>
          <div className="dialog-form backup-panel">
            {(error || loadError) && (
              <p role="alert" className="error-banner">
                {error || loadError}
              </p>
            )}
            <section>
              <h3>
                <ShieldCheck size={18} /> Локальная копия
              </h3>
              <p>Последнее сохранение: {moment(status?.local_saved_at || tree.updated_at)}</p>
              <p>Актуальный GEDCOM: {status?.gedcom.message || 'Проверяем…'}</p>
              <p>Обновлён: {moment(status?.gedcom.generated_at || null)}</p>
              <div className="actions">
                {[
                  ['backup.zip', 'Полный ZIP'],
                  ['tree.json', 'JSON'],
                  ['export.ged', 'GEDCOM'],
                ].map(([file, label]) => (
                  <a
                    key={file}
                    className="button secondary"
                    href={appUrl(`/api/trees/${tree.id}/${file}`)}
                    download
                  >
                    {label}
                  </a>
                ))}
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void action(`/trees/${tree.id}/regenerate-gedcom`)}
                >
                  Обновить GEDCOM
                </button>
              </div>
            </section>
            <section>
              <h3>Копия в GitHub</h3>
              <p role="status">{github?.message || 'Проверяем…'}</p>
              <p>Последняя синхронизация: {moment(github?.last_sync || null)}</p>
              <p>
                Коммит: <code>{github?.last_commit || 'Ещё не было'}</code>
              </p>
              <p>
                {github?.pending
                  ? 'Есть изменения, ожидающие отправки.'
                  : 'Изменений в очереди нет.'}
              </p>
              <button
                type="button"
                className="button primary"
                disabled={
                  busy || !github || github.state === 'disabled' || github.state === 'syncing'
                }
                onClick={() => void action('/sync')}
              >
                {github?.state === 'error' ? 'Повторить синхронизацию' : 'Синхронизировать сейчас'}
              </button>
              {github?.state === 'disabled' && (
                <p>
                  Подключение репозитория настраивается на сервере. Ключи доступа не сохраняются в
                  браузере.
                </p>
              )}
              {github?.state === 'conflict' && (
                <div className="draft-banner">
                  <p>Обе версии сохранены. Скачайте их и сравните перед выбором.</p>
                  <a className="button secondary" href={appUrl('/api/sync/conflicts.zip')} download>
                    Скачать обе версии
                  </a>
                  <ul>
                    {github.conflicts.map((path) => (
                      <li key={path}>
                        <code>{path}</code>
                      </li>
                    ))}
                  </ul>
                  {(['local', 'remote'] as const).map((strategy) => (
                    <button
                      type="button"
                      className="button secondary"
                      key={strategy}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Для конфликтующих файлов выбрать ${strategy === 'local' ? 'локальную версию' : 'версию GitHub'}? Обе версии останутся в архиве.`,
                          )
                        )
                          void action('/sync/resolve', {
                            strategy,
                            expected_head: github.conflict_head,
                          });
                      }}
                    >
                      {strategy === 'local' ? 'Выбрать локальную версию' : 'Выбрать версию GitHub'}
                    </button>
                  ))}
                </div>
              )}
            </section>
            <details>
              <summary>Папка дерева и диагностика</summary>
              <p>
                Идентификатор: <code>{tree.id}</code>
              </p>
              <label className="field">
                Постоянное имя папки
                <input
                  value={slug}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={100}
                  onChange={(event) => setSlug(event.target.value)}
                />
              </label>
              <p>
                Название дерева можно менять отдельно. Переименование папки сохраняет все связи и
                ссылки на карточки.
              </p>
              <button
                type="button"
                className="button secondary"
                disabled={
                  busy || slug === (tree.slug || '') || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
                }
                onClick={() =>
                  void action(`/trees/${tree.id}/rename-directory`, {
                    slug,
                    revision: tree.revision,
                  })
                }
              >
                Переименовать папку
              </button>
              <pre>{JSON.stringify(status, null, 2)}</pre>
            </details>
            <p>
              ZIP содержит данные, фотографии, исходный GEDCOM и инструкцию восстановления. JSON —
              основной документ дерева.
            </p>
            <footer className="dialog-footer">
              <button type="button" className="button secondary" disabled={busy} onClick={close}>
                Закрыть
              </button>
            </footer>
          </div>
        </Dialog>
      )}
    </>
  );
}
