(() => {
  'use strict';
  const R = window.ShopRules;
  LearningUI.mount({ id: 'forest-shop', title: 'Магазин лесных друзей', color: '#b17b35',
    subtitle: 'Собери заказ, посчитай покупку и помоги лесным соседям.', count: 5, levels: R.LEVELS,
    parent: 'Сначала количество, затем цена одного товара и сумма двух. Сравнение бюджета и сдачу выбирайте позже. Монетки здесь условные: каждая равна одной единице. Нет реальных покупок, таймера и соревнования.',
    offline: 'Откройте магазин из игрушек. Сделайте ценники 1, 2, 3 и расплачивайтесь пуговицами под присмотром взрослого.',
    generate: R.generate, example: level => R.generate(level, 217, 0),
    render(task, area, ctx) {
      const { el, button } = ctx;
      let state = R.draft(ctx.getDraft());
      if (ctx.demo) state = { cart: task.order.slice(), coins: task.level === 'budget' || task.level === 'count' ? 0 : task.answer };
      const scene = el('div', 'shop-scene'), awning = el('div', 'shop-awning'); awning.append(el('strong', '', 'ЛЕСНАЯ ЛАВКА')); scene.append(awning);
      const client = el('div', 'shop-client'); client.append(el('span', 'shop-face', task.client), el('p', '', task.prompt)); scene.append(client);
      const shelves = el('div', 'shop-shelves'), basket = el('div', 'shop-basket');
      const basketTitle = el('div', 'shop-basket-title', 'КОРЗИНА · нажми на лишнее, чтобы убрать');
      const items = el('div', 'shop-items'); basket.append(basketTitle, items);
      function persist() { ctx.setDraft(state); }
      function refresh() {
        items.replaceChildren();
        if (!state.cart.length) items.append(el('span', 'ws-caption', 'Здесь пока пусто. Выбери товары на полке.'));
        state.cart.forEach((id, i) => {
          const p = R.product(id), b = button(p.icon, () => { if (ctx.done) return; state.cart.splice(i, 1); persist(); refresh(); }, 'shop-item');
          b.setAttribute('aria-label', `Убрать: ${p.name}`); b.disabled = ctx.done; items.append(b);
        });
      }
      R.PRODUCTS.forEach(p => {
        const b = button('', () => { if (ctx.done) return; if (state.cart.length >= 10) { ctx.announce('Корзина полна. Убери лишние товары.'); return; } state.cart.push(p.id); persist(); refresh(); }, 'shop-product');
        b.dataset.product = p.id; b.disabled = ctx.done;
        b.append(el('span', 'fruit', p.icon), el('strong', '', p.name));
        if (task.level !== 'count') b.append(el('small', '', R.coins(p.price)), el('span', 'shop-price-coins', '●'.repeat(p.price)));
        b.setAttribute('aria-label', `Добавить: ${p.name}${task.level !== 'count' ? `, цена ${p.price}` : ''}`); shelves.append(b);
      });
      scene.append(shelves, basket); area.append(scene); refresh();
      const check = decision => {
        if (ctx.demo) { ctx.announce(task.explanation); return; }
        const result = R.check(task, state, decision); ctx.submit(result.ok, result.text);
        if (result.ok) area.querySelectorAll('button').forEach(b => b.disabled = true);
      };
      if (task.level === 'budget') {
        const wallet = el('div', 'shop-money'); wallet.append(el('p', '', `В кошельке покупателя: ${R.coins(task.wallet)}`));
        const coins = el('div', 'shop-coins'); for (let i = 0; i < task.wallet; i++) coins.append(el('span', 'shop-coin', '1')); wallet.append(coins);
        const choices = el('div', 'shop-choices'); choices.append(button('Хватит', () => check(true), 'learn-button answer-choice'), button('Не хватит', () => check(false), 'learn-button answer-choice')); wallet.append(choices); area.append(wallet);
      } else if (task.level !== 'count') {
        const money = el('div', 'shop-money'); money.append(el('p', '', task.level === 'change' ? `Оплата покупателя: ${R.coins(task.wallet)}. Положи сдачу:` : 'Положи столько монет, сколько стоит покупка:'));
        const coins = el('div', 'shop-coins'), controls = el('div', 'shop-controls'), total = el('span', 'shop-total'); total.setAttribute('aria-live', 'polite');
        const update = () => { total.textContent = `${state.coins}`; coins.replaceChildren(); for (let i = 0; i < state.coins; i++) coins.append(el('span', 'shop-coin', '1')); };
        const adjust = n => { if (ctx.done) return; state.coins = Math.max(0, Math.min(20, state.coins + n)); persist(); update(); };
        controls.append(button('− 1', () => adjust(-1), 'learn-button'), total, button('+ 1', () => adjust(1), 'learn-button'));
        money.append(coins, controls); area.append(money); update();
      }
      if (task.level !== 'budget') area.append(button(task.level === 'count' ? 'Заказ собран' : task.level === 'change' ? 'Вернуть сдачу' : 'Оплатить', () => check(), 'learn-button primary shop-check answer-choice'));
      if (ctx.demo) area.append(el('p', 'shop-guide', task.explanation));
      ctx.onHint(() => { scene.classList.add('helped'); });
      if (ctx.done) area.querySelectorAll('button').forEach(b => b.disabled = true);
    }
  });
})();
