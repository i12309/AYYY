/* Geometry and validation stay separate from SVG and pointer handling. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ShapeRules = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const COLORS = ['#e88d91', '#f1bd57', '#65b5a5', '#699ed4', '#9e83cf'];
  const TYPES = {
    triangle: { name: 'Треугольник', icon: '▲', period: 360, points: [[0, -40], [40, 40], [-40, 40]] },
    square: { name: 'Квадрат', icon: '■', period: 90, points: [[-40, -40], [40, -40], [40, 40], [-40, 40]] },
    circle: { name: 'Круг', icon: '●', period: 1 },
    bar: { name: 'Прямоугольник', icon: '▬', period: 180, points: [[-50, -20], [50, -20], [50, 20], [-50, 20]] }
  };
  const piece = (type, x, y, rot = 0, color = 0) => ({ type, x, y, rot, color });
  const LEVELS = [
    { id: 'house', title: '1. Солнечный дом', mode: 'silhouette', targets: [piece('square', 320, 240, 0, 0), piece('triangle', 320, 160, 0, 3), piece('circle', 455, 115, 0, 1), piece('bar', 320, 305, 0, 2)] },
    { id: 'boat', title: '2. Парусник', mode: 'silhouette', targets: [piece('triangle', 270, 180, 90, 1), piece('triangle', 350, 180, 270, 0), piece('bar', 310, 265, 0, 3), piece('circle', 465, 110, 0, 1)] },
    { id: 'fish', title: '3. Рыбка', mode: 'silhouette', targets: [piece('square', 310, 210, 0, 1), piece('triangle', 390, 210, 270, 0), piece('circle', 190, 125, 0, 3), piece('circle', 160, 230, 0, 2)] },
    { id: 'rocket', title: '4. Поверни: ракета', mode: 'rotation', targets: [piece('triangle', 320, 115, 0, 0), piece('bar', 320, 205, 90, 3), piece('triangle', 260, 245, 270, 2), piece('triangle', 380, 245, 90, 1)] },
    { id: 'tree', title: '5. Поверни: ёлка', mode: 'rotation', targets: [piece('triangle', 320, 105, 0, 2), piece('triangle', 320, 185, 0, 2), piece('triangle', 320, 265, 0, 2), piece('bar', 320, 335, 90, 1)] },
    { id: 'windmill', title: '6. Поверни: мельница', mode: 'rotation', targets: [piece('triangle', 280, 155, 90, 0), piece('triangle', 360, 155, 180, 1), piece('triangle', 360, 235, 270, 3), piece('triangle', 280, 235, 0, 2)] },
    { id: 'butterfly', title: '7. Зеркало: бабочка', mode: 'mirror', targets: [piece('triangle', 380, 150, 90, 0), piece('triangle', 380, 240, 90, 3), piece('bar', 340, 100, 90, 1)], fixed: [piece('triangle', 260, 150, 270, 0), piece('triangle', 260, 240, 270, 3), piece('bar', 300, 100, 90, 1)] },
    { id: 'robot', title: '8. Зеркало: робот', mode: 'mirror', targets: [piece('square', 380, 150, 0, 3), piece('circle', 445, 240, 0, 1), piece('bar', 380, 300, 90, 2)], fixed: [piece('square', 260, 150, 0, 3), piece('circle', 195, 240, 0, 1), piece('bar', 260, 300, 90, 2)] },
    { id: 'garden', title: '9. Зеркало: сад', mode: 'mirror', targets: [piece('triangle', 430, 145, 0, 2), piece('bar', 430, 235, 90, 1), piece('circle', 355, 315, 0, 0)], fixed: [piece('triangle', 210, 145, 0, 2), piece('bar', 210, 235, 90, 1), piece('circle', 285, 315, 0, 0)] },
    { id: 'free', title: 'Свободная мастерская', mode: 'free', targets: [] }
  ];
  const byId = id => LEVELS.find(l => l.id === id) || LEVELS[0];
  const rotate = a => ((a % 360) + 360) % 360;
  function initial(id) {
    const level = byId(id);
    return level.targets.map((t, i) => ({ ...t, id: i + 1, x: 105 + i * 130, y: 420, rot: level.mode === 'rotation' ? rotate(t.rot + 90 + i * 90) : 0 }));
  }
  function validPieces(raw) {
    if (!Array.isArray(raw) || raw.length > 40) return null;
    const ids = new Set();
    for (const p of raw) {
      if (!p || !Number.isInteger(p.id) || p.id < 1 || p.id > 1000000 || ids.has(p.id) || !Object.hasOwn(TYPES, p.type) ||
        !Number.isFinite(p.x) || p.x < 40 || p.x > 600 || !Number.isFinite(p.y) || p.y < 40 || p.y > 440 ||
        !Number.isInteger(p.rot) || p.rot < 0 || p.rot >= 360 || p.rot % 90 || !Number.isInteger(p.color) || p.color < 0 || p.color >= COLORS.length) return null;
      ids.add(p.id);
    }
    return raw.map(p => ({ id: p.id, type: p.type, x: p.x, y: p.y, rot: p.rot, color: p.color }));
  }
  function matches(p, t, tolerance = 1, mirror = false) {
    return p.type === t.type && Math.hypot(p.x - t.x, p.y - t.y) <= tolerance && rotate(p.rot - t.rot) % TYPES[p.type].period === 0 && (!mirror || p.color === t.color);
  }
  function snap(pieces, id, level) {
    const p = pieces.find(x => x.id === id); if (!p) return false;
    const target = level.targets.find(t => matches(p, t, 24, level.mode === 'mirror') && !pieces.some(other => other.id !== id && matches(other, t, 1, level.mode === 'mirror')));
    if (!target) return false; p.x = target.x; p.y = target.y; return true;
  }
  function solved(pieces, level) {
    if (!level.targets.length || pieces.length !== level.targets.length) return false;
    const used = new Set();
    return level.targets.every(t => { const p = pieces.find(p => !used.has(p.id) && matches(p, t, 1, level.mode === 'mirror')); if (!p) return false; used.add(p.id); return true; });
  }
  function validForLevel(pieces, level) {
    const valid = validPieces(pieces); if (!valid) return null;
    if (level.mode !== 'free' && (valid.length !== level.targets.length || valid.map(p => p.type).sort().join() !== level.targets.map(p => p.type).sort().join())) return null;
    if (level.mode === 'mirror' && valid.map(p => `${p.type}:${p.color}`).sort().join() !== level.targets.map(p => `${p.type}:${p.color}`).sort().join()) return null;
    return valid;
  }
  return { COLORS, TYPES, LEVELS, byId, rotate, initial, validPieces, matches, snap, solved, validForLevel };
});
