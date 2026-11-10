/* GitHub transport. Only encrypted envelopes reach the private repository.
   Token is in module memory and vanishes when this page is closed/reloaded. */
(() => {
  'use strict';
  const DIR='health-data/v2/';
  const PATH=DIR+'vault.json';
  const objectPath=id=>DIR+'objects/'+id+'.bin';
  const C=window.HumanCrypto;
  const MAX_ENVELOPE=Math.ceil((C.MAX_METADATA+16)/3)*4+C.MAX_OBJECTS*70+2048;
  let bearer='';
  let requests;
  let rateLimitedUntil=0;
  let stagingRepo='';
  const stagedBlobs=new Map();
  const encoder=new TextEncoder(), decoder=new TextDecoder('utf-8',{fatal:true});
  function token(value){
    const next=String(value||'').trim();
    if(next!==bearer){
      requests?.abort();
      requests=next?new AbortController():null;
      stagedBlobs.clear();stagingRepo='';bearer=next;
    }
    const authorized=requests;
    return ()=>!!authorized&&authorized===requests;
  }
  function hasToken(){return !!bearer;}
  function disconnect(){token('');}
  function parseRepo(value,branch='main'){
    const name=String(value||'').trim().replace(/^https:\/\/github\.com\//i,'').replace(/\.git$/i,'').replace(/\/$/,'');
    const found=name.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)$/);
    if(!found || !branch || !/^[A-Za-z0-9._/-]+$/.test(branch) ||
       branch.includes('..') || branch.includes('@{') || branch.startsWith('/') ||
       branch.endsWith('/') || branch.endsWith('.lock'))throw new Error('Укажите репозиторий owner/repo и корректную ветку.');
    return {owner:found[1],repo:found[2],branch};
  }
  function root(repo){return '/repos/'+encodeURIComponent(repo.owner)+'/'+encodeURIComponent(repo.repo);}
  function rateError(){
    const when=new Date(rateLimitedUntil).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
    return Error('GitHub ограничил частоту запросов. Повторите после '+when+'. Локальные данные сохранены.');
  }
  async function api(path,method='GET',body,allow404=false,accept='application/vnd.github+json'){
    if(!bearer)throw new Error('Введите GitHub-токен с разрешением Contents на приватный репозиторий.');
    if(Date.now()<rateLimitedUntil)throw rateError();
    const signal=requests.signal;
    const cancelled=()=>new Error('Подключение к GitHub отменено.');
    let response;
    try{
      response=await fetch('https://api.github.com'+path,{
        method,cache:'no-store',credentials:'omit',redirect:'error',signal,
        headers:{'Accept':accept,'Authorization':'Bearer '+bearer,
          'X-GitHub-Api-Version':'2022-11-28',...(body===undefined?{}:{'Content-Type':'application/json'})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})
      });
    }catch{if(signal.aborted)throw cancelled();throw new Error('GitHub недоступен или изменился адрес репозитория. Проверьте подключение и адрес.');}
    if(signal.aborted)throw cancelled();
    if(allow404 && response.status===404)return null;
    if(!response.ok){
      if([409,422].includes(response.status)){
        const error=new Error('Конфликт: данные в GitHub изменились. Загрузите их и разрешите конфликт.');
        error.status=response.status;
        throw error;
      }
      if(response.status===401)throw new Error('GitHub-токен недействителен или истёк.');
      if(response.status===403||response.status===429){
        const retry=Number(response.headers.get('retry-after'));
        const remaining=response.headers.get('x-ratelimit-remaining');
        const reset=Number(response.headers.get('x-ratelimit-reset'))*1000;
        const body=await response.json().catch(()=>null);
        if(signal.aborted)throw cancelled();
        if(response.status===429||retry>0||remaining==='0'||/rate limit/i.test(body?.message||'')){
          rateLimitedUntil=retry>0?Date.now()+retry*1000
            :remaining==='0'&&reset>Date.now()?reset:Date.now()+60000;
          throw rateError();
        }
        throw new Error('Нет доступа к GitHub. Проверьте права Contents на репозиторий.');
      }
      if(response.status===404)throw new Error('Не найден репозиторий, ветка или файл.');
      throw new Error('GitHub вернул ошибку HTTP '+response.status+'.');
    }
    if(response.status===204)return null;
    const data=await response.json();
    if(signal.aborted)throw cancelled();
    return data;
  }
  const branchPath=repo=>root(repo)+'/git/ref/heads/'+encodeURIComponent(repo.branch);
  async function branchHead(repo){
    const result=await api(branchPath(repo));
    if(!result?.object?.sha)throw Error('Не удалось прочитать состояние ветки GitHub.');
    return result.object.sha;
  }
  async function privateRepo(repo){
    const info=await api(root(repo));
    if(info.private!==true||info.visibility!=='private')throw new Error('Синхронизация доступна только для приватного репозитория GitHub.');
    if(!Number.isSafeInteger(info.id)||info.id<1)throw new Error('GitHub не подтвердил идентификатор репозитория.');
    return info.id;
  }
  async function verify(repo){
    await privateRepo(repo);
    await branchHead(repo);
    return true;
  }
  function decodeEnvelope(bytes){
    try{
      const envelope=JSON.parse(decoder.decode(bytes));
      C.assertEnvelope(envelope);
      return envelope;
    }catch{throw new Error('В GitHub лежит файл неизвестного формата; данные не изменены.');}
  }
  async function blobBytes(repo,sha,limit){
    if(!/^[0-9a-f]{40}$/i.test(sha))throw new Error('Некорректный идентификатор версии GitHub.');
    const blob=await api(root(repo)+'/git/blobs/'+encodeURIComponent(sha),'GET',undefined,true);
    if(!blob)return null;
    if(blob.sha!==sha||blob.encoding!=='base64'||!blob.content)throw new Error('Не удалось прочитать версию архива GitHub.');
    const encoded=blob.content.replace(/\s/g,'');
    if(blob.size>limit||encoded.length>Math.ceil(limit/3)*4)
      throw Error('Файл GitHub превышает допустимый размер.');
    const bytes=C.unbase64(encoded);
    if(bytes.length!==blob.size)throw Error('GitHub вернул неполный зашифрованный файл.');
    return bytes;
  }
  async function readBlob(repo,sha){
    const bytes=await blobBytes(repo,sha,MAX_ENVELOPE);
    return bytes?decodeEnvelope(bytes):null;
  }
  async function contents(repo,path,ref){
    return api(root(repo)+'/contents/'+path+'?ref='+encodeURIComponent(ref),
      'GET',undefined,true,'application/vnd.github.object+json');
  }
  async function read(repo,commit){
    commit??=await branchHead(repo);
    const item=await contents(repo,PATH,commit);
    if(!item)return null;
    if(item.type!=='file'||typeof item.sha!=='string')throw new Error('Некорректный архив в GitHub.');
    if(item.size>MAX_ENVELOPE)throw Error('Файл журнала GitHub превышает допустимый размер.');
    const envelope=item.encoding==='base64'&&item.content
      ? decodeEnvelope(C.unbase64(item.content.replace(/\s/g,''))) : await readBlob(repo,item.sha);
    if(!envelope)throw new Error('Не удалось прочитать архив GitHub.');
    return {sha:item.sha,envelope,commit};
  }
  async function readObject(repo,id,commit){
    if(!C.isHash(id)||!commit)throw Error('Некорректная ссылка на документ GitHub.');
    const item=await contents(repo,objectPath(id),commit);
    if(item?.type!=='file'||!Number.isSafeInteger(item.size)||item.size<C.FILE_OVERHEAD||item.size>C.MAX_FILE+C.FILE_OVERHEAD)
      throw Error('В GitHub отсутствует зашифрованный документ или нарушен предел размера.');
    // Read the exact immutable Git object for binary data, regardless of the
    // Contents API's media representation or inline content.
    const bytes=await blobBytes(repo,item.sha,C.MAX_FILE+C.FILE_OVERHEAD);
    if(bytes?.length!==item.size)throw Error('GitHub вернул неполный зашифрованный документ.');
    await C.verifyObject(id,bytes);
    return {id,bytes};
  }
  async function write(repo,envelope,expectedSha,loadObject,active=()=>true){
    C.assertEnvelope(envelope);
    const apiRoot=root(repo);
    const authorized=requests;
    function requireSession(){if(!active()||requests!==authorized)throw Error('Журнал или подключение к GitHub закрыто.');}
    requireSession();
    const repoId=await privateRepo(repo);
    requireSession();
    const head=await branchHead(repo);
    requireSession();
    const latest=await read(repo,head);
    requireSession();
    if((latest?.sha||null)!==expectedSha){
      const error=Error('Конфликт: данные в GitHub изменились.');
      error.status=409;
      throw error;
    }
    const oldIds=new Set(latest?.envelope.objectIds||[]);
    const wanted=new Set(envelope.objectIds);
    const changes=[];
    if(stagingRepo!==repoId){stagedBlobs.clear();stagingRepo=repoId;}
    for(const id of stagedBlobs.keys())if(!wanted.has(id))stagedBlobs.delete(id);
    async function newBlob(bytes){
      requireSession();
      // GitHub identifies Git blobs by the SHA-1 of their header and bytes.
      // File authentication still uses AES-GCM and SHA-256.
      const header=encoder.encode('blob '+bytes.length+'\0');
      const input=new Uint8Array(header.length+bytes.length);
      input.set(header);
      input.set(bytes,header.length);
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-1',input));
      const expected=Array.from(digest,value=>value.toString(16).padStart(2,'0')).join('');
      requireSession();
      const item=await api(apiRoot+'/git/blobs','POST',{content:C.base64(bytes),encoding:'base64'});
      if(item?.sha!==expected)throw Error('Контрольная сумма загруженного файла GitHub не совпала.');
      return item.sha;
    }
    const entry=(path,sha)=>({path,mode:'100644',type:'blob',sha});
    for(const id of wanted){
      if(oldIds.has(id))continue;
      requireSession();
      let sha=stagedBlobs.get(id);
      if(!sha){
        const object=await loadObject?.(id);
        if(!object)throw Error('На устройстве отсутствует зашифрованный документ.');
        await C.verifyObject(id,object.bytes);
        sha=await newBlob(object.bytes);
        requireSession();
        stagedBlobs.set(id,sha);
      }
      changes.push(entry(objectPath(id),sha));
    }
    for(const id of oldIds)if(!wanted.has(id))changes.push(entry(objectPath(id),null));
    const sha=await newBlob(encoder.encode(JSON.stringify(envelope)+'\n'));
    changes.push(entry(PATH,sha));
    requireSession();
    const base=await api(apiRoot+'/git/commits/'+head);
    requireSession();
    const tree=await api(apiRoot+'/git/trees','POST',{base_tree:base.tree.sha,tree:changes});
    requireSession();
    const commit=await api(apiRoot+'/git/commits','POST',{
      message:'health: sync encrypted personal data [skip ci]',tree:tree.sha,parents:[head],
    });
    // The complete tree becomes visible together. A concurrent head wins over this draft.
    requireSession();
    if(await privateRepo(repo)!==repoId)throw Error('Репозиторий GitHub изменился во время отправки.');
    requireSession();
    const ref=await api(apiRoot+'/git/refs/heads/'+encodeURIComponent(repo.branch),'PATCH',{sha:commit.sha,force:false});
    if(ref?.object?.sha!==commit.sha)throw Error('GitHub не подтвердил сохранение журнала.');
    for(const id of wanted)stagedBlobs.delete(id);
    return sha;
  }
  window.HumanGithub={PATH,token,hasToken,disconnect,parseRepo,verify,read,readBlob,readObject,write};
})();
