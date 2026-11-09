/* Curved tracks and level metadata. All geometry is local, deterministic and resolution independent. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MarbleLevels = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const COLORS = [
    { name: 'красный', hex: '#fa5b76' },
    { name: 'голубой', hex: '#39c5f1' },
    { name: 'жёлтый', hex: '#ffd34e' },
    { name: 'зелёный', hex: '#5bdc83' },
    { name: 'фиолетовый', hex: '#bd81f8' },
    { name: 'оранжевый', hex: '#ff9850' },
    { name: 'розовый', hex: '#fa85c2' }
  ];
  const routes = [
    [[.02,.16],[.22,.15],[.78,.16],[.90,.28],[.90,.76],[.78,.87],[.22,.87],[.10,.73],[.10,.42],[.22,.32],[.73,.33],[.77,.49],[.72,.68],[.61,.70]],
    [[.02,.82],[.20,.82],[.78,.82],[.90,.66],[.90,.25],[.77,.14],[.22,.14],[.11,.27],[.12,.60],[.27,.70],[.72,.67],[.75,.55],[.70,.39],[.61,.36]],
    [[.10,.03],[.10,.27],[.10,.77],[.25,.90],[.80,.89],[.91,.73],[.89,.25],[.78,.12],[.32,.14],[.25,.27],[.30,.42],[.70,.42],[.74,.60],[.63,.71]],
    [[.91,.07],[.78,.10],[.26,.11],[.11,.25],[.10,.69],[.23,.86],[.80,.87],[.90,.68],[.82,.53],[.70,.40],[.29,.42],[.29,.61],[.62,.72]],
    [[.03,.49],[.12,.22],[.31,.11],[.72,.12],[.88,.29],[.91,.60],[.75,.86],[.30,.88],[.13,.72],[.17,.52],[.30,.32],[.67,.33],[.75,.50],[.63,.70]]
  ];
  const names = ['Первые шарики', 'Радужная поляна', 'Солнечная дуга', 'Морской поворот', 'Тайная тропа', 'Зеркальный сад', 'Волшебное кольцо', 'Лесной ручей', 'Звёздный вираж', 'Мастер шариков'];
  const icons = ['🌈', '🌼', '☀️', '🐬', '🍀', '🪞', '🌀', '🌳', '⭐', '🏆'];
  const LEVELS = names.map((title, i) => Object.freeze({
    id: i + 1, title, icon: icons[i],
    points: Object.freeze(routes[i % 5].map(([x,y]) => Object.freeze([i >= 5 ? 1 - x : x,y]))),
    colors: [3,3,3,4,4,4,5,5,5,6][i], groups: 9 + i * 2,
    difficulty: i < 3 ? 'easy' : i < 7 ? 'medium' : 'hard',
    description: i < 3 ? 'Учимся собирать три шарика в ряд.' : i < 7 ? 'Новые цвета и более длинная дорожка.' : 'Большие цепочки и хитрые повороты.'
  }));
  const MODES = Object.freeze({
    kid: { title: 'Малыш', speed: .52, maxColors: 3 },
    normal: { title: 'Обычный', speed: 1, maxColors: 6 },
    expert: { title: 'Эксперт', speed: 1.38, maxColors: 7 }
  });
  const levelById = id => LEVELS.find(l => l.id === Number(id)) || null;
  const clamp = (n,a,b) => Math.max(a,Math.min(n,b));
  // Catmull–Rom interpolation produces smooth bends without any SVG/CDN dependency.
  function interpolate(a,b,c,d,t) {
    return .5 * ((2*b) + (c-a)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t);
  }
  function buildPath(level, width = 960, height = 680) {
    if (!level || !level.points) throw Error('Unknown level');
    const margin = Math.max(18,Math.min(width,height)*.036);
    const pts = level.points.map(([x,y]) => ({x:margin + x*(width-2*margin), y:margin + y*(height-2*margin)}));
    const samples = [{x:pts[0].x,y:pts[0].y,s:0}];
    let total = 0;
    for(let i=0;i<pts.length-1;i++) {
      const a=pts[Math.max(0,i-1)], b=pts[i],c=pts[i+1],d=pts[Math.min(i+2,pts.length-1)];
      const steps=Math.max(18,Math.round(Math.hypot(c.x-b.x,c.y-b.y)/7));
      for(let j=1;j<=steps;j++) {
        const t=j/steps, x=interpolate(a.x,b.x,c.x,d.x,t), y=interpolate(a.y,b.y,c.y,d.y,t);
        const last=samples[samples.length-1]; total += Math.hypot(x-last.x,y-last.y);
        samples.push({x,y,s:total});
      }
    }
    function at(s) {
      if(s<=0) return {...samples[0],tx:1,ty:0};
      if(s>=total) return {...samples[samples.length-1],...tangent(samples.length-1)};
      let lo=0,hi=samples.length-1;
      while(lo+1<hi){const mid=(lo+hi)>>1;if(samples[mid].s<=s)lo=mid;else hi=mid;}
      const p=samples[lo],q=samples[hi],t=(s-p.s)/(q.s-p.s||1);
      const dx=q.x-p.x,dy=q.y-p.y,h=Math.hypot(dx,dy)||1;
      return {x:p.x+dx*t,y:p.y+dy*t,s,tx:dx/h,ty:dy/h};
    }
    function tangent(index) {
      const a=samples[Math.max(index-1,0)],b=samples[Math.min(index+1,samples.length-1)];
      const dx=b.x-a.x,dy=b.y-a.y,h=Math.hypot(dx,dy)||1;
      return {tx:dx/h,ty:dy/h};
    }
    return {samples, length:total, at, start:at(0),end:at(total),width,height};
  }
  return Object.freeze({LEVELS,COLORS,MODES,levelById,buildPath,clamp});
});
