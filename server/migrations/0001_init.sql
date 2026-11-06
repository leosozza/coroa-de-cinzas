-- Arcane Chess online, fase 1: contas (convidado agora; Google e Discord depois), notas e partidas.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'guest',          -- guest | account
  name TEXT NOT NULL,
  created INTEGER NOT NULL,                     -- epoch ms
  last_seen INTEGER,
  birth TEXT,                                   -- AAAA-MM-DD, pedido ao virar conta (LGPD, menores)
  deleted INTEGER NOT NULL DEFAULT 0
);
-- login externo ligado a um usuário (o convidado vira conta sem perder o progresso)
CREATE TABLE IF NOT EXISTS identities (
  provider TEXT NOT NULL,                       -- google | discord
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  created INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
);
-- Glicko-2: uma nota por modo (xadrez = Xadrez Puro, arcano), começando em 1500
CREATE TABLE IF NOT EXISTS ratings (
  user_id TEXT NOT NULL REFERENCES users(id),
  pool TEXT NOT NULL,
  r REAL NOT NULL DEFAULT 1500,
  rd REAL NOT NULL DEFAULT 350,
  vol REAL NOT NULL DEFAULT 0.06,
  games INTEGER NOT NULL DEFAULT 0,
  updated INTEGER,
  PRIMARY KEY (user_id, pool)
);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,                          -- id da sala
  mode TEXT NOT NULL,                           -- xadrez | arcano
  tc TEXT NOT NULL,
  ranked INTEGER NOT NULL DEFAULT 0,
  white TEXT, black TEXT,
  result TEXT,                                  -- 1-0 | 0-1 | 1/2-1/2 | abortada
  reason TEXT,                                  -- mate, tempo, abandono, desistencia, acordo, afogamento, repeticao...
  plies INTEGER NOT NULL DEFAULT 0,
  started INTEGER, ended INTEGER,
  moves TEXT                                    -- lances em SAN separados por espaço (replay básico)
);
CREATE INDEX IF NOT EXISTS games_white ON games(white, ended);
CREATE INDEX IF NOT EXISTS games_black ON games(black, ended);
