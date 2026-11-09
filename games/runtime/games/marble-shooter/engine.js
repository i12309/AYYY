/* Pure marble-shooter simulation. No DOM, timers, storage or rendering here. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./levels.js') : root.MarbleLevels);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MarbleEngine = api;
})(typeof window !== 'undefined' ? window : null, function (levels) {
  'use strict';
  const {COLORS, MODES, buildPath, clamp} = levels;
  const RADIUS = 18, SPACING = RADIUS*2.03;
  function rng(seed) {
    let s=seed>>>0;
    return () => { s+=0x6D2B79F5; let t=s; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
  }
  function segmentCircle(ax,ay,bx,by,cx,cy,r) {
    const dx=bx-ax,dy=by-ay,fx=ax-cx,fy=ay-cy,a=dx*dx+dy*dy;
    if(a<.000001) return fx*fx+fy*fy<=r*r?0:null;
    const b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-r*r,disc=b*b-4*a*c;
    if(c<=0)return 0;
    if(disc<0) return null;
    const root=Math.sqrt(disc),t1=(-b-root)/(2*a),t2=(-b+root)/(2*a);
    if(t1>=0&&t1<=1)return t1;
    if(t2>=0&&t2<=1)return t2;
    return c<=0?0:null;
  }
  function makeChain(level,mode,seed) {
    const rnd=rng((seed>>>0)||1),numColors=Math.min(level.colors,MODES[mode].maxColors);
    const chain=[];
    let previous=-1;
    for(let i=0;i<level.groups;i++) {
      let color=Math.floor(rnd()*numColors);
      if(numColors>1 && color===previous) color=(color+1+Math.floor(rnd()*(numColors-1)))%numColors;
      for(let j=0;j<2;j++)chain.push({color,id:i*2+j,displayS:null});
      previous=color;
    }
    return chain;
  }
  // Resolve a local run of three or more; removing a group can connect another same-color run.
  function takeMatches(chain,index) {
    const matches=[];
    let next=index,combo=0;
    while(chain.length && next>=0 && next<chain.length) {
      let a=next,b=next,color=chain[next].color;
      while(a>0 && chain[a-1].color===color)a--;
      while(b<chain.length-1 && chain[b+1].color===color)b++;
      if(b-a+1<3)break;
      matches.push({start:a, count:b-a+1,color,items:chain.slice(a,b+1)});
      chain.splice(a,b-a+1);
      next=Math.min(a,chain.length-1);
      combo++;
      if(combo>100)throw Error('Unexpected match recursion');
    }
    return matches;
  }
  function snapshotValid(s,level,mode,pathLength) {
    if(!s||s.version!==1||s.level!==level.id||s.mode!==mode||!Array.isArray(s.chain)||s.chain.length>150)return false;
    if(!['playing','paused','won','lost'].includes(s.status))return false;
    if(!Number.isFinite(s.headS)||s.headS<0||s.headS>pathLength+SPACING*5)return false;
    if(!Number.isFinite(s.score)||s.score<0||s.score>1e9)return false;
    if(!Number.isInteger(s.shots)||s.shots<0||s.shots>100000)return false;
    if(!Number.isFinite(s.elapsed)||s.elapsed<0||s.elapsed>1e7)return false;
    const validColor = n=>Number.isInteger(n)&&n>=0&&n<COLORS.length;
    if(!s.chain.every(b=>b&&validColor(b.color)&&Number.isInteger(b.id)&&b.id>=0))return false;
    if(!validColor(s.current)||!validColor(s.next))return false;
    if(s.chain.length>0&&s.status==='won')return false;
    return true;
  }
  class Game {
    constructor(level,mode='kid',seed=1,width=960,height=680) {
      if(!level||!MODES[mode])throw Error('Invalid game settings');
      this.level=level;this.mode=mode;this.seed=(seed>>>0)||1;
      this.path=buildPath(level,width,height);this.width=width;this.height=height;
      this.cannon={x:width*.51,y:height*.54};
      this.reset();
    }
    get speed() { return (36 + this.level.id*2)*MODES[this.mode].speed; }
    reset() {
      this.chain=makeChain(this.level,this.mode,this.seed);
      this.headS=520;
      this.chain.forEach((ball,i)=>{ball.displayS=this.positionS(i);});
      this.status='playing';this.score=0;this.shots=0;this.elapsed=0;this.goodShots=0;this.removed=0;
      this.current=this.pickAmmo(true);this.next=this.pickAmmo(true);
      this.projectile=null;this.freezeTime=0;this.armedBomb=false;
      this.charges={freeze:0,bomb:0,reverse:0};this.undoStack=[];
      this.effects=[];this.lastEvent=null;
    }
    positionS(i) {return this.headS-(this.chain.length-1-i)*SPACING;}
    position(i) {const ball=this.chain[i]; if(!ball)return null;return this.path.at(ball.displayS??this.positionS(i));}
    visibleBall(i) { const s=this.chain[i]?.displayS??this.positionS(i);return s>=-RADIUS && s<=this.path.length+RADIUS; }
    pickAmmo(preferHead=false) {
      if(!this.chain.length)return 0;
      const headColor=this.chain[this.chain.length-1].color;
      if(preferHead)return headColor;
      const active=new Set();
      for(let i=0;i<this.chain.length;i++)if(this.positionS(i)>-RADIUS*4)active.add(this.chain[i].color);
      const available=active.size?[...active]:[...new Set(this.chain.map(b=>b.color))];
      const rand=rng((this.seed+this.shots*1999+this.chain.length*407+this.score)>>>0)();
      return rand<.68?headColor:available[Math.floor(rand*997)%available.length];
    }
    snapshot() {
      return {version:1,level:this.level.id,mode:this.mode,seed:this.seed,
        chain:this.chain.map(b=>({color:b.color,id:b.id,displayS:b.displayS})),headS:this.headS,
        status:this.status,score:this.score,shots:this.shots,elapsed:this.elapsed,
        goodShots:this.goodShots,removed:this.removed,current:this.current,next:this.next,
        charges:{...this.charges},freezeTime:this.freezeTime,armedBomb:this.armedBomb};
    }
    restore(s) {
      if(!snapshotValid(s,this.level,this.mode,this.path.length))return false;
      this.seed=s.seed>>>0 || this.seed;
      this.chain=s.chain.map(b=>({color:b.color,id:b.id,displayS:Number.isFinite(b.displayS)?b.displayS:null}));
      this.headS=s.headS;this.status=s.status;this.score=s.score;this.shots=s.shots;this.elapsed=s.elapsed;
      this.goodShots=clamp(s.goodShots|0,0,100000);this.removed=clamp(s.removed|0,0,200000);
      this.current=s.current;this.next=s.next;
      const caps=s.charges||{};
      this.charges={freeze:clamp(caps.freeze|0,0,3),bomb:clamp(caps.bomb|0,0,3),reverse:clamp(caps.reverse|0,0,3)};
      this.freezeTime=clamp(Number(s.freezeTime)||0,0,10);this.armedBomb=Boolean(s.armedBomb);
      this.projectile=null;this.effects=[];this.undoStack=[];this.lastEvent=null;
      return true;
    }
    resize(width,height) {
      const fraction=this.headS/this.path.length;
      this.width=width;this.height=height;this.cannon={x:width*.51,y:height*.54};
      this.path=buildPath(this.level,width,height);this.headS=fraction*this.path.length;
      this.chain.forEach((b,i)=>{b.displayS=this.positionS(i);});
      this.projectile=null;this.effects=[];
    }
    swap() {
      if(this.status!=='playing'||this.projectile)return false;
      [this.current,this.next]=[this.next,this.current];return true;
    }
    fire(x,y) {
      if(this.status!=='playing'||this.projectile)return false;
      const dx=x-this.cannon.x,dy=y-this.cannon.y,h=Math.hypot(dx,dy);
      if(h<6)return false;
      this.undoStack.push(this.snapshot());if(this.undoStack.length>8)this.undoStack.shift();
      this.projectile={x:this.cannon.x,y:this.cannon.y,vx:dx/h*700,vy:dy/h*700,
        color:this.current,bomb:this.armedBomb,travel:0};
      this.armedBomb=false;
      this.current=this.next;this.next=this.pickAmmo();
      this.shots++;this.lastEvent={type:'shoot'};
      return true;
    }
    undo() {
      const prev=this.undoStack.pop();if(!prev)return false;
      const remaining=this.undoStack.slice();
      this.restore(prev);this.undoStack=remaining;return true;
    }
    activate(power) {
      if(this.status!=='playing'||!(this.charges[power]>0))return false;
      if(power==='bomb') {
        if(this.projectile)return false;
        if(this.armedBomb)return false;
        this.armedBomb=true;this.charges.bomb--;
      } else if(power==='freeze') {
        this.charges.freeze--;this.freezeTime=8;
      } else if(power==='reverse') {
        this.charges.reverse--;this.headS=Math.max(30,this.headS-210);
      } else return false;
      this.lastEvent={type:'power',power};return true;
    }
    emit(x,y,color,count=13) {
      const random=rng((this.seed+Math.floor(x*37+y*19)+this.shots*47)>>>0);
      for(let i=0;i<count;i++){
        const a=random()*Math.PI*2,v=35+random()*150;
        this.effects.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.38+random()*.32,maxLife:.75,color});
      }
      if(this.effects.length>250)this.effects.splice(0,this.effects.length-250);
    }
    removeAt(index,bomb=false,side=1) {
      if(index<0||index>=this.chain.length)return false;
      this.lastEvent=null;
      const ball=this.chain[index];const hitPos=this.position(index);
      if(bomb) {
        const from=Math.max(0,index-2),to=Math.min(this.chain.length,index+3);
        const gone=this.chain.splice(from,to-from);
        gone.forEach(b=>{const p=this.path.at(b.displayS??this.headS);this.emit(p.x,p.y,b.color,6);});
        this.score+=gone.length*115;this.removed+=gone.length;
        const chainReactions=takeMatches(this.chain,Math.min(from,this.chain.length-1));
        this.resolveRemoved(chainReactions);
        this.lastEvent={type:'bomb',removed:gone.length+chainReactions.reduce((s,m)=>s+m.count,0)};
      } else {
        const insertion=clamp(index+(side>0?1:0),0,this.chain.length);
        this.chain.splice(insertion,0,{color:this.projectile?.color??ball.color,id:100000+this.shots,displayS:this.positionS(index)});
        const matches=takeMatches(this.chain,insertion);
        this.resolveRemoved(matches);
        this.lastEvent={type:matches.length?'match':'insert',removed:matches.reduce((s,m)=>s+m.count,0),combo:matches.length};
      }
      if(!this.chain.length){this.status='won';this.lastEvent={type:'won'};}
      return {x:hitPos.x,y:hitPos.y,event:this.lastEvent};
    }
    resolveRemoved(matches) {
      if(!matches.length)return;
      let n=0;
      matches.forEach((match,k)=>{
        n+=match.count;this.score+=match.count*100*(k+1);
        match.items.forEach(b=>{const p=this.path.at(b.displayS??this.headS);this.emit(p.x,p.y,b.color,7);});
      });
      this.removed+=n;this.goodShots++;
      if(this.goodShots%3===0)this.charges.freeze=Math.min(3,this.charges.freeze+1);
      if(this.goodShots%5===0)this.charges.bomb=Math.min(3,this.charges.bomb+1);
      if(this.goodShots%7===0)this.charges.reverse=Math.min(3,this.charges.reverse+1);
    }
    update(dt) {
      dt=clamp(Number(dt)||0,0,.05);
      if(this.status==='playing') {
        this.elapsed+=dt;
        if(this.freezeTime>0)this.freezeTime=Math.max(0,this.freezeTime-dt);
        this.headS+=this.speed*(this.freezeTime>0?.13:1)*dt;
        for(let i=0;i<this.chain.length;i++){
          const b=this.chain[i],target=this.positionS(i);
          b.displayS=Number.isFinite(b.displayS)?b.displayS+(target-b.displayS)*Math.min(1,dt*13):target;
        }
        if(this.headS>=this.path.length-RADIUS*1.5){this.headS=this.path.length-RADIUS*1.5;this.status='lost';this.projectile=null;this.lastEvent={type:'lost'};}
        if(this.projectile&&this.status==='playing') {
          const shot=this.projectile,x0=shot.x,y0=shot.y,x1=x0+shot.vx*dt,y1=y0+shot.vy*dt;
          let nearest=null;
          for(let i=0;i<this.chain.length;i++){
            if(!this.visibleBall(i))continue;
            const p=this.position(i),t=segmentCircle(x0,y0,x1,y1,p.x,p.y,RADIUS*1.85);
            if(t!==null&&(!nearest||t<nearest.t))nearest={index:i,t,p};
          }
          if(nearest) {
            const hitX=x0+(x1-x0)*nearest.t,hitY=y0+(y1-y0)*nearest.t;
            const side=(hitX-nearest.p.x)*nearest.p.tx+(hitY-nearest.p.y)*nearest.p.ty;
            const res=this.removeAt(nearest.index,shot.bomb,side);
            this.projectile=null;
            if(res&&this.status==='playing'&&res.event?.type==='insert')this.emit(hitX,hitY,shot.color,3);
          } else {
            shot.x=x1;shot.y=y1;shot.travel+=Math.hypot(shot.vx,shot.vy)*dt;
            if(shot.x< -40||shot.x>this.width+40||shot.y< -40||shot.y>this.height+40||shot.travel>Math.max(this.width,this.height)*2){
              this.projectile=null;this.lastEvent={type:'miss'};
            }
          }
        }
        if(!this.chain.length&&this.status==='playing'){this.status='won';this.lastEvent={type:'won'};}
      }
      this.effects.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=170*dt;p.life-=dt;});
      this.effects=this.effects.filter(p=>p.life>0);
    }
    hint() {
      if(!this.chain.length)return null;
      for(let i=this.chain.length-1;i>=1;i--){
        if(this.chain[i].color!==this.chain[i-1].color)continue;
        if(this.positionS(i-1)<-RADIUS)continue;
        return {index:i,color:this.chain[i].color,at:this.position(i),available:this.current===this.chain[i].color||this.next===this.chain[i].color};
      }
      return null;
    }
  }
  return Object.freeze({Game,RADIUS,SPACING,COLORS,segmentCircle,takeMatches,makeChain,rng,snapshotValid});
});
