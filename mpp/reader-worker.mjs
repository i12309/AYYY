/* Parse Microsoft Project files off the UI thread. No network calls or persistent storage. */
import {readProject} from './vendor/mpxj-ts/mpxj.mjs';
import {normalizeProject} from './model.mjs';

self.onmessage = event => {
  const {bytes, filename} = event.data || {};
  try {
    if (!(bytes instanceof ArrayBuffer)) throw new Error('Нет данных файла.');
    const parsed = readProject(new Uint8Array(bytes));
    const model = normalizeProject(parsed, filename || '');
    const {byUid, ...transferableModel} = model;
    self.postMessage({ok:true, model:transferableModel});
  } catch (error) {
    self.postMessage({
      ok:false,
      error:String(error?.message || error || 'Ошибка чтения MPP'),
      code:String(error?.code || 'format')
    });
  }
};
