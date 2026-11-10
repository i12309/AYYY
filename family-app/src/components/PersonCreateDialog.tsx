import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Family, Person, PersonWrite, Relation, Sex, TreeData } from '../types';
import { api, errorMessage } from '../lib/api';
import { emptyPerson, fullName } from '../lib/format';
import { Dialog } from './Dialog';
import { DateField } from './DateField';
import { PersonSelect } from './PersonSelect';
import { useUnsavedGuard, type RegisterNavigationGuard } from '../lib/useUnsavedGuard';

interface Props {
  data: TreeData;
  base?: Person;
  relation?: Relation;
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
  onNavigationGuard?: RegisterNavigationGuard;
}
const relationLabels: Record<Relation, string> = {
  parent: 'Добавить родителя',
  partner: 'Добавить партнёра',
  child: 'Добавить ребёнка',
};

export function PersonCreateDialog({
  data,
  base,
  relation,
  onClose,
  onCreated,
  onNavigationGuard,
}: Props) {
  const [person, setPerson] = useState<PersonWrite>(() => ({
    ...emptyPerson(),
    surname: base && relation !== 'partner' ? base.surname : '',
  }));
  const [existing, setExisting] = useState(false);
  const [relativeId, setRelativeId] = useState('');
  const eligible = data.families.filter((f) =>
    relation === 'child'
      ? [f.partner1_id, f.partner2_id].includes(base?.id || '')
      : relation === 'parent'
        ? f.children.some((c) => c.person_id === base?.id) && (!f.partner1_id || !f.partner2_id)
        : false,
  );
  const [familyId, setFamilyId] = useState(eligible.length === 1 ? eligible[0].id : '');
  const [pedigree, setPedigree] = useState('birth');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [baseline] = useState(() =>
    JSON.stringify({ person, existing, relativeId, familyId, pedigree }),
  );
  const update = <K extends keyof PersonWrite>(key: K, value: PersonWrite[K]) =>
    setPerson((p) => ({ ...p, [key]: value }));
  function familyLabel(family: Family) {
    return (
      [family.partner1_id, family.partner2_id]
        .map((id) => data.persons.find((p) => p.id === id))
        .filter((p): p is Person => Boolean(p))
        .map((p) => fullName(p))
        .join(' + ') || 'Семья без указанных родителей'
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (existing && !relativeId) {
      setError('Выберите человека из дерева');
      return;
    }
    if (
      !existing &&
      ![person.given_name, person.surname, person.patronymic].some((v) => v.trim())
    ) {
      setError('Укажите имя или фамилию');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (base && relation) {
        const result = await api<{ person: Person; family: Family }>(
          `/trees/${data.tree.id}/persons/${base.id}/relatives`,
          {
            method: 'POST',
            body: JSON.stringify({
              relation,
              ...(existing ? { relative_id: relativeId } : { person }),
              ...(familyId ? { family_id: familyId } : { create_new_family: true }),
              pedigree,
            }),
          },
        );
        await onCreated(result.person.id);
      } else {
        const result = await api<Person>(`/trees/${data.tree.id}/persons`, {
          method: 'POST',
          body: JSON.stringify(person),
        });
        await onCreated(result.id);
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const close = useUnsavedGuard(
    JSON.stringify({ person, existing, relativeId, familyId, pedigree }) !== baseline,
    busy,
    onClose,
    onNavigationGuard,
  );
  return (
    <Dialog title={relation ? relationLabels[relation] : 'Добавить человека'} onClose={close}>
      <form className="dialog-form" onSubmit={submit}>
        {base && (
          <p className="form-description">
            Родственная связь с человеком: <strong>{fullName(base)}</strong>
          </p>
        )}
        {base && (
          <div className="segmented">
            <button
              type="button"
              className={!existing ? 'active' : ''}
              onClick={() => setExisting(false)}
            >
              Новый человек
            </button>
            <button
              type="button"
              className={existing ? 'active' : ''}
              onClick={() => setExisting(true)}
            >
              Уже есть в дереве
            </button>
          </div>
        )}
        {existing ? (
          <PersonSelect
            label="Человек"
            placeholder="Выберите человека"
            persons={data.persons.filter((p) => p.id !== base?.id)}
            value={relativeId}
            onChange={setRelativeId}
          />
        ) : (
          <>
            <div className="form-grid">
              <label className="field">
                Имя
                <input
                  value={person.given_name}
                  onChange={(event) => update('given_name', event.target.value)}
                  autoFocus
                  placeholder="Имя"
                  maxLength={200}
                />
              </label>
              <label className="field">
                Фамилия
                <input
                  value={person.surname}
                  onChange={(event) => update('surname', event.target.value)}
                  placeholder="Фамилия"
                  maxLength={200}
                />
              </label>
              <label className="field">
                Отчество
                <input
                  value={person.patronymic}
                  onChange={(event) => update('patronymic', event.target.value)}
                  maxLength={200}
                />
              </label>
              <label className="field">
                Пол
                <select
                  value={person.sex}
                  onChange={(event) => update('sex', event.target.value as Sex)}
                >
                  <option value="U">Не указан</option>
                  <option value="M">Мужской</option>
                  <option value="F">Женский</option>
                  <option value="X">Другой</option>
                </select>
              </label>
              <DateField
                label="Дата рождения"
                value={person.birth_date}
                onChange={(value) => update('birth_date', value)}
              />
              <label className="field">
                Место рождения
                <input
                  value={person.birth_place}
                  onChange={(event) => update('birth_place', event.target.value)}
                  placeholder="Город, страна"
                />
              </label>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={person.is_living}
                onChange={(event) => update('is_living', event.target.checked)}
              />
              Человек жив
            </label>
            <p className="field-hint">
              Биографию, фотографии и события можно добавить после создания.
            </p>
          </>
        )}
        {eligible.length > 0 && (
          <label className="field">
            Семья
            <select value={familyId} onChange={(event) => setFamilyId(event.target.value)}>
              <option value="">Создать отдельную семью</option>
              {eligible.map((family) => (
                <option key={family.id} value={family.id}>
                  {familyLabel(family)}
                </option>
              ))}
            </select>
          </label>
        )}
        {relation && relation !== 'partner' && (
          <label className="field">
            Родство
            <select value={pedigree} onChange={(event) => setPedigree(event.target.value)}>
              <option value="birth">Биологическое</option>
              <option value="adopted">Усыновление</option>
              <option value="foster">Приёмная семья</option>
              <option value="unknown">Неизвестно</option>
            </select>
          </label>
        )}
        {error && (
          <div role="alert" className="error-banner">
            {error}
          </div>
        )}
        <footer className="dialog-footer">
          <button type="button" className="button secondary" disabled={busy} onClick={close}>
            Отмена
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Сохраняем…' : existing ? 'Добавить связь' : 'Добавить'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
