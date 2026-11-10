import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Crosshair, MoreHorizontal } from 'lucide-react';
import type { Family, Person } from '../types';
import { fullName } from '../lib/format';
import { formatDate, MONTHS } from '../lib/dates';
import { birthAnchors, LIFE_COLORS, timeDate, timelineLayout } from '../lib/timeline';
import { Avatar } from './Avatar';
import '../generation-map.css';

interface Props {
  persons: Person[];
  allPersons: Person[];
  families: Family[];
  allFamilies: Family[];
  rootId: string | null;
  onFocus: (id: string) => void;
  onOpenPerson: (id: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}

export function GenerationMap({
  persons,
  allPersons,
  families,
  allFamilies,
  rootId,
  onFocus,
  onOpenPerson,
  onContextMenu,
}: Props) {
  const [scale, setScale] = useState(36);
  const [zoom, setZoom] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [allLinks, setAllLinks] = useState(true);
  const viewport = useRef<HTMLDivElement>(null);
  const today = new Date();
  const todayYear = timeDate(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
  )!.year;
  const anchors = useMemo(() => birthAnchors(allPersons, allFamilies), [allPersons, allFamilies]);
  const layout = useMemo(
    () => timelineLayout(persons, families, anchors, scale, todayYear),
    [persons, families, anchors, scale, todayYear],
  );
  const focus = rootId && layout.positions.get(rootId);
  const center = () => {
    if (!focus || !viewport.current) return;
    viewport.current.scrollTo({
      left: Math.max(0, (focus.x + 100) * zoom - viewport.current.clientWidth / 2),
      top: Math.max(0, focus.y * zoom - 140),
      behavior: 'instant',
    });
  };
  useEffect(center, [rootId, layout, zoom]);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(() => {
      setViewportHeight(viewport.current!.clientHeight);
      center();
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [layout, rootId, zoom]);
  const effectiveScale = scale * zoom;
  const ticks: { y: number; label: string; major: boolean }[] = [];
  const from = Math.max(
    layout.start,
    Math.floor(layout.start + (scrollTop - 72 * zoom) / effectiveScale),
  );
  const to = Math.min(
    layout.end,
    Math.ceil(layout.start + (scrollTop + viewportHeight - 72 * zoom) / effectiveScale),
  );
  const yearStep =
    [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000].find((step) => step * effectiveScale >= 28) ?? 1000;
  for (let year = from; year <= to; year++) {
    if (year < 1 || year > 9999) continue;
    if (year % yearStep === 0)
      ticks.push({ y: layout.y(year) * zoom - scrollTop, label: String(year), major: true });
    if (effectiveScale >= 144)
      for (let month = 1; month < 12; month++) {
        const date = timeDate(`${year}-${String(month + 1).padStart(2, '0')}-01`)!;
        ticks.push({
          y: layout.y(date.year) * zoom - scrollTop,
          label: MONTHS[month].slice(0, 3).toLocaleLowerCase('ru'),
          major: false,
        });
      }
  }
  const linked = new Set(
    families
      .filter((family) =>
        [
          family.partner1_id,
          family.partner2_id,
          ...family.children.map((child) => child.person_id),
        ].includes(rootId ?? ''),
      )
      .map((family) => family.id),
  );
  const undated = persons.filter((p) => !anchors.has(p.id)).length;
  if (!persons.length)
    return (
      <div className="empty-state">
        <h2>Все ветки скрыты</h2>
        <p>Разверните ветки в фильтрах.</p>
      </div>
    );
  return (
    <div className="generation-map">
      <header className="generation-map-toolbar">
        <div>
          <strong>Карта жизни</strong>
          <span>Рождение → жизнь → смерть. Время идёт сверху вниз.</span>
        </div>
        <div className="timeline-controls">
          <label>
            Шкала
            <select
              aria-label="Масштаб времени"
              value={scale}
              onChange={(event) => {
                setScale(Number(event.target.value));
                setZoom(1);
              }}
            >
              <option value={12}>Обзор · 5 лет</option>
              <option value={36}>Годы</option>
              <option value={180}>Месяцы</option>
              <option value={720}>Подробно · месяцы</option>
            </select>
          </label>
          <label>
            Размер
            <select
              aria-label="Масштаб карты"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            >
              {![0.5, 0.75, 1, 1.25, 1.5].includes(zoom) && (
                <option value={zoom}>Обзор · {Math.round(zoom * 100)}%</option>
              )}
              {[0.5, 0.75, 1, 1.25, 1.5].map((value) => (
                <option key={value} value={value}>
                  {value * 100}%
                </option>
              ))}
            </select>
          </label>
          <button
            className="button secondary"
            onClick={() => {
              if (!viewport.current) return;
              setZoom(
                Math.max(
                  0.01,
                  Math.min(
                    1,
                    (viewport.current.clientWidth - 24) / layout.width,
                    (viewport.current.clientHeight - 24) / layout.height,
                  ),
                ),
              );
            }}
          >
            Вся карта
          </button>
          <button
            className="button secondary"
            onClick={() => {
              if (zoom === 1) center();
              else setZoom(1);
            }}
            disabled={!focus}
          >
            <Crosshair size={15} />К выбранному
          </button>
          <label>
            <input
              type="checkbox"
              checked={allLinks}
              onChange={(event) => setAllLinks(event.target.checked)}
            />
            Все связи
          </label>
        </div>
      </header>
      <div className="timeline-window">
        {['left', 'right'].map((side) => (
          <div
            key={side}
            className={`timeline-axis timeline-axis-${side}`}
            aria-label={`Шкала времени ${side === 'left' ? 'слева' : 'справа'}`}
          >
            {ticks.map((tick) => (
              <span
                key={`${tick.label}-${tick.y}`}
                className={tick.major ? 'year-tick' : 'month-tick'}
                style={{ top: tick.y }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        ))}
        <div
          className="timeline-scroll"
          ref={viewport}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          tabIndex={0}
          aria-label="Карта жизни: прокрутка по годам и семьям"
        >
          <div
            className="timeline-canvas"
            style={{ width: layout.width, height: layout.height, zoom }}
          >
            <svg
              className="timeline-lines"
              width={layout.width}
              height={layout.height}
              aria-hidden="true"
            >
              {Array.from({ length: layout.end - layout.start + 1 }, (_, i) => layout.start + i)
                .filter((year) => year % yearStep === 0)
                .map((year) => (
                  <line
                    key={year}
                    className="timeline-year-line"
                    x1={0}
                    x2={layout.width}
                    y1={layout.y(year)}
                    y2={layout.y(year)}
                  />
                ))}
              <line
                className="timeline-today"
                x1={0}
                x2={layout.width}
                y1={layout.y(todayYear)}
                y2={layout.y(todayYear)}
              />
              {families.map((family, familyIndex) => {
                const parents = [family.partner1_id, family.partner2_id].filter(
                  (id): id is string => !!id && layout.positions.has(id),
                );
                const children = family.children.filter((child) =>
                  layout.positions.has(child.person_id),
                );
                const points = [...parents, ...children.map((child) => child.person_id)].map((id) =>
                  layout.positions.get(id)!,
                );
                if (!points.length || (!allLinks && !linked.has(family.id))) return null;
                const marriage = timeDate(family.marriage_date);
                const joinY = marriage
                  ? layout.y(marriage.year)
                  : children.length
                    ? Math.min(...children.map((child) => layout.positions.get(child.person_id)!.y))
                    : Math.max(...points.map((point) => point.y));
                const minX = Math.min(...points.map((point) => point.x));
                const maxX = Math.max(...points.map((point) => point.x));
                return (
                  <g
                    key={family.id}
                    data-family-id={family.id}
                    className={`timeline-family ${linked.has(family.id) ? 'is-highlighted' : ''}`}
                    stroke={LIFE_COLORS[familyIndex % LIFE_COLORS.length]}
                  >
                    <title>
                      Семья:{' '}
                      {parents.map((id) => fullName(persons.find((p) => p.id === id)!)).join(' и ')}
                    </title>
                    <path d={`M ${minX} ${joinY} H ${maxX}`} />
                    {parents.map((id) => {
                      const p = layout.positions.get(id)!;
                      const attach = Math.min(p.endY, Math.max(p.y, joinY));
                      return (
                        <path
                          key={id}
                          d={`M ${p.x} ${attach} L ${p.x + 9} ${attach} V ${joinY} H ${p.x}`}
                        />
                      );
                    })}
                    {children.map((child) => {
                      const p = layout.positions.get(child.person_id)!;
                      return (
                        <path
                          key={child.person_id}
                          strokeDasharray={
                            child.pedigree === 'adopted' || child.pedigree === 'foster'
                              ? '5 4'
                              : undefined
                          }
                          d={`M ${p.x} ${joinY} H ${p.x - 12} V ${p.y} H ${p.x}`}
                        />
                      );
                    })}
                  </g>
                );
              })}
              {persons.map((person) => {
                const p = layout.positions.get(person.id)!;
                const birth = anchors.get(person.id);
                const color = LIFE_COLORS[p.lane % LIFE_COLORS.length];
                return (
                  <g key={person.id} data-life-id={person.id} stroke={color}>
                    {birth && (
                      <line
                        className="timeline-life"
                        strokeDasharray={
                          birth.approximate || (!p.death && !person.is_living) ? '5 4' : undefined
                        }
                        x1={p.x}
                        x2={p.x}
                        y1={p.y}
                        y2={p.endY}
                      />
                    )}
                    <circle cx={p.x} cy={p.y} r={4} fill={color} />
                    <line x1={p.x} x2={p.x + 18} y1={p.y} y2={p.y} />
                    {birth && p.death && !p.invalid && (
                      <path
                        data-death-id={person.id}
                        className="timeline-death"
                        strokeDasharray={p.death.approximate ? '2 2' : undefined}
                        d={`M ${p.x - 6} ${p.endY} H ${p.x + 6} M ${p.x} ${p.endY - 8} V ${p.endY + 8}`}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
            <span className="timeline-today-label" style={{ top: layout.y(todayYear) }}>
              Сегодня · {today.getFullYear()}
            </span>
            {undated > 0 && (
              <div className="timeline-undated" style={{ top: layout.unplacedY - 60 }}>
                Без опорной даты · {undated} чел. Нет дат у человека и связанных родственников.
              </div>
            )}
            {persons.map((person) => {
              const p = layout.positions.get(person.id)!;
              const birth = anchors.get(person.id);
              const color = LIFE_COLORS[p.lane % LIFE_COLORS.length];
              const estimated = birth && !timeDate(person.birth_date);
              return (
                <div key={person.id}>
                  <article
                    className={`timeline-person ${rootId === person.id ? 'is-current' : ''}`}
                    data-person-id={person.id}
                    data-year={birth?.year ?? ''}
                    data-estimated={!!estimated}
                    style={
                      { left: p.x + 18, top: p.y - 25, '--life-color': color } as CSSProperties
                    }
                  >
                    <button
                      className="timeline-person-focus"
                      onClick={() => {
                        setZoom(1);
                        onFocus(person.id);
                      }}
                      onDoubleClick={() => onOpenPerson(person.id)}
                      aria-label={`Перейти к ${fullName(person)}`}
                    >
                      <Avatar person={person} />
                      <strong title={fullName(person)}>{fullName(person, false)}</strong>
                      <small>
                        {estimated
                          ? `≈ ${Math.floor(birth.year)} · расчёт`
                          : person.birth_date
                            ? formatDate(person.birth_date)
                            : 'Рождение неизвестно'}
                      </small>
                    </button>
                    {birth?.approximate && (
                      <span className="timeline-estimate" title={birth.reason}>
                        {birth.reason}
                      </span>
                    )}
                    <div className="timeline-person-actions">
                      <button className="text-button" onClick={() => onOpenPerson(person.id)}>
                        Биография
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Действия: ${fullName(person)}`}
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          onContextMenu(person.id, rect.right, rect.bottom);
                        }}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                  </article>
                  {birth && (
                    <span
                      className={`timeline-end ${p.invalid ? 'is-invalid' : ''}`}
                      data-end-id={person.id}
                      style={{ left: p.x - 2, top: Math.max(p.endY + 12, p.y + 90), color }}
                    >
                      {p.invalid
                        ? 'Смерть раньше рождения: проверьте даты'
                        : p.death
                          ? `† ${formatDate(person.death_date)}`
                          : person.is_living
                            ? 'Живёт · до сегодня'
                            : '… Дата смерти неизвестна'}
                    </span>
                  )}
                  {!birth && person.death_date && (
                    <span className="timeline-end" style={{ left: p.x + 18, top: p.y + 95 }}>
                      † {formatDate(person.death_date)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="generation-map-tip">
        Прокрутка по вертикали — время, по горизонтали — семьи. ≈ — расчёт или неточная дата;
        пунктир — неопределённость. Фильтры веток слева действуют и здесь. Расчёты не записываются в
        дерево.
      </p>
    </div>
  );
}
