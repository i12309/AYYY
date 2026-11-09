/* Five larger 48-cell scenes with machinery, buildings and space equipment. */
(() => {
  'use strict';
  const A=typeof window!=='undefined'?window.PixelArt:require('../pixel-art.js');
  A.add('tractor','Трактор на ферме',48,'hard','Путешествия',(b,c)=>{
    b.ellipse(24,42,23,4,c.mint);b.cloud(9,8,1);b.ellipse(39,8,5,5,c.gold);
    b.rect(5,33,37,6,c.forest);b.rect(10,18,16,19,c.green);b.rect(8,15,20,4,c.forest);b.rect(13,20,10,11,c.sky);b.rect(14,21,3,8,c.mist);
    b.rect(25,27,17,10,c.green);b.rect(28,25,4,3,c.forest);b.rect(35,17,3,11,c.ink);b.rect(34,16,5,2,c.navy);
    b.rect(39,29,4,8,c.navy);[30,33,36].forEach(y=>b.rect(40,y,2,1,c.stone));b.rect(25,28,5,2,c.gold);
    [[15,37,8],[36,38,6]].forEach(([x,y,r])=>{b.ellipse(x,y,r,r,c.ink);b.ellipse(x,y,r-2,r-2,c.navy);b.ellipse(x,y,r-4,r-4,c.gold);b.put(x,y,c.brown);for(let k=0;k<8;k++){const a=k*Math.PI/4;b.put(x+Math.cos(a)*(r-1),y+Math.sin(a)*(r-1),c.stone);}});
    b.line(23,32,27,32,c.brown);b.line(23,31,25,28,c.ink);b.rect(5,31,3,2,c.red);
    [2,44].forEach(x=>{b.line(x,40,x,29,c.tan);for(let y=30;y<37;y+=3){b.line(x,y,x-2,y-2,c.gold);b.line(x,y,x+2,y-2,c.gold);}});
  });
  A.add('train','Весёлый паровоз',48,'hard','Путешествия',(b,c)=>{
    b.cloud(32,8,1.2);b.cloud(24,5,.7);b.line(1,43,47,43,c.brown,2);for(let x=3;x<48;x+=6)b.rect(x,41,2,5,c.tan);
    b.rect(4,21,17,18,c.blue);b.rect(2,18,21,4,c.navy);b.rect(7,24,10,8,c.sky);b.rect(8,25,3,5,c.white);b.rect(10,34,5,2,c.gold);
    b.rect(21,27,20,12,c.red);b.ellipse(40,32,4,6,c.rose);b.rect(29,17,5,12,c.ink);b.rect(27,15,9,4,c.navy);b.rect(24,25,3,3,c.gold);
    b.rect(3,37,40,3,c.ink);b.poly([[41,34],[47,40],[40,40]],c.orange);b.ellipse(43,28,2,2,c.gold);
    [10,23,36].forEach(x=>{b.ellipse(x,39,5,5,c.ink);b.ellipse(x,39,3,3,c.gold);b.ellipse(x,39,1,1,c.orange);});b.line(10,40,36,40,c.stone,2);
    b.rect(22,29,15,2,c.coral);b.star(7,9,3,c.gold);
  });
  A.add('lighthouse','Маяк у моря',48,'hard','Путешествия',(b,c)=>{
    b.rect(1,29,46,17,c.blue);b.rect(1,37,46,9,c.teal);b.ellipse(9,8,5,5,c.gold);b.cloud(36,9,1);
    b.poly([[2,44],[13,33],[33,34],[46,46]],c.stone);b.poly([[6,44],[16,35],[35,39],[40,46]],c.tan);
    b.poly([[18,11],[29,11],[33,38],[14,38]],c.white);b.poly([[17,19],[30,19],[31,25],[16,25]],c.red);b.poly([[15,31],[32,31],[33,38],[14,38]],c.red);
    b.rect(17,8,13,7,c.navy);b.rect(19,9,9,4,c.gold);b.rect(23,9,1,4,c.brown);b.poly([[15,8],[23,2],[32,8]],c.red);b.rect(14,15,19,2,c.navy);
    b.rect(22,32,5,7,c.brown);b.rect(21,26,5,4,c.blue);b.rect(23,26,1,4,c.white);
    for(let y=31;y<46;y+=5){b.line(2,y,9,y,c.mist);b.line(37,y+1,45,y+1,c.sky);}
    b.line(36,18,39,20,c.navy);b.line(39,20,42,18,c.navy);b.star(8,41,2,c.gold);
  });
  A.add('astronaut','Космонавт среди звёзд',48,'hard','Космос',(b,c)=>{
    [[5,6,2],[39,4,2],[7,29,2],[42,27,3],[34,39,2]].forEach(([x,y,r])=>b.star(x,y,r,c.gold));
    b.ellipse(39,13,6,5,c.violet);b.line(32,16,46,10,c.pink,2);
    b.rect(14,19,20,15,c.stone);b.line(15,29,10,38,c.stone,3);b.line(10,38,5,37,c.stone,3);
    b.line(18,31,16,42,c.white,6);b.line(27,31,30,41,c.white,6);b.rect(12,42,8,3,c.navy);b.rect(27,41,8,3,c.navy);
    b.line(14,23,7,18,c.white,5);b.line(30,23,37,19,c.white,5);b.ellipse(6,17,3,3,c.stone);b.ellipse(38,18,3,3,c.stone);
    b.rect(14,21,17,13,c.white);b.rect(18,25,10,6,c.navy);b.rect(19,26,3,2,c.sky);b.put(25,27,c.red);b.put(25,29,c.gold);b.rect(14,32,17,2,c.blue);
    b.ellipse(22,14,10,10,c.stone);b.ellipse(22,13,9,9,c.white);b.ellipse(22,13,7,6,c.navy);b.ellipse(23,14,5,4,c.blue);b.line(18,10,22,8,c.mist,2);
    b.rect(12,12,2,4,c.red);b.rect(31,12,2,4,c.red);
  });
  A.add('submarine','Подводная экспедиция',48,'hard','Путешествия',(b,c)=>{
    b.rect(1,1,46,46,c.mist);b.rect(1,31,46,16,c.sky);b.ellipse(24,46,26,4,c.sand);
    b.line(7,45,5,32,c.forest,2);b.line(5,38,2,35,c.green,2);b.line(42,45,44,34,c.teal,2);b.fish(10,11,.8,c.coral);b.fish(38,37,.7,c.violet);
    b.rect(21,14,4,10,c.orange);b.rect(21,12,9,4,c.gold);b.rect(27,12,3,3,c.navy);
    b.ellipse(24,28,19,10,c.orange);b.ellipse(24,26,18,8,c.gold);b.rect(12,34,23,3,c.tan);
    b.rect(2,25,4,7,c.brown);b.line(2,23,2,34,c.rose,3);b.poly([[40,26],[46,21],[46,35],[40,30]],c.orange);
    [14,25,35].forEach(x=>{b.ellipse(x,26,4,4,c.brown);b.ellipse(x,26,3,3,c.blue);b.put(x-1,25,c.white);});
    [[38,8,3],[33,15,2],[42,18,1],[16,39,2]].forEach(([x,y,r])=>{b.ellipse(x,y,r,r,c.white);b.ellipse(x,y,r-1,r-1,c.sky);});
    b.star(25,43,2,c.red);
  });
})();
