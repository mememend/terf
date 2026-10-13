// language: TypeScript, file: shared/src/overrides.ts
// Переопределения игровых параметров из админ-панели.
//
// Базовые значения лежат в config.ts и остаются нетронутыми: здесь снимается
// их копия, и при каждом применении конфиг сначала возвращается к базовому,
// а затем на него накладываются переопределения. Поэтому повторное применение
// всегда даёт один и тот же результат, а снятое переопределение возвращает
// исходное значение — без перезапуска сервера.

import { COUNTRIES, PATTERN_POINTS, RARITIES, TARIFFS } from './config';
import type { RarityId, Rarity, Tariff, TariffId } from './types';

/** Снимок базовых значений, снятый при первом обращении. */
interface Pristine {
  tariffPrice: Record<string, number | null>;
  tariffOdds: Record<string, Record<string, number>>;
  tariffXp: Record<string, number>;
  rarityBasePrice: Record<string, number>;
  patternPoints: Record<string, number>;
  regionDemand: Record<string, number>;
}

let pristine: Pristine | null = null;

function snapshot(): Pristine {
  if (pristine) return pristine;
  pristine = {
    tariffPrice: Object.fromEntries(
      Object.entries(TARIFFS).map(([id, tariff]) => [id, tariff.price]),
    ),
    tariffOdds: Object.fromEntries(
      Object.entries(TARIFFS).map(([id, tariff]) => [id, { ...tariff.odds }]),
    ),
    tariffXp: Object.fromEntries(
      Object.entries(TARIFFS).map(([id, tariff]) => [id, tariff.xpMultiplier]),
    ),
    rarityBasePrice: Object.fromEntries(
      Object.entries(RARITIES).map(([id, rarity]) => [id, rarity.basePrice]),
    ),
    patternPoints: { ...PATTERN_POINTS },
    regionDemand: Object.fromEntries(COUNTRIES.map((country) => [country.id, country.demand])),
  };
  return pristine;
}

export interface OverrideReport {
  /** Ключи, которые удалось применить. */
  applied: string[];
  /** Ключи, которые не распознаны или отброшены. */
  ignored: string[];
}

/** Возвращает конфиг к базовым значениям. */
export function resetConfigToBase(): void {
  const base = snapshot();

  for (const [id, tariff] of Object.entries(TARIFFS) as [TariffId, Tariff][]) {
    tariff.price = base.tariffPrice[id] ?? null;
    tariff.odds = { ...(base.tariffOdds[id] as Record<RarityId, number>) };
    tariff.xpMultiplier = base.tariffXp[id] ?? 1;
  }
  for (const [id, rarity] of Object.entries(RARITIES) as [RarityId, Rarity][]) {
    rarity.basePrice = base.rarityBasePrice[id] ?? rarity.basePrice;
  }
  for (const [id, points] of Object.entries(base.patternPoints)) {
    PATTERN_POINTS[id] = points;
  }
  for (const country of COUNTRIES) {
    country.demand = base.regionDemand[country.id] ?? country.demand;
  }
}

/**
 * Применяет переопределения поверх базового конфига.
 * Возвращает отчёт: что применилось, а что отброшено.
 */
export function applyConfigOverrides(
  overrides: Record<string, unknown>,
): OverrideReport {
  resetConfigToBase();

  const applied: string[] = [];
  const ignored: string[] = [];

  for (const [key, value] of Object.entries(overrides)) {
    if (applyOne(key, value)) applied.push(key);
    else ignored.push(key);
  }

  return { applied, ignored };
}

function applyOne(key: string, value: unknown): boolean {
  const priceMatch = /^tariff\.([a-z]+)\.price$/.exec(key);
  if (priceMatch) {
    const tariff = TARIFFS[priceMatch[1] as TariffId];
    if (!tariff || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return false;
    tariff.price = Math.round(value);
    return true;
  }

  const oddsMatch = /^tariff\.([a-z]+)\.odds$/.exec(key);
  if (oddsMatch) {
    const tariff = TARIFFS[oddsMatch[1] as TariffId];
    if (!tariff || typeof value !== 'object' || value === null) return false;
    const draft = value as Record<string, number>;
    const sum = Object.values(draft).reduce((total, item) => total + Number(item), 0);
    // Сумма взаимоисключающих исходов обязана быть ровно 100 %.
    if (Math.abs(sum - 100) > 0.001) return false;
    tariff.odds = { ...(draft as Record<RarityId, number>) };
    return true;
  }

  const patternMatch = /^pattern\.([a-z_]+)$/.exec(key);
  if (patternMatch) {
    if (!(patternMatch[1] in PATTERN_POINTS)) return false;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return false;
    PATTERN_POINTS[patternMatch[1]] = value;
    return true;
  }

  const regionMatch = /^region\.([a-z]+)$/.exec(key);
  if (regionMatch) {
    const country = COUNTRIES.find((item) => item.id === regionMatch[1]);
    if (!country) return false;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 10) {
      return false;
    }
    country.demand = value;
    return true;
  }

  const rarityMatch = /^rarity\.([a-z]+)\.basePrice$/.exec(key);
  if (rarityMatch) {
    const rarity = RARITIES[rarityMatch[1] as RarityId];
    if (!rarity) return false;
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return false;
    rarity.basePrice = value;
    return true;
  }

  return false;
}

/** Базовые значения для витрины админ-панели. */
export function baseConfigValues() {
  const base = snapshot();
  return {
    tariffPrice: { ...base.tariffPrice },
    tariffOdds: structuredClone(base.tariffOdds),
    patternPoints: { ...base.patternPoints },
    regionDemand: { ...base.regionDemand },
    rarityBasePrice: { ...base.rarityBasePrice },
  };
}
