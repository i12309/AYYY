import { useEffect, useState } from 'react';
import { api, appUrl, errorMessage } from '../lib/api';
import type { MediaItem, Person } from '../types';
import { DateField } from './DateField';
import { formatDate } from '../lib/dates';

interface Props {
  treeId: string;
  person: Person;
  revision: number;
  disabled: boolean;
  onSaved: (person: Person) => Promise<void>;
  onDirty: (dirty: boolean) => void;
  onBusy: (busy: boolean) => void;
}
export function PersonGallery({
  treeId,
  person,
  revision,
  disabled,
  onSaved,
  onDirty,
  onBusy,
}: Props) {
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [baseline, setBaseline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const path = `/trees/${treeId}/persons/${person.id}/media`;
  const dirty = Boolean(editing && JSON.stringify(editing) !== baseline);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  async function request(url: string, options: RequestInit) {
    if (busy || disabled) return;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const updated = await api<Person>(url, options);
      setEditing(null);
      await onSaved(updated);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  function abandon() {
    return !dirty || window.confirm('Подпись файла не сохранена. Продолжить без сохранения?');
  }
  return (
    <section className="pe-gallery">
      <h3>Фотографии и документы</h3>
      <p>Файлы сохраняются сразу. Для каждого можно указать подпись, дату, место и описание.</p>
      <label className="button secondary">
        Добавить фото или PDF
        <input
          aria-label="Файл галереи"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={busy || disabled}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (!file || !abandon()) return;
            const body = new FormData();
            body.append('file', file);
            body.append('revision', String(revision));
            void request(path, { method: 'POST', body });
          }}
        />
      </label>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <div className="gallery-grid">
        {(person.gallery ?? []).map((item) => (
          <article key={item.id} className="gallery-item">
            {item.mime_type.startsWith('image/') ? (
              <a href={appUrl(item.url)} target="_blank" rel="noopener noreferrer">
                <img
                  loading="lazy"
                  src={appUrl(item.url)}
                  alt={item.caption || 'Фотография из семейного архива'}
                />
              </a>
            ) : (
              <a href={appUrl(item.url)}>Скачать PDF</a>
            )}
            <strong>{item.caption || 'Без подписи'}</strong>
            <span>{[formatDate(item.date), item.place].filter(Boolean).join(' · ')}</span>
            {item.description && <p className="biography-plain">{item.description}</p>}
            {editing?.id === item.id ? (
              <div className="gallery-edit">
                <label>
                  Подпись
                  <input
                    value={editing.caption}
                    onChange={(event) => setEditing({ ...editing, caption: event.target.value })}
                  />
                </label>
                <DateField
                  label="Дата файла"
                  value={editing.date}
                  onChange={(date) => setEditing({ ...editing, date })}
                />
                <label>
                  Место
                  <input
                    value={editing.place}
                    onChange={(event) => setEditing({ ...editing, place: event.target.value })}
                  />
                </label>
                <label>
                  Описание
                  <textarea
                    value={editing.description}
                    onChange={(event) =>
                      setEditing({ ...editing, description: event.target.value })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="button primary"
                  disabled={busy || disabled}
                  onClick={() =>
                    void request(`${path}/${item.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({
                        caption: editing.caption,
                        date: editing.date,
                        place: editing.place,
                        description: editing.description,
                        revision,
                      }),
                    })
                  }
                >
                  Сохранить подпись
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    if (abandon()) setEditing(null);
                  }}
                >
                  Отмена
                </button>
              </div>
            ) : (
              <div className="gallery-actions">
                <button
                  type="button"
                  disabled={busy || disabled}
                  onClick={() => {
                    if (abandon()) {
                      setEditing({ ...item });
                      setBaseline(JSON.stringify(item));
                    }
                  }}
                >
                  Изменить подпись
                </button>
                {item.mime_type.startsWith('image/') && (
                  <button
                    type="button"
                    disabled={busy || disabled}
                    onClick={() => {
                      if (abandon())
                        void request(`${path}/${item.id}/portrait`, {
                          method: 'POST',
                          body: JSON.stringify({ revision }),
                        });
                    }}
                  >
                    Сделать портретом
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy || disabled}
                  onClick={() => {
                    if (abandon() && window.confirm('Убрать файл из галереи?'))
                      void request(`${path}/${item.id}?revision=${revision}`, { method: 'DELETE' });
                  }}
                >
                  Убрать
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!person.gallery?.length && <p>Галерея пока пуста.</p>}
    </section>
  );
}
