(() => {
  'use strict';
  const W = window.Workshop, R = window.MarbleLab, { element: el, button } = W;
  const KEY = 'workshop.marble-lab.v1', raw = Igroland.read(KEY, {});
  const sessions = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const params = new URLSearchParams(location.search);
  let level = R.byId(params.get('level')), design, selected = null, tool = 'rail', undo = [], workId = null, gesture = null, ghosts = false;
  let balls = [], mode = 'edit', raf = 0, last = 0, accumulator = 0, elapsed = 0, requested = 1, spawned = 0, colliders = [];
  const ui = W.shell('Шариковая мастерская', 'Построй дорожку. Запусти шарик. Посмотри, что можно улучшить.', R.LEVELS, load);
  ui.details.append(el('p', '', 'Выбери жёлоб, воронку или пружину и нажми на поле. Инструмент «Двигать» позволяет перетаскивать детали. Поворот и длина меняются кнопками. Зелёные детали задания закреплены.'));
  ui.details.append(el('p', '', 'В свободной мастерской можно менять старт и финиш. Редактор сохраняет трассу, но не полёт шариков. До 30 деталей, 3 шариков одновременно и 24 работ на общей полке. Это игровая модель, не инженерный расчёт.'));
  const actions = el('div', 'ws-actions'), editActions = el('div', 'ws-actions'), board = el('div', 'ws-board');
  const canvas = el('canvas'); canvas.width = 640; canvas.height = 480; canvas.tabIndex = 0; canvas.setAttribute('role', 'group'); canvas.setAttribute('aria-label', 'Конструктор трассы. Выбери инструмент и нажми на поле.');
  const ctx = canvas.getContext('2d'); board.append(canvas);
  const banner = el('div', 'ws-banner'); banner.hidden = true;
  ui.main.append(actions, editActions, board, banner, el('p', 'ws-caption', 'Зелёное — закреплено. Голубое — твои жёлобы. Оранжевое — воронка. Фиолетовое — пружина. Сначала останови шарики, чтобы менять трассу.'));
  const runButton = button('▶ Запустить', () => run(1), 'ws-button primary');
  const pauseButton = button('Пауза', () => { if (mode === 'running') pause(); else if (mode === 'paused') { mode = 'running'; last = 0; frameStart(); controls(); } });
  const stopButton = button('■ В редактор', () => stop());
  actions.append(runButton, button('Три шарика', () => run(3)), pauseButton, stopButton);
  const undoButton = button('↶ Отмена', () => { if (!undo.length) return; stop(); design = undo.pop(); selected = null; changed(); });
  const ghostButton = button('Контур маршрута', () => { ghosts = !ghosts; ghostButton.setAttribute('aria-pressed', String(ghosts)); ui.notify(ghosts ? 'Пунктир — один из возможных маршрутов. Можно построить иначе.' : 'Контур скрыт.'); draw(); });
  const soundButton = button('Звук', () => { Igroland.setSound(!Igroland.soundEnabled()); soundButton.setAttribute('aria-pressed', String(Igroland.soundEnabled())); }); soundButton.setAttribute('aria-pressed', String(Igroland.soundEnabled()));
  actions.append(ghostButton, soundButton);
  function editSelected(action) { if (mode === 'running' || mode === 'paused') return ui.notify('Сначала нажми «В редактор».'); if (mode === 'finished') stop(); const p = design.parts.find(p => p.id === selected); if (!p) return ui.notify('Выбери свою деталь инструментом «Двигать».'); record(); action(p); changed(); }
  editActions.append(undoButton,
    button('↶ 15°', () => editSelected(p => { p.angle = normalize(p.angle - 15); })),
    button('↷ 15°', () => editSelected(p => { p.angle = normalize(p.angle + 15); })),
    button('Короче', () => editSelected(p => { p.length = Math.max(60, p.length - 20); })),
    button('Длиннее', () => editSelected(p => { p.length = Math.min(240, p.length + 20); })),
    button('Убрать', () => editSelected(p => { design.parts = design.parts.filter(x => x.id !== p.id); selected = null; })),
    button('Заново', () => { if (!confirm('Начать эту трассу заново? Сохранённые работы останутся на полке.')) return; load(level.id, true); }));
  const TOOL_NAMES = { rail: 'Жёлоб', funnel: 'Воронка', spring: 'Пружина', move: 'Двигать', erase: 'Ластик', start: 'Старт', goal: 'Финиш' };
  Object.entries(TOOL_NAMES).forEach(([id, name]) => { const b = button(name, () => { tool = id; toolState(); }); b.dataset.tool = id; ui.tools.append(b); });
  ui.savebox.append(button('Сохранить на полку', () => {
    const data = { ...W.clone(design), parts: [...R.fixed(level), ...design.parts].map((p, i) => ({ ...p, id: i + 1 })) };
    const result = W.saveWork('marble-lab', ui.name.value, data, workId);
    if (result.error) return ui.notify(result.error); workId = result.item.id; ui.name.value = result.item.name; ui.notify('Трасса сохранена на полку «Мои работы».');
  }, 'ws-button primary'));
  function normalize(a) { return ((a + 180) % 360 + 360) % 360 - 180; }
  function toolState() { [...ui.tools.children].forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.tool === tool)); b.disabled = ['start', 'goal'].includes(b.dataset.tool) && level.id !== 'free'; }); }
  function record() { undo.push(W.clone(design)); if (undo.length > 60) undo.shift(); }
  function persist() { sessions[level.id] = W.clone(design); const ok = Igroland.write(KEY, sessions); if (!ok) ui.notify('Не удалось сохранить черновик. Не закрывай страницу с работой.'); return ok; }
  function changed() { persist(); controls(); draw(); }
  function controls() { pauseButton.disabled = !['running', 'paused'].includes(mode); pauseButton.textContent = mode === 'paused' ? 'Продолжить' : 'Пауза'; stopButton.disabled = mode === 'edit'; undoButton.disabled = !undo.length; runButton.disabled = mode === 'running'; }
  function stop() { cancelAnimationFrame(raf); raf = 0; last = accumulator = elapsed = 0; mode = 'edit'; balls = []; spawned = 0; banner.hidden = true; controls(); draw(); }
  function pause() { cancelAnimationFrame(raf); raf = 0; mode = 'paused'; controls(); ui.notify('Пауза. Нажми «Продолжить», когда будешь готов.'); }
  function run(count) {
    stop(); mode = 'running'; requested = count; spawned = 0; colliders = [...R.fixed(level), ...design.parts].flatMap(R.segments);
    ui.notify('Наблюдай за шариком. Если не получится, поправим трассу.'); controls(); frameStart();
  }
  function frameStart() { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  function frame(time) {
    if (mode !== 'running') return;
    const delta = last ? Math.min(.05, (time - last) / 1000) : 0; last = time; accumulator += delta;
    while (accumulator >= R.DT) {
      elapsed += R.DT; accumulator -= R.DT;
      if (spawned < requested && elapsed >= spawned * .6) { balls.push(R.ballAt(design.spawn)); spawned++; }
      balls.forEach(b => R.step(b, colliders, design.goal));
    }
    draw();
    if (spawned === requested && balls.every(b => b.status !== 'moving')) {
      mode = 'finished'; const wins = balls.filter(b => b.status === 'won').length; controls(); banner.hidden = false;
      banner.replaceChildren(el('strong', '', wins ? 'Шарик добрался!' : 'Попробуем другой путь'), el('span', '', wins ? `В чашке ${wins} из ${requested}. Можно улучшить трассу или выбрать новое задание.` : 'Шарик не дошёл или остановился. Вернись в редактор, проверь наклон и стыки деталей.'));
      if (wins) Igroland.sound([523,659,784], .11);
      ui.notify(wins ? 'Финиш! Трассу можно сохранить.' : 'Попытка закончилась. Твоя трасса осталась на месте.');
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function load(id, reset = false) {
    cancelAnimationFrame(raf); gesture = null; level = R.byId(id);
    let saved = !reset && R.validDesign(sessions[level.id]);
    if (saved && saved.parts.length + R.fixed(level).length > 30) saved = null;
    design = saved || { parts: [], spawn: { ...level.spawn }, goal: { ...level.goal } };
    if (level.id !== 'free') { design.spawn = { ...level.spawn }; design.goal = { ...level.goal }; }
    undo = []; selected = null; workId = null; ghosts = false; tool = 'rail';
    ui.select.value = level.id; ui.help.textContent = level.text; ui.name.value = level.id === 'free' ? '' : level.title.replace(/^\d+\. /, '');
    ghostButton.hidden = level.id === 'free'; ghostButton.setAttribute('aria-pressed', 'false'); W.route(level.id); toolState(); stop(); if (persist()) ui.notify(level.text);
  }
  function line(a, b, color, width, dash = []) { ctx.beginPath(); ctx.setLineDash(dash); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.setLineDash([]); }
  function renderPart(p, isFixed, ghost = false) {
    const color = p.type === 'funnel' ? '#e8a359' : p.type === 'spring' ? '#a37bd3' : isFixed ? '#68b5a2' : '#6faddb';
    const segments = R.segments(p);
    if (ghost) { segments.forEach(s => line(s.a, s.b, '#bdc8c9', 5, [6, 8])); return; }
    segments.forEach(s => { line({x:s.a.x,y:s.a.y+4},{x:s.b.x,y:s.b.y+4},'#c6d4d7',11); line(s.a,s.b,color,11); line({x:s.a.x,y:s.a.y-2},{x:s.b.x,y:s.b.y-2},'#ffffff65',2); });
    if (p.type === 'spring') {
      const a = p.angle * Math.PI / 180; ctx.save(); ctx.translate(p.x,p.y);ctx.rotate(a);ctx.beginPath();ctx.moveTo(-35,8);for(let i=0;i<8;i++)ctx.lineTo(-35+i*10,i%2?21:8);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();ctx.restore();
    }
    ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle=isFixed?'#287c6e':'#fff';ctx.fill();
    if (!isFixed && p.id === selected) { ctx.beginPath();ctx.arc(p.x,p.y,17,0,Math.PI*2);ctx.strokeStyle='#376587';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]); }
  }
  function marble(x, y, index) {
    const colors = ['#eb809c','#e8b948','#847bcd']; const g=ctx.createRadialGradient(x-4,y-5,1,x,y,12);g.addColorStop(0,'#fff6fc');g.addColorStop(.3,colors[index%3]);g.addColorStop(1,colors[index%3]);ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.stroke();
  }
  function draw() {
    if (!design || !ctx) return;
    ctx.setTransform(canvas.width/640,0,0,canvas.height/480,0,0); ctx.clearRect(0,0,640,480);ctx.fillStyle='#f5faf9';ctx.fillRect(0,0,640,480);ctx.lineCap='round';
    ctx.fillStyle='#d6e6e3';for(let x=20;x<640;x+=20)for(let y=20;y<480;y+=20){ctx.beginPath();ctx.arc(x,y,.8,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#e7f4e9';ctx.beginPath();ctx.ellipse(140,490,270,65,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e8f0f8';ctx.beginPath();ctx.ellipse(560,500,260,65,0,0,Math.PI*2);ctx.fill();
    if (ghosts) R.solution(level).forEach(p=>renderPart(p,false,true));
    R.fixed(level).forEach(p=>renderPart(p,true));design.parts.forEach(p=>renderPart(p,false));
    const s=design.spawn,g=design.goal;
    ctx.beginPath();ctx.arc(s.x,s.y,19,0,Math.PI*2);ctx.strokeStyle='#cba2b4';ctx.lineWidth=2;ctx.setLineDash([3,5]);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#9e7a8e';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText('СТАРТ',s.x,Math.max(13,s.y-27));
    ctx.beginPath();ctx.moveTo(g.x-34,g.y-21);ctx.lineTo(g.x-27,g.y+24);ctx.quadraticCurveTo(g.x,g.y+38,g.x+27,g.y+24);ctx.lineTo(g.x+34,g.y-21);ctx.closePath();ctx.fillStyle='#f3d58b';ctx.fill();ctx.strokeStyle='#d5ac52';ctx.lineWidth=3;ctx.stroke();line({x:g.x-38,y:g.y-21},{x:g.x+38,y:g.y-21},'#dfbb6d',6);
    ctx.fillStyle='#9e8146';ctx.font='bold 11px system-ui';ctx.fillText('ФИНИШ',g.x,Math.min(472,g.y+51));
    if (!balls.length) marble(s.x,s.y,0);
    balls.forEach((b,i)=>{if(b.status==='moving')marble(b.x,b.y,i);if(b.status==='won')marble(g.x-14+i*12,g.y+9,i);});
  }
  function resize() { const width=canvas.getBoundingClientRect().width;if(!width)return;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(width*.75*dpr);draw(); }
  function point(e) {const r=canvas.getBoundingClientRect();return {x:Math.max(25,Math.min(615,(e.clientX-r.left)*640/r.width)),y:Math.max(20,Math.min(450,(e.clientY-r.top)*480/r.height))};}
  function hit(pt) {return design.parts.slice().reverse().find(p=>R.segments(p).some(s=>{const q=R.closest(pt,s.a,s.b);return Math.hypot(pt.x-q.x,pt.y-q.y)<24;}));}
  canvas.addEventListener('pointerdown',e=>{
    if(gesture||(e.pointerType==='mouse'&&e.button!==0))return;if(mode==='running'||mode==='paused')return ui.notify('Сначала нажми «В редактор».');
    if(mode==='finished')stop();
    const pt=point(e),p=hit(pt);gesture={pointer:e.pointerId,start:pt,before:W.clone(design),part:tool==='move'?p:null};
    if(p&&tool==='move')selected=p.id;
    canvas.setPointerCapture(e.pointerId);e.preventDefault();draw();
  });
  canvas.addEventListener('pointermove',e=>{if(!gesture||gesture.pointer!==e.pointerId||!gesture.part)return;const pt=point(e),original=gesture.before.parts.find(p=>p.id===gesture.part.id);gesture.part.x=Math.max(25,Math.min(615,original.x+pt.x-gesture.start.x));gesture.part.y=Math.max(20,Math.min(450,original.y+pt.y-gesture.start.y));draw();});
  function end(e,cancelled){
    if(!gesture||gesture.pointer!==e.pointerId)return;const g=gesture;gesture=null;
    if(cancelled){design=g.before;draw();return;}
    const pt=point(e);
    if(tool==='erase'){const p=hit(pt);if(p){design.parts=design.parts.filter(x=>x.id!==p.id);selected=null;}}
    else if(['start','goal'].includes(tool)&&level.id==='free')design[tool==='start'?'spawn':'goal']=pt;
    else if(['rail','funnel','spring'].includes(tool)){
      if(design.parts.length+R.fixed(level).length>=30)ui.notify('На поле 30 деталей. Убери лишнюю, чтобы добавить новую.');
      else{selected=1+Math.max(100,...design.parts.map(p=>p.id));design.parts.push(R.part(selected,Math.round(pt.x/5)*5,Math.round(pt.y/5)*5,tool==='rail'?25:0,tool));}
    }else if(tool==='move'&&!g.part)ui.notify('Нажми на голубую, оранжевую или фиолетовую деталь, затем перетащи.');
    if(JSON.stringify(g.before)!==JSON.stringify(design)){undo.push(g.before);if(undo.length>60)undo.shift();}
    changed();
  }
  canvas.addEventListener('pointerup',e=>end(e,false));canvas.addEventListener('pointercancel',e=>end(e,true));canvas.addEventListener('lostpointercapture',e=>end(e,true));
  canvas.addEventListener('keydown',e=>{const d={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,-5],ArrowDown:[0,5]}[e.key];if(d){e.preventDefault();editSelected(p=>{p.x=Math.max(25,Math.min(615,p.x+d[0]));p.y=Math.max(20,Math.min(450,p.y+d[1]));});}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='running')pause();});
  window.addEventListener('pagehide',()=>{persist();cancelAnimationFrame(raf);});
  if(typeof ResizeObserver==='function')new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);
  load(level.id);resize();
  const opened=W.entries().find(e=>e.id===params.get('work')&&e.game==='marble-lab');
  if(opened){const valid=R.validDesign(opened.data);if(valid){load('free');design=valid;workId=opened.id;ui.name.value=opened.name;changed();ui.notify('Трасса открыта. Можно достроить её и снова запустить шарики.');}else ui.notify('Работа повреждена. Другие работы остались на полке.');}
})();
