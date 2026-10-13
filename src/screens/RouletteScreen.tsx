// language: TypeScript, file: frontend/src/screens/RouletteScreen.tsx
// Рулетка.
//
// Вращение считается вручную, кадр за кадром, а не CSS-переходом: так видно
// настоящую кривую торможения, можно мигать лампочкам в такт и точно знать
// момент остановки. Угол пишется прямо в стиль элемента — без состояния React
// на каждый кадр, иначе шестьдесят перерисовок в секунду съели бы телефон.
//
// Поверх колеса — canvas с частицами: на выигрыш из центра летят искры цвета
// приза. Это дешевле, чем сотня DOM-узлов, и живёт отдельным слоем.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_WHEEL_ID,
  ROULETTE_WHEELS,
  formatMoney,
  wheelById,
  wheelExpectedValue,
} from '@ciferki/shared';
import type { RoulettePrize, RouletteWheelId } from '@ciferki/shared';
import { Header } from '../components/Header';
import { Modal } from '../components/Modal';
import { headerProps, type ScreenProps } from './screen-utils';
import { api, describeApiError } from '../api';
import { hapticImpact, hapticNotify } from '../telegram';
import { effectOf } from '../utils/prize';

/* ─────────────────────────── ГЕОМЕТРИЯ ─────────────────────────── */

const SIZE = 340;
const CENTER = SIZE / 2;
const RIM_OUTER = SIZE / 2 - 2;
const RIM_INNER = RIM_OUTER - 16;
const SEGMENT_RADIUS = RIM_INNER - 4;
const HUB_RADIUS = 48;
/** Сколько полных оборотов накручиваем перед остановкой. */
const EXTRA_TURNS = 6;
/** Длительность вращения. */
const SPIN_MS = 5200;

/** Плавное торможение: быстро разгоняется, долго и мягко останавливается. */
function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5;
}

interface Segment {
  prize: RoulettePrize;
  start: number;
  sweep: number;
  center: number;
}

export function RouletteScreen({ game, onBack }: ScreenProps) {
  const [wheelId, setWheelId] = useState<RouletteWheelId>(DEFAULT_WHEEL_ID);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<RoulettePrize | null>(null);
  const [won, setWon] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Текущий угол колеса. Живёт в ref: на каждый кадр состояние не меняем. */
  const angleRef = useRef(0);
  const busy = useRef(false);

  const wheel = useMemo(() => wheelById(wheelId), [wheelId]);
  const cost = wheel.cost;

  const segments = useMemo<Segment[]>(() => {
    let cursor = 0;
    return wheel.prizes.map((prize) => {
      const sweep = (prize.chance / 100) * 360;
      const segment = { prize, start: cursor, sweep, center: cursor + sweep / 2 };
      cursor += sweep;
      return segment;
    });
  }, [wheel]);

  /** Лампочки по ободу: двадцать четыре штуки, как на настоящем колесе. */
  const bulbs = useMemo(
    () => Array.from({ length: 24 }, (_, index) => (index / 24) * 360),
    [],
  );

  useEffect(() => {
    setResult(null);
    setWon(null);
    setError(null);
  }, [wheelId]);

  /* ─────────────────────────── ЧАСТИЦЫ ─────────────────────────── */

  const particles = useRef<
    { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }[]
  >([]);
  const rafRef = useRef<number | null>(null);

  /** Запускает искры цвета приза. Живут отдельным слоем и гаснут сами. */
  const burst = useCallback((color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const count = 64;
    const center = canvas.width / 2;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.2;
      const speed = 2.4 + Math.random() * 4.2;
      particles.current.push({
        x: center,
        y: center,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        life: 0,
        max: 60 + Math.random() * 40,
        color,
        size: 1.6 + Math.random() * 2.6,
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let running = true;

    const frame = () => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.current = particles.current.filter((p) => p.life < p.max);
      for (const p of particles.current) {
        p.life += 1;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.09;
        p.vx *= 0.985;
        const fade = 1 - p.life / p.max;
        ctx.globalAlpha = Math.max(0, fade);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * fade + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* ─────────────────────────── ВРАЩЕНИЕ ─────────────────────────── */

  /**
   * Крутит колесо до нужного угла.
   *
   * Промис разрешается ровно тогда, когда колесо встало: по нему показываем
   * приз и только после этого обновляем состояние с сервера, чтобы списание
   * не выглядело оторванным от результата.
   */
  const animateTo = useCallback((delta: number, duration: number) => {
    return new Promise<void>((resolve) => {
      const from = angleRef.current;
      const started = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - started) / duration);
        const angle = from + delta * easeOutQuint(t);
        angleRef.current = angle;
        // Пишем угол напрямую в стиль: React на каждый кадр не дёргаем.
        if (svgRef.current) svgRef.current.style.transform = `rotate(${angle}deg)`;
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }, []);

  const spin = async () => {
    if (busy.current || !affordable) return;
    busy.current = true;
    setSpinning(true);
    setResult(null);
    setWon(null);
    setError(null);
    hapticImpact('medium');

    try {
      const response = await api.roulette(wheelId);
      const index = typeof response.index === 'number' ? response.index : 0;
      const target = segments[index] ?? segments[0];

      /*
       * Ведём центр выпавшего сектора под стрелку сверху. Доворот считаем
       * от текущего угла и всегда вперёд, чтобы колесо не дёргалось назад.
       */
      const landing = 360 * EXTRA_TURNS - target.center;
      const current = angleRef.current % 360;
      const delta = ((landing - current) % 360 + 360) % 360 + 360 * EXTRA_TURNS;

      await animateTo(delta, SPIN_MS);

      /*
       * Приз берём из местного набора колеса, а не из ответа сервера.
       * Сервер отдаёт только описание для показа, без суммы, множителя и числа
       * круток — из-за этого в подписи печаталось «удача ×undefined». Местный
       * набор — единственный источник, где есть все поля приза.
       */
      const shown =
        wheel.prizes.find((prize) => prize.id === response.prize?.id) ?? response.prize ?? null;

      setWon(shown?.id ?? null);
      setResult(shown);
      burst(shown?.color ?? '#F0B90B');
      hapticNotify('success');
      // Состояние с сервера обновляем только после остановки.
      await game.refresh();
    } catch (failure) {
      setError(describeApiError(failure));
      hapticNotify('error');
    } finally {
      setSpinning(false);
      busy.current = false;
    }
  };

  const affordable = game.state.player.balance >= cost;

  return (
    <div
      className="app app--roulette roulette"
      /*
       * Цвета выбранного колеса задаём на корне: оттуда их наследуют и обод,
       * и кнопка прокрута, и подсветка фона. Иначе у каждого элемента была бы
       * своя копия, и они разошлись бы.
       */
      style={{
        ['--ring-a' as string]: wheel.ring[0],
        ['--ring-b' as string]: wheel.ring[1],
      }}
    >
      <Header {...headerProps(game, onBack)} />
      <h1 className="screen-title">
        Рулетка
        <span className="section__note">{formatMoney(cost)} ₽ за попытку</span>
      </h1>

      <div className="wheel-tabs">
        {ROULETTE_WHEELS.map((item) => (
          <button
            key={item.id}
            className={`wheel-tab ${wheelId === item.id ? 'wheel-tab--active' : ''}`}
            style={{
              ['--ring-a' as string]: item.ring[0],
              ['--ring-b' as string]: item.ring[1],
            }}
            disabled={spinning}
            onClick={() => setWheelId(item.id)}
          >
            <span className="wheel-tab__name">{item.name}</span>
            <span className="wheel-tab__cost">{formatMoney(item.cost)} ₽</span>
          </button>
        ))}
      </div>

      <p className="wheel__tagline">{wheel.tagline}</p>

      <div className={`wheel ${spinning ? 'wheel--spinning' : ''}`}>
        {/* Свечение позади колеса: дышит, пока идёт вращение. */}
        <div className="wheel__halo" />

        {/* Луч прожектора: тонкий сектор света, обегающий колесо. */}
        <div className="wheel__sweep" />

        <div className="wheel__pointer" />

        <svg
          ref={svgRef}
          className="wheel__svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ transform: 'rotate(0deg)' }}
        >
          <defs>
            {segments.map((segment) => (
              <radialGradient
                key={segment.prize.id}
                id={`seg-${wheel.id}-${segment.prize.id}`}
                cx="50%"
                cy="50%"
                r="82%"
              >
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                <stop offset="46%" stopColor={segment.prize.color} />
                <stop offset="100%" stopColor={segment.prize.color} />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
              </radialGradient>
            ))}

            {/* Обод колеса: свет сверху, тень снизу — металлический кант. */}
            <linearGradient id={`rim-${wheel.id}`} x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="18%" stopColor={wheel.ring[0]} />
              <stop offset="82%" stopColor={wheel.ring[1]} />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.7" />
            </linearGradient>

            {/* Внутренний кант: тёмное кольцо между ободом и секторами. */}
            <linearGradient id={`inner-${wheel.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a2a2e" />
              <stop offset="100%" stopColor="#0b0b0d" />
            </linearGradient>

            {/* Стеклянный блик поверх секторов. */}
            <linearGradient id={`gloss-${wheel.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
              <stop offset="38%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="62%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
            </linearGradient>

            {/* Втулка в центре: объёмная, с подсветкой сверху. */}
            <radialGradient id={`hub-${wheel.id}`} cx="42%" cy="34%" r="76%">
              <stop offset="0%" stopColor="#3f3f46" />
              <stop offset="60%" stopColor="#18181b" />
              <stop offset="100%" stopColor="#09090b" />
            </radialGradient>
          </defs>

          {/* Обод */}
          <circle cx={CENTER} cy={CENTER} r={RIM_OUTER} fill={`url(#rim-${wheel.id})`} />
          <circle cx={CENTER} cy={CENTER} r={RIM_INNER} fill={`url(#inner-${wheel.id})`} />

          {/* Секторы */}
          {segments.map((segment) => (
            <path
              key={segment.prize.id}
              d={arcPath(
                CENTER,
                CENTER,
                SEGMENT_RADIUS,
                segment.start,
                segment.start + segment.sweep,
              )}
              fill={`url(#seg-${wheel.id}-${segment.prize.id})`}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="0.8"
              className={won === segment.prize.id ? 'wheel__seg--won' : undefined}
            />
          ))}

          {/* Блик поверх секторов */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={SEGMENT_RADIUS}
            fill={`url(#gloss-${wheel.id})`}
            pointerEvents="none"
          />

          {/* Подписи вдоль радиуса: в узкий сектор слово по дуге не влезает. */}
          {segments.map((segment) => {
            const angle = segment.center - 90;
            const flipped = angle > 90 && angle < 270;
            const x = CENTER + SEGMENT_RADIUS * 0.9;
            return (
              <text
                key={`${segment.prize.id}-label`}
                x={x}
                y={CENTER}
                fill="#0b0b0b"
                fontSize="12.5"
                fontWeight="800"
                textAnchor={flipped ? 'start' : 'end'}
                dominantBaseline="middle"
                transform={`rotate(${angle} ${CENTER} ${CENTER})${
                  flipped ? ` rotate(180 ${x} ${CENTER})` : ''
                }`}
              >
                {segment.prize.label}
              </text>
            );
          })}

          {/* Лампочки по ободу: мигают по кругу, пока колесо идёт. */}
          {bulbs.map((deg, index) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            const x = CENTER + (RIM_OUTER - 8) * Math.cos(rad);
            const y = CENTER + (RIM_OUTER - 8) * Math.sin(rad);
            return (
              <circle
                key={deg}
                cx={x}
                cy={y}
                r="3.4"
                className="wheel__bulb"
                style={{ animationDelay: `${index * 55}ms` }}
              />
            );
          })}

          {/* Втулка */}
          <circle cx={CENTER} cy={CENTER} r={HUB_RADIUS} fill={`url(#hub-${wheel.id})`} />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={HUB_RADIUS}
            fill="none"
            stroke={wheel.ring[0]}
            strokeWidth="1.4"
            strokeOpacity="0.6"
          />
          <text
            x={CENTER}
            y={CENTER + 5}
            fill="#ffffff"
            fontSize="14"
            fontWeight="800"
            textAnchor="middle"
          >
            ЦИФЕРКИ
          </text>
        </svg>

        {/* Частицы: отдельный слой поверх колеса. */}
        <canvas
          ref={canvasRef}
          className="wheel__canvas"
          width={SIZE + 60}
          height={SIZE + 60}
        />
      </div>

      {result && !spinning && (
        <div className="wheel-result" style={{ ['--prize' as string]: result.color }}>
          <div className="wheel-result__label">Выпало</div>
          <div className="wheel-result__title">{result.title}</div>
          <div className="wheel-result__effect">{effectOf(result)}</div>
        </div>
      )}

      {error && <div className="admin-error">{error}</div>}

      <button
        className="choose-btn roulette__spin"
        disabled={!affordable || spinning}
        style={!affordable || spinning ? { opacity: 0.5 } : undefined}
        onClick={() => void spin()}
      >
        <span>{spinning ? 'Крутится…' : 'Крутить колесо'}</span>
        <span className="choose-btn__side">{formatMoney(cost)} ₽</span>
      </button>

      {!affordable && (
        <div className="action-note">
          Не хватает {formatMoney(cost - game.state.player.balance)} ₽
        </div>
      )}

      <button className="link-row" style={{ width: '100%' }} onClick={() => setShowTable(true)}>
        Все призы и шансы ›
      </button>

      {showTable && (
        <Modal
          title={`Призы · ${wheel.name}`}
          subtitle="Сектор колеса равен вероятности приза"
          onClose={() => setShowTable(false)}
          footer={
            <div className="action-note" style={{ textAlign: 'left' }}>
              Средний приз за попытку — {formatMoney(Math.round(wheelExpectedValue(wheel)))} ₽ при
              цене {formatMoney(cost)} ₽. Колесо задумано как трата, а не как заработок.
            </div>
          }
        >
          <div className="prize-list">
            {wheel.prizes.map((prize) => (
              <div className="prize-row" key={prize.id}>
                <span className="prize-row__dot" style={{ background: prize.color }} />
                <span className="prize-row__title">{prize.title}</span>
                <span className="prize-row__chance">{prize.chance} %</span>
              </div>
            ))}
          </div>

          <div className="prize-stock">
            <div className="prize-stock__title">Ваши запасы</div>
            <div className="prize-stock__row">
              Бесплатные выпуски: <b>{game.state.player.freeReleases}</b>
            </div>
            <div className="prize-stock__row">
              Билеты «Элит»: <b>{game.state.player.tickets}</b>
            </div>
            <div className="prize-stock__row">
              Удача: <b>×{game.state.player.luck.multiplier}</b>
              {game.state.player.luck.spinsLeft > 0
                ? ` · ещё ${game.state.player.luck.spinsLeft} круток`
                : ''}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Дуга сектора колеса: от центра к краю по часовой стрелке. */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const point = (deg: number): [number, number] => {
    // −90°, чтобы ноль градусов был наверху, где стоит стрелка.
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x1, y1] = point(startDeg);
  const [x2, y2] = point(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}