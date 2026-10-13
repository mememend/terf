// language: TypeScript, file: shared/src/config.ts
// ВСЕ ЧИСЛА ЗДЕСЬ — ПРЕДЛОЖЕНИЕ. Взяты из референсов и подлежат согласованию.
// Меняются в одном месте; backend импортирует этот же файл как источник истины.

import type {
  Country,
  LuckState,
  PhoneNumber,
  Rarity,
  RarityId,
  Tariff,
  TariffId,
  UpgradeId,
} from './types';

/* ─────────────────────────── РЕДКОСТЬ ─────────────────────────── */

export const RARITY_ORDER: RarityId[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
];

// Цвета сняты с окна «Шансы»: серая точка, зелёная, синяя, фиолетовая, янтарная, красная.
export const RARITIES: Record<RarityId, Rarity> = {
  common: {
    id: 'common',
    name: 'Обычный',
    whyName: 'Обычный',
    color: '#9AA0A6',
    glow: 'rgba(154,160,166,0.18)',
    basePrice: 1500,
    xp: 12,
  },
  uncommon: {
    id: 'uncommon',
    name: 'Необычный',
    whyName: 'Необычный',
    color: '#22C55E',
    glow: 'rgba(34,197,94,0.20)',
    basePrice: 3200,
    xp: 26,
  },
  rare: {
    id: 'rare',
    name: 'Редкий',
    whyName: 'Редкий',
    color: '#3B82F6',
    glow: 'rgba(59,130,246,0.24)',
    basePrice: 14000,
    xp: 70,
  },
  epic: {
    id: 'epic',
    name: 'Эпический',
    whyName: 'Эпический',
    color: '#A855F7',
    glow: 'rgba(168,85,247,0.28)',
    basePrice: 75000,
    xp: 220,
  },
  legendary: {
    id: 'legendary',
    name: 'Легендарный',
    whyName: 'Легендарный',
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.30)',
    basePrice: 520000,
    xp: 900,
  },
  mythic: {
    id: 'mythic',
    name: 'Мифический',
    whyName: 'Мифический',
    color: '#EF4444',
    glow: 'rgba(239,68,68,0.34)',
    basePrice: 4000000,
    xp: 4000,
  },
};

/**
 * Границы очков узора → категория. Опорная точка из референса:
 * «Лесенка ВНИЗ 65432» = +35 очков = Необычный.
 */
export const SCORE_BANDS: { upTo: number; rarity: RarityId }[] = [
  { upTo: 9, rarity: 'common' },
  { upTo: 39, rarity: 'uncommon' },
  { upTo: 79, rarity: 'rare' },
  { upTo: 139, rarity: 'epic' },
  { upTo: 219, rarity: 'legendary' },
  { upTo: Number.POSITIVE_INFINITY, rarity: 'mythic' },
];

export function rarityForScore(score: number): RarityId {
  for (const band of SCORE_BANDS) {
    if (score <= band.upTo) return band.rarity;
  }
  return 'mythic';
}

/** Целевой диапазон очков для категории — генератор строит номер под него. */
export function scoreRangeForRarity(rarity: RarityId): { min: number; max: number } {
  const index = SCORE_BANDS.findIndex((band) => band.rarity === rarity);
  const min = index === 0 ? 0 : SCORE_BANDS[index - 1].upTo + 1;
  const band = SCORE_BANDS[index];
  return { min, max: Number.isFinite(band.upTo) ? band.upTo : 400 };
}

/* ─────────────────────────── ТАРИФЫ ─────────────────────────── */

/**
 * Базовые вероятности без удачи. Проверка по референсам:
 * модалка тарифа даёт «1 из N», окно «Шансы» — те же значения при удаче ×2.
 * Сумма каждой строки ровно 100.
 */
export const TARIFFS: Record<TariffId, Tariff> = {
  standard: {
    id: 'standard',
    name: 'Стандарт',
    price: 1700,
    ticketCost: null,
    tagline: 'тариф Циферок',
    stripe: '#E5E7EB',
    gradient: 'linear-gradient(135deg, #F4F4F5 0%, #FFFFFF 52%, #EDEDEF 100%)',
    accent: '#9AA0A6',
    odds: {
      mythic: 0.0003,
      legendary: 0.0059,
      epic: 0.72,
      rare: 6.0,
      uncommon: 25,
      common: 68.2738,
    },
    xpMultiplier: 1,
  },
  plus: {
    id: 'plus',
    name: 'Плюс',
    price: 7000,
    ticketCost: null,
    tagline: 'тариф Циферок',
    stripe: '#38BDF8',
    gradient: 'linear-gradient(135deg, #7DD3FC 0%, #F0F9FF 46%, #FFFFFF 100%)',
    accent: '#38BDF8',
    odds: {
      mythic: 0.002,
      legendary: 0.12,
      epic: 5,
      rare: 23.878,
      uncommon: 30,
      common: 41,
    },
    xpMultiplier: 2,
  },
  premium: {
    id: 'premium',
    name: 'Премиум',
    price: 34500,
    ticketCost: null,
    tagline: 'тариф Циферок',
    stripe: '#A855F7',
    gradient: 'linear-gradient(135deg, #C084FC 0%, #F5F0FF 46%, #FFFFFF 100%)',
    accent: '#A855F7',
    odds: {
      mythic: 0.01,
      legendary: 0.77,
      epic: 24,
      rare: 75.22,
      uncommon: 0,
      common: 0,
    },
    xpMultiplier: 4,
  },
  elite: {
    id: 'elite',
    name: 'Элит',
    price: null,
    ticketCost: 1,
    tagline: 'тариф Циферок',
    stripe: '#F0B90B',
    gradient: 'linear-gradient(135deg, #FCD34D 0%, #FFF8E1 44%, #FFFFFF 100%)',
    accent: '#F0B90B',
    odds: {
      mythic: 0.02,
      legendary: 3.03,
      epic: 96.95,
      rare: 0,
      uncommon: 0,
      common: 0,
    },
    xpMultiplier: 8,
  },
};

export const TARIFF_ORDER: TariffId[] = ['standard', 'plus', 'premium', 'elite'];

/* ─────────────────────────── ОПЕРАТОРЫ ─────────────────────────── */
// Синтетические операторы, совпадающие по стилю с референсом. Не аффилированы с реальными.


/* ─────────────────────────── РЕГИОНЫ ─────────────────────────── */
// Спрос — множитель к оценке номера. Числа предложены по разбросу цен из коллекции.

export const COUNTRIES: Country[] = [
  {
    id: 'ru',
    name: 'Россия',
    code: '+7',
    flag: '🇷🇺',
    demand: 1.0,
    mask: '+7 AAA BBB-CC-DD',
  },
  {
    id: 'us',
    name: 'США',
    code: '+1',
    flag: '🇺🇸',
    demand: 1.15,
    mask: '+1 (AAA) BBB-CCCC',
  },
  {
    id: 'gb',
    name: 'Великобритания',
    code: '+44',
    flag: '🇬🇧',
    demand: 1.18,
    mask: '+44 AAAA BBBBBB',
  },
  {
    id: 'de',
    name: 'Германия',
    code: '+49',
    flag: '🇩🇪',
    demand: 1.3,
    mask: '+49 AAA BBBBBBBB',
  },
  {
    id: 'fr',
    name: 'Франция',
    code: '+33',
    flag: '🇫🇷',
    demand: 1.15,
    mask: '+33 A BB CC DD EE',
  },
  {
    id: 'fi',
    name: 'Финляндия',
    code: '+358',
    flag: '🇫🇮',
    demand: 1.1,
    mask: '+358 AA BBB CCCC',
  },
  {
    id: 'jp',
    name: 'Япония',
    code: '+81',
    flag: '🇯🇵',
    demand: 1.35,
    mask: '+81 AA-BBBB-CCCC',
  },
  {
    id: 'ae',
    name: 'ОАЭ',
    code: '+971',
    flag: '🇦🇪',
    demand: 1.4,
    mask: '+971 AA BBB CCCC',
  },
  {
    id: 'kz',
    name: 'Казахстан',
    code: '+7',
    flag: '🇰🇿',
    demand: 0.85,
    mask: '+7 AAA BBB-CC-DD',
  },
  {
    id: 'br',
    name: 'Бразилия',
    code: '+55',
    flag: '🇧🇷',
    demand: 0.7,
    mask: '+55 AA BBBBB-CCCC',
  },
  {
    id: 'tr',
    name: 'Турция',
    code: '+90',
    flag: '🇹🇷',
    demand: 0.95,
    mask: '+90 AAA BBB CCCC',
  },
  {
    id: 'es',
    name: 'Испания',
    code: '+34',
    flag: '🇪🇸',
    demand: 1.05,
    mask: '+34 AAA BBB CCC',
  },
  {
    id: 'it',
    name: 'Италия',
    code: '+39',
    flag: '🇮🇹',
    demand: 1.1,
    mask: '+39 AAA BBB CCCC',
  },
  {
    id: 'pl',
    name: 'Польша',
    code: '+48',
    flag: '🇵🇱',
    demand: 0.9,
    mask: '+48 AAA BBB CCC',
  },
  {
    id: 'cn',
    name: 'Китай',
    code: '+86',
    flag: '🇨🇳',
    demand: 1.25,
    mask: '+86 AAA BBBB CCCC',
  },
  {
    id: 'in',
    name: 'Индия',
    code: '+91',
    flag: '🇮🇳',
    demand: 0.75,
    mask: '+91 AAAAA BBBBB',
  },
  {
    id: 'kr',
    name: 'Южная Корея',
    code: '+82',
    flag: '🇰🇷',
    demand: 1.3,
    mask: '+82 AA BBBB CCCC',
  },
  {
    id: 'ca',
    name: 'Канада',
    code: '+1',
    flag: '🇨🇦',
    demand: 1.05,
    mask: '+1 (AAA) BBB-CCCC',
  },
  {
    id: 'au',
    name: 'Австралия',
    code: '+61',
    flag: '🇦🇺',
    demand: 1.1,
    mask: '+61 AAA BBB CCC',
  },
  {
    id: 'mx',
    name: 'Мексика',
    code: '+52',
    flag: '🇲🇽',
    demand: 0.8,
    mask: '+52 AA BBBB CCCC',
  },
  {
    id: 'nl',
    name: 'Нидерланды',
    code: '+31',
    flag: '🇳🇱',
    demand: 1.12,
    mask: '+31 AA BBB CCCC',
  },
  {
    id: 'se',
    name: 'Швеция',
    code: '+46',
    flag: '🇸🇪',
    demand: 1.08,
    mask: '+46 AA BBB CCCC',
  },
  {
    id: 'ch',
    name: 'Швейцария',
    code: '+41',
    flag: '🇨🇭',
    demand: 1.45,
    mask: '+41 AA BBB CCCC',
  },
  {
    id: 'pt',
    name: 'Португалия',
    code: '+351',
    flag: '🇵🇹',
    demand: 0.95,
    mask: '+351 AAA BBB CCC',
  },
  {
    id: 'cz',
    name: 'Чехия',
    code: '+420',
    flag: '🇨🇿',
    demand: 0.92,
    mask: '+420 AAA BBB CCC',
  },
  {
    id: 'by',
    name: 'Беларусь',
    code: '+375',
    flag: '🇧🇾',
    demand: 0.74,
    mask: '+375 (AA) AAA-AA-AA',
  },
  {
    id: 'ua',
    name: 'Украина',
    code: '+380',
    flag: '🇺🇦',
    demand: 0.81,
    mask: '+380 (AA) AAA-AA-AA',
  },
  {
    id: 'ro',
    name: 'Румыния',
    code: '+40',
    flag: '🇷🇴',
    demand: 0.88,
    mask: '+40 AAA-AAA-AAA',
  },
  {
    id: 'gr',
    name: 'Греция',
    code: '+30',
    flag: '🇬🇷',
    demand: 0.94,
    mask: '+30 AAA-AAA-AAAA',
  },
  {
    id: 'hu',
    name: 'Венгрия',
    code: '+36',
    flag: '🇭🇺',
    demand: 0.9,
    mask: '+36 (AA) AAA-AAAA',
  },
  {
    id: 'at',
    name: 'Австрия',
    code: '+43',
    flag: '🇦🇹',
    demand: 1.12,
    mask: '+43 AAA-AAAAAAA',
  },
  {
    id: 'be',
    name: 'Бельгия',
    code: '+32',
    flag: '🇧🇪',
    demand: 1.08,
    mask: '+32 (AAA) AA-AA-AA',
  },
  {
    id: 'dk',
    name: 'Дания',
    code: '+45',
    flag: '🇩🇰',
    demand: 1.16,
    mask: '+45 AA-AA-AA-AA',
  },
  {
    id: 'no',
    name: 'Норвегия',
    code: '+47',
    flag: '🇳🇴',
    demand: 1.22,
    mask: '+47 AAA-AA-AAA',
  },
  {
    id: 'ie',
    name: 'Ирландия',
    code: '+353',
    flag: '🇮🇪',
    demand: 1.1,
    mask: '+353 (AA) AAA-AAAA',
  },
];

export const COUNTRY_BY_ID: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((country) => [country.id, country]),
);

/**
 * Анонимный номер +888.
 *
 * Это не страна и не оператор: у него нет ни региона, ни бренда, поэтому в
 * роуминге он не выбирается. Цена у него случайная — обычный множитель спроса
 * здесь не работает, вместо него тянется коэффициент из ANONYMOUS.
 */
export const ANONYMOUS: Country & { minCoefficient: number; maxCoefficient: number } = {
  id: 'anon',
  name: 'Анонимный',
  code: '+888',
  flag: '🕶️',
  demand: 1,
  mask: '+888 AAA-BBB-CC',
  /**
   * Разброс случайной надбавки. Нижняя граница держит анонимный номер дороже
   * любого обычного, верхняя — не даёт ему улететь в бесконечность: на этих
   * числах строится экономика тестов, а не витрина.
   */
  minCoefficient: 3,
  maxCoefficient: 12,
};

// Анонимный номер должен находиться по идентификатору, но не попадать в список стран.
COUNTRY_BY_ID[ANONYMOUS.id] = ANONYMOUS;

/** Анонимные номера не выбираются в роуминге — только выдаются администратором. */
export function isAnonymous(countryId: string | null): boolean {
  return countryId === ANONYMOUS.id;
}

/** «Свои номера» — режим пользовательских синтетических шаблонов. */
export const CUSTOM_COUNTRY_ID = 'custom';


/* ─────────────────────────── УЗОРЫ ─────────────────────────── */
// Список снят с выпадающего списка «Узор». Очки — предложение, согласовать.

export const PATTERN_POINTS: Record<string, number> = {
  all_same: 300,
  almost_same: 120,
  date: 90,
  palindrome: 70,
  alternating: 65,
  block_repeat: 60,
  mirror: 55,
  prefix_echo: 45,
  prefix_repeat: 40,
  ladder_up: 8, // за каждую цифру последовательности
  ladder_down: 7, // за каждую цифру последовательности — 65432 = 35
  /*
   * Длинная лесенка: шестая и каждая следующая цифра стоит дороже.
   * Шесть подряд идущих цифр встречаются куда реже пяти, и стоить должны
   * не на одну цифру дороже, а заметно. Пятизначные лесенки это не трогает,
   * поэтому опорный случай «65432» = 35 очков сохранён.
   */
  ladderLong: 30,
  series: 12, // за каждую цифру серии
  pairs: 8, // за каждую пару
  /*
   * Круглый: за каждый ноль в конце. Раньше было 25 за любые нули, поэтому
   * 5000 и 500000 стоили одинаково, хотя второе встречается намного реже.
   */
  round: 12,
  /** Первая и последняя цифры совпадают — «7…7» */
  twin_ends: 35,
  /** Две повторяющиеся пары подряд — «1122», «3344» */
  aabb: 30,
  /** Прямая по клавиатуре телефона — «147», «258», «159» */
  keypad_line: 45,
  /** Три и более нуля подряд внутри номера */
  zero_run: 20,
  country_code: 15,
};

export const PATTERN_ORDER = [
  'all_same',
  'series',
  'pairs',
  'block_repeat',
  'ladder_up',
  'ladder_down',
  'palindrome',
  'mirror',
  'alternating',
  'round',
  'date',
  'prefix_echo',
  'prefix_repeat',
  'country_code',
  'almost_same',
  'keypad_line',
  'twin_ends',
  'aabb',
  'zero_run',
] as const;

/* ─────────────────────────── ЭКОНОМИКА И ПРОГРЕСС ─────────────────────────── */

export const ECONOMY = {
  startingBalance: 99800,
  startingTickets: 1,
  slots: 100,
  /**
   * Надбавка за выпуск на своём операторе: игрок платит за выбор.
   * Шансы при этом не меняются — дороже только право выбрать код.
   */
  operatorSurcharge: 0.1,
  /** Сколько стоит билет на бесплатный выпуск — для расчёта призов рулетки */
  releaseTicketValue: 1700,
  /** Цена смены одной цифры номера */
  digitChangePrice: 500,
  /** Цена назначения основного номера вне бесплатных смен */
  primarySwapPrice: 500,
  freePrimarySwaps: 3,
  /**
   * Доля оценки, которую возвращает продажа.
   *
   * Не единица: без комиссии номер продаётся ровно за то, что стоит, и выпуск
   * становится безрисковым — купил и сразу вернул. 15 % — плата за то, что
   * решение «оставить или продать» снова становится решением.
   */
  sellRate: 0.85,
  /** Бонус к балансу, когда средств меньше цены Стандарта */
  bailoutThreshold: 1700,
  bailoutAmount: 1700,
  /** Сколько опыта нужно на уровень n */
  xpForLevel: (level: number) => 250 + (level - 1) * 120,
};

/* ─────────────────────────── УДАЧА ─────────────────────────── */

export const LUCK = {
  /** Удача множит шансы редких и выше, затем распределение нормализуется заново. */
  boostedRarities: ['rare', 'epic', 'legendary', 'mythic'] as RarityId[],
  /** Длительность бонуса в миллисекундах */
  durationMs: 3 * 60 * 60 * 1000,
  defaultState: {
    multiplier: 2,
    expiresAt: null,
    spinsLeft: 0,
    title: 'Ивент · Удача ×2',
    subtitle: 'Удача ×2 на все крутки — до 00:00 МСК',
  } as LuckState,
};

/* ─────────────────────────── УЛУЧШЕНИЯ НОМЕРА ─────────────────────────── */
// Четыре разных способа сделать номер дороже. Разные не только ценой,
// но и характером: точный выбор, ручная перестановка, полный перебор
// и гарантированный подъём категории.

export interface UpgradeMeta {
  id: UpgradeId;
  name: string;
  /** Что операция делает — одной строкой для карточки */
  effect: string;
  /** Пояснение под названием */
  description: string;
  /** Фиксированная цена; null — считается от самого номера */
  price: number | null;
  /** Доля базовой цены следующей категории — только для апелляции */
  appealShare: number | null;
}

export const UPGRADES: Record<UpgradeId, UpgradeMeta> = {
  digit: {
    id: 'digit',
    name: 'Замена цифры',
    effect: 'одна цифра меняется на случайную',
    description: 'Точное попадание по позиции, но результат случайный. Номер может подорожать или подешеветь.',
    price: 500,
    appealShare: null,
  },
  swap: {
    id: 'swap',
    name: 'Перестановка',
    effect: 'две цифры меняются местами',
    description: 'Никакой случайности: состав цифр сохраняется, меняется только порядок. Видно заранее, что получится.',
    price: 900,
    appealShare: null,
  },
  reroll: {
    id: 'reroll',
    name: 'Перебор',
    effect: 'все цифры подбираются заново',
    description: 'Категория сохраняется, цифры приходят новые. Разброс очков внутри категории — от нижней границы до верхней.',
    price: 5000,
    appealShare: null,
  },
  appeal: {
    id: 'appeal',
    name: 'Апелляция',
    effect: 'категория поднимается на ступень',
    description: 'Гарантированный подъём без случайности: номер перевыпускается в следующей категории. Цена растёт вместе с категорией.',
    price: null,
    // Гарантированный переход в следующую категорию: половина её базы делала
    // апелляцию дешевле обычного выпуска, и прогрессия ломалась.
    appealShare: 0.85,
  },
  operator: {
    id: 'operator',
    name: 'Смена оператора',
    effect: 'номер переходит к другому оператору',
    description: 'Меняется префикс оператора, остальные цифры остаются на месте. Префикс участвует в узорах, поэтому номер может подорожать или подешеветь.',
    price: 2500,
    appealShare: null,
  },
};

export const UPGRADE_ORDER: UpgradeId[] = ['digit', 'swap', 'reroll', 'operator', 'appeal'];

/** Цена операции для конкретного номера. */
export function upgradePrice(id: UpgradeId, number: PhoneNumber): number {
  const meta = UPGRADES[id];
  if (meta.price !== null) return meta.price;
  if (id === 'appeal') {
    const next = nextRarity(number.rarity);
    if (!next) return 0;
    return Math.round(RARITIES[next].basePrice * (meta.appealShare ?? 0.5));
  }
  return 0;
}

/** Следующая категория вверх; null — уже максимальная. */
export function nextRarity(rarity: RarityId): RarityId | null {
  const index = RARITY_ORDER.indexOf(rarity);
  if (index < 0 || index >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[index + 1];
}

/* ─────────────────────────── ЧИСЛА ДЛЯ ВИТРИНЫ ─────────────────────────── */

export const formatMoney = (value: number): string =>
  new Intl.NumberFormat('ru-RU').format(Math.round(value));

export const formatMoneyWithSign = (value: number): string =>
  `${formatMoney(value)} ₽`;

/** «1 из 17», «часто», «никогда» — как в референсе. */
export function formatOdds(chancePercent: number): string {
  if (chancePercent <= 0) return 'никогда';
  if (chancePercent >= 12) return 'часто';
  const oneIn = Math.round(100 / chancePercent);
  return `1 из ${new Intl.NumberFormat('ru-RU').format(oneIn)}`;
}

export function formatPercent(chancePercent: number): string {
  if (chancePercent <= 0) return '0 %';
  if (chancePercent < 0.01) return `${chancePercent.toFixed(3).replace('.', ',')} %`;
  if (chancePercent < 1) return `${chancePercent.toFixed(2).replace('.', ',')} %`;
  if (chancePercent < 10) return `${chancePercent.toFixed(1).replace('.', ',')} %`;
  return `${Math.round(chancePercent)} %`;
}