// language: TypeScript, file: frontend/src/components/RoamingModal.tsx
// Окно выбора региона: «Любая страна», сетка стран и режим «Свои номера».
// Все номера синтетические — реальные контакты и SMS сюда не подключаются.

import { useMemo, useState } from 'react';
import { COUNTRIES } from '@ciferki/shared';
import { Flag } from './Flag';
import { CUSTOM_COUNTRY_ID } from '@ciferki/shared';
import { Modal } from './Modal';
import { IconGlobe, IconSearch } from './Icons';

interface RoamingModalProps {
  selected: string | null;
  onPick: (countryId: string | null) => void;
  onClose: () => void;
  onCustom: () => void;
}

export function RoamingModal({ selected, onPick, onClose, onCustom }: RoamingModalProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return COUNTRIES;
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(needle) || country.code.includes(needle),
    );
  }, [query]);

  return (
    <Modal title="Роуминг" subtitle="Страна, где выпустят номер" onClose={onClose}>
      <div className="search">
        <IconSearch size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск страны"
          inputMode="search"
        />
      </div>

      <div className="country-grid">
        <button
          className={`country-tile ${selected === null ? 'country-tile--active' : ''}`}
          onClick={() => {
            onPick(null);
            onClose();
          }}
        >
          <span className="country-tile__globe">
            <IconGlobe size={20} />
          </span>
          <span className="country-tile__name">Любая</span>
          <span className="country-tile__code">случайно</span>
        </button>

        {filtered.map((country) => (
          <button
            key={country.id}
            className={`country-tile ${
              selected === country.id ? 'country-tile--active' : ''
            }`}
            onClick={() => {
              onPick(country.id);
              onClose();
            }}
          >
            <Flag countryId={country.id} size={24} className="country-tile__flag" />
            <span className="country-tile__name">{country.name}</span>
            <span className="country-tile__code">{country.code}</span>
          </button>
        ))}

        <button
          className={`country-tile ${
            selected === CUSTOM_COUNTRY_ID ? 'country-tile--active' : ''
          }`}
          onClick={() => {
            onCustom();
            onClose();
          }}
        >
          <span className="country-tile__digits">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="country-tile__name">Свои номера</span>
          <span className="country-tile__code">свои коды</span>
        </button>
      </div>

      <div className="action-note">
        Номера игровые и синтетические. Реальные абоненты не используются.
      </div>
    </Modal>
  );
}
