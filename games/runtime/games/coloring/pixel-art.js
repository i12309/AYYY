/* Deterministic, DOM-free rasteriser for original number-colouring patterns.
 * Coordinates address cells, not screen pixels. No canvas, downloads or randomness.
 * Keep published recipes stable: their IDs address saved colouring progress. */
(function (root) {
  'use strict';
  const C = Object.freeze({
    ink:'#29334d',navy:'#425583',blue:'#438fd6',sky:'#92d7ed',mist:'#d6f1f4',
    white:'#fff8e7',stone:'#9ba8ba',violet:'#a082d2',plum:'#705893',
    pink:'#ef7fa3',rose:'#d7517f',red:'#e85b54',coral:'#ff9470',
    orange:'#efa443',gold:'#ffd361',lemon:'#fff1ac',brown:'#845845',
    tan:'#c28a60',sand:'#e8c391',cream:'#ffe3b5',green:'#60b86d',
    forest:'#32796b',mint:'#8cd19b',teal:'#39adab'
  });
  function board(width,height=width) {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<8||height<8||width>128||height>128) throw Error('Invalid pattern dimensions');
    const cells=Array(width*height).fill(null);
    const put=(x,y,c)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<width&&y<height)cells[y*width+x]=c;};
    const rect=(x,y,w,h,c)=>{for(let j=Math.ceil(y);j<y+h;j++)for(let i=Math.ceil(x);i<x+w;i++)put(i,j,c);};
    const ellipse=(x,y,rx,ry,c)=>{
      if(rx<=0||ry<=0)return;
      for(let j=Math.ceil(y-ry);j<=y+ry;j++)for(let i=Math.ceil(x-rx);i<=x+rx;i++)
        if(((i-x)/rx)**2+((j-y)/ry)**2<=1)put(i,j,c);
    };
    const poly=(points,c)=>{
      const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
      for(let y=Math.floor(Math.min(...ys));y<=Math.ceil(Math.max(...ys));y++){
        for(let x=Math.floor(Math.min(...xs));x<=Math.ceil(Math.max(...xs));x++){
          let inside=false;
          for(let i=0,j=points.length-1;i<points.length;j=i++){
            const [xi,yi]=points[i],[xj,yj]=points[j];
            if((yi>y+.5)!==(yj>y+.5)&&x+.5<(xj-xi)*(y+.5-yi)/(yj-yi)+xi)inside=!inside;
          }
          if(inside)put(x,y,c);
        }
      }
    };
    const line=(x1,y1,x2,y2,c,thickness=1)=>{
      const n=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)*2));
      for(let i=0;i<=n;i++){
        const x=Math.round(x1+(x2-x1)*i/n),y=Math.round(y1+(y2-y1)*i/n);
        if(thickness<=1)put(x,y,c);else ellipse(x,y,thickness/2,thickness/2,c);
      }
    };
    const star=(x,y,r,c)=>{const points=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,k=i%2?r*.45:r;points.push([x+Math.cos(a)*k,y+Math.sin(a)*k]);}poly(points,c);};
    const eye=(x,y,r=1)=>{ellipse(x,y,r,r,C.ink);if(r>=2)put(x-1,y-1,C.white);};
    const cloud=(x,y,s=1)=>{ellipse(x,y,5*s,2*s,C.white);ellipse(x-2*s,y-s,2.5*s,2*s,C.white);ellipse(x+s,y-2*s,2.5*s,2.5*s,C.white);};
    const flower=(x,y,s=1,color=C.pink)=>{[[0,-2],[2,0],[0,2],[-2,0]].forEach(([dx,dy])=>ellipse(x+dx*s,y+dy*s,1.5*s,1.5*s,color));ellipse(x,y,s,s,C.gold);};
    const pine=(x,y,s=1)=>{rect(x-s,y,s*2,s*4,C.brown);poly([[x,y-10*s],[x-5*s,y],[x+5*s,y]],C.forest);poly([[x,y-8*s],[x-3*s,y-2*s],[x+3*s,y-2*s]],C.green);};
    const fish=(x,y,s=1,color=C.orange)=>{poly([[x-3*s,y],[x-6*s,y-3*s],[x-6*s,y+3*s]],C.coral);ellipse(x,y,4*s,2.5*s,color);line(x,y-2*s,x,y+2*s,C.gold,Math.max(1,s));eye(x+2*s,y-s,Math.max(1,s/2));};
    return {width,height,cells,put,rect,ellipse,poly,line,star,eye,cloud,flower,pine,fish};
  }
  function add(id,title,size,difficulty,theme,paint) {
    const b=board(...(Array.isArray(size)?size:[size,size]));paint(b,C);
    const colors=[...new Set(b.cells.filter(Boolean))];
    if(!colors.length||colors.length>52||colors.some(c=>!/^#[a-f0-9]{6}$/i.test(c)))throw Error('Invalid palette: '+id);
    const keys='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const palette=Object.fromEntries(colors.map((c,i)=>[keys[i],c]));
    const map=new Map(colors.map((c,i)=>[c,keys[i]]));
    const rows=Array.from({length:b.height},(_,y)=>b.cells.slice(y*b.width,(y+1)*b.width).map(c=>c?map.get(c):'.').join(''));
    const active=b.cells.filter(Boolean).length;
    const level=Object.freeze({id:'more-'+id,title,emoji:'',difficulty,theme,palette:Object.freeze(palette),rows:Object.freeze(rows),short:`${b.width}×${b.height} · ${colors.length} цветов · ${active} клеток`});
    root.PIXEL_LEVELS ||= [];
    if(root.PIXEL_LEVELS.some(x=>x.id===level.id))throw Error('Duplicate pattern: '+level.id);
    root.PIXEL_LEVELS.push(level);return level;
  }
  const api=Object.freeze({C,board,add});root.PixelArt=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
