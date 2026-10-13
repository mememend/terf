// language: TypeScript, file: bot/src/api.ts
// Клиент Telegram Bot API поверх fetch. Без внешних зависимостей.
// Базовый адрес настраивается, поэтому проверки поднимают локальный эмулятор
// и гоняют по нему настоящий код клиента, а не заглушку.

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  first_name?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    data?: string;
    message?: TelegramMessage;
  };
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  /** Кнопка, открывающая Mini App внутри Telegram. */
  web_app?: { url: string };
  callback_data?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface ReplyKeyboardMarkup {
  keyboard: { text: string; web_app?: { url: string } }[][];
  resize_keyboard?: boolean;
  is_persistent?: boolean;
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface MenuButton {
  type: 'default' | 'commands' | 'web_app';
  text?: string;
  web_app?: { url: string };
}

export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly errorCode: number,
    readonly description: string,
    readonly retryAfterSeconds: number | null,
  ) {
    super(`${method}: ${errorCode} ${description}`);
  }
}

interface ApiEnvelope<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

export class TelegramApi {
  constructor(
    private readonly token: string,
    private readonly base: string = 'https://api.telegram.org',
    private readonly timeoutMs = 30_000,
  ) {}

  /** Низкоуровневый вызов. Все методы Bot API идут через него. */
  async call<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.base}/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      let envelope: ApiEnvelope<T>;
      try {
        envelope = (await response.json()) as ApiEnvelope<T>;
      } catch {
        throw new TelegramApiError(method, response.status, 'ответ не является JSON', null);
      }

      if (!envelope.ok) {
        throw new TelegramApiError(
          method,
          envelope.error_code ?? response.status,
          envelope.description ?? 'неизвестная ошибка',
          envelope.parameters?.retry_after ?? null,
        );
      }
      return envelope.result as T;
    } finally {
      clearTimeout(timer);
    }
  }

  getMe(): Promise<TelegramUser> {
    return this.call<TelegramUser>('getMe');
  }

  /**
   * Длинный опрос. timeout меньше клиентского таймаута запроса,
   * иначе соединение обрывается раньше, чем Telegram ответит.
   */
  getUpdates(offset: number, timeoutSeconds: number): Promise<TelegramUpdate[]> {
    return this.call<TelegramUpdate[]>('getUpdates', {
      offset,
      timeout: timeoutSeconds,
      allowed_updates: ['message', 'callback_query'],
    });
  }

  sendMessage(
    chatId: number,
    text: string,
    options: {
      keyboard?: InlineKeyboardMarkup | ReplyKeyboardMarkup;
      disablePreview?: boolean;
    } = {},
  ): Promise<TelegramMessage> {
    return this.call<TelegramMessage>('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: options.disablePreview ?? true },
      ...(options.keyboard ?? {}),
    });
  }

  answerCallbackQuery(id: string, text?: string): Promise<boolean> {
    return this.call<boolean>('answerCallbackQuery', { callback_query_id: id, text });
  }

  setMyCommands(commands: BotCommand[]): Promise<boolean> {
    return this.call<boolean>('setMyCommands', { commands });
  }

  /** Кнопка меню слева от поля ввода — постоянный вход в Mini App. */
  setChatMenuButton(button: MenuButton): Promise<boolean> {
    return this.call<boolean>('setChatMenuButton', { menu_button: button });
  }
}
