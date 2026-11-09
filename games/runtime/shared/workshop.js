/* Common controls and a bounded, local-only shelf. No dependency on game engines. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Workshop = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const KEY = 'workshop.shelf.v1';
  const SLUGS = ['shape-studio', 'marble-lab'];
  const clone = value => JSON.parse(JSON.stringify(value));
  function validEntry(e) {
    return e && /^w[\w-]{1,70}$/.test(e.id) && SLUGS.includes(e.game) &&
      typeof e.name === 'string' && e.name.length <= 60 && Number.isFinite(e.time) &&
      e.data && typeof e.data === 'object' && !Array.isArray(e.data) && JSON.stringify(e.data).length < 30000;
  }
  function entries() {
    const list = window.Igroland.read(KEY, []);
    return Array.isArray(list) ? list.filter(validEntry).slice(0, 24) : [];
  }
  function saveWork(game, name, data, id) {
    const list = entries();
    const old = list.findIndex(e => e.id === id && e.game === game);
    if (old < 0 && list.length >= 24) return { error: 'Полка заполнена: 24 работы. Удали ненужную работу на странице «Мои работы».' };
    const item = { id: old >= 0 ? id : `w${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`, game,
      name: String(name || 'Моя работа').trim().slice(0, 60) || 'Моя работа', time: Date.now(), data: clone(data) };
    if (!validEntry(item)) return { error: 'Работа не сохранена: неверный формат.' };
    if (old >= 0) list.splice(old, 1);
    list.unshift(item);
    return window.Igroland.write(KEY, list) ? { item } : { error: 'Браузер не разрешил сохранение. Не закрывай страницу с работой.' };
  }
  function removeWork(id) { return window.Igroland.write(KEY, entries().filter(e => e.id !== id)); }
  function element(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, action, cls = 'ws-button') {
    const b = element('button', cls, text); b.type = 'button'; b.addEventListener('click', action); return b;
  }
  function shell(title, subtitle, levels, onLevel) {
    const root = document.getElementById('workshopRoot');
    const top = element('div', 'ws-heading');
    top.append(element('div', 'ws-kicker', 'ПРИДУМАЙ · ПОПРОБУЙ · СОХРАНИ'), element('h1', '', title), element('p', '', subtitle)); root.append(top);
    const layout = element('div', 'ws-layout'), side = element('aside', 'ws-side'), main = element('section', 'ws-main');
    layout.append(side, main); root.append(layout);
    const label = element('label', 'ws-label', 'Задание или свободная мастерская'), select = element('select', 'ws-select');
    select.id = 'levelSelect'; label.htmlFor = select.id;
    levels.forEach(l => { const o = element('option', '', l.title); o.value = l.id; select.append(o); });
    select.addEventListener('change', () => onLevel(select.value)); side.append(label, select);
    const help = element('p', 'ws-help'); side.append(help);
    const tools = element('div', 'ws-tools'); side.append(tools);
    const status = element('div', 'ws-message'); status.id = 'gameMessage'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    main.append(status);
    const notify = text => { status.textContent = text; };
    const savebox = element('div', 'ws-savebox'); const nameLabel = element('label', 'ws-label', 'Название работы');
    const name = element('input', 'ws-input'); name.id = 'workName'; name.maxLength = 60; name.placeholder = 'Моя новая идея'; nameLabel.htmlFor = name.id;
    savebox.append(nameLabel, name); side.append(savebox);
    const details = element('details', 'ws-instructions'); details.append(element('summary', '', 'Как играть?')); side.append(details);
    return { root, side, main, tools, select, help, notify, name, savebox, details, status };
  }
  function route(id) { try { const u = new URL(location.href); u.searchParams.set('level', id); u.searchParams.delete('work'); history.replaceState(null, '', u); } catch (_) {} }
  return Object.freeze({ KEY, SLUGS, clone, validEntry, entries, saveWork, removeWork, element, button, shell, route });
});
