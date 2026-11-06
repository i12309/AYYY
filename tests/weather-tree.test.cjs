/* AYYY 12-month tree/scene regression tests. Run: node tests/weather-tree.test.cjs */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const Tree=require(path.join(root,'weather/tree-art.js'));
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
let count=0;
function test(message,condition){assert.ok(condition,message);count++;}
const months=Array.from({length:12},(_,n)=>Tree.stage(n+1,55));
for(let i=0;i<12;i++){
 test('Month '+(i+1)+' mapped to itself',months[i].month===i+1);
 test('Month '+(i+1)+' seasonal palette',Array.isArray(months[i].colors)&&months[i].colors.length>=2);
 test('Month '+(i+1)+' stable density',months[i].density>=0&&months[i].density<=1);
 test('Month '+(i+1)+' SVG generated',Tree.canopy(i+1).startsWith('<svg')&&Tree.canopy(i+1).endsWith('</svg>'));
}
test('Winter in January is bare',months[0].density===0);
test('April creates first canopy',months[3].density>.4);
test('July is maximum foliage',months[6].density===1);
test('September turns golden',months[8].season==='autumn');
test('October is thinning',months[9].density<months[8].density);
test('November nearly leafless',months[10].density<.2);
test('December is bare',months[11].density===0);
test('Southern January is summer',Tree.stage(1,-34).season==='summer');
test('Southern July is winter',Tree.stage(7,-34).season==='winter');
test('Same month deterministic',Tree.canopy(10)===Tree.canopy(10));
test('Month changes visible foliage',Tree.canopy(7)!==Tree.canopy(10));
test('Autumn falling leaves',Tree.falling(10).includes('ww-tree-falling-leaf'));
test('Summer has no falling leaves',Tree.falling(7)==='');
test('Winter SVG is leafless',!Tree.canopy(1).includes('ww-tree-leaves'));
test('SVG contains no embedded remote scripts',!Tree.canopy(7).includes('<script'));
const scene=read('weather/scene.js'),view=read('weather/view.js'),css=read('weather/tree.css'),route=read('src/weather-route.js'),standalone=read('weather/index.html');
test('Scene creates tree layers',scene.includes('AYYYWeatherTree?.sceneMarkup'));
test('Scene selects subject without deleting lighthouse',scene.includes("next=subject==='tree'")&&scene.includes('ww-tower-wrap'));
test('Month is passed to scene',view.includes('calendarMonth=Number(M.dateKey'));
test('Tree selection persists',view.includes("weather.scene.subject"));
test('Month preview changes only decoration',view.includes('state.override.month=m')&&!view.includes('state.data.current.month=m'));
test('Tree reset does not change live forecast',view.includes('state.override={};renderScene()'));
test('Tree/month controls have role and labels',view.includes('aria-label="Выбор пейзажа"')&&view.includes('aria-label="Предпросмотр дерева по месяцам"'));
test('Portal loads tree-art before scene',route.indexOf("resource('tree-art.js')")<route.indexOf("resource('scene.js')"));
test('Standalone loads tree-art before scene',standalone.indexOf('tree-art.js')<standalone.indexOf('scene.js'));
test('Day-night artwork rules exist',css.includes('[data-phase=night] .ww-tree-wrap'));
test('Weather snowfall rules exist',css.includes('[data-weather=snow] .ww-tree-snowcap'));
test('Reduced motion available',css.includes('prefers-reduced-motion'));
test('Artwork SVG is local',fs.existsSync(path.join(root,'weather/assets/tree-trunk.svg'))&&fs.existsSync(path.join(root,'weather/assets/tree-mountains.svg'))&&fs.existsSync(path.join(root,'weather/assets/tree-hill.svg')));
test('Landscape buttons use querySelectorAll',view.includes("$$('[data-subject]').forEach"));
test('Month buttons use querySelectorAll',view.includes("$$('[data-preview-month]').forEach"));
console.log('AYYY weather tree: '+count+' PASS');
