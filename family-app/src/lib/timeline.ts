import type { Family, Person } from '../types';
import { calendarDate, MONTHS, parseExactDate } from './dates';
import { buildFamilyIndex, layoutTree } from './genealogy';
import { fullName } from './format';

export interface TimeAnchor {
  year: number;
  approximate: boolean;
  reason: string;
}
/** Coordinates for display only. Never replaces or completes a stored date. */
export function timeDate(value: string): TimeAnchor | null {
  const exact = parseExactDate(value);
  if (exact) {
    const start = calendarDate(exact.year, 0, 1).getTime();
    const end = calendarDate(exact.year + 1, 0, 1).getTime();
    return {
      year:
        exact.year +
        (calendarDate(exact.year, exact.month, exact.day).getTime() - start) / (end - start),
      approximate: false,
      reason: '',
    };
  }
  const qualified = /^(ABT|EST|CAL|BEF|AFT)\s+(.+)$/i.exec(value.trim());
  if (qualified) {
    const anchor = timeDate(qualified[2]);
    return anchor && { ...anchor, approximate: true, reason: 'Неточная дата в документе' };
  }
  const range = /^(?:BET|FROM)\s+(.+?)\s+(?:AND|TO)\s+(.+)$/i.exec(value.trim());
  if (range) {
    const a = timeDate(range[1]);
    const b = timeDate(range[2]);
    return (
      a &&
      b && { year: (a.year + b.year) / 2, approximate: true, reason: 'Середина указанного периода' }
    );
  }
  if (/^\d{1,4}$/.test(value.trim()) && Number(value) > 0)
    return { year: Number(value) + 0.5, approximate: true, reason: 'Известен только год' };
  const partial = /^(\S+)\s+(\d{4})$/.exec(value.trim());
  if (partial) {
    const names = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];
    const month = names.findIndex((name, i) =>
      [name, MONTHS[i].toLocaleUpperCase('ru')].includes(partial[1].toLocaleUpperCase('ru')),
    );
    if (month >= 0 && Number(partial[2]) > 0) {
      const middle = timeDate(`15 ${names[month]} ${partial[2]}`)!;
      return { ...middle, approximate: true, reason: 'Известны только месяц и год' };
    }
  }
  return null;
}

/** Use the full document: hiding a reference relative must not move a card. */
export function birthAnchors(persons: Person[], families: Family[]): Map<string, TimeAnchor> {
  const index = buildFamilyIndex(persons, families);
  const anchors = new Map<string, TimeAnchor>();
  const siblings = new Map<string, Set<string>>();
  for (const family of families)
    for (const child of family.children) {
      const peers = siblings.get(child.person_id) ?? new Set<string>();
      family.children.forEach((other) => {
        if (other.person_id !== child.person_id) peers.add(other.person_id);
      });
      siblings.set(child.person_id, peers);
    }
  for (const person of persons) {
    const anchor = timeDate(person.birth_date);
    if (anchor) anchors.set(person.id, anchor);
  }
  const ordered = [...persons].sort((a, b) => a.id.localeCompare(b.id));
  for (let round = 0; round < persons.length; round++) {
    const additions = new Map<string, TimeAnchor>();
    for (const person of ordered) {
      if (anchors.has(person.id)) continue;
      const choices = [
        { ids: siblings.get(person.id), offset: 0, text: 'На уровне брата или сестры' },
        {
          ids: index.parents.get(person.id),
          offset: 25,
          text: 'Через 25 лет после рождения родителя',
        },
        { ids: index.children.get(person.id), offset: -25, text: 'За 25 лет до рождения ребёнка' },
        { ids: index.partners.get(person.id), offset: 0, text: 'На уровне супруга' },
      ];
      for (const choice of choices) {
        const id = [...(choice.ids ?? [])]
          .filter((id) => anchors.has(id))
          .sort(
            (a, b) =>
              Number(anchors.get(a)!.approximate) - Number(anchors.get(b)!.approximate) ||
              a.localeCompare(b),
          )[0];
        if (!id) continue;
        const year = anchors.get(id)!.year + choice.offset;
        const death = timeDate(person.death_date);
        if (year < 1 || year > 9999 || (death && year > death.year)) continue;
        additions.set(person.id, {
          year,
          approximate: true,
          reason: `${choice.text}: ${fullName(index.persons.get(id)!)}`,
        });
        break;
      }
    }
    if (!additions.size) break;
    additions.forEach((anchor, id) => anchors.set(id, anchor));
  }
  return anchors;
}

export const LIFE_COLORS = [
  '#397f75',
  '#b07751',
  '#557fa5',
  '#997393',
  '#89914d',
  '#b36c73',
  '#527f8b',
  '#997d48',
];
export const LANE_WIDTH = 260;
export const CARD_HEIGHT = 108;
export function timelineLayout(
  persons: Person[],
  families: Family[],
  anchors: Map<string, TimeAnchor>,
  scale: number,
  today: number,
) {
  const tree = layoutTree(persons, families);
  const values = persons
    .flatMap((person) => [
      anchors.get(person.id)?.year,
      timeDate(person.death_date)?.year,
      person.is_living && anchors.has(person.id) ? today : undefined,
    ])
    .filter((value): value is number => value !== undefined);
  const start = Math.floor(Math.min(...values, today)) - 1;
  const end = Math.ceil(Math.max(...values, today)) + 1;
  const y = (year: number) => 72 + (year - start) * scale;
  const unplacedY = y(end) + 100;
  const lanes: number[] = [];
  const positions = new Map<
    string,
    { x: number; y: number; endY: number; lane: number; death: TimeAnchor | null; invalid: boolean }
  >();
  const sorted = [...persons].sort(
    (a, b) =>
      (anchors.get(a.id)?.year ?? Infinity) - (anchors.get(b.id)?.year ?? Infinity) ||
      (tree.positions.get(a.id)?.x ?? 0) - (tree.positions.get(b.id)?.x ?? 0) ||
      a.id.localeCompare(b.id),
  );
  for (const person of sorted) {
    const birth = anchors.get(person.id);
    const death = timeDate(person.death_date);
    const top = birth ? y(birth.year) : unplacedY;
    const invalid = !!(birth && death && death.year < birth.year);
    const endY =
      birth && death && !invalid
        ? y(death.year)
        : birth && person.is_living && today >= birth.year
          ? y(today)
          : top + 76;
    const free = lanes.findIndex((bottom) => bottom + 36 < top - 30);
    const lane = free < 0 ? lanes.length : free;
    lanes[lane] = Math.max(endY + 28, top + CARD_HEIGHT);
    positions.set(person.id, { x: lane * LANE_WIDTH + 36, y: top, endY, lane, death, invalid });
  }
  return {
    positions,
    start,
    end,
    y,
    unplacedY,
    width: Math.max(760, lanes.length * LANE_WIDTH + 72),
    height: persons.some((p) => !anchors.has(p.id)) ? unplacedY + CARD_HEIGHT + 80 : y(end) + 100,
  };
}
