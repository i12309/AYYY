(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../../shared/learning-core.js'):root.LearningCore);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NumberGarden=api;})(typeof window!=='undefined'?window:null,function(C){
  'use strict';
  const levels=[
    {id:'count',title:'Сколько всего?',detail:'Количество и ноль',kind:'count',max:10},
    {id:'compare',title:'Больше, меньше, поровну',detail:'Сравниваем две группы',kind:'compare',max:10},
    {id:'parts',title:'Домики числа',detail:'Из каких частей состоит число',kind:'parts',max:10},
    {id:'add5',title:'Первые сложения',detail:'Складываем в пределах 5',kind:'add',max:5},
    {id:'add10',title:'Складываем до 10',detail:'Объединяем две группы',kind:'add',max:10},
    {id:'subtract',title:'Что осталось?',detail:'Вычитаем в пределах 10',kind:'subtract',max:10},
    {id:'twenty',title:'Через десяток',detail:'Дополнительно · суммы от 11 до 18',kind:'add',max:20}
  ];
  function generate(id,seed,index=0){
    const l=levels.find(x=>x.id===id)||levels[0],r=C.rng((seed+index*17011)>>>0);
    let a=0,b=0,result=0,prompt='',explanation='',hint='';
    if(l.kind==='count'){
      a=index===0?C.integer(r,1,5):index===1?0:C.integer(r,1,10);result=a;
      prompt='Сколько ягод в корзинке?';explanation=a===0?'Корзинка пустая. Ни одной ягоды — это ноль.':`Последнее число при счёте показывает, сколько всего ягод: ${a}.`;
      hint='Коснись каждой ягоды один раз. Уже посчитанная ягода получит номер. Если ягод нет, выбирай 0.';
    }else if(l.kind==='compare'){
      a=C.integer(r,0,10);b=index===1?a:C.integer(r,0,10);result=a>b?'>':a<b?'<':'=';
      prompt='Сравни количество ягод слева и справа.';explanation=`Слева ${a}, справа ${b}. ${a===b?'Поровну: знак =.':a>b?'Слева больше: знак >.':'Слева меньше: знак <.'}`;
      hint='Соедини ягоды парами мысленно: одна слева и одна справа. Где останутся лишние? Широкая сторона знака смотрит на большее число.';
    }else if(l.kind==='parts'){
      const total=C.integer(r,2,index<2?5:10);a=C.integer(r,0,total);b=total-a;result=b;
      prompt=`Всего ${total}. В первой комнате ${a}. Сколько во второй?`;
      explanation=`${total} можно разделить на ${a} и ${b}. Значит, ${a} + ${b} = ${total}.`;
      hint='Все ягоды уже разделены на две комнаты. Посчитай ягоды во второй. Две части вместе дают число на крыше.';
    }else if(l.kind==='subtract'){
      a=C.integer(r,index<2?2:1,index<2?5:10);b=index<2?index+1:C.integer(r,0,a);result=a-b;
      prompt=`Было ${a}. Убрали ${b}. Сколько осталось?`;explanation=`${a} − ${b} = ${result}. Считай только те ягоды, которые остались.`;
      hint='Коснись бледных ягод, чтобы убрать их, затем посчитай оставшиеся. Убрать ноль — значит ничего не менять.';
    }else{
      if(l.id==='twenty'){a=C.integer(r,6,9);b=C.integer(r,11-a,9);}else if(index<2){b=index+1;a=C.integer(r,l.max===5?1:3,l.max-b);}else if(index===3){a=C.integer(r,1,l.max);b=0;}else{a=C.integer(r,1,l.max-1);b=C.integer(r,1,l.max-a);}
      result=a+b;prompt=`Было ${a}. Добавили ${b}. Сколько стало?`;
      explanation=`${a} + ${b} = ${result}. Сложить — значит объединить две группы.`;
      hint=l.id==='twenty'?`Сначала дополни ${a} до десяти: добавь ${10-a}. От второй группы останется ${b-(10-a)}. Затем прибавь остаток к 10.`:'Нажми «Объединить». Можно посчитать все ягоды или начать с первого числа и досчитать вторую группу.';
    }
    const choices=l.kind==='compare'?C.shuffle(['<','=','>'],r):C.options(result,0,l.max,r);
    return {kind:l.kind,max:l.max,level:l.id,a,b,result,prompt,explanation,hint,choices};
  }
  const lessons={
    count:{a:3,b:0,text:'У каждой ягоды при счёте своё число. Последнее число отвечает на вопрос «сколько всего?». Пустая корзинка — это 0.'},
    compare:{a:3,b:2,text:'Поставь ягоды парами. Слева одна осталась без пары — значит, слева больше. 3 > 2. Когда ни одной лишней нет, пишем =.'},
    parts:{a:2,b:3,text:'На крыше домика живёт число 5. В комнатах — 2 и 3. Две части составляют целое: 2 + 3 = 5. Можно разделить и иначе: 1 и 4.'},
    add5:{a:2,b:1,text:'Было 2 ягоды. Добавили ещё 1. Теперь их 3. Знак + означает «добавить», а = — «столько же». 2 + 1 = 3.'},
    add10:{a:4,b:2,text:'Было 4. Добавим 2: пять, шесть. Получилось 6. Можно не считать заново, а продолжить счёт: 4 + 2 = 6.'},
    subtract:{a:5,b:2,text:'Было 5 ягод. Уберём 2. Останется 3. Знак − означает «убрать»: 5 − 2 = 3.'},
    twenty:{a:8,b:5,text:'8 + 5: возьмём из пяти сначала 2. Получится 10. Осталось добавить 3. Значит, 8 + 5 = 10 + 3 = 13.'}
  };
  function example(id){const l=levels.find(x=>x.id===id)||levels[0],d=lessons[l.id];return {...generate(l.id,1),a:d.a,b:d.b,result:l.kind==='compare'?'>':l.kind==='parts'?d.b:l.kind==='subtract'?d.a-d.b:l.kind==='count'?d.a:d.a+d.b,prompt:d.text,explanation:d.text,hint:d.text};}
  return Object.freeze({levels,generate,example});
});
