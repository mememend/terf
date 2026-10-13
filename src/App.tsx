// language: TypeScript, file: frontend/src/App.tsx
// Точка сборки: главный экран, экраны разделов и модальные окна.
// Никаких пустых переходов — каждый пункт меню ведёт на работающий экран
// либо на честную заглушку с описанием того, что появится позже.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from './hooks/useGame';
import { bindBackButton, hapticImpact, initTelegram } from './telegram';
import { HomeScreen } from './screens/HomeScreen';
import { RouletteScreen } from './screens/RouletteScreen';
import { PromoScreen } from './screens/PromoScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { NumberScreen } from './screens/NumberScreen';
import { AdminScreen } from './screens/AdminScreen';
import { COUNTRY_BY_ID, applyMask } from '@ciferki/shared';
import type { PhoneNumber } from '@ciferki/shared';
import {
  CheckerScreen,
  HistoryScreen,
  ProfileScreen,
  QuestsScreen,
  RatingScreen,
  RulesScreen,
  SettingsScreen,
  ShopScreen,
  SoonScreen,
} from './screens/InfoScreens';
import { MenuDrawer } from './components/MenuDrawer';
import { TariffModal } from './components/TariffModal';
import { RoamingModal } from './components/RoamingModal';
import { CodeModal, OperatorModal } from './components/OperatorModal';
import { ChancesModal } from './components/ChancesModal';
import { ResultOverlay } from './components/ResultOverlay';
import { resolveRoute } from './routes';
import type { View as RouteView } from './routes';

/*
 * Куда ведёт пункт меню, решает общий модуль routes.ts. Раньше такой список
 * был ещё и здесь, и они разошлись: рулетка стала рабочим экраном, а переход
 * продолжал считать её заглушкой и выбрасывал игрока на главную.
 */
export type View = RouteView | 'number';

export function App() {
  const game = useGame();
  const [view, setView] = useState<View>('home');
  const [drawer, setDrawer] = useState(false);
  const [overlay, setOverlay] = useState<
    'tariff' | 'roaming' | 'chances' | 'operator' | 'codes' | null
  >(null);
  const [openNumberId, setOpenNumberId] = useState<string | null>(null);
  /** Заглушка раздела: храним готовый текст, а не ключ — тогда её нельзя потерять. */
  const [blocked, setBlocked] = useState<{ title: string; note: string } | null>(null);

  useEffect(() => {
    initTelegram();
  }, []);

  /**
   * Тактильный отклик на каждое нажатие кнопки.
   *
   * Один слушатель на весь документ: палец чувствует отклик раньше, чем глаз
   * видит результат, а размечать вибрацию у каждой кнопки по отдельности
   * значило бы рано или поздно что-то забыть.
   */
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button:not(:disabled)')) hapticImpact('light');
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  /**
   * Системная кнопка «Назад» в шапке Telegram. Дома её нет — там некуда
   * возвращаться, а на остальных экранах она дублирует кнопку в шапке игры.
   */
  useEffect(() => {
    return bindBackButton(() => setView('home'), view !== 'home');
  }, [view]);

  /**
   * Переход по пункту меню.
   *
   * Правило простое: любой пункт обязан куда-то привести. Если экрана нет —
   * показываем описание, а не пустоту. Именно из-за отсутствия этой страховки
   * «Удача» и «Шансы» открывали чёрный экран.
   */
  const go = useCallback((target: View) => {
    setDrawer(false);

    const route = resolveRoute(target);

    // Шансы — модальное окно поверх главного, а не отдельный экран.
    if (route.kind === 'overlay') {
      setOverlay('chances');
      return;
    }

    if (route.kind === 'view' && route.view) {
      setBlocked(null);
      setView(route.view);
      return;
    }

    setBlocked(
      route.soon ?? {
        title: 'Раздел',
        note: 'Этот раздел ещё не готов и появится в следующих обновлениях.',
      },
    );
    setView('home');
  }, []);

  const openNumber = useCallback(
    (id: string) => {
      setOpenNumberId(id);
      setView('number');
      game.dismissDrop();
    },
    [game],
  );

  const activeNumber = openNumberId
    ? game.state.numbers.find((number) => number.id === openNumberId) ?? null
    : null;

  /**
   * Проданный номер исчезает из коллекции — экран обязан уйти вместе с ним.
   * Без этого после продажи оставался пустой экран.
   */
  useEffect(() => {
    if (view === 'number' && !activeNumber) {
      setView('collection');
    }
  }, [view, activeNumber]);

  // Последний выпуск показываем на главной карточке, как в референсе.
  const lastRelease = game.state.numbers[0] ?? null;

  /**
   * Пустой бланк для выбранной страны: маска, код и флаг.
   *
   * Нужен, когда игрок сменил роуминг, а на карточке висел прошлый номер из
   * другой страны — выглядело так, будто выбор не сработал.
   */
  const previewNumber = useMemo<PhoneNumber | null>(() => {
    const selected = game.state.selectedCountry
      ? COUNTRY_BY_ID[game.state.selectedCountry]
      : null;
    if (!selected) return null;
    const slots = (selected.mask.match(/A/g) ?? []).length;
    return {
      id: 'preview',
      display: applyMask(selected.mask, '0'.repeat(slots)),
      digits: '0'.repeat(slots),
      countryId: selected.id,
      regionCode: selected.code,
      operatorId: game.state.selectedOperator ?? 'carrier',
      tariffId: game.state.selectedTariff,
      rarity: 'common',
      basePrice: 0,
      patternMultiplier: 1,
      demandMultiplier: selected.demand,
      finalPrice: 0,
      score: 0,
      patterns: [],
      issuedAt: new Date().toISOString(),
      releaseId: 'preview',
      limitedEdition: null,
    };
  }, [
    game.state.selectedCountry,
    game.state.selectedOperator,
    game.state.selectedTariff,
  ]);

  /**
   * Что рисовать на карточке. Свежий выпуск — всегда. Иначе прошлый номер
   * показываем, только если он из выбранной страны: иначе после смены роуминга
   * на карточке оставался чужой флаг с чужим кодом.
   */
  const lastNumberMatches =
    lastRelease !== null &&
    (game.state.selectedCountry === null || lastRelease.countryId === game.state.selectedCountry);

  const cardNumber = game.dropped ?? (lastNumberMatches ? lastRelease : previewNumber);
  const cardIsPreview = game.dropped === null && !lastNumberMatches;

  /** Выбранная страна нужна модалкам оператора и кодов: у каждой свои бренды. */
  const country = game.state.selectedCountry
    ? COUNTRY_BY_ID[game.state.selectedCountry] ?? null
    : null;

  return (
    <>
      {/* Заставка закрывает пустоту, пока проверяется доступность сервера. */}
      {game.mode === 'checking' && (
        <div className="splash">
          <div className="splash__mark">
            <span className="splash__chip" />
          </div>
          <div className="splash__title">Циферки</div>
          <div className="splash__hint">Собираем номера…</div>
        </div>
      )}

      {/* Ключ по экрану: при переходе содержимое въезжает заново. */}
      <div className="screen-enter" key={`${view}:${blocked?.title ?? ''}:${openNumberId ?? ''}`}>
        {view === 'home' && (
          <HomeScreen
            game={game}
            lastNumber={cardNumber}
            isPreview={cardIsPreview}
            onOpenMenu={() => setDrawer(true)}
            onOpenTariff={() => setOverlay('tariff')}
            onOpenRoaming={() => setOverlay('roaming')}
            onOpenOperator={() => setOverlay('operator')}
            onOpenCollection={() => go('collection')}
            onOpenNumber={openNumber}
          />
        )}

        {view === 'collection' && (
          <CollectionScreen
            game={game}
            onBack={() => setView('home')}
            onOpenNumber={openNumber}
          />
        )}

        {view === 'number' && activeNumber && (
          <NumberScreen
            game={game}
            number={activeNumber}
            onBack={() => setView(openNumberId && game.state.numbers.length > 0 ? 'collection' : 'home')}
          />
        )}

        {view === 'history' && <HistoryScreen game={game} onBack={() => go('home')} />}
        {view === 'profile' && <ProfileScreen game={game} onBack={() => go('home')} />}
        {view === 'quests' && <QuestsScreen game={game} onBack={() => go('home')} />}
        {view === 'rating' && <RatingScreen game={game} onBack={() => go('home')} />}
        {view === 'shop' && <ShopScreen game={game} onBack={() => go('home')} />}
        {view === 'rules' && <RulesScreen game={game} onBack={() => go('home')} />}
        {view === 'settings' && <SettingsScreen game={game} onBack={() => go('home')} />}
        {view === 'admin' && <AdminScreen game={game} onBack={() => go('home')} />}

        {view === 'checker' && <CheckerScreen game={game} onBack={() => go('home')} />}

        {view === 'roulette' && <RouletteScreen game={game} onBack={() => go('home')} />}

        {view === 'promo' && <PromoScreen game={game} onBack={() => go('home')} />}

        {view === 'home' && blocked && (
          <SoonScreen
            game={game}
            onBack={() => setBlocked(null)}
            title={blocked.title}
            note={blocked.note}
          />
        )}
      </div>

      {drawer && <MenuDrawer game={game} onClose={() => setDrawer(false)} onGo={go} />}

      {overlay === 'tariff' && (
        <TariffModal
          selected={game.state.selectedTariff}
          luck={game.luck}
          balance={game.state.player.balance}
          tickets={game.state.player.tickets}
          onPick={game.chooseTariff}
          onOpenChances={() => setOverlay('chances')}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay === 'roaming' && (
        <RoamingModal
          selected={game.state.selectedCountry}
          onPick={game.chooseCountry}
          onCustom={() => {
            setOverlay(null);
            setBlocked({
              title: 'Свои номера',
              note: 'Режим собственных шаблонов синтетических номеров появится позже.',
            });
          }}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay === 'operator' && (
        <OperatorModal
          game={game}
          country={country}
          onClose={() => setOverlay(null)}
          onOpenCountries={() => setOverlay('roaming')}
          onOpenCodes={() => setOverlay('codes')}
        />
      )}

      {overlay === 'codes' && (
        <CodeModal
          game={game}
          country={country}
          onClose={() => setOverlay(null)}
          onOpenOperators={() => setOverlay('operator')}
        />
      )}

      {overlay === 'chances' && (
        <ChancesModal
          tariffId={game.state.selectedTariff}
          luck={game.luck}
          onPickTariff={game.chooseTariff}
          onClose={() => setOverlay(null)}
        />
      )}

      {game.dropped && view === 'home' && (
        <ResultOverlay
          number={game.dropped}
          onClose={game.dismissDrop}
          onOpen={() => openNumber(game.dropped!.id)}
        />
      )}

      {game.toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.kind === 'error' ? 'toast--error' : ''}`}
        >
          {toast.text}
        </div>
      ))}
    </>
  );
}