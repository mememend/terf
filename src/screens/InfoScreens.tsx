// language: TypeScript, file: frontend/src/screens/InfoScreens.tsx
// Разделы меню: история, профиль, задания и достижения, рейтинг, магазин,
// правила, настройки. Каждый экран работает на реальных данных состояния.

import { useEffect, useMemo, useState } from 'react';
import {
  ANONYMOUS,
  COUNTRIES,
  ECONOMY,
  PATTERN_POINTS,
  RARITIES,
  RARITY_ORDER,
  SCORE_BANDS,
  TARIFFS,
  TARIFF_ORDER,
  UPGRADES,
  UPGRADE_ORDER,
  applyMask,
  applyMaskPartial,
  digitsFromMaskedInput,
  formatMoney,
  maskSlots,
  periodEndsAt,
  tasksFor,
} from '@ciferki/shared';
import type { Task } from '@ciferki/shared';
import {
  ACHIEVEMENTS,
  achievementProgress,
  dailyAvailable,
  dailyReward,
  isUnlocked,
  progressLabel,
} from '@ciferki/shared';
import { Header } from '../components/Header';
import { Flag } from '../components/Flag';
import { SimCard } from '../components/SimCard';
import { api, describeApiError } from '../api';
import { useDragScroll } from '../hooks/useDragScroll';
import { IconGift, IconTrend } from '../components/Icons';
import { formatDateTime } from '../utils/format';
import type { Game } from '../hooks/useGame';
import type { LedgerKind } from '@ciferki/shared';

interface ScreenProps {
  game: Game;
  onBack: () => void;
}

/* ─────────────────────────── ИСТОРИЯ ─────────────────────────── */

const LEDGER_LABEL: Record<LedgerKind, string> = {
  release: 'Выпуск',
  sale: 'Продажа',
  digit_change: 'Замена цифры',
  upgrade: 'Улучшение',
  daily: 'Награда',
  quest: 'Задание',
  levelup: 'Уровень',
  ticket: 'Билет',
  gift: 'Выдача',
  roulette: 'Рулетка',
  promo: 'Промокод',
};

export function HistoryScreen({ game, onBack }: ScreenProps) {
  const { state } = game;

  return (
    <div className="app app--history">
      <Header {...headerProps(game, onBack)} />
      <h1 className="screen-title">История</h1>

      {state.ledger.length === 0 ? (
        <div className="estimate" style={{ padding: '40px 0' }}>
          <div className="estimate__label">Операций пока нет</div>
        </div>
      ) : (
        <div className="rows">
          {state.ledger.map((entry) => {
            const number = state.numbers.find((item) => item.id === entry.numberId);
            return (
              <div className="row" key={entry.id}>
                <span
                  className="row__icon"
                  style={{
                    background:
                      entry.amount > 0 ? 'rgba(34,197,94,0.18)' : 'var(--surface-3)',
                    color: entry.amount > 0 ? 'var(--green)' : 'var(--text-dim)',
                  }}
                >
                  <IconTrend size={16} />
                </span>
                <span className="row__body">
                  <span className="row__label">{entry.label}</span>
                  <span className="row__hint">
                    {LEDGER_LABEL[entry.kind]} · {formatDateTime(entry.at)}
                    {number ? ` · ${number.display}` : ''}
                  </span>
                </span>
                <span
                  className="row__value"
                  style={{ color: entry.amount > 0 ? 'var(--green)' : undefined }}
                >
                  {entry.amount === 0
                    ? '—'
                    : `${entry.amount > 0 ? '+' : '−'}${formatMoney(Math.abs(entry.amount))} ₽`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── ПРОФИЛЬ ─────────────────────────── */

export function ProfileScreen({ game, onBack }: ScreenProps) {
  const { state, countByRarity, portfolioValue, levelXp } = game;

  // Полоски категорий масштабируем относительно самой крупной — так видно состав.
  const peak = Math.max(1, ...RARITY_ORDER.map((rarity) => countByRarity[rarity]));

  /** Основной номер: крупной карточкой, как в референсе. */
  const primary = useMemo(
    () => state.numbers.find((number) => number.id === state.player.primaryNumberId) ?? null,
    [state.numbers, state.player.primaryNumberId],
  );

  /** Лучшая категория в коллекции. */
  const best = useMemo(() => {
    const order = [...RARITY_ORDER];
    for (let index = order.length - 1; index >= 0; index -= 1) {
      if (countByRarity[order[index]] > 0) return order[index];
    }
    return null;
  }, [countByRarity]);

  /** Три самых дорогих номера — «лучшие» из референса. */
  const top = useMemo(
    () => [...state.numbers].sort((a, b) => b.finalPrice - a.finalPrice).slice(0, 3),
    [state.numbers],
  );

  return (
    <div className="app app--profile">
      <Header {...headerProps(game, onBack)} />

      <div className="profile-head">
        <div className="profile-head__avatar">
          {state.player.avatarUrl ? (
            <img src={state.player.avatarUrl} alt={state.player.name} />
          ) : (
            state.player.name.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="profile-head__name">{state.player.name}</div>
        <div className="profile-head__meta">
          Уровень {state.player.level} · мест {state.numbers.length} из {state.slots}
        </div>
      </div>

      <div className="tiles">
        <Tile label="номеров" value={String(state.numbers.length)} />
        <Tile
          label="лучшая"
          value={best ? RARITIES[best].name : '—'}
          accent={best ? RARITIES[best].color : undefined}
        />
        <Tile label="₽ на счёте" value={formatMoney(state.player.balance)} />
      </div>

      <div className="hero__xp" style={{ marginTop: 4 }}>
        <span>
          {state.player.xp} / {levelXp} XP
        </span>
        <span className="hero__xp-left">до уровня {levelXp - state.player.xp} XP</span>
      </div>
      <div className="hero__bar">
        <div className="hero__bar-fill" style={{ width: `${game.levelProgress * 100}%` }} />
      </div>

      {primary && (
        <section className="section">
          <h2 className="section__title">Основной номер</h2>
          <button
            style={{ width: '100%' }}
            onClick={() => game.notify('Основной номер открывается в коллекции')}
          >
            <SimCard number={primary} />
          </button>
        </section>
      )}

      <section className="section">
        <h2 className="section__title">По редкости</h2>
        <div className="rarity-list rarity-list--all">
          {[...RARITY_ORDER].reverse().map((rarity) => (
            <div
              className={`rarity-row ${countByRarity[rarity] === 0 ? 'rarity-row--empty' : ''}`}
              key={rarity}
              style={{ ['--rarity' as string]: RARITIES[rarity].color }}
            >
              <span className="rarity-row__name">{RARITIES[rarity].name}</span>
              <span className="rarity-row__track">
                <span
                  className="rarity-row__fill"
                  style={{ width: `${(countByRarity[rarity] / peak) * 100}%` }}
                />
              </span>
              <span className="rarity-row__count">{countByRarity[rarity]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">
          Лучшие номера
          <span className="section__count">{top.length} из {state.numbers.length}</span>
        </h2>
        {top.length === 0 ? (
          <div className="empty">
            <div className="empty__title">Коллекция пуста</div>
            <div className="empty__hint">Выпусти первую SIM — лучшие номера появятся здесь</div>
          </div>
        ) : (
          <div className="top-list">
            {top.map((number, index) => (
              <div className="top-card" key={number.id} style={{ ['--i' as string]: index }}>
                <SimCard number={number} />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="action-note">Портфель целиком: {formatMoney(portfolioValue)} ₽</div>
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="tile">
      <div className="tile__value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="tile__label">{label}</div>
    </div>
  );
}

/* ─────────────────────────── ЗАДАНИЯ ДНЯ И НЕДЕЛИ ─────────────────────────── */

/**
 * Список заданий периода, как в референсе: строка с названием, полосой
 * прогресса, счётом «N / M · +R ₽» и кнопкой «Забрать», когда условие закрыто.
 */
function TaskSection({
  title,
  note,
  tasks,
  onClaim,
}: {
  title: string;
  note: string;
  tasks: Task[];
  onClaim: (key: string) => void;
}) {
  return (
    <section className="section">
      <h2 className="section__title">
        {title}
        <span className="section__note">{note}</span>
      </h2>

      <div className="task-list">
        {tasks.map((task) => {
          const share = task.target > 0 ? task.progress / task.target : 0;
          return (
            <div
              key={task.key}
              className={`task ${task.claimed ? 'task--claimed' : ''} ${
                task.ready && !task.claimed ? 'task--ready' : ''
              }`}
            >
              <div className="task__top">
                <span className="task__title">{task.title}</span>
                {task.ready && !task.claimed && (
                  <button className="quest__claim" onClick={() => onClaim(task.key)}>
                    Забрать
                  </button>
                )}
                {task.claimed && <span className="task__done">✓</span>}
              </div>

              <div className="task__track">
                <div className="task__fill" style={{ width: `${share * 100}%` }} />
              </div>

              <div className="task__foot">
                <span className="task__progress">
                  {task.progress} / {task.target}
                </span>
                <span className="task__reward">+{formatMoney(task.reward)} ₽</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** «12 ч 49 мин» — сколько осталось до конца периода. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  const seconds = total % 60;
  return `${minutes} мин ${seconds} с`;
}

/* ─────────────────────────── ЗАДАНИЯ И ДОСТИЖЕНИЯ ─────────────────────────── */

export function QuestsScreen({ game, onBack }: ScreenProps) {
  const { state } = game;
  const available = dailyAvailable(state);
  const reward = dailyReward(state);
  const [now, setNow] = useState(() => Date.now());

  // Часы: подписи «обновится через…» должны идти, а не застывать.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const moment = new Date(now);
  const tasks = tasksFor(state, moment);
  const daily = tasks.filter((task) => task.scope === 'daily');
  const weekly = tasks.filter((task) => task.scope === 'weekly');
  const readyCount = tasks.filter((task) => task.ready && !task.claimed).length;

  const streakDays = Math.min(state.player.dailyStreak, 7);
  const done = ACHIEVEMENTS.filter((achievement) => isUnlocked(achievement, state)).length;

  return (
    <div className="app app--quests">
      <Header {...headerProps(game, onBack)} />
      <h1 className="screen-title">
        Задания
        {readyCount > 0 && <span className="screen-title__badge">{readyCount}</span>}
      </h1>

      <button
        className={`daily ${available ? '' : 'daily--done'}`}
        onClick={() => game.takeDaily()}
      >
        <div className="daily__head">
          <span className="daily__icon">
            <IconGift size={20} color="#1a1400" />
          </span>
          <span className="daily__body">
            <span className="daily__title">
              {available ? 'Награда дня' : 'Награда уже получена'}
            </span>
            <span className="daily__hint">
              серия {state.player.dailyStreak} · следующая через день
            </span>
          </span>
          <span className="daily__reward">{formatMoney(reward)} ₽</span>
        </div>

        <div className="streak">
          {Array.from({ length: 7 }, (_, index) => (
            <span
              key={index}
              className={`streak__dot ${index < streakDays ? 'streak__dot--on' : ''}`}
            />
          ))}
        </div>

        <div className="daily__action">{available ? 'Забрать' : 'Возвращайся завтра'}</div>
      </button>

      <TaskSection
        title="Сегодня"
        note={`обновится через ${formatCountdown(periodEndsAt('daily', moment) - now)}`}
        tasks={daily}
        onClaim={(key) => void game.collectTask(key)}
      />

      <TaskSection
        title="Неделя"
        note={`обновится через ${formatCountdown(periodEndsAt('weekly', moment) - now)}`}
        tasks={weekly}
        onClaim={(key) => void game.collectTask(key)}
      />

      <section className="section">
        <h2 className="section__title">
          Достижения
          <span className="section__count">
            {done} из {ACHIEVEMENTS.length}
          </span>
        </h2>

        <div className="quest-grid">
          {ACHIEVEMENTS.map((achievement, index) => {
            const unlocked = isUnlocked(achievement, state);
            const claimed = state.claimedAchievements.includes(achievement.id);
            const progress = achievementProgress(achievement, state);
            const ready = unlocked && !claimed;

            return (
              <div
                key={achievement.id}
                className={`quest ${claimed ? 'quest--done' : ''} ${ready ? 'quest--ready' : ''}`}
                style={{ ['--i' as string]: Math.min(index, 12) }}
              >
                <div className="quest__top">
                  <span className="quest__title">{achievement.title}</span>
                  <span className="quest__reward">
                    {claimed ? 'получено' : `+${formatMoney(achievement.reward)} ₽`}
                  </span>
                </div>
                <div className="quest__hint">{achievement.hint}</div>
                <div className="quest__track">
                  <div className="quest__fill" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="quest__foot">
                  <span className="quest__progress">{progressLabel(achievement, state)}</span>
                  {ready ? (
                    <button
                      className="quest__claim"
                      onClick={() => game.collectAchievement(achievement.id)}
                    >
                      Забрать
                    </button>
                  ) : (
                    <span className={`quest__state ${claimed ? 'quest__state--done' : ''}`}>
                      {claimed ? '✓' : 'в процессе'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────── РЕЙТИНГ ─────────────────────────── */

export function RatingScreen({ game, onBack }: ScreenProps) {
  const { state, portfolioValue } = game;

  // Демонстрационная таблица: реальные игроки появятся с подключением сервера.
  const rows = useMemo(() => {
    const base = [
      { name: 'Цифровой', value: 412_000_000 },
      { name: 'Оператор', value: 188_450_000 },
      { name: 'Сим-Сим', value: 74_210_500 },
      { name: 'Ноль-Ноль', value: 31_900_000 },
      { name: 'Лесенка', value: 12_480_000 },
      { name: 'Палиндром', value: 4_120_000 },
      { name: 'Зеркало', value: 1_640_000 },
      { name: 'Чередование', value: 620_000 },
    ];
    return [...base, { name: state.player.name, value: portfolioValue, me: true }].sort(
      (a, b) => b.value - a.value,
    );
  }, [portfolioValue, state.player.name]);

  const myIndex = rows.findIndex((row) => 'me' in row && row.me);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="app app--rating">
      <Header {...headerProps(game, onBack)} />
      <h1 className="screen-title">Рейтинг</h1>

      <div className="rank-hero">
        <div className="rank-hero__place">
          <span className="rank-hero__number">{myIndex + 1}</span>
          <span className="rank-hero__of">место из {rows.length}</span>
        </div>
        <div className="rank-hero__value">{formatMoney(portfolioValue)} ₽</div>
        <div className="rank-hero__label">стоимость твоей коллекции</div>
      </div>

      <div className="podium">
        {[1, 0, 2].map((slot) => {
          const row = podium[slot];
          if (!row) return <div key={slot} />;
          const place = rows.indexOf(row) + 1;
          return (
            <div key={row.name} className={`podium__slot podium__slot--${place}`}>
              <div className="podium__medal">{place}</div>
              <div className="podium__name">{row.name}</div>
              <div className="podium__value">{formatMoney(row.value)} ₽</div>
            </div>
          );
        })}
      </div>

      <div className="rank-list">
        {rest.map((row, index) => {
          const place = index + 4;
          const me = 'me' in row && row.me;
          return (
            <div className={`rank-row ${me ? 'rank-row--me' : ''}`} key={`${row.name}-${place}`}>
              <span className="rank-row__place">{place}</span>
              <span className="rank-row__name">
                {row.name}
                {me && <span className="rank-row__badge">вы</span>}
              </span>
              <span className="rank-row__value">{formatMoney(row.value)} ₽</span>
            </div>
          );
        })}
      </div>

      <div className="action-note">
        Демонстрационная таблица. Реальные игроки появятся после подключения сервера.
      </div>
    </div>
  );
}

/* ─────────────────────────── МАГАЗИН ─────────────────────────── */

export function ShopScreen({ game, onBack }: ScreenProps) {
  const { state } = game;
  const canTakeBailout = state.player.balance < ECONOMY.bailoutThreshold;

  return (
    <div className="app app--shop">
      <Header {...headerProps(game, onBack)} />
      <h1 className="screen-title">Магазин</h1>

      <div className="shop-grid">
        <button
          className={`shop-card ${canTakeBailout ? 'shop-card--ready' : ''}`}
          style={{ ['--i' as string]: 0 }}
          disabled={!canTakeBailout}
          onClick={() => game.takeBailout()}
        >
          <span className="shop-card__icon" style={{ background: '#F59E0B', color: '#1a1400' }}>
            <IconGift size={18} />
          </span>
          <span className="shop-card__title">Бонус баланса</span>
          <span className="shop-card__hint">
            {canTakeBailout
              ? 'Доступен — забирай'
              : `Откроется при балансе ниже ${formatMoney(ECONOMY.bailoutThreshold)} ₽`}
          </span>
          <span className="shop-card__price">+{formatMoney(ECONOMY.bailoutAmount)} ₽</span>
        </button>

        <div className="shop-card" style={{ ['--i' as string]: 1, opacity: 0.6 }}>
          <span className="shop-card__icon" style={{ background: '#A855F7', color: '#fff' }}>
            <IconGift size={18} />
          </span>
          <span className="shop-card__title">Крутки</span>
          <span className="shop-card__hint">Пакеты круток со скидкой на выпуск</span>
          <span className="shop-card__price shop-card__price--soon">скоро</span>
        </div>

        <div className="shop-card" style={{ ['--i' as string]: 2, opacity: 0.6 }}>
          <span className="shop-card__icon" style={{ background: '#0EA5E9', color: '#fff' }}>
            <IconGift size={18} />
          </span>
          <span className="shop-card__title">Оформление</span>
          <span className="shop-card__hint">Рамки и фоны карточек номера</span>
          <span className="shop-card__price shop-card__price--soon">скоро</span>
        </div>

        <div className="shop-card" style={{ ['--i' as string]: 3, opacity: 0.6 }}>
          <span className="shop-card__icon" style={{ background: '#F0B90B', color: '#1a1400' }}>
            <IconGift size={18} />
          </span>
          <span className="shop-card__title">Билет Элит</span>
          <span className="shop-card__hint">Разрешение на выпуск тарифа Элит</span>
          <span className="shop-card__price shop-card__price--soon">скоро</span>
        </div>
      </div>

      <section className="section">
        <h2 className="section__title">Тарифы</h2>
        <div className="tariff-mini-list">
          {TARIFF_ORDER.map((id) => {
            const tariff = TARIFFS[id];
            const selected = state.selectedTariff === id;
            return (
              <div className="tariff-mini" key={id}>
                <span className="tariff-mini__plate" style={{ background: tariff.gradient }}>
                  <span className="tariff-mini__stripe" style={{ background: tariff.stripe }} />
                </span>
                <span className="tariff-mini__body">
                  <span className="tariff-mini__name">
                    {tariff.name}
                    {selected && (
                      <span className="rank-row__badge" style={{ marginLeft: 8 }}>
                        выбран
                      </span>
                    )}
                  </span>
                  <span className="tariff-mini__hint">
                    опыт ×{tariff.xpMultiplier} · редкий и выше{' '}
                    {(
                      tariff.odds.rare +
                      tariff.odds.epic +
                      tariff.odds.legendary +
                      tariff.odds.mythic
                    )
                      .toFixed(1)
                      .replace('.', ',')}{' '}
                    %
                  </span>
                </span>
                <span className="tariff-mini__price">
                  {tariff.price === null ? 'по билету' : `${formatMoney(tariff.price)} ₽`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">
          Регионы
          <span className="section__count">{COUNTRIES.length}</span>
        </h2>
        <div className="region-list">
          {COUNTRIES.map((country) => (
            <div className="region-cell" key={country.id}>
              <Flag countryId={country.id} size={22} className="region-cell__flag" />
              <span className="region-cell__body">
                <span className="region-cell__name">{country.name}</span>
                <span className="region-cell__hint">
                  {country.code} · спрос ×{String(country.demand).replace('.', ',')}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────── ПРОВЕРКА НОМЕРА ─────────────────────────── */

/**
 * Проверка номера: свободен он или лежит у кого-то в коллекции.
 *
 * Номер вводится цифрами, а показывается в маске выбранной страны — так игрок
 * видит привычный формат и не путается в скобках и дефисах.
 */
export function CheckerScreen({ game, onBack }: ScreenProps) {
  const [countryId, setCountryId] = useState(COUNTRIES[0].id);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { free: boolean; display: string | null; digits: string } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const countryStrip = useDragScroll<HTMLDivElement>();

  const country = COUNTRIES.find((item) => item.id === countryId) ?? COUNTRIES[0];
  /*
   * Длину набора считаем общей функцией, а не поиском буквы «A».
   * В маске вида «+7 AAA BBB-CC-DD» каждая буква — отдельный разряд:
   * знаков десять, хотя «A» встречается только трижды. Поиск «A» давал 3,
   * из-за чего ввод обрезался до трёх цифр, а счётчик показывал «11 / 3».
   */
  const slots = useMemo(() => maskSlots(country.mask), [country.mask]);
  /*
   * Разбор ввода — общей функцией: в поле лежит готовый номер с кодом страны,
   * и код при разборе отбрасывается. Иначе код занимал первый разряд, маска
   * подставляла его снова, и любая введённая цифра превращалась в «7».
   */
  const typed = useMemo(
    () => digitsFromMaskedInput(country.mask, country.code, value),
    [country.mask, country.code, value],
  );
  const ready = typed.length >= Math.min(6, slots);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.checkNumber(typed);
      setResult({ free: response.free, display: response.display, digits: response.digits });
    } catch (failure) {
      setError(describeApiError(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app app--checker">
      <Header {...headerProps(game, onBack)} />
      <h1 className="screen-title">Проверка номера</h1>

      <p className="checker__lead">
        Узнайте, есть ли номер у кого-то в коллекции. Проданный скупщику или салону
        снова свободен.
      </p>

      <div className="toolbar" ref={countryStrip}>
        {COUNTRIES.map((item) => (
          <button
            key={item.id}
            className={`pill-btn ${countryId === item.id ? 'pill-btn--active' : ''}`}
            onClick={() => {
              setCountryId(item.id);
              setResult(null);
              setValue('');
            }}
          >
            <Flag countryId={item.id} size={15} /> {item.name}
          </button>
        ))}
      </div>

      <div className="checker__field">
        <input
          value={applyMaskPartial(country.mask, typed.slice(0, slots))}
          onChange={(event) => {
            setValue(event.target.value);
            setResult(null);
          }}
          placeholder={applyMask(country.mask, '0'.repeat(slots))}
          inputMode="numeric"
        />
        <span className={`checker__count ${typed.length >= slots ? 'checker__count--over' : ''}`}>
          {typed.length} / {slots}
        </span>
      </div>

      <button
        className="choose-btn"
        disabled={!ready || busy}
        style={!ready || busy ? { opacity: 0.5 } : undefined}
        onClick={() => void run()}
      >
        <span>{busy ? 'Проверяем…' : 'Проверить'}</span>
      </button>

      {error && <div className="admin-error">{error}</div>}

      {result && (
        <div className={`checker-result ${result.free ? 'checker-result--free' : ''}`}>
          <div className="checker-result__title">
            {result.free ? 'Номер свободен' : 'Номер занят'}
          </div>
          <div className="checker-result__number">
            {result.display ?? applyMask(country.mask, result.digits)}
          </div>
          <div className="checker-result__hint">
            {result.free
              ? 'Такого номера нет ни у кого. Его можно выпустить в роуминге этой страны.'
              : 'Номер уже в чьей-то коллекции. Проданный или переданный — снова свободен.'}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── ПРАВИЛА ─────────────────────────── */

export function RulesScreen({ game, onBack }: ScreenProps) {
  return (
    <div className="app app--rules">
      <Header {...headerProps(game, onBack)} />
      <h1 className="screen-title">Правила</h1>

      <div className="rules">
        <RuleGroup title="Как играть">
          <Rule
            title="Выпуск SIM"
            text={`Каждый выпуск списывает стоимость тарифа. Номер получает случайную категорию по шансам тарифа, а затем анализатор считает его узор. Результат определяет сервер — клиент на выпадение повлиять не может.`}
          />
          <Rule
            title="Роуминг"
            text={`Страна выпуска задаёт формат номера, телефонный код и спрос. ${COUNTRIES.length} регионов, у каждого свои операторы и коды. Чем выше спрос, тем дороже номер.`}
          />
          <Rule
            title="Свой оператор"
            text={`Номер можно выпустить на конкретном операторе или с конкретным кодом. За право выбора берётся надбавка ${Math.round(ECONOMY.operatorSurcharge * 100)} % — шансы при этом не меняются: платишь за выбор, а не за лучший результат.`}
          />
          <Rule
            title="Удача"
            text="Бонус удачи умножает шансы редких и выше, после чего распределение нормализуется обратно к 100 %. Окно «Шансы» всегда показывает фактические вероятности текущего тарифа с учётом удачи."
          />
        </RuleGroup>

        <RuleGroup title="Категории">
          <Rule
            title="Категория по очкам, а не по роллу"
            text="Ролл выбирает только цель. Итоговую категорию определяет сумма очков узора — поэтому показанные шансы и фактический результат не могут разойтись."
          />
          <div className="rules-table">
            {SCORE_BANDS.map((band, index) => {
              // Нижняя граница — предыдущая верхняя плюс один.
              const min = index === 0 ? 0 : SCORE_BANDS[index - 1].upTo + 1;
              const rarity = RARITIES[band.rarity];
              return (
                <div className="rules-table__row" key={band.rarity}>
                  <span className="rules-table__dot" style={{ background: rarity.color }} />
                  <span className="rules-table__name">{rarity.name}</span>
                  <span className="rules-table__band">
                    {min}–{Number.isFinite(band.upTo) ? band.upTo : '∞'} очков
                  </span>
                  <span className="rules-table__price">{formatMoney(rarity.basePrice)} ₽</span>
                </div>
              );
            })}
          </div>
          <Rule
            title="Базовая стоимость"
            text="Это цена при множителе узора 1 и спросе 1. Дальше она растёт: два номера одной категории стоят по-разному."
          />
        </RuleGroup>

        <RuleGroup title="Узоры и очки">
          <Rule
            title="Что ищет анализатор"
            text="В цифрах номера ищутся закономерности: серии одинаковых цифр, лесенки, палиндромы, зеркала, чередования, пары, даты, повторы блоков, круглые окончания. Каждый найденный узор даёт очки."
          />
          <div className="rules-table">
            {Object.entries(PATTERN_POINTS)
              .sort((a, b) => b[1] - a[1])
              .map(([key, points]) => (
                <div className="rules-table__row" key={key}>
                  <span className="rules-table__name">{PATTERN_LABELS[key] ?? key}</span>
                  <span className="rules-table__price">+{points}</span>
                </div>
              ))}
          </div>
          <Rule
            title="Один рисунок — один бонус"
            text="Пересекающиеся узоры не суммируются дважды: если найден более ценный рисунок, подчинённые ему не начисляются. Так один и тот же набор цифр не может принести двойную выгоду."
          />
        </RuleGroup>

        <RuleGroup title="Цена">
          <Rule
            title="Формула"
            text="Стоимость = база категории × множитель узора × спрос региона. Множитель узора растёт вместе с очками, поэтому красивый номер внутри одной категории дороже обычного."
          />
          <Rule
            title="Анонимные номера +888"
            text={`Отдельный класс: без страны и оператора, поэтому номер всегда ничей. Категория тянется по лучшим шансам игры, а цена — со случайным коэффициентом от ${ANONYMOUS.minCoefficient} до ${ANONYMOUS.maxCoefficient}. Выпустить обычным путём нельзя, только получить выдачей.`}
          />
        </RuleGroup>

        <RuleGroup title="Мастерская">
          <Rule
            title="Пять способов улучшить"
            text="Любой номер можно доработать. Каждая операция пересчитывает очки, категорию и цену заново — категория всегда следует за суммой очков."
          />
          <div className="rules-table">
            {UPGRADE_ORDER.map((id) => (
              <div className="rules-table__row" key={id}>
                <span className="rules-table__name">{UPGRADES[id].name}</span>
                <span className="rules-table__band rules-table__band--wide">
                  {UPGRADES[id].effect}
                </span>
                <span className="rules-table__price">
                  {UPGRADES[id].price === null ? 'доля от базы' : `${formatMoney(UPGRADES[id].price)} ₽`}
                </span>
              </div>
            ))}
          </div>
          <Rule
            title="Итог с учётом цены"
            text="После операции показывается не только новая стоимость, но и честный итог: насколько номер подорожал или подешевел за вычетом того, что заплатили за саму операцию."
          />
        </RuleGroup>

        <RuleGroup title="Коллекция и деньги">
          <Rule
            title="Продажа"
            text={`Номер продаётся за его оценку. Основной номер продать нельзя — он закреплён. Продать можно и пачкой: в коллекции есть режим выбора с кнопками «Выбрать все» и «Продать».`}
          />
          <Rule
            title="Баланс"
            text={`Выпуск стоит денег, продажа их возвращает. Если баланс опустится ниже ${formatMoney(ECONOMY.bailoutThreshold)} ₽, в магазине откроется бонус баланса на ${formatMoney(ECONOMY.bailoutAmount)} ₽ — один раз на это состояние.`}
          />
          <Rule
            title="Уровни и опыт"
            text="За каждый выпуск начисляется опыт: он зависит от категории номера и множителя тарифа. С уровнем растёт предел коллекции и открываются новые возможности."
          />
          <Rule
            title="Билеты"
            text="Тариф «Элит» выпускается не за деньги, а по билету. Билеты выдаются за достижения и события."
          />
        </RuleGroup>

        <RuleGroup title="Задания">
          <Rule
            title="Награда дня"
            text="Раз в сутки выдаётся награда, её размер растёт с серией входов: базовая сумма плюс прибавка за каждый день подряд. Пропуск дня сбрасывает серию."
          />
          <Rule
            title="Достижения"
            text="За каждое достижение назначена сумма, и её надо забрать вручную — награда не начисляется сама. Кнопка «Забрать» появляется, когда условие выполнено."
          />
          <Rule
            title="Забрать дважды нельзя"
            text="Условие проверяет сервер по фактическому состоянию: незакрытое достижение не выдаётся, закрытое — только один раз."
          />
        </RuleGroup>

        <RuleGroup title="Честность">
          <Rule
            title="Результат считает сервер"
            text="Клиент не присылает результат и не может его подделать. Все суммы, цены и категории пересчитываются на сервере по общему ядру игры."
          />
          <Rule
            title="Одно ядро на всех"
            text="Клиент и сервер используют один и тот же код. Поэтому показанные шансы, цены и фактические списания не могут разойтись."
          />
          <Rule
            title="Повтор не проходит"
            text="У каждого выпуска есть идентификатор. Повторная отправка того же запроса не создаст второй номер и не спишет деньги дважды."
          />
        </RuleGroup>

        <RuleGroup title="Данные и безопасность">
          <Rule
            title="Номера синтетические"
            text="Все номера выдуманы и существуют только внутри игры. Базы реальных абонентов, чужие контакты, переписка и SMS-активации не используются."
          />
          <Rule
            title="Операторы вымышленные"
            text="Названия операторов и наборы кодов в игре синтетические и не связаны с настоящими компаниями. Коды подобраны так, чтобы номера выглядели правдоподобно."
          />
          <Rule
            title="Авторизация"
            text="Вход выполняется через Telegram: сервер проверяет подпись данных, полученных от клиента, и время жизни подписи. Пароли не используются."
          />
          <Rule
            title="Валюта"
            text="₽ — обозначение внутриигрового баланса. Это не реальные деньги. Реальные платежи, обналичивание и покупка настоящих SIM-карт не подключены."
          />
        </RuleGroup>
      </div>
    </div>
  );
}

/** Подпись узора для таблицы правил: ключ конфига → человеческое название. */
const PATTERN_LABELS: Record<string, string> = {
  all_same: 'Все цифры одинаковые',
  almost_same: 'Почти все одинаковые',
  date: 'Дата',
  palindrome: 'Палиндром',
  alternating: 'Чередование',
  block_repeat: 'Повтор блока',
  mirror: 'Зеркало',
  prefix_echo: 'Начало повторяет конец',
  prefix_repeat: 'Повтор в начале',
  ladder_up: 'Лесенка вверх · за цифру',
  ladder_down: 'Лесенка вниз · за цифру',
  ladderLong: 'Лесенка от шести цифр · надбавка',
  series: 'Серия подряд · за цифру',
  pairs: 'Пары · за пару',
  round: 'Круглое окончание · за ноль',
  keypad_line: 'Линия по клавиатуре телефона',
  twin_ends: 'Одинаковые первая и последняя цифры',
  aabb: 'Двойные пары подряд',
  zero_run: 'Нули подряд',
  country_code: 'Код страны внутри номера',
};

function RuleGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rules-group">
      <h2 className="rules-group__title">{title}</h2>
      <div className="rules-group__body">{children}</div>
    </section>
  );
}

function Rule({ title, text }: { title: string; text: string }) {
  return (
    <div className="rule">
      <div className="rule__title">{title}</div>
      <div className="rule__text">{text}</div>
    </div>
  );
}
/* ─────────────────────────── НАСТРОЙКИ ─────────────────────────── */

export function SettingsScreen({ game, onBack }: ScreenProps) {
  const { state } = game;
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="app app--settings">
      <Header {...headerProps(game, onBack)} />
      <h1 className="screen-title">Настройки</h1>

      <div className="rows">
        <div className="row">
          <span className="row__body">
            <span className="row__label">Игрок</span>
            <span className="row__hint">
              {game.identity.inside ? 'Авторизация через Telegram' : 'Открыто в браузере'}
            </span>
          </span>
          <span className="row__value">{state.player.name}</span>
        </div>
        <div className="row">
          <span className="row__body">
            <span className="row__label">Хранилище прогресса</span>
            <span className="row__hint">
              {game.mode === 'server'
                ? 'Сервер: результаты выпуска считает сервер'
                : game.mode === 'checking'
                  ? 'Проверяем доступность сервера'
                  : 'Локально в браузере: сервер недоступен, демо-режим'}
            </span>
          </span>
          <span className="row__value">
            {game.mode === 'server' ? 'сервер' : game.mode === 'checking' ? '…' : 'локально'}
          </span>
        </div>
        <div className="row">
          <span className="row__body">
            <span className="row__label">Версия схемы</span>
            <span className="row__hint">обновление сбрасывает несовместимые сохранения</span>
          </span>
          <span className="row__value">{state.schema}</span>
        </div>
      </div>

      <section className="section">
        <h2 className="section__title">Сброс</h2>
        <button
          className="action-btn"
          style={{ width: '100%', color: confirmReset ? '#fff' : 'var(--danger)' }}
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true);
              window.setTimeout(() => setConfirmReset(false), 4000);
              return;
            }
            game.reset();
            setConfirmReset(false);
            onBack();
          }}
        >
          {confirmReset ? 'Нажми ещё раз — прогресс удалится' : 'Сбросить прогресс'}
        </button>
        <div className="action-note">
          Действие необратимо: удалит номера, баланс и историю.
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────── ОБЩЕЕ ─────────────────────────── */

function headerProps(game: Game, onBack: () => void) {
  return {
    level: game.state.player.level,
    levelProgress: game.levelProgress,
    balance: game.state.player.balance,
    avatarUrl: game.state.player.avatarUrl,
    name: game.state.player.name,
    onBack,
  };
}

/** Честная заглушка для разделов, которых пока нет в прототипе. */
export function SoonScreen({
  game,
  onBack,
  title,
  note,
}: ScreenProps & { title: string; note: string }) {
  return (
    <div className="app app--soon">
      <Header {...headerProps(game, onBack)} />
      <h1 className="screen-title">{title}</h1>
      <div className="rows" style={{ padding: 18 }}>
        <div style={{ fontSize: 15, lineHeight: 1.5 }}>{note}</div>
        <div className="action-note" style={{ textAlign: 'left', paddingTop: 10 }}>
          Раздел появится на этапе подключения сервера. Сейчас играешь на локальном
          сохранении: {game.state.numbers.length} номеров и {game.state.ledger.length}{' '}
          операций в истории.
        </div>
      </div>
    </div>
  );
}