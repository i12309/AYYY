/* Mahjong solitaire rules and constructive layouts. Pure logic, browser + Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MahjongRules = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const LEVELS = Object.freeze([
    { id: 'garden', title: 'Цветочный сад', short: '16 фишек', difficulty: 'easy', cols: 4, rows: 4, tiers: [] },
    { id: 'friends', title: 'Зверята', short: '24 фишки', difficulty: 'easy', cols: 6, rows: 4, tiers: [] },
    { id: 'lanterns', title: 'Фонарики', short: '28 фишек · 2 этажа', difficulty: 'medium', cols: 6, rows: 4, tiers: [{ cols: 2, rows: 2 }] },
    { id: 'temple', title: 'Старинный храм', short: '44 фишки · 2 этажа', difficulty: 'medium', cols: 6, rows: 6, tiers: [{ cols: 4, rows: 2 }] },
    { id: 'turtle', title: 'Черепашка', short: '68 фишек · 3 этажа', difficulty: 'hard', cols: 8, rows: 6, tiers: [{ cols: 4, rows: 4 }, { cols: 2, rows: 2 }] }
  ]);
  const SYMBOLS = Object.freeze([
    { icon: '🌸', title: 'Сакура' }, { icon: '🌼', title: 'Ромашка' },
    { icon: '🌺', title: 'Цветок' }, { icon: '🍀', title: 'Клевер' },
    { icon: '🍓', title: 'Клубника' }, { icon: '🍋', title: 'Лимон' },
    { icon: '🍄', title: 'Грибок' }, { icon: '🦋', title: 'Бабочка' },
    { icon: '🐼', title: 'Панда' }, { icon: '🐱', title: 'Котик' },
    { icon: '🦊', title: 'Лисичка' }, { icon: '🐸', title: 'Лягушка' },
    { icon: '🐢', title: 'Черепашка' }, { icon: '🐙', title: 'Осьминог' },
    { icon: '🐞', title: 'Божья коровка' }, { icon: '☀️', title: 'Солнце' },
    { icon: '🌙', title: 'Луна' }, { icon: '⭐', title: 'Звезда' },
    { icon: '🎈', title: 'Шарик' }, { icon: '🎁', title: 'Подарок' },
    { icon: '🧸', title: 'Мишка' }, { icon: '🚀', title: 'Ракета' },
    { icon: '🍉', title: 'Арбуз' }, { icon: '🪁', title: 'Воздушный змей' }
  ]);
  const levelById = id => LEVELS.find(level => level.id === id) || null;
  function random(seed) {
    let value = (seed >>> 0) || 1;
    return () => {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      return (value >>> 0) / 4294967296;
    };
  }
  function shuffle(array, rng) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  function positions(levelId) {
    const level = levelById(levelId);
    if (!level) throw new Error('Unknown Mahjong level');
    const all = [];
    const add = (cols, rows, layer) => {
      const offsetX = Math.floor((level.cols - cols) / 2);
      const offsetY = Math.floor((level.rows - rows) / 2);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
        all.push({ id: all.length, col: c + offsetX, row: r + offsetY, layer });
    };
    add(level.cols, level.rows, 0);
    level.tiers.forEach((t, index) => add(t.cols, t.rows, index + 1));
    if (all.length % 2) throw new Error('Layout must have even tile count');
    return all;
  }
  function freeTile(tile, tiles, removed) {
    if (removed.has(tile.id)) return false;
    for (const other of tiles) {
      if (removed.has(other.id)) continue;
      if (other.layer > tile.layer && other.col === tile.col && other.row === tile.row) return false;
    }
    let left = false, right = false;
    for (const other of tiles) {
      if (removed.has(other.id) || other.layer !== tile.layer || other.row !== tile.row) continue;
      if (other.col === tile.col - 1) left = true;
      if (other.col === tile.col + 1) right = true;
      if (left && right) return false;
    }
    return true;
  }
  function freeTiles(tiles, removed) { return tiles.filter(tile => freeTile(tile, tiles, removed)); }
  function removablePairs(tiles, symbols, removed) {
    const grouped = new Map();
    for (const tile of freeTiles(tiles, removed)) {
      const key = symbols[tile.id];
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(tile.id);
    }
    const result = [];
    for (const ids of grouped.values())
      for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) result.push([ids[a], ids[b]]);
    return result;
  }
  function makePlan(tiles, removed, seed) {
    const seeded = random(seed);
    // Retry random geometric pair eliminations to avoid leaving one tile covered by its mate.
    for (let attempt = 0; attempt < 140; attempt++) {
      const gone = new Set(removed);
      const pairs = [];
      while (gone.size < tiles.length) {
        const available = freeTiles(tiles, gone);
        if (available.length < 2) break;
        // Peeling upper tiers first generally protects the bottom layers from dead ends.
        const sorted = shuffle(available.slice(), seeded).sort((a, b) => b.layer - a.layer);
        const first = sorted[Math.floor(seeded() * Math.min(3, sorted.length))];
        const candidates = shuffle(available.filter(t => t.id !== first.id), seeded);
        let second = candidates[0];
        // Avoid producing an immediate geometric lock if possible.
        for (const option of candidates) {
          const trial = new Set([...gone, first.id, option.id]);
          if (trial.size === tiles.length || freeTiles(tiles, trial).length >= 2) { second = option; break; }
        }
        gone.add(first.id); gone.add(second.id);
        pairs.push([first.id, second.id]);
      }
      if (gone.size === tiles.length) return pairs;
    }
    return null;
  }
  function generate(levelId, seed) {
    const tiles = positions(levelId);
    const plan = makePlan(tiles, new Set(), seed ^ 0x4d41484a);
    if (!plan) throw new Error('Could not build solvable Mahjong layout');
    const rng = random(seed ^ 0xa7e31);
    const ids = shuffle(SYMBOLS.map((_, i) => i), rng).slice(0, Math.min(17, plan.length));
    const pairSymbols = shuffle(plan.map((_, i) => ids[i % ids.length]), rng);
    const symbols = Array(tiles.length);
    plan.forEach((pair, i) => pair.forEach(id => { symbols[id] = pairSymbols[i]; }));
    return { levelId, seed, tiles, symbols, plan };
  }
  function validSymbols(tiles, symbols, removed = new Set()) {
    if (!Array.isArray(symbols) || symbols.length !== tiles.length) return false;
    const counts = new Map();
    for (const tile of tiles) {
      const symbol = symbols[tile.id];
      if (!Number.isInteger(symbol) || symbol < 0 || symbol >= SYMBOLS.length) return false;
      if (!removed.has(tile.id)) counts.set(symbol, (counts.get(symbol) || 0) + 1);
    }
    return [...counts.values()].every(n => n % 2 === 0);
  }
  function reorganize(game, removed, seed) {
    if (!validSymbols(game.tiles, game.symbols, removed)) return null;
    const plan = makePlan(game.tiles, removed, seed);
    if (!plan) return null;
    const availableSymbols = [];
    const counts = new Map();
    for (const tile of game.tiles) if (!removed.has(tile.id))
      counts.set(game.symbols[tile.id], (counts.get(game.symbols[tile.id]) || 0) + 1);
    for (const [symbol, count] of counts) for (let n = 0; n < count / 2; n++) availableSymbols.push(symbol);
    if (availableSymbols.length !== plan.length) return null;
    shuffle(availableSymbols, random(seed ^ 0xbabecafe));
    const symbols = game.symbols.slice();
    plan.forEach((pair, n) => pair.forEach(id => { symbols[id] = availableSymbols[n]; }));
    return { symbols, plan };
  }
  function takePair(game, removed, idA, idB) {
    if (idA === idB || removed.has(idA) || removed.has(idB) || !Number.isInteger(idA) || !Number.isInteger(idB)) return null;
    const a = game.tiles[idA], b = game.tiles[idB];
    if (!a || !b || game.symbols[idA] !== game.symbols[idB]) return null;
    if (!freeTile(a, game.tiles, removed) || !freeTile(b, game.tiles, removed)) return null;
    return new Set([...removed, idA, idB]);
  }
  function safeHint(game, removed, maxNodes = 9000) {
    // A constructive plan remains valid if the player removed only complete planned pairs.
    const plan = game.plan || [];
    if (plan.length && plan.every(pair => removed.has(pair[0]) === removed.has(pair[1]))) {
      const pair = plan.find(pair => !removed.has(pair[0]));
      if (!pair) return null;
      if (takePair(game, removed, ...pair)) return pair;
    }
    // If the player picked an alternate valid pair, search for a complete continuation.
    const seen = new Set();
    let nodes = 0;
    const search = current => {
      if (current.size === game.tiles.length) return [];
      if (nodes++ >= maxNodes) return null;
      const key = [...current].sort((a, b) => a - b).join(',');
      if (seen.has(key)) return null;
      seen.add(key);
      const pairs = removablePairs(game.tiles, game.symbols, current);
      for (const pair of pairs) {
        const next = new Set([...current, ...pair]);
        const route = search(next);
        if (route) return [pair, ...route];
      }
      return null;
    };
    return search(new Set(removed))?.[0] || null;
  }
  return Object.freeze({ LEVELS, SYMBOLS, levelById, positions, random, shuffle, freeTile, freeTiles, removablePairs, makePlan, generate, reorganize, validSymbols, takePair, safeHint });
});
