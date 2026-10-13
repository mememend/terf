// language: TypeScript, file: frontend/src/components/Header.tsx
// Верхняя панель: бургер или назад, аватар, уровень с полосой опыта, баланс справа.
// Баланс не прыгает, а доезжает до нового значения и мягко подчёркивает изменение.

import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@ciferki/shared';
import { useCountUp } from '../hooks/useCountUp';

interface HeaderProps {
  level: number;
  levelProgress: number;
  balance: number;
  avatarUrl: string | null;
  name: string;
  onMenu?: () => void;
  onBack?: () => void;
}

export function Header({
  level,
  levelProgress,
  balance,
  avatarUrl,
  name,
  onMenu,
  onBack,
}: HeaderProps) {
  const shown = useCountUp(balance);
  const [bump, setBump] = useState(false);
  const previous = useRef(balance);

  useEffect(() => {
    if (previous.current === balance) return;
    previous.current = balance;
    setBump(true);
    const timer = window.setTimeout(() => setBump(false), 540);
    return () => window.clearTimeout(timer);
  }, [balance]);

  return (
    <header className="header">
      {onBack ? (
        <button className="header__back" onClick={onBack} aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      ) : (
        <button className="header__burger" onClick={onMenu} aria-label="Меню">
          <span />
        </button>
      )}

      <div className="header__avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </div>

      <div className="header__level">
        <div className="header__level-row">
          <span>Ур. {level}</span>
        </div>
        <div className="header__level-bar">
          <div
            className="header__level-fill"
            style={{ width: `${Math.round(levelProgress * 100)}%` }}
          />
        </div>
      </div>

      <div className={`header__balance ${bump ? 'balance-bump' : ''}`}>
        {formatMoney(shown)} ₽
      </div>
    </header>
  );
}
