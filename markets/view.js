/* Markets workspace. Local FX charts + cross-origin market widgets on demand. */
(() => {
 'use strict';
 const A=window.AYYY,M=window.AYYYMarkets,C=window.AYYYMarketChart,e=A.escape,I=(n,s=16)=>A.icon(n,s);
 const n=(v,d=2)=>Number.isFinite(v)?Number(v).toLocaleString('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
 const day=d=>M.validDate(d)?new Date(d+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'—';
 const pct=v=>Number.isFinite(v)?`${v>=0?'+':'−'}${n(Math.abs(v))}%`:'—';
 const tones=v=>v>=0?'rise':'fall';
 const options=chosen=>Object.entries(M.currencies).map(([k,v])=>`<option value="${k}" ${chosen===k?'selected':''}>${k} · ${e(v[0])}</option>`).join('');
 function render(){
  return `<div class="fm-page"><div class="fm-art" aria-hidden="true"><img class="fm-notes-art" src="markets/assets/banknotes.webp" alt=""><img class="fm-metals-art" src="markets/assets/metals.webp" alt=""><svg viewBox="0 0 1600 900" preserveAspectRatio="none"><path d="M0 180C200 70 240 200 480 95S1000 70 1600 0M0 850C230 760 400 890 700 810S1180 880 1600 770"/><path d="M0 200C200 100 300 180 530 105M980 845C1200 760 1380 900 1600 800"/></svg></div>
  <header class="fm-header"><a class="fm-brand" href="#home" aria-label="AYYY — главная">ayyy<span>.</span></a><span class="fm-header-label">ФИНАНСЫ</span><nav aria-label="Навигация"><a href="#home">Главная</a><a href="#directory">${I('grid',14)} Все сервисы</a></nav></header>
  <main class="fm-main"><section class="fm-heading"><div><div class="fm-kicker">AYYY / MARKET DESK</div><h1>Валюты и рынки</h1><p>Курсы, индексы и рыночные ориентиры. Без лишнего шума.</p></div><button class="fm-button" data-fm="refresh">${I('refresh')}<span>Обновить данные</span></button></section>
  <div class="fm-status-row"><span id="fm-status" role="status"></span><button class="fm-text-button" data-fm="sources">Источники и задержки ${I('info',13)}</button></div>
  <div class="fm-error" id="fm-error" role="alert" hidden></div><section class="fm-rate-cards" id="fm-cards" aria-label="Справочные курсы валют"></section>
  <div class="fm-work"><section class="fm-panel fm-market"><div class="fm-panel-head"><div><div class="fm-kicker">ОБЗОР ДИНАМИКИ</div><h2 id="fm-chart-title">Рынок в деталях</h2></div><div class="fm-segment" aria-label="Источник графика"><button data-mode="rates">Курсы валют</button><button data-mode="market">Биржи и сырьё</button></div></div>
  <div class="fm-chart-tools"><label class="fm-symbol"><span class="fm-sr">Инструмент графика</span><select id="fm-symbol"></select></label><div class="fm-periods" id="fm-periods" aria-label="Период графика"></div><div class="fm-indicators" id="fm-indicators"><label><input type="checkbox" data-indicator="sma20">SMA 20</label><label><input type="checkbox" data-indicator="sma50">SMA 50</label><label><input type="checkbox" data-indicator="bb">BB</label></div><button class="fm-icon" data-fm="chart-style" aria-label="Изменить вид графика" title="Изменить вид графика">${I('chart')}</button><button class="fm-icon" data-fm="csv" aria-label="Скачать данные графика CSV" title="Экспорт CSV">${I('download')}</button></div>
  <div class="fm-chart-quote" id="fm-quote"></div><div class="fm-plot" id="fm-plot" tabindex="0" role="group" aria-label="График: стрелки влево и вправо выбирают дату"></div><div class="fm-chart-bottom" id="fm-chart-bottom"></div><div class="fm-chart-source" id="fm-chart-source"></div></section>
  <aside class="fm-panel fm-converter"><div class="fm-panel-head"><div><div class="fm-kicker">ПЕРЕСЧЁТ БЕЗ КОМИССИЙ</div><h2>Конвертер валют</h2></div>${I('coins',20)}</div><label class="fm-field"><span>Сумма</span><input id="fm-amount" inputmode="decimal" maxlength="30" autocomplete="off" aria-label="Сумма для конвертации"></label><div class="fm-currency-selectors"><label class="fm-field"><span>Из</span><select id="fm-from"></select></label><button class="fm-icon" data-fm="swap" title="Поменять валюты местами" aria-label="Поменять валюты местами">${I('refresh')}</button><label class="fm-field"><span>В</span><select id="fm-to"></select></label></div><div class="fm-conversion" id="fm-conversion" aria-live="polite"></div><div class="fm-converter-actions"><button class="fm-text-button" data-fm="copy">${I('copy',13)} Скопировать</button><button class="fm-text-button" data-fm="pair">Показать график ${I('arrow-right',13)}</button></div><div class="fm-provider"><span class="fm-provider-icon">F</span><div><strong>Frankfurter</strong><span>Дневные справочные курсы</span></div><span class="fm-badge">API</span></div><p class="fm-caption">Это не курс покупки или продажи в банке. Комиссии и спред не включены. Сумма остаётся в браузере.</p></aside></div>
  <div class="fm-bottom"><section class="fm-panel"><div class="fm-panel-head"><h2>Биржевые индексы</h2><span class="fm-badge">TradingView</span></div><div id="fm-indices"></div><p class="fm-caption">Значения и задержки отображаются в графике провайдера.</p></section><section class="fm-panel fm-observations"><div class="fm-panel-head"><h2>Наблюдения и заметки</h2>${I('note')}</div><div id="fm-observation" class="fm-observation"></div><label class="fm-sr" for="fm-note">Ваша локальная заметка</label><textarea id="fm-note" rows="2" maxlength="2000" placeholder="Запишите наблюдение или уровень, который хотите проверить…"></textarea><div class="fm-note-foot"><span id="fm-note-status">Только в этом браузере</span><button class="fm-text-button" data-fm="clear-note">Очистить</button></div></section><section class="fm-panel"><div class="fm-panel-head"><h2>Металлы и сырьё</h2><span class="fm-badge muted">Обзор</span></div><div id="fm-commodities"></div><p class="fm-caption">Открытие графика не выполняет торговые операции.</p></section></div>
  <footer class="fm-footer"><span>${I('shield',13)} Конвертация и заметки — на вашем устройстве</span><span>Frankfurter · TradingView <span class="fm-footer-sep">/</span> Не торговая рекомендация</span></footer></main></div>`;
 }
 function mount(){
  const root=document.querySelector('.fm-page');if(!root)return;
  document.body.dataset.shell='markets';const $=s=>root.querySelector(s);
  const raw=A.get('markets.preferences',{}),saved=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{},cache=A.get(M.KEY,null);
  const safeCode=(x,f)=>Object.hasOwn(M.currencies,x)?x:f;
  const state={data:M.valid(cache)?cache:null,mode:'rates',base:safeCode(saved.base,'USD'),quote:safeCode(saved.quote,'RUB'),from:safeCode(saved.from,'USD'),to:safeCode(saved.to,'RUB'),amount:typeof saved.amount==='string'?saved.amount.slice(0,30):'100',period:[30,90,180,365].includes(saved.period)?saved.period:90,market:'spx',indicators:{sma20:true,sma50:false,bb:false},area:true,style:'1',busy:false,error:'',conversion:null};
  let alive=true,controller=null,timer=0,widgetTimer=0,serial=0,geometry=null,cursor=-1,noteTimer=0;
  let measuredWidth=0,resizeObserver=null;
  function prefs(){A.set('markets.preferences',{base:state.base,quote:state.quote,from:state.from,to:state.to,amount:state.amount,period:state.period});}
  function points(days=state.period){return M.series(state.data,state.base,state.quote,days);}
  function status(){
   const d=state.data,last=d?.days[d.days.length-1]?.date,stale=d&&(Date.now()-d.updatedAt>M.TTL||Date.now()-Date.parse(last+'T12:00:00Z')>5*M.DAY);
   $('#fm-status').innerHTML=`<i class="fm-dot ${state.error||stale?'warn':''}"></i>${state.busy?'Обновляем дневные курсы…':d?`${stale||state.error?'Сохранённые курсы':'Дневные курсы'} · ${day(last)}`:'Данные ещё не загружены'}`;
   const refresh=$('[data-fm="refresh"]');refresh.disabled=state.busy;refresh.querySelector('span').textContent=state.busy?'Обновляем…':'Обновить данные';
   $('#fm-error').hidden=!state.error;$('#fm-error').textContent=state.error+(d?' Показаны сохранённые данные.':' Попробуйте обновить данные ещё раз.');
  }
  function cards(){
   $('#fm-cards').innerHTML=['USD','EUR','GBP','CNY','CHF'].map(code=>{const pp=M.series(state.data,code,'RUB',30),s=M.stats(pp);return `<button class="fm-rate ${state.mode==='rates'&&state.base===code&&state.quote==='RUB'?'active':''}" data-rate="${code}"><div class="fm-rate-head"><span class="fm-currency-icon">${M.currencies[code][1]}</span><span><strong>${code} / RUB</strong><small>${M.currencies[code][0]}</small></span></div><div class="fm-rate-data"><strong>${s?n(s.last.value):'—'}<small> ₽</small></strong><div class="${s?tones(s.daily):''}">${C.spark(pp)}</div></div><div class="fm-rate-foot"><span class="${s?tones(s.daily):''}">${s?pct(s.daily):'Нет данных'}</span><span>${s?'к '+day(s.previousDate):'Нажмите «Обновить»'}</span></div></button>`;}).join('');
  }
  function controls(){
   root.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===state.mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
   $('#fm-symbol').innerHTML=state.mode==='rates'?Object.keys(M.currencies).filter(c=>c!=='RUB').map(c=>`<option value="${c}" ${c===state.base?'selected':''}>${c} / ${state.quote}</option>`).join(''):M.instruments.map(x=>`<option value="${x.id}" ${x.id===state.market?'selected':''}>${e(x.name)}</option>`).join('');
   if(state.mode==='rates'&&state.base==='RUB')$('#fm-symbol').insertAdjacentHTML('afterbegin',`<option value="RUB" selected>RUB / ${state.quote}</option>`);
   $('#fm-periods').innerHTML=[[30,'1М'],[90,'3М'],[180,'6М'],[365,'1Г']].map(([p,l])=>`<button data-period="${p}" class="${p===state.period?'active':''}" aria-pressed="${p===state.period}">${l}</button>`).join('');
   $('#fm-indicators').hidden=state.mode!=='rates';root.querySelectorAll('[data-indicator]').forEach(i=>i.checked=state.indicators[i.dataset.indicator]);
   $('[data-fm="csv"]').disabled=state.mode!=='rates'||!points().length;
   $('[data-fm="chart-style"]').setAttribute('aria-label',state.mode==='rates'?'Переключить линию и область':'Переключить свечи и область');
   root.querySelectorAll('[data-instrument]').forEach(b=>b.classList.toggle('active',state.mode==='market'&&b.dataset.instrument===state.market));
  }
  function observation(){
   const s=M.stats(points());$('#fm-observation').innerHTML=s?`<span class="fm-dot"></span><div><strong>${state.base}/${state.quote}: ${pct(s.percent)} за период</strong><p>${s.count} наблюдений · минимум ${n(s.min)}, максимум ${n(s.max)}. По справочным данным, не торговый сигнал.</p></div>`:`<span class="fm-dot warn"></span><div><strong>Сначала — данные</strong><p>Изменения рассчитываются по истории, а не заполняются демонстрационными значениями.</p></div>`;
  }
  function selectPoint(index){
   if(!geometry||!geometry.points.length)return;cursor=Math.max(0,Math.min(geometry.points.length-1,index));const p=geometry.points[cursor],x=geometry.x(cursor),y=geometry.y(p.value);
   $('#fm-crosshair')?.removeAttribute('hidden');$('#fm-cross-line')?.setAttribute('d',`M${x} ${geometry.T}V${geometry.B}`);$('#fm-cross-dot')?.setAttribute('cx',x);$('#fm-cross-dot')?.setAttribute('cy',y);
   const read=$('#fm-cursor');if(read)read.textContent=`${day(p.date)} · 1 ${state.base} = ${n(p.value,4)} ${state.quote}`;
  }
  function chart(){
   clearTimeout(widgetTimer);geometry=null;cursor=-1;controls();
   $('#fm-plot').classList.toggle('is-widget',state.mode==='market');
   if(state.mode==='market'){
    const item=M.instruments.find(x=>x.id===state.market);$('#fm-chart-title').textContent=item.name;
    $('#fm-quote').innerHTML=`<strong>${e(item.symbol)}</strong><span class="fm-badge">Внешний график</span><span>Доступность и задержка зависят от биржи</span>`;
    const frame=document.createElement('iframe');frame.title=item.name+' · график TradingView';frame.src=M.widgetURL(item.id,{30:'1M',90:'3M',180:'6M',365:'12M'}[state.period],state.style);
    // The origin is TradingView, NOT srcdoc or this portal. Its storage APIs can work,
    // while browser same-origin rules deny it access to AYYY/Gmail/LLM data.
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');frame.referrerPolicy='strict-origin';frame.allow='fullscreen';frame.setAttribute('loading','eager');
    $('#fm-plot').replaceChildren(frame);
    $('#fm-chart-bottom').innerHTML=`<span id="fm-widget-hint">TradingView · котировки и время обновления — внутри графика.</span><button class="fm-text-button" data-fm="retry-widget">${I('refresh',13)} Повторить</button>`;
    $('#fm-chart-source').innerHTML=`<a href="${M.symbolURL(item.id)}" target="_blank" rel="noopener noreferrer">${e(item.name)} — график TradingView ${I('external',12)}</a><button class="fm-text-button" data-mode="rates">Вернуться к графику валют</button>`;
    widgetTimer=setTimeout(()=>{if(alive&&state.mode==='market'&&$('#fm-widget-hint'))$('#fm-widget-hint').textContent='График не виден? Возможна блокировка провайдера, сети или расширения. Повторите загрузку или откройте TradingView по ссылке.';},12000);
    return;
   }
   const pp=points(),s=M.stats(pp);$('#fm-chart-title').textContent='Рынок в деталях';
   $('#fm-quote').innerHTML=`<strong>${state.base} / ${state.quote}</strong><b>${s?n(s.last.value,4):'—'}</b>${s?`<span class="${tones(s.percent)}">${pct(s.percent)}</span>`:''}<span>за выбранный период · дневной курс</span>`;
   if(!s){$('#fm-plot').innerHTML=`<div class="fm-empty">${I('chart',38)}<h3>${state.busy?'Загружаем историю курсов':'Нужна история котировок'}</h3><p>График строится по данным Frankfurter.<br>Здесь не будет вымышленных чисел или случайных свечей.</p><button class="fm-button" data-fm="refresh">Загрузить историю ${I('arrow-right',14)}</button></div>`;$('#fm-chart-bottom').innerHTML='';}
   else{geometry=C.plot(pp,points(500),{...state.indicators,area:state.area,width:$('#fm-plot').clientWidth,height:$('#fm-plot').clientHeight});$('#fm-plot').innerHTML=geometry.html;$('#fm-chart-bottom').innerHTML=`<span>Начало <b>${n(s.first.value)}</b></span><span>Минимум <b>${n(s.min)}</b></span><span>Максимум <b>${n(s.max)}</b></span><span id="fm-cursor" aria-live="polite">${s.count} наблюдений · наведите на график</span>`;}
   $('#fm-chart-source').innerHTML=`<span><i class="fm-line-key"></i> Дневной курс <i class="fm-line-key orange"></i> SMA 20 <i class="fm-line-key gray"></i> SMA 50</span><a href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer">Frankfurter · не биржевые свечи ${I('external',12)}</a>`;
   observation();
  }
  function convert(){
   state.amount=$('#fm-amount').value;state.from=$('#fm-from').value;state.to=$('#fm-to').value;state.conversion=null;
   try{const r=M.convert(state.data,state.amount,state.from,state.to);state.conversion=r;$('#fm-amount').removeAttribute('aria-invalid');$('#fm-conversion').innerHTML=`<span>${n(r.amount,2)} ${state.from} =</span><strong>${n(r.total,2)} <small>${M.currencies[state.to][1]}</small></strong><p>1 ${state.from} = ${n(r.rate,6)} ${state.to}</p><div>${I('clock',12)} Общая дата курсов: ${day(r.date)}</div>`;}
   catch(err){$('#fm-conversion').innerHTML=`<span>${e(err.message)}</span><strong>—</strong>`;if(state.data)$('#fm-amount').setAttribute('aria-invalid','true');}
   $('[data-fm="copy"]').disabled=!state.conversion;prefs();
  }
  function rows(group){return M.instruments.filter(x=>x.group===group).map((x,i)=>`<button class="fm-instrument" data-instrument="${x.id}"><span class="fm-instrument-icon ${x.id}">${group==='index'?String(i+1).padStart(2,'0'):I(x.id==='oil'?'droplet':'coins',17)}</span><span><strong>${e(x.name)}</strong><small>${e(x.description)}</small></span><span class="fm-open-chart">График ${I('arrow-right',13)}</span></button>`).join('');}
  async function refresh(){
   if(state.busy)return;state.busy=true;state.error='';const ticket=++serial;controller=new AbortController();const own=controller;timer=setTimeout(()=>own.abort(),15000);status();if(!state.data&&state.mode==='rates')chart();
   try{const data=await M.load(own.signal);if(!alive||ticket!==serial)return;state.data=data;if(!A.set(M.KEY,data))A.toast('Курсы загружены, но браузер не сохранил кэш.');}
   catch(err){if(alive&&ticket===serial)state.error=err.name==='AbortError'?'Источник не ответил за 15 секунд.':err instanceof TypeError?'Не удалось связаться с источником курсов.':err.message;}
   finally{clearTimeout(timer);if(alive&&ticket===serial){state.busy=false;status();cards();convert();if(state.mode==='rates')chart();observation();}}
  }
  function saveNote(){clearTimeout(noteTimer);if(!alive)return;const ok=A.set('markets.note',$('#fm-note').value.slice(0,2000));$('#fm-note-status').textContent=ok?'Сохранено на этом устройстве':'Не сохранено — скопируйте текст';}
  const click=ev=>{
   const b=ev.target.closest('button');if(!b)return;
   if(b.dataset.rate){state.base=b.dataset.rate;state.quote='RUB';state.mode='rates';cards();chart();prefs();return;}
   if(b.dataset.mode){state.mode=b.dataset.mode;chart();cards();return;}
   if(b.dataset.period){state.period=Number(b.dataset.period);chart();prefs();return;}
   if(b.dataset.instrument){state.market=b.dataset.instrument;state.mode='market';chart();cards();$('#fm-chart-title').scrollIntoView({block:'nearest',behavior:'smooth'});return;}
   switch(b.dataset.fm){
    case'refresh':refresh();break;
    case'swap':{const old=$('#fm-from').value;$('#fm-from').value=$('#fm-to').value;$('#fm-to').value=old;convert();break;}
    case'pair':state.base=state.from;state.quote=state.to;state.mode='rates';chart();cards();prefs();break;
    case'copy':if(state.conversion)A.copy(`${state.amount} ${state.from} = ${n(state.conversion.total)} ${state.to} (${state.conversion.date}, Frankfurter)`);break;
    case'csv':if(state.mode==='rates'&&points().length)A.download(`AYYY_${state.base}_${state.quote}.csv`,M.csv(points()),'text/csv;charset=utf-8');break;
    case'chart-style':if(state.mode==='rates')state.area=!state.area;else state.style=state.style==='1'?'3':'1';chart();break;
    case'retry-widget':chart();break;
    case'clear-note':$('#fm-note').value='';saveNote();break;
    case'sources':A.modal('Источники данных',`<p>Frankfurter — дневные справочные курсы. Изменение в карточке сравнивает два последних наблюдения, а не обязательно два соседних календарных дня. Кросс-курс использует значения одной даты.</p><p>Биржевые графики и металлы предоставляются TradingView в отдельном окне другого origin. AYYY не получает их котировки как JSON и не подставляет вымышленные цены. Ограничения, символы и задержки определяет поставщик.</p><p>Формулы SMA и BB рассчитаны по дневной истории. Это описание данных, не рекомендация покупать или продавать. Сумма конвертации и заметка не отправляются поставщикам.</p><div class="modal-footer"><button class="btn" data-close-modal>Понятно</button></div>`);break;
   }
  };
  const change=ev=>{const t=ev.target;if(t.id==='fm-symbol'){if(state.mode==='rates'){state.base=t.value;prefs();}else state.market=t.value;chart();cards();}else if(t.dataset.indicator){state.indicators[t.dataset.indicator]=t.checked;chart();}else if(t.id==='fm-from'||t.id==='fm-to')convert();};
  const input=ev=>{if(ev.target.id==='fm-amount')convert();if(ev.target.id==='fm-note'){clearTimeout(noteTimer);noteTimer=setTimeout(saveNote,300);}};
  const pointer=ev=>{if(!geometry)return;const svg=$('#fm-plot svg');if(!svg)return;const point=svg.createSVGPoint();point.x=ev.clientX;point.y=ev.clientY;const matrix=svg.getScreenCTM();if(!matrix)return;const v=point.matrixTransform(matrix.inverse()).x;selectPoint(Math.round((v-geometry.L)/(geometry.R-geometry.L)*(geometry.points.length-1)));};
  const key=ev=>{if(!geometry||!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;ev.preventDefault();selectPoint(ev.key==='Home'?0:ev.key==='End'?geometry.points.length-1:cursor<0?geometry.points.length-1:cursor+(ev.key==='ArrowRight'?1:-1));};
  $('#fm-from').innerHTML=options(state.from);$('#fm-to').innerHTML=options(state.to);$('#fm-amount').value=state.amount;
  $('#fm-indices').innerHTML=rows('index');$('#fm-commodities').innerHTML=rows('commodity');const note=A.get('markets.note','');$('#fm-note').value=typeof note==='string'?note.slice(0,2000):'';
  root.addEventListener('click',click);root.addEventListener('change',change);root.addEventListener('input',input);$('#fm-plot').addEventListener('pointermove',pointer);$('#fm-plot').addEventListener('pointerdown',pointer);$('#fm-plot').addEventListener('keydown',key);
  status();cards();chart();convert();
  if(typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(()=>{const width=$('#fm-plot').clientWidth;if(width!==measuredWidth){measuredWidth=width;if(alive&&state.mode==='rates')chart();}});resizeObserver.observe($('#fm-plot'));}
  if(!state.data||Date.now()-state.data.updatedAt>M.TTL)refresh();
  return ()=>{if(noteTimer)saveNote();alive=false;resizeObserver?.disconnect();serial++;controller?.abort();clearTimeout(timer);clearTimeout(widgetTimer);clearTimeout(noteTimer);root.removeEventListener('click',click);root.removeEventListener('change',change);root.removeEventListener('input',input);$('#fm-plot').removeEventListener('pointermove',pointer);$('#fm-plot').removeEventListener('pointerdown',pointer);$('#fm-plot').removeEventListener('keydown',key);$('#fm-plot').replaceChildren();};
 }
 const service=A.services.find(x=>x.id==='finance');if(service)Object.assign(service,{color:'orange',desc:'История курсов, графики и конвертер'});
 A.register('finance',{title:'Валюты и рынки',render,mount});
})();
