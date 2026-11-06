/* Approved visual layout. Presentation-only: every number comes from AYYYLoans.
   The mount wrapper is disposed together with the original loan workspace. */
(function(root){
 'use strict';
 const U=root.AYYYCity,A=U.A,L=root.AYYYLoans,e=U.escape;
 const original=U.mountLoan;
 U.mountLoan=function(host){
  const dispose=original(host);
  let alive=true,observer,latest=null;
  const currency={RUB:'₽',USD:'$',EUR:'€'};
  const cash=(n,c)=>U.fmt(n,0)+' '+(currency[c]||c);
  function polish(){
   if(!alive||!host.isConnected)return;
   observer?.disconnect();
   try{
    const out=host.querySelector('#loan-output'),visual=out?.querySelector('.city-loan-visual');
    // Mode changes rebuild the original form. Move the same controls, never clones.
    const panel=host.querySelector('.city-parameters'),form=host.querySelector('#loan-form');
    if(panel&&form&&!panel.dataset.approved){
     panel.dataset.approved='true';
     const title=panel.querySelector('.city-panel-title'),segment=panel.querySelector('.city-segment');
     title.querySelector('.city-small-tag')?.remove();title.append(segment);
     const type=form.elements.type.closest('.city-field'),cur=form.elements.currency.closest('.city-field');
     cur.querySelector('span').textContent='Валюта';
     for(const option of form.elements.currency.options)option.textContent=(currency[option.value]||option.value)+' ('+option.value+')';
     const grid=document.createElement('div');grid.className='city-form-grid city-payment-grid';
     type.before(grid);grid.append(type,cur);
     const details=form.querySelector('.city-details');
     details.querySelector('summary').after(form.elements.strategy.closest('.city-field'));
    }
    // Format monetary inputs visually while preserving their native numeric values.
    host.querySelectorAll('input[name="price"],input[name="down"],input[name="principal"],input[data-extra-field="amount"]').forEach(input=>{
     const wrap=input.parentElement;if(!wrap.classList.contains('city-input-wrap'))return;
     let display=wrap.querySelector('.city-number-display');
     if(!display){display=document.createElement('span');display.className='city-number-display';display.setAttribute('aria-hidden','true');wrap.append(display);wrap.classList.add('city-formatted-number');}
     display.textContent=input.value===''?'':U.fmt(Number(input.value),2);
    });
    if(!visual||out.hidden)return;
    const state=A.get('city.loan',null);let result=null;latest=null;
    try{if(state)result=L.calculate(state);}catch{}
    if(result){const values=[...out.querySelectorAll('.city-kpi strong')].map(n=>n.textContent.trim());
     if(values[0]!==cash(result.plan.firstPayment,state.currency)||values[1]!==cash(result.plan.interest,state.currency)||values[2]!==cash(result.savedInterest,state.currency))result=null;
    }
    if(result)latest={state,result};
    if(!visual.dataset.approved){
    const warning=visual.querySelector('.city-warning');
    visual.dataset.approved='true';
    const title=visual.querySelector('.city-panel-title'),split=visual.querySelector('.city-chart-split');
    const chart=split.firstElementChild,cost=split.lastElementChild;
    const card=document.createElement('section');card.className='city-panel city-chart-card';
    visual.replaceChildren(card,cost);card.append(title,chart);split.remove();
    cost.className='city-panel city-cost-summary';
    cost.querySelector('.city-eyebrow').outerHTML='<h2>Структура затрат</h2>';
    const total=document.createElement('div');total.className='city-cost-total';
    if(result){total.innerHTML='<span>Итого</span><strong>'+e(cash(result.plan.total,state.currency))+'</strong>';cost.querySelector('dl').append(total);}
    // A broad chart uses the full card width instead of a tiny centered SVG.
    const svg=card.querySelector('svg.city-chart');
    if(svg){
     svg.setAttribute('preserveAspectRatio','none');
     const paths=svg.querySelectorAll('g[clip-path] > path');
     const path=paths[paths.length-1];
     if(path){
      const defs=svg.querySelector('defs');
      const grad=document.createElementNS('http://www.w3.org/2000/svg','linearGradient');
      grad.id='loan-approved-fill';grad.setAttribute('x1','0');grad.setAttribute('y1','0');grad.setAttribute('x2','0');grad.setAttribute('y2','1');
      grad.innerHTML='<stop stop-color="#8bb8d4" stop-opacity=".24"/><stop offset="1" stop-color="#8bb8d4" stop-opacity=".03"/>';defs.append(grad);
      const area=path.cloneNode();area.setAttribute('d',path.getAttribute('d')+' L780,214 L53,214 Z');area.setAttribute('stroke','none');area.setAttribute('fill','url(#loan-approved-fill)');path.before(area);
     }
    }
    const holder=card.querySelector('#loan-chart');
    holder.insertAdjacentHTML('beforeend','<div class="city-chart-tooltip" hidden></div>');
    if(warning)card.append(warning);
    }
    out.querySelector('.city-reference-bottom')?.remove();
    // Never display stale supplemental financial figures when browser storage fails.
    if(!result)return;
    const p=result.plan,b=result.base;
    const quick=document.createElement('div');quick.className='city-reference-bottom';
    let saved=A.get('city.scenarios',[]);saved=Array.isArray(saved)?saved:[];
    const rows=[{name:'Базовый',note:'Без досрочных платежей',plan:b},{name:'Ваш план',note:p.extras?'Досрочно: '+cash(p.extras,state.currency):'Текущие условия',plan:p,current:true},...saved.slice(0,2).flatMap((s,index)=>{try{return s.data.currency===state.currency?[{name:s.name,note:'Сохранённый сценарий',plan:L.calculate(s.data).plan,index}]:[];}catch{return [];}})];
    quick.innerHTML='<section class="city-panel city-quick-scenarios"><div class="city-panel-title"><h2>Сценарии и досрочное погашение</h2><button type="button" data-quick-scenarios>Все сценарии '+A.icon('arrow-right',14)+'</button></div><div class="city-quick-scroll"><table><thead><tr><th>Сценарий</th><th>Платёж</th><th>Платежей</th><th>Проценты</th></tr></thead><tbody>'+rows.map(row=>'<tr class="'+(row.current?'is-current':'')+'"><td><i class="city-scenario-dot" aria-hidden="true"></i><span>'+('<strong>'+e(row.name)+'</strong>')+'<small>'+e(row.note)+'</small></span></td><td>'+e(cash(row.plan.firstPayment,state.currency))+'</td><td>'+row.plan.dueCount+'</td><td>'+e(cash(row.plan.interest,state.currency))+'</td></tr>').join('')+'</tbody></table></div></section><section class="city-panel city-brief"><h2>'+A.icon('chart',16)+' Краткое резюме</h2><dl>'+[
     ['Сумма кредита',cash(p.principal,state.currency)],['Общая выплата',cash(p.total,state.currency)],['Доля процентов',U.fmt(p.interest/p.total*100,1)+'%'],['Дополнительные расходы',cash(p.fees,state.currency)],['Переплата к сумме кредита',U.fmt((p.total-p.principal)/p.principal*100,1)+'%']
    ].map(([label,value])=>'<div><dt>'+e(label)+'</dt><dd>'+e(value)+'</dd></div>').join('')+'</dl></section>';
    out.append(quick);

   }finally{if(alive)observer.observe(host,{childList:true,subtree:true});}
  }
  observer=new MutationObserver(records=>{if(records.some(r=>r.target===host||r.target.id==='loan-output'||r.target.id==='loan-tab-content'))polish();});
  const move=event=>{
   const svg=event.target.closest('#loan-chart svg');if(!svg)return;
   const tip=host.querySelector('.city-chart-tooltip');if(!tip)return;
   if(!latest)return;const cfg=latest.state;
   try{const result=latest.result,rect=svg.getBoundingClientRect();
    const x=Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*800-53)/727));
    const stamp=L.date(cfg.start)+x*(L.date(result.base.finish)-L.date(cfg.start));
    const row=result.plan.rows.findLast(r=>L.date(r.date)<=stamp);
    tip.innerHTML='<strong>'+e(U.date(L.iso(stamp)))+'</strong><span>Остаток: '+e(cash(row?.balance??cfg.principal,cfg.currency))+'</span><span>Проценты: '+e(cash(row?.interestToDate??0,cfg.currency))+'</span>';
    tip.hidden=false;tip.style.left=Math.max(4,Math.min(rect.width-230,event.clientX-rect.left+12))+'px';tip.style.top='14px';
   }catch{tip.hidden=true;}
  };
  const leave=event=>{if(event.target.closest('#loan-chart')&&!event.relatedTarget?.closest?.('#loan-chart')){const tip=host.querySelector('.city-chart-tooltip');if(tip)tip.hidden=true;}};
  const click=event=>{if(event.target.closest('[data-quick-scenarios]')){host.querySelector('.city-events [data-loan-tab="scenarios"]')?.click();host.querySelector('.city-events')?.scrollIntoView({behavior:'smooth',block:'nearest'});}};
  host.addEventListener('pointermove',move);host.addEventListener('pointerout',leave);host.addEventListener('click',click);
  polish();return ()=>{alive=false;observer.disconnect();host.removeEventListener('pointermove',move);host.removeEventListener('pointerout',leave);host.removeEventListener('click',click);dispose?.();};
 };
})(window);
