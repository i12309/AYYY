(() => {
  'use strict';
  const R=window.NumberGarden;
  function render(t,area,c){
    const {el,button}=c, draft=c.getDraft();
    let counted=Array.isArray(draft?.counted)?[...new Set(draft.counted.filter(n=>Number.isInteger(n)&&n>=0&&n<30))]:[];
    let joined=draft?.joined===true;
    const save=()=>c.setDraft({counted,joined});
    const scene=el('div');area.append(scene);
    const equation=el('div','learn-equation');
    const formula=(show=c.demo||c.done)=>t.kind==='count'?`${show?t.a:'?'} ${show&&t.a===1?'ягода':show&&t.a>=2&&t.a<=4?'ягоды':'ягод'}`:t.kind==='compare'?`${t.a} ${show?t.result:'?'} ${t.b}`:t.kind==='parts'?`${t.a} + ${show?t.b:'?'} = ${t.a+t.b}`:`${t.a} ${t.kind==='subtract'?'−':'+'} ${t.b} = ${show?t.result:'?'}`;
    equation.textContent=formula();
    function basket(n,title,cls,start=0,subtract=0){
      const box=el('div',`number-basket ${cls}`);box.append(el('h3','',title));const items=el('div','number-items');box.append(items);
      if(!n)items.append(el('span','number-empty','Пусто'));
      const tokens=[];
      for(let i=0;i<n;i++){
        const index=start+i,leaving=subtract>0&&i>=n-subtract;
        const b=button('🍓',()=>{
          if(leaving){b.classList.add('removed');b.disabled=true;return;}
          counted=counted.includes(index)?counted.filter(x=>x!==index):[...counted,index];save();refreshTokens();
        },`count-token${leaving?' leaving':''}`);
        b.setAttribute('aria-label',leaving?'Убрать эту ягоду':`Посчитать ягоду ${index+1}`);b.dataset.index=String(index);tokens.push(b);items.append(b);
      }
      function refreshTokens(){for(const b of tokens){const i=Number(b.dataset.index),pool=counted.filter(x=>x>=start&&x<start+n),pos=pool.indexOf(i);b.classList.toggle('counted',pos>=0);b.setAttribute('aria-pressed',String(pos>=0));b.querySelector('small')?.remove();if(pos>=0)b.append(el('small','',String(pos+1)));}}
      refreshTokens();return box;
    }
    function draw(){
      scene.replaceChildren();
      if(t.kind==='parts')scene.append(el('div','number-house-roof',String(t.a+t.b)));
      const groups=el('div','number-groups');scene.append(groups);
      if(t.kind==='count')groups.append(basket(t.a,'Корзинка','blue'));
      else if(t.kind==='subtract')groups.append(basket(t.a,`Было ${t.a} · убираем ${t.b}`,'blue',0,t.b));
      else if(joined&&t.kind==='add'){
        if(t.level==='twenty'){
          const frames=el('div','tenframes');
          for(let f=0;f<2;f++){const frame=el('div','tenframe');frame.setAttribute('aria-label',f===0?'Первый десяток':'Второй десяток');for(let i=0;i<10;i++){const index=f*10+i;frame.append(el('div',`ten-cell ${index<t.a?'a':index<t.a+t.b?'b':''}`,index<t.a+t.b?'🍓':''));}frames.append(frame);}groups.append(frames);
        }else groups.append(basket(t.a+t.b,'Объединили две группы','blue'));
      }else{
        groups.append(basket(t.a,t.kind==='parts'?'Первая комната':`Слева: ${t.a}`,'blue'));
        groups.append(el('span','number-op',t.kind==='compare'?'?':'+'));
        groups.append(basket(t.b,t.kind==='parts'?'Вторая комната':`Справа: ${t.b}`,'gold',t.a));
      }
    }
    draw();
    if(t.kind==='add')area.append(button(joined?'Разделить группы':'Объединить группы',e=>{joined=!joined;counted=[];save();e.currentTarget.textContent=joined?'Разделить группы':'Объединить группы';draw();}));
    area.append(equation,el('p','learn-hint-label',t.kind==='subtract'?'Бледные ягоды убираем. Считаем только оставшиеся.':'Ягоды можно считать касанием: одна ягода — одно число.'));
    if(c.demo)return;
    const choices=el('div','learn-choices');area.append(choices);
    for(const value of t.choices){const label=t.kind==='compare'?({'<':'<  Слева меньше','>':'>  Слева больше','=':'=  Поровну'})[value]:String(value);
      const b=button(label,()=>{const ok=value===t.result;b.classList.add(ok?'correct':'wrong');b.disabled=true;if(ok)equation.textContent=formula(true);c.submit(ok,ok?t.explanation:t.hint);},`answer-choice${t.kind==='compare'?' word-answer':''}`);b.dataset.answer=String(value);choices.append(b);
    }
  }
  window.LearningUI.mount({id:'number-garden',title:'Числовой сад',color:'#218c73',subtitle:'Не заучиваем ответы: считаем, собираем числа и понимаем, что означают + и −.',levels:R.levels,generate:R.generate,example:R.example,render,
    parent:'Начните со сложения до 5. Счёт и состав числа можно повторять по необходимости. Переход к следующей теме выбирает взрослый: правильный ответ не включает сложность автоматически.',
    offline:'Возьмите 5 кубиков. Разделите их между двумя ладонями. Сколько в каждой? А сколько получится, если соединить?'});
})();
