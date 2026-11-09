import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  Heart,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { api, ApiError, appUrl, errorMessage } from '../lib/api';
import { emptyPerson, fullName, initials, years } from '../lib/format';
import type { Family, LifeEvent, Person, PersonWrite, Relation, TreeData } from '../types';
import '../editor.css';
import { DateField } from './DateField';
import { formatDate } from '../lib/dates';
import { MarkdownText } from './MarkdownText';
import { PersonGallery } from './PersonGallery';
import {
  readBiographyDraft,
  saveBiographyDraft,
  removeBiographyDraft,
} from '../lib/biographyDraft';

interface PersonEditorProps {
  treeId: string;
  person: Person;
  persons: Person[];
  families: Family[];
  onClose: () => void;
  onSaved: (person: Person) => Promise<void>;
  onSelectPerson: (id: string) => void;
  onAddRelative: (id: string, relation: Relation) => void;
  onEditFamily: (family: Family) => void;
  onDeletePerson: (id: string) => void;
  onNavigationGuard?: (guard: (() => boolean) | null) => void;
}

type Tab = 'biography' | 'details' | 'events' | 'family' | 'gallery';
type ChangeField = <K extends keyof PersonWrite>(key: K, value: PersonWrite[K]) => void;
type Pending = 'save' | 'photo' | 'reload' | 'gallery' | null;

const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: 'biography', label: 'Биография', icon: BookOpen },
  { id: 'details', label: 'Сведения', icon: UserRound },
  { id: 'events', label: 'События', icon: CalendarDays },
  { id: 'family', label: 'Семья', icon: UsersRound },
  { id: 'gallery', label: 'Галерея', icon: ImagePlus },
];

const EVENT_TYPES = [
  { tag: 'EVEN', label: 'Другое событие' },
  { tag: 'RESI', label: 'Место жительства' },
  { tag: 'EDUC', label: 'Образование' },
  { tag: 'OCCU', label: 'Работа' },
  { tag: 'BURI', label: 'Захоронение' },
];

function editable(person: Person): PersonWrite {
  const values = emptyPerson();
  for (const key of Object.keys(values) as (keyof PersonWrite)[]) {
    Object.assign(values, { [key]: person[key] });
  }
  values.biography_format = person.biography_format ?? 'text';
  return { ...values, events: person.events.map((event) => ({ ...event })) };
}

function photoSource(url: string, revision: number): string {
  return `${appUrl(url)}${url.includes('?') ? '&' : '?'}v=${revision}`;
}

function Portrait({
  person,
  photo,
  revision,
}: {
  person: Pick<Person, 'given_name' | 'surname'>;
  photo: string | null;
  revision: number;
}) {
  return (
    <span className="pe-avatar" aria-hidden="true">
      {initials(person)}
      {photo && (
        <img
          src={photoSource(photo, revision)}
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
          onLoad={(event) => {
            event.currentTarget.hidden = false;
          }}
        />
      )}
    </span>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  wide,
  multiline,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wide?: boolean;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <label className={`pe-field${wide ? ' pe-field-wide' : ''}`}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function SectionHeading({
  children,
  description,
  action,
}: {
  children: ReactNode;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="pe-section-heading">
      <div>
        <h3>{children}</h3>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function PersonFields({
  draft,
  onChange,
  onDelete,
}: {
  draft: PersonWrite;
  onChange: ChangeField;
  onDelete: () => void;
}) {
  return (
    <div className="pe-sections">
      <section>
        <SectionHeading description="Имена можно записать так, как их помнят в вашей семье.">
          Личные сведения
        </SectionHeading>
        <div className="pe-field-grid">
          <TextField
            label="Имя"
            value={draft.given_name}
            onChange={(value) => onChange('given_name', value)}
          />
          <TextField
            label="Фамилия"
            value={draft.surname}
            onChange={(value) => onChange('surname', value)}
          />
          <TextField
            label="Отчество"
            value={draft.patronymic}
            onChange={(value) => onChange('patronymic', value)}
          />
          {draft.sex !== 'M' && (
            <TextField
              label="Девичья фамилия"
              value={draft.maiden_name}
              onChange={(value) => onChange('maiden_name', value)}
            />
          )}
          <label className="pe-field">
            <span>Пол</span>
            <select
              value={draft.sex}
              onChange={(event) => onChange('sex', event.target.value as Person['sex'])}
            >
              <option value="U">Не указан</option>
              <option value="M">Мужской</option>
              <option value="F">Женский</option>
              <option value="X">Другой</option>
            </select>
          </label>
          <TextField
            label="Род занятий"
            value={draft.occupation}
            onChange={(value) => onChange('occupation', value)}
            placeholder="Профессия или любимое дело"
          />
        </div>
      </section>
      <section>
        <SectionHeading description="Сохраняйте неполные и приблизительные даты, если точная дата неизвестна.">
          Даты и места
        </SectionHeading>
        <div className="pe-field-grid">
          <DateField
            className="pe-field"
            label="Дата рождения"
            value={draft.birth_date}
            onChange={(value) => onChange('birth_date', value)}
            placeholder="16 Марта 2022 или 1940"
          />
          <TextField
            label="Место рождения"
            value={draft.birth_place}
            onChange={(value) => onChange('birth_place', value)}
            placeholder="Город, регион, страна"
          />
          <label className="pe-living pe-field-wide">
            <input
              type="checkbox"
              checked={draft.is_living}
              onChange={(event) => onChange('is_living', event.target.checked)}
            />
            <span>
              <strong>Человек жив</strong>
              <small>Отметка отображается в карточке дерева.</small>
            </span>
            <Heart size={18} aria-hidden="true" />
          </label>
          <DateField
            className="pe-field"
            label="Дата смерти"
            value={draft.death_date}
            onChange={(value) => onChange('death_date', value)}
            placeholder={
              draft.is_living ? 'Не указывается для живущего человека' : '16 Марта 2022 или 1940'
            }
          />
          <TextField
            label="Место смерти"
            value={draft.death_place}
            onChange={(value) => onChange('death_place', value)}
            placeholder="Город, регион, страна"
          />
        </div>
        <p className="pe-hint">
          Можно указать только год: <b>1940</b>. Для приблизительной даты используйте{' '}
          <b>ABT 1940</b>.
        </p>
      </section>
      <section>
        <SectionHeading description="Источники, вопросы для родственников и детали, которые ещё нужно проверить.">
          Заметки
        </SectionHeading>
        <TextField
          label="Заметки к карточке"
          value={draft.notes}
          onChange={(value) => onChange('notes', value)}
          multiline
          placeholder="Что ещё хочется узнать об этом человеке?"
        />
      </section>
      <div className="pe-delete-row">
        <div>
          <strong>Удаление карточки</strong>
          <p>Удалятся сведения и связи этого человека. Родственники останутся в дереве.</p>
        </div>
        <button type="button" className="pe-text-button pe-danger" onClick={onDelete}>
          <Trash2 size={16} />
          Удалить человека
        </button>
      </div>
    </div>
  );
}

function EventsEditor({
  draft,
  onChange,
  onOpenDetails,
}: {
  draft: PersonWrite;
  onChange: ChangeField;
  onOpenDetails: () => void;
}) {
  function addEvent() {
    const id =
      globalThis.crypto?.randomUUID?.() ??
      `event-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    onChange('events', [
      ...draft.events,
      { id, tag: 'EVEN', type: '', date: '', place: '', description: '' },
    ]);
    requestAnimationFrame(() => document.getElementById(`pe-event-${id}`)?.focus());
  }

  function changeEvent(index: number, field: keyof LifeEvent, value: string) {
    onChange(
      'events',
      draft.events.map((event, current) =>
        current === index ? { ...event, [field]: value } : event,
      ),
    );
  }

  return (
    <div className="pe-sections">
      <section>
        <SectionHeading
          description="Соберите места, занятия и важные моменты в одной карточке."
          action={
            <button type="button" className="button secondary pe-small-button" onClick={addEvent}>
              <Plus size={16} />
              Событие
            </button>
          }
        >
          События жизни
        </SectionHeading>
        <div className="pe-life-markers">
          <button type="button" className="pe-life-marker" onClick={onOpenDetails}>
            <span className="pe-marker-icon">
              <CalendarDays size={18} />
            </span>
            <span>
              <strong>Рождение</strong>
              <span>{formatDate(draft.birth_date) || 'Дата не указана'}</span>
              {draft.birth_place && <small>{draft.birth_place}</small>}
            </span>
            <Pencil size={15} />
          </button>
          {(!draft.is_living || draft.death_date || draft.death_place) && (
            <button type="button" className="pe-life-marker" onClick={onOpenDetails}>
              <span className="pe-marker-icon">
                <CalendarDays size={18} />
              </span>
              <span>
                <strong>Смерть</strong>
                <span>{formatDate(draft.death_date) || 'Дата не указана'}</span>
                {draft.death_place && <small>{draft.death_place}</small>}
              </span>
              <Pencil size={15} />
            </button>
          )}
        </div>
        <p className="pe-hint">
          Рождение и смерть редактируются во вкладке «Сведения»; браки — в связях семьи.
        </p>
      </section>
      {draft.events.length === 0 ? (
        <div className="pe-empty">
          <CalendarDays size={30} strokeWidth={1.4} />
          <h4>Важные моменты складываются в историю</h4>
          <p>Добавьте переезд, учёбу, работу или другое событие, которое хочется сохранить.</p>
          <button type="button" className="button secondary" onClick={addEvent}>
            <Plus size={16} />
            Добавить событие
          </button>
        </div>
      ) : (
        <div className="pe-events">
          {draft.events.map((event, index) => (
            <section className="pe-event" key={event.id}>
              <div className="pe-event-heading">
                <span className="pe-event-number">{String(index + 1).padStart(2, '0')}</span>
                <h4>
                  {event.type ||
                    EVENT_TYPES.find((type) => type.tag === event.tag)?.label ||
                    event.tag}
                </h4>
                <button
                  type="button"
                  className="icon-button pe-event-remove"
                  aria-label={`Удалить событие ${event.type || index + 1}`}
                  onClick={() =>
                    onChange(
                      'events',
                      draft.events.filter((_, current) => current !== index),
                    )
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="pe-field-grid">
                <label className="pe-field">
                  <span>Вид события</span>
                  <select
                    value={event.tag}
                    onChange={(e) => changeEvent(index, 'tag', e.target.value)}
                  >
                    {!EVENT_TYPES.some((type) => type.tag === event.tag) && (
                      <option value={event.tag}>{event.tag} — из GEDCOM</option>
                    )}
                    {EVENT_TYPES.map((type) => (
                      <option key={type.tag} value={type.tag}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pe-field">
                  <span>Название события</span>
                  <input
                    id={`pe-event-${event.id}`}
                    value={event.type}
                    placeholder="Как вы назовёте этот момент?"
                    onChange={(e) => changeEvent(index, 'type', e.target.value)}
                  />
                </label>
                <DateField
                  className="pe-field"
                  label="Дата события"
                  value={event.date}
                  onChange={(value) => changeEvent(index, 'date', value)}
                  placeholder="16 Марта 2022 или 1940"
                />
                <TextField
                  label="Место события"
                  value={event.place}
                  onChange={(value) => changeEvent(index, 'place', value)}
                  placeholder="Город или адрес"
                />
                <TextField
                  label="Описание события"
                  value={event.description}
                  onChange={(value) => changeEvent(index, 'description', value)}
                  multiline
                  wide
                  placeholder="Детали, воспоминания, источник информации…"
                />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function RelativeButton({
  relative,
  role,
  onSelect,
}: {
  relative: Person;
  role: string;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="pe-relative" onClick={onSelect}>
      <Portrait person={relative} photo={relative.photo_url} revision={relative.revision} />
      <span className="pe-relative-text">
        <small>{role}</small>
        <strong>{fullName(relative)}</strong>
        <span>{years(relative)}</span>
      </span>
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  );
}

function FamilyView({
  person,
  persons,
  families,
  onSelect,
  onAdd,
  onEdit,
}: {
  person: Person;
  persons: Person[];
  families: Family[];
  onSelect: (id: string) => void;
  onAdd: (relation: Relation) => void;
  onEdit: (family: Family) => void;
}) {
  const byId = useMemo(
    () => new Map(persons.map((relative) => [relative.id, relative])),
    [persons],
  );
  const parentFamilies = families.filter((family) =>
    family.children.some((child) => child.person_id === person.id),
  );
  const ownFamilies = families.filter(
    (family) => family.partner1_id === person.id || family.partner2_id === person.id,
  );
  const pedigreeName = {
    birth: 'По рождению',
    adopted: 'Усыновление',
    foster: 'Приёмная семья',
    unknown: 'Родство не уточнено',
  };

  function relative(id: string | null, role: 'parent' | 'partner' | 'child', isMarried = false) {
    const relativePerson = id ? byId.get(id) : undefined;
    if (!relativePerson) return null;
    const labels =
      role === 'parent'
        ? ['Отец', 'Мать', 'Родитель']
        : role === 'child'
          ? ['Сын', 'Дочь', 'Ребёнок']
          : isMarried
            ? ['Супруг', 'Супруга', 'Партнёр']
            : ['Партнёр', 'Партнёр', 'Партнёр'];
    const roleLabel = labels[relativePerson.sex === 'M' ? 0 : relativePerson.sex === 'F' ? 1 : 2];
    return (
      <RelativeButton
        key={relativePerson.id}
        relative={relativePerson}
        role={roleLabel}
        onSelect={() => onSelect(relativePerson.id)}
      />
    );
  }

  function familyHeading(family: Family, title: string, subtitle?: string) {
    return (
      <div className="pe-family-heading">
        <div>
          <h4>{title}</h4>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <button type="button" className="pe-text-button" onClick={() => onEdit(family)}>
          <Pencil size={14} />
          Изменить связи
        </button>
      </div>
    );
  }

  return (
    <div className="pe-sections">
      <section>
        <SectionHeading
          description="Семьи, в которых этот человек записан ребёнком."
          action={
            <button
              type="button"
              className="button secondary pe-small-button"
              onClick={() => onAdd('parent')}
            >
              <Plus size={15} />
              Родитель
            </button>
          }
        >
          Родители
        </SectionHeading>
        {parentFamilies.length === 0 ? (
          <p className="pe-family-empty">
            Родители пока не добавлены. Начните с одного человека — остальное можно заполнить позже.
          </p>
        ) : (
          parentFamilies.map((family, index) => (
            <div className="pe-family-card" key={family.id}>
              {familyHeading(
                family,
                parentFamilies.length > 1 ? `Семья родителей ${index + 1}` : 'Семья родителей',
                pedigreeName[
                  family.children.find((child) => child.person_id === person.id)!.pedigree
                ],
              )}
              {relative(family.partner1_id, 'parent')}
              {relative(family.partner2_id, 'parent')}
              {!family.partner1_id && !family.partner2_id && (
                <p className="pe-family-empty">Родители в этой семье не указаны.</p>
              )}
            </div>
          ))
        )}
      </section>
      <section>
        <SectionHeading description="Каждый союз хранится отдельно, со своими детьми и датами.">
          Партнёры и дети
        </SectionHeading>
        <div className="pe-family-actions">
          <button
            type="button"
            className="button secondary pe-small-button"
            onClick={() => onAdd('partner')}
          >
            <Plus size={15} />
            Партнёр
          </button>
          <button
            type="button"
            className="button secondary pe-small-button"
            onClick={() => onAdd('child')}
          >
            <Plus size={15} />
            Ребёнок
          </button>
        </div>
        {ownFamilies.length === 0 ? (
          <p className="pe-family-empty">
            Здесь появятся партнёры и дети, когда вы добавите семейные связи.
          </p>
        ) : (
          ownFamilies.map((family, index) => {
            const partnerId =
              family.partner1_id === person.id ? family.partner2_id : family.partner1_id;
            return (
              <div className="pe-family-card" key={family.id}>
                {familyHeading(family, ownFamilies.length > 1 ? `Семья ${index + 1}` : 'Семья')}
                {(family.marriage_date || family.marriage_place) && (
                  <div className="pe-union-date">
                    <Heart size={14} />
                    <span>
                      {['Брак', formatDate(family.marriage_date), family.marriage_place]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                )}
                {family.divorce_date && (
                  <p className="pe-divorce">Развод · {formatDate(family.divorce_date)}</p>
                )}
                {partnerId ? (
                  relative(
                    partnerId,
                    'partner',
                    Boolean(family.marriage_date || family.marriage_place),
                  )
                ) : (
                  <p className="pe-missing-partner">Партнёр не указан</p>
                )}
                {family.children.length > 0 && (
                  <div className="pe-children">
                    <span className="pe-children-label">Дети · {family.children.length}</span>
                    {family.children.map((child) => (
                      <div key={child.person_id}>
                        {relative(child.person_id, 'child')}
                        {child.pedigree !== 'birth' && (
                          <span className="pe-pedigree">{pedigreeName[child.pedigree]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {family.notes && <p className="pe-family-notes">{family.notes}</p>}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

export function PersonEditor(props: PersonEditorProps) {
  return <EditorSession key={`${props.treeId}:${props.person.id}`} {...props} />;
}

function EditorSession({
  treeId,
  person,
  persons,
  families,
  onClose,
  onSaved,
  onSelectPerson,
  onAddRelative,
  onEditFamily,
  onDeletePerson,
  onNavigationGuard,
}: PersonEditorProps) {
  const [draft, setDraft] = useState(() => editable(person));
  const [baseline, setBaseline] = useState(() => editable(person));
  const [revision, setRevision] = useState(person.revision);
  const [photo, setPhoto] = useState(person.photo_url);
  const [photoRevision, setPhotoRevision] = useState(person.revision);
  const [gallery, setGallery] = useState(person.gallery ?? []);
  const [galleryDirty, setGalleryDirty] = useState(false);
  const [reading, setReading] = useState(false);
  const [cachedDraft, setCachedDraft] = useState(() => readBiographyDraft(treeId, person.id));
  const [draftNotice, setDraftNotice] = useState('');
  const biographyInput = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<Tab>('biography');
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [conflict, setConflict] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const closeRef = useRef<() => void>(() => {});
  const uid = useId();
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  );
  const words = draft.biography.trim() ? draft.biography.trim().split(/\s+/u).length : 0;
  const personPath = `/trees/${treeId}/persons/${person.id}`;

  function canNavigate() {
    return (
      !pending &&
      (!(dirty || galleryDirty) ||
        window.confirm('В карточке есть несохранённые изменения. Продолжить без сохранения?'))
    );
  }

  function guard(action: () => void) {
    if (canNavigate()) action();
  }

  useEffect(() => {
    onNavigationGuard?.(canNavigate);
    return () => onNavigationGuard?.(null);
  }, [dirty, galleryDirty, pending, onNavigationGuard]);

  const draftToPersist = useRef<(() => void) | null>(null);
  draftToPersist.current =
    !cachedDraft &&
    (draft.biography !== baseline.biography || draft.biography_format !== baseline.biography_format)
      ? () => {
          saveBiographyDraft(treeId, person.id, {
            biography: draft.biography,
            format: draft.biography_format ?? 'text',
            revision,
            savedAt: new Date().toISOString(),
          });
        }
      : null;
  useEffect(() => {
    if (!draftToPersist.current) return;
    function persist() {
      if (!draftToPersist.current) return;
      try {
        draftToPersist.current?.();
        setDraftNotice('Черновик биографии сохранён в этом браузере');
      } catch {
        setDraftNotice('Браузер не смог сохранить черновик. Сохраните карточку на сервере.');
      }
    }
    const timer = window.setTimeout(persist, 300);
    return () => window.clearTimeout(timer);
  }, [
    draft.biography,
    draft.biography_format,
    baseline.biography,
    baseline.biography_format,
    cachedDraft,
    treeId,
    person.id,
    revision,
  ]);
  useEffect(() => {
    function persist() {
      try {
        draftToPersist.current?.();
      } catch {
        /* The explicit save remains available. */
      }
    }
    window.addEventListener('beforeunload', persist);
    return () => {
      window.removeEventListener('beforeunload', persist);
      persist();
    };
  }, []);

  function insertMarkdown(before: string, after = '', fallback = 'текст') {
    const input = biographyInput.current;
    const start = input?.selectionStart ?? draft.biography.length;
    const end = input?.selectionEnd ?? start;
    const selected = draft.biography.slice(start, end) || fallback;
    setDraft((current) => ({
      ...current,
      biography_format: 'markdown',
      biography:
        current.biography.slice(0, start) +
        before +
        selected +
        after +
        current.biography.slice(end),
    }));
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function changeField<K extends keyof PersonWrite>(key: K, value: PersonWrite[K]) {
    if (key === 'is_living' && value === true && (draft.death_date || draft.death_place)) {
      if (!window.confirm('Отметить человека как живущего и очистить дату и место смерти?')) return;
      setDraft((current) => ({ ...current, is_living: true, death_date: '', death_place: '' }));
    } else {
      setDraft((current) => ({
        ...current,
        [key]: value,
        ...(key === 'death_date' && typeof value === 'string' && value.trim()
          ? { is_living: false }
          : {}),
      }));
    }
    setStatus('');
  }

  function acceptPerson(updated: Person) {
    const values = editable(updated);
    setDraft(values);
    setBaseline(values);
    setRevision(updated.revision);
    setPhoto(updated.photo_url);
    setPhotoRevision(updated.revision);
    setGallery(updated.gallery ?? []);
    setConflict(false);
  }

  async function refreshTree(updated: Person, savedMessage: string) {
    try {
      await onSaved(updated);
    } catch (cause) {
      setError(`${savedMessage} Обновить дерево не удалось: ${errorMessage(cause)}`);
    }
  }

  async function save() {
    if (pending || !dirty || conflict) return;
    setPending('save');
    setError('');
    setStatus('');
    try {
      const updated = await api<Person>(personPath, {
        method: 'PUT',
        body: JSON.stringify({ ...draft, revision }),
      });
      acceptPerson(updated);
      draftToPersist.current = null;
      removeBiographyDraft(treeId, person.id);
      setCachedDraft(null);
      setDraftNotice('');
      setStatus('Изменения сохранены');
      await refreshTree(updated, 'Карточка сохранена.');
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409) setConflict(true);
    } finally {
      setPending(null);
    }
  }

  async function changePhoto(file?: File) {
    if (pending) return;
    setPending('photo');
    setError('');
    setStatus('');
    const body = new FormData();
    if (file) body.append('file', file);
    body.append('revision', String(revision));
    try {
      const updated = await api<Person>(
        `${personPath}/photo${file ? '' : `?revision=${revision}`}`,
        file ? { method: 'POST', body } : { method: 'DELETE' },
      );
      setPhoto(updated.photo_url);
      setPhotoRevision(updated.revision);
      if (JSON.stringify(editable(updated)) !== JSON.stringify(baseline)) {
        setConflict(true);
        setError(
          'В другой вкладке изменили сведения этого человека. Ваши правки остались в редакторе. Загрузите актуальную версию, чтобы продолжить.',
        );
      } else {
        setRevision(updated.revision);
      }
      setStatus(file ? 'Фотография сохранена' : 'Фотография удалена');
      await refreshTree(updated, file ? 'Фотография сохранена.' : 'Фотография удалена.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(null);
    }
  }

  async function acceptMedia(updated: Person) {
    setGallery(updated.gallery ?? []);
    setPhoto(updated.photo_url);
    setPhotoRevision(updated.revision);
    if (JSON.stringify(editable(updated)) !== JSON.stringify(baseline)) {
      setConflict(true);
      setError(
        'Сведения изменились в другой вкладке. Ваш текст сохранён в редакторе; загрузите актуальную версию.',
      );
    } else setRevision(updated.revision);
    await refreshTree(updated, 'Файл сохранён.');
  }

  async function reload() {
    if (
      pending ||
      (dirty &&
        !window.confirm(
          'Заменить несохранённые изменения актуальной версией карточки? Сначала скопируйте текст, который хотите сохранить.',
        ))
    )
      return;
    setPending('reload');
    setError('');
    try {
      const data = await api<TreeData>(`/trees/${treeId}`);
      const updated = data.persons.find((current) => current.id === person.id);
      if (!updated)
        throw new Error(
          'Этот человек уже удалён из дерева. Закройте карточку и обновите страницу.',
        );
      acceptPerson(updated);
      setStatus('Загружена актуальная версия');
      await refreshTree(updated, 'Карточка обновлена.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(null);
    }
  }

  useEffect(() => {
    closeRef.current = () => guard(onClose);
  });

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus({ preventScroll: true });
    function keydown(event: KeyboardEvent) {
      const panel = dialogRef.current;
      if (!panel) return;
      if (event.key === 'Escape') {
        if (
          event.target instanceof Element &&
          event.target.closest('[data-date-field]')?.querySelector('[data-date-calendar]')
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const controls = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button:not(:disabled):not([tabindex="-1"]), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) {
          event.preventDefault();
          panel.focus();
          return;
        }
        if (!panel.contains(document.activeElement) || document.activeElement === panel) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!dirty && !galleryDirty && !pending) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, galleryDirty, pending]);

  function switchTab(next: Tab) {
    if (
      pending ||
      (galleryDirty && !window.confirm('Подпись файла не сохранена. Перейти без сохранения?'))
    )
      return;
    setGalleryDirty(false);
    setTab(next);
  }

  return (
    <div
      className="pe-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) guard(onClose);
      }}
    >
      <div
        className="pe-drawer"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-name`}
        tabIndex={-1}
      >
        <form
          className="pe-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <header className="pe-header">
            <div className="pe-header-eyebrow">
              <span className="pe-eyebrow-dot" />
              СЕМЕЙНЫЙ АРХИВ
            </div>
            <button
              type="button"
              className="icon-button pe-close"
              aria-label="Закрыть карточку"
              disabled={Boolean(pending)}
              onClick={() => guard(onClose)}
            >
              <X size={21} />
            </button>
            <div className="pe-person-heading">
              <button
                type="button"
                className="pe-portrait-button"
                disabled={Boolean(pending)}
                onClick={() => photoInput.current?.click()}
                aria-label="Изменить фотографию"
              >
                <Portrait person={draft} photo={photo} revision={photoRevision} />
                <span className="pe-camera">
                  {pending === 'photo' ? (
                    <LoaderCircle size={14} className="pe-spin" />
                  ) : (
                    <Camera size={14} />
                  )}
                </span>
              </button>
              <div className="pe-identity">
                <h2 id={`${uid}-name`}>{fullName(draft)}</h2>
                <div className="pe-person-meta">
                  <span>{years(draft)}</span>
                  {draft.birth_place && (
                    <span>
                      <MapPin size={13} />
                      {draft.birth_place}
                    </span>
                  )}
                </div>
                <div className="pe-photo-actions">
                  <button
                    type="button"
                    className="pe-text-button"
                    disabled={Boolean(pending)}
                    onClick={() => photoInput.current?.click()}
                  >
                    <ImagePlus size={13} />
                    {photo ? 'Изменить фото' : 'Добавить фото'}
                  </button>
                  {photo && (
                    <button
                      type="button"
                      className="pe-text-button pe-muted"
                      disabled={Boolean(pending)}
                      onClick={() => void changePhoto()}
                    >
                      Убрать
                    </button>
                  )}
                  <span>Фото сохраняется сразу</span>
                </div>
              </div>
            </div>
            <input
              ref={photoInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              aria-label="Фотография человека"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void changePhoto(file);
              }}
            />
          </header>
          <div className="pe-tabs" role="tablist" aria-label="Разделы карточки">
            {TABS.map(({ id, label, icon: Icon }, index) => (
              <button
                type="button"
                role="tab"
                key={id}
                id={`${uid}-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`${uid}-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                className={tab === id ? 'pe-tab pe-tab-active' : 'pe-tab'}
                onClick={() => switchTab(id)}
                onKeyDown={(event) => {
                  let next: number | undefined;
                  if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
                  if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length;
                  if (event.key === 'Home') next = 0;
                  if (event.key === 'End') next = TABS.length - 1;
                  if (next !== undefined) {
                    event.preventDefault();
                    switchTab(TABS[next].id);
                    document.getElementById(`${uid}-tab-${TABS[next].id}`)?.focus();
                  }
                }}
              >
                <Icon size={17} />
                {label}
                {id === 'events' && draft.events.length > 0 && (
                  <span className="pe-tab-count">{draft.events.length}</span>
                )}
              </button>
            ))}
          </div>
          <div
            className="pe-content"
            role="tabpanel"
            id={`${uid}-panel-${tab}`}
            aria-labelledby={`${uid}-tab-${tab}`}
            tabIndex={0}
          >
            {error && (
              <div className="error-banner pe-error" role="alert">
                <span>{error}</span>
                {conflict && (
                  <button
                    type="button"
                    className="pe-text-button"
                    disabled={Boolean(pending)}
                    onClick={() => void reload()}
                  >
                    Загрузить актуальную версию
                  </button>
                )}
              </div>
            )}
            <fieldset className="pe-fields" disabled={Boolean(pending)}>
              {tab === 'biography' && (
                <div className="pe-biography">
                  {cachedDraft && (
                    <div className="draft-banner" role="status">
                      <p>
                        В этом браузере есть черновик биографии от{' '}
                        {new Date(cachedDraft.savedAt).toLocaleString('ru-RU')}.
                        {cachedDraft.revision !== revision &&
                          ' Серверная карточка с тех пор изменилась; восстановится только текст биографии.'}
                      </p>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => {
                          setDraft((current) => ({
                            ...current,
                            biography: cachedDraft.biography,
                            biography_format: cachedDraft.format,
                          }));
                          setCachedDraft(null);
                        }}
                      >
                        Восстановить черновик
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => {
                          removeBiographyDraft(treeId, person.id);
                          setCachedDraft(null);
                          setDraftNotice('');
                        }}
                      >
                        Удалить черновик
                      </button>
                    </div>
                  )}
                  <SectionHeading description="Сохраните воспоминания, характер и маленькие детали, из которых складывается жизнь.">
                    У каждой жизни есть история
                  </SectionHeading>
                  <div className="biography-toolbar">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setReading(!reading)}
                    >
                      {reading ? 'Редактировать' : 'Читать'}
                    </button>
                    {!reading && (
                      <>
                        <button
                          type="button"
                          onClick={() => insertMarkdown('## ', '', 'Заголовок')}
                        >
                          Заголовок
                        </button>
                        <button type="button" onClick={() => insertMarkdown('**', '**')}>
                          Жирный
                        </button>
                        <button type="button" onClick={() => insertMarkdown('*', '*')}>
                          Курсив
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMarkdown('\n- ', '', 'Пункт списка')}
                        >
                          Список
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertMarkdown('[', '](https://example.com)', 'Название ссылки')
                          }
                        >
                          Ссылка
                        </button>
                        {gallery
                          .filter((item) => item.mime_type.startsWith('image/'))
                          .map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                insertMarkdown(
                                  `\n![${item.caption.replace(/[\[\]\\]/g, '')}](${item.url})\n`,
                                  '',
                                  '',
                                )
                              }
                            >
                              Фото: {item.caption || 'без подписи'}
                            </button>
                          ))}
                      </>
                    )}
                  </div>
                  {reading ? (
                    <div className="biography-reading">
                      <MarkdownText
                        text={draft.biography || 'Биография пока не записана.'}
                        format={draft.biography_format}
                      />
                      <h4>Даты и события</h4>
                      <p>
                        {formatDate(draft.birth_date)}
                        {draft.birth_place && ` · ${draft.birth_place}`}
                      </p>
                      {draft.events.map((event, index) => (
                        <p key={index}>
                          {[formatDate(event.date), event.type, event.place, event.description]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="pe-writing-surface">
                      <div className="pe-writing-header">
                        <label htmlFor={`${uid}-biography`}>Биография</label>
                        <span>Текст и воспоминания</span>
                      </div>
                      <textarea
                        ref={biographyInput}
                        id={`${uid}-biography`}
                        className="pe-biography-input"
                        value={draft.biography}
                        onChange={(event) => changeField('biography', event.target.value)}
                        placeholder={
                          'Начните с того, что помните об этом человеке.\n\nГде прошло детство? Чем он увлекался? Какие семейные истории хочется передать дальше?'
                        }
                        spellCheck
                      />
                      <div className="pe-writing-footer">
                        <span>Пишите свободно, абзацами</span>
                        <span>
                          {words} слов · {draft.biography.length} знаков
                        </span>
                      </div>
                    </div>
                  )}
                  {draftNotice && <small aria-live="polite">{draftNotice}</small>}
                  <details className="pe-writing-prompts">
                    <summary>
                      <BookOpen size={16} />
                      <span>О чём можно написать</span>
                      <ChevronDown size={16} />
                    </summary>
                    <ul>
                      <li>Детство, родной дом и семейные традиции.</li>
                      <li>Учёба, работа, увлечения и важные встречи.</li>
                      <li>Характер, любимые выражения и воспоминания близких.</li>
                      <li>Откуда известны эти сведения и что ещё хочется узнать.</li>
                    </ul>
                  </details>
                </div>
              )}
              {tab === 'details' && (
                <PersonFields
                  draft={draft}
                  onChange={changeField}
                  onDelete={() => guard(() => onDeletePerson(person.id))}
                />
              )}
              {tab === 'events' && (
                <EventsEditor
                  draft={draft}
                  onChange={changeField}
                  onOpenDetails={() => setTab('details')}
                />
              )}
              {tab === 'family' && (
                <FamilyView
                  person={person}
                  persons={persons}
                  families={families}
                  onSelect={(id) => guard(() => onSelectPerson(id))}
                  onAdd={(relation) => guard(() => onAddRelative(person.id, relation))}
                  onEdit={(family) => guard(() => onEditFamily(family))}
                />
              )}
              {tab === 'gallery' && (
                <PersonGallery
                  treeId={treeId}
                  person={{ ...person, gallery }}
                  revision={revision}
                  disabled={Boolean(pending) && pending !== 'gallery'}
                  onSaved={acceptMedia}
                  onDirty={setGalleryDirty}
                  onBusy={(busy) => setPending(busy ? 'gallery' : null)}
                />
              )}
            </fieldset>
          </div>
          <footer className="pe-footer">
            <div
              className={`pe-save-status${dirty ? ' pe-save-dirty' : ''}`}
              role="status"
              aria-live="polite"
            >
              {pending ? (
                <LoaderCircle size={16} className="pe-spin" />
              ) : dirty ? (
                <span className="pe-dirty-dot" />
              ) : (
                <Check size={16} />
              )}
              <span>
                {pending === 'save'
                  ? 'Сохраняем изменения…'
                  : pending === 'photo'
                    ? 'Сохраняем фотографию…'
                    : pending === 'reload'
                      ? 'Обновляем карточку…'
                      : dirty
                        ? 'Есть несохранённые изменения'
                        : status || 'Все изменения сохранены'}
              </span>
            </div>
            <button
              type="submit"
              className="button primary pe-save"
              disabled={Boolean(pending) || !dirty || conflict}
            >
              <Save size={17} />
              Сохранить изменения
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default PersonEditor;
