// src/selftest.ts
import { createServer } from "node:http";
import { spawn } from "node:child_process";

// src/api.ts
var TelegramApiError = class extends Error {
  constructor(method, errorCode, description, retryAfterSeconds) {
    super(`${method}: ${errorCode} ${description}`);
    this.method = method;
    this.errorCode = errorCode;
    this.description = description;
    this.retryAfterSeconds = retryAfterSeconds;
  }
};
var TelegramApi = class {
  constructor(token, base = "https://api.telegram.org", timeoutMs = 3e4) {
    this.token = token;
    this.base = base;
    this.timeoutMs = timeoutMs;
  }
  /** Низкоуровневый вызов. Все методы Bot API идут через него. */
  async call(method, payload = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.base}/bot${this.token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      let envelope;
      try {
        envelope = await response.json();
      } catch {
        throw new TelegramApiError(method, response.status, "\u043E\u0442\u0432\u0435\u0442 \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F JSON", null);
      }
      if (!envelope.ok) {
        throw new TelegramApiError(
          method,
          envelope.error_code ?? response.status,
          envelope.description ?? "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430",
          envelope.parameters?.retry_after ?? null
        );
      }
      return envelope.result;
    } finally {
      clearTimeout(timer);
    }
  }
  getMe() {
    return this.call("getMe");
  }
  /**
   * Длинный опрос. timeout меньше клиентского таймаута запроса,
   * иначе соединение обрывается раньше, чем Telegram ответит.
   */
  getUpdates(offset, timeoutSeconds) {
    return this.call("getUpdates", {
      offset,
      timeout: timeoutSeconds,
      allowed_updates: ["message", "callback_query"]
    });
  }
  sendMessage(chatId, text, options = {}) {
    return this.call("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: options.disablePreview ?? true },
      ...options.keyboard ?? {}
    });
  }
  answerCallbackQuery(id, text) {
    return this.call("answerCallbackQuery", { callback_query_id: id, text });
  }
  setMyCommands(commands) {
    return this.call("setMyCommands", { commands });
  }
  /** Кнопка меню слева от поля ввода — постоянный вход в Mini App. */
  setChatMenuButton(button) {
    return this.call("setChatMenuButton", { menu_button: button });
  }
};

// src/env.ts
function loadBotEnv(source = process.env) {
  const botToken = source.BOT_TOKEN ?? "";
  if (!botToken) {
    throw new Error("BOT_TOKEN \u043D\u0435 \u0437\u0430\u0434\u0430\u043D \u2014 \u0431\u043E\u0442\u0443 \u043D\u0435\u0447\u0435\u043C \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u043E\u0432\u0430\u0442\u044C\u0441\u044F \u0432 Telegram");
  }
  const webappUrl = source.WEBAPP_URL ?? "http://127.0.0.1:5173";
  if (source.NODE_ENV === "production" && !webappUrl.startsWith("https://")) {
    throw new Error("WEBAPP_URL \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C HTTPS: Telegram \u043D\u0435 \u043E\u0442\u043A\u0440\u043E\u0435\u0442 Mini App \u043F\u043E http");
  }
  return {
    botToken,
    webappUrl,
    webappTitle: source.WEBAPP_TITLE ?? "\u0426\u0438\u0444\u0435\u0440\u043A\u0438",
    apiBase: source.BOT_API_BASE ?? "https://api.telegram.org",
    backendUrl: source.BACKEND_URL ?? null,
    backendSecret: source.BOT_INTERNAL_SECRET ?? null,
    botUsername: source.BOT_USERNAME ?? null,
    pollTimeoutSeconds: Number(source.POLL_TIMEOUT ?? 25)
  };
}
function webappLink(env, startParam) {
  if (!startParam) return env.webappUrl;
  const separator = env.webappUrl.includes("?") ? "&" : "?";
  return `${env.webappUrl}${separator}startapp=${encodeURIComponent(startParam)}`;
}
function miniAppDirectLink(env, startParam) {
  if (!env.botUsername) return null;
  const base = `https://t.me/${env.botUsername}`;
  return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
}

// src/keyboards.ts
function mainKeyboard(env, startParam) {
  return {
    inline_keyboard: [
      [{ text: `\u{1F3B0} \u041E\u0442\u043A\u0440\u044B\u0442\u044C ${env.webappTitle}`, web_app: { url: webappLink(env, startParam) } }],
      [
        { text: "\u0428\u0430\u043D\u0441\u044B", callback_data: "chances" },
        { text: "\u041F\u0440\u0430\u0432\u0438\u043B\u0430", callback_data: "rules" },
        { text: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C", callback_data: "profile" }
      ]
    ]
  };
}
function shareKeyboard(env, startParam) {
  const link = miniAppDirectLink(env, startParam);
  const rows = [
    [{ text: `\u{1F3B0} \u041E\u0442\u043A\u0440\u044B\u0442\u044C ${env.webappTitle}`, web_app: { url: webappLink(env, startParam) } }]
  ];
  if (link) {
    rows.push([
      {
        text: "\u041F\u043E\u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F \u0441 \u0434\u0440\u0443\u0437\u044C\u044F\u043C\u0438",
        url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("\u0421\u043E\u0431\u0438\u0440\u0430\u044E \u043A\u0440\u0430\u0441\u0438\u0432\u044B\u0435 \u043D\u043E\u043C\u0435\u0440\u0430 \u0432 \u0426\u0438\u0444\u0435\u0440\u043A\u0430\u0445")}`
      }
    ]);
  }
  return { inline_keyboard: rows };
}

// src/texts.ts
var TEXTS = {
  greeting: (name) => `<b>\u0426\u0438\u0444\u0435\u0440\u043A\u0438</b> \u2014 \u0432\u044B\u043F\u0443\u0441\u043A\u0430\u0439 \u0438\u0433\u0440\u043E\u0432\u044B\u0435 SIM, \u0441\u043E\u0431\u0438\u0440\u0430\u0439 \u043A\u0440\u0430\u0441\u0438\u0432\u044B\u0435 \u043D\u043E\u043C\u0435\u0440\u0430.

\u041F\u0440\u0438\u0432\u0435\u0442, ${name}. \u0412\u043D\u0443\u0442\u0440\u0438: \u0447\u0435\u0442\u044B\u0440\u0435 \u0442\u0430\u0440\u0438\u0444\u0430, \u0434\u0435\u0441\u044F\u0442\u044C \u0440\u0435\u0433\u0438\u043E\u043D\u043E\u0432, \u0448\u0435\u0441\u0442\u044C \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0439 \u0440\u0435\u0434\u043A\u043E\u0441\u0442\u0438 \u0438 \u0430\u043D\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440 \u0443\u0437\u043E\u0440\u043E\u0432 \u2014 \u043D\u043E\u043C\u0435\u0440 \u0442\u0435\u043C \u0434\u043E\u0440\u043E\u0436\u0435, \u0447\u0435\u043C \u043A\u0440\u0430\u0441\u0438\u0432\u0435\u0435 \u0432 \u043D\u0451\u043C \u0446\u0438\u0444\u0440\u044B.

\u041D\u043E\u043C\u0435\u0440\u0430 \u0441\u0438\u043D\u0442\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0438 \u0436\u0438\u0432\u0443\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0438\u0433\u0440\u0435.`,
  referral: (name) => `\u041F\u0440\u0438\u0432\u0435\u0442, ${name}. \u0422\u0435\u0431\u044F \u043F\u043E\u0437\u0432\u0430\u043B\u0438 \u043F\u043E \u0441\u0441\u044B\u043B\u043A\u0435 \u2014 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u0431\u043E\u043D\u0443\u0441 \u0443\u0436\u0435 \u043D\u0430 \u043C\u0435\u0441\u0442\u0435.`,
  help: `<b>\u0427\u0442\u043E \u0443\u043C\u0435\u0435\u0442 \u0431\u043E\u0442</b>

/play \u2014 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0438\u0433\u0440\u0443
/chances \u2014 \u0448\u0430\u043D\u0441\u044B \u0432\u044B\u043F\u0430\u0434\u0435\u043D\u0438\u044F \u043F\u043E \u0442\u0430\u0440\u0438\u0444\u0430\u043C
/rules \u2014 \u043F\u0440\u0430\u0432\u0438\u043B\u0430: \u043A\u0430\u043A \u0441\u0447\u0438\u0442\u0430\u044E\u0442\u0441\u044F \u043E\u0447\u043A\u0438 \u0438 \u0446\u0435\u043D\u0430
/profile \u2014 \u0442\u0432\u043E\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C
/share \u2014 \u0441\u0441\u044B\u043B\u043A\u0430 \u0434\u043B\u044F \u0434\u0440\u0443\u0437\u0435\u0439

\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0435 \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0434\u0438\u0442 \u0432 Mini App: \u043A\u043D\u043E\u043F\u043A\u0430 \u043D\u0438\u0436\u0435 \u0438\u043B\u0438 \u043A\u043D\u043E\u043F\u043A\u0430 \u043C\u0435\u043D\u044E \u0443 \u043F\u043E\u043B\u044F \u0432\u0432\u043E\u0434\u0430.`,
  chances: `<b>\u0428\u0430\u043D\u0441\u044B \u043F\u043E \u0442\u0430\u0440\u0438\u0444\u0430\u043C</b>

\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442 \u2014 1 700 \u20BD
\u041F\u043B\u044E\u0441 \u2014 7 000 \u20BD
\u041F\u0440\u0435\u043C\u0438\u0443\u043C \u2014 34 500 \u20BD
\u042D\u043B\u0438\u0442 \u2014 \u043F\u043E \u0431\u0438\u043B\u0435\u0442\u0443

\u0414\u043E\u0440\u043E\u0436\u0435 \u0442\u0430\u0440\u0438\u0444 \u2014 \u0432\u044B\u0448\u0435 \u0448\u0430\u043D\u0441 \u0440\u0435\u0434\u043A\u0438\u0445 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0439, \u043D\u043E \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0438 \u043D\u0435\u0442. \u041F\u043E\u043B\u043D\u0430\u044F \u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u0435\u0439 \u2014 \u0432 \u0438\u0433\u0440\u0435, \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u0428\u0430\u043D\u0441\u044B\xBB: \u043E\u043D\u0430 \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u0438\u0437 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A \u0438 \u0432\u0441\u0435\u0433\u0434\u0430 \u0441\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u043A 100 %.`,
  rules: `<b>\u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u043A\u043E\u0440\u043E\u0442\u043A\u043E</b>

1. \u0410\u043D\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440 \u0438\u0449\u0435\u0442 \u0432 \u0446\u0438\u0444\u0440\u0430\u0445 \u0443\u0437\u043E\u0440\u044B: \u0441\u0435\u0440\u0438\u0438, \u043B\u0435\u0441\u0435\u043D\u043A\u0438, \u043F\u0430\u043B\u0438\u043D\u0434\u0440\u043E\u043C\u044B, \u0437\u0435\u0440\u043A\u0430\u043B\u0430, \u0447\u0435\u0440\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u043F\u0430\u0440\u044B, \u0434\u0430\u0442\u044B, \u043F\u043E\u0432\u0442\u043E\u0440\u044B \u0431\u043B\u043E\u043A\u043E\u0432.
2. \u0417\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u0443\u0437\u043E\u0440 \u043D\u0430\u0447\u0438\u0441\u043B\u044F\u044E\u0442\u0441\u044F \u043E\u0447\u043A\u0438. \u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442\u0441\u044F \u0441\u0443\u043C\u043C\u043E\u0439 \u043E\u0447\u043A\u043E\u0432.
3. \u0426\u0435\u043D\u0430 = \u0431\u0430\u0437\u043E\u0432\u0430\u044F \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \xD7 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0443\u0437\u043E\u0440\u0430 \xD7 \u0441\u043F\u0440\u043E\u0441 \u0440\u0435\u0433\u0438\u043E\u043D\u0430.
4. \u041E\u0434\u0438\u043D \u0440\u0438\u0441\u0443\u043D\u043E\u043A \u0434\u0430\u0451\u0442 \u043E\u0434\u0438\u043D \u0431\u043E\u043D\u0443\u0441: \u043F\u043E\u0434\u0447\u0438\u043D\u0451\u043D\u043D\u044B\u0435 \u0443\u0437\u043E\u0440\u044B \u043D\u0435 \u0441\u0443\u043C\u043C\u0438\u0440\u0443\u044E\u0442\u0441\u044F.
5. \u0423\u0434\u0430\u0447\u0430 \u0443\u043C\u043D\u043E\u0436\u0430\u0435\u0442 \u0448\u0430\u043D\u0441\u044B \u0440\u0435\u0434\u043A\u0438\u0445, \u043F\u043E\u0441\u043B\u0435 \u0447\u0435\u0433\u043E \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043D\u043E\u0440\u043C\u0430\u043B\u0438\u0437\u0443\u0435\u0442\u0441\u044F \u043A 100 %.
6. \u20BD \u2014 \u0438\u0433\u0440\u043E\u0432\u043E\u0439 \u0431\u0430\u043B\u0430\u043D\u0441, \u043D\u0435 \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0435\u043D\u044C\u0433\u0438.

\u041F\u043E\u0434\u0440\u043E\u0431\u043D\u043E\u0441\u0442\u0438 \u2014 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u041F\u0440\u0430\u0432\u0438\u043B\u0430\xBB \u0432\u043D\u0443\u0442\u0440\u0438 \u0438\u0433\u0440\u044B.`,
  profileUnavailable: `\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F, \u043A\u043E\u0433\u0434\u0430 \u0438\u0433\u0440\u0430 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u0430 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C. \u041E\u0442\u043A\u0440\u043E\u0439 \u0438\u0433\u0440\u0443 \u2014 \u0442\u0430\u043C \u0443\u0440\u043E\u0432\u0435\u043D\u044C, \u0431\u0430\u043B\u0430\u043D\u0441 \u0438 \u0432\u0441\u044F \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F.`,
  profileLoading: "\u0421\u043C\u043E\u0442\u0440\u044E \u043F\u0440\u043E\u0444\u0438\u043B\u044C\u2026",
  shareUnavailable: `\u0421\u0441\u044B\u043B\u043A\u0443 \u0434\u043B\u044F \u0434\u0440\u0443\u0437\u0435\u0439 \u043C\u043E\u0436\u043D\u043E \u0441\u043E\u0431\u0440\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u0443 \u0431\u043E\u0442\u0430 \u0437\u0430\u0434\u0430\u043D\u043E \u0438\u043C\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F (BOT_USERNAME).`,
  unknown: `\u041D\u0435 \u0437\u043D\u0430\u044E \u0442\u0430\u043A\u043E\u0439 \u043A\u043E\u043C\u0430\u043D\u0434\u044B. \u0427\u0442\u043E \u0443\u043C\u0435\u044E \u2014 \u0432 /help. \u0418\u0433\u0440\u0430 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \u043D\u0438\u0436\u0435.`,
  stale: `\u041A\u043D\u043E\u043F\u043A\u0430 \u0443\u0441\u0442\u0430\u0440\u0435\u043B\u0430 \u2014 \u043E\u0442\u043A\u0440\u043E\u0439 \u0438\u0433\u0440\u0443 \u0437\u0430\u043D\u043E\u0432\u043E.`,
  error: "\u0427\u0442\u043E-\u0442\u043E \u0441\u043B\u043E\u043C\u0430\u043B\u043E\u0441\u044C \u043D\u0430 \u043C\u043E\u0435\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u0435. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437 \u0447\u0435\u0440\u0435\u0437 \u043C\u0438\u043D\u0443\u0442\u0443."
};
function profileText(profile) {
  return `<b>${profile.name}</b>

\u0423\u0440\u043E\u0432\u0435\u043D\u044C: ${profile.level}
\u0411\u0430\u043B\u0430\u043D\u0441: ${formatMoney(profile.balance)} \u20BD
\u041D\u043E\u043C\u0435\u0440\u043E\u0432: ${profile.numbers}
\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u0438: ${formatMoney(profile.portfolio)} \u20BD`;
}
function formatMoney(value) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

// src/handlers.ts
function parseCommand(text) {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const [head, ...rest] = trimmed.split(/\s+/);
  const command = head.slice(1).split("@")[0].toLowerCase();
  return { command, payload: rest.join(" ") };
}
function displayName(update) {
  const user = update.message?.from ?? update.callback_query?.from;
  if (!user) return "\u0438\u0433\u0440\u043E\u043A";
  return user.first_name || user.username || "\u0438\u0433\u0440\u043E\u043A";
}
async function handleUpdate(ctx, update) {
  const log = ctx.log ?? (() => void 0);
  if (update.callback_query) {
    const chatId2 = update.callback_query.message?.chat.id;
    const data = update.callback_query.data ?? "";
    await ctx.api.answerCallbackQuery(update.callback_query.id);
    if (chatId2 === void 0) return;
    switch (data) {
      case "chances":
        await ctx.api.sendMessage(chatId2, TEXTS.chances, { keyboard: mainKeyboard(ctx.env) });
        return;
      case "rules":
        await ctx.api.sendMessage(chatId2, TEXTS.rules, { keyboard: mainKeyboard(ctx.env) });
        return;
      case "profile":
        await sendProfile(ctx, chatId2, update.callback_query.from.id);
        return;
      default:
        await ctx.api.sendMessage(chatId2, TEXTS.stale);
        return;
    }
  }
  const message = update.message;
  if (!message?.text) return;
  const chatId = message.chat.id;
  const userId = message.from?.id ?? chatId;
  const parsed = parseCommand(message.text);
  if (!parsed) {
    await ctx.api.sendMessage(chatId, TEXTS.unknown, { keyboard: mainKeyboard(ctx.env) });
    return;
  }
  log(`\u043A\u043E\u043C\u0430\u043D\u0434\u0430 /${parsed.command} \u043E\u0442 ${userId}`);
  switch (parsed.command) {
    case "start": {
      const isReferral = parsed.payload.startsWith("ref_");
      const text = isReferral ? `${TEXTS.referral(displayName(update))}

${TEXTS.greeting(displayName(update))}` : TEXTS.greeting(displayName(update));
      await ctx.api.sendMessage(chatId, text, { keyboard: mainKeyboard(ctx.env) });
      return;
    }
    case "play":
      await ctx.api.sendMessage(chatId, "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u044E \u0438\u0433\u0440\u0443:", { keyboard: mainKeyboard(ctx.env) });
      return;
    case "help":
      await ctx.api.sendMessage(chatId, TEXTS.help, { keyboard: mainKeyboard(ctx.env) });
      return;
    case "chances":
      await ctx.api.sendMessage(chatId, TEXTS.chances, { keyboard: mainKeyboard(ctx.env) });
      return;
    case "rules":
      await ctx.api.sendMessage(chatId, TEXTS.rules, { keyboard: mainKeyboard(ctx.env) });
      return;
    case "profile":
      await sendProfile(ctx, chatId, userId);
      return;
    case "share": {
      const link = shareKeyboard(ctx.env, `ref_${userId}`);
      await ctx.api.sendMessage(
        chatId,
        "\u041F\u043E\u0437\u043E\u0432\u0438 \u0434\u0440\u0443\u0437\u0435\u0439 \u2014 \u043F\u043E \u0441\u0441\u044B\u043B\u043A\u0435 \u043E\u043D\u0438 \u043F\u043E\u043F\u0430\u0434\u0443\u0442 \u0432 \u0438\u0433\u0440\u0443 \u0441 \u043F\u043E\u043C\u0435\u0442\u043A\u043E\u0439 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F.",
        { keyboard: link }
      );
      return;
    }
    default:
      await ctx.api.sendMessage(chatId, TEXTS.unknown, { keyboard: mainKeyboard(ctx.env) });
  }
}
async function sendProfile(ctx, chatId, telegramId) {
  if (!ctx.profile) {
    await ctx.api.sendMessage(chatId, TEXTS.profileUnavailable, {
      keyboard: mainKeyboard(ctx.env)
    });
    return;
  }
  try {
    const profile = await ctx.profile(telegramId);
    if (!profile) {
      await ctx.api.sendMessage(chatId, TEXTS.profileUnavailable, {
        keyboard: mainKeyboard(ctx.env)
      });
      return;
    }
    await ctx.api.sendMessage(chatId, profileText(profile), { keyboard: mainKeyboard(ctx.env) });
  } catch {
    await ctx.api.sendMessage(chatId, TEXTS.error, { keyboard: mainKeyboard(ctx.env) });
  }
}

// src/setup.ts
var COMMANDS = [
  { command: "play", description: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0438\u0433\u0440\u0443" },
  { command: "chances", description: "\u0428\u0430\u043D\u0441\u044B \u0432\u044B\u043F\u0430\u0434\u0435\u043D\u0438\u044F \u043F\u043E \u0442\u0430\u0440\u0438\u0444\u0430\u043C" },
  { command: "rules", description: "\u041A\u0430\u043A \u0441\u0447\u0438\u0442\u0430\u044E\u0442\u0441\u044F \u043E\u0447\u043A\u0438 \u0438 \u0446\u0435\u043D\u0430" },
  { command: "profile", description: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C: \u0443\u0440\u043E\u0432\u0435\u043D\u044C, \u0431\u0430\u043B\u0430\u043D\u0441, \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F" },
  { command: "share", description: "\u0421\u0441\u044B\u043B\u043A\u0430 \u0434\u043B\u044F \u0434\u0440\u0443\u0437\u0435\u0439" },
  { command: "help", description: "\u0427\u0442\u043E \u0443\u043C\u0435\u0435\u0442 \u0431\u043E\u0442" }
];
async function configureBot(api, env) {
  const warnings = [];
  const me = await api.getMe();
  if (!me.is_bot) warnings.push("getMe \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435 \u0431\u043E\u0442\u0430 \u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u0442\u043E\u043A\u0435\u043D");
  const commands = await api.setMyCommands(COMMANDS);
  const menuButton = await api.setChatMenuButton({
    type: "web_app",
    text: env.webappTitle.slice(0, 64),
    web_app: { url: webappLink(env) }
  });
  const username = me.username ?? env.botUsername ?? null;
  if (!username) {
    warnings.push("\u0443 \u0431\u043E\u0442\u0430 \u043D\u0435\u0442 username \u2014 \u043A\u043E\u043C\u0430\u043D\u0434\u0430 /share \u043D\u0435 \u0441\u043C\u043E\u0436\u0435\u0442 \u0441\u043E\u0431\u0440\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443");
  }
  return { commands, menuButton, username, warnings };
}

// src/selftest.ts
var calls = [];
var inbox = [];
var failures = 0;
function check(label, condition, detail = "") {
  console.log(`  ${condition ? "ok  " : "FAIL"} ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  if (!condition) failures += 1;
}
function lastCall(method) {
  return [...calls].reverse().find((call) => call.method === method);
}
function normalizeSpaces(value) {
  return value.replace(/[\u00A0\u202F\u2009]/g, " ");
}
function respond(res, result) {
  if (res.writableEnded) return;
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, result }));
}
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return true;
    await sleep(100);
  }
  return predicate();
}
function startFakeApi() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = url.pathname.split("/").pop() ?? "";
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      let payload = {};
      try {
        payload = body ? JSON.parse(body) : {};
      } catch {
        payload = {};
      }
      calls.push({ method, payload });
      let result = true;
      if (method === "getMe") {
        result = {
          id: 1,
          is_bot: true,
          first_name: "\u0426\u0438\u0444\u0435\u0440\u043A\u0438",
          username: "ciferki_bot"
        };
      } else if (method === "getUpdates") {
        const offset = Number(payload.offset ?? 0);
        result = inbox.filter((update) => update.update_id >= offset);
        inbox = [];
        const wait = Math.min(Number(payload.timeout ?? 0), 1) * 1e3;
        if (wait > 0) {
          setTimeout(() => respond(res, result), wait);
          return;
        }
      } else if (method === "sendMessage") {
        result = {
          message_id: calls.length,
          chat: { id: payload.chat_id, type: "private" },
          date: Math.floor(Date.now() / 1e3),
          text: payload.text
        };
      }
      respond(res, result);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, port });
    });
  });
}
function messageUpdate(id, text) {
  return {
    update_id: id,
    message: {
      message_id: id,
      from: { id: 4242, is_bot: false, first_name: "\u0414\u0438\u0434\u0436\u0435\u0439", username: "dj" },
      chat: { id: 4242, type: "private" },
      date: Math.floor(Date.now() / 1e3),
      text
    }
  };
}
async function main() {
  console.log("\n\u0420\u0430\u0437\u0431\u043E\u0440 \u043A\u043E\u043C\u0430\u043D\u0434");
  check("\u043E\u0431\u044B\u0447\u043D\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430", parseCommand("/start")?.command === "start");
  check("\u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u0441 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u043C", parseCommand("/start ref_42")?.payload === "ref_42");
  check("\u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u0441 \u0430\u0434\u0440\u0435\u0441\u0430\u0446\u0438\u0435\u0439 \u0431\u043E\u0442\u0430", parseCommand("/help@ciferki_bot")?.command === "help");
  check("\u0440\u0435\u0433\u0438\u0441\u0442\u0440 \u043D\u0435 \u0432\u0430\u0436\u0435\u043D", parseCommand("/START")?.command === "start");
  check("\u043E\u0431\u044B\u0447\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u043D\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u0430", parseCommand("\u043F\u0440\u0438\u0432\u0435\u0442") === null);
  check("\u043F\u0443\u0441\u0442\u043E\u0439 \u0442\u0435\u043A\u0441\u0442 \u043D\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u0430", parseCommand(void 0) === null);
  const { server, port } = await startFakeApi();
  process.env.BOT_TOKEN = "test-token";
  const env = {
    ...loadBotEnv({
      BOT_TOKEN: "test-token",
      WEBAPP_URL: "https://ciferki.example/app",
      WEBAPP_TITLE: "\u0426\u0438\u0444\u0435\u0440\u043A\u0438",
      BOT_USERNAME: "ciferki_bot"
    }),
    apiBase: `http://127.0.0.1:${port}`
  };
  const api = new TelegramApi(env.botToken, env.apiBase);
  console.log("\n\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0431\u043E\u0442\u0430");
  const setup = await configureBot(api, env);
  check("getMe \u0432\u044B\u0437\u0432\u0430\u043D", Boolean(lastCall("getMe")));
  check("\u043A\u043E\u043C\u0430\u043D\u0434\u044B \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B", setup.commands === true);
  check("\u043A\u043D\u043E\u043F\u043A\u0430 \u043C\u0435\u043D\u044E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430", setup.menuButton === true);
  const menuCall = lastCall("setChatMenuButton");
  check("\u043C\u0435\u043D\u044E \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 Mini App", menuCall?.payload.menu_button?.type === "web_app");
  check(
    "\u0430\u0434\u0440\u0435\u0441 \u0432 \u043A\u043D\u043E\u043F\u043A\u0435 \u043C\u0435\u043D\u044E \u0432\u0435\u0440\u043D\u044B\u0439",
    menuCall?.payload.menu_button?.web_app?.url === "https://ciferki.example/app",
    String(menuCall?.payload.menu_button?.web_app?.url)
  );
  check("\u0438\u043C\u044F \u0431\u043E\u0442\u0430 \u043F\u043E\u0434\u0445\u0432\u0430\u0447\u0435\u043D\u043E \u0438\u0437 getMe", setup.username === "ciferki_bot");
  console.log("\n\u0414\u043B\u0438\u043D\u043D\u044B\u0439 \u043E\u043F\u0440\u043E\u0441");
  inbox = [messageUpdate(100, "/start")];
  const first = await api.getUpdates(0, 0);
  check("\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E", first.length === 1, String(first.length));
  inbox = [];
  const afterOffset = await api.getUpdates(first[0].update_id + 1, 0);
  check("\u0441\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0434\u0432\u0438\u043D\u0443\u0442\u043E, \u043F\u043E\u0432\u0442\u043E\u0440 \u043D\u0435 \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442", afterOffset.length === 0, String(afterOffset.length));
  console.log("\n\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u043A\u043E\u043C\u0430\u043D\u0434");
  const ctx = { api, env, log: () => void 0 };
  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(200, "/start"));
  const startCall = lastCall("sendMessage");
  const startKeyboard = startCall?.payload.inline_keyboard;
  check("/start \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435\u043C", Boolean(startCall));
  check(
    "/start \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043A\u043D\u043E\u043F\u043A\u0443 web_app",
    Array.isArray(startKeyboard) && startKeyboard[0]?.[0]?.web_app?.url === "https://ciferki.example/app"
  );
  check(
    "\u0442\u0435\u043A\u0441\u0442 \u043F\u0440\u0438\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u044F \u043D\u0430 \u043C\u0435\u0441\u0442\u0435",
    typeof startCall?.payload.text === "string" && startCall.payload.text.includes("\u0426\u0438\u0444\u0435\u0440\u043A\u0438")
  );
  check(
    "\u0432 \u043A\u043B\u0430\u0432\u0438\u0430\u0442\u0443\u0440\u0435 \u0435\u0441\u0442\u044C \u0431\u044B\u0441\u0442\u0440\u044B\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u044B",
    Array.isArray(startKeyboard) && startKeyboard[1]?.length === 3
  );
  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(201, "/start ref_777"));
  check(
    "\u0440\u0435\u0444\u0435\u0440\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u043E\u0442\u043B\u0438\u0447\u0430\u0435\u0442\u0441\u044F \u0442\u0435\u043A\u0441\u0442\u043E\u043C",
    String(lastCall("sendMessage")?.payload.text).includes("\u043F\u043E\u0437\u0432\u0430\u043B\u0438 \u043F\u043E \u0441\u0441\u044B\u043B\u043A\u0435")
  );
  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(202, "/share"));
  const shareCall = lastCall("sendMessage");
  const shareRows = shareCall?.payload.inline_keyboard ?? [];
  const shareButton = shareRows.flat().find((button) => button.url?.includes("t.me/share"));
  check("\u043A\u043D\u043E\u043F\u043A\u0430 \xAB\u043F\u043E\u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F\xBB \u0432\u0435\u0434\u0451\u0442 \u0432 t.me/share", Boolean(shareButton));
  check(
    "\u0432 \u0441\u0441\u044B\u043B\u043A\u0435 \u0435\u0441\u0442\u044C \u043C\u0435\u0442\u043A\u0430 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F",
    String(shareButton?.url).includes("ref_4242"),
    String(shareButton?.url)
  );
  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(203, "/profile"));
  check(
    "\u0431\u0435\u0437 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430 \u043F\u0440\u043E\u0444\u0438\u043B\u044F \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430",
    lastCall("sendMessage")?.payload.text === TEXTS.profileUnavailable
  );
  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(204, "/profile"));
  calls.length = 0;
  await handleUpdate(
    { ...ctx, profile: async () => ({ name: "\u0414\u0438\u0434\u0436\u0435\u0439", level: 4, balance: 113280, numbers: 18, portfolio: 24e4 }) },
    messageUpdate(205, "/profile")
  );
  const profileText2 = String(lastCall("sendMessage")?.payload.text);
  check("\u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0443\u0440\u043E\u0432\u0435\u043D\u044C", profileText2.includes("\u0423\u0440\u043E\u0432\u0435\u043D\u044C: 4"), profileText2.slice(0, 40));
  check(
    "\u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0431\u0430\u043B\u0430\u043D\u0441",
    normalizeSpaces(profileText2).includes("113 280"),
    normalizeSpaces(profileText2).split("\n")[2] ?? ""
  );
  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(206, "/\u0447\u0435\u043F\u0443\u0445\u0430"));
  check("\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u043E\u0439", lastCall("sendMessage")?.payload.text === TEXTS.unknown);
  calls.length = 0;
  await handleUpdate(ctx, messageUpdate(207, "\u043F\u0440\u043E\u0441\u0442\u043E \u0442\u0435\u043A\u0441\u0442"));
  check("\u043E\u0431\u044B\u0447\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 \u0442\u0443 \u0436\u0435 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0443", lastCall("sendMessage")?.payload.text === TEXTS.unknown);
  calls.length = 0;
  await handleUpdate(ctx, {
    update_id: 300,
    callback_query: {
      id: "cb-1",
      from: { id: 4242, is_bot: false, first_name: "\u0414\u0438\u0434\u0436\u0435\u0439" },
      data: "chances",
      message: {
        message_id: 10,
        chat: { id: 4242, type: "private" },
        date: Math.floor(Date.now() / 1e3)
      }
    }
  });
  check("\u043D\u0430\u0436\u0430\u0442\u0438\u0435 \u043A\u043D\u043E\u043F\u043A\u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E", Boolean(lastCall("answerCallbackQuery")));
  check("\u043A\u043D\u043E\u043F\u043A\u0430 \xAB\u0448\u0430\u043D\u0441\u044B\xBB \u043F\u0440\u0438\u0441\u044B\u043B\u0430\u0435\u0442 \u0442\u0430\u0431\u043B\u0438\u0446\u0443", lastCall("sendMessage")?.payload.text === TEXTS.chances);
  calls.length = 0;
  await handleUpdate(ctx, {
    update_id: 301,
    callback_query: {
      id: "cb-2",
      from: { id: 4242, is_bot: false, first_name: "\u0414\u0438\u0434\u0436\u0435\u0439" },
      data: "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F",
      message: {
        message_id: 11,
        chat: { id: 4242, type: "private" },
        date: Math.floor(Date.now() / 1e3)
      }
    }
  });
  check("\u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0430\u044F \u043A\u043D\u043E\u043F\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442\u0441\u044F", lastCall("sendMessage")?.payload.text === TEXTS.stale);
  console.log("\n\u041E\u0448\u0438\u0431\u043A\u0430 Bot API");
  const badApi = new TelegramApi(env.botToken, `http://127.0.0.1:${port}`);
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 7 } }), {
    status: 429,
    headers: { "Content-Type": "application/json" }
  });
  let caught = null;
  try {
    await badApi.getMe();
  } catch (error) {
    caught = error;
  }
  globalThis.fetch = original;
  check("\u043E\u0448\u0438\u0431\u043A\u0430 Bot API \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u043D\u0430", caught instanceof Error);
  check(
    "\u0437\u0430\u0434\u0435\u0440\u0436\u043A\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u0430 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u0430",
    caught?.retryAfterSeconds === 7,
    String(caught?.retryAfterSeconds)
  );
  console.log("\n\u0417\u0430\u043F\u0443\u0441\u043A \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0430 \u0431\u043E\u0442\u0430");
  const bundle = process.env.BOT_BUNDLE;
  if (!bundle) {
    console.log("  --   \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E: BOT_BUNDLE \u043D\u0435 \u0437\u0430\u0434\u0430\u043D");
    server.close();
    console.log(failures === 0 ? "\n\u041F\u0420\u041E\u0412\u0415\u0420\u041A\u0410 \u0411\u041E\u0422\u0410 \u041F\u0420\u041E\u0419\u0414\u0415\u041D\u0410" : `
\u041F\u0420\u041E\u0412\u0410\u041B\u041E\u0412: ${failures}`);
    process.exit(failures === 0 ? 0 : 1);
  }
  const before = calls.length;
  const bot = spawn(process.execPath, ["--enable-source-maps", bundle], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "test",
      BOT_TOKEN: "test-token",
      BOT_API_BASE: `http://127.0.0.1:${port}`,
      WEBAPP_URL: "https://ciferki.example/app",
      BOT_USERNAME: "ciferki_bot",
      POLL_TIMEOUT: "1"
    }
  });
  let botLog = "";
  bot.stdout.on("data", (chunk) => {
    botLog += chunk;
  });
  bot.stderr.on("data", (chunk) => {
    botLog += chunk;
  });
  const sinceBoot = () => calls.slice(before);
  const polling = await waitFor(
    () => sinceBoot().some((call) => call.method === "getUpdates"),
    1e4
  );
  check("\u043F\u0440\u043E\u0446\u0435\u0441\u0441 \u0431\u043E\u0442\u0430 \u043F\u043E\u0434\u043D\u044F\u043B\u0441\u044F \u0438 \u043E\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u0442 Telegram", polling, botLog.slice(0, 200));
  const bootMethods = sinceBoot().map((call) => call.method);
  check("\u043F\u0440\u0438 \u0441\u0442\u0430\u0440\u0442\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B \u043A\u043E\u043C\u0430\u043D\u0434\u044B", bootMethods.includes("setMyCommands"), bootMethods.join(", "));
  check("\u043F\u0440\u0438 \u0441\u0442\u0430\u0440\u0442\u0435 \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0430 \u043A\u043D\u043E\u043F\u043A\u0430 \u043C\u0435\u043D\u044E", bootMethods.includes("setChatMenuButton"));
  inbox = [messageUpdate(900, "/start")];
  const answered = await waitFor(
    () => sinceBoot().some(
      (call) => call.method === "sendMessage" && String(call.payload.text ?? "").includes("\u0426\u0438\u0444\u0435\u0440\u043A\u0438")
    ),
    1e4
  );
  check("\u0436\u0438\u0432\u043E\u0439 \u043E\u043F\u0440\u043E\u0441 \u0434\u043E\u043D\u043E\u0441\u0438\u0442 /start \u0434\u043E \u043E\u0442\u0432\u0435\u0442\u0430", answered);
  const liveAnswer = [...sinceBoot()].reverse().find(
    (call) => call.method === "sendMessage" && String(call.payload.text ?? "").includes("\u0426\u0438\u0444\u0435\u0440\u043A\u0438")
  );
  check(
    "\u0432 \u0436\u0438\u0432\u043E\u043C \u043E\u0442\u0432\u0435\u0442\u0435 \u0435\u0441\u0442\u044C \u043A\u043D\u043E\u043F\u043A\u0430 Mini App",
    liveAnswer?.payload.inline_keyboard?.[0]?.[0]?.web_app?.url === "https://ciferki.example/app",
    String(liveAnswer?.payload.inline_keyboard?.[0]?.[0]?.web_app?.url)
  );
  if (!answered) console.log(botLog.slice(-1500));
  bot.kill();
  await sleep(400);
  server.close();
  console.log(failures === 0 ? "\n\u041F\u0420\u041E\u0412\u0415\u0420\u041A\u0410 \u0411\u041E\u0422\u0410 \u041F\u0420\u041E\u0419\u0414\u0415\u041D\u0410" : `
\u041F\u0420\u041E\u0412\u0410\u041B\u041E\u0412: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}
void main();
//# sourceMappingURL=selftest.mjs.map
