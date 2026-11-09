/* Small deterministic circle/segment solver, world units are independent of pixels. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MarbleLab = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const WIDTH = 640, HEIGHT = 480, RADIUS = 10, DT = 1 / 120;
  const part = (id, x, y, angle, type = 'rail', length = 160) => ({ id, x, y, angle, type, length });
  const route = (direction, offset, angle = 25) => {
    const dx = 160 * Math.cos(angle * Math.PI / 180), dy = 160 * Math.sin(angle * Math.PI / 180);
    const first = direction === 1 ? 155 : 485;
    return [0, 1, 2].map(i => part(i + 1, first + direction * i * dx, 145 + offset + i * dy, direction * angle));
  };
  const LEVELS = [
    { id: 'bridge', title: '1. Недостающий жёлоб', text: 'Соедини два зелёных жёлоба. Шарик должен докатиться до чашки.', spawn: { x: 102, y: 40 }, goal: { x: 525, y: 310 }, reference: route(1, 0), missing: [1] },
    { id: 'slope', title: '2. Длинная горка', text: 'Продолжи горку двумя жёлобами. Нажми на деталь, чтобы повернуть её.', spawn: { x: 102, y: 40 }, goal: { x: 525, y: 310 }, reference: route(1, 0), missing: [1, 2] },
    { id: 'left', title: '3. Другой берег', text: 'Теперь финиш слева. Поверни жёлобы в другую сторону.', spawn: { x: 538, y: 35 }, goal: { x: 115, y: 310 }, reference: route(-1, 0), missing: [1, 2] },
    { id: 'funnel', title: '4. Собери в воронку', text: 'Поставь воронку под стартом, а жёлоб — под ней. Можно попробовать своё решение.', spawn: { x: 95, y: 25 }, goal: { x: 525, y: 340 }, reference: [part(1, 102, 88, 0, 'funnel'), ...route(1, 30).map((p, i) => ({ ...p, id: i + 2 }))], missing: [0, 2] },
    { id: 'spring', title: '5. Пружинный прыжок', text: 'Шарик подпрыгнет на пружине. Воронка поможет ему вернуться к финишу.', spawn: { x: 320, y: 30 }, goal: { x: 550, y: 410 }, reference: [part(1, 320, 190, 25, 'spring', 100), part(2, 550, 290, 0, 'funnel')], missing: [0, 1] },
    { id: 'engineer', title: '6. Построй сам', text: 'На поле только старт и финиш. Построй путь из любых деталей.', spawn: { x: 102, y: 40 }, goal: { x: 525, y: 310 }, reference: route(1, 0), missing: [0, 1, 2] },
    { id: 'free', title: 'Свободная мастерская', text: 'Строй трассу, переставляй старт и чашку, запускай один или три шарика.', spawn: { x: 110, y: 45 }, goal: { x: 525, y: 310 }, reference: [], missing: [] }
  ];
  const byId = id => LEVELS.find(l => l.id === id) || LEVELS[0];
  const fixed = level => level.reference.filter((_, i) => !level.missing.includes(i));
  const solution = level => level.reference.filter((_, i) => level.missing.includes(i)).map(p => ({ ...p }));
  function validPoint(p) { return p && Number.isFinite(p.x) && p.x >= 25 && p.x <= 615 && Number.isFinite(p.y) && p.y >= 20 && p.y <= 450; }
  function validDesign(raw) {
    if (!raw || !Array.isArray(raw.parts) || raw.parts.length > 30 || !validPoint(raw.spawn) || !validPoint(raw.goal)) return null;
    const ids = new Set();
    for (const p of raw.parts) {
      if (!p || !['rail', 'funnel', 'spring'].includes(p.type) || !Number.isInteger(p.id) || p.id < 1 || p.id > 1000000 || ids.has(p.id) ||
        !validPoint(p) || !Number.isFinite(p.angle) || p.angle < -180 || p.angle > 180 || !Number.isFinite(p.length) || p.length < 60 || p.length > 240) return null;
      ids.add(p.id);
    }
    return { parts: raw.parts.map(p => ({ id: p.id, type: p.type, x: p.x, y: p.y, angle: p.angle, length: p.length })), spawn: { x: raw.spawn.x, y: raw.spawn.y }, goal: { x: raw.goal.x, y: raw.goal.y } };
  }
  function segments(p) {
    const a = p.angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const transform = ([x, y]) => ({ x: p.x + x * c - y * s, y: p.y + x * s + y * c });
    const pairs = p.type === 'funnel' ? [[[-60, -30], [-14, 35]], [[60, -30], [14, 35]]] : [[[-p.length / 2, 0], [p.length / 2, 0]]];
    return pairs.map(([a, b]) => ({ a: transform(a), b: transform(b), spring: p.type === 'spring' }));
  }
  function closest(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, n = dx * dx + dy * dy;
    const t = n ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / n)) : 0;
    return { x: a.x + t * dx, y: a.y + t * dy };
  }
  function ballAt(spawn) { return { x: spawn.x, y: spawn.y, vx: 0, vy: 0, time: 0, springWait: 0, status: 'moving' }; }
  function step(ball, colliders, goal, dt = DT) {
    if (ball.status !== 'moving') return ball.status;
    dt = Math.max(0, Math.min(DT, Number(dt) || 0)); ball.time += dt; ball.springWait = Math.max(0, ball.springWait - dt);
    ball.vy += 420 * dt; ball.vx *= Math.pow(.997, dt / DT);
    const speed = Math.hypot(ball.vx, ball.vy); if (speed > 650) { ball.vx *= 650 / speed; ball.vy *= 650 / speed; }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    for (let pass = 0; pass < 2; pass++) for (const line of colliders) {
      const q = closest(ball, line.a, line.b), dx = ball.x - q.x, dy = ball.y - q.y, d = Math.hypot(dx, dy);
      if (d >= RADIUS + 3) continue;
      let nx = dx / (d || 1), ny = dy / (d || 1);
      if (d < 1e-6) { const l = Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y); nx = (line.b.y - line.a.y) / l; ny = -(line.b.x - line.a.x) / l; }
      const penetration = RADIUS + 3 - d; ball.x += nx * penetration; ball.y += ny * penetration;
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        const rebound = line.spring && ball.springWait <= 0 && vn < -20 ? Math.max(240, -vn * .85) : -vn * .03;
        ball.vx += (rebound - vn) * nx; ball.vy += (rebound - vn) * ny;
        if (line.spring && rebound >= 240) ball.springWait = .2;
      }
    }
    if (Math.abs(ball.x - goal.x) < 32 && ball.y > goal.y - 25 && ball.y < goal.y + 25) ball.status = 'won';
    else if (ball.y > HEIGHT + 35 || ball.x < -40 || ball.x > WIDTH + 40 || ball.time >= 20) ball.status = 'lost';
    return ball.status;
  }
  function simulate(design, extra = []) {
    const b = ballAt(design.spawn), lines = [...extra, ...design.parts].flatMap(segments);
    for (let i = 0; i < 2401 && b.status === 'moving'; i++) step(b, lines, design.goal);
    return b;
  }
  return { WIDTH, HEIGHT, RADIUS, DT, LEVELS, byId, part, fixed, solution, validPoint, validDesign, segments, closest, ballAt, step, simulate };
});
