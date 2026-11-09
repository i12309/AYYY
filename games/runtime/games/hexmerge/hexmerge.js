(() => {
  'use strict';
  const app=window.Igroland,rules=window.HexRules,$=id=>document.getElementById(id), svg=$('hexBoard');
  const NS='http://www.w3.org/2000/svg';
  const COLORS={2:['#f341a7','#b71d70'],4:['#6bc64b','#369233'],8:['#28b3c8','#15718e'],16:['#4b88f7','#2451bc'],32:['#ef8546','#c84e28'],64:['#8e69e5','#5d42ba'],128:['#edc841','#b98e18'],256:['#fe6180','#bf284a'],512:['#40ceae','#22967a'],1024:['#ffb247','#be792c'],2048:['#dfb0ff','#9753c1']};
  const labels={easy:'Легко',normal:'Средне',hard:'Сложно'};
  const saved=app.read('hexmerge.progress.v1',{});
  const requestedLevel=new URLSearchParams(location.search).get('level');
  let mode=Object.hasOwn(rules.MODES, requestedLevel)?requestedLevel:(saved?.mode in rules.MODES?saved.mode:'easy');
  let sessions=saved?.sessions&&typeof saved.sessions==='object'?saved.sessions:{};
  let best=app.read('hexmerge.records.v1',{})||{},history=[],state=null,hint=null,animation=null,seed=0;
  const copy=s=>({board:s.board.map(row=>row.slice()),score:s.score,moves:s.moves,bestTile:s.bestTile,won:s.won});
  const randSeed=()=>Math.floor(Math.random()*0x7fffffff)+1;
  const message=msg=>{$('gameMessage').textContent=msg;};
  function persist(){sessions[mode]={state:copy(state),history:history.map(copy),seed};app.write('hexmerge.progress.v1',{mode,sessions});}
  function update(){
    $('scoreValue').textContent=String(state.score);$('bestTile').textContent=String(state.bestTile);$('targetNumber').textContent=String(rules.MODES[mode].target);
    $('recordValue').textContent=String(best[mode]||0);$('undoButton').disabled=!history.length;
    document.querySelectorAll('[data-difficulty]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.difficulty===mode)));
  }
  function node(name,attrs={}){const el=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;}
  function draw(){
    const r=39,w=Math.sqrt(3)*r,dy=r*1.5,rows=state.board.length,cols=state.board[0].length;
    const width=(cols-1)*w+w/2+2*r+20,height=(rows-1)*dy+2*r+20;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const fragment=document.createDocumentFragment();
    const defs=node('defs');for(const [k,colors] of Object.entries(COLORS)){
      const grad=node('linearGradient',{id:'hexGrad'+k,x1:'0',y1:'0',x2:'0',y2:'1'});
      grad.append(node('stop',{offset:'0%', 'stop-color':colors[0]}),node('stop',{offset:'100%','stop-color':colors[1]}));defs.append(grad);
    }
    fragment.append(defs);
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const value=state.board[row][col];const x=r+10+col*w+(row%2)*w/2,y=r+10+row*dy;
      const points=`0,${-r} ${w/2},${-r/2} ${w/2},${r/2} 0,${r} ${-w/2},${r/2} ${-w/2},${-r/2}`;
      const group=node('g',{transform:`translate(${x} ${y})`,tabindex:'0',role:'button','aria-label':`Ряд ${row+1}, столбец ${col+1}, число ${value}`});
      group.classList.add('hex-cell');group.dataset.row=row;group.dataset.col=col;
      const shadow=node('polygon',{points,class:'tile-shadow'});
      const tile=node('polygon',{points,class:'tile-top',fill:`url(#hexGrad${Math.min(value,2048)})`});
      const label=node('text',{x:'0',y:'2',class:'tile-number'});label.textContent=String(value);
      if(value>=1024)label.setAttribute('font-size','17');
      group.append(shadow,tile,label);
      if(hint&&hint.some(([hr,hc])=>hr===row&&hc===col))group.classList.add('hint');
      if(animation&&animation[0]===row&&animation[1]===col)group.classList.add('pulse');
      group.addEventListener('click',()=>tap(row,col));
      group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();tap(row,col);}});
      fragment.append(group);
    }
    svg.replaceChildren(fragment);update();
  }
  function fresh(){seed=randSeed();state=rules.create(mode,seed);history=[];hint=null;animation=null;message('Нажми на число, рядом с которым есть такое же.');$('successDialog').hidden=true;persist();draw();}
  function load(next){
    mode=next;const entry=sessions[mode];
    const good=entry&&rules.validate(entry.state,mode)&&Array.isArray(entry.history)&&entry.history.length<300&&entry.history.every(s=>rules.validate(s,mode));
    if(good){state=copy(entry.state);history=entry.history.map(copy);seed=entry.seed||randSeed();hint=null;animation=null;$('successDialog').hidden=!state.won;draw();message(state.won?'Цель достигнута!':'Найди соседние одинаковые числа.');}
    else fresh();
    persist();
  }
  function tap(row,col){
    if(state.won)return;
    const previous=copy(state),next=rules.merge(state,row,col,mode,(seed=Math.imul(seed||1,1664525)+1013904223>>>0));
    if(!next){
      const target=svg.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      target?.classList.add('warn');message('Рядом должно быть такое же число. Посмотри на соседние соты!');app.sound([225],.08);return;
    }
    history.push(previous);if(history.length>150)history.shift();
    state=next;hint=null;animation=next.at;app.sound(next.merged>1?[523,698,880]:[490,720],.09);
    if((best[mode]||0)<state.score){best[mode]=state.score;app.write('hexmerge.records.v1',best);}
    message(next.merged>1?`Цепочка! +${next.earned} очков.`:`Отлично! +${next.earned} очков.`);
    if(state.won){$('successDialog').hidden=false;$('successText').textContent=`Ты собрал ${state.bestTile} и получил ${state.score} очков!`;app.sound([523,659,784,988],.13);}
    persist();draw();
  }
  $('newGame').addEventListener('click',fresh);
  $('againButton').addEventListener('click',fresh);
  $('undoButton').addEventListener('click',()=>{if(!history.length)return;state=history.pop();hint=null;animation=null;$('successDialog').hidden=true;message('Предыдущий ход отменён.');persist();draw();});
  $('hintButton').addEventListener('click',()=>{if(state.won)return;const pairs=rules.findPairs(state.board);if(!pairs.length)return;hint=pairs[0];message(`Подсказка: соедини два числа ${state.board[hint[0][0]][hint[0][1]]} в подсвеченных сотах.`);draw();});
  $('soundButton').addEventListener('click',()=>{app.setSound(!app.soundEnabled());$('soundButton').setAttribute('aria-pressed',String(app.soundEnabled()));});
  $('soundButton').setAttribute('aria-pressed',String(app.soundEnabled()));
  document.querySelectorAll('[data-difficulty]').forEach(el=>el.addEventListener('click',()=>load(el.dataset.difficulty)));
  window.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='z'){$('undoButton').click();event.preventDefault();}});
  load(mode);
})();
