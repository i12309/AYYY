(() => {
'use strict';
const app=window.Igroland,rules=window.ArrowRules,$=id=>document.getElementById(id),canvas=$('arrowCanvas'),ctx=canvas.getContext('2d');
const COLORS=['#32e66d','#58dfff','#f6c633','#f95da9','#9e61f1','#368bf0','#f78e45','#dc3c50','#4ed8b7'];
let level=1,variant=0,board=null,remaining=[],history=[],moves=0,hearts=3,hints=0,win=false,lose=false,flash=-1,hintId=-1,animation=null,frame=0;
let zoom=1,panX=0,panY=0,viewW=800,viewH=560,dpr=1;
let progress=app.read('arrows.progress.v1',{})||{},sessions=progress.sessions&&typeof progress.sessions==='object'?progress.sessions:{};
const requestedLevel=Number(new URLSearchParams(location.search).get('level'));
level=Number.isInteger(requestedLevel)&&requestedLevel>=1&&requestedLevel<=100?requestedLevel:(Number.isInteger(progress.level)&&progress.level>=1?Math.min(100,progress.level):1);
const pointers=new Map();let pinch=null,interaction=null;
const say=s=>{$('gameMessage').textContent=s;};
const cloneIds=()=>remaining.slice();
function makeSession(){return{level,variant,remaining:cloneIds(),history:history.map(x=>({remaining:x.remaining.slice(),moves:x.moves,hearts:x.hearts})),moves,hearts,hints,win,lose};}
function persist(){sessions[level]=makeSession();app.write('arrows.progress.v1',{level,sessions});}
function validSession(s,created){if(!s||!Array.isArray(s.remaining)||!Array.isArray(s.history)||s.history.length>150||!Number.isInteger(s.moves)||s.moves<0||!Number.isInteger(s.hearts)||s.hearts<0||s.hearts>3||!Number.isInteger(s.variant)||s.variant<0||s.variant>10000)return false;
 const ids=new Set(created.pieces.map(p=>p.id)),unique=new Set(s.remaining);
 return unique.size===s.remaining.length&&s.remaining.every(id=>ids.has(id))&&s.history.every(x=>x&&Array.isArray(x.remaining)&&x.remaining.length<=created.pieces.length&&x.remaining.every(id=>ids.has(id))&&Number.isInteger(x.moves)&&Number.isInteger(x.hearts)&&x.hearts>=0&&x.hearts<=3);}
function getPieces(){const kept=new Set(remaining);return board.pieces.filter(p=>kept.has(p.id));}
function update(){
 $('levelNumber').textContent=String(level);$('remainingCount').textContent=String(remaining.length);$('heartsCount').textContent='♥ '.repeat(hearts)+'♡ '.repeat(3-hearts);
 $('movesValue').textContent=`${moves} ходов`;$('recordValue').textContent=`${Object.keys(app.read('arrows.completed.v1',{})||{}).length} уровней пройдено`;
 $('undoButton').disabled=!history.length;
 $('previousLevel').disabled=level===1;$('nextLevel').disabled=level>=100;
 $('zoomLabel').textContent=`${Math.round(zoom*100)}%`;
}
function metrics(){const tile=Math.min(viewW/(board.width+1.3),viewH/(board.height+1.5))*.96*zoom;return{tile,x0:(viewW-board.width*tile)/2+panX,y0:(viewH-board.height*tile)/2+panY};}
function pointOn(pt,m){return {x:m.x0+(pt[0]+.5)*m.tile,y:m.y0+(pt[1]+.5)*m.tile};}
function linePath(piece,m,offsetX=0,offsetY=0){ctx.beginPath();piece.path.forEach((p,i)=>{const pt=pointOn(p,m);if(i===0)ctx.moveTo(pt.x+offsetX,pt.y+offsetY);else ctx.lineTo(pt.x+offsetX,pt.y+offsetY);});}
function drawPiece(piece,m,offsetX=0,offsetY=0){
 const color=COLORS[piece.color],stroke=Math.min(15,Math.max(3.7,m.tile*.30));
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 linePath(piece,m,offsetX,offsetY);ctx.strokeStyle=color+'2c';ctx.lineWidth=stroke*2.4;ctx.stroke();
 linePath(piece,m,offsetX,offsetY);ctx.strokeStyle='#18243e';ctx.lineWidth=stroke+3;ctx.stroke();
 linePath(piece,m,offsetX,offsetY);ctx.strokeStyle=color;ctx.lineWidth=stroke;ctx.stroke();
 const head=piece.path.at(-1),[dx,dy]=rules.heading(piece),{x,y}=pointOn(head,m);
 const xx=x+offsetX,yy=y+offsetY,size=Math.min(19,Math.max(5,m.tile*.49));
 ctx.beginPath();ctx.moveTo(xx+dx*size,yy+dy*size);ctx.lineTo(xx-dx*size*.4-dy*size*.6,yy-dy*size*.4+dx*size*.6);ctx.lineTo(xx-dx*size*.4+dy*size*.6,yy-dy*size*.4-dx*size*.6);ctx.closePath();ctx.fillStyle=color;ctx.fill();
 const tail=pointOn(piece.path[0],m);ctx.beginPath();ctx.arc(tail.x+offsetX,tail.y+offsetY,stroke*.42,0,Math.PI*2);ctx.fill();
 if(piece.id===hintId||piece.id===flash){
   linePath(piece,m,offsetX,offsetY);ctx.strokeStyle=piece.id===flash?'#ff3554':'#ffffff';ctx.lineWidth=stroke+5;ctx.globalAlpha=.65;ctx.stroke();
 }
 ctx.restore();
}
function render(){
 if(!board||!ctx)return;
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,viewW,viewH);
 const m=metrics();
 ctx.save();ctx.fillStyle='#ffffff0d';
 for(let row=0;row<board.height;row++)for(let col=0;col<board.width;col++){const p=pointOn([col,row],m);ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.6,m.tile*.04),0,Math.PI*2);ctx.fill();}
 ctx.restore();
 for(const piece of getPieces())drawPiece(piece,m);
 if(animation){
   const t=Math.min(1,(performance.now()-animation.start)/460),ease=t*t*(3-2*t);
   const [dx,dy]=rules.heading(animation.piece);const distance=m.tile*(Math.max(board.width,board.height)+12)*ease;
   drawPiece(animation.piece,m,dx*distance,dy*distance);
 }
}
function repaint(){render();}
function animate(){render();if(!animation)return; if(performance.now()-animation.start<460){frame=requestAnimationFrame(animate);}else{animation=null;frame=0;render();}}
function finish(){win=true;const completed=app.read('arrows.completed.v1',{})||{};completed[level]=true;app.write('arrows.completed.v1',completed);
 $('resultEmoji').textContent='✨';$('resultTitle').textContent='Все стрелки свободны!';$('successText').textContent=`Отлично! ${moves} ходов.`;$('againButton').textContent='Следующий уровень →';$('successDialog').hidden=false;say('Победа! Все стрелки улетели.');app.sound([523,659,784,1047],.13);
}
function loseGame(){lose=true;$('resultEmoji').textContent='💛';$('resultTitle').textContent='Попробуем ещё раз?';$('successText').textContent='У тебя получится! Можно начать заново или отменить ход.';$('againButton').textContent='Начать заново';$('successDialog').hidden=false;say('Сердечки кончились. Попробуй ещё раз!');}
function saveHistory(){history.push({remaining:cloneIds(),moves,hearts});if(history.length>120)history.shift();}
function removePiece(piece){
 if(animation||win||lose)return;
 const active=getPieces();
 if(!rules.available(piece,active,board.width,board.height)){
    saveHistory();hearts--;flash=piece.id;hintId=-1;app.sound([175,150],.07);
    say('Эту стрелку пока закрывают другие. Найди свободную!');
    if(hearts<=0)loseGame();
    setTimeout(()=>{if(flash===piece.id){flash=-1;repaint();}},560);
 }else{
    saveHistory();remaining=remaining.filter(id=>id!==piece.id);moves++;flash=-1;hintId=-1;app.sound([450,650],.075);
    animation={piece,start:performance.now()};cancelAnimationFrame(frame);frame=requestAnimationFrame(animate);
    if(!remaining.length)finish();else say('Стрелка свободна! Продолжай.');
 }
 persist();update();render();
}
function hit(x,y){
 const m=metrics();let chosen=null,best=Math.max(11,m.tile*.38);
 for(const piece of getPieces()){
  for(let i=1;i<piece.path.length;i++){
   const a=pointOn(piece.path[i-1],m),b=pointOn(piece.path[i],m);
   const t=Math.max(0,Math.min(1,((x-a.x)*(b.x-a.x)+(y-a.y)*(b.y-a.y))/((b.x-a.x)**2+(b.y-a.y)**2)));
   const dist=Math.hypot(x-(a.x+(b.x-a.x)*t),y-(a.y+(b.y-a.y)*t));
   if(dist<best){best=dist;chosen=piece;}
  }
 }
 return chosen;
}
function resize(){const r=canvas.getBoundingClientRect();viewW=Math.max(1,r.width);viewH=Math.max(1,r.height);dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(viewW*dpr);canvas.height=Math.round(viewH*dpr);repaint();}
function zoomAt(factor,x,y){if(!board)return;const old=metrics(),wx=(x-old.x0)/old.tile,wy=(y-old.y0)/old.tile;zoom=Math.max(.6,Math.min(4,zoom*factor));const next=metrics();panX+=x-(next.x0+wx*next.tile);panY+=y-(next.y0+wy*next.tile);update();repaint();}
function fit(){zoom=1;panX=0;panY=0;update();repaint();}
function levelLoad(n,newBoard=false){
 if(animation){animation=null;cancelAnimationFrame(frame);frame=0;}
 level=Math.max(1,Math.min(100,n));
 const old= !newBoard?sessions[level]:null;
 variant=old&&Number.isInteger(old.variant)&&old.variant>=0&&old.variant<=10000?old.variant:0;
 board=rules.create(level,variant);
 if(old&&validSession(old,board)){
  remaining=old.remaining.slice();history=old.history.map(x=>({remaining:x.remaining.slice(),moves:x.moves,hearts:x.hearts}));moves=old.moves;hearts=old.hearts;hints=old.hints||0;win=Boolean(old.win)&&!remaining.length;lose=Boolean(old.lose)&&hearts===0;
 }else{remaining=board.pieces.map(p=>p.id);history=[];moves=0;hearts=3;hints=0;win=false;lose=false;}
 flash=-1;hintId=-1;$('successDialog').hidden=!(win||lose);
 if(win){$('resultTitle').textContent='Все стрелки свободны!';$('resultEmoji').textContent='✨';$('againButton').textContent='Следующий уровень →';}
 if(lose){$('resultTitle').textContent='Попробуем ещё раз?';$('resultEmoji').textContent='💛';$('againButton').textContent='Начать заново';}
 say(win?'Уровень пройден!':lose?'Попробуй заново или отмени ход.':'Нажимай на стрелки, у которых свободен путь.');fit();persist();
}
function restart(){delete sessions[level];levelLoad(level,true);}
function undo(){if(!history.length)return;const prev=history.pop();remaining=prev.remaining;moves=prev.moves;hearts=prev.hearts;win=false;lose=false;hintId=-1;flash=-1;animation=null;cancelAnimationFrame(frame);frame=0;$('successDialog').hidden=true;say('Ход отменён. Продолжаем!');persist();update();repaint();}
function hint(){if(win||lose)return;const avail=getPieces().filter(p=>rules.available(p,getPieces(),board.width,board.height));if(!avail.length){say('Свободных стрелок нет. Попробуй отменить ход.');return;}hintId=avail[0].id;hints++;say('Подсказка: белой обводкой выделена свободная стрелка.');app.sound([790],.08);persist();repaint();}
function pos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function pair(){const a=[...pointers.values()];if(a.length<2)return null;return{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)};}
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('wheel',event=>{event.preventDefault();zoomAt(event.deltaY<0?1.12:1/1.12,pos(event).x,pos(event).y);},{passive:false});
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0&&e.button!==2)return;
 e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=pos(e);
 pointers.set(e.pointerId,p);
 if(pointers.size===1){interaction={x:p.x,y:p.y,last:p,moved:false,right:e.pointerType==='mouse'&&e.button===2};pinch=null;}
 else{pinch=pair();if(interaction)interaction.moved=true;}
});
canvas.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;
 e.preventDefault();const p=pos(e),before=pointers.get(e.pointerId);pointers.set(e.pointerId,p);
 if(pointers.size>=2){const next=pair();if(next&&pinch&&pinch.d>1){zoomAt(next.d/pinch.d,next.x,next.y);panX+=next.x-pinch.x;panY+=next.y-pinch.y;repaint();}pinch=next;return;}
 if(interaction&&Math.hypot(p.x-interaction.x,p.y-interaction.y)>9)interaction.moved=true;
 if(interaction?.moved||interaction?.right){panX+=p.x-before.x;panY+=p.y-before.y;repaint();}
});
function end(e){if(!pointers.has(e.pointerId))return;const p=pos(e),single=pointers.size===1;const tap=single&&interaction&&!interaction.moved&&!interaction.right&&Math.hypot(p.x-interaction.x,p.y-interaction.y)<12;pointers.delete(e.pointerId);
 if(!pointers.size){pinch=null;interaction=null;}else{pinch=null;interaction={x:p.x,y:p.y,last:p,moved:true,right:false};}
 if(tap){const piece=hit(p.x,p.y);if(piece)removePiece(piece);}
}
canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
$('previousLevel').addEventListener('click',()=>levelLoad(level-1));
$('nextLevel').addEventListener('click',()=>levelLoad(level+1));
$('newGame').addEventListener('click',restart);
$('undoButton').addEventListener('click',undo);
$('hintButton').addEventListener('click',hint);
$('zoomIn').addEventListener('click',()=>zoomAt(1.25,viewW/2,viewH/2));
$('zoomOut').addEventListener('click',()=>zoomAt(1/1.25,viewW/2,viewH/2));
$('zoomFit').addEventListener('click',fit);
$('againButton').addEventListener('click',()=>win?levelLoad(level+1):restart());
$('soundButton').addEventListener('click',()=>{app.setSound(!app.soundEnabled());$('soundButton').setAttribute('aria-pressed',String(app.soundEnabled()));});
$('soundButton').setAttribute('aria-pressed',String(app.soundEnabled()));
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}if(e.key==='Escape')fit();});
levelLoad(level);
if(typeof ResizeObserver==='function')new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);
resize();
})();
