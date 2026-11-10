import { memo, useDeferredValue, useMemo, useState } from 'react';
import { Crosshair, Search, X } from 'lucide-react';
import type { Person } from '../types';
import { fullName, years } from '../lib/format';
import { Avatar } from './Avatar';

export const GlobalPersonSearch = memo(function GlobalPersonSearch({
  persons,
  onSelect,
  onQuery,
}: {
  persons: Person[];
  onSelect: (id: string) => void;
  onQuery: (query: string) => void;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const normalizedQuery = text.trim().normalize('NFKC').toLocaleLowerCase('ru');
  const defer = persons.length > 500;
  const deferredQuery = useDeferredValue(defer ? normalizedQuery : '');
  const query = defer ? deferredQuery : normalizedQuery;
  const index = useMemo(
    () =>
      persons.map((person) => ({
        person,
        normalized:
          `${fullName(person)} ${person.maiden_name} ${person.birth_place} ${person.occupation}`
            .normalize('NFKC')
            .toLocaleLowerCase('ru'),
      })),
    [persons],
  );
  const results = useMemo(
    () => (query ? index.filter((row) => row.normalized.includes(query)) : []),
    [query, index],
  );
  const change = (next: string) => {
    setText(next);
    onQuery(next);
  };
  const select = (id: string) => {
    change('');
    setOpen(false);
    onSelect(id);
  };
  return (
    <div className="global-search">
      <Search size={18} />
      <input
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          change(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && results[0]) select(results[0].person.id);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder="Найти человека или место"
        aria-label="Поиск людей"
      />
      {text && (
        <button className="icon-button" aria-label="Очистить поиск" onClick={() => change('')}>
          <X size={15} />
        </button>
      )}
      {open && query && (
        <div className="search-results" onMouseDown={(event) => event.preventDefault()}>
          <span className="search-result-count">Найдено: {results.length}</span>
          {results.slice(0, 12).map(({ person }) => (
            <button key={person.id} onClick={() => select(person.id)}>
              <Avatar person={person} />
              <span>
                <strong>{fullName(person)}</strong>
                <small>
                  {years(person)}
                  {person.birth_place ? ` · ${person.birth_place}` : ''}
                </small>
              </span>
              <Crosshair size={15} />
            </button>
          ))}
          {!results.length && <p>Попробуйте другое имя или место.</p>}
        </div>
      )}
    </div>
  );
});
