export const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];
const MONTH_DATES = [
  'Января',
  'Февраля',
  'Марта',
  'Апреля',
  'Мая',
  'Июня',
  'Июля',
  'Августа',
  'Сентября',
  'Октября',
  'Ноября',
  'Декабря',
];
const GED_MONTHS = [
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
export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

export function daysInMonth(year: number, month: number): number {
  return (
    [
      31,
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ][month] ?? 0
  );
}

function monthIndex(value: string): number {
  const month = value.toLocaleUpperCase('ru');
  return GED_MONTHS.findIndex((ged, index) =>
    [
      ged,
      MONTHS[index].toLocaleUpperCase('ru'),
      MONTH_DATES[index].toLocaleUpperCase('ru'),
    ].includes(month),
  );
}

export function parseExactDate(value: string): CalendarDay | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const numeric = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text);
  const named = /^(\d{1,2})\s+(\S+)\s+(\d{1,4})$/.exec(text);
  const result = iso
    ? { year: Number(iso[1]), month: Number(iso[2]) - 1, day: Number(iso[3]) }
    : numeric
      ? { year: Number(numeric[3]), month: Number(numeric[2]) - 1, day: Number(numeric[1]) }
      : named
        ? { year: Number(named[3]), month: monthIndex(named[2]), day: Number(named[1]) }
        : null;
  return result &&
    result.year >= 1 &&
    result.year <= 9999 &&
    result.month >= 0 &&
    result.month <= 11 &&
    result.day >= 1 &&
    result.day <= daysInMonth(result.year, result.month)
    ? result
    : null;
}

export function gedcomDate(date: CalendarDay): string {
  return `${date.day} ${GED_MONTHS[date.month]} ${String(date.year).padStart(4, '0')}`;
}

/** Presentation only: unknown syntax and calendar qualifiers remain untouched. */
export function formatDate(value: string): string {
  const range = /^(BET|FROM)\s+(.+?)\s+(AND|TO)\s+(.+)$/i.exec(value.trim());
  if (range)
    return range[1].toUpperCase() === 'BET'
      ? `Между ${formatDate(range[2])} и ${formatDate(range[4])}`
      : `С ${formatDate(range[2])} по ${formatDate(range[4])}`;
  const openRange = /^(FROM|TO)\s+(.+)$/i.exec(value.trim());
  if (openRange)
    return `${openRange[1].toUpperCase() === 'FROM' ? 'С' : 'По'} ${formatDate(openRange[2])}`;
  const exact = parseExactDate(value);
  if (exact) return `${exact.day} ${MONTH_DATES[exact.month]} ${exact.year}`;
  const partial = /^(\S+)\s+(\d{4})$/.exec(value.trim());
  if (partial && monthIndex(partial[1]) >= 0)
    return `${MONTHS[monthIndex(partial[1])]} ${partial[2]}`;
  const approximate = /^(ABT|BEF|AFT|CAL|EST)\s+(.+)$/i.exec(value.trim());
  if (approximate) {
    const prefixes: Record<string, string> = {
      ABT: 'Около',
      BEF: 'До',
      AFT: 'После',
      CAL: 'Вычислено:',
      EST: 'Приблизительно',
    };
    return `${prefixes[approximate[1].toUpperCase()]} ${formatDate(approximate[2])}`;
  }
  return value;
}

export function normalizeDate(value: string): string {
  const exact = parseExactDate(value);
  return exact ? gedcomDate(exact) : value;
}

/** Monday-first weekday; UTC is used only for calendar arithmetic, never for stored dates. */
export function calendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date;
}

export function initialCalendar(value: string, today: Date): CalendarDay {
  const exact = parseExactDate(value);
  if (exact) return exact;
  const partial = /^(\S+)\s+(\d{4})$/.exec(value.trim());
  const year = /\b(\d{4})\b/.exec(value);
  return {
    year: year && Number(year[1]) > 0 ? Number(year[1]) : today.getFullYear(),
    month: partial && monthIndex(partial[1]) >= 0 ? monthIndex(partial[1]) : today.getMonth(),
    day: 1,
  };
}
