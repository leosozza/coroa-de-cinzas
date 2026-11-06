-- Fase 2 (a): replays, perfil e Arcano ranqueado. Cada partida terminada guarda o necessário para o motor reproduzi-la
-- inteira (semente, grimórios e a lista de ações aceitas pelo servidor), os nomes da época e a variação de nota.
ALTER TABLE games ADD COLUMN seed INTEGER;
ALTER TABLE games ADD COLUMN deck_w TEXT;
ALTER TABLE games ADD COLUMN deck_b TEXT;
ALTER TABLE games ADD COLUMN actions TEXT;      -- JSON: [{type:'move', from, to, promotion?} | {type:'card', uid, picks} | {type:'end'}]
ALTER TABLE games ADD COLUMN rules TEXT;        -- carimbo das regras (versão do motor + catálogo)
ALTER TABLE games ADD COLUMN w_name TEXT;
ALTER TABLE games ADD COLUMN b_name TEXT;
ALTER TABLE games ADD COLUMN w_delta INTEGER;   -- variação de nota na ranqueada
ALTER TABLE games ADD COLUMN b_delta INTEGER;
CREATE INDEX IF NOT EXISTS games_ended ON games(ended);
