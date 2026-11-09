(() => {
  'use strict';
  const R=window.ReadingStories;
  function render(t,area,c){
    const {el,button}=c;
    const scene=el('div','reading-scene',t.story.scene);scene.setAttribute('aria-hidden','true');area.append(scene);
    const controls=el('div','learn-tools'),text=el('div','reading-text'),note=el('div','reading-word-note');note.setAttribute('role','status');
    let split=window.Igroland.read('learning.reading.syllables',t.story.level==='phrases')===true;
    text.classList.toggle('syllables',split);
    const toggle=button('По слогам',()=>{split=!split;text.classList.toggle('syllables',split);toggle.setAttribute('aria-pressed',String(split));window.Igroland.write('learning.reading.syllables',split);},'learn-button small');toggle.setAttribute('aria-pressed',String(split));controls.append(toggle,button('Послушать текст',()=>c.speak(t.story.lines.map(R.plain).join(' ')),'learn-button small'));area.append(controls,text,note);
    let currentWord='';
    t.story.lines.forEach((line,i)=>{
      const p=el('div','reading-line');p.dataset.line=String(i);text.append(p);
      for(const word of line.split(' ')){
        const w=button('',()=>{text.querySelectorAll('.reading-word').forEach(x=>x.classList.remove('selected'));w.classList.add('selected');currentWord=R.plain(word);note.replaceChildren(el('span','',word.replaceAll('/',' · ')+' '),button('Послушать слово',()=>c.speak(currentWord),'learn-button small'));c.markHelp();},'reading-word');
        w.setAttribute('aria-label',R.plain(word));word.split('/').forEach(s=>w.append(el('span','syllable',s)));p.append(w);
      }
    });
    c.onHint(()=>{text.querySelectorAll('.reading-line').forEach((line,i)=>{line.style.background=i===t.evidence?'#fff0c8':'';});});
    if(c.demo){area.append(el('p','reading-question',t.hint));return;}
    area.append(el('h3','reading-question',t.prompt));
    if(t.kind==='question'){
      const choices=el('div','learn-choices');area.append(choices);
      t.choices.forEach(option=>{const b=button(option.text,()=>{b.disabled=true;b.classList.add(option.correct?'correct':'wrong');c.submit(option.correct,option.correct?t.explanation:'Найди ответ в тексте. Подсказка выделит нужное предложение.');},'answer-choice word-answer');b.dataset.correct=String(option.correct);choices.append(b);});
    }else{
      let selected=[];const d=c.getDraft();if(Array.isArray(d?.words)&&new Set(d.words).size===d.words.length&&d.words.every(x=>Number.isInteger(x)&&x>=0&&x<t.expected.length))selected=d.words.slice();
      const slots=el('div','word-slots'),bank=el('div','learn-choices');area.append(slots,bank);
      const check=button('Проверить предложение',()=>c.submit(R.ordered(t,selected),R.ordered(t,selected)?t.explanation:'Сверь порядок слов с первым предложением. Нажми на слово в собранной фразе, чтобы вернуть его.'),'learn-button primary answer-choice word-answer');area.append(check);
      function draw(){slots.replaceChildren();bank.replaceChildren();selected.forEach((id,i)=>slots.append(button(t.expected[id],()=>{selected.splice(i,1);c.setDraft({words:selected});draw();},'word-chip')));if(!selected.length)slots.append(el('span','learn-hint-label','Нажимай слова в нужном порядке'));
        t.bank.forEach(w=>{const b=button(w.text,()=>{selected.push(w.id);c.setDraft({words:selected});draw();},'word-chip');b.disabled=selected.includes(w.id)||c.done;bank.append(b);});check.disabled=selected.length!==t.expected.length||c.done;
      }draw();
    }
  }
  window.LearningUI.mount({id:'reading-stories',title:'Читаем истории',color:'#8761c0',subtitle:'От знакомых слов — к предложениям и пониманию маленькой истории.',customSpeech:true,count:6,levels:R.levels,generate:R.generate,example:R.example,render,
    parent:'В занятии две истории: вопросы по смыслу и сборка предложения по образцу. Не измеряем скорость и не распознаём голос ребёнка. Попросите пересказать историю своими словами. Слоговая подсветка — учебная опора, а не проверка техники чтения.',
    offline:'Выберите книжку. Прочитайте два предложения по очереди и спросите: «Кто здесь действует? Что произошло? Откуда мы это узнали?»'});
})();
