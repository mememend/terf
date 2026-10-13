// language: TypeScript, file: frontend/src/utils/prize.ts
// Подпись приза рулетки.
//
// Отдельный модуль без зависимостей: экран тянет за собой api и окружение
// сборщика, а эту функцию надо проверять тестом в обычном Node.

import { formatMoney } from '@ciferki/shared';
import type { RoulettePrize } from '@ciferki/shared';

/** Что приз дал игроку — короткой строкой под названием. */
export function effectOf(prize: RoulettePrize): string {
  switch (prize.kind) {
    case 'money':
      return `+${formatMoney(prize.amount ?? 0)} ₽ на баланс`;
    case 'refund':
      return `возврат ${formatMoney(prize.amount ?? 0)} ₽`;
    case 'tickets': {
      const count = prize.releases ?? 0;
      const word = count === 1 ? 'бесплатный выпуск' : 'бесплатных выпуска';
      return `${count} ${word}`;
    }
    default: {
      // Если полей нет — не печатаем «undefined», а честно говорим, что не знаем.
      const multiplier = prize.multiplier ?? 1;
      const spins = prize.spins ?? 0;
      if (multiplier <= 1 || spins <= 0) return 'бонус удачи';
      return `удача ×${multiplier} на ${spins} ${spins === 1 ? 'крутку' : 'крутки'}`;
    }
  }
}
