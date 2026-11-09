/* Increasing detail: wings, feathers, spines, a curled tail and tropical leaves. */
(() => {
  'use strict';
  const A=typeof window!=='undefined'?window.PixelArt:require('../pixel-art.js');
  A.add('bee','Пчёлка и цветок',32,'medium','Животные',(b,c)=>{
    b.line(26,30,26,22,c.forest,2);b.flower(26,21,1.2,c.pink);
    b.ellipse(12,9,5,6,c.sky);b.ellipse(19,9,5,6,c.sky);b.ellipse(12,8,3,4,c.mist);b.ellipse(20,8,3,4,c.mist);
    b.poly([[4,17],[0,16],[4,14]],c.ink);b.ellipse(13,17,10,7,c.ink);b.ellipse(13,16,9,6,c.gold);
    b.rect(7,11,3,11,c.ink);b.rect(14,11,3,12,c.ink);b.ellipse(23,14,6,6,c.orange);b.ellipse(23,13,5,5,c.gold);
    b.line(20,9,19,5,c.ink);b.line(25,8,27,5,c.ink);b.eye(25,12);b.line(25,16,27,15,c.brown);
    b.line(10,23,9,26,c.ink);b.line(17,23,18,26,c.ink);
  });
  A.add('owl','Сова на ветке',40,'hard','Животные',(b,c)=>{
    b.line(3,35,37,33,c.brown,3);b.line(31,33,36,28,c.tan);b.poly([[33,29],[37,24],[39,27],[36,30]],c.green);
    b.ellipse(20,23,12,13,c.brown);b.ellipse(20,25,9,9,c.sand);b.ellipse(9,24,4,9,c.tan);b.ellipse(31,24,4,9,c.tan);
    b.poly([[7,4],[15,9],[25,9],[33,4],[31,21],[9,21]],c.brown);b.ellipse(20,15,13,10,c.tan);
    b.ellipse(14,15,6,6,c.cream);b.ellipse(26,15,6,6,c.cream);b.ellipse(14,15,3,4,c.gold);b.ellipse(26,15,3,4,c.gold);b.eye(14,15,2);b.eye(26,15,2);
    b.poly([[17,20],[23,20],[20,24]],c.orange);
    for(let y=25;y<=31;y+=3)for(let x=14+(y%2);x<=26;x+=5){b.put(x,y,c.brown);b.put(x+1,y+1,c.brown);b.put(x+2,y,c.brown);}
    b.line(15,33,15,35,c.orange,2);b.line(25,33,25,35,c.orange,2);b.ellipse(5,7,2,2,c.gold);
  });
  A.add('hedgehog','Ёжик с яблоком',40,'hard','Животные',(b,c)=>{
    b.ellipse(20,35,18,3,c.mint);
    const spikes=[[4,28],[2,20],[8,22],[5,14],[12,17],[12,10],[18,15],[22,9],[24,16],[30,12],[31,20],[35,20],[33,28]];
    b.poly(spikes,c.brown);b.ellipse(20,26,14,9,c.brown);b.ellipse(23,28,10,6,c.tan);
    for(let i=0;i<6;i++)b.line(7+i*4,23,10+i*4,18+(i%2)*3,c.sand,1);
    b.poly([[23,23],[31,25],[39,30],[30,34],[21,33]],c.cream);b.ellipse(37,30,2,2,c.ink);b.eye(30,28);b.ellipse(28,31,2,1,c.pink);
    b.ellipse(13,34,3,2,c.brown);b.ellipse(27,34,3,2,c.brown);
    b.ellipse(19,12,4,5,c.red);b.ellipse(24,12,4,5,c.red);b.line(22,8,23,4,c.brown);b.poly([[23,5],[28,3],[29,6],[24,7]],c.green);b.rect(17,9,2,2,c.coral);
    b.flower(5,33,.7,c.gold);
  });
  A.add('seahorse','Морской конёк',40,'hard','Животные',(b,c)=>{
    b.line(6,37,5,22,c.teal,2);b.line(5,29,2,25,c.green,2);b.line(5,34,9,30,c.green,2);b.ellipse(23,37,15,2,c.sand);
    b.poly([[23,16],[33,20],[25,24]],c.violet);b.poly([[22,16],[29,20],[23,22]],c.pink);
    b.ellipse(22,24,7,8,c.orange);b.ellipse(20,23,4,6,c.gold);
    b.ellipse(24,32,5,5,c.orange);b.ellipse(24,32,3,3,null);b.line(24,32,27,32,c.gold,2);
    b.line(24,20,21,12,c.orange,7);b.ellipse(20,10,7,6,c.orange);b.ellipse(18,9,5,4,c.gold);b.rect(8,10,11,4,c.orange);b.rect(8,10,8,2,c.gold);
    b.poly([[21,5],[25,2],[25,7],[29,5],[27,11]],c.coral);b.eye(19,8,2);
    [17,21,25,28].forEach(y=>b.line(19,y,22,y+1,c.cream));
    [[6,6,2],[10,18,1],[34,12,2],[32,29,1]].forEach(([x,y,r])=>{b.ellipse(x,y,r,r,c.sky);b.put(x,y,c.mist);});
  });
  A.add('toucan','Тукан в джунглях',40,'hard','Животные',(b,c)=>{
    b.line(2,34,38,33,c.brown,3);b.line(5,33,2,22,c.forest,2);b.poly([[3,26],[0,20],[7,22],[6,29]],c.green);b.poly([[34,32],[31,25],[39,27],[37,33]],c.mint);
    b.poly([[16,24],[8,36],[14,36],[20,28]],c.navy);b.ellipse(18,22,8,11,c.ink);b.ellipse(21,19,5,8,c.white);b.ellipse(15,23,4,7,c.navy);
    b.ellipse(21,12,8,8,c.ink);b.ellipse(23,12,5,5,c.gold);
    b.poly([[24,7],[32,7],[38,11],[38,15],[25,16]],c.orange);b.poly([[25,8],[32,8],[36,10],[25,12]],c.gold);b.poly([[33,12],[38,12],[38,15],[33,15]],c.red);
    b.line(25,13,37,13,c.brown);b.ellipse(22,11,2,3,c.sky);b.eye(22,11);
    b.line(19,31,18,34,c.orange,2);b.line(24,30,24,33,c.orange,2);b.flower(32,23,.8,c.pink);b.line(32,26,34,32,c.forest);
  });
})();
