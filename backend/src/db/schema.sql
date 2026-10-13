-- language: SQL, file: backend/src/db/schema.sql
-- Схема базы. Номера и операции лежат отдельными таблицами, а не одним JSON:
-- так право владения и защита от двойной продажи обеспечиваются ключами БД.

CREATE TABLE IF NOT EXISTS players (
  id              BIGSERIAL PRIMARY KEY,
  telegram_id     BIGINT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  username        TEXT,
  avatar_url      TEXT,
  balance         BIGINT NOT NULL DEFAULT 99800,
  tickets         INTEGER NOT NULL DEFAULT 1,
  level           INTEGER NOT NULL DEFAULT 1,
  xp              INTEGER NOT NULL DEFAULT 0,
  primary_number_id TEXT,
  free_primary_swaps INTEGER NOT NULL DEFAULT 3,
  daily_streak    INTEGER NOT NULL DEFAULT 1,
  luck_multiplier NUMERIC(6,2) NOT NULL DEFAULT 2,
  luck_expires_at TIMESTAMPTZ,
  selected_tariff TEXT NOT NULL DEFAULT 'standard',
  selected_country TEXT,
  is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Отрицательный баланс запрещён на уровне схемы, а не только кодом.
  CONSTRAINT players_balance_non_negative CHECK (balance >= 0),
  CONSTRAINT players_level_positive CHECK (level >= 1)
);

-- Журнал выпусков. Первичный ключ release_id — жёсткая защита от повторного
-- списания по одному и тому же запросу, даже если он придёт одновременно дважды.
CREATE TABLE IF NOT EXISTS releases (
  release_id  TEXT PRIMARY KEY,
  player_id   BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  number_id   TEXT NOT NULL,
  tariff_id   TEXT NOT NULL,
  country_id  TEXT NOT NULL,
  cost        BIGINT NOT NULL,
  tickets     INTEGER NOT NULL DEFAULT 0,
  rarity      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS releases_player_idx ON releases (player_id, created_at DESC);

CREATE TABLE IF NOT EXISTS numbers (
  id                 TEXT PRIMARY KEY,
  player_id          BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  release_id         TEXT NOT NULL REFERENCES releases(release_id) ON DELETE CASCADE,
  display            TEXT NOT NULL,
  digits             TEXT NOT NULL,
  country_id         TEXT NOT NULL,
  region_code        TEXT NOT NULL,
  operator_id        TEXT NOT NULL,
  tariff_id          TEXT NOT NULL,
  rarity             TEXT NOT NULL,
  base_price         BIGINT NOT NULL,
  pattern_multiplier NUMERIC(8,2) NOT NULL,
  demand_multiplier  NUMERIC(8,2) NOT NULL,
  final_price        BIGINT NOT NULL,
  score              INTEGER NOT NULL,
  patterns           JSONB NOT NULL DEFAULT '[]'::jsonb,
  limited_edition    INTEGER,
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS numbers_player_idx ON numbers (player_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS numbers_rarity_idx ON numbers (rarity);

CREATE TABLE IF NOT EXISTS ledger (
  id         TEXT PRIMARY KEY,
  player_id  BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  amount     BIGINT NOT NULL,
  label      TEXT NOT NULL,
  number_id  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_player_idx ON ledger (player_id, created_at DESC);

-- Переопределения игровых параметров из админ-панели.
CREATE TABLE IF NOT EXISTS game_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_by BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Журнал действий администраторов и ошибок сервера.
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  actor_id   BIGINT,
  action     TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);

-- Учёт миграций: какие файлы уже применены.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name       TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Достижения, за которые награда уже получена.
-- ALTER, а не CREATE: у уже развёрнутой базы таблица существует, и колонку
-- нужно добавить к ней. Оператор идемпотентен, повторный запуск безопасен.
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS claimed_achievements TEXT[] NOT NULL DEFAULT '{}';

-- Выбранный оператор и код: с ними выпускается следующий номер.
ALTER TABLE players ADD COLUMN IF NOT EXISTS selected_operator TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS selected_code TEXT;

-- Призы рулетки: удача по круткам и бесплатные выпуски.
ALTER TABLE players ADD COLUMN IF NOT EXISTS luck_spins INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS free_releases INT NOT NULL DEFAULT 0;

-- Погашенные промокоды игрока: повторно тот же код не сработает.
ALTER TABLE players ADD COLUMN IF NOT EXISTS used_promo_codes TEXT[] NOT NULL DEFAULT '{}';

-- Общий тираж промокодов. Считается отдельно от игроков: ограничение общее
-- для всех, а не «по разу каждому».
CREATE TABLE IF NOT EXISTS promo_uses (
  code TEXT PRIMARY KEY,
  uses INT NOT NULL DEFAULT 0
);

-- Промокоды, созданные в админке. Хранятся отдельно от зашитых в игру.
CREATE TABLE IF NOT EXISTS custom_promos (
  code       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  kind       TEXT NOT NULL,
  amount     INTEGER NOT NULL DEFAULT 0,
  max_uses   INTEGER,
  until      DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
