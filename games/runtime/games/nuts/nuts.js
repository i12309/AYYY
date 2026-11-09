(() => {
  'use strict';
  const app=window.Igroland, rules=window.NutsRules;
  const $=id=>document.getElementById(id);
  const board=$('nutsBoard'), status=$('gameMessage'), modal=$('successDialog');
  const PALETTE=['#f34735','#2182ef','#f4c71e','#4abd62','#a84ade','#29bacd','#df8a23','#ee5fa9'];
  const labels=['красная','синяя','жёлтая','зелёная','фиолетовая','бирюзовая','оранжевая','розовая'];
  const SAVE='nuts.progress.v1';
  let saved=app.read(SAVE,{});if(!saved||typeof saved!=='object')saved={};
  let sessions=saved.sessions&&typeof saved.sessions==='object'?saved.sessions:{};
  const requestedLevel=Number(new URLSearchParams(location.search).get('level'));
  let level=Number.isInteger(requestedLevel)&&requestedLevel>=1&&requestedLevel<=999?requestedLevel:(Number.isInteger(saved.level)&&saved.level>0?Math.min(saved.level,999):1);
  let state=[],initial=[],history=[],solution=[],selected=null,hint=null,solved=false,request=0,worker=null;
  const clone=x=>x.map(s=>s.slice());
  const currentKey=x=>JSON.stringify(x);
  function validSave(record,n){return record&&rules.validState(record.initial,n)&&rules.validState(record.state,n)&&Array.isArray(record.history)&&record.history.length<=400&&record.history.every(s=>rules.validState(s,n))&&Number.isInteger(record.moves)&&record.moves>=0&&record.moves<=400&&typeof record.won==='boolean'&&record.won===rules.isWon(record.state)&&!rules.isWon(record.initial);}
  function persist(){sessions[level]={state:clone(state),initial:clone(initial),history:history.map(clone),moves:history.length,won:solved};app.write(SAVE,{level,sessions});}
  function say(msg){status.textContent=msg;}
  function cancelHint(){hint=null;request++;if(worker){worker.terminate();worker=null;}}
  function load(num,keepProgress=true){
    level=Math.max(1,Math.min(999,num));selected=null;cancelHint();
    const generated=rules.create(level); initial=clone(generated.stacks);solution=generated.answer;
    const prior=keepProgress?sessions[level]:null;
    const stored=validSave(prior,rules.colorsForLevel(level))&&currentKey(prior.initial)===currentKey(initial);
    state=stored?clone(prior.state):clone(initial); history=stored?prior.history.map(clone):[];
    solved=rules.isWon(state);
    $('levelNumber').textContent=level;
    $('previousLevel').disabled=level===1;
    $('nextLevel').disabled=level>=999;
    modal.hidden=!solved;
    if(solved) $('successText').textContent=`Уровень ${level} пройден за ${history.length} ходов.`;
    say('Переноси только верхнюю гайку. Собери все цвета!');
    draw();persist();
  }
  function draw(animate){
    const previousRect=animate?board.children[animate.from]?.querySelector(`[data-slot="${animate.idxFrom}"]`)?.getBoundingClientRect():null;
    board.replaceChildren();
    state.forEach((stack,idx)=>{
      const bolt=document.createElement('button'); bolt.type='button';bolt.className='bolt';bolt.dataset.bolt=idx;
      if(selected===idx)bolt.classList.add('selected');
      if(selected!==null&&selected!==idx&&rules.canMove(state,selected,idx))bolt.classList.add('possible');
      if(rules.isSorted(stack))bolt.classList.add('completed');
      const kind=stack.length?labels[stack.at(-1)]:'пустой';
      bolt.setAttribute('aria-label',`Болт ${idx+1}: ${stack.length} гаек, сверху ${kind}`);
      const glow=document.createElement('span');glow.className='bolt-base-glow';bolt.append(glow);
      stack.forEach((color,i)=>{
        const nut=document.createElement('span');nut.className='nut'+(selected===idx&&i===stack.length-1?' is-lifted':'');nut.style.setProperty('--index',String(i));nut.style.setProperty('--nut-color',PALETTE[color]);nut.dataset.slot=i;
        const shape=document.createElement('span');shape.className='nut-shape';const hole=document.createElement('span');hole.className='nut-hole';nut.append(shape,hole);bolt.append(nut);
      });
      const number=document.createElement('span');number.className='bolt-number';number.textContent=String(idx+1);bolt.append(number);
      bolt.addEventListener('click',()=>tap(idx,bolt));board.append(bolt);
    });
    if(animate&&previousRect){
      const target=board.children[animate.to]?.querySelector(`[data-slot="${animate.idxTo}"]`);
      const nextRect=target?.getBoundingClientRect();
      if(nextRect&&typeof target.animate==='function'&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
        target.animate([{transform:`translate(${previousRect.x-nextRect.x}px, ${previousRect.y-nextRect.y-26}px)`,offset:0},{transform:'translate(0, -32px)',offset:.55},{transform:'translate(0,0)',offset:1}],{duration:340,easing:'ease-out'});
      }
    }
    $('moveCount').textContent=String(history.length);
    $('sortedCount').textContent=String(state.filter(rules.isSorted).length)+'/'+rules.colorsForLevel(level);
    $('completedCount').textContent=String(Object.keys(app.read('nuts.completed.v1',{})||{}).length);
    $('undoButton').disabled=!history.length;
    board.querySelectorAll('.bolt').forEach((el,i)=>{if(hint&&i===hint[0])el.classList.add('hint-source');if(hint&&i===hint[1])el.classList.add('hint-target');});
  }
  function tap(idx,element){
    if(solved)return;
    if(selected===null){if(!state[idx].length){say('Сначала выбери болт с гайкой.');return;}selected=idx;cancelHint();say('Теперь нажми на пустой болт или на такую же гайку.');draw();return;}
    if(selected===idx){selected=null;draw();return;}
    const moved=rules.move(state,selected,idx);
    if(!moved){
      if(!state[idx].length||state[idx].length===4)say('Сюда пока нельзя: на болте нет места.');
      else say('Можно класть только на гайку такого же цвета.');
      element.classList.remove('invalid');void element.offsetWidth;element.classList.add('invalid');app.sound([220,170],.06);return;
    }
    const from=selected,idxFrom=state[from].length-1,idxTo=state[idx].length;
    history.push(clone(state)); state=moved;selected=null;cancelHint();
    solved=rules.isWon(state);app.sound([560,730],.055);
    if(solved){
      const completed=app.read('nuts.completed.v1',{})||{};completed[level]=true;app.write('nuts.completed.v1',completed);
      modal.hidden=false;$('successText').textContent=`Уровень ${level} пройден за ${history.length} ходов.`;
      say('Все цвета на своих местах!');app.sound([523,659,784,1047],.13);
    }else say('Отлично! Продолжай собирать цвета.');
    persist();draw({from,to:idx,idxFrom,idxTo});
  }
  function hintPair(pair){
    if(!pair||!rules.canMove(state,...pair)){say('Похоже, нет свободного хода. Отмени последний шаг.');return;}
    hint=pair;draw();say(`Подсказка: переложи гайку с болта ${pair[0]+1} на болт ${pair[1]+1}.`);
    app.sound([780],.09);
  }
  function hintMove(){
    if(solved)return;
    cancelHint();selected=null;
    // Following the stored constructive solution is instant and exact.
    let cursor=clone(initial);
    if(currentKey(cursor)===currentKey(state)){hintPair(solution[0]);return;}
    for(const step of solution){cursor=rules.move(cursor,...step);if(!cursor)break;const i=solution.findIndex(x=>x===step);if(currentKey(cursor)===currentKey(state)){hintPair(solution[i+1]);return;}}
    say('Ищу безопасный ход…');
    try{
      const id=++request;
      worker=new Worker('solver-worker.js');
      worker.onmessage=e=>{if(id!==request)return;worker?.terminate();worker=null;hintPair(e.data.answer?.[0]);};
      worker.onerror=()=>{if(id!==request)return;worker?.terminate();worker=null;say('Подсказка недоступна. Попробуй отменить ход.');};
      worker.postMessage({id,state});
    }catch(_){say('Попробуй собрать пару одинаковых гаек или отменить ход.');}
  }
  function undo(){if(!history.length)return;state=history.pop();selected=null;solved=false;modal.hidden=true;cancelHint();say('Последний ход отменён.');draw();persist();}
  $('undoButton').addEventListener('click',undo);
  $('hintButton').addEventListener('click',hintMove);
  $('restartButton').addEventListener('click',()=>load(level,false));
  $('previousLevel').addEventListener('click',()=>load(level-1));
  $('nextLevel').addEventListener('click',()=>load(level+1));
  $('againButton').addEventListener('click',()=>load(level+1));
  $('soundButton').addEventListener('click',()=>{app.setSound(!app.soundEnabled());$('soundButton').setAttribute('aria-pressed',String(app.soundEnabled()));});
  $('soundButton').setAttribute('aria-pressed',String(app.soundEnabled()));
  window.addEventListener('keydown',event=>{if(event.key==='Escape'){selected=null;draw();}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo();}});
  load(level);
})();
