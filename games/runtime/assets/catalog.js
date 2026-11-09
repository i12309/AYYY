(() => {
  'use strict';
  const games = window.IGROLAND_GAME_REGISTRY || [];
  const coloring = window.PIXEL_LEVELS || [];
  const $ = id => document.getElementById(id);
  const artDifficulty = { easy: 'Легко', medium: 'Средне', hard: 'Сложно', expert: 'Очень сложно', master: 'Эксперт' };
  const randomIndex = count => Math.floor(Math.random() * count);
  const mix = array => {
    const shuffled = array.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomIndex(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  let featured = -1;
  let previewTiles = [];
  function chooseFeatured() {
    if (!games.length) return;
    let next = randomIndex(games.length);
    if (games.length > 1 && next === featured) next = (next + 1 + randomIndex(games.length - 1)) % games.length;
    featured = next;
    const game = games[next];
    const hero = $('featuredGame');
    hero.dataset.game = game.id;
    hero.style.setProperty('--hero-accent', game.color);
    hero.style.setProperty('--hero-tint', game.tint);
    $('featuredCategory').textContent = `${game.category} · ${game.difficulty}`;
    $('featuredTitle').textContent = game.title;
    $('featuredDescription').textContent = game.description;
    $('featuredPlay').href = game.link;
    $('featuredVisualCategory').textContent = game.category.toUpperCase();
    $('featuredVisualTitle').textContent = game.title;
    $('featuredVisualCaption').textContent = game.short;
    $('featuredSymbols').replaceChildren(...game.visual.map((symbol, index) => {
      const block = make('span', `hero-symbol hero-symbol-${index + 1}`, symbol);
      return block;
    }));
  }
  function gameCard(game, index) {
    const feature = index === 0;
    const a = make('a', feature ? 'game-feature-card' : 'upcoming-card ready-card');
    a.href = game.link;
    a.setAttribute('aria-label', `Играть: ${game.title}`);
    const art = make('div', feature ? 'game-feature-illustration catalog-illustration' : `upcoming-icon catalog-illustration card-${game.id}`);
    art.style.setProperty('--card-tint', game.tint);
    art.style.setProperty('--card-accent', game.color);
    art.setAttribute('aria-hidden', 'true');
    const symbols = make('div', 'catalog-card-symbols');
    game.visual.slice(0, feature ? 4 : 3).forEach(icon => symbols.append(make('span', 'catalog-card-symbol', icon)));
    art.append(symbols);
    const content = feature ? make('div', 'game-feature-body') : document.createDocumentFragment();
    const tag = make('span', 'mini-pill green', 'МОЖНО ИГРАТЬ');
    const title = make('h3', '', game.title);
    const desc = make('p', '', game.description);
    const call = make('span', 'feature-cta', 'Открыть игру →');
    content.append(tag, title, desc, call);
    a.append(art, content);
    return a;
  }
  function drawPreview(canvas, level) {
    const rows = level?.rows;
    if (!Array.isArray(rows) || !rows.length) return;
    const w = rows[0].length, h = rows.length;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || 160, height = canvas.clientHeight || 160;
    canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    const unit = Math.min((width - 15) / w, (height - 15) / h, 9);
    const left = (width - w * unit) / 2, top = (height - h * unit) / 2;
    rows.forEach((row, r) => [...row].forEach((key, c) => {
      if (key === '.' || !level.palette[key]) return;
      ctx.fillStyle = level.palette[key];
      ctx.fillRect(left + c * unit, top + r * unit, Math.ceil(unit), Math.ceil(unit));
    }));
  }
  function allLevels() {
    return games.flatMap(game => {
      const levels = game.id === 'coloring'
        ? coloring.map(level => ({
          title: level.title, detail: 'Раскраска', difficulty: level.difficulty,
          icon: '🎨', pixel: level, link: `games/coloring/index.html?level=${encodeURIComponent(level.id)}`
        })) : game.levels;
      return levels.map(level => ({ ...level, game }));
    });
  }
  function renderLevels() {
    const all = allLevels();
    const result = [];
    // Include at least one genuine level from EVERY game, then add more variety.
    games.forEach(game => {
      const options = all.filter(level => level.game.id === game.id);
      if (options.length) result.push(options[randomIndex(options.length)]);
    });
    const picked = new Set(result.map(level => level.link));
    for (const level of mix(all.filter(level => !picked.has(level.link)))) {
      if (result.length >= 12) break;
      result.push(level);
    }
    const gallery = $('levelGallery'); gallery.replaceChildren(); previewTiles = [];
    mix(result).forEach(level => {
      const card = make('a', 'level-tile');
      card.href = level.link;
      card.setAttribute('aria-label', `${level.game.title}: ${level.title}, ${artDifficulty[level.difficulty] || 'Уровень'}`);
      const visual = make('div', `level-tile-visual visual-${level.game.id}`);
      visual.style.setProperty('--tile-accent', level.game.color);
      visual.style.setProperty('--tile-tint', level.game.tint);
      if (level.pixel) {
        const canvas = make('canvas', 'level-pixel-preview');
        canvas.setAttribute('aria-hidden', 'true');
        visual.append(canvas); previewTiles.push({ canvas, level: level.pixel });
      } else {
        const symbol = make('span', `level-visual-symbol symbol-${level.game.id}`, level.icon);
        visual.append(symbol);
        if (level.game.id === 'mahjong') {
          const extra = make('span', 'level-mahjong-extra', '✿'); visual.append(extra);
        }
      }
      const body = make('div', 'level-tile-body');
      const name = make('span', 'level-tile-game', level.game.title);
      const title = make('strong', 'level-tile-title', level.title);
      const row = make('div', 'level-tile-meta');
      row.append(make('span', 'level-tile-detail', level.detail), make('span', `difficulty ${level.difficulty}`, artDifficulty[level.difficulty] || 'Играть'));
      body.append(name, title, row); card.append(visual, body); gallery.append(card);
    });
    requestAnimationFrame(() => previewTiles.forEach(({ canvas, level }) => drawPreview(canvas, level)));
  }
  $('gameCards').replaceChildren(...games.map(gameCard));
  $('gameCount').textContent = `${games.length} игр готовы`;
  $('featuredReroll').addEventListener('click', chooseFeatured);
  $('refreshLevels').addEventListener('click', renderLevels);
  window.addEventListener('resize', () => previewTiles.forEach(({ canvas, level }) => drawPreview(canvas, level)));
  chooseFeatured(); renderLevels();
})();
