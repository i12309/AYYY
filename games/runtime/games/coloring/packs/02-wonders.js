/* Treats and first journeys: five independent fixed patterns. */
(() => {
  'use strict';
  const A=typeof window!=='undefined'?window.PixelArt:require('../pixel-art.js');
  A.add('icecream','Три шарика мороженого',24,'easy','Угощения',(b,c)=>{
    b.poly([[5,13],[19,13],[12,23]],c.tan);b.poly([[7,14],[17,14],[12,21]],c.sand);
    b.line(8,15,15,18,c.brown);b.line(16,15,10,19,c.brown);
    b.ellipse(7,11,5,4,c.violet);b.ellipse(17,11,5,4,c.pink);b.ellipse(12,6,5,5,c.cream);
    b.rect(4,9,2,1,c.white);b.rect(14,9,2,1,c.white);b.rect(9,4,2,1,c.white);b.ellipse(12,2,2,2,c.red);
  });
  A.add('cupcake','Праздничный кекс',32,'medium','Угощения',(b,c)=>{
    b.poly([[5,17],[27,17],[24,29],[8,29]],c.plum);b.poly([[7,18],[25,18],[23,28],[9,28]],c.violet);
    [11,16,21].forEach(x=>b.line(x,20,x,27,c.pink));b.rect(8,28,16,2,c.plum);
    b.ellipse(16,17,12,5,c.rose);b.ellipse(16,14,11,5,c.pink);b.ellipse(16,10,8,4,c.cream);b.ellipse(16,7,4,3,c.white);
    b.line(17,3,19,1,c.forest);b.ellipse(16,5,2,2,c.red);
    [[8,14],[13,11],[20,12],[23,16],[13,17]].forEach(([x,y],i)=>b.rect(x,y,2,1,[c.blue,c.gold,c.rose][i%3]));
    b.star(3,5,2,c.gold);b.star(28,7,2,c.gold);
  });
  A.add('sailboat','Парусник в море',32,'medium','Путешествия',(b,c)=>{
    b.ellipse(25,6,4,4,c.gold);b.cloud(7,6,.7);b.rect(2,26,28,4,c.sky);
    b.line(16,5,16,24,c.brown);b.poly([[15,6],[15,21],[3,21]],c.red);b.poly([[17,9],[27,21],[17,21]],c.white);
    b.poly([[13,9],[13,19],[5,19]],c.coral);b.poly([[16,3],[23,5],[16,7]],c.gold);
    b.poly([[3,23],[29,23],[25,28],[8,28]],c.navy);b.line(6,24,26,24,c.tan);
    [10,16,22].forEach(x=>b.ellipse(x,25,1,1,c.sky));
    b.line(2,29,10,29,c.blue);b.line(18,30,29,30,c.blue);
  });
  A.add('balloon','Воздушный шар',32,'medium','Путешествия',(b,c)=>{
    b.cloud(5,18,.7);b.cloud(27,7,.7);
    b.ellipse(16,11,10,10,c.plum);b.ellipse(16,10,9,9,c.red);b.ellipse(16,10,6,9,c.gold);b.ellipse(16,10,3,9,c.teal);
    b.poly([[8,16],[24,16],[20,23],[12,23]],c.orange);b.poly([[12,16],[20,16],[18,23],[14,23]],c.gold);
    b.line(12,22,13,27,c.brown);b.line(20,22,19,27,c.brown);b.rect(12,27,9,4,c.brown);b.rect(13,28,7,2,c.tan);
    b.line(9,6,11,4,c.cream,2);b.rect(12,22,9,2,c.plum);
  });
  A.add('mushroom','Гриб на полянке',32,'medium','Природа',(b,c)=>{
    b.ellipse(16,27,14,3,c.mint);b.rect(12,14,8,13,c.tan);b.rect(13,14,5,12,c.cream);b.ellipse(16,26,4,2,c.cream);
    b.ellipse(16,15,13,5,c.rose);b.ellipse(16,13,12,9,c.red);b.rect(2,16,28,5,null);b.rect(12,18,8,9,c.tan);b.rect(13,18,5,8,c.cream);b.ellipse(16,16,13,3,c.rose);b.line(5,15,27,15,c.coral,2);
    [[11,8,2],[20,8,2],[7,12,2],[16,12,2],[25,12,1]].forEach(([x,y,r])=>b.ellipse(x,y,r,r,c.white));
    b.line(4,28,3,23,c.forest);b.line(25,28,28,22,c.forest);b.line(27,27,30,25,c.green);
    b.flower(5,23,.7,c.pink);b.ellipse(23,27,3,2,c.orange);b.ellipse(24,26,2,2,c.gold);b.put(24,26,c.brown);
  });
})();
