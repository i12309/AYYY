import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Crosshair,
  Heart,
  MapPin,
  Plus,
  X,
} from 'lucide-react';
import type { Family, Person, Relation } from '../types';
import { fullName, years } from '../lib/format';
import { Avatar } from './Avatar';
import { formatDate } from '../lib/dates';
import { MarkdownText } from './MarkdownText';

interface Props {
  person: Person;
  persons: Person[];
  families: Family[];
  isRoot: boolean;
  onOpen: () => void;
  onSelect: (id: string) => void;
  onRoot: () => void;
  onAdd: (relation: Relation) => void;
  onClose: () => void;
}

export function PersonPreview({
  person,
  persons,
  families,
  isRoot,
  onOpen,
  onSelect,
  onRoot,
  onAdd,
  onClose,
}: Props) {
  const lookup = new Map(persons.map((p) => [p.id, p]));
  const parents = new Set<string>(),
    partners = new Set<string>(),
    children = new Set<string>();
  for (const family of families) {
    if (family.children.some((child) => child.person_id === person.id))
      for (const id of [family.partner1_id, family.partner2_id]) if (id) parents.add(id);
    if ([family.partner1_id, family.partner2_id].includes(person.id)) {
      for (const id of [family.partner1_id, family.partner2_id])
        if (id && id !== person.id) partners.add(id);
      for (const child of family.children) children.add(child.person_id);
    }
  }
  const group = (label: string, ids: Set<string>, relation: Relation) => (
    <section className="preview-relations">
      <div className="preview-section-heading">
        <h3>{label}</h3>
        <button
          className="icon-button"
          title={`Добавить: ${label.toLowerCase()}`}
          aria-label={`Добавить: ${label.toLowerCase()}`}
          onClick={() => onAdd(relation)}
        >
          <Plus size={15} />
        </button>
      </div>
      {[...ids].map((id) => {
        const relative = lookup.get(id);
        return (
          relative && (
            <button className="relative-item" key={id} onClick={() => onSelect(id)}>
              <Avatar person={relative} />
              <span>
                <strong>{fullName(relative, false)}</strong>
                <small>{years(relative)}</small>
              </span>
            </button>
          )
        );
      })}
      {!ids.size && <p className="muted preview-empty">Не указаны</p>}
    </section>
  );
  return (
    <aside className="person-preview">
      <header className="preview-heading">
        <span>КАРТОЧКА ЧЕЛОВЕКА</span>
        <button className="icon-button" aria-label="Скрыть карточку" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="preview-scroll">
        <div className="preview-profile">
          <Avatar person={person} large />
          <h2>
            {[person.given_name, person.patronymic].filter(Boolean).join(' ')}
            <span>{person.surname || 'Имя неизвестно'}</span>
          </h2>
          {person.sex !== 'M' && person.maiden_name && (
            <p className="maiden-name">урожд. {person.maiden_name}</p>
          )}
          <p className="preview-years">{years(person)}</p>
          {isRoot && (
            <span className="root-badge">
              <Crosshair size={12} />В центре дерева
            </span>
          )}
        </div>
        <button className="button primary preview-biography" onClick={onOpen}>
          <BookOpen size={17} />
          Биография и сведения
        </button>
        <div className="preview-facts">
          {person.birth_date && (
            <div>
              <CalendarDays size={16} />
              <span>
                <small>Рождение</small>
                {formatDate(person.birth_date)}
              </span>
            </div>
          )}
          {person.death_date && (
            <div>
              <CalendarDays size={16} />
              <span>
                <small>Смерть</small>
                {formatDate(person.death_date)}
              </span>
            </div>
          )}
          {person.birth_place && (
            <div>
              <MapPin size={16} />
              <span>
                <small>Место рождения</small>
                {person.birth_place}
              </span>
            </div>
          )}
          {person.occupation && (
            <div>
              <BriefcaseBusiness size={16} />
              <span>
                <small>Занятие</small>
                {person.occupation}
              </span>
            </div>
          )}
        </div>
        {person.biography && (
          <section className="preview-story">
            <h3>История жизни</h3>
            <MarkdownText text={person.biography} format={person.biography_format} />
            <button className="text-button" onClick={onOpen}>
              Читать и редактировать
            </button>
          </section>
        )}
        <div className="preview-family-title">
          <Heart size={16} />
          <h3>Семья</h3>
        </div>
        {group('Родители', parents, 'parent')}
        {group('Партнёры', partners, 'partner')}
        {group('Дети', children, 'child')}
      </div>
      {!isRoot && (
        <footer className="preview-footer">
          <button className="button secondary" onClick={onRoot}>
            <Crosshair size={16} />
            Сделать центральным
          </button>
        </footer>
      )}
    </aside>
  );
}
