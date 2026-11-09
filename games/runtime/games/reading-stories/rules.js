(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../../shared/learning-core.js'):root.LearningCore);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ReadingStories=api;})(typeof window!=='undefined'?window:null,function(C){
  'use strict';
  const levels=[{id:'phrases',title:'Короткие фразы',detail:'3–4 слова · две мысли'},{id:'sentences',title:'Читаем предложения',detail:'Небольшой связный текст'},{id:'stories',title:'Маленькие истории',detail:'Смысл, причина и порядок'}];
  // Syllable boundaries are authored, not guessed by an automatic consonant splitter.
  const stories=[
    {id:'cat',level:'phrases',title:'Кот у окна',scene:'🐈 ☀️',lines:['Кот спит до/ма.','Ма/ма чи/та/ет.'],facts:[['Где спит кот?',['Дома','В саду','В лесу'],0,0],['Что делает мама?',['Читает','Поёт','Бежит'],0,1]]},
    {id:'ball',level:'phrases',title:'Мяч у Нины',scene:'👧 ⚽',lines:['У Ни/ны мяч.','Мяч у/пал.'],facts:[['У кого мяч?',['У Нины','У кота','У папы'],0,0],['Что случилось с мячом?',['Упал','Улетел','Пропал'],0,1]]},
    {id:'garden',level:'phrases',title:'Летний сад',scene:'🌳 🍓',lines:['У па/пы сад.','Там ра/стёт ма/ли/на.'],facts:[['Что есть у папы?',['Сад','Кот','Мяч'],0,0],['Что растёт в саду?',['Малина','Дуб','Роза'],0,1]]},
    {id:'fox',level:'phrases',title:'У реки',scene:'🦊 💧',lines:['Ли/са у ре/ки.','Ли/са пьёт во/ду.'],facts:[['Кто у реки?',['Лиса','Кот','Ёж'],0,0],['Что пьёт лиса?',['Воду','Сок','Молоко'],0,1]]},
    {id:'boat',level:'sentences',title:'Бумажный кораблик',scene:'⛵ 💧',lines:['Па/па сде/лал ко/раб/лик из бу/ма/ги.','Са/ша пу/стил е/го по ру/чью.'],facts:[['Из чего папа сделал кораблик?',['Из бумаги','Из камня','Из песка'],0,0],['Где поплыл кораблик?',['По ручью','По морю','По озеру'],0,1]]},
    {id:'soup',level:'sentences',title:'Обед',scene:'🥕 🍲',lines:['Ма/ма ва/рит о/вощ/ной суп.','Ни/на по/мо/га/ет мыть мор/ковь.'],facts:[['Что варит мама?',['Овощной суп','Кашу','Варенье'],0,0],['Как Нина помогает маме?',['Моет морковь','Читает книгу','Несёт воду'],0,1]]},
    {id:'snow',level:'sentences',title:'Снежный день',scene:'⛄ 🧤',lines:['Но/чью вы/пал бе/лый снег.','Де/ти ле/пят сне/го/ви/ка у до/ма.'],facts:[['Когда выпал снег?',['Ночью','Утром','Днём'],0,0],['Что делают дети?',['Лепят снеговика','Строят дом','Сажают цветы'],0,1]]},
    {id:'book',level:'sentences',title:'Книга про море',scene:'📖 🐬',lines:['У Ле/ны но/ва/я кни/га про мо/ре.','На пер/вой стра/ни/це на/ри/со/ван дель/фин.'],facts:[['Про что новая книга?',['Про море','Про лес','Про космос'],0,0],['Кто нарисован на первой странице?',['Дельфин','Кот','Лиса'],0,1]]},
    {id:'rain',level:'stories',title:'Зонт для двоих',scene:'☔ 👧',lines:['На/чал/ся дождь.','О/ля рас/кры/ла зонт и по/зва/ла Ни/ну.','Де/воч/ки до/шли до до/ма су/хи/ми.'],facts:[['Почему Оля раскрыла зонт?',['Начался дождь','Стало жарко','Пришла ночь'],0,0],['Почему девочки не промокли?',['Шли под зонтом','Быстро бежали','Дождя не было'],0,1]]},
    {id:'seed',level:'stories',title:'Новое растение',scene:'🌱 💧',lines:['Ми/ша по/са/дил се/мя в гор/шок.','Каж/дый день он по/ли/вал зем/лю.','Ско/ро по/я/вил/ся зе/лё/ный ро/сток.'],facts:[['Что Миша сделал сначала?',['Посадил семя','Увидел росток','Сорвал цветок'],0,0],['Что появилось в горшке?',['Зелёный росток','Красный мяч','Бумажный кораблик'],0,2]]},
    {id:'scarf',level:'stories',title:'Тёплый шарф',scene:'🧣 🧒',lines:['На у/ли/це ста/ло хо/лод/но.','Ба/буш/ка свя/за/ла Ко/ле тёп/лый шарф.','Те/перь он гу/ля/ет в шар/фе.'],facts:[['Зачем Коле тёплый шарф?',['Чтобы не мёрзнуть','Чтобы плавать','Чтобы рисовать'],0,0],['Кто связал шарф?',['Бабушка','Коля','Друг'],0,1]]},
    {id:'bird',level:'stories',title:'Кормушка',scene:'🐦 🌻',lines:['Зи/мой пти/цам труд/но най/ти е/ду.','Де/ти на/сы/па/ли се/ме/чек в кор/муш/ку.','К кор/муш/ке при/ле/те/ла си/ни/ца.'],facts:[['Зачем дети насыпали семечек?',['Чтобы покормить птиц','Чтобы вырастить дерево','Чтобы собрать игрушки'],0,0],['Кто прилетел к кормушке?',['Синица','Лиса','Бабочка'],0,2]]}
  ];
  const plain=s=>s.replaceAll('/','');
  function generate(id,seed,index=0){
    const level=levels.find(l=>l.id===id)||levels[0],pool=stories.filter(s=>s.level===level.id),story=pool[((seed>>>0)+Math.floor(index/3))%pool.length];
    const r=C.rng((seed+index*9409)>>>0),assemble=index%3===2,f=story.facts[index%3===1?1:0];
    const choices=C.shuffle(f[1].map((text,i)=>({text,correct:i===f[2]})),r);
    const expected=plain(story.lines[0]).split(' ');
    const prompt=assemble?'Собери первое предложение точно как в тексте.':f[0];
    return {story,heading:story.title,kind:assemble?'assemble':'question',prompt,choices,expected,bank:C.shuffle(expected.map((text,id)=>({text,id})),r),evidence:assemble?0:f[3],
      explanation:assemble?'Слова встали на свои места. Прочитай предложение ещё раз.':`В тексте сказано: «${plain(story.lines[f[3]])}»`,
      hint:assemble?'Посмотри на первое предложение. Начни с первого слова. Точка останется у последнего. Нажатое слово можно вернуть обратно.':`Перечитай предложение: «${plain(story.lines[f[3]])}»`,
      speech:story.lines.map(plain).join(' ')+' '+prompt};
  }
  function example(id){const t=generate(id,0,0);return {...t,prompt:'Прочитай текст не спеша. Коснись трудного слова, чтобы увидеть его по слогам. Ответ на вопрос ищи в самом тексте, а не угадывай по картинке.',hint:`На вопрос «${t.prompt}» отвечает фраза: «${plain(t.story.lines[t.evidence])}».`};}
  function ordered(task,ids){return Array.isArray(ids)&&ids.length===task.expected.length&&new Set(ids).size===ids.length&&ids.every((id,i)=>Number.isInteger(id)&&id>=0&&id<task.expected.length&&task.expected[id]===task.expected[i]);}
  return Object.freeze({levels,stories,plain,generate,example,ordered});
});
