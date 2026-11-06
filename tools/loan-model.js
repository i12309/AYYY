/* AYYY Loans · deterministic local amortization, calendar events and cent rounding. */
(function(root){
  'use strict';
  const DAY=86400000;
  const money=n=>Math.round((n+Number.EPSILON)*100)/100;
  function fail(message){throw new Error(message);}
  function number(value,name,min,max){const n=Number(value);if(value===''||value===null||typeof value==='boolean'||!Number.isFinite(n)||n<min||n>max)fail('Проверьте '+name+'.');return n;}
  function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('Дата должна быть в формате ГГГГ-ММ-ДД.');const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==value||d.getUTCFullYear()<1900||d.getUTCFullYear()>2200)fail('Некорректная дата: '+value);return +d;}
  const iso=t=>new Date(t).toISOString().slice(0,10);
  function addMonths(value,n){const t=typeof value==='number'?value:date(value),d=new Date(t),day=d.getUTCDate();const y=d.getUTCFullYear(),m=d.getUTCMonth()+n;const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return Date.UTC(y,m,Math.min(day,last));}
  function normalize(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('Неверный сценарий.');
    const c={principal:money(number(raw.principal,'сумму кредита',1,1e10)),rate:number(raw.rate,'ставку (0–100%)',0,100),months:number(raw.months,'срок (1–600 месяцев)',1,600),start:raw.start,first:raw.first,type:raw.type||'annuity',basis:raw.basis||'monthly',strategy:raw.strategy||'term',upfront:money(number(raw.upfront??0,'разовую комиссию',0,1e9)),monthlyFee:money(number(raw.monthlyFee??0,'ежемесячные расходы',0,1e8)),extras:[],rates:[]};
    if(!Number.isInteger(c.months))fail('Срок должен быть целым числом месяцев.');
    if(!['annuity','differential'].includes(c.type)||!['monthly','act365','actual'].includes(c.basis)||!['term','payment'].includes(c.strategy))fail('Неизвестная модель расчёта.');
    const start=date(c.start),first=date(c.first);if(first<=start||first-start>62*DAY)fail('Первый платёж: позже выдачи, но не более чем через 62 дня.');
    const maturity=addMonths(first,c.months-1);
    if(new Date(maturity).getUTCFullYear()>2200)fail('Дата окончания позже 2200 года.');
    if(!Array.isArray(raw.extras||[])||(raw.extras||[]).length>300||!Array.isArray(raw.rates||[])||(raw.rates||[]).length>100)fail('Слишком много событий.');
    c.extras=(raw.extras||[]).map((x,i)=>{
      if(!x||typeof x!=='object')fail('Некорректный досрочный платёж.');
      const t=date(x.date);if(t<start||t>maturity)fail('Досрочный взнос должен попадать в срок кредита.');
      const strategy=x.strategy||c.strategy;if(!['term','payment'].includes(strategy))fail('Неизвестный способ пересчёта.');
      return {date:iso(t),amount:money(number(x.amount,'досрочный взнос',.01,1e10)),strategy,id:String(x.id||'extra-'+i).slice(0,80)};
    });
    c.rates=(raw.rates||[]).map(x=>{const t=date(x.date);if(t<start||t>maturity)fail('Изменение ставки должно попадать в срок кредита.');return {date:iso(t),rate:number(x.rate,'новую ставку',0,100)};});
    const seen=new Set();c.rates.forEach(x=>{if(seen.has(x.date))fail('Две ставки на одну дату.');seen.add(x.date);});
    if(raw.repeat&&(typeof raw.repeat!=='object'||Array.isArray(raw.repeat)))fail('Некорректный регулярный взнос.');
    if(raw.repeat)number(raw.repeat.amount,'регулярный взнос',0,1e10);
    if(raw.repeat&&Number(raw.repeat.amount)>0){
      const r=raw.repeat,from=date(r.from),to=date(r.to),every=number(r.every??1,'период повторения',1,12);
      if(!Number.isInteger(every)||from<start||to<from||to>maturity)fail('Проверьте даты и период повторяющегося взноса.');
      const amount=money(number(r.amount,'повторяющийся взнос',.01,1e10));
      c.repeat={amount,from:iso(from),to:iso(to),every};
    } else c.repeat=null;
    return c;
  }
  function factor(from,to,rate,basis,periodStart,periodEnd){
    if(to<=from)return 0;
    if(basis==='monthly')return rate/1200*(to-from)/(periodEnd-periodStart);
    if(basis==='act365')return rate/100*(to-from)/DAY/365;
    let result=0,t=from;while(t<to){const year=new Date(t).getUTCFullYear(),end=Math.min(to,Date.UTC(year+1,0,1)),yearDays=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/DAY;result+=rate/100*((end-t)/DAY)/yearDays;t=end;}return result;
  }
  function level(balance,accrued,from,rate,c,dates){
    let discount=1,sum=0,firstDiscount=1,last=from;
    const first=dates.findIndex(t=>t>from);
    if(first<0)return money(balance+accrued);
    for(let ix=first;ix<dates.length;ix++){
      const k=ix-first,end=dates[ix],periodStart=ix?dates[ix-1]:date(c.start);
      discount*=1+factor(last,end,rate,c.basis,periodStart,end);if(!k)firstDiscount=discount;sum+=1/discount;last=end;
    }
    return money((balance+accrued/firstDiscount)/sum);
  }
  function simulate(raw,withoutExtras=false){
    const c=normalize(raw),start=date(c.start),first=date(c.first),dates=Array.from({length:c.months},(_,i)=>addMonths(first,i));
    const maturity=dates.at(-1),events=dates.map((t,i)=>({t,kind:'due',index:i,priority:1}));
    for(const r of c.rates)events.push({t:date(r.date),kind:'rate',rate:r.rate,priority:0});
    if(!withoutExtras){
      for(const x of c.extras)events.push({t:date(x.date),kind:'extra',amount:x.amount,strategy:x.strategy,priority:2});
      if(c.repeat)for(let k=0;k<600;k++){const t=addMonths(c.repeat.from,k*c.repeat.every);if(t>date(c.repeat.to))break;events.push({t,kind:'extra',amount:c.repeat.amount,strategy:c.strategy,priority:2});}
    }
    events.sort((a,b)=>a.t-b.t||a.priority-b.priority);
    let balance=c.principal,accrued=0,rate=c.rate,last=start,periodIndex=0;
    let payment=level(balance,0,start,rate,c,dates),principalStep=money(balance/c.months),paidInterest=0,paidPrincipal=0,extraTotal=0,fees=c.upfront,dueCount=0;
    const rows=[],warnings=[];let finish=maturity;
    const record=(event,interest,principal,extra,fee)=>{
      const total=money(interest+principal+extra+fee);paidInterest=money(paidInterest+interest);paidPrincipal=money(paidPrincipal+principal+extra);extraTotal=money(extraTotal+extra);fees=money(fees+fee);
      rows.push({date:iso(event.t),kind:event.kind,number:dueCount,rate,payment:total,principal:money(principal),extra:money(extra),interest:money(interest),fee,balance:money(balance),interestToDate:paidInterest});
    };
    for(const ev of events){
      if(balance<=0)break;
      while(periodIndex<dates.length-1&&dates[periodIndex]<ev.t)periodIndex++;
      const periodStart=periodIndex?dates[periodIndex-1]:start;
      accrued+=balance*factor(last,ev.t,rate,c.basis,periodStart,dates[periodIndex]);last=ev.t;
      if(ev.kind==='rate'){
        rate=ev.rate;const includeToday=dates.includes(ev.t);
        // Reprice after a same-day scheduled installment; the current interest uses the old rate.
        if(!includeToday)payment=level(balance,accrued,ev.t,rate,c,dates);
        continue;
      }
      if(ev.kind==='due'){
        dueCount++;const interest=money(accrued);let principal;
        if(c.type==='annuity'){if(payment<interest&&ev.index<c.months-1)fail('Платёж меньше процентов. Выберите снижение платежа или проверьте ставку.');principal=money(Math.max(0,payment-interest));}
        else principal=principalStep;
        if(ev.index===c.months-1)principal=balance;
        principal=Math.min(balance,principal);balance=money(balance-principal);accrued=0;
        record(ev,interest,principal,0,c.monthlyFee);
        if(c.rates.some(r=>date(r.date)===ev.t))payment=level(balance,0,ev.t,rate,c,dates);
      } else {
        const extra=Math.min(balance,ev.amount);if(extra<ev.amount)warnings.push('Взнос '+iso(ev.t)+' ограничен остатком долга.');
        balance=money(balance-extra);
        const interest=balance===0?money(accrued):0;
        if(balance===0)accrued=0;
        record(ev,interest,0,extra,0);
        if(balance>0&&ev.strategy==='payment'){
          const remaining=dates.filter(t=>t>ev.t).length;
          payment=level(balance,accrued,ev.t,rate,c,dates);principalStep=remaining?money(balance/remaining):balance;
        }
      }
      if(balance===0){finish=ev.t;break;}
    }
    const unused=events.filter(x=>x.kind==='extra'&&x.t>finish).length;
    if(unused)warnings.push('После закрытия кредита не применено взносов: '+unused+'.');
    const firstDue=rows.find(r=>r.kind==='due');
    return {config:c,rows,principal:c.principal,interest:paidInterest,fees,total:money(paidPrincipal+paidInterest+fees),extras:extraTotal,balance,finish:iso(finish),dueCount,firstPayment:firstDue?money(firstDue.payment-firstDue.fee):0,warnings:[...new Set(warnings)]};
  }
  function calculate(raw){const plan=simulate(raw),base=simulate(raw,true);return {plan,base,savedInterest:money(base.interest-plan.interest),savedTotal:money(base.total-plan.total),savedMonths:base.dueCount-plan.dueCount};}
  function csv(result){const header=['Дата','Событие','Платёж','Основной долг','Досрочно','Проценты','Расходы','Остаток','Ставка'];const rows=result.rows.map(r=>[r.date,r.kind==='due'?'По графику':'Досрочно',r.payment,r.principal,r.extra,r.interest,r.fee,r.balance,r.rate]);return '\ufeff'+[header,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');}
  const api={money,date,iso,addMonths,factor,normalize,simulate,calculate,csv};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.AYYYLoans=api;
})(typeof window==='undefined'?globalThis:window);
