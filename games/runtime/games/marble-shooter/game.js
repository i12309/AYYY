(() => {
  'use strict';
  const app=window.Igroland,levels=window.MarbleLevels,engine=window.MarbleEngine;
  const $=id=>document.getElementById(id);
  const canvas=$('marbleCanvas'), renderer=new window.MarbleRenderer(canvas);
  const params=new URLSearchParams(location.search);
  const storedMode=app.read('marble.mode.v1','kid');
  let mode=levels.MODES[storedMode]?storedMode:'kid';
  let levelId=levels.levelById(params.get('level'))?.id || levels.levelById(app.read('marble.selected.v1',1))?.id || 1;
  let game=null,lastTime=0,lastSave=0,lastHud=0,lastEvent=null,lastStatus='',hintUntil=0;
  let observed={w:0,h:0};
  const pointerMap=new Map();
  let gesture=null,gestureUsed=false,aimAngle=-.8;
  const finished=app.read('marble.completed.v1',{});
  const completed=finished&&typeof finished==='object'&&!Array.isArray(finished)?finished:{};
  const message=text=>{$('marbleMessage').textContent=text;};
  const saveKey=(id=levelId,selectedMode=mode)=>`marble.level.v1.${selectedMode}.${id}`;
  const save=()=>{
    if(!game)return;
    app.write(saveKey(game.level.id,game.mode),game.snapshot());
    app.write('marble.selected.v1',levelId);
    app.write('marble.mode.v1',mode);
  };
  function makeLevelButtons() {
    const frag=document.createDocumentFragment();
    for(const lvl of levels.LEVELS) {
      const button=document.createElement('button');button.type='button';button.className='marble-level';
      button.dataset.level=String(lvl.id);
      const done=Boolean(completed[mode]?.[lvl.id]);
      button.innerHTML=`<span class="num">${lvl.id}</span><span class="details"><strong>${lvl.title}</strong><small>${done?'✓ Пройден':'Уровень '+lvl.id}</small></span>`;
      button.setAttribute('aria-label',`${lvl.title}, уровень ${lvl.id}${done?', пройден':''}`);
      button.setAttribute('aria-pressed',String(levelId===lvl.id));
      button.addEventListener('click',()=>load(lvl.id));frag.append(button);
    }
    $('marbleLevels').replaceChildren(frag);
  }
  function setSize() {
    const portrait=window.matchMedia('(max-width: 720px)').matches;
    const w=portrait?600:960,h=portrait?820:680;
    if(observed.w===w&&observed.h===h)return;
    observed={w,h};renderer.setSize(w,h);renderer.resetView();
    if(game)game.resize(w,h);
    const angle=aimAngle;renderer.aim={x:w*.51+Math.cos(angle)*230,y:h*.54+Math.sin(angle)*230};
  }
  function load(id,reset=false) {
    const level=levels.levelById(id)||levels.LEVELS[0];
    if(game)save();
    levelId=level.id;
    pointerMap.clear();gesture=null;gestureUsed=false;hintUntil=0;lastEvent=null;
    const seed=0x12345+(level.id*21211)+(mode==='normal'?9277:mode==='expert'?14971:0);
    game=new engine.Game(level,mode,seed,observed.w||960,observed.h||680);
    if(!reset){const stored=app.read(saveKey(),null);if(stored)game.restore(stored);}
    if(reset)app.write(saveKey(),null);
    renderer.resetView();renderer.highlight=-1;
    $('marbleTitle').textContent=level.title;
    $('marbleSubtitle').textContent=level.description;
    $('marbleOverlay').hidden=true;
    $('modeSelect').value=mode;
    makeLevelButtons();setSize();updateHud();
    message('Собери три шарика одного цвета. Нажми на поле, чтобы выстрелить.');
    try { history.replaceState(null,'',`?level=${levelId}`); } catch (_) { /* about:blank/file:// browser previews */ }
    if(game.status==='won'||game.status==='lost'||game.status==='paused')renderOverlay();
    save();
  }
  function updateHud() {
    if(!game)return;
    $('scoreValue').textContent=game.score.toLocaleString('ru-RU');
    $('ballValue').textContent=String(game.chain.length);
    $('timeValue').textContent=app.duration(game.elapsed);
    $('marbleNow').style.background=levels.COLORS[game.current].hex;
    $('marbleNext').style.background=levels.COLORS[game.next].hex;
    for(const key of ['freeze','bomb','reverse']) {
      $(key+'Count').textContent=String(game.charges[key]);
      $(key+'Button').disabled=game.charges[key]===0||game.status!=='playing'||(key==='bomb'&&Boolean(game.projectile));
    }
    $('bombButton').setAttribute('aria-pressed',String(game.armedBomb));
    $('soundButton').setAttribute('aria-pressed',String(app.soundEnabled()));
    $('soundButton').textContent=app.soundEnabled()?'♫ Звук вкл.':'♪ Звук';
    $('undoButton').disabled=game.undoStack.length===0;
    $('swapButton').disabled=game.status!=='playing'||Boolean(game.projectile);
    $('pauseButton').textContent=game.status==='paused'?'▶ Продолжить':'Ⅱ Пауза';
    $('pauseButton').disabled=game.status==='won'||game.status==='lost';
  }
  function showOverlay(title,description,icon,button,secondary) {
    $('overlayIcon').textContent=icon;$('overlayTitle').textContent=title;$('overlayText').textContent=description;
    $('overlayAction').textContent=button;$('overlaySecondary').textContent=secondary;
    $('marbleOverlay').hidden=false;
  }
  function renderOverlay() {
    if(game.status==='won') {
      const index=levels.LEVELS.findIndex(l=>l.id===levelId);
      showOverlay('Все шарики собраны!',`Уровень ${levelId} пройден! ${game.score.toLocaleString('ru-RU')} очков за ${app.duration(game.elapsed)}.`,`🏆`,index<levels.LEVELS.length-1?'Следующий уровень →':'Играть ещё','Повторить уровень');
    } else if(game.status==='lost') {
      showOverlay('Попробуем ещё?',`Шарики добрались до звёздочки. Ты уже знаешь, как собирать цвета!`,`🌟`,'Попробовать снова','Выбрать лёгкий режим');
    } else if(game.status==='paused') {
      showOverlay('Пауза','Отдохни и продолжай, когда захочешь.','⏸️','Продолжить','Заново');
    } else $('marbleOverlay').hidden=true;
  }
  function complete() {
    if(!completed[mode]||typeof completed[mode]!=='object')completed[mode]={};
    const prior=completed[mode][levelId];
    if(!prior||prior.score<game.score||!Number.isFinite(prior.score)){
      completed[mode][levelId]={score:game.score,seconds:Math.floor(game.elapsed)};
      app.write('marble.completed.v1',completed);
    }
    makeLevelButtons();
  }
  function onGameEvent(event) {
    if(!event)return;
    if(event.type==='shoot')app.sound([360],.065);
    if(event.type==='match'){app.sound(event.combo>1?[440,640,820]:[410,640],.095);message(`Отлично! Исчезло ${event.removed} шариков. +${game.score.toLocaleString('ru-RU')} очков всего!`);}
    if(event.type==='insert'){app.sound([190],.07);message('Попробуй попасть в два шарика того же цвета.');}
    if(event.type==='miss')message('Ничего страшного! Прицелься ещё раз.');
    if(event.type==='bomb'){app.sound([200,310,480],.07);message(`Бум! Удалено ${event.removed} шариков.`);}
    if(event.type==='power'){app.sound([510,690],.09);message({freeze:'Цепочка замедлилась на 8 секунд.',bomb:'Следующий выстрел — взрывной!',reverse:'Шарики отступили назад!'}[event.power]);}
    if(event.type==='won'){app.sound([440,550,660,880],.14);complete();message('Победа! Ты собрал все шарики!');}
    if(event.type==='lost'){app.sound([260,210],.15);message('Можно попробовать снова или выбрать режим «Малыш».');}
    save();updateHud();
  }
  function togglePause() {
    if(game.status==='playing'){game.status='paused';game.projectile=null;message('Игра на паузе.');}
    else if(game.status==='paused'){game.status='playing';message('Продолжаем!');}
    renderOverlay();save();updateHud();
  }
  function fire(target) {
    if(!game||game.status!=='playing')return;
    if(game.fire(target.x,target.y)){renderer.highlight=-1;hintUntil=0;updateHud();save();}
  }
  function getCanvasPoint(event) {
    const bounds=canvas.getBoundingClientRect();
    return {x:(event.clientX-bounds.left)*renderer.w/bounds.width,
            y:(event.clientY-bounds.top)*renderer.h/bounds.height};
  }
  function aimAt(point) {
    const world=renderer.screenToWorld(point.x,point.y);
    const dx=world.x-game.cannon.x,dy=world.y-game.cannon.y;
    if(Math.hypot(dx,dy)>=6){renderer.aim=world;aimAngle=Math.atan2(dy,dx);}
    return world;
  }
  function pinch() {
    if(pointerMap.size<2)return;
    const [a,b]=[...pointerMap.values()];
    return {mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},dist:Math.hypot(a.x-b.x,a.y-b.y)};
  }
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.pointerType==='mouse')return;
    const pt=getCanvasPoint(e);pointerMap.set(e.pointerId,pt);
    try { canvas.setPointerCapture?.(e.pointerId); } catch (_) { /* synthetic events and older browsers */ }
    if(pointerMap.size===2) {
      const g=pinch();gesture={startDist:g.dist||1,startZoom:renderer.zoom,anchor:renderer.screenToWorld(g.mid.x,g.mid.y)};
      gestureUsed=true;
    } else if(pointerMap.size===1) {
      gestureUsed=false;
      aimAt(pt);
      if(e.pointerType==='mouse')fire(renderer.aim);
    }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove',e=>{
    const pt=getCanvasPoint(e);
    if(pointerMap.has(e.pointerId))pointerMap.set(e.pointerId,pt);
    if(pointerMap.size>=2&&gesture) {
      const g=pinch(),newZoom=levels.clamp(gesture.startZoom*(g.dist/gesture.startDist),1,1.9);
      renderer.zoom=newZoom;
      renderer.panX=g.mid.x-renderer.w/2-(gesture.anchor.x-renderer.w/2)*newZoom;
      renderer.panY=g.mid.y-renderer.h/2-(gesture.anchor.y-renderer.h/2)*newZoom;
      renderer.clampPan();
    } else if(e.pointerType==='mouse'||pointerMap.has(e.pointerId))aimAt(pt);
    e.preventDefault();
  });
  function endPointer(e) {
    const wasSingle=pointerMap.size===1;
    const pt=getCanvasPoint(e);
    pointerMap.delete(e.pointerId);
    if(e.type==='pointerup'&&e.pointerType!=='mouse'&&wasSingle&&!gestureUsed)fire(aimAt(pt));
    if(pointerMap.size<2)gesture=null;
    if(pointerMap.size===0)gestureUsed=false;
    e.preventDefault();
  }
  canvas.addEventListener('pointerup',endPointer);
  canvas.addEventListener('pointercancel',endPointer);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();const p=getCanvasPoint(e);
    renderer.setZoom(renderer.zoom*(e.deltaY<0?1.12:1/1.12),p.x,p.y);
  },{passive:false});
  $('zoomIn').addEventListener('click',()=>renderer.setZoom(renderer.zoom*1.2));
  $('zoomOut').addEventListener('click',()=>renderer.setZoom(renderer.zoom/1.2));
  $('fitButton').addEventListener('click',()=>renderer.resetView());
  $('swapButton').addEventListener('click',()=>{if(game.swap()){app.sound([470],.07);updateHud();save();message('Цвета шариков поменялись местами.');}});
  $('hintButton').addEventListener('click',()=>{
    const h=game.hint();if(!h){message('Пока нет доступной пары. Подожди, когда появятся шарики.');return;}
    renderer.highlight=h.index;hintUntil=performance.now()+5000;
    if(game.current===h.color)message(`Подсказка: стреляй в подсвеченные ${levels.COLORS[h.color].name} шарики.`);
    else if(game.next===h.color)message(`Подсказка: нажми «Поменять шар», затем стреляй в ${levels.COLORS[h.color].name} шарики.`);
    else message(`Подсказка: ищи ${levels.COLORS[h.color].name} цвет. Можно выстрелить, чтобы получить другой шар.`);
    app.sound([630],.1);
  });
  $('undoButton').addEventListener('click',()=>{if(game.undo()){lastEvent=null;renderer.highlight=-1;message('Последний выстрел отменён.');renderOverlay();updateHud();save();}});
  $('pauseButton').addEventListener('click',togglePause);
  $('retryButton').addEventListener('click',()=>load(levelId,true));
  $('freezeButton').addEventListener('click',()=>{if(game.activate('freeze')){lastEvent=null;onGameEvent(game.lastEvent);}});
  $('bombButton').addEventListener('click',()=>{if(game.activate('bomb')){lastEvent=null;onGameEvent(game.lastEvent);}});
  $('reverseButton').addEventListener('click',()=>{if(game.activate('reverse')){lastEvent=null;onGameEvent(game.lastEvent);}});
  $('soundButton').addEventListener('click',()=>{app.setSound(!app.soundEnabled());updateHud();if(app.soundEnabled())app.sound([660],.11);});
  $('modeSelect').addEventListener('change',e=>{
    if(!levels.MODES[e.target.value])return;
    save();mode=e.target.value;load(levelId);message(`Режим: ${levels.MODES[mode].title}.`);
  });
  $('overlayAction').addEventListener('click',()=>{
    if(game.status==='won')load(levelId<10?levelId+1:levelId,levelId===10);
    else if(game.status==='lost')load(levelId,true);
    else if(game.status==='paused')togglePause();
  });
  $('overlaySecondary').addEventListener('click',()=>{
    if(game.status==='lost'){$('modeSelect').value='kid';mode='kid';load(levelId,true);}
    else load(levelId,true);
  });
  window.addEventListener('keydown',e=>{
    if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName||''))return;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowDown'){
      e.preventDefault();aimAngle+=e.key==='ArrowLeft'?.10:e.key==='ArrowRight'?-.10:e.key==='ArrowUp'?-.065:.065;
      renderer.aim={x:game.cannon.x+Math.cos(aimAngle)*250,y:game.cannon.y+Math.sin(aimAngle)*250};
    } else if(e.key===' '){e.preventDefault();fire(renderer.aim);}
    else if(e.key.toLowerCase()==='s'){game.swap();updateHud();}
    else if(e.key.toLowerCase()==='p'){togglePause();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(game.undo()){renderOverlay();updateHud();save();}}
  });
  function loop(now) {
    const dt=Math.min(.05,lastTime?(now-lastTime)/1000:0);
    lastTime=now;
    if(game){
      const before=game.status;
      game.update(document.hidden?0:dt);
      if(game.lastEvent&&game.lastEvent!==lastEvent){lastEvent=game.lastEvent;onGameEvent(lastEvent);}
      if(before!==game.status){renderOverlay();updateHud();}
      if(hintUntil&&now>hintUntil){hintUntil=0;renderer.highlight=-1;}
      renderer.draw(game,now);
      if(now-lastHud>200){updateHud();lastHud=now;}
      if(game.status==='playing'&&now-lastSave>3500){save();lastSave=now;}
    }
    requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&game?.status==='playing'){togglePause();}
  });
  window.addEventListener('pagehide',save);
  window.addEventListener('resize',setSize);
  $('modeSelect').value=mode;setSize();load(levelId);requestAnimationFrame(loop);
})();
