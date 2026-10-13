// language: TypeScript, file: frontend/src/components/MenuDrawer.tsx
// Боковое меню: сетка быстрых разделов, магазин и список «Ещё».
// Пункты, у которых экрана пока нет, помечены честно и не притворяются рабочими.

import { RARITIES, RARITY_ORDER, TARIFFS, formatMoney } from '@ciferki/shared';
import {
  IconAuction,
  IconChannel,
  IconChances,
  IconSearch,
  IconCollection,
  IconDeals,
  IconFriends,
  IconGift,
  IconHistory,
  IconMarket,
  IconPhone,
  IconProfile,
  IconPromo,
  IconRating,
  IconRoulette,
  IconRules,
  IconShop,
  IconSkills,
} from './Icons';
import { formatShortDuration } from '../utils/format';
import type { Game } from '../hooks/useGame';
import type { ReactNode } from 'react';

export type MenuTarget =
  | 'home'
  | 'collection'
  | 'history'
  | 'profile'
  | 'rules'
  | 'settings'
  | 'chances'
  | 'quests'
  | 'achievements'
  | 'rating'
  | 'market'
  | 'auction'
  | 'deals'
  | 'phones'
  | 'roulette'
  | 'skills'
  | 'friends'
  | 'shops'
  | 'promo'
  | 'channel'
  | 'checker'
  | 'shop'
  | 'admin';

/** Все пункты меню списком: тест проверяет, что каждый куда-то ведёт. */
export const MENU_TARGETS: MenuTarget[] = [
  'home',
  'collection',
  'history',
  'profile',
  'rules',
  'settings',
  'chances',
  'quests',
  'achievements',
  'rating',
  'market',
  'auction',
  'deals',
  'phones',
  'roulette',
  'skills',
  'friends',
  'shops',
  'promo',
  'channel',
  'checker',
  'shop',
  'admin',
];

/**
 * Пункты, которые ещё не готовы: показываем «скоро» и приглушаем.
 *
 * Список один на всё меню, и тест сверяет его с рабочими экранами. Иначе
 * получается ровно то, что уже случалось: экран сделан, а плитка в меню
 * по-прежнему серая и подписана «скоро».
 */
export const SOON_TARGETS: MenuTarget[] = [
  'skills',
  'market',
  'auction',
  'deals',
  'phones',
  'friends',
  'channel',
];

/** Готов ли раздел. */
export function isSoon(target: MenuTarget): boolean {
  return SOON_TARGETS.includes(target);
}

interface MenuDrawerProps {
  game: Game;
  onClose: () => void;
  onGo: (target: MenuTarget) => void;
}

export function MenuDrawer({ game, onClose, onGo }: MenuDrawerProps) {
  const { state, countByRarity, portfolioValue, luckRemainingMs } = game;
  const tariff = TARIFFS[state.selectedTariff];

  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer__panel" onClick={(event) => event.stopPropagation()}>
        <div className="header" style={{ paddingBottom: 12 }}>
          <div className="header__avatar">
            {state.player.avatarUrl ? (
              <img src={state.player.avatarUrl} alt={state.player.name} />
            ) : (
              state.player.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{state.player.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
              Ур. {state.player.level} · {state.numbers.length} SIM
            </div>
          </div>
          <div className="header__balance" style={{ fontSize: 17 }}>
            {formatMoney(state.player.balance)} ₽
          </div>
        </div>

        <div className="menu-grid">
          <Tile icon={<IconCollection size={19} />} bg="#0EA5E9" label="Коллекция" onClick={() => onGo('collection')} />
          <Tile icon={<IconRoulette size={19} />} bg="#F59E0B" label="Рулетка" onClick={() => onGo('roulette')} />
          <Tile icon={<IconGift size={19} />} bg="#EF4444" label="Награды" onClick={() => onGo('quests')} />
          <Tile icon={<IconSkills size={19} />} bg="#A855F7" label="Навыки" onClick={() => onGo('skills')} soon={isSoon('skills')} />
          <Tile icon={<IconMarket size={19} />} bg="#22C55E" label="Рынок" onClick={() => onGo('market')} soon={isSoon('market')} />
          <Tile icon={<IconAuction size={19} />} bg="#8B5CF6" label="Аукцион" onClick={() => onGo('auction')} soon={isSoon('auction')} />
          <Tile icon={<IconDeals size={19} />} bg="#14B8A6" label="Сделки" onClick={() => onGo('deals')} soon={isSoon('deals')} />
          <Tile icon={<IconPhone size={19} />} bg="#F97316" label="Телефоны" onClick={() => onGo('phones')} soon={isSoon('phones')} />
        </div>

        <div className="rows" style={{ marginBottom: 12 }}>
          <button className="row" onClick={() => onGo('quests')}>
            <span className="row__icon" style={{ background: '#F59E0B', color: '#1a1400' }}>
              <IconGift size={17} />
            </span>
            <span className="row__body">
              <span className="row__label">Пропуск · ур. {state.player.level}</span>
              <span className="row__hint">награды за уровень</span>
            </span>
            <span className="row__value row__value--accent">
              {state.player.xp} / {game.levelXp} XP
            </span>
          </button>
        </div>

        <button className="promo-banner" style={{ width: '100%' }} onClick={() => onGo('shop')}>
          <span className="promo-banner__icon">
            <IconShop size={19} color="#1a1400" />
          </span>
          <span className="row__body" style={{ textAlign: 'left' }}>
            <span className="row__label">Магазин</span>
            <span className="row__hint">оформление, крутки, удача, VIP</span>
          </span>
        </button>

        <div className="section" style={{ marginTop: 0 }}>
          <div className="section__title" style={{ fontSize: 20 }}>
            Сейчас
          </div>
          <div className="rows">
            <SummaryRow
              icon={<IconGift size={17} />}
              bg="#EF4444"
              label="Награда дня"
              value={`серия ${state.player.dailyStreak} дн.`}
              onClick={() => onGo('quests')}
            />
            <SummaryRow
              icon={<IconChances size={17} />}
              bg="#F59E0B"
              label="Удача"
              value={
                luckRemainingMs > 0
                  ? `×${game.luck} через ${formatShortDuration(luckRemainingMs)}`
                  : 'не активна'
              }
              onClick={() => onGo('chances')}
            />
            <SummaryRow
              icon={<IconHistory size={17} />}
              bg="#8B5CF6"
              label="История"
              value={`${state.ledger.length} операций`}
              onClick={() => onGo('history')}
            />
            <SummaryRow
              icon={<IconSkills size={17} />}
              bg="#A855F7"
              label="Уровень"
              value={`${state.player.level} · ещё ${game.levelXp - state.player.xp} XP`}
              onClick={() => onGo('profile')}
            />
          </div>
        </div>

        <div className="section">
          <div className="section__title" style={{ fontSize: 20 }}>
            Ещё
          </div>
          <div className="rows">
            {game.isAdmin && (
              <SummaryRow
                icon={<IconShop size={17} />}
                bg="#F0B90B"
                label="Админка"
                value="параметры игры"
                onClick={() => onGo('admin')}
              />
            )}
            <SummaryRow icon={<IconProfile size={17} />} bg="#0EA5E9" label="Профиль" onClick={() => onGo('profile')} />
            <SummaryRow icon={<IconFriends size={17} />} bg="#EF4444" label="Друзья" onClick={() => onGo('friends')} soon={isSoon('friends')} />
            <SummaryRow icon={<IconRating size={17} />} bg="#F59E0B" label="Рейтинг" onClick={() => onGo('rating')} />
            <SummaryRow icon={<IconChances size={17} />} bg="#3B82F6" label="Шансы" onClick={() => onGo('chances')} />
            <SummaryRow icon={<IconHistory size={17} />} bg="#8B5CF6" label="История" onClick={() => onGo('history')} />
            <SummaryRow
              icon={<IconSearch size={17} />}
              bg="#14B8A6"
              label="Проверка номера"
              value="свободен или занят"
              onClick={() => onGo('checker')}
            />
            <SummaryRow icon={<IconPromo size={17} />} bg="#A855F7" label="Промокод" onClick={() => onGo('promo')} soon={isSoon('promo')} />
            <SummaryRow icon={<IconRules size={17} />} bg="#EF4444" label="Правила" onClick={() => onGo('rules')} />
            <SummaryRow icon={<IconShop size={17} />} bg="#8E8E93" label="Настройки" onClick={() => onGo('settings')} />
            <SummaryRow icon={<IconChannel size={17} />} bg="#0EA5E9" label="Канал" onClick={() => onGo('channel')} soon={isSoon('channel')} />
          </div>
        </div>

        <div className="section" style={{ paddingBottom: 20 }}>
          <div className="rows">
            <button className="row" onClick={() => onGo('collection')}>
              <span className="row__icon" style={{ background: 'var(--surface-3)' }}>
                <IconCollection size={17} />
              </span>
              <span className="row__body">
                <span className="row__label">
                  Портфель: {formatMoney(portfolioValue)} ₽
                </span>
                <span className="row__hint">
                  {RARITY_ORDER.filter((rarity) => countByRarity[rarity] > 0)
                    .map((rarity) => `${RARITIES[rarity].name} ${countByRarity[rarity]}`)
                    .join(' · ') || 'пока пусто'}
                </span>
              </span>
              <span className="row__value">Тариф {tariff.name}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({
  icon,
  bg,
  label,
  onClick,
  soon,
}: {
  icon: ReactNode;
  bg: string;
  label: string;
  onClick: () => void;
  soon?: boolean;
}) {
  return (
    <button className="menu-tile" onClick={onClick} style={{ opacity: soon ? 0.6 : 1 }}>
      <span className="menu-tile__icon" style={{ background: bg, color: '#fff' }}>
        {icon}
      </span>
      <span>
        {label}
        {soon && (
          <span style={{ display: 'block', fontSize: 9.5, color: 'var(--text-faint)' }}>
            скоро
          </span>
        )}
      </span>
    </button>
  );
}

function SummaryRow({
  icon,
  bg,
  label,
  value,
  onClick,
  soon,
}: {
  icon: ReactNode;
  bg: string;
  label: string;
  value?: string;
  onClick: () => void;
  soon?: boolean;
}) {
  return (
    <button className="row" onClick={onClick}>
      <span className="row__icon" style={{ background: bg, color: '#fff' }}>
        {icon}
      </span>
      <span className="row__body">
        <span className="row__label">{label}</span>
      </span>
      <span className="row__value">{soon ? 'скоро' : value ?? '›'}</span>
    </button>
  );
}
