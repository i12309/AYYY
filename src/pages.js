(() => {
  'use strict';
  const a=window.AYYY, e=a.escape, i=a.icon;
  // Home and the service directory are registered by splash.js.
  a.apiBadge=(data)=>`<span class="badge ${data.live?'live':'demo'}">${data.live?(data.stale?'Сохранено':'API'):'Демо'}</span>`;
  a.searchProviders={Google:{letter:'G',url:q=>'https://www.google.com/search?q='+encodeURIComponent(q)},Яндекс:{letter:'Я',url:q=>'https://yandex.ru/search/?text='+encodeURIComponent(q)},DuckDuckGo:{letter:'D',url:q=>'https://duckduckgo.com/?q='+encodeURIComponent(q)},Bing:{letter:'b',url:q=>'https://www.bing.com/search?q='+encodeURIComponent(q)}};
  a.performSearch=(query,mode='web',provider=a.get('searchEngine','Google'),type='web')=>{
    query=query.trim();if(!query){a.toast('Напишите, что хотите найти.');return;}
    if(mode==='local'){a.catalogCategory='all';a.navigate('directory',query);return;}if(mode==='ai'){a.navigate('ai',query);return;}
    let url=(a.searchProviders[provider]||a.searchProviders.Google).url(query);
    if(type==='video')url='https://www.youtube.com/results?search_query='+encodeURIComponent(query);
    else if(type==='images')url='https://www.google.com/search?tbm=isch&q='+encodeURIComponent(query);
    else if(type==='maps')url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
    else if(type==='wiki')url='https://ru.wikipedia.org/w/index.php?search='+encodeURIComponent(query);
    else if(type==='code')url='https://github.com/search?type=code&q='+encodeURIComponent(query);
    a.set('recentSearches',[query,...a.get('recentSearches',[]).filter(s=>s!==query)].slice(0,10));window.open(url,'_blank','noopener,noreferrer');
  };
})();
