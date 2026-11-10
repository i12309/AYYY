/* Three-way comparison of decrypted journals. Results stay in browser memory. */
(() => {
  'use strict';
  const C = window.HumanCrypto;
  const collections = [...Object.keys(window.HumanJournal.collections), 'revisions', 'timeline'];

  function equal(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal(a[key], b[key]));
  }

  function index(rows, key, collection) {
    const result = new Map();
    for (const row of rows) {
      const id = row?.[key];
      if (typeof id !== 'string' || !id || result.has(id))
        throw Error('В архиве обнаружены записи без уникального ключа: ' + collection + '.');
      result.set(id, row);
    }
    return result;
  }

  function plan(base, local, remote, choices = []) {
    for (const doc of [base, local, remote]) {
      C.assertData(doc);
      if (doc.id !== local.id) throw Error('Версии принадлежат разным журналам.');
    }
    const conflicts = [];
    let unresolved = false;
    function select(collection, id, before, left, right) {
      if (equal(left, right) || equal(right, before)) return left;
      if (equal(left, before)) return right;
      const i = conflicts.length;
      conflicts.push({collection, id, before, local:left, remote:right});
      if (choices[i] === 'local') return left;
      if (choices[i] === 'remote') return right;
      unresolved = true;
      return left;
    }
    function mergeRecords(collection) {
      // request_id is the idempotency key for importing a review from two devices.
      const key = collection === 'recommendationReports' ? 'request_id' : 'id';
      const [old, left, right] = [base, local, remote].map(doc => index(doc[collection], key, collection));
      const ids = new Set([...old.keys(), ...left.keys(), ...right.keys()]);
      const records = [];
      for (const id of ids) {
        const chosen = select(collection, id, old.get(id), left.get(id), right.get(id));
        if (chosen !== undefined) records.push(chosen);
      }
      return records;
    }

    const doc = {schema:local.schema, id:local.id};
    for (const name of collections) doc[name] = mergeRecords(name);
    const known = new Set(['schema', 'id', 'analytePreferences', ...collections]);
    for (const name of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      if (known.has(name)) continue;
      const values = [base, local, remote].map(version => Object.hasOwn(version, name) ? version[name] : undefined);
      const value = select('settings', name, ...values);
      if (value !== undefined) Object.defineProperty(doc, name, {value, enumerable:true, writable:true, configurable:true});
    }
    const preferences = [base, local, remote].map(value => value.analytePreferences || {});
    if (preferences.some(value => Object.keys(value).length)) {
      const keys = new Set(preferences.flatMap(Object.keys));
      doc.analytePreferences = Object.fromEntries([...keys].flatMap(key => {
        const value = select('analytePreferences', key, ...preferences.map(p => Object.hasOwn(p, key) ? p[key] : undefined));
        return value === undefined ? [] : [[key, value]];
      }));
    }

    // Both histories are retained, but selecting the current questionnaire must
    // be explicit when the latest answers on each device differ.
    const [old, left, right] = [base, local, remote].map(value => value.recommendationIntakes.at(-1));
    const current = equal(left?.answers, right?.answers)
      ? (left?.version >= right?.version ? left : right)
      : select('currentQuestionnaire', '', old, left, right);
    if (current) {
      const at = doc.recommendationIntakes.findIndex(row => row.id === current.id);
      if (at >= 0) doc.recommendationIntakes.push(...doc.recommendationIntakes.splice(at, 1));
    }
    doc.revisions.sort((a, b) => (a.changedAt || '').localeCompare(b.changedAt || '') || a.id.localeCompare(b.id));
    return {doc:unresolved ? null : C.assertData(doc), conflicts};
  }

  window.HumanSyncMerge = {plan};
})();
