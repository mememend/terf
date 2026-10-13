// language: TypeScript, file: frontend/src/components/SimCard.tsx
// Большая светлая карточка SIM. До первого выпуска — номер-заполнитель,
// после — полученный номер с подчёркнутыми цифрами, попавшими в узор.

import { RARITIES, highlightedIndices, operatorById } from '@ciferki/shared';
import { Flag } from './Flag';
import { digitPositions } from '../utils/format';
import type { PhoneNumber, RarityId } from '@ciferki/shared';

interface SimCardProps {
  number: PhoneNumber | null;
  revealing?: boolean;
  /** Категория готовящегося выпадения: чем выше, тем сильнее дрожит карточка. */
  revealRarity?: RarityId | null;
  /** Бланк выбранной страны: категории ещё нет, показывать её нельзя */
  preview?: boolean;
}

/** Заполнитель до первого выпуска: тот же ритм цифр, что в референсе. */
const PLACEHOLDER = '+7 000 000-00-00';

/** Насколько сильно трясёт карточку перед выпадением. */
const SHAKE_BY_RARITY: Record<RarityId, number> = {
  common: 0.45,
  uncommon: 0.8,
  rare: 1.1,
  epic: 1.5,
  legendary: 2,
  mythic: 2.5,
};

export function SimCard({
  number,
  revealing = false,
  revealRarity = null,
  preview = false,
}: SimCardProps) {
  const rarity = number ? RARITIES[number.rarity] : null;
  const operator = number ? operatorById(number.operatorId) : null;
  const display = number?.display ?? PLACEHOLDER;
  const highlights = number ? highlightedIndices(number.patterns) : new Set<number>();
  const positions = digitPositions(display);

  const style = {
    ...(number
      ? {
          '--rarity': rarity?.color,
          '--rarity-glow': rarity?.glow,
        }
      : {}),
    // Тряска нарастает вместе с категорией: игрок чувствует, что идёт что-то серьёзное.
    '--shake': String(revealRarity ? SHAKE_BY_RARITY[revealRarity] : 1),
  } as React.CSSProperties;

  const cardClass = [
    'sim-card',
    revealing ? 'sim-card--revealing' : '',
    number && number.rarity !== 'common' ? 'sim-card--rare' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClass} style={style}>
      <div className="sim-card__top">
        <div className="sim-card__brand">
          {number && operator ? (
            <span
              className="sim-card__brand-badge sim-card__brand-badge--operator"
              style={{ ['--operator' as string]: operator.color }}
            >
              {operator.badge}
            </span>
          ) : (
            <span className="sim-card__brand-badge">?</span>
          )}
          <div>
            <div className="sim-card__brand-text">
              {operator?.name ?? 'Циферки'}
            </div>
            {number && (
              <div className="sim-card__country">
                <Flag countryId={number.countryId} size={13} />
                <span>{number.regionCode}</span>
              </div>
            )}
          </div>
        </div>

        <div className="sim-card__chip">
          <span className="sim-card__chip-inner" />
        </div>
      </div>

      <div className="sim-card__number">
        <span className={number ? 'sim-card__code' : 'sim-card__number--placeholder'}>
          {renderWithHighlights(
            display,
            positions,
            highlights,
            number ? '' : 'sim-card__digits--placeholder',
          )}
        </span>
        <span
          className="sim-card__rarity"
          style={{ ['--rarity' as string]: rarity?.color ?? '#8a8a8f' }}
        >
          {preview ? 'Бланк' : rarity?.name ?? 'Пусто'}
        </span>
      </div>
    </div>
  );
}

/** Разбиваем строку на символы, подчёркивая те цифры, что вошли в узор. */
function renderWithHighlights(
  display: string,
  positions: Map<number, number>,
  highlights: Set<number>,
  extraClass: string,
) {
  const nodes: React.ReactNode[] = [];
  let order = 0;
  for (let i = 0; i < display.length; i += 1) {
    const char = display[i];
    const digitIndex = positions.get(i);
    const isHit = digitIndex !== undefined && highlights.has(digitIndex);
    // Цифры встают по очереди: номер как будто набирается на глазах.
    const delay = digitIndex === undefined ? 0 : order++ * 26;
    nodes.push(
      <span
        key={`${i}-${char}`}
        className={[
          'digit',
          'digit--in',
          // Пробел из маски — такой же символ номера, как цифра и тире.
          char === ' ' ? 'digit--space' : '',
          isHit ? 'digit--hit' : '',
          extraClass,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ animationDelay: `${delay}ms` }}
      >
        {char}
      </span>,
    );
  }
  return nodes;
}
