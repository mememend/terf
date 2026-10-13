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
var UPGRADE_ORDER = ["digit", "swap", "reroll", "operator", "appeal"];

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

// ../shared/src/rng.ts
function randomInt(rng, min, max) {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

// ../shared/src/generator.ts
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
function placeRun(length, rng, run2) {
  const offset = randomInt(rng, 0, Math.max(0, length - run2.length));
  const chars = [];
  for (let i = 0; i < length; i += 1) {
    let d = randomDigit(rng);
    if (i > 0 && d === chars[i - 1]) d = String((Number(d) + 1) % 10);
    chars.push(d);
  }
  for (let i = 0; i < run2.length; i += 1) chars[offset + i] = run2[i];
  if (offset > 0 && chars[offset - 1] === chars[offset]) {
    chars[offset - 1] = String((Number(chars[offset]) + 1) % 10);
  }
  const after = offset + run2.length;
  if (after < length && chars[after] === chars[after - 1]) {
    chars[after] = String((Number(chars[after - 1]) + 1) % 10);
  }
  if (chars[0] === "0") chars[0] = randomDigit(rng, false);
  return chars.join("");
}
var series = (size) => (length, rng) => placeRun(length, rng, randomDigit(rng, false).repeat(size));
var ladderUp = (size) => (length, rng) => {
  const start = randomInt(rng, 0, Math.max(0, 9 - size));
  let run2 = "";
  for (let i = 0; i < size; i += 1) run2 += String(start + i);
  return placeRun(length, rng, run2);
};
var ladderDown = (size) => (length, rng) => {
  const start = randomInt(rng, Math.min(size - 1, 9), 9);
  let run2 = "";
  for (let i = 0; i < size; i += 1) run2 += String(start - i);
  return placeRun(length, rng, run2);
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

// ../shared/src/anonymous.ts
var ANONYMOUS_TARIFF_LABEL = TARIFFS.premium.name;

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

// ../shared/src/quests.ts
var DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1e3;

// ../shared/src/engine.ts
function isSwapAllowed(number, a, b) {
  const length = number.digits.length;
  if (a === b || a < 0 || b < 0 || a >= length || b >= length) return false;
  if (number.digits[a] === number.digits[b]) return false;
  const chars = [...number.digits];
  [chars[a], chars[b]] = [chars[b], chars[a]];
  return chars[0] !== "0";
}

// src/smoke.ts
var PORT = Number(process.env.SMOKE_PORT ?? 8099);
var BASE = `http://127.0.0.1:${PORT}`;
var PLAYER = "555001";
var ADMIN = "777001";
var SECRET = process.env.BOT_INTERNAL_SECRET ?? "smoke-internal-secret";
var EXPECTED_DRIVER = process.env.SMOKE_EXPECT_DRIVER ?? "memory";
var failures = 0;
var log = [];
function check(label, condition, detail = "") {
  const line = `${condition ? "ok  " : "FAIL"} ${label}${detail ? ` \u2014 ${detail}` : ""}`;
  log.push(line);
  console.log(`  ${line}`);
  if (!condition) failures += 1;
}
async function call(path, options = {}) {
  const headers = {};
  if (options.user) headers["X-Dev-User"] = options.user;
  if (options.botSecret) headers["X-Bot-Secret"] = options.botSecret;
  if (options.body !== void 0) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === void 0 ? void 0 : JSON.stringify(options.body)
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}
async function waitForServer(timeoutMs = 2e4) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return true;
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}
async function run() {
  console.log("\n\u0421\u0435\u0440\u0432\u0435\u0440 \u0438 \u0434\u043E\u0441\u0442\u0443\u043F");
  const health = await call("/health");
  check("GET /health \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442", health.status === 200, `\u043A\u043E\u0434 ${health.status}`);
  check(
    `\u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435: ${EXPECTED_DRIVER}`,
    health.body?.driver === EXPECTED_DRIVER,
    String(health.body?.driver)
  );
  const anonymous = await call("/api/state");
  check("\u0431\u0435\u0437 \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u2014 401", anonymous.status === 401, `\u043A\u043E\u0434 ${anonymous.status}`);
  console.log("\n\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435");
  const initial = await call("/api/state", { user: PLAYER });
  check("GET /api/state \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442", initial.status === 200, `\u043A\u043E\u0434 ${initial.status}`);
  check(
    "\u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u0431\u0430\u043B\u0430\u043D\u0441",
    initial.body?.state?.player?.balance === ECONOMY.startingBalance,
    String(initial.body?.state?.player?.balance)
  );
  check("\u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F \u043F\u0443\u0441\u0442\u0430", initial.body?.state?.numbers?.length === 0);
  const chances = await call("/api/chances", { user: PLAYER });
  const odds = chances.body?.odds ?? {};
  const oddsSum = Object.values(odds).reduce((sum, value) => sum + Number(value), 0);
  check("\u0432\u0438\u0442\u0440\u0438\u043D\u0430 \u0448\u0430\u043D\u0441\u043E\u0432 \u0441\u0443\u043C\u043C\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u0432 100 %", Math.abs(oddsSum - 100) < 1e-6, oddsSum.toFixed(6));
  console.log("\n\u0412\u044B\u043F\u0443\u0441\u043A \u0438 \u0438\u0434\u0435\u043C\u043F\u043E\u0442\u0435\u043D\u0442\u043D\u043E\u0441\u0442\u044C");
  const releaseId = "smoke-fixed-release-1";
  const first = await call("/api/release", {
    method: "POST",
    user: PLAYER,
    body: { releaseId, tariffId: "standard", countryId: "ru" }
  });
  check("\u0432\u044B\u043F\u0443\u0441\u043A \u043F\u0440\u043E\u0448\u0451\u043B", first.status === 200 && first.body?.ok === true, `\u043A\u043E\u0434 ${first.status}`);
  const number = first.body?.number;
  check("\u043D\u043E\u043C\u0435\u0440 \u043F\u043E\u043B\u0443\u0447\u0435\u043D", Boolean(number?.display), String(number?.display));
  check(
    "\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043E\u0447\u043A\u0430\u043C \u0443\u0437\u043E\u0440\u0430",
    number && rarityForScore(number.score) === number.rarity,
    `\u043E\u0447\u043A\u0438 ${number?.score}, \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F ${number?.rarity}, \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ${number && rarityForScore(number.score)}`
  );
  const expectedPrice = number && Math.round(number.basePrice * number.patternMultiplier * number.demandMultiplier);
  check(
    "\u0446\u0435\u043D\u0430 \u043F\u043E\u0441\u0447\u0438\u0442\u0430\u043D\u0430 \u043F\u043E \u0444\u043E\u0440\u043C\u0443\u043B\u0435",
    number && number.finalPrice === expectedPrice,
    `${number?.finalPrice} \u043F\u0440\u043E\u0442\u0438\u0432 ${expectedPrice}`
  );
  check(
    "\u0431\u0430\u0437\u043E\u0432\u0430\u044F \u0446\u0435\u043D\u0430 \u0432\u0437\u044F\u0442\u0430 \u0438\u0437 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438",
    number && number.basePrice === RARITIES[number.rarity].basePrice,
    String(number?.basePrice)
  );
  const balanceAfterFirst = first.body?.balance;
  check(
    "\u0441\u043F\u0438\u0441\u0430\u043D\u0430 \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0442\u0430\u0440\u0438\u0444\u0430",
    balanceAfterFirst === ECONOMY.startingBalance - TARIFFS.standard.price,
    `${balanceAfterFirst}`
  );
  const duplicate = await call("/api/release", {
    method: "POST",
    user: PLAYER,
    body: { releaseId, tariffId: "standard", countryId: "ru" }
  });
  check("\u043F\u043E\u0432\u0442\u043E\u0440 \u0442\u043E\u0433\u043E \u0436\u0435 releaseId \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D", duplicate.status === 409, `\u043A\u043E\u0434 ${duplicate.status}`);
  const afterDuplicate = await call("/api/state", { user: PLAYER });
  check(
    "\u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0435 \u0441\u043F\u0438\u0441\u0430\u043B \u0432\u0430\u043B\u044E\u0442\u0443",
    afterDuplicate.body?.state?.player?.balance === balanceAfterFirst,
    `${afterDuplicate.body?.state?.player?.balance}`
  );
  check(
    "\u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u0438\u043B \u043D\u043E\u043C\u0435\u0440",
    afterDuplicate.body?.state?.numbers?.length === 1,
    String(afterDuplicate.body?.state?.numbers?.length)
  );
  console.log("\n\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u043A\u0430");
  const second = await call("/api/release", {
    method: "POST",
    user: PLAYER,
    body: { tariffId: "plus", countryId: "de" }
  });
  check("\u0432\u0442\u043E\u0440\u043E\u0439 \u0432\u044B\u043F\u0443\u0441\u043A \u043F\u0440\u043E\u0448\u0451\u043B", second.status === 200, `\u043A\u043E\u0434 ${second.status}`);
  check(
    "\u0441\u043F\u0438\u0441\u0430\u043D\u0430 \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0442\u0430\u0440\u0438\u0444\u0430 \u041F\u043B\u044E\u0441",
    second.body?.balance === balanceAfterFirst - TARIFFS.plus.price,
    String(second.body?.balance)
  );
  const soldId = second.body?.number?.id;
  const sell = await call("/api/sell", { method: "POST", user: PLAYER, body: { numberId: soldId } });
  check("\u043F\u0440\u043E\u0434\u0430\u0436\u0430 \u043F\u0440\u043E\u0448\u043B\u0430", sell.status === 200, `\u043A\u043E\u0434 ${sell.status}`);
  const afterSell = await call("/api/state", { user: PLAYER });
  check("\u043D\u043E\u043C\u0435\u0440\u043E\u0432 \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C \u043E\u0434\u0438\u043D", afterSell.body?.state?.numbers?.length === 1, String(afterSell.body?.state?.numbers?.length));
  check(
    "\u043F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F \u043F\u0440\u043E\u0434\u0430\u0436\u0430 \u0442\u043E\u0433\u043E \u0436\u0435 \u043D\u043E\u043C\u0435\u0440\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430",
    (await call("/api/sell", { method: "POST", user: PLAYER, body: { numberId: soldId } })).status === 400
  );
  console.log("\n\u0417\u0430\u043C\u0435\u043D\u0430 \u0446\u0438\u0444\u0440\u044B");
  const targetId = afterSell.body?.state?.numbers?.[0]?.id;
  const forecast = await call(`/api/digit/forecast?numberId=${targetId}&index=3`, { user: PLAYER });
  check("\u043F\u0440\u043E\u0433\u043D\u043E\u0437 \u0437\u0430\u043C\u0435\u043D\u044B \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442", forecast.status === 200, `\u043A\u043E\u0434 ${forecast.status}`);
  const change = await call("/api/digit", {
    method: "POST",
    user: PLAYER,
    body: { numberId: targetId, index: 3 }
  });
  check("\u0437\u0430\u043C\u0435\u043D\u0430 \u0446\u0438\u0444\u0440\u044B \u043F\u0440\u043E\u0448\u043B\u0430", change.status === 200, `\u043A\u043E\u0434 ${change.status}`);
  check(
    "\u0446\u0438\u0444\u0440\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C",
    change.body?.number?.digits !== afterSell.body?.state?.numbers?.[0]?.digits,
    `${afterSell.body?.state?.numbers?.[0]?.digits} \u2192 ${change.body?.number?.digits}`
  );
  check(
    "\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u043D\u0430 \u043F\u043E \u043D\u043E\u0432\u044B\u043C \u043E\u0447\u043A\u0430\u043C",
    change.body?.number && rarityForScore(change.body.number.score) === change.body.number.rarity
  );
  console.log("\n\u0423\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u044F \u043D\u043E\u043C\u0435\u0440\u0430");
  const upgradesMissing = await call("/api/upgrades", { user: PLAYER });
  check("\u0432\u0438\u0442\u0440\u0438\u043D\u0430 \u0431\u0435\u0437 \u043D\u043E\u043C\u0435\u0440\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430", upgradesMissing.status === 400, `\u043A\u043E\u0434 ${upgradesMissing.status}`);
  const currentNumber = (await call("/api/state", { user: PLAYER })).body?.state?.numbers?.[0];
  const upgrades = await call(`/api/upgrades?numberId=${currentNumber.id}`, { user: PLAYER });
  check("\u0432\u0438\u0442\u0440\u0438\u043D\u0430 \u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u0439 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442", upgrades.status === 200, `\u043A\u043E\u0434 ${upgrades.status}`);
  check(
    "\u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u044B \u0432\u0441\u0435 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0438\u0437 \u043A\u043E\u043D\u0444\u0438\u0433\u0430",
    upgrades.body?.offers?.length === UPGRADE_ORDER.length,
    `${upgrades.body?.offers?.length} \u0438\u0437 ${UPGRADE_ORDER.length}`
  );
  check(
    "\u0443 \u043A\u0430\u0436\u0434\u043E\u0439 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0435\u0441\u0442\u044C \u0446\u0435\u043D\u0430 \u0438 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435",
    (upgrades.body?.offers ?? []).every(
      (offer) => offer.price > 0 && typeof offer.description === "string" && offer.description.length > 0
    )
  );
  const swapOffer = (upgrades.body?.offers ?? []).find((offer) => offer.id === "swap");
  let swapPair = null;
  for (let a = 0; a < currentNumber.digits.length && !swapPair; a += 1) {
    for (let b = a + 1; b < currentNumber.digits.length && !swapPair; b += 1) {
      if (isSwapAllowed(currentNumber, a, b)) swapPair = [a, b];
    }
  }
  check("\u043D\u0430\u0448\u043B\u0430\u0441\u044C \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u043F\u0430\u0440\u0430 \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438", swapPair !== null, JSON.stringify(swapPair));
  const balanceBeforeUpgrade = (await call("/api/state", { user: PLAYER })).body?.state?.player?.balance;
  const swapResult = await call("/api/upgrade", {
    method: "POST",
    user: PLAYER,
    body: { numberId: currentNumber.id, id: "swap", a: swapPair?.[0], b: swapPair?.[1] }
  });
  check("\u043F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 API \u043F\u0440\u043E\u0448\u043B\u0430", swapResult.status === 200, `\u043A\u043E\u0434 ${swapResult.status}`);
  check(
    "\u0441\u043F\u0438\u0441\u0430\u043D\u0430 \u0446\u0435\u043D\u0430 \u043F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438",
    swapResult.body?.balance === balanceBeforeUpgrade - swapOffer.price,
    `${balanceBeforeUpgrade} \u2192 ${swapResult.body?.balance}, \u0446\u0435\u043D\u0430 ${swapOffer?.price}`
  );
  check(
    "\u0441\u043E\u0441\u0442\u0430\u0432 \u0446\u0438\u0444\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D",
    [...String(swapResult.body?.number?.digits)].sort().join("") === [...String(currentNumber.digits)].sort().join(""),
    `${currentNumber.digits} \u2192 ${swapResult.body?.number?.digits}`
  );
  check(
    "\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u043D\u0430 \u043F\u043E \u043E\u0447\u043A\u0430\u043C",
    rarityForScore(swapResult.body?.number?.score) === swapResult.body?.number?.rarity,
    `${swapResult.body?.number?.score} \u2192 ${swapResult.body?.number?.rarity}`
  );
  const upgradesAfterSwap = await call(`/api/upgrades?numberId=${currentNumber.id}`, {
    user: PLAYER
  });
  const appealOffer = (upgradesAfterSwap.body?.offers ?? []).find(
    (offer) => offer.id === "appeal"
  );
  const beforeAppeal = (await call("/api/state", { user: PLAYER })).body?.state?.numbers?.find(
    (item) => item.id === currentNumber.id
  );
  const balanceBeforeAppeal = (await call("/api/state", { user: PLAYER })).body?.state?.player?.balance;
  const appealResult = await call("/api/upgrade", {
    method: "POST",
    user: PLAYER,
    body: { numberId: currentNumber.id, id: "appeal" }
  });
  if (balanceBeforeAppeal >= appealOffer.price) {
    check("\u0430\u043F\u0435\u043B\u043B\u044F\u0446\u0438\u044F \u0447\u0435\u0440\u0435\u0437 API \u043F\u0440\u043E\u0448\u043B\u0430", appealResult.status === 200, `\u043A\u043E\u0434 ${appealResult.status}`);
    check(
      "\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043F\u043E\u0434\u043D\u044F\u043B\u0430\u0441\u044C \u0440\u043E\u0432\u043D\u043E \u043D\u0430 \u0441\u0442\u0443\u043F\u0435\u043D\u044C",
      RARITY_ORDER.indexOf(appealResult.body?.number?.rarity) === RARITY_ORDER.indexOf(beforeAppeal.rarity) + 1,
      `${beforeAppeal.rarity} \u2192 ${appealResult.body?.number?.rarity}`
    );
    check(
      "\u0441\u043F\u0438\u0441\u0430\u043D\u0430 \u0446\u0435\u043D\u0430 \u0430\u043F\u0435\u043B\u043B\u044F\u0446\u0438\u0438",
      appealResult.body?.balance === balanceBeforeAppeal - appealOffer.price,
      `${balanceBeforeAppeal} \u2192 ${appealResult.body?.balance}, \u0446\u0435\u043D\u0430 ${appealOffer.price}`
    );
  } else {
    check(
      "\u0434\u043E\u0440\u043E\u0433\u0430\u044F \u0430\u043F\u0435\u043B\u043B\u044F\u0446\u0438\u044F \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430 \u0438\u0437-\u0437\u0430 \u043D\u0435\u0445\u0432\u0430\u0442\u043A\u0438 \u0441\u0440\u0435\u0434\u0441\u0442\u0432",
      appealResult.status === 400 && appealResult.body?.error === "insufficient_funds",
      `\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F ${beforeAppeal.rarity}, \u0431\u0430\u043B\u0430\u043D\u0441 ${balanceBeforeAppeal}, \u0446\u0435\u043D\u0430 ${appealOffer.price}, \u043E\u0442\u0432\u0435\u0442 ${appealResult.body?.error}`
    );
    check(
      "\u0431\u0430\u043B\u0430\u043D\u0441 \u043D\u0435 \u0442\u0440\u043E\u043D\u0443\u0442",
      (await call("/api/state", { user: PLAYER })).body?.state?.player?.balance === balanceBeforeAppeal
    );
  }
  console.log("\n\u0421\u043C\u0435\u043D\u0430 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430");
  const afterSwapNumber = (await call("/api/state", { user: PLAYER })).body?.state?.numbers?.find(
    (item) => item.id === currentNumber.id
  );
  const operatorOffer = (upgradesAfterSwap.body?.offers ?? []).find(
    (offer) => offer.id === "operator"
  );
  check(
    "\u0432\u0438\u0442\u0440\u0438\u043D\u0430 \u043E\u0442\u0434\u0430\u0451\u0442 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430",
    (operatorOffer?.operators?.length ?? 0) >= 2,
    String(operatorOffer?.operators?.length)
  );
  const visibleOperators = operatorOffer?.operators ?? [];
  check(
    "\u043F\u0435\u0440\u0435\u0432\u043E\u0437\u0447\u0438\u043A \u043D\u0435 \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0435\u0442\u0441\u044F \u043A \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0443",
    !visibleOperators.some((choice) => choice.id === "carrier"),
    visibleOperators.map((choice) => choice.id).join(", ")
  );
  check(
    "\u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u043F\u043E\u043C\u0435\u0447\u0435\u043D \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0430",
    visibleOperators.filter((choice) => choice.current).length <= 1,
    String(visibleOperators.filter((choice) => choice.current).length)
  );
  const targetOperator = (operatorOffer?.operators ?? []).find((choice) => !choice.current);
  const balanceBeforeOperator = (await call("/api/state", { user: PLAYER })).body?.state?.player?.balance;
  const operatorResult = await call("/api/upgrade", {
    method: "POST",
    user: PLAYER,
    body: { numberId: currentNumber.id, id: "operator", operatorId: targetOperator.id }
  });
  check("\u0441\u043C\u0435\u043D\u0430 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430 \u0447\u0435\u0440\u0435\u0437 API \u043F\u0440\u043E\u0448\u043B\u0430", operatorResult.status === 200, `\u043A\u043E\u0434 ${operatorResult.status}`);
  check(
    "\u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u0441\u043C\u0435\u043D\u0438\u043B\u0441\u044F",
    operatorResult.body?.number?.operatorId === targetOperator.id,
    `${afterSwapNumber.operatorId} \u2192 ${operatorResult.body?.number?.operatorId}`
  );
  check(
    "\u0445\u0432\u043E\u0441\u0442 \u043D\u043E\u043C\u0435\u0440\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D",
    String(operatorResult.body?.number?.digits).slice(-4) === String(afterSwapNumber.digits).slice(-4),
    `${afterSwapNumber.digits} \u2192 ${operatorResult.body?.number?.digits}`
  );
  check(
    "\u0441\u043F\u0438\u0441\u0430\u043D\u0430 \u0446\u0435\u043D\u0430 \u0441\u043C\u0435\u043D\u044B \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430",
    operatorResult.body?.balance === balanceBeforeOperator - operatorOffer.price,
    `${balanceBeforeOperator} \u2192 ${operatorResult.body?.balance}, \u0446\u0435\u043D\u0430 ${operatorOffer?.price}`
  );
  const foreignOperator = await call("/api/upgrade", {
    method: "POST",
    user: PLAYER,
    body: { numberId: currentNumber.id, id: "operator", operatorId: "sakura" }
  });
  check(
    "\u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u0447\u0443\u0436\u043E\u0433\u043E \u0440\u0435\u0433\u0438\u043E\u043D\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D",
    foreignOperator.status === 400,
    `\u043A\u043E\u0434 ${foreignOperator.status}`
  );
  const sameOperator = await call("/api/upgrade", {
    method: "POST",
    user: PLAYER,
    body: { numberId: currentNumber.id, id: "operator", operatorId: targetOperator.id }
  });
  check(
    "\u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043A \u0442\u0435\u043A\u0443\u0449\u0435\u043C\u0443 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0443 \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D",
    sameOperator.status === 400,
    `\u043A\u043E\u0434 ${sameOperator.status}`
  );
  const unknownUpgrade = await call("/api/upgrade", {
    method: "POST",
    user: PLAYER,
    body: { numberId: currentNumber.id, id: "\u0442\u0435\u043B\u0435\u043F\u043E\u0440\u0442" }
  });
  check("\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430", unknownUpgrade.status === 400, `\u043A\u043E\u0434 ${unknownUpgrade.status}`);
  const sameDigitSwap = await call("/api/upgrade", {
    method: "POST",
    user: PLAYER,
    body: { numberId: currentNumber.id, id: "swap", a: 1, b: 1 }
  });
  check("\u043F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0446\u0438\u0444\u0440\u044B \u0441 \u0441\u0430\u043C\u043E\u0439 \u0441\u043E\u0431\u043E\u0439 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430", sameDigitSwap.status === 400, `\u043A\u043E\u0434 ${sameDigitSwap.status}`);
  console.log("\n\u0415\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u0430\u044F \u043D\u0430\u0433\u0440\u0430\u0434\u0430");
  const dailyFirst = await call("/api/daily", { method: "POST", user: PLAYER });
  check("\u043D\u0430\u0433\u0440\u0430\u0434\u0430 \u0434\u043D\u044F \u043D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u0430", dailyFirst.status === 200, `\u043A\u043E\u0434 ${dailyFirst.status}`);
  const dailyAgain = await call("/api/daily", { method: "POST", user: PLAYER });
  check("\u043F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F \u043D\u0430\u0433\u0440\u0430\u0434\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430", dailyAgain.status === 400, `\u043A\u043E\u0434 ${dailyAgain.status}`);
  console.log("\n\u041F\u0440\u0430\u0432\u0430 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430");
  const forbidden = await call("/api/admin/stats", { user: PLAYER });
  check("\u043E\u0431\u044B\u0447\u043D\u043E\u043C\u0443 \u0438\u0433\u0440\u043E\u043A\u0443 \u0430\u0434\u043C\u0438\u043D\u043A\u0430 \u0437\u0430\u043A\u0440\u044B\u0442\u0430", forbidden.status === 403, `\u043A\u043E\u0434 ${forbidden.status}`);
  const adminStats = await call("/api/admin/stats", { user: ADMIN });
  check("\u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0443 \u0430\u0434\u043C\u0438\u043D\u043A\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u0430", adminStats.status === 200, `\u043A\u043E\u0434 ${adminStats.status}`);
  check("\u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0438\u0433\u0440\u043E\u043A\u043E\u0432", (adminStats.body?.players ?? 0) >= 2, String(adminStats.body?.players));
  const badOdds = await call("/api/admin/config", {
    method: "PUT",
    user: ADMIN,
    body: { key: "tariff.standard.odds", value: { mythic: 1, legendary: 1, epic: 1, rare: 1, uncommon: 1, common: 1 } }
  });
  check("\u0431\u0438\u0442\u044B\u0435 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u0438 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u044B", badOdds.status === 400, `\u043A\u043E\u0434 ${badOdds.status}`);
  const goodOdds = await call("/api/admin/config", {
    method: "PUT",
    user: ADMIN,
    body: { key: "tariff.standard.odds", value: { mythic: 1e-3, legendary: 0.01, epic: 1, rare: 7, uncommon: 25, common: 66.989 } }
  });
  check("\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0435 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u0438 \u043F\u0440\u0438\u043D\u044F\u0442\u044B", goodOdds.status === 200, `\u043A\u043E\u0434 ${goodOdds.status}`);
  const unknownKey = await call("/api/admin/config", {
    method: "PUT",
    user: ADMIN,
    body: { key: "player.balance", value: 999999999 }
  });
  check("\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D", unknownKey.status === 400, `\u043A\u043E\u0434 ${unknownKey.status}`);
  console.log("\n\u0410\u0434\u043C\u0438\u043D\u043A\u0430 \u0432\u043B\u0438\u044F\u0435\u0442 \u043D\u0430 \u0438\u0433\u0440\u0443");
  const configBefore = await call("/api/admin/config", { user: ADMIN });
  check(
    "\u043F\u0430\u043D\u0435\u043B\u044C \u043E\u0442\u0434\u0430\u0451\u0442 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B",
    configBefore.status === 200 && Boolean(configBefore.body?.current?.tariffPrice),
    `\u043A\u043E\u0434 ${configBefore.status}`
  );
  check("\u043F\u0430\u043D\u0435\u043B\u044C \u043E\u0442\u0434\u0430\u0451\u0442 \u0431\u0430\u0437\u043E\u0432\u044B\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F", Boolean(configBefore.body?.base?.tariffPrice));
  check(
    "\u043F\u0430\u043D\u0435\u043B\u044C \u043E\u0442\u0434\u0430\u0451\u0442 \u0441\u043F\u0438\u0441\u043E\u043A \u0443\u0437\u043E\u0440\u043E\u0432",
    Array.isArray(configBefore.body?.patterns) && configBefore.body.patterns.length > 10
  );
  const basePremium = Number(configBefore.body?.base?.tariffPrice?.premium);
  check(
    "\u0431\u0430\u0437\u043E\u0432\u0430\u044F \u0446\u0435\u043D\u0430 \u041F\u0440\u0435\u043C\u0438\u0443\u043C\u0430 \u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430",
    basePremium === TARIFFS.premium.price,
    `${basePremium} \u043F\u0440\u043E\u0442\u0438\u0432 ${TARIFFS.premium.price}`
  );
  const setPrice = await call("/api/admin/config", {
    method: "PUT",
    user: ADMIN,
    body: { key: "tariff.premium.price", value: 12345 }
  });
  check("\u0446\u0435\u043D\u0430 \u0442\u0430\u0440\u0438\u0444\u0430 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0430", setPrice.status === 200, `\u043A\u043E\u0434 ${setPrice.status}`);
  const balanceBefore = (await call("/api/state", { user: PLAYER })).body?.state?.player?.balance;
  const premiumRelease = await call("/api/release", {
    method: "POST",
    user: PLAYER,
    body: { tariffId: "premium", countryId: "ru" }
  });
  check("\u0432\u044B\u043F\u0443\u0441\u043A \u043F\u043E \u043D\u043E\u0432\u043E\u0439 \u0446\u0435\u043D\u0435 \u043F\u0440\u043E\u0448\u0451\u043B", premiumRelease.status === 200, `\u043A\u043E\u0434 ${premiumRelease.status}`);
  check(
    "\u0441\u043F\u0438\u0441\u0430\u043D\u0430 \u0438\u043C\u0435\u043D\u043D\u043E \u043D\u043E\u0432\u0430\u044F \u0446\u0435\u043D\u0430 \u2014 \u043F\u0440\u0430\u0432\u043A\u0430 \u0434\u043E\u0448\u043B\u0430 \u0434\u043E \u0432\u044B\u043F\u0443\u0441\u043A\u0430",
    premiumRelease.body?.balance === balanceBefore - 12345,
    `${balanceBefore} \u2192 ${premiumRelease.body?.balance}, \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ${balanceBefore - 12345}`
  );
  const resetPrice = await call("/api/admin/config/tariff.premium.price", {
    method: "DELETE",
    user: ADMIN
  });
  check("\u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0441\u043D\u044F\u0442\u043E", resetPrice.status === 200, `\u043A\u043E\u0434 ${resetPrice.status}`);
  const configAfter = await call("/api/admin/config", { user: ADMIN });
  check(
    "\u0446\u0435\u043D\u0430 \u0432\u0435\u0440\u043D\u0443\u043B\u0430\u0441\u044C \u043A \u0431\u0430\u0437\u043E\u0432\u043E\u0439",
    Number(configAfter.body?.current?.tariffPrice?.premium) === basePremium,
    String(configAfter.body?.current?.tariffPrice?.premium)
  );
  const chancesBefore = await call("/api/chances?tariffId=standard", { user: PLAYER });
  const oddsOverride = await call("/api/admin/config", {
    method: "PUT",
    user: ADMIN,
    body: {
      key: "tariff.standard.odds",
      value: { mythic: 1, legendary: 4, epic: 20, rare: 30, uncommon: 25, common: 20 }
    }
  });
  check("\u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u044B", oddsOverride.status === 200, `\u043A\u043E\u0434 ${oddsOverride.status}`);
  const chancesAfter = await call("/api/chances?tariffId=standard", { user: PLAYER });
  check(
    "\u0432\u0438\u0442\u0440\u0438\u043D\u0430 \u0448\u0430\u043D\u0441\u043E\u0432 \u043F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u043B\u0430\u0441\u044C \u2014 \u043F\u0440\u0430\u0432\u043A\u0430 \u0434\u043E\u0448\u043B\u0430 \u0434\u043E \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F",
    Number(chancesAfter.body?.odds?.rare) > Number(chancesBefore.body?.odds?.rare),
    `${chancesBefore.body?.odds?.rare} \u2192 ${chancesAfter.body?.odds?.rare}`
  );
  const oddsSumAfterEdit = Object.values(chancesAfter.body?.odds ?? {}).reduce(
    (sum, value) => sum + Number(value),
    0
  );
  check(
    "\u0441\u0443\u043C\u043C\u0430 \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0430\u0432\u043A\u0438 \u0432\u0441\u0451 \u0435\u0449\u0451 100 %",
    Math.abs(oddsSumAfterEdit - 100) < 1e-6,
    oddsSumAfterEdit.toFixed(6)
  );
  const cleanOdds = await call("/api/admin/config/tariff.standard.odds", {
    method: "DELETE",
    user: ADMIN
  });
  check("\u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u0438 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u044B \u043A \u0431\u0430\u0437\u043E\u0432\u044B\u043C", cleanOdds.status === 200, `\u043A\u043E\u0434 ${cleanOdds.status}`);
  const forbiddenDelete = await call("/api/admin/config/tariff.premium.price", {
    method: "DELETE",
    user: PLAYER
  });
  check(
    "\u043E\u0431\u044B\u0447\u043D\u043E\u043C\u0443 \u0438\u0433\u0440\u043E\u043A\u0443 \u0441\u043D\u044F\u0442\u0438\u0435 \u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u043A\u0440\u044B\u0442\u043E",
    forbiddenDelete.status === 403,
    `\u043A\u043E\u0434 ${forbiddenDelete.status}`
  );
  console.log("\n\u0424\u043B\u0430\u0433 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430 \u0432 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0438");
  const adminState = await call("/api/state", { user: ADMIN });
  check("\u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440 \u0432\u0438\u0434\u0438\u0442 \u0444\u043B\u0430\u0433", adminState.body?.isAdmin === true, String(adminState.body?.isAdmin));
  const playerState = await call("/api/state", { user: PLAYER });
  check("\u043E\u0431\u044B\u0447\u043D\u044B\u0439 \u0438\u0433\u0440\u043E\u043A \u0444\u043B\u0430\u0433\u0430 \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442", playerState.body?.isAdmin === false, String(playerState.body?.isAdmin));
  console.log("\n\u0414\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F \u0438 \u043D\u0430\u0433\u0440\u0430\u0434\u044B");
  const quests = await call("/api/quests", { user: PLAYER });
  check("\u0441\u0432\u043E\u0434\u043A\u0430 \u0437\u0430\u0434\u0430\u043D\u0438\u0439 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442", quests.status === 200, `\u043A\u043E\u0434 ${quests.status}`);
  check(
    "\u0432 \u0441\u0432\u043E\u0434\u043A\u0435 \u043F\u0435\u0440\u0435\u0447\u0438\u0441\u043B\u0435\u043D\u044B \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F \u0441 \u043D\u0430\u0433\u0440\u0430\u0434\u043E\u0439",
    Array.isArray(quests.body?.achievements) && quests.body.achievements.length > 0 && quests.body.achievements.every((item) => item.reward > 0),
    String(quests.body?.achievements?.length)
  );
  const lockedClaim = await call("/api/achievement", {
    method: "POST",
    user: PLAYER,
    body: { id: "first_mythic" }
  });
  check("\u043D\u0435\u0437\u0430\u043A\u0440\u044B\u0442\u043E\u0435 \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u0432\u044B\u0434\u0430\u0451\u0442\u0441\u044F", lockedClaim.status === 400, `\u043A\u043E\u0434 ${lockedClaim.status}`);
  const unknownClaim = await call("/api/achievement", {
    method: "POST",
    user: PLAYER,
    body: { id: "\u043D\u0435\u0442-\u0442\u0430\u043A\u043E\u0433\u043E" }
  });
  check("\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E", unknownClaim.status === 400, `\u043A\u043E\u0434 ${unknownClaim.status}`);
  const firstSim = (quests.body?.achievements ?? []).find((item) => item.id === "first_sim");
  check("\u043F\u0435\u0440\u0432\u044B\u0439 \u0432\u044B\u043F\u0443\u0441\u043A \u0437\u0430\u043A\u0440\u044B\u0442 \u0438 \u043D\u0435 \u0437\u0430\u0431\u0440\u0430\u043D", firstSim?.unlocked === true && firstSim?.claimed === false);
  const balanceBeforeClaim = (await call("/api/state", { user: PLAYER })).body?.state?.player?.balance;
  const claimedQuest = await call("/api/achievement", {
    method: "POST",
    user: PLAYER,
    body: { id: "first_sim" }
  });
  check("\u043D\u0430\u0433\u0440\u0430\u0434\u0430 \u0437\u0430 \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0435 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0430", claimedQuest.status === 200, `\u043A\u043E\u0434 ${claimedQuest.status}`);
  check(
    "\u043D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u0430 \u0440\u043E\u0432\u043D\u043E \u043E\u0431\u0435\u0449\u0430\u043D\u043D\u0430\u044F \u0441\u0443\u043C\u043C\u0430",
    claimedQuest.body?.balance === balanceBeforeClaim + firstSim.reward,
    `${balanceBeforeClaim} \u2192 ${claimedQuest.body?.balance}, \u043D\u0430\u0433\u0440\u0430\u0434\u0430 ${firstSim?.reward}`
  );
  check(
    "\u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u043D\u0430\u0433\u0440\u0430\u0434\u0430 \u043D\u0435 \u0432\u044B\u0434\u0430\u0451\u0442\u0441\u044F",
    (await call("/api/achievement", { method: "POST", user: PLAYER, body: { id: "first_sim" } })).status === 400
  );
  console.log("\n\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u043E\u043C\u0435\u0440\u0430");
  const ownNumber = (await call("/api/state", { user: PLAYER })).body?.state?.numbers?.[0];
  if (ownNumber) {
    const exact = await call(`/api/check?number=${ownNumber.digits}`, { user: PLAYER });
    check("\u0441\u0432\u043E\u0439 \u043D\u043E\u043C\u0435\u0440 \u043F\u043E \u0446\u0438\u0444\u0440\u0430\u043C \u043D\u0430\u0439\u0434\u0435\u043D", exact.body?.free === false, String(exact.body?.free));
    const pasted = await call(
      `/api/check?number=${encodeURIComponent(ownNumber.display)}`,
      { user: PLAYER }
    );
    check(
      "\u0432\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u0438\u0437 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043D\u043E\u043C\u0435\u0440 \u0442\u043E\u0436\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",
      pasted.body?.free === false,
      `${ownNumber.display} \u2192 \u0441\u0432\u043E\u0431\u043E\u0434\u0435\u043D: ${pasted.body?.free}`
    );
    check(
      "\u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u0438\u044F \u043F\u0435\u0440\u0435\u0431\u0440\u0430\u043D\u043E \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E",
      (pasted.body?.checked ?? 0) > 1,
      String(pasted.body?.checked)
    );
  }
  const freeNumber = await call("/api/check?number=99900011223", { user: PLAYER });
  check("\u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439 \u043D\u043E\u043C\u0435\u0440 \u0441\u0432\u043E\u0431\u043E\u0434\u0435\u043D", freeNumber.body?.free === true);
  const shortNumber = await call("/api/check?number=123", { user: PLAYER });
  check("\u0441\u043B\u0438\u0448\u043A\u043E\u043C \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D", shortNumber.status === 400, `\u043A\u043E\u0434 ${shortNumber.status}`);
  console.log("\n\u041C\u0430\u0441\u0441\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0434\u0430\u0436\u0430");
  const bulkState = (await call("/api/state", { user: PLAYER })).body?.state;
  const bulkIds = (bulkState?.numbers ?? []).filter((number2) => number2.id !== bulkState?.player?.primaryNumberId).slice(0, 3).map((number2) => number2.id);
  const primaryId = bulkState?.player?.primaryNumberId;
  check("\u0435\u0441\u0442\u044C \u0447\u0442\u043E \u043F\u0440\u043E\u0434\u0430\u0432\u0430\u0442\u044C \u043F\u0430\u0447\u043A\u043E\u0439", bulkIds.length > 0, String(bulkIds.length));
  const emptyBatch = await call("/api/sell-batch", { method: "POST", user: PLAYER, body: { ids: [] } });
  check("\u043F\u0443\u0441\u0442\u043E\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D", emptyBatch.status === 400, `\u043A\u043E\u0434 ${emptyBatch.status}`);
  const balanceBeforeBatch = bulkState?.player?.balance ?? 0;
  const batch = await call("/api/sell-batch", { method: "POST", user: PLAYER, body: { ids: bulkIds } });
  check("\u043F\u0430\u0447\u043A\u0430 \u043F\u0440\u043E\u0434\u0430\u043D\u0430 \u0447\u0435\u0440\u0435\u0437 API", batch.status === 200, `\u043A\u043E\u0434 ${batch.status}`);
  check(
    "\u043F\u0440\u043E\u0434\u0430\u043D\u043E \u0441\u0442\u043E\u043B\u044C\u043A\u043E \u0436\u0435, \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u043E\u0441\u0438\u043B\u0438",
    batch.body?.sold === bulkIds.length,
    `${batch.body?.sold} \u0438\u0437 ${bulkIds.length}`
  );
  check(
    "\u0432\u044B\u0440\u0443\u0447\u043A\u0430 \u0441\u043E\u0432\u043F\u0430\u043B\u0430 \u0441 \u043F\u0440\u0438\u0431\u0430\u0432\u043A\u043E\u0439 \u0431\u0430\u043B\u0430\u043D\u0441\u0430",
    ((await call("/api/state", { user: PLAYER })).body?.state?.player?.balance ?? 0) === balanceBeforeBatch + (batch.body?.total ?? 0)
  );
  if (primaryId) {
    const lockedBatch = await call("/api/sell-batch", {
      method: "POST",
      user: PLAYER,
      body: { ids: [primaryId] }
    });
    check(
      "\u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u043D\u043E\u043C\u0435\u0440 \u043F\u0440\u043E\u0434\u0430\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F \u0438 \u043F\u0440\u0438\u0447\u0438\u043D\u0430 \u043D\u0430\u0437\u0432\u0430\u043D\u0430",
      lockedBatch.body?.sold === 0 && lockedBatch.body?.skipped?.[0]?.reason === "locked",
      String(lockedBatch.body?.skipped?.[0]?.reason)
    );
  }
  console.log("\n\u0410\u043D\u043E\u043D\u0438\u043C\u043D\u044B\u0435 \u043D\u043E\u043C\u0435\u0440\u0430");
  const notAdminAnon = await call("/api/admin/anonymous", {
    method: "POST",
    user: PLAYER,
    body: { count: 1 }
  });
  check("\u043E\u0431\u044B\u0447\u043D\u043E\u043C\u0443 \u0438\u0433\u0440\u043E\u043A\u0443 \u0430\u043D\u043E\u043D\u0438\u043C\u043D\u044B\u0435 \u043D\u0435 \u0432\u044B\u0434\u0430\u044E\u0442\u0441\u044F", notAdminAnon.status === 403, `\u043A\u043E\u0434 ${notAdminAnon.status}`);
  const tooMany = await call("/api/admin/anonymous", {
    method: "POST",
    user: ADMIN,
    body: { count: 99 }
  });
  check("\u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u0430\u044F \u043F\u0430\u0440\u0442\u0438\u044F \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430", tooMany.status === 400, `\u043A\u043E\u0434 ${tooMany.status}`);
  const beforeAnon = (await call("/api/state", { user: ADMIN })).body?.state?.numbers?.length ?? 0;
  const gave = await call("/api/admin/anonymous", {
    method: "POST",
    user: ADMIN,
    body: { count: 2 }
  });
  check("\u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440 \u043F\u043E\u043B\u0443\u0447\u0438\u043B \u0430\u043D\u043E\u043D\u0438\u043C\u043D\u044B\u0435", gave.status === 200, `\u043A\u043E\u0434 ${gave.status}`);
  check(
    "\u0432\u044B\u0434\u0430\u043D\u043E \u0440\u043E\u0432\u043D\u043E \u0434\u0432\u0430 \u0441 \u043A\u043E\u0434\u043E\u043C +888",
    (gave.body?.numbers ?? []).length === 2 && gave.body.numbers.every((item) => item.display.startsWith("+888")),
    String(gave.body?.numbers?.[0]?.display)
  );
  check(
    "\u0432\u044B\u0434\u0430\u0447\u0430 \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u0430 \u2014 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F \u0432\u044B\u0440\u043E\u0441\u043B\u0430 \u043D\u0430 \u0434\u0432\u0430",
    ((await call("/api/state", { user: ADMIN })).body?.state?.numbers?.length ?? 0) === beforeAnon + 2
  );
  console.log("\n\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442 \u0431\u043E\u0442\u0430");
  const noSecret = await call("/internal/profile", {
    method: "POST",
    body: { telegramId: Number(PLAYER) }
  });
  check("\u0431\u0435\u0437 \u0441\u0435\u043A\u0440\u0435\u0442\u0430 \u0437\u0430\u043A\u0440\u044B\u0442\u043E", noSecret.status === 401, `\u043A\u043E\u0434 ${noSecret.status}`);
  const wrongSecret = await call("/internal/profile", {
    method: "POST",
    botSecret: "wrong-secret-value",
    body: { telegramId: Number(PLAYER) }
  });
  check("\u0441 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u043C \u0441\u0435\u043A\u0440\u0435\u0442\u043E\u043C \u0437\u0430\u043A\u0440\u044B\u0442\u043E", wrongSecret.status === 401, `\u043A\u043E\u0434 ${wrongSecret.status}`);
  const existing = await call("/internal/profile", {
    method: "POST",
    botSecret: SECRET,
    body: { telegramId: Number(PLAYER) }
  });
  check("\u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0438\u0433\u0440\u0430\u044E\u0449\u0435\u0433\u043E \u043E\u0442\u0434\u0430\u0451\u0442\u0441\u044F", existing.status === 200, `\u043A\u043E\u0434 ${existing.status}`);
  check(
    "\u0432 \u043F\u0440\u043E\u0444\u0438\u043B\u0435 \u0435\u0441\u0442\u044C \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0438 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F",
    typeof existing.body?.profile?.level === "number" && typeof existing.body?.profile?.numbers === "number",
    JSON.stringify(existing.body?.profile)
  );
  const stranger = await call("/internal/profile", {
    method: "POST",
    botSecret: SECRET,
    body: { telegramId: 999888777 }
  });
  check(
    "\u043D\u0435\u0437\u043D\u0430\u043A\u043E\u043C\u0435\u0446 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F \u0438 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 \u043F\u0443\u0441\u0442\u043E\u0439 \u043E\u0442\u0432\u0435\u0442",
    stranger.status === 200 && stranger.body?.profile === null,
    JSON.stringify(stranger.body)
  );
  console.log("\n\u041E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u0447\u0430\u0441\u0442\u043E\u0442\u044B");
  const burst = [];
  for (let i = 0; i < 60; i += 1) {
    const attempt = await call("/api/release", {
      method: "POST",
      user: PLAYER,
      body: { tariffId: "standard", countryId: "ru" }
    });
    burst.push(attempt.status);
    if (attempt.status === 429) break;
  }
  check("\u0444\u043B\u0443\u0434 \u0432\u044B\u043F\u0443\u0441\u043A\u0430\u043C\u0438 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D", burst.includes(429), `\u0441\u0442\u0430\u0442\u0443\u0441\u044B: ${[...new Set(burst)].join(", ")}`);
}
async function main() {
  const ready = await waitForServer();
  if (!ready) {
    console.error("\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u043D\u044F\u043B\u0441\u044F \u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u0430");
    process.exit(1);
  }
  await run();
  console.log(failures === 0 ? "\n\u0421\u041A\u0412\u041E\u0417\u041D\u0410\u042F \u041F\u0420\u041E\u0412\u0415\u0420\u041A\u0410 \u041F\u0420\u041E\u0419\u0414\u0415\u041D\u0410" : `
\u041F\u0420\u041E\u0412\u0410\u041B\u041E\u0412: ${failures}`);
  process.exitCode = failures === 0 ? 0 : 1;
}
process.on("uncaughtException", (error) => {
  console.error("\n[smoke] \u043D\u0435\u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043D\u043E\u0435 \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435:", error);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("\n[smoke] \u043D\u0435\u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043D\u044B\u0439 \u043E\u0442\u043A\u0430\u0437:", reason);
  process.exit(1);
});
void main();
//# sourceMappingURL=smoke.mjs.map
