// language: TypeScript, file: backend/src/routes/admin.ts
// Админ-панель. Доступ только по ADMIN_TELEGRAM_IDS после проверки подписи.
// Каждое значение проверяется до записи: битые вероятности сломали бы экономику.

import { Router } from 'express';
import {
  ANONYMOUS_MAX_BATCH,
  COUNTRIES,
  PATTERN_POINTS,
  RARITIES,
  TARIFFS,
  baseConfigValues,
  brandedOperators,
  issueAnonymous,
} from '@ciferki/shared';
import type { RarityId } from '@ciferki/shared';
import { asyncHandler, badRequest } from '../middleware/errors.ts';
import { requireAdmin, requirePlayer } from '../middleware/auth.ts';
import type { Repository } from '../repository/types.ts';
import { reloadConfig } from '../services/config-service.ts';
import type { GameService } from '../services/game-service.ts';

type Validator = (value: unknown) => { ok: true; value: unknown } | { ok: false; reason: string };

const RARITY_IDS = Object.keys(RARITIES) as RarityId[];

const probabilitySet: Validator = (value) => {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, reason: 'ожидался объект с вероятностями по категориям' };
  }
  const draft = value as Record<string, unknown>;
  let sum = 0;
  for (const rarity of RARITY_IDS) {
    const item = draft[rarity];
    if (typeof item !== 'number' || !Number.isFinite(item) || item < 0) {
      return { ok: false, reason: `вероятность «${rarity}» должна быть неотрицательным числом` };
    }
    sum += item;
  }
  // Сумма взаимоисключающих исходов обязана быть ровно 100 %.
  if (Math.abs(sum - 100) > 0.001) {
    return { ok: false, reason: `сумма вероятностей должна быть 100 %, получено ${sum}` };
  }
  return { ok: true, value: Object.fromEntries(RARITY_IDS.map((r) => [r, draft[r]])) };
};

const positiveMoney: Validator = (value) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return { ok: false, reason: 'цена должна быть целым положительным числом' };
  }
  if (value > 100_000_000) return { ok: false, reason: 'цена выше разумного предела' };
  return { ok: true, value };
};

const demandFactor: Validator = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 10) {
    return { ok: false, reason: 'множитель спроса должен быть в пределах от 0 до 10' };
  }
  return { ok: true, value: Math.round(value * 100) / 100 };
};

const nonNegativeInteger: Validator = (value) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return { ok: false, reason: 'очки должны быть целым неотрицательным числом' };
  }
  return { ok: true, value };
};

/** Реестр допустимых ключей. Всё, чего здесь нет, записать нельзя. */
function validatorFor(key: string): { validate: Validator; describe: string } | null {
  if (key.startsWith('tariff.') && key.endsWith('.price')) {
    const tariffId = key.slice('tariff.'.length, -'.price'.length);
    if (tariffId in TARIFFS) {
      return { validate: positiveMoney, describe: `Цена тарифа «${tariffId}»` };
    }
  }
  if (key.startsWith('tariff.') && key.endsWith('.odds')) {
    const tariffId = key.slice('tariff.'.length, -'.odds'.length);
    if (tariffId in TARIFFS) {
      return { validate: probabilitySet, describe: `Вероятности тарифа «${tariffId}»` };
    }
  }
  if (key.startsWith('pattern.')) {
    const patternId = key.slice('pattern.'.length);
    if (patternId in PATTERN_POINTS) {
      return { validate: nonNegativeInteger, describe: `Очки узора «${patternId}»` };
    }
  }
  if (key.startsWith('region.')) {
    const regionId = key.slice('region.'.length);
    if (COUNTRIES.some((country) => country.id === regionId)) {
      return { validate: demandFactor, describe: `Спрос региона «${regionId}»` };
    }
  }
  const rarityMatch = /^rarity\.([a-z]+)\.basePrice$/.exec(key);
  if (rarityMatch) {
    const rarityId = rarityMatch[1];
    if (rarityId in RARITIES) {
      return { validate: positiveMoney, describe: `Базовая цена категории «${rarityId}»` };
    }
  }
  return null;
}

export function createAdminRouter(repo: Repository, service: GameService): Router {
  const router = Router();
  router.use(requirePlayer, requireAdmin);

  /**
   * Текущие параметры: базовые значения, переопределения и то, что реально
   * действует сейчас. Панель показывает разницу, а не только цифры.
   */
  router.get(
    '/config',
    asyncHandler(async (_req, res) => {
      res.json({
        overrides: await repo.getConfigOverrides(),
        base: baseConfigValues(),
        current: {
          tariffPrice: Object.fromEntries(
            Object.entries(TARIFFS).map(([id, tariff]) => [id, tariff.price]),
          ),
          tariffOdds: Object.fromEntries(
            Object.entries(TARIFFS).map(([id, tariff]) => [id, tariff.odds]),
          ),
          patternPoints: { ...PATTERN_POINTS },
          regionDemand: Object.fromEntries(
            COUNTRIES.map((country) => [country.id, country.demand]),
          ),
          rarityBasePrice: Object.fromEntries(
            Object.entries(RARITIES).map(([id, rarity]) => [id, rarity.basePrice]),
          ),
        },
        tariffs: Object.entries(TARIFFS).map(([id, tariff]) => ({
          id,
          name: tariff.name,
          price: tariff.price,
          ticketCost: tariff.ticketCost,
          odds: tariff.odds,
        })),
        patterns: Object.entries(PATTERN_POINTS).map(([id, points]) => ({ id, points })),
        regions: COUNTRIES.map((country) => ({
          id: country.id,
          name: country.name,
          // Флаг показываем вместо идентификатора: «ru» игроку ничего не говорит.
          flag: country.flag,
          code: country.code,
          demand: country.demand,
          operators: brandedOperators(country.id).length,
        })),
        rarities: Object.entries(RARITIES).map(([id, rarity]) => ({
          id,
          name: rarity.name,
          basePrice: rarity.basePrice,
        })),
      });
    }),
  );

  /**
   * Изменение параметра. Ключ и значение проверяются до записи, после записи
   * конфиг немедленно перечитывается — правка действует без перезапуска.
   */
  router.put(
    '/config',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const key = typeof body.key === 'string' ? body.key : '';
      const rule = validatorFor(key);
      if (!rule) {
        badRequest(res, 'unknown_key');
        return;
      }
      const checked = rule.validate(body.value);
      if (!checked.ok) {
        res.status(400).json({ error: 'invalid_value', reason: checked.reason });
        return;
      }

      await repo.setConfigOverride(key, checked.value, req.player!.id);
      const report = await reloadConfig(repo);
      res.json({ ok: true, key, value: checked.value, applied: report.applied });
    }),
  );

  /** Снятие переопределения: параметр возвращается к базовому значению. */
  router.delete(
    '/config/:key',
    asyncHandler(async (req, res) => {
      const key = req.params.key;
      if (!validatorFor(key)) {
        badRequest(res, 'unknown_key');
        return;
      }
      await repo.clearConfigOverride(key, req.player!.id);
      await reloadConfig(repo);
      res.json({ ok: true, key });
    }),
  );

  /* ─────────────────────────── ПРОМОКОДЫ ─────────────────────────── */

  /** Список кодов: зашитые в игру и созданные здесь. */
  router.get(
    '/promos',
    asyncHandler(async (_req, res) => {
      res.json(await service.listPromos());
    }),
  );

  /**
   * Создать промокод.
   *
   * Код латиницей и без обязательных заглавных: сравнение идёт без учёта
   * регистра, так что набирать его с телефона удобно. Допустимы буквы, цифры,
   * дефис и подчёркивание.
   */
  router.post(
    '/promos',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const code = typeof body.code === 'string' ? body.code : '';
      const kind = typeof body.kind === 'string' ? body.kind : 'money';
      const amount = Number(body.amount ?? 0);
      const limitRaw = body.limit;
      const untilRaw = body.until;

      const result = await service.createPromo({
        code,
        title: typeof body.title === 'string' ? body.title : '',
        note: typeof body.note === 'string' ? body.note : '',
        kind: ['money', 'tickets', 'releases', 'luck'].includes(kind) ? kind : 'money',
        amount: Number.isFinite(amount) ? amount : 0,
        limit:
          limitRaw === null || limitRaw === undefined || limitRaw === ''
            ? null
            : Number(limitRaw),
        until: typeof untilRaw === 'string' && untilRaw.length >= 10 ? untilRaw.slice(0, 10) : null,
      });

      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  router.delete(
    '/promos/:code',
    asyncHandler(async (req, res) => {
      const result = await service.deletePromo(String(req.params.code));
      res.status(result.ok ? 200 : 404).json(result);
    }),
  );

  /**
   * Выдать себе анонимные номера +888.
   *
   * Инструмент проверки: анонимный номер нельзя выпустить обычным путём — у него
   * нет страны и оператора. Выдача бесплатная и попадает в историю отдельной
   * строкой, чтобы в коллекции не появлялось номеров «из ниоткуда».
   */
  router.post(
    '/anonymous',
    asyncHandler(async (req, res) => {
      const raw = (req.body as Record<string, unknown>).count;
      const count = raw === undefined ? 1 : Number(raw);
      if (!Number.isFinite(count) || count < 1 || count > ANONYMOUS_MAX_BATCH) {
        res.status(400).json({ error: 'bad_count', max: ANONYMOUS_MAX_BATCH });
        return;
      }

      const outcome = await repo.mutate(req.player!.id, (state) => {
        const issued = issueAnonymous(state, Math.floor(count));
        return {
          state: issued.state,
          value: {
            ok: issued.ok,
            error: issued.error,
            numbers: issued.numbers.map((number) => ({
              id: number.id,
              display: number.display,
              rarity: number.rarity,
              score: number.score,
              finalPrice: number.finalPrice,
            })),
          },
        };
      });

      res.status(outcome.value.ok ? 200 : 400).json(outcome.value);
    }),
  );

  router.get(
    '/stats',
    asyncHandler(async (_req, res) => {
      res.json(await repo.stats());
    }),
  );

  /** Журнал: ошибки сервера и действия администраторов. */
  router.get(
    '/audit',
    asyncHandler(async (_req, res) => {
      const stats = await repo.stats();
      res.json({ entries: stats.recentAudit });
    }),
  );

  return router;
}
