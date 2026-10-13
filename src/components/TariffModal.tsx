// language: TypeScript, file: frontend/src/components/TariffModal.tsx
// Окно выбора тарифа: карусель четырёх карточек, доля «редкий и выше»,
// краткая таблица вероятностей и кнопка подтверждения.

import { useEffect, useState } from 'react';
import {
  RARITIES,
  TARIFFS,
  TARIFF_ORDER,
  formatMoney,
  formatOdds,
} from '@ciferki/shared';
import { distributionFor, rarePlusShare } from '@ciferki/shared';
import { Modal } from './Modal';
import { useDragScroll } from '../hooks/useDragScroll';
import type { RarityId, TariffId } from '@ciferki/shared';

const SHOWN_RARITIES: RarityId[] = ['rare', 'epic', 'legendary', 'mythic'];

interface TariffModalProps {
  selected: TariffId;
  luck: number;
  balance: number;
  tickets: number;
  onPick: (tariffId: TariffId) => void;
  onOpenChances: () => void;
  onClose: () => void;
}

export function TariffModal({
  selected,
  luck,
  balance,
  tickets,
  onPick,
  onOpenChances,
  onClose,
}: TariffModalProps) {
  // Карусель открывается на текущем тарифе, не на первом.
  const [active, setActive] = useState<TariffId>(selected);
  const dragRef = useDragScroll<HTMLDivElement>();
  const trackRef = dragRef;

  // При открытии доводим ленту до выбранного тарифа.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const index = TARIFF_ORDER.indexOf(selected);
    if (index <= 0) return;
    const card = track.children[index] as HTMLElement | undefined;
    if (card) track.scrollLeft = card.offsetLeft - (track.clientWidth - card.clientWidth) / 2;
    // Ставим выбранный тариф активным сразу, не дожидаясь события прокрутки.
    setActive(selected);
  }, [selected, trackRef]);

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let closest = TARIFF_ORDER[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < track.children.length; i += 1) {
      const card = track.children[i] as HTMLElement;
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const distance = Math.abs(cardCenter - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = TARIFF_ORDER[i];
      }
    }
    setActive(closest);
  };

  const tariff = TARIFFS[active];
  const distribution = distributionFor(active, luck);
  const share = rarePlusShare(active, luck);
  const isSelected = active === selected;
  const affordable =
    tariff.price === null ? tickets >= (tariff.ticketCost ?? 1) : balance >= tariff.price;

  return (
    <Modal
      title="Тариф"
      subtitle="Дороже тариф — чаще редкие номера"
      onClose={onClose}
      footer={
        <button
          className={`choose-btn ${isSelected ? 'choose-btn--done' : ''}`}
          onClick={() => {
            onPick(active);
            onClose();
          }}
        >
          <span>{isSelected ? `${tariff.name} выбран` : `Выбрать ${tariff.name}`}</span>
          <span className="choose-btn__side">{priceLabel(active, balance, tickets)}</span>
        </button>
      }
    >
      {/* Лента тарифов: тянется мышью через useDragScroll и пальцем нативно. */}
      <div className="tariff-carousel" ref={dragRef} onScroll={onScroll}>
        {TARIFF_ORDER.map((id) => (
          <TariffPlate key={id} id={id} muted={id !== active} />
        ))}
      </div>

      <div className="dots">
        {TARIFF_ORDER.map((id) => (
          <div
            key={id}
            className={`dots__item ${id === active ? 'dots__item--active' : ''}`}
          />
        ))}
      </div>

      <div className="tariff-share">
        <div className="tariff-share__value" style={{ color: tariff.accent }}>
          {formatShare(share)}
        </div>
        <div className="tariff-share__label">редкий и выше</div>
      </div>

      <div className="odds-grid">
        {SHOWN_RARITIES.map((rarity) => (
          <div key={rarity} className="odds-cell">
            <div className="odds-cell__label">
              <span
                className="odds-cell__dot"
                style={{ ['--dot' as string]: RARITIES[rarity].color }}
              />
              {RARITIES[rarity].name}
            </div>
            <div className="odds-cell__value">{formatOdds(distribution[rarity])}</div>
          </div>
        ))}
      </div>

      <button className="link-row" onClick={onOpenChances} style={{ width: '100%' }}>
        Все шансы ›
      </button>

      {!affordable && (
        <div className="action-note" style={{ color: 'var(--danger)' }}>
          {tariff.price === null
            ? `Нужен билет. Сейчас билетов: ${tickets}`
            : `Не хватает ${formatMoney(tariff.price - balance)} ₽`}
        </div>
      )}
    </Modal>
  );
}

function TariffPlate({ id, muted }: { id: TariffId; muted: boolean }) {
  const tariff = TARIFFS[id];
  return (
    <div className={`tariff-card ${muted ? 'tariff-card--muted' : ''}`}>
      <div
        className="tariff-card__plate"
        style={{ background: tariff.gradient }}
      >
        <div className="tariff-card__stripe" style={{ background: tariff.stripe }} />
        <div className="tariff-card__content">
          <span className="tariff-card__chip" />
          <div className="tariff-card__name">{tariff.name}</div>
          <div className="tariff-card__tagline">{tariff.tagline}</div>
        </div>
      </div>
    </div>
  );
}

function priceLabel(id: TariffId, _balance: number, tickets: number): string {
  const tariff = TARIFFS[id];
  if (tariff.price === null) return tickets > 0 ? 'по билету' : 'нет билета';
  return `${formatMoney(tariff.price)} ₽`;
}

function formatShare(share: number): string {
  if (share >= 99.95) return '100 %';
  if (share < 1) return `${share.toFixed(1).replace('.', ',')} %`;
  return `${share.toFixed(0)} %`;
}
