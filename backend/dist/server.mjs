// src/app.ts
import cors from "cors";
import express from "express";

// src/telegram-auth.ts
import { createHmac, timingSafeEqual } from "node:crypto";
var MAX_AGE_SECONDS = 24 * 60 * 60;
function verifyInitData(initData, botToken, options = {}) {
  if (!botToken) return { ok: false, user: null, authDate: null, reason: "no_token" };
  if (!initData) return { ok: false, user: null, authDate: null, reason: "empty" };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, user: null, authDate: null, reason: "no_hash" };
  params.delete("hash");
  params.delete("signature");
  const dataCheckString = [...params.entries()].map(([key, value]) => `${key}=${value}`).sort().join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!safeEqualHex(expected, hash)) {
    return { ok: false, user: null, authDate: null, reason: "bad_hash" };
  }
  const authDateSeconds = Number(params.get("auth_date"));
  const now = options.now ?? Date.now();
  const maxAge = options.maxAgeSeconds ?? MAX_AGE_SECONDS;
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    return { ok: false, user: null, authDate: null, reason: "expired" };
  }
  if (now / 1e3 - authDateSeconds > maxAge) {
    return { ok: false, user: null, authDate: null, reason: "expired" };
  }
  const rawUser = params.get("user");
  if (!rawUser) return { ok: false, user: null, authDate: null, reason: "no_user" };
  let user;
  try {
    user = JSON.parse(rawUser);
  } catch {
    return { ok: false, user: null, authDate: null, reason: "bad_json" };
  }
  if (!Number.isFinite(user.id)) {
    return { ok: false, user: null, authDate: null, reason: "no_user" };
  }
  return { ok: true, user, authDate: new Date(authDateSeconds * 1e3) };
}
function safeEqualHex(a, b) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}
function devUser(header) {
  if (!header) return null;
  const id = Number(header);
  if (!Number.isFinite(id)) return null;
  return { id, first_name: `\u0422\u0435\u0441\u0442${id}`, username: `dev${id}` };
}

// src/middleware/auth.ts
var INIT_DATA_HEADER = "x-telegram-init-data";
var DEV_USER_HEADER = "x-dev-user";
function createAuthMiddleware(repo, env) {
  return async (req, res, next) => {
    try {
      const initData = req.header(INIT_DATA_HEADER) ?? "";
      let user = null;
      if (initData) {
        const result = verifyInitData(initData, env.botToken);
        if (!result.ok) {
          console.warn(`[auth] \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430: ${result.reason}`);
          res.status(401).json({ error: "invalid_init_data" });
          return;
        }
        user = result.user;
      } else if (env.allowDevAuth) {
        user = devUser(req.header(DEV_USER_HEADER));
      }
      if (!user) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      const isAdmin = env.adminTelegramIds.includes(user.id);
      const player = await repo.getOrCreatePlayer(user, isAdmin);
      if (player.isBanned) {
        res.status(403).json({ error: "banned" });
        return;
      }
      req.player = player;
      req.telegramUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
function requireAdmin(req, res, next) {
  if (!req.player?.isAdmin) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  next();
}
function requirePlayer(req, res, next) {
  if (!req.player) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

// src/middleware/errors.ts
function asyncHandler(handler) {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
function createErrorHandler(repo) {
  return (error, req, res, _next) => {
    console.error(`[error] ${req.method} ${req.path}:`, error.message);
    void repo.recordAudit(req.player?.id ?? null, "error", {
      path: req.path,
      method: req.method,
      message: error.message
    }).catch(() => void 0);
    if (res.headersSent) return;
    res.status(500).json({ error: "internal_error" });
  };
}
function badRequest(res, error) {
  res.status(400).json({ error });
}

// src/routes/admin.ts
import { Router } from "express";

// ../shared/src/config.ts
var RARITY_ORDER = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic"
];
var RARITIES = {
  common: {
    id: "common",
    name: "\u041E\u0431\u044B\u0447\u043D\u044B\u0439",
    whyName: "\u041E\u0431\u044B\u0447\u043D\u044B\u0439",
    color: "#9AA0A6",
    glow: "rgba(154,160,166,0.18)",
    basePrice: 1500,
    xp: 12
  },
  uncommon: {
    id: "uncommon",
    name: "\u041D\u0435\u043E\u0431\u044B\u0447\u043D\u044B\u0439",
    whyName: "\u041D\u0435\u043E\u0431\u044B\u0447\u043D\u044B\u0439",
    color: "#22C55E",
    glow: "rgba(34,197,94,0.20)",
    basePrice: 3200,
    xp: 26
  },
  rare: {
    id: "rare",
    name: "\u0420\u0435\u0434\u043A\u0438\u0439",
    whyName: "\u0420\u0435\u0434\u043A\u0438\u0439",
    color: "#3B82F6",
    glow: "rgba(59,130,246,0.24)",
    basePrice: 14e3,
    xp: 70
  },
  epic: {
    id: "epic",
    name: "\u042D\u043F\u0438\u0447\u0435\u0441\u043A\u0438\u0439",
    whyName: "\u042D\u043F\u0438\u0447\u0435\u0441\u043A\u0438\u0439",
    color: "#A855F7",
    glow: "rgba(168,85,247,0.28)",
    basePrice: 75e3,
    xp: 220
  },
  legendary: {
    id: "legendary",
    name: "\u041B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0439",
    whyName: "\u041B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0439",
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.30)",
    basePrice: 52e4,
    xp: 900
  },
  mythic: {
    id: "mythic",
    name: "\u041C\u0438\u0444\u0438\u0447\u0435\u0441\u043A\u0438\u0439",
    whyName: "\u041C\u0438\u0444\u0438\u0447\u0435\u0441\u043A\u0438\u0439",
    color: "#EF4444",
    glow: "rgba(239,68,68,0.34)",
    basePrice: 4e6,
    xp: 4e3
  }
};
var SCORE_BANDS = [
  { upTo: 9, rarity: "common" },
  { upTo: 39, rarity: "uncommon" },
  { upTo: 79, rarity: "rare" },
  { upTo: 139, rarity: "epic" },
  { upTo: 219, rarity: "legendary" },
  { upTo: Number.POSITIVE_INFINITY, rarity: "mythic" }
];
function rarityForScore(score) {
  for (const band of SCORE_BANDS) {
    if (score <= band.upTo) return band.rarity;
  }
  return "mythic";
}
var TARIFFS = {
  standard: {
    id: "standard",
    name: "\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442",
    price: 1700,
    ticketCost: null,
    tagline: "\u0442\u0430\u0440\u0438\u0444 \u0426\u0438\u0444\u0435\u0440\u043E\u043A",
    stripe: "#E5E7EB",
    gradient: "linear-gradient(135deg, #F4F4F5 0%, #FFFFFF 52%, #EDEDEF 100%)",
    accent: "#9AA0A6",
    odds: {
      mythic: 3e-4,
      legendary: 59e-4,
      epic: 0.72,
      rare: 6,
      uncommon: 25,
      common: 68.2738
    },
    xpMultiplier: 1
  },
  plus: {
    id: "plus",
    name: "\u041F\u043B\u044E\u0441",
    price: 7e3,
    ticketCost: null,
    tagline: "\u0442\u0430\u0440\u0438\u0444 \u0426\u0438\u0444\u0435\u0440\u043E\u043A",
    stripe: "#38BDF8",
    gradient: "linear-gradient(135deg, #7DD3FC 0%, #F0F9FF 46%, #FFFFFF 100%)",
    accent: "#38BDF8",
    odds: {
      mythic: 2e-3,
      legendary: 0.12,
      epic: 5,
      rare: 23.878,
      uncommon: 30,
      common: 41
    },
    xpMultiplier: 2
  },
  premium: {
    id: "premium",
    name: "\u041F\u0440\u0435\u043C\u0438\u0443\u043C",
    price: 34500,
    ticketCost: null,
    tagline: "\u0442\u0430\u0440\u0438\u0444 \u0426\u0438\u0444\u0435\u0440\u043E\u043A",
    stripe: "#A855F7",
    gradient: "linear-gradient(135deg, #C084FC 0%, #F5F0FF 46%, #FFFFFF 100%)",
    accent: "#A855F7",
    odds: {
      mythic: 0.01,
      legendary: 0.77,
      epic: 24,
      rare: 75.22,
      uncommon: 0,
      common: 0
    },
    xpMultiplier: 4
  },
  elite: {
    id: "elite",
    name: "\u042D\u043B\u0438\u0442",
    price: null,
    ticketCost: 1,
    tagline: "\u0442\u0430\u0440\u0438\u0444 \u0426\u0438\u0444\u0435\u0440\u043E\u043A",
    stripe: "#F0B90B",
    gradient: "linear-gradient(135deg, #FCD34D 0%, #FFF8E1 44%, #FFFFFF 100%)",
    accent: "#F0B90B",
    odds: {
      mythic: 0.02,
      legendary: 3.03,
      epic: 96.95,
      rare: 0,
      uncommon: 0,
      common: 0
    },
    xpMultiplier: 8
  }
};
var COUNTRIES = [
  {
    id: "ru",
    name: "\u0420\u043E\u0441\u0441\u0438\u044F",
    code: "+7",
    flag: "\u{1F1F7}\u{1F1FA}",
    demand: 1,
    mask: "+7 AAA BBB-CC-DD"
  },
  {
    id: "us",
    name: "\u0421\u0428\u0410",
    code: "+1",
    flag: "\u{1F1FA}\u{1F1F8}",
    demand: 1.15,
    mask: "+1 (AAA) BBB-CCCC"
  },
  {
    id: "gb",
    name: "\u0412\u0435\u043B\u0438\u043A\u043E\u0431\u0440\u0438\u0442\u0430\u043D\u0438\u044F",
    code: "+44",
    flag: "\u{1F1EC}\u{1F1E7}",
    demand: 1.18,
    mask: "+44 AAAA BBBBBB"
  },
  {
    id: "de",
    name: "\u0413\u0435\u0440\u043C\u0430\u043D\u0438\u044F",
    code: "+49",
    flag: "\u{1F1E9}\u{1F1EA}",
    demand: 1.3,
    mask: "+49 AAA BBBBBBBB"
  },
  {
    id: "fr",
    name: "\u0424\u0440\u0430\u043D\u0446\u0438\u044F",
    code: "+33",
    flag: "\u{1F1EB}\u{1F1F7}",
    demand: 1.15,
    mask: "+33 A BB CC DD EE"
  },
  {
    id: "fi",
    name: "\u0424\u0438\u043D\u043B\u044F\u043D\u0434\u0438\u044F",
    code: "+358",
    flag: "\u{1F1EB}\u{1F1EE}",
    demand: 1.1,
    mask: "+358 AA BBB CCCC"
  },
  {
    id: "jp",
    name: "\u042F\u043F\u043E\u043D\u0438\u044F",
    code: "+81",
    flag: "\u{1F1EF}\u{1F1F5}",
    demand: 1.35,
    mask: "+81 AA-BBBB-CCCC"
  },
  {
    id: "ae",
    name: "\u041E\u0410\u042D",
    code: "+971",
    flag: "\u{1F1E6}\u{1F1EA}",
    demand: 1.4,
    mask: "+971 AA BBB CCCC"
  },
  {
    id: "kz",
    name: "\u041A\u0430\u0437\u0430\u0445\u0441\u0442\u0430\u043D",
    code: "+7",
    flag: "\u{1F1F0}\u{1F1FF}",
    demand: 0.85,
    mask: "+7 AAA BBB-CC-DD"
  },
  {
    id: "br",
    name: "\u0411\u0440\u0430\u0437\u0438\u043B\u0438\u044F",
    code: "+55",
    flag: "\u{1F1E7}\u{1F1F7}",
    demand: 0.7,
    mask: "+55 AA BBBBB-CCCC"
  },
  {
    id: "tr",
    name: "\u0422\u0443\u0440\u0446\u0438\u044F",
    code: "+90",
    flag: "\u{1F1F9}\u{1F1F7}",
    demand: 0.95,
    mask: "+90 AAA BBB CCCC"
  },
  {
    id: "es",
    name: "\u0418\u0441\u043F\u0430\u043D\u0438\u044F",
    code: "+34",
    flag: "\u{1F1EA}\u{1F1F8}",
    demand: 1.05,
    mask: "+34 AAA BBB CCC"
  },
  {
    id: "it",
    name: "\u0418\u0442\u0430\u043B\u0438\u044F",
    code: "+39",
    flag: "\u{1F1EE}\u{1F1F9}",
    demand: 1.1,
    mask: "+39 AAA BBB CCCC"
  },
  {
    id: "pl",
    name: "\u041F\u043E\u043B\u044C\u0448\u0430",
    code: "+48",
    flag: "\u{1F1F5}\u{1F1F1}",
    demand: 0.9,
    mask: "+48 AAA BBB CCC"
  },
  {
    id: "cn",
    name: "\u041A\u0438\u0442\u0430\u0439",
    code: "+86",
    flag: "\u{1F1E8}\u{1F1F3}",
    demand: 1.25,
    mask: "+86 AAA BBBB CCCC"
  },
  {
    id: "in",
    name: "\u0418\u043D\u0434\u0438\u044F",
    code: "+91",
    flag: "\u{1F1EE}\u{1F1F3}",
    demand: 0.75,
    mask: "+91 AAAAA BBBBB"
  },
  {
    id: "kr",
    name: "\u042E\u0436\u043D\u0430\u044F \u041A\u043E\u0440\u0435\u044F",
    code: "+82",
    flag: "\u{1F1F0}\u{1F1F7}",
    demand: 1.3,
    mask: "+82 AA BBBB CCCC"
  },
  {
    id: "ca",
    name: "\u041A\u0430\u043D\u0430\u0434\u0430",
    code: "+1",
    flag: "\u{1F1E8}\u{1F1E6}",
    demand: 1.05,
    mask: "+1 (AAA) BBB-CCCC"
  },
  {
    id: "au",
    name: "\u0410\u0432\u0441\u0442\u0440\u0430\u043B\u0438\u044F",
    code: "+61",
    flag: "\u{1F1E6}\u{1F1FA}",
    demand: 1.1,
    mask: "+61 AAA BBB CCC"
  },
  {
    id: "mx",
    name: "\u041C\u0435\u043A\u0441\u0438\u043A\u0430",
    code: "+52",
    flag: "\u{1F1F2}\u{1F1FD}",
    demand: 0.8,
    mask: "+52 AA BBBB CCCC"
  },
  {
    id: "nl",
    name: "\u041D\u0438\u0434\u0435\u0440\u043B\u0430\u043D\u0434\u044B",
    code: "+31",
    flag: "\u{1F1F3}\u{1F1F1}",
    demand: 1.12,
    mask: "+31 AA BBB CCCC"
  },
  {
    id: "se",
    name: "\u0428\u0432\u0435\u0446\u0438\u044F",
    code: "+46",
    flag: "\u{1F1F8}\u{1F1EA}",
    demand: 1.08,
    mask: "+46 AA BBB CCCC"
  },
  {
    id: "ch",
    name: "\u0428\u0432\u0435\u0439\u0446\u0430\u0440\u0438\u044F",
    code: "+41",
    flag: "\u{1F1E8}\u{1F1ED}",
    demand: 1.45,
    mask: "+41 AA BBB CCCC"
  },
  {
    id: "pt",
    name: "\u041F\u043E\u0440\u0442\u0443\u0433\u0430\u043B\u0438\u044F",
    code: "+351",
    flag: "\u{1F1F5}\u{1F1F9}",
    demand: 0.95,
    mask: "+351 AAA BBB CCC"
  },
  {
    id: "cz",
    name: "\u0427\u0435\u0445\u0438\u044F",
    code: "+420",
    flag: "\u{1F1E8}\u{1F1FF}",
    demand: 0.92,
    mask: "+420 AAA BBB CCC"
  },
  {
    id: "by",
    name: "\u0411\u0435\u043B\u0430\u0440\u0443\u0441\u044C",
    code: "+375",
    flag: "\u{1F1E7}\u{1F1FE}",
    demand: 0.74,
    mask: "+375 (AA) AAA-AA-AA"
  },
  {
    id: "ua",
    name: "\u0423\u043A\u0440\u0430\u0438\u043D\u0430",
    code: "+380",
    flag: "\u{1F1FA}\u{1F1E6}",
    demand: 0.81,
    mask: "+380 (AA) AAA-AA-AA"
  },
  {
    id: "ro",
    name: "\u0420\u0443\u043C\u044B\u043D\u0438\u044F",
    code: "+40",
    flag: "\u{1F1F7}\u{1F1F4}",
    demand: 0.88,
    mask: "+40 AAA-AAA-AAA"
  },
  {
    id: "gr",
    name: "\u0413\u0440\u0435\u0446\u0438\u044F",
    code: "+30",
    flag: "\u{1F1EC}\u{1F1F7}",
    demand: 0.94,
    mask: "+30 AAA-AAA-AAAA"
  },
  {
    id: "hu",
    name: "\u0412\u0435\u043D\u0433\u0440\u0438\u044F",
    code: "+36",
    flag: "\u{1F1ED}\u{1F1FA}",
    demand: 0.9,
    mask: "+36 (AA) AAA-AAAA"
  },
  {
    id: "at",
    name: "\u0410\u0432\u0441\u0442\u0440\u0438\u044F",
    code: "+43",
    flag: "\u{1F1E6}\u{1F1F9}",
    demand: 1.12,
    mask: "+43 AAA-AAAAAAA"
  },
  {
    id: "be",
    name: "\u0411\u0435\u043B\u044C\u0433\u0438\u044F",
    code: "+32",
    flag: "\u{1F1E7}\u{1F1EA}",
    demand: 1.08,
    mask: "+32 (AAA) AA-AA-AA"
  },
  {
    id: "dk",
    name: "\u0414\u0430\u043D\u0438\u044F",
    code: "+45",
    flag: "\u{1F1E9}\u{1F1F0}",
    demand: 1.16,
    mask: "+45 AA-AA-AA-AA"
  },
  {
    id: "no",
    name: "\u041D\u043E\u0440\u0432\u0435\u0433\u0438\u044F",
    code: "+47",
    flag: "\u{1F1F3}\u{1F1F4}",
    demand: 1.22,
    mask: "+47 AAA-AA-AAA"
  },
  {
    id: "ie",
    name: "\u0418\u0440\u043B\u0430\u043D\u0434\u0438\u044F",
    code: "+353",
    flag: "\u{1F1EE}\u{1F1EA}",
    demand: 1.1,
    mask: "+353 (AA) AAA-AAAA"
  }
];
var COUNTRY_BY_ID = Object.fromEntries(
  COUNTRIES.map((country) => [country.id, country])
);
var ANONYMOUS = {
  id: "anon",
  name: "\u0410\u043D\u043E\u043D\u0438\u043C\u043D\u044B\u0439",
  code: "+888",
  flag: "\u{1F576}\uFE0F",
  demand: 1,
  mask: "+888 AAA-BBB-CC",
  /**
   * Разброс случайной надбавки. Нижняя граница держит анонимный номер дороже
   * любого обычного, верхняя — не даёт ему улететь в бесконечность: на этих
   * числах строится экономика тестов, а не витрина.
   */
  minCoefficient: 3,
  maxCoefficient: 12
};
COUNTRY_BY_ID[ANONYMOUS.id] = ANONYMOUS;
function isAnonymous(countryId) {
  return countryId === ANONYMOUS.id;
}
var PATTERN_POINTS = {
  all_same: 300,
  almost_same: 120,
  date: 90,
  palindrome: 70,
  alternating: 65,
  block_repeat: 60,
  mirror: 55,
  prefix_echo: 45,
  prefix_repeat: 40,
  ladder_up: 8,
  // за каждую цифру последовательности
  ladder_down: 7,
  // за каждую цифру последовательности — 65432 = 35
  /*
   * Длинная лесенка: шестая и каждая следующая цифра стоит дороже.
   * Шесть подряд идущих цифр встречаются куда реже пяти, и стоить должны
   * не на одну цифру дороже, а заметно. Пятизначные лесенки это не трогает,
   * поэтому опорный случай «65432» = 35 очков сохранён.
   */
  ladderLong: 30,
  series: 12,
  // за каждую цифру серии
  pairs: 8,
  // за каждую пару
  /*
   * Круглый: за каждый ноль в конце. Раньше было 25 за любые нули, поэтому
   * 5000 и 500000 стоили одинаково, хотя второе встречается намного реже.
   */
  round: 12,
  /** Первая и последняя цифры совпадают — «7…7» */
  twin_ends: 35,
  /** Две повторяющиеся пары подряд — «1122», «3344» */
  aabb: 30,
  /** Прямая по клавиатуре телефона — «147», «258», «159» */
  keypad_line: 45,
  /** Три и более нуля подряд внутри номера */
  zero_run: 20,
  country_code: 15
};
var PATTERN_ORDER = [
  "all_same",
  "series",
  "pairs",
  "block_repeat",
  "ladder_up",
  "ladder_down",
  "palindrome",
  "mirror",
  "alternating",
  "round",
  "date",
  "prefix_echo",
  "prefix_repeat",
  "country_code",
  "almost_same",
  "keypad_line",
  "twin_ends",
  "aabb",
  "zero_run"
];
var ECONOMY = {
  startingBalance: 99800,
  startingTickets: 1,
  slots: 100,
  /**
   * Надбавка за выпуск на своём операторе: игрок платит за выбор.
   * Шансы при этом не меняются — дороже только право выбрать код.
   */
  operatorSurcharge: 0.1,
  /** Сколько стоит билет на бесплатный выпуск — для расчёта призов рулетки */
  releaseTicketValue: 1700,
  /** Цена смены одной цифры номера */
  digitChangePrice: 500,
  /** Цена назначения основного номера вне бесплатных смен */
  primarySwapPrice: 500,
  freePrimarySwaps: 3,
  /**
   * Доля оценки, которую возвращает продажа.
   *
   * Не единица: без комиссии номер продаётся ровно за то, что стоит, и выпуск
   * становится безрисковым — купил и сразу вернул. 15 % — плата за то, что
   * решение «оставить или продать» снова становится решением.
   */
  sellRate: 0.85,
  /** Бонус к балансу, когда средств меньше цены Стандарта */
  bailoutThreshold: 1700,
  bailoutAmount: 1700,
  /** Сколько опыта нужно на уровень n */
  xpForLevel: (level) => 250 + (level - 1) * 120
};
var LUCK = {
  /** Удача множит шансы редких и выше, затем распределение нормализуется заново. */
  boostedRarities: ["rare", "epic", "legendary", "mythic"],
  /** Длительность бонуса в миллисекундах */
  durationMs: 3 * 60 * 60 * 1e3,
  defaultState: {
    multiplier: 2,
    expiresAt: null,
    spinsLeft: 0,
    title: "\u0418\u0432\u0435\u043D\u0442 \xB7 \u0423\u0434\u0430\u0447\u0430 \xD72",
    subtitle: "\u0423\u0434\u0430\u0447\u0430 \xD72 \u043D\u0430 \u0432\u0441\u0435 \u043A\u0440\u0443\u0442\u043A\u0438 \u2014 \u0434\u043E 00:00 \u041C\u0421\u041A"
  }
};
var UPGRADES = {
  digit: {
    id: "digit",
    name: "\u0417\u0430\u043C\u0435\u043D\u0430 \u0446\u0438\u0444\u0440\u044B",
    effect: "\u043E\u0434\u043D\u0430 \u0446\u0438\u0444\u0440\u0430 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043D\u0430 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u0443\u044E",
    description: "\u0422\u043E\u0447\u043D\u043E\u0435 \u043F\u043E\u043F\u0430\u0434\u0430\u043D\u0438\u0435 \u043F\u043E \u043F\u043E\u0437\u0438\u0446\u0438\u0438, \u043D\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0439. \u041D\u043E\u043C\u0435\u0440 \u043C\u043E\u0436\u0435\u0442 \u043F\u043E\u0434\u043E\u0440\u043E\u0436\u0430\u0442\u044C \u0438\u043B\u0438 \u043F\u043E\u0434\u0435\u0448\u0435\u0432\u0435\u0442\u044C.",
    price: 500,
    appealShare: null
  },
  swap: {
    id: "swap",
    name: "\u041F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430",
    effect: "\u0434\u0432\u0435 \u0446\u0438\u0444\u0440\u044B \u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u043C\u0435\u0441\u0442\u0430\u043C\u0438",
    description: "\u041D\u0438\u043A\u0430\u043A\u043E\u0439 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u043E\u0441\u0442\u0438: \u0441\u043E\u0441\u0442\u0430\u0432 \u0446\u0438\u0444\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F, \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0440\u044F\u0434\u043E\u043A. \u0412\u0438\u0434\u043D\u043E \u0437\u0430\u0440\u0430\u043D\u0435\u0435, \u0447\u0442\u043E \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u0441\u044F.",
    price: 900,
    appealShare: null
  },
  reroll: {
    id: "reroll",
    name: "\u041F\u0435\u0440\u0435\u0431\u043E\u0440",
    effect: "\u0432\u0441\u0435 \u0446\u0438\u0444\u0440\u044B \u043F\u043E\u0434\u0431\u0438\u0440\u0430\u044E\u0442\u0441\u044F \u0437\u0430\u043D\u043E\u0432\u043E",
    description: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F, \u0446\u0438\u0444\u0440\u044B \u043F\u0440\u0438\u0445\u043E\u0434\u044F\u0442 \u043D\u043E\u0432\u044B\u0435. \u0420\u0430\u0437\u0431\u0440\u043E\u0441 \u043E\u0447\u043A\u043E\u0432 \u0432\u043D\u0443\u0442\u0440\u0438 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u2014 \u043E\u0442 \u043D\u0438\u0436\u043D\u0435\u0439 \u0433\u0440\u0430\u043D\u0438\u0446\u044B \u0434\u043E \u0432\u0435\u0440\u0445\u043D\u0435\u0439.",
    price: 5e3,
    appealShare: null
  },
  appeal: {
    id: "appeal",
    name: "\u0410\u043F\u0435\u043B\u043B\u044F\u0446\u0438\u044F",
    effect: "\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043F\u043E\u0434\u043D\u0438\u043C\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u0441\u0442\u0443\u043F\u0435\u043D\u044C",
    description: "\u0413\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043F\u043E\u0434\u044A\u0451\u043C \u0431\u0435\u0437 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u043E\u0441\u0442\u0438: \u043D\u043E\u043C\u0435\u0440 \u043F\u0435\u0440\u0435\u0432\u044B\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u0432 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438. \u0426\u0435\u043D\u0430 \u0440\u0430\u0441\u0442\u0451\u0442 \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0435\u0439.",
    price: null,
    // Гарантированный переход в следующую категорию: половина её базы делала
    // апелляцию дешевле обычного выпуска, и прогрессия ломалась.
    appealShare: 0.85
  },
  operator: {
    id: "operator",
    name: "\u0421\u043C\u0435\u043D\u0430 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430",
    effect: "\u043D\u043E\u043C\u0435\u0440 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0438\u0442 \u043A \u0434\u0440\u0443\u0433\u043E\u043C\u0443 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0443",
    description: "\u041C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043F\u0440\u0435\u0444\u0438\u043A\u0441 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430, \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0446\u0438\u0444\u0440\u044B \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u043D\u0430 \u043C\u0435\u0441\u0442\u0435. \u041F\u0440\u0435\u0444\u0438\u043A\u0441 \u0443\u0447\u0430\u0441\u0442\u0432\u0443\u0435\u0442 \u0432 \u0443\u0437\u043E\u0440\u0430\u0445, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u043D\u043E\u043C\u0435\u0440 \u043C\u043E\u0436\u0435\u0442 \u043F\u043E\u0434\u043E\u0440\u043E\u0436\u0430\u0442\u044C \u0438\u043B\u0438 \u043F\u043E\u0434\u0435\u0448\u0435\u0432\u0435\u0442\u044C.",
    price: 2500,
    appealShare: null
  }
};
var UPGRADE_ORDER = ["digit", "swap", "reroll", "operator", "appeal"];
function upgradePrice(id, number) {
  const meta = UPGRADES[id];
  if (meta.price !== null) return meta.price;
  if (id === "appeal") {
    const next = nextRarity(number.rarity);
    if (!next) return 0;
    return Math.round(RARITIES[next].basePrice * (meta.appealShare ?? 0.5));
  }
  return 0;
}
function nextRarity(rarity) {
  const index = RARITY_ORDER.indexOf(rarity);
  if (index < 0 || index >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[index + 1];
}
var formatMoney = (value) => new Intl.NumberFormat("ru-RU").format(Math.round(value));

// ../shared/src/operators.ts
var COUNTRY_OPERATORS = {
  ru: [
    { id: "ru_gigafon", name: "\u0413\u0438\u0433\u0430\u0444\u043E\u043D", badge: "\u0413", color: "#22C55E", codes: ["920", "921", "923", "925", "926", "927"] },
    { id: "ru_nts", name: "\u041D\u0422\u0421", badge: "\u041D", color: "#EF4444", codes: ["910", "915", "916", "917", "919", "985"] },
    { id: "ru_belime", name: "Belime", badge: "B", color: "#F59E0B", codes: ["903", "905", "906", "909", "960", "961", "962", "963", "965", "967"] },
    { id: "ru_o3", name: "\u041E3", badge: "\u041E", color: "#3B82F6", codes: ["911", "912", "913", "914", "918", "999"] },
    { id: "ru_l2", name: "L2", badge: "L2", color: "#8B5CF6", codes: ["900", "901", "902", "904", "908", "950"] },
    { id: "ru_volna", name: "\u0412\u043E\u043B\u043D\u0430", badge: "\u0412", color: "#06B6D4", codes: ["922", "924", "929"] },
    { id: "ru_zvezda", name: "\u0417\u0432\u0435\u0437\u0434\u0430", badge: "\u0417", color: "#F43F5E", codes: ["951", "952", "958"] }
  ],
  us: [
    { id: "us_atb", name: "AT&B", badge: "AT", color: "#0EA5E9", codes: ["214", "215", "310", "404", "415", "617"] },
    { id: "us_northern", name: "Northern", badge: "N", color: "#1D4ED8", codes: ["212", "305", "312", "702", "713"] },
    { id: "us_pacific", name: "Pacific", badge: "P", color: "#0891B2", codes: ["206", "213", "503", "619", "808"] },
    { id: "us_summit", name: "Summit", badge: "S", color: "#7C3AED", codes: ["303", "480", "612", "720", "801"] },
    { id: "us_delta", name: "Delta US", badge: "D", color: "#DB2777", codes: ["469", "512", "832", "972"] },
    { id: "us_beacon", name: "Beacon", badge: "B", color: "#0D9488", codes: ["201", "203", "609"] },
    { id: "us_cascade", name: "Cascade", badge: "C", color: "#7C3AED", codes: ["971", "541", "458"] }
  ],
  gb: [
    { id: "gb_o3", name: "\u041E3", badge: "\u041E", color: "#3B82F6", codes: ["7700", "7711", "7788"] },
    { id: "gb_vodafun", name: "Vodafun", badge: "V", color: "#DC2626", codes: ["7400", "7411", "7500"] },
    { id: "gb_albion", name: "Albion", badge: "A", color: "#16A34A", codes: ["7300", "7311", "7455"] },
    { id: "gb_thames", name: "Thames", badge: "T", color: "#0284C7", codes: ["7600", "7611", "7622"] },
    { id: "gb_northwind", name: "Northwind", badge: "N", color: "#64748B", codes: ["7800", "7811", "7900"] },
    { id: "gb_caledon", name: "Caledon", badge: "C", color: "#4F46E5", codes: ["7422", "7433", "7444"] },
    { id: "gb_wessex", name: "Wessex", badge: "W", color: "#B45309", codes: ["7722", "7733", "7744"] }
  ],
  de: [
    { id: "de_vodafun", name: "Vodafun", badge: "V", color: "#DC2626", codes: ["170", "171", "172", "175"] },
    { id: "de_telekom", name: "Telekom+", badge: "T", color: "#E11D48", codes: ["151", "160", "162", "163"] },
    { id: "de_o2plus", name: "O2plus", badge: "O", color: "#8B5CF6", codes: ["176", "177", "179"] },
    { id: "de_rhein", name: "Rhein", badge: "R", color: "#0891B2", codes: ["152", "157", "159"] },
    { id: "de_bayern", name: "Bayern", badge: "B", color: "#0EA5E9", codes: ["165", "166", "167"] },
    { id: "de_spree", name: "Spree", badge: "S", color: "#0F766E", codes: ["150", "153", "154"] },
    { id: "de_isar", name: "Isar", badge: "I", color: "#9333EA", codes: ["155", "156", "158"] }
  ],
  fr: [
    /*
     * У Orange остались только 07x-хвосты, не занятые соседями: короткие
     * «06» и «07» перехватывали чужие номера, потому что совпадение берётся
     * по самому длинному коду.
     */
    { id: "fr_orange", name: "Orange+", badge: "O", color: "#FB923C", codes: ["071", "072", "073", "076"] },
    { id: "fr_sfr", name: "SFR+", badge: "S", color: "#DC2626", codes: ["062", "063", "078"] },
    { id: "fr_bouygues", name: "Bouy+", badge: "B", color: "#2563EB", codes: ["064", "065", "066"] },
    { id: "fr_free", name: "Libre", badge: "L", color: "#16A34A", codes: ["068", "069", "079"] },
    { id: "fr_alsace", name: "Alsace", badge: "A", color: "#7C3AED", codes: ["061", "067", "077"] },
    // У Orange код «06» короче остальных. Совпадение берётся по самому
    // длинному коду, поэтому «062» уходит к SFR, а не к Orange.
    { id: "fr_provence", name: "Provence", badge: "P", color: "#EA580C", codes: ["060", "070"] },
    { id: "fr_bretagne", name: "Bretagne", badge: "B", color: "#0891B2", codes: ["074", "075"] }
  ],
  fi: [
    { id: "fi_nordic", name: "Nordic", badge: "N", color: "#60A5FA", codes: ["40", "41", "45"] },
    { id: "fi_elisa", name: "Elisa+", badge: "E", color: "#0284C7", codes: ["42", "43", "44"] },
    { id: "fi_sauna", name: "Sauna", badge: "S", color: "#14B8A6", codes: ["46", "47", "48"] },
    { id: "fi_lappi", name: "Lappi", badge: "L", color: "#6366F1", codes: ["49", "50", "51"] },
    { id: "fi_tampere", name: "Tampere", badge: "T", color: "#E11D48", codes: ["52", "53", "54"] }
  ],
  jp: [
    { id: "jp_sakura", name: "Sakura", badge: "S", color: "#F472B6", codes: ["80", "90"] },
    { id: "jp_kiku", name: "Kiku", badge: "K", color: "#EF4444", codes: ["70", "81"] },
    { id: "jp_momiji", name: "Momiji", badge: "M", color: "#F59E0B", codes: ["60", "71"] },
    { id: "jp_fuji", name: "Fuji", badge: "F", color: "#3B82F6", codes: ["82", "83"] },
    { id: "jp_matsuri", name: "Matsuri", badge: "\u041C", color: "#8B5CF6", codes: ["84", "85"] }
  ],
  ae: [
    // Коды ОАЭ: 50, 52, 54, 55, 56, 58. Раньше 50, 52 и 55 стояли у двух
    // операторов сразу, и второй из них не мог получить ни одного номера.
    { id: "ae_emirates", name: "Emirates", badge: "E", color: "#84CC16", codes: ["50", "56"] },
    { id: "ae_dune", name: "Dune", badge: "D", color: "#F59E0B", codes: ["54", "58"] },
    { id: "ae_oasis", name: "Oasis", badge: "O", color: "#14B8A6", codes: ["52", "57"] },
    { id: "ae_pearl", name: "Pearl", badge: "P", color: "#0EA5E9", codes: ["55", "59"] },
    { id: "ae_falcon", name: "Falcon", badge: "F", color: "#DC2626", codes: ["53"] }
  ],
  kz: [
    { id: "kz_kcell", name: "Kcell", badge: "K", color: "#14B8A6", codes: ["701", "702", "705"] },
    { id: "kz_belime", name: "Belime", badge: "B", color: "#F59E0B", codes: ["707", "708", "747"] },
    { id: "kz_alatau", name: "Alatau", badge: "A", color: "#0EA5E9", codes: ["700", "703", "704"] },
    { id: "kz_steppe", name: "Steppe", badge: "S", color: "#84CC16", codes: ["706", "709", "771"] },
    { id: "kz_turan", name: "Turan", badge: "T", color: "#8B5CF6", codes: ["775", "776", "777"] },
    { id: "kz_altai", name: "\u0410\u043B\u0442\u0430\u0439", badge: "\u0410", color: "#16A34A", codes: ["710", "715", "718"] },
    { id: "kz_saryarka", name: "\u0421\u0430\u0440\u044B\u0430\u0440\u043A\u0430", badge: "\u0421", color: "#DB2777", codes: ["721", "725", "728"] }
  ],
  br: [
    { id: "br_vivobr", name: "VivoBR", badge: "V", color: "#A855F7", codes: ["11", "21", "31"] },
    { id: "br_claro", name: "Claro+", badge: "C", color: "#DC2626", codes: ["41", "51", "61"] },
    { id: "br_tim", name: "Tim+", badge: "T", color: "#2563EB", codes: ["71", "81", "91"] },
    { id: "br_oi", name: "Oi+", badge: "O", color: "#F59E0B", codes: ["12", "22", "32"] },
    { id: "br_amazon", name: "Amazon", badge: "A", color: "#16A34A", codes: ["13", "23", "33"] }
  ],
  tr: [
    { id: "tr_anadolu", name: "Anadolu", badge: "A", color: "#E11D48", codes: ["532", "533", "541"] },
    { id: "tr_bosphorus", name: "Bosphorus", badge: "B", color: "#0EA5E9", codes: ["505", "506", "555"] },
    { id: "tr_efes", name: "Efes", badge: "E", color: "#F59E0B", codes: ["530", "531", "538"] },
    { id: "tr_kapadokya", name: "Kapadokya", badge: "K", color: "#14B8A6", codes: ["542", "543", "544"] },
    { id: "tr_istanbul", name: "Istanbul", badge: "I", color: "#8B5CF6", codes: ["545", "546", "547"] },
    { id: "tr_toros", name: "Toros", badge: "T", color: "#0891B2", codes: ["548", "549", "551"] },
    { id: "tr_ege", name: "Ege", badge: "E", color: "#65A30D", codes: ["552", "553", "554"] }
  ],
  es: [
    { id: "es_iberia", name: "Iberia", badge: "I", color: "#F59E0B", codes: ["61", "62", "63"] },
    { id: "es_sol", name: "Sol", badge: "S", color: "#FBBF24", codes: ["71", "72", "73"] },
    { id: "es_movista", name: "Movista", badge: "M", color: "#0EA5E9", codes: ["64", "65", "66"] },
    { id: "es_andalus", name: "Andalus", badge: "A", color: "#16A34A", codes: ["67", "68", "69"] },
    { id: "es_costa", name: "Costa", badge: "C", color: "#DC2626", codes: ["74", "75", "76"] }
  ],
  it: [
    { id: "it_vesuvio", name: "Vesuvio", badge: "V", color: "#DC2626", codes: ["33", "34", "35"] },
    { id: "it_adriatico", name: "Adriatico", badge: "A", color: "#0891B2", codes: ["36", "37", "38"] },
    { id: "it_toscana", name: "Toscana", badge: "T", color: "#16A34A", codes: ["39", "32", "31"] },
    { id: "it_lombardia", name: "Lombardia", badge: "L", color: "#7C3AED", codes: ["30", "29", "28"] },
    { id: "it_sicilia", name: "Sicilia", badge: "S", color: "#F59E0B", codes: ["27", "26", "25"] }
  ],
  pl: [
    { id: "pl_wisla", name: "Wisla", badge: "W", color: "#EF4444", codes: ["51", "52", "53"] },
    { id: "pl_polonia", name: "Polonia", badge: "P", color: "#F43F5E", codes: ["60", "66", "69"] },
    { id: "pl_baltyk", name: "Baltyk", badge: "B", color: "#0EA5E9", codes: ["50", "56", "57"] },
    { id: "pl_tatra", name: "Tatra", badge: "T", color: "#16A34A", codes: ["58", "59", "88"] },
    { id: "pl_mazur", name: "Mazur", badge: "M", color: "#8B5CF6", codes: ["70", "71", "72"] }
  ],
  cn: [
    /*
     * Короткие коды «13», «15», «18» у Jade перехватывали номера соседей,
     * потому что совпадение берётся по самому длинному коду. Оставили Jade
     * свои трёхзначные коды, а свободные хвосты диапазонов — за ней.
     */
    { id: "cn_jade", name: "Jade", badge: "J", color: "#10B981", codes: ["133", "153", "183"] },
    { id: "cn_panda", name: "Panda", badge: "P", color: "#334155", codes: ["130", "131", "188"] },
    { id: "cn_dragon", name: "Dragon", badge: "D", color: "#DC2626", codes: ["135", "136", "137"] },
    { id: "cn_lotus", name: "Lotus", badge: "L", color: "#F472B6", codes: ["138", "139", "150"] },
    { id: "cn_greatwall", name: "Greatwall", badge: "G", color: "#F59E0B", codes: ["152", "157", "182"] }
  ],
  in: [
    { id: "in_lotus", name: "Lotus", badge: "L", color: "#EC4899", codes: ["70", "71", "72", "73"] },
    { id: "in_ganges", name: "Ganges", badge: "G", color: "#0D9488", codes: ["80", "81", "82", "83"] },
    { id: "in_monsoon", name: "Monsoon", badge: "M", color: "#0284C7", codes: ["90", "91", "92"] },
    { id: "in_basmati", name: "Basmati", badge: "B", color: "#F59E0B", codes: ["93", "94", "95"] },
    { id: "in_saffron", name: "Saffron", badge: "S", color: "#F97316", codes: ["96", "97", "98"] }
  ],
  kr: [
    { id: "kr_hanul", name: "Hanul", badge: "H", color: "#6366F1", codes: ["10", "11", "16"] },
    { id: "kr_sejong", name: "Sejong", badge: "S", color: "#8B5CF6", codes: ["17", "19"] },
    { id: "kr_hangang", name: "Hangang", badge: "\u0425", color: "#0EA5E9", codes: ["18", "15"] },
    { id: "kr_halla", name: "Halla", badge: "\u0425", color: "#14B8A6", codes: ["13", "14"] },
    { id: "kr_jiri", name: "Jiri", badge: "J", color: "#22C55E", codes: ["12", "21"] }
  ],
  ca: [
    // Канада: 867 — код Юкона и северо-запада, поэтому он у Yukon, а Aurora
    // получила 613. Раньше 780 и 867 стояли у двух операторов сразу.
    { id: "ca_maple", name: "Maple", badge: "M", color: "#DC2626", codes: ["416", "604", "647"] },
    { id: "ca_northern", name: "Northern", badge: "N", color: "#1D4ED8", codes: ["204", "306", "780"] },
    { id: "ca_aurora", name: "Aurora", badge: "A", color: "#0EA5E9", codes: ["403", "587", "613"] },
    { id: "ca_yukon", name: "Yukon", badge: "Y", color: "#14B8A6", codes: ["867", "250", "778"] },
    { id: "ca_nova", name: "Nova", badge: "N", color: "#7C3AED", codes: ["902", "506", "709"] }
  ],
  au: [
    { id: "au_reef", name: "Reef", badge: "R", color: "#06B6D4", codes: ["40", "41", "43"] },
    { id: "au_southern", name: "Southern", badge: "S", color: "#F97316", codes: ["45", "46", "47"] },
    { id: "au_outback", name: "Outback", badge: "O", color: "#F59E0B", codes: ["48", "49", "42"] },
    { id: "au_kangaroo", name: "Kangaroo", badge: "K", color: "#DC2626", codes: ["44", "34"] },
    { id: "au_tasman", name: "Tasman", badge: "T", color: "#16A34A", codes: ["35", "36"] }
  ],
  mx: [
    { id: "mx_azteca", name: "Azteca", badge: "A", color: "#16A34A", codes: ["55", "56"] },
    { id: "mx_solmaya", name: "Sol Maya", badge: "SM", color: "#CA8A04", codes: ["81", "82"] },
    { id: "mx_tequila", name: "Tequila", badge: "T", color: "#F59E0B", codes: ["33", "44"] },
    { id: "mx_caribe", name: "Caribe", badge: "C", color: "#0EA5E9", codes: ["99", "98"] },
    { id: "mx_sierra", name: "Sierra", badge: "S", color: "#7C3AED", codes: ["22", "24"] }
  ],
  nl: [
    { id: "nl_tulip", name: "Tulip", badge: "T", color: "#FB7185", codes: ["61", "62", "63"] },
    { id: "nl_delta", name: "Delta", badge: "D", color: "#0284C7", codes: ["64", "65"] },
    { id: "nl_canal", name: "Canal", badge: "C", color: "#14B8A6", codes: ["66", "67"] },
    { id: "nl_windmill", name: "Windmill", badge: "W", color: "#F59E0B", codes: ["68", "69"] },
    { id: "nl_polder", name: "Polder", badge: "P", color: "#6366F1", codes: ["60", "85"] }
  ],
  se: [
    { id: "se_nord", name: "Nord", badge: "N", color: "#38BDF8", codes: ["70", "72", "73"] },
    { id: "se_viking", name: "Viking", badge: "V", color: "#475569", codes: ["76", "79"] },
    { id: "se_krona", name: "Krona", badge: "K", color: "#F59E0B", codes: ["74", "75"] },
    { id: "se_gotland", name: "Gotland", badge: "G", color: "#16A34A", codes: ["77", "78"] },
    { id: "se_lappland", name: "Lappland", badge: "L", color: "#0EA5E9", codes: ["71", "66"] }
  ],
  ch: [
    { id: "ch_alpen", name: "Alpen", badge: "A", color: "#E11D48", codes: ["75", "76", "78"] },
    { id: "ch_helvetia", name: "Helvetia", badge: "H", color: "#DC2626", codes: ["79", "77"] },
    { id: "ch_matterhorn", name: "Matterhorn", badge: "M", color: "#0EA5E9", codes: ["74", "73"] },
    { id: "ch_jura", name: "Jura", badge: "J", color: "#16A34A", codes: ["72", "71"] },
    { id: "ch_ticino", name: "Ticino", badge: "T", color: "#8B5CF6", codes: ["70", "69"] }
  ],
  pt: [
    { id: "pt_lusitania", name: "Lusitania", badge: "L", color: "#15803D", codes: ["91", "92", "93"] },
    { id: "pt_atlantico", name: "Atlantico", badge: "A", color: "#0EA5E9", codes: ["96", "97"] },
    { id: "pt_tejo", name: "Tejo", badge: "T", color: "#F59E0B", codes: ["94", "95"] },
    { id: "pt_algarve", name: "Algarve", badge: "A", color: "#EC4899", codes: ["98", "99"] },
    { id: "pt_porto", name: "Porto", badge: "P", color: "#7C3AED", codes: ["90", "89"] }
  ],
  cz: [
    { id: "cz_bohemia", name: "Bohemia", badge: "B", color: "#7C3AED", codes: ["601", "602", "603"] },
    { id: "cz_vltava", name: "Vltava", badge: "V", color: "#2563EB", codes: ["720", "721", "730"] },
    { id: "cz_morava", name: "Morava", badge: "M", color: "#16A34A", codes: ["604", "605", "606"] },
    { id: "cz_krkonose", name: "Krkonose", badge: "K", color: "#F59E0B", codes: ["607", "608", "702"] },
    { id: "cz_sumava", name: "Sumava", badge: "S", color: "#0EA5E9", codes: ["703", "704", "705"] }
  ],
  by: [
    { id: "by_a1", name: "A1 \u0411\u0435\u043B\u0430\u0440\u0443\u0441\u044C", badge: "A1", color: "#EF4444", codes: ["29", "291", "292"] },
    { id: "by_mts", name: "\u041C\u0422\u0421", badge: "\u041C", color: "#DC2626", codes: ["33", "331", "332"] },
    { id: "by_life", name: "Life:)", badge: "L", color: "#8B5CF6", codes: ["25", "251", "252"] },
    { id: "by_beltelecom", name: "\u0411\u0435\u043B\u0442\u0435\u043B\u0435\u043A\u043E\u043C", badge: "\u0411", color: "#16A34A", codes: ["17", "171", "172"] },
    { id: "by_diallog", name: "Diallog", badge: "D", color: "#0EA5E9", codes: ["44", "441", "442"] }
  ],
  ua: [
    { id: "ua_kyivstar", name: "Kyivstar", badge: "K", color: "#2563EB", codes: ["67", "68", "96", "97", "98"] },
    { id: "ua_vodafone", name: "Vodafone UA", badge: "V", color: "#DC2626", codes: ["50", "66", "95", "99"] },
    { id: "ua_lifecell", name: "lifecell", badge: "L", color: "#F59E0B", codes: ["63", "73", "93"] },
    { id: "ua_dnipro", name: "Dnipro", badge: "D", color: "#0EA5E9", codes: ["91", "92", "94"] },
    { id: "ua_carpathia", name: "Carpathia", badge: "C", color: "#16A34A", codes: ["89", "90", "69"] },
    { id: "ua_bukovyna", name: "\u0411\u0443\u043A\u043E\u0432\u0438\u043D\u0430", badge: "\u0411", color: "#DB2777", codes: ["75", "77", "79"] },
    { id: "ua_tavria", name: "\u0422\u0430\u0432\u0440\u0456\u044F", badge: "\u0422", color: "#0284C7", codes: ["80", "85", "88"] }
  ],
  ro: [
    { id: "ro_orange", name: "Orange RO", badge: "O", color: "#FB923C", codes: ["74", "75", "76"] },
    { id: "ro_vodafone", name: "Vodafone RO", badge: "V", color: "#DC2626", codes: ["72", "73"] },
    { id: "ro_telekom", name: "Telekom RO", badge: "T", color: "#E11D48", codes: ["70", "71"] },
    { id: "ro_digi", name: "Digi", badge: "D", color: "#2563EB", codes: ["77", "78"] },
    { id: "ro_carpathia", name: "Carpathia", badge: "C", color: "#16A34A", codes: ["79", "68"] }
  ],
  gr: [
    { id: "gr_cosmote", name: "Cosmote", badge: "C", color: "#22C55E", codes: ["697", "698", "699"] },
    { id: "gr_vodafone", name: "Vodafone GR", badge: "V", color: "#DC2626", codes: ["694", "695"] },
    { id: "gr_nova", name: "Nova", badge: "N", color: "#2563EB", codes: ["690", "693"] },
    { id: "gr_aegean", name: "Aegean", badge: "A", color: "#0EA5E9", codes: ["691", "692"] },
    { id: "gr_olympus", name: "Olympus", badge: "O", color: "#F59E0B", codes: ["696", "689"] }
  ],
  hu: [
    { id: "hu_telekom", name: "Telekom HU", badge: "T", color: "#E11D48", codes: ["30", "31"] },
    { id: "hu_vodafone", name: "Vodafone HU", badge: "V", color: "#DC2626", codes: ["70", "71"] },
    { id: "hu_yettel", name: "Yettel", badge: "Y", color: "#0EA5E9", codes: ["20", "21"] },
    { id: "hu_digimobile", name: "Digi HU", badge: "D", color: "#2563EB", codes: ["50", "51"] },
    { id: "hu_puszta", name: "Puszta", badge: "P", color: "#16A34A", codes: ["25", "26"] }
  ],
  at: [
    { id: "at_a1", name: "A1 \u0410\u0432\u0441\u0442\u0440\u0438\u044F", badge: "A1", color: "#EF4444", codes: ["664", "665"] },
    { id: "at_magenta", name: "Magenta", badge: "M", color: "#DB2777", codes: ["676", "677"] },
    { id: "at_drei", name: "Drei", badge: "D", color: "#0EA5E9", codes: ["660", "661"] },
    { id: "at_alpen", name: "Alpen", badge: "A", color: "#16A34A", codes: ["650", "651"] },
    { id: "at_danube", name: "Danube", badge: "D", color: "#2563EB", codes: ["699", "698"] }
  ],
  be: [
    { id: "be_proximus", name: "Proximus", badge: "P", color: "#7C3AED", codes: ["470", "471", "472"] },
    { id: "be_orange", name: "Orange BE", badge: "O", color: "#FB923C", codes: ["473", "474", "475"] },
    { id: "be_base", name: "Base", badge: "B", color: "#0EA5E9", codes: ["476", "477", "478"] },
    { id: "be_arlon", name: "Arlon", badge: "A", color: "#16A34A", codes: ["479", "480"] },
    { id: "be_scheldt", name: "Scheldt", badge: "S", color: "#DC2626", codes: ["455", "456"] }
  ],
  dk: [
    { id: "dk_tdc", name: "TDC", badge: "T", color: "#2563EB", codes: ["20", "21", "22"] },
    { id: "dk_telenor", name: "Telenor DK", badge: "T", color: "#0EA5E9", codes: ["30", "31", "40"] },
    { id: "dk_telia", name: "Telia DK", badge: "T", color: "#7C3AED", codes: ["50", "51", "60"] },
    { id: "dk_jutland", name: "Jutland", badge: "J", color: "#16A34A", codes: ["71", "81"] },
    { id: "dk_oresund", name: "Oresund", badge: "O", color: "#F59E0B", codes: ["93", "94"] }
  ],
  no: [
    { id: "no_telenor", name: "Telenor NO", badge: "T", color: "#0EA5E9", codes: ["400", "401", "900"] },
    { id: "no_telia", name: "Telia NO", badge: "T", color: "#7C3AED", codes: ["901", "902", "903"] },
    { id: "no_ice", name: "Ice", badge: "I", color: "#38BDF8", codes: ["904", "905", "906"] },
    { id: "no_fjord", name: "Fjord", badge: "F", color: "#16A34A", codes: ["907", "908"] },
    { id: "no_nordkapp", name: "Nordkapp", badge: "N", color: "#F59E0B", codes: ["909", "910"] }
  ],
  ie: [
    { id: "ie_vodafone", name: "Vodafone IE", badge: "V", color: "#DC2626", codes: ["83", "86"] },
    { id: "ie_three", name: "Three IE", badge: "T", color: "#0EA5E9", codes: ["85", "87"] },
    { id: "ie_eir", name: "Eir", badge: "E", color: "#16A34A", codes: ["88", "89"] },
    { id: "ie_shannon", name: "Shannon", badge: "S", color: "#2563EB", codes: ["84", "80"] },
    { id: "ie_emerald", name: "Emerald", badge: "E", color: "#22C55E", codes: ["82", "81"] }
  ]
};
var CARRIER = {
  id: "carrier",
  name: "Carrier",
  badge: "C",
  color: "#64748B",
  codes: []
};
var BY_ID = /* @__PURE__ */ new Map();
for (const operators of Object.values(COUNTRY_OPERATORS)) {
  for (const operator of operators) BY_ID.set(operator.id, operator);
}
BY_ID.set(CARRIER.id, CARRIER);
function operatorById(id) {
  return BY_ID.get(id) ?? CARRIER;
}
function brandedOperators(countryId) {
  return COUNTRY_OPERATORS[countryId] ?? [];
}
function pickOperatorForDigits(countryId, digits) {
  let bestId = CARRIER.id;
  let bestLength = 0;
  for (const operator of brandedOperators(countryId)) {
    for (const code of operator.codes) {
      if (code.length > bestLength && digits.startsWith(code)) {
        bestId = operator.id;
        bestLength = code.length;
      }
    }
  }
  return bestId;
}

// ../shared/src/rng.ts
function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = state + 1831565813 >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function randomInt(rng, min, max) {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}
function seedFromString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function createId(prefix) {
  const bytes = new Uint8Array(12);
  const source = globalThis.crypto;
  if (source?.getRandomValues) {
    source.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${Date.now().toString(36)}_${hex}`;
}

// ../shared/src/patterns.ts
var EXCLUDES = {
  all_same: [
    "almost_same",
    "series",
    "pairs",
    "alternating",
    "palindrome",
    "mirror",
    "block_repeat",
    "prefix_echo",
    "prefix_repeat",
    "ladder_up",
    "ladder_down",
    "round",
    "date",
    "twin_ends",
    "aabb",
    "keypad_line",
    "zero_run"
  ],
  almost_same: [
    "series",
    "pairs",
    "prefix_echo",
    "alternating",
    "aabb",
    "zero_run",
    "round",
    "keypad_line",
    "twin_ends"
  ],
  palindrome: ["mirror", "block_repeat", "prefix_echo", "alternating", "twin_ends", "keypad_line"],
  alternating: ["block_repeat", "prefix_repeat", "mirror", "aabb"],
  block_repeat: [
    "prefix_repeat",
    "prefix_echo",
    "mirror",
    "aabb",
    "zero_run",
    "round",
    "keypad_line",
    "twin_ends"
  ],
  mirror: ["prefix_echo", "twin_ends", "keypad_line"],
  // Лесенка и линия по клавиатуре — один и тот же рисунок «идём подряд»:
  // 6789 это и лесенка, и три цифры линии «789». Считаем один раз, дорогим.
  ladder_up: ["series", "keypad_line"],
  ladder_down: ["series", "keypad_line"],
  // Линия по клавиатуре — не серия и не пары, хотя цифры в ней соседние.
  keypad_line: ["series", "pairs", "aabb"],
  // Серия одинаковых цифр описывает ту же картинку точнее, чем пары.
  // ВАЖНО: серия обязана проверяться РАНЬШЕ пар, иначе она недостижима —
  // три одинаковые цифры всегда дают две пары, и пары гасили бы серию.
  series: ["pairs", "aabb"],
  aabb: ["pairs"],
  // Круглый номер описывает хвост из нулей точнее, чем «нули подряд» и «пары»:
  // два нуля в конце — это не отдельная пара, а то же самое окончание.
  round: ["zero_run", "pairs"],
  prefix_echo: ["twin_ends"]
};
var PRIORITY = [
  "all_same",
  "almost_same",
  "date",
  "palindrome",
  "alternating",
  "block_repeat",
  "mirror",
  "prefix_echo",
  "prefix_repeat",
  "ladder_up",
  "ladder_down",
  "keypad_line",
  "twin_ends",
  "series",
  "aabb",
  "round",
  "zero_run",
  "pairs",
  "country_code"
];
function longestLadder(digits, step) {
  let best = { start: 0, end: 0, length: 0 };
  let runStart = 0;
  let runLength = 1;
  for (let i = 1; i <= digits.length; i += 1) {
    const continues = i < digits.length && digits.charCodeAt(i) - digits.charCodeAt(i - 1) === step;
    if (continues) {
      runLength += 1;
    } else {
      if (runLength > best.length) best = { start: runStart, end: runStart + runLength, length: runLength };
      runStart = i;
      runLength = 1;
    }
  }
  return best;
}
function longestRun(digits) {
  let best = { start: 0, end: 0, length: 0, digit: "" };
  let runStart = 0;
  for (let i = 1; i <= digits.length; i += 1) {
    const continues = i < digits.length && digits[i] === digits[runStart];
    if (!continues) {
      const length = i - runStart;
      if (length > best.length) {
        best = { start: runStart, end: i, length, digit: digits[runStart] };
      }
      runStart = i;
    }
  }
  return best;
}
function alternatingSpan(digits) {
  let best = { start: 0, end: 0, length: 0 };
  for (let start = 0; start + 2 <= digits.length; start += 1) {
    let end = start + 2;
    while (end < digits.length && digits[end] === digits[end - 2]) end += 1;
    if (end - start > best.length) best = { start, end, length: end - start };
  }
  return best;
}
function dominantDigit(digits) {
  const counts = /* @__PURE__ */ new Map();
  for (const char of digits) counts.set(char, (counts.get(char) ?? 0) + 1);
  let best = { digit: digits[0] ?? "0", count: 0 };
  for (const [digit, count] of counts) {
    if (count > best.count) best = { digit, count };
  }
  return best;
}
function repeatedBlock(digits) {
  for (let size = 2; size <= Math.floor(digits.length / 2); size += 1) {
    for (let start = 0; start + size * 2 <= digits.length; start += 1) {
      const block = digits.slice(start, start + size);
      let count = 1;
      let cursor = start + size;
      while (digits.slice(cursor, cursor + size) === block) {
        count += 1;
        cursor += size;
      }
      if (count >= 2) return { start, end: cursor, block, count };
    }
  }
  return null;
}
function dateSpan(digits) {
  for (let i = 0; i + 4 <= digits.length; i += 1) {
    const day = Number(digits.slice(i, i + 2));
    const month = Number(digits.slice(i + 2, i + 4));
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { start: i, end: i + 4, text: digits.slice(i, i + 4) };
    }
  }
  return null;
}
function mirrorSpan(digits) {
  for (let size = Math.floor(digits.length / 2); size >= 3; size -= 1) {
    const head = digits.slice(0, size);
    const tail = digits.slice(digits.length - size);
    if (head === [...tail].reverse().join("")) {
      return { start: 0, end: digits.length, text: head };
    }
  }
  return null;
}
function doublePairSpan(digits) {
  for (let i = 0; i + 4 <= digits.length; i += 1) {
    if (digits[i] === digits[i + 1] && digits[i + 2] === digits[i + 3] && digits[i] !== digits[i + 2]) {
      return { start: i, end: i + 4 };
    }
  }
  return null;
}
function zeroRunSpan(digits) {
  let best = null;
  let start = -1;
  for (let i = 0; i <= digits.length; i += 1) {
    if (i < digits.length && digits[i] === "0") {
      if (start < 0) start = i;
      continue;
    }
    if (start >= 0) {
      const length = i - start;
      if (length >= 3 && (!best || length > best.length)) best = { start, end: i, length };
      start = -1;
    }
  }
  return best;
}
var KEYPAD_LINES = ["123", "456", "789", "147", "258", "369", "159", "357"];
function keypadSpan(digits) {
  let best = null;
  for (const line of KEYPAD_LINES) {
    for (const variant of [line, [...line].reverse().join("")]) {
      for (let start = 0; start + 3 <= digits.length; start += 1) {
        for (let take = variant.length; take >= 3; take -= 1) {
          if (!digits.startsWith(variant.slice(0, take), start)) continue;
          if (!best || take > best.end - best.start) {
            best = { start, end: start + take, text: digits.slice(start, start + take) };
          }
          break;
        }
      }
    }
  }
  return best;
}
function analyzeNumber(digits, ctx = {}) {
  const found = /* @__PURE__ */ new Map();
  const push = (id, label, detail, points, span) => {
    if (points <= 0) return;
    found.set(id, { id, label, detail, points, span });
  };
  const length = digits.length;
  const run = longestRun(digits);
  if (length >= 4 && run.length === length) {
    push("all_same", "\u0412\u0441\u0435 \u0446\u0438\u0444\u0440\u044B \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u0435", `\u041F\u043E\u043B\u043D\u043E\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u0435\u043D\u0438\u0435 \xAB${digits}\xBB`, PATTERN_POINTS.all_same, { start: 0, end: length });
  }
  const dominant = dominantDigit(digits);
  if (length >= 5 && dominant.count === length - 1) {
    push(
      "almost_same",
      "\u041F\u043E\u0447\u0442\u0438 \u043E\u0434\u043D\u0430 \u0446\u0438\u0444\u0440\u0430",
      `\u0412\u0441\u0435 \u0446\u0438\u0444\u0440\u044B \u2014 \xAB${dominant.digit}\xBB, \u043A\u0440\u043E\u043C\u0435 \u043E\u0434\u043D\u043E\u0439`,
      PATTERN_POINTS.almost_same,
      { start: 0, end: length }
    );
  }
  const date = dateSpan(digits);
  if (date) {
    push("date", "\u0414\u0430\u0442\u0430", `\u041F\u0440\u0430\u0432\u0434\u043E\u043F\u043E\u0434\u043E\u0431\u043D\u0430\u044F \u0434\u0430\u0442\u0430 \xAB${date.text}\xBB`, PATTERN_POINTS.date, date);
  }
  if (length >= 5 && digits === [...digits].reverse().join("")) {
    push("palindrome", "\u041F\u0430\u043B\u0438\u043D\u0434\u0440\u043E\u043C", `\u0427\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u043E \u0432 \u043E\u0431\u0435 \u0441\u0442\u043E\u0440\u043E\u043D\u044B \xAB${digits}\xBB`, PATTERN_POINTS.palindrome, { start: 0, end: length });
  }
  const alt = alternatingSpan(digits);
  if (alt.length >= 6) {
    push(
      "alternating",
      "\u0427\u0435\u0440\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435",
      `\u041F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0438\u0439\u0441\u044F \u0440\u0438\u0441\u0443\u043D\u043E\u043A \u0434\u043B\u0438\u043D\u043E\u0439 ${alt.length}`,
      PATTERN_POINTS.alternating,
      alt
    );
  }
  const block = repeatedBlock(digits);
  if (block) {
    push(
      "block_repeat",
      "\u041F\u043E\u0432\u0442\u043E\u0440 \u0431\u043B\u043E\u043A\u0430",
      `\u0411\u043B\u043E\u043A \xAB${block.block}\xBB \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F ${block.count} \u0440\u0430\u0437\u0430`,
      PATTERN_POINTS.block_repeat,
      block
    );
  }
  const mirror2 = mirrorSpan(digits);
  if (mirror2) {
    push("mirror", "\u0417\u0435\u0440\u043A\u0430\u043B\u043E", `\u0417\u0435\u0440\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u043A\u043E\u043C\u0431\u0438\u043D\u0430\u0446\u0438\u044F \u0432\u043E\u043A\u0440\u0443\u0433 \xAB${mirror2.text}\xBB`, PATTERN_POINTS.mirror, mirror2);
  }
  if (length >= 6 && digits.slice(0, 2) === digits.slice(-2)) {
    push("prefix_echo", "\u042D\u0445\u043E \u043F\u0440\u0435\u0444\u0438\u043A\u0441\u0430", `\u041D\u0430\u0447\u0430\u043B\u043E \xAB${digits.slice(0, 2)}\xBB \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F \u0432 \u043A\u043E\u043D\u0446\u0435`, PATTERN_POINTS.prefix_echo, { start: 0, end: length });
  }
  const head = digits.slice(0, 2);
  if (head.length === 2) {
    const again = digits.indexOf(head, 2);
    if (again > 0) {
      push(
        "prefix_repeat",
        "\u041F\u043E\u0432\u0442\u043E\u0440 \u0432 \u043F\u0440\u0435\u0444\u0438\u043A\u0441\u0435",
        `\u041F\u0440\u0435\u0444\u0438\u043A\u0441 \xAB${head}\xBB \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F \u0432\u043D\u0443\u0442\u0440\u0438 \u043D\u043E\u043C\u0435\u0440\u0430`,
        PATTERN_POINTS.prefix_repeat,
        { start: again, end: again + 2 }
      );
    }
  }
  const up = longestLadder(digits, 1);
  if (up.length >= 4) {
    const bonus = up.length >= 6 ? (up.length - 5) * PATTERN_POINTS.ladderLong : 0;
    push(
      "ladder_up",
      "\u041B\u0435\u0441\u0435\u043D\u043A\u0430 \u0432\u0432\u0435\u0440\u0445",
      `\u0412\u043E\u0437\u0440\u0430\u0441\u0442\u0430\u044E\u0449\u0430\u044F \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \xAB${digits.slice(up.start, up.end)}\xBB`,
      up.length * PATTERN_POINTS.ladder_up + bonus,
      up
    );
  }
  const down = longestLadder(digits, -1);
  if (down.length >= 4) {
    const bonus = down.length >= 6 ? (down.length - 5) * PATTERN_POINTS.ladderLong : 0;
    push(
      "ladder_down",
      "\u041B\u0435\u0441\u0435\u043D\u043A\u0430 \u0432\u043D\u0438\u0437",
      `\u0423\u0431\u044B\u0432\u0430\u044E\u0449\u0430\u044F \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \xAB${digits.slice(down.start, down.end)}\xBB`,
      down.length * PATTERN_POINTS.ladder_down + bonus,
      down
    );
  }
  const keypad = keypadSpan(digits);
  if (keypad) {
    push(
      "keypad_line",
      "\u041B\u0438\u043D\u0438\u044F \u043F\u043E \u043A\u043B\u0430\u0432\u0438\u0430\u0442\u0443\u0440\u0435",
      `\u0426\u0438\u0444\u0440\u044B \u0438\u0434\u0443\u0442 \u043F\u043E \u043E\u0434\u043D\u043E\u0439 \u043B\u0438\u043D\u0438\u0438 \xAB${keypad.text}\xBB`,
      PATTERN_POINTS.keypad_line,
      keypad
    );
  }
  if (length >= 6 && digits[0] === digits[length - 1]) {
    push(
      "twin_ends",
      "\u041E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u0435 \u043A\u0440\u0430\u044F",
      `\u041D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F \u0438 \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \xAB${digits[0]}\xBB`,
      PATTERN_POINTS.twin_ends,
      { start: 0, end: length }
    );
  }
  const doublePair = doublePairSpan(digits);
  if (doublePair) {
    push(
      "aabb",
      "\u0414\u0432\u043E\u0439\u043D\u044B\u0435 \u043F\u0430\u0440\u044B",
      `\u041F\u0430\u0440\u044B \xAB${digits.slice(doublePair.start, doublePair.end)}\xBB`,
      PATTERN_POINTS.aabb,
      doublePair
    );
  }
  let pairCount = 0;
  for (let i = 1; i < length; i += 1) {
    if (digits[i] === digits[i - 1]) pairCount += 1;
  }
  if (pairCount >= 1) {
    push("pairs", "\u041F\u0430\u0440\u044B", `\u0412\u044B\u0440\u0430\u0436\u0435\u043D\u043D\u044B\u0445 \u043F\u0430\u0440: ${pairCount}`, pairCount * PATTERN_POINTS.pairs, { start: 0, end: length });
  }
  if (run.length >= 3) {
    push(
      "series",
      "\u0421\u0435\u0440\u0438\u044F",
      `\u0421\u0435\u0440\u0438\u044F \u0438\u0437 ${run.length} \u0446\u0438\u0444\u0440 \xAB${run.digit}\xBB`,
      run.length * PATTERN_POINTS.series,
      run
    );
  }
  const trailingZeros = length - digits.replace(/0+$/, "").length;
  if (trailingZeros >= 2) {
    push(
      "round",
      "\u041A\u0440\u0443\u0433\u043B\u044B\u0439",
      `\u0417\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043D\u0430 ${trailingZeros} \u043D\u0443\u043B${trailingZeros === 2 ? "\u044F" : "\u0435\u0439"}`,
      trailingZeros * PATTERN_POINTS.round,
      { start: length - trailingZeros, end: length }
    );
  }
  const zeros = zeroRunSpan(digits);
  if (zeros) {
    push(
      "zero_run",
      "\u041D\u0443\u043B\u0438 \u043F\u043E\u0434\u0440\u044F\u0434",
      `${zeros.length} \u043D\u0443\u043B\u044F \u043F\u043E\u0434\u0440\u044F\u0434`,
      PATTERN_POINTS.zero_run + (zeros.length - 3) * 5,
      zeros
    );
  }
  const countryDigits = ctx.countryDigits ?? "";
  if (countryDigits && digits.startsWith(countryDigits) && countryDigits.length < length) {
    push(
      "country_code",
      "\u041A\u043E\u0434 \u0441\u0442\u0440\u0430\u043D\u044B",
      `\u041D\u043E\u043C\u0435\u0440 \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F \u0441 \u043A\u043E\u0434\u0430 \xAB${countryDigits}\xBB`,
      PATTERN_POINTS.country_code,
      { start: 0, end: countryDigits.length }
    );
  }
  const hits = [];
  const dropped = /* @__PURE__ */ new Set();
  for (const id of PRIORITY) {
    if (dropped.has(id)) continue;
    const hit = found.get(id);
    if (!hit) continue;
    hits.push(hit);
    for (const subordinate of EXCLUDES[id] ?? []) dropped.add(subordinate);
  }
  for (const id of PATTERN_ORDER) {
    if (hits.some((hit2) => hit2.id === id) || dropped.has(id)) continue;
    const hit = found.get(id);
    if (hit) hits.push(hit);
  }
  hits.sort((a, b) => b.points - a.points);
  const score = hits.reduce((sum, hit) => sum + hit.points, 0);
  return { hits, score };
}
function patternMultiplier(score) {
  return Math.round((1 + score / 60) * 100) / 100;
}

// ../shared/src/generator.ts
var maskSlots = (mask) => [...mask].filter((char) => /[A-Z]/.test(char)).length;
var randomDigit = (rng, allowZero = true) => String(randomInt(rng, allowZero ? 0 : 1, 9));
function distinctPair(rng) {
  const a = randomDigit(rng, false);
  let b = randomDigit(rng);
  if (b === a) b = String((Number(a) + 1) % 10);
  return [a, b];
}
var plain = (length, rng) => {
  let out = randomDigit(rng, false);
  while (out.length < length) out += randomDigit(rng);
  return out;
};
var allSame = (length, rng) => randomDigit(rng, false).repeat(length);
var almostSame = (length, rng) => {
  const base = randomDigit(rng, false);
  const odd = randomInt(rng, 0, length - 1);
  let other = randomDigit(rng);
  if (other === base) other = String((Number(base) + 1) % 10);
  if (odd === 0 && other === "0") other = "1";
  return Array.from({ length }, (_, i) => i === odd ? other : base).join("");
};
var almostOnesWithDate = (length, rng) => {
  const odd = randomInt(rng, 0, length - 1);
  const other = odd === 0 ? "2" : "0";
  return Array.from({ length }, (_, i) => i === odd ? other : "1").join("");
};
function placeRun(length, rng, run) {
  const offset = randomInt(rng, 0, Math.max(0, length - run.length));
  const chars = [];
  for (let i = 0; i < length; i += 1) {
    let d = randomDigit(rng);
    if (i > 0 && d === chars[i - 1]) d = String((Number(d) + 1) % 10);
    chars.push(d);
  }
  for (let i = 0; i < run.length; i += 1) chars[offset + i] = run[i];
  if (offset > 0 && chars[offset - 1] === chars[offset]) {
    chars[offset - 1] = String((Number(chars[offset]) + 1) % 10);
  }
  const after = offset + run.length;
  if (after < length && chars[after] === chars[after - 1]) {
    chars[after] = String((Number(chars[after - 1]) + 1) % 10);
  }
  if (chars[0] === "0") chars[0] = randomDigit(rng, false);
  return chars.join("");
}
var series = (size) => (length, rng) => placeRun(length, rng, randomDigit(rng, false).repeat(size));
var ladderUp = (size) => (length, rng) => {
  const start = randomInt(rng, 0, Math.max(0, 9 - size));
  let run = "";
  for (let i = 0; i < size; i += 1) run += String(start + i);
  return placeRun(length, rng, run);
};
var ladderDown = (size) => (length, rng) => {
  const start = randomInt(rng, Math.min(size - 1, 9), 9);
  let run = "";
  for (let i = 0; i < size; i += 1) run += String(start - i);
  return placeRun(length, rng, run);
};
var palindrome = (length, rng) => {
  const half = Math.ceil(length / 2);
  let head = randomDigit(rng, false);
  while (head.length < half) head += randomDigit(rng);
  const tail = [...head].reverse().join("");
  return (head + tail).slice(0, length);
};
var mirror = (size) => (length, rng) => {
  let head = randomDigit(rng, false);
  while (head.length < size) head += randomDigit(rng);
  const tail = [...head].reverse().join("");
  if (size * 2 >= length) return (head + tail).slice(0, length);
  let middle = "";
  const [a, b] = distinctPair(rng);
  while (middle.length < length - size * 2) {
    const next = middle.length % 2 === 0 ? a : b;
    middle += next;
  }
  return head + middle + tail;
};
var alternating = (length, rng) => {
  const [a, b] = distinctPair(rng);
  let out = "";
  for (let i = 0; i < length; i += 1) out += i % 2 === 0 ? a : b;
  return out;
};
var blockRepeat = (size) => (length, rng) => {
  let block = randomDigit(rng, false);
  while (block.length < size) block += randomDigit(rng);
  let out = "";
  while (out.length < length) out += block;
  return out.slice(0, length);
};
var withRoundTail = (zeros) => (length, rng) => {
  const headLength = Math.max(1, length - zeros);
  let out = randomDigit(rng, false);
  while (out.length < headLength) out += randomDigit(rng);
  return out + "0".repeat(zeros);
};
var withCountryCode = (code) => (length, rng) => {
  let out = code;
  while (out.length < length) out += randomDigit(rng);
  return out.slice(0, length);
};
var alternatingWithRound = (length, rng) => {
  const tail = 3;
  const head = Math.max(6, length - tail);
  const [a, b] = distinctPair(rng);
  let out = "";
  for (let i = 0; i < head; i += 1) out += i % 2 === 0 ? a : b;
  return (out + "0".repeat(tail)).slice(0, length).padEnd(length, "0");
};
var dateWithRound = (length, rng) => {
  const day = String(randomInt(rng, 10, 28));
  const month = String(randomInt(rng, 1, 12)).padStart(2, "0");
  let out = day + month;
  const middle = Math.max(0, length - out.length - 2);
  for (let i = 0; i < middle; i += 1) out += randomDigit(rng);
  return (out + "00").slice(0, length);
};
var dateWithAlternating = (length, rng) => {
  const day = String(randomInt(rng, 10, 28));
  const month = String(randomInt(rng, 1, 12)).padStart(2, "0");
  const [a, b] = distinctPair(rng);
  let out = day + month;
  let i = out.length;
  while (out.length < length) {
    out += i % 2 === 0 ? a : b;
    i += 1;
  }
  return out.slice(0, length);
};
var dateWithMirror = (length, rng) => {
  const size = 3;
  let head = randomDigit(rng, false);
  while (head.length < size) head += randomDigit(rng);
  const tail = [...head].reverse().join("");
  const day = String(randomInt(rng, 10, 28));
  const month = String(randomInt(rng, 1, 12)).padStart(2, "0");
  let out = head + day + month + tail;
  if (out.length < length) {
    const filler = "0".repeat(length - out.length);
    out = head + day + month + filler + tail;
  }
  return out.slice(0, length);
};
var palindromeWithSeries = (length, rng) => {
  const [a, b] = distinctPair(rng);
  return a + b.repeat(Math.max(3, length - 2)) + a;
};
var RECIPES = {
  common: [{ label: "\u043E\u0431\u044B\u0447\u043D\u044B\u0439", build: plain }],
  uncommon: [
    { label: "\u0441\u0435\u0440\u0438\u044F 3", build: series(3) },
    { label: "\u043B\u0435\u0441\u0435\u043D\u043A\u0430 \u0432\u043D\u0438\u0437 5", build: ladderDown(5) },
    { label: "\u043B\u0435\u0441\u0435\u043D\u043A\u0430 \u0432\u0432\u0435\u0440\u0445 4", build: ladderUp(4) },
    { label: "\u043A\u0440\u0443\u0433\u043B\u044B\u0439", build: withRoundTail(2) },
    { label: "\u043A\u043E\u0434 \u0441\u0442\u0440\u0430\u043D\u044B", build: withCountryCode("7") }
  ],
  rare: [
    { label: "\u043B\u0435\u0441\u0435\u043D\u043A\u0430 \u0432\u043D\u0438\u0437 6", build: ladderDown(6) },
    { label: "\u043B\u0435\u0441\u0435\u043D\u043A\u0430 \u0432\u043D\u0438\u0437 7", build: ladderDown(7) },
    { label: "\u043B\u0435\u0441\u0435\u043D\u043A\u0430 \u0432\u0432\u0435\u0440\u0445 5", build: ladderUp(5) },
    { label: "\u0437\u0435\u0440\u043A\u0430\u043B\u043E", build: mirror(3) },
    { label: "\u043F\u043E\u0432\u0442\u043E\u0440 \u0431\u043B\u043E\u043A\u0430", build: blockRepeat(3) },
    { label: "\u0447\u0435\u0440\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435", build: alternating },
    { label: "\u043F\u0430\u043B\u0438\u043D\u0434\u0440\u043E\u043C", build: palindrome }
  ],
  epic: [
    { label: "\u043F\u043E\u0447\u0442\u0438 \u043E\u0434\u043D\u0430 \u0446\u0438\u0444\u0440\u0430", build: almostSame },
    { label: "\u0447\u0435\u0440\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 + \u043A\u0440\u0443\u0433\u043B\u044B\u0439", build: alternatingWithRound },
    { label: "\u0434\u0430\u0442\u0430 + \u043A\u0440\u0443\u0433\u043B\u044B\u0439", build: dateWithRound },
    { label: "\u043F\u0430\u043B\u0438\u043D\u0434\u0440\u043E\u043C + \u0441\u0435\u0440\u0438\u044F", build: palindromeWithSeries }
  ],
  legendary: [
    { label: "\u043F\u043E\u0447\u0442\u0438 \u0432\u0441\u0435 \u0435\u0434\u0438\u043D\u0438\u0446\u044B + \u0434\u0430\u0442\u0430", build: almostOnesWithDate },
    { label: "\u0434\u0430\u0442\u0430 + \u0447\u0435\u0440\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435", build: dateWithAlternating },
    { label: "\u0434\u0430\u0442\u0430 + \u0437\u0435\u0440\u043A\u0430\u043B\u043E", build: dateWithMirror }
  ],
  mythic: [{ label: "\u0432\u0441\u0435 \u0446\u0438\u0444\u0440\u044B \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u0435", build: allSame }]
};
var MIN_DIGITS = 7;
var MAX_ATTEMPTS = 400;
var padTo = (value, length, rng) => {
  let out = value.replace(/\D/g, "");
  while (out.length < length) out += randomDigit(rng);
  if (out.length > length) out = out.slice(0, length);
  return out[0] === "0" ? randomDigit(rng, false) + out.slice(1) : out;
};
function generateDigitsForRarity(rarity, length, rng, countryDigits = "") {
  const pool2 = RECIPES[rarity].map(
    (recipe) => (
      // Код страны подставляем фактический, иначе рецепт не сработает вне России.
      recipe.label === "\u043A\u043E\u0434 \u0441\u0442\u0440\u0430\u043D\u044B" && countryDigits ? { ...recipe, build: withCountryCode(countryDigits) } : recipe
    )
  );
  let best = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const recipe = pool2[attempt % pool2.length];
    const digits = padTo(recipe.build(length, rng), length, rng);
    const analysis = analyzeNumber(digits, {
      operatorPrefix: digits.slice(0, 2),
      countryDigits
    });
    const actual = rarityForScore(analysis.score);
    const candidate = {
      digits,
      hits: analysis.hits,
      score: analysis.score,
      rarity: actual,
      matchedTarget: actual === rarity,
      recipe: recipe.label
    };
    if (candidate.matchedTarget) return candidate;
    const band = bandCenter(rarity);
    const gap = Math.abs(analysis.score - band);
    if (gap < bestGap) {
      bestGap = gap;
      best = candidate;
    }
  }
  return best ?? {
    digits: padTo(plain(length, rng), length, rng),
    hits: [],
    score: 0,
    rarity: "common",
    matchedTarget: rarity === "common",
    recipe: "\u043E\u0431\u044B\u0447\u043D\u044B\u0439"
  };
}
function bandCenter(rarity) {
  const table = {
    common: 4,
    uncommon: 25,
    rare: 60,
    epic: 110,
    legendary: 180,
    mythic: 300
  };
  return table[rarity];
}
function applyMask(mask, digits) {
  let cursor = 0;
  let out = "";
  for (const char of mask) {
    if (/[A-Z]/.test(char)) {
      out += digits[cursor] ?? "0";
      cursor += 1;
    } else {
      out += char;
    }
  }
  return out;
}
function issueNumber(input) {
  const country = (input.countryId ? COUNTRY_BY_ID[input.countryId] : void 0) ?? COUNTRIES[randomInt(input.rng, 0, COUNTRIES.length - 1)];
  const length = Math.max(MIN_DIGITS, maskSlots(country.mask));
  const countryDigits = country.code.replace(/\D/g, "");
  const generated = generateDigitsForRarity(input.rarity, length, input.rng, countryDigits);
  const rarity = generated.rarity;
  let digits = generated.digits;
  let operatorId;
  if (input.operatorId) {
    const applied = applyOperatorCode(
      brandedOperators(country.id),
      input.operatorId,
      input.code ?? null,
      digits,
      input.rng
    );
    operatorId = applied.operatorId;
    digits = applied.digits;
  } else {
    operatorId = pickOperatorForDigits(country.id, digits);
  }
  if (operatorId === "carrier" && !input.operatorId) {
    for (const candidate of brandedOperators(country.id)) {
      const prefix = candidate.codes[randomInt(input.rng, 0, candidate.codes.length - 1)];
      const prefixLength = Math.min(prefix.length, digits.length);
      const candidateDigits = prefix.slice(0, prefixLength) + digits.slice(prefixLength);
      if (candidateDigits[0] === "0") continue;
      const check = analyzeNumber(candidateDigits, {
        operatorPrefix: candidateDigits.slice(0, 2),
        countryDigits
      });
      if (rarityForScore(check.score) !== rarity) continue;
      digits = candidateDigits;
      operatorId = candidate.id;
      break;
    }
  }
  const analysis = analyzeNumber(digits, {
    operatorPrefix: digits.slice(0, 2),
    countryDigits
  });
  const finalRarity = rarityForScore(analysis.score);
  const multiplier = patternMultiplier(analysis.score);
  const basePrice = RARITIES[finalRarity].basePrice;
  const demandMultiplier = isAnonymous(country.id) ? Math.round(
    (ANONYMOUS.minCoefficient + input.rng() * (ANONYMOUS.maxCoefficient - ANONYMOUS.minCoefficient)) * 100
  ) / 100 : country.demand;
  const finalPrice = Math.round(basePrice * multiplier * demandMultiplier);
  return {
    id: `num_${input.releaseId}`,
    display: applyMask(country.mask, digits),
    digits,
    countryId: country.id,
    regionCode: country.code,
    operatorId,
    tariffId: input.tariffId,
    rarity: finalRarity,
    basePrice,
    patternMultiplier: multiplier,
    demandMultiplier,
    finalPrice,
    score: analysis.score,
    patterns: analysis.hits,
    issuedAt: (/* @__PURE__ */ new Date()).toISOString(),
    releaseId: input.releaseId,
    limitedEdition: null
  };
}
function applyOperatorCode(operators, operatorId, code, digits, rng) {
  const operator = operators.find((item) => item.id === operatorId);
  if (!operator || operator.codes.length === 0) {
    return { operatorId: "carrier", digits };
  }
  const chosen = code && operator.codes.includes(code) ? code : operator.codes[randomInt(rng, 0, operator.codes.length - 1)];
  const length = Math.min(chosen.length, digits.length);
  return { operatorId: operator.id, digits: chosen.slice(0, length) + digits.slice(length) };
}

// ../shared/src/anonymous.ts
var ANONYMOUS_MAX_BATCH = 5;
function weightedRarity(rng) {
  const entries = Object.entries(TARIFFS.premium.odds);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return entries[entries.length - 1][0];
}
function issueAnonymous(state, count, seed = createId("anon")) {
  const safeCount = Math.floor(count);
  if (!Number.isFinite(safeCount) || safeCount < 1 || safeCount > ANONYMOUS_MAX_BATCH) {
    return { ok: false, state, numbers: [], error: "bad_count" };
  }
  const free = state.slots - state.numbers.length;
  if (free < safeCount) {
    return { ok: false, state, numbers: [], error: "slots_full" };
  }
  const rng = makeRng(seedFromString(seed));
  const numbers = [];
  for (let index = 0; index < safeCount; index += 1) {
    const releaseId = `${seed}_${index}`;
    numbers.push(
      issueNumber({
        countryId: ANONYMOUS.id,
        tariffId: "premium",
        rarity: weightedRarity(rng),
        releaseId,
        rng
      })
    );
  }
  const entries = numbers.map((number, index) => ({
    id: `${seed}_ledger_${index}`,
    kind: "gift",
    amount: 0,
    label: `\u0410\u043D\u043E\u043D\u0438\u043C\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 ${number.display} \xB7 ${RARITIES[number.rarity].name}`,
    numberId: number.id,
    at: new Date(Date.now() + index).toISOString()
  }));
  return {
    ok: true,
    numbers,
    state: {
      ...state,
      numbers: [...numbers, ...state.numbers],
      processedReleaseIds: [
        .../* @__PURE__ */ new Set([...state.processedReleaseIds, ...numbers.map((number) => number.releaseId)])
      ].slice(-300),
      ledger: [...entries.reverse(), ...state.ledger].slice(0, 500)
    }
  };
}
var ANONYMOUS_TARIFF_LABEL = TARIFFS.premium.name;

// ../shared/src/roulette.ts
var STANDARD = [
  { id: "cash1000", kind: "money", label: "1\u041A", title: "1 000 \u20BD", chance: 18, color: "#22C55E", amount: 1e3 },
  { id: "cash2500", kind: "money", label: "2,5\u041A", title: "2 500 \u20BD", chance: 16, color: "#3B82F6", amount: 2500 },
  { id: "cash5000", kind: "money", label: "5\u041A", title: "5 000 \u20BD", chance: 14, color: "#8B5CF6", amount: 5e3 },
  { id: "cash10000", kind: "money", label: "10\u041A", title: "10 000 \u20BD", chance: 9, color: "#F59E0B", amount: 1e4 },
  { id: "cash25000", kind: "money", label: "25\u041A", title: "25 000 \u20BD", chance: 3, color: "#EAB308", amount: 25e3 },
  { id: "ticket1", kind: "tickets", label: "\u0411\u0438\u043B\u0435\u0442", title: "\u0411\u0438\u043B\u0435\u0442 \xAB\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\xBB", chance: 13, color: "#14B8A6", releases: 1 },
  { id: "ticket2", kind: "tickets", label: "2 \u0431\u0438\u043B.", title: "\u0414\u0432\u0430 \u0431\u0438\u043B\u0435\u0442\u0430 \xAB\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\xBB", chance: 5, color: "#0EA5E9", releases: 2 },
  { id: "ticketPlus", kind: "tickets", label: "\u041F\u043B\u044E\u0441", title: "\u0411\u0438\u043B\u0435\u0442 \xAB\u041F\u043B\u044E\u0441\xBB", chance: 4, color: "#2563EB", releases: 4 },
  { id: "luck2", kind: "luck", label: "\xD72", title: "\u0423\u0434\u0430\u0447\u0430 \xD72 \u043D\u0430 3 \u043A\u0440\u0443\u0442\u043A\u0438", chance: 7, color: "#A855F7", multiplier: 2, spins: 3 },
  { id: "luck3", kind: "luck", label: "\xD73", title: "\u0423\u0434\u0430\u0447\u0430 \xD73 \u043D\u0430 \u043A\u0440\u0443\u0442\u043A\u0443", chance: 3, color: "#EC4899", multiplier: 3, spins: 1 },
  { id: "discount", kind: "refund", label: "\u221225 %", title: "\u0421\u043A\u0438\u0434\u043A\u0430 25 % \u043D\u0430 \u043A\u0440\u0443\u0442\u043A\u0443", chance: 5, color: "#F97316", amount: 1250 },
  { id: "respin", kind: "refund", label: "\u0415\u0449\u0451", title: "\u0415\u0449\u0451 \u043E\u0434\u043D\u0430 \u043F\u043E\u043F\u044B\u0442\u043A\u0430", chance: 3, color: "#EF4444", amount: 5e3 }
];
var GENEROUS = [
  { id: "g5000", kind: "money", label: "5\u041A", title: "5 000 \u20BD", chance: 20, color: "#22C55E", amount: 5e3 },
  { id: "g10000", kind: "money", label: "10\u041A", title: "10 000 \u20BD", chance: 16, color: "#3B82F6", amount: 1e4 },
  { id: "g25000", kind: "money", label: "25\u041A", title: "25 000 \u20BD", chance: 12, color: "#8B5CF6", amount: 25e3 },
  { id: "g50000", kind: "money", label: "50\u041A", title: "50 000 \u20BD", chance: 8, color: "#F59E0B", amount: 5e4 },
  { id: "g150000", kind: "money", label: "150\u041A", title: "150 000 \u20BD", chance: 3, color: "#EAB308", amount: 15e4 },
  { id: "gPlus", kind: "tickets", label: "\u041F\u043B\u044E\u0441", title: "\u0411\u0438\u043B\u0435\u0442 \xAB\u041F\u043B\u044E\u0441\xBB", chance: 11, color: "#14B8A6", releases: 4 },
  { id: "gPlus2", kind: "tickets", label: "2 \u041F\u043B\u044E\u0441", title: "\u0414\u0432\u0430 \u0431\u0438\u043B\u0435\u0442\u0430 \xAB\u041F\u043B\u044E\u0441\xBB", chance: 5, color: "#0EA5E9", releases: 8 },
  { id: "gElite", kind: "tickets", label: "\u042D\u043B\u0438\u0442", title: "\u0411\u0438\u043B\u0435\u0442 \xAB\u042D\u043B\u0438\u0442\xBB", chance: 3, color: "#2563EB", releases: 20 },
  { id: "gLuck3", kind: "luck", label: "\xD73", title: "\u0423\u0434\u0430\u0447\u0430 \xD73 \u043D\u0430 5 \u043A\u0440\u0443\u0442\u043E\u043A", chance: 8, color: "#A855F7", multiplier: 3, spins: 5 },
  { id: "gLuck5", kind: "luck", label: "\xD75", title: "\u0423\u0434\u0430\u0447\u0430 \xD75 \u043D\u0430 2 \u043A\u0440\u0443\u0442\u043A\u0438", chance: 4, color: "#EC4899", multiplier: 5, spins: 2 },
  { id: "gDiscount", kind: "refund", label: "\u221250 %", title: "\u0421\u043A\u0438\u0434\u043A\u0430 50 % \u043D\u0430 \u043A\u0440\u0443\u0442\u043A\u0443", chance: 6, color: "#F97316", amount: 12500 },
  { id: "gRespin", kind: "refund", label: "\u0415\u0449\u0451", title: "\u0415\u0449\u0451 \u043E\u0434\u043D\u0430 \u043F\u043E\u043F\u044B\u0442\u043A\u0430", chance: 4, color: "#EF4444", amount: 25e3 }
];
var ELITE = [
  { id: "e25000", kind: "money", label: "25\u041A", title: "25 000 \u20BD", chance: 18, color: "#22C55E", amount: 25e3 },
  { id: "e50000", kind: "money", label: "50\u041A", title: "50 000 \u20BD", chance: 15, color: "#3B82F6", amount: 5e4 },
  { id: "e100000", kind: "money", label: "100\u041A", title: "100 000 \u20BD", chance: 12, color: "#8B5CF6", amount: 1e5 },
  { id: "e250000", kind: "money", label: "250\u041A", title: "250 000 \u20BD", chance: 7, color: "#F59E0B", amount: 25e4 },
  { id: "eMillion", kind: "money", label: "1 \u043C\u043B\u043D", title: "1 000 000 \u20BD", chance: 2, color: "#EAB308", amount: 1e6 },
  { id: "eElite", kind: "tickets", label: "\u042D\u043B\u0438\u0442", title: "\u0411\u0438\u043B\u0435\u0442 \xAB\u042D\u043B\u0438\u0442\xBB", chance: 12, color: "#14B8A6", releases: 20 },
  { id: "eElite3", kind: "tickets", label: "3 \u042D\u043B\u0438\u0442", title: "\u0422\u0440\u0438 \u0431\u0438\u043B\u0435\u0442\u0430 \xAB\u042D\u043B\u0438\u0442\xBB", chance: 4, color: "#0EA5E9", releases: 60 },
  { id: "eFree5", kind: "tickets", label: "5 \u0431\u0438\u043B.", title: "\u041F\u044F\u0442\u044C \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0445 \u0432\u044B\u043F\u0443\u0441\u043A\u043E\u0432", chance: 8, color: "#2563EB", releases: 5 },
  { id: "eLuck5", kind: "luck", label: "\xD75", title: "\u0423\u0434\u0430\u0447\u0430 \xD75 \u043D\u0430 5 \u043A\u0440\u0443\u0442\u043E\u043A", chance: 8, color: "#A855F7", multiplier: 5, spins: 5 },
  { id: "eLuck10", kind: "luck", label: "\xD710", title: "\u0423\u0434\u0430\u0447\u0430 \xD710 \u043D\u0430 3 \u043A\u0440\u0443\u0442\u043A\u0438", chance: 4, color: "#EC4899", multiplier: 10, spins: 3 },
  { id: "eDiscount", kind: "refund", label: "\u221250 %", title: "\u0421\u043A\u0438\u0434\u043A\u0430 50 % \u043D\u0430 \u043A\u0440\u0443\u0442\u043A\u0443", chance: 6, color: "#F97316", amount: 5e4 },
  { id: "eRespin", kind: "refund", label: "\u0415\u0449\u0451", title: "\u0415\u0449\u0451 \u043E\u0434\u043D\u0430 \u043F\u043E\u043F\u044B\u0442\u043A\u0430", chance: 4, color: "#EF4444", amount: 1e5 }
];
var ROULETTE_WHEELS = [
  {
    id: "standard",
    name: "\u041E\u0431\u044B\u0447\u043D\u043E\u0435",
    tagline: "\u0421\u043F\u043E\u043A\u043E\u0439\u043D\u043E\u0435 \u043A\u043E\u043B\u0435\u0441\u043E: \u043D\u0435\u0431\u043E\u043B\u044C\u0448\u0438\u0435 \u0441\u0443\u043C\u043C\u044B \u0438 \u0431\u0438\u043B\u0435\u0442\u044B \u043D\u0430 \xAB\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\xBB",
    cost: 5e3,
    ring: ["#F0B90B", "#7C4A03"],
    prizes: STANDARD
  },
  {
    id: "generous",
    name: "\u0429\u0435\u0434\u0440\u043E\u0435",
    tagline: "\u0421\u0442\u0430\u0432\u043A\u0430 \u0431\u043E\u043B\u044C\u0448\u0435, \u043D\u043E \u0438 \u043F\u0440\u0438\u0437\u044B \u0432\u043F\u044F\u0442\u0435\u0440\u043E \u043A\u0440\u0443\u043F\u043D\u0435\u0435",
    cost: 25e3,
    ring: ["#22D3EE", "#0E5C6B"],
    prizes: GENEROUS
  },
  {
    id: "elite",
    name: "\u042D\u043B\u0438\u0442\u043D\u043E\u0435",
    tagline: "\u041C\u0438\u043B\u043B\u0438\u043E\u043D \u0432 \u043E\u0434\u043D\u043E\u043C \u0441\u0435\u043A\u0442\u043E\u0440\u0435 \u0438 \u0431\u0438\u043B\u0435\u0442\u044B \u043D\u0430 \xAB\u042D\u043B\u0438\u0442\xBB",
    cost: 1e5,
    ring: ["#A855F7", "#3B0764"],
    prizes: ELITE
  }
];
function wheelById(id) {
  return ROULETTE_WHEELS.find((wheel) => wheel.id === id) ?? ROULETTE_WHEELS[0];
}
function pickPrize(wheel, roll) {
  let cursor = 0;
  for (let index = 0; index < wheel.prizes.length; index += 1) {
    cursor += wheel.prizes[index].chance;
    if (roll <= cursor) return { prize: wheel.prizes[index], index };
  }
  const last = wheel.prizes.length - 1;
  return { prize: wheel.prizes[last], index: last };
}
function spinRoulette(state, options = {}) {
  const wheel = wheelById(options.wheelId);
  const releaseId = options.releaseId ?? createId("spin");
  if (state.processedReleaseIds.includes(releaseId)) {
    return {
      ok: false,
      state,
      wheelId: wheel.id,
      prize: null,
      index: -1,
      spent: 0,
      gained: 0,
      error: "duplicate"
    };
  }
  if (state.player.balance < wheel.cost) {
    return {
      ok: false,
      state,
      wheelId: wheel.id,
      prize: null,
      index: -1,
      spent: 0,
      gained: 0,
      error: "insufficient_funds"
    };
  }
  const rng = makeRng(seedFor(releaseId));
  const { prize, index } = pickPrize(wheel, rng() * 100);
  const player = { ...state.player, balance: state.player.balance - wheel.cost };
  const entries = [
    ledgerEntry(state, {
      kind: "roulette",
      amount: -wheel.cost,
      label: `\u0420\u0443\u043B\u0435\u0442\u043A\u0430 \xAB${wheel.name}\xBB \xB7 \u043F\u043E\u043F\u044B\u0442\u043A\u0430`
    })
  ];
  let gained = 0;
  if (prize.kind === "money" || prize.kind === "refund") {
    gained = prize.amount ?? 0;
    player.balance += gained;
    entries.unshift(
      ledgerEntry(state, {
        kind: "roulette",
        amount: gained,
        label: `\u0420\u0443\u043B\u0435\u0442\u043A\u0430 \xB7 ${prize.title}`
      })
    );
  } else if (prize.kind === "tickets") {
    player.freeReleases += prize.releases ?? 0;
    entries.unshift(
      ledgerEntry(state, { kind: "roulette", amount: 0, label: `\u0420\u0443\u043B\u0435\u0442\u043A\u0430 \xB7 ${prize.title}` })
    );
  } else {
    const current = activeLuckOf(state);
    const better = (prize.multiplier ?? 1) > current || (prize.multiplier ?? 1) === current && (prize.spins ?? 0) > state.player.luck.spinsLeft;
    player.luck = better ? {
      multiplier: prize.multiplier ?? 1,
      expiresAt: state.player.luck.expiresAt,
      spinsLeft: prize.spins ?? 0,
      title: `\u0420\u0443\u043B\u0435\u0442\u043A\u0430 \xB7 \u0423\u0434\u0430\u0447\u0430 \xD7${prize.multiplier}`,
      subtitle: `\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0435\u0449\u0451 ${prize.spins} \u043A\u0440\u0443\u0442\u043E\u043A`
    } : {
      ...state.player.luck,
      spinsLeft: state.player.luck.spinsLeft + (prize.spins ?? 0)
    };
    entries.unshift(
      ledgerEntry(state, { kind: "roulette", amount: 0, label: `\u0420\u0443\u043B\u0435\u0442\u043A\u0430 \xB7 ${prize.title}` })
    );
  }
  return {
    ok: true,
    wheelId: wheel.id,
    prize,
    index,
    spent: wheel.cost,
    gained,
    state: {
      ...state,
      player,
      processedReleaseIds: [...state.processedReleaseIds, releaseId].slice(-300),
      ledger: [...entries, ...state.ledger].slice(0, 500)
    }
  };
}
function seedFor(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function activeLuckOf(state) {
  const { multiplier, expiresAt, spinsLeft } = state.player.luck;
  if (multiplier <= 1) return 1;
  if (spinsLeft > 0) return multiplier;
  if (!expiresAt) return 1;
  return new Date(expiresAt).getTime() > Date.now() ? multiplier : 1;
}
function ledgerEntry(state, entry) {
  return {
    id: `ledger_${state.ledger.length}_${entry.label}`,
    at: (/* @__PURE__ */ new Date()).toISOString(),
    ...entry
  };
}

// ../shared/src/tasks.ts
var GOOD = ["rare", "epic", "legendary", "mythic"];
var PAID_TARIFFS = ["plus", "premium", "elite"];
function issuedSince(state, since) {
  return state.numbers.filter(
    (number) => number.countryId !== "anon" && Date.parse(number.issuedAt) >= since
  );
}
function salesSince(state, since) {
  return state.ledger.filter(
    (entry) => entry.kind === "sale" && Date.parse(entry.at) >= since
  ).length;
}
var DAILY_TASKS = [
  {
    id: "release5",
    scope: "daily",
    title: "\u0412\u044B\u043F\u0443\u0441\u0442\u0438 5 SIM",
    target: 5,
    reward: 900,
    progress: (state, since) => issuedSince(state, since).length
  },
  {
    id: "release_plus3",
    scope: "daily",
    title: "\u0412\u044B\u043F\u0443\u0441\u0442\u0438 3 SIM \u043D\u0430 \xAB\u041F\u043B\u044E\u0441\u0435\xBB \u0438\u043B\u0438 \u0434\u043E\u0440\u043E\u0436\u0435",
    target: 3,
    reward: 1400,
    progress: (state, since) => issuedSince(state, since).filter((number) => PAID_TARIFFS.includes(number.tariffId)).length
  },
  {
    id: "sell5",
    scope: "daily",
    title: "\u041F\u0440\u043E\u0434\u0430\u0439 5 \u043D\u043E\u043C\u0435\u0440\u043E\u0432",
    target: 5,
    reward: 700,
    progress: (state, since) => salesSince(state, since)
  }
];
var WEEKLY_TASKS = [
  {
    id: "release30",
    scope: "weekly",
    title: "\u0412\u044B\u043F\u0443\u0441\u0442\u0438 30 SIM \u0437\u0430 \u043D\u0435\u0434\u0435\u043B\u044E",
    target: 30,
    reward: 6e3,
    progress: (state, since) => issuedSince(state, since).length
  },
  {
    id: "good5",
    scope: "weekly",
    title: "\u041F\u043E\u043B\u0443\u0447\u0438 5 \u0440\u0435\u0434\u043A\u0438\u0445 \u043D\u043E\u043C\u0435\u0440\u043E\u0432 \u0438\u043B\u0438 \u043B\u0443\u0447\u0448\u0435",
    target: 5,
    reward: 8e3,
    progress: (state, since) => issuedSince(state, since).filter((number) => GOOD.includes(number.rarity)).length
  },
  {
    id: "sell15",
    scope: "weekly",
    title: "\u041F\u0440\u043E\u0434\u0430\u0439 15 \u043D\u043E\u043C\u0435\u0440\u043E\u0432",
    target: 15,
    reward: 5e3,
    progress: (state, since) => salesSince(state, since)
  }
];
var TASK_DEFINITIONS = [...DAILY_TASKS, ...WEEKLY_TASKS];
function startOfDay(now) {
  const copy = new Date(now);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}
function startOfWeek(now) {
  const copy = new Date(now);
  const day = (copy.getDay() + 6) % 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy.getTime();
}
function periodKey(scope, now) {
  if (scope === "daily") {
    const date = new Date(startOfDay(now));
    return `d:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
  }
  const monday = new Date(startOfWeek(now));
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.floor((thursday.getTime() - jan1.getTime()) / 864e5 / 7) + 1;
  return `w:${thursday.getFullYear()}-${String(week).padStart(2, "0")}`;
}
function tasksFor(state, now = /* @__PURE__ */ new Date()) {
  const periods = {
    daily: { key: periodKey("daily", now), since: startOfDay(now) },
    weekly: { key: periodKey("weekly", now), since: startOfWeek(now) }
  };
  return TASK_DEFINITIONS.map((definition) => {
    const period = periods[definition.scope];
    const key = `${period.key}:${definition.id}`;
    const raw = definition.progress(state, period.since);
    const progress = Math.min(raw, definition.target);
    return {
      key,
      title: definition.title,
      scope: definition.scope,
      target: definition.target,
      reward: definition.reward,
      progress,
      ready: progress >= definition.target,
      claimed: state.claimedAchievements.includes(key)
    };
  });
}
function claimTask(state, key, now = /* @__PURE__ */ new Date()) {
  const task = tasksFor(state, now).find((item) => item.key === key);
  if (!task) return { ok: false, state, amount: 0, task: null, error: "not_found" };
  if (task.claimed) return { ok: false, state, amount: 0, task, error: "already" };
  if (!task.ready) return { ok: false, state, amount: 0, task, error: "locked" };
  const entry = {
    id: `ledger_${key}_${state.ledger.length}`,
    kind: "quest",
    amount: task.reward,
    label: `\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \xB7 ${task.title}`,
    at: new Date(now).toISOString()
  };
  return {
    ok: true,
    amount: task.reward,
    task: { ...task, claimed: true },
    state: {
      ...state,
      player: { ...state.player, balance: state.player.balance + task.reward },
      // Ключ с периодом: в новом периоде задание снова доступно.
      claimedAchievements: [...state.claimedAchievements, key].slice(-200),
      ledger: [entry, ...state.ledger].slice(0, 500)
    }
  };
}

// ../shared/src/promo.ts
var PROMO_CODES = [
  {
    code: "\u0426\u0418\u0424\u0415\u0420\u041A\u0418",
    title: "\u041F\u0440\u0438\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439",
    note: "\u0421\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u043F\u043E\u0434\u0430\u0440\u043E\u043A: \u0434\u0435\u043D\u044C\u0433\u0438 \u0438 \u0431\u0438\u043B\u0435\u0442",
    reward: { kind: "tickets", count: 1 },
    limit: null,
    until: null
  },
  {
    code: "\u041F\u0415\u0420\u0412\u042B\u0419",
    title: "\u041F\u0435\u0440\u0432\u044B\u0439 \u0432\u044B\u043F\u0443\u0441\u043A",
    note: "\u041E\u0434\u0438\u043D \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0439 \u0432\u044B\u043F\u0443\u0441\u043A",
    reward: { kind: "releases", count: 1 },
    limit: 5e3,
    until: null
  },
  {
    code: "\u0423\u0414\u0410\u0427\u0410",
    title: "\u041F\u043E\u043B\u043E\u0441\u0430 \u0432\u0435\u0437\u0435\u043D\u0438\u044F",
    note: "\u0423\u0434\u0430\u0447\u0430 \xD73 \u043D\u0430 \u043F\u044F\u0442\u044C \u043A\u0440\u0443\u0442\u043E\u043A",
    reward: { kind: "luck", multiplier: 3, spins: 5 },
    limit: 2e3,
    until: null
  },
  {
    code: "\u0429\u0415\u0414\u0420\u041E\u0421\u0422\u042C",
    title: "\u0429\u0435\u0434\u0440\u044B\u0439 \u0432\u0435\u0447\u0435\u0440",
    note: "25 000 \u20BD \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441",
    reward: { kind: "money", amount: 25e3 },
    limit: 500,
    until: null
  }
];
function normalizePromo(input) {
  return input.replace(/\s+/g, "").toUpperCase();
}
function findPromo(input, codes = PROMO_CODES) {
  const code = normalizePromo(input);
  return codes.find((item) => normalizePromo(item.code) === code) ?? null;
}
function validatePromoCode(code) {
  const clean = normalizePromo(code);
  if (clean.length < 3) return "\u041A\u043E\u0434 \u043A\u043E\u0440\u043E\u0447\u0435 \u0442\u0440\u0451\u0445 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432";
  if (clean.length > 24) return "\u041A\u043E\u0434 \u0434\u043B\u0438\u043D\u043D\u0435\u0435 24 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432";
  if (!/^[A-Z0-9_-]+$/.test(clean)) return "\u0422\u043E\u043B\u044C\u043A\u043E \u043B\u0430\u0442\u0438\u043D\u0441\u043A\u0438\u0435 \u0431\u0443\u043A\u0432\u044B, \u0446\u0438\u0444\u0440\u044B, \u0434\u0435\u0444\u0438\u0441 \u0438 \u043F\u043E\u0434\u0447\u0451\u0440\u043A\u0438\u0432\u0430\u043D\u0438\u0435";
  return null;
}
function promoRewardText(promo) {
  const reward = promo.reward;
  switch (reward.kind) {
    case "money":
      return `${reward.amount.toLocaleString("ru-RU")} \u20BD \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441`;
    case "tickets":
      return `${reward.count} \u0431\u0438\u043B\u0435\u0442${reward.count === 1 ? "" : "\u0430"} \xAB\u042D\u043B\u0438\u0442\xBB`;
    case "releases":
      return `${reward.count} \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D${reward.count === 1 ? "\u044B\u0439 \u0432\u044B\u043F\u0443\u0441\u043A" : "\u044B\u0445 \u0432\u044B\u043F\u0443\u0441\u043A\u0430"}`;
    default:
      return `\u0443\u0434\u0430\u0447\u0430 \xD7${reward.multiplier} \u043D\u0430 ${reward.spins} \u043A\u0440\u0443\u0442\u043E\u043A`;
  }
}
function redeemPromo(state, input, usedTotal = 0, today = /* @__PURE__ */ new Date(), codes = PROMO_CODES) {
  const raw = normalizePromo(input);
  if (raw.length === 0) {
    return { ok: false, state, promo: null, gained: "", error: "empty" };
  }
  const promo = findPromo(raw, codes);
  if (!promo) {
    return { ok: false, state, promo: null, gained: "", error: "not_found" };
  }
  if (state.usedPromoCodes.includes(raw)) {
    return { ok: false, state, promo, gained: "", error: "already" };
  }
  if (promo.until) {
    const limit = /* @__PURE__ */ new Date(`${promo.until}T23:59:59`);
    if (today.getTime() > limit.getTime()) {
      return { ok: false, state, promo, gained: "", error: "expired" };
    }
  }
  if (promo.limit !== null && usedTotal >= promo.limit) {
    return { ok: false, state, promo, gained: "", error: "exhausted" };
  }
  const player = { ...state.player };
  const reward = promo.reward;
  if (reward.kind === "money") {
    player.balance += reward.amount;
  } else if (reward.kind === "tickets") {
    player.tickets += reward.count;
  } else if (reward.kind === "releases") {
    player.freeReleases += reward.count;
  } else {
    const current = player.luck.multiplier;
    player.luck = reward.multiplier > current || player.luck.spinsLeft === 0 ? {
      multiplier: reward.multiplier,
      expiresAt: player.luck.expiresAt,
      spinsLeft: reward.spins,
      title: `\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434 \xB7 \u0423\u0434\u0430\u0447\u0430 \xD7${reward.multiplier}`,
      subtitle: `\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0435\u0449\u0451 ${reward.spins} \u043A\u0440\u0443\u0442\u043E\u043A`
    } : { ...player.luck, spinsLeft: player.luck.spinsLeft + reward.spins };
  }
  const entry = {
    id: `ledger_promo_${state.ledger.length}_${raw}`,
    kind: "promo",
    amount: reward.kind === "money" ? reward.amount : 0,
    label: `\u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434 ${promo.code} \xB7 ${promoRewardText(promo)}`,
    at: (/* @__PURE__ */ new Date()).toISOString()
  };
  return {
    ok: true,
    promo,
    gained: promoRewardText(promo),
    state: {
      ...state,
      player,
      usedPromoCodes: [...state.usedPromoCodes, raw].slice(-200),
      ledger: [entry, ...state.ledger].slice(0, 500)
    }
  };
}

// ../shared/src/overrides.ts
var pristine = null;
function snapshot() {
  if (pristine) return pristine;
  pristine = {
    tariffPrice: Object.fromEntries(
      Object.entries(TARIFFS).map(([id, tariff]) => [id, tariff.price])
    ),
    tariffOdds: Object.fromEntries(
      Object.entries(TARIFFS).map(([id, tariff]) => [id, { ...tariff.odds }])
    ),
    tariffXp: Object.fromEntries(
      Object.entries(TARIFFS).map(([id, tariff]) => [id, tariff.xpMultiplier])
    ),
    rarityBasePrice: Object.fromEntries(
      Object.entries(RARITIES).map(([id, rarity]) => [id, rarity.basePrice])
    ),
    patternPoints: { ...PATTERN_POINTS },
    regionDemand: Object.fromEntries(COUNTRIES.map((country) => [country.id, country.demand]))
  };
  return pristine;
}
function resetConfigToBase() {
  const base = snapshot();
  for (const [id, tariff] of Object.entries(TARIFFS)) {
    tariff.price = base.tariffPrice[id] ?? null;
    tariff.odds = { ...base.tariffOdds[id] };
    tariff.xpMultiplier = base.tariffXp[id] ?? 1;
  }
  for (const [id, rarity] of Object.entries(RARITIES)) {
    rarity.basePrice = base.rarityBasePrice[id] ?? rarity.basePrice;
  }
  for (const [id, points] of Object.entries(base.patternPoints)) {
    PATTERN_POINTS[id] = points;
  }
  for (const country of COUNTRIES) {
    country.demand = base.regionDemand[country.id] ?? country.demand;
  }
}
function applyConfigOverrides(overrides) {
  resetConfigToBase();
  const applied = [];
  const ignored = [];
  for (const [key, value] of Object.entries(overrides)) {
    if (applyOne(key, value)) applied.push(key);
    else ignored.push(key);
  }
  return { applied, ignored };
}
function applyOne(key, value) {
  const priceMatch = /^tariff\.([a-z]+)\.price$/.exec(key);
  if (priceMatch) {
    const tariff = TARIFFS[priceMatch[1]];
    if (!tariff || typeof value !== "number" || !Number.isFinite(value) || value <= 0) return false;
    tariff.price = Math.round(value);
    return true;
  }
  const oddsMatch = /^tariff\.([a-z]+)\.odds$/.exec(key);
  if (oddsMatch) {
    const tariff = TARIFFS[oddsMatch[1]];
    if (!tariff || typeof value !== "object" || value === null) return false;
    const draft = value;
    const sum = Object.values(draft).reduce((total, item) => total + Number(item), 0);
    if (Math.abs(sum - 100) > 1e-3) return false;
    tariff.odds = { ...draft };
    return true;
  }
  const patternMatch = /^pattern\.([a-z_]+)$/.exec(key);
  if (patternMatch) {
    if (!(patternMatch[1] in PATTERN_POINTS)) return false;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return false;
    PATTERN_POINTS[patternMatch[1]] = value;
    return true;
  }
  const regionMatch = /^region\.([a-z]+)$/.exec(key);
  if (regionMatch) {
    const country = COUNTRIES.find((item) => item.id === regionMatch[1]);
    if (!country) return false;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 10) {
      return false;
    }
    country.demand = value;
    return true;
  }
  const rarityMatch = /^rarity\.([a-z]+)\.basePrice$/.exec(key);
  if (rarityMatch) {
    const rarity = RARITIES[rarityMatch[1]];
    if (!rarity) return false;
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return false;
    rarity.basePrice = value;
    return true;
  }
  return false;
}
function baseConfigValues() {
  const base = snapshot();
  return {
    tariffPrice: { ...base.tariffPrice },
    tariffOdds: structuredClone(base.tariffOdds),
    patternPoints: { ...base.patternPoints },
    regionDemand: { ...base.regionDemand },
    rarityBasePrice: { ...base.rarityBasePrice }
  };
}

// ../shared/src/quests.ts
var countRarity = (state, rarity) => state.numbers.filter((number) => number.rarity === rarity).length;
var ACHIEVEMENTS = [
  {
    id: "first_sim",
    title: "\u041F\u0435\u0440\u0432\u0430\u044F \u0441\u0438\u043C\u043A\u0430",
    hint: "\u0412\u044B\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u043F\u0435\u0440\u0432\u0443\u044E SIM",
    target: 1,
    progress: (state) => Math.min(1, state.numbers.length),
    reward: 300
  },
  {
    id: "ten_sim",
    title: "\u0420\u0430\u0437\u043E\u0433\u0440\u0435\u0432",
    hint: "\u0421\u043E\u0431\u0440\u0430\u0442\u044C 10 \u043D\u043E\u043C\u0435\u0440\u043E\u0432",
    target: 10,
    progress: (state) => state.numbers.length,
    reward: 1500
  },
  {
    id: "fifty_sim",
    title: "\u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440",
    hint: "\u0421\u043E\u0431\u0440\u0430\u0442\u044C 50 \u043D\u043E\u043C\u0435\u0440\u043E\u0432",
    target: 50,
    progress: (state) => state.numbers.length,
    reward: 9e3
  },
  {
    id: "first_rare",
    title: "\u0420\u0435\u0434\u043A\u0430\u044F \u043D\u0430\u0445\u043E\u0434\u043A\u0430",
    hint: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0440\u0435\u0434\u043A\u0438\u0439 \u043D\u043E\u043C\u0435\u0440",
    target: 1,
    progress: (state) => countRarity(state, "rare"),
    reward: 2500
  },
  {
    id: "first_epic",
    title: "\u042D\u043F\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0443\u043B\u043E\u0432",
    hint: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u044D\u043F\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043D\u043E\u043C\u0435\u0440",
    target: 1,
    progress: (state) => countRarity(state, "epic"),
    reward: 12e3
  },
  {
    id: "first_legendary",
    title: "\u041B\u0435\u0433\u0435\u043D\u0434\u0430",
    hint: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440",
    target: 1,
    progress: (state) => countRarity(state, "legendary"),
    reward: 8e4
  },
  {
    id: "first_mythic",
    title: "\u041C\u0438\u0444",
    hint: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043C\u0438\u0444\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043D\u043E\u043C\u0435\u0440",
    target: 1,
    progress: (state) => countRarity(state, "mythic"),
    reward: 5e5
  },
  {
    id: "beauty_100",
    title: "\u041A\u0440\u0430\u0441\u0438\u0432\u044B\u0439 \u0443\u0437\u043E\u0440",
    hint: "\u041D\u0430\u0439\u0442\u0438 \u043D\u043E\u043C\u0435\u0440 \u0441 100 \u043E\u0447\u043A\u0430\u043C\u0438 \u0443\u0437\u043E\u0440\u0430",
    target: 100,
    progress: (state) => state.numbers.reduce((best, number) => Math.max(best, number.score), 0),
    reward: 8e3
  },
  {
    id: "level_5",
    title: "\u041F\u044F\u0442\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C",
    hint: "\u0414\u043E\u0441\u0442\u0438\u0447\u044C 5 \u0443\u0440\u043E\u0432\u043D\u044F",
    target: 5,
    progress: (state) => state.player.level,
    reward: 4e3
  },
  {
    id: "portfolio",
    title: "\u041C\u0438\u043B\u043B\u0438\u043E\u043D \u0432 \u0446\u0438\u0444\u0440\u0430\u0445",
    hint: "\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044E \u0434\u043E\u0440\u043E\u0436\u0435 1 000 000 \u20BD",
    target: 1e6,
    progress: (state) => state.numbers.reduce((sum, number) => sum + number.finalPrice, 0),
    reward: 5e4
  }
];
function progressLabel(achievement, state) {
  const current = achievement.progress(state);
  if (achievement.target >= 1e3) {
    return `${formatMoney(current)} / ${formatMoney(achievement.target)} \u20BD`;
  }
  return `${current} \u0438\u0437 ${achievement.target}`;
}
var DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1e3;
function lastDailyAt(state) {
  const entry = state.ledger.find((item) => item.kind === "daily");
  return entry ? new Date(entry.at).getTime() : 0;
}
function dailyAvailable(state, now = Date.now()) {
  return now - lastDailyAt(state) >= DAILY_COOLDOWN_MS;
}
var DAILY_BASE = 600;
var DAILY_STEP = 120;
var DAILY_CAP = 1200;
function dailyReward(state) {
  const streak = Math.max(0, state.player.dailyStreak);
  return Math.min(DAILY_BASE + streak * DAILY_STEP, DAILY_CAP);
}
function dailyTicket(streakAfter) {
  return streakAfter > 0 && streakAfter % 7 === 0 ? 1 : 0;
}

// ../shared/src/engine.ts
var SCHEMA_VERSION = 4;
function activeLuck(state, now = Date.now()) {
  const { multiplier, expiresAt, spinsLeft } = state.player.luck;
  if (multiplier <= 1) return 1;
  if (spinsLeft > 0) return multiplier;
  if (expiresAt === null) return 1;
  return new Date(expiresAt).getTime() > now ? multiplier : 1;
}
function distributionFor(tariffId, luckMultiplier = 1) {
  const base = TARIFFS[tariffId].odds;
  const boosted = { ...base };
  if (luckMultiplier > 1) {
    for (const rarity of LUCK.boostedRarities) {
      boosted[rarity] = base[rarity] * luckMultiplier;
    }
  }
  const total = Object.values(boosted).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { ...base };
  const normalized = {};
  for (const key of Object.keys(boosted)) {
    normalized[key] = boosted[key] / total * 100;
  }
  return normalized;
}
function rarePlusShare(tariffId, luckMultiplier = 1) {
  const distribution = distributionFor(tariffId, luckMultiplier);
  return distribution.rare + distribution.epic + distribution.legendary + distribution.mythic;
}
function ledger(_state, entry) {
  return { ...entry, id: createId("led"), at: (/* @__PURE__ */ new Date()).toISOString() };
}
function tariffCost(tariffId) {
  const tariff = TARIFFS[tariffId];
  return { money: tariff.price ?? 0, tickets: tariff.ticketCost ?? 0 };
}
function releaseCost(tariffId, selectedOperator) {
  const base = tariffCost(tariffId);
  if (!selectedOperator || base.money === 0) {
    return { ...base, surcharge: 0 };
  }
  const money = Math.round(base.money * (1 + ECONOMY.operatorSurcharge));
  return { money, tickets: base.tickets, surcharge: money - base.money };
}
function release(state, options = {}) {
  const tariffId = options.tariffId ?? state.selectedTariff;
  const countryId = options.countryId === void 0 ? state.selectedCountry : options.countryId;
  const releaseId = options.releaseId ?? createId("rel");
  if (state.processedReleaseIds.includes(releaseId)) {
    return { ok: false, state, number: null, error: "duplicate", spent: 0 };
  }
  const cost = releaseCost(tariffId, state.selectedOperator);
  if (cost.tickets > 0 && state.player.tickets < cost.tickets) {
    return { ok: false, state, number: null, error: "no_tickets", spent: 0 };
  }
  if (state.player.balance < cost.money) {
    return { ok: false, state, number: null, error: "insufficient_funds", spent: 0 };
  }
  if (state.numbers.length >= state.slots) {
    return { ok: false, state, number: null, error: "slots_full", spent: 0 };
  }
  const rng = makeRng(hashSeed(releaseId));
  const luck = activeLuck(state);
  const rarity = rollRarity(tariffId, luck, rng);
  const number = issueNumber({
    countryId,
    tariffId,
    rarity,
    releaseId,
    rng,
    // Свой оператор и код: номер начнётся именно с них.
    operatorId: state.selectedOperator ?? void 0,
    code: state.selectedCode ?? void 0
  });
  const player = { ...state.player };
  const useFree = player.freeReleases > 0 && cost.money > 0;
  if (useFree) {
    player.freeReleases -= 1;
  } else {
    player.balance -= cost.money;
  }
  player.tickets -= cost.tickets;
  if (player.luck.spinsLeft > 0 && player.luck.multiplier > 1) {
    player.luck = { ...player.luck, spinsLeft: player.luck.spinsLeft - 1 };
  }
  const xpGain = Math.round(RARITIES[number.rarity].xp * TARIFFS[tariffId].xpMultiplier);
  player.xp += xpGain;
  while (player.xp >= ECONOMY.xpForLevel(player.level)) {
    player.xp -= ECONOMY.xpForLevel(player.level);
    player.level += 1;
  }
  const entries = [];
  if (cost.money > 0) {
    entries.push(
      ledger(state, {
        kind: "release",
        amount: -cost.money,
        label: cost.surcharge > 0 ? `\u0412\u044B\u043F\u0443\u0441\u043A SIM \xB7 ${TARIFFS[tariffId].name} \xB7 \u0441\u0432\u043E\u0439 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 (+${cost.surcharge} \u20BD)` : `\u0412\u044B\u043F\u0443\u0441\u043A SIM \xB7 ${TARIFFS[tariffId].name} \xB7 ${RARITIES[number.rarity].name}`,
        numberId: number.id
      })
    );
  }
  if (cost.tickets > 0) {
    entries.push(
      ledger(state, {
        kind: "release",
        amount: 0,
        label: `\u0412\u044B\u043F\u0443\u0441\u043A SIM \xB7 ${TARIFFS[tariffId].name} \xB7 \u043F\u043E \u0431\u0438\u043B\u0435\u0442\u0443`,
        numberId: number.id
      })
    );
  }
  return {
    ok: true,
    // За бесплатный выпуск из рулетки денег не взято — значит и списано ноль.
    spent: useFree ? 0 : cost.money,
    number,
    state: {
      ...state,
      player,
      numbers: [number, ...state.numbers],
      ledger: [...entries, ...state.ledger].slice(0, 500),
      processedReleaseIds: [releaseId, ...state.processedReleaseIds].slice(0, 500)
    }
  };
}
function rollRarity(tariffId, luck, rng) {
  const distribution = distributionFor(tariffId, luck);
  const roll = rng() * 100;
  let cursor = 0;
  const order = ["mythic", "legendary", "epic", "rare", "uncommon", "common"];
  for (const rarity of order) {
    cursor += distribution[rarity];
    if (roll <= cursor) return rarity;
  }
  return "common";
}
function hashSeed(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function sellNumber(state, numberId) {
  const number = state.numbers.find((item) => item.id === numberId);
  if (!number) return { ok: false, state, error: "not_found" };
  if (state.player.primaryNumberId === numberId) return { ok: false, state, error: "locked" };
  const payout = Math.round(number.finalPrice * ECONOMY.sellRate);
  return {
    ok: true,
    state: {
      ...state,
      player: { ...state.player, balance: state.player.balance + payout },
      numbers: state.numbers.filter((item) => item.id !== numberId),
      ledger: [
        ledger(state, {
          kind: "sale",
          amount: payout,
          label: `\u041F\u0440\u043E\u0434\u0430\u0436\u0430 \xB7 ${number.display}`,
          numberId: number.id
        }),
        ...state.ledger
      ].slice(0, 500)
    }
  };
}
function sellMany(state, ids) {
  let current = state;
  let sold = 0;
  let total = 0;
  const skipped = [];
  for (const id of [...new Set(ids)]) {
    const before = current.player.balance;
    const result = sellNumber(current, id);
    if (!result.ok) {
      skipped.push({ id, reason: result.error ?? "unknown" });
      continue;
    }
    current = result.state;
    sold += 1;
    total += current.player.balance - before;
  }
  return { ok: sold > 0, state: current, sold, total, skipped };
}
function forecastDigitChange(number, index) {
  const rng = makeRng(hashSeed(`${number.id}:${index}`));
  let rise = 0;
  let same = 0;
  let fall = 0;
  let best = 0;
  let worst = Number.POSITIVE_INFINITY;
  for (let d = 0; d <= 9; d += 1) {
    if (String(d) === number.digits[index]) continue;
    const digits = number.digits.slice(0, index) + d + number.digits.slice(index + 1);
    const analysis = analyzeNumber(digits, { operatorPrefix: digits.slice(0, 2) });
    const price = Math.round(
      RARITIES[rarityForScore(analysis.score)].basePrice * patternMultiplier(analysis.score) * number.demandMultiplier
    );
    if (price > number.finalPrice) rise += 1;
    else if (price === number.finalPrice) same += 1;
    else fall += 1;
    if (price > best) best = price;
    if (price < worst) worst = price;
  }
  const total = Math.max(1, rise + same + fall);
  const jitter = 0.94 + rng() * 0.12;
  return {
    index,
    currentDigit: number.digits[index],
    willRise: Math.round(rise / total * 100 * jitter),
    same: Math.round(same / total * 100 * jitter),
    willFall: Math.round(fall / total * 100 * jitter),
    bestPrice: best || number.finalPrice,
    worstPrice: Number.isFinite(worst) ? worst : number.finalPrice,
    price: number.finalPrice
  };
}
function changeDigit(state, numberId, index) {
  const existing = state.numbers.find((item) => item.id === numberId);
  if (!existing) return { ok: false, state, number: null, error: "not_found" };
  if (index < 0 || index >= existing.digits.length) {
    return { ok: false, state, number: null, error: "bad_index" };
  }
  if (state.player.balance < ECONOMY.digitChangePrice) {
    return { ok: false, state, number: null, error: "insufficient_funds" };
  }
  const rng = makeRng(hashSeed(`${numberId}:${index}:${Date.now()}`));
  let next = String(randomInt(rng, 0, 9));
  if (next === existing.digits[index]) next = String((Number(next) + 1) % 10);
  if (index === 0 && next === "0") next = "1";
  const digits = existing.digits.slice(0, index) + next + existing.digits.slice(index + 1);
  const analysis = analyzeNumber(digits, { operatorPrefix: digits.slice(0, 2) });
  const rarity = rarityForScore(analysis.score);
  const number = {
    ...existing,
    digits,
    display: applyMask(countryOf(existing).mask, digits),
    rarity,
    basePrice: RARITIES[rarity].basePrice,
    patternMultiplier: patternMultiplier(analysis.score),
    finalPrice: Math.round(
      RARITIES[rarity].basePrice * patternMultiplier(analysis.score) * existing.demandMultiplier
    ),
    score: analysis.score,
    patterns: analysis.hits
  };
  return {
    ok: true,
    number,
    state: {
      ...state,
      player: { ...state.player, balance: state.player.balance - ECONOMY.digitChangePrice },
      numbers: state.numbers.map((item) => item.id === numberId ? number : item),
      ledger: [
        ledger(state, {
          kind: "digit_change",
          amount: -ECONOMY.digitChangePrice,
          label: `\u0417\u0430\u043C\u0435\u043D\u0430 \u0446\u0438\u0444\u0440\u044B \xB7 ${number.display}`,
          numberId
        }),
        ...state.ledger
      ].slice(0, 500)
    }
  };
}
function setPrimaryNumber(state, numberId) {
  if (!state.numbers.some((item) => item.id === numberId)) {
    return { ok: false, state, error: "not_found" };
  }
  const player = { ...state.player };
  if (player.freePrimarySwaps > 0) {
    player.freePrimarySwaps -= 1;
  } else if (player.balance >= ECONOMY.primarySwapPrice) {
    player.balance -= ECONOMY.primarySwapPrice;
  } else {
    return { ok: false, state, error: "insufficient_funds" };
  }
  player.primaryNumberId = numberId;
  return { ok: true, state: { ...state, player } };
}
function claimBailout(state) {
  if (state.player.balance >= ECONOMY.bailoutThreshold) return { ok: false, state };
  return {
    ok: true,
    state: {
      ...state,
      player: { ...state.player, balance: state.player.balance + ECONOMY.bailoutAmount },
      ledger: [
        ledger(state, {
          kind: "daily",
          amount: ECONOMY.bailoutAmount,
          label: "\u0411\u043E\u043D\u0443\u0441 \xB7 \u0431\u0430\u043B\u0430\u043D\u0441 \u043D\u0438\u0436\u0435 \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u0438 \u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u0430"
        }),
        ...state.ledger
      ].slice(0, 500)
    }
  };
}
function rebuildNumber(number, digits) {
  const country = countryOf(number);
  const analysis = analyzeNumber(digits, {
    operatorPrefix: digits.slice(0, 2),
    countryDigits: country.code.replace(/\D/g, "")
  });
  const rarity = rarityForScore(analysis.score);
  const multiplier = patternMultiplier(analysis.score);
  const basePrice = RARITIES[rarity].basePrice;
  return {
    ...number,
    digits,
    display: applyMask(country.mask, digits),
    operatorId: pickOperatorForDigits(country.id, digits),
    rarity,
    basePrice,
    patternMultiplier: multiplier,
    finalPrice: Math.round(basePrice * multiplier * number.demandMultiplier),
    score: analysis.score,
    patterns: analysis.hits
  };
}
function digitsLengthFor(number) {
  const country = countryOf(number);
  return Math.max(7, [...country.mask].filter((char) => /[A-Z]/.test(char)).length);
}
function commitUpgrade(state, numberId, price, label, produce) {
  const existing = state.numbers.find((item) => item.id === numberId);
  if (!existing) return { ok: false, state, number: null, error: "not_found" };
  if (price <= 0) return { ok: false, state, number: null, error: "max_rarity" };
  if (state.player.balance < price) {
    return { ok: false, state, number: null, error: "insufficient_funds" };
  }
  const produced = produce(existing);
  if ("ok" in produced) return produced;
  return {
    ok: true,
    number: produced,
    state: {
      ...state,
      player: { ...state.player, balance: state.player.balance - price },
      numbers: state.numbers.map((item) => item.id === numberId ? produced : item),
      ledger: [
        ledger(state, { kind: "upgrade", amount: -price, label, numberId }),
        ...state.ledger
      ].slice(0, 500)
    }
  };
}
function swapDigits(state, numberId, a, b) {
  const existing = state.numbers.find((item) => item.id === numberId);
  if (!existing) return { ok: false, state, number: null, error: "not_found" };
  if (a === b || a < 0 || b < 0 || a >= existing.digits.length || b >= existing.digits.length) {
    return { ok: false, state, number: null, error: "bad_index" };
  }
  if (existing.digits[a] === existing.digits[b]) {
    return { ok: false, state, number: null, error: "same_digit" };
  }
  const chars = [...existing.digits];
  [chars[a], chars[b]] = [chars[b], chars[a]];
  if (chars[0] === "0") {
    return { ok: false, state, number: null, error: "leading_zero" };
  }
  const price = upgradePrice("swap", existing);
  return commitUpgrade(
    state,
    numberId,
    price,
    `\u041F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \xB7 ${existing.display}`,
    (number) => rebuildNumber(number, chars.join(""))
  );
}
function rerollNumber(state, numberId) {
  const existing = state.numbers.find((item) => item.id === numberId);
  if (!existing) return { ok: false, state, number: null, error: "not_found" };
  const country = countryOf(existing);
  const price = upgradePrice("reroll", existing);
  return commitUpgrade(state, numberId, price, `\u041F\u0435\u0440\u0435\u0431\u043E\u0440 \xB7 ${existing.display}`, (number) => {
    const rng = makeRng(hashSeed(`${numberId}:reroll:${Date.now()}`));
    const generated = generateDigitsForRarity(
      number.rarity,
      digitsLengthFor(number),
      rng,
      country.code.replace(/\D/g, "")
    );
    return rebuildNumber(number, generated.digits);
  });
}
function appealNumber(state, numberId) {
  const existing = state.numbers.find((item) => item.id === numberId);
  if (!existing) return { ok: false, state, number: null, error: "not_found" };
  const target = nextRarity(existing.rarity);
  if (!target) return { ok: false, state, number: null, error: "max_rarity" };
  const country = countryOf(existing);
  const price = upgradePrice("appeal", existing);
  return commitUpgrade(state, numberId, price, `\u0410\u043F\u0435\u043B\u043B\u044F\u0446\u0438\u044F \xB7 ${RARITIES[target].name}`, (number) => {
    const rng = makeRng(hashSeed(`${numberId}:appeal:${target}:${Date.now()}`));
    const generated = generateDigitsForRarity(
      target,
      digitsLengthFor(number),
      rng,
      country.code.replace(/\D/g, "")
    );
    return rebuildNumber(number, generated.digits);
  });
}
function changeOperator(state, numberId, operatorId) {
  const existing = state.numbers.find((item) => item.id === numberId);
  if (!existing) return { ok: false, state, number: null, error: "not_found" };
  if (!operatorId || existing.operatorId === operatorId) {
    return { ok: false, state, number: null, error: "same_digit" };
  }
  const country = countryOf(existing);
  const target = brandedOperators(country.id).find((item) => item.id === operatorId);
  if (!target || target.codes.length === 0) {
    return { ok: false, state, number: null, error: "bad_index" };
  }
  const prefix = target.codes[0];
  const length = Math.min(prefix.length, existing.digits.length);
  const digits = prefix.slice(0, length) + existing.digits.slice(length);
  if (digits[0] === "0") {
    return { ok: false, state, number: null, error: "leading_zero" };
  }
  const price = upgradePrice("operator", existing);
  return commitUpgrade(
    state,
    numberId,
    price,
    `\u0421\u043C\u0435\u043D\u0430 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430 \xB7 ${operatorById(operatorId).name}`,
    (number) => ({ ...rebuildNumber(number, digits), operatorId })
  );
}
function operatorChoices(number) {
  const country = countryOf(number);
  return brandedOperators(country.id).map((operator) => ({
    id: operator.id,
    name: operator.name,
    samplePrefix: operator.codes[0] ?? "",
    codes: operator.codes,
    color: operator.color,
    badge: operator.badge,
    current: operator.id === number.operatorId
  }));
}
function applyUpgrade(state, numberId, id, params = {}) {
  switch (id) {
    case "digit": {
      const result = changeDigit(state, numberId, params.index ?? 0);
      return { ...result, number: result.number ?? null };
    }
    case "swap":
      return swapDigits(state, numberId, params.a ?? 0, params.b ?? 1);
    case "reroll":
      return rerollNumber(state, numberId);
    case "appeal":
      return appealNumber(state, numberId);
    case "operator":
      return changeOperator(state, numberId, params.operatorId ?? "");
    default:
      return { ok: false, state, number: null, error: "not_found" };
  }
}
function upgradeOffers(state, numberId) {
  const number = state.numbers.find((item) => item.id === numberId);
  if (!number) return [];
  const balance = state.player.balance;
  return UPGRADE_ORDER.map((id) => {
    const meta = UPGRADES[id];
    const price = upgradePrice(id, number);
    const targetRarity = id === "appeal" ? nextRarity(number.rarity) : null;
    const choices = id === "operator" ? operatorChoices(number) : void 0;
    const hasAlternative = choices ? choices.some((choice) => !choice.current) : true;
    return {
      id,
      name: meta.name,
      effect: meta.effect,
      description: meta.description,
      price,
      affordable: balance >= price && price > 0,
      available: (id === "appeal" ? targetRarity !== null : true) && hasAlternative,
      targetRarity,
      ...choices ? { operators: choices } : {}
    };
  });
}
function claimDaily(state) {
  const now = Date.now();
  if (!dailyAvailable(state, now)) return { ok: false, state, amount: 0, tickets: 0 };
  const amount = dailyReward(state);
  const streakAfter = state.player.dailyStreak + 1;
  const tickets = dailyTicket(streakAfter);
  const player = {
    ...state.player,
    balance: state.player.balance + amount,
    tickets: state.player.tickets + tickets,
    dailyStreak: streakAfter
  };
  const entries = [
    ledger(state, {
      kind: "daily",
      amount,
      label: `\u041D\u0430\u0433\u0440\u0430\u0434\u0430 \u0434\u043D\u044F \xB7 \u0441\u0435\u0440\u0438\u044F ${streakAfter}`
    })
  ];
  if (tickets > 0) {
    entries.unshift(
      ledger(state, {
        kind: "ticket",
        amount: tickets,
        label: `\u0411\u0438\u043B\u0435\u0442 \u0437\u0430 \u0441\u0435\u0440\u0438\u044E ${streakAfter} \u0434\u043D\u0435\u0439`
      })
    );
  }
  return {
    ok: true,
    amount,
    tickets,
    state: {
      ...state,
      player,
      ledger: [...entries, ...state.ledger].slice(0, 500)
    }
  };
}
function claimAchievement(state, achievementId) {
  const achievement = ACHIEVEMENTS.find((item) => item.id === achievementId);
  if (!achievement) return { ok: false, state, amount: 0, error: "not_found" };
  if (state.claimedAchievements.includes(achievementId)) {
    return { ok: false, state, amount: 0, error: "already" };
  }
  if (achievement.progress(state) < achievement.target) {
    return { ok: false, state, amount: 0, error: "locked" };
  }
  return {
    ok: true,
    amount: achievement.reward,
    state: {
      ...state,
      player: { ...state.player, balance: state.player.balance + achievement.reward },
      claimedAchievements: [...state.claimedAchievements, achievementId],
      ledger: [
        ledger(state, {
          kind: "quest",
          amount: achievement.reward,
          label: `\u0414\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0435 \xB7 ${achievement.title}`
        }),
        ...state.ledger
      ].slice(0, 500)
    }
  };
}
function createInitialState(overrides = {}) {
  return {
    schema: SCHEMA_VERSION,
    player: {
      id: overrides.id ?? createId("plr"),
      name: overrides.name ?? "\u0418\u0433\u0440\u043E\u043A",
      avatarUrl: overrides.avatarUrl ?? null,
      balance: overrides.balance ?? ECONOMY.startingBalance,
      tickets: overrides.tickets ?? ECONOMY.startingTickets,
      level: overrides.level ?? 1,
      xp: overrides.xp ?? 0,
      primaryNumberId: null,
      freeReleases: 0,
      freePrimarySwaps: ECONOMY.freePrimarySwaps,
      dailyStreak: 1,
      luck: defaultLuck()
    },
    numbers: [],
    ledger: [],
    selectedTariff: "standard",
    selectedCountry: null,
    selectedOperator: null,
    selectedCode: null,
    processedReleaseIds: [],
    claimedAchievements: [],
    usedPromoCodes: [],
    slots: ECONOMY.slots
  };
}
function defaultLuck() {
  const expires = /* @__PURE__ */ new Date();
  expires.setHours(24, 0, 0, 0);
  return {
    ...LUCK.defaultState,
    expiresAt: expires.toISOString()
  };
}
function countryOf(number) {
  return COUNTRY_BY_ID[number.countryId];
}

// src/services/config-service.ts
async function reloadConfig(repo) {
  const overrides = await repo.getConfigOverrides();
  const report = applyConfigOverrides(overrides);
  if (report.ignored.length > 0) {
    console.warn(
      `[config] \u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u043E\u0442\u0431\u0440\u043E\u0448\u0435\u043D\u044B (\u043D\u0435 \u043F\u0440\u043E\u0448\u043B\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443): ${report.ignored.join(", ")}`
    );
  }
  if (report.applied.length > 0) {
    console.log(`[config] \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u043E \u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0439: ${report.applied.length}`);
  }
  return report;
}

// src/routes/admin.ts
var RARITY_IDS = Object.keys(RARITIES);
var probabilitySet = (value) => {
  if (typeof value !== "object" || value === null) {
    return { ok: false, reason: "\u043E\u0436\u0438\u0434\u0430\u043B\u0441\u044F \u043E\u0431\u044A\u0435\u043A\u0442 \u0441 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044F\u043C\u0438 \u043F\u043E \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F\u043C" };
  }
  const draft = value;
  let sum = 0;
  for (const rarity of RARITY_IDS) {
    const item = draft[rarity];
    if (typeof item !== "number" || !Number.isFinite(item) || item < 0) {
      return { ok: false, reason: `\u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \xAB${rarity}\xBB \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u043D\u0435\u043E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0447\u0438\u0441\u043B\u043E\u043C` };
    }
    sum += item;
  }
  if (Math.abs(sum - 100) > 1e-3) {
    return { ok: false, reason: `\u0441\u0443\u043C\u043C\u0430 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u0435\u0439 \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C 100 %, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${sum}` };
  }
  return { ok: true, value: Object.fromEntries(RARITY_IDS.map((r) => [r, draft[r]])) };
};
var positiveMoney = (value) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return { ok: false, reason: "\u0446\u0435\u043D\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u0446\u0435\u043B\u044B\u043C \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0447\u0438\u0441\u043B\u043E\u043C" };
  }
  if (value > 1e8) return { ok: false, reason: "\u0446\u0435\u043D\u0430 \u0432\u044B\u0448\u0435 \u0440\u0430\u0437\u0443\u043C\u043D\u043E\u0433\u043E \u043F\u0440\u0435\u0434\u0435\u043B\u0430" };
  return { ok: true, value };
};
var demandFactor = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 10) {
    return { ok: false, reason: "\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0441\u043F\u0440\u043E\u0441\u0430 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 \u043E\u0442 0 \u0434\u043E 10" };
  }
  return { ok: true, value: Math.round(value * 100) / 100 };
};
var nonNegativeInteger = (value) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return { ok: false, reason: "\u043E\u0447\u043A\u0438 \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u0446\u0435\u043B\u044B\u043C \u043D\u0435\u043E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0447\u0438\u0441\u043B\u043E\u043C" };
  }
  return { ok: true, value };
};
function validatorFor(key) {
  if (key.startsWith("tariff.") && key.endsWith(".price")) {
    const tariffId = key.slice("tariff.".length, -".price".length);
    if (tariffId in TARIFFS) {
      return { validate: positiveMoney, describe: `\u0426\u0435\u043D\u0430 \u0442\u0430\u0440\u0438\u0444\u0430 \xAB${tariffId}\xBB` };
    }
  }
  if (key.startsWith("tariff.") && key.endsWith(".odds")) {
    const tariffId = key.slice("tariff.".length, -".odds".length);
    if (tariffId in TARIFFS) {
      return { validate: probabilitySet, describe: `\u0412\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u0438 \u0442\u0430\u0440\u0438\u0444\u0430 \xAB${tariffId}\xBB` };
    }
  }
  if (key.startsWith("pattern.")) {
    const patternId = key.slice("pattern.".length);
    if (patternId in PATTERN_POINTS) {
      return { validate: nonNegativeInteger, describe: `\u041E\u0447\u043A\u0438 \u0443\u0437\u043E\u0440\u0430 \xAB${patternId}\xBB` };
    }
  }
  if (key.startsWith("region.")) {
    const regionId = key.slice("region.".length);
    if (COUNTRIES.some((country) => country.id === regionId)) {
      return { validate: demandFactor, describe: `\u0421\u043F\u0440\u043E\u0441 \u0440\u0435\u0433\u0438\u043E\u043D\u0430 \xAB${regionId}\xBB` };
    }
  }
  const rarityMatch = /^rarity\.([a-z]+)\.basePrice$/.exec(key);
  if (rarityMatch) {
    const rarityId = rarityMatch[1];
    if (rarityId in RARITIES) {
      return { validate: positiveMoney, describe: `\u0411\u0430\u0437\u043E\u0432\u0430\u044F \u0446\u0435\u043D\u0430 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \xAB${rarityId}\xBB` };
    }
  }
  return null;
}
function createAdminRouter(repo, service) {
  const router = Router();
  router.use(requirePlayer, requireAdmin);
  router.get(
    "/config",
    asyncHandler(async (_req, res) => {
      res.json({
        overrides: await repo.getConfigOverrides(),
        base: baseConfigValues(),
        current: {
          tariffPrice: Object.fromEntries(
            Object.entries(TARIFFS).map(([id, tariff]) => [id, tariff.price])
          ),
          tariffOdds: Object.fromEntries(
            Object.entries(TARIFFS).map(([id, tariff]) => [id, tariff.odds])
          ),
          patternPoints: { ...PATTERN_POINTS },
          regionDemand: Object.fromEntries(
            COUNTRIES.map((country) => [country.id, country.demand])
          ),
          rarityBasePrice: Object.fromEntries(
            Object.entries(RARITIES).map(([id, rarity]) => [id, rarity.basePrice])
          )
        },
        tariffs: Object.entries(TARIFFS).map(([id, tariff]) => ({
          id,
          name: tariff.name,
          price: tariff.price,
          ticketCost: tariff.ticketCost,
          odds: tariff.odds
        })),
        patterns: Object.entries(PATTERN_POINTS).map(([id, points]) => ({ id, points })),
        regions: COUNTRIES.map((country) => ({
          id: country.id,
          name: country.name,
          // Флаг показываем вместо идентификатора: «ru» игроку ничего не говорит.
          flag: country.flag,
          code: country.code,
          demand: country.demand,
          operators: brandedOperators(country.id).length
        })),
        rarities: Object.entries(RARITIES).map(([id, rarity]) => ({
          id,
          name: rarity.name,
          basePrice: rarity.basePrice
        }))
      });
    })
  );
  router.put(
    "/config",
    asyncHandler(async (req, res) => {
      const body = req.body;
      const key = typeof body.key === "string" ? body.key : "";
      const rule = validatorFor(key);
      if (!rule) {
        badRequest(res, "unknown_key");
        return;
      }
      const checked = rule.validate(body.value);
      if (!checked.ok) {
        res.status(400).json({ error: "invalid_value", reason: checked.reason });
        return;
      }
      await repo.setConfigOverride(key, checked.value, req.player.id);
      const report = await reloadConfig(repo);
      res.json({ ok: true, key, value: checked.value, applied: report.applied });
    })
  );
  router.delete(
    "/config/:key",
    asyncHandler(async (req, res) => {
      const key = req.params.key;
      if (!validatorFor(key)) {
        badRequest(res, "unknown_key");
        return;
      }
      await repo.clearConfigOverride(key, req.player.id);
      await reloadConfig(repo);
      res.json({ ok: true, key });
    })
  );
  router.get(
    "/promos",
    asyncHandler(async (_req, res) => {
      res.json(await service.listPromos());
    })
  );
  router.post(
    "/promos",
    asyncHandler(async (req, res) => {
      const body = req.body;
      const code = typeof body.code === "string" ? body.code : "";
      const kind = typeof body.kind === "string" ? body.kind : "money";
      const amount = Number(body.amount ?? 0);
      const limitRaw = body.limit;
      const untilRaw = body.until;
      const result = await service.createPromo({
        code,
        title: typeof body.title === "string" ? body.title : "",
        note: typeof body.note === "string" ? body.note : "",
        kind: ["money", "tickets", "releases", "luck"].includes(kind) ? kind : "money",
        amount: Number.isFinite(amount) ? amount : 0,
        limit: limitRaw === null || limitRaw === void 0 || limitRaw === "" ? null : Number(limitRaw),
        until: typeof untilRaw === "string" && untilRaw.length >= 10 ? untilRaw.slice(0, 10) : null
      });
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.delete(
    "/promos/:code",
    asyncHandler(async (req, res) => {
      const result = await service.deletePromo(String(req.params.code));
      res.status(result.ok ? 200 : 404).json(result);
    })
  );
  router.post(
    "/anonymous",
    asyncHandler(async (req, res) => {
      const raw = req.body.count;
      const count = raw === void 0 ? 1 : Number(raw);
      if (!Number.isFinite(count) || count < 1 || count > ANONYMOUS_MAX_BATCH) {
        res.status(400).json({ error: "bad_count", max: ANONYMOUS_MAX_BATCH });
        return;
      }
      const outcome = await repo.mutate(req.player.id, (state) => {
        const issued = issueAnonymous(state, Math.floor(count));
        return {
          state: issued.state,
          value: {
            ok: issued.ok,
            error: issued.error,
            numbers: issued.numbers.map((number) => ({
              id: number.id,
              display: number.display,
              rarity: number.rarity,
              score: number.score,
              finalPrice: number.finalPrice
            }))
          }
        };
      });
      res.status(outcome.value.ok ? 200 : 400).json(outcome.value);
    })
  );
  router.get(
    "/stats",
    asyncHandler(async (_req, res) => {
      res.json(await repo.stats());
    })
  );
  router.get(
    "/audit",
    asyncHandler(async (_req, res) => {
      const stats = await repo.stats();
      res.json({ entries: stats.recentAudit });
    })
  );
  return router;
}

// src/routes/api.ts
import { Router as Router2 } from "express";

// src/middleware/rate-limit.ts
function createRateLimiter(options) {
  const buckets = /* @__PURE__ */ new Map();
  return (req, res, next) => {
    const key = req.player?.id;
    if (key === void 0) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const now = Date.now();
    const bucket = buckets.get(key) ?? { tokens: options.capacity, updatedAt: now };
    const elapsedMinutes = (now - bucket.updatedAt) / 6e4;
    bucket.tokens = Math.min(
      options.capacity,
      bucket.tokens + elapsedMinutes * options.refillPerMinute
    );
    bucket.updatedAt = now;
    if (bucket.tokens < 1) {
      buckets.set(key, bucket);
      res.status(429).json({ error: "rate_limited", retryAfterSeconds: 1 });
      return;
    }
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    next();
  };
}

// src/routes/api.ts
var TARIFF_IDS = Object.keys(TARIFFS);
var UPGRADE_IDS = UPGRADE_ORDER;
var isTariff = (value) => typeof value === "string" && TARIFF_IDS.includes(value);
var asString = (value) => typeof value === "string" && value.length > 0 && value.length <= 64 ? value : null;
function digitCandidates(digits) {
  const set = /* @__PURE__ */ new Set([digits]);
  for (const country of COUNTRIES) {
    const code = country.code.replace(/\D/g, "");
    if (code.length === 0) continue;
    if (digits.startsWith(code) && digits.length > code.length) {
      set.add(digits.slice(code.length));
    }
    if (!digits.startsWith(code)) set.add(code + digits);
  }
  if (digits.startsWith("8") && digits.length === 11) set.add(`7${digits.slice(1)}`);
  if (digits.startsWith("7") && digits.length === 11) set.add(`8${digits.slice(1)}`);
  return [...set];
}
function createApiRouter(service, repo, env) {
  const router = Router2();
  const releaseLimiter = createRateLimiter({
    capacity: Math.max(5, Math.floor(env.releaseRateLimit / 2)),
    refillPerMinute: env.releaseRateLimit
  });
  router.use(requirePlayer);
  router.get(
    "/state",
    asyncHandler(async (req, res) => {
      const state = await service.getState(req.player.id);
      res.json({
        state,
        summary: service.describe(state),
        // Право администратора определяет сервер по проверенной подписи.
        // Клиент использует это только для показа раздела, не для доступа.
        isAdmin: req.player.isAdmin
      });
    })
  );
  router.get(
    "/chances",
    asyncHandler(async (req, res) => {
      const state = await service.getState(req.player.id);
      const tariffId = isTariff(req.query.tariffId) ? req.query.tariffId : state.selectedTariff;
      res.json(service.chances(tariffId, state.player.luck.multiplier));
    })
  );
  router.post(
    "/release",
    releaseLimiter,
    asyncHandler(async (req, res) => {
      const body = req.body;
      const tariffId = isTariff(body.tariffId) ? body.tariffId : void 0;
      const countryId = body.countryId === null ? null : asString(body.countryId) ?? void 0;
      const releaseId = asString(req.body.releaseId) ?? void 0;
      const result = await service.release(req.player.id, {
        tariffId,
        countryId,
        releaseId
      });
      if (!result.ok) {
        const status = result.error === "duplicate" ? 409 : 400;
        res.status(status).json({ error: result.error, balance: result.balance });
        return;
      }
      res.json(result);
    })
  );
  router.post(
    "/select",
    asyncHandler(async (req, res) => {
      const body = req.body;
      const tariffId = isTariff(body.tariffId) ? body.tariffId : void 0;
      const countryId = body.countryId === null ? null : asString(body.countryId) ?? void 0;
      const operatorId = body.operatorId === null ? null : asString(body.operatorId) ?? void 0;
      const code = body.code === null ? null : asString(body.code) ?? void 0;
      if (tariffId === void 0 && countryId === void 0 && operatorId === void 0 && code === void 0) {
        res.status(400).json({ error: "nothing_to_change" });
        return;
      }
      const result = await service.select(req.player.id, {
        tariffId,
        countryId,
        operatorId,
        code
      });
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.post(
    "/sell-batch",
    asyncHandler(async (req, res) => {
      const raw = req.body.ids;
      if (!Array.isArray(raw) || raw.length === 0) {
        res.status(400).json({ error: "ids_required" });
        return;
      }
      const ids = raw.filter((item) => typeof item === "string");
      if (ids.length === 0 || ids.length > 200) {
        res.status(400).json({ error: "bad_ids" });
        return;
      }
      const outcome = await service.sellBatch(req.player.id, ids);
      res.status(outcome.ok ? 200 : 400).json(outcome);
    })
  );
  router.post(
    "/sell",
    asyncHandler(async (req, res) => {
      const numberId = asString(req.body.numberId);
      if (!numberId) {
        res.status(400).json({ error: "number_required" });
        return;
      }
      const result = await service.sell(req.player.id, numberId);
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.post(
    "/primary",
    asyncHandler(async (req, res) => {
      const numberId = asString(req.body.numberId);
      if (!numberId) {
        res.status(400).json({ error: "number_required" });
        return;
      }
      const result = await service.makePrimary(req.player.id, numberId);
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.get(
    "/digit/forecast",
    asyncHandler(async (req, res) => {
      const numberId = asString(req.query.numberId);
      const index = Number(req.query.index);
      if (!numberId || !Number.isInteger(index)) {
        res.status(400).json({ error: "bad_request" });
        return;
      }
      const result = await service.forecast(req.player.id, numberId, index);
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.post(
    "/digit",
    asyncHandler(async (req, res) => {
      const body = req.body;
      const numberId = asString(body.numberId);
      const index = Number(body.index);
      if (!numberId || !Number.isInteger(index)) {
        res.status(400).json({ error: "bad_request" });
        return;
      }
      const result = await service.changeDigit(req.player.id, numberId, index);
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.get(
    "/upgrades",
    asyncHandler(async (req, res) => {
      const numberId = asString(req.query.numberId);
      if (!numberId) {
        res.status(400).json({ error: "number_required" });
        return;
      }
      const result = await service.upgrades(req.player.id, numberId);
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.post(
    "/upgrade",
    asyncHandler(async (req, res) => {
      const body = req.body;
      const numberId = asString(body.numberId);
      const id = asString(body.id);
      if (!numberId || !id) {
        res.status(400).json({ error: "bad_request" });
        return;
      }
      if (!UPGRADE_IDS.includes(id)) {
        res.status(400).json({ error: "unknown_upgrade" });
        return;
      }
      const index = body.index === void 0 ? void 0 : Number(body.index);
      const a = body.a === void 0 ? void 0 : Number(body.a);
      const b = body.b === void 0 ? void 0 : Number(body.b);
      if ([index, a, b].some((value) => value !== void 0 && !Number.isInteger(value))) {
        res.status(400).json({ error: "bad_index" });
        return;
      }
      const result = await service.upgrade(req.player.id, {
        numberId,
        id,
        index,
        a,
        b,
        // Для смены оператора: сервер проверит, что он из региона номера.
        operatorId: asString(body.operatorId) ?? void 0
      });
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.get(
    "/quests",
    asyncHandler(async (req, res) => {
      res.json(await service.quests(req.player.id));
    })
  );
  router.post(
    "/roulette",
    asyncHandler(async (req, res) => {
      const body = req.body;
      const releaseId = asString(body.releaseId) ?? void 0;
      const wheelId = asString(body.wheelId) ?? null;
      const result = await service.spinRoulette(req.player.id, wheelId, releaseId);
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.post(
    "/promo",
    asyncHandler(async (req, res) => {
      const code = asString(req.body.code);
      if (!code) {
        res.status(400).json({ error: "code_required" });
        return;
      }
      const result = await service.redeemPromo(req.player.id, code);
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.get(
    "/check",
    asyncHandler(async (req, res) => {
      const raw = typeof req.query.number === "string" ? req.query.number : "";
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 6) {
        res.status(400).json({ error: "number_too_long_or_short" });
        return;
      }
      const candidates = digitCandidates(digits);
      const owner = await repo.findNumberOwner(candidates);
      res.json({
        ok: true,
        digits,
        free: owner === null,
        // Имя владельца не раскрываем: игроку достаточно знать, что номер занят.
        checked: candidates.length,
        display: owner ? owner.display : null
      });
    })
  );
  router.get(
    "/tasks",
    asyncHandler(async (req, res) => {
      const state = await service.load(req.player.id);
      res.json({ ok: true, tasks: tasksFor(state), balance: state.player.balance });
    })
  );
  router.post(
    "/task",
    asyncHandler(async (req, res) => {
      const key = asString(req.body.key);
      if (!key) {
        res.status(400).json({ error: "key_required" });
        return;
      }
      const result = await service.claimTask(req.player.id, key);
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.post(
    "/achievement",
    asyncHandler(async (req, res) => {
      const id = asString(req.body.id);
      if (!id) {
        res.status(400).json({ error: "achievement_required" });
        return;
      }
      const result = await service.claimAchievement(req.player.id, id);
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.post(
    "/daily",
    asyncHandler(async (req, res) => {
      const result = await service.claimDaily(req.player.id);
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.post(
    "/bailout",
    asyncHandler(async (req, res) => {
      const result = await service.claimBailout(req.player.id);
      res.status(result.ok ? 200 : 400).json(result);
    })
  );
  router.get(
    "/meta",
    asyncHandler(async (_req, res) => {
      res.json({
        tariffs: Object.values(TARIFFS),
        driver: repo.driver
      });
    })
  );
  return router;
}

// src/routes/internal.ts
import { timingSafeEqual as timingSafeEqual2 } from "node:crypto";
import { Router as Router3 } from "express";
var BOT_SECRET_HEADER = "x-bot-secret";
function secretMatches(expected, provided) {
  if (!provided) return false;
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(provided, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual2(left, right);
}
function createInternalRouter(repo, service, secret) {
  const router = Router3();
  router.use((req, res, next) => {
    if (!secretMatches(secret, req.header(BOT_SECRET_HEADER))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  });
  router.post(
    "/profile",
    asyncHandler(async (req, res) => {
      const raw = req.body.telegramId;
      const telegramId = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(telegramId)) {
        res.status(400).json({ error: "telegram_id_required" });
        return;
      }
      const player = await repo.findPlayerByTelegramId(telegramId);
      if (!player) {
        res.json({ profile: null, reason: "not_playing_yet" });
        return;
      }
      const state = await service.getState(player.id);
      const summary = service.describe(state);
      res.json({
        profile: {
          name: state.player.name,
          level: state.player.level,
          balance: state.player.balance,
          numbers: summary.count,
          portfolio: summary.portfolioValue
        }
      });
    })
  );
  return router;
}

// src/services/game-service.ts
var GameService = class {
  constructor(repo) {
    this.repo = repo;
  }
  async getState(playerId) {
    return this.repo.loadState(playerId);
  }
  /** Состояние для расчётов внутри сервиса. */
  async load(playerId) {
    return this.repo.loadState(playerId);
  }
  /**
   * Награда за задание дня или недели. Прогресс считается по датам выпусков
   * и записям истории, поэтому отдельные счётчики не нужны.
   */
  async claimTask(playerId, key) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = claimTask(state, key);
      return {
        state: result.state,
        value: {
          ok: result.ok,
          error: result.error,
          amount: result.amount,
          balance: result.state.player.balance
        }
      };
    });
    return outcome.value;
  }
  /** Распределение категорий для витрины. Считается тем же кодом, что и выпадение. */
  chances(tariffId, luck) {
    const odds = distributionFor(tariffId, luck);
    return {
      tariffId,
      luck,
      odds,
      rareAndAbove: rarePlusShare(tariffId, luck),
      categories: Object.keys(RARITIES).map((rarity) => ({
        id: rarity,
        name: RARITIES[rarity].name,
        color: RARITIES[rarity].color,
        basePrice: RARITIES[rarity].basePrice,
        percent: odds[rarity]
      }))
    };
  }
  /**
   * Выпуск SIM. Двойная защита от повторного списания:
   * 1) предварительная проверка release_id в таблице выпусков;
   * 2) проверка processedReleaseIds внутри самого движка, уже под блокировкой строки.
   */
  async release(playerId, input) {
    const releaseId = input.releaseId && input.releaseId.length <= 64 ? input.releaseId : createId("rel");
    if (await this.repo.releaseExists(releaseId)) {
      const state = await this.repo.loadState(playerId);
      return {
        ok: false,
        error: "duplicate",
        balance: state.player.balance,
        odds: distributionFor(state.selectedTariff, 1)
      };
    }
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = release(state, {
        tariffId: input.tariffId,
        countryId: input.countryId,
        releaseId
      });
      return {
        state: result.state,
        value: {
          ok: result.ok,
          number: result.number ?? void 0,
          error: result.error
        }
      };
    });
    return {
      ...outcome.value,
      balance: outcome.state.player.balance,
      odds: distributionFor(outcome.state.selectedTariff, 1)
    };
  }
  async sell(playerId, numberId) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = sellNumber(state, numberId);
      return {
        state: result.state,
        value: { ok: result.ok, error: result.error }
      };
    });
    return outcome.value;
  }
  /**
   * Погасить промокод.
   *
   * Общий тираж берём из хранилища: он считается по всем игрокам, а не по
   * одному. Засчитываем погашение только после успешной выдачи награды.
   */
  async redeemPromo(playerId, code) {
    const custom = await this.repo.promoList();
    const all = [...PROMO_CODES, ...custom];
    const promo = findPromo(code, all);
    if (!promo) {
      return { ok: false, error: "not_found", gained: "" };
    }
    const usedTotal = await this.repo.promoUses(normalizePromo(promo.code));
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = redeemPromo(state, code, usedTotal, /* @__PURE__ */ new Date(), all);
      return {
        state: result.state,
        value: {
          ok: result.ok,
          error: result.error,
          gained: result.gained,
          title: result.promo?.title ?? null,
          note: result.promo?.note ?? null,
          balance: result.state.player.balance
        }
      };
    });
    if (outcome.value.ok) {
      await this.repo.addPromoUse(normalizePromo(promo.code));
    }
    return outcome.value;
  }
  /* ─────────────────────────── ПРОМОКОДЫ: АДМИНКА ─────────────────────────── */
  /** Список кодов: зашитые в игру и созданные в админке. */
  async listPromos() {
    const custom = await this.repo.promoList();
    const usedMap = /* @__PURE__ */ new Map();
    for (const promo of [...PROMO_CODES, ...custom]) {
      const key = normalizePromo(promo.code);
      usedMap.set(key, await this.repo.promoUses(key));
    }
    const describe = (promo) => ({
      code: promo.code,
      title: promo.title,
      note: promo.note,
      kind: promo.reward.kind,
      reward: promoRewardText(promo),
      limit: promo.limit,
      until: promo.until,
      custom: promo.custom === true,
      used: usedMap.get(normalizePromo(promo.code)) ?? 0
    });
    return {
      builtin: PROMO_CODES.map(describe),
      custom: custom.map(describe)
    };
  }
  /** Создать промокод. Код латиницей, регистр не важен. */
  async createPromo(input) {
    const problem = validatePromoCode(input.code);
    if (problem) return { ok: false, error: problem };
    const code = normalizePromo(input.code);
    const all = [...PROMO_CODES, ...await this.repo.promoList()];
    if (all.some((promo2) => normalizePromo(promo2.code) === code)) {
      return { ok: false, error: "\u0422\u0430\u043A\u043E\u0439 \u043A\u043E\u0434 \u0443\u0436\u0435 \u0435\u0441\u0442\u044C" };
    }
    const amount = Math.max(1, Math.floor(input.amount || 1));
    const reward = input.kind === "money" ? { kind: "money", amount } : input.kind === "tickets" ? { kind: "tickets", count: amount } : input.kind === "releases" ? { kind: "releases", count: amount } : { kind: "luck", multiplier: amount, spins: 3 };
    const promo = {
      code,
      title: input.title.trim() || code,
      note: input.note.trim(),
      reward,
      limit: input.limit === null || input.limit <= 0 ? null : Math.floor(input.limit),
      until: input.until,
      custom: true
    };
    await this.repo.createPromo(promo);
    await this.repo.recordAudit(null, "promo.create", promo);
    return { ok: true, promo: { ...promo, reward: promoRewardText(promo) } };
  }
  /** Удалить свой промокод. Зашитые в игру удалить нельзя. */
  async deletePromo(code) {
    const removed = await this.repo.deletePromo(code);
    if (removed) await this.repo.recordAudit(null, "promo.delete", { code });
    return {
      ok: removed,
      error: removed ? void 0 : "\u041A\u043E\u0434 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0438\u043B\u0438 \u043E\u043D \u0437\u0430\u0448\u0438\u0442 \u0432 \u0438\u0433\u0440\u0443"
    };
  }
  /** Прокрут рулетки: приз выбирается по весам из общего ядра. */
  async spinRoulette(playerId, wheelId, releaseId) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = spinRoulette(state, { wheelId, releaseId });
      return {
        state: result.state,
        value: {
          ok: result.ok,
          error: result.error,
          wheelId: result.wheelId,
          index: result.index,
          spent: result.spent,
          gained: result.gained,
          prize: result.prize ? {
            id: result.prize.id,
            kind: result.prize.kind,
            label: result.prize.label,
            title: result.prize.title,
            chance: result.prize.chance,
            color: result.prize.color,
            // Поля эффекта тоже отдаём: без них клиенту нечего показать,
            // и в подписи печаталось «удача ×undefined».
            amount: result.prize.amount ?? null,
            releases: result.prize.releases ?? null,
            multiplier: result.prize.multiplier ?? null,
            spins: result.prize.spins ?? null
          } : null,
          balance: result.state.player.balance,
          freeReleases: result.state.player.freeReleases,
          luck: result.state.player.luck
        }
      };
    });
    return outcome.value;
  }
  /** Продажа пачки: коллекция чистится за один заход. */
  async sellBatch(playerId, ids) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = sellMany(state, ids);
      return {
        state: result.state,
        value: {
          ok: result.ok,
          sold: result.sold,
          total: result.total,
          skipped: result.skipped
        }
      };
    });
    return outcome.value;
  }
  async makePrimary(playerId, numberId) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = setPrimaryNumber(state, numberId);
      return {
        state: result.state,
        value: { ok: result.ok, error: result.error }
      };
    });
    return outcome.value;
  }
  async changeDigit(playerId, numberId, index) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = changeDigit(state, numberId, index);
      return {
        state: result.state,
        value: {
          ok: result.ok,
          error: result.error,
          number: result.number ?? void 0
        }
      };
    });
    return outcome.value;
  }
  /**
   * Награда за достижение. Условие проверяется по состоянию игрока: закрытое
   * достижение нельзя получить дважды, незакрытое — вообще.
   */
  async claimAchievement(playerId, achievementId) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = claimAchievement(state, achievementId);
      return {
        state: result.state,
        value: {
          ok: result.ok,
          error: result.error,
          amount: result.amount,
          balance: result.state.player.balance
        }
      };
    });
    return outcome.value;
  }
  /** Сводка по заданиям: что закрыто, что можно забрать, что уже забрано. */
  async quests(playerId) {
    const state = await this.repo.loadState(playerId);
    return {
      ok: true,
      balance: state.player.balance,
      dailyAvailable: dailyAvailable(state),
      dailyReward: dailyReward(state),
      streak: state.player.dailyStreak,
      achievements: ACHIEVEMENTS.map((achievement) => ({
        id: achievement.id,
        title: achievement.title,
        hint: achievement.hint,
        target: achievement.target,
        reward: achievement.reward,
        progress: Math.min(achievement.progress(state), achievement.target),
        unlocked: achievement.progress(state) >= achievement.target,
        claimed: state.claimedAchievements.includes(achievement.id),
        label: progressLabel(achievement, state)
      }))
    };
  }
  async claimDaily(playerId) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = claimDaily(state);
      return {
        state: result.state,
        value: { ok: result.ok, amount: result.amount, streak: result.state.player.dailyStreak }
      };
    });
    return outcome.value;
  }
  async claimBailout(playerId) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = claimBailout(state);
      return {
        state: result.state,
        value: { ok: result.ok, balance: result.state.player.balance }
      };
    });
    return outcome.value;
  }
  /** Выбор тарифа и региона. Валюту не списывает — только сохраняет намерение. */
  async select(playerId, input) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const tariffId = input.tariffId ?? state.selectedTariff;
      if (!TARIFFS[tariffId]) {
        return { state, value: { ok: false, error: "bad_tariff" } };
      }
      const countryId = input.countryId === void 0 ? state.selectedCountry : input.countryId;
      if (countryId !== null && !COUNTRIES.some((country) => country.id === countryId)) {
        return { state, value: { ok: false, error: "bad_country" } };
      }
      let operatorId = input.operatorId === void 0 ? state.selectedOperator : input.operatorId;
      if (operatorId !== null) {
        if (countryId === null) {
          return { state, value: { ok: false, error: "bad_country" } };
        }
        const pool2 = brandedOperators(countryId);
        if (!pool2.some((operator) => operator.id === operatorId)) {
          operatorId = null;
        }
      }
      let code = input.code === void 0 ? state.selectedCode : input.code;
      if (code !== null) {
        const operator = operatorId ? brandedOperators(countryId ?? "").find((item) => item.id === operatorId) : void 0;
        if (!operator || !operator.codes.includes(code)) code = null;
      }
      if (operatorId === null) code = null;
      return {
        state: {
          ...state,
          selectedTariff: tariffId,
          selectedCountry: countryId,
          selectedOperator: operatorId,
          selectedCode: code
        },
        value: {
          ok: true,
          // Возвращаем то, что реально записали: клиент применит это у себя,
          // и надпись сверху не разойдётся с состоянием на сервере.
          selection: {
            tariffId,
            countryId,
            operatorId,
            code
          }
        }
      };
    });
    return outcome.value;
  }
  /** Прогноз замены цифры: считает сервер, клиент только показывает. */
  async forecast(playerId, numberId, index) {
    const state = await this.repo.loadState(playerId);
    const number = state.numbers.find((item) => item.id === numberId);
    if (!number) return { ok: false, error: "not_found" };
    if (index < 0 || index >= number.digits.length) {
      return { ok: false, error: "bad_index" };
    }
    return { ok: true, forecast: forecastDigitChange(number, index) };
  }
  /**
   * Витрина улучшений для конкретного номера: что можно сделать, сколько стоит
   * и хватает ли средств. Цены считает сервер — клиент их только показывает.
   */
  async upgrades(playerId, numberId) {
    const state = await this.repo.loadState(playerId);
    const number = state.numbers.find((item) => item.id === numberId);
    if (!number) return { ok: false, error: "not_found" };
    return {
      ok: true,
      balance: state.player.balance,
      number,
      offers: upgradeOffers(state, numberId)
    };
  }
  /** Применение улучшения. Списание и пересчёт — на сервере, под блокировкой игрока. */
  async upgrade(playerId, input) {
    const outcome = await this.repo.mutate(playerId, (state) => {
      const result = applyUpgrade(state, input.numberId, input.id, {
        index: input.index,
        a: input.a,
        b: input.b,
        operatorId: input.operatorId
      });
      return {
        state: result.state,
        value: {
          ok: result.ok,
          error: result.error,
          number: result.number ?? void 0,
          balance: result.state.player.balance
        }
      };
    });
    return outcome.value;
  }
  /** Сводка по коллекции: используется профилем и админ-статистикой. */
  describe(state) {
    const byRarity = {};
    let value = 0;
    for (const number of state.numbers) {
      byRarity[number.rarity] = (byRarity[number.rarity] ?? 0) + 1;
      value += number.finalPrice;
    }
    return {
      count: state.numbers.length,
      slots: state.slots,
      portfolioValue: value,
      byRarity,
      cost: tariffCost(state.selectedTariff)
    };
  }
};

// src/app.ts
function createApp(repo, env) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use(
    cors({
      // Пустой список означает разработку: пускаем всё, но без передачи cookie.
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
      allowedHeaders: ["Content-Type", "X-Telegram-Init-Data", "X-Dev-User"],
      methods: ["GET", "POST", "PUT", "OPTIONS"],
      credentials: false
    })
  );
  app.get("/health", (_req, res) => {
    res.json({ ok: true, driver: repo.driver, env: env.nodeEnv });
  });
  const service = new GameService(repo);
  const auth = createAuthMiddleware(repo, env);
  if (env.botInternalSecret) {
    app.use("/internal", createInternalRouter(repo, service, env.botInternalSecret));
  }
  app.use("/api", auth);
  app.use("/api", createApiRouter(service, repo, env));
  app.use("/api/admin", createAdminRouter(repo, service));
  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });
  app.use(createErrorHandler(repo));
  return app;
}

// src/db/pool.ts
import pg from "pg";

// src/db/schema.sql
var schema_default = "-- language: SQL, file: backend/src/db/schema.sql\n-- \u0421\u0445\u0435\u043C\u0430 \u0431\u0430\u0437\u044B. \u041D\u043E\u043C\u0435\u0440\u0430 \u0438 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u043B\u0435\u0436\u0430\u0442 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C\u0438 \u0442\u0430\u0431\u043B\u0438\u0446\u0430\u043C\u0438, \u0430 \u043D\u0435 \u043E\u0434\u043D\u0438\u043C JSON:\n-- \u0442\u0430\u043A \u043F\u0440\u0430\u0432\u043E \u0432\u043B\u0430\u0434\u0435\u043D\u0438\u044F \u0438 \u0437\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0434\u0432\u043E\u0439\u043D\u043E\u0439 \u043F\u0440\u043E\u0434\u0430\u0436\u0438 \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u043A\u043B\u044E\u0447\u0430\u043C\u0438 \u0411\u0414.\n\nCREATE TABLE IF NOT EXISTS players (\n  id              BIGSERIAL PRIMARY KEY,\n  telegram_id     BIGINT NOT NULL UNIQUE,\n  name            TEXT NOT NULL,\n  username        TEXT,\n  avatar_url      TEXT,\n  balance         BIGINT NOT NULL DEFAULT 99800,\n  tickets         INTEGER NOT NULL DEFAULT 1,\n  level           INTEGER NOT NULL DEFAULT 1,\n  xp              INTEGER NOT NULL DEFAULT 0,\n  primary_number_id TEXT,\n  free_primary_swaps INTEGER NOT NULL DEFAULT 3,\n  daily_streak    INTEGER NOT NULL DEFAULT 1,\n  luck_multiplier NUMERIC(6,2) NOT NULL DEFAULT 2,\n  luck_expires_at TIMESTAMPTZ,\n  selected_tariff TEXT NOT NULL DEFAULT 'standard',\n  selected_country TEXT,\n  is_banned       BOOLEAN NOT NULL DEFAULT FALSE,\n  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),\n  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),\n  -- \u041E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0431\u0430\u043B\u0430\u043D\u0441 \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D \u043D\u0430 \u0443\u0440\u043E\u0432\u043D\u0435 \u0441\u0445\u0435\u043C\u044B, \u0430 \u043D\u0435 \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u0434\u043E\u043C.\n  CONSTRAINT players_balance_non_negative CHECK (balance >= 0),\n  CONSTRAINT players_level_positive CHECK (level >= 1)\n);\n\n-- \u0416\u0443\u0440\u043D\u0430\u043B \u0432\u044B\u043F\u0443\u0441\u043A\u043E\u0432. \u041F\u0435\u0440\u0432\u0438\u0447\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 release_id \u2014 \u0436\u0451\u0441\u0442\u043A\u0430\u044F \u0437\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0433\u043E\n-- \u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044F \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u0438 \u0442\u043E\u043C\u0443 \u0436\u0435 \u0437\u0430\u043F\u0440\u043E\u0441\u0443, \u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u043E\u043D \u043F\u0440\u0438\u0434\u0451\u0442 \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0434\u0432\u0430\u0436\u0434\u044B.\nCREATE TABLE IF NOT EXISTS releases (\n  release_id  TEXT PRIMARY KEY,\n  player_id   BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,\n  number_id   TEXT NOT NULL,\n  tariff_id   TEXT NOT NULL,\n  country_id  TEXT NOT NULL,\n  cost        BIGINT NOT NULL,\n  tickets     INTEGER NOT NULL DEFAULT 0,\n  rarity      TEXT NOT NULL,\n  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nCREATE INDEX IF NOT EXISTS releases_player_idx ON releases (player_id, created_at DESC);\n\nCREATE TABLE IF NOT EXISTS numbers (\n  id                 TEXT PRIMARY KEY,\n  player_id          BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,\n  release_id         TEXT NOT NULL REFERENCES releases(release_id) ON DELETE CASCADE,\n  display            TEXT NOT NULL,\n  digits             TEXT NOT NULL,\n  country_id         TEXT NOT NULL,\n  region_code        TEXT NOT NULL,\n  operator_id        TEXT NOT NULL,\n  tariff_id          TEXT NOT NULL,\n  rarity             TEXT NOT NULL,\n  base_price         BIGINT NOT NULL,\n  pattern_multiplier NUMERIC(8,2) NOT NULL,\n  demand_multiplier  NUMERIC(8,2) NOT NULL,\n  final_price        BIGINT NOT NULL,\n  score              INTEGER NOT NULL,\n  patterns           JSONB NOT NULL DEFAULT '[]'::jsonb,\n  limited_edition    INTEGER,\n  issued_at          TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nCREATE INDEX IF NOT EXISTS numbers_player_idx ON numbers (player_id, issued_at DESC);\nCREATE INDEX IF NOT EXISTS numbers_rarity_idx ON numbers (rarity);\n\nCREATE TABLE IF NOT EXISTS ledger (\n  id         TEXT PRIMARY KEY,\n  player_id  BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,\n  kind       TEXT NOT NULL,\n  amount     BIGINT NOT NULL,\n  label      TEXT NOT NULL,\n  number_id  TEXT,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nCREATE INDEX IF NOT EXISTS ledger_player_idx ON ledger (player_id, created_at DESC);\n\n-- \u041F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u0438\u0433\u0440\u043E\u0432\u044B\u0445 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432 \u0438\u0437 \u0430\u0434\u043C\u0438\u043D-\u043F\u0430\u043D\u0435\u043B\u0438.\nCREATE TABLE IF NOT EXISTS game_config (\n  key        TEXT PRIMARY KEY,\n  value      JSONB NOT NULL,\n  updated_by BIGINT,\n  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- \u0416\u0443\u0440\u043D\u0430\u043B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u0432 \u0438 \u043E\u0448\u0438\u0431\u043E\u043A \u0441\u0435\u0440\u0432\u0435\u0440\u0430.\nCREATE TABLE IF NOT EXISTS audit_log (\n  id         BIGSERIAL PRIMARY KEY,\n  actor_id   BIGINT,\n  action     TEXT NOT NULL,\n  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nCREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);\n\n-- \u0423\u0447\u0451\u0442 \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u0439: \u043A\u0430\u043A\u0438\u0435 \u0444\u0430\u0439\u043B\u044B \u0443\u0436\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u044B.\nCREATE TABLE IF NOT EXISTS schema_migrations (\n  name       TEXT PRIMARY KEY,\n  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- \u0414\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F, \u0437\u0430 \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u0430\u0433\u0440\u0430\u0434\u0430 \u0443\u0436\u0435 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0430.\n-- ALTER, \u0430 \u043D\u0435 CREATE: \u0443 \u0443\u0436\u0435 \u0440\u0430\u0437\u0432\u0451\u0440\u043D\u0443\u0442\u043E\u0439 \u0431\u0430\u0437\u044B \u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442, \u0438 \u043A\u043E\u043B\u043E\u043D\u043A\u0443\n-- \u043D\u0443\u0436\u043D\u043E \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A \u043D\u0435\u0439. \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u0438\u0434\u0435\u043C\u043F\u043E\u0442\u0435\u043D\u0442\u0435\u043D, \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u0435\u043D.\nALTER TABLE players\n  ADD COLUMN IF NOT EXISTS claimed_achievements TEXT[] NOT NULL DEFAULT '{}';\n\n-- \u0412\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u0438 \u043A\u043E\u0434: \u0441 \u043D\u0438\u043C\u0438 \u0432\u044B\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u043D\u043E\u043C\u0435\u0440.\nALTER TABLE players ADD COLUMN IF NOT EXISTS selected_operator TEXT;\nALTER TABLE players ADD COLUMN IF NOT EXISTS selected_code TEXT;\n\n-- \u041F\u0440\u0438\u0437\u044B \u0440\u0443\u043B\u0435\u0442\u043A\u0438: \u0443\u0434\u0430\u0447\u0430 \u043F\u043E \u043A\u0440\u0443\u0442\u043A\u0430\u043C \u0438 \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0435 \u0432\u044B\u043F\u0443\u0441\u043A\u0438.\nALTER TABLE players ADD COLUMN IF NOT EXISTS luck_spins INT NOT NULL DEFAULT 0;\nALTER TABLE players ADD COLUMN IF NOT EXISTS free_releases INT NOT NULL DEFAULT 0;\n\n-- \u041F\u043E\u0433\u0430\u0448\u0435\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u043C\u043E\u043A\u043E\u0434\u044B \u0438\u0433\u0440\u043E\u043A\u0430: \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u0442\u043E\u0442 \u0436\u0435 \u043A\u043E\u0434 \u043D\u0435 \u0441\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442.\nALTER TABLE players ADD COLUMN IF NOT EXISTS used_promo_codes TEXT[] NOT NULL DEFAULT '{}';\n\n-- \u041E\u0431\u0449\u0438\u0439 \u0442\u0438\u0440\u0430\u0436 \u043F\u0440\u043E\u043C\u043E\u043A\u043E\u0434\u043E\u0432. \u0421\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043E\u0442 \u0438\u0433\u0440\u043E\u043A\u043E\u0432: \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u043E\u0431\u0449\u0435\u0435\n-- \u0434\u043B\u044F \u0432\u0441\u0435\u0445, \u0430 \u043D\u0435 \xAB\u043F\u043E \u0440\u0430\u0437\u0443 \u043A\u0430\u0436\u0434\u043E\u043C\u0443\xBB.\nCREATE TABLE IF NOT EXISTS promo_uses (\n  code TEXT PRIMARY KEY,\n  uses INT NOT NULL DEFAULT 0\n);\n\r\n-- \u041F\u0440\u043E\u043C\u043E\u043A\u043E\u0434\u044B, \u0441\u043E\u0437\u0434\u0430\u043D\u043D\u044B\u0435 \u0432 \u0430\u0434\u043C\u0438\u043D\u043A\u0435. \u0425\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043E\u0442 \u0437\u0430\u0448\u0438\u0442\u044B\u0445 \u0432 \u0438\u0433\u0440\u0443.\r\nCREATE TABLE IF NOT EXISTS custom_promos (\r\n  code       TEXT PRIMARY KEY,\r\n  title      TEXT NOT NULL,\r\n  note       TEXT NOT NULL DEFAULT '',\r\n  kind       TEXT NOT NULL,\r\n  amount     INTEGER NOT NULL DEFAULT 0,\r\n  max_uses   INTEGER,\r\n  until      DATE,\r\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\r\n);\r\n";

// src/db/pool.ts
var { Pool } = pg;
var pool = null;
function getPool(connectionString) {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 8e3,
      // Деньги и очки храним целыми: BIGINT приходит строкой, поэтому приводим сами.
      application_name: "ciferki-backend"
    });
    pool.on("error", (error) => {
      console.error("[db] \u043E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u043E\u0441\u0442\u0430\u0438\u0432\u0430\u044E\u0449\u0435\u0433\u043E \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F:", error.message);
    });
  }
  return pool;
}
async function closePool() {
  if (!pool) return;
  const active = pool;
  pool = null;
  await active.end();
}
async function applySchema(db) {
  await db.query(schema_default);
}
async function pingDatabase(db) {
  await db.query("SELECT 1");
}

// src/env.ts
function readInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
function readList(value) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}
function loadEnv(source = process.env) {
  const nodeEnv = source.NODE_ENV ?? "development";
  const botToken = source.BOT_TOKEN ?? "";
  const allowDevAuth = source.ALLOW_DEV_AUTH === "1" && nodeEnv !== "production";
  const problems = [];
  if (nodeEnv === "production" && !botToken) {
    problems.push("BOT_TOKEN \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D \u0432 \u043F\u0440\u043E\u0434\u0430\u043A\u0448\u0435\u043D\u0435: \u0431\u0435\u0437 \u043D\u0435\u0433\u043E \u043D\u0435\u043B\u044C\u0437\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u043E\u0434\u043F\u0438\u0441\u044C Telegram");
  }
  if (nodeEnv === "production" && !source.DATABASE_URL) {
    problems.push("DATABASE_URL \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D \u0432 \u043F\u0440\u043E\u0434\u0430\u043A\u0448\u0435\u043D\u0435: \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u0432 \u043F\u0430\u043C\u044F\u0442\u0438 \u0442\u0435\u0440\u044F\u0435\u0442 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441");
  }
  if (problems.length > 0) {
    throw new Error(`\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044F:
- ${problems.join("\n- ")}`);
  }
  return {
    nodeEnv,
    port: readInt(source.PORT, 8080),
    databaseUrl: source.DATABASE_URL ?? null,
    botToken,
    webappUrl: source.WEBAPP_URL ?? "http://127.0.0.1:5173",
    corsOrigins: readList(source.CORS_ORIGINS),
    adminTelegramIds: readList(source.ADMIN_TELEGRAM_IDS).map(Number).filter(Number.isFinite),
    botInternalSecret: source.BOT_INTERNAL_SECRET ?? null,
    releaseRateLimit: readInt(source.RELEASE_RATE_LIMIT, 60),
    allowDevAuth
  };
}

// src/repository/memory.ts
var MemoryRepository = class {
  driver = "memory";
  players = /* @__PURE__ */ new Map();
  byTelegram = /* @__PURE__ */ new Map();
  releases = /* @__PURE__ */ new Set();
  audit = [];
  overrides = {};
  /** Общий тираж промокодов: сколько раз какой код погасили. */
  promoUses_ = /* @__PURE__ */ new Map();
  /** Промокоды, созданные в админке. */
  promos_ = /* @__PURE__ */ new Map();
  nextId = 1;
  nextAuditId = 1;
  async init() {
    console.warn(
      "[repo] DATABASE_URL \u043D\u0435 \u0437\u0430\u0434\u0430\u043D \u2014 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u0432 \u043F\u0430\u043C\u044F\u0442\u0438. \u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u043D\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F \u043C\u0435\u0436\u0434\u0443 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043C\u0438."
    );
  }
  async close() {
    this.players.clear();
  }
  async getOrCreatePlayer(user, admin) {
    const existingId = this.byTelegram.get(user.id);
    if (existingId !== void 0) {
      const entry = this.players.get(existingId);
      if (entry) {
        entry.row.isAdmin = admin;
        return entry.row;
      }
    }
    const id = this.nextId;
    this.nextId += 1;
    const row = {
      id,
      telegramId: user.id,
      name: displayName(user),
      username: user.username ?? null,
      avatarUrl: user.photo_url ?? null,
      isBanned: false,
      isAdmin: admin
    };
    const state = createInitialState({
      id: String(id),
      name: row.name,
      avatarUrl: row.avatarUrl
    });
    this.players.set(id, { row, state });
    this.byTelegram.set(user.id, id);
    return row;
  }
  async getPlayerById(playerId) {
    return this.players.get(playerId)?.row ?? null;
  }
  async findPlayerByTelegramId(telegramId) {
    const playerId = this.byTelegram.get(telegramId);
    if (playerId === void 0) return null;
    return this.players.get(playerId)?.row ?? null;
  }
  async loadState(playerId) {
    const entry = this.players.get(playerId);
    if (!entry) throw new Error(`\u0418\u0433\u0440\u043E\u043A ${playerId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D`);
    return structuredClone(entry.state);
  }
  async mutate(playerId, work) {
    const entry = this.players.get(playerId);
    if (!entry) throw new Error(`\u0418\u0433\u0440\u043E\u043A ${playerId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D`);
    const outcome = work(entry.state);
    if (outcome.state !== entry.state) {
      for (const number of outcome.state.numbers) {
        this.releases.add(number.releaseId);
      }
      entry.state = outcome.state;
    }
    return outcome;
  }
  async releaseExists(releaseId) {
    return this.releases.has(releaseId);
  }
  async recordAudit(actorId, action, payload) {
    this.audit.unshift({
      id: this.nextAuditId,
      actorId,
      action,
      payload,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.nextAuditId += 1;
    if (this.audit.length > 500) this.audit.length = 500;
  }
  async findNumberOwner(candidates) {
    const wanted = new Set(candidates);
    for (const entry of this.players.values()) {
      const found = entry.state.numbers.find((number) => wanted.has(number.digits));
      if (found) {
        return { playerName: entry.row.name, display: found.display };
      }
    }
    return null;
  }
  async promoUses(code) {
    return this.promoUses_.get(code) ?? 0;
  }
  async addPromoUse(code) {
    this.promoUses_.set(code, (this.promoUses_.get(code) ?? 0) + 1);
  }
  async promoList() {
    return [...this.promos_.values()];
  }
  async createPromo(promo) {
    this.promos_.set(normalizePromo(promo.code), { ...promo, code: normalizePromo(promo.code), custom: true });
  }
  async deletePromo(code) {
    return this.promos_.delete(normalizePromo(code));
  }
  async stats() {
    const byRarity = {};
    let numbers = 0;
    let releases = 0;
    let priceSum = 0;
    let portfolioValue = 0;
    for (const entry of this.players.values()) {
      for (const number of entry.state.numbers) {
        numbers += 1;
        priceSum += number.finalPrice;
        portfolioValue += number.finalPrice;
        byRarity[number.rarity] = (byRarity[number.rarity] ?? 0) + 1;
      }
      releases += entry.state.processedReleaseIds.length;
    }
    return {
      players: this.players.size,
      numbers,
      releases,
      byRarity,
      averagePrice: numbers > 0 ? Math.round(priceSum / numbers) : 0,
      portfolioValue,
      recentAudit: this.audit.slice(0, 50)
    };
  }
  async getConfigOverrides() {
    return { ...this.overrides };
  }
  async setConfigOverride(key, value, actorId) {
    this.overrides[key] = value;
    await this.recordAudit(actorId, "config.set", { key, value });
  }
  async clearConfigOverride(key, actorId) {
    delete this.overrides[key];
    await this.recordAudit(actorId, "config.clear", { key });
  }
};
function displayName(user) {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return user.username ?? `\u0418\u0433\u0440\u043E\u043A ${user.id}`;
}

// src/repository/postgres.ts
var PostgresRepository = class {
  constructor(pool2) {
    this.pool = pool2;
  }
  driver = "postgres";
  async init() {
    await pingDatabase(this.pool);
    await applySchema(this.pool);
  }
  async close() {
  }
  async getOrCreatePlayer(user, admin) {
    const name = displayName2(user);
    const inserted = await this.pool.query(
      `INSERT INTO players (telegram_id, name, username, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (telegram_id) DO UPDATE
         SET name = EXCLUDED.name,
             username = EXCLUDED.username,
             avatar_url = EXCLUDED.avatar_url,
             updated_at = now()
       RETURNING *`,
      [user.id, name, user.username ?? null, user.photo_url ?? null]
    );
    return mapPlayerRow(inserted.rows[0], admin);
  }
  async getPlayerById(playerId) {
    const result = await this.pool.query("SELECT * FROM players WHERE id = $1", [
      playerId
    ]);
    return result.rowCount === 0 ? null : mapPlayerRow(result.rows[0], false);
  }
  async findPlayerByTelegramId(telegramId) {
    const result = await this.pool.query(
      "SELECT * FROM players WHERE telegram_id = $1",
      [telegramId]
    );
    return result.rowCount === 0 ? null : mapPlayerRow(result.rows[0], false);
  }
  async loadState(playerId) {
    const client = await this.pool.connect();
    try {
      const player = await client.query("SELECT * FROM players WHERE id = $1", [
        playerId
      ]);
      if (player.rowCount === 0) throw new Error(`\u0418\u0433\u0440\u043E\u043A ${playerId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D`);
      return await this.readState(client, player.rows[0]);
    } finally {
      client.release();
    }
  }
  async mutate(playerId, work) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const player = await client.query(
        "SELECT * FROM players WHERE id = $1 FOR UPDATE",
        [playerId]
      );
      if (player.rowCount === 0) throw new Error(`\u0418\u0433\u0440\u043E\u043A ${playerId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D`);
      const state = await this.readState(client, player.rows[0]);
      const loadedNumbers = new Map(state.numbers.map((number) => [number.id, number]));
      const loadedLedger = new Set(state.ledger.map((entry) => entry.id));
      const outcome = work(state);
      if (outcome.state !== state) {
        await this.writeState(client, playerId, outcome.state, loadedNumbers, loadedLedger);
      }
      await client.query("COMMIT");
      return outcome;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async releaseExists(releaseId) {
    const result = await this.pool.query("SELECT 1 FROM releases WHERE release_id = $1", [
      releaseId
    ]);
    return (result.rowCount ?? 0) > 0;
  }
  async recordAudit(actorId, action, payload) {
    await this.pool.query(
      "INSERT INTO audit_log (actor_id, action, payload) VALUES ($1, $2, $3)",
      [actorId, action, JSON.stringify(payload ?? {})]
    );
  }
  async findNumberOwner(candidates) {
    const result = await this.pool.query(
      `SELECT p.name, n.display
         FROM numbers n
         JOIN players p ON p.id = n.player_id
        WHERE n.digits = ANY($1)
        LIMIT 1`,
      [candidates]
    );
    const row = result.rows[0];
    return row ? { playerName: row.name, display: row.display } : null;
  }
  async promoList() {
    const result = await this.pool.query("SELECT * FROM custom_promos ORDER BY created_at DESC");
    return result.rows.map((row) => ({
      code: row.code,
      title: row.title,
      note: row.note,
      // Вид награды собираем обратно в тот же вид, что и у зашитых кодов.
      reward: row.kind === "money" ? { kind: "money", amount: row.amount } : row.kind === "tickets" ? { kind: "tickets", count: row.amount } : row.kind === "releases" ? { kind: "releases", count: row.amount } : { kind: "luck", multiplier: row.amount, spins: 3 },
      limit: row.max_uses,
      until: row.until ? new Date(row.until).toISOString().slice(0, 10) : null,
      custom: true
    }));
  }
  async createPromo(promo) {
    const reward = promo.reward;
    const amount = reward.kind === "money" ? reward.amount : reward.kind === "tickets" ? reward.count : reward.kind === "releases" ? reward.count : reward.multiplier;
    await this.pool.query(
      `INSERT INTO custom_promos (code, title, note, kind, amount, max_uses, until)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (code) DO UPDATE
         SET title = $2, note = $3, kind = $4, amount = $5, max_uses = $6, until = $7`,
      [normalizePromo(promo.code), promo.title, promo.note, reward.kind, amount, promo.limit, promo.until]
    );
  }
  async deletePromo(code) {
    const result = await this.pool.query("DELETE FROM custom_promos WHERE code = $1", [
      normalizePromo(code)
    ]);
    return (result.rowCount ?? 0) > 0;
  }
  async promoUses(code) {
    const result = await this.pool.query(
      "SELECT uses FROM promo_uses WHERE code = $1",
      [code]
    );
    return result.rows[0]?.uses ?? 0;
  }
  async addPromoUse(code) {
    await this.pool.query(
      `INSERT INTO promo_uses (code, uses) VALUES ($1, 1)
       ON CONFLICT (code) DO UPDATE SET uses = promo_uses.uses + 1`,
      [code]
    );
  }
  async stats() {
    const [players, numbers, releases, rarity, audit] = await Promise.all([
      this.pool.query("SELECT count(*)::text AS count FROM players"),
      this.pool.query(
        "SELECT count(*)::text AS count, avg(final_price)::text AS avg, sum(final_price)::text AS total FROM numbers"
      ),
      this.pool.query("SELECT count(*)::text AS count FROM releases"),
      this.pool.query(
        "SELECT rarity, count(*)::text AS count FROM numbers GROUP BY rarity"
      ),
      this.pool.query(
        "SELECT id, actor_id, action, payload, created_at FROM audit_log ORDER BY id DESC LIMIT 50"
      )
    ]);
    const byRarity = {};
    for (const row of rarity.rows) byRarity[row.rarity] = Number(row.count);
    return {
      players: Number(players.rows[0]?.count ?? 0),
      numbers: Number(numbers.rows[0]?.count ?? 0),
      releases: Number(releases.rows[0]?.count ?? 0),
      byRarity,
      averagePrice: Math.round(Number(numbers.rows[0]?.avg ?? 0)),
      portfolioValue: Number(numbers.rows[0]?.total ?? 0),
      recentAudit: audit.rows.map((row) => ({
        id: Number(row.id),
        actorId: row.actor_id === null ? null : Number(row.actor_id),
        action: row.action,
        payload: row.payload,
        createdAt: new Date(row.created_at).toISOString()
      }))
    };
  }
  async getConfigOverrides() {
    const result = await this.pool.query(
      "SELECT key, value FROM game_config"
    );
    const overrides = {};
    for (const row of result.rows) overrides[row.key] = row.value;
    return overrides;
  }
  async setConfigOverride(key, value, actorId) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO game_config (key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [key, JSON.stringify(value), actorId]
      );
      await client.query(
        "INSERT INTO audit_log (actor_id, action, payload) VALUES ($1, $2, $3)",
        [actorId, "config.set", JSON.stringify({ key, value })]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async clearConfigOverride(key, actorId) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM game_config WHERE key = $1", [key]);
      await client.query(
        "INSERT INTO audit_log (actor_id, action, payload) VALUES ($1, $2, $3)",
        [actorId, "config.clear", JSON.stringify({ key })]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  /* ─────────────────────────── ЧТЕНИЕ СОСТОЯНИЯ ─────────────────────────── */
  async readState(client, row) {
    const playerId = Number(row.id);
    const [numbers, ledger2, releases] = await Promise.all([
      client.query(
        "SELECT * FROM numbers WHERE player_id = $1 ORDER BY issued_at DESC",
        [playerId]
      ),
      client.query(
        "SELECT * FROM ledger WHERE player_id = $1 ORDER BY created_at DESC LIMIT 500",
        [playerId]
      ),
      client.query(
        "SELECT release_id FROM releases WHERE player_id = $1 ORDER BY created_at DESC LIMIT 500",
        [playerId]
      )
    ]);
    const player = {
      id: String(playerId),
      name: row.name,
      avatarUrl: row.avatar_url,
      balance: Number(row.balance),
      tickets: row.tickets,
      // Бесплатные выпуски из рулетки живут на игроке, как и билеты.
      freeReleases: row.free_releases ?? 0,
      level: row.level,
      xp: row.xp,
      primaryNumberId: row.primary_number_id,
      freePrimarySwaps: row.free_primary_swaps,
      dailyStreak: row.daily_streak,
      luck: {
        multiplier: Number(row.luck_multiplier),
        expiresAt: row.luck_expires_at ? new Date(row.luck_expires_at).toISOString() : null,
        spinsLeft: row.luck_spins ?? 0,
        title: "\u0418\u0432\u0435\u043D\u0442 \xB7 \u0423\u0434\u0430\u0447\u0430 \xD72",
        subtitle: "\u0423\u0434\u0430\u0447\u0430 \xD72 \u043D\u0430 \u0432\u0441\u0435 \u043A\u0440\u0443\u0442\u043A\u0438 \u2014 \u0434\u043E 00:00 \u041C\u0421\u041A"
      }
    };
    return {
      schema: createInitialState().schema,
      player,
      numbers: numbers.rows.map(mapNumberRow),
      ledger: ledger2.rows.map(mapLedgerRow),
      selectedTariff: row.selected_tariff,
      selectedCountry: row.selected_country,
      selectedOperator: row.selected_operator ?? null,
      selectedCode: row.selected_code ?? null,
      processedReleaseIds: releases.rows.map((item) => item.release_id),
      claimedAchievements: row.claimed_achievements ?? [],
      usedPromoCodes: row.used_promo_codes ?? [],
      slots: 100
    };
  }
  /* ─────────────────────────── ЗАПИСЬ СОСТОЯНИЯ ─────────────────────────── */
  async writeState(client, playerId, state, loadedNumbers, loadedLedger) {
    await client.query(
      `UPDATE players SET
         balance = $2, tickets = $3, level = $4, xp = $5,
         primary_number_id = $6, free_primary_swaps = $7, daily_streak = $8,
         luck_multiplier = $9, luck_expires_at = $10,
         selected_tariff = $11, selected_country = $12,
         selected_operator = $13, selected_code = $14,
         luck_spins = $15, free_releases = $16,
         claimed_achievements = $17, used_promo_codes = $18, updated_at = now()
       WHERE id = $1`,
      [
        playerId,
        state.player.balance,
        state.player.tickets,
        state.player.level,
        state.player.xp,
        state.player.primaryNumberId,
        state.player.freePrimarySwaps,
        state.player.dailyStreak,
        state.player.luck.multiplier,
        state.player.luck.expiresAt,
        state.selectedTariff,
        state.selectedCountry,
        state.selectedOperator,
        state.selectedCode,
        state.player.luck.spinsLeft,
        state.player.freeReleases,
        state.claimedAchievements,
        state.usedPromoCodes
      ]
    );
    const nextIds = new Set(state.numbers.map((number) => number.id));
    for (const id of loadedNumbers.keys()) {
      if (!nextIds.has(id)) {
        await client.query("DELETE FROM numbers WHERE id = $1 AND player_id = $2", [id, playerId]);
      }
    }
    for (const number of state.numbers) {
      const previous = loadedNumbers.get(number.id);
      if (!previous) {
        const tariff = TARIFFS[number.tariffId];
        await client.query(
          `INSERT INTO releases (release_id, player_id, number_id, tariff_id, country_id, cost, tickets, rarity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (release_id) DO NOTHING`,
          [
            number.releaseId,
            playerId,
            number.id,
            number.tariffId,
            number.countryId,
            tariff?.price ?? 0,
            tariff?.ticketCost ?? 0,
            number.rarity
          ]
        );
        await client.query(
          `INSERT INTO numbers (
             id, player_id, release_id, display, digits, country_id, region_code, operator_id,
             tariff_id, rarity, base_price, pattern_multiplier, demand_multiplier, final_price,
             score, patterns, limited_edition, issued_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (id) DO NOTHING`,
          [
            number.id,
            playerId,
            number.releaseId,
            number.display,
            number.digits,
            number.countryId,
            number.regionCode,
            number.operatorId,
            number.tariffId,
            number.rarity,
            number.basePrice,
            number.patternMultiplier,
            number.demandMultiplier,
            number.finalPrice,
            number.score,
            JSON.stringify(number.patterns),
            number.limitedEdition,
            number.issuedAt
          ]
        );
      } else if (numberFieldsChanged(previous, number)) {
        await client.query(
          `UPDATE numbers SET
             display = $2, digits = $3, operator_id = $4, rarity = $5, base_price = $6,
             pattern_multiplier = $7, demand_multiplier = $8, final_price = $9,
             score = $10, patterns = $11
           WHERE id = $1 AND player_id = $12`,
          [
            number.id,
            number.display,
            number.digits,
            number.operatorId,
            number.rarity,
            number.basePrice,
            number.patternMultiplier,
            number.demandMultiplier,
            number.finalPrice,
            number.score,
            JSON.stringify(number.patterns),
            playerId
          ]
        );
      }
    }
    for (const entry of state.ledger.slice(0, 500)) {
      if (loadedLedger.has(entry.id)) continue;
      await client.query(
        `INSERT INTO ledger (id, player_id, kind, amount, label, number_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [entry.id, playerId, entry.kind, entry.amount, entry.label, entry.numberId ?? null, entry.at]
      );
    }
  }
};
function mapPlayerRow(row, admin) {
  return {
    id: Number(row.id),
    telegramId: Number(row.telegram_id),
    name: row.name,
    username: row.username,
    avatarUrl: row.avatar_url,
    isBanned: row.is_banned,
    isAdmin: admin
  };
}
function mapNumberRow(row) {
  return {
    id: row.id,
    display: row.display,
    digits: row.digits,
    countryId: row.country_id,
    regionCode: row.region_code,
    operatorId: row.operator_id,
    tariffId: row.tariff_id,
    rarity: row.rarity,
    basePrice: Number(row.base_price),
    patternMultiplier: Number(row.pattern_multiplier),
    demandMultiplier: Number(row.demand_multiplier),
    finalPrice: Number(row.final_price),
    score: row.score,
    patterns: row.patterns ?? [],
    issuedAt: new Date(row.issued_at).toISOString(),
    releaseId: row.release_id,
    limitedEdition: row.limited_edition
  };
}
function mapLedgerRow(row) {
  return {
    id: row.id,
    kind: row.kind,
    amount: Number(row.amount),
    label: row.label,
    at: new Date(row.created_at).toISOString(),
    numberId: row.number_id ?? void 0
  };
}
function numberFieldsChanged(a, b) {
  return a.digits !== b.digits || a.display !== b.display || a.operatorId !== b.operatorId || a.rarity !== b.rarity || a.score !== b.score || a.finalPrice !== b.finalPrice || a.patternMultiplier !== b.patternMultiplier || a.demandMultiplier !== b.demandMultiplier;
}
function displayName2(user) {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return user.username ?? `\u0418\u0433\u0440\u043E\u043A ${user.id}`;
}

// src/repository/index.ts
async function createRepository(env) {
  if (!env.databaseUrl) {
    const repository2 = new MemoryRepository();
    await repository2.init();
    return repository2;
  }
  const repository = new PostgresRepository(getPool(env.databaseUrl));
  await repository.init();
  return repository;
}

// src/index.ts
async function main() {
  const env = loadEnv();
  const repo = await createRepository(env);
  await reloadConfig(repo);
  const app = createApp(repo, env);
  const server = app.listen(env.port, () => {
    console.log(`[server] \u0426\u0438\u0444\u0435\u0440\u043A\u0438 API \u0441\u043B\u0443\u0448\u0430\u0435\u0442 \u043F\u043E\u0440\u0442 ${env.port}`);
    console.log(`[server] \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u0435: ${env.nodeEnv}, \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435: ${repo.driver}`);
    if (env.allowDevAuth) {
      console.warn("[server] \u0412\u041D\u0418\u041C\u0410\u041D\u0418\u0415: ALLOW_DEV_AUTH=1 \u2014 \u0432\u0445\u043E\u0434 \u0431\u0435\u0437 \u043F\u043E\u0434\u043F\u0438\u0441\u0438 Telegram \u0440\u0430\u0437\u0440\u0435\u0448\u0451\u043D");
    }
  });
  const shutdown = async (signal) => {
    console.log(`[server] \u043F\u043E\u043B\u0443\u0447\u0435\u043D ${signal}, \u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u043C\u0441\u044F`);
    server.close();
    await repo.close();
    await closePool();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
main().catch((error) => {
  console.error("[server] \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C\u0441\u044F:", error);
  process.exit(1);
});
//# sourceMappingURL=server.mjs.map
