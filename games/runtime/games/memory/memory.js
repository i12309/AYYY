(() => {
  'use strict';
  const app = window.Igroland;
  const levels = {
    easy: { pairs: 3, icons: ['🐱', '🐶', '🐰'], columns: 3 },
    normal: { pairs: 6, icons: ['🦊', '🐼', '🐸', '🐝', '🐢', '🐙'], columns: 4 },
    hard: { pairs: 10, icons: ['🐻', '🦁', '🐨', '🦄', '🐳', '🐞', '🦋', '🦖', '🐧', '🐬'], columns: 5 }
  };
  const board = document.querySelector('#memoryBoard');
  const pairCount = document.querySelector('#pairCount');
  const moveCount = document.querySelector('#moveCount');
  const clockValue = document.querySelector('#clockValue');
  const bestScore = document.querySelector('#bestScore');
  const gameMessage = document.querySelector('#gameMessage');
  const successDialog = document.querySelector('#successDialog');
  const successText = document.querySelector('#successText');
  const hintButton = document.querySelector('#hintButton');
  const soundButton = document.querySelector('#soundButton');
  let sessions = app.read('memory.sessions.v1', {});
  if (!sessions || typeof sessions !== 'object' || Array.isArray(sessions)) sessions = {};
  let best = app.read('memory.best.v1', {});
  if (!best || typeof best !== 'object' || Array.isArray(best)) best = {};
  const requestedLevel = new URLSearchParams(location.search).get('level');
  let difficulty = Object.hasOwn(levels, requestedLevel) ? requestedLevel : app.read('memory.difficulty', 'easy');
  if (!levels[difficulty]) difficulty = 'easy';
  let state = null;
  let selected = [];
  let hintIndices = [];
  let locked = false;
  let delayedClose = null;
  let delayedHint = null;

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function freshState(mode) {
    const icons = levels[mode].icons;
    return { order: shuffle([...icons, ...icons]), matched: [], moves: 0, hints: 0, seconds: 0, started: false, won: false };
  }

  function validate(candidate, mode) {
    if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.order) || !Array.isArray(candidate.matched)) return false;
    const expected = levels[mode].icons;
    if (candidate.order.length !== expected.length * 2) return false;
    if (expected.some(icon => candidate.order.filter(item => item === icon).length !== 2)) return false;
    if (!candidate.matched.every(i => Number.isInteger(i) && i >= 0 && i < candidate.order.length)) return false;
    if (new Set(candidate.matched).size !== candidate.matched.length) return false;
    const byEmoji = new Map();
    for (const i of candidate.matched) byEmoji.set(candidate.order[i], (byEmoji.get(candidate.order[i]) || 0) + 1);
    if ([...byEmoji.values()].some(count => count !== 2)) return false;
    if (![candidate.moves, candidate.hints, candidate.seconds].every(n => Number.isInteger(n) && n >= 0 && n < 10000000)) return false;
    return typeof candidate.won === 'boolean' && typeof candidate.started === 'boolean' && (!candidate.won || candidate.matched.length === candidate.order.length);
  }

  function persist() {
    sessions[difficulty] = state;
    app.write('memory.sessions.v1', sessions);
  }

  function message(text) { gameMessage.textContent = text; }

  function updateScore() {
    pairCount.textContent = `${state.matched.length / 2}/${levels[difficulty].pairs}`;
    moveCount.textContent = String(state.moves);
    clockValue.textContent = app.duration(state.seconds);
    const result = best[difficulty];
    bestScore.textContent = result && Number.isInteger(result.moves) ? `${result.moves} ходов` : '—';
  }

  function renderCards() {
    [...board.children].forEach((node, index) => {
      const matched = state.matched.includes(index);
      const open = selected.includes(index);
      const hint = hintIndices.includes(index);
      node.classList.toggle('is-matched', matched);
      node.classList.toggle('is-open', open);
      node.classList.toggle('is-hint', hint);
      node.disabled = matched || state.won;
      node.setAttribute('aria-label', matched ? `Карточка ${index + 1}: пара найдена, ${state.order[index]}` : open || hint ? `Карточка ${index + 1}: ${state.order[index]}` : `Карточка ${index + 1}: закрыта`);
    });
    hintButton.disabled = locked || state.won || hintIndices.length > 0;
  }

  function buildBoard() {
    board.replaceChildren();
    board.dataset.difficulty = difficulty;
    board.style.setProperty('--columns', levels[difficulty].columns);
    state.order.forEach((icon, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'memory-card';
      button.dataset.index = String(index);
      button.innerHTML = `<span class="memory-card-inner"><span class="memory-card-back" aria-hidden="true"><span class="memory-back-icon">✦</span></span><span class="memory-card-front" aria-hidden="true">${icon}</span></span>`;
      button.addEventListener('click', () => flip(index));
      board.append(button);
    });
    renderCards();
  }

  function clearPending() {
    if (delayedClose !== null) clearTimeout(delayedClose);
    if (delayedHint !== null) clearTimeout(delayedHint);
    delayedClose = delayedHint = null;
    selected = [];
    hintIndices = [];
    locked = false;
  }

  function loadLevel(mode, reset = false) {
    if (!levels[mode]) return;
    clearPending();
    difficulty = mode;
    app.write('memory.difficulty', mode);
    state = !reset && validate(sessions[mode], mode) ? sessions[mode] : freshState(mode);
    document.querySelectorAll('[data-difficulty]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.difficulty === mode)));
    persist();
    buildBoard();
    successDialog.hidden = !state.won;
    if (state.won) successText.textContent = `Найдено ${levels[difficulty].pairs} пар за ${state.moves} ходов. Ты молодец!`;
    updateScore();
    message(state.won ? 'Все пары найдены! Выбирай следующий уровень или начни снова.' : 'Нажми на две карточки и ищи одинаковые картинки.');
  }

  function finish() {
    state.won = true;
    if (state.hints === 0 && (!best[difficulty] || state.moves < best[difficulty].moves)) {
      best[difficulty] = { moves: state.moves, seconds: state.seconds };
      app.write('memory.best.v1', best);
    }
    persist();
    updateScore();
    renderCards();
    successText.textContent = `Найдено ${levels[difficulty].pairs} пар за ${state.moves} ходов. ${state.hints ? 'Поиграем ещё?' : 'Отличная память!'}`;
    successDialog.hidden = false;
    message('Ура! Ты нашёл все пары!');
    app.sound([523, 659, 784, 1047], .15);
  }

  function flip(index) {
    if (locked || state.won || hintIndices.length || selected.includes(index) || state.matched.includes(index)) return;
    state.started = true;
    selected.push(index);
    renderCards();
    if (selected.length !== 2) { app.sound([440], .065); return; }
    state.moves++;
    updateScore();
    const [a, b] = selected;
    if (state.order[a] === state.order[b]) {
      state.matched.push(a, b);
      updateScore();
      selected = [];
      app.sound([620, 820], .12);
      persist();
      renderCards();
      if (state.matched.length === state.order.length) finish();
      else message('Пара найдена! Продолжай искать.');
      return;
    }
    locked = true;
    message('Разные картинки. Попробуй запомнить их!');
    renderCards();
    app.sound([310], .1);
    delayedClose = setTimeout(() => {
      selected = [];
      locked = false;
      delayedClose = null;
      renderCards();
      persist();
    }, 950);
  }

  function showHint() {
    if (locked || state.won || hintIndices.length) return;
    const candidates = state.order.map((value, index) => ({ value, index })).filter(item => !state.matched.includes(item.index));
    const icon = selected.length ? state.order[selected[0]] : candidates[0]?.value;
    if (!icon) return;
    hintIndices = candidates.filter(item => item.value === icon).map(item => item.index);
    state.hints++;
    locked = true;
    message('Посмотри на подсвеченную пару и запомни её!');
    renderCards();
    delayedHint = setTimeout(() => {
      hintIndices = [];
      locked = false;
      delayedHint = null;
      renderCards();
      persist();
    }, 1450);
  }

  function refreshSound() {
    const enabled = app.soundEnabled();
    soundButton.setAttribute('aria-pressed', String(enabled));
    soundButton.firstChild.textContent = enabled ? '🔊 ' : '🔇 ';
  }

  document.querySelectorAll('[data-difficulty]').forEach(button => button.addEventListener('click', () => loadLevel(button.dataset.difficulty)));
  document.querySelector('#newGame').addEventListener('click', () => loadLevel(difficulty, true));
  document.querySelector('#againButton').addEventListener('click', () => loadLevel(difficulty, true));
  hintButton.addEventListener('click', showHint);
  soundButton.addEventListener('click', () => { app.setSound(!app.soundEnabled()); refreshSound(); app.sound([550, 740], .075); });
  setInterval(() => {
    if (!state || !state.started || state.won || document.hidden) return;
    state.seconds++;
    clockValue.textContent = app.duration(state.seconds);
    persist();
  }, 1000);
  window.addEventListener('pagehide', () => { if (state) persist(); });
  refreshSound();
  loadLevel(difficulty);
})();
