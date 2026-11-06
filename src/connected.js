(() => {
  'use strict';
  const a=window.AYYY,e=a.escape,i=a.icon;
  const defaultAI={mode:'demo',endpoint:'',model:''};
  let aiActive=a.get('aiActive',''),aiController=null,aiPending=false,aiStreamText='';
  const chats=()=>a.get('aiChats',[]);
  const currentChat=()=>chats().find(c=>c.id===aiActive);
  const prompts=[['calendar','Помоги составить план дня'],['lightbulb','Объясни сложное простыми словами'],['sparkles','Придумай идею для проекта'],['type','Напиши короткий текст']];
  function aiMessagesHTML(){const chat=currentChat();if(!chat||!chat.messages.length)return `<div class="ai-welcome"><div class="ai-logo">${i('sparkles',30)}</div><h2>С чего начнём?</h2><p>Дайте идее направление.<br>Помощник поможет с текстом, планом и новым взглядом.</p><div class="prompt-grid">${prompts.map(([icon,prompt])=>`<button class="prompt-card" data-prompt="${e(prompt)}">${i(icon,17)}<span>${prompt}</span></button>`).join('')}</div></div>`;return chat.messages.map(m=>`<div class="message ${m.role}"><span class="message-icon">${m.role==='user'?i('lighthouse',15):i('sparkles',15)}</span><div style="flex:1;min-width:0"><div class="message-name">${m.role==='user'?'Вы':'AYYY · помощник'}${m.demo?'<span class="badge demo">Демо-ответ</span>':''}${m.error?'<span class="badge demo">Сообщение интерфейса</span>':''}</div><div class="message-content">${e(m.content)}</div></div></div>`).join('');}
  a.register('ai',{title:'ИИ-помощник',render(){const cfg=a.get('aiConfig',defaultAI);const list=chats();return a.heading('Мысли становятся яснее.','Ваше пространство для вопросов, идей и хороших текстов.',`<button class="btn" id="ai-settings-top">${i('sliders',16)} Настроить подключение</button>`)+`<div class="ai-layout"><aside class="ai-sidebar"><button class="btn soft" id="ai-new">${i('plus',15)} Новый разговор</button><p class="nav-section-label" style="padding:24px 8px 5px">ВАШИ РАЗГОВОРЫ</p><div id="ai-chat-list">${list.length?list.map(c=>`<button class="ai-conversation ${c.id===aiActive?'active':''}" data-chat="${e(c.id)}">${i('note',14)}<span>${e(c.title.slice(0,27))}</span></button>`).join(''):'<p class="small muted" style="padding:12px 8px">Здесь будут ваши разговоры.</p>'}</div><div class="ai-connect-card"><h3>${cfg.mode==='live'?'Своё подключение':'Попробуйте свой ИИ'}</h3><p>${cfg.mode==='live'?e(cfg.model||'Модель не указана'):'Подключите совместимый API или локальную модель.'}</p><button class="text-link" id="ai-settings-side" style="margin-top:10px">${cfg.mode==='live'?'Настроить':'Подключить'} ${i('arrow-right',12)}</button></div></aside><section class="ai-workspace"><div class="ai-toolbar"><span style="display:flex;align-items:center;gap:8px">${i('sparkles',17)}<strong style="font-weight:550">${cfg.mode==='live'?e(cfg.model||'Своя модель'):'AYYY Assistant'}</strong><span class="badge ${cfg.mode==='live'?'live':'demo'}">${cfg.mode==='live'?'Свой API':'Демо'}</span></span><span style="display:flex"><button class="icon-btn ai-history-button" id="ai-history" title="История разговоров" aria-label="История разговоров">${i('clock',16)}</button><button class="icon-btn" id="ai-new-mobile" title="Новый разговор">${i('plus',16)}</button><button class="icon-btn" id="ai-export" title="Скачать разговор">${i('download',16)}</button><button class="icon-btn" id="ai-clear" title="Удалить текущий разговор">${i('trash',16)}</button></span></div><div class="ai-messages" id="ai-messages" role="log" aria-live="polite">${aiMessagesHTML()}</div><div class="ai-composer"><form id="ai-form"><div class="ai-input-wrap"><textarea id="ai-query" placeholder="Напишите, что у вас на уме…" rows="2" maxlength="8000" aria-label="Сообщение ИИ">${e(a.param)}</textarea><button class="search-submit" id="ai-submit" aria-label="Отправить сообщение">${i('arrow-up',20)}</button><button class="icon-btn hidden" id="ai-stop" type="button" title="Остановить запрос">${i('x',18)}</button></div></form><div class="ai-disclaimer">${cfg.mode==='demo'?'Демонстрационный режим · ответы подготовлены заранее · запросы не отправляются в сеть':`Сообщения отправятся на ${e(endpointHost(cfg.endpoint))} · история хранится в этом браузере`} · Enter — отправить</div></div></section></div>`;},mount(){
    document.querySelector('#ai-settings-top').onclick=aiSettings;document.querySelector('#ai-settings-side').onclick=aiSettings;
    const fresh=()=>{aiActive='';a.set('aiActive','');a.navigate('ai');};document.querySelector('#ai-new').onclick=fresh;document.querySelector('#ai-new-mobile').onclick=fresh;
    document.querySelectorAll('[data-chat]').forEach(b=>b.onclick=()=>{aiActive=b.dataset.chat;a.set('aiActive',aiActive);a.navigate('ai');});
    document.querySelector('#ai-export').onclick=()=>{const chat=currentChat();if(!chat){a.toast('Сначала начните разговор.');return;}a.download('AYYY_conversation.txt',chat.messages.map(m=>(m.role==='user'?'Вы':'Помощник')+(m.demo?' [демо]':'')+'\n'+m.content).join('\n\n'));};
    document.querySelector('#ai-clear').onclick=()=>{if(!currentChat()){a.toast('Здесь пока нет сообщений.');return;}a.modal('Удалить этот разговор?',`<p class="small muted">История текущего разговора будет удалена из этого браузера. Можно сначала скачать её кнопкой со стрелкой вниз.</p><div class="modal-footer"><button class="btn" data-close-modal>Оставить</button><button class="btn danger" id="ai-delete-confirm">Удалить</button></div>`);document.querySelector('#ai-delete-confirm').onclick=()=>{a.set('aiChats',chats().filter(c=>c.id!==aiActive));aiActive='';a.set('aiActive','');a.closeModal();a.render();};};
    document.querySelector('#ai-history').onclick=()=>{const list=chats();a.modal('Ваши разговоры',list.length?list.map(c=>`<button class="command-result" data-history-chat="${e(c.id)}">${i('note',17)}<span>${e(c.title)}</span></button>`).join(''):'<p class="muted">Здесь будут ваши разговоры.</p>');document.querySelectorAll('[data-history-chat]').forEach(b=>b.onclick=()=>{aiActive=b.dataset.historyChat;a.set('aiActive',aiActive);a.closeModal();a.navigate('ai');});};
    bindPrompts();const form=document.querySelector('#ai-form');form.onsubmit=event=>{event.preventDefault();sendAI();};document.querySelector('#ai-query').onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();sendAI();}};document.querySelector('#ai-stop').onclick=()=>aiController?.abort();
    return ()=>{if(aiController)aiController.abort();};
  }});
  function endpointHost(value){try{return new URL(value).host;}catch{return'ваш API';}}
  function endpointOrigin(value){try{return new URL(value).origin;}catch{return'';}}
  function bindPrompts(){document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{const q=document.querySelector('#ai-query');q.value=b.dataset.prompt;q.focus();});}
  function refreshMessages(){const el=document.querySelector('#ai-messages');if(!el)return;el.innerHTML=aiMessagesHTML()+(aiPending?`<div class="ai-connecting loading-dots">${i('sparkles',15)} ${a.get('aiConfig',defaultAI).mode==='demo'?'Показываем пример ответа':'Ожидаем ответ модели'}<pre id="ai-stream-preview" class="ai-stream-preview">${e(aiStreamText)}</pre></div>`:'');el.scrollTop=el.scrollHeight;bindPrompts();const submit=document.querySelector('#ai-submit');if(submit)submit.disabled=aiPending;document.querySelector('#ai-stop')?.classList.toggle('hidden',!aiPending||a.get('aiConfig',defaultAI).mode==='demo');}
  function addMessage(role,content,extra={}){const list=chats();let chat=list.find(c=>c.id===aiActive);if(!chat){chat={id:crypto.randomUUID?.()||String(Date.now()),title:content.slice(0,45),messages:[]};aiActive=chat.id;list.unshift(chat);a.set('aiActive',aiActive);}chat.messages.push({role,content,...extra});chat.messages=chat.messages.slice(-40);chat.updatedAt=new Date().toISOString();a.set('aiChats',list.slice(0,30));return chat;}

  // Read OpenAI-compatible SSE streams. Some compatible providers respond
  // with regular JSON even when stream:true; both response types are supported.
  async function fetchAICompletion(cfg,messages,signal,onChunk){
    const response=await fetch(apiURL(cfg.endpoint),{
      method:'POST',
      headers:{'Content-Type':'application/json',...(a.secrets.key?{Authorization:'Bearer '+a.secrets.key}:{})},
      body:JSON.stringify({model:cfg.model,messages,stream:true}),
      signal
    });
    if(!response.ok)throw new Error(response.status===401||response.status===403?'API отклонил доступ. Проверьте ключ и разрешение на модель.':`API вернул HTTP ${response.status}. Проверьте адрес и настройки сервера.`);
    const contentType=response.headers.get('content-type')||'';
    if(contentType.includes('text/event-stream')&&response.body?.getReader){
      const reader=response.body.getReader(),decoder=new TextDecoder();
      let buffer='',answer='';
      const handle=block=>{
        for(const line of block.split(/\r?\n/)){
          if(!line.startsWith('data:'))continue;
          const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')continue;
          let event;try{event=JSON.parse(raw);}catch{continue;}
          if(event.error)throw new Error(typeof event.error==='string'?event.error:event.error.message||'Ошибка потоковой модели');
          const content=event.choices?.[0]?.delta?.content;
          if(typeof content==='string'&&content){answer=(answer+content).slice(0,60000);onChunk(answer);}
        }
      };
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        buffer+=decoder.decode(value,{stream:true});
        const chunks=buffer.split(/\r?\n\r?\n/);buffer=chunks.pop()||'';
        chunks.forEach(handle);
        if(answer.length>=60000){await reader.cancel().catch(()=>{});break;}
      }
      if(buffer.trim())handle(buffer);
      if(!answer.trim())throw new Error('API не вернул текст в потоковом ответе.');
      return answer;
    }
    const data=await response.json();
    const answer=data?.choices?.[0]?.message?.content;
    if(typeof answer!=='string'||!answer.trim())throw new Error('API вернул неподдерживаемый формат. Ожидается OpenAI-совместимый chat/completions.');
    onChunk(answer.slice(0,60000));
    return answer.slice(0,60000);
  }
  async function sendAI(){
    if(aiPending)return;
    const input=document.querySelector('#ai-query');if(!input)return;
    const message=input.value.trim();if(!message)return;
    const cfg=a.get('aiConfig',defaultAI);
    if(cfg.mode==='live'&&(!cfg.endpoint||!cfg.model)){aiSettings();return;}
    const chat=addMessage('user',message),chatID=chat.id;
    input.value='';aiPending=true;aiStreamText='';refreshMessages();
    try {
      if(cfg.mode==='demo'){
        await new Promise(resolve=>setTimeout(resolve,500));
        if(a.route==='ai'&&aiActive===chatID)addMessage('assistant',demoResponse(message),{demo:true});
      }else{
        aiController=new AbortController();
        const controller=aiController,timer=setTimeout(()=>controller.abort(),60000);
        try{
          const answer=await fetchAICompletion(cfg,chat.messages.filter(m=>!m.demo&&!m.error).map(({role,content})=>({role,content})),controller.signal,text=>{
            aiStreamText=text;
            const preview=document.querySelector('#ai-stream-preview');
            if(preview&&a.route==='ai'&&aiActive===chatID){preview.textContent=text;preview.closest('#ai-messages')?.scrollTo({top:1000000,behavior:'instant'});}
          });
          if(a.route==='ai'&&aiActive===chatID)addMessage('assistant',answer);
        }finally{clearTimeout(timer);}
      }
    }catch(error){
      if(a.route==='ai'&&aiActive===chatID){
        if(error?.name==='AbortError'&&aiStreamText.trim())addMessage('assistant',aiStreamText+'\n\n[Генерация остановлена]');
        else addMessage('assistant',error?.name==='AbortError'?'Запрос остановлен или превышено время ожидания (60 секунд).':error instanceof TypeError?'Не удалось связаться с API. Проверьте адрес, HTTPS и CORS. Ключ хранится только в памяти вкладки.':String(error?.message||error),{error:true});
      }
    }finally{
      aiPending=false;aiController=null;aiStreamText='';
      if(a.route==='ai'&&aiActive===chatID){
        refreshMessages();
        const el=document.querySelector('#ai-chat-list');
        if(el)el.innerHTML=chats().map(c=>`<button class="ai-conversation ${c.id===aiActive?'active':''}" data-chat="${e(c.id)}">${i('note',14)}<span>${e(c.title.slice(0,27))}</span></button>`).join('');
        document.querySelectorAll('[data-chat]').forEach(b=>b.onclick=()=>{aiActive=b.dataset.chat;a.set('aiActive',aiActive);a.navigate('ai');});
      }
    }
  }
  function apiURL(endpoint){return endpoint.replace(/\/+$/,'').endsWith('/chat/completions')?endpoint.replace(/\/+$/,''):endpoint.replace(/\/+$/,'')+'/chat/completions';}
  function demoResponse(message){if(/план|день|успев|дело/i.test(message))return 'Давайте оставим в дне место для главного.\n\n1. Выберите одно дело, после которого день уже можно считать удачным.\n2. Отведите ему первые 25 минут без переключений. Таймер фокуса есть в AYYY.\n3. Запишите ещё два небольших дела в заметки.\n4. Оставьте свободный промежуток и время на прогулку.\n\nЭто заранее подготовленный пример ответа. Для персонального плана подключите свою модель в настройках.';
    if(/маяк|сложн|объясн/i.test(message))return 'Представьте маяк как очень заметный ориентир. Он не управляет кораблём, но помогает понять, где берег и куда двигаться.\n\nЛинза собирает свет в направленный луч. Вращение или мигание создаёт повторяющийся рисунок сигнала, по которому можно различать маяки.\n\nТакую же роль мы задумали для AYYY: сделать нужное направление заметным.\n\nЭто демонстрационный текст, подготовленный заранее. Чтобы обсуждать любую тему, подключите модель.';
    if(/иде|проект|придум/i.test(message))return 'Вот пример небольшой идеи для AYYY: «Банка хороших идей».\n\nСохраняйте короткие заметки, добавляйте им цвет и раз в неделю выбирайте одну для маленького эксперимента. Хранить всё можно прямо в браузере, а резервную копию — скачивать файлом.\n\nПервый шаг: создать три карточки — «Хочу попробовать», «Делаю», «Получилось».\n\nЭто заранее подготовленный пример. В режиме собственного API ответы создаст подключённая вами модель.';
    return 'Давайте зададим тексту направление: для кого он, что нужно сказать и какое действие ожидается в конце?\n\nПример для этого портала:\n«AYYY — ваш маяк в интернете. Находите нужное, сохраняйте идеи и решайте повседневные задачи в одном спокойном пространстве».\n\nСейчас показан заранее подготовленный демонстрационный ответ. Подключите свою модель, чтобы получить ответ именно на ваш запрос.';}
  function aiSettings(){const cfg=a.get('aiConfig',defaultAI);a.modal('Подключение ИИ',`<form id="ai-config-form"><div class="segmented" style="width:100%"><label class="chip" style="flex:1"><input type="radio" name="ai-mode" value="demo" ${cfg.mode==='demo'?'checked':''}> Демонстрация</label><label class="chip" style="flex:1"><input type="radio" name="ai-mode" value="live" ${cfg.mode==='live'?'checked':''}> Свой API</label></div><label class="field-label" for="ai-endpoint">Базовый адрес совместимого API</label><input class="field mono" id="ai-endpoint" type="url" value="${e(cfg.endpoint)}" placeholder="https://your-api.example/v1"><label class="field-label" for="ai-model">Название модели</label><input class="field mono" id="ai-model" value="${e(cfg.model)}" placeholder="Имя модели на вашем сервере" maxlength="150"><label class="field-label" for="ai-key">Ваш ключ, если сервер требует авторизацию</label><input class="field mono" id="ai-key" type="password" autocomplete="off" placeholder="${a.secrets.key?'Ключ задан для текущего сервера. Пустое поле сохранит его.':'Останется только в памяти этой вкладки'}" value=""><p class="small muted" style="margin-top:13px">Поддерживается формат chat/completions, в том числе совместимые серверы vLLM и Ollama. Сервер должен разрешать обращения с домена портала (CORS). Указывайте только доверенный адрес: ему будут отправлены сообщения и введённый ключ.</p><div class="notice" style="margin-top:14px">${i('lock',16)}<span>Ключ не записывается в файл или хранилище браузера. При смене сервера прежний ключ очищается: введите ключ для нового адреса. Общий ключ публичного сервиса нужно держать на сервере.</span></div><p id="ai-config-error" class="small" style="color:var(--red);margin-top:12px" role="alert"></p><div class="modal-footer"><button class="btn" type="button" data-close-modal>Отмена</button><button class="btn primary">Применить</button></div></form>`);document.querySelector('#ai-config-form').onsubmit=event=>{event.preventDefault();const mode=document.querySelector('input[name="ai-mode"]:checked').value;const endpoint=document.querySelector('#ai-endpoint').value.trim(),model=document.querySelector('#ai-model').value.trim();if(mode==='live'){try{const u=new URL(endpoint);if(u.username||u.password||u.hash||u.search)throw new Error('Укажите адрес без логина, пароля, параметров или #.');if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new Error('Для внешнего API используйте HTTPS. HTTP допускается для localhost.');if(!model)throw new Error('Укажите название модели.');}catch(error){document.querySelector('#ai-config-error').textContent=error.message==='Invalid URL'?'Проверьте адрес API.':error.message;return;}}const enteredKey=document.querySelector('#ai-key').value.trim();a.secrets.key=enteredKey||(endpointOrigin(endpoint)===endpointOrigin(cfg.endpoint)?a.secrets.key:'');a.set('aiConfig',{mode,endpoint,model});a.closeModal();if(a.route==='ai')a.render();a.toast(mode==='demo'?'Демонстрационный режим включён':'Настройки сохранены. API будет вызван при отправке сообщения.');};}
  a.aiSettings=aiSettings;

  // Gmail is implemented in gmail.js, loaded after this module.
})();
