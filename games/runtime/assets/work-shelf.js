(() => {
  'use strict';
  const W = window.Workshop, { element: el, button } = W;
  const root = document.getElementById('workShelf'), status = document.getElementById('shelfMessage');
  const notify = text => { status.textContent = text; };
  function validate(game, data) {
    if (game === 'shape-studio') { const pieces = ShapeRules.validPieces(data?.pieces); return pieces ? { pieces } : null; }
    return game === 'marble-lab' ? MarbleLab.validDesign(data) : null;
  }
  function preview(canvas, item) {
    canvas.width = 640; canvas.height = 480; const c = canvas.getContext('2d'); if (!c) return;
    c.fillStyle = '#f3f9f6'; c.fillRect(0, 0, 640, 480);
    const data = validate(item.game, item.data); if (!data) return;
    if (item.game === 'shape-studio') data.pieces.forEach(p => {
      c.save();c.translate(p.x,p.y);c.rotate(p.rot*Math.PI/180);c.beginPath();
      if(p.type==='circle')c.arc(0,0,40,0,Math.PI*2);else ShapeRules.TYPES[p.type].points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
      c.closePath();c.fillStyle=ShapeRules.COLORS[p.color];c.fill();c.strokeStyle='#fff';c.lineWidth=3;c.stroke();c.restore();
    });
    else {
      data.parts.forEach(p=>MarbleLab.segments(p).forEach(s=>{c.beginPath();c.moveTo(s.a.x,s.a.y);c.lineTo(s.b.x,s.b.y);c.lineWidth=12;c.lineCap='round';c.strokeStyle=p.type==='funnel'?'#e7ae61':p.type==='spring'?'#9d83cb':'#69b4a5';c.stroke();}));
      c.beginPath();c.arc(data.spawn.x,data.spawn.y,13,0,Math.PI*2);c.fillStyle='#e986a4';c.fill();c.fillStyle='#edc96a';c.fillRect(data.goal.x-32,data.goal.y-20,64,44);
    }
  }
  function exportItem(item) {
    const data = JSON.stringify({ format: 'igroland-work', version: 1, game: item.game, name: item.name, data: item.data }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `igroland-${item.game}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function render() {
    root.replaceChildren(); const entries = W.entries();
    if (!entries.length) {
      const empty = el('div', 'ws-empty'); empty.style.gridColumn = '1 / -1'; empty.append(el('h2', '', 'Здесь будут твои идеи'), el('p', '', 'Собери картинку или построй трассу и нажми «Сохранить на полку».')); root.append(empty); return;
    }
    entries.forEach(item => {
      const card = el('article', 'ws-work'), canvas = el('canvas', 'ws-thumb'); canvas.setAttribute('aria-label', `Предпросмотр: ${item.name}`);
      card.append(canvas, el('h2', '', item.name), el('p', '', item.game === 'shape-studio' ? 'Картинка из фигур' : 'Шариковая трасса'));
      const actions = el('div', 'ws-actions'), open = el('a', 'ws-button primary', 'Открыть'); open.href = `games/${item.game}/index.html?level=free&work=${encodeURIComponent(item.id)}`;
      actions.append(open, button('Сохранить файл', () => exportItem(item)), button('Удалить', () => {
        if (!confirm(`Удалить работу «${item.name}»? Другие работы останутся.`)) return;
        if (!W.removeWork(item.id)) return notify('Браузер не разрешил удалить работу.'); render(); notify('Работа удалена.');
      })); card.append(actions); root.append(card); preview(canvas, item);
    });
  }
  const input = document.getElementById('workFile'); document.getElementById('importWork').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0]; input.value = ''; if (!file) return;
    if (file.size > 100000) return notify('Файл слишком большой. Нужен файл работы Игроланда размером до 100 КБ.');
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed?.format === 'igroland-work' && parsed.version === 1 && typeof parsed.name === 'string' && validate(parsed.game, parsed.data);
      if (!data) return notify('Это не поддерживаемый файл работы Игроланда.');
      const result = W.saveWork(parsed.game, parsed.name, data); if (result.error) return notify(result.error); render(); notify('Работа добавлена на полку.');
    } catch (_) { notify('Не удалось прочитать файл. Другие работы не изменены.'); }
  });
  render();
})();
