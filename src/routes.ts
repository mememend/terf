// language: TypeScript, file: frontend/src/routes.ts
// Куда ведёт каждый пункт меню.
//
// Логика вынесена из App в чистый модуль: её можно проверить тестом.
// Однажды «Удача» и «Шансы» открывали чёрный экран именно потому, что
// проверить это было нечем — экрана не существовало, а пункт в меню был.

export type View =
  | 'home'
  | 'collection'
  | 'number'
  | 'history'
  | 'profile'
  | 'quests'
  | 'rating'
  | 'shop'
  | 'rules'
  | 'settings'
  | 'admin'
  | 'checker'
  | 'achievements'
  | 'dealer'
  | 'roulette'
  | 'skills'
  | 'pass'
  | 'chances'
  | 'promo'
  | 'channel'
  | 'clans'
  | 'market'
  | 'cases'
  | 'auction'
  | 'deals'
  | 'phones'
  | 'friends'
  | 'shops';

/** Экраны, которые действительно нарисованы. Всё остальное получает заглушку. */
export const IMPLEMENTED: View[] = [
  'home',
  'collection',
  'number',
  'history',
  'profile',
  'quests',
  'rating',
  'shop',
  'rules',
  'settings',
  'admin',
  'checker',
  'roulette',
  'promo',
];

/** Пункты, которые ведут не на свой экран, а на соседний. */
export const REDIRECT: Partial<Record<View, View>> = {
  // Достижения живут внутри экрана заданий.
  achievements: 'quests',
};

/** Разделы, которых ещё нет: игрок увидит описание, а не пустоту. */
export const SOON_SCREENS: Partial<Record<View, { title: string; note: string }>> = {
  dealer: {
    title: 'Скупщик',
    note: 'Заказы дня: скупщик берёт номера с нужным признаком дороже системы.',
  },
  roulette: {
    title: 'Рулетка',
    note: 'Колесо с призами: деньги, билеты, удача и скидки на крутку.',
  },
  skills: {
    title: 'Навыки',
    note: 'Очки за уровень вкладываются в удачу, торговлю и азарт.',
  },
  pass: {
    title: 'Пропуск',
    note: 'Сезон с двумя дорожками наград и VIP-веткой.',
  },
  promo: {
    title: 'Промокод',
    note: 'Ввод промокода и начисление награды. Проверка кода выполняется на сервере.',
  },
  channel: {
    title: 'Канал',
    note: 'Новости игры, анонсы ивентов и розыгрышей.',
  },
  auction: {
    title: 'Аукцион',
    note: 'Номера с редким узором уходят с торгов: ставки игроков, срок и шаг ставки.',
  },
  deals: {
    title: 'Сделки',
    note: 'Обмен номерами между игроками: обе стороны подтверждают, сервер проверяет владение.',
  },
  phones: {
    title: 'Телефоны',
    note: 'Коробки с техникой: модель выпадает по шансам, тираж каждой ограничен.',
  },
  friends: {
    title: 'Друзья',
    note: 'Список друзей, подарки номерами и сравнение коллекций.',
  },
  clans: {
    title: 'Кланы',
    note: 'Объединения игроков, общий склад и клановый рейтинг.',
  },
  market: {
    title: 'Рынок',
    note: 'Передача номеров между игроками. Сделки будет проверять сервер.',
  },
  cases: {
    title: 'Кейсы',
    note: 'Коробки с техникой: модель выпадает по шансам, тираж ограничен.',
  },
};

export interface ResolvedRoute {
  /** Что открыть: экран, модальное окно или заглушку */
  kind: 'view' | 'overlay' | 'soon';
  view?: View;
  overlay?: 'chances';
  soon?: { title: string; note: string };
}

/**
 * Куда ведёт пункт меню.
 *
 * Ни один пункт не может привести в пустоту: если экрана нет, возвращается
 * заглушка с названием и описанием.
 */
export function resolveRoute(target: View): ResolvedRoute {
  // Шансы — модальное окно поверх главного, а не отдельный экран.
  if (target === 'chances') return { kind: 'overlay', overlay: 'chances' };

  const resolved = REDIRECT[target] ?? target;
  if (IMPLEMENTED.includes(resolved)) return { kind: 'view', view: resolved };

  return {
    kind: 'soon',
    soon: SOON_SCREENS[resolved] ?? {
      title: 'Раздел',
      note: 'Этот раздел ещё не готов и появится в следующих обновлениях.',
    },
  };
}
