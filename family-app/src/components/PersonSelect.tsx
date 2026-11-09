import { useId, useMemo, useState } from 'react';
import type { Person } from '../types';
import { fullName, years } from '../lib/format';
import { Avatar } from './Avatar';

export function PersonSelect({
  persons,
  value,
  onChange,
  label,
  placeholder = 'Не указан',
}: {
  persons: Person[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  placeholder?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const chosen = persons.find((person) => person.id === value);
  const choices = useMemo(
    () =>
      persons
        .filter((person) =>
          `${fullName(person)} ${years(person)} ${person.maiden_name}`
            .toLocaleLowerCase('ru')
            .includes(query.trim().toLocaleLowerCase('ru')),
        )
        .sort((a, b) => fullName(a).localeCompare(fullName(b), 'ru'))
        .slice(0, 100),
    [persons, query],
  );
  function choose(personId: string) {
    onChange(personId);
    setOpen(false);
    setQuery('');
  }
  return (
    <div
      className="person-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="person-select-input">
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={
            open && choices[active] ? `${id}-${choices[active].id}` : undefined
          }
          placeholder={placeholder}
          value={open ? query : chosen ? `${fullName(chosen)} · ${years(chosen)}` : ''}
          onFocus={() => {
            setOpen(true);
            setQuery('');
            setActive(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.min(index + 1, choices.length - 1));
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            }
            if (event.key === 'Enter' && open) {
              event.preventDefault();
              if (choices[active]) choose(choices[active].id);
            }
          }}
        />
        {value && (
          <button type="button" aria-label={`Очистить: ${label}`} onClick={() => choose('')}>
            ×
          </button>
        )}
      </div>
      {open && (
        <div role="listbox" id={`${id}-list`} className="person-select-options">
          {choices.map((person, index) => (
            <button
              type="button"
              role="option"
              aria-selected={person.id === value}
              id={`${id}-${person.id}`}
              key={person.id}
              className={index === active ? 'active' : ''}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(person.id)}
            >
              <Avatar person={person} />
              <span>
                <strong>{fullName(person)}</strong>
                <small>{years(person)}</small>
              </span>
            </button>
          ))}
          {!choices.length && <p>Совпадений нет</p>}
          {choices.length === 100 && <small>Уточните имя или год, чтобы сузить поиск.</small>}
        </div>
      )}
    </div>
  );
}
