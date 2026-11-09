/* Five original small patterns. Published coordinates are save-compatible. */
(() => {
  'use strict';
  const A=typeof window!=='undefined'?window.PixelArt:require('../pixel-art.js');
  A.add('sun','Солнечная улыбка',24,'easy','Природа',(b,c)=>{
    for(let i=0;i<12;i++){const a=i*Math.PI/6;b.line(12+8*Math.cos(a),12+8*Math.sin(a),12+10*Math.cos(a),12+10*Math.sin(a),c.orange,2);}
    b.ellipse(12,12,7,7,c.gold);b.ellipse(10,10,4,4,c.lemon);
    b.eye(9,11);b.eye(15,11);b.line(10,15,14,15,c.brown);b.put(9,14,c.brown);b.put(15,14,c.brown);
    b.rect(7,13,2,1,c.coral);b.rect(16,13,2,1,c.coral);
  });
  A.add('rainbow','Радуга над облаками',24,'easy','Природа',(b,c)=>{
    [c.red,c.orange,c.gold,c.green,c.blue,c.violet].forEach((color,i)=>b.ellipse(12,16,11-i,12-i,color));
    b.ellipse(12,16,5,6,null);b.rect(0,17,24,7,null);
    b.cloud(5,17,.8);b.cloud(19,17,.8);b.put(3,16,c.sky);b.put(18,18,c.sky);
  });
  A.add('cherries','Две вишенки',24,'easy','Угощения',(b,c)=>{
    b.line(7,15,13,4,c.forest,2);b.line(18,17,13,4,c.forest,2);
    b.poly([[12,5],[16,1],[22,3],[17,6]],c.green);b.line(14,4,20,3,c.mint);
    b.ellipse(7,16,5,5,c.rose);b.ellipse(7,15,4,4,c.red);
    b.ellipse(17,17,5,5,c.rose);b.ellipse(16,16,4,4,c.red);
    b.rect(4,13,2,2,c.cream);b.rect(14,14,2,2,c.cream);
  });
  A.add('watermelon','Сочный арбуз',24,'easy','Угощения',(b,c)=>{
    b.poly([[1,7],[23,7],[20,17],[12,22],[4,17]],c.forest);
    b.poly([[2,7],[22,7],[19,16],[12,20],[5,16]],c.mint);
    b.poly([[3,7],[21,7],[18,15],[12,18],[6,15]],c.red);
    b.rect(4,7,16,2,c.coral);[[7,10],[12,10],[17,10],[9,13],[15,13],[12,15]].forEach(([x,y])=>b.line(x,y,x,y+1,c.ink));
  });
  A.add('ladybird','Божья коровка',24,'easy','Животные',(b,c)=>{
    [[5,11,2,9],[5,15,2,16],[7,19,4,22],[19,11,22,9],[19,15,22,16],[17,19,20,22]].forEach(p=>b.line(...p,c.ink));
    b.line(9,5,7,2,c.ink);b.line(15,5,17,2,c.ink);b.ellipse(12,7,5,4,c.ink);
    b.ellipse(12,14,8,8,c.ink);b.ellipse(12,14,7,7,c.red);b.line(12,7,12,21,c.ink);
    [[8,11],[16,11],[7,16],[17,16],[9,19],[15,19]].forEach(([x,y])=>b.ellipse(x,y,1,1,c.ink));
    b.rect(9,5,2,2,c.white);b.rect(14,5,2,2,c.white);b.put(6,11,c.coral);
  });
})();
