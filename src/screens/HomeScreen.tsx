// language: TypeScript, file: frontend/src/screens/HomeScreen.tsx
// Главный экран. Композиция один в один с референсом: верхняя панель, баннер удачи,
// большая SIM-карта с оценкой, индикатор удачи, два переключателя и кнопка выпуска.

import {
  COUNTRIES,
  COUNTRY_BY_ID,
  ECONOMY,
  LUCK,
  TARIFFS,
  formatMoney,
  releaseCost,
} from '@ciferki/shared';
import { Header } from '../components/Header';
import { SimCard } from '../components/SimCard';
import { Flag } from '../components/Flag';
import { describeOperatorChoice } from '../components/OperatorModal';
import { formatDuration } from '../utils/format';
import { useCountUp } from '../hooks/useCountUp';
import type { Game } from '../hooks/useGame';
import type { PhoneNumber } from '@ciferki/shared';

interface HomeScreenProps {
  game: Game;
  lastNumber: PhoneNumber | null;
  /** На карточке не выпущенный номер, а бланк выбранной страны */
  isPreview: boolean;
  onOpenMenu: () => void;
  onOpenTariff: () => void;
  onOpenRoaming: () => void;
  onOpenOperator: () => void;
  onOpenCollection: () => void;
  onOpenNumber: (id: string) => void;
}

export function HomeScreen({
  game,
  lastNumber,
  isPreview,
  onOpenMenu,
  onOpenTariff,
  onOpenRoaming,
  onOpenOperator,
  onOpenCollection,
  onOpenNumber,
}: HomeScreenProps) {
  const { state, luck, luckRemainingMs } = game;
  const tariff = TARIFFS[state.selectedTariff];
  const country = state.selectedCountry ? COUNTRY_BY_ID[state.selectedCountry] : null;

  // Цену выпуска считает общее ядро: надбавка за своего оператора входит в неё,
  // иначе кнопка обещала бы одну сумму, а списывалась другая.
  const cost = releaseCost(state.selectedTariff, state.selectedOperator);

  const affordable =
    tariff.price === null
      ? state.player.tickets >= (tariff.ticketCost ?? 1)
      : state.player.balance >= cost.money;

  const luckShare = luckRemainingMs / LUCK.durationMs;

  /*
   * Оценка под карточкой доезжает до значения, а не появляется готовой:
   * число бежит от прежнего к новому и сразу видно, что выпуск что-то изменил.
   */
  const shownPrice = useCountUp(lastNumber && !isPreview ? lastNumber.finalPrice : 0);
  /** Сколько номеров в коллекции — тоже счётчиком, для той же живости. */
  const shownCount = useCountUp(state.numbers.length, 620);

  return (
    <div className="app app--home">
      <Header
        level={state.player.level}
        levelProgress={game.levelProgress}
        balance={state.player.balance}
        avatarUrl={state.player.avatarUrl}
        name={state.player.name}
        onMenu={onOpenMenu}
      />

      {luck > 1 && (
        <div className="luck-banner">
          <span className="luck-banner__badge">Ч</span>
          <div className="luck-banner__body">
            <div className="luck-banner__title">
              {state.player.luck.title.split('·')[0].trim()}
              <b>×{luck}</b>
            </div>
            <div className="luck-banner__sub">{state.player.luck.subtitle}</div>
          </div>
          <span className="luck-banner__timer">{formatDuration(luckRemainingMs)}</span>
        </div>
      )}

      <div className="sim-wrap">
        <SimCard
          number={lastNumber}
          revealing={game.revealing}
          revealRarity={game.revealingRarity}
        />

        {lastNumber && !isPreview ? (
          <button
            className="estimate"
            onClick={() => onOpenNumber(lastNumber.id)}
            style={{ width: '100%' }}
          >
            <div className="estimate__label">
              {game.countByRarity[lastNumber.rarity] > 1
                ? 'Последний выпуск · оценка'
                : 'Оценка номера'}
            </div>
            <div className="estimate__value">{formatMoney(shownPrice)} ₽</div>
            <div className="estimate__tags">
              <span className="chip">
                <b>×{String(lastNumber.patternMultiplier).replace('.', ',')}</b> узор
              </span>
              <span className="chip">оценка узора: {lastNumber.score}</span>
            </div>
          </button>
        ) : isPreview ? (
          /* Бланк выбранной страны: оценка появится, когда номер выпадет. */
          <div className="estimate">
            <div className="estimate__label">Номер ещё не выпущен</div>
            <div className="estimate__tags">
              <span className="chip">страна и оператор выбраны</span>
            </div>
          </div>
        ) : (
          <div className="estimate">
            <div className="estimate__label">Коллекция пуста</div>
            <div className="estimate__tags">
              <span className="chip">Мест: {state.slots}</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="luck-strip">
          {luck > 1
            ? `Эта крутка — с удачей ×${luck}`
            : `Удача ×${state.player.luck.multiplier} не активна`}
        </div>
        <div className="luck-track">
          <div
            className="luck-track__fill"
            style={{ width: `${Math.min(100, Math.max(0, luckShare * 100))}%` }}
          />
        </div>
      </div>

      <div className="spacer" style={{ minHeight: 12 }} />

      <div className="selectors">
        <button className="selector" onClick={onOpenRoaming}>
          <div className="selector__label">Роуминг</div>
          <div className="selector__value">
            {country ? (
              <>
                <Flag countryId={country.id} size={18} />
                {country.name}
              </>
            ) : (
              <>
                <span>🌐</span>
                Любой
              </>
            )}
          </div>
        </button>

        <button className="selector" onClick={onOpenTariff}>
          <div className="selector__label">Тариф</div>
          <div className="selector__value">{tariff.name}</div>
        </button>
      </div>

      {/* Оператор и код: свой выбор стоит дороже, но номер начнётся с него. */}
      <button className="selector selector--wide" onClick={onOpenOperator}>
        <div className="selector__label">Оператор</div>
        <div className="selector__value">
          {describeOperatorChoice(game)}
          {game.state.selectedOperator && (
            <span className="selector__surcharge">
              +{Math.round(ECONOMY.operatorSurcharge * 100)} %
            </span>
          )}
        </div>
      </button>

      <button
        className="release-btn"
        disabled={!affordable || game.revealing}
        onClick={() => game.doRelease()}
      >
        <span>
          {game.revealing
            ? 'Выпускаем…'
            : luck > 1
              ? `Выпустить SIM с удачей ×${luck}`
              : 'Выпустить SIM'}
        </span>
        <span className="release-btn__price">
          {priceOf(state.selectedTariff, state.player.tickets, cost.money)}
        </span>
      </button>

      {/* Если выпуск недоступен, игрок должен видеть причину, а не гадать. */}
      {!affordable && !game.revealing && (
        <button className="release-blocked" onClick={onOpenTariff}>
          <span className="release-blocked__dot" />
          {blockReason(state.selectedTariff, state.player.balance, state.player.tickets, cost.money)}
          <span className="release-blocked__action">сменить тариф ›</span>
        </button>
      )}

      {state.numbers.length > 0 && (
        <button className="link-row" style={{ width: '100%' }} onClick={onOpenCollection}>
          Коллекция · {shownCount} из {state.slots} ›
        </button>
      )}

      <div className="action-note">{COUNTRIES.length} регионов</div>
    </div>
  );
}

function priceOf(tariffId: keyof typeof TARIFFS, tickets: number, money: number): string {
  const tariff = TARIFFS[tariffId];
  if (tariff.price === null) return tickets > 0 ? 'по билету' : 'нет билета';
  return `${formatMoney(money)} ₽`;
}

/** Почему выпуск сейчас недоступен — конкретно, а не «недостаточно средств». */
function blockReason(
  tariffId: keyof typeof TARIFFS,
  balance: number,
  tickets: number,
  money: number,
): string {
  const tariff = TARIFFS[tariffId];
  if (tariff.price === null) {
    return tickets > 0 ? 'Для Элита нужен билет' : 'Нужен билет на Элит';
  }
  const missing = money - balance;
  if (missing <= 0) return 'Выпуск недоступен';
  return `Не хватает ${formatMoney(missing)} ₽`;
}
