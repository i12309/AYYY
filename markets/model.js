/* AYYY markets: daily reference rates, never fabricated OHLC or live quotes. */
(function(root){
  'use strict';
  const DAY=86400000, TTL=36*3600000, KEY='markets.history.v1';
  const currencies={RUB:['Российский рубль','₽'],USD:['Доллар США','$'],EUR:['Евро','€'],GBP:['Фунт стерлингов','£'],CNY:['Китайский юань','¥'],CHF:['Швейцарский франк','Fr'],JPY:['Японская иена','¥']};
  const instruments=[
    {id:'spx',name:'S&P 500',symbol:'SP:SPX',group:'index',description:'США · индекс'},
    {id:'ndx',name:'NASDAQ 100',symbol:'NASDAQ:NDX',group:'index',description:'США · индекс'},
    {id:'imoex',name:'Индекс Мосбиржи',symbol:'MOEX:IMOEX',group:'index',description:'Россия · индекс'},
    {id:'dax',name:'DAX',symbol:'XETR:DAX',group:'index',description:'Германия · индекс'},
    {id:'gold',name:'Золото',symbol:'OANDA:XAUUSD',group:'commodity',description:'XAU/USD · тройская унция'},
    {id:'silver',name:'Серебро',symbol:'OANDA:XAGUSD',group:'commodity',description:'XAG/USD · тройская унция'},
    {id:'oil',name:'Brent',symbol:'TVC:UKOIL',group:'commodity',description:'USD · баррель'}
  ];
  const dateKey=n=>new Date(n).toISOString().slice(0,10);
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&dateKey(Date.parse(s+'T12:00:00Z'))===s;
  const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<1e12;
  function parse(rows,now=Date.now()){
    if(!Array.isArray(rows)||rows.length>15000)throw new Error('Источник вернул неверную историю курсов.');
    const groups=new Map(),today=dateKey(now);
    for(const row of rows){
      const quote=String(row?.quote||'').toUpperCase();
      if(String(row?.base).toUpperCase()!=='RUB'||quote==='RUB'||!Object.hasOwn(currencies,quote)||!validDate(row.date)||row.date>today||!positive(row.rate))continue;
      const value=1/row.rate;if(!positive(value))continue;
      if(!groups.has(row.date))groups.set(row.date,{date:row.date,rates:{RUB:1}});
      groups.get(row.date).rates[quote]=value;
    }
    const days=[...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-500);
    if(days.length<2)throw new Error('Недостаточно наблюдений для графика. Сохранённая история не изменена.');
    return {version:1,source:'Frankfurter',updatedAt:now,days};
  }
  function valid(data,now=Date.now()){
    return !!data&&data.version===1&&data.source==='Frankfurter'&&Number.isFinite(data.updatedAt)&&data.updatedAt>0&&data.updatedAt<=now+60000&&Array.isArray(data.days)&&data.days.length>=2&&data.days.length<=500&&data.days.every((d,i)=>d&&validDate(d.date)&&d.date<=dateKey(now)&&d.rates&&d.rates.RUB===1&&Object.entries(d.rates).every(([c,v])=>Object.hasOwn(currencies,c)&&positive(v))&&(!i||d.date>data.days[i-1].date));
  }
  function series(data,base,quote,days=365){
    if(!data||!Object.hasOwn(currencies,base)||!Object.hasOwn(currencies,quote))return [];
    const all=data.days.filter(d=>positive(d.rates[base])&&positive(d.rates[quote])).map(d=>({date:d.date,value:d.rates[base]/d.rates[quote]}));
    if(!all.length)return [];
    const end=Date.parse(all[all.length-1].date+'T12:00:00Z'),start=end-Math.max(1,Math.min(500,days))*DAY;
    return all.filter(p=>Date.parse(p.date+'T12:00:00Z')>=start);
  }
  function stats(points){
    if(!points.length)return null;
    const first=points[0],last=points[points.length-1],prior=points[points.length-2];
    return {first,last,count:points.length,min:Math.min(...points.map(p=>p.value)),max:Math.max(...points.map(p=>p.value)),change:last.value-first.value,percent:(last.value/first.value-1)*100,daily:prior?(last.value/prior.value-1)*100:null,previousDate:prior?.date||null};
  }
  function sma(points,n){
    let sum=0;return points.map((p,i)=>{sum+=p.value;if(i>=n)sum-=points[i-n].value;return {date:p.date,value:i>=n-1?sum/n:null};});
  }
  function bands(points,n=20){
    const avg=sma(points,n);return avg.map((p,i)=>{if(p.value===null)return {date:p.date,upper:null,lower:null};const variance=points.slice(i-n+1,i+1).reduce((s,x)=>s+(x.value-p.value)**2,0)/n;const sd=Math.sqrt(variance);return {date:p.date,upper:p.value+2*sd,lower:p.value-2*sd};});
  }
  function convert(data,amount,from,to){
    const raw=String(amount).trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
    if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)||!Number.isFinite(Number(raw))||Number(raw)>1e12)throw new Error('Введите сумму от 0 до 1 000 000 000 000.');
    if(!Object.hasOwn(currencies,from)||!Object.hasOwn(currencies,to))throw new Error('Неизвестная валюта.');
    const points=series(data,from,to,500),point=points[points.length-1];
    if(!point)throw new Error('Для этой пары пока нет совместных данных. Обновите курсы.');
    return {amount:Number(raw),rate:point.value,total:Number(raw)*point.value,date:point.date};
  }
  function url(now=Date.now()){
    const q=new URLSearchParams({base:'rub',quotes:Object.keys(currencies).filter(c=>c!=='RUB').join(',').toLowerCase(),from:dateKey(now-440*DAY),to:dateKey(now)});
    return 'https://api.frankfurter.dev/v2/rates?'+q;
  }
  async function load(signal){const response=await fetch(url(),{signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error('Источник курсов: HTTP '+response.status);return parse(await response.json());}
  function widgetURL(instrument,range='1M',style='1'){
    const item=instruments.find(x=>x.id===instrument);if(!item)throw new Error('Неизвестный инструмент.');
    const p=new URLSearchParams({symbol:item.symbol,interval:'D',range:['1M','3M','6M','12M','60M'].includes(range)?range:'1M',theme:'light',style:style==='3'?'3':'1',locale:'ru',timezone:'Etc/UTC',hideideas:'1',hidesidetoolbar:'1',hidetoptoolbar:'0',symboledit:'0',saveimage:'0',withdateranges:'1',studies:'[]',toolbarbg:'ffffff',utm_source:'ayyy',utm_medium:'widget',utm_campaign:'chart'});
    return 'https://s.tradingview.com/widgetembed/?'+p;
  }
  const symbolURL=id=>'https://www.tradingview.com/chart/?symbol='+encodeURIComponent(instruments.find(x=>x.id===id)?.symbol||'SP:SPX');
  const csv=points=>'date,reference_rate\r\n'+points.map(p=>p.date+','+p.value.toPrecision(12)).join('\r\n');
  const api={DAY,TTL,KEY,currencies,instruments,dateKey,validDate,parse,valid,series,stats,sma,bands,convert,url,load,widgetURL,symbolURL,csv};
  root.AYYYMarkets=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
