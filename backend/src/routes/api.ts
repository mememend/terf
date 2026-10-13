// language: TypeScript, file: backend/src/routes/api.ts
// Игровое API. Клиент присылает намерение, сервер возвращает результат.
// Ни одно поле, влияющее на баланс или выпадение, от клиента не принимается.

import { Router } from 'express';
import { COUNTRIES, TARIFFS, UPGRADE_ORDER, tasksFor } from '@ciferki/shared';
import type { TariffId, UpgradeId } from '@ciferki/shared';
import type { Env } from '../env.ts';
import { asyncHandler } from '../middleware/errors.ts';
import { createRateLimiter } from '../middleware/rate-limit.ts';
import { requirePlayer } from '../middleware/auth.ts';
import type { Repository } from '../repository/types.ts';
import type { GameService } from '../services/game-service.ts';

const TARIFF_IDS = Object.keys(TARIFFS) as TariffId[];
const UPGRADE_IDS = UPGRADE_ORDER as string[];

const isTariff = (value: unknown): value is TariffId =>
  typeof value === 'string' && TARIFF_IDS.includes(value as TariffId);

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null;

/**
 * Все написания, которыми может быть записан один и тот же номер.
 *
 * Игрок вставляет «+7 985 268-55-16», в базе лежит «9852685516». Чтобы не
 * зависеть от того, с кодом страны номер или без, проверяем оба варианта.
 */
function digitCandidates(digits: string): string[] {
  const set = new Set<string>([digits]);
  for (const country of COUNTRIES) {
    const code = country.code.replace(/\D/g, '');
    if (code.length === 0) continue;
    if (digits.startsWith(code) && digits.length > code.length) {
      set.add(digits.slice(code.length));
    }
    if (!digits.startsWith(code)) set.add(code + digits);
  }
  // Восьмёрка в начале — привычная запись российского номера вместо семёрки.
  if (digits.startsWith('8') && digits.length === 11) set.add(`7${digits.slice(1)}`);
  if (digits.startsWith('7') && digits.length === 11) set.add(`8${digits.slice(1)}`);
  return [...set];
}

export function createApiRouter(service: GameService, repo: Repository, env: Env): Router {
  const router = Router();
  const releaseLimiter = createRateLimiter({
    capacity: Math.max(5, Math.floor(env.releaseRateLimit / 2)),
    refillPerMinute: env.releaseRateLimit,
  });

  router.use(requirePlayer);

  /**
   * Полное состояние игрока. Отдаём ровно ту же форму GameState, что использует
   * клиентское ядро, поэтому переключение между локальным и серверным режимом
   * не меняет ни одного компонента.
   */
  router.get(
    '/state',
    asyncHandler(async (req, res) => {
      const state = await service.getState(req.player!.id);
      res.json({
        state,
        summary: service.describe(state),
        // Право администратора определяет сервер по проверенной подписи.
        // Клиент использует это только для показа раздела, не для доступа.
        isAdmin: req.player!.isAdmin,
      });
    }),
  );

  /** Витрина шансов. Считается тем же кодом, что и фактическое выпадение. */
  router.get(
    '/chances',
    asyncHandler(async (req, res) => {
      const state = await service.getState(req.player!.id);
      const tariffId = isTariff(req.query.tariffId) ? req.query.tariffId : state.selectedTariff;
      res.json(service.chances(tariffId, state.player.luck.multiplier));
    }),
  );

  /** Выпуск SIM. Тело: { tariffId?, countryId?, releaseId }. */
  router.post(
    '/release',
    releaseLimiter,
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const tariffId = isTariff(body.tariffId) ? body.tariffId : undefined;
      const countryId =
        body.countryId === null ? null : asString(body.countryId) ?? undefined;
      const releaseId = asString((req.body as Record<string, unknown>).releaseId) ?? undefined;

      const result = await service.release(req.player!.id, {
        tariffId,
        countryId,
        releaseId,
      });

      if (!result.ok) {
        const status = result.error === 'duplicate' ? 409 : 400;
        res.status(status).json({ error: result.error, balance: result.balance });
        return;
      }
      res.json(result);
    }),
  );

  /** Выбор тарифа, региона, оператора и кода. Валюту не списывает. */
  router.post(
    '/select',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const tariffId = isTariff(body.tariffId) ? body.tariffId : undefined;
      const countryId =
        body.countryId === null ? null : asString(body.countryId) ?? undefined;
      const operatorId =
        body.operatorId === null ? null : asString(body.operatorId) ?? undefined;
      const code = body.code === null ? null : asString(body.code) ?? undefined;

      if (
        tariffId === undefined &&
        countryId === undefined &&
        operatorId === undefined &&
        code === undefined
      ) {
        res.status(400).json({ error: 'nothing_to_change' });
        return;
      }

      const result = await service.select(req.player!.id, {
        tariffId,
        countryId,
        operatorId,
        code,
      });
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  /** Продажа пачки номеров: коллекция чистится за один заход. */
  router.post(
    '/sell-batch',
    asyncHandler(async (req, res) => {
      const raw = (req.body as Record<string, unknown>).ids;
      if (!Array.isArray(raw) || raw.length === 0) {
        res.status(400).json({ error: 'ids_required' });
        return;
      }
      const ids = raw.filter((item): item is string => typeof item === 'string');
      if (ids.length === 0 || ids.length > 200) {
        res.status(400).json({ error: 'bad_ids' });
        return;
      }

      const outcome = await service.sellBatch(req.player!.id, ids);
      res.status(outcome.ok ? 200 : 400).json(outcome);
    }),
  );

  router.post(
    '/sell',
    asyncHandler(async (req, res) => {
      const numberId = asString((req.body as Record<string, unknown>).numberId);
      if (!numberId) {
        res.status(400).json({ error: 'number_required' });
        return;
      }
      const result = await service.sell(req.player!.id, numberId);
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  router.post(
    '/primary',
    asyncHandler(async (req, res) => {
      const numberId = asString((req.body as Record<string, unknown>).numberId);
      if (!numberId) {
        res.status(400).json({ error: 'number_required' });
        return;
      }
      const result = await service.makePrimary(req.player!.id, numberId);
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  /** Прогноз замены цифры. Только чтение — валюту не трогает. */
  router.get(
    '/digit/forecast',
    asyncHandler(async (req, res) => {
      const numberId = asString(req.query.numberId);
      const index = Number(req.query.index);
      if (!numberId || !Number.isInteger(index)) {
        res.status(400).json({ error: 'bad_request' });
        return;
      }
      const result = await service.forecast(req.player!.id, numberId, index);
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  router.post(
    '/digit',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const numberId = asString(body.numberId);
      const index = Number(body.index);
      if (!numberId || !Number.isInteger(index)) {
        res.status(400).json({ error: 'bad_request' });
        return;
      }
      const result = await service.changeDigit(req.player!.id, numberId, index);
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  /** Витрина улучшений: что можно сделать с номером и сколько это стоит. */
  router.get(
    '/upgrades',
    asyncHandler(async (req, res) => {
      const numberId = asString(req.query.numberId);
      if (!numberId) {
        res.status(400).json({ error: 'number_required' });
        return;
      }
      const result = await service.upgrades(req.player!.id, numberId);
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  /**
   * Улучшение номера. Вид операции приходит строкой, параметры — позициями.
   * Цену, результат и новую категорию определяет сервер.
   */
  router.post(
    '/upgrade',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const numberId = asString(body.numberId);
      const id = asString(body.id);

      if (!numberId || !id) {
        res.status(400).json({ error: 'bad_request' });
        return;
      }
      if (!UPGRADE_IDS.includes(id as UpgradeId)) {
        res.status(400).json({ error: 'unknown_upgrade' });
        return;
      }

      const index = body.index === undefined ? undefined : Number(body.index);
      const a = body.a === undefined ? undefined : Number(body.a);
      const b = body.b === undefined ? undefined : Number(body.b);
      if ([index, a, b].some((value) => value !== undefined && !Number.isInteger(value))) {
        res.status(400).json({ error: 'bad_index' });
        return;
      }

      const result = await service.upgrade(req.player!.id, {
        numberId,
        id: id as UpgradeId,
        index,
        a,
        b,
        // Для смены оператора: сервер проверит, что он из региона номера.
        operatorId: asString(body.operatorId) ?? undefined,
      });
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  /** Задания и достижения: прогресс, награда, признак «уже забрано». */
  router.get(
    '/quests',
    asyncHandler(async (req, res) => {
      res.json(await service.quests(req.player!.id));
    }),
  );

  /**
   * Крутить колесо.
   *
   * Попытка стоит денег и списывается на сервере; приз выбирается по весам из
   * общего ядра и применяется там же. Идентификатор защищает от повторов:
   * повторная отправка не спишет деньги дважды.
   */
  router.post(
    '/roulette',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const releaseId = asString(body.releaseId) ?? undefined;
      const wheelId = asString(body.wheelId) ?? null;
      const result = await service.spinRoulette(req.player!.id, wheelId, releaseId);
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  /**
   * Погасить промокод.
   *
   * Проверка целиком на сервере: срок, повторное использование игроком и
   * общий тираж. Клиент только показывает ответ.
   */
  router.post(
    '/promo',
    asyncHandler(async (req, res) => {
      const code = asString((req.body as Record<string, unknown>).code);
      if (!code) {
        res.status(400).json({ error: 'code_required' });
        return;
      }
      const result = await service.redeemPromo(req.player!.id, code);
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  /**
   * Проверка номера: свободен он или лежит у кого-то в коллекции.
   *
   * Игрок вставляет номер так, как он показан — с кодом страны, скобками и
   * дефисами. В коллекции при этом хранятся только цифры БЕЗ кода страны.
   * Поэтому проверяем несколько написаний сразу: иначе вставленный из карточки
   * номер не находился бы и всегда отвечал «свободен».
   */
  router.get(
    '/check',
    asyncHandler(async (req, res) => {
      const raw = typeof req.query.number === 'string' ? req.query.number : '';
      const digits = raw.replace(/\D/g, '');
      if (digits.length < 6) {
        res.status(400).json({ error: 'number_too_long_or_short' });
        return;
      }

      const candidates = digitCandidates(digits);
      const owner = await repo.findNumberOwner(candidates);
      res.json({
        ok: true,
        digits,
        free: owner === null,
        // Имя владельца не раскрываем: игроку достаточно знать, что номер занят.
        checked: candidates.length,
        display: owner ? owner.display : null,
      });
    }),
  );

  /** Задания дня и недели вместе с прогрессом. */
  router.get(
    '/tasks',
    asyncHandler(async (req, res) => {
      const state = await service.load(req.player!.id);
      res.json({ ok: true, tasks: tasksFor(state), balance: state.player.balance });
    }),
  );

  /** Забрать награду за задание. Условие проверяет сервер по состоянию. */
  router.post(
    '/task',
    asyncHandler(async (req, res) => {
      const key = asString((req.body as Record<string, unknown>).key);
      if (!key) {
        res.status(400).json({ error: 'key_required' });
        return;
      }
      const result = await service.claimTask(req.player!.id, key);
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  /** Забрать награду за достижение. Условие проверяет сервер. */
  router.post(
    '/achievement',
    asyncHandler(async (req, res) => {
      const id = asString((req.body as Record<string, unknown>).id);
      if (!id) {
        res.status(400).json({ error: 'achievement_required' });
        return;
      }
      const result = await service.claimAchievement(req.player!.id, id);
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  router.post(
    '/daily',
    asyncHandler(async (req, res) => {
      const result = await service.claimDaily(req.player!.id);
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  router.post(
    '/bailout',
    asyncHandler(async (req, res) => {
      const result = await service.claimBailout(req.player!.id);
      res.status(result.ok ? 200 : 400).json(result);
    }),
  );

  /** Читаемые игроку параметры: нужны экрану правил и магазину. */
  router.get(
    '/meta',
    asyncHandler(async (_req, res) => {
      res.json({
        tariffs: Object.values(TARIFFS),
        driver: repo.driver,
      });
    }),
  );

  return router;
}
