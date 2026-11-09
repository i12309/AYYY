(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../../shared/learning-core.js'):root.LearningCore);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LogicLab=api;})(typeof window!=='undefined'?window:null,function(C){
  'use strict';
  const levels=[{id:'patterns',title:'Продолжи узор',detail:'Повторяющиеся группы'},{id:'sorting',title:'Найди по признаку',detail:'Форма важнее цвета'},{id:'order',title:'Сначала — потом',detail:'Порядок действий и событий'}];
  const symbols=[{icon:'●',name:'круг'},{icon:'▲',name:'треугольник'},{icon:'■',name:'квадрат'},{icon:'★',name:'звезда'}];
  const sequences=[
    {title:'Подсолнух',steps:[['🫘','Семя'],['🌱','Маленький росток'],['🌿','Растение с листьями'],['🌻','Раскрывшийся цветок']],hint:'Из семени появляется росток. Затем растение растёт, а позже раскрывается цветок.'},
    {title:'Письмо',steps:[['✏️','Написать письмо'],['✉️','Положить письмо в конверт'],['📮','Опустить конверт в почтовый ящик'],['📬','Получатель достаёт письмо']],hint:'Сначала письмо нужно написать. Его кладут в конверт, отправляют и только потом получают.'},
    {title:'Пирог',steps:[['🥣','Замесить тесто'],['🫓','Выложить тесто в форму'],['🔥','Испечь пирог со взрослым'],['🥧','Остудить готовый пирог']],hint:'Сначала готовят тесто, затем выкладывают его в форму. После выпечки горячему пирогу дают остыть.'},
    {title:'Рисунок',steps:[['📄','Взять чистый лист'],['✏️','Нарисовать контур'],['🎨','Раскрасить контур'],['🖼️','Показать готовый рисунок']],hint:'В этой истории сначала берут лист, рисуют контур, раскрашивают его и показывают готовый рисунок.'},
    {title:'Башня',steps:[['🟥','Поставить красный кубик на стол'],['🟦','Поставить синий кубик на красный'],['🟩','Поставить зелёный кубик на синий'],['⭐','Украсить вершину готовой башни']],hint:'В этой башне снизу красный кубик, на нём синий, затем зелёный. Украшение кладём на готовую башню.'},
    {title:'Снеговик',steps:[['❄️','Дождаться снега'],['⚪','Скатать снежные шары'],['⛄','Сложить шары в снеговика'],['🥕','Добавить нос готовому снеговику']],hint:'Сначала нужен снег. Из него катают шары, собирают снеговика и добавляют нос.'}
  ];
  function generate(id,seed,index=0){
    const level=levels.find(x=>x.id===id)||levels[0],r=C.rng((seed+index*4729)>>>0);
    if(level.id==='patterns'){
      const pool=C.shuffle(symbols,r),pattern=index<2?[pool[0],pool[1]]:index===2?[pool[0],pool[0],pool[1]]:[pool[0],pool[1],pool[2]];
      const n=pattern.length*2+(index%pattern.length),row=Array.from({length:n},(_,i)=>pattern[i%pattern.length]),answer=pattern[n%pattern.length];
      return {kind:'patterns',prompt:'Повторяй группу по кругу. Какая фигура следующая?',pattern,row,answer:answer.icon,choices:C.shuffle(symbols,r),hint:`Повторяется группа: ${pattern.map(s=>s.name).join(', ')}. После конца группы начинай её сначала.`,explanation:`Дальше ${answer.name}. В узоре снова и снова повторяется одна и та же группа.`};
    }
    if(level.id==='sorting'){
      const pool=C.shuffle(symbols,r),base=pool[0],odd=pool[1],oddIndex=C.integer(r,0,3),colors=C.shuffle(['#b465b3','#387aa9','#aa7623','#348a71'],r);
      return {kind:'sorting',prompt:'Одна фигура отличается по форме. Найди её, не обращая внимания на цвет.',items:Array.from({length:4},(_,i)=>({...((i===oddIndex)?odd:base),color:colors[i],id:i})),answer:oddIndex,hint:`Три фигуры — ${base.name}. Найди другую форму. Цвет сейчас не важен.`,explanation:`Это ${odd.name}. Остальные три — ${base.name}. Мы сравнивали форму, а не цвет.`};
    }
    const sequence=sequences[((seed>>>0)+index)%sequences.length];
    return {kind:'order',prompt:`«${sequence.title}»: расположи события от начала к результату.`,sequence,bank:C.shuffle(sequence.steps.map((s,id)=>({id,icon:s[0],text:s[1]})),r),hint:sequence.hint,explanation:sequence.hint};
  }
  function example(id){const t=generate(id,1,0);return {...t,prompt:t.kind==='patterns'?'Узор состоит из группы, которая повторяется. Читай фигуры слева направо. Когда группа закончилась, начинай её сначала.':t.kind==='sorting'?'У предмета есть разные признаки: форма, цвет, размер. Сейчас смотрим только на форму. Два разных цвета ещё не означают две разные формы.':'Некоторые действия можно сделать только после других. Разложи историю от начала к результату. Нажатую карточку можно вернуть и переставить.'};}
  function ordered(task,ids){return Array.isArray(ids)&&ids.length===task.sequence.steps.length&&ids.every((v,i)=>v===i);}
  return Object.freeze({levels,symbols,sequences,generate,example,ordered});
});
