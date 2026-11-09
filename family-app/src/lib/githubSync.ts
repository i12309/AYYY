/**
 * GEN: browser-to-private-GitHub transport.
 * The token exists in memory only and is never persisted or logged.
 */
import {type Document,validate,now} from './browserModel';
import {
  getSync,setSync,listTrees,readTree,readFiles,installTreeSnapshot,type SyncRecord
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
  await installTreeSnapshot(document,files);
  await setSync({treeId:document.tree.id,...repo,path,blobSha:file.sha,lastCommit:head,
    lastSync:now(),lastLocalSavedAt:document.tree.updated_at});
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
  const names=[...usedMedia(document).keys()];
  for(const name of names){
    if(!media.has(name))throw new Error('Не найден локальный медиафайл '+name+'. Синхронизация остановлена.');
  }
  const commit=await api(root(repo)+'/git/commits/'+head);
  const parentTree=commit.tree.sha;
  const data=new TextEncoder().encode(JSON.stringify(document,null,2)+'\n');
  const jsonBlob=await api(root(repo)+'/git/blobs','POST',{content:b64(data),encoding:'base64'});
  const entries:Array<{path:string;mode:string;type:string;sha:string}>=[
    {path,mode:'100644',type:'blob',sha:jsonBlob.sha}
  ];
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
    lastSync:now(),lastLocalSavedAt:document.tree.updated_at};
  await setSync(sync);
  const pending=(await readTree(treeId)).tree.updated_at!==document.tree.updated_at;
  return {sha:next.sha,pending};
}
