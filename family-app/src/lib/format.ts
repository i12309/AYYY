import type { Family, Person, PersonWrite } from '../types';
import { formatDate, parseExactDate } from './dates';

/** A subtle, repeatable family accent; it never changes the genealogy document. */
export function familyTone(personId: string, families: Family[]): number {
  const own = families.filter((family) =>
    [family.partner1_id, family.partner2_id].includes(personId),
  );
  const memberships = own.length
    ? own
    : families.filter((family) => family.children.some((child) => child.person_id === personId));
  const key = memberships.map((family) => family.id).sort()[0] ?? personId;
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 5;
}

export function familyTones(persons: Person[], families: Family[]): Map<string, number> {
  const own = new Map<string, string>();
  const children = new Map<string, string>();
  const add = (index: Map<string, string>, id: string | null, familyId: string) => {
    if (id && (!index.has(id) || familyId < index.get(id)!)) index.set(id, familyId);
  };
  for (const family of families) {
    add(own, family.partner1_id, family.id);
    add(own, family.partner2_id, family.id);
    for (const child of family.children) add(children, child.person_id, family.id);
  }
  return new Map(
    persons.map((person) => {
      const key = own.get(person.id) ?? children.get(person.id) ?? person.id;
      let hash = 0;
      for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
      return [person.id, hash % 5];
    }),
  );
}

export function fullName(
  person: Pick<Person, 'given_name' | 'surname' | 'patronymic'>,
  patronymic = true,
): string {
  return (
    [person.given_name, patronymic && person.patronymic, person.surname]
      .filter(Boolean)
      .join(' ') || 'Имя неизвестно'
  );
}

export function initials(person: Pick<Person, 'given_name' | 'surname'>): string {
  return (
    `${person.given_name.trim()[0] || ''}${person.surname.trim()[0] || ''}`.toUpperCase() || '?'
  );
}

export function yearOf(date: string): string {
  const text = date.trim();
  if (!text) return '';
  const exact = parseExactDate(text);
  if (exact) return String(exact.year);
  if (/^\d{1,4}$/.test(text)) return text;
  const partial = /^(\S+)\s+(\d{4})$/.exec(text);
  if (partial && parseExactDate(`15 ${partial[1]} ${partial[2]}`)) return partial[2];
  const range = /^(BET|FROM)\s+(.+?)\s+(AND|TO)\s+(.+)$/i.exec(text);
  if (range)
    return `${range[1].toUpperCase() === 'BET' ? 'между' : 'с'} ${yearOf(range[2])} ${range[1].toUpperCase() === 'BET' ? 'и' : 'по'} ${yearOf(range[4])}`;
  const qualified = /^(ABT|CAL|EST|BEF|AFT|FROM|TO)\s+(.+)$/i.exec(text);
  if (qualified) {
    const prefix: Record<string, string> = {
      ABT: 'ок.',
      CAL: 'выч.',
      EST: 'прибл.',
      BEF: 'до',
      AFT: 'после',
      FROM: 'с',
      TO: 'по',
    };
    return `${prefix[qualified[1].toUpperCase()]} ${yearOf(qualified[2])}`;
  }
  return formatDate(text);
}

export function years(person: Pick<Person, 'birth_date' | 'death_date' | 'is_living'>): string {
  const born = yearOf(person.birth_date);
  const died = yearOf(person.death_date);
  if (!born && !died) return 'Даты не указаны';
  if (person.is_living && !died) return born ? `род. ${born}` : '';
  return `${born || '?'} — ${died || '?'}`;
}

export function personWord(count: number): string {
  const n = count % 100;
  return n >= 11 && n <= 14
    ? 'человек'
    : count % 10 === 1
      ? 'человек'
      : count % 10 >= 2 && count % 10 <= 4
        ? 'человека'
        : 'человек';
}

export function emptyPerson(): PersonWrite {
  return {
    given_name: '',
    surname: '',
    patronymic: '',
    maiden_name: '',
    sex: 'U',
    birth_date: '',
    birth_place: '',
    death_date: '',
    death_place: '',
    is_living: true,
    occupation: '',
    biography: '',
    biography_format: 'markdown',
    notes: '',
    events: [],
  };
}
