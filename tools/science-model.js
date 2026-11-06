/* AYYY Engineering · allowlisted expression tree. No eval, Function, accessors or assignments. */
(function(root){
  'use strict';
  const fail=s=>{throw new Error(s);};
  const finite=x=>{if(!Number.isFinite(x))fail('Результат не определён в действительных числах.');return Object.is(x,-0)?0:x;};
  function factorial(n){if(!Number.isInteger(n)||n<0||n>170)fail('Факториал: целое число от 0 до 170.');let v=1;for(let i=2;i<=n;i++)v*=i;return v;}
  const functions=Object.freeze({
    sin:[1,1,(a,m)=>Math.sin(a[0]*(m==='DEG'?Math.PI/180:1))],cos:[1,1,(a,m)=>Math.cos(a[0]*(m==='DEG'?Math.PI/180:1))],tan:[1,1,(a,m)=>{const x=a[0]*(m==='DEG'?Math.PI/180:1);if(Math.abs(Math.cos(x))<1e-14)fail('Тангенс не определён.');return Math.tan(x);}],
    asin:[1,1,(a,m)=>Math.asin(a[0])*(m==='DEG'?180/Math.PI:1)],acos:[1,1,(a,m)=>Math.acos(a[0])*(m==='DEG'?180/Math.PI:1)],atan:[1,1,(a,m)=>Math.atan(a[0])*(m==='DEG'?180/Math.PI:1)],
    sinh:[1,1,a=>Math.sinh(a[0])],cosh:[1,1,a=>Math.cosh(a[0])],tanh:[1,1,a=>Math.tanh(a[0])],
    sqrt:[1,1,a=>Math.sqrt(a[0])],cbrt:[1,1,a=>Math.cbrt(a[0])],abs:[1,1,a=>Math.abs(a[0])],exp:[1,1,a=>Math.exp(a[0])],
    ln:[1,1,a=>Math.log(a[0])],log:[1,2,a=>a.length===1?Math.log10(a[0]):(a[1]>0&&a[1]!==1?Math.log(a[0])/Math.log(a[1]):NaN)],log10:[1,1,a=>Math.log10(a[0])],log2:[1,1,a=>Math.log2(a[0])],
    floor:[1,1,a=>Math.floor(a[0])],ceil:[1,1,a=>Math.ceil(a[0])],round:[1,1,a=>Math.round(a[0])],sign:[1,1,a=>Math.sign(a[0])],
    min:[2,8,a=>Math.min(...a)],max:[2,8,a=>Math.max(...a)],pow:[2,2,a=>Math.pow(a[0],a[1])],hypot:[2,8,a=>Math.hypot(...a)],
    fact:[1,1,a=>factorial(a[0])],ncr:[2,2,a=>{const [n,k]=a;if(!Number.isInteger(n)||!Number.isInteger(k)||k<0||k>n||n>170)fail('nCr: 0 ≤ k ≤ n ≤ 170.');let x=1;for(let j=1;j<=Math.min(k,n-k);j++)x*= (n-j+1)/j;return x;}]
  });
  function compile(source){
    if(typeof source!=='string'||!source.trim()||source.length>512)fail('Введите выражение до 512 символов.');
    const s=source.replace(/×/g,'*').replace(/÷/g,'/').replace(/[−–]/g,'-').replace(/π/g,'pi').replace(/\*\*/g,'^');
    const tokens=[];let pos=0;
    while(pos<s.length){if(/\s/.test(s[pos])){pos++;continue;}const m=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|^[A-Za-z_][A-Za-z_0-9]*|^[+*/^!%,()\-]/.exec(s.slice(pos));if(!m)fail('Недопустимый символ: '+s[pos]);tokens.push(m[0]);pos+=m[0].length;}
    if(tokens.length>256)fail('Слишком сложное выражение.');
    let i=0,depth=0;
    const isNum=t=>t!==undefined&&/^(\d|\.)/.test(t);
    function expr(min=0){
      if(++depth>48)fail('Слишком глубокая вложенность.');
      let left,t=tokens[i++];
      if(t==='+'||t==='-')left={op:'u'+t,a:expr(29)};
      else if(t==='('){left=expr();if(tokens[i++]!==')')fail('Проверьте скобки.');}
      else if(isNum(t))left={value:finite(Number(t))};
      else if(['x','a','ans','pi','e','tau'].includes(t))left={name:t};
      else if(Object.hasOwn(functions,t||'')){
        if(tokens[i++]!=='(')fail('После функции нужны скобки.');const args=[];
        if(tokens[i]!==')'){do{args.push(expr());if(tokens[i]!==',')break;i++;}while(i<tokens.length);}
        if(tokens[i++]!==')')fail('Проверьте аргументы функции.');const [lo,hi]=functions[t];if(args.length<lo||args.length>hi)fail('Неверное число аргументов '+t);left={call:t,args};
      } else fail('Неизвестное имя или пропущенное число: '+(t??'конец строки'));
      while(i<tokens.length){
        const next=tokens[i];if(next==='!'||next==='%'){if(40<min)break;i++;left={op:next,a:left};continue;}
        const implicit=next==='('||/^[A-Za-z_]/.test(next)||isNum(next);
        const op=implicit?'*':next,prec=op==='+'||op==='-'?10:op==='*'||op==='/'?20:op==='^'?30:-1;
        if(prec<min||prec<0)break;if(!implicit)i++;left={op,a:left,b:expr(op==='^'?prec:prec+1)};
      }
      depth--;return left;
    }
    const tree=expr();if(i!==tokens.length)fail('Лишний символ: '+tokens[i]);
    function evaluate(n,scope,mode){
      if(Object.hasOwn(n,'value'))return n.value;
      if(n.name){const constants={pi:Math.PI,e:Math.E,tau:2*Math.PI};if(Object.hasOwn(constants,n.name))return constants[n.name];return finite(Number(scope[n.name]??0));}
      if(n.call)return finite(functions[n.call][2](n.args.map(x=>evaluate(x,scope,mode)),mode));
      const a=evaluate(n.a,scope,mode);if(n.op==='u-')return -a;if(n.op==='u+')return a;if(n.op==='!')return factorial(a);if(n.op==='%')return a/100;
      const b=evaluate(n.b,scope,mode);if(n.op==='/'&&b===0)fail('Деление на ноль.');
      return finite(n.op==='+'?a+b:n.op==='-'?a-b:n.op==='*'?a*b:n.op==='/'?a/b:Math.pow(a,b));
    }
    return (scope={},mode='RAD')=>evaluate(tree,scope,mode);
  }
  function derivative(fn,x){const h=Math.cbrt(Number.EPSILON)*Math.max(1,Math.abs(x));return finite((fn(x+h)-fn(x-h))/(2*h));}
  function integral(fn,a,b){
    if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>1e8||Math.abs(b)>1e8)fail('Проверьте границы интеграла.');if(a===b)return {value:0,error:0};
    function simpson(n){const h=(b-a)/n;let s=fn(a)+fn(b);for(let i=1;i<n;i++)s+=(i%2?4:2)*fn(a+i*h);return finite(s*h/3);}
    const coarse=simpson(512),fine=simpson(1024),err=Math.abs(fine-coarse)/15;
    if(err>1e-4*Math.max(1,Math.abs(fine)))fail('Интеграл не сошёлся: возможен разрыв или быстрое колебание.');return {value:fine,error:err};
  }
  function rootBetween(fn,a,b){
    let fa=fn(a),fb=fn(b);if(Math.abs(fa)<1e-12)return a;if(Math.abs(fb)<1e-12)return b;
    if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b||fa*fb>0)fail('На границах нужны разные знаки f(x).');
    let x=0,fx=0;for(let n=0;n<100;n++){x=(a+b)/2;fx=fn(x);if(Math.abs(fx)<1e-10)return x;if(fa*fx<=0){b=x;fb=fx;}else{a=x;fa=fx;}}
    if(Math.abs(fx)>1e-6)fail('Корень не подтверждён: проверьте непрерывность.');return x;
  }
  const api={compile,factorial,derivative,integral,rootBetween,functions:Object.keys(functions)};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.AYYYScience=api;
})(typeof window==='undefined'?globalThis:window);
