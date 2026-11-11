/* AYYY terminal: local model cache inspector. No broad origin storage deletion. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const formatSize = bytes => {
    if(!Number.isFinite(bytes))return 'Размер не определён';
    if(bytes < 1024 * 1024)return Math.ceil(bytes / 1024) + ' КБ';
    if(bytes < 1024 * 1024 * 1024)return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' ГБ';
  };
  function init(providers, isWorking = () => false) {
    const dialog = $('#modelCacheDialog');
    const openButton = $('#modelCacheBtn');
    const closeButton = $('#modelCacheClose');
    const refreshButton = $('#modelCacheRefresh');
    const list = $('#modelCacheList');
    const summary = $('#modelCacheSummary');
    const usage = $('#modelCacheUsage');
    const notice = $('#modelCacheNotice');
    if(!dialog || !openButton || !list || !providers) return;
    let rows = [];
    let pending = false;

    function announce(message, error = false) {
      notice.textContent = message;
      notice.classList.toggle('error', !!error);
    }
    function setPending(value) {
      pending = value;
      refreshButton.disabled = value;
      closeButton.disabled = value;
      list.querySelectorAll('[data-cache-index]').forEach(button => {
        button.disabled = value || isWorking() || providers.isBusy();
      });
    }
    function makeRow(model, index) {
      const row = document.createElement('div');
      row.className = 'cache-model-row';
      row.setAttribute('role', 'listitem');
      const desc = document.createElement('div');
      desc.className = 'cache-model-desc';
      const title = document.createElement('div');
      title.className = 'cache-model-name';
      title.textContent = model.name;
      title.title = model.name;
      const meta = document.createElement('div');
      meta.className = 'cache-model-meta';
      const status = model.status === 'ready' ? 'ЗАГРУЖЕНА' : 'НЕПОЛНАЯ / ПОВРЕЖДЕНА';
      meta.textContent = model.cache + ' · ' + status + ' · ' + formatSize(model.sizeBytes);
      if(model.status !== 'ready')meta.classList.add('warn');
      desc.append(title, meta);
      const remove = document.createElement('button');
      remove.className = 'cache-model-remove';
      remove.type = 'button';
      remove.dataset.cacheIndex = String(index);
      remove.textContent = 'Удалить';
      remove.setAttribute('aria-label', 'Удалить модель ' + model.name);
      remove.disabled = pending || isWorking() || providers.isBusy();
      row.append(desc, remove);
      return row;
    }
    async function refresh(afterMessage = '') {
      if(pending)return;
      setPending(true);
      list.replaceChildren();
      const loading = document.createElement('p');
      loading.className = 'cache-model-empty';
      loading.textContent = 'Проверка кэша GGUF и WebLLM на этом устройстве...';
      list.append(loading);
      announce('Поиск моделей...');
      try {
        const result = await providers.listCachedModels();
        rows = result.models;
        list.replaceChildren();
        if(!rows.length) {
          const empty = document.createElement('p');
          empty.className = 'cache-model-empty';
          empty.textContent = 'Скаченных моделей не обнаружено.';
          list.append(empty);
        }else{
          rows.forEach((model, index) => list.append(makeRow(model,index)));
        }
        const totalGGUF = rows
          .filter(m => m.engine === 'wllama')
          .reduce((sum,m) => sum + (m.sizeBytes || 0),0);
        summary.textContent = 'МОДЕЛЕЙ: ' + rows.length +
          ' / GGUF: ' + formatSize(totalGGUF) +
          ' / WebLLM: размер отдельных моделей браузер не сообщает';
        usage.textContent = Number.isFinite(result.originUsage) ?
          'Все данные этого сайта в браузере: ~' + formatSize(result.originUsage) +
          ' (включая другие разделы и проекты этого домена)' :
          'Оценка общего использования хранилища недоступна.';
        const errors = result.errors || [];
        announce(errors.length ? errors.join(' · ') :
          (afterMessage || 'Список актуален. Данные других разделов не удаляются.'), errors.length>0);
      }catch(error){
        rows = [];
        list.replaceChildren();
        summary.textContent = 'ОШИБКА ПРОВЕРКИ';
        announce(error?.message || String(error),true);
      }finally{
        setPending(false);
      }
    }
    async function remove(index) {
      if(pending)return;
      if(isWorking() || providers.isBusy()){
        announce('Сначала остановите текущую загрузку или генерацию в терминале.',true);
        return;
      }
      const model = rows[index];
      if(!model)return;
      const message = 'Удалить локальную модель «' + model.name + '»?\n\n' +
        'Её файлы будут удалены с этого устройства. При следующем запуске потребуется повторная загрузка.\n' +
        'Другие данные AYYY сохранятся.';
      if(!window.confirm(message))return;
      setPending(true);
      announce('Удаление ' + model.name + '...');
      let success=false;
      try {
        await providers.deleteCachedModel({engine:model.engine,id:model.id});
        success=true;
      }catch(error){
        announce('Не удалось удалить модель: ' + (error?.message || String(error)),true);
      }finally{
        setPending(false);
      }
      if(success)await refresh('Модель «' + model.name + '» удалена.');
    }

    openButton.addEventListener('click',() => {
      if(dialog.open)return;
      dialog.showModal();
      void refresh();
    });
    closeButton.addEventListener('click',() => {if(!pending)dialog.close();});
    refreshButton.addEventListener('click',() => void refresh());
    dialog.addEventListener('cancel',event => {if(pending)event.preventDefault();});
    list.addEventListener('click',event => {
      const button = event.target.closest('button[data-cache-index]');
      if(button && list.contains(button))void remove(Number(button.dataset.cacheIndex));
    });
  }
  window.AYYY_TERMINAL_MODEL_CACHE_UI={init,formatSize};
})();
