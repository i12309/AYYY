/* Single source for catalog cards, random featured game and mixed level shortcuts. */
(function (root, factory) {
  const games = factory();
  if (typeof module === 'object' && module.exports) module.exports = games;
  if (root) root.IGROLAND_GAME_REGISTRY = games;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const games = [
    {
      id: 'coloring', title: 'Раскраска по номерам', short: 'Оживи рисунок цвет за цветом',
      description: 'Выбирай цвет по номеру, раскрашивай клеточки и открывай яркие рисунки. Можно загрузить собственную фотографию!',
      category: 'Творчество', icon: '🎨', visual: ['🌸', '🦋', '💖', '🐱'],
      color: '#7456df', tint: '#f0ebff', link: 'games/coloring/index.html?level=heart',
      difficulty: 'От 4 лет',
      levels: [] // Filled from local PIXEL_LEVELS by the catalog.
    },
    {
      id: 'memory', title: 'Найди пару', short: 'Секреты хорошей памяти',
      description: 'Переворачивай карточки и запоминай, где прячутся одинаковые зверята. Начни с трёх пар и постепенно усложняй задачу.',
      category: 'Память', icon: '🐰', visual: ['🐰', '🐼', '🐶', '🦊'],
      color: '#d9559b', tint: '#ffedf6', link: 'games/memory/index.html?level=easy', difficulty: 'От 4 лет',
      levels: [
        { title: 'Первые пары', detail: '3 пары карточек', difficulty: 'easy', icon: '🐰', link: 'games/memory/index.html?level=easy' },
        { title: 'Лесные друзья', detail: '6 пар карточек', difficulty: 'medium', icon: '🦊', link: 'games/memory/index.html?level=normal' },
        { title: 'Большая память', detail: '10 пар карточек', difficulty: 'hard', icon: '🐼', link: 'games/memory/index.html?level=hard' }
      ]
    },
    {
      id: 'maze', title: 'Лабиринты', short: 'Помоги герою найти дорогу',
      description: 'Помоги медвежонку найти путь к цели. Проходи запутанные коридоры, пользуйся подсказками и рисуй маршрут пальчиком.',
      category: 'Логика', icon: '🐻', visual: ['🐻', '🧭', '🌳', '🍯'],
      color: '#21a88c', tint: '#e8faf2', link: 'games/maze/index.html?level=easy', difficulty: 'От 4 лет',
      levels: [
        { title: 'Первая тропинка', detail: 'Простой лабиринт', difficulty: 'easy', icon: '🍯', link: 'games/maze/index.html?level=easy' },
        { title: 'Лесные дорожки', detail: 'Средняя сложность', difficulty: 'medium', icon: '🌳', link: 'games/maze/index.html?level=normal' },
        { title: 'Запутанный путь', detail: 'Сложный лабиринт', difficulty: 'hard', icon: '🧭', link: 'games/maze/index.html?level=hard' }
      ]
    },
    {
      id: 'nuts', title: 'Сортировка гаек', short: 'Все цвета — по своим болтам',
      description: 'Перекладывай цветные гайки с болта на болт. На каждом должна остаться стопка одного цвета. Учись планировать несколько ходов вперёд.',
      category: 'Головоломка', icon: '🔩', visual: ['🔴', '🟡', '🟢', '🔵'],
      color: '#eb8245', tint: '#fff1e6', link: 'games/nuts/index.html?level=1', difficulty: 'От 5 лет',
      levels: [1, 3, 6, 9, 12, 20].map((num, index) => ({ title: `Уровень ${num}`, detail: index < 2 ? 'Первые цвета' : index < 4 ? 'Цветная задачка' : 'Для мастеров', difficulty: index < 2 ? 'easy' : index < 4 ? 'medium' : 'hard', icon: ['🔴','🟡','🟢','🔵','🟣','🟠'][index], link: `games/nuts/index.html?level=${num}` }))
    },
    {
      id: 'arrows', title: 'Распутай стрелки', short: 'Найди свободный путь',
      description: 'Нажимай на стрелки, которые могут выбраться с поля, не задев соседок. Распутай все линии и освободи пространство.',
      category: 'Внимание', icon: '↗️', visual: ['↗️', '↪️', '⬅️', '↘️'],
      color: '#408dda', tint: '#eaf2ff', link: 'games/arrows/index.html?level=1', difficulty: 'От 5 лет',
      levels: [1, 3, 9, 21, 35].map((num, index) => ({ title: `Уровень ${num}`, detail: index < 2 ? 'Свободные стрелки' : index < 4 ? 'Больше поворотов' : 'Настоящий вызов', difficulty: index < 2 ? 'easy' : index < 4 ? 'medium' : 'hard', icon: ['↗️','⬅️','↪️','↘️','↖️'][index], link: `games/arrows/index.html?level=${num}` }))
    },
    {
      id: 'hexmerge', title: 'Числовые соты', short: 'Соединяй числа',
      description: 'Найди соседние соты с одинаковым числом и объедини их. Двигайся от маленьких двоек к большим числам и строй цепочки.',
      category: 'Числа', icon: '⬡', visual: ['2', '4', '8', '16'],
      color: '#3caaa5', tint: '#e9f9f8', link: 'games/hexmerge/index.html?level=easy', difficulty: 'От 6 лет',
      levels: [
        { title: 'Число 64', detail: 'Простая цель', difficulty: 'easy', icon: '64', link: 'games/hexmerge/index.html?level=easy' },
        { title: 'Число 128', detail: 'Средняя цель', difficulty: 'medium', icon: '128', link: 'games/hexmerge/index.html?level=normal' },
        { title: 'Число 256', detail: 'Сложная цель', difficulty: 'hard', icon: '256', link: 'games/hexmerge/index.html?level=hard' }
      ]
    },
    {
      id: 'mahjong', title: 'Маджонг', short: 'Найди одинаковые фишки',
      description: 'Отыскивай две одинаковые свободные фишки и убирай их с поля. Начни с простого сада, а затем разгадай башни и черепашку.',
      category: 'Наблюдательность', icon: '🀄', visual: ['🌸', '🐼', '🌙', '🦋'],
      color: '#bc7c42', tint: '#fff3e3', link: 'games/mahjong/index.html?level=garden', difficulty: 'От 4 лет',
      levels: [
        { title: 'Цветочный сад', detail: '16 фишек', difficulty: 'easy', icon: '🌸', link: 'games/mahjong/index.html?level=garden' },
        { title: 'Зверята', detail: '24 фишки', difficulty: 'easy', icon: '🐼', link: 'games/mahjong/index.html?level=friends' },
        { title: 'Фонарики', detail: '28 фишек · 2 этажа', difficulty: 'medium', icon: '🏮', link: 'games/mahjong/index.html?level=lanterns' },
        { title: 'Старинный храм', detail: '44 фишки · 2 этажа', difficulty: 'medium', icon: '🏯', link: 'games/mahjong/index.html?level=temple' },
        { title: 'Черепашка', detail: '68 фишек · 3 этажа', difficulty: 'hard', icon: '🐢', link: 'games/mahjong/index.html?level=turtle' }
      ]
    },
    {
      "id": "marble-shooter",
      "title": "Шариковый лабиринт",
      "short": "Три шарика — и волшебная цепочка!",
      "description": "Прицеливайся и стреляй цветными шариками по извилистой дорожке. Собирай три одного цвета, запускай цепные реакции и проходи десять уровней.",
      "category": "Аркада",
      "icon": "🔮",
      "visual": [
        "🔵",
        "🟡",
        "🟣",
        "✨"
      ],
      "color": "#438edc",
      "tint": "#e8f4ff",
      "link": "games/marble-shooter/index.html?level=1",
      "difficulty": "От 4 лет",
      "levels": [
        {
          "title": "Первые шарики",
          "detail": "Первые цепочки",
          "difficulty": "easy",
          "icon": "🌈",
          "link": "games/marble-shooter/index.html?level=1"
        },
        {
          "title": "Радужная поляна",
          "detail": "Первые цепочки",
          "difficulty": "easy",
          "icon": "🌼",
          "link": "games/marble-shooter/index.html?level=2"
        },
        {
          "title": "Солнечная дуга",
          "detail": "Первые цепочки",
          "difficulty": "easy",
          "icon": "☀️",
          "link": "games/marble-shooter/index.html?level=3"
        },
        {
          "title": "Морской поворот",
          "detail": "Повороты и цвета",
          "difficulty": "medium",
          "icon": "🐬",
          "link": "games/marble-shooter/index.html?level=4"
        },
        {
          "title": "Тайная тропа",
          "detail": "Повороты и цвета",
          "difficulty": "medium",
          "icon": "🍀",
          "link": "games/marble-shooter/index.html?level=5"
        },
        {
          "title": "Зеркальный сад",
          "detail": "Повороты и цвета",
          "difficulty": "medium",
          "icon": "🪞",
          "link": "games/marble-shooter/index.html?level=6"
        },
        {
          "title": "Волшебное кольцо",
          "detail": "Повороты и цвета",
          "difficulty": "medium",
          "icon": "🌀",
          "link": "games/marble-shooter/index.html?level=7"
        },
        {
          "title": "Лесной ручей",
          "detail": "Для мастеров",
          "difficulty": "hard",
          "icon": "🌳",
          "link": "games/marble-shooter/index.html?level=8"
        },
        {
          "title": "Звёздный вираж",
          "detail": "Для мастеров",
          "difficulty": "hard",
          "icon": "⭐",
          "link": "games/marble-shooter/index.html?level=9"
        },
        {
          "title": "Мастер шариков",
          "detail": "Для мастеров",
          "difficulty": "hard",
          "icon": "🏆",
          "link": "games/marble-shooter/index.html?level=10"
        }
      ]
    }
  ];
  return Object.freeze(games.map(game => Object.freeze({ ...game, levels: Object.freeze(game.levels) })));
});
