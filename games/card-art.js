(function () {
  'use strict';
  const c = { ink: '#203640', sea: '#3d8491', orange: '#e77d36', gold: '#d7ad57', mint: '#91b7a1', blue: '#8cb9c2', paper: '#fffef8', line: '#a6b6af', rose: '#cb8771' };
  const path = (d, fill = 'none', stroke = c.ink, w = 1.4, rest = '') => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${rest}/>`;
  const rect = (x, y, w, h, fill, rx = 5, stroke = 'none', rest = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" ${rest}/>`;
  const circle = (x, y, r, fill, stroke = 'none', w = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
  const text = (x, y, value, size = 19, fill = c.ink, extra = '') => `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-family="Georgia,serif" text-anchor="middle" ${extra}>${value}</text>`;
  const group = (transform, content) => `<g transform="${transform}">${content}</g>`;
  const wash = (tone = c.sea) => `<path d="M57 61C68 30 137 27 174 35S263 22 286 62S294 136 251 146S163 150 122 157S62 134 67 107S46 82 57 61Z" fill="${tone}" opacity=".065"/>`;
  const marks = () => `${path('M49 131l-7 3M60 143l-2 6M304 50l7-3M298 39l3-7', 'none', c.gold, 1)}${circle(312, 125, 2, c.orange)}${circle(51, 44, 1.6, c.sea)}`;
  const sun = (x, y, size = 13) => {
    let rays = '';
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; rays += path(`M${x + Math.cos(a) * (size + 5)} ${y + Math.sin(a) * (size + 5)}l${Math.cos(a) * 4} ${Math.sin(a) * 4}`, 'none', c.gold, 1.4); }
    return circle(x, y, size, '#edcf8540', c.gold, 1.5) + rays;
  };
  const boat = (x, y, scale = 1) => group(`translate(${x} ${y}) scale(${scale})`, path('M-20 10h42l-7 9h-27Z', c.sea, c.ink, 1) + path('M0-23V10M-3-21l-18 26h18Z', c.paper, c.ink, 1.2) + path('M4-19L19 5H4Z', c.orange, c.orange, 1) + path('M-25 24q8-4 16 0t16 0t16 0', 'none', c.sea, 1));
  const leaf = (x, y) => group(`translate(${x} ${y})`, path('M-12 16C-24-7-5-23 16-20C22 1 10 17-12 16Z', '#91b7a133', c.sea, 1.4) + path('M-14 21L12-16M-7 11l-4-13M1 2l11-1', 'none', c.sea, 1.2));
  const flower = (x, y, tone = c.orange) => { let p = ''; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; p += circle(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 6.5, tone + '55', tone); } return p + circle(x, y, 4, c.gold); };
  const hex = (x, y, r, fill, label) => { let pts = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; pts.push(`${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`); } return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${c.ink}" stroke-opacity=".25" stroke-width="1.2"/>` + (label === undefined ? '' : text(x, y + 7, label, label > 9 ? 22 : 25, fill === c.sea ? c.paper : c.ink)); };
  const arts = {};

  arts.coloring = () => {
    const drawing = ['0000000000', '0000440000', '0004224000', '0004334000', '0004444000', '0002112000', '0002112000', '0002222000', '0022222200', '0021111200', '0021111200', '0033333300', '3331331333'];
    const colors = { 0: '#fffef8', 1: '#f4e9d3', 2: c.orange, 3: c.sea, 4: c.ink };
    let pixels = '';
    drawing.forEach((row, y) => [...row].forEach((n, x) => {
      if (n === '0') return;
      const colored = x < 5 || (x === 5 && y > 7);
      pixels += rect(18 + x * 9, 15 + y * 9, 9, 9, colored ? colors[n] : '#fffef8', 0, '#d9d7c8');
      if (!colored) pixels += text(22.5 + x * 9, 21.6 + y * 9, n, 6, '#81928c');
    }));
    return wash(c.gold) + group('translate(95 20) rotate(-6 70 75)', rect(3, 5, 137, 153, '#b9afa42b', 4) + rect(0, 0, 137, 153, c.paper, 4, '#c8cec4') + pixels + path('M19 140h54', 'none', '#c1c6bb', 1) + circle(112, 140, 3.5, c.orange)) + group('translate(258 58) rotate(24)', rect(-5, 0, 10, 91, c.orange, 1, '#b96a37') + path('M-5 91L0 104L5 91Z', '#e6ca9b', c.ink, .6) + path('M-1.5 100L0 104L1.5 100Z', c.ink, c.ink, 1) + rect(-5, -9, 10, 10, '#afbec0', 1) + path('M1 0V90', 'none', '#ffc38d', 1.4)) + circle(261, 142, 10, c.sea) + circle(282, 152, 8, c.gold) + marks();
  };

  arts.memory = () => {
    let cards = '';
    for (let i = 0; i < 6; i++) {
      const x = 83 + (i % 3) * 65, y = 24 + Math.floor(i / 3) * 74, face = [0, 2, 4].includes(i);
      let tile = rect(2, 4, 56, 64, '#20364013', 6) + rect(0, 0, 56, 64, face ? c.paper : c.sea, 6, face ? '#b7c7bd' : c.sea);
      if (!face) tile += rect(5, 5, 46, 54, 'none', 3, '#d8e9e077') + path('M28 21l11 11-11 11-11-11Z', 'none', '#e7f1e8', 1) + circle(28, 32, 3, '#e7f1e8');
      else if (i === 0) tile += sun(28, 32, 10);
      else if (i === 2) tile += boat(28, 32, .65);
      else tile += sun(28, 32, 10);
      cards += group(`translate(${x} ${y}) rotate(${[-7, 3, 7, -3, 5, -6][i]} 28 32)`, tile);
    }
    return wash(c.sea) + cards + path('M59 89q-12 12 1 23', 'none', c.gold, 1.2) + marks();
  };

  arts.maze = () => {
    const walls = 'M0 0h132v132H0V0M22 0v22h44v22H22v44H0M88 0v44h44M0 44h22M44 66h44V44M110 66v44H66v22M22 110h22V88h22M88 88V66h22M44 110H22V88M66 22h22M66 66v22';
    return wash(c.sea) + group('translate(112 20) rotate(4 70 70)', rect(-8, -8, 149, 149, c.paper, 8, '#b4c6bd') + path(walls, 'none', '#457e82', 3) + path('M11 11h0v22h66v22h-44v22h44v22h44v22', 'none', c.orange, 4, 'opacity=".8"') + circle(11, 11, 5, c.orange) + path('M121 112l-6 9 6 9 6-9Z', c.gold, c.gold, 1)) + marks();
  };

  arts.nuts = () => {
    let bolts = '';
    const stacks = [[c.sea, c.sea, c.orange], [c.gold, c.orange, c.gold, c.gold], [c.orange, c.mint, c.sea]];
    stacks.forEach((stack, i) => {
      const x = 106 + i * 73;
      bolts += rect(x - 3, 30, 6, 115, '#b9b4a5', 2, '#8d8c80') + rect(x - 25, 144, 50, 9, '#d7cbb4', 4, '#a89f8f');
      for (let j = 0; j < 9; j++) bolts += path(`M${x - 3} ${38 + j * 11}l6-2`, 'none', '#8f948a', .7);
      stack.forEach((tone, j) => {
        const y = 133 - j * 25;
        bolts += path(`M${x - 22} ${y - 8}l11-7h22l11 7v12l-11 7h-22l-11-7Z`, tone, '#20364066', 1);
        bolts += path(`M${x - 22} ${y - 8}l11 7h22l11-7M${x - 11} ${y - 1}v12M${x + 11} ${y - 1}v12`, 'none', '#fffef855', 1);
        bolts += `<ellipse cx="${x}" cy="${y - 7}" rx="7" ry="3.5" fill="#e7dec9" stroke="#20364066" stroke-width="1"/>`;
      });
    });
    return wash(c.orange) + bolts + marks();
  };

  arts.arrows = () => {
    const lines = [
      ['M90 133V51h45v50h43', 'M170 94l8 7-8 7', c.sea],
      ['M111 133h39v-17h62V74h56', 'M260 67l8 7-8 7', c.orange],
      ['M158 51h35v29h44V44', 'M230 52l7-8 7 8', c.gold],
      ['M269 99v40h-30v-18', 'M232 129l7-8 7 8', c.mint]
    ];
    let dots = ''; for (let x = 80; x <= 280; x += 20) for (let y = 30; y <= 150; y += 20) dots += circle(x, y, 1.2, '#9eafa63b');
    return wash(c.sea) + dots + lines.map(([d, a, tone]) => path(d, 'none', tone, 6) + path(a, 'none', tone, 4)).join('') + marks();
  };

  arts.hexmerge = () => {
    const cells = [[180, 95, c.sea, 16], [133, 68, '#e0eae3', 2], [133, 122, '#e0eae3', 2], [180, 41, '#f2dfb5', 4], [180, 149, '#edb985', 8], [227, 68, '#edb985', 8], [227, 122, '#f2dfb5', 4]];
    return wash(c.sea) + cells.map(v => hex(...[v[0] + 2, v[1] + 4, 30, '#2036400c'])).join('') + cells.map(v => hex(v[0], v[1], 29, v[2], v[3])).join('') + path('M279 81v25m-5-6 5 6 5-6', 'none', c.gold, 1.4) + marks();
  };

  arts.mahjong = () => {
    const tile = (x, y, type, angle = 0) => {
      let pattern = type === 'flower' ? flower(27, 37, c.rose) : type === 'sun' ? sun(27, 37, 9) : '';
      if (type === 'bamboo') {
        for (let i = 0; i < 3; i++) { const xx = 15 + i * 12; pattern += path(`M${xx} 20v35M${xx - 3} 31h6M${xx - 3} 43h6M${xx} 25q6-9 9-6M${xx} 48q-7-4-8 1`, 'none', c.sea, 1.6); }
      }
      return group(`translate(${x} ${y}) rotate(${angle} 27 37)`, rect(0, 4, 55, 74, '#c2b59a', 5, '#9e9e8a') + rect(0, 0, 55, 71, c.paper, 5, '#b9b79f') + rect(5, 5, 45, 61, 'none', 2, '#e4decf') + pattern);
    };
    return wash(c.gold) + tile(86, 76, 'bamboo', -9) + tile(145, 78, 'sun', 2) + tile(204, 74, 'flower', 8) + tile(114, 22, 'flower', -8) + tile(178, 21, 'bamboo', 6) + marks();
  };

  arts['marble-shooter'] = () => {
    const d = 'M84 139C48 75 110 28 179 43S295 87 260 120S179 144 174 107';
    const points = [[84,139],[78,123],[77,105],[81,88],[89,72],[101,58],[117,48],[134,42],[152,40],[170,42],[188,46],[206,51],[224,58],[240,66],[254,77],[265,90],[266,106],[257,120],[241,129],[223,133]];
    let balls = points.map(([x,y],i) => circle(x,y,10.2,[c.sea,c.sea,c.gold,c.gold,c.orange,c.orange,c.mint][i % 7],'#20364044',.8) + circle(x-3,y-3,2.5,'#fffef877')).join('');
    return wash(c.sea) + path(d, 'none', '#afbaa966', 4) + balls + group('translate(174 111) rotate(-26)', circle(0,0,18,'#f2dec0','#bbae90',1.3) + rect(-6,-30,12,28,c.ink,4) + circle(0,0,9,c.orange,c.paper,2)) + path('M174 69v-10', 'none', c.orange, 2, 'stroke-dasharray="2 4"') + marks();
  };

  arts['marble-lab'] = () => {
    return wash(c.blue) + path('M91 53v102M256 76v80M164 110v45', 'none', '#b7ac93', 3) + path('M77 46l119 29M77 54l119 29M184 96l92-28M184 104l92-28M90 119l116 31M90 127l116 31', 'none', c.sea, 4) + path('M197 79q35 0 27 10', 'none', c.gold, 2, 'stroke-dasharray="3 5"') + circle(106,43,10,c.orange,'#b2743b',1) + circle(243,72,9,c.gold,'#ac8c47',1) + circle(163,133,10,c.sea,c.ink,1) + circle(103,40,2.5,'#fff9') + circle(240,69,2,'#fff9') + path('M259 130l6-6-6-6 6-6-6-6', 'none', c.orange, 2) + path('M246 147h39v7h-39Z', '#d6c8a6', '#aa9e87', 1) + path('M73 158h210', 'none', '#c6c8b7', 1) + marks();
  };

  arts['number-garden'] = () => {
    let pots = '';
    [109, 182, 255].forEach((x, i) => {
      const y = 107 - [3, 16, 4][i];
      pots += path(`M${x - 23} ${y}h46l-7 49h-32Z`, ['#e3aa83','#c5d9c6','#dfc18c'][i], '#887e6644', 1.3) + rect(x - 27, y - 7, 54, 11, ['#cf946d','#a7c3ac','#d0ad72'][i], 3) + text(x,y+32,[2,3,5][i],25) + path(`M${x} ${y - 7}v-35`, 'none', c.sea, 2) + path(`M${x} ${y - 30}q-27 0-22-17q23-2 22 17Z`, '#91b7a177', c.sea, 1) + path(`M${x} ${y - 18}q26-1 23-19q-23-1-23 19Z`, '#91b7a177', c.sea, 1);
    });
    return wash(c.mint) + pots + text(145,122,'+',17,'#98815c') + text(219,122,'=',17,'#98815c') + path('M76 161h211', 'none', '#c4c1a9', 1) + marks();
  };

  arts['reading-stories'] = () => {
    return wash(c.gold) + group('rotate(-5 180 95)', path('M79 55Q130 34 180 54Q232 34 282 55V146Q232 130 180 151Q128 130 79 147Z','#d6c8a6','#b3ab93',1.3) + path('M81 49Q130 29 180 49Q232 29 280 49V138Q232 121 180 144Q129 121 81 138Z',c.paper,'#b7bcae',1.4) + path('M180 49V144M91 128Q133 116 169 131M191 131Q233 116 268 128','none','#d2d2c0',1) + rect(235,40,13,52,c.orange,1) + path('M235 92l6-6 7 6Z',c.paper,c.paper,0) + text(129,83,'МА',22,c.ink) + text(216,83,'ЯК',22,c.ink) + path('M158 78h11', 'none', c.orange, 2) + path('M101 100h55M101 108h42M197 102h59M197 110h43','none','#c3cbbf',2)) + circle(62,79,3,c.gold) + marks();
  };

  arts['logic-lab'] = () => {
    let blocks = '';
    const tile = (x,y,kind,tone) => rect(x,y,49,49,c.paper,8,'#b5c6b9') + (kind === 'circle' ? circle(x+24.5,y+24.5,12,tone) : kind === 'tri' ? path(`M${x+24} ${y+10}l15 28H${x+9}Z`,tone,tone,1) : kind === 'square' ? rect(x+12,y+12,25,25,tone,3) : text(x+24.5,y+33,'?',29,c.ink));
    const types=['circle','tri','circle','tri'];
    for(let i=0;i<4;i++) blocks += tile(73+i*57,31,types[i],i%2?c.orange:c.sea);
    for(let i=0;i<4;i++) blocks += tile(73+i*57,102,['square','circle','square','q'][i],i%2?c.gold:c.mint);
    return wash(c.gold)+blocks+path('M89 92h192','none','#9caaa177',1,'stroke-dasharray="3 5"')+marks();
  };

  arts['robot-route'] = () => {
    let board = '';
    for(let y=0;y<5;y++) for(let x=0;x<5;x++) board += rect(107+x*28,24+y*28,26,26,(x+y)%2?'#e5ece0':'#f8f7eb',3,'#d4ddcf');
    board += path('M120 149v-56h56V65h56','none',c.orange,3,'stroke-dasharray="4 5"') + path('M227 60l6 5-6 5','none',c.orange,2);
    [[1,0],[3,2],[2,4]].forEach(([x,y])=>{board+=rect(111+x*28,28+y*28,18,18,'#abc1ad',4,'#7f9f8c');});
    const robot = group('translate(120 139)', rect(-13,-10,26,24,c.sea,5,c.ink)+rect(-9,-6,18,11,c.paper,3)+circle(-4,-1,2,c.ink)+circle(4,-1,2,c.ink)+path('M0-10v-6','none',c.ink,1.5)+circle(0,-18,2,c.orange)+path('M-6 15v4M6 15v4','none',c.ink,3));
    return wash(c.sea)+board+robot+path('M233 35v-13l10 4-10 4','none',c.orange,1.7)+marks();
  };

  arts['forest-shop'] = () => {
    const apple=(x,y,tone)=>path(`M${x} ${y-8}C${x-16} ${y-19} ${x-21} ${y+12} ${x-7} ${y+16}Q${x} ${y+13} ${x+7} ${y+16}C${x+22} ${y+10} ${x+16} ${y-19} ${x} ${y-8}Z`,tone,'#5d6f5b77',1)+path(`M${x} ${y-8}q-1-8 4-12M${x+1} ${y-14}q12-9 14 1q-8 3-14-1`,'#91b7a1',c.sea,1);
    return wash(c.gold)+apple(124,70,c.orange)+apple(158,62,'#e4bc68')+apple(190,72,c.mint)+path('M93 91h123l-13 63H106Z','#dfbd8e','#9e8866',1.5)+path('M100 108h109M104 126h101M113 93l7 57M134 93l3 58M157 93v58M180 93l-3 57M201 93l-8 57','none','#b5966d',1.2)+path('M111 93Q102 30 154 32Q212 29 200 93','none','#bd9466',4)+group('translate(243 85) rotate(8)',rect(-15,-19,36,45,c.paper,3,'#b9b9a4')+circle(3,-11,2,'none',c.gold)+text(3,14,'3',25)) + circle(241,146,13,c.gold,'#b1914f',1)+circle(241,146,9,'none','#fff5',1)+text(241,151,'1',15)+circle(271,136,13,c.gold,'#b1914f',1)+circle(271,136,9,'none','#fff5',1)+text(271,141,'2',15)+marks();
  };

  arts['story-post'] = () => {
    let houses='';
    [[85,77,39,65,c.sea],[137,48,47,94,c.orange],[200,66,42,76,c.gold]].forEach(([x,y,w,h,tone])=>{
      houses += rect(x,y,w,h,c.paper,1,'#a8b3a8')+path(`M${x-6} ${y}l${w/2+6} -24l${w/2+6} 24Z`,tone,'#697e7444',1)+rect(x+w/2-6,y+h-23,12,23,tone,2)+rect(x+9,y+14,8,13,'#d7e5dc',2,'#a8b3a8')+rect(x+w-17,y+14,8,13,'#d7e5dc',2,'#a8b3a8');
    });
    const envelope = group('translate(234 118) rotate(-12)',rect(-38,-20,78,51,c.paper,3,'#7d9491')+path('M-37-18L1 8l38-26M-37 29l25-21M39 29L15 8','none','#7d9491',1.4)+rect(22,-13,11,14,'#c5dbc9',1)+circle(25,18,4,c.orange));
    return wash(c.gold)+path('M75 148h184','none','#b3baa9',1)+houses+envelope+path('M275 75q28 15 8 33','none',c.gold,1.4,'stroke-dasharray="3 5"')+marks();
  };

  arts['shape-studio'] = () => {
    const sail = group('translate(108 27) rotate(-5 78 64)',path('M76 0V99H4Z',c.orange,c.paper,2)+path('M83 30L133 99H83Z',c.sea,c.paper,2)+path('M0 106h153l-33 27H29Z',c.gold,c.paper,2)+path('M76 56L36 99h40Z','#eab58c',c.paper,2)+path('M83 99V65l25 34Z','#77a3a6',c.paper,2)+path('M31 108l44 25 44-25Z','#c9994c',c.paper,2));
    return wash(c.sea)+sail+path('M80 174q18-9 36 0t36 0t36 0t36 0t36 0','none','#90b8b2',1.3)+path('M272 101l23 6-17 16Z','#91b7a188',c.paper,1)+rect(72,42,16,16,'#dbad6888',1)+marks();
  };

  arts['2048'] = () => wash(c.gold)+group('rotate(-8 180 95)', [0,1,2,3,4,5,6,7,8].map((n)=> { const x=101+(n%3)*52,y=17+Math.floor(n/3)*52;const vals=[2,4,8,16,32,64,128,256,2048];return rect(x,y,46,46,[c.paper,'#e7ece5','#e7d2a9','#d7ad57','#b7cec0',c.sea,'#b9622f','#a7bdaf',c.orange][n],5,'#fffef8')+text(x+23,y+30,vals[n],n===8?14:19,n>4?c.paper:c.ink);}).join(''))+marks();
  arts.math = () => wash(c.mint)+group('rotate(-6 180 95)',rect(94,29,172,133,c.paper,4,'#b6c3b7')+text(180,80,'3 + 5 = ?',29)+path('M119 98h123','none','#d5ddd3',1)+[3,5,8].map((v,n)=>rect(119+n*43,112,35,32,n===2?c.sea:'#edf1e9',4)+text(136+n*43,134,v,20,n===2?c.paper:c.ink)).join(''))+marks();
  window.AYYYGamesArt = {
    render(id) {
      const drawing = arts[id];
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 190" width="100%" height="100%" role="presentation" aria-hidden="true" focusable="false">${drawing ? drawing() : ''}</svg>`;
    }
  };
}());
