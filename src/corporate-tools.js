/* Corporate route replaces the tool surface, retaining tested utility behavior. */
(() => {
 'use strict';
 const A=window.AYYY,legacy=A.views.tools,e=A.escape;
 const tabs=[['loan','Ипотека и кредит','home'],['science','Инженерный','calculator'],['percent','Проценты','percent'],['converter','Конвертер','ruler'],['dates','Даты','calendar'],['password','Пароли','lock'],['json','JSON','code'],['text','Текст','type'],['color','Цвета','paint']];
 const selected=()=>A.param==='calc'?'science':tabs.some(t=>t[0]===A.param)?A.param:'loan';
 const oldCalc=A.services.find(s=>s.id==='calc');if(oldCalc)Object.assign(oldCalc,{name:'Инженерный калькулятор',desc:'Функции, графики, численные методы',param:'science'});
 if(!A.services.some(s=>s.id==='loan')){const ix=A.services.findIndex(s=>s.id==='calc');A.services.splice(ix,0,{id:'loan',name:'Ипотека и кредит',desc:'График, досрочные взносы и сценарии',icon:'home',color:'blue',group:'tools',kind:'local',route:'tools',param:'loan'});}
 document.querySelectorAll('.nav-count').forEach(x=>x.textContent=A.services.length);
 A.register('tools',{
  title:'Финансы и инженерия',
  render(){const active=selected();return `<div class="city-stage"><div class="city-illustration" aria-hidden="true"><div class="city-illustration-side"><img src="tools/assets/tower.svg" alt="" decoding="async"></div><div class="city-illustration-horizon"><img src="tools/assets/horizon.svg" alt="" decoding="async"></div></div><header class="city-global-header"><a class="city-brand" href="#home" aria-label="AYYY — главная">ayyy<span>.</span></a><span class="city-brand-label">ИНСТРУМЕНТЫ</span><nav aria-label="Навигация портала"><a href="#home">Главная</a><a href="#directory">Все сервисы ${A.icon('arrow-right',15)}</a></nav></header><main class="city-wrap"><section class="city-intro"><div><span class="city-eyebrow">AYYY / WORKSPACE</span><h2>Ясность в каждом расчёте.</h2><p>Финансовые решения и инженерная точность.</p></div><div class="city-intro-note"><span>${A.icon('shield',14)}Локальная обработка</span><span>09 инструментов</span></div></section><nav class="city-nav" aria-label="Выбор инструмента">${tabs.map(([id,title,icon],n)=>`<a href="#tools/${id}" class="${active===id?'active':''}" ${active===id?'aria-current="page"':''}>${A.icon(icon,17)}${title}<small>${String(n+1).padStart(2,'0')}</small></a>`).join('')}</nav><div id="city-workspace"></div><footer class="city-footer"><span>${A.icon('shield',13)} Расчёты остаются на вашем устройстве</span><span>AYYY · Финансы и инженерия / 2026</span></footer></main></div>`;},
  mount(){const stage=document.querySelector('.city-stage'),host=document.querySelector('#city-workspace'),active=selected();/* Artwork is loaded from local SVG files, no remote data. */
   document.querySelectorAll('.nav-count').forEach(x=>x.textContent=A.services.length);
   if(active==='loan')return window.AYYYCity.mountLoan(host);
   if(active==='science')return window.AYYYCity.mountScience(host);
   const wrapper=document.createElement('div');wrapper.innerHTML=legacy.render();const layout=wrapper.querySelector('.tools-layout');
   host.innerHTML=`<div class="city-section-head"><div><span class="city-eyebrow">AYYY / ПРИКЛАДНЫЕ ИНСТРУМЕНТЫ</span><h1>${e(tabs.find(t=>t[0]===active)[1])}</h1><p>Локальная обработка. Тот же рабочий процесс, новый интерфейс.</p></div></div><div class="tools-root city-legacy" data-tool-active="${active}"></div>`;
   if(layout)host.querySelector('.city-legacy').appendChild(layout);return legacy.mount();
  }
 });
})();
