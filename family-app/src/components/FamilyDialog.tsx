import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Family, FamilyWrite, Pedigree, Person } from '../types';
import { api, errorMessage } from '../lib/api';
import { fullName } from '../lib/format';
import { Dialog } from './Dialog';
import { DateField } from './DateField';
import { PersonSelect } from './PersonSelect';
import { useUnsavedGuard, type RegisterNavigationGuard } from '../lib/useUnsavedGuard';

export function FamilyDialog({
  treeId,
  family,
  persons,
  onClose,
  onSaved,
  onNavigationGuard,
}: {
  treeId: string;
  family: Family;
  persons: Person[];
  onClose: () => void;
  onSaved: (family?: Family) => Promise<void>;
  onNavigationGuard?: RegisterNavigationGuard;
}) {
  const [draft, setDraft] = useState<FamilyWrite>({
    partner1_id: family.partner1_id,
    partner2_id: family.partner2_id,
    children: family.children.map((c) => ({ ...c })),
    marriage_date: family.marriage_date,
    marriage_place: family.marriage_place,
    divorce_date: family.divorce_date,
    notes: family.notes,
    revision: family.revision,
  });
  const [addId, setAddId] = useState('');
  const [baseline] = useState(() => JSON.stringify(draft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const choices = [...persons].sort((a, b) => fullName(a).localeCompare(fullName(b), 'ru'));
  const names = new Map(persons.map((p) => [p.id, fullName(p)]));
  const update = <K extends keyof FamilyWrite>(key: K, value: FamilyWrite[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await api<Family>(`/trees/${treeId}/families/${family.id}`, {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      await onSaved(updated);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!window.confirm('Удалить эту семейную связь? Сами люди останутся в дереве.')) return;
    setBusy(true);
    setError('');
    try {
      await api(`/trees/${treeId}/families/${family.id}`, { method: 'DELETE' });
      await onSaved();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const close = useUnsavedGuard(
    JSON.stringify(draft) !== baseline || Boolean(addId),
    busy,
    onClose,
    onNavigationGuard,
  );
  return (
    <Dialog title="Семья и родственные связи" onClose={close} wide>
      <form className="dialog-form" onSubmit={submit}>
        <div className="form-grid">
          {(['partner1_id', 'partner2_id'] as const).map((key, index) => (
            <PersonSelect
              key={key}
              label={index ? 'Второй родитель / партнёр' : 'Первый родитель / партнёр'}
              persons={choices}
              value={draft[key] || ''}
              onChange={(value) => update(key, value || null)}
            />
          ))}
        </div>
        <h3 className="form-section-title">Дети</h3>
        <div className="family-children">
          {draft.children.map((child) => (
            <div className="family-child-row" key={child.person_id}>
              <span>{names.get(child.person_id) || 'Неизвестный человек'}</span>
              <select
                value={child.pedigree}
                aria-label={`Родство: ${names.get(child.person_id)}`}
                onChange={(event) =>
                  update(
                    'children',
                    draft.children.map((c) =>
                      c.person_id === child.person_id
                        ? { ...c, pedigree: event.target.value as Pedigree }
                        : c,
                    ),
                  )
                }
              >
                <option value="birth">Биологическое</option>
                <option value="adopted">Усыновление</option>
                <option value="foster">Приёмная семья</option>
                <option value="unknown">Неизвестно</option>
              </select>
              <button
                type="button"
                className="icon-button"
                aria-label={`Убрать из семьи: ${names.get(child.person_id)}`}
                onClick={() =>
                  update(
                    'children',
                    draft.children.filter((c) => c.person_id !== child.person_id),
                  )
                }
              >
                <X size={17} />
              </button>
            </div>
          ))}
        </div>
        <div className="inline-add">
          <PersonSelect
            label="Добавить существующего ребёнка"
            placeholder="Выбрать ребёнка из дерева"
            value={addId}
            onChange={setAddId}
            persons={choices.filter(
              (p) =>
                ![
                  draft.partner1_id,
                  draft.partner2_id,
                  ...draft.children.map((c) => c.person_id),
                ].includes(p.id),
            )}
          />
          <button
            type="button"
            className="button secondary"
            disabled={!addId}
            onClick={() => {
              update('children', [...draft.children, { person_id: addId, pedigree: 'birth' }]);
              setAddId('');
            }}
          >
            <Plus size={16} />
            Добавить
          </button>
        </div>
        <h3 className="form-section-title">События семьи</h3>
        <div className="form-grid">
          <DateField
            label="Дата брака"
            value={draft.marriage_date}
            onChange={(value) => update('marriage_date', value)}
          />
          <label className="field">
            Место брака
            <input
              value={draft.marriage_place}
              onChange={(event) => update('marriage_place', event.target.value)}
            />
          </label>
          <DateField
            label="Дата развода"
            value={draft.divorce_date}
            onChange={(value) => update('divorce_date', value)}
          />
        </div>
        <label className="field">
          Примечания
          <textarea
            value={draft.notes}
            rows={3}
            onChange={(event) => update('notes', event.target.value)}
          />
        </label>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <footer className="dialog-footer split">
          <button type="button" className="button danger ghost" onClick={remove} disabled={busy}>
            <Trash2 size={16} />
            Удалить связь
          </button>
          <div className="actions">
            <button type="button" className="button secondary" onClick={close} disabled={busy}>
              Отмена
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
