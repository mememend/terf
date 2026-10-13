// language: TypeScript, file: backend/src/services/config-service.ts
// Применение переопределений из админ-панели к игровому конфигу.
//
// Конфиг живёт в модуле @ciferki/shared и общий для всего процесса. Значит,
// правка через панель немедленно влияет и на выпуск, и на витрину шансов —
// без перезапуска. Функция вызывается при старте и после каждой записи.

import { applyConfigOverrides, type OverrideReport } from '@ciferki/shared';
import type { Repository } from '../repository/types.ts';

export async function reloadConfig(repo: Repository): Promise<OverrideReport> {
  const overrides = await repo.getConfigOverrides();
  const report = applyConfigOverrides(overrides);
  if (report.ignored.length > 0) {
    // Битое переопределение не должно ронять сервер, но о нём нужно знать.
    console.warn(
      `[config] переопределения отброшены (не прошли проверку): ${report.ignored.join(', ')}`,
    );
  }
  if (report.applied.length > 0) {
    console.log(`[config] применено переопределений: ${report.applied.length}`);
  }
  return report;
}
