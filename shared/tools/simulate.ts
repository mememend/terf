// language: TypeScript, file: shared/tools/simulate.ts
// Симулятор экономики.
//
// Цены в игре были расставлены на глаз. Этот прогон играет сам за себя:
// выпускает номера, продаёт лишние, копит на следующий тариф — и показывает,
// где игрок застревает, а где деньги перестают что-либо значить.
//
// Запуск: npm --workspace shared run simulate

import {
  COUNTRIES,
  ECONOMY,
  RARITIES,
  TARIFFS,
  TARIFF_ORDER,
  UPGRADES,
  activeLuck,
  createInitialState,
  dailyReward,
  distributionFor,
  release,
  sellNumber,
} from '../src/index';
import type { GameState, RarityId, TariffId } from '../src/index';

/** Простая стратегия: держим лучший номер, остальное продаём. */
function playOneRoll(state: GameState, tariffId: TariffId, countryId: string | null): GameState {
  const result = release(state, {
    tariffId,
    countryId,
    releaseId: `sim_${state.numbers.length}_${Math.random().toString(36).slice(2, 8)}`,
  });
  if (!result.ok) return state;

  let next = result.state;
  // Продаём всё, что дешевле половины самого дорогого номера, если мест мало.
  if (next.numbers.length > next.slots - 5) {
    const sorted = [...next.numbers].sort((a, b) => a.finalPrice - b.finalPrice);
    const cheapest = sorted[0];
    if (cheapest.id !== next.player.primaryNumberId) {
      const sale = sellNumber(next, cheapest.id);
      if (sale.ok) next = sale.state;
    }
  }
  return next;
}

interface Stats {
  rolls: number;
  spent: number;
  earned: number;
  rarity: Record<RarityId, number>;
  best: { display: string; price: number; rarity: RarityId } | null;
  balance: number;
  portfolio: number;
}

function simulate(rolls: number, tariffId: TariffId, countryId: string | null): Stats {
  let state = createInitialState({ balance: ECONOMY.startingBalance });
  const rarity = Object.fromEntries(
    Object.keys(RARITIES).map((id) => [id, 0]),
  ) as Record<RarityId, number>;

  let spent = 0;
  let earned = 0;
  let actualRolls = 0;
  let best: Stats['best'] = null;

  for (let index = 0; index < rolls; index += 1) {
    const before = state.player.balance;
    // Если на тариф не хватает — переходим на тот, что по карману.
    const affordable: TariffId =
      state.player.balance >= (TARIFFS[tariffId].price ?? 0) ? tariffId : 'standard';
    if (state.player.balance < (TARIFFS.standard.price ?? 0)) break;

    state = playOneRoll(state, affordable, countryId);
    actualRolls += 1;
    const after = state.player.balance;
    if (after < before) spent += before - after;
    if (after > before) earned += after - before;

    const newest = state.numbers[0];
    if (newest) {
      rarity[newest.rarity] += 1;
      if (!best || newest.finalPrice > best.price) {
        best = { display: newest.display, price: newest.finalPrice, rarity: newest.rarity };
      }
    }
  }

  const portfolio = state.numbers.reduce((sum, number) => sum + number.finalPrice, 0);
  return {
    rolls: actualRolls,
    spent,
    earned,
    rarity,
    best,
    balance: state.player.balance,
    portfolio,
  };
}

function money(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

/**
 * Сколько выпусков нужно, чтобы заработать на тариф.
 *
 * Считаем не «докуда копить с текущего баланса» — стартовых денег хватает сразу
 * на «Премиум», и ответ всегда был бы нулём. Считаем, сколько выпусков надо
 * ПРОДАТЬ, чтобы выручить цену тарифа с учётом комиссии.
 */
function rollsToAfford(target: TariffId, countryId: string | null): number {
  const price = TARIFFS[target].price ?? 0;
  if (price === 0) return 0;

  // Средняя выручка с одного проданного номера Стандарта.
  let state = createInitialState({ balance: 10_000_000 });
  let earned = 0;
  let sold = 0;
  const sample = 600;

  for (let index = 0; index < sample; index += 1) {
    const result = release(state, {
      tariffId: 'standard',
      countryId,
      releaseId: `afford_${target}_${index}`,
    });
    if (!result.ok) break;
    const number = result.state.numbers[0];
    const sale = sellNumber(result.state, number.id);
    if (!sale.ok) break;
    earned += sale.state.player.balance - result.state.player.balance;
    sold += 1;
    state = sale.state;
  }

  const average = sold > 0 ? earned / sold : 0;
  return average > 0 ? Math.ceil(price / average) : Number.POSITIVE_INFINITY;
}

console.log('\n═══ ЭКОНОМИКА: 400 выпусков по Стандарту, Россия ═══\n');

const base = simulate(400, 'standard', 'ru');
console.log(`выпусков:            ${base.rolls}`);
console.log(`потрачено:           ${money(base.spent)}`);
console.log(`возвращено продажей: ${money(base.earned)}`);
console.log(`баланс в конце:      ${money(base.balance)}`);
console.log(`портфель:            ${money(base.portfolio)}`);
console.log(`лучший номер:        ${base.best?.display ?? '—'} · ${money(base.best?.price ?? 0)}`);

console.log('\nкатегории за прогон:');
for (const [id, count] of Object.entries(base.rarity)) {
  const share = ((count / base.rolls) * 100).toFixed(1);
  console.log(`  ${RARITIES[id as RarityId].name.padEnd(12)} ${String(count).padStart(4)}  ${share} %`);
}

console.log('\n═══ СКОЛЬКО КОПИТЬ НА СЛЕДУЮЩИЙ ТАРИФ ═══\n');
for (const tariffId of TARIFF_ORDER) {
  const tariff = TARIFFS[tariffId];
  if (tariff.price === null) {
    console.log(`  ${tariff.name.padEnd(10)} по билету — экономикой не проверяется`);
    continue;
  }
  const rolls = rollsToAfford(tariffId, 'ru');
  console.log(
    `  ${tariff.name.padEnd(10)} ${money(tariff.price).padStart(12)}  →  ${rolls} выпусков Стандарта`,
  );
}

console.log('\n═══ КОМИССИЯ И ОПЕРАЦИИ ═══\n');
const sample = createInitialState({ balance: 100_000 });
const sampleRoll = release(sample, {
  tariffId: 'standard',
  countryId: 'ru',
  releaseId: 'sim_sample',
});
if (sampleRoll.ok) {
  const number = sampleRoll.state.numbers[0];
  const payout = Math.round(number.finalPrice * ECONOMY.sellRate);
  console.log(`  номер стоит               ${money(number.finalPrice)}`);
  console.log(
    `  продажа возвращает        ${money(payout)}  (комиссия ${Math.round((1 - ECONOMY.sellRate) * 100)} %)`,
  );
  console.log(`  потеря на круге           ${money(number.finalPrice - payout)}`);
}
console.log(`  апелляция обычный → необычный: ${money(
  Math.round(RARITIES.uncommon.basePrice * (UPGRADES.appeal.appealShare ?? 0.5)),
)}`);
console.log(`  обычный выпуск Стандарта:       ${money(TARIFFS.standard.price ?? 0)}`);
console.log(`  база «Необычного»:              ${money(RARITIES.uncommon.basePrice)}`);

console.log('\n═══ НАГРАДА ДНЯ ═══\n');
const streakState = createInitialState({ balance: 0 });
for (const streak of [0, 1, 3, 6, 7, 14]) {
  const probe = {
    ...streakState,
    player: { ...streakState.player, dailyStreak: streak },
  };
  console.log(
    `  серия ${String(streak).padStart(2)} → ${money(dailyReward(probe))}${
      (streak + 1) % 7 === 0 ? ' + билет' : ''
    }`,
  );
}

/**
 * Сверка заявленных шансов с фактом.
 *
 * Экран «Шансы» обещает игроку конкретные проценты. Если фактическое выпадение
 * расходится с ними, обещание — обман, даже если расхождение случайно.
 */
function distributionCheck(tariffId: TariffId, rolls: number): void {
  const state = createInitialState({ balance: 1_000_000_000 });
  const big: GameState = { ...state, slots: rolls + 10 };
  let current = big;
  const actual = Object.fromEntries(Object.keys(RARITIES).map((id) => [id, 0])) as Record<
    RarityId,
    number
  >;

  for (let index = 0; index < rolls; index += 1) {
    const result = release(current, {
      tariffId,
      countryId: 'ru',
      releaseId: `dist_${tariffId}_${index}`,
    });
    if (!result.ok) break;
    current = result.state;
    actual[current.numbers[0].rarity] += 1;
  }

  console.log(`\n═══ СВЕРКА ШАНСОВ · «${TARIFFS[tariffId].name}» · ${rolls} выпусков ═══\n`);

  // Сравнивать надо с тем, что игроку обещано С УЧЁТОМ УДАЧИ: экран «Шансы»
  // показывает именно её. Базовые шансы тарифа тут были бы неверной линейкой.
  const luck = activeLuck(current);
  const expected = distributionFor(tariffId, luck);
  console.log(`  действующая удача: ×${luck}\n`);
  console.log('  категория      обещано     факт      отклонение');

  let tooHigh = 0;

  for (const id of Object.keys(RARITIES).reverse() as RarityId[]) {
    const declared = expected[id];
    const observed = (actual[id] / rolls) * 100;
    // Для редких категорий абсолютное отклонение бессмысленно: считаем кратность.
    const relative = declared > 0 ? observed / declared : null;
    const flag = declared > 0 && (observed > declared * 1.6 || (declared > 0.5 && observed < declared * 0.5));
    if (flag) tooHigh += 1;
    console.log(
      `  ${RARITIES[id].name.padEnd(12)} ${declared.toFixed(4).padStart(8)} % ${observed
        .toFixed(4)
        .padStart(8)} % ${
        relative === null ? '        —' : `${relative.toFixed(2)}×`
      }${flag ? '  ←' : ''}`,
    );
  }

  const rarePlusDeclared =
    expected.rare + expected.epic + expected.legendary + expected.mythic;
  const rarePlusActual =
    ((actual.rare + actual.epic + actual.legendary + actual.mythic) / rolls) * 100;
  console.log(
    `\n  редкий и выше: обещано ${rarePlusDeclared.toFixed(2)} %, факт ${rarePlusActual.toFixed(
      2,
    )} %`,
  );
  console.log(
    tooHigh === 0
      ? '  ВЫВОД: обещанное совпадает с фактическим\n'
      : `  ВЫВОД: расходятся категорий — ${tooHigh}\n`,
  );
}

distributionCheck('standard', 6000);
distributionCheck('plus', 3000);
distributionCheck('premium', 2000);

console.log('\n═══ РЕГИОНЫ: СПРОС ═══\n');
const cheap = [...COUNTRIES].sort((a, b) => a.demand - b.demand).slice(0, 3);
const rich = [...COUNTRIES].sort((a, b) => b.demand - a.demand).slice(0, 3);
console.log(`  дешевле всех:  ${cheap.map((c) => `${c.name} ×${c.demand}`).join(', ')}`);
console.log(`  дороже всех:   ${rich.map((c) => `${c.name} ×${c.demand}`).join(', ')}`);
console.log(
  `  разброс: ${((rich[0].demand / cheap[0].demand - 1) * 100).toFixed(0)} % между крайними\n`,
);

void UPGRADES;
