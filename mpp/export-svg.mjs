/* Read-only, local SVG export. Does not alter or upload the Microsoft Project file. */
import {DAY,timelineRange,dateText,dependencyLines,workingHoursOnDate} from './model.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export function ganttSvg(model,tasks,options={}) {
  if(!model||!tasks?.length)throw new Error('Нет задач для выгрузки.');
  if(tasks.length>1000)throw new Error('Для SVG-экспорта выберите не более 1000 видимых задач (используйте поиск или сверните группы).');
  const pixel={day:18,week:8,month:3.2}[options.zoom]||8;
  const range=timelineRange(model);
  const chartWidth=Math.ceil(range.days*pixel);
  if(chartWidth>20000)throw new Error('Выбран слишком длинный период: уменьшите масштаб или экспортируйте CSV.');
  const row=26,left=290,header=66,width=left+chartWidth,height=header+tasks.length*row+28;
  if(height>27000)throw new Error('Слишком много строк для SVG: используйте поиск или сверните группы.');
  const out=['<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Диаграмма Ганта">',
  '<rect width="'+width+'" height="'+height+'" fill="#fff"/>',
  '<rect width="'+width+'" height="'+header+'" fill="#eaf2f1"/>',
  '<text x="12" y="25" font-size="16" font-family="Arial" fill="#274752" font-weight="bold">'+esc(model.title)+'</text>',
  '<text x="12" y="48" font-size="11" font-family="Arial" fill="#66818a">AYYY Project Viewer · экспорт для просмотра</text>',
  '<line x1="'+left+'" x2="'+left+'" y1="0" y2="'+height+'" stroke="#c6d6d7"/>'];
  for(let d=0;d<range.days;d+=30){
    const x=left+Math.round(d*pixel),date=range.start+d*DAY;
    if(x>width)break;
    out.push('<line x1="'+x+'" x2="'+x+'" y1="'+header+'" y2="'+(height-28)+'" stroke="#e2ebed"/>');
    out.push('<text x="'+(x+4)+'" y="'+(header-8)+'" font-size="10" font-family="Arial" fill="#536e77">'+esc(dateText(date))+'</text>');
  }
  if(options.showCalendar!==false && model.calendars?.length && model.calendar && range.days<=900){
    for(let d=0;d<range.days;d++){
      const hours=workingHoursOnDate(model,range.start+d*DAY,model.calendar);
      if(hours && !hours.length)
        out.push('<rect x="'+(left+Math.round(d*pixel))+'" y="'+header+'" width="'+Math.max(1,Math.ceil(pixel))+'" height="'+(tasks.length*row)+'" fill="#e5ebea" opacity=".55"/>');
    }
  }
  const critical=options.criticalIds||new Set();
  for(let i=0;i<tasks.length;i++){
    const task=tasks[i],y=header+i*row;
    if(i%2===1)out.push('<rect x="0" y="'+y+'" width="'+width+'" height="'+row+'" fill="#f9fbfb" opacity=".85"/>');
    out.push('<line x1="0" y1="'+(y+row)+'" x2="'+width+'" y2="'+(y+row)+'" stroke="#e9efee"/>');
    out.push('<text x="'+(12+Math.min(6,Math.max(0,task.level-1))*11)+'" y="'+(y+17)+'" font-size="11" font-family="Arial" fill="#244650">'+esc(((task.wbs?task.wbs+'  ':'')+task.name).slice(0,130))+'</text>');
    if(task.start==null||task.finish==null)continue;
    const x=left+Math.round((task.start-range.start)/DAY*pixel),right=left+Math.round((task.finish-range.start)/DAY*pixel)+pixel;
    if(x>width||right<left)continue;
    if(options.showBaseline!==false && task.baselineStart!=null && task.baselineFinish!=null){
      const bX=left+Math.round((task.baselineStart-range.start)/DAY*pixel),bRight=left+Math.round((task.baselineFinish-range.start)/DAY*pixel)+pixel;
      out.push('<rect x="'+bX+'" y="'+(y+21)+'" width="'+Math.max(2,bRight-bX)+'" height="3" fill="#969399"/>');
    }
    const fill=critical.has(task.uid)?'#c68068':task.summary?'#4d6870':'#438892';
    if(task.milestone || task.start===task.finish)out.push('<rect x="'+x+'" y="'+(y+7)+'" width="10" height="10" transform="rotate(45 '+(x+5)+' '+(y+12)+')" fill="#c99356"/>');
    else{
      out.push('<rect x="'+x+'" y="'+(y+6)+'" rx="2" width="'+Math.max(4,right-x)+'" height="14" fill="'+fill+'"/>');
      if(task.percent>0)out.push('<rect x="'+x+'" y="'+(y+6)+'" rx="2" width="'+Math.max(1,(right-x)*clamp(task.percent,0,100)/100)+'" height="14" fill="#224f61" opacity=".65"/>');
    }
  }
  if(options.showLinks!==false){
    const paths=dependencyLines(tasks,model.links||[],range.start,pixel,row);
    out.push('<g transform="translate('+left+','+header+')" fill="none" stroke="#6e9199" stroke-width="1.2">');
    for(const path of paths.slice(0,4000))out.push('<path d="'+esc(path.d)+'" '+(path.critical?'stroke="#b66f54"':'')+'/>');
    out.push('</g>');
  }
  if(options.showToday!==false){
    const now=new Date(),today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
    if(today>=range.start && today<range.start+range.days*DAY){
      const x=left+Math.round((today-range.start)/DAY*pixel);
      out.push('<line x1="'+x+'" y1="'+header+'" x2="'+x+'" y2="'+(height-28)+'" stroke="#d67753" stroke-width="1.5" stroke-dasharray="4 3"/>');
    }
  }
  out.push('<text x="12" y="'+(height-9)+'" font-size="10" font-family="Arial" fill="#6e858b">Только просмотр · '+tasks.length+' задач · '+esc(new Date().toISOString().slice(0,10))+'</text>');
  out.push('</svg>');
  return out.join('');
}
