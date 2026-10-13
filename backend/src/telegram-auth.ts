// language: TypeScript, file: backend/src/telegram-auth.ts
// Проверка подписи Telegram Web App initData.
// Алгоритм из документации: секрет = HMAC_SHA256("WebAppData", bot_token),
// подпись = HMAC_SHA256(секрет, data_check_string). Сравнение — постоянное по времени.
//
// Всё, что клиент передал про себя (имя, username, id), до проверки подписи
// считается недоверенным. Права администратора определяются только по этой подписи.

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface InitDataResult {
  ok: boolean;
  user: TelegramUser | null;
  authDate: Date | null;
  /** Причина отказа — для журнала ошибок, наружу отдаётся обобщённо. */
  reason?: 'empty' | 'no_hash' | 'bad_hash' | 'expired' | 'no_user' | 'bad_json' | 'no_token';
}

/** Срок жизни подписи. Telegram рекомендует ограничивать окно. */
const MAX_AGE_SECONDS = 24 * 60 * 60;

export function verifyInitData(
  initData: string,
  botToken: string,
  options: { maxAgeSeconds?: number; now?: number } = {},
): InitDataResult {
  if (!botToken) return { ok: false, user: null, authDate: null, reason: 'no_token' };
  if (!initData) return { ok: false, user: null, authDate: null, reason: 'empty' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, user: null, authDate: null, reason: 'no_hash' };
  params.delete('hash');
  // Поле signature относится к отдельной схеме Ed25519 и в проверку hash не входит.
  params.delete('signature');

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (!safeEqualHex(expected, hash)) {
    return { ok: false, user: null, authDate: null, reason: 'bad_hash' };
  }

  const authDateSeconds = Number(params.get('auth_date'));
  const now = options.now ?? Date.now();
  const maxAge = options.maxAgeSeconds ?? MAX_AGE_SECONDS;
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    return { ok: false, user: null, authDate: null, reason: 'expired' };
  }
  if (now / 1000 - authDateSeconds > maxAge) {
    return { ok: false, user: null, authDate: null, reason: 'expired' };
  }

  const rawUser = params.get('user');
  if (!rawUser) return { ok: false, user: null, authDate: null, reason: 'no_user' };

  let user: TelegramUser;
  try {
    user = JSON.parse(rawUser) as TelegramUser;
  } catch {
    return { ok: false, user: null, authDate: null, reason: 'bad_json' };
  }
  if (!Number.isFinite(user.id)) {
    return { ok: false, user: null, authDate: null, reason: 'no_user' };
  }

  return { ok: true, user, authDate: new Date(authDateSeconds * 1000) };
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/** Отображаемое имя игрока. Серверное, из проверенной подписи. */
export function displayNameOf(user: TelegramUser): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return user.username ?? `Игрок ${user.id}`;
}

/**
 * Подпись для локальной проверки без Telegram. Работает только когда
 * ALLOW_DEV_AUTH=1 и NODE_ENV не production — это проверяет env.ts.
 */
export function devUser(header: string | undefined): TelegramUser | null {
  if (!header) return null;
  const id = Number(header);
  if (!Number.isFinite(id)) return null;
  return { id, first_name: `Тест${id}`, username: `dev${id}` };
}
