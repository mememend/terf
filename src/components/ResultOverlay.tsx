// language: TypeScript, file: frontend/src/components/ResultOverlay.tsx
// Экран выпадения — главный момент игры.
//
// Показ идёт по ступеням: сначала вспышка, потом карточка, потом категория,
// потом оценка. Чем выше категория, тем богаче сцена: у обычного только вспышка,
// у мифического — вращающиеся лучи и три с лишним десятка искр.
// Всё берётся из фактических данных номера, ничего не преувеличено.

import { RARITIES, formatMoney } from '@ciferki/shared';
import type { RarityId } from '@ciferki/shared';
import { SimCard } from './SimCard';
import type { PhoneNumber } from '@ciferki/shared';

interface ResultOverlayProps {
  number: PhoneNumber;
  onClose: () => void;
  onOpen: () => void;
}

/** Сколько искр разлетается при выпадении. У обычного их нет — незачем. */
const SPARKS_BY_RARITY: Record<RarityId, number> = {
  common: 0,
  uncommon: 6,
  rare: 12,
  epic: 18,
  legendary: 26,
  mythic: 36,
};

/** С какой категории включаются вращающиеся лучи. */
const RAYS_FROM: RarityId[] = ['epic', 'legendary', 'mythic'];

function tierHeadline(rarity: RarityId): string {
  switch (rarity) {
    case 'mythic':
      return 'Мифическая находка';
    case 'legendary':
      return 'Легендарное выпадение';
    case 'epic':
      return 'Эпическое выпадение';
    case 'rare':
      return 'Редкое выпадение';
    case 'uncommon':
      return 'Необычное выпадение';
    default:
      return 'Обычное выпадение';
  }
}

interface Spark {
  angle: number;
  distance: number;
  size: number;
  delay: number;
}

/**
 * Искры раскладываем детерминированно: угол по золотому сечению, радиус и размер —
 * из хеша индекса. Сцена каждый раз одинаковая по характеру, но не «решёткой».
 */
function buildSparks(count: number): Spark[] {
  const sparks: Spark[] = [];
  for (let i = 0; i < count; i += 1) {
    const hash = Math.sin(i * 12.9898) * 43758.5453;
    const noise = hash - Math.floor(hash);
    sparks.push({
      angle: (i * 137.508) % 360,
      distance: 90 + noise * 110,
      size: 3 + (1 - noise) * 4,
      delay: (i % 7) * 34,
    });
  }
  return sparks;
}

export function ResultOverlay({ number, onClose, onOpen }: ResultOverlayProps) {
  const rarity = RARITIES[number.rarity];
  const sparks = buildSparks(SPARKS_BY_RARITY[number.rarity]);
  const showRays = RAYS_FROM.includes(number.rarity);

  return (
    <div
      className="result"
      style={{
        ['--rarity' as string]: rarity.color,
        ['--rarity-glow' as string]: rarity.glow,
      }}
    >
      <div className="result__stage">
        {showRays && <span className="result__rays" />}
        <span className="result__burst" />

        {sparks.map((spark, index) => (
          <span
            key={index}
            className="result__spark"
            style={{
              ['--angle' as string]: `${spark.angle}deg`,
              ['--distance' as string]: `${spark.distance}px`,
              ['--size' as string]: `${spark.size}px`,
              animationDelay: `${spark.delay}ms`,
            }}
          />
        ))}

        <div className="result__card">
          <SimCard number={number} />
        </div>
      </div>

      <div className="result__caption">
        <div className="result__tier">{tierHeadline(number.rarity)}</div>
        <div className="result__name" style={{ color: rarity.color }}>
          {rarity.name}
        </div>

        <div className="estimate" style={{ marginTop: 10 }}>
          <div className="estimate__label">Оценка номера</div>
          <div className="estimate__value">{formatMoney(number.finalPrice)} ₽</div>
          <div className="estimate__tags">
            <span className="chip">
              <b>{number.score}</b> очков
            </span>
            <span className="chip">
              <b>×{String(number.patternMultiplier).replace('.', ',')}</b> узор
            </span>
            <span className="chip">
              <b>×{String(number.demandMultiplier).replace('.', ',')}</b> спрос
            </span>
          </div>
          {number.patterns.length > 0 && (
            <div className="result__patterns">
              {number.patterns.slice(0, 3).map((hit) => (
                <span key={hit.id} className="chip chip--gold">
                  {hit.label} +{hit.points}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="result__actions">
        <button className="release-btn" onClick={onOpen}>
          <span>Открыть карточку</span>
          <span className="release-btn__price">{number.display}</span>
        </button>
        <button className="action-btn" onClick={onClose}>
          Дальше
        </button>
      </div>
    </div>
  );
}
