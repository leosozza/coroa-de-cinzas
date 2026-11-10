-- Conquista dos Mundos: progresso da campanha por conta (estrelas por fase, cartas ganhas e Selos).
-- As estrelas são bits (1 = venceu, 2 = capturou o Portador e venceu, 4 = venceu em até 30 lances); a gravação só soma bits,
-- nunca apaga uma estrela já ganha.
CREATE TABLE IF NOT EXISTS campaign_progress (
  user_id TEXT NOT NULL REFERENCES users(id),
  phase TEXT NOT NULL,                          -- "<mundo>-<fase>", de 1-1 a 8-6
  stars INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL,
  PRIMARY KEY (user_id, phase)
);
CREATE TABLE IF NOT EXISTS campaign_items (
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,                           -- carta | selo
  item TEXT NOT NULL,                           -- nome da carta ou número do mundo do Selo
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, item)
);
