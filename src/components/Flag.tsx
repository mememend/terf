// language: TypeScript, file: frontend/src/components/Flag.tsx
// Флаги стран — векторные фигуры.
//
// Почему не эмодзи: в Windows в системном шрифте нет флагов, и вместо 🇷🇺
// рисуются две буквы «RU». Почему не CSS-полоски: гербы и звёзды ими не
// передать, а флаг должен выглядеть как флаг.
//
// Поэтому каждый флаг — небольшой SVG: точные цвета и расположение, одинаковый
// вид на любой системе, ни одной картинки из сети.

import type { CSSProperties } from 'react';

/** Пятиконечная звезда: вершины через одну по внешнему и внутреннему радиусу. */
function star(cx: number, cy: number, r: number, fill: string): string {
  const points: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? r : r * 0.42;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return `<polygon points="${points.join(' ')}" fill="${fill}"/>`;
}

/** Полосы: горизонтальные или вертикальные, равными долями. */
function bands(colors: string[], horizontal: boolean): string {
  const size = (horizontal ? 40 : 60) / colors.length;
  return colors
    .map(
      (color, index) =>
        `<rect x="${horizontal ? 0 : index * size}" y="${
          horizontal ? index * size : 0
        }" width="${horizontal ? 60 : size}" height="${horizontal ? size : 40}" fill="${color}"/>`,
    )
    .join('');
}

/** Скандинавский крест: смещён к древку. */
function nordic(field: string, cross: string, edge?: string): string {
  const bar = (x: number, y: number, w: number, h: number, fill: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
  let out = `<rect width="60" height="40" fill="${field}"/>`;
  if (edge) {
    out += bar(17, 0, 4, 40, edge) + bar(0, 18, 60, 4, edge);
  }
  out += bar(19, 0, 8, 40, cross) + bar(0, 16, 60, 8, cross);
  return out;
}

/** Все флаги: разметка внутри viewBox 0 0 60 40. */
const FLAGS: Record<string, string> = {
  ru: bands(['#ffffff', '#0039A6', '#D52B1E'], true),
  de: bands(['#000000', '#DD0000', '#FFCE00'], true),
  fr: bands(['#002395', '#ffffff', '#ED2939'], false),
  it: bands(['#008C45', '#F4F5F0', '#CD212A'], false),
  nl: bands(['#AE1C28', '#ffffff', '#21468B'], true),
  pl: bands(['#ffffff', '#DC143C'], true),
  ua: bands(['#0057B7', '#FFD700'], true),
  ro: bands(['#002B7F', '#FCD116', '#CE1126'], false),
  hu: bands(['#CE2939', '#ffffff', '#477050'], true),
  at: bands(['#ED2939', '#ffffff', '#ED2939'], true),
  be: bands(['#000000', '#FDDA24', '#EF3340'], false),
  ie: bands(['#169B62', '#ffffff', '#FF883E'], false),
  mx: `${bands(['#006847', '#ffffff', '#CE1126'], false)}
      <circle cx="30" cy="20" r="5" fill="#8B5A2B"/>
      <path d="M27 20h6M30 17v6" stroke="#fff" stroke-width="0.8"/>`,
  es: `<rect width="60" height="40" fill="#AA151B"/>
       <rect y="10" width="60" height="20" fill="#F1BF00"/>
       <rect x="12" y="16" width="6" height="8" fill="#AA151B" opacity="0.85"/>`,
  pt: `<rect width="60" height="40" fill="#DA291C"/>
       <rect width="24" height="40" fill="#046A38"/>
       <circle cx="24" cy="20" r="7" fill="#FFE900" stroke="#046A38" stroke-width="1"/>`,
  cz: `<rect width="60" height="20" fill="#ffffff"/>
       <rect y="20" width="60" height="20" fill="#D7141A"/>
       <path d="M0 0 L28 20 L0 40 Z" fill="#11457E"/>`,
  by: `<rect width="60" height="40" fill="#C8313E"/>
       <rect y="27" width="60" height="13" fill="#4AA657"/>
       <rect width="6" height="40" fill="#ffffff"/>
       <path d="M1 3h4M1 8h4M1 13h4M1 18h4M1 23h4M1 28h4M1 33h4M1 38h4" stroke="#C8313E" stroke-width="2"/>`,

  fi: nordic('#ffffff', '#003580'),
  se: nordic('#006AA7', '#FECC00'),
  dk: nordic('#C60C30', '#ffffff'),
  no: nordic('#BA0C2F', '#ffffff', '#00205B'),

  ch: `<rect width="60" height="40" fill="#D52B1E"/>
       <rect x="24" y="9" width="12" height="22" fill="#ffffff"/>
       <rect x="19" y="14" width="22" height="12" fill="#ffffff"/>`,
  jp: `<rect width="60" height="40" fill="#ffffff"/>
       <circle cx="30" cy="20" r="9" fill="#BC002D"/>`,
  tr: `<rect width="60" height="40" fill="#E30A17"/>
       <circle cx="24" cy="20" r="9" fill="#ffffff"/>
       <circle cx="27" cy="20" r="7.2" fill="#E30A17"/>
       ${star(36, 20, 4.6, '#ffffff')}`,
  cn: `<rect width="60" height="40" fill="#DE2910"/>
       ${star(12, 10, 7, '#FFDE00')}
       ${star(23, 4, 2.4, '#FFDE00')}
       ${star(27, 9, 2.4, '#FFDE00')}
       ${star(27, 16, 2.4, '#FFDE00')}
       ${star(23, 21, 2.4, '#FFDE00')}`,
  kr: `<rect width="60" height="40" fill="#ffffff"/>
       <circle cx="30" cy="20" r="8" fill="#CD2E3A"/>
       <path d="M22 20a8 8 0 0 1 16 0 4 4 0 0 1-8 0 4 4 0 0 0-8 0Z" fill="#0047A0"/>
       <path d="M10 10l6 3M44 27l6 3M10 30l6-3M44 13l6-3" stroke="#000" stroke-width="1.4"/>`,
  in: `${bands(['#FF9933', '#ffffff', '#138808'], true)}
       <circle cx="30" cy="20" r="5.4" fill="none" stroke="#000080" stroke-width="1.1"/>
       <circle cx="30" cy="20" r="1" fill="#000080"/>`,
  ca: `<rect width="60" height="40" fill="#ffffff"/>
       <rect width="15" height="40" fill="#D80621"/>
       <rect x="45" width="15" height="40" fill="#D80621"/>
       <path d="M30 7l3 6 5-2-2 6 5 1-4 4 3 5h-6l-1 5-3-4-3 4-1-5h-6l3-5-4-4 5-1-2-6 5 2z" fill="#D80621"/>`,
  br: `<rect width="60" height="40" fill="#009C3B"/>
       <path d="M30 4 L56 20 L30 36 L4 20 Z" fill="#FFDF00"/>
       <circle cx="30" cy="20" r="9" fill="#002776"/>
       <path d="M21.5 17.5c6 3 12 3.6 17.5 1.4" stroke="#ffffff" stroke-width="1.6" fill="none"/>`,
  gb: `<rect width="60" height="40" fill="#012169"/>
       <path d="M0 0 L60 40 M60 0 L0 40" stroke="#ffffff" stroke-width="8"/>
       <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" stroke-width="4"/>
       <path d="M30 0 V40 M0 20 H60" stroke="#ffffff" stroke-width="13"/>
       <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" stroke-width="7.5"/>`,
  us: `<rect width="60" height="40" fill="#ffffff"/>
       ${[0, 1, 2, 3, 4, 5, 6]
         .map((i) => `<rect y="${i * 6.15}" width="60" height="3.08" fill="#B22234"/>`)
         .join('')}
       <rect width="26" height="21.5" fill="#3C3B6E"/>
       ${[0, 1, 2, 3, 4]
         .map((row) =>
           [0, 1, 2, 3, 4, 5]
             .map((col) => star(3 + col * 4.2, 2.6 + row * 4.2 + (col % 2) * 0.4, 1.5, '#ffffff'))
             .join(''),
         )
         .join('')}`,
  au: `<rect width="60" height="40" fill="#00008B"/>
       <rect width="30" height="20" fill="#012169"/>
       <path d="M0 0 L30 20 M30 0 L0 20" stroke="#ffffff" stroke-width="4"/>
       <path d="M15 0 V20 M0 10 H30" stroke="#ffffff" stroke-width="6"/>
       <path d="M15 0 V20 M0 10 H30" stroke="#C8102E" stroke-width="3"/>
       ${star(15, 31, 4.4, '#ffffff')}
       ${star(44, 10, 2.6, '#ffffff')}
       ${star(50, 20, 2.6, '#ffffff')}
       ${star(42, 29, 2.6, '#ffffff')}
       ${star(52, 31, 2, '#ffffff')}`,
  gr: `${[0, 1, 2, 3, 4, 5, 6, 7, 8]
         .map((i) =>
           `<rect y="${i * 4.44}" width="60" height="4.44" fill="${i % 2 === 0 ? '#0D5EAF' : '#ffffff'}"/>`,
         )
         .join('')}
       <rect width="22.2" height="22.2" fill="#0D5EAF"/>
       <rect x="8.9" width="4.44" height="22.2" fill="#ffffff"/>
       <rect y="8.9" width="22.2" height="4.44" fill="#ffffff"/>`,
  ae: `<rect width="60" height="13.33" fill="#00732F"/>
       <rect y="13.33" width="60" height="13.33" fill="#ffffff"/>
       <rect y="26.66" width="60" height="13.34" fill="#000000"/>
       <rect width="16" height="40" fill="#FF0000"/>`,
  kz: `<rect width="60" height="40" fill="#00AFCA"/>
       <circle cx="30" cy="18" r="7" fill="#FEC50C"/>
       <path d="M30 8v-4M30 32v-4M20 18h-4M44 18h-4M23 11l-3-3M37 25l3 3M37 11l3-3M23 25l-3 3" stroke="#FEC50C" stroke-width="1.6"/>
       <path d="M22 32c4-4 12-4 16 0" stroke="#FEC50C" stroke-width="2" fill="none"/>`,

  anon: `<rect width="60" height="40" fill="#111827"/>
       <circle cx="30" cy="20" r="11" fill="#1F2937" stroke="#64748B" stroke-width="1.5"/>
       <path d="M22 24c2-6 6-9 8-9s6 3 8 9" stroke="#64748B" stroke-width="2" fill="none"/>
       <circle cx="26.5" cy="19" r="1.8" fill="#94A3B8"/>
       <circle cx="33.5" cy="19" r="1.8" fill="#94A3B8"/>`,
};

export function Flag({
  countryId,
  size = 22,
  className,
  style,
}: {
  countryId: string;
  /** Высота флага в пикселях; ширина считается как 3:2 */
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const markup = FLAGS[countryId];
  return (
    <span
      className={`flag ${className ?? ''}`}
      style={{ width: Math.round(size * 1.5), height: size, ...style }}
      aria-hidden
    >
      {markup ? (
        <svg viewBox="0 0 60 40" preserveAspectRatio="none" dangerouslySetInnerHTML={{ __html: markup }} />
      ) : (
        <svg viewBox="0 0 60 40">
          <rect width="60" height="40" fill="#334155" />
        </svg>
      )}
    </span>
  );
}

export function hasFlag(countryId: string): boolean {
  return countryId in FLAGS;
}
