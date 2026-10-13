// language: TypeScript, file: shared/src/types.ts
// Единые типы игровой модели. Те же структуры повторяет backend — менять только парой.

export type RarityId =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export type TariffId = 'standard' | 'plus' | 'premium' | 'elite';

/** Операции улучшения номера. Каждая меняет цифры и пересчитывает оценку. */
export type UpgradeId = 'digit' | 'swap' | 'reroll' | 'appeal' | 'operator';

export type PatternId =
  | 'all_same'
  | 'series'
  | 'pairs'
  | 'block_repeat'
  | 'ladder_up'
  | 'ladder_down'
  | 'palindrome'
  | 'mirror'
  | 'alternating'
  | 'round'
  | 'date'
  | 'prefix_echo'
  | 'prefix_repeat'
  | 'country_code'
  | 'almost_same'
  /** Первая и последняя цифры совпадают */
  | 'twin_ends'
  /** Две повторяющиеся пары подряд: 1122 */
  | 'aabb'
  /** Прямая по клавиатуре телефона: 147, 258, 159 */
  | 'keypad_line'
  /** Три и более нуля подряд */
  | 'zero_run';

export interface Rarity {
  id: RarityId;
  /** Отображаемое имя: «Обычный», «Мифический» */
  name: string;
  /** Именительный падеж для подписи «Почему Необычный» */
  whyName: string;
  /** Цвет категории — точка, полоса, текст */
  color: string;
  /** Тёмная подложка под цвет категории */
  glow: string;
  /** Базовая игровая стоимость до множителя узора */
  basePrice: number;
  /** Опыт за предмет этой категории */
  xp: number;
}

export interface Tariff {
  id: TariffId;
  name: string;
  /** Стоимость выпуска в игровой валюте. null — тариф открывается билетом */
  price: number | null;
  /** Сколько билетов списывается, если price === null */
  ticketCost: number | null;
  /** Короткое описание под названием */
  tagline: string;
  /** Полоса слева на карточке тарифа */
  stripe: string;
  /** Градиент карточки тарифа */
  gradient: string;
  /** Цвет акцента: цифры процента, рамка, свечение */
  accent: string;
  /** Базовое распределение категорий, сумма строго 100 */
  odds: Record<RarityId, number>;
  /** Множитель опыта за выпуск */
  xpMultiplier: number;
}

export interface Country {
  id: string;
  name: string;
  /** Телефонный код как визуальный элемент */
  code: string;
  flag: string;
  /** Множитель спроса — влияет на оценку номера */
  demand: number;
  /** Маска набора цифр: 'A' — случайная цифра, остальное — литерал */
  mask: string;
}

export interface Operator {
  id: string;
  name: string;
  /** Буква или две буквы в квадратной иконке */
  badge: string;
  color: string;
}

export interface PatternHit {
  id: PatternId;
  /** Подпись узора: «Лесенка вниз» */
  label: string;
  /** Пояснение: «Убывающая последовательность «65432»» */
  detail: string;
  /** Начисленные очки */
  points: number;
  /** Диапазон цифр, формирующих узор. end — исключительно. Нужен для подчёркивания. */
  span: { start: number; end: number } | null;
}

export interface PhoneNumber {
  id: string;
  /** Синтетический игровой номер целиком: «+7 920 936-54-32» */
  display: string;
  /** Только цифры абонентской части, без кода страны */
  digits: string;
  countryId: string;
  regionCode: string;
  operatorId: string;
  tariffId: TariffId;
  rarity: RarityId;
  /** Базовая стоимость категории на момент выпуска */
  basePrice: number;
  /** Множитель узора, округлённый до сотых */
  patternMultiplier: number;
  /** Множитель спроса региона на момент выпуска */
  demandMultiplier: number;
  /** Базовая × узор × спрос */
  finalPrice: number;
  /** Сумма очков всех найденных узоров */
  score: number;
  /** Найденные узоры для экрана «Почему …» */
  patterns: PatternHit[];
  issuedAt: string;
  /** Уникальный id операции выпуска — защита от повторного списания */
  releaseId: string;
  /** Порядковый номер владения; тираж «Без ограничения» если null */
  limitedEdition: number | null;
}

export type LedgerKind =
  | 'release'
  | 'sale'
  | 'digit_change'
  | 'upgrade'
  | 'daily'
  | 'quest'
  | 'levelup'
  | 'ticket'
  /** Выдача вне обычной игры: анонимные номера, подарки, тестовые операции */
  | 'gift'
  /** Прокрут рулетки и её призы */
  | 'roulette'
  /** Промокод */
  | 'promo';

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  /** Отрицательное — списание, положительное — начисление */
  amount: number;
  /** Подпись строки истории */
  label: string;
  at: string;
  /** Номер, к которому относится операция */
  numberId?: string;
}

export interface LuckState {
  /** Текущий множитель удачи: 1 — бонуса нет */
  multiplier: number;
  /** Когда бонус истекает */
  expiresAt: string | null;
  /**
   * Сколько круток бонус ещё держится. Удача из рулетки считается крутками,
   * а не часами: игрок получает ровно то, что обещано, и не зависит от того,
   * сколько он просидел в игре.
   */
  spinsLeft: number;
  /** Заголовок баннера: «Ивент · Удача ×2» */
  title: string;
  /** Строка под заголовком */
  subtitle: string;
}

export interface Player {
  id: string;
  /** Отображаемое имя из Telegram */
  name: string;
  avatarUrl: string | null;
  balance: number;
  tickets: number;
  /**
   * Бесплатные выпуски из рулетки. Пока их больше нуля, выпуск не списывает
   * деньги: это билет, который рулетка выдала вместо наличных.
   */
  freeReleases: number;
  level: number;
  xp: number;
  /** Номер, выбранный как основной */
  primaryNumberId: string | null;
  /** Сколько бесплатных смен основного номера осталось */
  freePrimarySwaps: number;
  /** Текущая серия ежедневных входов */
  dailyStreak: number;
  luck: LuckState;
}

export interface GameState {
  /** Версия схемы сохранения — для миграций */
  schema: number;
  player: Player;
  numbers: PhoneNumber[];
  ledger: LedgerEntry[];
  /** Последний выбранный режим */
  selectedTariff: TariffId;
  /** null — «Любая страна», выбирается случайно при выпуске */
  selectedCountry: string | null;
  /**
   * Выбранный оператор. null — любой: номер уйдёт к тому, чей код подойдёт.
   * Свой оператор стоит дороже — за выбор доплачивают.
   */
  selectedOperator: string | null;
  /** Выбранный код внутри оператора. null — любой код этого оператора. */
  selectedCode: string | null;
  /** Счётчик уникальных идентификаторов операций */
  processedReleaseIds: string[];
  /** Достижения, за которые награда уже получена */
  claimedAchievements: string[];
  /** Погашенные промокоды — повторно тот же код не сработает */
  usedPromoCodes: string[];
  /** Максимум мест в коллекции */
  slots: number;
}
