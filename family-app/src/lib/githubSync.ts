/**
 * GEN: browser-to-private-GitHub transport.
 * The token exists in memory only and is never persisted or logged.
 */
import {type Document,validate,now} from './browserModel';
import {exportGedcom} from './gedcomExport';
import {mergeDocuments,type MergeChoice,type MergeConflict} from './browserMerge';
import {
  getSync,setSync,listTrees,readTree,readFiles,installTreeSnapshot,installResolvedSnapshot,type SyncRecord
} from './browserStore';

let bearer = '';
export function setSessionToken(value: string) {bearer=value.trim();}
export function hasSessionToken() {return Boolean(bearer);}
export function disconnectToken() {bearer='';}
export type RemoteRepo = {owner:string;repo:string;branch:string};
export function parseRepo(value: string,branch='main'): RemoteRepo {
  const match=value.trim().match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match || !branch || !/^[A-Za-z0-9._/-]+$/.test(branch) ||
      branch.includes('..') || branch.includes('@{') || branch.endsWith('/') ||
      branch.startsWith('/') || branch.endsWith('.lock')) {
    throw new Error('Укажите репозиторий owner/repo и корректную ветку.');
  }
  return {owner:match[1],repo:match[2],branch};
}
function root(repo: RemoteRepo) {
  return '/repos/'+encodeURIComponent(repo.owner)+'/'+encodeURIComponent(repo.repo);
}
function archivePath(slug:string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Некорректное имя каталога.');
  return 'family-data/trees/'+slug+'/tree.json';
}
function mediaPath(filePath:string,filename:string) {
  if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(filename) || filename.includes('..')) {
    throw new Error('Некорректное имя медиафайла.');
  }
  return filePath.slice(0,-'tree.json'.length)+'media/'+filename;
}
async function api(path:string,method='GET',body?:unknown,allowMissing=false):Promise<any> {
  if(!bearer)throw new Error('Введите токен GitHub с правами Contents на приватный репозиторий.');
  const reply=await fetch('https://api.github.com'+path,{
    method,cache:'no-store',
    headers:{
      'Accept':'application/vnd.github+json',
      'Authorization':'Bearer '+bearer,
      'X-GitHub-Api-Version':'2022-11-28',
      ...(body===undefined?{}:{'Content-Type':'application/json'})
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(reply.status===404 && allowMissing)return null;
  if(!reply.ok){
    const reason=reply.status===401?'Недействительный токен GitHub.'
      :reply.status===403?'Нет разрешения на запись/чтение или превышен лимит GitHub API.'
      :reply.status===404?'Репозиторий, ветка или файл не найден.'
      :[409,422].includes(reply.status)?'Конфликт обновления GitHub. Обновите дерево и проверьте версии.'
      :'GitHub: ошибка HTTP '+reply.status+'.';
    throw new Error(reason);
  }
  return reply.status===204?undefined:reply.json();
}
function b64(bytes:Uint8Array):string {
  let encoded='';
  for(let i=0;i<bytes.length;i+=32768){
    encoded+=String.fromCharCode(...bytes.subarray(i,i+32768));
  }
  return btoa(encoded);
}
function unb64(value:string):Uint8Array {
  const s=atob(value.replace(/\s/g,''));
  return Uint8Array.from(s,char=>char.charCodeAt(0));
}
async function verifyPrivate(repo:RemoteRepo) {
  const data=await api(root(repo));
  if(!data.private)throw new Error('Открытый репозиторий запрещён. Семейный архив можно сохранять только в приватном репозитории.');
}
async function branchHead(repo:RemoteRepo):Promise<string> {
  const ref=await api(root(repo)+'/git/ref/heads/'+encodeURIComponent(repo.branch));
  return ref.object.sha;
}
function treeFile(repo:RemoteRepo,path:string,ref:string) {
  return api(root(repo)+'/contents/'+path+'?ref='+encodeURIComponent(ref),'GET',undefined,true);
}
async function readBlob(repo:RemoteRepo,sha:string):Promise<Uint8Array> {
  const item=await api(root(repo)+'/git/blobs/'+encodeURIComponent(sha));
  if(item.encoding!=='base64')throw new Error('GitHub вернул неизвестный формат блоба.');
  return unb64(item.content);
}
function usedMedia(doc:Document):Map<string,string> {
  const files=new Map<string,string>();
  for(const p of doc.persons){
    if(p._photo?.filename)files.set(p._photo.filename,p._photo.mime_type || 'image/jpeg');
    for(const m of p._gallery || [])if(m.filename)files.set(m.filename,m.mime_type || 'application/octet-stream');
  }
  return files;
}
export async function listRemoteTrees(repo:RemoteRepo):Promise<string[]> {
  await verifyPrivate(repo);
  const item=await api(root(repo)+'/contents/family-data/trees?ref='+encodeURIComponent(repo.branch),'GET',undefined,true);
  if(!item)return [];
  if(!Array.isArray(item))throw new Error('Некорректный каталог деревьев в GitHub.');
  return item.filter((entry:any)=>entry.type==='dir'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name))
    .map((entry:any)=>String(entry.name));
}
export async function restoreFromGitHub(repo:RemoteRepo,slug:string):Promise<Document> {
  await verifyPrivate(repo);
  const head=await branchHead(repo);
  const path=archivePath(slug);
  const file=await treeFile(repo,path,head);
  if(!file?.sha)throw new Error('Дерево tree.json отсутствует в выбранном репозитории.');
  const raw=await readBlob(repo,file.sha);
  let document:Document;
  try{document=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}
  catch{throw new Error('Не удалось прочитать JSON из GitHub.');}
  validate(document);
  if(document.tree.slug!==slug)throw new Error('Каталог GitHub не совпадает с данными дерева.');
  if((await listTrees()).some(t=>t.id===document.tree.id)){
    throw new Error('Такое дерево уже есть в браузере. Сначала сохраните его ZIP и удалите локальную копию, если хотите восстановить другую.');
  }
  const files:Array<{filename:string;blob:Blob}>=[];
  const wanted=[...usedMedia(document)];
  for(let i=0;i<wanted.length;i+=4){
    const group=await Promise.all(wanted.slice(i,i+4).map(async ([name,mime])=>{
      const obj=await treeFile(repo,mediaPath(path,name),head);
      if(!obj?.sha)throw new Error('В GitHub отсутствует фотография/файл '+name+'.');
      const data=await readBlob(repo,obj.sha);
      return {filename:name,blob:new Blob([data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer],{type:mime})};
    }));
    files.push(...group);
  }
  // Preserve the exact original GEDCOM bytes when this tree was imported.
  const originalPath=path.replace(/tree\.json$/,'original.ged');
  const originalRemote=await treeFile(repo,originalPath,head);
  if(originalRemote?.sha) {
    const bytes=await readBlob(repo,originalRemote.sha);
    files.push({filename:'original.ged',blob:new Blob(
      [bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer],
      {type:'text/plain;charset=utf-8'})});
  }
  await installTreeSnapshot(document,files);
  await setSync({treeId:document.tree.id,...repo,path,blobSha:file.sha,lastCommit:head,
    lastSync:now(),lastLocalSavedAt:document.tree.updated_at,baseline:structuredClone(document)});
  return document;
}
export async function pushToGitHub(treeId:string,repo:RemoteRepo) {
  await verifyPrivate(repo);
  const document=await readTree(treeId);
  const link=await getSync(treeId);
  const path=archivePath(document.tree.slug);
  if(link && (link.owner!==repo.owner||link.repo!==repo.repo||
     link.branch!==repo.branch||link.path!==path)){
    throw new Error('Дерево уже связано с другим GitHub-репозиторием или каталогом.');
  }
  const head=await branchHead(repo);
  const remote=await treeFile(repo,path,head);
  if(remote && !link?.blobSha){
    throw new Error('В этом каталоге GitHub уже есть дерево. Сначала загрузите его, чтобы исключить перезапись.');
  }
  if(link?.blobSha && remote?.sha!==link.blobSha){
    throw new Error('Конфликт: дерево в GitHub изменилось с последней синхронизации. Данные не перезаписаны.');
  }
  if(!remote && link?.blobSha)throw new Error('Удалённое дерево исчезло. Синхронизация остановлена.');
  const media=await readFiles(treeId);
  // Derived GEDCOM and immutable original are part of the same Git commit.
  const gedcom=exportGedcom(document.persons,document.families,document.metadata);
  const original=media.get('original.ged');
  const names=[...usedMedia(document).keys()];
  for(const name of names){
    if(!media.has(name))throw new Error('Не найден локальный медиафайл '+name+'. Синхронизация остановлена.');
  }
  const commit=await api(root(repo)+'/git/commits/'+head);
  const parentTree=commit.tree.sha;
  const data=new TextEncoder().encode(JSON.stringify(document,null,2)+'\n');
  const jsonBlob=await api(root(repo)+'/git/blobs','POST',{content:b64(data),encoding:'base64'});
  const gedBlob=await api(root(repo)+'/git/blobs','POST',{content:b64(gedcom),encoding:'base64'});
  const entries:Array<{path:string;mode:string;type:string;sha:string}>=[
    {path,mode:'100644',type:'blob',sha:jsonBlob.sha},
    {path:path.replace(/tree\.json$/,'tree.ged'),mode:'100644',type:'blob',sha:gedBlob.sha}
  ];
  if(original){
    const bytes=new Uint8Array(await original.arrayBuffer());
    const blob=await api(root(repo)+'/git/blobs','POST',{content:b64(bytes),encoding:'base64'});
    entries.push({path:path.replace(/tree\.json$/,'original.ged'),
      mode:'100644',type:'blob',sha:blob.sha});
  }
  for(let i=0;i<names.length;i+=4) {
    const group=await Promise.all(names.slice(i,i+4).map(async name=>{
      const file=media.get(name)!;
      const bytes=new Uint8Array(await file.arrayBuffer());
      const value=await api(root(repo)+'/git/blobs','POST',{content:b64(bytes),encoding:'base64'});
      return {path:mediaPath(path,name),mode:'100644',type:'blob',sha:value.sha};
    }));
    entries.push(...group);
  }
  const newTree=await api(root(repo)+'/git/trees','POST',{base_tree:parentTree,tree:entries});
  const next=await api(root(repo)+'/git/commits','POST',{
    message:'gen: update family archive '+document.tree.slug,
    tree:newTree.sha,parents:[head]
  });
  // GitHub rejects non-fast-forward if another device advanced the ref.
  await api(root(repo)+'/git/refs/heads/'+encodeURIComponent(repo.branch),'PATCH',{
    sha:next.sha,force:false
  });
  const sync:SyncRecord={treeId,...repo,path,blobSha:jsonBlob.sha,lastCommit:next.sha,
    lastSync:now(),lastLocalSavedAt:document.tree.updated_at,baseline:structuredClone(document)};
  await setSync(sync);
  const pending=(await readTree(treeId)).tree.updated_at!==document.tree.updated_at;
  return {sha:next.sha,pending};
}


/** Validate an entered personal access token against *this exact* private repo.
 * Write check creates an unreferenced Git blob, not a commit or branch edit.
 * Works for fine-grained PATs and ephemeral GitHub Actions tokens.
 */
export async function verifyGitHubConnection(repo:RemoteRepo,write=false):Promise<{
  repository:string;branch:string;canWrite:boolean
}>{
  await verifyPrivate(repo);
  await branchHead(repo);
  if(write){
    const proof=new TextEncoder().encode('GEN token permissions check; no family data.\n');
    await api(root(repo)+'/git/blobs','POST',{content:b64(proof),encoding:'base64'});
  }
  return {repository:repo.owner+'/'+repo.repo,branch:repo.branch,canWrite:write};
}

export type GitHubConflictPreview={
  treeId:string;
  repo:RemoteRepo;
  path:string;
  head:string;
  remoteSha:string;
  local:Document;
  remote:Document;
  base:Document|null;
  conflicts:MergeConflict[];
  autoChanges:number;
};

/** Collect both versions for a read-only preview. Never changes the local
 * archive, even when the remote tree conflicts with earlier sync state.
 */
export async function previewGitHubConflict(treeId:string,repo:RemoteRepo):Promise<GitHubConflictPreview>{
  await verifyPrivate(repo);
  const local=await readTree(treeId);
  const link=await getSync(treeId);
  if(!link||link.owner!==repo.owner||link.repo!==repo.repo||link.branch!==repo.branch)
    throw new Error('Сначала привяжите дерево к выбранному GitHub-репозиторию.');
  const path=archivePath(local.tree.slug);
  if(link.path!==path)throw new Error('Каталог дерева изменён; сначала сохраните локальный ZIP.');
  const head=await branchHead(repo);
  const entry=await treeFile(repo,path,head);
  if(!entry?.sha)throw new Error('Удалённый tree.json отсутствует. Отправка блокирована.');
  let remote:Document;
  try{remote=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBlob(repo,entry.sha)));}
  catch{throw new Error('GitHub содержит повреждённый JSON; локальные данные не изменены.');}
  validate(remote);
  let baseline:Document|null=link.baseline||null;
  if(!baseline&&link.blobSha) {
    try{
      baseline=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBlob(repo,link.blobSha)));
      validate(baseline);
    }catch{
      baseline=null; // Never guess a baseline or silently merge unrelated data.
    }
  }
  const result=mergeDocuments(baseline,local,remote);
  return {treeId,repo,path,head,remoteSha:entry.sha,
    local,remote,base:baseline,conflicts:result.conflicts,autoChanges:result.autoChanges};
}

function requiredMedia(doc:Document):Map<string,string>{
  return usedMedia(doc);
}
function sameBytes(a:Uint8Array,b:Uint8Array):boolean{
  return a.length===b.length&&a.every((value,index)=>value===b[index]);
}
/** Load only remote media missing from this browser. Existing media filenames
 * are immutable by GEN design; an original.ged mismatch is explicitly rejected.
 */
async function collectResolutionMedia(
  preview:GitHubConflictPreview,merged:Document
):Promise<Map<string,Blob>>{
  const files=await readFiles(preview.treeId);
  const required=requiredMedia(merged);
  for(const [name,mime] of required){
    if(files.has(name))continue;
    const entry=await treeFile(preview.repo,mediaPath(preview.path,name),preview.head);
    if(!entry?.sha)throw new Error('Отсутствует медиафайл '+name+' в локальном архиве и GitHub.');
    const data=await readBlob(preview.repo,entry.sha);
    const raw=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer;
    files.set(name,new Blob([raw],{type:mime}));
  }
  const path=preview.path.replace(/tree\.json$/,'original.ged');
  const original=await treeFile(preview.repo,path,preview.head);
  if(original?.sha){
    const bytes=await readBlob(preview.repo,original.sha);
    const current=files.get('original.ged');
    if(current){
      if(!sameBytes(new Uint8Array(await current.arrayBuffer()),bytes))
        throw new Error('Исходные original.ged различаются. Сохраните обе версии отдельно перед слиянием.');
    }else{
      const raw=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
      files.set('original.ged',new Blob([raw],{type:'text/plain'}));
    }
  }
  return files;
}
/** Commit a fully validated resolved snapshot without replacing local data first.
 * Any concurrent branch movement is rejected by the non-forced ref update.
 */
async function publishResolvedSnapshot(
  preview:GitHubConflictPreview,doc:Document,files:Map<string,Blob>
):Promise<{head:string;sha:string}>{
  const repo=preview.repo,path=preview.path;
  if(await branchHead(repo)!==preview.head)
    throw new Error('GitHub изменился после просмотра конфликта. Проверьте версии ещё раз.');
  const check=await treeFile(repo,path,preview.head);
  if(!check||check.sha!==preview.remoteSha)
    throw new Error('Удалённая версия дерева больше не совпадает с просмотренной.');
  const originalCommit=await api(root(repo)+'/git/commits/'+preview.head);
  const encoded=new TextEncoder().encode(JSON.stringify(doc,null,2)+'\n');
  const record=await api(root(repo)+'/git/blobs','POST',{content:b64(encoded),encoding:'base64'});
  const ged=exportGedcom(doc.persons,doc.families,doc.metadata);
  const gedBlob=await api(root(repo)+'/git/blobs','POST',{content:b64(ged),encoding:'base64'});
  const entries:Array<{path:string;mode:string;type:string;sha:string}>=[
    {path,mode:'100644',type:'blob',sha:record.sha},
    {path:path.replace(/tree\.json$/,'tree.ged'),mode:'100644',type:'blob',sha:gedBlob.sha}
  ];
  const original=files.get('original.ged');
  if(original){
    const bytes=new Uint8Array(await original.arrayBuffer());
    const blob=await api(root(repo)+'/git/blobs','POST',{content:b64(bytes),encoding:'base64'});
    entries.push({path:path.replace(/tree\.json$/,'original.ged'),mode:'100644',type:'blob',sha:blob.sha});
  }
  const required=[...requiredMedia(doc)];
  for(let i=0;i<required.length;i+=4){
    const batch=await Promise.all(required.slice(i,i+4).map(async([name])=>{
      const file=files.get(name);
      if(!file)throw new Error('Отсутствует файл '+name+'.');
      const data=new Uint8Array(await file.arrayBuffer());
      const blob=await api(root(repo)+'/git/blobs','POST',{content:b64(data),encoding:'base64'});
      return {path:mediaPath(path,name),mode:'100644',type:'blob',sha:blob.sha};
    }));
    entries.push(...batch);
  }
  const gitTree=await api(root(repo)+'/git/trees','POST',{base_tree:originalCommit.tree.sha,tree:entries});
  const commit=await api(root(repo)+'/git/commits','POST',{
    message:'gen: resolve family archive '+doc.tree.slug,tree:gitTree.sha,parents:[preview.head]
  });
  await api(root(repo)+'/git/refs/heads/'+encodeURIComponent(repo.branch),'PATCH',{
    sha:commit.sha,force:false
  });
  return {head:commit.sha,sha:record.sha};
}

/** Resolve user-selected fields. Existing local data is not discarded before
 * GitHub accepts the result. A simultaneous browser edit is never overwritten.
 */
export async function resolveGitHubConflict(
  preview:GitHubConflictPreview,
  choices:MergeChoice
):Promise<{sha:string;pending:boolean;autoChanges:number}> {
  await verifyPrivate(preview.repo);
  const actual=await readTree(preview.treeId);
  if(JSON.stringify(actual)!==JSON.stringify(preview.local))
    throw new Error('Локальное дерево изменилось. Откройте сравнение заново.');
  const proposed=mergeDocuments(preview.base,preview.local,preview.remote,choices);
  if(proposed.unresolved.length)
    throw new Error('Не выбран источник для '+proposed.unresolved.length+' спорных изменений.');
  validate(proposed.document);
  const media=await collectResolutionMedia(preview,proposed.document);
  const published=await publishResolvedSnapshot(preview,proposed.document,media);
  const record:SyncRecord={treeId:preview.treeId,...preview.repo,path:preview.path,
    blobSha:published.sha,lastCommit:published.head,lastSync:now(),
    lastLocalSavedAt:proposed.document.tree.updated_at,
    baseline:structuredClone(proposed.document)};
  const installed=await installResolvedSnapshot(preview.local,proposed.document,
    [...media].map(([filename,blob])=>({filename,blob})),record);
  return {sha:published.head,pending:!installed,autoChanges:proposed.autoChanges};
}
