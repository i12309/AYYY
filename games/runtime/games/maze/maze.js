(() => {
  'use strict';
  const app = window.Igroland;
  const MODES = { easy: 7, normal: 11, hard: 15 };
  const stage = document.querySelector('#mazeStage');
  const canvas = document.querySelector('#mazeCanvas');
  const ctx = canvas.getContext('2d');
  const stepsValue = document.querySelector('#stepsValue');
  const timeValue = document.querySelector('#timeValue');
  const bestScore = document.querySelector('#bestScore');
  const zoomLabel = document.querySelector('#zoomLabel');
  const successDialog = document.querySelector('#successDialog');
  const successText = document.querySelector('#successText');
  const gameMessage = document.querySelector('#gameMessage');
  const soundButton = document.querySelector('#soundButton');
  let sessions = app.read('maze.sessions.v1', {});
  if (!sessions || typeof sessions !== 'object' || Array.isArray(sessions)) sessions = {};
  let best = app.read('maze.best.v1', {});
  if (!best || typeof best !== 'object' || Array.isArray(best)) best = {};
  const requestedLevel = new URLSearchParams(location.search).get('level');
  let difficulty = Object.hasOwn(MODES, requestedLevel) ? requestedLevel : app.read('maze.difficulty', 'easy');
  if (!MODES[difficulty]) difficulty = 'easy';
  let state = null;
  let hintCell = null;
  let hintTimeout = null;
  let viewWidth = 640;
  let viewHeight = 500;
  let deviceScale = 1;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  const pointers = new Map();
  let gesture = null;
  let fingerTracing = false;
  let mousePanning = false;
  let lastTracePoint = null;

  function createGrid(size) {
    const grid = Array.from({ length: size }, () => Array(size).fill(1));
    const stack = [[1, 1]];
    grid[1][1] = 0;
    const choices = [[0, -2], [0, 2], [-2, 0], [2, 0]];
    while (stack.length) {
      const [row, col] = stack[stack.length - 1];
      const options = choices.map(([dr, dc]) => [row + dr, col + dc, dr, dc])
        .filter(([r, c]) => r > 0 && c > 0 && r < size - 1 && c < size - 1 && grid[r][c] === 1);
      if (options.length === 0) { stack.pop(); continue; }
      const [nextRow, nextCol, dr, dc] = options[Math.floor(Math.random() * options.length)];
      grid[row + dr / 2][col + dc / 2] = 0;
      grid[nextRow][nextCol] = 0;
      stack.push([nextRow, nextCol]);
    }
    return grid;
  }

  function freshState(mode) {
    return { grid: createGrid(MODES[mode]), player: [1, 1], trail: [[1, 1]], steps: 0, seconds: 0, hints: 0, started: false, won: false };
  }

  function validate(candidate, mode) {
    const n = MODES[mode];
    if (!candidate || !Array.isArray(candidate.grid) || candidate.grid.length !== n) return false;
    if (!candidate.grid.every((row, ri) => Array.isArray(row) && row.length === n && row.every((c, ci) => (c === 0 || c === 1) && (ri !== 0 && ci !== 0 && ri !== n-1 && ci !== n-1 || c === 1)))) return false;
    if (candidate.grid[1][1] || candidate.grid[n - 2][n - 2]) return false;
    if (!Array.isArray(candidate.player) || candidate.player.length !== 2 || !candidate.player.every(Number.isInteger)) return false;
    const [pr, pc] = candidate.player;
    if (pr < 0 || pc < 0 || pr >= n || pc >= n || candidate.grid[pr][pc]) return false;
    if (!Array.isArray(candidate.trail) || candidate.trail.length > 100000 || !candidate.trail.every(cell => Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger) && cell[0] >= 0 && cell[1] >= 0 && cell[0] < n && cell[1] < n && candidate.grid[cell[0]][cell[1]] === 0)) return false;
    if (![candidate.steps, candidate.seconds, candidate.hints].every(v => Number.isInteger(v) && v >= 0 && v < 10000000)) return false;
    return typeof candidate.started === 'boolean' && typeof candidate.won === 'boolean' && (!candidate.won || (pr === n - 2 && pc === n - 2));
  }

  function persist() { sessions[difficulty] = state; app.write('maze.sessions.v1', sessions); }
  function message(value) { gameMessage.textContent = value; }
  function updateScore() {
    stepsValue.textContent = String(state.steps);
    timeValue.textContent = app.duration(state.seconds);
    bestScore.textContent = Number.isInteger(best[difficulty]?.steps) ? `${best[difficulty].steps} шагов` : '—';
  }

  function metrics() {
    const n = state.grid.length;
    const tile = (Math.min(viewWidth, viewHeight) * .90 / n) * zoom;
    const width = tile * n;
    return { tile, x0: (viewWidth - width) / 2 + panX, y0: (viewHeight - width) / 2 + panY };
  }

  function roundRect(x, y, w, h, radius, fill) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.max(0, Math.min(radius, w / 2, h / 2)));
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function draw() {
    if (!state || !ctx) return;
    ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    ctx.clearRect(0, 0, viewWidth, viewHeight);
    const { x0, y0, tile } = metrics();
    const n = state.grid.length;
    ctx.save();
    ctx.translate(x0, y0);
    roundRect(-4, -4, tile * n + 8, tile * n + 8, Math.max(8, tile * .2), '#a8c2be');
    roundRect(-2, -2, tile * n + 4, tile * n + 4, Math.max(6, tile * .16), '#fffef8');
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const x = col * tile;
        const y = row * tile;
        if (state.grid[row][col] === 1) {
          ctx.fillStyle = (row + col) % 2 ? '#ccdfd8' : '#d6e5df';
          ctx.fillRect(x, y, tile + .5, tile + .5);
          if (tile >= 14) { ctx.fillStyle = '#ffffff46'; ctx.fillRect(x + tile * .12, y + tile * .10, tile * .76, Math.max(2, tile * .08)); }
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, tile + .5, tile + .5);
        }
      }
    }
    if (state.trail.length > 1) {
      ctx.strokeStyle = '#3d849178';
      ctx.lineWidth = Math.max(3, tile * .32);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      state.trail.forEach(([row, col], i) => {
        if (i === 0) ctx.moveTo((col + .5) * tile, (row + .5) * tile);
        else ctx.lineTo((col + .5) * tile, (row + .5) * tile);
      });
      ctx.stroke();
    }
    if (hintCell) {
      const [hr, hc] = hintCell;
      ctx.beginPath(); ctx.fillStyle = '#f7dcaa'; ctx.arc((hc + .5) * tile, (hr + .5) * tile, tile * .43, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d79742'; ctx.lineWidth = Math.max(2, tile * .065); ctx.stroke();
    }
    const goal = n - 2;
    roundRect((goal + .12) * tile, (goal + .12) * tile, tile * .76, tile * .76, tile * .25, '#f7e7c9');
    roundRect(.12 * tile + tile, .12 * tile + tile, tile * .76, tile * .76, tile * .25, '#e6f0e8');
    ctx.textAlign = 'center';ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(12, tile * .7)}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`;
    ctx.fillText('🍯', (goal + .5) * tile, (goal + .51) * tile);
    const [pr, pc] = state.player;
    ctx.beginPath();ctx.fillStyle = '#fbedd1';ctx.arc((pc + .5) * tile, (pr + .5) * tile, tile * .45, 0, Math.PI * 2);ctx.fill();
    ctx.font = `${Math.max(12, tile * .77)}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`;
    ctx.fillText('🐻', (pc + .5) * tile, (pr + .51) * tile);
    ctx.restore();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    viewWidth = Math.max(1, rect.width);
    viewHeight = Math.max(1, rect.height);
    deviceScale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewWidth * deviceScale);
    canvas.height = Math.round(viewHeight * deviceScale);
    draw();
  }

  function fit() { zoom = 1; panX = 0; panY = 0; updateZoom(); draw(); }
  function updateZoom() { zoomLabel.textContent = `${Math.round(zoom * 100)}%`; }
  function zoomAt(factor, x, y) {
    const old = metrics();
    const worldX = (x - old.x0) / old.tile;
    const worldY = (y - old.y0) / old.tile;
    zoom = Math.max(.65, Math.min(4, zoom * factor));
    const next = metrics();
    panX += x - (next.x0 + worldX * next.tile);
    panY += y - (next.y0 + worldY * next.tile);
    updateZoom(); draw();
  }

  function hit(x, y) {
    const { x0, y0, tile } = metrics();
    const row = Math.floor((y - y0) / tile);
    const col = Math.floor((x - x0) / tile);
    return row >= 0 && col >= 0 && row < state.grid.length && col < state.grid.length ? [row, col] : null;
  }

  function clearHint() {
    hintCell = null;
    if (hintTimeout) clearTimeout(hintTimeout);
    hintTimeout = null;
  }

  function finish() {
    state.won = true;
    if (state.hints === 0 && (!best[difficulty] || state.steps < best[difficulty].steps)) {
      best[difficulty] = { steps: state.steps, seconds: state.seconds };
      app.write('maze.best.v1', best);
    }
    successText.textContent = `Ты прошёл лабиринт за ${state.steps} шагов. Отличная работа!`;
    successDialog.hidden = false;
    message('Молодец! Медвежонок нашёл мёд!');
    app.sound([494, 622, 784, 988], .14);
    updateScore();
  }

  function move(row, col) {
    if (!state || state.won) return false;
    const [pr, pc] = state.player;
    if (Math.abs(row - pr) + Math.abs(col - pc) !== 1 || state.grid[row]?.[col] !== 0) return false;
    clearHint();
    state.started = true;
    state.player = [row, col];
    state.steps++;
    const last = state.trail.at(-2);
    if (last && last[0] === row && last[1] === col) state.trail.pop();
    else state.trail.push([row, col]);
    app.sound([460], .043);
    const goal = state.grid.length - 2;
    if (row === goal && col === goal) finish();
    else message('Идём дальше! Ищи свободную белую дорожку.');
    persist();updateScore();draw();
    return true;
  }

  function moveDirection(direction) {
    const [r, c] = state.player;
    const steps = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
    const delta = steps[direction];
    if (delta) move(r + delta[0], c + delta[1]);
  }

  function follow(cell) {
    if (!cell || state.won) return;
    let [pr, pc] = state.player;
    const [tr, tc] = cell;
    if (tr === pr && tc !== pc) {
      const delta = Math.sign(tc - pc);
      while (pc !== tc && move(pr, pc + delta)) pc += delta;
    } else if (tc === pc && tr !== pr) {
      const delta = Math.sign(tr - pr);
      while (pr !== tr && move(pr + delta, pc)) pr += delta;
    } else move(tr, tc);
  }

  function shortestPath() {
    const n = state.grid.length;
    const start = state.player;
    const goal = [n - 2, n - 2];
    const queue = [start];
    let cursor = 0;
    const parent = new Map([[start.join(','), null]]);
    while (cursor < queue.length) {
      const [row, col] = queue[cursor++];
      if (row === goal[0] && col === goal[1]) break;
      for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nr = row + dr, nc = col + dc, key = `${nr},${nc}`;
        if (state.grid[nr]?.[nc] !== 0 || parent.has(key)) continue;
        parent.set(key, `${row},${col}`);
        queue.push([nr, nc]);
      }
    }
    const path = [];
    let key = goal.join(',');
    if (!parent.has(key)) return path;
    while (key !== null) { path.push(key.split(',').map(Number)); key = parent.get(key); }
    return path.reverse();
  }

  function hint() {
    if (state.won) return;
    const path = shortestPath();
    if (path.length < 2) return;
    clearHint();
    hintCell = path[1];
    state.hints++;
    persist();
    message('Жёлтый кружок показывает следующий шаг!');
    draw();
    hintTimeout = setTimeout(() => { hintCell = null; hintTimeout = null; draw(); }, 2200);
  }

  function loadLevel(mode, fresh = false) {
    if (!MODES[mode]) return;
    clearHint();
    pointers.clear(); gesture = null; fingerTracing = false; mousePanning = false; lastTracePoint = null;
    difficulty = mode;
    app.write('maze.difficulty', mode);
    state = !fresh && validate(sessions[mode], mode) ? sessions[mode] : freshState(mode);
    document.querySelectorAll('[data-difficulty]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.difficulty === mode)));
    persist();
    successDialog.hidden = !state.won;
    if (state.won) successText.textContent = `Ты прошёл лабиринт за ${state.steps} шагов. Отличная работа!`;
    message(state.won ? 'Лабиринт пройден! Можно начать новый.' : 'Проведи медвежонка к мёду!');
    updateScore();fit();
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function pairInfo() {
    const values = [...pointers.values()];
    if (values.length < 2) return null;
    const [a, b] = values;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  function traceSegment(a, b) {
    const stepSize = Math.max(4, metrics().tile * .30);
    const count = Math.min(120, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / stepSize));
    for (let i = 1; i <= count; i++) follow(hit(a.x + (b.x - a.x) * i / count, a.y + (b.y - a.y) * i / count));
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const p = point(event);
    pointers.set(event.pointerId, p);
    if (pointers.size >= 2) { fingerTracing = false; mousePanning = false; gesture = pairInfo(); return; }
    gesture = null;
    mousePanning = event.pointerType === 'mouse' && event.button === 2;
    lastTracePoint = p;
    const cell = hit(p.x, p.y);
    const onHero = cell && cell[0] === state.player[0] && cell[1] === state.player[1];
    fingerTracing = !mousePanning && (onHero || (cell && Math.abs(cell[0] - state.player[0]) + Math.abs(cell[1] - state.player[1]) === 1));
    if (fingerTracing && !onHero) follow(cell);
  });

  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    const current = point(event);
    const previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId, current);
    if (pointers.size >= 2) {
      const next = pairInfo();
      if (gesture && next && gesture.distance > 0) {
        zoomAt(next.distance / gesture.distance, next.x, next.y);
        panX += next.x - gesture.x;
        panY += next.y - gesture.y;
        draw();
      }
      gesture = next;
    } else if (mousePanning) {
      panX += current.x - previous.x;
      panY += current.y - previous.y;
      draw();
    } else if (fingerTracing && lastTracePoint) {
      traceSegment(lastTracePoint, current);
      lastTracePoint = current;
    }
  });
  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) gesture = null;
    fingerTracing = false;
    mousePanning = false;
    lastTracePoint = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const p = point(event);
    zoomAt(Math.exp(-event.deltaY * .0014), p.x, p.y);
  }, { passive: false });
  document.querySelectorAll('[data-difficulty]').forEach(button => button.addEventListener('click', () => loadLevel(button.dataset.difficulty)));
  document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => moveDirection(button.dataset.direction)));
  document.querySelector('#newMaze').addEventListener('click', () => loadLevel(difficulty, true));
  document.querySelector('#againButton').addEventListener('click', () => loadLevel(difficulty, true));
  document.querySelector('#hintButton').addEventListener('click', hint);
  document.querySelector('#zoomFit').addEventListener('click', fit);
  document.querySelector('#zoomIn').addEventListener('click', () => zoomAt(1.25, viewWidth / 2, viewHeight / 2));
  document.querySelector('#zoomOut').addEventListener('click', () => zoomAt(.8, viewWidth / 2, viewHeight / 2));
  soundButton.addEventListener('click', () => { app.setSound(!app.soundEnabled()); refreshSound(); app.sound([540, 720], .075); });
  function refreshSound() {
    const enabled = app.soundEnabled();
    soundButton.setAttribute('aria-pressed', String(enabled));
    soundButton.textContent = enabled ? '🔊' : '🔇';
  }
  window.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', ц: 'up', ы: 'down', ф: 'left', в: 'right' };
    const direction = map[event.key];
    if (direction && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) { event.preventDefault(); moveDirection(direction); }
  });
  setInterval(() => {
    if (!state || !state.started || state.won || document.hidden) return;
    state.seconds++;
    timeValue.textContent = app.duration(state.seconds);
    persist();
  }, 1000);
  window.addEventListener('pagehide', () => { if (state) persist(); });
  if ('ResizeObserver' in window) new window.ResizeObserver(resizeCanvas).observe(stage);
  else window.addEventListener('resize', resizeCanvas);
  refreshSound();
  loadLevel(difficulty);
  resizeCanvas();
})();
