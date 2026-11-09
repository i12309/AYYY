(() => {
  'use strict';
  const R=window.RobotRoute;
  function render(t,area,c){
    const {el,button}=c,draft=c.getDraft();
    let commands=Array.isArray(draft?.commands)&&draft.commands.length<=30&&draft.commands.every(x=>Object.hasOwn(R.directions,x))?draft.commands.slice():[];
    let position={...t.start,got:!t.pickup},visited=[],timer=null,running=false,alive=true;
    c.onCleanup(()=>{alive=false;if(timer!==null)clearTimeout(timer);});
    const grid=el('div','robot-grid');grid.style.setProperty('--size',t.size);grid.setAttribute('role','img');grid.setAttribute('aria-label','Карта: робот, дом, препятствия'+(t.pickup?' и посылка.':'.'));area.append(grid);
    const cells=[];
    for(let y=0;y<t.size;y++)for(let x=0;x<t.size;x++){const n=el('div','robot-cell'),p={x,y};n.dataset.x=String(x);n.dataset.y=String(y);grid.append(n);cells.push({node:n,p});}
    function drawMap(){cells.forEach(({node,p})=>{const wall=t.walls.some(w=>R.equal(w,p)),goal=R.equal(t.goal,p),pickup=t.pickup&&R.equal(t.pickup,p)&&!position.got,current=R.equal(position,p);node.className=`robot-cell${wall?' wall':''}${current?' current':''}${visited.some(v=>R.equal(v,p))?' visited':''}`;node.replaceChildren(el('span','',current?'🤖':wall?'🪨':pickup?'📦':goal?'🏠':''));node.setAttribute('aria-label',`Строка ${p.y+1}, столбец ${p.x+1}: ${current?'робот':wall?'препятствие':pickup?'посылка':goal?'дом':'пусто'}`);});}
    const legend=el('p','learn-hint-label',t.pickup?'Забери посылку до завершения маршрута. Направления — по экрану, не относительно робота.':'Стрелки задают движение по экрану. Диагональных шагов нет.');area.append(legend);
    const controls=el('div','robot-controls');area.append(controls);
    for(const [key,d] of Object.entries(R.directions)){const b=button(d.icon,()=>{if(running||c.done)return;if(commands.length>=30){c.announce('В программе уже 30 команд. Удали ненужные шаги.');return;}commands.push(key);c.setDraft({commands});resetPosition();drawQueue();},'learn-button');b.setAttribute('aria-label',`Добавить команду: ${d.name}`);controls.append(b);}
    const queue=el('div','robot-queue');queue.setAttribute('aria-label','Твоя программа. Нажми на команду, чтобы удалить.');area.append(queue);
    const actions=el('div','learn-tools');area.append(actions);
    const run=button('Запустить',start,'learn-button primary answer-choice word-answer'),clear=button('Очистить',()=>{commands=[];c.setDraft({commands});resetPosition();drawQueue();});actions.append(run,clear);
    if(c.demo)actions.append(button('Показать пример пути',()=>{if(running)return;commands=t.solution.slice();drawQueue();start();}));
    const result=el('p','logic-rule');result.setAttribute('aria-live','polite');area.append(result);
    function resetPosition(){position={...t.start,got:!t.pickup};visited=[];drawMap();result.textContent='';}
    function drawQueue(){
      queue.replaceChildren();commands.forEach((command,i)=>{const b=button(R.directions[command].icon,()=>{if(running||c.done)return;commands.splice(i,1);c.setDraft({commands});resetPosition();drawQueue();},'robot-command');b.setAttribute('aria-label',`Удалить шаг ${i+1}: ${R.directions[command].name}`);b.append(el('small','',String(i+1)));b.disabled=running||c.done;queue.append(b);});
      if(!commands.length)queue.append(el('span','learn-hint-label','Добавь стрелки — это план движения.'));run.disabled=running||c.done||!commands.length;clear.disabled=running||c.done||!commands.length;controls.querySelectorAll('button').forEach(b=>b.disabled=running||c.done);
    }
    function start(){
      if(running||c.done||!commands.length)return;running=true;resetPosition();drawQueue();const report=R.simulate(t,commands);let frame=0;
      function tick(){if(!alive)return;
        position=report.trace[frame];visited=report.trace.slice(0,frame);drawMap();queue.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('running',i===frame-1));
        if(frame+1<report.trace.length){frame++;timer=setTimeout(tick,window.matchMedia('(prefers-reduced-motion: reduce)').matches?80:380);return;}
        running=false;drawQueue();result.textContent=report.ok?t.explanation:report.error;
        if(report.at!==null&&queue.children[report.at])queue.children[report.at].classList.add('failed');
        if(!c.demo){c.submit(report.ok,report.ok?t.explanation:report.error);if(report.ok){run.disabled=true;clear.disabled=true;controls.querySelectorAll('button').forEach(b=>b.disabled=true);queue.querySelectorAll('button').forEach(b=>b.disabled=true);}}
      }tick();
    }
    if(c.done){const report=R.simulate(t,commands);if(report.ok){position=report.trace.at(-1);visited=report.trace;}}
    drawMap();drawQueue();
  }
  window.LearningUI.mount({id:'robot-route',title:'Маршрут робота',color:'#c27b35',subtitle:'Думай наперёд: составь план, запусти его и исправь нужный шаг.',levels:R.levels,generate:R.generate,example:R.example,render,
    parent:'Это не лабиринт на скорость. Ребёнок сначала составляет последовательность команд. Ошибка оставляет план на месте: можно найти неудачный шаг и изменить его. Подсказка показывает только первый шаг одного из допустимых маршрутов.',
    offline:'Разложите на полу листы-клетки. Пусть ребёнок командует игрушке: «один шаг вперёд, два вправо». Затем поменяйтесь ролями.'});
})();
