/* GitHub transport. Only encrypted envelopes reach the private repository.
   Token is in module memory and vanishes when this page is closed/reloaded. */
(() => {
  'use strict';
  const PATH='health-data/v1/vault.json';
  let bearer='';
  const encoder=new TextEncoder(), decoder=new TextDecoder('utf-8',{fatal:true});
  function token(value){bearer=String(value||'').trim();}
  function hasToken(){return !!bearer;}
  function disconnect(){bearer='';}
  function parseRepo(value,branch='main'){
    const name=String(value||'').trim().replace(/^https:\/\/github\.com\//i,'').replace(/\.git$/i,'').replace(/\/$/,'');
    const found=name.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)$/);
    if(!found || !branch || !/^[A-Za-z0-9._/-]+$/.test(branch) ||
       branch.includes('..') || branch.includes('@{') || branch.startsWith('/') ||
       branch.endsWith('/') || branch.endsWith('.lock'))throw new Error('Укажите репозиторий owner/repo и корректную ветку.');
    return {owner:found[1],repo:found[2],branch};
  }
  function root(repo){return '/repos/'+encodeURIComponent(repo.owner)+'/'+encodeURIComponent(repo.repo);}
  async function api(path,method='GET',body,allow404=false){
    if(!bearer)throw new Error('Введите GitHub-токен с разрешением Contents на приватный репозиторий.');
    let response;
    try{
      response=await fetch('https://api.github.com'+path,{
        method,cache:'no-store',
        headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+bearer,
          'X-GitHub-Api-Version':'2022-11-28',...(body===undefined?{}:{'Content-Type':'application/json'})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})
      });
    }catch{throw new Error('GitHub недоступен. Проверьте подключение к интернету.');}
    if(allow404 && response.status===404)return null;
    if(!response.ok){
      if([409,422].includes(response.status)){
        const error=new Error('Конфликт: данные в GitHub изменились. Загрузите их и разрешите конфликт.');
        error.status=response.status;
        throw error;
      }
      if(response.status===401)throw new Error('GitHub-токен недействителен или истёк.');
      if(response.status===403)throw new Error('Нет доступа к GitHub или превышен лимит API.');
      if(response.status===404)throw new Error('Не найден репозиторий, ветка или файл.');
      throw new Error('GitHub вернул ошибку HTTP '+response.status+'.');
    }
    return response.status===204?null:response.json();
  }
  async function verify(repo){
    const info=await api(root(repo));
    if(info.private!==true)throw new Error('Медицинские данные запрещено синхронизировать с публичным репозиторием.');
    await api(root(repo)+'/git/ref/heads/'+encodeURIComponent(repo.branch));
    return true;
  }
  function decodeEnvelope(encoded){
    try{
      const envelope=JSON.parse(decoder.decode(window.HumanCrypto.unbase64(encoded.replace(/\s/g,''))));
      window.HumanCrypto.assertEnvelope(envelope);
      return envelope;
    }catch{throw new Error('В GitHub лежит файл неизвестного формата; данные не изменены.');}
  }
  async function readBlob(repo,sha){
    if(!/^[0-9a-f]{40}$/i.test(sha))throw new Error('Некорректный идентификатор версии GitHub.');
    const blob=await api(root(repo)+'/git/blobs/'+encodeURIComponent(sha),'GET',undefined,true);
    if(!blob)return null;
    if(blob.sha!==sha||blob.encoding!=='base64'||!blob.content)throw new Error('Не удалось прочитать версию архива GitHub.');
    return decodeEnvelope(blob.content);
  }
  async function read(repo){
    const item=await api(root(repo)+'/contents/'+PATH+'?ref='+encodeURIComponent(repo.branch),
      'GET',undefined,true);
    if(!item)return null;
    if(item.type!=='file'||typeof item.sha!=='string')throw new Error('Некорректный архив в GitHub.');
    const envelope=item.encoding==='base64'&&item.content ? decodeEnvelope(item.content) : await readBlob(repo,item.sha);
    if(!envelope)throw new Error('Не удалось прочитать архив GitHub.');
    return {sha:item.sha,envelope};
  }
  async function write(repo,envelope,expectedSha){
    window.HumanCrypto.assertEnvelope(envelope);
    const bytes=encoder.encode(JSON.stringify(envelope)+'\n');
    // PUT /contents requires the latest blob SHA when updating a file.
    const payload={message:'health: sync encrypted personal data [skip ci]',
      content:window.HumanCrypto.base64(bytes),branch:repo.branch};
    if(expectedSha)payload.sha=expectedSha;
    const result=await api(root(repo)+'/contents/'+PATH,'PUT',payload);
    if(!result?.content?.sha)throw new Error('GitHub не подтвердил сохранение.');
    return result.content.sha;
  }
  window.HumanGithub={PATH,token,hasToken,disconnect,parseRepo,verify,read,readBlob,write};
})();
