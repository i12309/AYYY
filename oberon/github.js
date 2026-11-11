/* OBERON GitHub transport. Notes are ordinary UTF-8 Markdown files.
 * The bearer token lives only in the client closure and is erased by abort().
 * A save merges path-level changes, creates one Git commit, and advances the
 * selected branch without force. Everything outside OBERON/ is preserved.
 */
(() => {
  'use strict';
  const ROOT = 'OBERON';
  const MAX_NOTE_BYTES = 2 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
  const MAX_NOTES = 1000;
  const EMPTY_BLOB = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', {fatal:true});
  const markdown = path => /\.(md|markdown)$/i.test(path);
  const regular = entry => entry?.type === 'blob' && ['100644','100755'].includes(entry.mode);
  const parent = path => path.includes('/') ? path.slice(0,path.lastIndexOf('/')) : '';
  const cloneNote = note => ({...note});
  const content = note => note ? note.content : null;

  function problem(code, message, details = {}) {
    return Object.assign(new Error(message), {code}, details);
  }
  function validBranch(branch) {
    return !branch || (!/[\x00-\x20\x7f~^:?*\[\\]/.test(branch) && branch !== '@' &&
      !branch.includes('..') && !branch.includes('@{') && !branch.includes('//') &&
      !branch.startsWith('/') && !branch.endsWith('/') && !branch.endsWith('.') &&
      branch.split('/').every(part => part && !part.startsWith('.') && !part.endsWith('.lock')));
  }
  function parseRepo(value, branch = '') {
    let name = String(value || '').trim();
    if (/^https:\/\/github\.com\//i.test(name)) name = name.replace(/^https:\/\/github\.com\//i,'');
    name = name.replace(/\/$/,'').replace(/\.git$/i,'');
    const match = name.match(/^([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9_.-]+)$/);
    branch = String(branch || '').trim();
    if (!match || ['.','..'].includes(match[2]) || !validBranch(branch)) {
      throw problem('INVALID_REPOSITORY','Укажите репозиторий owner/repo и корректное имя ветки.');
    }
    return {owner:match[1], repo:match[2], branch};
  }
  function pathAllowed(path) {
    return typeof path === 'string' && path.length > 0 && path.length <= 1024 &&
      !/[\\\u0000-\u001f\u007f]/.test(path) &&
      path.split('/').every(part => part && part !== '.' && part !== '..' && part.toLowerCase() !== '.git');
  }
  function noteMap(snapshot) {
    if (!Array.isArray(snapshot?.notes)) throw problem('INVALID_SNAPSHOT','Не удалось прочитать локальные заметки.');
    const map = new Map();
    let bytes = 0;
    if (snapshot.notes.length > MAX_NOTES) throw problem('VAULT_LIMIT',`В одном хранилище поддерживается до ${MAX_NOTES} заметок.`);
    for (const note of snapshot.notes) {
      if (!note || !pathAllowed(note.path) || !markdown(note.path) || typeof note.content !== 'string' || map.has(note.path)) {
        throw problem('INVALID_PATH','В хранилище есть недопустимый или повторяющийся путь Markdown-файла.');
      }
      const size = encoder.encode(note.content).length;
      if (size > MAX_NOTE_BYTES) throw problem('FILE_LIMIT',`Заметка «${note.path}» больше 2 МиБ. Разделите её перед синхронизацией.`);
      bytes += size;
      map.set(note.path,note);
    }
    if (bytes > MAX_TOTAL_BYTES) throw problem('VAULT_LIMIT','Общий размер Markdown-заметок превышает 32 МиБ.');
    return map;
  }
  function folderSet(snapshot) {
    if (!Array.isArray(snapshot?.folders)) throw problem('INVALID_SNAPSHOT','Не удалось прочитать папки хранилища.');
    const folders = new Set();
    for (const folder of snapshot.folders) {
      if (!pathAllowed(folder)) throw problem('INVALID_PATH','В хранилище есть недопустимый путь папки.');
      for (let path=folder; path; path=parent(path)) folders.add(path);
    }
    return folders;
  }
  function addParents(folders, path) {
    for (let p=parent(path); p; p=parent(p)) folders.add(p);
  }

  /** Three-way merge of complete Markdown snapshots. A conflicting local
   * version stays in notes until the caller asks the user which version to keep.
   * Missing notes represent deletion; an empty string is a real empty file. */
  function merge(base, local, remote) {
    const b=noteMap(base), l=noteMap(local), r=noteMap(remote);
    const notes=[], conflicts=[];
    for (const path of new Set([...b.keys(),...l.keys(),...r.keys()])) {
      const before=b.get(path), ours=l.get(path), theirs=r.get(path);
      let chosen;
      if (content(ours) === content(before)) chosen=theirs;
      else if (content(theirs) === content(before) || content(ours) === content(theirs)) chosen=ours;
      else {
        conflicts.push({path,base:content(before),local:content(ours),remote:content(theirs)});
        chosen=ours;
      }
      if (chosen) {
        // Editor IDs and favorites are local UI state; refresh only the content.
        notes.push({...chosen,...(ours ? {id:ours.id,favorite:!!ours.favorite} : {})});
      }
    }
    const bf=folderSet(base), lf=folderSet(local), rf=folderSet(remote), folders=new Set();
    for (const path of new Set([...bf,...lf,...rf])) {
      const keep=lf.has(path) === bf.has(path) ? rf.has(path) : lf.has(path);
      if (keep) folders.add(path);
    }
    for (const note of notes) addParents(folders,note.path);
    for (const path of [...folders]) addParents(folders,path);
    notes.sort((a,b)=>a.path.localeCompare(b.path,'ru'));
    return {notes,folders:[...folders].sort((a,b)=>a.localeCompare(b,'ru')),conflicts};
  }
  function base64(bytes) {
    let binary='';
    for (let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return btoa(binary);
  }
  function unbase64(value) {
    const binary=atob(value.replace(/\s/g,''));
    return Uint8Array.from(binary,c=>c.charCodeAt(0));
  }
  async function gitHash(bytes) {
    const header=encoder.encode('blob '+bytes.length+'\0');
    const input=new Uint8Array(header.length+bytes.length);
    input.set(header); input.set(bytes,header.length);
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-1',input));
    return [...hash].map(v=>v.toString(16).padStart(2,'0')).join('');
  }
  function assertSha(value) {
    if (!/^[a-f0-9]{40}$/i.test(value || '')) throw problem('INVALID_RESPONSE','GitHub вернул некорректный идентификатор версии.');
    return value;
  }
  async function pool(items, limit, task) {
    let cursor=0;
    const result=new Array(items.length);
    await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
      while (cursor<items.length) {const index=cursor++;result[index]=await task(items[index],index);}
    }));
    return result;
  }

  function create(connection, token = '', knownSnapshot = null) {
    const parsed=parseRepo(connection?.owner+'/'+connection?.repo,connection?.branch);
    let info={...parsed}, secret=String(token||'').trim(), repoId=connection?.repoId || null;
    if (secret && (/\s/.test(secret) || secret.length>1024)) throw problem('INVALID_TOKEN','Проверьте GitHub-токен: в нём не должно быть пробелов.');
    const controller=new AbortController(), cache=new Map(), uploaded=new Set(), knownNotes=new Map();
    // A workspace may recreate its client after every sync. Keep only candidate
    // text here; the fresh remote tree and a Git blob checksum must validate it
    // before it can replace a network read. Local snapshots are never trusted.
    for (const note of Array.isArray(knownSnapshot?.notes) ? knownSnapshot.notes : []) {
      const entry=knownSnapshot?.entries?.[note?.path];
      if (typeof note?.path==='string' && typeof note.content==='string' && note.content.length<=MAX_NOTE_BYTES && typeof entry?.sha==='string') {
        knownNotes.set(note.path,{content:note.content,sha:entry.sha});
      }
    }
    knownSnapshot=null;
    let limitedUntil=0, syncing=false;
    const root='/repos/'+encodeURIComponent(parsed.owner)+'/'+encodeURIComponent(parsed.repo);
    const cancelled=()=>problem('ABORTED','Подключение к GitHub закрыто. Локальные заметки сохранены.');
    function active() {if(controller.signal.aborted)throw cancelled();}
    function progress(callback,phase,done,total) {active();if(typeof callback==='function')callback({phase,done,total});}
    function rateError() {
      return problem('RATE_LIMIT','GitHub ограничил частоту запросов. Повторите позже; локальные заметки сохранены.',{retryAt:limitedUntil});
    }
    async function api(path, method='GET', body) {
      active();
      if (Date.now()<limitedUntil) throw rateError();
      let response;
      try {
        response=await fetch('https://api.github.com'+root+path,{
          method,cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal,
          headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
            ...(secret?{Authorization:'Bearer '+secret}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},
          ...(body===undefined?{}:{body:JSON.stringify(body)})
        });
      } catch (_) {
        active();
        throw problem('NETWORK','GitHub недоступен. Проверьте интернет и адрес репозитория; локальные заметки сохранены.');
      }
      active();
      if (!response.ok) {
        const payload=await response.json().catch(()=>null);active();
        if (response.status===401) throw problem('AUTH','GitHub-токен недействителен или истёк.',{status:401});
        if (response.status===403 || response.status===429) {
          const retry=Number(response.headers.get('retry-after'));
          const remaining=response.headers.get('x-ratelimit-remaining');
          const reset=Number(response.headers.get('x-ratelimit-reset'))*1000;
          if (response.status===429 || retry>0 || remaining==='0' || /rate limit/i.test(payload?.message||'')) {
            limitedUntil=retry>0?Date.now()+retry*1000:reset>Date.now()?reset:Date.now()+60000;
            throw rateError();
          }
          throw problem('FORBIDDEN','GitHub не разрешил действие. Проверьте доступ токена к репозиторию и разрешение Contents: Read and write.',{status:response.status});
        }
        if (response.status===404) throw problem('NOT_FOUND','Репозиторий или ветка не найдены. Для приватного репозитория нужен токен с доступом к нему.',{status:404});
        if (response.status===409 || response.status===422) throw problem('HEAD_CHANGED','Ветка GitHub изменилась или защищена от прямой записи. Обновите хранилище и повторите синхронизацию.',{status:response.status});
        throw problem('GITHUB_ERROR','GitHub вернул ошибку HTTP '+response.status+'. Локальные заметки сохранены.',{status:response.status});
      }
      if (response.status===204) return null;
      let data;
      try {data=await response.json();} catch (_) {throw problem('INVALID_RESPONSE','GitHub вернул неполный ответ. Повторите позже.');}
      active();return data;
    }
    async function metadata() {
      const data=await api('');
      if (!Number.isSafeInteger(data.id) || data.id<1) throw problem('INVALID_RESPONSE','GitHub не подтвердил идентификатор репозитория.');
      if (repoId && repoId!==data.id) throw problem('REPOSITORY_CHANGED','По этому адресу теперь другой репозиторий. Подключите его отдельно, чтобы сохранить локальные заметки.');
      repoId=data.id;
      const branch=parsed.branch || data.default_branch;
      if (!branch || !validBranch(branch)) throw problem('EMPTY_REPOSITORY','Сначала создайте в репозитории README или первый коммит на GitHub.');
      info={...parsed,branch,private:!!data.private,repoId,htmlUrl:'https://github.com/'+parsed.owner+'/'+parsed.repo,
        canWrite:!secret || data.archived || data.disabled || data.permissions?.push===false ? false : data.permissions?.push===true ? true : null};
      return {...info};
    }
    async function head() {
      try {
        const ref=await api('/git/ref/heads/'+encodeURIComponent(info.branch));
        if (ref?.object?.type && ref.object.type!=='commit') throw problem('INVALID_RESPONSE','Выбранная ссылка GitHub не является веткой.');
        return assertSha(ref?.object?.sha);
      } catch (error) {
        if (error.status===409) throw problem('EMPTY_REPOSITORY','В репозитории ещё нет коммитов. Создайте README на GitHub и подключите его снова.');
        throw error;
      }
    }
    async function verify() {await metadata();await head();return {...info};}
    function readTree(data) {
      if (!data || !Array.isArray(data.tree) || data.truncated) throw problem('TREE_LIMIT','GitHub вернул неполное дерево файлов. Хранилище не открыто, чтобы не потерять заметки.');
      return data.tree;
    }
    async function readNote(entry) {
      if (cache.has(entry.sha)) return cache.get(entry.sha);
      if (!Number.isSafeInteger(entry.size) || entry.size<0 || entry.size>MAX_NOTE_BYTES) throw problem('FILE_LIMIT',`Заметка «${entry.path}» больше 2 МиБ или имеет неизвестный размер.`);
      const known=knownNotes.get(entry.path);
      if (known?.sha===entry.sha && !known.content.includes('\0')) {
        const bytes=encoder.encode(known.content);
        if (bytes.length===entry.size && decoder.decode(bytes)===known.content && await gitHash(bytes)===entry.sha) {
          active();cache.set(entry.sha,known.content);return known.content;
        }
      }
      const data=await api('/git/blobs/'+assertSha(entry.sha));
      if (data?.sha!==entry.sha || data.encoding!=='base64' || typeof data.content!=='string' || data.size!==entry.size || data.content.replace(/\s/g,'').length>Math.ceil(MAX_NOTE_BYTES/3)*4) {
        throw problem('INVALID_RESPONSE',`GitHub вернул неполную заметку «${entry.path}».`);
      }
      let bytes,text;
      try {bytes=unbase64(data.content);text=decoder.decode(bytes);} catch (_) {throw problem('FILE_FORMAT',`Заметка «${entry.path}» не является текстом UTF-8.`);}
      if (bytes.length!==entry.size || await gitHash(bytes)!==entry.sha) throw problem('INVALID_RESPONSE',`Контрольная сумма заметки «${entry.path}» не совпала.`);
      if (text.includes('\0')) throw problem('FILE_FORMAT',`Файл «${entry.path}» содержит двоичные данные.`);
      active();cache.set(entry.sha,text);return text;
    }
    async function load({onProgress} = {}) {
      await metadata();
      const commit=await head(), revision=await api('/git/commits/'+commit);
      const tree=assertSha(revision?.tree?.sha), rootItems=readTree(await api('/git/trees/'+tree));
      const vault=rootItems.find(item=>item.path===ROOT);
      if (!vault) return {notes:[],folders:[],commit,tree,entries:{},repository:{...info}};
      if (vault.type!=='tree' || vault.mode!=='040000') throw problem('ROOT_COLLISION','В корне репозитория OBERON уже существует как файл. Для заметок нужна папка с этим именем.');
      const items=readTree(await api('/git/trees/'+assertSha(vault.sha)+'?recursive=1'));
      const entries={}, folders=new Set(), files=[];
      for (const item of items) {
        if (!pathAllowed(item.path)) throw problem('INVALID_PATH','GitHub содержит путь, который нельзя безопасно открыть в OBERON.');
        if (item.type==='tree') {folders.add(item.path);continue;}
        entries[item.path]={sha:assertSha(item.sha),mode:item.mode,type:item.type,size:item.size??0};
        addParents(folders,item.path);
        if (regular(item) && markdown(item.path)) files.push(item);
      }
      if (files.length>MAX_NOTES || files.reduce((sum,item)=>sum+(item.size||0),0)>MAX_TOTAL_BYTES) throw problem('VAULT_LIMIT',`Хранилище превышает предел ${MAX_NOTES} заметок или 32 МиБ Markdown-текста.`);
      let done=0;progress(onProgress,'read',0,files.length);
      const updated=revision.committer?.date || revision.author?.date || null;
      const notes=await pool(files,4,async file=>{
        const text=await readNote(file);progress(onProgress,'read',++done,files.length);
        return {id:'github:'+file.path,path:file.path,content:text,favorite:false,updated};
      });
      notes.sort((a,b)=>a.path.localeCompare(b.path,'ru'));
      return {notes,folders:[...folders].sort((a,b)=>a.localeCompare(b,'ru')),commit,tree,entries,repository:{...info}};
    }
    function assertWritablePaths(snapshot, remote) {
      const directories=new Set(remote.folders), wanted=new Set(snapshot.notes.map(note=>note.path));
      for (const note of snapshot.notes) {
        const existing=remote.entries[note.path];
        if (directories.has(note.path) || (existing && !regular(existing))) {
          throw problem('PATH_CONFLICT',`Путь «${note.path}» занят папкой, ссылкой или другим объектом. Переименуйте локальную заметку.`,{path:note.path});
        }
        for (let p=parent(note.path);p;p=parent(p)) {
          if (remote.entries[p] || wanted.has(p)) throw problem('PATH_CONFLICT',`Путь «${p}» уже занят файлом. Выберите другую папку.`,{path:p});
        }
      }
      for (const folder of snapshot.folders) if (remote.entries[folder] || wanted.has(folder)) {
        throw problem('PATH_CONFLICT',`Путь папки «${folder}» уже занят файлом.`,{path:folder});
      }
    }
    async function writeBlob(text) {
      const bytes=encoder.encode(text),sha=await gitHash(bytes);active();
      if (uploaded.has(sha)) return sha;
      const result=await api('/git/blobs','POST',{content:base64(bytes),encoding:'base64'});
      if (result?.sha!==sha) throw problem('INVALID_RESPONSE','GitHub не подтвердил контрольную сумму сохранённой заметки.');
      cache.set(sha,text);uploaded.add(sha);return sha;
    }
    async function sync({base,local,onProgress} = {}) {
      if (syncing) throw problem('BUSY','Синхронизация этого хранилища уже выполняется.');
      if (!secret) throw problem('TOKEN_REQUIRED','Для сохранения в GitHub введите токен с разрешением Contents: Read and write.');
      noteMap(base);folderSet(base);noteMap(local);folderSet(local);
      syncing=true;
      try {
        const remote=await load({onProgress});
        if (info.canWrite===false) throw problem('READ_ONLY','Репозиторий доступен только для чтения. Локальные изменения сохранены.');
        const combined=merge(base,local,remote);
        if (combined.conflicts.length) throw problem('CONFLICT','Некоторые заметки изменились и здесь, и в GitHub. Выберите версии для сохранения.',{conflicts:combined.conflicts,remote,merged:combined});
        assertWritablePaths(combined,remote);
        const theirs=noteMap(remote), ours=noteMap(combined), changes=[];
        const put=(path,sha,mode='100644')=>changes.push({path:ROOT+'/'+path,mode,type:'blob',sha});
        const modified=[...ours.values()].filter(note=>note.content!==theirs.get(note.path)?.content);
        const deleted=[...theirs.keys()].filter(path=>!ours.has(path));
        const leafEntries={...remote.entries};
        let done=0;progress(onProgress,'write',0,modified.length);
        for (const note of modified) {
          const sha=await writeBlob(note.content),mode=remote.entries[note.path]?.mode||'100644';
          put(note.path,sha,mode);leafEntries[note.path]={sha,mode,type:'blob',size:encoder.encode(note.content).length};
          progress(onProgress,'write',++done,modified.length);
        }
        for (const path of deleted) {put(path,null,remote.entries[path]?.mode||'100644');delete leafEntries[path];}
        // Empty directories need a real Git object. Only an empty, regular
        // .gitkeep is managed; a user's nonempty .gitkeep is never replaced.
        const folders=new Set(combined.folders), keepers=new Set();
        for (const folder of folders) {
          const prefix=folder+'/', hasDescendant=Object.keys(leafEntries).some(path=>path.startsWith(prefix) && path!==prefix+'.gitkeep') || [...folders].some(path=>path.startsWith(prefix));
          if (!hasDescendant) keepers.add(prefix+'.gitkeep');
        }
        for (const [path,item] of Object.entries(leafEntries)) {
          if (path.endsWith('/.gitkeep') && item.sha===EMPTY_BLOB && regular(item) && !keepers.has(path) && base.entries?.[path]?.sha===item.sha) {
            put(path,null,item.mode);delete leafEntries[path];
          }
        }
        for (const path of keepers) {
          if (!leafEntries[path]) {const sha=await writeBlob('');put(path,sha);leafEntries[path]={sha,mode:'100644',type:'blob',size:0};}
        }
        if (!changes.length) return {snapshot:{...remote,notes:combined.notes,folders:combined.folders},commit:remote.commit,changed:0};
        active();progress(onProgress,'commit',0,1);
        const newTree=await api('/git/trees','POST',{base_tree:remote.tree,tree:changes});
        const tree=assertSha(newTree?.sha);
        const commitResult=await api('/git/commits','POST',{message:'oberon: sync Markdown notes [skip ci]',tree,parents:[remote.commit]});
        const commit=assertSha(commitResult?.sha);
        await metadata(); // Verify that repository identity/access still matches.
        if (await head()!==remote.commit) throw problem('HEAD_CHANGED','Ветка изменилась во время сохранения. Локальные заметки сохранены; повторите синхронизацию.');
        active();
        const ref=await api('/git/refs/heads/'+encodeURIComponent(info.branch),'PATCH',{sha:commit,force:false});
        if (ref?.object?.sha!==commit) throw problem('UNCONFIRMED','GitHub не подтвердил новый коммит. Обновите хранилище перед повторным сохранением.');
        progress(onProgress,'commit',1,1);
        for (const path of Object.keys(leafEntries)) addParents(folders,path);
        return {snapshot:{notes:combined.notes.map(cloneNote),folders:[...folders].sort((a,b)=>a.localeCompare(b,'ru')),commit,tree,entries:leafEntries,repository:{...info}},commit,changed:changes.length};
      } finally {syncing=false;}
    }
    function abort() {secret='';controller.abort();cache.clear();uploaded.clear();knownNotes.clear();}
    return Object.freeze({verify,load,sync,abort});
  }
  window.OberonGitHub=Object.freeze({ROOT,MAX_NOTE_BYTES,MAX_NOTES,parseRepo,create,merge});
})();
