(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../../shared/learning-core.js'):root.LearningCore);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.RobotRoute=api;})(typeof window!=='undefined'?window:null,function(C){
  'use strict';
  const levels=[{id:'steps',title:'Первые команды',detail:'Один знак — одна клетка'},{id:'detour',title:'Обойди препятствия',detail:'Планируем весь путь'},{id:'delivery',title:'Забери и доставь',detail:'Сначала посылка, затем дом'}];
  const directions={U:{dx:0,dy:-1,icon:'↑',name:'вверх'},R:{dx:1,dy:0,icon:'→',name:'вправо'},D:{dx:0,dy:1,icon:'↓',name:'вниз'},L:{dx:-1,dy:0,icon:'←',name:'влево'}};
  const equal=(a,b)=>a.x===b.x&&a.y===b.y;
  const key=(p,got)=>`${p.x},${p.y},${got?1:0}`;
  function transition(task,p,command,got){
    const d=directions[command];if(!d)return null;
    const next={x:p.x+d.dx,y:p.y+d.dy};
    if(next.x<0||next.y<0||next.x>=task.size||next.y>=task.size||task.walls.some(w=>equal(w,next)))return null;
    return {p:next,got:got||!!task.pickup&&equal(task.pickup,next)};
  }
  function solve(task){
    const got=!task.pickup||equal(task.start,task.pickup),queue=[{p:task.start,got,path:[]}],seen=new Set([key(task.start,got)]);
    for(let index=0;index<queue.length;index++){
      const item=queue[index];if(equal(item.p,task.goal)&&item.got)return item.path;
      for(const command of Object.keys(directions)){const next=transition(task,item.p,command,item.got);if(!next)continue;const k=key(next.p,next.got);if(seen.has(k))continue;seen.add(k);queue.push({...next,path:[...item.path,command]});}
    }return null;
  }
  function simulate(task,commands){
    let p={...task.start},got=!task.pickup||equal(task.start,task.pickup);const trace=[{...p,got}];
    if(!Array.isArray(commands)||commands.length>30)return {ok:false,trace,error:'Программа слишком длинная.',at:0};
    for(let i=0;i<commands.length;i++){
      const next=transition(task,p,commands[i],got);if(!next)return {ok:false,trace,error:`Команда ${i+1}: впереди край поля или препятствие. Измени этот шаг.`,at:i};
      p=next.p;got=next.got;trace.push({...p,got});
    }
    const ok=equal(p,task.goal)&&got;
    return {ok,trace,at:null,error:ok?'':!got?'Сначала нужно забрать посылку. Затем вернуться к дому.':'Программа закончилась, а робот ещё не у дома. Добавь или измени команды.'};
  }
  function generate(id,seed,index=0){
    const level=levels.find(l=>l.id===id)||levels[0],r=C.rng((seed+index*19381)>>>0),size=level.id==='steps'?4:5;
    const start={x:0,y:size-1},goal=level.id==='steps'?{x:Math.min(3,index+1),y:index<2?size-1:Math.max(0,size-1-(index-1))}:{x:size-1,y:0};
    const pickup=level.id==='delivery'?{x:0,y:0}:null;
    let task={kind:'robot',level:level.id,size,start,goal,pickup,walls:[]};
    if(level.id!=='steps'){
      const candidates=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++){const p={x,y};if(!equal(p,start)&&!equal(p,goal)&&(!pickup||!equal(p,pickup)))candidates.push(p);}
      for(const wall of C.shuffle(candidates,r)){
        const proposed={...task,walls:[...task.walls,wall]};const path=solve(proposed);
        if(path&&path.length<=18)task=proposed;if(task.walls.length>=5+Math.min(index,3))break;
      }
    }
    const solution=solve(task);
    return {...task,solution,prompt:pickup?'Составь путь: забери посылку и отнеси её к дому.':'Составь команды, чтобы робот дошёл до дома.',
      hint:`Направления считаем по экрану. Первый шаг подходящего пути — ${directions[solution[0]].icon} ${directions[solution[0]].name}. Можно выбрать другой правильный маршрут.`,
      explanation:pickup?'Сначала робот забрал посылку, затем доставил её к дому.':'Каждая команда сдвинула робота ровно на одну клетку. Ты спланировал путь!'};
  }
  function example(id){const task=generate(id,12,0);return {...task,prompt:'Стрелка — команда роботу. ↑ означает вверх по экрану, → вправо. Одна команда передвигает робота на одну клетку. Сначала составь путь, затем нажми «Запустить». Команду можно удалить нажатием.'};}
  return Object.freeze({levels,directions,equal,solve,simulate,generate,example});
});
