import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react';
import type { Person } from '../types';
import { fullName, yearOf } from '../lib/format';
import { Avatar } from './Avatar';
import { formatDate } from '../lib/dates';

interface Props {
  persons: Person[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onContext: (id: string, x: number, y: number) => void;
}
type SortKey = 'name' | 'birth_date' | 'death_date' | 'birth_place';

export function PeopleTable({ persons, selectedId, onSelect, onOpen, onContext }: Props) {
  const [sort, setSort] = useState<SortKey>('name');
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(0);
  const sorted = useMemo(
    () =>
      [...persons].sort((a, b) => {
        const value = (p: Person) =>
          sort === 'name'
            ? `${p.surname} ${p.given_name} ${p.patronymic}`
            : sort === 'birth_place'
              ? p.birth_place
              : yearOf(p[sort]).replace('ок. ', '');
        const left = value(a),
          right = value(b);
        if (!left || !right) return !left && !right ? 0 : !left ? 1 : -1;
        return left.localeCompare(right, 'ru', { numeric: true }) * (ascending ? 1 : -1);
      }),
    [persons, sort, ascending],
  );
  const pages = Math.max(1, Math.ceil(sorted.length / 50));
  const current = Math.min(page, pages - 1);
  const heading = (key: SortKey, label: string) => (
    <button
      onClick={() => {
        if (sort === key) setAscending(!ascending);
        else {
          setSort(key);
          setAscending(true);
        }
        setPage(0);
      }}
    >
      {label}
      {sort === key && (ascending ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
    </button>
  );
  return (
    <div className="table-view">
      <div className="table-scroll">
        <table className="people-table">
          <thead>
            <tr>
              <th>{heading('name', 'Человек')}</th>
              <th>{heading('birth_date', 'Рождение')}</th>
              <th>{heading('death_date', 'Смерть')}</th>
              <th>{heading('birth_place', 'Место рождения')}</th>
              <th>Биография</th>
              <th aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {sorted.slice(current * 50, current * 50 + 50).map((person) => (
              <tr
                key={person.id}
                className={selectedId === person.id ? 'selected' : ''}
                onClick={() => onSelect(person.id)}
                onDoubleClick={() => onOpen(person.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onContext(person.id, event.clientX, event.clientY);
                }}
              >
                <td>
                  <button className="table-person" onClick={() => onSelect(person.id)}>
                    <Avatar person={person} />
                    <span>
                      <strong>{person.surname || '—'}</strong>
                      <span>
                        {[person.given_name, person.patronymic].filter(Boolean).join(' ') ||
                          'Имя неизвестно'}
                      </span>
                    </span>
                  </button>
                </td>
                <td>{formatDate(person.birth_date) || '—'}</td>
                <td>
                  {formatDate(person.death_date) ||
                    (person.is_living ? <span className="living-label">Живёт</span> : '—')}
                </td>
                <td>{person.birth_place || '—'}</td>
                <td>
                  <button
                    className={`text-button ${person.biography ? '' : 'muted'}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(person.id);
                    }}
                  >
                    <BookOpen size={15} />
                    {person.biography ? 'Читать' : 'Добавить'}
                  </button>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Действия: ${fullName(person)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onContext(person.id, event.clientX, event.clientY);
                    }}
                  >
                    <Ellipsis size={19} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sorted.length && (
          <div className="empty-state">
            <h3>Никого не найдено</h3>
            <p>Измените поиск или фильтры родства.</p>
          </div>
        )}
      </div>
      <footer className="table-footer">
        <span>
          {sorted.length
            ? `${current * 50 + 1}–${Math.min((current + 1) * 50, sorted.length)} из ${sorted.length}`
            : '0 человек'}
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Предыдущая страница"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            className="icon-button"
            aria-label="Следующая страница"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}
