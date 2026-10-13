// language: TypeScript, file: frontend/src/screens/AdminScreen.tsx
// Админ-панель: тарифы, узоры, регионы, категории, статистика и журнал.
//
// Правки уходят на сервер и применяются немедленно — они влияют и на выпуск,
// и на витрину шансов, без перезапуска. Значения проверяет сервер; клиент
// показывает и пояснение отказа, и предупреждение до отправки.

import { useCallback, useEffect, useState } from 'react';
import {
  ANONYMOUS,
  ANONYMOUS_MAX_BATCH,
  RARITIES,
  TARIFFS,
  formatMoney,
} from '@ciferki/shared';
import type { RarityId } from '@ciferki/shared';
import {
  api,
  describeApiError,
  type AdminConfig,
  type AdminStats,
  type AnonymousNumber,
} from '../api';
import { Header } from '../components/Header';
import { Flag } from '../components/Flag';
import { Modal } from '../components/Modal';
import { IconTrend } from '../components/Icons';
import { formatDateTime } from '../utils/format';
import { useDragScroll } from '../hooks/useDragScroll';
import type { Game } from '../hooks/useGame';

type Tab =
  | 'tariffs'
  | 'patterns'
  | 'regions'
  | 'rarities'
  | 'anon'
  | 'promos'
  | 'stats'
  | 'audit';

const TABS: { id: Tab; label: string }[] = [
  { id: 'tariffs', label: 'Тарифы' },
  { id: 'patterns', label: 'Узоры' },
  { id: 'regions', label: 'Регионы' },
  { id: 'rarities', label: 'Категории' },
  { id: 'anon', label: 'Анонимные' },
  { id: 'promos', label: 'Промокоды' },
  { id: 'stats', label: 'Статистика' },
  { id: 'audit', label: 'Журнал' },
];

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;

interface NumberEditor {
  key: string;
  title: string;
  subtitle?: string;
  value: number;
  base: number;
  integer: boolean;
  max: number;
}

interface OddsEditor {
  tariffId: string;
  name: string;
  values: Record<string, number>;
}

interface AdminScreenProps {
  game: Game;
  onBack: () => void;
}

export function AdminScreen({ game, onBack }: AdminScreenProps) {
  const [tab, setTab] = useState<Tab>('tariffs');
  const tabsRef = useDragScroll<HTMLDivElement>();
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [numberEditor, setNumberEditor] = useState<NumberEditor | null>(null);
  const [oddsEditor, setOddsEditor] = useState<OddsEditor | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextConfig, nextStats] = await Promise.all([api.admin.config(), api.admin.stats()]);
      setConfig(nextConfig);
      setStats(nextStats);
    } catch (error) {
      game.notify(describeApiError(error), 'error');
    }
  }, [game]);

  useEffect(() => {
    if (game.mode === 'server') void load();
  }, [game.mode, load]);

  const isOverridden = (key: string): boolean =>
    Boolean(config && Object.prototype.hasOwnProperty.call(config.overrides, key));

  /** Общая обёртка: отправить правку, перечитать конфиг, сказать о результате. */
  const commit = useCallback(
    async (action: () => Promise<unknown>, successText: string) => {
      setBusy(true);
      try {
        await action();
        await load();
        game.notify(successText);
        return true;
      } catch (error) {
        game.notify(describeApiError(error), 'error');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [game, load],
  );

  if (game.mode !== 'server') {
    return (
      <div className="app app--admin">
        <Header {...headerProps(game, onBack)} />
        <h1 className="screen-title">Админка</h1>
        <div className="rows" style={{ padding: 18 }}>
          <div style={{ fontSize: 15, lineHeight: 1.5 }}>
            Панель работает только с сервером: параметры хранятся в базе и применяются
            на серверной стороне. Сейчас игра идёт в демо-режиме на локальном сохранении.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app app--admin">
      <Header {...headerProps(game, onBack)} />
      <h1 className="screen-title">Админка</h1>

      {/* Вкладки тянем мышью: на компьютере браузер сам этого не делает. */}
      <div className="admin-tabs" ref={tabsRef}>
        {TABS.map((item) => (
          <button
            key={item.id}
            className={`pill-btn ${tab === item.id ? 'pill-btn--active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!config ? (
        <div className="estimate" style={{ padding: '40px 0' }}>
          <div className="estimate__label">Загружаю параметры…</div>
        </div>
      ) : (
        <>
          {tab === 'tariffs' && (
            <TariffsTab
              config={config}
              isOverridden={isOverridden}
              onEditPrice={(tariff) =>
                setNumberEditor({
                  key: `tariff.${tariff.id}.price`,
                  title: `Цена · ${tariff.name}`,
                  subtitle: 'Списывается при выпуске SIM этого тарифа',
                  value: Number(tariff.price ?? 0),
                  base: Number(config.base.tariffPrice[tariff.id] ?? 0),
                  integer: true,
                  max: 100_000_000,
                })
              }
              onEditOdds={(tariff) =>
                setOddsEditor({
                  tariffId: tariff.id,
                  name: tariff.name,
                  values: Object.fromEntries(
                    RARITY_ORDER.map((rarity) => [rarity, tariff.odds[rarity] ?? 0]),
                  ),
                })
              }
              onClear={(key) => void commit(() => api.admin.clear(key), 'Возвращено к базовому')}
            />
          )}

          {tab === 'patterns' && (
            <Section title="Очки за узоры" note="Сколько очков даёт каждый найденный рисунок">
              {config.patterns.map((pattern) => {
                const key = `pattern.${pattern.id}`;
                return (
                  <Row
                    key={pattern.id}
                    label={PATTERN_LABEL[pattern.id] ?? pattern.id}
                    hint={key}
                    value={`${pattern.points} очк.`}
                    overridden={isOverridden(key)}
                    base={config.base.patternPoints[pattern.id]}
                    onEdit={() =>
                      setNumberEditor({
                        key,
                        title: PATTERN_LABEL[pattern.id] ?? pattern.id,
                        subtitle: 'Очки за найденный узор',
                        value: pattern.points,
                        base: config.base.patternPoints[pattern.id] ?? 0,
                        integer: true,
                        max: 100_000,
                      })
                    }
                    onClear={() => void commit(() => api.admin.clear(key), 'Возвращено к базовому')}
                  />
                );
              })}
            </Section>
          )}

          {tab === 'regions' && (
            <Section title="Спрос регионов" note="Множитель к оценке номера из этого региона">
              {config.regions.map((region) => {
                const key = `region.${region.id}`;
                return (
                  <Row
                    key={region.id}
                    label={
                      <span className="admin-region">
                        <Flag countryId={region.id} size={16} />
                        {region.name}
                      </span>
                    }
                    hint={`${region.code ?? ''} · операторов ${region.operators ?? '—'}`}
                    value={`×${String(region.demand).replace('.', ',')}`}
                    overridden={isOverridden(key)}
                    base={config.base.regionDemand[region.id]}
                    onEdit={() =>
                      setNumberEditor({
                        key,
                        title: `Спрос · ${region.name}`,
                        subtitle: 'Множитель в формуле цены, от 0 до 10',
                        value: region.demand,
                        base: config.base.regionDemand[region.id] ?? 1,
                        integer: false,
                        max: 10,
                      })
                    }
                    onClear={() => void commit(() => api.admin.clear(key), 'Возвращено к базовому')}
                  />
                );
              })}
            </Section>
          )}

          {tab === 'rarities' && (
            <Section title="Базовые цены категорий" note="Основа формулы: база × узор × спрос">
              {config.rarities.map((rarity) => {
                const key = `rarity.${rarity.id}.basePrice`;
                return (
                  <Row
                    key={rarity.id}
                    label={rarity.name}
                    hint={key}
                    value={`${formatMoney(rarity.basePrice)} ₽`}
                    accent={RARITIES[rarity.id as keyof typeof RARITIES]?.color}
                    overridden={isOverridden(key)}
                    base={config.base.rarityBasePrice[rarity.id]}
                    onEdit={() =>
                      setNumberEditor({
                        key,
                        title: `База · ${rarity.name}`,
                        subtitle: 'Стоимость до множителя узора и спроса',
                        value: rarity.basePrice,
                        base: config.base.rarityBasePrice[rarity.id] ?? 0,
                        integer: true,
                        max: 1_000_000_000,
                      })
                    }
                    onClear={() => void commit(() => api.admin.clear(key), 'Возвращено к базовому')}
                  />
                );
              })}
            </Section>
          )}

          {tab === 'anon' && (
            <AnonymousPanel game={game} />
          )}

          {tab === 'promos' && <PromoPanel />}



          {tab === 'stats' && stats && (
            <>
              <div className="admin-grid">
                <Stat value={String(stats.players)} label="игроков" />
                <Stat value={String(stats.numbers)} label="номеров выпущено" />
                <Stat value={String(stats.releases)} label="выпусков" />
                <Stat value={`${formatMoney(stats.averagePrice)} ₽`} label="средняя цена" />
                <Stat value={`${formatMoney(stats.portfolioValue)} ₽`} label="сумма коллекций" />
                <Stat value={String(Object.keys(stats.byRarity).length)} label="категорий в обороте" />
              </div>

              <Section title="Категории" note="Сколько номеров каждой категории выпущено">
                {RARITY_ORDER.map((rarity) => (
                  <div className="admin-row" key={rarity}>
                    <span
                      className="row__icon"
                      style={{ background: RARITIES[rarity].color, color: '#fff' }}
                    >
                      <IconTrend size={16} />
                    </span>
                    <span className="admin-row__body">
                      <span className="admin-row__label">{RARITIES[rarity].name}</span>
                    </span>
                    <span className="admin-row__value">{stats.byRarity[rarity] ?? 0}</span>
                  </div>
                ))}
              </Section>
            </>
          )}

          {tab === 'audit' && stats && (
            <Section title="Журнал" note="Действия администраторов и ошибки сервера">
              {stats.recentAudit.length === 0 ? (
                <div className="admin-row">
                  <span className="admin-row__body">
                    <span className="admin-row__hint">Пока пусто</span>
                  </span>
                </div>
              ) : (
                stats.recentAudit.map((entry) => (
                  <div className="admin-row" key={entry.id}>
                    <span className="admin-row__body">
                      <span className="admin-row__label">
                        {entry.action}
                        {entry.actorId !== null && (
                          <span className="admin-badge">id {entry.actorId}</span>
                        )}
                      </span>
                      <span className="admin-row__hint">
                        {formatDateTime(entry.createdAt)} · {summarize(entry.payload)}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </Section>
          )}
        </>
      )}

      {numberEditor && (
        <NumberModal
          editor={numberEditor}
          busy={busy}
          onChange={(value) => setNumberEditor({ ...numberEditor, value })}
          onClose={() => setNumberEditor(null)}
          onSave={async () => {
            const ok = await commit(
              () => api.admin.set(numberEditor.key, numberEditor.value),
              'Параметр обновлён',
            );
            if (ok) setNumberEditor(null);
          }}
          onClear={async () => {
            const ok = await commit(
              () => api.admin.clear(numberEditor.key),
              'Возвращено к базовому',
            );
            if (ok) setNumberEditor(null);
          }}
        />
      )}

      {oddsEditor && (
        <OddsModal
          editor={oddsEditor}
          busy={busy}
          onChange={(values) => setOddsEditor({ ...oddsEditor, values })}
          onClose={() => setOddsEditor(null)}
          onSave={async () => {
            const ok = await commit(
              () => api.admin.set(`tariff.${oddsEditor.tariffId}.odds`, oddsEditor.values),
              'Вероятности обновлены',
            );
            if (ok) setOddsEditor(null);
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── АНОНИМНЫЕ НОМЕРА ─────────────────────────── */

/**
 * Выдача анонимных номеров +888.
 *
 * Анонимный номер нельзя выпустить обычным путём: у него нет ни страны, ни
 * оператора. Поэтому он выдаётся отсюда — бесплатно, для проверки витрины,
 * коллекции и карточки номера. Цена у него случайная: генератор тянет
 * коэффициент от 3 до 12, поэтому две «обычные» анонимки стоят по-разному.
 */
function AnonymousPanel({ game }: { game: Game }) {
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<AnonymousNumber[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mine = game.state.numbers.filter((number) => number.countryId === ANONYMOUS.id);

  const give = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.admin.anonymous(count);
      setIssued(response.numbers ?? []);
      await game.refresh();
    } catch (failure) {
      setError(describeApiError(failure));
      setIssued([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section
        title="Анонимный номер +888"
        note="Выдаётся бесплатно для проверки. Обычным выпуском его получить нельзя"
      >
        <div className="anon-note">
          <div className="anon-note__row">
            <span>Категория</span>
            <span>по лучшим шансам игры — как у тарифа «{TARIFFS.premium.name}»</span>
          </div>
          <div className="anon-note__row">
            <span>Цена</span>
            <span>
              база категории × узор × случайный коэффициент{' '}
              <b>
                {ANONYMOUS.minCoefficient}–{ANONYMOUS.maxCoefficient}
              </b>
            </span>
          </div>
          <div className="anon-note__row">
            <span>Страна и оператор</span>
            <span>нет — номер ничей, поэтому и анонимный</span>
          </div>
        </div>

        <div className="anon-picker">
          {[1, 2, 3, 5].map((value) => (
            <button
              key={value}
              className={`pill-btn ${count === value ? 'pill-btn--active' : ''}`}
              onClick={() => setCount(value)}
            >
              {value}
            </button>
          ))}
          <span className="anon-picker__hint">за раз, максимум {ANONYMOUS_MAX_BATCH}</span>
        </div>

        <button className="choose-btn" disabled={busy} onClick={() => void give()}>
          <span>{busy ? 'Выдаём…' : `Выдать ${count} шт.`}</span>
          <span className="choose-btn__side">бесплатно</span>
        </button>

        {error && <div className="admin-error">{error}</div>}

        {issued.length > 0 && (
          <div className="anon-issued">
            {issued.map((number) => (
              <div className="anon-issued__row" key={number.id}>
                <span
                  className="anon-issued__dot"
                  style={{ background: RARITIES[number.rarity as RarityId]?.color ?? '#888' }}
                />
                <span className="anon-issued__number">{number.display}</span>
                <span className="anon-issued__rarity">
                  {RARITIES[number.rarity as RarityId]?.name ?? number.rarity} · {number.score} очк.
                </span>
                <span className="anon-issued__price">{formatMoney(number.finalPrice)} ₽</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="В коллекции"
        note={`Анонимных номеров: ${mine.length} из ${game.state.numbers.length}`}
      >
        {mine.length === 0 ? (
          <div className="admin-row">
            <span className="admin-row__body">
              <span className="admin-row__hint">
                Пока ни одного. Выдай один — он появится в коллекции отдельной группой.
              </span>
            </span>
          </div>
        ) : (
          mine.slice(0, 12).map((number) => (
            <div className="admin-row" key={number.id}>
              <span
                className="row__icon"
                style={{ background: RARITIES[number.rarity].color, color: '#fff' }}
              >
                +
              </span>
              <span className="admin-row__body">
                <span className="admin-row__label">{number.display}</span>
                <span className="admin-row__hint">
                  {RARITIES[number.rarity].name} · {number.score} очков · коэффициент ×
                  {String(number.demandMultiplier).replace('.', ',')}
                </span>
              </span>
              <span className="admin-row__value">{formatMoney(number.finalPrice)} ₽</span>
            </div>
          ))
        )}
      </Section>
    </>
  );
}

/* ─────────────────────────── ВКЛАДКИ ─────────────────────────── */

function TariffsTab({
  config,
  isOverridden,
  onEditPrice,
  onEditOdds,
  onClear,
}: {
  config: AdminConfig;
  isOverridden: (key: string) => boolean;
  onEditPrice: (tariff: AdminConfig['tariffs'][number]) => void;
  onEditOdds: (tariff: AdminConfig['tariffs'][number]) => void;
  onClear: (key: string) => void;
}) {
  return (
    <Section title="Тарифы" note="Цена выпуска и распределение категорий">
      {config.tariffs.map((tariff) => {
        const priceKey = `tariff.${tariff.id}.price`;
        const oddsKey = `tariff.${tariff.id}.odds`;
        const share =
          (tariff.odds.rare ?? 0) +
          (tariff.odds.epic ?? 0) +
          (tariff.odds.legendary ?? 0) +
          (tariff.odds.mythic ?? 0);

        return (
          <div key={tariff.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Row
              label={tariff.name}
              hint={priceKey}
              value={tariff.price === null ? 'по билету' : `${formatMoney(tariff.price)} ₽`}
              overridden={isOverridden(priceKey)}
              base={config.base.tariffPrice[tariff.id] ?? undefined}
              onEdit={tariff.price === null ? undefined : () => onEditPrice(tariff)}
              onClear={() => onClear(priceKey)}
            />
            <Row
              label="Вероятности"
              hint={`редкий и выше ${share.toFixed(1).replace('.', ',')} %`}
              value="изменить"
              overridden={isOverridden(oddsKey)}
              onEdit={() => onEditOdds(tariff)}
              onClear={() => onClear(oddsKey)}
            />
          </div>
        );
      })}
    </Section>
  );
}

/* ─────────────────────────── ПРОМОКОДЫ ─────────────────────────── */

interface AdminPromo {
  code: string;
  title: string;
  note: string;
  kind: string;
  reward: string;
  limit: number | null;
  until: string | null;
  custom: boolean;
  used: number;
}

const REWARD_KINDS = [
  { id: 'money', label: 'Деньги', unit: '₽' },
  { id: 'tickets', label: 'Билеты', unit: 'шт' },
  { id: 'releases', label: 'Выпуски', unit: 'шт' },
  { id: 'luck', label: 'Удача', unit: '×' },
];

/**
 * Создание промокодов.
 *
 * Код латиницей и без обязательных заглавных: сравнение идёт без учёта
 * регистра, поэтому `summer25` и `SUMMER25` — один и тот же код.
 */
function PromoPanel() {
  const [data, setData] = useState<{ builtin: AdminPromo[]; custom: AdminPromo[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('money');
  const [amount, setAmount] = useState('25000');
  const [limit, setLimit] = useState('');
  const [until, setUntil] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.adminPromos());
    } catch (failure) {
      setError(describeApiError(failure));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      const result = await api.adminCreatePromo({
        code,
        title,
        kind,
        amount: Number(amount) || 1,
        limit: limit.trim() === '' ? null : Number(limit),
        until: until.trim() === '' ? null : until.trim(),
      });
      if (!result.ok) {
        setError(result.error ?? 'Не получилось');
        return;
      }
      setFlash(`Код ${result.promo?.code} создан`);
      setCode('');
      setTitle('');
      await load();
    } catch (failure) {
      setError(describeApiError(failure));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (target: string) => {
    try {
      await api.adminDeletePromo(target);
      setFlash(`Код ${target} удалён`);
      await load();
    } catch (failure) {
      setError(describeApiError(failure));
    }
  };

  const unit = REWARD_KINDS.find((item) => item.id === kind)?.unit ?? '';

  return (
    <>
      <Section title="Новый промокод" note="Код латиницей: регистр не важен, summer25 и SUMMER25 — одно и то же.">
        <div className="promo-form">
          <label className="promo-form__field">
            <span>Код</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="summer25"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <label className="promo-form__field">
            <span>Название</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Летняя акция"
            />
          </label>

          <div className="promo-form__field">
            <span>Награда</span>
            <div className="promo-form__kinds">
              {REWARD_KINDS.map((item) => (
                <button
                  key={item.id}
                  className={`pill-btn ${kind === item.id ? 'pill-btn--active' : ''}`}
                  onClick={() => {
                    setKind(item.id);
                    setAmount(item.id === 'money' ? '25000' : item.id === 'luck' ? '3' : '1');
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <label className="promo-form__field">
            <span>Сколько, {unit}</span>
            <input
              value={amount}
              inputMode="numeric"
              onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
            />
          </label>

          <label className="promo-form__field">
            <span>Тираж (пусто — без ограничения)</span>
            <input
              value={limit}
              inputMode="numeric"
              placeholder="500"
              onChange={(event) => setLimit(event.target.value.replace(/\D/g, ''))}
            />
          </label>

          <label className="promo-form__field">
            <span>Действует до (пусто — бессрочно)</span>
            <input type="date" value={until} onChange={(event) => setUntil(event.target.value)} />
          </label>

          <button
            className="choose-btn"
            disabled={busy || code.trim().length < 3}
            style={busy || code.trim().length < 3 ? { opacity: 0.5 } : undefined}
            onClick={() => void create()}
          >
            <span>{busy ? 'Создаём…' : 'Создать код'}</span>
          </button>
        </div>

        {error && <div className="admin-error">{error}</div>}
        {flash && <div className="admin-flash">{flash}</div>}
      </Section>

      <Section title={`Свои коды · ${data?.custom.length ?? 0}`} note="Созданы здесь. Их можно удалить.">
        {(data?.custom.length ?? 0) === 0 ? (
          <div className="admin-note">Пока ни одного своего кода.</div>
        ) : (
          data!.custom.map((promo) => (
            <div className="admin-promo" key={promo.code}>
              <div className="admin-promo__head">
                <span className="admin-promo__code">{promo.code}</span>
                <span className="admin-promo__limit">
                  {promo.limit === null ? `погашен ${promo.used} раз` : `${promo.used} / ${promo.limit}`}
                </span>
              </div>
              <div className="admin-promo__title">{promo.title}</div>
              <div className="admin-promo__reward">{promo.reward}</div>
              {promo.until && <div className="admin-promo__until">до {promo.until}</div>}
              <button className="row__action" onClick={() => void remove(promo.code)}>
                Удалить
              </button>
            </div>
          ))
        )}
      </Section>

      <Section title={`Зашиты в игру · ${data?.builtin.length ?? 0}`} note="Постоянные коды. Удалить их нельзя.">
        {data?.builtin.map((promo) => (
          <div className="admin-promo" key={promo.code}>
            <div className="admin-promo__head">
              <span className="admin-promo__code">{promo.code}</span>
              <span className="admin-promo__limit">
                {promo.limit === null ? `погашен ${promo.used} раз` : `${promo.used} / ${promo.limit}`}
              </span>
            </div>
            <div className="admin-promo__title">{promo.title}</div>
            <div className="admin-promo__reward">{promo.reward}</div>
          </div>
        ))}
      </Section>
    </>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section" style={{ marginTop: 0 }}>
      <h2 className="section__title" style={{ fontSize: 20 }}>
        {title}
      </h2>
      <div className="action-note" style={{ textAlign: 'left', paddingBottom: 8 }}>
        {note}
      </div>
      <div className="rows">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  value,
  base,
  accent,
  overridden,
  onEdit,
  onClear,
}: {
  /** Строкой или узлом: в строке регионов нужен флаг рядом с названием */
  label: React.ReactNode;
  hint: string;
  value: string;
  base?: number | null;
  accent?: string;
  overridden: boolean;
  onEdit?: () => void;
  onClear: () => void;
}) {
  return (
    <div className="admin-row">
      {accent && (
        <span className="row__icon" style={{ background: accent, color: '#fff' }}>
          <IconTrend size={16} />
        </span>
      )}
      <button
        className="admin-row__body"
        onClick={onEdit}
        disabled={!onEdit}
        style={{ textAlign: 'left', opacity: onEdit ? 1 : 0.6 }}
      >
        <span className="admin-row__label">
          {label}
          {overridden && <span className="admin-badge">изменено</span>}
        </span>
        <span className="admin-row__hint">{hint}</span>
      </button>
      <span className="admin-row__value">
        {value}
        {overridden && base !== undefined && base !== null && (
          <span className="admin-row__base">
            {typeof base === 'number' && base > 1000 ? formatMoney(base) : base}
          </span>
        )}
      </span>
      {overridden && (
        <button
          className="pill-btn"
          onClick={onClear}
          style={{ padding: '6px 10px', fontSize: 12 }}
        >
          сбросить
        </button>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat__value">{value}</div>
      <div className="admin-stat__label">{label}</div>
    </div>
  );
}

/* ─────────────────────────── РЕДАКТОРЫ ─────────────────────────── */

function NumberModal({
  editor,
  busy,
  onChange,
  onClose,
  onSave,
  onClear,
}: {
  editor: NumberEditor;
  busy: boolean;
  onChange: (value: number) => void;
  onClose: () => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const valid =
    Number.isFinite(editor.value) && editor.value > 0 && editor.value <= editor.max &&
    (!editor.integer || Number.isInteger(editor.value));

  return (
    <Modal
      title={editor.title}
      subtitle={editor.subtitle}
      onClose={onClose}
      footer={
        <>
          <button
            className="choose-btn"
            style={!valid || busy ? { opacity: 0.5 } : undefined}
            disabled={!valid || busy}
            onClick={onSave}
          >
            <span>Сохранить</span>
            <span className="choose-btn__side">сейчас {String(editor.base).replace('.', ',')}</span>
          </button>
          <div className="admin-actions">
            <button className="action-btn" onClick={onClear} disabled={busy}>
              Сбросить к базовому
            </button>
          </div>
        </>
      }
    >
      <input
        className="admin-input"
        type="text"
        inputMode="decimal"
        value={String(editor.value)}
        onChange={(event) => {
          const raw = event.target.value.replace(',', '.').replace(/[^\d.]/g, '');
          onChange(raw === '' ? 0 : Number(raw));
        }}
      />
      <div className={`admin-sum ${valid ? 'admin-sum--ok' : 'admin-sum--bad'}`}>
        {valid
          ? editor.integer
            ? `Целое число, максимум ${editor.max}`
            : `Допустимо от 0 до ${editor.max}`
          : editor.integer
            ? `Нужно целое положительное число, не больше ${editor.max}`
            : `Нужно число больше 0 и не больше ${editor.max}`}
      </div>
      <div className="action-note">
        Проверку повторит сервер: некорректное значение не сохранится.
      </div>
    </Modal>
  );
}

function OddsModal({
  editor,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  editor: OddsEditor;
  busy: boolean;
  onChange: (values: Record<string, number>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const sum = RARITY_ORDER.reduce((total, rarity) => total + (editor.values[rarity] ?? 0), 0);
  const valid = Math.abs(sum - 100) < 0.001;

  return (
    <Modal
      title={`Вероятности · ${editor.name}`}
      subtitle="Сумма всех категорий должна быть ровно 100 %"
      onClose={onClose}
      footer={
        <button
          className="choose-btn"
          style={!valid || busy ? { opacity: 0.5 } : undefined}
          disabled={!valid || busy}
          onClick={onSave}
        >
          <span>Сохранить</span>
          <span className="choose-btn__side">
            {sum.toFixed(3).replace('.', ',')} %
          </span>
        </button>
      }
    >
      <div className="rows">
        {RARITY_ORDER.map((rarity) => (
          <div className="admin-row" key={rarity}>
            <span
              className="row__icon"
              style={{ background: RARITIES[rarity].color, color: '#fff' }}
            >
              <IconTrend size={16} />
            </span>
            <span className="admin-row__body">
              <span className="admin-row__label">{RARITIES[rarity].name}</span>
            </span>
            <input
              className="admin-input"
              style={{ width: 96, padding: '10px 8px', fontSize: 16 }}
              type="text"
              inputMode="decimal"
              value={String(editor.values[rarity] ?? 0)}
              onChange={(event) => {
                const raw = event.target.value.replace(',', '.').replace(/[^\d.]/g, '');
                onChange({ ...editor.values, [rarity]: raw === '' ? 0 : Number(raw) });
              }}
            />
            <span className="admin-row__value" style={{ width: 22 }}>
              %
            </span>
          </div>
        ))}
      </div>

      <div className={`admin-sum ${valid ? 'admin-sum--ok' : 'admin-sum--bad'}`}>
        {valid
          ? 'Сумма сходится — можно сохранять'
          : `Сумма ${sum.toFixed(3).replace('.', ',')} %, нужно ровно 100 %`}
      </div>
      <div className="action-note">
        Удача умножает шансы редких категорий, после чего распределение нормализуется
        обратно к 100 %. Здесь задаются базовые значения — без удачи.
      </div>
    </Modal>
  );
}

/* ─────────────────────────── МЕЛОЧИ ─────────────────────────── */

const PATTERN_LABEL: Record<string, string> = {
  all_same: 'Все цифры одинаковые',
  keypad_line: 'Линия по клавиатуре',
  twin_ends: 'Одинаковые края',
  aabb: 'Двойные пары',
  zero_run: 'Нули подряд',
  ladderLong: 'Длинная лесенка',
  almost_same: 'Почти одна цифра',
  date: 'Дата',
  palindrome: 'Палиндром',
  alternating: 'Чередование',
  block_repeat: 'Повтор блока',
  mirror: 'Зеркало',
  prefix_echo: 'Эхо префикса',
  prefix_repeat: 'Повтор в префиксе',
  ladder_up: 'Лесенка вверх (за цифру)',
  ladder_down: 'Лесенка вниз (за цифру)',
  pairs: 'Пары (за пару)',
  series: 'Серия (за цифру)',
  round: 'Круглый',
  country_code: 'Код страны',
};

/** Короткое описание полезной нагрузки записи журнала. */
function summarize(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return String(payload ?? '');
  const record = payload as Record<string, unknown>;
  if ('key' in record) return `${record.key} → ${JSON.stringify(record.value ?? '—')}`;
  if ('path' in record) return `${record.path} · ${record.message ?? ''}`;
  return JSON.stringify(record).slice(0, 80);
}

function headerProps(game: Game, onBack: () => void) {
  return {
    level: game.state.player.level,
    levelProgress: game.levelProgress,
    balance: game.state.player.balance,
    avatarUrl: game.state.player.avatarUrl,
    name: game.state.player.name,
    onBack,
  };
}
