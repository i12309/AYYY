/* Standalone interactive prototype. Production integration must reuse AYYY core
   performSearch(), searchProviders, searchEngine and recentSearches. */
(() => {
  'use strict';
  const root=document.getElementById('search-prototype');
  if(!root)return;
  const Q=selector=>root.querySelector(selector);
  const all=selector=>Array.from(root.querySelectorAll(selector));
  const keys={engine:'ayyy:prototype:search:engine',recent:'ayyy:prototype:search:history'};
  const providers={
    Google:q=>'https://www.google.com/search?q='+encodeURIComponent(q),
    'Яндекс':q=>'https://yandex.ru/search/?text='+encodeURIComponent(q),
    DuckDuckGo:q=>'https://duckduckgo.com/?q='+encodeURIComponent(q),
    Bing:q=>'https://www.bing.com/search?q='+encodeURIComponent(q)
  };
  const modes={
    web:{label:'Веб',hint:'Результаты откроются в новой вкладке выбранного поисковика.'},
    images:{label:'Картинки',hint:'Изображения откроются в Google Картинках.',url:q=>'https://www.google.com/search?tbm=isch&q='+encodeURIComponent(q)},
    video:{label:'Видео',hint:'Видео откроются в результатах YouTube.',url:q=>'https://www.youtube.com/results?search_query='+encodeURIComponent(q)},
    maps:{label:'Карты',hint:'Места и адреса откроются в Google Картах.',url:q=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q)},
    wiki:{label:'Знания',hint:'Энциклопедический поиск откроется в Википедии.',url:q=>'https://ru.wikipedia.org/w/index.php?search='+encodeURIComponent(q)},
    code:{label:'Код',hint:'Репозитории и код откроются в поиске GitHub.',url:q=>'https://github.com/search?type=code&q='+encodeURIComponent(q)}
  };
  function get(key,def){try{const value=localStorage.getItem(key);return value===null?def:JSON.parse(value);}catch{return def;}}
  function put(key,val){try{localStorage.setItem(key,JSON.stringify(val));return true;}catch{return false;}}
  let mode='web';
  let provider=Object.hasOwn(providers,get(keys.engine,'Яндекс'))?get(keys.engine,'Яндекс'):'Яндекс';
  let recent=get(keys.recent,['привет']);
  if(!Array.isArray(recent))recent=[];
  recent=recent.filter(v=>typeof v==='string'&&v.trim()).slice(0,10);
  let toastTimeout;
  const historyList=Q('#sp-history-list');
  function toast(message){
    const box=Q('#sp-toast');box.textContent=message;box.classList.add('is-visible');
    clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>box.classList.remove('is-visible'),3500);
  }
  function iconSvg(name){
    const path=name==='clock'?'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>':'<path d="M4 12h16m-6-6 6 6-6 6"/>';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.innerHTML=path;
    return svg;
  }
  function renderHistory(){
    historyList.replaceChildren();
    if(recent.length===0){
      const empty=document.createElement('p');empty.className='sp-history-empty';empty.textContent='История пока пуста. Здесь появятся ваши запросы — только в этом браузере.';
      historyList.append(empty);
    }else{
      recent.slice(0,6).forEach(text=>{
        const btn=document.createElement('button');btn.type='button';btn.className='sp-history-item';btn.title='Подставить запрос в строку поиска';
        const label=document.createElement('span');label.textContent=text;
        btn.append(iconSvg('clock'),label,iconSvg('arrow'));btn.lastElementChild.classList.add('sp-history-arrow');
        btn.addEventListener('click',()=>{Q('#sp-query').value=text;Q('#sp-query').focus();});
        historyList.append(btn);
      });
    }
    Q('#sp-history-count').textContent=recent.length+' / 10';
    Q('#sp-clear-history').disabled=recent.length===0;
  }
  function renderControls(){
    all('[data-mode]').forEach(button=>{
      const active=button.dataset.mode===mode;
      button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));
    });
    all('[data-provider]').forEach(button=>{
      const active=button.dataset.provider===provider;
      button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));
      button.disabled=mode!=='web';
    });
    Q('#sp-hint-text').textContent=modes[mode].hint;
  }
  all('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
    mode=button.dataset.mode;renderControls();Q('#sp-query').focus();
  }));
  all('[data-provider]').forEach(button=>button.addEventListener('click',()=>{
    if(mode!=='web')return;
    provider=button.dataset.provider;put(keys.engine,provider);renderControls();
  }));
  Q('#sp-search-form').addEventListener('submit',event=>{
    event.preventDefault();const query=Q('#sp-query').value.trim();
    if(!query){toast('Введите запрос для поиска.');Q('#sp-query').focus();return;}
    const url=mode==='web'?providers[provider](query):modes[mode].url(query);
    recent=[query,...recent.filter(v=>v!==query)].slice(0,10);put(keys.recent,recent);renderHistory();
    const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';
    link.click();toast('Поиск: '+modes[mode].label.toLowerCase()+'. Результат откроется в новой вкладке.');
  });
  Q('#sp-clear-history').addEventListener('click',()=>{recent=[];put(keys.recent,recent);renderHistory();toast('История очищена.');});
  document.addEventListener('keydown',event=>{
    const typing=event.target.closest?.('input,textarea,select,[contenteditable="true"]');
    if((event.key==='/'&&!typing)||(event.key.toLowerCase()==='k'&&(event.ctrlKey||event.metaKey))){
      event.preventDefault();Q('#sp-query').focus();Q('#sp-query').select();
    }else if(event.key==='Escape'&&document.activeElement===Q('#sp-query')){
      Q('#sp-query').value='';
    }
  });
  renderControls();renderHistory();
})();
