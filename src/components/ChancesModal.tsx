// language: TypeScript, file: frontend/src/components/ChancesModal.tsx
// Окно «Шансы». Проценты считаются из фактического распределения с учётом удачи,
// поэтому витрина и генератор всегда показывают одно и то же.

import { RARITIES, RARITY_ORDER, formatOdds, formatPercent, TARIFFS } from '@ciferki/shared';
import { distributionFor, rarePlusShare } from '@ciferki/shared';
import { Modal } from './Modal';
import { formatMoney } from '@ciferki/shared';
import type { RarityId, TariffId } from '@ciferki/shared';

interface ChancesModalProps {
  tariffId: TariffId;
  luck: number;
  onPickTariff: (tariffId: TariffId) => void;
  onClose: () => void;
}

export function ChancesModal({ tariffId, luck, onPickTariff, onClose }: ChancesModalProps) {
  const distribution = distributionFor(tariffId, luck);
  const peak = Math.max(...RARITY_ORDER.map((rarity) => distribution[rarity]));

  return (
    <Modal
      title="Шансы"
      subtitle="Что выпадет на следующей крутке"
      onClose={onClose}
      footer={
        <div className="modal__sub" style={{ textAlign: 'center' }}>
          {luck > 1
            ? `С учётом удачи ×${luck}. Сумма вероятностей — ровно 100 %.`
            : 'Сумма вероятностей — ровно 100 %.'}
        </div>
      }
    >
      <div className="toolbar" style={{ justifyContent: 'center' }}>
        {(Object.keys(TARIFFS) as TariffId[]).map((id) => (
          <button
            key={id}
            className={`pill-btn ${id === tariffId ? 'pill-btn--active' : ''}`}
            onClick={() => onPickTariff(id)}
            style={
              id === tariffId
                ? { background: TARIFFS[id].accent, color: '#0a0a0a' }
                : undefined
            }
          >
            {TARIFFS[id].name}
          </button>
        ))}
      </div>

      <div style={{ padding: '4px 0 10px' }}>
        {[...RARITY_ORDER].reverse().map((rarity) => (
          <ChanceRow
            key={rarity}
            rarity={rarity}
            percent={distribution[rarity]}
            peak={peak}
          />
        ))}
      </div>
    </Modal>
  );
}

function ChanceRow({
  rarity,
  percent,
  peak,
}: {
  rarity: RarityId;
  percent: number;
  peak: number;
}) {
  const meta = RARITIES[rarity];
  const width = peak > 0 ? Math.max(2, (percent / peak) * 100) : 0;

  return (
    <div style={{ padding: '7px 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: meta.color,
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 17, fontWeight: 700, color: meta.color }}>
            {meta.name}
          </span>
        </span>
        <span style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{formatOdds(percent)}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
            {formatPercent(percent)}
          </div>
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: 'var(--surface-3)',
          marginTop: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${width}%`,
            background: meta.color,
            borderRadius: 2,
            transition: 'width 260ms cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </div>
    </div>
  );
}

/** Строка «редкий и выше» для карточки тарифа. */
export function rarePlusLabel(tariffId: TariffId, luck: number): string {
  const share = rarePlusShare(tariffId, luck);
  return `${share.toFixed(1).replace('.', ',')} %`;
}

/** Базовая цена категории — показывается в окне шансов мелким шрифтом. */
export function rarityBaseLabel(rarity: RarityId): string {
  return `${formatMoney(RARITIES[rarity].basePrice)} ₽`;
}
