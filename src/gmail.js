
/* AYYY Gmail: token-only browser OAuth, local drafts, no persisted mailbox. */
(() => {
  'use strict';
  const app=window.AYYY, esc=app.escape, icon=app.icon;
  const READ='https://www.googleapis.com/auth/gmail.readonly';
  const SEND='https://www.googleapis.com/auth/gmail.send';
  const API='https://gmail.googleapis.com/gmail/v1/users/me';
  let token='',tokenUntil=0,sendToken='',sendUntil=0,gisLoader=null;
  let entries=[],detail=null,selected='',folder='INBOX',query='',status='',error='',loading=false,hasMore=false;
  let pageToken='',requestedPage='',email='',requestSerial=0;
  const clientId=()=>String(app.get('gmail.clientId','')||'').trim();
  const connected=()=>!!token&&Date.now()<tokenUntil;
  const drafts=()=>{const data=app.get('mailDrafts',[]);return Array.isArray(data)?data.filter(x=>x&&typeof x.id==='string'&&typeof x.to==='string'&&typeof x.body==='string').slice(0,100):[];};
  const newId=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
  const safeDate=value=>{try{const d=new Date(Number(value));return Number.isNaN(d.valueOf())?'':d.toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return'';}};
  function header(message,name){
    return (message?.payload?.headers||[]).find(h=>String(h.name||'').toLowerCase()===name.toLowerCase())?.value||'';
  }
  function fromBase64(value){
    if(typeof value!=='string'||value.length>3000000)return'';
    try{const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'='));
      const bytes=Uint8Array.from(raw,ch=>ch.charCodeAt(0));return new TextDecoder('utf-8',{fatal:false}).decode(bytes);}catch{return'';}
  }
  function toBase64(value){
    const bytes=new TextEncoder().encode(value);let raw='';
    for(let start=0;start<bytes.length;start+=8192){raw+=String.fromCharCode(...bytes.slice(start,start+8192));}
    return btoa(raw);
  }
  function bodyText(message){
    const part=message?.payload;
    if(!part)return message?.snippet||'';
    const walk=(p,type)=>{
      if(p.mimeType===type&&p.body?.data)return fromBase64(p.body.data);
      for(const child of p.parts||[]){const found=walk(child,type);if(found)return found;}
      return '';
    };
    let text=walk(part,'text/plain');
    if(text)return text.slice(0,100000);
    const html=walk(part,'text/html');
    if(html){const d=new DOMParser().parseFromString(html,'text/html');
      d.querySelectorAll('script,style,iframe,svg,form').forEach(el=>el.remove());
      return (d.body?.textContent||'').trim().slice(0,100000);
    }
    return (message.snippet||'').slice(0,2000);
  }
  async function gmailFetch(path,access,options={}){
    const response=await fetch(API+path,{...options,headers:{Authorization:'Bearer '+access,'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
    let data={};try{data=await response.json();}catch{}
    if(!response.ok){if(response.status===401){token='';sendToken='';}
      throw new Error(response.status===401?'Срок доступа истёк. Подключите Google снова.':data.error?.message||'Gmail API: HTTP '+response.status);}
    return data;
  }
  const canOAuth=()=>!!window.google?.accounts?.oauth2?.initTokenClient;
  function loadGIS(){
    if(canOAuth())return Promise.resolve();
    if(gisLoader)return gisLoader;
    gisLoader=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;
      s.onload=()=>canOAuth()?resolve():reject(new Error('Google Identity Services не загрузился'));
      s.onerror=()=>reject(new Error('Не удалось загрузить библиотеку Google'));
      document.head.appendChild(s);
    }).catch(err=>{gisLoader=null;throw err;});
    return gisLoader;
  }
  function screen(){if(app.route==='mail')app.render();}
  function requestScope(scope,done){
    if(!clientId()){error='Сначала сохраните OAuth Client ID.';screen();return;}
    if(!canOAuth()){
      status='Подготовка входа Google. Когда библиотека загрузится, нажмите кнопку снова.';
      screen();
      loadGIS().then(()=>{status='Google готов к подключению. Нажмите кнопку ещё раз.';screen();}).catch(err=>{error=err.message;screen();});
      return;
    }
    try{
      const client=window.google.accounts.oauth2.initTokenClient({
        client_id:clientId(),scope,
        callback:async answer=>{
          if(answer.error||!answer.access_token){error='Google не предоставил доступ: '+(answer.error||'отмена авторизации');screen();return;}
          const validUntil=Date.now()+Math.max(60,Number(answer.expires_in)||3600)*1000-30000;
          if(scope===READ){token=answer.access_token;tokenUntil=validUntil;email='';}
          else {sendToken=answer.access_token;sendUntil=validUntil;}
          error='';try{await done(answer.access_token);}catch(err){error=err.message||'Ошибка обращения к Gmail';screen();}
        }
      });
      client.requestAccessToken({prompt:'consent'});
    }catch(err){error=err.message||'Не удалось открыть окно входа Google';screen();}
  }
  async function loadMail(next=false){
    if(!connected()){status='Срок доступа истёк. Подключите Gmail снова.';screen();return;}
    const serial=++requestSerial;
    loading=true;error='';status='Загружаем письма Gmail…';screen();
    try{
      const params=new URLSearchParams({maxResults:'15'});
      if(folder==='INBOX'||folder==='SENT'||folder==='STARRED')params.set('labelIds',folder);
      if(query)params.set('q',query);
      if(next&&pageToken)params.set('pageToken',pageToken);
      const list=await gmailFetch('/messages?'+params.toString(),token);
      const messages=(list.messages||[]).slice(0,15);
      const fetched=await Promise.all(messages.map(m=>gmailFetch('/messages/'+encodeURIComponent(m.id)+'?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date',token)));
      if(serial!==requestSerial)return;
      entries=next?entries.concat(fetched):fetched;pageToken=list.nextPageToken||'';hasMore=!!pageToken;
      loading=false;status=entries.length?'Письма получены из Gmail. Содержимое не сохраняется в браузере.':'Писем нет.';
      if(!email){try{const profile=await gmailFetch('/profile',token);email=profile.emailAddress||'';}catch{}}
      screen();
    }catch(err){if(serial!==requestSerial)return;loading=false;error=err.message||'Ошибка Gmail API';screen();}
  }
  async function openMessage(id){
    if(!connected()||!id)return;
    selected=id;detail=null;loading=true;status='Читаем письмо…';screen();
    try{const msg=await gmailFetch('/messages/'+encodeURIComponent(id)+'?format=full',token);
      if(selected!==id)return;
      detail={id,from:header(msg,'From'),to:header(msg,'To'),subject:header(msg,'Subject')||'Без темы',date:safeDate(msg.internalDate),text:bodyText(msg)};
      loading=false;status='Содержимое загружено непосредственно из Gmail.';screen();
    }catch(err){loading=false;error=err.message;screen();}
  }
  function encodeMail(to,subject,text){
    const safeTo=to.replace(/[\r\n]/g,'').trim();
    const safeSubject=subject.replace(/[\r\n]/g,' ').trim().slice(0,150);
    if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(safeTo))throw new Error('Введите один корректный адрес получателя.');
    if(!text.trim())throw new Error('Текст письма пуст.');
    const subject64=toBase64(safeSubject||'Без темы');
    const text64=toBase64(text).match(/.{1,76}/g)?.join('\r\n')||'';
    const raw=['To: '+safeTo,'Subject: =?UTF-8?B?'+subject64+'?=','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',text64].join('\r\n');
    return toBase64(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  async function sendDraft(item){
    if(!connected()){error='Сначала подключите Gmail для отправки.';screen();return;}
    const commit=async access=>{
      loading=true;status='Отправляем письмо через Gmail API…';screen();
      try{
        const raw=encodeMail(item.to,item.subject,item.body);
        await gmailFetch('/messages/send',access,{method:'POST',body:JSON.stringify({raw})});
        app.set('mailDrafts',drafts().filter(d=>d.id!==item.id));
        loading=false;status='Письмо отправлено через Gmail.';error='';
        folder='SENT';selected='';detail=null;pageToken='';await loadMail(false);
        app.toast('Письмо отправлено через Gmail');
      }catch(err){loading=false;error=err.message;screen();}
    };
    if(sendToken&&Date.now()<sendUntil)commit(sendToken);
    else requestScope(SEND,commit);
  }
  function compose(id=''){
    const d=drafts().find(x=>x.id===id)||{id:newId(),to:'',subject:'',body:''};
    app.modal('Письмо Gmail · локальный черновик','<form id="gmail-compose-form"><label class="field-label">Кому</label><input class="field" name="to" type="email" required value="'+esc(d.to)+'" placeholder="name@example.com"><label class="field-label">Тема</label><input class="field" name="subject" maxlength="150" value="'+esc(d.subject||'')+'"><label class="field-label">Текст письма</label><textarea class="field" name="body" rows="10" maxlength="100000" required>'+esc(d.body)+'</textarea><p class="small muted" style="margin-top:10px">Сохранить — только в этом браузере. Отправить — через Google, после отдельного подтверждения.</p><div class="modal-footer"><button type="button" class="btn" data-close-modal>Отмена</button><button class="btn" type="submit" name="intent" value="save">Сохранить черновик</button><button class="btn primary" type="submit" name="intent" value="send">Отправить Gmail</button></div></form>',true);
    const form=document.querySelector('#gmail-compose-form');
    form.onsubmit=ev=>{
      ev.preventDefault();const intent=ev.submitter?.value||'save';
      const updated={id:d.id,to:form.elements.to.value.trim(),subject:form.elements.subject.value.trim(),body:form.elements.body.value,updatedAt:new Date().toISOString()};
      if(!updated.to||!updated.body.trim()){app.toast('Заполните получателя и текст');return;}
      const list=drafts(),ix=list.findIndex(v=>v.id===d.id);
      if(ix<0)list.unshift(updated);else list[ix]=updated;
      if(!app.set('mailDrafts',list)){app.toast('Не удалось сохранить черновик');return;}
      app.closeModal();
      if(intent==='save'){app.toast('Черновик сохранён локально');screen();return;}
      app.modal('Подтвердить отправку','<p>Отправить письмо на <strong>'+esc(updated.to)+'</strong> через Gmail?</p><p class="small muted">Тема: '+esc(updated.subject||'Без темы')+'</p><div class="modal-footer"><button class="btn" data-close-modal>Отмена</button><button type="button" class="btn primary" id="gmail-approve-send">Отправить</button></div>');
      document.querySelector('#gmail-approve-send').onclick=()=>{app.closeModal();sendDraft(updated);};
    };
  }
  function mailHTML(){
    const logged=connected();
    const top='<div class="gmail-top"><div><h1>Почта Gmail</h1><p class="muted">Ваши письма напрямую из Google. Без серверного хранения в AYYY.</p></div><div class="gmail-actions"><button type="button" class="btn" data-gmail-config>Настройка</button>'+(logged?'<button class="btn" data-gmail-disconnect>Отключить</button>':'<button class="btn primary" data-gmail-connect>Подключить Gmail</button>')+'</div></div>';
    const note=error?'<div class="notice amber" role="alert">'+esc(error)+'</div>':status?'<p class="small muted" role="status">'+esc(status)+'</p>':'';
    const draftsHTML='<section class="panel gmail-drafts"><div class="panel-head"><h2>Черновики на этом устройстве</h2><button type="button" class="btn small" data-gmail-compose>Написать письмо</button></div>'+(drafts().length?drafts().map(d=>'<div class="gmail-draft-row"><button type="button" data-gmail-draft="'+esc(d.id)+'"><strong>'+esc(d.subject||'Без темы')+'</strong><small>'+esc(d.to)+'</small></button><button type="button" class="icon-btn" data-gmail-remove-draft="'+esc(d.id)+'" aria-label="Удалить черновик">'+icon('trash',16)+'</button></div>').join(''):'<p class="small muted">Черновиков пока нет.</p>')+'</section>';
    if(!logged)return '<div class="gmail-page">'+top+'<section class="panel gmail-onboarding"><h2>Подключение официального Gmail API</h2><p>Нужен OAuth Client ID проекта Google Cloud. Пароль и Client Secret не нужны; доступ запрашивает окно Google. На GitHub Pages приложение не может получить почту без такой настройки.</p><form id="gmail-client-form"><label class="field-label" for="gmail-client-id">OAuth Client ID (Web application)</label><input class="field mono" id="gmail-client-id" value="'+esc(clientId())+'" placeholder="123456789-....apps.googleusercontent.com" required><button class="btn primary" type="submit">Сохранить Client ID</button></form><p class="small muted">Разрешённый JavaScript origin в Google Cloud: <code>'+esc(location.origin)+'</code>. Включите Gmail API и добавьте себя в тестовые пользователи OAuth. Вход требует разрешения на чтение Gmail (restricted scope).</p><a target="_blank" rel="noopener noreferrer" href="https://developers.google.com/workspace/gmail/api/quickstart/js">Официальная инструкция Google</a></section>'+note+draftsHTML+'</div>';
    const folders=[['INBOX','Входящие'],['SENT','Отправленные'],['STARRED','Избранное']];
    const toolbar='<div class="gmail-toolbar"><span>'+esc(email||'Google аккаунт')+'</span><div><button class="btn small" data-gmail-refresh '+(loading?'disabled':'')+'>Обновить</button><button class="btn primary small" data-gmail-compose>Написать</button></div></div><nav class="gmail-folders">'+folders.map(v=>'<button type="button" data-gmail-folder="'+v[0]+'" class="'+(folder===v[0]?'active':'')+'">'+v[1]+'</button>').join('')+'</nav><form id="gmail-search-form" class="gmail-search"><input class="field" id="gmail-search" value="'+esc(query)+'" placeholder="Поиск по Gmail (например, from:...)" aria-label="Поиск писем"><button class="btn" type="submit">Найти</button></form>';
    const list=entries.map(m=>'<button type="button" class="gmail-mail-item '+(selected===m.id?'selected':'')+'" data-gmail-open="'+esc(m.id)+'"><strong>'+esc(header(m,'Subject')||'Без темы')+'</strong><span>'+esc(header(m,'From'))+'</span><small>'+esc(safeDate(m.internalDate))+' · '+esc((m.snippet||'').slice(0,170))+'</small></button>').join('')||'<p class="small muted">В этой папке нет писем или список ещё не загружен.</p>';
    const view=detail?'<article class="gmail-message"><h2>'+esc(detail.subject)+'</h2><p class="small muted">От: '+esc(detail.from)+' · Кому: '+esc(detail.to)+' · '+esc(detail.date)+'</p><pre class="gmail-body">'+esc(detail.text)+'</pre></article>':'<div class="gmail-empty">Выберите письмо слева, чтобы прочитать его.<p class="small muted">HTML-письма показываются только как текст; вложения открывайте в Gmail.</p></div>';
    return '<div class="gmail-page">'+top+note+toolbar+'<div class="gmail-columns"><section class="panel gmail-list"><h2>Письма '+(loading?'· загрузка':'')+'</h2>'+list+(hasMore?'<button class="btn small" data-gmail-more '+(loading?'disabled':'')+'>Ещё 15</button>':'')+'</section><section class="panel gmail-reader">'+view+'</section></div>'+draftsHTML+'</div>';
  }
  app.register('mail',{
    title:'Gmail · почта',
    render:mailHTML,
    mount(){
      const root=document.querySelector('#view .gmail-page');if(!root)return;
      if(clientId()&&!canOAuth())loadGIS().catch(()=>{});
      root.addEventListener('submit',ev=>{
        if(ev.target.id==='gmail-client-form'){
          ev.preventDefault();const id=root.querySelector('#gmail-client-id').value.trim();
          if(!/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(id)){error='Неверный формат OAuth Client ID.';screen();return;}
          app.set('gmail.clientId',id);error='';status='Client ID сохранён. Нажмите «Подключить Gmail».';screen();return;
        }
        if(ev.target.id==='gmail-search-form'){ev.preventDefault();query=root.querySelector('#gmail-search').value.trim().slice(0,300);pageToken='';selected='';detail=null;loadMail(false);}
      });
      root.addEventListener('click',ev=>{
        const b=ev.target.closest('button');if(!b)return;
        if(b.hasAttribute('data-gmail-connect')){requestScope(READ,()=>loadMail(false));return;}
        if(b.hasAttribute('data-gmail-config')){token='';sendToken='';entries=[];detail=null;error='';status='Укажите OAuth Client ID. Доступ отключён.';screen();return;}
        if(b.hasAttribute('data-gmail-disconnect')){
          const access=token;token='';sendToken='';tokenUntil=sendUntil=0;entries=[];detail=null;selected='';email='';requestSerial++;
          if(access&&window.google?.accounts?.oauth2?.revoke)window.google.accounts.oauth2.revoke(access,()=>{});
          error='';status='Gmail отключён. Письма удалены из памяти вкладки.';screen();return;
        }
        if(b.hasAttribute('data-gmail-refresh')){loadMail(false);return;}
        if(b.hasAttribute('data-gmail-folder')){folder=b.dataset.gmailFolder;pageToken='';selected='';detail=null;loadMail(false);return;}
        if(b.hasAttribute('data-gmail-more')){loadMail(true);return;}
        if(b.hasAttribute('data-gmail-open')){openMessage(b.dataset.gmailOpen);return;}
        if(b.hasAttribute('data-gmail-compose')){compose();return;}
        if(b.hasAttribute('data-gmail-draft')){compose(b.dataset.gmailDraft);return;}
        if(b.hasAttribute('data-gmail-remove-draft')){
          app.set('mailDrafts',drafts().filter(d=>d.id!==b.dataset.gmailRemoveDraft));screen();
        }
      });
    }
  });
})();
