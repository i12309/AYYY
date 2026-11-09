/* Shared lesson shell. Game-specific tasks and renderers remain independent. */
(() => {
  'use strict';
  const C=window.LearningCore;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const button=(text,action,cls='learn-button')=>{const n=el('button',cls,text);n.type='button';n.addEventListener('click',action);return n;};
  function speak(text,notify){
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){notify('Озвучка недоступна. Можно прочитать вместе со взрослым.');return false;}
    const voice=speechSynthesis.getVoices().find(v=>/^ru(?:-|_)/i.test(v.lang)&&v.localService===true);
    if(!voice){notify('На устройстве нет доступного локального русского голоса. Прочитайте текст вместе; интернет-озвучку мы не используем.');return false;}
    speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.voice=voice;u.lang='ru-RU';u.rate=.85;
    u.onerror=()=>notify('Не получилось включить голос. Текст остаётся на экране.');speechSynthesis.speak(u);return true;
  }
  function mount(spec){
    const app=window.Igroland, key=`learning.${spec.id}.v1`, count=spec.count||5;
    const raw=app.read(key,null);
    const saved=raw&&raw.version===1&&raw.topics&&typeof raw.topics==='object'&&!Array.isArray(raw.topics)?raw:{version:1,topics:{},history:[],last:spec.levels[0].id};
    saved.history=Array.isArray(saved.history)?saved.history.filter(x=>x&&spec.levels.some(l=>l.id===x.level)&&Number.isInteger(x.seed)&&Number.isInteger(x.total)&&x.total===count&&Number.isInteger(x.independent)&&x.independent>=0&&x.independent<=count).slice(-60):[];
    const params=new URLSearchParams(location.search);
    let id=spec.levels.some(l=>l.id===params.get('level'))?params.get('level'):spec.levels.some(l=>l.id===saved.last)?saved.last:spec.levels[0].id;
    let state=null,teaching=true,dispose=[],hintAction=null;
    const root=document.getElementById('learningRoot');root.style.setProperty('--learn-accent',spec.color);
    const header=el('div','learn-top');const titleBox=el('div');titleBox.append(el('div','learn-kicker','МАСТЕРСКАЯ ЗНАНИЙ · 5–7 ЛЕТ'),el('h1','',spec.title),el('p','learn-lead',spec.subtitle));
    const label=el('span','learn-calm','Без таймера · можно ошибаться');header.append(titleBox,label);root.append(header);
    const layout=el('div','learn-layout'),side=el('aside','learn-side'),panel=el('section','learn-panel');panel.setAttribute('aria-label','Занятие');layout.append(side,panel);root.append(layout);
    side.append(el('h2','','Выбери занятие'));
    const selectLabel=el('label','learn-select-label','Тема занятия');const select=el('select','learn-select');select.id='learningTopic';selectLabel.htmlFor=select.id;
    const nav=el('div','learn-topics');spec.levels.forEach((level,i)=>{
      const option=el('option','',`${i+1}. ${level.title}`);option.value=level.id;select.append(option);
      const b=button('',()=>load(level.id),'learn-topic');b.dataset.level=level.id;b.append(el('span','learn-topic-num',String(i+1)),el('span','learn-topic-name',level.title),el('small','',level.detail));nav.append(b);
    });select.addEventListener('change',()=>load(select.value));side.append(selectLabel,select,nav);
    const parent=el('details','learn-parent');parent.append(el('summary','','Для взрослого'));const parentBody=el('div');parent.append(parentBody);side.append(parent);
    side.append(el('p','learn-storage','Прогресс хранится только в этом браузере. Имена и возраст вводить не нужно.'));
    const status=el('div','learn-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
    const announce=text=>{status.textContent=text;};
    const freshSeed=()=>Math.floor(Math.random()*0x100000000)>>>0;
    function persist(){saved.last=id;saved.topics[id]={seen:!teaching||saved.topics[id]?.seen===true,session:state};if(!app.write(key,saved))announce('Не удалось сохранить прогресс. Играть можно, но после закрытия он может потеряться.');}
    function stop(){dispose.forEach(fn=>fn());dispose=[];hintAction=null;if(window.speechSynthesis)speechSynthesis.cancel();}
    function renderParent(){
      parentBody.replaceChildren(el('p','',spec.parent));
      const help=el('p','','Самостоятельно — с первого ответа, без подсказки и озвучки. Остальные ответы — с поддержкой. Это результаты упражнений, не оценка развития ребёнка.');parentBody.append(help);
      const list=el('div','learn-report');spec.levels.forEach(l=>{const rows=saved.history.filter(h=>h.level===l.id);const last=rows.at(-1);list.append(el('p','',`${l.title}: ${last?`${last.independent} из ${last.total} самостоятельно в последнем завершённом занятии`:'ещё нет завершённого занятия'}.`));});parentBody.append(list);
      parentBody.append(button('Сбросить прогресс этой игры',()=>{if(!window.confirm('Удалить только учебный прогресс этой игры? Другие игры останутся без изменений.'))return;stop();saved.topics={};saved.history=[];load(id);},'learn-button small'));
      parentBody.append(el('p','learn-storage','Озвучка: только локальный русский голос устройства, если он доступен. Игра работает и без голоса.'));
    }
    function load(next){stop();id=next;const entry=Object.prototype.hasOwnProperty.call(saved.topics,id)?saved.topics[id]:null;state=C.restore(entry?.session,freshSeed(),count);teaching=entry?.seen!==true;
      select.value=id;nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.level===id)));
      try{const url=new URL(location.href);url.searchParams.set('level',id);history.replaceState(null,'',url);}catch(_){/* file:// may restrict history */}
      persist();render();renderParent();
    }
    function submit(correct,explanation){
      if(teaching||state.index>=count||!C.answer(state,correct))return;
      const feedback=panel.querySelector('.learn-feedback');feedback.className=`learn-feedback ${correct?'success':'retry'}`;feedback.textContent=correct?`Получилось! ${explanation||''}`:`Попробуем ещё. ${explanation||'Можно воспользоваться подсказкой.'}`;
      feedback.setAttribute('role','status');
      if(correct){panel.querySelectorAll('.answer-choice,.word-chip,.robot-command,.robot-controls button').forEach(b=>b.disabled=true);panel.querySelector('.learn-next').hidden=false;app.sound([523,659],.12);}persist();
    }
    function help(){if(!teaching&&!state.done){state.aided=true;persist();}const box=panel.querySelector('.learn-explanation');box.hidden=false;box.textContent=(teaching?spec.example(id):spec.generate(id,state.seed,state.index)).hint;if(hintAction)hintAction();}
    function render(){
      stop();panel.replaceChildren();announce('');
      if(state.index>=count&&!teaching){renderSummary();return;}
      const level=spec.levels.find(l=>l.id===id),task=teaching?spec.example(id):spec.generate(id,state.seed,state.index);
      const top=el('div','learn-panel-top');top.append(el('span','learn-badge',teaching?'Сначала разберёмся':`Задание ${state.index+1} из ${count}`),button(teaching?'К практике →':'Разбор примера',()=>{teaching=!teaching;persist();render();},'learn-button small'));panel.append(top);
      if(!teaching){const progress=el('progress','learn-progress');progress.max=count;progress.value=state.index;progress.setAttribute('aria-label',`Выполнено ${state.index} из ${count}`);panel.append(progress);}
      panel.append(el('h2','learn-question',teaching?level.title:(task.heading||task.prompt)));
      if(teaching)panel.append(el('p','learn-lesson-text',task.prompt));
      const tools=el('div','learn-tools');if(!spec.customSpeech||teaching)tools.append(button('Послушать',()=>{if(speak(teaching?task.prompt:(task.speech||task.prompt),announce)&&!teaching&&!state.done){state.aided=true;persist();}},'learn-button small'));tools.append(button(teaching?'Показать объяснение':'Подсказка',help,'learn-button small'));panel.append(tools);
      const area=el('div','learn-activity');panel.append(area);
      const context={el,button,demo:teaching,done:!teaching&&state.done,task,
        submit,announce,help,markHelp:()=>{if(!teaching&&!state.done){state.aided=true;persist();}},
        getDraft:()=>teaching?null:state.draft,setDraft:value=>{if(!teaching&&!state.done){state.draft=value;persist();}},
        onCleanup:fn=>dispose.push(fn),onHint:fn=>{hintAction=fn;},
        speak:text=>{if(speak(text,announce)&&!teaching&&!state.done){state.aided=true;persist();}}
      };
      spec.render(task,area,context);
      const explanation=el('div','learn-explanation');explanation.hidden=true;panel.append(explanation);
      const feedback=el('div','learn-feedback');feedback.setAttribute('aria-live','polite');panel.append(feedback);
      const next=button(teaching?'Теперь попробую сам →':'Дальше →',()=>{
        if(teaching){teaching=false;persist();render();return;}
        if(!C.advance(state,count))return;
        if(state.index===count&&!saved.history.some(h=>h.seed===state.seed&&h.level===id))saved.history.push({level:id,seed:state.seed,total:count,independent:state.results.filter(r=>r.independent).length});saved.history=saved.history.slice(-60);persist();render();renderParent();panel.scrollIntoView({block:'start',behavior:'auto'});
      },'learn-button primary learn-next');next.hidden=!teaching&&!state.done;panel.append(next);
      if(state.done&&!teaching){feedback.classList.add('success');feedback.textContent=`Получилось! ${task.explanation||''}`;area.querySelectorAll('.answer-choice,.word-chip,.robot-command,.robot-controls button').forEach(b=>b.disabled=true);}
    }
    function renderSummary(){
      const independent=state.results.filter(r=>r.independent).length;
      panel.append(el('div','learn-finish-mark','✓'),el('h2','','Занятие завершено'),el('p','learn-lesson-text',`Ты разобрался с ${count} заданиями. Можно отдохнуть или попробовать применить это без экрана.`),el('p','learn-offline',spec.offline));
      const note=el('p','learn-storage',`Для взрослого: самостоятельно ${independent} из ${count}, с поддержкой ${count-independent}.`);panel.append(note);
      panel.append(button('Ещё одно занятие',()=>{state=C.initial(freshSeed());persist();render();},'learn-button primary'),button('Посмотреть объяснение',()=>{teaching=true;render();}));
      const back=el('a','learn-button','Выбрать другую игру');back.href='../../index.html?section=learn';panel.append(back);
    }
    window.addEventListener('pagehide',()=>{persist();stop();});
    if(window.speechSynthesis&&speechSynthesis.getVoices)speechSynthesis.getVoices();
    load(id);
  }
  window.LearningUI=Object.freeze({mount,el,button});
})();
