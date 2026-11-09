/* AYYY canvas skin: a paper marble garden with a teal route and brass launcher.
 * Rendering only: color identities, coordinates and the engine API stay intact. */
(function () {
  'use strict';
  const levels=window.MarbleLevels,core=window.MarbleEngine;
  class Renderer {
    constructor(canvas) {
      this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
      this.w=960;this.h=680;this.zoom=1;this.panX=0;this.panY=0;
      this.aim={x:this.w*.72,y:this.h*.3};this.highlight=-1;
      this.sprites=levels.COLORS.map(c=>this.sprite(c.hex));
      this.bombSprite=this.sprite('#ffb54b',true);
      this.stars=Array.from({length:52},(_,i)=>({x:((i*173+53)%997)/997,y:((i*307+61)%991)/991,size:i%5===0?2.4:1.1,opacity:.18+(i%4)*.08}));
    }
    sprite(color,bomb=false) {
      const canvas=document.createElement('canvas');canvas.width=88;canvas.height=88;
      const c=canvas.getContext('2d');
      c.shadowColor='#20364028';c.shadowBlur=6;c.shadowOffsetY=3;
      const grad=c.createRadialGradient(28,24,4,44,44,33);
      grad.addColorStop(0,'#fffefb');grad.addColorStop(.18,color);grad.addColorStop(.63,color);grad.addColorStop(1,'#405650');
      c.fillStyle=grad;c.beginPath();c.arc(44,43,31,0,Math.PI*2);c.fill();
      c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetY=0;
      c.lineWidth=2;c.strokeStyle='#fffefb99';c.beginPath();c.arc(44,43,30,0,Math.PI*2);c.stroke();
      c.fillStyle='#fffefb70';c.beginPath();c.ellipse(33,26,10,6,-.5,0,Math.PI*2);c.fill();
      if(bomb){c.fillStyle='#ffffffee';c.font='bold 28px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('✦',44,45);}
      return canvas;
    }
    setSize(w,h) {
      this.w=w;this.h=h;
      const dpr=Math.min(2,Math.max(1,window.devicePixelRatio||1));
      this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
      this.ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    resetView(){this.zoom=1;this.panX=this.panY=0;}
    clampPan() {
      const dx=this.w*(this.zoom-1)/2,dy=this.h*(this.zoom-1)/2;
      this.panX=levels.clamp(this.panX,-dx,dx);
      this.panY=levels.clamp(this.panY,-dy,dy);
    }
    screenToWorld(x,y) {
      return {x:(x-this.w/2-this.panX)/this.zoom+this.w/2,
              y:(y-this.h/2-this.panY)/this.zoom+this.h/2};
    }
    worldToScreen(x,y) {
      return {x:this.w/2+this.panX+(x-this.w/2)*this.zoom,
              y:this.h/2+this.panY+(y-this.h/2)*this.zoom};
    }
    setZoom(scale,anchorX=this.w/2,anchorY=this.h/2) {
      const anchor=this.screenToWorld(anchorX,anchorY);
      this.zoom=levels.clamp(scale,1,1.9);
      this.panX=anchorX-this.w/2-(anchor.x-this.w/2)*this.zoom;
      this.panY=anchorY-this.h/2-(anchor.y-this.h/2)*this.zoom;
      this.clampPan();
    }
    draw(game,now=0){
      const c=this.ctx,w=this.w,h=this.h;
      c.setTransform(this.canvas.width/w,0,0,this.canvas.height/h,0,0);
      const bg=c.createLinearGradient(0,0,w,h);
      bg.addColorStop(0,'#fffefb');bg.addColorStop(.55,'#f5f3e8');bg.addColorStop(1,'#e8efeb');
      c.fillStyle=bg;c.fillRect(0,0,w,h);
      c.fillStyle='#638c8e';this.stars.forEach(star=>{c.globalAlpha=star.opacity*.45;c.beginPath();c.arc(star.x*w,star.y*h,star.size,0,Math.PI*2);c.fill();});c.globalAlpha=1;
      c.save();c.translate(w/2+this.panX,h/2+this.panY);c.scale(this.zoom,this.zoom);c.translate(-w/2,-h/2);
      this.drawTrack(c,game,now);
      const balls=game.chain;
      for(let i=0;i<balls.length;i++){
        if(!game.visibleBall(i))continue;
        const p=game.position(i);
        if(i===this.highlight){c.strokeStyle='#b9622f';c.lineWidth=4;c.shadowColor='#e7b67555';c.shadowBlur=8;c.beginPath();c.arc(p.x,p.y,core.RADIUS+6,0,Math.PI*2);c.stroke();c.shadowBlur=0;}
        this.drawBall(c,p.x,p.y,balls[i].color,core.RADIUS);
      }
      this.drawCannon(c,game,now);
      if(game.projectile){const shot=game.projectile;this.drawBall(c,shot.x,shot.y,shot.color,core.RADIUS*.95,shot.bomb);}
      game.effects.forEach(p=>{c.globalAlpha=Math.max(0,Math.min(1,p.life*2));c.fillStyle=levels.COLORS[p.color]?.hex||'#b9622f';c.beginPath();c.arc(p.x,p.y,2+Math.max(0,p.life)*5,0,Math.PI*2);c.fill();});c.globalAlpha=1;
      if(game.freezeTime>0){c.strokeStyle='#3d8491';c.lineWidth=5;c.globalAlpha=.22+Math.sin(now*.005)*.11;c.strokeRect(5,5,w-10,h-10);c.globalAlpha=1;}
      c.restore();
    }
    drawTrack(c,game,now){
      const path=game.path,points=path.samples;
      c.save();c.beginPath();c.moveTo(points[0].x,points[0].y);
      for(let i=2;i<points.length-1;i+=3)c.lineTo(points[i].x,points[i].y);
      c.lineTo(points[points.length-1].x,points[points.length-1].y);
      c.lineJoin='round';c.lineCap='round';
      c.shadowBlur=6;c.shadowColor='#20364018';c.strokeStyle='#a7b9ae';c.lineWidth=core.RADIUS*2+18;c.stroke();
      c.shadowBlur=0;c.strokeStyle='#f7f3e6';c.lineWidth=core.RADIUS*2+11;c.stroke();
      c.strokeStyle='#dbe5dc';c.lineWidth=core.RADIUS*2+5;c.stroke();
      c.setLineDash([2,16]);c.strokeStyle='#4c838c66';c.lineWidth=3;c.stroke();c.setLineDash([]);
      const a=path.start,b=path.end;
      // Entrance portal and goal are intentionally different from the shooter.
      c.fillStyle='#3d8491';c.strokeStyle='#c3d6cc';c.lineWidth=4;
      c.beginPath();c.arc(a.x,a.y,core.RADIUS+12,0,Math.PI*2);c.fill();c.stroke();
      c.fillStyle='#fffefb';c.textAlign='center';c.textBaseline='middle';c.font='bold 23px system-ui';c.fillText('→',a.x,a.y+1);
      c.fillStyle='#fff8ea';c.strokeStyle='#bf885e';c.lineWidth=6;
      c.beginPath();c.arc(b.x,b.y,core.RADIUS+16,0,Math.PI*2);c.fill();c.stroke();
      c.fillStyle='#b9622f';c.font='bold 26px system-ui';c.fillText('★',b.x,b.y+1);
      c.restore();
    }
    drawBall(c,x,y,color,r=core.RADIUS,bomb=false){
      const s=bomb?this.bombSprite:this.sprites[color]||this.sprites[0];
      c.drawImage(s,x-r*1.4,y-r*1.4,r*2.8,r*2.8);
    }
    drawCannon(c,game,now){
      const {x,y}=game.cannon,deltaX=this.aim.x-x,deltaY=this.aim.y-y;
      const angle=Math.atan2(deltaY,deltaX);
      if(game.status==='playing'){
        c.save();c.setLineDash([8,13]);c.lineWidth=2;c.strokeStyle='#3d84918c';
        c.beginPath();c.moveTo(x+Math.cos(angle)*40,y+Math.sin(angle)*40);
        c.lineTo(x+Math.cos(angle)*Math.min(360,Math.hypot(deltaX,deltaY)),y+Math.sin(angle)*Math.min(360,Math.hypot(deltaX,deltaY)));
        c.stroke();c.setLineDash([]);
        c.strokeStyle='#9b673d9c';c.lineWidth=1.5;c.beginPath();c.arc(this.aim.x,this.aim.y,11+Math.sin(now*.006)*2,0,Math.PI*2);c.stroke();c.restore();
      }
      c.save();c.translate(x,y);
      c.fillStyle='#e6e1cf';c.shadowColor='#20364020';c.shadowBlur=10;c.beginPath();c.arc(0,0,49,0,Math.PI*2);c.fill();
      c.shadowBlur=0;c.strokeStyle='#3d8491';c.lineWidth=6;c.beginPath();c.arc(0,0,43,0,Math.PI*2);c.stroke();
      c.fillStyle='#a8c3b6';c.beginPath();c.arc(0,0,38,0,Math.PI*2);c.fill();
      c.rotate(angle);
      const barrel=c.createLinearGradient(0,-17,0,17);barrel.addColorStop(0,'#e6bc85');barrel.addColorStop(.55,'#bd8450');barrel.addColorStop(1,'#865f42');
      c.fillStyle=barrel;c.strokeStyle='#f6e5cc';c.lineWidth=2;c.beginPath();c.roundRect(13,-15,52,30,12);c.fill();c.stroke();
      c.fillStyle='#203640';c.beginPath();c.ellipse(65,0,5,15,0,0,Math.PI*2);c.fill();
      c.rotate(-angle);
      this.drawBall(c,0,0,game.current,core.RADIUS*1.12,game.armedBomb);
      c.restore();
    }
  }
  window.MarbleRenderer=Renderer;
})();
