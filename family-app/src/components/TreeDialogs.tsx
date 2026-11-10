import { useState } from 'react';
import type { FormEvent } from 'react';
import { FileUp, FolderHeart } from 'lucide-react';
import type { TreeSummary } from '../types';
import { api, errorMessage } from '../lib/api';
import { Dialog } from './Dialog';
import { useUnsavedGuard, type RegisterNavigationGuard } from '../lib/useUnsavedGuard';

export function TreeDialog({
  tree,
  onClose,
  onSaved,
  onNavigationGuard,
}: {
  tree?: TreeSummary;
  onClose: () => void;
  onSaved: (tree: TreeSummary) => Promise<void>;
  onNavigationGuard?: RegisterNavigationGuard;
}) {
  const [name, setName] = useState(tree?.name || '');
  const [description, setDescription] = useState(tree?.description || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Укажите название дерева');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await api<TreeSummary>(tree ? `/trees/${tree.id}` : '/trees', {
        method: tree ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          ...(tree ? { revision: tree.revision } : {}),
        }),
      });
      await onSaved(saved);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const close = useUnsavedGuard(
    name !== (tree?.name || '') || description !== (tree?.description || ''),
    busy,
    onClose,
    onNavigationGuard,
  );
  return (
    <Dialog title={tree ? 'Название дерева' : 'Новое семейное дерево'} onClose={close}>
      <form onSubmit={submit} className="dialog-form">
        <span className="form-emblem">
          <FolderHeart size={28} />
        </span>
        <label className="field">
          Название
          <input
            value={name}
            maxLength={150}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, семья Волковых"
            autoFocus
            required
          />
        </label>
        <label className="field">
          Описание <span className="optional">необязательно</span>
          <textarea
            value={description}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Какие ветви семьи вы исследуете?"
          />
        </label>
        {error && (
          <div role="alert" className="error-banner">
            {error}
          </div>
        )}
        <footer className="dialog-footer">
          <button type="button" className="button secondary" onClick={close} disabled={busy}>
            Отмена
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Сохраняем…' : tree ? 'Сохранить' : 'Создать дерево'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

export function ImportDialog({
  onClose,
  onImported,
  onNavigationGuard,
}: {
  onClose: () => void;
  onImported: (tree: TreeSummary, warnings: string[]) => Promise<void>;
  onNavigationGuard?: RegisterNavigationGuard;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [encoding, setEncoding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Выберите GEDCOM или документ GEN в формате JSON');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('Размер файла должен быть не больше 25 МБ');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    if (name.trim()) body.append('name', name.trim());
    if (encoding && /\.(ged|gedcom)$/i.test(file.name)) body.append('encoding', encoding);
    setBusy(true);
    setError('');
    try {
      const result = await api<{ tree: TreeSummary; warnings: string[] }>('/trees/import', {
        method: 'POST',
        body,
      });
      await onImported(result.tree, result.warnings);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const close = useUnsavedGuard(
    Boolean(file || name || encoding),
    busy,
    onClose,
    onNavigationGuard,
  );
  return (
    <Dialog title="Импорт GEDCOM или JSON" onClose={close}>
      <form className="dialog-form" onSubmit={submit}>
        <p className="form-description">
          Импортируйте GEDCOM 5.5.1/7 из генеалогической программы или tree.json из GEN.
          Неизвестные структуры исходного GEDCOM сохраняются при редактировании.
        </p>
        <label className={`file-drop ${file ? 'has-file' : ''}`}>
          <FileUp size={30} />
          <strong>{file ? file.name : 'Выбрать GEDCOM / JSON'}</strong>
          <span>
            {file ? `${(file.size / 1024).toFixed(0)} КБ` : 'GEDCOM 5.5.1/7 или JSON GEN · до 25 МБ'}
          </span>
          <input
            type="file"
            accept=".ged,.gedcom,.json,application/json,text/plain"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            disabled={busy}
            aria-label="Файл GEDCOM или JSON"
          />
        </label>
        <label className="field">
          Название дерева
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={file?.name.replace(/\.[^.]+$/, '') || 'Название файла по умолчанию'}
          />
        </label>

        {file && /\.(ged|gedcom)$/i.test(file.name) && (
          <label className="field">
            Кодировка исходного GEDCOM
            <select value={encoding} onChange={(event) => setEncoding(event.target.value)}>
              <option value="">Определить автоматически</option>
              <option value="utf-8">UTF-8</option>
              <option value="utf-16le">UTF-16 LE</option>
              <option value="utf-16be">UTF-16 BE</option>
              <option value="cp1251">Windows-1251</option>
              <option value="ascii">ASCII</option>
            </select>
          </label>
        )}
        <p className="field-hint">
          Файл .ged не содержит сами фотографии. Оригинал импорта сохраняется без изменений;
          для полного переноса изображений позже добавим восстановление ZIP.
        </p>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <footer className="dialog-footer">
          <button type="button" className="button secondary" onClick={close} disabled={busy}>
            Отмена
          </button>
          <button className="button primary" disabled={busy || !file}>
            {busy ? 'Импортируем…' : 'Импортировать'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
