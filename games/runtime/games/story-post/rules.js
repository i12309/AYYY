/* Authored clue patterns. Every letter refers to exactly one rendered house. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('../../shared/learning-core.js') : root.LearningCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PostRules = api;
})(typeof window !== 'undefined' ? window : null, function (C) {
  'use strict';
  const LEVELS = [
    { id: 'address', title: 'Найди дом', detail: 'Короткая записка' },
    { id: 'clues', title: 'Две подсказки', detail: 'Прочитай оба предложения' },
    { id: 'stories', title: 'Почтовые истории', detail: 'Куда отнести посылку?' }
  ];
  const ROOFS = [{ name: 'синяя', adj: 'синей', color: '#559bdd' }, { name: 'красная', adj: 'красной', color: '#ea7582' }, { name: 'зелёная', adj: 'зелёной', color: '#65b597' }];
  const DOORS = [{ name: 'жёлтая', adj: 'жёлтой', color: '#f3cc62' }, { name: 'фиолетовая', adj: 'фиолетовой', color: '#a68bce' }];
  const PEOPLE = [
    { name: 'Заяц', to: 'зайцу', at: 'зайца', icon: '🐰' }, { name: 'Лиса', to: 'лисе', at: 'лисы', icon: '🦊' },
    { name: 'Мишка', to: 'мишке', at: 'мишки', icon: '🐻' }, { name: 'Белка', to: 'белке', at: 'белки', icon: '🐿️' },
    { name: 'Сова', to: 'сове', at: 'совы', icon: '🦉' }, { name: 'Панда', to: 'панде', at: 'панды', icon: '🐼' }
  ];
  const SYLLABLES = { 'отнеси': ['от','не','си'], 'письмо': ['пись','мо'], 'посылку': ['по','сыл','ку'], 'крышей': ['кры','шей'], 'синей': ['си','ней'], 'красной': ['крас','ной'], 'зелёной': ['зе','лё','ной'], 'дверью': ['две','рью'], 'жёлтой': ['жёл','той'], 'фиолетовой': ['фи','о','ле','то','вой'], 'верхнем': ['верх','нем'], 'нижнем': ['ниж','нем'], 'ряду': ['ря','ду'], 'слева': ['сле','ва'], 'справа': ['спра','ва'], 'середине': ['се','ре','ди','не'], 'подарок': ['по','да','рок'], 'лежит': ['ле','жит'], 'коробке': ['ко','роб','ке'], 'домой': ['до','мой'], 'гостях': ['гос','тях'], 'посылка': ['по','сыл','ка'], 'записка': ['за','пис','ка'], 'зайцу': ['зай','цу'], 'лисе': ['ли','се'], 'мишке': ['миш','ке'], 'белке': ['бел','ке'], 'сове': ['со','ве'], 'панде': ['пан','де'] };
  function generate(level, seed, index = 0) {
    if (!LEVELS.some(l => l.id === level)) level = 'address';
    const r = C.rng((seed + index * 17389) >>> 0);
    const occupants = C.shuffle(PEOPLE, r);
    const features = C.shuffle(Array.from({ length: 6 }, (_, i) => ({ roof: i % 3, door: Math.floor(i / 3) })), r);
    const houses = features.map((f, i) => ({ id: i, number: i + 1, ...f, person: occupants[i], row: Math.floor(i / 3), col: i % 3 }));
    const target = C.integer(r, 0, 5), h = houses[target], variant = index % 3;
    let lines, clue;
    if (level === 'address') {
      lines = variant === 0 ? [`Отнеси письмо ${h.person.to}.`] : variant === 1 ? [`Отнеси письмо в дом номер ${h.number}.`] : [`Отнеси письмо в дом ${['слева', 'в середине', 'справа'][h.col]} в ${h.row === 0 ? 'верхнем' : 'нижнем'} ряду.`]; clue = 0;
    } else if (level === 'clues') {
      lines = [`У дома ${ROOFS[h.roof].name} крыша.`, `У него ${DOORS[h.door].name} дверь.`, 'Отнеси письмо в этот дом.']; clue = 1;
    } else if (variant === 0) {
      const sender = houses[(target + 1) % 6].person;
      lines = [`Это посылка ${sender.to}.`, `На двери записка: «Я в гостях у ${h.person.at}».`, 'Отнеси посылку туда, где сейчас получатель.']; clue = 1;
    } else if (variant === 1) {
      lines = [`${h.person.name} ждёт подарок.`, 'Подарок лежит в коробке на почте.', `Отнеси коробку ${h.person.to} домой.`]; clue = 2;
    } else {
      lines = ['Утром почтальон намочил адрес.', `Он помнит: у дома ${ROOFS[h.roof].name} крыша и ${DOORS[h.door].name} дверь.`, 'Найди этот дом и доставь письмо.']; clue = 1;
    }
    const explanation = `Письмо доставлено: дом ${h.number}, ${h.person.name.toLowerCase()}. ${level === 'clues' ? 'Совпали оба признака — крыша и дверь.' : level === 'stories' && variant === 0 ? 'Получатель сейчас в гостях, поэтому мы пришли не к нему домой.' : 'Ты нашёл адрес по записке.'}`;
    return { level, target, houses, lines, clue, heading: 'Кому доставим письмо?', prompt: lines.join(' '), hint: level === 'clues' ? 'Нужно, чтобы совпали сразу оба признака. Прочитай про крышу и дверь.' : 'Перечитай выделенное предложение. Ищи дом по словам записки.', explanation };
  }
  function syllables(word) {
    const match = word.match(/^([^А-Яа-яЁё]*)([А-Яа-яЁё]+)([^А-Яа-яЁё]*)$/);
    if (!match) return [word];
    const parts = SYLLABLES[match[2].toLowerCase()];
    if (!parts) return [word];
    let at = 0;
    const result = parts.map(p => { const s = match[2].slice(at, at + p.length); at += p.length; return s; });
    result[0] = match[1] + result[0]; result[result.length - 1] += match[3]; return result;
  }
  function describe(h) { return `Дом ${h.number}. ${h.person.name}. ${ROOFS[h.roof].name} крыша, ${DOORS[h.door].name} дверь.`; }
  return { LEVELS, ROOFS, DOORS, PEOPLE, SYLLABLES, generate, syllables, describe };
});
