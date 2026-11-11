/* Browser-only OCR for scanned lab tables. The engine and language models are served with HUMAN. */
(() => {
  'use strict';
  const root = new URL('./vendor/ocr/', document.baseURI);
  const limit = 20_000_000;
  let library;

  function loadLibrary() {
    library ??= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('tesseract.min.js', root).href;
      script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(Error('Модуль распознавания не загрузился.'));
      script.onerror = () => {
        script.remove();
        reject(Error('Не удалось загрузить модуль распознавания.'));
      };
      document.head.append(script);
    }).catch(error => { library = undefined; throw error; });
    return library;
  }

  async function bounded(task, signal, milliseconds) {
    signal?.throwIfAborted();
    let cancel, timer;
    try {
      return await Promise.race([task, new Promise((_, reject) => {
        cancel = () => reject(signal.reason);
        signal?.addEventListener('abort', cancel, {once: true});
        timer = setTimeout(() => reject(Error('Превышено время распознавания.')), milliseconds);
      })]);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }

  const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 1;
  };

  function tableFromTsv(tsv, name) {
    const words = [];
    for (const line of tsv.split(/\r?\n/)) {
      const fields = line.split('\t');
      const [x, y, width, height, confidence] = fields.slice(6, 11).map(Number);
      const raw = fields.slice(11).join(' ').trim();
      if (fields[0] !== '5' || !raw || width <= 0 || height <= 0 || !Number.isFinite(confidence)) continue;
      if (words.length === 15_000) throw Error('На странице слишком много распознанных слов.');
      words.push({raw, x, y, width, height, center: y + height / 2, confidence});
    }
    const rows = [], provenance = [];
    if (!words.length) return {name, rows, provenance, ocr: true};
    const tolerance = median(words.map(word => word.height)) * .6;
    const gap = Math.max(tolerance, median(words.map(word => word.width / word.raw.length)) * 2.6);
    const lines = [];
    for (const word of words.sort((a, b) => a.center - b.center)) {
      let line = lines.at(-1);
      if (!line || word.center - line.center > tolerance) {
        line = {center: word.center, words: []};
        lines.push(line);
      }
      line.words.push(word);
    }
    const cells = lines.map(line => {
      const row = [];
      for (const word of line.words.sort((a, b) => a.x - b.x)) {
        const cell = row.at(-1);
        if (!cell || word.x - cell.at(-1).x - cell.at(-1).width > gap) row.push([word]);
        else cell.push(word);
      }
      return row;
    });
    const reference = cells.reduce((a, b) => a.length >= b.length ? a : b, []);
    if (reference.length > 100) throw Error('Распознано больше 100 колонок.');
    if (cells.length > 5000) throw Error('Распознано больше 5000 строк.');
    const boundaries = reference.slice(1).map((cell, i) => {
      const previous = reference[i].at(-1);
      return (cell[0].x + previous.x + previous.width) / 2;
    });
    for (const row of cells) {
      const columns = Array.from({length: reference.length}, () => []);
      for (const cell of row) {
        const next = boundaries.findIndex(boundary => cell[0].x < boundary);
        columns[next < 0 ? boundaries.length : next].push(...cell);
      }
      const text = columns.map(column => column.map(word => word.raw).join(' '));
      rows.push(text);
      provenance.push(columns.flatMap((column, i) => column.length ? [{
        column: i, kind: 'ocr', raw: text[i], confidence: Math.round(Math.min(...column.map(word => word.confidence))),
      }] : []));
    }
    return {name, rows, provenance, ocr: true};
  }

  async function recognize(canvas, name, {signal, onProgress} = {}) {
    signal?.throwIfAborted();
    onProgress?.('Загрузка распознавания');
    const tesseract = await bounded(loadLibrary(), signal, 30_000);
    let worker, failed, finished = false;
    const failure = new Promise((_, reject) => { failed = reject; });
    const creation = tesseract.createWorker(['rus', 'eng'], tesseract.OEM.LSTM_ONLY, {
      workerPath: new URL('worker.min.js', root).href,
      corePath: root.href,
      langPath: root.href.replace(/\/$/, ''),
      cacheMethod: 'none',
      workerBlobURL: false,
      logger: ({status, progress}) => {
        if (!finished && status === 'recognizing text') onProgress?.('Распознавание · ' + Math.round(progress * 100) + '%');
      },
      errorHandler: error => failed(Error(String(error))),
    }).then(async value => {
      if (finished) await value.terminate();
      else worker = value;
      return value;
    });
    try {
      const run = async () => {
        const current = await creation;
        if (finished) return null;
        await current.setParameters({tessedit_pageseg_mode: tesseract.PSM.SPARSE_TEXT});
        if (finished) return null;
        return current.recognize(canvas, {}, {text: false, tsv: true});
      };
      const result = await bounded(Promise.race([run(), failure]), signal, 120_000);
      return tableFromTsv(result.data.tsv || '', name);
    } finally {
      finished = true;
      await worker?.terminate();
    }
  }

  function imageSize(bytes, extension) {
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (extension === 'png' && bytes.length >= 24 && data.getUint32(0) === 0x89504e47 &&
        data.getUint32(4) === 0x0d0a1a0a && data.getUint32(12) === 0x49484452) {
      return [data.getUint32(16), data.getUint32(20)];
    }
    if (extension !== 'png' && bytes.length >= 4 && data.getUint16(0) === 0xffd8) {
      for (let i = 2; i + 4 < bytes.length && bytes[i] === 0xff;) {
        while (bytes[i] === 0xff) i++;
        const marker = bytes[i++];
        if (marker === 0xda || marker === 0xd9 || i + 2 > bytes.length) break;
        if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        const size = data.getUint16(i);
        if (size < 2 || i + size > bytes.length) break;
        if (size >= 7 && [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))
          return [data.getUint16(i + 5), data.getUint16(i + 3)];
        i += size;
      }
    }
    throw Error('Не удалось прочитать размеры изображения. Проверьте формат файла.');
  }

  async function imageCanvas(bytes, extension, {signal, preview=false} = {}) {
    const [width, height] = imageSize(bytes, extension);
    if (!width || !height || width * height > limit) throw Error('Изображение должно быть не больше 20 мегапикселей.');
    signal?.throwIfAborted();
    const bitmap = await createImageBitmap(new Blob([bytes], {type: extension === 'png' ? 'image/png' : 'image/jpeg'}));
    try {
      signal?.throwIfAborted();
      const scale = Math.min(1, (preview?1500:2600) / bitmap.width, (preview?2000:3200) / bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d', {alpha: false});
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      bitmap.close();
    }
  }

  window.HumanOCR = {imageCanvas, recognize};
})();
