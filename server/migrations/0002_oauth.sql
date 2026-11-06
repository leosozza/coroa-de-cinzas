-- Fase 1 (c): login com Google e Discord. Estados do fluxo (state + PKCE) e códigos de volta ao jogo, ambos de uso único e curtos.
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  verifier TEXT NOT NULL,           -- PKCE code_verifier (fica só no servidor)
  guest_id TEXT,                    -- convidado que pediu o login (vira conta ou é fundido nela)
  return_url TEXT NOT NULL,         -- página do jogo para voltar (origem conferida em ALLOWED_ORIGINS)
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_codes (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created INTEGER NOT NULL
);
-- convidado fundido numa conta que já existia
ALTER TABLE users ADD COLUMN merged_into TEXT;
