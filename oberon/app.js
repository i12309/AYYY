(() => {
  'use strict';
  const pathKey = value => String(value).normalize('NFC').toLocaleLowerCase('ru');
  // Validate the resulting tree before changing any note, link, or folder.
  function pathProblem(snapshot, path, {folder=false, ignoreId=null}={}) {
    const issue=(code,message)=>({code,message});
    if(typeof path!=='string'||!path||/[\\\u0000-\u001f\u007f]/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'))
      return issue('INVALID_PATH','В пути есть недопустимые символы или пустая часть. Выберите другое имя.');
    if(path.split('/').some(part=>part.toLowerCase()==='.git'))
      return issue('INVALID_PATH','Имя .git зарезервировано. Выберите другое имя папки.');
    if(path.length>1024)return issue('PATH_LIMIT','Путь длиннее 1024 символов. Сократите имя или выберите папку ближе к корню.');
    if(!folder&&!/\.(md|markdown)$/i.test(path))return issue('INVALID_PATH','Заметка должна быть файлом .md или .markdown.');
    const key=pathKey(path),notes=(snapshot.notes||[]).filter(note=>note.id!==ignoreId);
    for(const note of notes){
      const other=pathKey(note.path);
      if(key===other)return issue('NAME_TAKEN',folder?'Этот путь уже занят заметкой. Выберите другое имя папки.':'В этой папке уже есть заметка с таким именем.');
      if(key.startsWith(other+'/'))return issue('FILE_PARENT','Путь «'+note.path+'» занят файлом. Выберите другую папку.');
      if(other.startsWith(key+'/'))return issue('NAME_TAKEN',folder?'Такая папка уже существует.':'Этот путь уже используется как папка. Выберите другое имя заметки.');
    }
    if((snapshot.folders||[]).some(existing=>{const other=pathKey(existing);return other===key||other.startsWith(key+'/');}))
      return issue('NAME_TAKEN',folder?'Такая папка уже существует.':'Этот путь уже занят папкой. Выберите другое имя заметки.');
    return null;
  }
  function availableNotePath(snapshot, path) {
    const extension=typeof path==='string'?path.match(/\.(md|markdown)$/i)?.[0]:null;
    const stem=extension?path.slice(0,-extension.length):path;
    let candidate=path,index=2;
    while(true){
      const problem=pathProblem(snapshot,candidate);
      if(!problem)return {path:candidate,error:''};
      if(problem.code!=='NAME_TAKEN')return {path:null,error:problem.message};
      candidate=stem+' ('+index+++')'+extension;
    }
  }
  function importName(name) {
    if(typeof name!=='string'||!/\.(md|markdown)$/i.test(name))return null;
    const stem=name.replace(/\.(md|markdown)$/i,'').replace(/[\\/:*?"<>|#\[\]\u0000-\u001f\u007f]/g,'_').trim().replace(/[. ]+$/g,'');
    return (stem||'Заметка')+'.md';
  }
  // Node tests exercise the same pure path rules without a browser fixture.
  if(typeof module!=='undefined'&&module.exports&&typeof document==='undefined'){
    module.exports={pathProblem,availableNotePath,importName};return;
  }
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    'search':'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
    'plus':'<path d="M12 5v14M5 12h14"/>',
    'x':'<path d="m6 6 12 12M18 6 6 18"/>',
    'folder':'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/>',
    'folder-open':'<path d="M3 10V6h7l2 2h8v3M3 11h19l-3 8H3Z"/>',
    'folder-plus':'<path d="M3 8V5h7l2 2h9v12H3V8Z M12 10v6M9 13h6"/>',
    'chevron-right':'<path d="m9 5 7 7-7 7"/>',
    'chevron-down':'<path d="m5 9 7 7 7-7"/>',
    'chevron-up':'<path d="m5 15 7-7 7 7"/>',
    'file':'<path d="M6 3h8l4 4v14H6Z M14 3v5h4M9 12h6M9 16h6"/>',
    'library':'<path d="M4 4v16M8 4v16M12 4v16M16 5l4 14"/>',
    'graph':'<path d="m8 7 8 2M8 9l3 8M16 11l-3 6"/><circle cx="5" cy="6" r="3"/><circle cx="19" cy="10" r="3"/><circle cx="12" cy="20" r="2.5"/>',
    'pin':'<path d="m9 3 9 3-4 4v5l-8-3 3-3V3ZM11 14l-4 7"/>',
    'fold':'<path d="m8 4 4 4 4-4M8 20l4-4 4 4M5 12h14"/>',
    'box':'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7 5l10 6"/>',
    'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h3M14 15h3"/>',
    'upload':'<path d="M12 16V3m-4 4 4-4 4 4M4 14v6h16v-6"/>',
    'download':'<path d="M12 3v13m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    'settings':'<path d="m10 3-1 3-3 1-3 3 2 2-1 4 3 2h3l2 3 3-2 3-1 2-3-1-3 1-3-3-2-3-1-1-2Z"/><circle cx="12" cy="12" r="3"/>',
    'help':'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 1-2 3M12 17v.1"/>',
    'github':'<path d="M9 19c-5 1-5-2-7-2M15 22v-4c0-1-.2-2-1-2 3-.5 6-1.5 6-6 0-1.3-.5-2.6-1.5-3.5.2-1 .2-2.5-.5-3.5-2 0-3.5 1-4 1a14 14 0 0 0-4 0C9 3.5 7.5 3 6 3c-.6 1-.7 2.5-.5 3.5A5 5 0 0 0 4 10c0 4.5 3 5.5 6 6-.7.5-1 1-1 2v4"/>',
    'moon':'<path d="M20.8 13.5A9 9 0 1 1 10.5 3a7 7 0 0 0 10.3 10.5Z"/>',
    'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2m-3-8-1.5 1.5M5.5 18.5 4 20M4 4l1.5 1.5M18.5 18.5 20 20"/>',
    'arrow-up-right':'<path d="M6 18 18 6M6 6h12v12"/>',
    'arrow-left':'<path d="M20 12H4m6-6-6 6 6 6"/>',
    'panel-left':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    'panel-right':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    'code':'<path d="m7 6-5 6 5 6m10-12 5 6-5 6M14 3l-4 18"/>',
    'columns':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
    'book':'<path d="M12 6C9 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 2Zm0 0v14"/>',
    'star':'<path d="m12 3 2.8 5.9 6.5 1-4.7 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4L2.7 10l6.5-1Z"/>',
    'expand':'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    'focus':'<path d="M3 8V3h5m8 0h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
    'more':'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    'list':'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
    'check-square':'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>',
    'link':'<path d="M10 13a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-3 3M14 11a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l3-3"/>',
    'quote':'<path d="M4 5h6v7H6c0 3 1 4 3 5l-2 2c-3-2-4-4-4-8V5Zm11 0h6v7h-4c0 3 1 4 3 5l-2 2c-3-2-4-4-4-8V5Z"/>',
    'spark':'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',
    'hash':'<path d="m10 3-4 18M18 3l-4 18M4 9h17M2 15h17"/>',
    'edit':'<path d="m15 4 5 5M3 21l5-1L21 7l-5-5L3 15v6Z"/>',
    'trash':'<path d="M3 6h18M9 3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    'copy':'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 4V3H3v13h1"/>',
    'check':'<path d="m5 12 4 4L20 5"/>',
    'info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>'
  };
  const icon = (name, cls='') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
  const hydrate = (root=document) => $$('[data-icon]',root).forEach(el => {el.innerHTML=icon(el.dataset.icon);});
  hydrate();
  const clone = x => JSON.parse(JSON.stringify(x));
  const seed = window.OBERON_SEED;
  const W = window.OberonWorkspace;
  const defaults=()=>({version:1,notes:[],folders:[],active:null,tabs:[],collapsed:['Библиотека','Личное'],mode:'read',theme:'paper',textSize:15,sidebarWidth:250,editorWidth:50,inspector:true,autoSync:true,syncConflict:null});
  let state=defaults();
  // Only the appearance preference is shared across spaces. Notes and repository
  // metadata are isolated by vault in IndexedDB; credentials stay in memory.
  try{const preferred=localStorage.getItem('ayyy.oberon.theme');if(['paper','night'].includes(preferred))state.theme=preferred;}catch(_){}
  let view='library', selectedFolder='', saveTimer, toastTimer, previousFocus, paletteIndex=0, lastDeleted=null;
  const app=$('#app'), editor=$('#editor'), modal=$('#modal');
  const md=window.OberonMarkdown;
  const active=()=>state.notes.find(n=>n.id===state.active);
  const basename=p=>p.split('/').pop().replace(/\.(md|markdown)$/i,'');
  const parent=p=>p.includes('/')?p.slice(0,p.lastIndexOf('/')):'';
  const uid=()=> 'n-'+(globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8));
  const title=n=>basename(n.path);
  const slug=pathKey;
  const noteTags=n=>[...new Set((n.content.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g,'').match(/(?:^|\s)#[\p{L}\p{N}_-]+/gu)||[]).map(x=>x.trim().slice(1)))];
  const normalPath = p => {
    const parts=[];
    for(const part of p.replace(/\\/g,'/').replace(/^OBERON\//i,'').split('/')) {
      if(!part||part==='.')continue;
      if(part==='..'){parts.pop();continue;}
      parts.push(part);
    }
    return parts.join('/');
  };
  function resolveWiki(raw, source=active()) {
    let ref=String(raw).split('|')[0].split('#')[0];
    try{ref=decodeURIComponent(ref);}catch(_){}
    ref=ref.replace(/\.md$/i,'').trim();
    if(!ref)return source;
    const direct=normalPath(ref), relative=normalPath((source?parent(source.path)+'/':'')+ref);
    const norm=n=>slug(n.path.replace(/\.md$/i,''));
    return state.notes.find(n=>norm(n)===slug(relative)) || state.notes.find(n=>norm(n)===slug(direct)) || state.notes.find(n=>slug(title(n))===slug(ref)) || state.notes.find(n=>slug(md.headings(n.content)[0]?.text||'')===slug(ref));
  }
  function edges(){
    const links=[],used=new Set();
    for(const note of state.notes)for(const target of md.wikiLinks(note.content)){
      const to=resolveWiki(target,note); if(!to||to.id===note.id)continue;
      const key=[note.id,to.id].sort().join('|');
      if(!used.has(key)){used.add(key);links.push([note.id,to.id]);}
    }
    return links;
  }
  function persist(announce=false){
    clearTimeout(saveTimer);
    return W.save(clone(state),announce);
  }
  function queueSave(){
    W.markPending();
    clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(),150);
  }
  function toast(message, undo){
    clearTimeout(toastTimer); const el=$('#toast');
    el.innerHTML=`<span>${esc(message)}</span>${undo?'<button id="undo-button">Отменить</button>':''}`;
    el.classList.add('visible');if(undo)$('#undo-button').onclick=()=>{undo();el.classList.remove('visible');};
    toastTimer=setTimeout(()=>el.classList.remove('visible'),undo?7000:3800);
  }
  function theme(){
    document.documentElement.dataset.theme=state.theme;
    document.documentElement.style.setProperty('--text-size',`${Math.min(20,Math.max(13,state.textSize||15))}px`);
    if(window.innerWidth>1250)document.documentElement.style.setProperty('--aside',`${Math.min(340,Math.max(210,state.sidebarWidth||250))}px`);
    else document.documentElement.style.removeProperty('--aside');
    document.documentElement.style.setProperty('--editor-width',Math.min(70,Math.max(30,state.editorWidth||50))+'%');
    $('.top-theme').innerHTML=icon(state.theme==='night'?'sun':'moon');
    app.classList.toggle('no-inspector',!state.inspector);
  }
  function toggleTheme(){state.theme=state.theme==='paper'?'night':'paper';theme();try{localStorage.setItem('ayyy.oberon.theme',state.theme);}catch(_){}if(W.hasActive())persist();}
  function treeRow(note,depth){return `<button class="tree-note${note.id===state.active?' active':''}" style="--depth:${depth}" data-note="${esc(note.id)}" title="${esc('OBERON/'+note.path)}" draggable="true" role="treeitem" aria-selected="${note.id===state.active}">${icon('file')}<span class="row-title">${esc(title(note))}</span>${note.favorite?'<span class="note-dot"></span>':''}</button>`;}
  function treeHTML(folder='',depth=0){
    let html='';
    const children=state.folders.filter(f=>parent(f)===folder);
    for(const path of children){
      const closed=state.collapsed.includes(path), count=state.notes.filter(n=>n.path.startsWith(path+'/')).length;
      html+=`<div role="group"><div class="tree-folder-row"><button type="button" class="tree-folder${selectedFolder===path?' selected':''}" data-folder="${esc(path)}" style="--depth:${depth}" role="treeitem" aria-expanded="${!closed}" aria-selected="${selectedFolder===path}" title="${esc(path)}">${icon(closed?'chevron-right':'chevron-down','chevron')}<span class="folder-icon">${icon(closed?'folder':'folder-open')}</span><span class="folder-name">${esc(path.split('/').pop())}</span><span class="folder-count">${count||''}</span></button><button type="button" class="tree-folder-add" data-action="new-subfolder" data-parent="${esc(path)}" title="Создать папку внутри ${esc(path)}" aria-label="Создать папку внутри ${esc(path)}">${icon('folder-plus')}</button></div>${closed?'':treeHTML(path,depth+1)}</div>`;
    }
    for(const note of state.notes.filter(n=>parent(n.path)===folder))html+=treeRow(note,depth+1);
    return html;
  }
  function renderLibrary(){
    $('#favorites').innerHTML=state.notes.filter(n=>n.favorite).map(n=>`<button class="favorite-row${n.id===state.active?' active':''}" data-note="${esc(n.id)}" title="${esc(title(n))}">${icon('star')}<span class="row-title">${esc(title(n))}</span></button>`).join('')||'<p class="root-empty">Закрепите важную заметку звёздочкой.</p>';
    $('#tree').innerHTML=`<button type="button" class="tree-root${selectedFolder===''?' selected':''}" role="treeitem" aria-selected="${selectedFolder===''}" data-select-root="true" data-drop-root="true" title="Выбрать корень OBERON">${icon('chevron-down')}${icon('box')}<span>OBERON</span><span class="tree-count">${state.notes.length}</span></button>${treeHTML()}`;
  }
  function renderTabs(){
    $('#tabs').innerHTML=state.tabs.map(id=>state.notes.find(n=>n.id===id)).filter(Boolean).map(n=>`<div class="tab${n.id===state.active?' active':''}"><button class="tab-open" role="tab" aria-selected="${n.id===state.active}" data-note="${esc(n.id)}" title="${esc(n.path)}">${icon('file')}<span class="tab-label">${esc(title(n))}</span></button><button class="tab-close" data-close-tab="${esc(n.id)}" title="Закрыть вкладку ${esc(title(n))}" aria-label="Закрыть вкладку ${esc(title(n))}">${icon('x')}</button></div>`).join('');
  }
  function renderInspector(note){
    const headings=md.headings(note?.content||'');
    $('#outline').innerHTML=headings.filter(h=>h.level<4).map(h=>`<button data-heading="${esc(h.id)}" data-line="${h.line}" style="padding-left:${h.level===1?14:20+(h.level-2)*9}px">${esc(h.text)}</button>`).join('')||'<p class="empty-note">Заголовки появятся здесь.</p>';
    const back=note?state.notes.filter(n=>n.id!==note.id&&md.wikiLinks(n.content).some(r=>resolveWiki(r,n)?.id===note.id)):[];
    $('#backlink-count').textContent=back.length;
    $('#backlinks').innerHTML=back.map(n=>`<button class="backlink" data-note="${esc(n.id)}"><strong>${icon('file')}${esc(title(n))}</strong><small>${esc(md.plainText(n.content.replace(/^# .+\n/, '')).slice(0,88))}</small></button>`).join('')||'<p class="empty-note">Здесь будут заметки, которые ссылаются на эту.</p>';
    $('#tags').innerHTML=note?noteTags(note).map(tag=>`<button class="tag-chip" data-tag="${esc(tag)}">#${esc(tag)}</button>`).join('')||'<p class="empty-note">Добавьте #метку в текст.</p>':'';
    const connected=note?edges().filter(e=>e.includes(note.id)).map(e=>e.find(id=>id!==note.id)):[];
    const pts=connected.slice(0,7).map((id,i,a)=>({id,x:100+Math.cos(i/a.length*Math.PI*2-.3)*66,y:61+Math.sin(i/a.length*Math.PI*2-.3)*40}));
    $('#mini-map').innerHTML=`<svg viewBox="0 0 200 122" aria-hidden="true">${pts.map(p=>`<line x1="100" y1="61" x2="${p.x}" y2="${p.y}" stroke="var(--muted)" opacity=".35" stroke-width=".7"/>`).join('')}${pts.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="${i%2?3.5:4.5}" fill="${i%2?'#859985':'#ab987b'}" opacity=".8"/>`).join('')}<circle cx="100" cy="61" r="12" stroke="var(--accent)" opacity=".2" fill="none"/><circle cx="100" cy="61" r="5" fill="var(--accent)"/><circle cx="36" cy="25" r="1.5" fill="var(--muted)" opacity=".4"/><circle cx="168" cy="101" r="1" fill="var(--muted)" opacity=".5"/></svg>`;
  }
  function renderDerived(){
    const note=active();
    $('#preview').innerHTML=note?md.render(note.content):'<div class="empty-workspace"><h1>Место для новой мысли.</h1><p>Создайте заметку или откройте её в библиотеке.</p><button class="primary-button" data-action="new">Новая заметка</button></div>';
    const text=md.plainText(note?.content||''), words=(text.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)||[]).length;
    $('#word-count').textContent=`${words} ${words%10===1&&words%100!==11?'слово':words%10>=2&&words%10<=4&&(words%100<12||words%100>14)?'слова':'слов'}`;
    $('#char-count').textContent=`${(note?.content.length||0).toLocaleString('ru')} знаков`;
    $('#note-category').textContent=note?(parent(note.path).split('/').pop()||'OBERON').toUpperCase():'';
    const related=note?[...new Set(md.wikiLinks(note.content).map(r=>resolveWiki(r,note)?.id).filter(id=>id&&id!==note.id))].slice(0,3):[];
    $('#note-related').innerHTML=related.map(id=>{const n=state.notes.find(x=>x.id===id);return `<button class="related-chip" data-note="${esc(id)}">${icon('link')}${esc(title(n))}</button>`;}).join('');
    renderInspector(note);
  }
  function renderNote(){
    const note=active();
    editor.value=note?.content||'';editor.disabled=!note;
    const parts=note?note.path.split('/'):['OBERON'];
    $('#breadcrumbs').innerHTML=icon('folder')+parts.map((part,i)=>`<span class="${i===parts.length-1?'breadcrumb-title':''}">${esc(part)}</span>${i<parts.length-1?'<span>/</span>':''}`).join('');
    $('#favorite-button').classList.toggle('favorite-active',!!note?.favorite);
    $('#favorite-button').setAttribute('aria-pressed',String(!!note?.favorite));
    $('#favorite-button').title=note?.favorite?'Открепить заметку':'Закрепить заметку';
    $('#favorite-button').setAttribute('aria-label',$('#favorite-button').title);
    $('#workspace').dataset.mode=state.mode;
    $$('[data-mode]', $('.view-switch')).forEach(el=>{el.classList.toggle('active',el.dataset.mode===state.mode);el.setAttribute('aria-pressed',String(el.dataset.mode===state.mode));});
    renderDerived();document.title=note?`${title(note)} — OBERON`:'OBERON — пространство для мыслей';
  }
  function render(){theme();renderLibrary();renderTabs();renderNote();renderView();}
  function renderView(){
    $('#workspace').hidden=view==='graph';$('#graph-view').hidden=view!=='graph';
    $('#library-button').classList.toggle('active',view==='library');$('#graph-button').classList.toggle('active',view==='graph');
    $('.note-toolbar').style.display=view==='graph'?'none':'';
    if(view==='graph')renderGraph();
  }
  function openNote(id,mode){
    const note=state.notes.find(n=>n.id===id);if(!note)return;
    state.active=id;selectedFolder=parent(note.path);
    if(!state.tabs.includes(id))state.tabs.push(id);
    if(state.tabs.length>8)state.tabs.shift();
    for(let path=parent(note.path);path;path=parent(path))state.collapsed=state.collapsed.filter(f=>f!==path);
    if(mode)state.mode=mode;view='library';closeDrawers();render();persist();
    $('#reading-pane').scrollTop=0;editor.scrollTop=0;
    requestAnimationFrame(()=>$('.tab.active')?.scrollIntoView({block:'nearest',inline:'nearest'}));
    if(mode==='edit')editor.focus();
  }
  function setMode(mode){state.mode=mode;view='library';renderNote();renderView();persist();if(mode!=='read'){editor.focus();editor.setSelectionRange(editor.value.length,editor.value.length);}}
  function closeTab(id){
    const i=state.tabs.indexOf(id);state.tabs=state.tabs.filter(t=>t!==id);
    if(state.active===id)state.active=state.tabs[Math.min(i,state.tabs.length-1)]||null;
    render();persist();
  }
  function closeDrawers(){app.classList.remove('show-sidebar','show-inspector');$('#drawer-scrim').hidden=true;}
  function openDialog(html,cls=''){
    previousFocus=document.activeElement;$('#popover').hidden=true;
    $('#modal-content').innerHTML=html;modal.className='modal '+cls;
    if(!modal.open)modal.showModal();
    const focus=$('[autofocus]',modal)||$('input,button,select',modal);requestAnimationFrame(()=>focus?.focus());
  }
  function closeDialog(){modal.close();if(previousFocus?.isConnected)previousFocus.focus();}
  const dialogHeader=(name,description='')=>`<div class="modal-header"><div><h2>${esc(name)}</h2>${description?`<p>${esc(description)}</p>`:''}</div><button class="icon-button" data-action="close-modal" aria-label="Закрыть">${icon('x')}</button></div>`;
  const folderOptions=(chosen)=>[...new Set(['',...state.folders,...(chosen?[chosen]:[])])].map(f=>`<option value="${esc(f)}"${f===chosen?' selected':''}>${esc(f?'OBERON / '+f:'OBERON /')}${f&&!state.folders.includes(f)?' (новая папка)':''}</option>`).join('');
  function ensureFolder(folder){let path='';for(const part of folder.split('/').filter(Boolean)){path+=(path?'/':'')+part;if(!state.folders.includes(path))state.folders.push(path);}}
  function validName(name){return name.length>0&&name.length<160&&!/[\\/:*?"<>|#\[\]\u0000-\u001f\u007f]/.test(name)&&!/^\.{1,2}$/.test(name)&&name.toLowerCase()!=='.git'&&!/[. ]$/.test(name);}
  function noteDialog(kind='new',suggested='',destination=selectedFolder){
    const note=active(), rename=kind==='rename', move=kind==='move';
    if((rename||move)&&!note)return;
    openDialog(dialogHeader(move?'Переместить заметку':rename?'Переименовать заметку':'Новая мысль',move?'Заметка останется обычным Markdown-файлом.':rename?'Внутренние ссылки на файл обновятся.':'У каждой большой идеи есть первая строка.')+`<form id="note-form"><div class="modal-body">${move?'':`<label class="modal-field"><span>Название файла</span><input id="note-name" name="name" value="${esc(rename?title(note):suggested)}" placeholder="О чём хочется написать?" maxlength="160" autocomplete="off" autofocus required></label>`}<label class="modal-field"><span>Папка</span><select id="note-folder" ${move?'autofocus':''}>${folderOptions((rename||move)?parent(note.path):destination)}</select></label><p class="form-error" id="form-error"></p></div><div class="modal-footer"><button class="secondary-button" type="button" data-action="close-modal">Отмена</button><button class="primary-button" type="submit">${icon(move?'folder':rename?'check':'plus')}${move?'Переместить':rename?'Сохранить':'Создать заметку'}</button></div></form>`);
    $('#note-form').onsubmit=e=>{
      e.preventDefault();const name=move?title(note):$('#note-name').value.trim().replace(/\.(md|markdown)$/i,''), folder=$('#note-folder').value;
      if(!move&&!validName(name)){$('#form-error').textContent='Уберите из имени / \\ : * ? " < > | # [ ], управляющие символы и точку в конце. Имя .git зарезервировано.';return;}
      const path=(folder?folder+'/':'')+(move?note.path.split('/').pop():name+'.md');
      const problem=pathProblem(state,path,{ignoreId:rename||move?note.id:null});
      if(problem){$('#form-error').textContent=problem.message;return;}
      if(rename||move){if(!changePath(note,path))return;closeDialog();render();persist();toast(move?'Заметка перемещена':'Название и ссылки обновлены');}
      else{ensureFolder(folder);const n={id:uid(),path,content:'# '+name+'\n\n',favorite:false,updated:new Date().toISOString()};state.notes.push(n);closeDialog();openNote(n.id,'edit');}
    };
    if(rename){requestAnimationFrame(()=>$('#note-name').select());}
  }
  function changePath(note,newPath){
    const problem=pathProblem(state,newPath,{ignoreId:note.id});
    if(problem){toast(problem.message);return false;}
    const oldTitle=title(note),newTitle=basename(newPath);
    const relativePath=(from,to)=>{const a=from.split('/').filter(Boolean),b=to.split('/');while(a.length&&b.length&&a[0]===b[0]){a.shift();b.shift();}return [...a.map(()=>'..'),...b].join('/');};
    const updates=state.notes.map(n=>{
      const content=md.rewriteLinks(n.content,(ref,kind)=>{
        const target=resolveWiki(ref,n);
        if(!target||(target.id!==note.id&&n.id!==note.id))return ref;
        const anchor=ref.includes('#')?'#'+ref.split('#').slice(1).join('#'):'';
        const sourceFolder=parent(n.id===note.id?newPath:n.path),targetPath=target.id===note.id?newPath:target.path;
        const path=relativePath(sourceFolder,targetPath);
        return (kind==='wiki'?path.replace(/\.md$/i,''):path)+anchor;
      });
      return [n,content];
    });
    for(const [n,content]of updates){if(n.content!==content){n.content=content;n.updated=new Date().toISOString();}}
    note.path=newPath;
    if(note.content.startsWith('# '+oldTitle+'\n'))note.content='# '+newTitle+note.content.slice(oldTitle.length+2);
    note.updated=new Date().toISOString();selectedFolder=parent(newPath);
    for(let f=selectedFolder;f;f=parent(f))state.collapsed=state.collapsed.filter(x=>x!==f);
    return true;
  }
  function newFolder(parentFolder=selectedFolder){
    const destination=parentFolder&&state.folders.includes(parentFolder)?parentFolder:'';
    openDialog(dialogHeader('Новая папка',destination?'Внутри OBERON / '+destination:'В корне OBERON')+`<form id="folder-form"><div class="modal-body"><label class="modal-field"><span>Название</span><input id="folder-name" maxlength="100" placeholder="Например, Наблюдения" autofocus required></label><label class="modal-field"><span>Внутри папки</span><select id="folder-parent">${folderOptions(destination)}</select></label><p class="form-error" id="form-error"></p></div><div class="modal-footer"><button type="button" class="secondary-button" data-action="close-modal">Отмена</button><button class="primary-button" type="submit">${icon('folder-plus')}Создать папку</button></div></form>`);
    $('#folder-form').onsubmit=e=>{e.preventDefault();const name=$('#folder-name').value.trim(),p=$('#folder-parent').value,path=(p?p+'/':'')+name;if(!validName(name)){$('#form-error').textContent='Введите имя без недопустимых символов и точки в конце. Имя .git зарезервировано.';return;}const problem=pathProblem(state,path,{folder:true});if(problem){$('#form-error').textContent=problem.message;return;}state.folders.push(path);selectedFolder=path;for(let f=path;f;f=parent(f))state.collapsed=state.collapsed.filter(x=>x!==f);closeDialog();renderLibrary();persist();toast('Папка создана в OBERON / '+path);};
  }
  function deleteNote(){
    const note=active();if(!note)return;
    openDialog(dialogHeader('Удалить заметку?',title(note))+`<div class="modal-body"><p>${W.isGithub()?'Файл будет удалён из пространства, а при следующей синхронизации — из папки OBERON в GitHub.':'Файл будет удалён из локального демо.'} Сразу после удаления действие можно отменить.</p></div><div class="modal-footer"><button class="secondary-button" data-action="close-modal">Оставить</button><button class="primary-button danger-button" id="confirm-delete">Удалить заметку</button></div>`);
    $('#confirm-delete').onclick=()=>{
      const index=state.notes.indexOf(note),vaultId=W.activeId();lastDeleted={note:clone(note),index};state.notes.splice(index,1);state.tabs=state.tabs.filter(id=>id!==note.id);state.active=state.tabs.at(-1)||state.notes[0]?.id||null;if(state.active&&!state.tabs.includes(state.active))state.tabs.push(state.active);closeDialog();W.delayDeletion();render();persist();toast('Заметка удалена',()=>{if(!lastDeleted||W.activeId()!==vaultId)return;const restored=lastDeleted,path=uniquePath(restored.note.path);if(!path)return;state.notes.splice(restored.index,0,{...restored.note,path});lastDeleted=null;openNote(restored.note.id);});
    };
  }
  function uniquePath(path){const result=availableNotePath(state,path);if(result.error)toast(result.error);return result.path;}
  function duplicate(){const note=active();if(!note)return;const path=uniquePath(note.path);if(!path)return;const copy={...clone(note),id:uid(),path,favorite:false,updated:new Date().toISOString()};state.notes.push(copy);openNote(copy.id);toast('Создана копия заметки');}
  function daily(){
    const d=new Date(),date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    const path='Личное/'+date+'.md',existing=state.notes.find(n=>n.path===path);if(existing){openNote(existing.id);return;}
    const problem=pathProblem(state,path);if(problem){toast(problem.message);return;}
    if(!state.folders.includes('Личное'))state.folders.push('Личное');
    const note={id:uid(),path,content:`# ${d.toLocaleDateString('ru',{day:'numeric',month:'long',year:'numeric'})}\n\n## Главное на сегодня\n\n- [ ] \n\n## Что хочется запомнить\n\n\n\n#дневник\n`,favorite:false,updated:d.toISOString()};state.notes.push(note);openNote(note.id,'edit');
  }
  function noteMenu(anchor){
    if(!active())return;const pop=$('#popover');
    if(!pop.hidden){pop.hidden=true;return;}
    pop.innerHTML=[['rename','edit','Переименовать'],['move','folder','Переместить'],['duplicate','copy','Создать копию'],['download','download','Скачать .md'],['export','box','Скачать всё хранилище']].map(([action,i,label])=>`<button data-action="${action}">${icon(i)}${label}</button>`).join('')+`<hr><button class="danger" data-action="delete">${icon('trash')}Удалить заметку</button>`;
    pop.hidden=false;const r=anchor.getBoundingClientRect();pop.style.left=Math.max(8,Math.min(window.innerWidth-230,r.right-220))+'px';pop.style.top=Math.min(window.innerHeight-pop.offsetHeight-12,r.bottom+7)+'px';
  }
  function search(query=''){
    openDialog(`<div class="palette-top">${icon('search')}<input id="search-input" value="${esc(query)}" aria-label="Поиск заметок" placeholder="Найти заметку, фразу или #метку…" autocomplete="off" autofocus><button data-action="close-modal" aria-label="Закрыть поиск"><kbd>Esc</kbd></button></div><div class="palette-results" id="search-results"></div><div class="palette-bottom"><span><kbd>↑ ↓</kbd>выбрать</span><span><kbd>↵</kbd>открыть</span><span>По названиям и содержимому</span></div>`,'palette');
    const input=$('#search-input');paletteIndex=0;renderSearch(query);
    input.oninput=()=>{paletteIndex=0;renderSearch(input.value);};
    input.onkeydown=e=>{
      const results=$$('.search-result',modal);if(!results.length)return;
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();paletteIndex=(paletteIndex+(e.key==='ArrowDown'?1:-1)+results.length)%results.length;results.forEach((r,i)=>r.classList.toggle('selected',i===paletteIndex));results[paletteIndex].scrollIntoView({block:'nearest'});}
      if(e.key==='Enter'){e.preventDefault();results[paletteIndex]?.click();}
    };
  }
  function renderSearch(q){
    const query=slug(q.trim()), list=state.notes.filter(n=>!query||slug(n.path+'\n'+n.content).includes(query));
    const highlight=text=>{const index=slug(text).indexOf(query);if(!query||index<0)return esc(text);return esc(text.slice(0,index))+'<mark>'+esc(text.slice(index,index+query.length))+'</mark>'+esc(text.slice(index+query.length));};
    $('#search-results').innerHTML=`<div class="palette-section-label">${q?'НАЙДЕНО: '+list.length:'ЗАМЕТКИ В ВАШЕЙ ОРБИТЕ'}</div>`+list.map((n,i)=>{
      const plain=md.plainText(n.content),index=slug(plain).indexOf(query),snippet=plain.slice(Math.max(0,index-25),Math.max(0,index-25)+100);
      return `<button class="search-result${i===paletteIndex?' selected':''}" data-search-note="${esc(n.id)}">${icon('file')}<div><strong>${highlight(title(n))}</strong><small>${q?highlight(snippet):esc('OBERON / '+n.path)}</small></div>${icon('arrow-up-right')}</button>`;
    }).join('')+(!list.length?`<div class="empty-workspace" style="padding:28px"><p>Такой мысли пока нет.</p><button class="quiet-button" id="search-create">${icon('plus')}Создать заметку</button></div>`:'');
    $('#search-create')?.addEventListener('click',()=>{const name=$('#search-input').value.trim().replace(/^#/,'');closeDialog();noteDialog('new',name);});
  }
  function graphLayout(){
    const nodes=state.notes,center=nodes.find(n=>n.id===state.active)||nodes[0];if(!center)return [];
    const others=nodes.filter(n=>n!==center), small=window.innerWidth<761;
    const points=[{note:center,x:small?300:450,y:small?260:250}];
    others.forEach((note,i)=>{const angle=-Math.PI/2+i/Math.max(1,others.length)*Math.PI*2,r=i%3===0?.73:1;points.push({note,x:(small?300:450)+Math.cos(angle)*(small?220:320)*r,y:(small?260:250)+Math.sin(angle)*(small?210:175)*r});});return points;
  }
  function renderGraph(){
    const points=graphLayout(),links=edges(),map=Object.fromEntries(points.map(p=>[p.note.id,p])),small=window.innerWidth<761;
    $('#graph-canvas').innerHTML=`<svg viewBox="0 0 ${small?'600 520':'900 500'}" role="group" aria-label="Карта связей между ${state.notes.length} заметками"><ellipse cx="${small?300:450}" cy="${small?260:250}" rx="${small?230:333}" ry="${small?218:190}" fill="none" stroke="#9baa8d" stroke-width=".6" opacity=".16" stroke-dasharray="2 9"/>${links.map(([a,b])=>{const p=map[a],q=map[b];if(!p||!q)return '';const on=a===state.active||b===state.active;return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${on?'#c9ac80':'#91a28c'}" stroke-width="${on?1:0.6}" opacity="${on?.5:.18}"/>`;}).join('')}${points.map(({note,x,y})=>{const on=note.id===state.active,color=on?'#dbb98b':note.path.startsWith('Проекты')?'#92ab90':note.path.startsWith('Библиотека')?'#a3b1bf':'#bda180';const label=title(note);return `<g class="graph-node${on?' active':''}" transform="translate(${x},${y})" data-note="${esc(note.id)}" role="button" tabindex="0" aria-label="Открыть ${esc(label)}"><title>${esc(note.path)}</title>${on?'<circle r="30" fill="none" stroke="#ddbd8c" stroke-width=".8" opacity=".25"/><circle r="21" fill="none" stroke="#ddbd8c" stroke-width=".7" opacity=".3"/>':''}<circle r="${on?10:6}" fill="${color}" stroke="${color}" stroke-width=".5"/><circle r="18" fill="transparent" stroke="none"/><text y="${on?48:28}">${esc(label.length>23?label.slice(0,22)+'…':label)}</text></g>`;}).join('')}</svg>`;
    $('#graph-stats').textContent=`${state.notes.length} заметок · ${links.length} связей`;
  }
  function settings(){
    openDialog(dialogHeader('Чуть ближе к себе','Настройте пространство для спокойной работы.')+`<div class="modal-body"><div class="setting-row"><div>Оформление<small>Тёплая бумага или вечерний графит</small></div><div class="theme-choices"><button class="theme-choice${state.theme==='paper'?' active':''}" data-set-theme="paper">Бумага</button><button class="theme-choice${state.theme==='night'?' active':''}" data-set-theme="night">Ночь</button></div></div><div class="setting-row"><div>Размер текста<small id="font-value">${state.textSize} px</small></div><input id="font-size" type="range" min="13" max="20" value="${state.textSize}" aria-label="Размер текста"></div><div class="setting-row"><div>Ваши заметки<small>${state.notes.length} файлов · ${state.folders.length} папок</small></div><button class="secondary-button" data-action="export">Скачать архив</button></div><div class="modal-notice" style="margin-top:20px">${icon('box')}<p>${W.isGithub()?'Черновики сохраняются в браузере. Синхронизацией с GitHub можно управлять через индикатор в верхней панели.':'Демо сохраняется в браузере на этом устройстве. Чтобы хранить собственные заметки в GitHub, подключите репозиторий на странице пространств.'}</p></div></div><div class="modal-footer"><button class="primary-button" data-action="close-modal">Готово</button></div>`);
    $('#font-size').oninput=e=>{state.textSize=Number(e.target.value);$('#font-value').textContent=state.textSize+' px';theme();queueSave();};
  }
  function help(){
    openDialog(dialogHeader('Меньше движений. Больше мысли.','Клавиши, которые быстро становятся привычкой.')+`<div class="modal-body">${[['Поиск по всем заметкам','Ctrl / ⌘ K'],['Новая заметка вне поля ввода','N'],['Сохранить и синхронизировать','Ctrl / ⌘ S'],['Чтение ↔ редактирование','Ctrl / ⌘ E'],['Полужирный текст в редакторе','Ctrl / ⌘ B'],['Режим фокуса','Alt F'],['Закрыть окно или выйти из фокуса','Esc']].map(([a,b])=>`<div class="shortcut-row"><span>${a}</span><kbd>${b}</kbd></div>`).join('')}<p style="color:var(--muted);margin-top:20px">Связывайте заметки через <code>[[Название]]</code>. Перетащите файл на папку, чтобы переместить его. В режиме чтения можно отмечать выполненные задачи.</p></div><div class="modal-footer"><button class="secondary-button" id="open-markdown-help">Открыть памятку Markdown</button><button class="primary-button" data-action="close-modal">Понятно</button></div>`);
    $('#open-markdown-help').onclick=()=>{const n=state.notes.find(n=>title(n)==='Коротко о Markdown');closeDialog();if(n)openNote(n.id);else search('Markdown');};
  }
  function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function downloadNote(){const n=active();if(!n)return;downloadBlob(new Blob([n.content],{type:'text/markdown;charset=utf-8'}),n.path.split('/').pop());toast('Markdown-файл подготовлен');}
  function exportVault(vaultState=state){
    // ZIP, stored method: UTF-8 filenames, standard CRC-32, no server or dependency.
    const enc=new TextEncoder(),chunks=[],central=[],now=new Date(),dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1),dosDate=((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
    let offset=0;const table=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
    const crc=data=>{let c=0xffffffff;for(const b of data)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
    const files=[...vaultState.folders.map(f=>({path:'OBERON/'+f+'/',content:''})),...vaultState.notes.map(n=>({path:'OBERON/'+n.path,content:n.content}))];
    for(const file of files){
      const name=enc.encode(file.path),data=enc.encode(file.content),sum=crc(data),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(10,dosTime,true);v.setUint16(12,dosDate,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30);chunks.push(h,data);
      const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(12,dosTime,true);w.setUint16(14,dosDate,true);w.setUint32(16,sum,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(38,file.path.endsWith('/')?16:0,true);w.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=h.length+data.length;
    }
    const centralLength=central.reduce((s,c)=>s+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralLength,true);v.setUint32(16,offset,true);
    downloadBlob(new Blob([...chunks,...central,end],{type:'application/zip'}),'OBERON.zip');toast('Архив OBERON.zip подготовлен');
  }
  function format(type){
    if(!active())return;if(state.mode==='read')setMode('edit');editor.focus();
    const a=editor.selectionStart,b=editor.selectionEnd,text=editor.value,selection=text.slice(a,b);let insert,from,to;
    const wraps={bold:['**','**','важная мысль'],italic:['*','*','мысль'],link:['[[',']]','Название заметки'],code:['\n```js\n','\n```\n','// код']};
    if(wraps[type]){const [left,right,fallback]=wraps[type];insert=left+(selection||fallback)+right;from=a+left.length;to=from+(selection||fallback).length;}
    else{const prefix=({h2:'## ',list:'- ',task:'- [ ] ',quote:'> '})[type];if(!prefix)return;const start=text.lastIndexOf('\n',a-1)+1,end=b;editor.setSelectionRange(start,end);insert=text.slice(start,end).split('\n').map(s=>prefix+s).join('\n');from=start+prefix.length;to=start+insert.length;}
    editor.setRangeText(insert,editor.selectionStart,editor.selectionEnd,'end');editor.setSelectionRange(from,to);editor.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function toggleFocus(){const is=app.classList.toggle('focus');$('#focus-label').textContent=is?'Выйти из фокуса':'Фокус';closeDrawers();if(view==='graph')renderGraph();}
  const actions={
    vaults:()=>W.home(), home:()=>openNote(state.notes.find(n=>n.id===seed.active)?.id||state.notes[0]?.id),
    new:()=>noteDialog(), 'new-folder':()=>newFolder(), 'new-subfolder':button=>newFolder(button.dataset.parent),
    search:()=>search(), graph:()=>{view='graph';closeDrawers();renderView();},library:()=>{view='library';closeDrawers();renderView();},
    github:()=>W.connection(), theme:toggleTheme,settings,help,
    today:daily,import:()=>$('#import-input').click(),export:()=>exportVault(state),download:downloadNote,
    favorite:()=>{const n=active();if(!n)return;n.favorite=!n.favorite;renderLibrary();renderNote();persist();toast(n.favorite?'Заметка теперь под рукой':'Заметка откреплена');},
    focus:toggleFocus,
    sidebar:()=>{const show=!app.classList.contains('show-sidebar');closeDrawers();app.classList.toggle('show-sidebar',show);$('#drawer-scrim').hidden=!show;},
    inspector:()=>{if(window.innerWidth<=1020){const show=!app.classList.contains('show-inspector');closeDrawers();app.classList.toggle('show-inspector',show);$('#drawer-scrim').hidden=!show;}else{state.inspector=!state.inspector;theme();persist();}},
    collapse:()=>{state.collapsed=state.collapsed.length===state.folders.length?[]:[...state.folders];renderLibrary();persist();},
    'close-modal':closeDialog,'note-menu':noteMenu,rename:()=>noteDialog('rename'),move:()=>noteDialog('move'),duplicate,delete:deleteNote
  };
  document.addEventListener('click',e=>{
    const action=e.target.closest('[data-action]');if(action){const name=action.dataset.action;if(name!=='note-menu')$('#popover').hidden=true;actions[name]?.(action);return;}
    const searchNote=e.target.closest('[data-search-note]');if(searchNote){const id=searchNote.dataset.searchNote;closeDialog();openNote(id);return;}
    const tabClose=e.target.closest('[data-close-tab]');if(tabClose){closeTab(tabClose.dataset.closeTab);return;}
    const note=e.target.closest('[data-note]');if(note){openNote(note.dataset.note);return;}
    if(e.target.closest('[data-select-root]')){selectedFolder='';renderLibrary();return;}
    const folder=e.target.closest('[data-folder]');if(folder){selectedFolder=folder.dataset.folder;state.collapsed=state.collapsed.includes(selectedFolder)?state.collapsed.filter(f=>f!==selectedFolder):[...state.collapsed,selectedFolder];renderLibrary();persist();return;}
    const mode=e.target.closest('.view-switch [data-mode]');if(mode){setMode(mode.dataset.mode);return;}
    const formatting=e.target.closest('[data-format]');if(formatting){format(formatting.dataset.format);return;}
    const wiki=e.target.closest('[data-wiki]');if(wiki){e.preventDefault();const raw=wiki.dataset.wiki,target=resolveWiki(raw);if(target){openNote(target.id);const hash=raw.split('#')[1];if(hash){const h=md.headings(target.content).find(h=>slug(h.text)===slug(hash));if(h)requestAnimationFrame(()=>document.getElementById(h.id)?.scrollIntoView({block:'start'}));}}else{let ref=raw.split('#')[0];try{ref=decodeURIComponent(ref);}catch(_){}const full=normalPath(ref.startsWith('.')?parent(active()?.path||'')+'/'+ref:ref),folder=full.includes('/')?parent(full):selectedFolder;noteDialog('new',basename(full),folder);}return;}
    const tag=e.target.closest('[data-tag]');if(tag){e.preventDefault();search('#'+tag.dataset.tag);return;}
    const heading=e.target.closest('[data-heading]');if(heading){if(state.mode==='edit'){const pos=editor.value.split('\n').slice(0,Number(heading.dataset.line)).join('\n').length;editor.focus();editor.setSelectionRange(pos?pos+1:0,pos?pos+1:0);editor.scrollTop=Number(heading.dataset.line)*26;}else document.getElementById(heading.dataset.heading)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
    const themeChoice=e.target.closest('[data-set-theme]');if(themeChoice){state.theme=themeChoice.dataset.setTheme;theme();try{localStorage.setItem('ayyy.oberon.theme',state.theme);}catch(_){}persist();$$('[data-set-theme]').forEach(el=>el.classList.toggle('active',el.dataset.setTheme===state.theme));return;}
    if(!e.target.closest('#popover'))$('#popover').hidden=true;
  });
  $('#drawer-scrim').onclick=closeDrawers;
  modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
  editor.addEventListener('input',()=>{const note=active();if(!note)return;note.content=editor.value;note.updated=new Date().toISOString();renderDerived();queueSave();});
  editor.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();editor.setRangeText('  ',editor.selectionStart,editor.selectionEnd,'end');editor.dispatchEvent(new Event('input',{bubbles:true}));}});
  $('#preview').addEventListener('change',e=>{
    if(!e.target.matches('input[type=checkbox][data-line]'))return;const n=active();if(!n)return;const lines=n.content.split('\n'),i=Number(e.target.dataset.line);if(i<0||i>=lines.length)return;lines[i]=lines[i].replace(/\[([ xX])\]/,'['+(e.target.checked?'x':' ')+']');n.content=lines.join('\n');n.updated=new Date().toISOString();editor.value=n.content;renderDerived();queueSave();
  });
  $('#tree').addEventListener('contextmenu',e=>{const el=e.target.closest('[data-note]');if(el){e.preventDefault();const rect=el.getBoundingClientRect();openNote(el.dataset.note);noteMenu({getBoundingClientRect:()=>rect});}});
  $('#tree').addEventListener('dragstart',e=>{const note=e.target.closest('[data-note]');if(!note)return;e.dataTransfer.setData('text/x-oberon-note',note.dataset.note);e.dataTransfer.effectAllowed='move';});
  $('#tree').addEventListener('dragover',e=>{const folder=e.target.closest('[data-folder],[data-drop-root]');if(folder&&[...e.dataTransfer.types].includes('text/x-oberon-note')){e.preventDefault();e.dataTransfer.dropEffect='move';folder.classList.add('drop-target');}});
  $('#tree').addEventListener('dragleave',e=>e.target.closest('.drop-target')?.classList.remove('drop-target'));
  $('#tree').addEventListener('drop',e=>{const folder=e.target.closest('[data-folder],[data-drop-root]');if(!folder)return;const id=e.dataTransfer.getData('text/x-oberon-note'),n=state.notes.find(n=>n.id===id);if(!n)return;e.preventDefault();const dest=folder.dataset.folder||'',path=(dest?dest+'/':'')+n.path.split('/').pop();$$('.drop-target').forEach(el=>el.classList.remove('drop-target'));if(!changePath(n,path))return;render();persist();toast('Заметка перемещена');});
  $('#import-input').addEventListener('change',async e=>{
    let count=0,skipped=0,reason='';const dest='Импорт',vaultId=W.activeId();
    for(const file of e.target.files){const safe=importName(file.name);if(!safe||file.size>2*1024*1024){skipped++;reason=reason||'Поддерживаются Markdown-файлы до 2 МБ.';continue;}try{const content=await file.text();if(W.activeId()!==vaultId){e.target.value='';toast('Импорт остановлен: открыто другое пространство.');return;}const result=availableNotePath(state,dest+'/'+safe);if(result.error){skipped++;reason=reason||result.error;continue;}if(!state.folders.includes(dest))state.folders.push(dest);state.notes.push({id:uid(),path:result.path,content,favorite:false,updated:new Date().toISOString()});count++;}catch(_){skipped++;reason=reason||'Не удалось прочитать файл.';}}
    e.target.value='';if(count){state.collapsed=state.collapsed.filter(f=>f!==dest);openNote(state.notes.at(-1).id);}toast(`Импортировано: ${count}${skipped?'. Пропущено: '+skipped+'. '+reason:''}`);
  });
  document.addEventListener('keydown',e=>{
    if(app.hidden)return;
    const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(W.isGithub())void W.sync();else void persist(true);return;}
    if(modal.open)return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='e'){e.preventDefault();setMode(state.mode==='read'?'edit':'read');return;}
    if((e.ctrlKey||e.metaKey)&&e.target===editor&&['b','i'].includes(e.key.toLowerCase())){e.preventDefault();format(e.key.toLowerCase()==='b'?'bold':'italic');return;}
    if(e.altKey&&e.key.toLowerCase()==='f'){e.preventDefault();toggleFocus();return;}
    if(e.key==='Escape'){closeDrawers();$('#popover').hidden=true;if(app.classList.contains('focus'))toggleFocus();}
    if(!typing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==='n'){e.preventDefault();noteDialog();}
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('.graph-node')){e.preventDefault();openNote(e.target.dataset.note);}
  });
  function resizeHandler(el,type){
    el.addEventListener('pointerdown',e=>{if(type==='editor'&&window.innerWidth<761)return;el.setPointerCapture(e.pointerId);document.body.style.cursor='col-resize';document.body.style.userSelect='none';
      const move=ev=>{if(type==='sidebar'){state.sidebarWidth=Math.min(340,Math.max(210,ev.clientX));document.documentElement.style.setProperty('--aside',state.sidebarWidth+'px');}else{const r=$('#workspace').getBoundingClientRect(),p=Math.min(70,Math.max(30,(ev.clientX-r.left)/r.width*100));state.editorWidth=p;document.documentElement.style.setProperty('--editor-width',p+'%');}};
      const done=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',done);el.removeEventListener('pointercancel',done);document.body.style.cursor='';document.body.style.userSelect='';persist();};
      el.addEventListener('pointermove',move);el.addEventListener('pointerup',done);el.addEventListener('pointercancel',done);
    });
    el.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const change=e.key==='ArrowLeft'?-10:10;if(type==='sidebar'){state.sidebarWidth=Math.max(210,Math.min(340,state.sidebarWidth+change));theme();persist();}else{const p=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--editor-width'))||50;state.editorWidth=Math.max(30,Math.min(70,p+change/5));theme();persist();}});
  }
  resizeHandler($('#left-resizer'),'sidebar');resizeHandler($('#editor-resizer'),'editor');
  window.addEventListener('resize',()=>{theme();closeDrawers();if(view==='graph')renderGraph();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist();});
  window.addEventListener('pagehide',()=>persist());
  function normalize(snapshot){
    const next={...defaults(),...clone(snapshot)};
    next.tabs=(next.tabs||[]).filter(id=>next.notes.some(n=>n.id===id));
    if(!next.notes.some(n=>n.id===next.active))next.active=next.notes[0]?.id||null;
    if(next.active&&!next.tabs.includes(next.active))next.tabs.push(next.active);
    if(!['read','edit','split'].includes(next.mode))next.mode='read';
    if(!['paper','night'].includes(next.theme))next.theme='paper';
    next.collapsed=Array.isArray(next.collapsed)?next.collapsed:[];
    return next;
  }
  function loadSnapshot(snapshot){
    clearTimeout(saveTimer);state=normalize(snapshot);view='library';selectedFolder=parent(active()?.path||'');lastDeleted=null;
    app.classList.remove('focus');$('#focus-label').textContent='Фокус';closeDrawers();render();
    editor.scrollTop=0;$('#reading-pane').scrollTop=0;
  }
  function applySnapshot(snapshot){
    const focused=document.activeElement===editor,selection=[editor.selectionStart,editor.selectionEnd],scroll=editor.scrollTop,readingScroll=$('#reading-pane').scrollTop;
    state=normalize(snapshot);render();editor.scrollTop=scroll;$('#reading-pane').scrollTop=readingScroll;
    if(focused){editor.focus({preventScroll:true});editor.setSelectionRange(Math.min(selection[0],editor.value.length),Math.min(selection[1],editor.value.length));editor.scrollTop=scroll;}
  }
  render();
  void W.start({
    snapshot:()=>clone(state),defaults:()=>({...defaults(),theme:state.theme}),load:loadSnapshot,apply:applySnapshot,
    patch:fields=>{state={...state,...fields};},
    show:()=>{app.hidden=false;},hide:()=>{app.hidden=true;closeDrawers();$('#popover').hidden=true;},
    context:({record,label,footer,kind,detail})=>{
      $('#current-vault-name').textContent=record.name;
      $('#vault-owner').textContent=record.kind==='demo'?'Первая орбита':record.connection.owner+'/'+record.connection.repo;
      $('#vault-subtitle').textContent=record.kind==='demo'?'Демо · сохранено на устройстве':record.connection.branch+' · OBERON/';
      $('#sync-label').textContent=label;const syncButton=$('.github-status');syncButton.dataset.state=kind;syncButton.title=detail||label;
      $('#save-status').textContent=footer;$('#save-status').dataset.state=kind;
    },
    toast,dialog:openDialog,closeDialog,export:exportVault,cancelSaveTimer:()=>clearTimeout(saveTimer),toggleTheme
  });
})();
