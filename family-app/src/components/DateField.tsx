import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  calendarDate,
  daysInMonth,
  formatDate,
  gedcomDate,
  initialCalendar,
  MONTHS,
  normalizeDate,
  parseExactDate,
  type CalendarDay,
} from '../lib/dates';
import '../date-field.css';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}
const inputText = (value: string) => (parseExactDate(value) ? formatDate(value) : value);

export function DateField({
  label,
  value,
  onChange,
  className = 'field',
  placeholder = '16 Марта 2022 или 1940',
}: Props) {
  const uid = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const textInput = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  const [text, setText] = useState(() => inputText(value));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => initialCalendar(value, new Date()));
  const [yearText, setYearText] = useState(String(view.year));
  const [activeDay, setActiveDay] = useState(view.day);
  const selected = parseExactDate(value);
  const year = /^\d{1,4}$/.test(yearText) && Number(yearText) >= 1 ? Number(yearText) : null;
  const days = year ? daysInMonth(year, view.month) : 0;
  const padding = year ? (calendarDate(year, view.month, 1).getUTCDay() + 6) % 7 : 0;
  useEffect(() => {
    if (!focused.current) setText(inputText(value));
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    const frame = requestAnimationFrame(() => {
      wrapper.current
        ?.querySelector<HTMLElement>('[data-date-calendar]')
        ?.scrollIntoView({ block: 'nearest' });
      wrapper.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${activeDay}"]`)
        ?.focus({ preventScroll: true });
    });
    return () => {
      document.removeEventListener('pointerdown', outside);
      cancelAnimationFrame(frame);
    };
  }, [open]);
  function showCalendar() {
    if (open) {
      setOpen(false);
      return;
    }
    const date = initialCalendar(value, new Date());
    setView(date);
    setYearText(String(date.year));
    setActiveDay(date.day);
    setOpen(true);
  }
  function choose(date: CalendarDay) {
    const next = gedcomDate(date);
    onChange(next);
    setText(inputText(next));
    setOpen(false);
    textInput.current?.focus({ preventScroll: true });
  }
  function moveMonth(step: number) {
    if (!year) return;
    const next = calendarDate(year, view.month + step, 1);
    if (next.getUTCFullYear() < 1 || next.getUTCFullYear() > 9999) return;
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth(), day: 1 });
    setYearText(String(next.getUTCFullYear()));
    setActiveDay(1);
  }
  function moveDay(day: number, step: number) {
    if (!year) return;
    const next = calendarDate(year, view.month, day + step);
    const nextYear = next.getUTCFullYear();
    if (nextYear < 1 || nextYear > 9999) return;
    setView({ year: nextYear, month: next.getUTCMonth(), day: next.getUTCDate() });
    setYearText(String(nextYear));
    setActiveDay(next.getUTCDate());
    requestAnimationFrame(() =>
      wrapper.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${next.getUTCDate()}"]`)
        ?.focus(),
    );
  }
  return (
    <div
      ref={wrapper}
      className={`${className} date-field`}
      data-date-field
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          textInput.current?.focus();
        }
        if (!open && event.altKey && event.key === 'ArrowDown') {
          event.preventDefault();
          showCalendar();
        }
      }}
    >
      <label htmlFor={`${uid}-input`}>{label}</label>
      <div className="date-input-row">
        <input
          ref={textInput}
          id={`${uid}-input`}
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            setText(inputText(value));
          }}
          onChange={(event) => {
            setText(event.target.value);
            onChange(normalizeDate(event.target.value));
          }}
        />
        <button
          type="button"
          className="date-calendar-trigger"
          aria-label={`Календарь: ${label}`}
          aria-expanded={open}
          aria-controls={`${uid}-calendar`}
          onClick={showCalendar}
        >
          <CalendarDays size={18} />
        </button>
      </div>
      {open && (
        <div
          id={`${uid}-calendar`}
          className="date-calendar"
          data-date-calendar
          role="dialog"
          aria-label={`Выбор даты: ${label}`}
        >
          <header>
            <strong>{label}</strong>
            <button
              type="button"
              className="icon-button"
              aria-label="Закрыть календарь"
              onClick={() => {
                setOpen(false);
                textInput.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          </header>
          <div className="date-calendar-navigation">
            <button
              type="button"
              className="icon-button"
              aria-label="Предыдущий месяц"
              disabled={!year || (year === 1 && view.month === 0)}
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <select
              aria-label="Месяц"
              value={view.month}
              onChange={(event) => {
                setView({ ...view, month: Number(event.target.value) });
                setActiveDay(1);
              }}
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>
            <input
              type="number"
              aria-label="Год"
              min="1"
              max="9999"
              value={yearText}
              onChange={(event) => {
                setYearText(event.target.value);
                setActiveDay(1);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Следующий месяц"
              disabled={!year || (year === 9999 && view.month === 11)}
              onClick={() => moveMonth(1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="date-calendar-week" aria-hidden="true">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="date-calendar-days">
            {Array.from({ length: padding }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                type="button"
                data-day={day}
                tabIndex={day === activeDay ? 0 : -1}
                className={
                  selected?.year === year && selected.month === view.month && selected.day === day
                    ? 'is-selected'
                    : ''
                }
                aria-pressed={
                  selected?.year === year && selected.month === view.month && selected.day === day
                }
                aria-label={formatDate(gedcomDate({ year: year!, month: view.month, day }))}
                onClick={() => choose({ year: year!, month: view.month, day })}
                onKeyDown={(event) => {
                  const steps: Record<string, number> = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  };
                  const step = steps[event.key];
                  if (step !== undefined) {
                    event.preventDefault();
                    moveDay(day, step);
                  }
                }}
              >
                {day}
              </button>
            ))}
          </div>
          {!year && <p role="status">Укажите год от 1 до 9999.</p>}
          <footer>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                choose({
                  year: new Date().getFullYear(),
                  month: new Date().getMonth(),
                  day: new Date().getDate(),
                })
              }
            >
              Сегодня
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                onChange('');
                setText('');
                setOpen(false);
                textInput.current?.focus();
              }}
            >
              Очистить дату
            </button>
          </footer>
          <p className="date-calendar-hint">
            Если день неизвестен, введите год или неточную дату в поле выше.
          </p>
        </div>
      )}
    </div>
  );
}
