(() => {
  'use strict';
  const R=window.LogicLab;
  function render(t,area,c){
    const {el,button}=c;
    if(t.kind==='patterns'){
      const group=el('div','logic-row');group.append(el('span','logic-rule','Повторяющаяся группа:'));t.pattern.forEach(s=>{const n=el('span','logic-tile marked',s.icon);n.setAttribute('aria-label',s.name);group.append(n);});area.append(group);
      const row=el('div','logic-row');t.row.forEach(s=>{const n=el('span','logic-tile',s.icon);n.setAttribute('aria-label',s.name);row.append(n);});row.append(el('span','logic-tile','?'));area.append(row);
      if(c.demo){area.append(el('p','logic-rule',t.hint));return;}
      const choices=el('div','learn-choices');area.append(choices);t.choices.forEach(s=>{const b=button(s.icon,()=>{const ok=s.icon===t.answer;b.disabled=true;b.classList.add(ok?'correct':'wrong');c.submit(ok,ok?t.explanation:t.hint);},'answer-choice');b.setAttribute('aria-label',s.name);b.dataset.answer=s.icon;choices.append(b);});
    }else if(t.kind==='sorting'){
      const row=el('div','logic-row');t.items.forEach(s=>{const b=button(s.icon,()=>{if(c.demo){c.announce(t.explanation);return;}const ok=s.id===t.answer;b.disabled=true;b.classList.add(ok?'correct':'wrong');c.submit(ok,ok?t.explanation:t.hint);},'answer-choice');b.style.color=s.color;b.setAttribute('aria-label',s.name);b.dataset.answer=String(s.id);row.append(b);});area.append(row);if(c.demo)area.append(el('p','logic-rule',t.hint));
    }else{
      let selected=[];const draft=c.getDraft();if(Array.isArray(draft?.order)&&new Set(draft.order).size===draft.order.length&&draft.order.every(v=>Number.isInteger(v)&&v>=0&&v<t.bank.length))selected=draft.order.slice();
      const slots=el('div','word-slots'),bank=el('div','learn-choices');area.append(slots,bank);
      const check=button(c.demo?'Показать порядок':'Проверить порядок',()=>{if(c.demo){selected=t.sequence.steps.map((_,i)=>i);draw();c.announce(t.hint);return;}const ok=R.ordered(t,selected);c.submit(ok,ok?t.explanation:t.hint);},'learn-button primary answer-choice word-answer');area.append(check);
      function chip(id,click){const b=button('',click,'word-chip sequence-card');b.append(el('span','',t.sequence.steps[id][0]),el('strong','',t.sequence.steps[id][1]));return b;}
      function draw(){slots.replaceChildren();bank.replaceChildren();selected.forEach((id,i)=>{const b=chip(id,()=>{selected.splice(i,1);c.setDraft({order:selected});draw();});b.disabled=c.done;slots.append(b);});if(!selected.length)slots.append(el('p','learn-hint-label','Нажимай карточки от первого события к последнему.'));
        t.bank.forEach(s=>{const b=chip(s.id,()=>{selected.push(s.id);c.setDraft({order:selected});draw();});b.disabled=c.done||selected.includes(s.id);bank.append(b);});check.disabled=c.done||(!c.demo&&selected.length!==t.bank.length);
      }draw();
    }
  }
  window.LearningUI.mount({id:'logic-lab',title:'Лаборатория закономерностей',color:'#3f82b3',subtitle:'Замечаем повторения, сравниваем признаки и разбираемся, что бывает сначала.',levels:R.levels,generate:R.generate,example:R.example,render,
    parent:'Просите ребёнка объяснять правило своими словами. В поиске лишнего признак задан явно: сравниваем форму, а не субъективное сходство. Эти упражнения тренируют конкретные навыки, но не измеряют интеллект.',
    offline:'Выложите узор из ложек и кубиков: ложка, кубик, ложка, кубик. Пусть ребёнок продолжит его, а затем придумает собственное правило.'});
})();
