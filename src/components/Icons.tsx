// language: TypeScript, file: frontend/src/components/Icons.tsx
// Минималистичные контурные иконки. Все рисуются одним набором правил,
// поэтому в меню выглядят как одна семья, а не как случайные картинки.

import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  color?: string;
}

const frame = (children: ReactNode, size: number, color: string) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconCollection = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 10h18M9 10v10" />
    </>,
    size,
    color,
  );

export const IconRoulette = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" />
    </>,
    size,
    color,
  );

export const IconGift = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M3 13h18M12 9v12" />
      <path d="M12 9S9.5 3 7.5 4.5 9.8 9 12 9zM12 9s2.5-6 4.5-4.5S14.2 9 12 9z" />
    </>,
    size,
    color,
  );

export const IconSkills = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <path d="M12 3l2.2 5.4L20 9.6l-4.2 3.8L17 19.5 12 16.6 7 19.5l1.2-6.1L4 9.6l5.8-1.2z" />
    </>,
    size,
    color,
  );

export const IconMarket = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <path d="M4 9l1.5-5h13L20 9" />
      <path d="M4 9h16v11H4z" />
      <path d="M9 20v-5h6v5" />
    </>,
    size,
    color,
  );

export const IconAuction = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <path d="M14.5 3.5l6 6-3 3-6-6z" />
      <path d="M11 7l-8 8 3 3 8-8" />
      <path d="M14 20h7" />
    </>,
    size,
    color,
  );

export const IconDeals = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </>,
    size,
    color,
  );

export const IconPhone = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <path d="M10.5 18.5h3" />
    </>,
    size,
    color,
  );

export const IconProfile = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
    </>,
    size,
    color,
  );

export const IconFriends = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <circle cx="9" cy="9" r="3.4" />
      <path d="M2.5 19c0-3.2 2.9-5.4 6.5-5.4s6.5 2.2 6.5 5.4" />
      <path d="M16 6.2a3.4 3.4 0 010 6.6M18 19c0-2.2-.7-3.9-2-5" />
    </>,
    size,
    color,
  );

export const IconRating = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <path d="M7 21V10M12 21V4M17 21v-7" />
    </>,
    size,
    color,
  );

export const IconHistory = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <path d="M3.5 12a8.5 8.5 0 108.5-8.5A8.5 8.5 0 005 7" />
      <path d="M3.5 3.5V7H7" />
      <path d="M12 8v4.5l3 1.8" />
    </>,
    size,
    color,
  );

export const IconChances = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <path d="M19 5L5 19" />
      <circle cx="7.5" cy="7.5" r="2.6" />
      <circle cx="16.5" cy="16.5" r="2.6" />
    </>,
    size,
    color,
  );

export const IconRules = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v6M12 7.6v.1" />
    </>,
    size,
    color,
  );

export const IconPromo = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <path d="M3.5 9.5V6a2 2 0 012-2h13a2 2 0 012 2v3.5a2.5 2.5 0 000 5V18a2 2 0 01-2 2h-13a2 2 0 01-2-2v-3.5a2.5 2.5 0 000-5z" />
      <path d="M9 8.5v7" strokeDasharray="2 2.4" />
    </>,
    size,
    color,
  );

export const IconShop = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <path d="M5 8h14l-1.2 12H6.2z" />
      <path d="M9 8a3 3 0 016 0" />
    </>,
    size,
    color,
  );

export const IconCheck = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(<path d="M5 12.5l4.5 4.5L19 7" />, size, color);

export const IconClose = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(<path d="M6 6l12 12M18 6L6 18" />, size, color);

export const IconSearch = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>,
    size,
    color,
  );

export const IconGlobe = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 2.6 4 5.7 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.7-4-9s1.4-6.4 4-9z" />
    </>,
    size,
    color,
  );

export const IconTag = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <path d="M12.6 3H20a1 1 0 011 1v7.4a1 1 0 01-.3.7l-8.6 8.6a1 1 0 01-1.4 0l-7.4-7.4a1 1 0 010-1.4l8.6-8.6a1 1 0 01.7-.3z" />
      <circle cx="16.2" cy="7.8" r="1.3" />
    </>,
    size,
    color,
  );

export const IconTrend = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <path d="M3 16l5.5-5.5 3.5 3.5L20 6" />
      <path d="M15 6h5v5" />
    </>,
    size,
    color,
  );

export const IconClock = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>,
    size,
    color,
  );

export const IconKey = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <circle cx="8" cy="14" r="4" />
      <path d="M11 11l8-8M16.5 5.5l2.5 2.5M14 8l2.5 2.5" />
    </>,
    size,
    color,
  );

export const IconChannel = ({ size = 20, color = 'currentColor' }: IconProps) =>
  frame(
    <>
      <path d="M4 10v4l12 5V5z" />
      <path d="M4 10H3a1 1 0 00-1 1v2a1 1 0 001 1h1M8 16.5V19a2 2 0 004 0" />
    </>,
    size,
    color,
  );
