/* Full picture library. Reads the same per-picture saves as the painting game. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const labels={easy:'Легко',medium:'Средне',hard:'Сложно',expert:'Очень сложно',master:'Эксперт'};
  const ranks={easy:0,medium:1,hard:2,expert:3,master:4};
  const originalThemes={heart:'Угощения',flower:'Природа',fish:'Животные',rocket:'Космос',cat:'Животные',house:'Сказки',butterfly:'Животные',dino:'Животные'};
  const levels=(window.PIXEL_LEVELS||[]).map(level=>({
    ...level,theme:level.theme||originalThemes[level.id]||'Разное',
    total:level.rows.reduce((sum,row)=>sum+[...row].filter(key=>key!=='.').length,0)
  })).sort((a,b)=>ranks[a.difficulty]-ranks[b.difficulty]||a.total-b.total);
  const normalize=value=>value.toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
  const create=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const themes=[...new Set(levels.map(level=>level.theme))].sort((a,b)=>a.localeCompare(b,'ru'));
  themes.forEach(theme=>{const option=create('option','',theme);option.value=theme;$('artTheme').append(option);});
  function readProgress(level){
    try{
      const values=JSON.parse(localStorage.getItem('igroland-pixel-paint-v1:progress:'+level.id)||'null');
      const cells=level.rows.join('');
      if(!Array.isArray(values)||values.length!==cells.length)return 0;
      return values.reduce((sum,v,i)=>sum+(v===1&&cells[i]!=='.'?1:0),0);
    }catch(_){return 0;}
  }
  function thumbnail(canvas,level){
    canvas.width=level.rows[0].length;canvas.height=level.rows.length;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    level.rows.forEach((row,y)=>[...row].forEach((key,x)=>{if(key==='.')return;ctx.fillStyle=level.palette[key];ctx.fillRect(x,y,1,1);}));
  }
  function card(level,filled){
    const link=create('a','picture-card');link.href='index.html?level='+encodeURIComponent(level.id);
    link.setAttribute('aria-label',`${level.title}. ${labels[level.difficulty]}. ${level.total} клеток.`);
    const image=create('div','picture-preview'),canvas=create('canvas');canvas.setAttribute('aria-hidden','true');image.append(canvas);
    if(level.id.startsWith('more-'))image.append(create('span','picture-new','НОВОЕ'));
    const body=create('div','picture-info'),row=create('div','picture-tags');
    row.append(create('span','picture-theme',level.theme),create('span','difficulty '+level.difficulty,labels[level.difficulty]));
    body.append(row,create('h2','',level.title),create('p','picture-metrics',`${level.rows[0].length}×${level.rows.length} · ${Object.keys(level.palette).length} цветов · ${level.total.toLocaleString('ru')} клеток`));
    if(filled){
      const percent=filled===level.total?100:Math.floor(100*filled/level.total);
      const bar=create('div','picture-progress'),fill=create('span');fill.style.width=percent+'%';bar.append(fill);
      body.append(bar,create('span','picture-status',filled===level.total?'Готово! Можно полюбоваться':`Продолжить · ${percent}% раскрашено`));
    }else body.append(create('span','picture-start','Раскрасить →'));
    link.append(image,body);thumbnail(canvas,level);return link;
  }
  function render(){
    const query=normalize($('artSearch').value),difficulty=$('artDifficulty').value,theme=$('artTheme').value,status=$('artProgress').value;
    const matching=levels.map(level=>({level,filled:readProgress(level)})).filter(({level,filled})=>
      (!query||normalize(level.title+' '+level.theme).includes(query))&&(difficulty==='all'||level.difficulty===difficulty)&&
      (theme==='all'||level.theme===theme)&&(status==='all'||status==='started'&&filled>0&&filled<level.total||status==='done'&&filled===level.total||status==='new'&&filled===0));
    $('artGallery').replaceChildren(...matching.map(({level,filled})=>card(level,filled)));
    $('artCount').textContent=`Показано ${matching.length} из ${levels.length}`;$('artEmpty').hidden=matching.length!==0;
    const url=new URL(location.href);for(const [key,value] of Object.entries({q:$('artSearch').value,difficulty,theme,status})){
      if(value&&value!=='all')url.searchParams.set(key,value);else url.searchParams.delete(key);
    }
    try{history.replaceState(null,'',url);}catch(_){}
  }
  const params=new URLSearchParams(location.search);$('artSearch').value=(params.get('q')||'').slice(0,80);
  for(const [id,key] of [['artDifficulty','difficulty'],['artTheme','theme'],['artProgress','status']]){
    const value=params.get(key);if([...$(id).options].some(option=>option.value===value))$(id).value=value;
  }
  $('libraryFilters').addEventListener('submit',event=>event.preventDefault());
  $('libraryFilters').addEventListener('input',render);$('libraryFilters').addEventListener('change',render);
  $('clearFilters').addEventListener('click',()=>{$('libraryFilters').reset();render();});
  window.addEventListener('pageshow',render);
  window.addEventListener('storage',event=>{if(event.key===null||event.key.startsWith('igroland-pixel-paint-v1:progress:'))render();});
  render();
})();
