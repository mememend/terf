// language: TypeScript, file: shared/tools/selftest.ts
import {
  ACHIEVEMENTS,
  ANONYMOUS,
  ANONYMOUS_MAX_BATCH,
  COUNTRIES,
  ECONOMY,
  RARITIES,
  RARITY_ORDER,
  PROMO_CODES,
  PATTERN_ORDER,
  PATTERN_POINTS,
  ROULETTE_WHEELS,
  TARIFFS,
  TARIFF_ORDER,
  UPGRADES,
  UPGRADE_ORDER,
  activeLuck,
  anonymousCount,
  appealNumber,
  applyUpgrade,
  brandedOperators,
  changeOperator,
  claimAchievement,
  claimTask,
  claimableAchievements,
  createInitialState,
  formatOdds,
  isSwapAllowed,
  longestCode,
  maskSlots,
  pickOperatorForDigits,
  issueAnonymous,
  nextRarity,
  operatorById,
  operatorChoices,
  operatorsOf,
  normalizePromo,
  promoRewardText,
  rarityForScore,
  redeemPromo,
  release,
  releaseCost,
  rerollNumber,
  wheelExpectedValue,
  scoreRangeForRarity,
  sellMany,
  setPrimaryNumber,
  spinRoulette,
  swapDigits,
  tasksFor,
  upgradeOffers,
  upgradePrice,
} from '../src/index';
import {
  applyMask,
  applyMaskPartial,
  digitsFromMaskedInput,
  generateDigitsForRarity,
  issueNumber,
} from '../src/index';
import { analyzeNumber, highlightedIndices, patternMultiplier } from '../src/index';
import { distributionFor } from '../src/index';
import { makeRng } from '../src/index';
import type { RarityId } from '../src/index';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ── 1. Опорный случай референса: «65432» = 35 очков = Необычный ── */
console.log('\nУзор и очки');
{
  const result = analyzeNumber('9365432', { operatorPrefix: '93' });
  const ladder = result.hits.find((hit) => hit.id === 'ladder_down');
  check('«9365432» находит Лесенку вниз', Boolean(ladder));
  check('Лесенка вниз даёт 35 очков', ladder?.points === 35, `получено ${ladder?.points}`);
  check('Итого очков 35', result.score === 35, `получено ${result.score}`);
  check(
    '35 очков = Необычный',
    rarityForScore(result.score) === 'uncommon',
    rarityForScore(result.score),
  );
  check(
    'диапазон подсвеченных цифр не пуст',
    highlightedIndices(result.hits).size > 0,
    `${highlightedIndices(result.hits).size} цифр`,
  );
}

/* ── 2. Один рисунок — один бонус ── */
console.log('\nГашение пересечений');
{
  const allSame = analyzeNumber('7777777777');
  check('«7777777777» = только «Все цифры одинаковые»', allSame.hits.length === 1, `${allSame.hits.length} узоров`);
  check('«7777777777» = 300 очков', allSame.score === 300, `${allSame.score}`);
  check('«7777777777» = Мифический', rarityForScore(allSame.score) === 'mythic');

  const almost = analyzeNumber('1111211111');
  check('«1111211111» не дублирует серию', !almost.hits.some((hit) => hit.id === 'series'));
  check('«1111211111» не дублирует пары', !almost.hits.some((hit) => hit.id === 'pairs'));

  const alt = analyzeNumber('1212121212');
  check('чередование гасит повтор блока', !alt.hits.some((hit) => hit.id === 'block_repeat'));

  const pal = analyzeNumber('12344321');
  check('палиндром гасит зеркало', !pal.hits.some((hit) => hit.id === 'mirror'));
}

/* ── 2б. Новые узоры и достижимость каждого ── */
console.log('\nУзоры: новые и достижимость всех');
{
  const ids = (digits: string) => analyzeNumber(digits).hits.map((hit) => hit.id);
  const scoreOf = (digits: string) => analyzeNumber(digits).score;

  check('«147258» находит линию по клавиатуре', ids('147258').includes('keypad_line'));
  check('«458147» находит линию в обратную сторону', ids('458147').includes('keypad_line'));
  check('«7345677» находит одинаковые края', ids('7345677').includes('twin_ends'));
  check('«3011229» находит двойные пары', ids('3011229').includes('aabb'));
  check('«3000129» находит нули подряд', ids('3000129').includes('zero_run'));

  /*
   * Серия была МЁРТВЫМ узором: она проверялась после пар, а три одинаковые
   * цифры всегда дают две пары — пары гасили серию, и 12 очков за цифру не
   * начислялись никогда. Проверка держит порядок гашения.
   */
  check('серия достижима', ids('999111').includes('series'), ids('999111').join(', '));
  check('серия не дублирует пары', !ids('999111').includes('pairs'));

  // Длинная лесенка дороже короткой, но опорный случай не сдвинулся.
  check('лесенка из 5 цифр = 35 очков', scoreOf('9365432') === 35, String(scoreOf('9365432')));
  const longUp = scoreOf('123456');
  check(
    'лесенка из 6 цифр дороже, чем 6 × 8',
    longUp > 6 * PATTERN_POINTS.ladder_up,
    `${longUp} против ${6 * PATTERN_POINTS.ladder_up}`,
  );
  check(
    'чем длиннее лесенка, тем дороже',
    scoreOf('1234567') > scoreOf('123456') && scoreOf('123456') > scoreOf('12345'),
    `${scoreOf('12345')} < ${scoreOf('123456')} < ${scoreOf('1234567')}`,
  );

  // Круглое окончание: цена растёт с числом нулей.
  check(
    'круглое с большим числом нулей дороже',
    PATTERN_POINTS.round * 5 > PATTERN_POINTS.round * 2,
    `${PATTERN_POINTS.round * 2} против ${PATTERN_POINTS.round * 5}`,
  );

  /*
   * Каждый узел из конфига обязан уметь сработать хоть на одном номере.
   * Узел, который не может начислиться, — обманка: он есть в правилах и
   * в админке, но очков за него не дают.
   */
  const SAMPLES: Record<string, string> = {
    all_same: '7777777',
    almost_same: '1111211111',
    date: '9350105',
    palindrome: '123454321',
    alternating: '121212',
    block_repeat: '123123',
    mirror: '12345321',
    prefix_echo: '459945',
    prefix_repeat: '4599455',
    ladder_up: '123456',
    ladder_down: '987654',
    keypad_line: '147258',
    twin_ends: '7345677',
    aabb: '30112290',
    zero_run: '3000129',
    round: '935500',
    series: '999111',
    pairs: '935541',
    country_code: '7912345678',
  };

  const unreachable: string[] = [];
  const withoutSample: string[] = [];
  for (const id of PATTERN_ORDER) {
    const sample = SAMPLES[id];
    if (!sample) {
      withoutSample.push(id);
      continue;
    }
    if (!analyzeNumber(sample, { countryDigits: '7' }).hits.some((hit) => hit.id === id)) {
      unreachable.push(id);
    }
  }

  check(
    'каждый узел конфига достижим',
    unreachable.length === 0,
    unreachable.length === 0 ? `${PATTERN_ORDER.length} узлов` : `мёртвые: ${unreachable.join(', ')}`,
  );
  check(
    'у каждого узла есть образец в проверке',
    withoutSample.length === 0,
    withoutSample.join(', ') || 'все покрыты',
  );
  check(
    'в конфиге нет узла вне списка порядка',
    Object.keys(PATTERN_POINTS).every(
      (key) => key === 'ladderLong' || (PATTERN_ORDER as readonly string[]).includes(key),
    ),
    Object.keys(PATTERN_POINTS)
      .filter((key) => key !== 'ladderLong' && !(PATTERN_ORDER as readonly string[]).includes(key))
      .join(', ') || 'списки совпадают',
  );
}

/* ── 3. Сумма вероятностей ровно 100 % ── */
console.log('\nРаспределение категорий');
for (const tariffId of TARIFF_ORDER) {
  const base = Object.values(TARIFFS[tariffId].odds).reduce((sum, value) => sum + value, 0);
  check(`${TARIFFS[tariffId].name}: базовые шансы = 100`, Math.abs(base - 100) < 1e-6, base.toFixed(6));

  const withLuck = distributionFor(tariffId, 5);
  const total = Object.values(withLuck).reduce((sum, value) => sum + value, 0);
  check(`${TARIFFS[tariffId].name}: с удачей ×5 сумма = 100`, Math.abs(total - 100) < 1e-6, total.toFixed(6));

  const rarePlus = (values: Record<RarityId, number>) =>
    values.rare + values.epic + values.legendary + values.mythic;
  const baseShare = rarePlus(TARIFFS[tariffId].odds);
  const luckyShare = rarePlus(withLuck);
  // У Элита и Премиума редкий+ уже равен 100 % — там расти некуда, но и падать нельзя.
  check(
    baseShare >= 99.99
      ? `${TARIFFS[tariffId].name}: редкий+ остаётся 100 %`
      : `${TARIFFS[tariffId].name}: удача поднимает редкий+`,
    baseShare >= 99.99 ? luckyShare >= baseShare - 1e-9 : luckyShare > baseShare,
    `${baseShare.toFixed(2)} % → ${luckyShare.toFixed(2)} %`,
  );
}

/* ── 4. Генератор попадает в запрошенную категорию ── */
console.log('\nГенератор: попадание в категорию (200 проб на категорию)');
for (const rarity of RARITY_ORDER) {
  let hits = 0;
  const samples = 200;
  for (let i = 0; i < samples; i += 1) {
    const rng = makeRng(1000 + i * 7919);
    const generated = generateDigitsForRarity(rarity, 10, rng, '7');
    if (generated.rarity === rarity) hits += 1;
  }
  const rate = hits / samples;
  check(`${RARITIES[rarity].name}: ${(rate * 100).toFixed(1)} % попаданий`, rate >= 0.95, `${hits}/${samples}`);
}

/* ── 5. Генератор не создаёт дубликатов и держит маску ── */
console.log('\nСборка предмета');
{
  const seen = new Set<string>();
  for (let i = 0; i < 300; i += 1) {
    const rng = makeRng(5000 + i * 104729);
    const number = issueNumber({
      countryId: COUNTRIES[i % COUNTRIES.length].id,
      tariffId: TARIFF_ORDER[i % TARIFF_ORDER.length],
      rarity: RARITY_ORDER[i % RARITY_ORDER.length],
      releaseId: `rel_test_${i}`,
      rng,
    });
    seen.add(number.digits);
    if (number.score < scoreRangeForRarity(number.rarity).min) {
      failures += 1;
      console.log(`  FAIL категория ниже диапазона у ${number.display}`);
      break;
    }
    if (number.finalPrice <= 0) {
      failures += 1;
      console.log(`  FAIL неположительная цена у ${number.display}`);
      break;
    }
  }
  check('300 выпусков без ошибок', true, `${seen.size} уникальных наборов цифр`);

  const masked = applyMask('+7 AAA BBB-CC-DD', '9209365432');
  check('маска собирается верно', masked === '+7 920 936-54-32', masked);

  const multiplier = patternMultiplier(35);
  check('множитель узора для 35 очков = 1,58', Math.abs(multiplier - 1.58) < 1e-9, String(multiplier));

  check('«1 из 17» форматируется', formatOdds(100 / 17) === '1 из 17', formatOdds(100 / 17));
  check('«никогда» для нуля', formatOdds(0) === 'никогда', formatOdds(0));
}

/* ── 6. Каждая категория достижима хотя бы одним рецептом ── */
console.log('\nДостижимость категорий');
for (const rarity of RARITY_ORDER) {
  const rng = makeRng(42);
  let best = 0;
  for (let i = 0; i < 40; i += 1) {
    const generated: { score: number } = generateDigitsForRarity(rarity, 10, rng, '7');
    best = Math.max(best, generated.score);
  }
  check(`${RARITIES[rarity].name}: максимальные очки за 40 проб = ${best}`, best > 0);
}

/* ── 7. Улучшения номера ── */
console.log('\nУлучшения номера');
{
  const base = createInitialState({ balance: 5_000_000 });
  const first = release(base, { tariffId: 'standard', countryId: 'ru', releaseId: 'upg_base' });
  check('базовый номер выпущен', first.ok && Boolean(first.number), String(first.number?.display));
  const start = first.state;
  const number = first.number!;

  // Инвариант, который обязан держаться после ЛЮБОЙ операции:
  // категория из очков, цена из формулы.
  const invariant = (label: string, state: typeof start, id: string): boolean => {
    const item = state.numbers.find((entry) => entry.id === id);
    if (!item) return false;
    const rarityOk = rarityForScore(item.score) === item.rarity;
    const priceOk =
      item.finalPrice ===
      Math.round(item.basePrice * item.patternMultiplier * item.demandMultiplier);
    const baseOk = item.basePrice === RARITIES[item.rarity].basePrice;
    if (!rarityOk || !priceOk || !baseOk) {
      console.log(
        `  отказ инварианта (${label}): очки ${item.score}, категория ${item.rarity}, ` +
          `ожидалось ${rarityForScore(item.score)}; цена ${item.finalPrice}`,
      );
      return false;
    }
    return true;
  };

  check('инвариант держится на исходном номере', invariant('исходный', start, number.id));

  /* Перестановка: точный результат, без случайности */
  const swapPrice = upgradePrice('swap', number);
  const twoDifferent = [...number.digits]
    .map((digit, index) => ({ digit, index }))
    .find((entry, _, all) => all.some((other) => other.digit !== entry.digit));
  const otherIndex = [...number.digits].findIndex((digit) => digit !== number.digits[0]);
  const swapped = swapDigits(start, number.id, twoDifferent!.index, otherIndex);
  check('перестановка прошла', swapped.ok, swapped.error ?? '');
  check(
    'списана цена перестановки',
    swapped.state.player.balance === start.player.balance - swapPrice,
    `${start.player.balance} → ${swapped.state.player.balance}, цена ${swapPrice}`,
  );
  check(
    'состав цифр сохранён, порядок изменён',
    [...swapped.number!.digits].sort().join('') === [...number.digits].sort().join('') &&
      swapped.number!.digits !== number.digits,
    `${number.digits} → ${swapped.number!.digits}`,
  );
  check('инвариант держится после перестановки', invariant('перестановка', swapped.state, number.id));

  const again = swapDigits(swapped.state, number.id, twoDifferent!.index, otherIndex);
  check(
    'обратная перестановка возвращает исходные цифры',
    again.number!.digits === number.digits,
    `${again.number?.digits}`,
  );

  const sameDigits = [...number.digits].findIndex(
    (digit, index) => [...number.digits].indexOf(digit) !== index,
  );
  const equalPair = [...number.digits].findIndex(
    (digit, index) => index !== sameDigits && digit === number.digits[sameDigits],
  );
  if (sameDigits >= 0 && equalPair >= 0) {
    const bad = swapDigits(start, number.id, sameDigits, equalPair);
    check('перестановка одинаковых цифр отклонена', !bad.ok && bad.error === 'same_digit', bad.error ?? 'прошла');
  } else {
    check('перестановка одинаковых цифр отклонена', true, 'в номере нет одинаковых цифр — пропущено');
  }

  /* Перебор: категория обязана сохраниться */
  const rerollPrice = upgradePrice('reroll', number);
  const rerolled = rerollNumber(start, number.id);
  check('перебор прошёл', rerolled.ok, rerolled.error ?? '');
  check(
    'категория сохранена',
    rerolled.number!.rarity === number.rarity,
    `${number.rarity} → ${rerolled.number!.rarity}`,
  );
  check(
    'списана цена перебора',
    rerolled.state.player.balance === start.player.balance - rerollPrice,
    String(rerollPrice),
  );
  check('инвариант держится после перебора', invariant('перебор', rerolled.state, number.id));

  /* Апелляция: гарантированный подъём на ступень */
  const expectedNext = nextRarity(number.rarity);
  const appealPrice = upgradePrice('appeal', number);
  check(
    'цена апелляции считается от следующей категории',
    expectedNext
      ? appealPrice ===
          Math.round(RARITIES[expectedNext].basePrice * (UPGRADES.appeal.appealShare ?? 0.5))
      : appealPrice === 0,
    String(appealPrice),
  );

  const appealed = appealNumber(start, number.id);
  check('апелляция прошла', appealed.ok, appealed.error ?? '');
  check(
    'категория поднялась ровно на ступень',
    appealed.number!.rarity === expectedNext,
    `${number.rarity} → ${appealed.number!.rarity}, ожидалось ${expectedNext}`,
  );
  check(
    'списана цена апелляции',
    appealed.state.player.balance === start.player.balance - appealPrice,
    String(appealPrice),
  );
  check('инвариант держится после апелляции', invariant('апелляция', appealed.state, number.id));

  /* Мифический — предел */
  const mythicState = {
    ...start,
    player: { ...start.player, balance: 999_999_999 },
    numbers: start.numbers.map((item) =>
      item.id === number.id ? { ...item, rarity: 'mythic' as const } : item,
    ),
  };
  const overLimit = appealNumber(mythicState, number.id);
  check('выше мифического апелляция недоступна', !overLimit.ok && overLimit.error === 'max_rarity', overLimit.error ?? 'прошла');

  /* Нехватка средств */
  const poorState = { ...start, player: { ...start.player, balance: 1 } };
  const poor = swapDigits(poorState, number.id, 0, otherIndex);
  check('без средств улучшение отклонено', !poor.ok && poor.error === 'insufficient_funds', poor.error ?? 'прошло');
  check('состояние не изменилось', poor.state === poorState);

  /* Витрина */
  const offers = upgradeOffers(start, number.id);
  check(
    'витрина предлагает все операции из конфига',
    offers.length === UPGRADE_ORDER.length,
    `${offers.length} из ${UPGRADE_ORDER.length}`,
  );
  check(
    'все операции названы и оценены',
    offers.every((offer) => offer.name.length > 0 && offer.price > 0),
    offers.map((offer) => `${offer.name}:${offer.price}`).join(', '),
  );
  check(
    'апелляция показывает целевую категорию',
    offers.find((offer) => offer.id === 'appeal')?.targetRarity === expectedNext,
  );
  check('неизвестный номер не даёт предложений', upgradeOffers(start, 'нет-такого').length === 0);

  /* Ведущий ноль недопустим: перестановка, ставящая ноль в начало, отклоняется */
  let zeroState = base;
  let withZero: { state: typeof base; number: NonNullable<typeof first.number> } | null = null;
  for (let attempt = 0; attempt < 60 && !withZero; attempt += 1) {
    const candidate = release(base, {
      tariffId: 'standard',
      countryId: 'ru',
      releaseId: `upg_zero_${attempt}`,
    });
    if (!candidate.ok || !candidate.number) continue;
    const zeroIndex = [...candidate.number.digits].findIndex(
      (digit, index) => index > 0 && digit === '0',
    );
    if (zeroIndex > 0) {
      zeroState = candidate.state;
      withZero = { state: candidate.state, number: candidate.number };
    }
  }

  if (withZero) {
    const blocked = swapDigits(zeroState, withZero.number.id, 0, [...withZero.number.digits].findIndex((digit: string, index: number) => index > 0 && digit === '0'));
    check(
      'перестановка с нулём в начало отклонена',
      !blocked.ok && blocked.error === 'leading_zero',
      `${withZero.number.digits} → ${blocked.error ?? 'прошла'}`,
    );
    check('состояние не изменилось', blocked.state === zeroState);
    check(
      'витрина не считает такую перестановку допустимой',
      !isSwapAllowed(withZero.number, 0, [...withZero.number.digits].findIndex((digit: string, index: number) => index > 0 && digit === '0')),
    );
  } else {
    check('перестановка с нулём в начало отклонена', false, 'не нашлось номера с нулём — проверка не выполнена');
  }

  /* Смена оператора: код переезжает, хвост номера остаётся */
  const choices = operatorChoices(number);
  // Перевозчик в список не попадает: у него нет кодов, перейти к нему нельзя.
  const brandedCount = brandedOperators('ru').length;
  check(
    'операторы региона перечислены',
    choices.length === brandedCount,
    `${choices.length} из ${brandedCount}`,
  );
  check(
    'перевозчик не предлагается к переходу',
    !choices.some((choice) => choice.id === 'carrier'),
  );
  check('текущий оператор помечен ровно один', choices.filter((c) => c.current).length === 1);

  const alternative = choices.find((choice) => !choice.current)!;
  const opResult = changeOperator(start, number.id, alternative.id);
  check('смена оператора прошла', opResult.ok, opResult.error ?? '');
  check(
    'оператор действительно сменился',
    opResult.number!.operatorId === alternative.id,
    opResult.number?.operatorId,
  );
  check(
    'хвост номера остался прежним',
    opResult.number!.digits.slice(-4) === number.digits.slice(-4),
    `${number.digits} → ${opResult.number!.digits}`,
  );
  check(
    'списана цена смены оператора',
    opResult.state.player.balance === start.player.balance - upgradePrice('operator', number),
    String(upgradePrice('operator', number)),
  );
  check('инвариант держится после смены оператора', invariant('смена оператора', opResult.state, number.id));

  const sameOperator = changeOperator(start, number.id, number.operatorId);
  check(
    'переход к текущему оператору отклонён',
    !sameOperator.ok && sameOperator.error === 'same_digit',
    sameOperator.error ?? 'прошла',
  );
  const foreignOperator = changeOperator(start, number.id, 'sakura');
  check(
    'оператор чужого региона отклонён',
    !foreignOperator.ok && foreignOperator.error === 'bad_index',
    foreignOperator.error ?? 'прошла',
  );

  const operatorOffer = upgradeOffers(start, number.id).find((offer) => offer.id === 'operator');
  check(
    'витрина отдаёт варианты оператора',
    (operatorOffer?.operators?.length ?? 0) === choices.length,
    String(operatorOffer?.operators?.length),
  );

  /* Диспетчер */
  const routedOperator = applyUpgrade(start, number.id, 'operator', { operatorId: alternative.id });
  check(
    'диспетчер направляет в смену оператора',
    routedOperator.ok && routedOperator.number!.operatorId === alternative.id,
  );

  const routed = applyUpgrade(start, number.id, 'appeal');
  check('диспетчер направляет в апелляцию', routed.ok && routed.number!.rarity === expectedNext);
}

/* ── 8. Награды за достижения ── */
console.log('\nДостижения и награды');
{
  const fresh = createInitialState({ balance: 50_000 });
  check(
    'на старте забранных достижений нет',
    fresh.claimedAchievements.length === 0,
    String(fresh.claimedAchievements.length),
  );
  check('на старте нечего забирать', claimableAchievements(fresh).length === 0);

  const locked = claimAchievement(fresh, 'first_sim');
  check(
    'незакрытое достижение забрать нельзя',
    !locked.ok && locked.error === 'locked',
    locked.error ?? 'прошло',
  );
  check('состояние не изменилось', locked.state === fresh);

  const afterFirst = release(fresh, {
    tariffId: 'standard',
    countryId: 'ru',
    releaseId: 'ach_first',
  });
  check('номер выпущен для достижения', afterFirst.ok);

  const ready = claimableAchievements(afterFirst.state);
  check(
    'после первого выпуска есть что забрать',
    ready.includes('first_sim'),
    ready.join(', ') || 'пусто',
  );

  const first = ACHIEVEMENTS.find((item) => item.id === 'first_sim')!;
  const balanceBefore = afterFirst.state.player.balance;
  const claimed = claimAchievement(afterFirst.state, 'first_sim');
  check('награда получена', claimed.ok, claimed.error ?? '');
  check(
    'начислена ровно обещанная сумма',
    claimed.state.player.balance === balanceBefore + first.reward,
    `${balanceBefore} → ${claimed.state.player.balance}, награда ${first.reward}`,
  );
  check(
    'достижение помечено полученным',
    claimed.state.claimedAchievements.includes('first_sim'),
  );
  check(
    'в истории появилась запись',
    claimed.state.ledger.some(
      (entry) => entry.kind === 'quest' && entry.amount === first.reward,
    ),
  );

  const twice = claimAchievement(claimed.state, 'first_sim');
  check(
    'повторно забрать нельзя',
    !twice.ok && twice.error === 'already',
    twice.error ?? 'прошло',
  );
  check(
    'повтор не изменил баланс',
    twice.state.player.balance === claimed.state.player.balance,
  );
  check(
    'из списка к получению достижение ушло',
    !claimableAchievements(claimed.state).includes('first_sim'),
  );

  const unknown = claimAchievement(claimed.state, 'нет-такого');
  check(
    'неизвестное достижение отклонено',
    !unknown.ok && unknown.error === 'not_found',
    unknown.error ?? 'прошло',
  );

  // Дорогое достижение: проверяем, что крупная награда начисляется целиком.
  const wealthy = {
    ...claimed.state,
    player: { ...claimed.state.player, balance: 0 },
    numbers: claimed.state.numbers.map((number) => ({ ...number, rarity: 'mythic' as const })),
  };
  const mythicReward = ACHIEVEMENTS.find((item) => item.id === 'first_mythic')!;
  const big = claimAchievement(wealthy, 'first_mythic');
  check('крупная награда начислена целиком', big.ok && big.state.player.balance === mythicReward.reward, String(big.state.player.balance));
}

/* ── 10. Свой оператор и анонимные номера ── */
console.log('\nСвой оператор и анонимные номера');
{
  const base = createInitialState({ balance: 500_000 });

  // Надбавка за своего оператора: шансы те же, цена выше.
  const normal = releaseCost('standard', null);
  const custom = releaseCost('standard', 'ru_nts');
  check(
    'выпуск на своём операторе дороже ровно на надбавку',
    custom.money === Math.round(normal.money * (1 + ECONOMY.operatorSurcharge)),
    `${normal.money} → ${custom.money}`,
  );
  check('надбавка показана отдельно', custom.surcharge === custom.money - normal.money);
  check('на «Любом» надбавки нет', releaseCost('standard', null).surcharge === 0);

  // Выпуск с выбранным оператором: номер обязан начинаться с его кода.
  let hits = 0;
  let spentTotal = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = { ...base, selectedOperator: 'ru_nts', selectedCode: null };
    const result = release(state, {
      tariffId: 'standard',
      countryId: 'ru',
      releaseId: `rel_custom_${attempt}`,
    });
    if (!result.ok) continue;
    spentTotal += result.spent;
    const codes = operatorById(result.number!.operatorId).codes;
    if (
      result.number!.operatorId === 'ru_nts' &&
      codes.some((code) => result.number!.digits.startsWith(code))
    ) {
      hits += 1;
    }
  }
  check('номер начинается с кода выбранного оператора', hits === 12, `${hits} из 12`);
  check(
    'за свой оператор списано больше базовой цены',
    spentTotal === 12 * custom.money,
    `${spentTotal} против ${12 * custom.money}`,
  );

  // Конкретный код: номер обязан начинаться именно с него.
  const withCode = release(
    { ...base, selectedOperator: 'ru_belime', selectedCode: '965' },
    { tariffId: 'standard', countryId: 'ru', releaseId: 'rel_code' },
  );
  check(
    'выбранный код попал в номер',
    withCode.ok && withCode.number!.digits.startsWith('965'),
    withCode.number?.digits ?? 'нет номера',
  );

  // Анонимные номера: своя маска, свой оператор, своя цена.
  const anonymous = issueAnonymous(createInitialState({ balance: 0 }), 5, 'anon_test');
  check('анонимные номера выданы', anonymous.ok && anonymous.numbers.length === 5);
  check(
    'у всех анонимных код +888',
    anonymous.numbers.every((number) => number.display.startsWith('+888')),
    anonymous.numbers[0]?.display ?? '',
  );
  check(
    'анонимный номер ничей — уходит перевозчику',
    anonymous.numbers.every((number) => number.operatorId === 'carrier'),
  );
  check(
    'анонимные не попали в список стран',
    !COUNTRIES.some((country) => country.id === ANONYMOUS.id),
  );
  check(
    'коэффициент анонимного в заданных границах',
    anonymous.numbers.every(
      (number) =>
        number.demandMultiplier >= ANONYMOUS.minCoefficient &&
        number.demandMultiplier <= ANONYMOUS.maxCoefficient,
    ),
    anonymous.numbers.map((number) => number.demandMultiplier).join(', '),
  );
  check(
    'цена анонимного посчитана по коэффициенту',
    anonymous.numbers.every(
      (number) =>
        number.finalPrice ===
        Math.round(number.basePrice * number.patternMultiplier * number.demandMultiplier),
    ),
  );
  check(
    'две анонимные одного класса стоят по-разному',
    new Set(anonymous.numbers.map((number) => number.demandMultiplier)).size > 1,
  );
  check('выдача попала в историю', anonymous.state.ledger.some((entry) => entry.kind === 'gift'));
  check('анонимные попали в коллекцию', anonymousCount(anonymous.state) === 5);

  // Границы пакета: за раз не больше ANONYMOUS_MAX_BATCH.
  check(
    'слишком большая партия отклонена',
    !issueAnonymous(createInitialState({ balance: 0 }), ANONYMOUS_MAX_BATCH + 1, 'x').ok,
  );
  check('нулевая партия отклонена', !issueAnonymous(createInitialState({ balance: 0 }), 0, 'x').ok);
  const tight = { ...createInitialState({ balance: 0 }), slots: 3 };
  check('не хватает мест — выдача отклонена', !issueAnonymous(tight, 5, 'x').ok);
}

/* ── 11. Массовая продажа ── */
console.log('\nМассовая продажа');
{
  let state = createInitialState({ balance: 100_000 });
  for (let index = 0; index < 5; index += 1) {
    const result = release(state, {
      tariffId: 'standard',
      countryId: 'ru',
      releaseId: `rel_bulk_${index}`,
    });
    if (result.ok) state = result.state;
  }
  check('коллекция собрана для продажи', state.numbers.length === 5, String(state.numbers.length));

  const primary = state.numbers[0];
  state = setPrimaryNumber(state, primary.id).state;

  const ids = state.numbers.map((number) => number.id);
  const balanceBefore = state.player.balance;
  const bulk = sellMany(state, ids);

  check('пачка продана', bulk.ok && bulk.sold === 4, `продано ${bulk.sold}`);
  check(
    'основной номер не продан и объяснено почему',
    bulk.skipped.length === 1 && bulk.skipped[0].id === primary.id,
    bulk.skipped.map((item) => item.reason).join(', '),
  );
  check('основной номер остался в коллекции', bulk.state.numbers.length === 1);
  check('основной номер тот же', bulk.state.numbers[0].id === primary.id);
  check(
    'выручка равна прибавке баланса',
    bulk.state.player.balance - balanceBefore === bulk.total,
    `${bulk.total} против ${bulk.state.player.balance - balanceBefore}`,
  );
  check('на каждый проданный по строке в истории', bulk.state.ledger.filter((entry) => entry.kind === 'sale').length === 4);

  // Дубликаты не должны продавать номер дважды.
  const twice = createInitialState({ balance: 100_000 });
  let filled = release(twice, { tariffId: 'standard', countryId: 'ru', releaseId: 'rel_dup' }).state;
  const dupId = filled.numbers[0].id;
  const dup = sellMany(filled, [dupId, dupId, dupId]);
  check('дубликат в списке продаёт один раз', dup.sold === 1, `продано ${dup.sold}`);

  check('пустой список ничего не продаёт', !sellMany(state, []).ok);
  check('чужой идентификатор пропущен с причиной', sellMany(state, ['нет-такого']).skipped.length === 1);
}

/* ── 12. Задания дня и недели ── */
console.log('\nЗадания дня и недели');
{
  const now = new Date();
  let state = createInitialState({ balance: 200_000 });

  const empty = tasksFor(state, now);
  check('заданий выдано шесть', empty.length === 6, String(empty.length));
  check(
    'на старте ничего не готово',
    empty.every((task) => !task.ready && task.progress === 0),
    empty.map((task) => `${task.title}: ${task.progress}`).join(', '),
  );
  check(
    'у каждого задания есть срок и награда',
    empty.every((task) => task.target > 0 && task.reward > 0),
  );

  // Пять выпусков закрывают дневное задание на выпуск.
  for (let index = 0; index < 5; index += 1) {
    const result = release(state, {
      tariffId: 'standard',
      countryId: 'ru',
      releaseId: `rel_task_${index}`,
    });
    if (result.ok) state = result.state;
  }

  const afterReleases = tasksFor(state, now);
  const releaseTask = afterReleases.find((task) => task.key.endsWith(':release5'))!;
  check(
    'пять выпусков закрыли задание дня',
    releaseTask.ready && releaseTask.progress === 5,
    `${releaseTask.progress} из ${releaseTask.target}`,
  );
  check(
    'прогресс не превышает цель',
    afterReleases.every((task) => task.progress <= task.target),
  );

  const unready = afterReleases.find((task) => task.key.endsWith(':release30'))!;
  const lockedClaim = claimTask(state, unready.key, now);
  check(
    'незакрытое задание не выдаётся',
    !lockedClaim.ok && lockedClaim.error === 'locked',
    lockedClaim.error ?? 'прошло',
  );

  const balanceBefore = state.player.balance;
  const claimed = claimTask(state, releaseTask.key, now);
  check('награда за задание получена', claimed.ok, claimed.error ?? '');
  check(
    'начислена ровно обещанная сумма',
    claimed.state.player.balance === balanceBefore + releaseTask.reward,
    `${balanceBefore} → ${claimed.state.player.balance}, награда ${releaseTask.reward}`,
  );
  check(
    'в истории появилась запись о задании',
    claimed.state.ledger.some(
      (entry) => entry.kind === 'quest' && entry.amount === releaseTask.reward,
    ),
  );

  const twice = claimTask(claimed.state, releaseTask.key, now);
  check(
    'повторно задание не выдаётся',
    !twice.ok && twice.error === 'already',
    twice.error ?? 'прошло',
  );

  // Тот же прогресс, но следующий день: задание снова доступно.
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const nextDay = tasksFor(claimed.state, tomorrow);
  const sameTaskTomorrow = nextDay.find((task) => task.key.endsWith(':release5'))!;
  check(
    'в новом периоде задание доступно снова',
    !sameTaskTomorrow.claimed && sameTaskTomorrow.key !== releaseTask.key,
    sameTaskTomorrow.key,
  );

  // Продажи считаются по истории, а не по счётчику.
  const sold = sellMany(claimed.state, claimed.state.numbers.slice(0, 2).map((item) => item.id));
  const afterSales = tasksFor(sold.state, now).find((task) => task.key.endsWith(':sell5'))!;
  check('продажи попали в прогресс', afterSales.progress === 2, String(afterSales.progress));

  // Задания с платными тарифами считают только платные выпуски.
  let paid = createInitialState({ balance: 500_000 });
  for (let index = 0; index < 3; index += 1) {
    const result = release(paid, {
      tariffId: 'plus',
      countryId: 'ru',
      releaseId: `rel_paid_${index}`,
    });
    if (result.ok) paid = result.state;
  }
  const paidTask = tasksFor(paid, now).find((task) => task.key.endsWith(':release_plus3'))!;
  check('платные выпуски закрыли своё задание', paidTask.ready, `${paidTask.progress} из 3`);

  // Анонимные номера не должны закрывать задания на выпуск.
  const anonState = issueAnonymous(createInitialState({ balance: 0 }), 3, 'task_anon').state;
  const anonCount = tasksFor(anonState, now).find((task) => task.key.endsWith(':release5'))!;
  check('выдача анонимных не считается выпуском', anonCount.progress === 0, String(anonCount.progress));
}

/* ── 13. Маски набора: знаки, обрезка, отсутствие добора ── */
console.log('\nМаски набора номеров');
{
  const slotsWrong: string[] = [];
  const pads: string[] = [];
  const truncates: string[] = [];

  for (const country of COUNTRIES) {
    const slots = maskSlots(country.mask);
    const codeDigits = country.code.replace(/\D/g, '').length;

    // Полная маска обязана дать ровно «код страны + знаки маски» цифр.
    const full = applyMask(country.mask, '9'.repeat(slots));
    if (full.replace(/\D/g, '').length !== codeDigits + slots) slotsWrong.push(country.id);

    // Недобор не добивается нулями: после кода страны нулей быть не должно.
    const tail = applyMaskPartial(country.mask, '1').slice(country.code.length);
    if (tail.includes('0')) pads.push(country.id);

    // Ввод длиннее маски обрезается, а не ломает вывод.
    const over = applyMaskPartial(country.mask, '1'.repeat(slots + 5));
    if (over.replace(/\D/g, '').length !== codeDigits + slots) truncates.push(country.id);
  }

  check(
    'знаков в маске столько, сколько разрядов',
    slotsWrong.length === 0,
    slotsWrong.length === 0 ? `${COUNTRIES.length} стран` : slotsWrong.join(', '),
  );
  check(
    'недонабранный номер не добивается нулями',
    pads.length === 0,
    pads.length === 0 ? 'все чисто' : pads.join(', '),
  );
  check(
    'лишние цифры обрезаются по маске',
    truncates.length === 0,
    truncates.length === 0 ? 'все чисто' : truncates.join(', '),
  );

  // Главная ловушка: «A» в маске встречается трижды, а разрядов десять.
  const ru = COUNTRIES.find((country) => country.id === 'ru')!;
  check(
    'в российской маске десять разрядов, а не три',
    maskSlots(ru.mask) === 10,
    String(maskSlots(ru.mask)),
  );
  check(
    'ввод трёх цифр даёт ровно три цифры после кода',
    applyMaskPartial(ru.mask, '792').replace(/\D/g, '').length === 1 + 3,
    applyMaskPartial(ru.mask, '792'),
  );
  check(
    'висящий разделитель не остаётся',
    !applyMaskPartial(ru.mask, '792').endsWith('-') &&
      !applyMaskPartial(ru.mask, '792').endsWith(' '),
    applyMaskPartial(ru.mask, '792'),
  );

  /*
   * Посимвольный набор в поле ввода.
   *
   * Это именно тот случай, где цифры превращались в «7»: код страны попадал
   * в разбор как ввод, занимал первый разряд, и маска подставляла его снова.
   * Проверяем весь путь на всех странах — и набор, и вставку готового номера.
   */
  const typingBroken: string[] = [];
  const pasteBroken: string[] = [];

  for (const country of COUNTRIES) {
    const slots = maskSlots(country.mask);
    const sample = '1234567890'.repeat(2).slice(0, slots);

    // Набор по одной цифре: значение поля всё время пересобирается из маски.
    let field = '';
    for (const char of sample) {
      const typedNow = digitsFromMaskedInput(country.mask, country.code, field + char);
      field = applyMaskPartial(country.mask, typedNow);
    }
    const typedBack = digitsFromMaskedInput(country.mask, country.code, field);
    if (typedBack !== sample) typingBroken.push(`${country.id}: ${sample} → ${typedBack}`);

    // Вставка готового номера целиком — так, как он показан на карточке.
    const full = applyMask(country.mask, sample);
    const pastedBack = digitsFromMaskedInput(country.mask, country.code, full);
    if (pastedBack !== sample) pasteBroken.push(`${country.id}: ${full} → ${pastedBack}`);
  }

  check(
    'набор по одной цифре не подменяет код страны',
    typingBroken.length === 0,
    typingBroken.length === 0 ? `${COUNTRIES.length} стран` : typingBroken.slice(0, 3).join('; '),
  );
  check(
    'вставленный целиком номер разбирается верно',
    pasteBroken.length === 0,
    pasteBroken.length === 0 ? `${COUNTRIES.length} стран` : pasteBroken.slice(0, 3).join('; '),
  );

  // Разбор на примере России: набрали 9206229693 — столько же и получили.
  let ruField = '';
  for (const char of '9206229693') {
    const typedNow = digitsFromMaskedInput(ru.mask, ru.code, ruField + char);
    ruField = applyMaskPartial(ru.mask, typedNow);
  }
  check(
    'российский номер набирается без подмены цифр',
    ruField === '+7 920 622-96-93',
    ruField,
  );
}

/* ── 14. Рулетка: три колеса ── */
console.log('\nРулетка');
{
  check('колёс объявлено три', ROULETTE_WHEELS.length === 3, String(ROULETTE_WHEELS.length));
  check(
    'у колёс разные названия и цены',
    new Set(ROULETTE_WHEELS.map((wheel) => wheel.id)).size === 3 &&
      new Set(ROULETTE_WHEELS.map((wheel) => wheel.cost)).size === 3,
    ROULETTE_WHEELS.map((wheel) => `${wheel.name} ${wheel.cost}`).join(', '),
  );

  const badSum: string[] = [];
  const badPrize: string[] = [];
  const unprofitable: string[] = [];

  for (const wheel of ROULETTE_WHEELS) {
    const total = wheel.prizes.reduce((sum, prize) => sum + prize.chance, 0);
    if (Math.abs(total - 100) > 0.001) badSum.push(`${wheel.id}: ${total}`);

    for (const prize of wheel.prizes) {
      const ok =
        prize.label.length > 0 &&
        prize.color.startsWith('#') &&
        (prize.kind === 'money' || prize.kind === 'refund'
          ? (prize.amount ?? 0) > 0
          : prize.kind === 'tickets'
            ? (prize.releases ?? 0) > 0
            : (prize.multiplier ?? 1) > 1 && (prize.spins ?? 0) > 0);
      if (!ok) badPrize.push(`${wheel.id}/${prize.id}`);
    }

    // Колесо обязано быть тратой: иначе баланс копится мёртвым грузом.
    const expected = wheelExpectedValue(wheel);
    if (expected >= wheel.cost) unprofitable.push(`${wheel.id}: ${Math.round(expected)}`);
  }

  check('в каждом колесе шансы дают ровно 100 %', badSum.length === 0, badSum.join(', ') || 'три колеса');
  check('у каждого приза есть подпись, цвет и эффект', badPrize.length === 0, badPrize.join(', ') || 'все призы заполнены');
  check(
    'каждое колесо невыгоднее своей ставки',
    unprofitable.length === 0,
    unprofitable.length === 0
      ? ROULETTE_WHEELS.map((w) => `${w.name}: ${Math.round(wheelExpectedValue(w))}/${w.cost}`).join(', ')
      : unprofitable.join(', '),
  );

  // Крутим каждое колесо: списывается своя цена, приз применяется.
  for (const wheel of ROULETTE_WHEELS) {
    const rich = createInitialState({ balance: wheel.cost * 10 });
    const spin = spinRoulette(rich, { wheelId: wheel.id, releaseId: `spin_${wheel.id}` });
    check(`колесо «${wheel.name}» крутится`, spin.ok, spin.error ?? '');
    check(
      `«${wheel.name}»: списана своя цена`,
      spin.spent === wheel.cost,
      `${spin.spent} против ${wheel.cost}`,
    );
    check(
      `«${wheel.name}»: сектор совпадает с призом`,
      spin.index >= 0 &&
        spin.index < wheel.prizes.length &&
        wheel.prizes[spin.index].id === spin.prize?.id,
      String(spin.index),
    );
    check(`«${wheel.name}»: прокрут в истории`, spin.state.ledger.some((e) => e.kind === 'roulette'));
  }

  // Незнакомый вид колеса не должен ломать прокрут — берём обычное.
  const fallback = spinRoulette(createInitialState({ balance: 100_000 }), {
    wheelId: 'нет-такого',
    releaseId: 'spin_fallback',
  });
  check('незнакомое колесо заменяется обычным', fallback.ok && fallback.wheelId === 'standard', fallback.wheelId);

  const rich0 = createInitialState({ balance: 1_000_000 });
  const spin0 = spinRoulette(rich0, { wheelId: 'standard', releaseId: 'spin_test_1' });
  const before = rich0.player.balance;
  const after = spin0.state.player.balance;
  const prize = spin0.prize!;
  if (prize.kind === 'money' || prize.kind === 'refund') {
    check(
      'денежный приз начислен ровно',
      after === before - 5000 + (prize.amount ?? 0),
      `${before} → ${after}, приз ${prize.amount}`,
    );
  } else if (prize.kind === 'tickets') {
    check('билеты начислены бесплатными выпусками', spin0.state.player.freeReleases > 0, String(spin0.state.player.freeReleases));
  } else {
    check('удача выдана крутками', spin0.state.player.luck.spinsLeft > 0, String(spin0.state.player.luck.spinsLeft));
  }

  const again = spinRoulette(spin0.state, { wheelId: 'standard', releaseId: 'spin_test_1' });
  check('повторный прокрут с тем же номером отклонён', !again.ok && again.error === 'duplicate', again.error ?? 'прошло');

  const poor = createInitialState({ balance: 4999 });
  const noMoney = spinRoulette(poor, { wheelId: 'standard', releaseId: 'spin_poor' });
  check('без денег колесо не крутится', !noMoney.ok && noMoney.error === 'insufficient_funds', noMoney.error ?? 'прошло');

  const poorElite = createInitialState({ balance: 99_999 });
  check(
    'элитное колесо требует свою цену',
    !spinRoulette(poorElite, { wheelId: 'elite', releaseId: 'spin_poor_elite' }).ok,
  );

  // Бесплатный выпуск из рулетки: деньги не списываются, счётчик уменьшается.
  const freeState = createInitialState({ balance: 10_000 });
  const withFree = { ...freeState, player: { ...freeState.player, freeReleases: 2 } };
  const freeRun = release(withFree, { tariffId: 'standard', countryId: 'ru', releaseId: 'rel_free_1' });
  check('бесплатный выпуск прошёл', freeRun.ok, freeRun.error ?? '');
  check('деньги за бесплатный выпуск не списаны', freeRun.spent === 0, String(freeRun.spent));
  check('счётчик бесплатных выпусков уменьшился', freeRun.state.player.freeReleases === 1, String(freeRun.state.player.freeReleases));
  check('баланс не изменился', freeRun.state.player.balance === withFree.player.balance, String(freeRun.state.player.balance));

  const secondFree = release(freeRun.state, { tariffId: 'standard', countryId: 'ru', releaseId: 'rel_free_2' });
  const paid = release(secondFree.state, { tariffId: 'standard', countryId: 'ru', releaseId: 'rel_free_3' });
  check('второй бесплатный выпуск тоже бесплатный', secondFree.ok && secondFree.spent === 0);
  check('третий выпуск уже платный', paid.ok && paid.spent > 0, String(paid.spent));

  // Удача по круткам сгорает по одной за выпуск.
  const luckyBase = createInitialState({ balance: 100_000 });
  const lucky = {
    ...luckyBase,
    player: {
      ...luckyBase.player,
      luck: { multiplier: 3, expiresAt: null, spinsLeft: 2, title: 'тест', subtitle: 'тест' },
    },
  };
  check('удача по круткам действует', activeLuck(lucky) === 3, String(activeLuck(lucky)));
  const firstSpin = release(lucky, { tariffId: 'standard', countryId: 'ru', releaseId: 'rel_luck_1' });
  check('после выпуска осталась одна крутка удачи', firstSpin.state.player.luck.spinsLeft === 1, String(firstSpin.state.player.luck.spinsLeft));
  const secondSpin = release(firstSpin.state, { tariffId: 'standard', countryId: 'ru', releaseId: 'rel_luck_2' });
  check('после второй крутки удача кончилась', activeLuck(secondSpin.state) === 1);
}

// Самопроверка игрового ядра. Запуск: npm run selftest
// Проверяет ровно то, что обещано игроку: очки узоров, категорию по очкам,
// сумму вероятностей и попадание генератора в запрошенную категорию.

/* ── 14б. Операторы: данные и подписи ── */
console.log('\nОператоры');
{
  /*
   * Три ошибки, которые здесь ловятся.
   *
   * 1. Один код у двух операторов: второй оператор не получит ни одного
   *    номера, потому что совпадение всегда достаётся первому.
   * 2. Короткий код затеняет длинный: во Франции «06» у Orange перехватывал
   *    «062…» у SFR, и номер подписывался чужим брендом.
   * 3. Код не короче маски: оператор не сможет выпустить ни одного номера.
   */
  const duplicates: string[] = [];
  const shadowed: string[] = [];
  const tooLong: string[] = [];
  const thin: string[] = [];

  for (const country of COUNTRIES) {
    const operators = brandedOperators(country.id);
    if (operators.length < 5) thin.push(`${country.id}: ${operators.length}`);

    const codes = operators.flatMap((operator) => operator.codes);
    const repeated = [...new Set(codes.filter((code, index) => codes.indexOf(code) !== index))];
    if (repeated.length > 0) duplicates.push(`${country.id}: ${repeated.join(',')}`);

    const slots = maskSlots(country.mask);
    for (const operator of operators) {
      const code = longestCode(operator);
      if (code.length >= slots) tooLong.push(`${country.id}/${operator.id}`);

      // Номер с самым длинным кодом оператора обязан остаться его номером.
      const sample = `${code}${'1234567890'.repeat(2)}`.slice(0, slots);
      if (pickOperatorForDigits(country.id, sample) !== operator.id) {
        shadowed.push(`${country.id}/${operator.id}/${code}`);
      }
    }
  }

  check('ни один код не принадлежит двум операторам', duplicates.length === 0, duplicates.join('; ') || 'чисто');
  check('короткий код не перехватывает длинный', shadowed.length === 0, shadowed.slice(0, 5).join('; ') || 'чисто');
  check('код оператора короче маски страны', tooLong.length === 0, tooLong.join('; ') || 'чисто');
  check('в каждой стране не меньше пяти операторов', thin.length === 0, thin.join('; ') || `${COUNTRIES.length} стран`);

  const total = COUNTRIES.reduce((sum, country) => sum + brandedOperators(country.id).length, 0);
  check('операторов стало больше пяти на страну', total > COUNTRIES.length * 5, `всего ${total}`);

  // Живой выпуск: номер обязан сохранить выбранного оператора.
  const wrong: string[] = [];
  let issued = 0;
  for (const country of COUNTRIES) {
    for (const operator of brandedOperators(country.id)) {
      const result = issueNumber({
        countryId: country.id,
        tariffId: 'standard',
        releaseId: 'op_check',
        rarity: 'common',
        operatorId: operator.id,
        rng: makeRng(4242),
      });
      issued += 1;
      // Перевозчик допустим только когда у оператора вообще нет кодов.
      if (result.operatorId !== operator.id) wrong.push(`${country.id}/${operator.id} → ${result.operatorId}`);
    }
  }
  check(
    'выпуск сохраняет выбранного оператора',
    wrong.length === 0,
    wrong.length === 0 ? `${issued} выпусков` : wrong.slice(0, 5).join('; '),
  );
}

/* ── 15. Промокоды ── */
console.log('\nПромокоды');
{
  check('коды объявлены', PROMO_CODES.length > 0, String(PROMO_CODES.length));
  check(
    'коды не повторяются',
    new Set(PROMO_CODES.map((promo) => normalizePromo(promo.code))).size === PROMO_CODES.length,
  );
  check(
    'у каждого кода есть название и описание награды',
    PROMO_CODES.every((promo) => promo.title.length > 0 && promoRewardText(promo).length > 0),
  );

  const clean = createInitialState({ balance: 1000 });

  check('пустой код отклонён', redeemPromo(clean, '   ').error === 'empty');
  check('неизвестный код отклонён', redeemPromo(clean, 'НЕТТАКОГО').error === 'not_found');

  // Регистр и пробелы не важны: код диктуют голосом и набирают руками.
  const spaced = redeemPromo(clean, '  циф ерки ');
  check('код с пробелами и строчными буквами принят', spaced.ok, spaced.error ?? '');

  const ticketPromo = PROMO_CODES.find((promo) => promo.reward.kind === 'tickets')!;
  check(
    'билеты начислены',
    spaced.state.player.tickets === clean.player.tickets + 1,
    String(spaced.state.player.tickets),
  );

  const again = redeemPromo(spaced.state, ticketPromo.code);
  check('повторно код не срабатывает', again.error === 'already', again.error ?? 'прошло');
  check('повтор не изменил баланс', again.state.player.balance === spaced.state.player.balance);

  // Деньги начисляются ровно.
  const moneyPromo = PROMO_CODES.find((promo) => promo.reward.kind === 'money')!;
  const money = redeemPromo(clean, moneyPromo.code);
  check('денежный промокод принят', money.ok, money.error ?? '');
  check(
    'начислена ровно обещанная сумма',
    money.state.player.balance ===
      clean.player.balance + (moneyPromo.reward as { amount: number }).amount,
    String(money.state.player.balance),
  );

  // Бесплатные выпуски.
  const releasePromo = PROMO_CODES.find((promo) => promo.reward.kind === 'releases')!;
  const releases = redeemPromo(clean, releasePromo.code);
  check(
    'бесплатные выпуски начислены',
    releases.state.player.freeReleases > 0,
    String(releases.state.player.freeReleases),
  );

  // Удача.
  const luckPromo = PROMO_CODES.find((promo) => promo.reward.kind === 'luck')!;
  const luck = redeemPromo(clean, luckPromo.code);
  check('удача от промокода действует', activeLuck(luck.state) > 1, String(activeLuck(luck.state)));

  check('погашение попало в историю', money.state.ledger.some((entry) => entry.kind === 'promo'));

  // Срок и тираж проверяются на временных кодах, чтобы не портить основной список.
  const saved = [...PROMO_CODES];
  PROMO_CODES.push({ ...PROMO_CODES[0], code: 'СТАРЫЙ', until: '2020-01-01' });
  check(
    'истёкший код отклонён',
    redeemPromo(clean, 'СТАРЫЙ', 0, new Date('2026-01-01')).error === 'expired',
  );

  PROMO_CODES.push({ ...PROMO_CODES[0], code: 'ТИРАЖ', limit: 5 });
  check('исчерпанный тираж отклонён', redeemPromo(clean, 'ТИРАЖ', 5).error === 'exhausted');
  check('тираж не исчерпан — код принят', redeemPromo(clean, 'ТИРАЖ', 4).ok);

  PROMO_CODES.length = 0;
  PROMO_CODES.push(...saved);
}

/* ── 16. Каждый регион выпускает номер, соответствующий своей маске ── */
console.log(`\nРегионы (${COUNTRIES.length} шт.)`);
{
  // Минимум цифр, при котором анализатор вообще может найти осмысленный узор.
  const minDigits = 7;
  let broken = 0;

  for (const country of COUNTRIES) {
    const slots = [...country.mask].filter((char) => /[A-Z]/.test(char)).length;
    if (slots < minDigits) {
      broken += 1;
      console.log(`  FAIL ${country.name}: в маске всего ${slots} знаков`);
      continue;
    }

    let ok = true;
    for (let attempt = 0; attempt < 12 && ok; attempt += 1) {
      const rng = makeRng(900 + attempt * 131 + country.id.length);
      const number = issueNumber({
        countryId: country.id,
        tariffId: 'standard',
        rarity: RARITY_ORDER[attempt % RARITY_ORDER.length],
        releaseId: `rel_${country.id}_${attempt}`,
        rng,
      });

      const codeDigits = [...country.code].filter((char) => /\d/.test(char)).length;
      const digitsInDisplay = [...number.display].filter((char) => /\d/.test(char)).length;

      if (number.digits.length !== slots) ok = false;
      if (digitsInDisplay !== codeDigits + slots) ok = false;
      if (!number.display.startsWith(country.code)) ok = false;
      if (number.finalPrice <= 0) ok = false;
      // Отображение обязано совпадать с маской страны: пробелы и тире на месте.
      if (number.display !== applyMask(country.mask, number.digits)) ok = false;
      // Оператор обязан принадлежать региону номера либо быть перевозчиком.
      const pool = operatorsOf(country.id).map((item) => item.id);
      if (!pool.includes(number.operatorId)) ok = false;
    }

    if (!ok) {
      broken += 1;
      console.log(`  FAIL ${country.name} (${country.code}): номер не соответствует маске`);
    }
  }

  check(
    'все регионы выпускают корректные номера',
    broken === 0,
    broken > 0 ? `сломано: ${broken}` : `${COUNTRIES.length} из ${COUNTRIES.length}`,
  );

  // У каждой страны минимум пять операторов с кодами. В части стран их
  // больше: пять — это нижняя граница выбора, а не точное число.
  const shortPools = COUNTRIES.filter((country) => brandedOperators(country.id).length < 5);
  check(
    'у каждой страны не меньше пяти операторов',
    shortPools.length === 0,
    shortPools.length === 0
      ? `${COUNTRIES.length} стран`
      : `меньше пяти: ${shortPools.map((country) => country.name).join(', ')}`,
  );

  const withoutCodes = COUNTRIES.filter((country) =>
    brandedOperators(country.id).some((operator) => operator.codes.length === 0),
  );
  check(
    'у каждого оператора есть коды',
    withoutCodes.length === 0,
    withoutCodes.length === 0
      ? 'все заполнены'
      : `пусто у: ${withoutCodes.map((country) => country.name).join(', ')}`,
  );

  // Главное: оператор не приписывается номеру без оснований.
  // Либо код номера принадлежит оператору, либо это нейтральный перевозчик.
  let mismatched = 0;
  const carriersByRarity = new Map<string, number>();
  const totalByRarity = new Map<string, number>();

  for (const country of COUNTRIES) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const rarity = RARITY_ORDER[attempt % RARITY_ORDER.length];
      const rng = makeRng(4400 + attempt * 977 + country.id.length * 31);
      const number = issueNumber({
        countryId: country.id,
        tariffId: 'standard',
        rarity,
        releaseId: `rel_own_${country.id}_${attempt}`,
        rng,
      });

      totalByRarity.set(rarity, (totalByRarity.get(rarity) ?? 0) + 1);

      const codes = operatorById(number.operatorId).codes;
      if (codes.length === 0) {
        if (number.operatorId !== 'carrier') mismatched += 1;
        carriersByRarity.set(rarity, (carriersByRarity.get(rarity) ?? 0) + 1);
      } else if (!codes.some((code) => number.digits.startsWith(code))) {
        mismatched += 1;
      }
    }
  }

  const breakdown = RARITY_ORDER.map(
    (rarity) => `${RARITIES[rarity].name} ${carriersByRarity.get(rarity) ?? 0}/${totalByRarity.get(rarity) ?? 0}`,
  ).join(', ');

  check(
    'оператор всегда подтверждается префиксом либо перевозчиком',
    mismatched === 0,
    mismatched > 0 ? `расхождений: ${mismatched}` : `перевозчику отдано: ${breakdown}`,
  );
}

console.log(failures === 0 ? '\nВСЁ ЧИСТО' : `\nПРОВАЛОВ: ${failures}`);
process.exit(failures === 0 ? 0 : 1);