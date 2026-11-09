(() => {
  'use strict';
  const R = window.PostRules, NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) { const n = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); return n; }
  function houseArt(h) {
    const art = svg('svg', { viewBox: '0 0 140 110', 'aria-hidden': 'true' });
    art.append(svg('ellipse', { cx: 70, cy: 104, rx: 55, ry: 5, fill: '#b9d2b9' }), svg('rect', { x: 26, y: 41, width: 88, height: 61, rx: 5, fill: '#fff8e9', stroke: '#d9c8b4', 'stroke-width': 2 }), svg('path', { d: 'M15 44 L70 5 L125 44 Z', fill: R.ROOFS[h.roof].color, stroke: '#ffffff', 'stroke-width': 2 }), svg('rect', { x: 59, y: 63, width: 25, height: 39, rx: 3, fill: R.DOORS[h.door].color }), svg('circle', { cx: 78, cy: 84, r: 2, fill: '#fff' }), svg('rect', { x: 35, y: 57, width: 16, height: 17, rx: 2, fill: '#bfdfed' }));
    const number = svg('text', { x: 99, y: 70, 'text-anchor': 'middle', fill: '#687686', 'font-family': 'system-ui', 'font-size': 14, 'font-weight': 800 }); number.textContent = h.number; art.append(number); return art;
  }
  LearningUI.mount({ id: 'story-post', title: 'Почта сказочного города', color: '#7e65b4', count: 5, levels: R.LEVELS,
    subtitle: 'Прочитай записку и доставь письмо. Адрес спрятан в словах, а не в подсветке.', customSpeech: true,
    parent: 'Записки не исчезают при ответе. Можно перечитать их и обсудить смысл. Режим двух подсказок требует одновременно учитывать крышу и дверь. В историях важно понять, где сейчас получатель. Игра не распознаёт голос ребёнка.',
    offline: 'Напишите короткую записку с адресом игрушки: «Под подушкой» или «На столе у окна». Пусть ребёнок доставит письмо по настоящей подсказке.',
    generate: R.generate, example: level => R.generate(level, 719, 0),
    render(task, area, ctx) {
      const { el, button } = ctx;
      const draft = ctx.getDraft(); let chunks = draft?.syllables === true;
      const tools = el('div', 'learn-tools'), toggle = button('Подсветить слоги', () => { chunks = !chunks; ctx.markHelp(); ctx.setDraft({ syllables: chunks }); renderLetter(); }, 'learn-button small');
      tools.append(toggle, button('Послушать письмо', () => ctx.speak(task.prompt), 'learn-button small')); area.append(tools);
      const letter = el('article', 'post-letter'); letter.setAttribute('aria-label', 'Письмо'); area.append(letter);
      const lines = [];
      function renderLetter() {
        letter.replaceChildren(el('span', 'post-stamp', '✉')); lines.length = 0; toggle.setAttribute('aria-pressed', String(chunks));
        task.lines.forEach(line => {
          const p = el('p');
          line.split(' ').forEach((word, i) => {
            if (i) p.append(document.createTextNode(' '));
            const b = button('', () => ctx.speak(word), 'post-word'); b.setAttribute('aria-label', `Прочитать слово: ${word}`);
            (chunks ? R.syllables(word) : [word]).forEach(part => b.append(el('span', 'syllable', part))); p.append(b);
          }); letter.append(p); lines.push(p);
        });
      }
      renderLetter();
      area.append(el('p', 'post-helper', 'Прочитай письмо. Нажми на дом, куда его нужно доставить. Трудное слово можно послушать нажатием.'));
      const map = el('div', 'post-map');
      for (let row = 0; row < 2; row++) {
        map.append(el('div', 'post-map-label', row === 0 ? 'ВЕРХНИЙ РЯД' : 'НИЖНИЙ РЯД'));
        const street = el('div', 'post-houses');
        task.houses.filter(h => h.row === row).forEach(h => {
          const b = button('', () => {
            if (ctx.demo) { ctx.announce(h.id === task.target ? task.explanation : 'Перечитай записку: нужен другой дом.'); return; }
            if (ctx.done) return;
            const ok = h.id === task.target;
            ctx.submit(ok, ok ? task.explanation : 'Сравни дом со словами письма. Можно перечитать записку или взять подсказку.');
            if (ok) { b.classList.add('delivered'); map.querySelectorAll('button').forEach(n => n.disabled = true); }
          }, 'post-house answer-choice');
          b.dataset.house = h.id; b.setAttribute('aria-label', R.describe(h)); b.disabled = ctx.done;
          b.append(houseArt(h), el('strong', '', `${h.person.icon} ${h.person.name}`), el('small', '', `Дом ${h.number}`));
          if (ctx.done && h.id === task.target) b.classList.add('delivered'); street.append(b);
        }); map.append(street);
        if (!row) map.append(el('div', 'post-road', 'УЛИЦА ПОЧТОВАЯ'));
      }
      area.append(map);
      if (ctx.demo) area.append(el('p', 'shop-guide', `${task.hint} ${task.explanation}`));
      ctx.onHint(() => { lines.forEach((line, i) => line.classList.toggle('highlight', task.level === 'clues' ? i < 2 : i === task.clue)); });
    }
  });
})();
