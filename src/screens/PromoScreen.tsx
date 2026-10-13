// language: TypeScript, file: frontend/src/screens/PromoScreen.tsx
// Промокод.
//
// Код можно погасить один раз. Проверка целиком на сервере: срок, повтор и
// общий тираж. Экран только вводит текст и показывает, что начислено.

import { useState } from 'react';
import { formatMoney } from '@ciferki/shared';
import { Header } from '../components/Header';
import { headerProps, type ScreenProps } from './screen-utils';
import { api, describeApiError } from '../api';
import { hapticNotify } from '../telegram';

const ERROR_TEXT: Record<string, string> = {
  empty: 'Введите код',
  not_found: 'Такого кода нет',
  already: 'Этот код уже погашен',
  expired: 'Срок кода истёк',
  exhausted: 'Код разобрали — тираж закончился',
  code_required: 'Введите код',
};

export function PromoScreen({ game, onBack }: ScreenProps) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<{ title: string; gained: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const code = value.trim();
    if (busy || code.length === 0) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const response = await api.promo(code);
      setOk({ title: response.title ?? 'Код принят', gained: response.gained ?? '' });
      setValue('');
      hapticNotify('success');
      await game.refresh();
    } catch (failure) {
      const detail = describeApiError(failure);
      const code2 = extractCode(failure);
      setError(ERROR_TEXT[code2 ?? ''] ?? detail);
      hapticNotify('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app app--promo promo-screen">
      <Header {...headerProps(game, onBack)} />
      <h1 className="screen-title">Промокод</h1>

      <div className="promo-hero">
        <div className="promo-hero__glyph">%</div>
        <div className="promo-hero__title">Введите код</div>
        <div className="promo-hero__note">
          Коды публикуют в канале игры. Каждый код погашается один раз.
        </div>
      </div>

      <div className="promo-field">
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
            setOk(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
          placeholder="НАПРИМЕР: ЦИФЕРКИ"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <button
        className="choose-btn promo-submit"
        disabled={busy || value.trim().length === 0}
        style={busy || value.trim().length === 0 ? { opacity: 0.5 } : undefined}
        onClick={() => void submit()}
      >
        <span>{busy ? 'Проверяем…' : 'Погасить'}</span>
      </button>

      {error && (
        <div className="promo-result promo-result--bad">
          <div className="promo-result__title">Не вышло</div>
          <div className="promo-result__note">{error}</div>
        </div>
      )}

      {ok && (
        <div className="promo-result promo-result--good">
          <div className="promo-result__title">{ok.title}</div>
          <div className="promo-result__gained">{ok.gained}</div>
          <div className="promo-result__note">Награда уже на балансе</div>
        </div>
      )}

      <div className="promo-stock">
        <div className="promo-stock__row">
          Баланс: <b>{formatMoney(game.state.player.balance)} ₽</b>
        </div>
        <div className="promo-stock__row">
          Бесплатные выпуски: <b>{game.state.player.freeReleases}</b>
        </div>
        <div className="promo-stock__row">
          Билеты «Элит»: <b>{game.state.player.tickets}</b>
        </div>
        <div className="promo-stock__row">
          Погашено кодов: <b>{game.state.usedPromoCodes.length}</b>
        </div>
      </div>
    </div>
  );
}

/** Достаёт код ошибки из ответа сервера, чтобы показать понятный текст. */
function extractCode(failure: unknown): string | null {
  const message = failure instanceof Error ? failure.message : String(failure);
  const match = /"error"\s*:\s*"([a-z_]+)"/.exec(message);
  return match ? match[1] : null;
}
