// language: TypeScript, file: frontend/src/components/UpgradeSheet.tsx
// Мастерская: пять способов сделать номер дороже.
//
// Поток из трёх фаз, как в референсе:
//   выбор  — что и куда меняем;
//   прокрутка — «Крутим…»: результат уже едет, но игрок его ещё не видит;
//   итог — что именно изменилось, сколько это стоило и что получилось в сумме,
//          с кнопками «Ещё раз» и «Готово».
//
// Для перестановки и смены оператора результат считается прямо здесь тем же
// ядром, что и на сервере, поэтому будущий номер виден до оплаты.

import { useEffect, useMemo, useState } from 'react';
import {
  operatorById,
  RARITIES,
  UPGRADES,
  UPGRADE_ORDER,
  formatMoney,
  isSwapAllowed,
  operatorChoices,
  rebuildNumber,
} from '@ciferki/shared';
import type { PhoneNumber, UpgradeId } from '@ciferki/shared';
import { Modal } from './Modal';
import type { Game } from '../hooks/useGame';

interface UpgradeSheetProps {
  game: Game;
  number: PhoneNumber;
  onClose: () => void;
}

/** Значок операции: у каждой свой характер, поэтому и знак свой. */
const UPGRADE_GLYPH: Record<UpgradeId, string> = {
  digit: '1',
  swap: '⇄',
  reroll: '↻',
  operator: '◎',
  appeal: '★',
};

const ROLL_MIN_MS = 1050;

type Phase = 'pick' | 'rolling' | 'result';

interface Outcome {
  id: UpgradeId;
  before: PhoneNumber;
  after: PhoneNumber;
  price: number;
}

export function UpgradeSheet({ game, number, onClose }: UpgradeSheetProps) {
  const [selected, setSelected] = useState<UpgradeId | null>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [index, setIndex] = useState<number | null>(null);
  const [pair, setPair] = useState<number[]>([]);
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const balance = game.state.player.balance;
  const rarity = RARITIES[number.rarity];

  const priceOf = (id: UpgradeId): number => {
    const meta = UPGRADES[id];
    if (meta.price !== null) return meta.price;
    const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    const next = order[order.indexOf(number.rarity) + 1] as keyof typeof RARITIES | undefined;
    if (!next) return 0;
    return Math.round(RARITIES[next].basePrice * (meta.appealShare ?? 0.5));
  };

  /* Живой предпросмотр перестановки: тот же расчёт, что и на сервере. */
  const swapPreview = useMemo(() => {
    if (selected !== 'swap' || pair.length !== 2) return null;
    if (!isSwapAllowed(number, pair[0], pair[1])) return null;
    const chars = [...number.digits];
    [chars[pair[0]], chars[pair[1]]] = [chars[pair[1]], chars[pair[0]]];
    return rebuildNumber(number, chars.join(''));
  }, [selected, pair, number]);

  /* Предпросмотр смены оператора: подменяем только префикс. */
  const operatorPreview = useMemo(() => {
    if (selected !== 'operator' || !operatorId) return null;
    const prefixes = operatorById(operatorId).codes;
    if (prefixes.length === 0) return null;
    const prefix = prefixes[0];
    const length = Math.min(prefix.length, number.digits.length);
    const digits = prefix.slice(0, length) + number.digits.slice(length);
    if (digits[0] === '0') return null;
    return { ...rebuildNumber(number, digits), operatorId };
  }, [selected, operatorId, number]);

  /**
   * Запуск операции. Минимум ROLL_MIN_MS держим специально: без паузы прокрутка
   * мелькала бы и игрок не успевал понять, что произошло.
   */
  const run = async (
    id: UpgradeId,
    params: { index?: number; a?: number; b?: number; operatorId?: string },
  ) => {
    const before = number;
    const price = priceOf(id);
    setPhase('rolling');
    const started = Date.now();

    const result = await game.upgradeNumber(number.id, id, params);

    const elapsed = Date.now() - started;
    if (elapsed < ROLL_MIN_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, ROLL_MIN_MS - elapsed));
    }

    if (!result.ok || !result.number) {
      setPhase('pick');
      return;
    }
    setOutcome({ id, before, after: result.number, price });
    setPhase('result');
  };

  const canConfirm =
    phase === 'pick' &&
    balance >= priceOf(selected ?? 'digit') &&
    (selected === 'digit'
      ? index !== null
      : selected === 'swap'
        ? swapPreview !== null
        : selected === 'operator'
          ? operatorPreview !== null
          : true);

  const confirm = () => {
    if (!selected) return;
    if (selected === 'digit' && index !== null) void run('digit', { index });
    else if (selected === 'swap' && pair.length === 2) void run('swap', { a: pair[0], b: pair[1] });
    else if (selected === 'operator' && operatorId) void run('operator', { operatorId });
    else if (selected !== 'digit' && selected !== 'swap' && selected !== 'operator') {
      void run(selected, {});
    }
  };

  /** «Ещё раз»: возвращаемся к выбору, но уже с обновлённым номером. */
  const again = () => {
    setIndex(null);
    setPair([]);
    setOperatorId(null);
    setOutcome(null);
    setPhase('pick');
  };

  /* ─────────────────────────── ИТОГ ─────────────────────────── */

  if (phase === 'result' && outcome) {
    return (
      <UpgradeOutcome
        outcome={outcome}
        onAgain={again}
        onDone={onClose}
      />
    );
  }

  /* ─────────────────────────── ПРОКРУТКА ─────────────────────────── */

  if (phase === 'rolling' && selected) {
    return (
      <RollingView
        number={number}
        id={selected}
        index={index}
        price={priceOf(selected)}
        title={UPGRADES[selected].name}
      />
    );
  }

  /* ─────────────────────────── СПИСОК ОПЕРАЦИЙ ─────────────────────────── */

  if (selected === null) {
    return (
      <Modal
        title="Мастерская"
        subtitle="Пять способов сделать номер дороже"
        onClose={onClose}
        footer={
          <div className="workshop-balance">
            Баланс: <b>{formatMoney(balance)} ₽</b>
          </div>
        }
      >
        <div className="workshop-head" style={{ ['--rarity' as string]: rarity.color }}>
          <div className="workshop-head__number">{number.display}</div>
          <div className="workshop-head__meta">
            <span style={{ color: rarity.color, fontWeight: 700 }}>{rarity.name}</span>
            <span>· {number.score} очков</span>
            <span>· {formatMoney(number.finalPrice)} ₽</span>
          </div>
        </div>

        <div className="workshop-list">
          {UPGRADE_ORDER.map((id) => {
            const meta = UPGRADES[id];
            const price = priceOf(id);
            const maxed = id === 'appeal' && number.rarity === 'mythic';
            const noAlternative =
              id === 'operator' && !operatorChoices(number).some((choice) => !choice.current);
            const unavailable = maxed || noAlternative;
            const blocked = unavailable || price <= 0 || balance < price;

            return (
              <button
                key={id}
                className="workshop-item"
                disabled={blocked}
                onClick={() => {
                  setSelected(id);
                  setIndex(null);
                  setPair([]);
                  setOperatorId(null);
                }}
              >
                <span
                  className="workshop-item__glyph"
                  style={{
                    background: unavailable ? 'var(--surface-3)' : rarity.color,
                    color: unavailable ? 'var(--text-dim)' : '#fff',
                  }}
                >
                  {UPGRADE_GLYPH[id]}
                </span>
                <span className="workshop-item__body">
                  <span className="workshop-item__title">{meta.name}</span>
                  <span className="workshop-item__effect">{meta.effect}</span>
                </span>
                <span className="workshop-item__price">
                  {maxed
                    ? 'предел'
                    : noAlternative
                      ? 'один оператор'
                      : `${formatMoney(price)} ₽`}
                  {!unavailable && balance < price && (
                    <span className="workshop-item__lack">не хватает</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="action-note" style={{ textAlign: 'left' }}>
          Каждая операция пересчитывает очки, категорию и цену заново. Категория всегда
          определяется суммой очков — подделать её нельзя.
        </div>
      </Modal>
    );
  }

  /* ─────────────────────────── ДЕТАЛИ ОПЕРАЦИИ ─────────────────────────── */

  const meta = UPGRADES[selected];
  const price = priceOf(selected);
  const affordable = balance >= price && price > 0;

  return (
    <Modal
      title={meta.name}
      subtitle={meta.effect}
      onClose={onClose}
      footer={
        <>
          <button
            className="choose-btn"
            disabled={!canConfirm}
            style={!canConfirm ? { opacity: 0.5 } : undefined}
            onClick={confirm}
          >
            <span>
              {selected === 'appeal'
                ? 'Подать апелляцию'
                : selected === 'operator'
                  ? 'Перевести номер'
                  : selected === 'digit'
                    ? `Поменять ${index !== null ? number.digits[index] : 'цифру'}`
                    : 'Применить'}
            </span>
            <span className="choose-btn__side">{formatMoney(price)} ₽</span>
          </button>
          <button className="link-row" style={{ width: '100%' }} onClick={() => setSelected(null)}>
            ‹ Другие способы
          </button>
        </>
      }
    >
      <div className="workshop-note">{meta.description}</div>

      {(selected === 'digit' || selected === 'swap') && (
        <>
          <div className="workshop-pick">
            {selected === 'digit'
              ? 'Какую цифру поменять?'
              : pair.length === 0
                ? 'Выберите первую цифру'
                : pair.length === 1
                  ? 'Выберите вторую цифру'
                  : 'Готово — проверьте результат'}
          </div>

          <div className="digit-row">
            {[...number.digits].map((digit, i) => {
              const picked = selected === 'digit' ? index === i : pair.includes(i);
              const blockedSwap =
                selected === 'swap' && pair.length === 1 && !isSwapAllowed(number, pair[0], i);
              return (
                <button
                  key={`${i}-${digit}`}
                  className={`digit-chip ${picked ? 'digit-chip--picked' : ''} ${
                    blockedSwap ? 'digit-chip--blocked' : ''
                  }`}
                  disabled={blockedSwap}
                  onClick={() => {
                    if (selected === 'digit') {
                      setIndex(i);
                      return;
                    }
                    setPair((current) => {
                      if (current.length >= 2) return [i];
                      if (current.includes(i)) return current.filter((value) => value !== i);
                      return [...current, i];
                    });
                  }}
                >
                  {digit}
                </button>
              );
            })}
          </div>
        </>
      )}

      {selected === 'digit' && index !== null && (
        <DigitForecast game={game} number={number} index={index} />
      )}

      {selected === 'operator' && (
        <>
          <div className="workshop-pick">
            {operatorId ? 'Проверьте, что получится' : 'К какому оператору перевести?'}
          </div>
          <div className="operator-list">
            {operatorChoices(number).map((choice) => (
              <button
                key={choice.id}
                className={`operator-chip ${
                  operatorId === choice.id ? 'operator-chip--picked' : ''
                } ${choice.current ? 'operator-chip--current' : ''}`}
                disabled={choice.current}
                onClick={() => setOperatorId(choice.id)}
              >
                <span
                  className="operator-chip__badge"
                  style={{ background: choice.color }}
                >
                  {choice.badge}
                </span>
                <span className="operator-chip__body">
                  <span className="operator-chip__name">{choice.name}</span>
                  <span className="operator-chip__prefix">
                    {choice.current
                      ? 'текущий'
                      : `${choice.codes.length} кодов · начнётся с ${choice.samplePrefix}`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {selected === 'operator' && operatorPreview && (
        <div
          className="preview"
          style={{ ['--rarity' as string]: RARITIES[operatorPreview.rarity].color }}
        >
          <div className="preview__label">Получится</div>
          <div className="preview__number">{operatorPreview.display}</div>
          <div className="preview__row">
            <span>
              Оператор <b>{operatorById(number.operatorId)?.name ?? number.operatorId}</b> →{' '}
              <b className="preview__up">
                {operatorById(operatorPreview.operatorId)?.name ?? operatorPreview.operatorId}
              </b>
            </span>
          </div>
          <div className="preview__row">
            <span>
              Цена <b>{formatMoney(number.finalPrice)} ₽</b> →{' '}
              <b
                className={
                  operatorPreview.finalPrice >= number.finalPrice
                    ? 'preview__up'
                    : 'preview__down'
                }
              >
                {formatMoney(operatorPreview.finalPrice)} ₽
              </b>
            </span>
            <span className="preview__delta">
              {operatorPreview.finalPrice === number.finalPrice
                ? 'без изменений'
                : `${operatorPreview.finalPrice >= number.finalPrice ? '+' : '−'}${formatMoney(
                    Math.abs(operatorPreview.finalPrice - number.finalPrice),
                  )} ₽`}
            </span>
          </div>
        </div>
      )}

      {selected === 'swap' && swapPreview && (
        <div
          className="preview"
          style={{ ['--rarity' as string]: RARITIES[swapPreview.rarity].color }}
        >
          <div className="preview__label">Получится</div>
          <div className="preview__number">{swapPreview.display}</div>
          <div className="preview__row">
            <span>
              Очки <b>{number.score}</b> → <b className="preview__up">{swapPreview.score}</b>
            </span>
            <span style={{ color: RARITIES[swapPreview.rarity].color }}>
              {RARITIES[swapPreview.rarity].name}
            </span>
          </div>
          <div className="preview__row">
            <span>
              Цена <b>{formatMoney(number.finalPrice)} ₽</b> →{' '}
              <b
                className={
                  swapPreview.finalPrice >= number.finalPrice ? 'preview__up' : 'preview__down'
                }
              >
                {formatMoney(swapPreview.finalPrice)} ₽
              </b>
            </span>
            <span className="preview__delta">
              {swapPreview.finalPrice >= number.finalPrice ? '+' : '−'}
              {formatMoney(Math.abs(swapPreview.finalPrice - number.finalPrice))} ₽
            </span>
          </div>
        </div>
      )}

      {selected === 'reroll' && (
        <div className="workshop-note workshop-note--soft">
          Категория останется прежней — <b>{rarity.name}</b>. Очки внутри категории
          будут от {bandOf(number.rarity).min} до {bandOf(number.rarity).max}, а вместе
          с ними изменится и цена. Результат выбирает сервер.
        </div>
      )}

      {selected === 'appeal' && (
        <div className="workshop-note workshop-note--soft">
          {number.rarity === 'mythic' ? (
            <>Мифический — верхняя категория. Выше подниматься некуда.</>
          ) : (
            <>
              Номер перевыпускается в категории{' '}
              <b style={{ color: RARITIES[nextOf(number.rarity)!].color }}>
                {RARITIES[nextOf(number.rarity)!].name}
              </b>{' '}
              — гарантированно, без случайности. Прежняя цена{' '}
              {formatMoney(number.finalPrice)} ₽ заменится новой.
            </>
          )}
        </div>
      )}

      <div className="action-note">
        {affordable
          ? `Спишется ${formatMoney(price)} ₽ · останется ${formatMoney(balance - price)} ₽`
          : `Не хватает ${formatMoney(Math.max(0, price - balance))} ₽`}
      </div>
    </Modal>
  );
}

/* ─────────────────────────── ПРОКРУТКА ─────────────────────────── */

/** Крутящаяся цифра: обычный интервал, меняющий символ, — как у игрового автомата. */
function useRollingDigit(active: boolean): string {
  const [digit, setDigit] = useState('0');

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setDigit(String(Math.floor(Math.random() * 10)));
    }, 78);
    return () => window.clearInterval(timer);
  }, [active]);

  return digit;
}

function RollingView({
  number,
  id,
  index,
  price,
  title,
}: {
  number: PhoneNumber;
  id: UpgradeId;
  index: number | null;
  price: number;
  title: string;
}) {
  const spinning = useRollingDigit(true);
  const digits = [...number.digits];
  const target = index ?? 0;

  return (
    <Modal title={title} subtitle="Крутим…" onClose={() => undefined}>
      <div className="rolling">
        <div className="rolling__stage" style={{ ['--rarity' as string]: RARITIES[number.rarity].color }}>
          <div className="rolling__label">Крутим…</div>
          <div className="rolling__number">
            {digits.map((digit, i) => (
              <span
                key={`${i}-${digit}`}
                className={`roll-chip ${i === target ? 'roll-chip--active' : ''}`}
              >
                {i === target && id === 'digit' ? spinning : digit}
              </span>
            ))}
          </div>
          <div className="rolling__was">
            Было: <b>{number.display}</b> · {formatMoney(number.finalPrice)} ₽
          </div>
        </div>
        <div className="rolling__hint">
          Спишется {formatMoney(price)} ₽. Результат уже едет.
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────────── ИТОГ ОПЕРАЦИИ ─────────────────────────── */

function UpgradeOutcome({
  outcome,
  onAgain,
  onDone,
}: {
  outcome: Outcome;
  onAgain: () => void;
  onDone: () => void;
}) {
  const { before, after, price } = outcome;
  const delta = after.finalPrice - before.finalPrice;
  // Итог с учётом цены операции: сколько игрок заработал или потерял на круг.
  const net = delta - price;

  const verdict =
    delta > 0 ? 'Подорожал' : delta < 0 ? 'Подешевел' : 'Без изменений';
  const tone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  return (
    <Modal
      title={verdict}
      subtitle={`${before.display} → ${after.display}`}
      onClose={onDone}
      footer={
        <div className="outcome-actions">
          <button className="action-btn action-btn--white" onClick={onAgain}>
            Ещё раз
          </button>
          <button className="action-btn" onClick={onDone}>
            Готово
          </button>
        </div>
      }
    >
      <div className={`outcome-banner outcome-banner--${tone}`}>
        <div className="outcome-banner__verdict">{verdict}</div>
        <div className="outcome-banner__delta">
          {delta === 0 ? '0 ₽' : `${delta > 0 ? '+' : '−'}${formatMoney(Math.abs(delta))} ₽`}
        </div>
      </div>

      <div
        className="outcome-card"
        style={{ ['--rarity' as string]: RARITIES[after.rarity].color }}
      >
        <div className="outcome-card__number">{after.display}</div>
        <div className="outcome-card__row">
          <span>Очки</span>
          <span>
            <b>{before.score}</b> → <b>{after.score}</b>
          </span>
        </div>
        <div className="outcome-card__row">
          <span>Категория</span>
          <span>
            <b>{RARITIES[before.rarity].name}</b> →{' '}
            <b style={{ color: RARITIES[after.rarity].color }}>{RARITIES[after.rarity].name}</b>
          </span>
        </div>
        <div className="outcome-card__row">
          <span>Оценка</span>
          <span>
            <b>{formatMoney(before.finalPrice)} ₽</b> →{' '}
            <b className={tone === 'up' ? 'preview__up' : tone === 'down' ? 'preview__down' : ''}>
              {formatMoney(after.finalPrice)} ₽
            </b>
          </span>
        </div>
      </div>

      {/* Итог честный: стоимость операции вычитается, иначе легко обмануться. */}
      <div className="outcome-summary">
        Операция стоила {formatMoney(price)} ₽ · итог с учётом цены:{' '}
        <b className={net >= 0 ? 'preview__up' : 'preview__down'}>
          {net >= 0 ? '+' : '−'}
          {formatMoney(Math.abs(net))} ₽
        </b>
      </div>
    </Modal>
  );
}

/* ─────────────────────────── ПРОГНОЗ ЗАМЕНЫ ЦИФРЫ ─────────────────────────── */

function DigitForecast({
  game,
  number,
  index,
}: {
  game: Game;
  number: PhoneNumber;
  index: number;
}) {
  const forecast = game.forecast(number, index);

  return (
    <>
      <div className="workshop-pick" style={{ paddingTop: 14 }}>
        Позиция {index + 1}: цифра {forecast.currentDigit}
      </div>
      <div className="outcomes">
        <Outcome percent={forecast.willRise} label="подорожает" note={`до ${formatMoney(forecast.bestPrice)} ₽`} tone="up" />
        <Outcome percent={forecast.same} label="почти не изменится" tone="flat" />
        <Outcome percent={forecast.willFall} label="подешевеет" note={`до ${formatMoney(forecast.worstPrice)} ₽`} tone="down" />
      </div>
      <div className="action-note">
        Перебраны все десять цифр на этой позиции. Фактическую выбирает сервер.
      </div>
    </>
  );
}

function Outcome({
  percent,
  label,
  note,
  tone,
}: {
  percent: number;
  label: string;
  note?: string;
  tone: 'up' | 'flat' | 'down';
}) {
  return (
    <div className={`outcome outcome--${tone}`}>
      <div className="outcome__percent">{percent} %</div>
      <div className="outcome__label">{label}</div>
      {note && <div className="outcome__note">{note}</div>}
    </div>
  );
}

/* ─────────────────────────── МЕЛОЧИ ─────────────────────────── */

const RARITY_LADDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;

function nextOf(rarity: PhoneNumber['rarity']) {
  const index = RARITY_LADDER.indexOf(rarity);
  return index >= 0 && index < RARITY_LADDER.length - 1 ? RARITY_LADDER[index + 1] : null;
}

/** Границы очков категории — чтобы честно сказать, куда может уехать перебор. */
function bandOf(rarity: PhoneNumber['rarity']): { min: number; max: number } {
  const bands = [9, 39, 79, 139, 219, 400];
  const index = RARITY_LADDER.indexOf(rarity);
  const min = index === 0 ? 0 : bands[index - 1] + 1;
  return { min, max: bands[index] ?? 400 };
}
