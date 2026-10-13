// language: TypeScript, file: frontend/src/screens/NumberScreen.tsx
// Карточка предмета: сам номер, действия, разбор «Почему …» по узорам,
// служебные данные и локальная история. Улучшения — в отдельной мастерской.

import { useMemo, useState } from 'react';
import { ECONOMY, operatorById, RARITIES, formatMoney, TARIFFS } from '@ciferki/shared';
import { Header } from '../components/Header';
import { SimCard } from '../components/SimCard';
import { UpgradeSheet } from '../components/UpgradeSheet';
import { IconClock, IconKey, IconTag, IconTrend } from '../components/Icons';
import { formatDateTime, formatDay } from '../utils/format';
import { shareText } from '../telegram';
import type { Game } from '../hooks/useGame';
import type { PhoneNumber } from '@ciferki/shared';

interface NumberScreenProps {
  game: Game;
  number: PhoneNumber;
  onBack: () => void;
}

export function NumberScreen({ game, number, onBack }: NumberScreenProps) {
  const { state } = game;
  const rarity = RARITIES[number.rarity];
  const operator = operatorById(number.operatorId);
  const isPrimary = state.player.primaryNumberId === number.id;
  const [changeOpen, setChangeOpen] = useState(false);

  const swapPrice =
    state.player.freePrimarySwaps > 0 ? 0 : ECONOMY.primarySwapPrice;

  const history = useMemo(
    () => state.ledger.filter((entry) => entry.numberId === number.id),
    [state.ledger, number.id],
  );

  return (
    <div className="app app--number">
      <Header
        level={state.player.level}
        levelProgress={game.levelProgress}
        balance={state.player.balance}
        avatarUrl={state.player.avatarUrl}
        name={state.player.name}
        onBack={onBack}
      />

      <h1 className="screen-title">Номер</h1>

      <SimCard number={number} />

      <div className="detail-actions">
        <button className="action-btn action-btn--white" onClick={() => setChangeOpen(true)}>
          Улучшить номер
        </button>

        <div className="action-row">
          <button
            className="action-btn"
            onClick={() => game.makePrimary(number.id)}
            disabled={isPrimary}
            style={isPrimary ? { opacity: 0.5 } : undefined}
          >
            {isPrimary
              ? 'Основной'
              : swapPrice === 0
                ? 'Сделать основным · бесплатно'
                : `Сделать основным · ${formatMoney(swapPrice)} ₽`}
          </button>
          <button className="action-btn" onClick={() => game.sell(number.id)}>
            Продать · {formatMoney(number.finalPrice)} ₽
          </button>
        </div>

        <div className="action-row">
          <button className="action-btn" onClick={() => game.notify('Оформление — раздел в разработке')}>
            Оформление
          </button>
          <button
            className="action-btn action-btn--gold"
            onClick={() => {
              const text = `${operator.name} · ${number.display} · ${formatMoney(
                number.finalPrice,
              )} ₽ — мой номер в Циферках`;
              void shareText(text).then((how) => {
                if (how === 'clipboard') game.notify('Текст скопирован — вставь в чат');
                else if (how === 'failed') game.notify('Поделиться не вышло', 'error');
              });
            }}
          >
            Похвастаться
          </button>
        </div>

        <button
          className="action-btn action-btn--gold"
          onClick={() => {
            game.notify('Передача номера другому игроку появится вместе с рынком');
          }}
        >
          Продать / передать
        </button>
      </div>

      <div className="action-note">
        {state.player.freePrimarySwaps > 0
          ? `Бесплатных смен основного: ${state.player.freePrimarySwaps}`
          : 'Бесплатные смены основного закончились'}
      </div>

      <section className="section">
        <h2 className="section__title">Почему {rarity.name}</h2>
        <div className="rows">
          {number.patterns.length === 0 ? (
            <div className="pattern-row">
              <span className="row__icon" style={{ background: 'var(--surface-3)' }}>
                <IconTag size={16} />
              </span>
              <span className="row__body">
                <span className="row__label">Выраженных узоров нет</span>
                <span className="row__hint">Ровный номер без повторов и последовательностей</span>
              </span>
              <span className="pattern-row__points">+0</span>
            </div>
          ) : (
            number.patterns.map((hit) => (
              <div className="pattern-row" key={hit.id}>
                <span className="row__icon" style={{ background: 'var(--surface-3)' }}>
                  <IconTrend size={16} />
                </span>
                <span className="row__body">
                  <span className="row__label">{hit.label}</span>
                  <span className="row__hint">{hit.detail}</span>
                </span>
                <span className="pattern-row__points">+{hit.points}</span>
              </div>
            ))
          )}
          <div className="pattern-row">
            <span className="row__icon" style={{ background: rarity.color, color: '#fff' }}>
              <IconTrend size={16} />
            </span>
            <span className="row__body">
              <span className="row__label">Итого очков</span>
              <span className="row__hint">
                Множитель узора ×{String(number.patternMultiplier).replace('.', ',')}
              </span>
            </span>
            <span className="pattern-row__points pattern-row__points--total">
              {number.score}
            </span>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">Номер</h2>
        <div className="rows">
          <div className="row">
            <span className="row__icon" style={{ background: 'var(--surface-3)' }}>
              <IconKey size={16} />
            </span>
            <span className="row__body">
              <span className="row__label">Тираж</span>
            </span>
            <span className="row__value">Без ограничения</span>
          </div>
          <div className="row">
            <span className="row__icon" style={{ background: 'var(--surface-3)' }}>
              <IconClock size={16} />
            </span>
            <span className="row__body">
              <span className="row__label">Первый выпуск</span>
            </span>
            <span className="row__value">{formatDay(number.issuedAt)}</span>
          </div>
          <div className="row">
            <span className="row__icon" style={{ background: 'var(--surface-3)' }}>
              <IconTag size={16} />
            </span>
            <span className="row__body">
              <span className="row__label">Получен</span>
            </span>
            <span className="row__value">
              Крутка, {formatDay(number.issuedAt)} · {TARIFFS[number.tariffId].name}
            </span>
          </div>
          <div className="row">
            <span className="row__icon" style={{ background: 'var(--surface-3)' }}>
              <IconTrend size={16} />
            </span>
            <span className="row__body">
              <span className="row__label">Оценка</span>
              <span className="row__hint">
                база {formatMoney(number.basePrice)} ₽ × узор × спрос{' '}
                {String(number.demandMultiplier).replace('.', ',')}
              </span>
            </span>
            <span className="row__value">{formatMoney(number.finalPrice)} ₽</span>
          </div>
        </div>
      </section>

      {history.length > 0 && (
        <section className="section">
          <h2 className="section__title">История</h2>
          <div className="rows">
            {history.map((entry) => (
              <div className="row" key={entry.id}>
                <span className="row__body">
                  <span className="row__label">{entry.label}</span>
                  <span className="row__hint">{formatDateTime(entry.at)}</span>
                </span>
                <span className="row__value">
                  {entry.amount === 0
                    ? '—'
                    : `${entry.amount > 0 ? '+' : '−'}${formatMoney(Math.abs(entry.amount))} ₽`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {changeOpen && (
        <UpgradeSheet game={game} number={number} onClose={() => setChangeOpen(false)} />
      )}
    </div>
  );
}