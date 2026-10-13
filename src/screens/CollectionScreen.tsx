// language: TypeScript, file: frontend/src/screens/CollectionScreen.tsx
// Коллекция: сводка по местам и категориям, сортировка, фильтр по регионам,
// поиск по цифрам и сетка карточек.

import { useMemo, useState } from 'react';
import {
  COUNTRIES,
  operatorById,
  RARITIES,
  RARITY_ORDER,
  formatMoney,
} from '@ciferki/shared';
import { Header } from '../components/Header';
import { IconSearch } from '../components/Icons';
import { useDragScroll } from '../hooks/useDragScroll';
import { Flag } from '../components/Flag';
import type { Game } from '../hooks/useGame';
import type { GameState, PhoneNumber, RarityId } from '@ciferki/shared';

type SortKey = 'new' | 'old' | 'price' | 'rarity' | 'beauty';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'new', label: 'Новые' },
  { key: 'old', label: 'Старые' },
  { key: 'price', label: 'По цене' },
  { key: 'rarity', label: 'По редкости' },
  { key: 'beauty', label: 'По узору' },
];

interface CollectionScreenProps {
  game: Game;
  onBack: () => void;
  onOpenNumber: (id: string) => void;
}

export function CollectionScreen({ game, onBack, onOpenNumber }: CollectionScreenProps) {
  const { state, countByRarity, portfolioValue } = game;
  const [sort, setSort] = useState<SortKey>('new');
  const [country, setCountry] = useState<string | null>(null);
  const [rarity, setRarity] = useState<RarityId | null>(null);
  const [query, setQuery] = useState('');
  const [grouped, setGrouped] = useState(false);
  /** Настройки фильтров спрятаны за одной кнопкой — экран не завален лентами. */
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Режим выбора: карточки помечаются галочками, снизу появляется продажа. */
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  /** Продажа пачки дороже этой суммы спрашивает подтверждение. */
const EXPENSIVE_SALE = 100_000;

/** 1 — ждём подтверждения дорогой продажи */
  const [confirmStep, setConfirmStep] = useState(0);

  // Ленты в настройках тоже тянем мышью.
  const sortRef = useDragScroll<HTMLDivElement>();
  const rarityRef = useDragScroll<HTMLDivElement>();
  const countryRef = useDragScroll<HTMLDivElement>();

  /** Сколько фильтров сейчас включено — показываем цифрой на кнопке. */
  const activeFilters =
    (sort !== 'new' ? 1 : 0) + (rarity ? 1 : 0) + (country ? 1 : 0) + (grouped ? 1 : 0);

  const visible = useMemo(
    () => applyFilters(state, { sort, country, rarity, query }),
    [state, sort, country, rarity, query],
  );

  /** Продать можно всё, кроме основного номера — его сервер не отдаст. */
  const sellable = visible.filter((number) => number.id !== state.player.primaryNumberId);
  const selectedSum = visible
    .filter((number) => selected.includes(number.id))
    .reduce((sum, number) => sum + number.finalPrice, 0);

  const toggleSelected = (id: string) => {
    setConfirmStep(0);
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  /**
   * Место номера среди номеров той же категории — по оценке.
   * Показываем на карточке, как в референсе: «Эпический, 2 из 6».
   */
  const rankOf = useMemo(() => {
    const buckets = new Map<string, PhoneNumber[]>();
    for (const number of state.numbers) {
      const list = buckets.get(number.rarity) ?? [];
      list.push(number);
      buckets.set(number.rarity, list);
    }
    const places = new Map<string, { place: number; total: number }>();
    for (const list of buckets.values()) {
      const sorted = [...list].sort((a, b) => b.finalPrice - a.finalPrice);
      sorted.forEach((number, index) => {
        places.set(number.id, { place: index + 1, total: sorted.length });
      });
    }
    return places;
  }, [state.numbers]);

  const sellSelected = async () => {
    if (selected.length === 0) return;

    // Дорогая пачка спрашивает подтверждение: одно неверное касание в режиме
    // выбора не должно стоить сотен тысяч.
    if (selectedSum >= EXPENSIVE_SALE && confirmStep === 0) {
      setConfirmStep(1);
      window.setTimeout(() => setConfirmStep(0), 4000);
      return;
    }

    setConfirmStep(0);
    const result = await game.sellBatch(selected);
    setSelected([]);
    if (result.sold > 0) setSelecting(false);
  };

  /** Разбивка по регионам: порядок стран берём из конфига, а не из порядка карточек. */
  const groupedByCountry = useMemo(() => {
    const buckets = new Map<string, PhoneNumber[]>();
    for (const number of visible) {
      const list = buckets.get(number.countryId) ?? [];
      list.push(number);
      buckets.set(number.countryId, list);
    }
    return COUNTRIES.filter((item) => buckets.has(item.id)).map((item) => ({
      country: item,
      numbers: buckets.get(item.id) ?? [],
      value: (buckets.get(item.id) ?? []).reduce((sum, n) => sum + n.finalPrice, 0),
    }));
  }, [visible]);

  const usedCountries = useMemo(
    () => COUNTRIES.filter((item) => state.numbers.some((n) => n.countryId === item.id)),
    [state.numbers],
  );

  const usedRarities = useMemo(
    () => [...RARITY_ORDER].reverse().filter((id) => countByRarity[id] > 0),
    [countByRarity],
  );

  return (
    <div className="app app--collection">
      <Header
        level={state.player.level}
        levelProgress={game.levelProgress}
        balance={state.player.balance}
        avatarUrl={state.player.avatarUrl}
        name={state.player.name}
        onBack={onBack}
      />

      <h1 className="screen-title">Коллекция</h1>

      {/* Одна кнопка вместо трёх лент фильтров: настройки выезжают по нажатию. */}
      <div className="coll-actions">
        <button
          className={`coll-toggle ${filtersOpen ? 'coll-toggle--open' : ''}`}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <span className="coll-toggle__icon">⚙</span>
          Настройки
          {activeFilters > 0 && <span className="coll-toggle__badge">{activeFilters}</span>}
          <span className={`coll-toggle__chevron ${filtersOpen ? 'is-open' : ''}`}>›</span>
        </button>

        <button
          className={`coll-toggle ${selecting ? 'coll-toggle--active' : ''}`}
          onClick={() => {
            setSelecting((value) => !value);
            setSelected([]);
          }}
        >
          <span className="coll-toggle__icon">{selecting ? '✕' : '☑'}</span>
          {selecting ? 'Отменить' : 'Выбрать'}
        </button>
      </div>

      {filtersOpen && (
        <div className="coll-filters">
          <div className="coll-filters__row">
            <span className="coll-filters__label">Порядок</span>
            <div className="toolbar" ref={sortRef}>
              {SORTS.map((item) => (
                <button
                  key={item.key}
                  className={`pill-btn ${sort === item.key ? 'pill-btn--active' : ''}`}
                  onClick={() => setSort(item.key)}
                >
                  {item.label}
                </button>
              ))}
              <button
                className={`pill-btn ${grouped ? 'pill-btn--active' : ''}`}
                onClick={() => setGrouped((value) => !value)}
                title="Сгруппировать по регионам"
              >
                {grouped ? '◇ По регионам' : '◇ Сеткой'}
              </button>
            </div>
          </div>

          {usedRarities.length > 1 && (
            <div className="coll-filters__row">
              <span className="coll-filters__label">Категории</span>
              <div className="toolbar" ref={rarityRef}>
                <button
                  className={`pill-btn ${rarity === null ? 'pill-btn--active' : ''}`}
                  onClick={() => setRarity(null)}
                >
                  Все
                </button>
                {usedRarities.map((id) => (
                  <button
                    key={id}
                    className={`pill-btn ${rarity === id ? 'pill-btn--active' : ''}`}
                    onClick={() => setRarity(id)}
                    style={
                      rarity === id
                        ? { background: RARITIES[id].color, color: '#0a0a0a' }
                        : undefined
                    }
                  >
                    <span
                      className="facet__dot"
                      style={{ ['--dot' as string]: RARITIES[id].color }}
                    />
                    {RARITIES[id].name}
                    <span style={{ color: 'inherit', opacity: 0.7 }}>{countByRarity[id]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {usedCountries.length > 1 && (
            <div className="coll-filters__row">
              <span className="coll-filters__label">Страны</span>
              <div className="toolbar" ref={countryRef}>
                <button
                  className={`pill-btn ${country === null ? 'pill-btn--active' : ''}`}
                  onClick={() => setCountry(null)}
                >
                  Все
                </button>
                {usedCountries.map((item) => (
                  <button
                    key={item.id}
                    className={`pill-btn ${country === item.id ? 'pill-btn--active' : ''}`}
                    onClick={() => setCountry(item.id)}
                  >
                    <Flag countryId={item.id} size={15} /> {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="coll-summary">
        <div className="coll-summary__top">
          <div className="coll-summary__count">
            {state.numbers.length}
            <small>SIM</small>
          </div>
          <div className="coll-summary__slots">
            мест {state.numbers.length} из {state.slots}
          </div>
        </div>

        <div className="coll-bar">
          {RARITY_ORDER.map((rarity) => {
            const share = state.numbers.length
              ? (countByRarity[rarity] / state.numbers.length) * 100
              : 0;
            if (share <= 0) return null;
            return (
              <div
                key={rarity}
                className="coll-bar__seg"
                style={{ width: `${share}%`, background: RARITIES[rarity].color }}
              />
            );
          })}
        </div>

        <div className="coll-facets">
          {RARITY_ORDER.filter((rarity) => countByRarity[rarity] > 0).map((rarity) => (
            <div key={rarity} className="facet">
              <span
                className="facet__dot"
                style={{ ['--dot' as string]: RARITIES[rarity].color }}
              />
              {RARITIES[rarity].name}
              <span className="facet__count">{countByRarity[rarity]}</span>
            </div>
          ))}
          <div className="facet">
            Портфель
            <span className="facet__count">{formatMoney(portfolioValue)} ₽</span>
          </div>
        </div>
      </div>

      <div className="search">
        <IconSearch size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти по цифрам"
          inputMode="numeric"
        />
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <div className="empty__title">
            {state.numbers.length === 0 ? 'Коллекция пуста' : 'Ничего не найдено'}
          </div>
          <div className="empty__hint">
            {state.numbers.length === 0
              ? 'Выпусти первую SIM — номера появятся здесь'
              : 'Попробуй снять фильтры или изменить запрос'}
          </div>
        </div>
      ) : grouped ? (
        <div className="groups">
          {groupedByCountry.map((group) => (
            <section className="group" key={group.country.id}>
              <div className="group__head">
                <Flag countryId={group.country.id} size={20} className="group__flag" />
                <span className="group__name">{group.country.name}</span>
                <span className="group__count">{group.numbers.length}</span>
                <span className="group__value">{formatMoney(group.value)} ₽</span>
              </div>
              <div className="num-grid">
                {group.numbers.map((number, index) => (
                  <NumberCard
                    key={number.id}
                    number={number}
                    index={index}
                    isPrimary={state.player.primaryNumberId === number.id}
                    rank={rankOf.get(number.id)}
                    onOpen={() => onOpenNumber(number.id)}
                    selecting={selecting}
                    selected={selected.includes(number.id)}
                    onToggle={() => toggleSelected(number.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="num-grid">
          {visible.map((number, index) => (
            <NumberCard
              key={number.id}
              number={number}
              index={index}
              isPrimary={state.player.primaryNumberId === number.id}
              rank={rankOf.get(number.id)}
              onOpen={() => onOpenNumber(number.id)}
              selecting={selecting}
              selected={selected.includes(number.id)}
              onToggle={() => toggleSelected(number.id)}
            />
          ))}
        </div>
      )}

      {/* Панель массовой продажи: появляется только в режиме выбора. */}
      {selecting && (
        <div className="bulk-bar">
          <div className="bulk-bar__info">
            <div className="bulk-bar__count">
              {selected.length > 0 ? `Выбрано ${selected.length}` : 'Ничего не выбрано'}
            </div>
            <div className="bulk-bar__sum">
              {selected.length > 0
                ? `выручка ${formatMoney(selectedSum)} ₽`
                : 'отметь номера галочками'}
            </div>
          </div>

          <button
            className="bulk-bar__all"
            onClick={() =>
              setSelected(
                selected.length >= sellable.length ? [] : sellable.map((number) => number.id),
              )
            }
          >
            {selected.length >= sellable.length && sellable.length > 0
              ? 'Снять всё'
              : 'Выбрать все'}
          </button>

          <button
            className={`bulk-bar__sell ${confirmStep === 1 ? 'bulk-bar__sell--confirm' : ''}`}
            disabled={selected.length === 0}
            onClick={() => void sellSelected()}
          >
            {confirmStep === 1 ? 'Точно продать?' : 'Продать'}
          </button>
        </div>
      )}
    </div>
  );
}

function NumberCard({
  number,
  index,
  isPrimary,
  rank,
  onOpen,
  selecting,
  selected,
  onToggle,
}: {
  number: PhoneNumber;
  index: number;
  isPrimary: boolean;
  /** Место среди номеров той же категории */
  rank?: { place: number; total: number };
  onOpen: () => void;
  /** Режим выбора: карточка помечается галочкой вместо перехода внутрь */
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const rarity = RARITIES[number.rarity];
  const operator = operatorById(number.operatorId);
  const locked = selecting && isPrimary;

  return (
    <button
      className={`num-card ${selected ? 'num-card--selected' : ''} ${
        locked ? 'num-card--locked' : ''
      }`}
      // В режиме выбора нажатие помечает номер, а не открывает его.
      onClick={selecting ? (locked ? undefined : onToggle) : onOpen}
      disabled={locked}
      // Волна появления: карточки проявляются по очереди, а не все разом.
      // Цвет категории задаёт полосу слева — дорогой номер видно в сетке.
      style={{
        ['--i' as string]: Math.min(index, 12),
        ['--card-accent' as string]: RARITIES[number.rarity].color,
      }}
    >
      {selecting && (
        <span className={`num-card__check ${selected ? 'num-card__check--on' : ''}`}>
          {locked ? '🔒' : selected ? '✓' : ''}
        </span>
      )}

      <div className="num-card__top">
        <span
          className="num-card__operator"
          style={{ ['--operator' as string]: operator.color }}
        >
          <span className="num-card__badge">{operator.badge}</span>
          {operator.name}
        </span>
        <span className="num-card__chip">
          <i />
        </span>
      </div>

      <div className="num-card__number">{number.display}</div>

      <div className="num-card__foot">
        <span
          className="num-card__rarity"
          style={{ ['--rarity' as string]: rarity.color }}
        >
          {rarity.name}
          {/* Место среди номеров той же категории, как в референсе */}
          {rank && rank.total > 1 && (
            <span className="num-card__rank">
              , {rank.place} из {rank.total}
            </span>
          )}
        </span>
        <span className="num-card__price">{formatMoney(number.finalPrice)} ₽</span>
      </div>

      {(isPrimary || number.patterns.length > 0) && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {isPrimary && (
            <span className="chip" style={{ fontSize: 10.5, padding: '3px 8px' }}>
              основной
            </span>
          )}
          {number.patterns.slice(0, 1).map((hit) => (
            <span
              key={hit.id}
              className="chip"
              style={{ fontSize: 10.5, padding: '3px 8px' }}
            >
              {hit.label}
            </span>
          ))}
          <span className="chip" style={{ fontSize: 10.5, padding: '3px 8px' }}>
            <Flag countryId={number.countryId} size={12} />
          </span>
        </div>
      )}
    </button>
  );
}

export function applyFilters(
  state: GameState,
  filters: { sort: SortKey; country: string | null; rarity: RarityId | null; query: string },
): PhoneNumber[] {
  const needle = filters.query.replace(/\D/g, '');
  let list = state.numbers.filter((number) => {
    if (filters.country && number.countryId !== filters.country) return false;
    if (filters.rarity && number.rarity !== filters.rarity) return false;
    if (needle && !number.digits.includes(needle) && !number.display.includes(filters.query.trim())) {
      return false;
    }
    return true;
  });

  const rarityWeight = (id: PhoneNumber['rarity']) => RARITY_ORDER.indexOf(id);
  list = [...list];
  switch (filters.sort) {
    case 'old':
      list.sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
      break;
    case 'price':
      list.sort((a, b) => b.finalPrice - a.finalPrice);
      break;
    case 'rarity':
      list.sort((a, b) => rarityWeight(b.rarity) - rarityWeight(a.rarity));
      break;
    case 'beauty':
      list.sort((a, b) => b.score - a.score);
      break;
    default:
      list.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }
  return list;
}