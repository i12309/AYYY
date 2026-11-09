(() => {
  'use strict';
  const app = window.Igroland, rules = window.MahjongRules;
  const $ = id => document.getElementById(id);
  const stage = $('mahjongStage'), board = $('mahjongBoard');
  const SAVE = 'mahjong.progress.v1', COMPLETE = 'mahjong.completed.v1';
  const LEVEL_ICONS = ['🌼', '🐼', '🏮', '🏯', '🐢'];
  const stored = app.read(SAVE, {});
  const sessions = stored && typeof stored.sessions === 'object' && !Array.isArray(stored.sessions) ? stored.sessions : {};
  const completed = app.read(COMPLETE, {}) || {};
  const params = new URLSearchParams(location.search);
  let levelId = rules.levelById(params.get('level'))?.id || rules.levelById(stored?.level)?.id || rules.LEVELS[0].id;
  let game = null, state = null, selected = null, hinted = [], zoom = 1, panX = 0, panY = 0;
  const pointerMap = new Map();
  let lastGesture = null, dragged = false, suppressClickUntil = 0, pointerStart = null;
  const newSeed = () => 1 + Math.floor(Math.random() * 0x7ffffffe);
  const removedSet = () => new Set(state.removed);
  const message = text => { $('gameMessage').textContent = text; };
  function snapshot() { return { symbols: game.symbols.slice(), removed: state.removed.slice(), plan: game.plan.map(x => x.slice()), moves: state.moves, won: state.won }; }
  function validSnapshot(item, count) {
    return item && Array.isArray(item.removed) && Array.isArray(item.symbols) && item.symbols.length === count &&
      item.removed.every(id => Number.isInteger(id) && id >= 0 && id < count) &&
      new Set(item.removed).size === item.removed.length && item.removed.length % 2 === 0 &&
      Number.isInteger(item.moves) && item.moves >= 0 && item.moves <= 200 && typeof item.won === 'boolean' &&
      item.won === (item.removed.length === count) && rules.validSymbols(game.tiles, item.symbols, new Set(item.removed)) &&
      Array.isArray(item.plan) && item.plan.length <= count / 2 && item.plan.every(p => Array.isArray(p) && p.length === 2 && p.every(id => Number.isInteger(id) && id >= 0 && id < count));
  }
  function freshState() {
    state = { seed: newSeed(), removed: [], history: [], moves: 0, seconds: 0, started: false, won: false, hints: 0, shuffles: 0 };
    game = rules.generate(levelId, state.seed);
  }
  function save() {
    sessions[levelId] = { ...state, symbols: game.symbols.slice(), plan: game.plan.map(pair => pair.slice()) };
    app.write(SAVE, { level: levelId, sessions });
  }
  function safeStored(entry) {
    if (!entry || !Number.isInteger(entry.seed) || entry.seed <= 0 || entry.seed >= 0x80000000) return false;
    game = rules.generate(levelId, entry.seed);
    if (!validSnapshot(entry, game.tiles.length) || !Array.isArray(entry.history) || entry.history.length > 120 ||
      !entry.history.every(part => validSnapshot(part, game.tiles.length)) ||
      !Number.isInteger(entry.seconds) || entry.seconds < 0 || entry.seconds > 604800 ||
      !Number.isInteger(entry.hints) || entry.hints < 0 || entry.hints > 10000 ||
      !Number.isInteger(entry.shuffles) || entry.shuffles < 0 || entry.shuffles > 10000 ||
      typeof entry.started !== 'boolean') return false;
    game.symbols = entry.symbols.slice(); game.plan = entry.plan.map(pair => pair.slice());
    return true;
  }
  function load(id, createNew = false) {
    levelId = rules.levelById(id)?.id || rules.LEVELS[0].id;
    const entry = createNew ? null : sessions[levelId];
    if (safeStored(entry)) {
      state = { seed: entry.seed, removed: entry.removed.slice(), history: entry.history.map(h => ({ ...h, removed: h.removed.slice(), symbols: h.symbols.slice(), plan: h.plan.map(pair => pair.slice()) })), moves: entry.moves, seconds: entry.seconds, started: entry.started, won: entry.won, hints: entry.hints, shuffles: entry.shuffles };
    } else freshState();
    selected = null; hinted = []; zoom = 1; panX = panY = 0;
    const current = new URL(location.href); current.searchParams.set('level', levelId);
    try { history.replaceState(null, '', current); } catch (_) { /* file:// is optional. */ }
    $('successDialog').hidden = !state.won;
    if (state.won) winText();
    $('levelDescription').textContent = `${rules.levelById(levelId).title} · ${rules.levelById(levelId).short}`;
    message(state.won ? 'Все фишки разобраны!' : 'Выбирай две одинаковые свободные фишки.');
    drawLevels(); draw(); save();
  }
  function drawLevels() {
    const container = $('mahjongLevels'); container.replaceChildren();
    rules.LEVELS.forEach((level, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'ig-level';
      button.dataset.level = level.id; button.setAttribute('aria-pressed', String(levelId === level.id));
      const emblem = document.createElement('span'); emblem.className = 'ig-level-icon mj-level-icon'; emblem.textContent = LEVEL_ICONS[index];
      const info = document.createElement('span');
      const strong = document.createElement('strong'); strong.textContent = level.title;
      const small = document.createElement('small'); small.textContent = completed[level.id] ? '✓ Пройдено' : level.short;
      info.append(strong, small); button.append(emblem, info);
      button.addEventListener('click', () => { if (levelId !== level.id) load(level.id); });
      container.append(button);
    });
  }
  function renderTiles() {
    const level = rules.levelById(levelId);
    const width = level.cols * 79 + 62, height = level.rows * 75 + 110;
    board.style.width = `${width}px`; board.style.height = `${height}px`;
    const gone = removedSet(), free = new Set(rules.freeTiles(game.tiles, gone).map(t => t.id));
    const fragment = document.createDocumentFragment();
    for (const tile of game.tiles) {
      if (gone.has(tile.id)) continue;
      const symbol = rules.SYMBOLS[game.symbols[tile.id]];
      const button = document.createElement('button'); button.type = 'button';
      button.className = `mj-tile ${free.has(tile.id) ? 'is-free' : 'is-locked'}`;
      if (selected === tile.id) button.classList.add('is-selected');
      if (hinted.includes(tile.id)) button.classList.add('is-hinted');
      button.dataset.tileId = String(tile.id);
      button.style.left = `${24 + tile.col * 79 + tile.layer * 9}px`;
      button.style.top = `${38 + tile.row * 75 - tile.layer * 12}px`;
      button.style.zIndex = String(10 + tile.layer * 100 + tile.row);
      button.setAttribute('aria-pressed', String(selected === tile.id));
      button.setAttribute('aria-label', `${symbol.title}, ряд ${tile.row + 1}, колонка ${tile.col + 1}, ${free.has(tile.id) ? 'свободна' : 'пока закрыта'}`);
      const dot = document.createElement('span'); dot.className = 'mj-symbol-corner'; dot.setAttribute('aria-hidden', 'true');
      const icon = document.createElement('span'); icon.className = 'mj-symbol'; icon.textContent = symbol.icon; icon.setAttribute('aria-hidden', 'true');
      const caption = document.createElement('span'); caption.className = 'mj-name'; caption.textContent = symbol.title; caption.setAttribute('aria-hidden', 'true');
      button.append(dot, icon, caption);
      button.addEventListener('click', () => { if (Date.now() >= suppressClickUntil) tap(tile.id); });
      fragment.append(button);
    }
    board.replaceChildren(fragment);
    updateScale();
  }
  function updateScale() {
    if (!game) return;
    const boxW = board.offsetWidth || 450, boxH = board.offsetHeight || 450;
    const fit = Math.min((stage.clientWidth - 18) / boxW, (stage.clientHeight - 18) / boxH, 1.2);
    const effective = Math.max(.15, fit) * zoom;
    board.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${effective})`;
    $('zoomValue').textContent = `${Math.round(zoom * 100)}%`;
  }
  function updateStats() {
    $('pairsValue').textContent = `${state.removed.length / 2}/${game.tiles.length / 2}`;
    $('remainingValue').textContent = String(game.tiles.length - state.removed.length);
    $('clockValue').textContent = app.duration(state.seconds);
    $('undoButton').disabled = !state.history.length;
    $('hintButton').disabled = state.won;
    $('shuffleButton').disabled = state.won;
    $('soundButton').setAttribute('aria-pressed', String(app.soundEnabled()));
  }
  function draw() { renderTiles(); updateStats(); }
  function winText() {
    $('successText').textContent = `Найдено ${state.moves} парных ходов за ${app.duration(state.seconds)}. Отличная работа!`;
    const index = rules.LEVELS.findIndex(level => level.id === levelId);
    $('nextLevelButton').textContent = index === rules.LEVELS.length - 1 ? 'Поиграть ещё →' : 'Следующий уровень →';
  }
  function complete() {
    state.won = true; completed[levelId] = true; app.write(COMPLETE, completed);
    winText(); $('successDialog').hidden = false; drawLevels();
    message('Ура! Все одинаковые пары собраны!'); app.sound([523, 659, 784, 1047], .11);
  }
  function tap(id) {
    if (state.won) return;
    const gone = removedSet(), tile = game.tiles[id];
    if (!tile || !rules.freeTile(tile, game.tiles, gone)) {
      message('Эта фишка пока закрыта. Освободи её сбоку и сверху.'); app.sound([250], .08); return;
    }
    hinted = [];
    if (selected === id) { selected = null; draw(); return; }
    if (selected === null) {
      selected = id; message(`Выбрана фишка «${rules.SYMBOLS[game.symbols[id]].title}». Найди такую же.`); draw(); return;
    }
    if (game.symbols[selected] !== game.symbols[id]) {
      selected = id; message('Рисунки разные. Теперь найди пару к выбранной фишке.'); app.sound([230], .07); draw(); return;
    }
    const next = rules.takePair(game, gone, selected, id);
    if (!next) { selected = id; draw(); return; }
    state.history.push(snapshot()); if (state.history.length > 110) state.history.shift();
    state.removed = [...next].sort((a, b) => a - b);
    state.moves++; state.started = true; selected = null;
    app.sound([570, 740], .07);
    if (state.removed.length === game.tiles.length) complete();
    else if (!rules.removablePairs(game.tiles, game.symbols, next).length)
      message('Свободных пар больше нет. Нажми «Перемешать» или «Отменить».');
    else message('Пара найдена! Продолжай.');
    draw(); save();
  }
  function hint() {
    if (state.won) return;
    const pair = rules.safeHint(game, removedSet(), 5000);
    if (!pair) {
      message('Сейчас нет проверенного пути. Перемешай оставшиеся фишки или отмени ход.'); return;
    }
    state.hints++; hinted = pair; selected = null;
    const name = rules.SYMBOLS[game.symbols[pair[0]]].title;
    message(`Подсказка: подсвечены две свободные фишки «${name}».`);
    app.sound([880], .1); draw(); save();
  }
  function shuffleRemaining() {
    if (state.won) return;
    const newDeal = rules.reorganize(game, removedSet(), newSeed());
    if (!newDeal) {
      message('Остались заблокированные фишки. Отмени ход или начни этот уровень заново.'); return;
    }
    state.history.push(snapshot()); if (state.history.length > 110) state.history.shift();
    game.symbols = newDeal.symbols; game.plan = newDeal.plan;
    selected = null; hinted = []; state.shuffles++; state.started = true;
    message('Фишки перемешаны! Теперь у раскладки снова есть решение.');
    app.sound([480, 620, 760], .085); draw(); save();
  }
  function undo() {
    const prev = state.history.pop(); if (!prev) return;
    game.symbols = prev.symbols; game.plan = prev.plan;
    state.removed = prev.removed; state.moves = prev.moves; state.won = prev.won;
    selected = null; hinted = []; $('successDialog').hidden = !state.won;
    message('Предыдущий ход отменён.'); draw(); save();
  }
  function zoomBy(factor) { zoom = Math.max(.65, Math.min(3.3, zoom * factor)); updateScale(); }
  function distance(p1, p2) { return Math.hypot(p1.x - p2.x, p1.y - p2.y); }
  function pointerPoint(event) { return { x: event.clientX, y: event.clientY }; }
  function pairMetrics() {
    const p = [...pointerMap.values()];
    return p.length < 2 ? null : { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2, d: distance(p[0], p[1]) };
  }
  stage.addEventListener('contextmenu', e => e.preventDefault());
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    pointerMap.set(e.pointerId, pointerPoint(e));
    if (pointerMap.size === 1) { dragged = e.button === 2; pointerStart = pointerPoint(e); }
    if (pointerMap.size >= 2) { lastGesture = pairMetrics(); dragged = true; suppressClickUntil = Date.now() + 450; }
  });
  stage.addEventListener('pointermove', e => {
    const previous = pointerMap.get(e.pointerId); if (!previous) return;
    const next = pointerPoint(e); pointerMap.set(e.pointerId, next);
    if (pointerMap.size >= 2) {
      const measure = pairMetrics();
      if (lastGesture && lastGesture.d > 3 && measure.d > 3) {
        zoom = Math.max(.65, Math.min(3.3, zoom * measure.d / lastGesture.d));
        panX += measure.x - lastGesture.x; panY += measure.y - lastGesture.y;
        updateScale();
      }
      lastGesture = measure; dragged = true; suppressClickUntil = Date.now() + 400; return;
    }
    if (!dragged && pointerStart && distance(pointerStart, next) > 9) dragged = true;
    if (dragged) {
      panX += next.x - previous.x; panY += next.y - previous.y;
      updateScale(); suppressClickUntil = Date.now() + 300;
    }
  });
  function endPointer(e) {
    pointerMap.delete(e.pointerId);
    if (dragged) suppressClickUntil = Date.now() + 200;
    if (pointerMap.size < 2) lastGesture = null;
    if (!pointerMap.size) dragged = false;
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.16 : 1 / 1.16); }, { passive: false });
  $('zoomIn').addEventListener('click', () => zoomBy(1.2));
  $('zoomOut').addEventListener('click', () => zoomBy(1 / 1.2));
  $('fitBoard').addEventListener('click', () => { zoom = 1; panX = panY = 0; updateScale(); });
  $('hintButton').addEventListener('click', hint);
  $('shuffleButton').addEventListener('click', shuffleRemaining);
  $('undoButton').addEventListener('click', undo);
  $('newGameButton').addEventListener('click', () => load(levelId, true));
  $('nextLevelButton').addEventListener('click', () => {
    const index = rules.LEVELS.findIndex(level => level.id === levelId);
    if (index + 1 < rules.LEVELS.length) load(rules.LEVELS[index + 1].id);
    else load(levelId, true);
  });
  $('soundButton').addEventListener('click', () => { app.setSound(!app.soundEnabled()); updateStats(); });
  window.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
  });
  if (typeof ResizeObserver === 'function') new ResizeObserver(updateScale).observe(stage);
  else window.addEventListener('resize', updateScale);
  window.setInterval(() => {
    if (!state || !state.started || state.won || document.hidden) return;
    state.seconds++; $('clockValue').textContent = app.duration(state.seconds);
    if (state.seconds % 5 === 0) save();
  }, 1000);
  window.addEventListener('pagehide', () => { if (state) save(); });
  load(levelId);
})();
