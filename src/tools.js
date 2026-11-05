/* AYYY · Browser tools. No dependencies, requests, eval, or stored passwords. */
(() => {
  'use strict';
  const app = window.AYYY;
  const e = app.escape;
  const icon = (name, size = 20) => app.icon(name, size);
  const catalog = [
    {id:'calc', title:'Калькулятор', note:'Числа, формулы, скобки', icon:'calculator', tone:'blue'},
    {id:'percent', title:'Проценты', note:'Скидки и изменения', icon:'percent', tone:'green'},
    {id:'converter', title:'Конвертер', note:'Длина, вес и не только', icon:'ruler', tone:'purple'},
    {id:'dates', title:'Даты', note:'Сколько дней между', icon:'calendar', tone:'amber'},
    {id:'password', title:'Пароли', note:'Случайные и надёжные', icon:'lock', tone:'green'},
    {id:'json', title:'JSON', note:'Порядок в ваших данных', icon:'code', tone:'blue'},
    {id:'text', title:'Текст', note:'Посчитать и привести в вид', icon:'type', tone:'purple'},
    {id:'color', title:'Цвета', note:'Палитра и контраст', icon:'sparkles', tone:'amber'}
  ];
  const format = n => new Intl.NumberFormat('ru-RU', {maximumSignificantDigits:13}).format(Object.is(n, -0) ? 0 : n);
  const plural = (n, forms) => { const a = Math.abs(n) % 100; return forms[a > 10 && a < 20 ? 2 : a % 10 === 1 ? 0 : a % 10 > 1 && a % 10 < 5 ? 1 : 2]; };
  const readNumber = (el, label = 'число') => {
    const raw = el.value.trim().replace(',', '.');
    if (!raw || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) || !Number.isFinite(Number(raw))) throw new Error(`Введите корректное ${label}.`);
    return Number(raw);
  };
  const listen = (el, type, fn, cleanups) => { el.addEventListener(type, fn); cleanups.push(() => el.removeEventListener(type, fn)); };
  const safeResult = n => { if (!Number.isFinite(n)) throw new Error('Результат слишком большой. Уменьшите исходные числа.'); return n; };
  const copy = async (value, root) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(String(value));
      app.toast('Скопировано');
    } catch (_) {
      let fallback = root.querySelector('.tools-copy-fallback');
      if (!fallback) {
        fallback = document.createElement('div');
        fallback.className = 'tools-copy-fallback';
        fallback.innerHTML = '<label>Браузер не разрешил копирование. Нажмите Ctrl+C / ⌘C:<textarea readonly aria-label="Текст для ручного копирования" rows="2"></textarea></label>';
        root.append(fallback);
      }
      const input = fallback.querySelector('textarea');
      input.value = String(value);
      input.focus(); input.select();
      app.toast('Текст выделен для ручного копирования');
    }
  };
  const button = (action, label, glyph, cls = '') => `<button class="btn ${cls}" type="button" data-action="${action}">${glyph ? icon(glyph, 17) : ''}<span>${label}</span></button>`;
  const note = (heading, text, glyph = 'shield') => `<div class="tools-note"><span class="tools-note-icon">${icon(glyph,19)}</span><div><strong>${heading}</strong><p>${text}</p></div></div>`;
  const context = (title, text, inner = '') => `<aside class="tools-context"><div class="panel tools-context-card"><div class="tools-overline">ПОЛЕЗНО ЗНАТЬ</div><h3>${title}</h3><p class="muted">${text}</p>${inner}</div>${note('Остаётся у вас', 'Расчёты выполняются в этом браузере. Введённые данные никуда не отправляются.')}</aside>`;
  const workspace = (id, title, eyebrow, content, aside) => `<div class="tools-layout"><section class="panel tools-workspace" aria-label="${title}"><div class="tools-workspace-head"><div><span class="tools-overline">${eyebrow}</span><h2>${title}</h2></div><span class="tools-local-dot"><i></i>В браузере</span></div>${content}<div class="tools-error" id="tools-error" role="status" aria-live="polite"></div></section>${aside}</div>`;
  const error = (root, message = '') => { const box = root.querySelector('#tools-error'); if (box) {box.textContent = message; box.hidden = !message;} };

  function evaluateExpression(source) {
    const raw = source.replace(/[×x]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/,/g, '.').replace(/\s/g, '');
    if (!raw) throw new Error('Введите выражение.');
    if (raw.length > 512) throw new Error('Выражение слишком длинное. Максимум — 512 знаков.');
    const tokens = []; let pos = 0;
    while (pos < raw.length) {
      const match = /^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+*/%\-])/.exec(raw.slice(pos));
      if (!match) throw new Error(`Недопустимый символ «${raw[pos]}».`);
      tokens.push(match[0]); pos += match[0].length;
    }
    let cursor = 0; let depth = 0;
    function atom() {
      if (++depth > 64) throw new Error('Слишком много вложенных операций.');
      let result;
      const token = tokens[cursor++];
      if (token === '+' || token === '-') result = (token === '-' ? -1 : 1) * atom();
      else if (token === '(') { result = sum(); if (tokens[cursor++] !== ')') throw new Error('Проверьте парные скобки.'); }
      else if (token !== undefined && /^(?:\d|\.)/.test(token)) result = safeResult(Number(token));
      else throw new Error('Не хватает числа или открывающей скобки.');
      while (tokens[cursor] === '%') {result /= 100; cursor++;}
      depth--; return safeResult(result);
    }
    function product() {
      let value = atom();
      while (tokens[cursor] === '*' || tokens[cursor] === '/') {
        const op = tokens[cursor++]; const rhs = atom();
        if (op === '/' && rhs === 0) throw new Error('На ноль делить нельзя.');
        value = safeResult(op === '*' ? value * rhs : value / rhs);
      }
      return value;
    }
    function sum() {
      let value = product();
      while (tokens[cursor] === '+' || tokens[cursor] === '-') {
        const op = tokens[cursor++]; const rhs = product();
        value = safeResult(op === '+' ? value + rhs : value - rhs);
      }
      return value;
    }
    const answer = sum();
    if (cursor !== tokens.length) throw new Error('Между числами или скобками нужен знак операции.');
    return answer;
  }
  function calcView() {
    const keys = ['C', '(', ')', '⌫', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '%', '+'];
    return workspace('calc','Калькулятор','ПОСЧИТАЕМ?', `<label class="tools-input-label" for="tools-expression">Выражение</label><input id="tools-expression" class="tools-expression" type="text" value="12 500 × (1 + 8 / 100)" autocomplete="off" spellcheck="false" inputmode="text"><div class="tools-result-card"><span>Получается</span><output id="tools-calc-result" aria-live="polite">13 500</output><button class="icon-btn" type="button" data-action="copy-result" aria-label="Скопировать результат">${icon('copy',18)}</button></div><div class="tools-keypad">${keys.map(k=>`<button type="button" class="tools-key ${/[÷×−+%()]/.test(k) ? 'is-op' : ''} ${k==='C'?'is-clear':''}" data-key="${k}" aria-label="${k==='⌫'?'Удалить последний знак':k==='C'?'Очистить':k}">${k}</button>`).join('')}</div><button type="button" class="btn primary tools-equals" data-action="calculate">Посчитать ${icon('arrow-right',18)}<kbd>Enter</kbd></button>`, context('Не теряйте ход мысли', 'Пишите формулу целиком или пользуйтесь кнопками. Скобки и порядок действий учитываются.', `<div class="tools-hint">Знак <b>%</b> делит число на 100. Например: <code>200 × 10% = 20</code>.</div><div class="tools-history-head"><h4>История</h4><button type="button" class="tools-text-btn" data-action="clear-history">Очистить</button></div><div id="tools-history" class="tools-history"></div>`));
  }
  function mountCalc(root, cleanups) {
    const input = root.querySelector('#tools-expression'); const output = root.querySelector('#tools-calc-result');
    let answer = null;
    let history = app.get('calculatorHistory', []);
    if (!Array.isArray(history)) history = [];
    history = history.filter(h=>h && typeof h.expression==='string' && Number.isFinite(h.result)).slice(0,8);
    function renderHistory() {
      root.querySelector('#tools-history').innerHTML = history.length ? history.map((h,i)=>`<button type="button" class="tools-history-item" data-history="${i}"><span>${e(h.expression)}</span><strong>${e(format(h.result))}</strong></button>`).join('') : '<div class="tools-history-empty">Здесь появятся ваши расчёты.<br>Нажмите «Посчитать».</div>';
    }
    function update(explicit = false) {
      try { answer = evaluateExpression(input.value); output.textContent = format(answer); error(root); if (explicit) { history.unshift({expression:input.value, result:answer}); history = history.slice(0,8); app.set('calculatorHistory',history); renderHistory(); } }
      catch (err) { answer = null; output.textContent = '—'; error(root, explicit ? err.message : ''); }
    }
    listen(input,'input',()=>update(),cleanups);
    listen(input,'keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();update(true);}},cleanups);
    listen(root,'click',ev=>{
      const key = ev.target.closest('[data-key]');
      if (key) {
        const value = key.dataset.key; const start = input.selectionStart ?? input.value.length; const end = input.selectionEnd ?? start;
        if (value==='C') {input.value='';input.focus();}
        else if (value==='⌫') {const from = start===end ? Math.max(0,start-1) : start; input.setRangeText('',from,end,'end');input.focus();}
        else {input.setRangeText(value,start,end,'end');input.focus();}
        update(); return;
      }
      const old = ev.target.closest('[data-history]');
      if (old && history[Number(old.dataset.history)]) {input.value=history[Number(old.dataset.history)].expression;update();input.focus();return;}
      const action = ev.target.closest('[data-action]')?.dataset.action;
      if(action==='calculate') update(true);
      if(action==='copy-result') answer===null ? app.toast('Сначала введите корректное выражение') : copy(String(answer),root);
      if(action==='clear-history') {history=[];app.set('calculatorHistory',history);renderHistory();app.toast('История очищена');}
    },cleanups);
    renderHistory(); update();
  }

  function percentView() {
    return workspace('percent','Проценты без головоломки','ПОНЯТНЫЕ ЧИСЛА', `<div class="tools-tabs" role="group" aria-label="Тип расчёта"><button type="button" class="is-active" data-percent-mode="part" aria-pressed="true">Процент от числа</button><button type="button" data-percent-mode="discount" aria-pressed="false">Скидка</button><button type="button" data-percent-mode="change" aria-pressed="false">Изменение</button></div><div class="tools-input-grid"><label><span id="tools-percent-first-label">Число</span><input class="field" id="tools-percent-first" type="text" inputmode="decimal" value="16000"></label><label><span id="tools-percent-second-label">Процент, %</span><input class="field" id="tools-percent-second" type="text" inputmode="decimal" value="15"></label></div><div class="tools-result-card tools-result-big"><span id="tools-percent-caption">15% от 16 000</span><output id="tools-percent-result" aria-live="polite">2 400</output><span class="tools-result-sub" id="tools-percent-detail">16 000 × 15 ÷ 100</span></div><div class="tools-actions">${button('percent-copy','Скопировать','copy')}</div>`, context('Три повседневные задачи','Проверить скидку в магазине, посчитать долю от суммы или понять, насколько изменилась цена.', `<div class="tools-tip-list"><div><span>01</span><p><b>Процент от числа</b><br>Сколько составляют 15% от суммы.</p></div><div><span>02</span><p><b>Скидка</b><br>Новая цена и ваша экономия.</p></div><div><span>03</span><p><b>Изменение</b><br>Рост или снижение относительно исходного значения.</p></div></div>`));
  }
  function mountPercent(root, cleanups) {
    let mode='part'; let result=null;
    const a=root.querySelector('#tools-percent-first'), b=root.querySelector('#tools-percent-second');
    function update() {
      try {
        const x=readNumber(a), y=readNumber(b, mode==='change'?'второе число':'значение процента'); let caption='',detail='';
        if(mode==='part') {result=safeResult(x*y/100);caption=`${format(y)}% от ${format(x)}`;detail=`${format(x)} × ${format(y)} ÷ 100`;}
        else if(mode==='discount') {if(x<0 || y<0 || y>100) throw new Error('Цена должна быть неотрицательной, а скидка — от 0 до 100%.');result=safeResult(x*(1-y/100));caption='Цена со скидкой';detail=`Экономия ${format(x-result)} · скидка ${format(y)}%`;}
        else {if(x<=0) throw new Error('Для расчёта изменения исходное значение должно быть больше нуля.');result=safeResult((y-x)/x*100);caption=result>0?'Значение выросло':result<0?'Значение снизилось':'Без изменений';detail=`Разница ${y-x>0?'+':''}${format(y-x)} · было ${format(x)}, стало ${format(y)}`;}
        root.querySelector('#tools-percent-result').textContent=(mode==='change'&&result>0?'+':'')+format(result)+(mode==='change'?'%':'');
        root.querySelector('#tools-percent-caption').textContent=caption;root.querySelector('#tools-percent-detail').textContent=detail;error(root);
      }catch(err){result=null;root.querySelector('#tools-percent-result').textContent='—';root.querySelector('#tools-percent-detail').textContent='';error(root,err.message);}
    }
    listen(root,'input',update,cleanups);
    listen(root,'click',ev=>{
      const tab=ev.target.closest('[data-percent-mode]');
      if(tab){mode=tab.dataset.percentMode;root.querySelectorAll('[data-percent-mode]').forEach(el=>{el.classList.toggle('is-active',el===tab);el.setAttribute('aria-pressed',String(el===tab));});root.querySelector('#tools-percent-first-label').textContent=mode==='change'?'Было':mode==='discount'?'Цена до скидки':'Число';root.querySelector('#tools-percent-second-label').textContent=mode==='change'?'Стало':'Процент, %';a.value=mode==='change'?'14500':'16000';b.value=mode==='change'?'16000':'15';update();}
      if(ev.target.closest('[data-action="percent-copy"]')) result===null?app.toast('Проверьте исходные числа'):copy(root.querySelector('#tools-percent-result').textContent,root);
    },cleanups);update();
  }

  const unitGroups = {
    length:{name:'Длина',default:['km','mi'],value:10,units:{mm:['Миллиметры · мм',.001],cm:['Сантиметры · см',.01],m:['Метры · м',1],km:['Километры · км',1000],in:['Дюймы · in',.0254],ft:['Футы · ft',.3048],yd:['Ярды · yd',.9144],mi:['Мили · mi',1609.344]}},
    mass:{name:'Масса',default:['kg','lb'],value:1,units:{mg:['Миллиграммы · мг',.000001],g:['Граммы · г',.001],kg:['Килограммы · кг',1],t:['Тонны · т',1000],oz:['Унции · oz',.028349523125],lb:['Фунты · lb',.45359237]}},
    temperature:{name:'Температура',default:['c','f'],value:22,units:{c:['Градусы Цельсия · °C',1],f:['Градусы Фаренгейта · °F',1],k:['Кельвины · K',1]}},
    data:{name:'Данные',default:['mb','mib'],value:100,units:{b:['Байты · B',1],kb:['Килобайты · kB',1000],mb:['Мегабайты · MB',1000000],gb:['Гигабайты · GB',1000000000],kib:['Кибибайты · KiB',1024],mib:['Мебибайты · MiB',1048576],gib:['Гибибайты · GiB',1073741824],tib:['Тебибайты · TiB',1099511627776]}}
  };
  function converterView() {
    return workspace('converter','Из одной единицы в другую','МЕНЯЕМ МАСШТАБ', `<label class="tools-input-label" for="tools-convert-group">Что переводим?</label><select class="field" id="tools-convert-group">${Object.entries(unitGroups).map(([id,g])=>`<option value="${id}">${g.name}</option>`).join('')}</select><div class="tools-input-grid tools-convert-grid"><label><span>Из</span><select class="field" id="tools-convert-from" aria-label="Исходная единица"></select><input class="field tools-number-field" type="text" inputmode="decimal" id="tools-convert-value" value="10" aria-label="Исходное значение"></label><button type="button" class="tools-swap" data-action="convert-swap" aria-label="Поменять единицы местами">⇄</button><label><span>В</span><select class="field" id="tools-convert-to" aria-label="Новая единица"></select><output class="tools-convert-output" id="tools-convert-result" aria-live="polite"></output></label></div><div class="tools-equivalence" id="tools-equivalence"></div><div class="tools-actions">${button('convert-copy','Скопировать результат','copy')}</div>`, context('Единицы без сюрпризов','Для переезда, покупок, рецептов, поездок и работы с файлами.', `<div class="tools-hint"><b>MB и MiB отличаются.</b><br>1 MB = 1 000 000 байт.<br>1 MiB = 1 048 576 байт.</div><div class="tools-mini-table" id="tools-convert-table"></div>`));
  }
  function mountConverter(root, cleanups) {
    const group=root.querySelector('#tools-convert-group'),from=root.querySelector('#tools-convert-from'),to=root.querySelector('#tools-convert-to'),input=root.querySelector('#tools-convert-value');let result=null;
    function convert(n,a,b) {
      if(group.value==='temperature') {const kelvin=a==='k'?n:a==='c'?n+273.15:(n-32)*5/9+273.15;if(kelvin< -1e-10)throw new Error('Температура не может быть ниже абсолютного нуля.');const k=Math.max(0,kelvin);return safeResult(b==='k'?k:b==='c'?k-273.15:(k-273.15)*9/5+32);}
      return safeResult(n*unitGroups[group.value].units[a][1]/unitGroups[group.value].units[b][1]);
    }
    function update() {
      try {const n=readNumber(input);result=convert(n,from.value,to.value);root.querySelector('#tools-convert-result').textContent=format(result);const u=unitGroups[group.value].units;let one='';try{one=`1 ${u[from.value][0].split(' · ')[1]} = ${format(convert(1,from.value,to.value))} ${u[to.value][0].split(' · ')[1]}`;}catch(_){}root.querySelector('#tools-equivalence').textContent=one;root.querySelector('#tools-convert-table').innerHTML=`<div><strong>${e(u[from.value][0].split(' · ')[1])}</strong><strong>${e(u[to.value][0].split(' · ')[1])}</strong></div>`+[1,10,100].map(v=>{let out='—';try{out=format(convert(v,from.value,to.value));}catch(_){}return `<div><span>${v}</span><span>${e(out)}</span></div>`;}).join('');error(root);}
      catch(err){result=null;root.querySelector('#tools-convert-result').textContent='—';root.querySelector('#tools-equivalence').textContent='';error(root,err.message);}
    }
    function setGroup() {const current=unitGroups[group.value];const options=Object.entries(current.units).map(([key,u])=>`<option value="${key}">${u[0]}</option>`).join('');from.innerHTML=options;to.innerHTML=options;from.value=current.default[0];to.value=current.default[1];input.value=String(current.value);update();}
    listen(root,'input',ev=>{if(ev.target===input)update();},cleanups);
    listen(root,'change',ev=>{if(ev.target===group)setGroup();else update();},cleanups);
    listen(root,'click',ev=>{const action=ev.target.closest('[data-action]')?.dataset.action;if(action==='convert-swap'){const old=from.value;from.value=to.value;to.value=old;if(result!==null)input.value=String(result);update();}if(action==='convert-copy')result===null?app.toast('Проверьте исходное значение'):copy(String(result),root);},cleanups);setGroup();
  }

  const isoDate = d => `${String(d.getFullYear()).padStart(4,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function parseDate(raw) {
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if(!m)throw new Error('Выберите дату.');
    const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);const d=new Date(0);d.setUTCFullYear(year,month-1,day);d.setUTCHours(0,0,0,0);
    if(year<1 || d.getUTCFullYear()!==year || d.getUTCMonth()!==month-1 || d.getUTCDate()!==day)throw new Error('Проверьте дату.');
    return d;
  }
  function datesView() {
    const today=new Date();const future=new Date(today);future.setDate(future.getDate()+90);
    return workspace('dates','У каждого плана есть дата','ВРЕМЯ В ПОРЯДКЕ', `<div class="tools-tabs" role="group" aria-label="Тип расчёта дат"><button type="button" class="is-active" data-date-mode="between" aria-pressed="true">Между датами</button><button type="button" data-date-mode="add" aria-pressed="false">Прибавить дни</button></div><div class="tools-input-grid"><label><span id="tools-date-start-label">Начало</span><input class="field" type="date" id="tools-date-start" value="${isoDate(today)}" min="0001-01-01" max="9999-12-31"></label><label id="tools-date-end-wrap"><span>Окончание</span><input class="field" type="date" id="tools-date-end" value="${isoDate(future)}" min="0001-01-01" max="9999-12-31"></label><label id="tools-date-days-wrap" hidden><span>Количество дней</span><input class="field" type="number" id="tools-date-days" value="30" step="1" min="-365000" max="365000"></label></div><label class="tools-check" id="tools-date-inclusive-wrap"><input type="checkbox" id="tools-date-inclusive"><span>Включить первый день</span></label><div class="tools-result-card tools-result-big"><span id="tools-date-caption">Разница между датами</span><output id="tools-date-result" aria-live="polite"></output><span class="tools-result-sub" id="tools-date-detail"></span></div><div class="tools-actions">${button('date-copy','Скопировать','copy')}${button('date-today','Сегодня','calendar','soft')}</div>`, context('Сколько осталось до?..','Отпуска, окончания проекта или важной встречи. Калькулятор считает календарные дни.', `<div class="tools-hint">В режиме «Прибавить дни» можно ввести отрицательное число, чтобы вернуться назад.</div><div class="tools-context-foot">Часовые пояса и переход на летнее время не меняют результат.</div>`));
  }
  function mountDates(root, cleanups) {
    let mode='between';let result='';const start=root.querySelector('#tools-date-start'),end=root.querySelector('#tools-date-end'),days=root.querySelector('#tools-date-days'),inclusive=root.querySelector('#tools-date-inclusive');
    function update() {
      try {const a=parseDate(start.value);let main='',detail='';
        if(mode==='between'){const b=parseDate(end.value);let n=Math.round((b-a)/86400000);if(inclusive.checked)n+=(n<0?-1:1);main=`${format(n)} ${plural(n,['день','дня','дней'])}`;const abs=Math.abs(n);const weeks=Math.floor(abs/7),rest=abs%7;detail=`${weeks} ${plural(weeks,['неделя','недели','недель'])}${rest?` и ${rest} ${plural(rest,['день','дня','дней'])}`:''}${n<0?' · в обратном направлении':''}`;root.querySelector('#tools-date-caption').textContent=inclusive.checked?'Включая первый день':'Разница между датами';}
        else {const n=readNumber(days,'целое количество дней');if(!Number.isInteger(n)||Math.abs(n)>365000)throw new Error('Введите целое число дней от −365 000 до 365 000.');const d=new Date(a.getTime()+n*86400000);if(d.getUTCFullYear()<1||d.getUTCFullYear()>9999)throw new Error('Результат за пределами поддерживаемых дат.');main=d.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});detail=d.toLocaleDateString('ru-RU',{weekday:'long',timeZone:'UTC'});root.querySelector('#tools-date-caption').textContent=n>=0?`Через ${n} ${plural(n,['день','дня','дней'])}`:`${Math.abs(n)} ${plural(n,['день','дня','дней'])} назад`;}
        root.querySelector('#tools-date-result').textContent=main;root.querySelector('#tools-date-result').classList.toggle('tools-date-long',mode==='add');root.querySelector('#tools-date-detail').textContent=detail;result=main;error(root);
      }catch(err){result='';root.querySelector('#tools-date-result').textContent='—';root.querySelector('#tools-date-detail').textContent='';error(root,err.message);}
    }
    listen(root,'input',update,cleanups);listen(root,'change',update,cleanups);
    listen(root,'click',ev=>{const tab=ev.target.closest('[data-date-mode]');if(tab){mode=tab.dataset.dateMode;root.querySelectorAll('[data-date-mode]').forEach(b=>{b.classList.toggle('is-active',b===tab);b.setAttribute('aria-pressed',String(b===tab));});root.querySelector('#tools-date-end-wrap').hidden=mode!=='between';root.querySelector('#tools-date-days-wrap').hidden=mode!=='add';root.querySelector('#tools-date-inclusive-wrap').hidden=mode!=='between';root.querySelector('#tools-date-start-label').textContent=mode==='between'?'Начало':'Исходная дата';update();}const action=ev.target.closest('[data-action]')?.dataset.action;if(action==='date-today'){start.value=isoDate(new Date());update();}if(action==='date-copy')result?copy(result,root):app.toast('Проверьте даты');},cleanups);update();
  }

  function randomIndex(max) {
    if(!globalThis.crypto?.getRandomValues)throw new Error('В этом браузере недоступен безопасный генератор. Откройте портал в современном браузере.');
    const limit=Math.floor(4294967296/max)*max;const buf=new Uint32Array(1);let value;do{crypto.getRandomValues(buf);value=buf[0];}while(value>=limit);return value%max;
  }
  function passwordView() {
    return workspace('password','Пароль, который не угадать','МАЛЕНЬКАЯ ПОЛЕЗНАЯ ПРИВЫЧКА', `<div class="tools-password-wrap"><input id="tools-password" class="tools-password" readonly type="text" autocomplete="off" spellcheck="false" aria-label="Сгенерированный пароль"><button type="button" class="icon-btn" data-action="password-regenerate" aria-label="Создать другой пароль">${icon('refresh',21)}</button></div><div class="tools-strength"><span></span><span></span><span></span><span></span><strong id="tools-strength-label"></strong></div><div class="tools-range-head"><label for="tools-password-length">Длина пароля</label><output id="tools-password-length-value">20 символов</output></div><input id="tools-password-length" class="tools-range" type="range" min="8" max="64" value="20"><div class="tools-range-ends"><span>8</span><span>64</span></div><div class="tools-check-grid"><label class="tools-check"><input type="checkbox" data-charclass="upper" checked><span>Прописные <b>A–Z</b></span></label><label class="tools-check"><input type="checkbox" data-charclass="lower" checked><span>Строчные <b>a–z</b></span></label><label class="tools-check"><input type="checkbox" data-charclass="digits" checked><span>Цифры <b>0–9</b></span></label><label class="tools-check"><input type="checkbox" data-charclass="symbols" checked><span>Символы <b>!@#$</b></span></label></div><label class="tools-check tools-similar"><input type="checkbox" id="tools-password-exclude" checked><span>Без похожих символов: O, 0, I, l, 1</span></label><div class="tools-actions">${button('password-copy','Скопировать пароль','copy','primary')}${button('password-toggle','Скрыть','shield')}</div>`, context('Один сервис — один пароль','Длинный случайный пароль лучше запоминающейся комбинации. Сохраните его в менеджере паролей.', `<div class="tools-hint"><b>Включены все выбранные наборы.</b><br>Каждый пароль содержит хотя бы один символ из каждой отмеченной группы.</div><div class="tools-context-foot">Пароли не сохраняются в истории портала. Генерация использует криптографический источник случайности браузера.</div>`));
  }
  function mountPassword(root, cleanups) {
    const output=root.querySelector('#tools-password'),length=root.querySelector('#tools-password-length');
    const classes={upper:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',lower:'abcdefghijklmnopqrstuvwxyz',digits:'0123456789',symbols:'!@#$%&*+-_=?:.'};
    function generate(){try{const n=Number(length.value);const exclude=root.querySelector('#tools-password-exclude').checked;const groups=[...root.querySelectorAll('[data-charclass]:checked')].map(el=>classes[el.dataset.charclass]).map(s=>exclude?s.replace(/[O0Il1]/g,''):s);if(!groups.length)throw new Error('Выберите хотя бы один набор символов.');const pool=groups.join('');const chars=groups.map(g=>g[randomIndex(g.length)]);while(chars.length<n)chars.push(pool[randomIndex(pool.length)]);for(let i=chars.length-1;i>0;i--){const j=randomIndex(i+1);[chars[i],chars[j]]=[chars[j],chars[i]];}output.value=chars.join('');root.querySelector('#tools-password-length-value').textContent=`${n} ${plural(n,['символ','символа','символов'])}`;const bits=n*Math.log2(pool.length);const level=bits>=90?4:bits>=65?3:bits>=45?2:1;root.querySelectorAll('.tools-strength>span').forEach((el,i)=>{el.classList.toggle('is-filled',i<level);el.classList.toggle('is-low',level<3);});root.querySelector('#tools-strength-label').textContent=level>=4?'Большой запас':level===3?'Хорошая длина':'Лучше сделать длиннее';error(root);}catch(err){output.value='';root.querySelector('#tools-strength-label').textContent='';root.querySelectorAll('.tools-strength>span').forEach(el=>el.classList.remove('is-filled'));error(root,err.message);}}
    listen(root,'input',ev=>{if(ev.target!==output)generate();},cleanups);listen(root,'click',ev=>{const button=ev.target.closest('[data-action]');const action=button?.dataset.action;if(action==='password-regenerate')generate();if(action==='password-copy')output.value?copy(output.value,root):app.toast('Сначала выберите набор символов');if(action==='password-toggle'){output.type=output.type==='password'?'text':'password';button.querySelector('span').textContent=output.type==='password'?'Показать':'Скрыть';}},cleanups);generate();
  }

  const jsonExample='{"name":"AYYY","idea":"Ваш маяк в интернете","services":["Поиск","Погода","Инструменты"],"localFirst":true,"version":1}';
  function jsonView() {
    return workspace('json','Красивый и правильный JSON','ДЛЯ ТЕХ, КТО СТРОИТ', `<div class="tools-actions tools-actions-top">${button('json-format','Форматировать','code','primary')}${button('json-minify','Сжать',null)}${button('json-example','Пример','refresh','soft')}</div><label class="tools-input-label" for="tools-json">Ваш JSON</label><textarea id="tools-json" class="tools-code-editor" rows="14" spellcheck="false" autocomplete="off">${e(jsonExample)}</textarea><div class="tools-editor-foot"><span id="tools-json-status">Готов к проверке</span><span id="tools-json-stats"></span></div><div class="tools-actions">${button('json-copy','Скопировать','copy')}${button('json-download','Скачать .json','download')}</div>`, context('Читается с первого взгляда','Добавьте отступы для чтения, уберите лишние пробелы для передачи или быстро найдите ошибку синтаксиса.', `<div class="tools-hint"><b>Без округления чисел.</b><br>При форматировании сохраняется исходная запись даже очень больших чисел.</div><div class="tools-context-foot">До 1 МБ и 100 уровней вложенности. Содержимое редактора не сохраняется после ухода со страницы.</div>`));
  }
  function formatJSON(raw, pretty = true) {
    if(raw.length>1048576 || new TextEncoder().encode(raw).length>1048576)throw new Error('Максимальный размер — 1 МБ текста.');
    JSON.parse(raw);
    const tokens=raw.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)||[];
    let checkDepth=0;for(const token of tokens){if(token==='{'||token==='['){if(++checkDepth>100)throw new Error('Максимум — 100 уровней вложенности.');}else if(token==='}'||token===']')checkDepth--;}
    if(!pretty)return tokens.join('');
    let level=0,out='';
    tokens.forEach((t,i)=>{
      if(t==='{'||t==='['){out+=t;if(!((t==='{'&&tokens[i+1]==='}')||(t==='['&&tokens[i+1]===']'))){if(++level>100)throw new Error('Максимум — 100 уровней вложенности.');out+='\n'+'  '.repeat(level);}}
      else if(t==='}'||t===']'){if(!((t==='}'&&tokens[i-1]==='{')||(t===']'&&tokens[i-1]==='['))){level--;out+='\n'+'  '.repeat(level);}out+=t;}
      else if(t===',')out+=',\n'+'  '.repeat(level);
      else if(t===':')out+=': ';
      else out+=t;
    });return out;
  }
  function mountJSON(root, cleanups) {
    const editor=root.querySelector('#tools-json'),status=root.querySelector('#tools-json-status');
    function stats(){root.querySelector('#tools-json-stats').textContent=`${format(editor.value.length)} зн. · ${format(editor.value.split('\n').length)} строк`;}function transform(pretty){try{editor.value=formatJSON(editor.value,pretty);status.textContent='✓ Корректный JSON';status.className='tools-valid';error(root);stats();return true;}catch(err){status.textContent='Проверьте синтаксис';status.className='';error(root,`JSON: ${err.message}`);return false;}}
    listen(editor,'input',()=>{status.textContent='Изменён · проверьте форматирование';status.className='';error(root);stats();},cleanups);
    listen(editor,'keydown',ev=>{if(ev.key==='Tab'){ev.preventDefault();editor.setRangeText('  ',editor.selectionStart,editor.selectionEnd,'end');stats();}},cleanups);
    listen(root,'click',ev=>{const action=ev.target.closest('[data-action]')?.dataset.action;if(action==='json-format')transform(true);if(action==='json-minify')transform(false);if(action==='json-example'){editor.value=jsonExample;transform(true);}if(action==='json-copy')copy(editor.value,root);if(action==='json-download'){if(transform(true))app.download('ayyy-data.json',editor.value,'application/json;charset=utf-8');}},cleanups);transform(true);
  }

  const textExample='Ваш маяк в интернете.\n\nЗдесь можно найти нужное, посчитать сложное и сохранить важное. А потом немного поиграть.';
  function textView() {
    return workspace('text','Немного заботы о тексте','СЛОВА НА СВОИХ МЕСТАХ', `<div class="tools-text-stats"><div><strong id="tools-text-words">0</strong><span>слов</span></div><div><strong id="tools-text-chars">0</strong><span>символов</span></div><div><strong id="tools-text-clean">0</strong><span>без пробелов</span></div><div><strong id="tools-text-reading">0</strong><span>на чтение</span></div></div><label class="tools-input-label" for="tools-text">Ваш текст</label><textarea id="tools-text" class="tools-text-editor" rows="9" placeholder="Напишите или вставьте текст…">${e(textExample)}</textarea><div class="tools-text-transforms"><button type="button" data-text-action="upper">АА <span>ВЕРХНИЙ</span></button><button type="button" data-text-action="lower">аа <span>нижний</span></button><button type="button" data-text-action="sentence">Аа <span>Предложения</span></button><button type="button" data-text-action="spaces">↔ <span>Пробелы</span></button><button type="button" data-text-action="duplicates">≠ <span>Без повторов строк</span></button></div><div class="tools-editor-foot"><span id="tools-text-status">Готов к работе</span><button type="button" class="tools-text-btn" data-text-action="undo" disabled>Отменить правку</button></div><div class="tools-actions">${button('text-copy','Скопировать','copy','primary')}${button('text-download','Скачать .txt','download')}</div>`, context('Сосредоточьтесь на содержании','Счётчик обновляется, пока вы печатаете. Приведите регистр в порядок и уберите лишние пробелы одним нажатием.', `<div class="tools-hint">«Без повторов строк» оставляет первое вхождение каждой строки. Регистр учитывается.</div><div class="tools-context-foot">Время чтения приблизительное: 220 слов в минуту. Символы считаются по кодовым точкам Unicode.</div>`));
  }
  function mountText(root, cleanups) {
    const input=root.querySelector('#tools-text');const history=[];
    function stats(){const words=(input.value.match(/[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu)||[]).length;root.querySelector('#tools-text-words').textContent=format(words);root.querySelector('#tools-text-chars').textContent=format(Array.from(input.value).length);root.querySelector('#tools-text-clean').textContent=format(Array.from(input.value.replace(/\s/g,'')).length);root.querySelector('#tools-text-reading').textContent=words===0?'0 мин':words<220?'< 1 мин':`${Math.ceil(words/220)} мин`;root.querySelector('[data-text-action="undo"]').disabled=!history.length;}
    listen(input,'input',()=>{stats();root.querySelector('#tools-text-status').textContent='Все изменения — только в этом редакторе';},cleanups);
    listen(root,'click',ev=>{const action=ev.target.closest('[data-text-action]')?.dataset.textAction;if(action){if(action==='undo'){if(history.length){input.value=history.pop();root.querySelector('#tools-text-status').textContent='Предыдущий текст восстановлен';}}else{const before=input.value;let after=before;const names={upper:'Верхний регистр',lower:'Нижний регистр',sentence:'Регистр предложений',spaces:'Лишние пробелы убраны',duplicates:'Повторяющиеся строки удалены'};if(action==='upper')after=before.toLocaleUpperCase('ru');if(action==='lower')after=before.toLocaleLowerCase('ru');if(action==='sentence')after=before.toLocaleLowerCase('ru').replace(/(^\s*|[.!?]\s+)([\p{L}])/gu,(_,p,l)=>p+l.toLocaleUpperCase('ru'));if(action==='spaces')after=before.replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim();if(action==='duplicates')after=[...new Set(before.split(/\r?\n/))].join('\n');if(after!==before){history.push(before);if(history.length>10)history.shift();input.value=after;}root.querySelector('#tools-text-status').textContent=names[action]||'Готово';}stats();}const command=ev.target.closest('[data-action]')?.dataset.action;if(command==='text-copy')copy(input.value,root);if(command==='text-download')app.download('ayyy-text.txt',input.value,'text/plain;charset=utf-8');},cleanups);stats();
  }

  function rgbToHsl(r,g,b) {r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0,s=0;const l=(max+min)/2;if(d){s=d/(1-Math.abs(2*l-1));h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360;}return [Math.round(h),Math.round(s*100),Math.round(l*100)];}
  function hslToHex(h,s,l){s/=100;l/=100;const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;const vals=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return '#'+vals.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('').toUpperCase();}
  function colorView() {
    return workspace('color','Найдите свой оттенок','ЦВЕТ И СМЫСЛ', `<div class="tools-color-top"><label class="tools-color-picker-label"><input type="color" id="tools-color-picker" value="#3767e8" aria-label="Выбрать цвет"><span>Выбрать цвет</span></label><div class="tools-color-values"><label><span>HEX</span><input class="field" id="tools-color-hex" value="#3767E8" maxlength="7" spellcheck="false" autocomplete="off"></label><button type="button" data-color-copy="rgb"><span>RGB</span><strong id="tools-color-rgb"></strong>${icon('copy',16)}</button><button type="button" data-color-copy="hsl"><span>HSL</span><strong id="tools-color-hsl"></strong>${icon('copy',16)}</button></div></div><div class="tools-rgb-sliders">${['R','G','B'].map((c,i)=>`<label><span>${c}</span><input type="range" min="0" max="255" value="${[55,103,232][i]}" data-rgb="${i}" aria-label="${['Красный','Зелёный','Синий'][i]} канал"><output id="tools-rgb-${i}">${[55,103,232][i]}</output></label>`).join('')}</div><div class="tools-subheading"><h3>Созвучная палитра</h3><span class="muted small">Нажмите на оттенок</span></div><div class="tools-palette" id="tools-color-palette"></div><div class="tools-actions">${button('color-copy','Скопировать HEX','copy','primary')}${button('color-download','Палитра в CSS','download')}</div>`, context('Красиво и читаемо','Проверяем выбранный фон с белым и чёрным текстом. Для обычного текста уровень AA требует контраст от 4,5 : 1.', `<div class="tools-contrast-card" id="tools-contrast-white"><div><b>Aa</b><span>Белый текст</span></div><strong id="tools-white-ratio"></strong></div><div class="tools-contrast-card" id="tools-contrast-black"><div><b>Aa</b><span>Чёрный текст</span></div><strong id="tools-black-ratio"></strong></div><div class="tools-context-foot">Расчёт по относительной яркости sRGB, WCAG 2.x. Прозрачность здесь не учитывается.</div>`));
  }
  function mountColor(root, cleanups) {
    let current='#3767E8';let values={};let palette=[];const hexInput=root.querySelector('#tools-color-hex'),picker=root.querySelector('#tools-color-picker');
    function update(hex,fromText=false){const raw=hex.trim().replace(/^#/,'');if(!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)){error(root,'Цвет должен быть в формате #RGB или #RRGGBB.');return;}current='#'+(raw.length===3?raw.split('').map(c=>c+c).join(''):raw).toUpperCase();const rgb=[1,3,5].map(i=>parseInt(current.slice(i,i+2),16));const hsl=rgbToHsl(...rgb);values={rgb:`rgb(${rgb.join(', ')})`,hsl:`hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`};if(!fromText)hexInput.value=current;picker.value=current.toLowerCase();root.querySelector('#tools-color-rgb').textContent=values.rgb;root.querySelector('#tools-color-hsl').textContent=values.hsl;rgb.forEach((v,i)=>{root.querySelector(`[data-rgb="${i}"]`).value=String(v);root.querySelector(`#tools-rgb-${i}`).textContent=String(v);});const channels=rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);const luminance=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;const white=1.05/(luminance+.05),black=(luminance+.05)/.05;[['white',white],['black',black]].forEach(([name,ratio])=>{root.querySelector(`#tools-contrast-${name}`).style.background=current;root.querySelector(`#tools-${name}-ratio`).textContent=`${ratio.toFixed(2)} : 1 · ${ratio>=7?'AAA':ratio>=4.5?'AA':'ниже AA'}`;});palette=[hslToHex(hsl[0],Math.min(hsl[1],90),95),current,hslToHex((hsl[0]+30)%360,hsl[1],Math.min(65,hsl[2]+7)),hslToHex((hsl[0]+180)%360,hsl[1],hsl[2]),hslToHex(hsl[0],Math.min(hsl[1],55),20)];root.querySelector('#tools-color-palette').innerHTML=palette.map(color=>`<button type="button" data-palette="${color}" aria-label="Выбрать ${color}"><i style="background:${color}"></i><span>${color}</span></button>`).join('');error(root);}
    listen(picker,'input',()=>update(picker.value),cleanups);listen(hexInput,'input',()=>update(hexInput.value,true),cleanups);listen(hexInput,'blur',()=>{if(!root.querySelector('#tools-error').textContent)hexInput.value=current;},cleanups);
    listen(root,'input',ev=>{if(ev.target.matches('[data-rgb]')){const vals=[...root.querySelectorAll('[data-rgb]')].map(el=>Number(el.value));update('#'+vals.map(v=>v.toString(16).padStart(2,'0')).join(''));}},cleanups);
    listen(root,'click',ev=>{const swatch=ev.target.closest('[data-palette]');if(swatch)update(swatch.dataset.palette);const colorCopy=ev.target.closest('[data-color-copy]');if(colorCopy)copy(values[colorCopy.dataset.colorCopy],root);const action=ev.target.closest('[data-action]')?.dataset.action;if(action==='color-copy')copy(current,root);if(action==='color-download')app.download('ayyy-palette.css',`:root {\n${palette.map((c,i)=>`  --color-${['surface','accent','secondary','complement','ink'][i]}: ${c};`).join('\n')}\n}\n`,'text/css;charset=utf-8');},cleanups);update(current);
  }

  const views={calc:calcView,percent:percentView,converter:converterView,dates:datesView,password:passwordView,json:jsonView,text:textView,color:colorView};
  const mounts={calc:mountCalc,percent:mountPercent,converter:mountConverter,dates:mountDates,password:mountPassword,json:mountJSON,text:mountText,color:mountColor};
  const selected = () => Object.hasOwn(views,app.param) ? app.param : 'calc';
  app.register('tools', {
    title:'Инструменты',
    render() {const active=selected();return `<div class="tools-root"><div class="tools-heading"><div><div class="tools-overline">ПОД РУКОЙ</div><h1>Для маленьких больших задач<span>.</span></h1><p class="muted">Посчитать, преобразовать, проверить. Просто откройте нужный инструмент.</p></div><span class="tools-offline">${icon('shield',16)} 8 инструментов · без сети</span></div><nav class="tools-catalog" aria-label="Выбор инструмента">${catalog.map(t=>`<button type="button" data-tool="${t.id}" class="tools-tile ${t.id===active?'is-active':''}" aria-pressed="${t.id===active}"><span class="tools-tile-icon tools-tone-${t.tone}">${icon(t.icon,21)}</span><span><strong>${t.title}</strong><small>${t.note}</small></span>${t.id===active?'<i class="tools-active-dot"></i>':''}</button>`).join('')}</nav>${views[active]()}</div>`;},
    mount(){const root=document.querySelector('#view .tools-root');if(!root)return;const cleanups=[];listen(root,'click',ev=>{const tile=ev.target.closest('[data-tool]');if(tile)app.navigate('tools',tile.dataset.tool);},cleanups);mounts[selected()](root,cleanups);return ()=>cleanups.forEach(fn=>fn());}
  });
})();
