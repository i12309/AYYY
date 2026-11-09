(() => {
  'use strict';
  const W = window.Workshop, R = window.ShapeRules, { element: el, button } = W;
  const NS = 'http://www.w3.org/2000/svg', KEY = 'workshop.shape-studio.v1';
  const raw = Igroland.read(KEY, {}), sessions = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const params = new URLSearchParams(location.search);
  let level = R.byId(params.get('level')), pieces = [], selected = null, color = 0, undo = [], gesture = null, guides = true, workId = null;
  const ui = W.shell('Мастерская фигур', 'Собирай силуэты, поворачивай детали и придумывай свои картинки.', R.LEVELS, load);
  ui.details.append(el('p', '', 'Выбери фигуру, затем нажми на поле, куда её поставить. Можно и перетаскивать. Поворот — кнопками. Для задания фигура прилипает к правильному месту. В зеркальных заданиях совпадают и форма, и цвет.'));
  ui.details.append(el('p', '', 'Клавиатура: выбери деталь кнопкой, стрелками двигай, R — поворот, Enter — поставить. Для свободных работ доступны до 40 фигур и 24 сохранённых работы на общей полке.'));
  const actions = el('div', 'ws-actions'), board = el('div', 'ws-board'), canvas = svg('svg', { viewBox: '0 0 640 480', tabindex: '0', role: 'group', 'aria-label': 'Поле для фигур. Выбери деталь, затем нажми на нужное место.' });
  board.append(canvas);
  const banner = el('div', 'ws-banner'); banner.hidden = true;
  const pieceList = el('div', 'ws-piece-list'); pieceList.setAttribute('aria-label', 'Выбор детали');
  ui.main.append(actions, board, pieceList, banner, el('p', 'ws-caption', 'Можно ставить детали касаниями — точное перетаскивание не обязательно. Работа сохраняется только в этом браузере.'));
  const undoButton = button('↶ Отмена', () => { if (!undo.length) return; pieces = undo.pop(); selected = pieces.some(p => p.id === selected) ? selected : null; changed(); });
  const rotateBy = a => { if (!selected) return ui.notify('Сначала выбери фигуру.'); record(); const p = pieces.find(p => p.id === selected); p.rot = R.rotate(p.rot + a); R.snap(pieces, selected, level); changed(); };
  const helpButton = button('Контуры', () => { guides = !guides; draw(); helpButton.setAttribute('aria-pressed', String(guides)); });
  actions.append(undoButton, button('↶ Повернуть', () => rotateBy(-90)), button('↷ Повернуть', () => rotateBy(90)), helpButton,
    button('Заново', () => { if (pieces.length && !confirm('Начать эту картинку заново? Работы на полке сохранятся.')) return; load(level.id, true); }));
  Object.entries(R.TYPES).forEach(([type, info]) => ui.tools.append(button(`${info.icon} ${info.name}`, () => {
    if (level.mode !== 'free') return ui.notify('В задании выбери одну из готовых деталей под полем. Свои детали добавляются в свободной мастерской.');
    if (pieces.length >= 40) return ui.notify('На поле уже 40 фигур. Убери ненужную.');
    record(); selected = 1 + Math.max(0, ...pieces.map(p => p.id)); pieces.push({ id: selected, type, x: 320, y: 220, rot: 0, color }); changed();
  })));
  const colors = el('div', 'ws-colors'); colors.setAttribute('aria-label', 'Цвет фигуры');
  const colorNames = ['Розовый', 'Жёлтый', 'Зелёный', 'Синий', 'Фиолетовый'];
  R.COLORS.forEach((hex, i) => { const b = button('', () => { color = i; if (selected && level.mode === 'free') { record(); pieces.find(p => p.id === selected).color = i; changed(); } updateColors(); }, 'ws-color'); b.style.background = hex; b.setAttribute('aria-label', colorNames[i]); colors.append(b); });
  ui.side.insertBefore(colors, ui.savebox);
  const remove = button('Убрать выбранную', () => { if (level.mode !== 'free') return ui.notify('В задании нужны все детали. Их можно двигать и поворачивать.'); if (!selected) return; record(); pieces = pieces.filter(p => p.id !== selected); selected = null; changed(); });
  actions.append(remove);
  ui.savebox.append(button('Сохранить на полку', () => {
    if (!pieces.length) return ui.notify('Сначала добавь хотя бы одну фигуру.');
    const result = W.saveWork('shape-studio', ui.name.value, { pieces: [...(level.fixed || []), ...pieces].map((p, i) => ({ ...p, id: i + 1 })) }, workId);
    if (result.error) return ui.notify(result.error); workId = result.item.id; ui.name.value = result.item.name; ui.notify('Работа сохранена. Открой «Мои работы», чтобы вернуться к ней.');
  }, 'ws-button primary'));
  function svg(tag, attrs) { const n = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); return n; }
  function art(p, fill, stroke, dash) {
    const g = svg('g', { transform: `translate(${p.x} ${p.y}) rotate(${p.rot})` });
    const attr = { fill, stroke: stroke || '#fff', 'stroke-width': stroke ? 2 : 3, 'stroke-linejoin': 'round' }; if (dash) attr['stroke-dasharray'] = '6 5';
    g.append(p.type === 'circle' ? svg('circle', { cx: 0, cy: 0, r: 40, ...attr }) : svg('polygon', { points: R.TYPES[p.type].points.map(p => p.join(',')).join(' '), ...attr })); return g;
  }
  function record() { undo.push(W.clone(pieces)); if (undo.length > 60) undo.shift(); }
  function persist() { sessions[level.id] = { pieces: W.clone(pieces) }; if (!Igroland.write(KEY, sessions)) ui.notify('Не удалось сохранить черновик. Работать можно, но не закрывай страницу.'); }
  function updateColors() { [...colors.children].forEach((b, i) => b.setAttribute('aria-pressed', String(color === i))); }
  function draw() {
    canvas.replaceChildren();
    if (level.mode === 'mirror') {
      canvas.append(svg('line', { x1: 320, y1: 30, x2: 320, y2: 365, stroke: '#bd94cc', 'stroke-width': 2, 'stroke-dasharray': '7 7' }));
      (level.fixed || []).forEach(p => canvas.append(art(p, R.COLORS[p.color])));
    }
    if (level.mode !== 'free') {
      level.targets.forEach(p => canvas.append(art(p, level.mode === 'mirror' && !guides ? 'none' : '#e2e9ec', guides ? '#b4c3cc' : 'none', guides)));
      canvas.append(svg('line', { x1: 20, y1: 365, x2: 620, y2: 365, stroke: '#cedbd6', 'stroke-dasharray': '4 6' }));
    }
    pieces.forEach(p => { const g = art(p, R.COLORS[p.color], p.id === selected ? '#344c67' : null); g.dataset.piece = p.id; if (p.id === selected) g.classList.add('selected'); canvas.append(g); });
    undoButton.disabled = !undo.length;
    const won = R.solved(pieces, level); banner.hidden = !won;
    if (won) banner.replaceChildren(el('strong', '', 'Картинка собрана!'), el('span', '', 'Можно сохранить её или выбрать следующее задание.'));
    pieceList.replaceChildren(); pieces.forEach((p, i) => { const b = button(`${R.TYPES[p.type].icon} ${i + 1}`, () => { selected = p.id; color = p.color; updateColors(); draw(); canvas.focus(); }); b.setAttribute('aria-label', `Выбрать: ${R.TYPES[p.type].name}, деталь ${i + 1}`); b.setAttribute('aria-pressed', String(selected === p.id)); b.dataset.selectPiece = p.id; pieceList.append(b); });
    remove.disabled = level.mode !== 'free' || !selected;
  }
  function changed() { persist(); draw(); }
  function load(id, reset = false) {
    if (gesture) gesture = null;
    level = R.byId(id); pieces = !reset && R.validForLevel(sessions[level.id]?.pieces, level) || R.initial(level.id);
    selected = null; undo = []; workId = null; guides = level.mode === 'silhouette';
    ui.tools.querySelectorAll('button').forEach(b => b.disabled = level.mode !== 'free'); colors.hidden = level.mode !== 'free';
    ui.select.value = level.id; ui.name.value = level.mode === 'free' ? '' : level.title.replace(/^\d+\. /, '');
    ui.help.textContent = level.mode === 'free' ? 'Добавляй фигуры кнопками. Выбирай цвет, двигай и поворачивай. Здесь нет неправильных картинок.' : level.mode === 'mirror' ? 'Слева — образец. Дострой его отражение справа от пунктирной линии.' : 'Выбери деталь под полем. Поставь её на силуэт и при необходимости поверни.';
    helpButton.hidden = level.mode === 'free'; helpButton.setAttribute('aria-pressed', String(guides)); W.route(level.id); ui.notify(''); changed();
  }
  function point(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * 640 / r.width, y: (e.clientY - r.top) * 480 / r.height }; }
  const place = (p, pt) => { p.x = Math.max(40, Math.min(600, pt.x)); p.y = Math.max(40, Math.min(440, pt.y)); };
  canvas.addEventListener('pointerdown', e => {
    if (gesture || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const id = Number(e.target.closest('[data-piece]')?.dataset.piece); if (id) { selected = id; color = pieces.find(p => p.id === id).color; updateColors(); }
    if (!selected) return; const p = pieces.find(p => p.id === selected); if (!p) return;
    const pt = point(e); gesture = { pointer: e.pointerId, before: W.clone(pieces), offset: id ? { x: p.x - pt.x, y: p.y - pt.y } : { x: 0, y: 0 } };
    canvas.setPointerCapture(e.pointerId); e.preventDefault(); place(p, { x: pt.x + gesture.offset.x, y: pt.y + gesture.offset.y }); draw();
  });
  canvas.addEventListener('pointermove', e => { if (!gesture || gesture.pointer !== e.pointerId) return; const pt = point(e); place(pieces.find(p => p.id === selected), { x: pt.x + gesture.offset.x, y: pt.y + gesture.offset.y }); draw(); });
  function end(e, cancelled) {
    if (!gesture || gesture.pointer !== e.pointerId) return;
    const old = gesture; gesture = null;
    if (cancelled) pieces = old.before;
    else { R.snap(pieces, selected, level); if (JSON.stringify(old.before) !== JSON.stringify(pieces)) { undo.push(old.before); if (undo.length > 60) undo.shift(); } }
    changed();
  }
  canvas.addEventListener('pointerup', e => end(e, false)); canvas.addEventListener('pointercancel', e => end(e, true));
  canvas.addEventListener('lostpointercapture', e => end(e, true));
  canvas.addEventListener('keydown', e => {
    const delta = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
    if (e.key.toLowerCase() === 'r') { e.preventDefault(); rotateBy(90); return; }
    if (!selected) return; const p = pieces.find(p => p.id === selected);
    if (delta) { e.preventDefault(); record(); place(p, { x: p.x + delta[0], y: p.y + delta[1] }); changed(); }
    if (e.key === 'Enter') { e.preventDefault(); record(); R.snap(pieces, selected, level); changed(); }
  });
  window.addEventListener('pagehide', persist);
  load(level.id); updateColors();
  const opened = W.entries().find(e => e.id === params.get('work') && e.game === 'shape-studio');
  if (opened) { const valid = R.validPieces(opened.data.pieces); if (valid) { load('free'); pieces = valid; workId = opened.id; ui.name.value = opened.name; changed(); ui.notify('Работа открыта. Изменяй и сохраняй её на ту же полку.'); } else ui.notify('Эта работа повреждена. Начни новую, другие работы сохранены.'); }
})();
