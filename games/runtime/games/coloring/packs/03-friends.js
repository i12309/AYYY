/* Animal portraits, each with its own silhouette and small details. */
(() => {
  'use strict';
  const A=typeof window!=='undefined'?window.PixelArt:require('../pixel-art.js');
  A.add('panda','Панда с бамбуком',32,'medium','Животные',(b,c)=>{
    b.line(27,29,27,6,c.forest,2);[9,15,22].forEach(y=>{b.line(27,y,31,y-3,c.green,2);b.line(27,y,24,y-3,c.mint,2);});
    b.ellipse(11,27,4,3,c.ink);b.ellipse(22,27,4,3,c.ink);b.ellipse(16,21,8,8,c.ink);b.ellipse(16,21,6,7,c.white);
    b.ellipse(8,6,4,4,c.ink);b.ellipse(24,6,4,4,c.ink);b.ellipse(16,12,11,10,c.ink);b.ellipse(16,12,10,9,c.white);
    b.ellipse(11,11,3,4,c.ink);b.ellipse(21,11,3,4,c.ink);b.put(11,10,c.white);b.put(21,10,c.white);
    b.ellipse(16,16,2,1,c.ink);b.line(16,17,16,18,c.ink);b.rect(7,15,2,1,c.pink);b.rect(24,15,2,1,c.pink);
    b.line(8,22,12,24,c.ink,3);b.line(23,21,26,17,c.ink,3);
  });
  A.add('fox','Лисёнок с хвостом',32,'medium','Животные',(b,c)=>{
    b.ellipse(24,23,6,6,c.brown);b.ellipse(25,22,5,5,c.orange);b.poly([[25,18],[30,18],[29,24],[25,24]],c.white);
    b.ellipse(15,23,6,7,c.orange);b.ellipse(15,24,3,5,c.cream);b.rect(9,28,5,2,c.brown);b.rect(17,28,5,2,c.brown);
    b.poly([[4,3],[13,7],[21,7],[28,3],[25,18],[16,23],[7,18]],c.brown);
    b.poly([[6,5],[13,9],[20,9],[26,5],[24,17],[16,21],[8,17]],c.orange);
    b.poly([[7,7],[11,10],[8,12]],c.pink);b.poly([[25,7],[22,10],[24,12]],c.pink);
    b.poly([[7,14],[15,17],[16,21],[9,18]],c.white);b.poly([[25,14],[17,17],[16,21],[23,18]],c.white);
    b.eye(11,13);b.eye(21,13);b.ellipse(16,18,2,1,c.ink);b.put(15,10,c.gold);
  });
  A.add('bunny','Зайчонок с морковкой',32,'medium','Животные',(b,c)=>{
    b.ellipse(10,9,4,8,c.stone);b.ellipse(22,9,4,8,c.stone);b.ellipse(10,8,3,6,c.white);b.ellipse(22,8,3,6,c.white);
    b.line(10,4,10,11,c.pink,2);b.line(22,4,22,11,c.pink,2);
    b.ellipse(16,24,7,6,c.stone);b.ellipse(16,23,6,6,c.white);b.ellipse(16,17,10,8,c.stone);b.ellipse(16,16,9,7,c.white);
    b.eye(12,15);b.eye(20,15);b.ellipse(16,18,1,1,c.rose);b.line(15,20,17,20,c.brown);b.rect(8,18,2,1,c.pink);b.rect(23,18,2,1,c.pink);
    b.poly([[20,22],[26,23],[22,31]],c.orange);b.line(24,23,25,19,c.forest);b.line(24,22,28,20,c.green);b.line(22,26,24,26,c.tan);
    b.ellipse(10,29,4,2,c.white);b.ellipse(18,29,3,2,c.white);
  });
  A.add('penguin','Пингвин в шарфе',32,'medium','Животные',(b,c)=>{
    b.ellipse(16,29,14,2,c.sky);b.ellipse(11,28,4,2,c.orange);b.ellipse(21,28,4,2,c.orange);
    b.ellipse(16,17,10,12,c.ink);b.ellipse(5,20,3,6,c.navy);b.ellipse(27,20,3,6,c.navy);b.ellipse(16,21,7,7,c.white);
    b.ellipse(16,10,9,8,c.ink);b.ellipse(12,11,4,5,c.white);b.ellipse(20,11,4,5,c.white);b.eye(12,10);b.eye(20,10);
    b.poly([[13,13],[20,13],[16,16]],c.gold);b.rect(8,17,17,3,c.red);b.rect(20,19,4,7,c.coral);b.rect(20,23,4,1,c.gold);
    b.star(4,5,2,c.sky);b.star(28,8,2,c.sky);
  });
  A.add('turtle','Черепашка на песке',32,'medium','Животные',(b,c)=>{
    b.ellipse(16,27,14,3,c.sand);[[7,24],[19,24],[7,16],[20,16]].forEach(([x,y])=>b.ellipse(x,y,3,3,c.green));
    b.poly([[3,22],[0,20],[4,19]],c.forest);b.ellipse(26,19,5,4,c.forest);b.ellipse(27,18,4,3,c.mint);b.eye(28,17);
    b.ellipse(13,19,11,9,c.forest);b.ellipse(13,18,9,7,c.green);
    b.poly([[11,12],[16,12],[19,17],[16,23],[10,23],[7,17]],c.gold);b.poly([[11,13],[15,13],[17,17],[15,21],[11,21],[9,17]],c.mint);
    b.line(7,14,4,13,c.forest);b.line(19,14,22,12,c.forest);b.line(7,21,4,24,c.forest);b.line(19,21,21,24,c.forest);
    b.flower(5,7,.8,c.pink);b.line(5,10,5,13,c.forest);
  });
})();
