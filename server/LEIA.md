# Servidor online do Arcane Chess

Worker (API) + Durable Object `GameRoom` (uma sala por partida) + D1. As regras vêm de `../engine/arcano-rules.js`, o mesmo motor embutido no jogo, sem cópia. Se o motor mudar, mude no HTML, regenere o módulo e rode `node tools/engine-sync-check.js`.

## Rodar local (sem conta, sem custo)
```
cd server
cp .dev.vars.example .dev.vars            # troque o valor; para os testes use também RECONNECT_MS=3000, FIRST_MOVE_MS=8000, DEV_TC=1
npx -y wrangler@4 d1 migrations apply arcane-chess --local
npx -y wrangler@4 dev --local --port 8787 --ip 127.0.0.1
node test/e2e.mjs                         # noutro terminal: 33 verificações (sala por link)
node test/queue.mjs                       # 23 verificações (filas, Glicko-2, ligas); .dev.vars com QUEUE_AI_MS=4000 e SHOW_MS=5000
node test/glicko2.test.mjs                # Glicko-2 contra o exemplo do artigo
```

## Criar na nuvem (dono da conta)
```
npx wrangler@4 d1 create arcane-chess                        # cole o database_id no wrangler.toml
npx wrangler@4 d1 migrations apply arcane-chess --remote
npx wrangler@4 secret put SESSION_SECRET                     # valor aleatório longo
npx wrangler@4 deploy
```
Durable Objects com SQLite e D1 cabem no plano gratuito. `DEV_TC`, `RECONNECT_MS`, `FIRST_MOVE_MS`, `QUEUE_AI_MS` e `SHOW_MS` não devem existir em produção (padrões: 60 s, 60 s, 30 s e 30 s).

## Protocolo
- `POST /api/guest {name?}` → `{ token, user }`. A ficha vai no `Authorization: Bearer` e na 1ª mensagem do WebSocket.
- `POST /api/rooms {mode:'xadrez'|'arcano', tc:'10+0'|'3+2'|'5+3'|'12+5'|'livre', color:'w'|'b'|'random', deck?}` → `{ id, link }` (link `https://arcanechess.pages.dev/#sala=<id>`).
- `GET /api/rooms/:id` → estado público da sala. `GET /api/rooms/:id/ws` → WebSocket.
- Cliente → sala: `{t:'hello', token}`, `{t:'act', a:{type:'move', from, to, promotion?} | {type:'card', uid, picks} | {type:'end'}}`, `{t:'resign'}`, `{t:'draw', op:'offer'|'accept'|'decline'}`, `{t:'ping'}`.
- Sala → cliente: `welcome` (lugar: `w`, `b` ou `null` para espectador), `state` (vista do motor para aquele lugar, eventos filtrados, relógios, presença, oferta de empate), `error`, `pong`.
- Fila: `GET /api/queue/ranked|casual/<ritmo>/ws`, 1ª mensagem `{t:'hello', token}`. A fila manda `queued`, `waiting` (espera, tamanho, janela), `offer-ai` (nível 1–3), `match` (`room`, `color`, `ranked`, `opponent`) ou `replaced` (outra aba). Depois do `match`, o cliente entra na sala pelo WebSocket da sala.
- `GET /api/me` traz `ratings.xadrez` e `ratings.arcano` (`r`, `rd`, `games`, `provisional`, `league`, `leagueName`, `rank`). `GET /api/leaderboard?pool=xadrez`. `GET /api/config` (ritmos, filas, ligas).
- Fim de partida ranqueada: `result.rating = { w:{ before, after, delta, rd }, b:{…} }`.

## Cliente no jogo
- O endereço do servidor é a constante `ONLINE_API` em `coroa-de-cinzas.html` (procure por `ONLINE_API =`). Teste local: abra o jogo servido em `http://localhost:8767/...?api=http://127.0.0.1:8787` (o `?api=` só aceita localhost e 127.0.0.1).
- Para testar duas abas reais com recarga de página, use no `.dev.vars` `RECONNECT_MS=30000` e `FIRST_MOVE_MS=60000` (a página leva alguns segundos para carregar a cena); para `test/e2e.mjs` volte a 3000 e 8000.
- `POST /api/name {name}` troca o nome público sem perder a nota (devolve uma ficha nova).

## Login (Google e Discord)
- Fluxo: `POST /api/auth/start {provider, return}` (com a ficha do convidado) → URL do provedor com `state` e PKCE S256 → `GET /api/auth/<provedor>/callback` → página do jogo com `#login=<código de uso único>` → `POST /api/auth/exchange {code}` → `{ token, user }`. `GET /api/auth/providers` diz quais botões mostrar. `POST /api/me/birth {birth}`.
- Ids públicos: `GOOGLE_CLIENT_ID` e `DISCORD_CLIENT_ID` em `[vars]` do `wrangler.toml` (vazios escondem o botão). Segredos só com `npx wrangler@4 secret put GOOGLE_CLIENT_SECRET` e `npx wrangler@4 secret put DISCORD_CLIENT_SECRET`.
- Teste local: `DEV_AUTH=1` no `.dev.vars` liga o provedor falso (`/api/auth/fake/…`, com página de login e conferência real do PKCE); `node test/auth.mjs` (23 verificações). Nunca usar `DEV_AUTH` em produção.
- Migração nova: `migrations/0002_oauth.sql` (`oauth_states`, `login_codes`, `users.merged_into`). Na nuvem: `npx wrangler@4 d1 migrations apply arcane-chess --remote`.

## No ar (06/11/2026)

- API: https://arcane-chess-api.leonardo-zogbi.workers.dev (o `ONLINE_API` do jogo aponta para ela).
- D1 `arcane-chess` criado e com as migrações 0001 e 0002 aplicadas; `SESSION_SECRET` gravado como segredo (gerado na máquina, nunca impresso).
- Teste rápido contra o servidor publicado: `node test/smoke.mjs https://arcane-chess-api.leonardo-zogbi.workers.dev`
  (10 verificações: health, CORS, sala por link com mate, mão escondida no Arcano, pareamento na fila casual).
- Em produção nunca criar `DEV_AUTH`, `DEV_TC`, `RECONNECT_MS`, `FIRST_MOVE_MS`, `QUEUE_AI_MS` ou `SHOW_MS`.
- Login Google/Discord continua escondido até os apps serem registrados (ids em `wrangler.toml`, segredos por `wrangler secret put`).
