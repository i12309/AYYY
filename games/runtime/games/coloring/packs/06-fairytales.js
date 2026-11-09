/* Fairytales and the first complete 64x64 scenes. */
(() => {
  'use strict';
  const A=typeof window!=='undefined'?window.PixelArt:require('../pixel-art.js');
  A.add('castle','Замок принцессы',48,'hard','Сказки',(b,c)=>{
    b.ellipse(24,43,23,4,c.mint);b.cloud(8,9,.8);b.cloud(38,8,.7);
    b.rect(12,24,25,18,c.sand);b.rect(14,25,21,16,c.cream);b.rect(18,15,13,26,c.cream);b.poly([[16,16],[24,4],[33,16]],c.rose);
    [6,34].forEach(x=>{b.rect(x,19,9,23,c.stone);b.rect(x+1,20,7,21,c.white);b.poly([[x-2,20],[x+4,8],[x+11,20]],c.violet);b.rect(x+3,24,3,6,c.sky);b.rect(x+3,34,3,4,c.blue);b.line(x+4,8,x+4,2,c.brown);b.poly([[x+5,2],[x+11,4],[x+5,6]],c.gold);});
    b.ellipse(24,34,5,7,c.brown);b.rect(19,34,11,8,c.brown);b.line(24,29,24,41,c.tan);b.put(22,36,c.gold);b.put(26,36,c.gold);
    b.rect(22,19,5,6,c.blue);b.rect(24,19,1,6,c.white);b.rect(22,21,5,1,c.white);
    for(let y=27;y<40;y+=4){b.rect(15,y,3,1,c.tan);b.rect(31,y+1,2,1,c.tan);}b.line(17,42,31,42,c.stone,2);
    b.flower(4,42,.7,c.pink);b.flower(43,42,.7,c.red);
  });
  A.add('dragon','Добрый дракон',48,'hard','Сказки',(b,c)=>{
    b.ellipse(25,44,21,3,c.mist);b.poly([[22,24],[10,10],[8,29],[18,25]],c.forest);b.poly([[21,24],[11,14],[12,25]],c.violet);
    b.poly([[23,23],[33,8],[39,25],[30,23]],c.forest);b.poly([[26,22],[33,12],[36,23]],c.pink);
    b.line(22,34,10,38,c.forest,9);b.line(10,38,5,31,c.forest,6);b.poly([[4,34],[1,26],[8,28]],c.gold);
    b.ellipse(26,32,10,11,c.green);b.ellipse(28,33,6,9,c.cream);[29,33,37].forEach(y=>b.line(24,y,32,y,c.gold));
    b.ellipse(28,17,10,9,c.forest);b.ellipse(29,16,9,8,c.green);b.ellipse(35,20,9,5,c.green);b.ellipse(35,22,7,3,c.mint);
    b.poly([[21,10],[22,2],[27,9]],c.gold);b.poly([[31,8],[35,2],[36,12]],c.orange);b.eye(30,14,2);b.put(40,19,c.forest);b.line(34,24,41,23,c.forest);
    b.line(20,28,16,31,c.green,4);b.ellipse(22,42,5,2,c.forest);b.ellipse(34,42,5,2,c.forest);
    b.star(7,8,3,c.gold);b.star(43,33,3,c.pink);
  });
  A.add('unicorn','Звёздный единорог',48,'hard','Сказки',(b,c)=>{
    b.ellipse(24,30,22,16,c.mist);b.star(7,9,3,c.gold);b.star(41,7,3,c.gold);b.star(41,36,2,c.pink);
    b.poly([[14,27],[7,26],[4,35],[8,41],[11,31]],c.violet);b.line(8,29,6,37,c.pink,2);
    b.rect(14,30,5,12,c.stone);b.rect(27,30,5,12,c.stone);b.rect(15,30,3,11,c.white);b.rect(28,30,3,11,c.white);
    b.ellipse(23,28,12,8,c.stone);b.ellipse(23,27,11,7,c.white);
    b.poly([[25,28],[25,12],[33,9],[38,17],[33,29]],c.stone);b.poly([[27,27],[27,13],[33,11],[36,17],[31,28]],c.white);
    b.ellipse(36,17,8,5,c.stone);b.ellipse(36,16,7,4,c.white);b.ellipse(41,18,3,2,c.pink);b.eye(34,14);
    b.poly([[28,12],[27,5],[33,11]],c.white);b.poly([[34,12],[38,2],[38,13]],c.gold);b.line(35,10,38,8,c.orange);
    b.poly([[27,9],[22,15],[22,25],[26,30],[29,24],[25,19],[29,13]],c.violet);b.line(26,12,24,18,c.pink,2);b.line(24,21,27,26,c.rose,2);
    b.rect(14,41,5,2,c.violet);b.rect(27,41,5,2,c.violet);
  });
  A.add('treehouse','Домик на большом дереве',64,'expert','Сказки',(b,c)=>{
    b.rect(1,1,62,62,c.mist);b.rect(1,49,62,14,c.mint);b.cloud(12,9,1.3);b.ellipse(54,8,5,5,c.gold);
    b.poly([[24,58],[27,29],[22,15],[31,25],[39,16],[35,35],[39,58]],c.brown);b.line(30,32,29,56,c.tan,2);
    [[18,22,14],[32,15,15],[47,24,14],[24,31,15]].forEach(([x,y,r],i)=>{b.ellipse(x,y,r,r-3,c.forest);b.ellipse(x-2,y-3,r-2,r-4,i%2?c.green:c.mint);});
    b.rect(17,29,31,18,c.tan);b.rect(19,30,27,16,c.sand);b.poly([[13,30],[32,14],[52,30]],c.rose);b.poly([[19,27],[32,17],[47,28]],c.coral);
    [32,36,40,44].forEach(y=>b.line(19,y,45,y,c.tan));b.rect(23,32,7,8,c.navy);b.rect(24,33,5,6,c.sky);b.rect(26,33,1,6,c.white);b.rect(24,35,5,1,c.white);
    b.rect(35,33,8,14,c.brown);b.put(41,40,c.gold);b.rect(14,46,38,3,c.brown);
    b.line(34,49,31,62,c.tan,2);b.line(43,49,40,62,c.tan,2);[51,55,59].forEach(y=>b.line(33-(y-51)/4,y,42-(y-51)/4,y,c.brown,2));
    b.line(49,28,51,48,c.brown);b.rect(47,48,9,2,c.orange);
    [[7,54],[16,58],[53,57]].forEach(([x,y],i)=>b.flower(x,y,.8,[c.pink,c.gold,c.rose][i]));b.ellipse(8,43,3,2,c.red);b.rect(7,45,3,5,c.cream);
  });
  A.add('aquarium','Сокровища подводного сада',64,'expert','Природа',(b,c)=>{
    b.rect(1,1,62,62,c.sky);b.rect(1,23,62,22,c.blue);b.rect(1,45,62,18,c.teal);b.poly([[1,57],[20,53],[41,58],[63,53],[63,63],[1,63]],c.sand);
    for(let k=0;k<5;k++){const x=5+k*12;b.line(x,4,x+5,4,c.mist);b.line(x+3,9,x+7,9,c.white);}
    [[7,60,25],[14,58,34],[56,60,26]].forEach(([x,y,top])=>{b.line(x,y,x,top,c.forest,2);for(let j=top+3;j<y;j+=6){b.line(x,j,x-4,j-5,c.green,2);b.line(x,j+2,x+4,j-3,c.mint,2);}});
    b.fish(20,18,1.8,c.orange);b.fish(46,30,1.5,c.pink);b.fish(24,40,1.2,c.gold);b.fish(44,12,.7,c.violet);
    b.rect(30,48,15,10,c.brown);b.rect(31,49,13,7,c.tan);b.poly([[29,48],[31,42],[45,42],[46,48]],c.brown);b.rect(32,43,12,4,c.gold);b.rect(36,48,3,5,c.gold);
    b.line(50,60,49,47,c.rose,2);b.line(49,53,45,49,c.pink,2);b.line(49,55,53,51,c.rose,2);
    [[7,16,2],[32,9,2],[38,23,3],[55,40,2],[19,31,1]].forEach(([x,y,r])=>{b.ellipse(x,y,r,r,c.mist);b.ellipse(x,y,r-1,r-1,c.sky);});
    b.star(23,58,3,c.red);b.ellipse(50,61,4,1,c.cream);b.ellipse(30,61,2,1,c.violet);
  });
})();
