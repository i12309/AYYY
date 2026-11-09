/* One expert scene and four 80x80 murals. Deliberately many small regions. */
(() => {
  'use strict';
  const A=typeof window!=='undefined'?window.PixelArt:require('../pixel-art.js');
  A.add('robot-city','Город дружелюбных роботов',64,'expert','Сказки',(b,c)=>{
    b.rect(1,1,62,62,c.mist);b.rect(1,44,62,19,c.stone);b.rect(1,56,62,6,c.navy);for(let x=3;x<62;x+=10)b.rect(x,58,5,1,c.gold);
    [[3,17,11,27],[18,9,13,35],[35,19,10,25],[49,12,12,32]].forEach(([x,y,w,h],i)=>{b.rect(x,y,w,h,[c.violet,c.blue,c.teal,c.plum][i]);for(let yy=y+3;yy<y+h-2;yy+=6)for(let xx=x+2;xx<x+w-2;xx+=4)b.rect(xx,yy,2,3,(xx+yy)%3?c.lemon:c.sky);});
    b.cloud(10,7,.7);b.ellipse(54,6,3,3,c.gold);b.line(26,9,26,4,c.navy);b.put(26,3,c.red);
    const robot=(x,y,color)=>{
      b.line(x+8,y,x+8,y-4,c.navy);b.ellipse(x+8,y-5,2,2,c.gold);b.rect(x,y,17,13,c.navy);b.rect(x+1,y+1,15,10,color);b.rect(x+3,y+3,11,4,c.ink);b.rect(x+4,y+4,2,2,c.white);b.rect(x+10,y+4,2,2,c.white);b.rect(x+5,y+9,7,1,c.white);
      b.rect(x+2,y+13,13,10,color);b.rect(x+5,y+15,7,5,c.white);b.put(x+6,y+16,c.red);b.put(x+9,y+18,c.green);b.line(x,y+15,x-3,y+20,c.navy,2);b.line(x+16,y+15,x+19,y+11,c.navy,2);b.rect(x+3,y+23,4,5,c.navy);b.rect(x+10,y+23,4,5,c.navy);
    };robot(9,26,c.orange);robot(37,29,c.pink);
    b.rect(30,48,4,6,c.tan);b.flower(32,46,.8,c.rose);
  });
  A.add('coral-reef','Большой коралловый риф',80,'master','Природа',(b,c)=>{
    b.rect(1,1,78,78,c.sky);b.rect(1,18,78,22,c.blue);b.rect(1,40,78,39,c.teal);b.poly([[1,70],[20,65],[45,70],[62,66],[79,71],[79,79],[1,79]],c.sand);
    for(let x=5;x<77;x+=13){b.line(x,5,x+8,5,c.mist);b.line(x+2,11,x+6,11,c.white);}
    for(let i=0;i<5;i++){const x=5+i*4;b.line(x,73,x,43+i%3*6,c.forest,2);for(let y=48+i%3*6;y<72;y+=6){b.line(x,y,x-3,y-5,c.green);b.line(x,y+2,x+3,y-3,c.mint);}}
    b.rect(29,51,5,22,c.stone);b.rect(45,51,5,22,c.stone);b.ellipse(39,52,11,9,c.stone);b.ellipse(39,54,6,6,c.teal);b.rect(34,54,11,18,c.teal);b.rect(27,50,25,3,c.navy);for(let y=57;y<72;y+=5){b.rect(29,y,5,1,c.navy);b.rect(45,y+1,5,1,c.navy);}
    b.fish(21,23,1.7,c.orange);b.fish(57,19,1.4,c.pink);b.fish(19,43,.9,c.gold);b.fish(45,40,.8,c.coral);b.fish(68,34,1,c.violet);
    [[37,25],[48,23],[39,33],[49,31]].forEach(([x,y])=>b.ellipse(x,y,3,2,c.green));b.ellipse(53,27,4,3,c.mint);b.eye(55,26);b.ellipse(43,28,9,6,c.forest);b.poly([[40,24],[46,24],[49,28],[45,32],[40,31],[37,27]],c.green);b.line(42,25,43,31,c.gold);b.line(38,28,48,28,c.gold);
    for(let i=0;i<5;i++){const x=59+i*3;b.line(66,64,x,73,c.plum,3);b.line(x,73,x-2,70,c.pink,2);}b.ellipse(66,61,7,7,c.plum);b.ellipse(65,59,6,6,c.pink);b.eye(63,60);b.eye(68,60);b.line(64,63,67,63,c.rose);
    [[22,75,c.rose],[54,74,c.red],[74,52,c.coral]].forEach(([x,y,col])=>{b.line(x,y,x,y-9,col,2);b.line(x,y-4,x-4,y-8,col,2);b.line(x,y-2,x+4,y-6,col,2);});
    [[9,17],[30,10],[57,36],[72,9],[35,43]].forEach(([x,y])=>{b.ellipse(x,y,2,2,c.mist);b.put(x,y,c.blue);});
    b.star(37,76,3,c.red);b.star(11,76,2,c.orange);[26,48,73].forEach(x=>{b.ellipse(x,77,3,1,c.cream);b.line(x-1,76,x,74,c.white);});
  });
  A.add('fairy-forest','Тайны волшебного леса',80,'master','Сказки',(b,c)=>{
    b.rect(1,1,78,78,c.navy);b.ellipse(42,13,8,8,c.lemon);b.ellipse(45,10,7,7,c.navy);b.rect(1,52,78,27,c.forest);
    [8,24,58,73].forEach((x,i)=>{b.rect(x-2,8,4,47,c.plum);b.poly([[x,4],[x-12,29],[x+12,29]],c.teal);b.poly([[x,17],[x-13,43],[x+13,43]],c.forest);b.line(x,26,x-5,21,c.plum);});
    b.poly([[32,51],[44,50],[43,59],[57,65],[47,79],[26,79],[43,66],[32,59]],c.blue);b.line(36,53,38,58,c.sky,2);b.line(43,67,36,76,c.sky,2);
    const cottage=(x,y,s,col)=>{b.rect(x-5*s,y,10*s,13*s,c.cream);b.rect(x-2*s,y+5*s,4*s,8*s,c.brown);b.put(x,y+9*s,c.gold);b.ellipse(x,y-1*s,12*s,7*s,col);b.rect(x-13*s,y+1*s,26*s,5*s,c.forest);b.rect(x-5*s,y+1*s,10*s,4*s,c.cream);b.ellipse(x,y,12*s,2*s,c.rose);[[x-5*s,y-3*s],[x+2*s,y-5*s],[x+7*s,y-2*s]].forEach(([xx,yy])=>b.ellipse(xx,yy,2*s,1.5*s,c.white));};
    cottage(17,49,1.1,c.red);cottage(62,42,1.2,c.violet);
    b.line(3,65,26,65,c.tan);b.line(3,67,26,67,c.tan);[4,10,16,22].forEach(x=>b.rect(x,62,1,7,c.sand));
    [[7,73],[20,75],[60,69],[72,75]].forEach(([x,y],i)=>{b.line(x,y,x,y-5,c.green);b.flower(x,y-6,.8,[c.pink,c.gold,c.coral,c.violet][i]);});
    for(let i=0;i<18;i++){const x=5+(i*23)%68,y=5+(i*17)%62;b.put(x,y,c.lemon);if(i%3===0)b.put(x+1,y,c.gold);}
    b.ellipse(38,32,3,4,c.pink);b.ellipse(45,32,3,4,c.violet);b.ellipse(39,37,2,3,c.violet);b.ellipse(44,37,2,3,c.pink);b.line(42,30,42,39,c.gold);
    b.rect(53,61,4,8,c.tan);b.ellipse(55,60,6,3,c.gold);b.ellipse(54,59,1,1,c.white);
  });
  A.add('spaceport','Космопорт на Луне',80,'master','Космос',(b,c)=>{
    b.rect(1,1,78,78,c.ink);for(let i=0;i<50;i++)b.put(3+(i*23)%74,2+(i*17)%50,i%4?c.white:c.gold);
    b.ellipse(56,15,11,10,c.blue);b.poly([[51,8],[58,6],[64,12],[57,13],[60,20],[53,22],[49,17]],c.green);b.ellipse(54,10,3,1,c.mist);
    b.poly([[1,56],[12,51],[31,57],[48,51],[68,56],[79,51],[79,79],[1,79]],c.stone);b.ellipse(10,73,8,3,c.navy);b.ellipse(10,72,6,2,c.plum);b.ellipse(67,69,9,3,c.navy);b.ellipse(67,68,7,2,c.plum);
    b.rect(8,24,4,38,c.navy);[27,33,39,45,51].forEach(y=>b.line(8,y,17,y,c.stone,2));
    b.poly([[15,52],[12,62],[19,59]],c.red);b.poly([[26,52],[30,62],[23,59]],c.red);b.rect(16,30,10,29,c.white);b.poly([[16,31],[21,19],[26,31]],c.red);b.rect(16,45,10,3,c.red);b.ellipse(21,37,3,4,c.navy);b.ellipse(21,36,2,2,c.sky);b.rect(15,60,12,3,c.navy);b.poly([[18,63],[24,63],[21,72]],c.orange);
    b.ellipse(49,48,13,12,c.teal);b.ellipse(49,47,11,10,c.sky);b.rect(35,50,29,12,c.white);b.rect(37,52,25,8,c.stone);[39,46,53].forEach(x=>b.rect(x,54,4,3,c.blue));b.rect(57,55,5,7,c.navy);b.line(49,37,49,50,c.white);b.line(38,45,60,45,c.white);
    b.line(67,37,67,58,c.white,2);b.poly([[60,30],[74,30],[67,39]],c.rose);b.line(67,33,72,26,c.white);b.ellipse(72,26,1,1,c.gold);
    [[33,66],[47,68]].forEach(([x,y])=>{b.rect(x,y,11,6,c.navy);for(let k=1;k<10;k+=3)b.line(x+k,y+1,x+k,y+4,c.sky);b.line(x+5,y+6,x+5,y+9,c.white);});
    b.rect(57,40,3,8,c.white);b.poly([[60,40],[66,42],[60,44]],c.gold);for(let i=0;i<6;i++)b.rect(29+i*4,62+(i%2)*2,1,1,c.navy);
  });
  A.add('festival','Парк весёлых аттракционов',80,'master','Путешествия',(b,c)=>{
    b.rect(1,1,78,78,c.violet);b.rect(1,35,78,44,c.pink);b.rect(1,59,78,20,c.mint);b.cloud(12,12,1.2);b.cloud(61,7,1.1);b.ellipse(69,19,6,6,c.lemon);
    b.line(8,11,73,31,c.navy);for(let i=0;i<9;i++){const x=9+i*7,y=11+i*2;b.poly([[x,y],[x+5,y+1],[x+2,y+6]],[c.red,c.gold,c.sky][i%3]);}
    b.ellipse(27,34,19,19,c.cream);b.ellipse(27,34,17,17,c.violet);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,x=27+19*Math.cos(a),y=34+19*Math.sin(a);b.line(27,34,x,y,c.white);b.rect(Math.round(x)-3,Math.round(y),7,6,[c.red,c.blue,c.gold,c.teal][i%4]);b.rect(Math.round(x)-2,Math.round(y)+1,5,2,c.mist);}
    b.line(27,34,15,64,c.navy,3);b.line(27,34,39,64,c.navy,3);b.ellipse(27,34,3,3,c.gold);b.rect(12,63,31,3,c.navy);
    b.rect(49,48,25,19,c.white);b.poly([[45,48],[61,31],[78,48]],c.rose);b.poly([[49,48],[61,31],[55,48]],c.gold);b.poly([[64,48],[61,31],[73,48]],c.gold);for(let x=50;x<73;x+=6)b.rect(x,49,3,17,c.red);b.ellipse(62,59,4,7,c.navy);b.rect(58,59,9,8,c.navy);b.line(61,31,61,25,c.brown);b.poly([[62,25],[70,27],[62,29]],c.gold);
    b.line(3,72,77,72,c.brown,2);for(let x=5;x<78;x+=6)b.rect(x,70,2,5,c.tan);
    [[8,69,c.blue],[20,69,c.red],[32,69,c.orange]].forEach(([x,y,col])=>{b.rect(x,y-5,10,6,col);b.rect(x+1,y-9,8,5,c.white);b.rect(x+2,y-8,6,3,c.sky);b.ellipse(x+2,y+1,2,2,c.ink);b.ellipse(x+8,y+1,2,2,c.ink);});
    [7,13,19].forEach((x,i)=>{b.line(x,53,13,62,c.brown);b.ellipse(x,51-i%2*5,3,4,[c.gold,c.sky,c.red][i]);});
    [[48,75],[72,76]].forEach(([x,y])=>b.flower(x,y,.7,c.rose));
  });
})();
