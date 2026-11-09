/* Integer-only toy-shop arithmetic. Each order has an exact, inspectable answer. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('../../shared/learning-core.js') : root.LearningCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ShopRules = api;
})(typeof window !== 'undefined' ? window : null, function (C) {
  'use strict';
  const PRODUCTS = [
    { id: 'apple', name: 'Яблоко', icon: '🍎', price: 2, forms: ['яблоко', 'яблока', 'яблок'] },
    { id: 'pear', name: 'Груша', icon: '🍐', price: 1, forms: ['грушу', 'груши', 'груш'] },
    { id: 'carrot', name: 'Морковь', icon: '🥕', price: 3, forms: ['морковку', 'морковки', 'морковок'] },
    { id: 'berry', name: 'Клубника', icon: '🍓', price: 2, forms: ['ягоду', 'ягоды', 'ягод'] },
    { id: 'banana', name: 'Банан', icon: '🍌', price: 4, forms: ['банан', 'банана', 'бананов'] },
    { id: 'bread', name: 'Хлеб', icon: '🍞', price: 1, forms: ['буханку', 'буханки', 'буханок'] }
  ];
  const CLIENTS = ['🐿️', '🐰', '🦔', '🐻', '🦊', '🐼'];
  const LEVELS = [
    { id: 'count', title: 'Собери заказ', detail: 'Количество от 1 до 5' },
    { id: 'pay', title: 'Один товар', detail: 'Цена и единичные монетки' },
    { id: 'total', title: 'Две покупки', detail: 'Сложение в пределах 8' },
    { id: 'budget', title: 'Хватит ли монет?', detail: 'Сравни стоимость и кошелёк' },
    { id: 'change', title: 'Верни сдачу', detail: 'Вычитание в пределах 10' }
  ];
  const product = id => PRODUCTS.find(p => p.id === id);
  const coins = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'монета' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'монеты' : 'монет'}`;
  const cost = ids => ids.reduce((sum, id) => sum + (product(id)?.price || 0), 0);
  function sameOrder(a, b) { return a.length === b.length && a.slice().sort().join('|') === b.slice().sort().join('|'); }
  function generate(level, seed, index = 0) {
    if (!LEVELS.some(l => l.id === level)) level = 'count';
    const random = C.rng((seed + index * 31337) >>> 0);
    const items = C.shuffle(PRODUCTS, random);
    const quantity = C.integer(random, 1, 5);
    const order = level === 'count' ? Array(quantity).fill(items[0].id) : ['total', 'budget'].includes(level) ? [items[0].id, items[1].id] : [items[0].id];
    const total = cost(order);
    const wallet = level === 'change' ? total + C.integer(random, 0, 10 - total) : Math.max(0, total + C.integer(random, -3, 3));
    const request = level === 'count' ? `${quantity} ${items[0].forms[quantity === 1 ? 0 : quantity < 5 ? 1 : 2]}` : order.map(id => product(id).forms[0]).join(' и ');
    const prompt = level === 'count' ? `Собери заказ: ${request}.` : level === 'budget' ? `Собери ${request}. В кошельке: ${coins(wallet)}. Хватит ли на покупку?` : level === 'change' ? `Покупатель выбрал ${request}. Оплата: ${coins(wallet)}. Сколько сдачи ему вернуть?` : `Собери ${request} и положи нужное число монет.`;
    const expression = order.map(id => product(id).price).join(' + ');
    const explanation = level === 'count' ? `Всего предметов: ${quantity}. Каждое нажатие добавляет один.` : level === 'budget' ? `Стоимость: ${expression} = ${total}. В кошельке ${wallet}. ${wallet >= total ? 'Монет хватает.' : `Не хватает ${total - wallet}.`}` : level === 'change' ? `Дали ${wallet}, покупка стоит ${total}. Сдача: ${wallet} − ${total} = ${wallet - total}.` : `Стоимость: ${expression}${order.length > 1 ? ` = ${total}` : ''}. Нужно: ${coins(total)}.`;
    return { level, order, total, wallet, quantity, request, prompt, heading: LEVELS.find(l => l.id === level).title,
      client: CLIENTS[C.integer(random, 0, CLIENTS.length - 1)], explanation,
      hint: level === 'count' ? 'Нажимай на нужный товар по одному разу. Пересчитай предметы в корзине. Нажми на лишний, чтобы убрать.' : level === 'change' ? `Отложи из ${wallet} монет ${total} за покупку. Посчитай, сколько останется.` : 'Под каждым товаром показана его цена. За каждый товар нужно столько же единичных монет. Сложи их вместе.',
      answer: level === 'count' ? quantity : level === 'budget' ? wallet >= total : level === 'change' ? wallet - total : total };
  }
  function draft(raw) {
    if (!raw || !Array.isArray(raw.cart) || raw.cart.length > 10 || !raw.cart.every(id => !!product(id)) || !Number.isInteger(raw.coins) || raw.coins < 0 || raw.coins > 20) return { cart: [], coins: 0 };
    return { cart: raw.cart.slice(), coins: raw.coins };
  }
  function check(task, state, decision) {
    if (!sameOrder(state.cart, task.order)) return { ok: false, text: 'Сравни корзину с заказом. Лишний товар можно убрать нажатием.' };
    if (task.level === 'count') return { ok: true, text: task.explanation };
    const ok = task.level === 'budget' ? decision === task.answer : state.coins === task.answer;
    return { ok, text: ok ? task.explanation : task.level === 'change' ? 'Сдача — это монеты, оставшиеся после оплаты. Можно разложить их на столе.' : 'Посчитай монеты за каждый товар ещё раз. Цена указана на полке.' };
  }
  return { PRODUCTS, LEVELS, product, coins, cost, sameOrder, generate, draft, check };
});
