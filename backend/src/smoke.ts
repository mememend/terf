// language: TypeScript, file: backend/src/smoke.ts
// Сквозная проверка сервера по HTTP. Поднимает собранный сервер на отдельном
// порту с хранилищем в памяти и проверяет то, что обещано игроку:
// идемпотентность выпуска, серверный расчёт категории и цены, права админа.

import {
  ECONOMY,
  RARITIES,
  RARITY_ORDER,
  TARIFFS,
  UPGRADE_ORDER,
  isSwapAllowed,
  rarityForScore,
} from '@ciferki/shared';
import type { RarityId } from '@ciferki/shared';

const PORT = Number(process.env.SMOKE_PORT ?? 8099);
const BASE = `http://127.0.0.1:${PORT}`;
const PLAYER = '555001';
const ADMIN = '777001';
const SECRET = process.env.BOT_INTERNAL_SECRET ?? 'smoke-internal-secret';
/** Какой драйвер хранилища ожидаем: memory для локального прогона, postgres для базы. */
const EXPECTED_DRIVER = process.env.SMOKE_EXPECT_DRIVER ?? 'memory';

let failures = 0;
const log: string[] = [];

function check(label: string, condition: boolean, detail = ''): void {
  const line = `${condition ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`;
  log.push(line);
  console.log(`  ${line}`);
  if (!condition) failures += 1;
}

interface CallResult {
  status: number;
  body: any;
}

async function call(
  path: string,
  options: { method?: string; user?: string; body?: unknown; botSecret?: string } = {},
): Promise<CallResult> {
  const headers: Record<string, string> = {};
  if (options.user) headers['X-Dev-User'] = options.user;
  if (options.botSecret) headers['X-Bot-Secret'] = options.botSecret;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function waitForServer(timeoutMs = 20_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return true;
    } catch {
      // Сервер ещё поднимается.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function run(): Promise<void> {
  console.log('\nСервер и доступ');
  const health = await call('/health');
  check('GET /health отвечает', health.status === 200, `код ${health.status}`);
  check(
    `хранилище: ${EXPECTED_DRIVER}`,
    health.body?.driver === EXPECTED_DRIVER,
    String(health.body?.driver),
  );

  const anonymous = await call('/api/state');
  check('без подписи — 401', anonymous.status === 401, `код ${anonymous.status}`);

  console.log('\nНачальное состояние');
  const initial = await call('/api/state', { user: PLAYER });
  check('GET /api/state отвечает', initial.status === 200, `код ${initial.status}`);
  check(
    'стартовый баланс',
    initial.body?.state?.player?.balance === ECONOMY.startingBalance,
    String(initial.body?.state?.player?.balance),
  );
  check('коллекция пуста', initial.body?.state?.numbers?.length === 0);

  const chances = await call('/api/chances', { user: PLAYER });
  const odds = chances.body?.odds ?? {};
  const oddsSum = Object.values(odds).reduce((sum: number, value) => sum + Number(value), 0);
  check('витрина шансов суммируется в 100 %', Math.abs(oddsSum - 100) < 1e-6, oddsSum.toFixed(6));

  console.log('\nВыпуск и идемпотентность');
  const releaseId = 'smoke-fixed-release-1';
  const first = await call('/api/release', {
    method: 'POST',
    user: PLAYER,
    body: { releaseId, tariffId: 'standard', countryId: 'ru' },
  });
  check('выпуск прошёл', first.status === 200 && first.body?.ok === true, `код ${first.status}`);
  const number = first.body?.number;
  check('номер получен', Boolean(number?.display), String(number?.display));
  check(
    'категория соответствует очкам узора',
    number && rarityForScore(number.score) === number.rarity,
    `очки ${number?.score}, категория ${number?.rarity}, ожидалось ${number && rarityForScore(number.score)}`,
  );
  const expectedPrice =
    number &&
    Math.round(number.basePrice * number.patternMultiplier * number.demandMultiplier);
  check(
    'цена посчитана по формуле',
    number && number.finalPrice === expectedPrice,
    `${number?.finalPrice} против ${expectedPrice}`,
  );
  check(
    'базовая цена взята из категории',
    number && number.basePrice === RARITIES[number.rarity as RarityId].basePrice,
    String(number?.basePrice),
  );
  const balanceAfterFirst = first.body?.balance;
  check(
    'списана стоимость тарифа',
    balanceAfterFirst === ECONOMY.startingBalance - TARIFFS.standard.price!,
    `${balanceAfterFirst}`,
  );

  const duplicate = await call('/api/release', {
    method: 'POST',
    user: PLAYER,
    body: { releaseId, tariffId: 'standard', countryId: 'ru' },
  });
  check('повтор того же releaseId отклонён', duplicate.status === 409, `код ${duplicate.status}`);
  const afterDuplicate = await call('/api/state', { user: PLAYER });
  check(
    'повторный запрос не списал валюту',
    afterDuplicate.body?.state?.player?.balance === balanceAfterFirst,
    `${afterDuplicate.body?.state?.player?.balance}`,
  );
  check(
    'повторный запрос не добавил номер',
    afterDuplicate.body?.state?.numbers?.length === 1,
    String(afterDuplicate.body?.state?.numbers?.length),
  );

  console.log('\nЭкономика');
  const second = await call('/api/release', {
    method: 'POST',
    user: PLAYER,
    body: { tariffId: 'plus', countryId: 'de' },
  });
  check('второй выпуск прошёл', second.status === 200, `код ${second.status}`);
  check(
    'списана стоимость тарифа Плюс',
    second.body?.balance === balanceAfterFirst - TARIFFS.plus.price!,
    String(second.body?.balance),
  );

  const soldId = second.body?.number?.id;
  const sell = await call('/api/sell', { method: 'POST', user: PLAYER, body: { numberId: soldId } });
  check('продажа прошла', sell.status === 200, `код ${sell.status}`);
  const afterSell = await call('/api/state', { user: PLAYER });
  check('номеров осталось один', afterSell.body?.state?.numbers?.length === 1, String(afterSell.body?.state?.numbers?.length));
  check(
    'повторная продажа того же номера отклонена',
    (await call('/api/sell', { method: 'POST', user: PLAYER, body: { numberId: soldId } })).status === 400,
  );

  console.log('\nЗамена цифры');
  const targetId = afterSell.body?.state?.numbers?.[0]?.id;
  const forecast = await call(`/api/digit/forecast?numberId=${targetId}&index=3`, { user: PLAYER });
  check('прогноз замены отвечает', forecast.status === 200, `код ${forecast.status}`);
  const change = await call('/api/digit', {
    method: 'POST',
    user: PLAYER,
    body: { numberId: targetId, index: 3 },
  });
  check('замена цифры прошла', change.status === 200, `код ${change.status}`);
  check(
    'цифра действительно изменилась',
    change.body?.number?.digits !== afterSell.body?.state?.numbers?.[0]?.digits,
    `${afterSell.body?.state?.numbers?.[0]?.digits} → ${change.body?.number?.digits}`,
  );
  check(
    'категория пересчитана по новым очкам',
    change.body?.number && rarityForScore(change.body.number.score) === change.body.number.rarity,
  );

  console.log('\nУлучшения номера');
  const upgradesMissing = await call('/api/upgrades', { user: PLAYER });
  check('витрина без номера отклонена', upgradesMissing.status === 400, `код ${upgradesMissing.status}`);

  const currentNumber = (await call('/api/state', { user: PLAYER })).body?.state?.numbers?.[0];
  const upgrades = await call(`/api/upgrades?numberId=${currentNumber.id}`, { user: PLAYER });
  check('витрина улучшений отвечает', upgrades.status === 200, `код ${upgrades.status}`);
  check(
    'предложены все операции из конфига',
    upgrades.body?.offers?.length === UPGRADE_ORDER.length,
    `${upgrades.body?.offers?.length} из ${UPGRADE_ORDER.length}`,
  );
  check(
    'у каждой операции есть цена и описание',
    (upgrades.body?.offers ?? []).every(
      (offer: any) => offer.price > 0 && typeof offer.description === 'string' && offer.description.length > 0,
    ),
  );

  const swapOffer = (upgrades.body?.offers ?? []).find((offer: any) => offer.id === 'swap');

  // Пару для перестановки выбираем проверкой, а не наугад: часть пар недопустима —
  // одинаковые цифры или ноль, встающий в начало номера.
  let swapPair: [number, number] | null = null;
  for (let a = 0; a < currentNumber.digits.length && !swapPair; a += 1) {
    for (let b = a + 1; b < currentNumber.digits.length && !swapPair; b += 1) {
      if (isSwapAllowed(currentNumber, a, b)) swapPair = [a, b];
    }
  }
  check('нашлась допустимая пара для перестановки', swapPair !== null, JSON.stringify(swapPair));

  const balanceBeforeUpgrade = (await call('/api/state', { user: PLAYER })).body?.state?.player?.balance;
  const swapResult = await call('/api/upgrade', {
    method: 'POST',
    user: PLAYER,
    body: { numberId: currentNumber.id, id: 'swap', a: swapPair?.[0], b: swapPair?.[1] },
  });
  check('перестановка через API прошла', swapResult.status === 200, `код ${swapResult.status}`);
  check(
    'списана цена перестановки',
    swapResult.body?.balance === balanceBeforeUpgrade - swapOffer.price,
    `${balanceBeforeUpgrade} → ${swapResult.body?.balance}, цена ${swapOffer?.price}`,
  );
  check(
    'состав цифр сохранён',
    [...String(swapResult.body?.number?.digits)].sort().join('') ===
      [...String(currentNumber.digits)].sort().join(''),
    `${currentNumber.digits} → ${swapResult.body?.number?.digits}`,
  );
  check(
    'категория пересчитана по очкам',
    rarityForScore(swapResult.body?.number?.score) === swapResult.body?.number?.rarity,
    `${swapResult.body?.number?.score} → ${swapResult.body?.number?.rarity}`,
  );

  // Цену перечитываем ПОСЛЕ перестановки: она изменила категорию, а вместе с ней
  // и стоимость апелляции. Читать её заранее — значит проверять удачу, а не логику.
  const upgradesAfterSwap = await call(`/api/upgrades?numberId=${currentNumber.id}`, {
    user: PLAYER,
  });
  const appealOffer = (upgradesAfterSwap.body?.offers ?? []).find(
    (offer: any) => offer.id === 'appeal',
  );
  const beforeAppeal = (await call('/api/state', { user: PLAYER })).body?.state?.numbers?.find(
    (item: any) => item.id === currentNumber.id,
  );
  const balanceBeforeAppeal = (await call('/api/state', { user: PLAYER })).body?.state?.player?.balance;
  const appealResult = await call('/api/upgrade', {
    method: 'POST',
    user: PLAYER,
    body: { numberId: currentNumber.id, id: 'appeal' },
  });

  // Апелляция может стоить дороже баланса — это нормальный отказ, а не сбой.
  // Проверяем обе ветки, а не подгоняем ожидание под случайную категорию.
  if (balanceBeforeAppeal >= appealOffer.price) {
    check('апелляция через API прошла', appealResult.status === 200, `код ${appealResult.status}`);
    check(
      'категория поднялась ровно на ступень',
      RARITY_ORDER.indexOf(appealResult.body?.number?.rarity) ===
        RARITY_ORDER.indexOf(beforeAppeal.rarity) + 1,
      `${beforeAppeal.rarity} → ${appealResult.body?.number?.rarity}`,
    );
    check(
      'списана цена апелляции',
      appealResult.body?.balance === balanceBeforeAppeal - appealOffer.price,
      `${balanceBeforeAppeal} → ${appealResult.body?.balance}, цена ${appealOffer.price}`,
    );
  } else {
    check(
      'дорогая апелляция отклонена из-за нехватки средств',
      appealResult.status === 400 && appealResult.body?.error === 'insufficient_funds',
      `категория ${beforeAppeal.rarity}, баланс ${balanceBeforeAppeal}, цена ${appealOffer.price}, ответ ${appealResult.body?.error}`,
    );
    check(
      'баланс не тронут',
      (await call('/api/state', { user: PLAYER })).body?.state?.player?.balance ===
        balanceBeforeAppeal,
    );
  }

  console.log('\nСмена оператора');
  const afterSwapNumber = (await call('/api/state', { user: PLAYER })).body?.state?.numbers?.find(
    (item: any) => item.id === currentNumber.id,
  );
  const operatorOffer = (upgradesAfterSwap.body?.offers ?? []).find(
    (offer: any) => offer.id === 'operator',
  );
  check(
    'витрина отдаёт варианты оператора',
    (operatorOffer?.operators?.length ?? 0) >= 2,
    String(operatorOffer?.operators?.length),
  );
  const visibleOperators: any[] = operatorOffer?.operators ?? [];
  check(
    'перевозчик не предлагается к переходу',
    !visibleOperators.some((choice) => choice.id === 'carrier'),
    visibleOperators.map((choice) => choice.id).join(', '),
  );
  // Если номер сейчас у перевозчика, ничей префикс не «текущий» — и это верно:
  // перейти можно к любому оператору региона.
  check(
    'текущий оператор помечен не более одного раза',
    visibleOperators.filter((choice) => choice.current).length <= 1,
    String(visibleOperators.filter((choice) => choice.current).length),
  );

  const targetOperator = (operatorOffer?.operators ?? []).find((choice: any) => !choice.current);
  const balanceBeforeOperator = (await call('/api/state', { user: PLAYER })).body?.state?.player?.balance;
  const operatorResult = await call('/api/upgrade', {
    method: 'POST',
    user: PLAYER,
    body: { numberId: currentNumber.id, id: 'operator', operatorId: targetOperator.id },
  });
  check('смена оператора через API прошла', operatorResult.status === 200, `код ${operatorResult.status}`);
  check(
    'оператор действительно сменился',
    operatorResult.body?.number?.operatorId === targetOperator.id,
    `${afterSwapNumber.operatorId} → ${operatorResult.body?.number?.operatorId}`,
  );
  check(
    'хвост номера сохранён',
    String(operatorResult.body?.number?.digits).slice(-4) === String(afterSwapNumber.digits).slice(-4),
    `${afterSwapNumber.digits} → ${operatorResult.body?.number?.digits}`,
  );
  check(
    'списана цена смены оператора',
    operatorResult.body?.balance === balanceBeforeOperator - operatorOffer.price,
    `${balanceBeforeOperator} → ${operatorResult.body?.balance}, цена ${operatorOffer?.price}`,
  );

  const foreignOperator = await call('/api/upgrade', {
    method: 'POST',
    user: PLAYER,
    body: { numberId: currentNumber.id, id: 'operator', operatorId: 'sakura' },
  });
  check(
    'оператор чужого региона отклонён',
    foreignOperator.status === 400,
    `код ${foreignOperator.status}`,
  );

  const sameOperator = await call('/api/upgrade', {
    method: 'POST',
    user: PLAYER,
    body: { numberId: currentNumber.id, id: 'operator', operatorId: targetOperator.id },
  });
  check(
    'переход к текущему оператору отклонён',
    sameOperator.status === 400,
    `код ${sameOperator.status}`,
  );

  const unknownUpgrade = await call('/api/upgrade', {
    method: 'POST',
    user: PLAYER,
    body: { numberId: currentNumber.id, id: 'телепорт' },
  });
  check('неизвестная операция отклонена', unknownUpgrade.status === 400, `код ${unknownUpgrade.status}`);

  const sameDigitSwap = await call('/api/upgrade', {
    method: 'POST',
    user: PLAYER,
    body: { numberId: currentNumber.id, id: 'swap', a: 1, b: 1 },
  });
  check('перестановка цифры с самой собой отклонена', sameDigitSwap.status === 400, `код ${sameDigitSwap.status}`);

  console.log('\nЕжедневная награда');
  const dailyFirst = await call('/api/daily', { method: 'POST', user: PLAYER });
  check('награда дня начислена', dailyFirst.status === 200, `код ${dailyFirst.status}`);
  const dailyAgain = await call('/api/daily', { method: 'POST', user: PLAYER });
  check('повторная награда отклонена', dailyAgain.status === 400, `код ${dailyAgain.status}`);

  console.log('\nПрава администратора');
  const forbidden = await call('/api/admin/stats', { user: PLAYER });
  check('обычному игроку админка закрыта', forbidden.status === 403, `код ${forbidden.status}`);
  const adminStats = await call('/api/admin/stats', { user: ADMIN });
  check('администратору админка открыта', adminStats.status === 200, `код ${adminStats.status}`);
  check('статистика содержит игроков', (adminStats.body?.players ?? 0) >= 2, String(adminStats.body?.players));

  const badOdds = await call('/api/admin/config', {
    method: 'PUT',
    user: ADMIN,
    body: { key: 'tariff.standard.odds', value: { mythic: 1, legendary: 1, epic: 1, rare: 1, uncommon: 1, common: 1 } },
  });
  check('битые вероятности отклонены', badOdds.status === 400, `код ${badOdds.status}`);

  const goodOdds = await call('/api/admin/config', {
    method: 'PUT',
    user: ADMIN,
    body: { key: 'tariff.standard.odds', value: { mythic: 0.001, legendary: 0.01, epic: 1, rare: 7, uncommon: 25, common: 66.989 } },
  });
  check('корректные вероятности приняты', goodOdds.status === 200, `код ${goodOdds.status}`);

  const unknownKey = await call('/api/admin/config', {
    method: 'PUT',
    user: ADMIN,
    body: { key: 'player.balance', value: 999_999_999 },
  });
  check('неизвестный ключ отклонён', unknownKey.status === 400, `код ${unknownKey.status}`);

  console.log('\nАдминка влияет на игру');
  const configBefore = await call('/api/admin/config', { user: ADMIN });
  check(
    'панель отдаёт действующие параметры',
    configBefore.status === 200 && Boolean(configBefore.body?.current?.tariffPrice),
    `код ${configBefore.status}`,
  );
  check('панель отдаёт базовые значения', Boolean(configBefore.body?.base?.tariffPrice));
  check(
    'панель отдаёт список узоров',
    Array.isArray(configBefore.body?.patterns) && configBefore.body.patterns.length > 10,
  );

  const basePremium = Number(configBefore.body?.base?.tariffPrice?.premium);
  check(
    'базовая цена Премиума известна',
    basePremium === TARIFFS.premium.price,
    `${basePremium} против ${TARIFFS.premium.price}`,
  );

  const setPrice = await call('/api/admin/config', {
    method: 'PUT',
    user: ADMIN,
    body: { key: 'tariff.premium.price', value: 12345 },
  });
  check('цена тарифа изменена', setPrice.status === 200, `код ${setPrice.status}`);

  const balanceBefore = (await call('/api/state', { user: PLAYER })).body?.state?.player?.balance;
  const premiumRelease = await call('/api/release', {
    method: 'POST',
    user: PLAYER,
    body: { tariffId: 'premium', countryId: 'ru' },
  });
  check('выпуск по новой цене прошёл', premiumRelease.status === 200, `код ${premiumRelease.status}`);
  check(
    'списана именно новая цена — правка дошла до выпуска',
    premiumRelease.body?.balance === balanceBefore - 12345,
    `${balanceBefore} → ${premiumRelease.body?.balance}, ожидалось ${balanceBefore - 12345}`,
  );

  const resetPrice = await call('/api/admin/config/tariff.premium.price', {
    method: 'DELETE',
    user: ADMIN,
  });
  check('переопределение снято', resetPrice.status === 200, `код ${resetPrice.status}`);
  const configAfter = await call('/api/admin/config', { user: ADMIN });
  check(
    'цена вернулась к базовой',
    Number(configAfter.body?.current?.tariffPrice?.premium) === basePremium,
    String(configAfter.body?.current?.tariffPrice?.premium),
  );

  const chancesBefore = await call('/api/chances?tariffId=standard', { user: PLAYER });
  const oddsOverride = await call('/api/admin/config', {
    method: 'PUT',
    user: ADMIN,
    body: {
      key: 'tariff.standard.odds',
      value: { mythic: 1, legendary: 4, epic: 20, rare: 30, uncommon: 25, common: 20 },
    },
  });
  check('вероятности изменены', oddsOverride.status === 200, `код ${oddsOverride.status}`);

  const chancesAfter = await call('/api/chances?tariffId=standard', { user: PLAYER });
  check(
    'витрина шансов пересчиталась — правка дошла до распределения',
    Number(chancesAfter.body?.odds?.rare) > Number(chancesBefore.body?.odds?.rare),
    `${chancesBefore.body?.odds?.rare} → ${chancesAfter.body?.odds?.rare}`,
  );
  const oddsSumAfterEdit = Object.values(chancesAfter.body?.odds ?? {}).reduce(
    (sum: number, value) => sum + Number(value),
    0,
  );
  check(
    'сумма после правки всё ещё 100 %',
    Math.abs(oddsSumAfterEdit - 100) < 1e-6,
    oddsSumAfterEdit.toFixed(6),
  );

  const cleanOdds = await call('/api/admin/config/tariff.standard.odds', {
    method: 'DELETE',
    user: ADMIN,
  });
  check('вероятности возвращены к базовым', cleanOdds.status === 200, `код ${cleanOdds.status}`);

  const forbiddenDelete = await call('/api/admin/config/tariff.premium.price', {
    method: 'DELETE',
    user: PLAYER,
  });
  check(
    'обычному игроку снятие переопределения закрыто',
    forbiddenDelete.status === 403,
    `код ${forbiddenDelete.status}`,
  );

  console.log('\nФлаг администратора в состоянии');
  const adminState = await call('/api/state', { user: ADMIN });
  check('администратор видит флаг', adminState.body?.isAdmin === true, String(adminState.body?.isAdmin));
  const playerState = await call('/api/state', { user: PLAYER });
  check('обычный игрок флага не получает', playerState.body?.isAdmin === false, String(playerState.body?.isAdmin));

  console.log('\nДостижения и награды');
  const quests = await call('/api/quests', { user: PLAYER });
  check('сводка заданий отвечает', quests.status === 200, `код ${quests.status}`);
  check(
    'в сводке перечислены достижения с наградой',
    Array.isArray(quests.body?.achievements) &&
      quests.body.achievements.length > 0 &&
      quests.body.achievements.every((item: any) => item.reward > 0),
    String(quests.body?.achievements?.length),
  );

  const lockedClaim = await call('/api/achievement', {
    method: 'POST',
    user: PLAYER,
    body: { id: 'first_mythic' },
  });
  check('незакрытое достижение не выдаётся', lockedClaim.status === 400, `код ${lockedClaim.status}`);

  const unknownClaim = await call('/api/achievement', {
    method: 'POST',
    user: PLAYER,
    body: { id: 'нет-такого' },
  });
  check('неизвестное достижение отклонено', unknownClaim.status === 400, `код ${unknownClaim.status}`);

  const firstSim = (quests.body?.achievements ?? []).find((item: any) => item.id === 'first_sim');
  check('первый выпуск закрыт и не забран', firstSim?.unlocked === true && firstSim?.claimed === false);

  const balanceBeforeClaim = (await call('/api/state', { user: PLAYER })).body?.state?.player?.balance;
  const claimedQuest = await call('/api/achievement', {
    method: 'POST',
    user: PLAYER,
    body: { id: 'first_sim' },
  });
  check('награда за достижение получена', claimedQuest.status === 200, `код ${claimedQuest.status}`);
  check(
    'начислена ровно обещанная сумма',
    claimedQuest.body?.balance === balanceBeforeClaim + firstSim.reward,
    `${balanceBeforeClaim} → ${claimedQuest.body?.balance}, награда ${firstSim?.reward}`,
  );
  check(
    'повторно награда не выдаётся',
    (await call('/api/achievement', { method: 'POST', user: PLAYER, body: { id: 'first_sim' } }))
      .status === 400,
  );

  console.log('\nПроверка номера');
  const ownNumber = (await call('/api/state', { user: PLAYER })).body?.state?.numbers?.[0];
  if (ownNumber) {
    const exact = await call(`/api/check?number=${ownNumber.digits}`, { user: PLAYER });
    check('свой номер по цифрам найден', exact.body?.free === false, String(exact.body?.free));

    // Главный случай: игрок вставляет номер так, как он показан — с кодом,
    // скобками и дефисами. В коллекции он лежит без кода страны.
    const pasted = await call(
      `/api/check?number=${encodeURIComponent(ownNumber.display)}`,
      { user: PLAYER },
    );
    check(
      'вставленный из карточки номер тоже найден',
      pasted.body?.free === false,
      `${ownNumber.display} → свободен: ${pasted.body?.free}`,
    );
    check(
      'вариантов написания перебрано несколько',
      (pasted.body?.checked ?? 0) > 1,
      String(pasted.body?.checked),
    );
  }

  const freeNumber = await call('/api/check?number=99900011223', { user: PLAYER });
  check('несуществующий номер свободен', freeNumber.body?.free === true);

  const shortNumber = await call('/api/check?number=123', { user: PLAYER });
  check('слишком короткий запрос отклонён', shortNumber.status === 400, `код ${shortNumber.status}`);

  console.log('\nМассовая продажа');
  const bulkState = (await call('/api/state', { user: PLAYER })).body?.state;
  const bulkIds: string[] = (bulkState?.numbers ?? [])
    .filter((number: any) => number.id !== bulkState?.player?.primaryNumberId)
    .slice(0, 3)
    .map((number: any) => number.id);
  const primaryId = bulkState?.player?.primaryNumberId;

  check('есть что продавать пачкой', bulkIds.length > 0, String(bulkIds.length));

  const emptyBatch = await call('/api/sell-batch', { method: 'POST', user: PLAYER, body: { ids: [] } });
  check('пустой список отклонён', emptyBatch.status === 400, `код ${emptyBatch.status}`);

  const balanceBeforeBatch = bulkState?.player?.balance ?? 0;
  const batch = await call('/api/sell-batch', { method: 'POST', user: PLAYER, body: { ids: bulkIds } });
  check('пачка продана через API', batch.status === 200, `код ${batch.status}`);
  check(
    'продано столько же, сколько просили',
    batch.body?.sold === bulkIds.length,
    `${batch.body?.sold} из ${bulkIds.length}`,
  );
  check(
    'выручка совпала с прибавкой баланса',
    ((await call('/api/state', { user: PLAYER })).body?.state?.player?.balance ?? 0) ===
      balanceBeforeBatch + (batch.body?.total ?? 0),
  );

  if (primaryId) {
    const lockedBatch = await call('/api/sell-batch', {
      method: 'POST',
      user: PLAYER,
      body: { ids: [primaryId] },
    });
    check(
      'основной номер продать нельзя и причина названа',
      lockedBatch.body?.sold === 0 && lockedBatch.body?.skipped?.[0]?.reason === 'locked',
      String(lockedBatch.body?.skipped?.[0]?.reason),
    );
  }

  console.log('\nАнонимные номера');
  const notAdminAnon = await call('/api/admin/anonymous', {
    method: 'POST',
    user: PLAYER,
    body: { count: 1 },
  });
  check('обычному игроку анонимные не выдаются', notAdminAnon.status === 403, `код ${notAdminAnon.status}`);

  const tooMany = await call('/api/admin/anonymous', {
    method: 'POST',
    user: ADMIN,
    body: { count: 99 },
  });
  check('слишком большая партия отклонена', tooMany.status === 400, `код ${tooMany.status}`);

  const beforeAnon = (await call('/api/state', { user: ADMIN })).body?.state?.numbers?.length ?? 0;
  const gave = await call('/api/admin/anonymous', {
    method: 'POST',
    user: ADMIN,
    body: { count: 2 },
  });
  check('администратор получил анонимные', gave.status === 200, `код ${gave.status}`);
  check(
    'выдано ровно два с кодом +888',
    (gave.body?.numbers ?? []).length === 2 &&
      gave.body.numbers.every((item: any) => item.display.startsWith('+888')),
    String(gave.body?.numbers?.[0]?.display),
  );
  check(
    'выдача бесплатна — коллекция выросла на два',
    ((await call('/api/state', { user: ADMIN })).body?.state?.numbers?.length ?? 0) ===
      beforeAnon + 2,
  );

  console.log('\nВнутренний маршрут бота');
  const noSecret = await call('/internal/profile', {
    method: 'POST',
    body: { telegramId: Number(PLAYER) },
  });
  check('без секрета закрыто', noSecret.status === 401, `код ${noSecret.status}`);

  const wrongSecret = await call('/internal/profile', {
    method: 'POST',
    botSecret: 'wrong-secret-value',
    body: { telegramId: Number(PLAYER) },
  });
  check('с неверным секретом закрыто', wrongSecret.status === 401, `код ${wrongSecret.status}`);

  const existing = await call('/internal/profile', {
    method: 'POST',
    botSecret: SECRET,
    body: { telegramId: Number(PLAYER) },
  });
  check('профиль играющего отдаётся', existing.status === 200, `код ${existing.status}`);
  check(
    'в профиле есть уровень и коллекция',
    typeof existing.body?.profile?.level === 'number' &&
      typeof existing.body?.profile?.numbers === 'number',
    JSON.stringify(existing.body?.profile),
  );

  const stranger = await call('/internal/profile', {
    method: 'POST',
    botSecret: SECRET,
    body: { telegramId: 999_888_777 },
  });
  check(
    'незнакомец не создаётся и получает пустой ответ',
    stranger.status === 200 && stranger.body?.profile === null,
    JSON.stringify(stranger.body),
  );

  console.log('\nОграничение частоты');
  const burst: number[] = [];
  for (let i = 0; i < 60; i += 1) {
    const attempt = await call('/api/release', {
      method: 'POST',
      user: PLAYER,
      body: { tariffId: 'standard', countryId: 'ru' },
    });
    burst.push(attempt.status);
    if (attempt.status === 429) break;
  }
  check('флуд выпусками ограничен', burst.includes(429), `статусы: ${[...new Set(burst)].join(', ')}`);
}

async function main(): Promise<void> {
  const ready = await waitForServer();
  if (!ready) {
    console.error('Сервер не поднялся — проверка невозможна');
    process.exit(1);
  }
  await run();

  console.log(failures === 0 ? '\nСКВОЗНАЯ ПРОВЕРКА ПРОЙДЕНА' : `\nПРОВАЛОВ: ${failures}`);
  // Код выставляем, но process.exit() не зовём: жёсткий выход обрывает
  // недописанный stdout и на Windows роняет рантайм ассертом libuv.
  process.exitCode = failures === 0 ? 0 : 1;
}

process.on('uncaughtException', (error) => {
  console.error('\n[smoke] необработанное исключение:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('\n[smoke] необработанный отказ:', reason);
  process.exit(1);
});

void main();
