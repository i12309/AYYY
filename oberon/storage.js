/* OBERON local vault registry. Tokens never enter the IndexedDB record. */
(() => {
  'use strict';
  const DATABASE = 'ayyy-oberon-v1';
  const STORE = 'vaults';
  let connection;
  const clone = value => typeof structuredClone === 'function'
    ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const fault = (message, code) => Object.assign(new Error(message), {code});
  const conflict = () => fault('Это пространство изменилось в другой вкладке. Откройте его заново; сохранённые данные не перезаписаны.', 'LOCAL_CONFLICT');

  function storageError(error) {
    if (typeof error?.code === 'string') return error;
    if (error?.name === 'QuotaExceededError')
      return fault('В хранилище браузера недостаточно места. Скачайте копию заметок перед очисткой данных.', 'STORAGE_QUOTA');
    if (error?.name === 'ConstraintError') return conflict();
    return fault('Не удалось сохранить или прочитать данные в этом браузере. Проверьте доступ к локальному хранилищу; скачайте копию открытых заметок.', 'STORAGE_UNAVAILABLE');
  }

  function open() {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(fault('Для заметок нужен браузер с поддержкой IndexedDB. Локальное хранилище недоступно.', 'STORAGE_UNAVAILABLE'));
        return;
      }
      let blocked = false;
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath:'id'});
      };
      request.onblocked = () => {
        blocked = true;
        reject(fault('Закройте другие вкладки OBERON и откройте эту страницу заново, чтобы обновить хранилище.', 'STORAGE_BLOCKED'));
      };
      request.onerror = () => reject(storageError(request.error));
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) { db.close(); return; }
        db.onversionchange = () => { db.close(); connection = null; };
        db.onclose = () => { connection = null; };
        resolve(db);
      };
    }).catch(error => { connection = null; throw storageError(error); });
    return connection;
  }

  async function transaction(mode, command) {
    const db = await open();
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(STORE, mode, mode === 'readwrite' ? {durability:'strict'} : undefined); }
      catch (error) {
        // Older IndexedDB implementations do not accept a durability option.
        if (error?.name !== 'TypeError' && error?.name !== 'NotSupportedError') { reject(storageError(error)); return; }
        try { tx = db.transaction(STORE, mode); }
        catch (fallbackError) { reject(storageError(fallbackError)); return; }
      }
      let result, failure;
      const finish = value => { result = value; };
      const fail = error => {
        failure = error;
        try { tx.abort(); } catch (_) { reject(storageError(error)); }
      };
      tx.oncomplete = () => resolve(result === undefined ? undefined : clone(result));
      tx.onerror = tx.onabort = () => reject(storageError(failure || tx.error));
      try { command(tx.objectStore(STORE), finish, fail); }
      catch (error) { fail(error); }
    });
  }

  function string(value, max = 1024) { return typeof value === 'string' && value.length <= max; }
  function path(value) {
    return string(value) && !!value && !/[\\\u0000-\u001f]/.test(value) &&
      value.split('/').every(part => part && part !== '.' && part !== '..');
  }
  function cleanConnection(value) {
    if (!value) return null;
    if (!string(value.owner, 100) || !string(value.repo, 200) || !string(value.branch, 300) || !value.owner || !value.repo || !value.branch)
      throw fault('Не удалось сохранить подключение: проверьте репозиторий и ветку.', 'INVALID_DATA');
    const out = {owner:value.owner, repo:value.repo, branch:value.branch};
    for (const key of ['private', 'canWrite']) if (typeof value[key] === 'boolean') out[key] = value[key];
    if (Number.isSafeInteger(value.repoId)) out.repoId = value.repoId;
    if (string(value.htmlUrl, 1000) && /^https:\/\/github\.com\//.test(value.htmlUrl)) out.htmlUrl = value.htmlUrl;
    return out;
  }
  function cleanNotes(value) {
    if (!Array.isArray(value)) throw fault('В локальном хранилище ожидается список заметок.', 'INVALID_DATA');
    const ids = new Set(), paths = new Set();
    return value.map(note => {
      if (!note || !string(note.id, 1200) || !note.id || !path(note.path) || !/\.(md|markdown)$/i.test(note.path) ||
          typeof note.content !== 'string' || ids.has(note.id) || paths.has(note.path))
        throw fault('Заметки содержат повторяющиеся имена или некорректные пути. Данные не перезаписаны.', 'INVALID_DATA');
      ids.add(note.id); paths.add(note.path);
      return {id:note.id, path:note.path, content:note.content, favorite:!!note.favorite,
        updated:string(note.updated, 80) ? note.updated : null};
    });
  }
  function cleanSnapshot(value, remote = false) {
    if (!value || !Array.isArray(value.folders)) throw fault('Не удалось сохранить структуру папок OBERON.', 'INVALID_DATA');
    const folders = [...new Set(value.folders)];
    if (!folders.every(path)) throw fault('В структуре OBERON найден некорректный путь.', 'INVALID_DATA');
    const out = {notes:cleanNotes(value.notes), folders};
    if (remote) {
      for (const key of ['commit', 'tree', 'rootSha', 'rootTree']) if (string(value[key], 100)) out[key] = value[key];
      if (Number.isSafeInteger(value.repoId)) out.repoId = value.repoId;
      if (value.repository) out.repository = cleanConnection(value.repository);
      if (value.entries && typeof value.entries === 'object') {
        const cleanEntry = entry => {
          if (!entry || typeof entry !== 'object') return null;
          const item = {};
          for (const key of ['path', 'sha', 'mode', 'type', 'encoding']) if (string(entry[key])) item[key] = entry[key];
          if (Number.isSafeInteger(entry.size)) item.size = entry.size;
          if (typeof entry.content === 'string') item.content = entry.content;
          return item;
        };
        out.entries = Array.isArray(value.entries) ? value.entries.map(cleanEntry).filter(Boolean)
          : Object.fromEntries(Object.entries(value.entries).map(([name, entry]) => [name, typeof entry === 'string' ? entry : cleanEntry(entry)]));
      }
      return out;
    }
    if (value.active === null || string(value.active, 1200)) out.active = value.active;
    for (const key of ['mode', 'theme']) if (value[key] === null || string(value[key], 300)) out[key] = value[key];
    for (const key of ['version', 'textSize', 'sidebarWidth', 'editorWidth']) if (Number.isFinite(value[key])) out[key] = value[key];
    if (typeof value.inspector === 'boolean') out.inspector = value.inspector;
    if (typeof value.autoSync === 'boolean') out.autoSync = value.autoSync;
    for (const key of ['tabs', 'collapsed']) if (Array.isArray(value[key]) && value[key].every(v => string(v, key === 'tabs' ? 1200 : 1024))) out[key] = [...value[key]];
    if (value.syncConflict === null) out.syncConflict = null;
    else if (value.syncConflict !== undefined) {
      const conflict = value.syncConflict;
      if (!conflict || conflict.kind !== 'remote' || !Array.isArray(conflict.conflicts) ||
          !conflict.conflicts.every(item => item && path(item.path) &&
            ['base', 'local', 'remote'].every(key => item[key] === null || typeof item[key] === 'string')))
        throw fault('Не удалось сохранить сведения о конфликте. Открытые изменения не перезаписаны.', 'INVALID_DATA');
      out.syncConflict = {kind:'remote', conflicts:conflict.conflicts.map(item =>
        ({path:item.path, base:item.base, local:item.local, remote:item.remote})),
        remote:cleanSnapshot(conflict.remote, true),
        merged:cleanSnapshot(conflict.merged)};
    }
    return out;
  }
  function cleanRecord(value) {
    if (!value || !string(value.id, 300) || !value.id || /[\u0000-\u001f]/.test(value.id) ||
        !['demo', 'github'].includes(value.kind) || (value.kind === 'demo') !== (value.id === 'demo'))
      throw fault('Некорректное пространство OBERON.', 'INVALID_DATA');
    if (Object.keys(value).some(key => /token|password|secret|authorization|credential/i.test(key)))
      throw fault('Токены и пароли нельзя сохранять в хранилище заметок.', 'SECRET_REJECTED');
    const out = {id:value.id, kind:value.kind,
      name:string(value.name, 200) && value.name ? value.name : (value.kind === 'demo' ? 'Демо' : 'Заметки'),
      connection:value.kind === 'github' ? cleanConnection(value.connection) : null,
      snapshot:cleanSnapshot(value.snapshot), dirty:!!value.dirty,
      lastSync:string(value.lastSync, 80) ? value.lastSync : null,
      lastOpened:string(value.lastOpened, 80) ? value.lastOpened : null};
    if (value.kind === 'github' && !out.connection) throw fault('Для GitHub-пространства нужно подключение к репозиторию.', 'INVALID_DATA');
    out.base = value.base ? cleanSnapshot(value.base, true) : null;
    if (string(value.createdAt, 80)) out.createdAt = value.createdAt;
    if (typeof value.readOnly === 'boolean') out.readOnly = value.readOnly;
    if (string(value.error, 1000)) out.error = value.error;
    return out;
  }
  function metadata(value) {
    return {id:value.id, kind:value.kind, name:value.name, connection:value.connection || null,
      noteCount:value.snapshot?.notes?.length || 0, folderCount:value.snapshot?.folders?.length || 0,
      lastOpened:value.lastOpened || null, lastSync:value.lastSync || null, dirty:!!value.dirty,
      error:value.error || '', readOnly:!!value.readOnly, revision:value.revision};
  }

  function list() {
    return transaction('readonly', (store, finish) => {
      const request = store.getAll();
      request.onsuccess = () => finish(request.result.map(metadata).sort((a, b) =>
        a.kind === 'demo' ? -1 : b.kind === 'demo' ? 1 : (b.lastOpened || '').localeCompare(a.lastOpened || '') || a.name.localeCompare(b.name, 'ru')));
    });
  }
  function get(id) {
    return transaction('readonly', (store, finish) => {
      const request = store.get(id);
      request.onsuccess = () => finish(request.result || null);
    });
  }
  function create(record) {
    let next;
    try { next = {...cleanRecord(record), revision:1}; }
    catch (error) { return Promise.reject(error); }
    return transaction('readwrite', (store, finish) => {
      const request = store.add(next);
      request.onsuccess = () => finish(next);
    });
  }
  function save(record, expectedRevision) {
    let next;
    try {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw conflict();
      next = {...cleanRecord(record), revision:expectedRevision + 1};
    } catch (error) { return Promise.reject(error); }
    return transaction('readwrite', (store, finish, fail) => {
      const request = store.get(next.id);
      request.onsuccess = () => {
        if (!request.result || request.result.revision !== expectedRevision) { fail(conflict()); return; }
        const write = store.put(next);
        write.onsuccess = () => finish(next);
      };
    });
  }
  function remove(id, expectedRevision) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) return Promise.reject(conflict());
    if (id === 'demo') return Promise.reject(fault('Демонстрационное пространство остаётся доступным. Его содержимое можно восстановить отдельно.', 'DEMO_REQUIRED'));
    return transaction('readwrite', (store, finish, fail) => {
      const request = store.get(id);
      request.onsuccess = () => {
        if (!request.result || request.result.revision !== expectedRevision) { fail(conflict()); return; }
        const deletion = store.delete(id);
        deletion.onsuccess = () => finish(true);
      };
    });
  }
  function ensureDemo(seed) {
    let initial;
    try {
      initial = {...cleanRecord({id:'demo', kind:'demo', name:'Демо', snapshot:seed, dirty:false,
        createdAt:new Date().toISOString()}), revision:1};
    } catch (error) { return Promise.reject(error); }
    return transaction('readwrite', (store, finish) => {
      const request = store.get('demo');
      request.onsuccess = () => {
        if (request.result) { finish(request.result); return; }
        const insertion = store.add(initial);
        insertion.onsuccess = () => finish(initial);
      };
    });
  }
  window.OberonStorage = Object.freeze({list, get, create, save, remove, ensureDemo});
})();
