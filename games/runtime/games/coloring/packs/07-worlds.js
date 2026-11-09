/* Five complete 64x64 landscapes, with foreground and background details. */
(() => {
  'use strict';
  const A=typeof window!=='undefined'?window.PixelArt:require('../pixel-art.js');
  A.add('planets','Парад планет',64,'expert','Космос',(b,c)=>{
    b.rect(1,1,62,62,c.ink);
    for(let i=0;i<38;i++){const x=3+(i*19)%58,y=3+(i*31)%58;b.put(x,y,i%3?c.white:c.gold);}
    [[12,13,3],[44,5,2],[56,45,3],[24,56,2]].forEach(p=>b.star(...p,c.lemon));
    b.ellipse(6,55,13,13,c.orange);b.ellipse(4,56,11,11,c.gold);b.ellipse(3,53,6,6,c.lemon);
    b.ellipse(29,36,9,9,c.blue);b.poly([[24,30],[30,28],[33,31],[29,35],[34,39],[29,43],[25,39]],c.green);b.line(26,29,31,28,c.mist,2);
    b.ellipse(48,19,10,8,c.tan);b.ellipse(47,17,8,5,c.sand);b.line(34,24,61,15,c.plum,4);b.line(34,23,61,14,c.pink,2);b.ellipse(47,15,7,3,c.sand);
    b.ellipse(20,16,5,5,c.red);b.ellipse(18,14,2,2,c.coral);b.ellipse(50,52,5,5,c.teal);b.line(47,50,53,52,c.sky,2);
    b.poly([[34,55],[39,44],[44,55]],c.red);b.rect(37,48,5,9,c.white);b.ellipse(39,50,1,2,c.sky);b.poly([[37,57],[42,57],[39,62]],c.orange);
  });
  A.add('windmill','Мельница среди тюльпанов',64,'expert','Природа',(b,c)=>{
    b.rect(1,1,62,62,c.mist);b.rect(1,34,62,29,c.mint);b.cloud(12,10,1.4);b.ellipse(53,9,5,5,c.gold);
    b.poly([[1,41],[17,32],[37,40],[63,31],[63,49],[1,49]],c.green);b.poly([[1,48],[63,42],[63,63],[1,63]],c.forest);
    b.poly([[27,21],[39,21],[44,49],[22,49]],c.sand);b.poly([[22,22],[33,8],[44,22]],c.rose);b.poly([[26,20],[33,11],[40,20]],c.coral);
    for(let y=27;y<47;y+=5)for(let x=27+(y%2)*2;x<39;x+=6)b.rect(x,y,3,1,c.tan);
    b.rect(30,39,7,10,c.brown);b.rect(30,30,5,5,c.blue);b.rect(32,30,1,5,c.white);
    b.line(17,14,48,43,c.brown,3);b.line(18,43,47,13,c.brown,3);
    [[[17,12],[28,23],[25,26],[14,15]],[[37,34],[48,44],[51,41],[40,31]],[[16,43],[26,32],[23,29],[13,40]],[[38,24],[49,13],[46,10],[35,21]]].forEach(p=>{b.poly(p,c.white);});
    b.ellipse(33,28,3,3,c.brown);b.ellipse(33,28,1,1,c.gold);
    for(let y=51;y<63;y+=5)for(let x=5;x<61;x+=7){b.line(x,y,x,y+3,c.mint);b.rect(x-1,y-2,3,2,((x+y)%3)?c.red:c.gold);b.put(x-1,y-3,c.pink);b.put(x+1,y-3,c.coral);}
    b.line(1,43,13,43,c.sky,3);b.line(48,47,63,47,c.sky,3);
  });
  A.add('mountain-lake','Горное озеро',64,'expert','Природа',(b,c)=>{
    b.rect(1,1,62,62,c.sky);b.cloud(14,9,1.5);b.ellipse(53,9,5,5,c.lemon);
    b.poly([[1,32],[19,6],[38,32]],c.navy);b.poly([[17,32],[40,9],[63,34]],c.stone);b.poly([[9,22],[19,6],[29,22],[22,18],[18,22],[15,18]],c.white);b.poly([[31,20],[40,9],[50,22],[43,19],[39,23],[36,19]],c.mist);
    b.poly([[1,35],[14,23],[25,35],[42,26],[63,35],[63,48],[1,48]],c.forest);b.rect(1,37,62,25,c.blue);
    for(let y=40;y<61;y+=4){const x=17+(y%3)*3;b.line(x,y,60-(y%7),y,c.sky);}
    b.poly([[1,38],[14,41],[20,49],[10,54],[12,63],[1,63]],c.green);b.poly([[53,42],[63,38],[63,63],[47,63],[52,54]],c.mint);
    b.pine(8,38,1.5);b.pine(57,46,1.5);b.pine(4,53,1.1);
    b.poly([[3,59],[12,45],[22,59]],c.orange);b.poly([[12,45],[12,59],[22,59]],c.gold);b.poly([[12,50],[12,59],[17,59]],c.brown);
    [[27,50,34,50],[28,51,33,51]].forEach(p=>b.line(...p,c.brown));b.line(31,45,31,50,c.tan);b.poly([[32,45],[36,49],[32,49]],c.white);
    b.ellipse(51,60,3,2,c.stone);b.ellipse(57,56,2,1,c.cream);b.flower(44,61,.6,c.pink);
  });
  A.add('winter-village','Зимняя деревня',64,'expert','Природа',(b,c)=>{
    b.rect(1,1,62,62,c.navy);b.ellipse(51,10,6,6,c.lemon);b.ellipse(54,8,5,5,c.navy);
    for(let i=0;i<32;i++)b.put(3+(i*17)%58,3+(i*13)%34,c.white);
    b.poly([[1,38],[18,33],[32,37],[48,32],[63,38],[63,63],[1,63]],c.mist);b.ellipse(29,59,37,9,c.white);
    b.pine(7,38,1.3);b.pine(57,45,1.8);b.pine(10,52,1.2);
    [[18,33,14,c.tan],[38,43,16,c.red]].forEach(([x,y,w,color])=>{
      b.rect(x,y,w,14,color);b.rect(x+w-5,y-10,3,8,c.brown);b.poly([[x-3,y],[x+w/2,y-13],[x+w+3,y]],c.plum);b.poly([[x-3,y],[x+w/2,y-13],[x+w+3,y],[x+w-2,y-2],[x+w/2,y-10],[x+2,y-2]],c.white);
      b.rect(x+2,y+3,4,5,c.gold);b.rect(x+3,y+3,1,5,c.brown);b.rect(x+2,y+5,4,1,c.brown);b.rect(x+w-6,y+7,4,7,c.brown);b.rect(x-1,y+13,w+2,2,c.white);
    });
    b.ellipse(26,57,5,5,c.sky);b.ellipse(26,56,4,4,c.white);b.ellipse(26,49,3,3,c.white);b.rect(23,44,6,3,c.ink);b.rect(21,46,10,1,c.ink);b.put(25,49,c.ink);b.line(27,50,30,50,c.orange);b.rect(23,52,7,2,c.rose);b.line(21,55,17,51,c.brown);b.line(31,55,35,51,c.brown);
    b.put(26,55,c.ink);b.put(26,58,c.ink);
  });
  A.add('safari','Сафари на закате',64,'expert','Животные',(b,c)=>{
    b.rect(1,1,62,62,c.cream);b.ellipse(44,14,10,10,c.gold);b.rect(1,29,62,34,c.sand);b.poly([[1,35],[21,29],[42,36],[63,30],[63,63],[1,63]],c.orange);
    b.line(10,36,10,13,c.brown,3);b.line(10,23,4,16,c.brown,2);b.line(10,20,19,15,c.brown,2);b.ellipse(11,13,11,4,c.forest);b.ellipse(8,11,8,3,c.green);
    b.ellipse(29,39,10,6,c.tan);b.rect(32,21,6,21,c.gold);b.ellipse(37,19,7,4,c.gold);b.line(34,16,34,12,c.brown);b.line(39,16,39,12,c.brown);b.eye(40,18);
    [23,28,33,37].forEach(x=>{b.rect(x,41,2,14,c.gold);b.rect(x,54,2,2,c.brown);});b.ellipse(28,38,9,5,c.gold);b.line(19,36,15,43,c.brown);
    [[23,36],[28,37],[33,38],[35,24],[35,30],[35,35]].forEach(([x,y])=>b.rect(x,y,2,3,c.brown));
    b.ellipse(49,48,10,6,c.stone);b.ellipse(53,44,6,6,c.stone);b.ellipse(49,43,4,5,c.navy);b.line(58,45,59,55,c.stone,3);b.line(59,55,56,57,c.stone,3);b.eye(55,42);[43,49,54].forEach(x=>b.rect(x,51,3,7,c.stone));
    for(let x=4;x<60;x+=8){b.line(x,62,x+1,58,c.forest);b.line(x,61,x-2,59,c.green);}
    b.line(25,9,27,11,c.brown);b.line(27,11,29,9,c.brown);
  });
})();
