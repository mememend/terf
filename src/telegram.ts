// language: TypeScript, file: frontend/src/telegram.ts
// Тонкая обёртка над Telegram Web Apps SDK. В обычном браузере всё работает
// в режиме заглушки, поэтому один и тот же билд открывается и в Telegram, и напрямую.

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramUser };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  isExpanded: boolean;
  viewportHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  openLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged?: () => void;
  };
  BackButton?: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  openTelegramLink?: (url: string) => void;
  HapticFeedbackAvailable?: boolean;
  MainButton?: {
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function webApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

/**
 * Инициализация: развернуть на весь экран и покрасить шапку.
 *
 * disableVerticalSwipes здесь СОЗНАТЕЛЬНО не вызывается. Он глушит свайпы
 * в клиенте Telegram, а вместе с ними перестаёт прокручиваться содержимое —
 * именно на это жаловались при игре. Пусть вертикальный жест закрывает
 * Mini App, зато страницы листаются.
 */
export function initTelegram(): void {
  const app = webApp();
  if (!app) return;
  app.ready();
  app.expand();
  app.setHeaderColor?.('#000000');
  app.setBackgroundColor?.('#000000');
}

/* ─────────────────────────── ТАКТИЛЬНЫЙ ОТКЛИК ─────────────────────────── */

/** Смена выбора — слабее нажатия: отмечает, что значение поменялось. */
export function hapticSelect(): void {
  webApp()?.HapticFeedback?.selectionChanged?.();
}

/* ─────────────────────────── СИСТЕМНАЯ КНОПКА «НАЗАД» ─────────────────────────── */

/**
 * Подключает системную кнопку «Назад» в шапке Telegram.
 *
 * Возвращает функцию отписки. Вне Telegram ничего не делает: там есть своя
 * кнопка в шапке приложения.
 */
export function bindBackButton(onBack: () => void, visible: boolean): () => void {
  const app = webApp();
  const button = app?.BackButton;
  if (!button) return () => undefined;

  button.onClick(onBack);
  if (visible) button.show();
  else button.hide();

  return () => {
    button.offClick(onBack);
    button.hide();
  };
}

/* ─────────────────────────── ПОХВАСТАТЬСЯ ─────────────────────────── */

/**
 * Открывает выбор чата в Telegram с готовым текстом о номере.
 * В обычном браузере копирует текст в буфер — чтобы кнопка не была мёртвой.
 */
export async function shareText(text: string): Promise<'telegram' | 'clipboard' | 'failed'> {
  const app = webApp();
  const url = `https://t.me/share/url?url=${encodeURIComponent('https://t.me')}&text=${encodeURIComponent(text)}`;

  if (app?.openTelegramLink) {
    app.openTelegramLink(url);
    return 'telegram';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'clipboard';
  } catch {
    return 'failed';
  }
}

export interface TelegramIdentity {
  /** Строка подписи для серверной проверки. Пустая вне Telegram. */
  initData: string;
  user: TelegramUser | null;
  /** true — приложение открыто внутри Telegram. */
  inside: boolean;
}

export function telegramIdentity(): TelegramIdentity {
  const app = webApp();
  const user = app?.initDataUnsafe?.user ?? null;
  return {
    initData: app?.initData ?? '',
    user,
    inside: Boolean(app?.initData),
  };
}

/** Отображаемое имя игрока из Telegram. */
export function displayName(user: TelegramUser | null): string {
  if (!user) return 'Игрок';
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : user.username ?? 'Игрок';
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium'): void {
  webApp()?.HapticFeedback?.impactOccurred(style);
}

export function hapticNotify(type: 'error' | 'success' | 'warning'): void {
  webApp()?.HapticFeedback?.notificationOccurred(type);
}

/**
 * Заголовки для запросов к backend: подпись Telegram уходит на сервер,
 * который её проверяет и сам определяет пользователя и его права.
 * VITE_DEV_USER добавляет отладочного игрока — сервер принимает его только
 * при ALLOW_DEV_AUTH=1 и вне продакшена.
 */
export function authHeaders(): Record<string, string> {
  const { initData } = telegramIdentity();
  const headers: Record<string, string> = {};
  if (initData) headers['X-Telegram-Init-Data'] = initData;
  const devUser = import.meta.env.VITE_DEV_USER as string | undefined;
  if (devUser) headers['X-Dev-User'] = devUser;
  return headers;
}
