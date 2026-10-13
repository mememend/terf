// language: TypeScript, file: frontend/tools/selftest.ts
// Проверки фронтенда.
//
// Раньше экраны проверялись только типами и сборкой: ошибку в логике
// компилятор не видит. Здесь — чистые функции, которые решают, что показать.
//
// Запуск: npm --workspace frontend run selftest

import { readFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { RARITY_ORDER, ROULETTE_WHEELS, createInitialState, release } from '@ciferki/shared';
import { effectOf } from '../src/utils/prize';
import type { GameState, PhoneNumber, RarityId } from '@ciferki/shared';
import { IMPLEMENTED, REDIRECT, resolveRoute, SOON_SCREENS } from '../src/routes';
import type { View } from '../src/routes';
import { MENU_TARGETS, SOON_TARGETS, isSoon } from '../src/components/MenuDrawer';
import { applyFilters } from '../src/screens/CollectionScreen';

let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

/* ── 1. Ни один пункт меню не ведёт в пустоту ── */
console.log('\nМаршруты меню');
{
  const empty: string[] = [];
  const undescribed: string[] = [];

  for (const target of MENU_TARGETS) {
    const route = resolveRoute(target as View);
    if (route.kind === 'view') {
      if (!route.view) empty.push(target);
      continue;
    }
    if (route.kind === 'overlay') continue;
    // Заглушка обязана быть с названием и описанием, иначе это тот же чёрный экран.
    if (!route.soon?.title || !route.soon?.note) undescribed.push(target);
  }

  check(
    'каждый пункт меню куда-то ведёт',
    empty.length === 0,
    empty.length === 0 ? `${MENU_TARGETS.length} пунктов` : `в пустоту: ${empty.join(', ')}`,
  );
  check(
    'у каждой заглушки есть название и описание',
    undescribed.length === 0,
    undescribed.length === 0 ? 'все описаны' : `без текста: ${undescribed.join(', ')}`,
  );
}

/* ── 2. Экраны и перенаправления согласованы ── */
console.log('\nСогласованность экранов');
{
  check(
    'перенаправление ведёт на существующий экран',
    Object.values(REDIRECT).every((target) => IMPLEMENTED.includes(target as View)),
    Object.entries(REDIRECT)
      .map(([from, to]) => `${from} → ${to}`)
      .join(', '),
  );
  check(
    'один и тот же экран не открывается двумя путями',
    new Set(IMPLEMENTED).size === IMPLEMENTED.length,
    String(IMPLEMENTED.length),
  );
  check(
    '«Шансы» открываются окном, а не экраном',
    resolveRoute('chances' as View).kind === 'overlay',
  );
  check(
    '«Достижения» ведут на экран заданий',
    resolveRoute('achievements' as View).view === 'quests',
  );
  check(
    'неизвестный раздел получает заглушку, а не пустоту',
    resolveRoute('которого-нет' as View).kind === 'soon',
  );
  check(
    'заглушки не пустые',
    Object.keys(SOON_SCREENS).length > 0,
    String(Object.keys(SOON_SCREENS).length),
  );
  // Проверка номера — рабочий экран, а не заглушка: её ищут в меню.
  check(
    '«Проверка номера» открывается экраном',
    resolveRoute('checker' as View).kind === 'view' &&
      resolveRoute('checker' as View).view === 'checker',
  );
  check(
    '«Проверка номера» есть в списке пунктов меню',
    MENU_TARGETS.includes('checker'),
  );

  /*
   * Пункт меню не может одновременно быть готовым экраном и помеченным
   * «скоро». Именно так рулетка осталась серой плиткой уже после того, как
   * экран был сделан: флаг в разметке и список экранов жили порознь.
   */
  const contradictory = SOON_TARGETS.filter((target) => IMPLEMENTED.includes(target));
  check(
    'готовый экран не помечен «скоро»',
    contradictory.length === 0,
    contradictory.length === 0 ? `${SOON_TARGETS.length} разделов ждут` : contradictory.join(', '),
  );
  check(
    'все «скоро» есть среди пунктов меню',
    SOON_TARGETS.every((target) => MENU_TARGETS.includes(target)),
    SOON_TARGETS.join(', '),
  );
  check(
    'у каждого «скоро» есть описание раздела',
    SOON_TARGETS.every((target) => Boolean(SOON_SCREENS[target as View])),
    SOON_TARGETS.filter((target) => !SOON_SCREENS[target as View]).join(', ') || 'все описаны',
  );
  check('рулетка — готовый экран, а не заглушка', !isSoon('roulette'));
  check(
    'переход на рулетку ведёт на экран, а не на главную',
    resolveRoute('roulette' as View).kind === 'view' &&
      resolveRoute('roulette' as View).view === 'roulette',
  );

  /*
   * Список экранов обязан быть ОДИН.
   *
   * Рулетка сломалась именно так: экран сделали, а в App.tsx осталась своя
   * копия списка, где её не было. Переход считал раздел заглушкой и выбрасывал
   * игрока на главную. Тест не даёт завести вторую копию снова.
   */
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const duplicateList = ['const IMPLEMENTED', 'const SOON_SCREENS', 'const REDIRECT'].filter(
    (needle) => appSource.includes(needle),
  );
  check(
    'в App.tsx нет своей копии списка экранов',
    duplicateList.length === 0,
    duplicateList.length === 0 ? 'источник один — routes.ts' : duplicateList.join(', '),
  );

  /*
   * Экран, который App рисует, обязан быть в списке готовых.
   *
   * Промокод сломался именно так: разметка и отрисовка появились, а в
   * IMPLEMENTED его не добавили — переход считал раздел заглушкой и отправлял
   * на главную. Проверка «готовый не помечен скоро» этого не ловит: там обе
   * стороны были согласованно неправы.
   */
  const rendered = [...appSource.matchAll(/view === '([a-z]+)'/g)].map((match) => match[1]);
  const unlisted = [...new Set(rendered)].filter(
    (view) => view !== 'number' && !(IMPLEMENTED as string[]).includes(view),
  );
  check(
    'каждый нарисованный экран есть в списке готовых',
    unlisted.length === 0,
    unlisted.length === 0
      ? `${new Set(rendered).size} экранов нарисовано`
      : `не в списке: ${unlisted.join(', ')}`,
  );

  check(
    'рулетка и промокод открываются экраном',
    (['roulette', 'promo'] as View[]).every(
      (view) => resolveRoute(view).kind === 'view' && resolveRoute(view).view === view,
    ),
  );

  /*
   * У каждого экрана свой цвет-акцент. Если класс забыть, экран останется
   * с зелёным по умолчанию — не сломается, но выпадет из общего вида.
   * Проверка читает разметку экранов и требует класс у каждого.
   */
  const screenFiles = [
    'App.tsx',
    'screens/HomeScreen.tsx',
    'screens/CollectionScreen.tsx',
    'screens/NumberScreen.tsx',
    'screens/InfoScreens.tsx',
    'screens/AdminScreen.tsx',
    'screens/RouletteScreen.tsx',
    'screens/PromoScreen.tsx',
  ];

  let roots = 0;
  const noAccent: string[] = [];
  for (const file of screenFiles) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    const matches = [...source.matchAll(/<div className="app([^"]*)"/g)];
    for (const match of matches) {
      roots += 1;
      if (!match[1].includes('app--')) noAccent.push(file);
    }
  }

  check(
    'у каждого экрана свой цвет-акцент',
    noAccent.length === 0,
    noAccent.length === 0 ? `${roots} корней экранов` : noAccent.join(', '),
  );
}

/* ── 3. Фильтры коллекции ── */
console.log('\nФильтры коллекции');
{
  let state: GameState = createInitialState({ balance: 1_000_000 });
  const issued: PhoneNumber[] = [];
  for (const country of ['ru', 'us', 'de', 'ru', 'us']) {
    const result = release(state, {
      tariffId: 'standard',
      countryId: country,
      releaseId: `filter_${issued.length}`,
    });
    if (result.ok) {
      state = result.state;
      issued.push(state.numbers[0]);
    }
  }

  const base = { sort: 'new', country: null, rarity: null, query: '' } as const;

  check(
    'без фильтров видны все номера',
    applyFilters(state, { ...base }).length === state.numbers.length,
    `${applyFilters(state, { ...base }).length} из ${state.numbers.length}`,
  );

  const russian = applyFilters(state, { ...base, country: 'ru' });
  check(
    'фильтр по стране оставляет только её номера',
    russian.length > 0 && russian.every((number) => number.countryId === 'ru'),
    String(russian.length),
  );

  const firstRarity = issued[0].rarity;
  const byRarity = applyFilters(state, { ...base, rarity: firstRarity as RarityId });
  check(
    'фильтр по категории оставляет только её',
    byRarity.every((number) => number.rarity === firstRarity),
    `${byRarity.length} шт.`,
  );

  const digits = issued[0].digits.slice(-4);
  const byQuery = applyFilters(state, { ...base, query: digits });
  check(
    'поиск по цифрам находит номер',
    byQuery.some((number) => number.digits.includes(digits)),
    `искали ${digits}`,
  );

  check(
    'поиск по несуществующим цифрам ничего не находит',
    applyFilters(state, { ...base, query: '00000000000' }).length === 0,
  );

  check(
    'пустой запрос не режет список',
    applyFilters(state, { ...base, query: '   ' }).length === state.numbers.length,
  );

  const byPrice = applyFilters(state, { ...base, sort: 'price' });
  const descending = byPrice.every(
    (number, index) => index === 0 || byPrice[index - 1].finalPrice >= number.finalPrice,
  );
  check('сортировка по цене идёт по убыванию', descending, `${byPrice.length} шт.`);

  const both = applyFilters(state, { ...base, country: 'ru', rarity: firstRarity as RarityId });
  check(
    'фильтры складываются, а не заменяют друг друга',
    both.length <= russian.length &&
      both.every((number) => number.countryId === 'ru' && number.rarity === firstRarity),
    `${both.length} шт.`,
  );
}

/* ── 4. Подписи призов рулетки ── */
console.log('\nПодписи призов');
{
  /*
   * В подписи под выпавшим призом печаталось «удача ×undefined на undefined
   * крутки»: сервер отдавал приз без полей эффекта, а экран брал их из ответа.
   * Проверяем, что для КАЖДОГО приза всех колёс подпись осмысленная.
   */
  const broken: string[] = [];
  for (const wheel of ROULETTE_WHEELS) {
    for (const prize of wheel.prizes) {
      const text = effectOf(prize);
      if (text.includes('undefined') || text.includes('NaN') || text.length < 4) {
        broken.push(`${wheel.id}/${prize.id}: ${text}`);
      }
    }
  }
  check(
    'в подписи приза нет undefined',
    broken.length === 0,
    broken.length === 0
      ? `${ROULETTE_WHEELS.reduce((sum, w) => sum + w.prizes.length, 0)} призов`
      : broken.slice(0, 3).join('; '),
  );

  // Приз без полей эффекта не должен превращаться в «undefined».
  const trimmed = { ...ROULETTE_WHEELS[0].prizes[8], multiplier: undefined, spins: undefined };
  check(
    'приз без полей описывается словами, а не undefined',
    !effectOf(trimmed as never).includes('undefined'),
    effectOf(trimmed as never),
  );
}

/* ── 5. Категории ── */
console.log('\nКатегории');
{
  const state = createInitialState({ balance: 0 });
  check('в состоянии шесть категорий', RARITY_ORDER.length === 6, RARITY_ORDER.join(', '));
  check('состояние начинается без номеров', state.numbers.length === 0);
}

console.log('');
if (failures > 0) {
  console.log(`ПРОВАЛОВ: ${failures}`);
  process.exitCode = 1;
} else {
  console.log('ПРОВЕРКИ ФРОНТЕНДА ПРОЙДЕНЫ');
}
