# Arcane Chess — plano do modo online e comercial (aprovado em 05/11/2026)

Doc original: https://claude.ai/artifact/3paPjdZHueCGXtBjXxABHL. O usuário aprovou tudo ("segue a sugestão"). Este arquivo é a cópia para quem não lê o doc.

## Decisões aprovadas

| # | Tema | Decisão |
|---|---|---|
| 1 | Servidor | Cloudflare: Pages (cliente, já em arcanechess.pages.dev), Worker (API), Durable Objects (uma sala por partida, uma fila por modo), D1 (dados), R2 (replays) |
| 2 | Login | Google e Discord no beta, mais o modo convidado, que vira conta sem perder o progresso. Apple só com app iOS |
| 3 | Beta | Partida por link + fila ranqueada de Xadrez Puro. O Arcano ranqueado só depois de balancear as cartas |
| 4 | Cartas | Cartas que mexem no jogo só se ganham jogando ou fabricando (Pó Arcano). O dinheiro compra só cosméticos e o Passe |
| 5 | Gacha | Nada aleatório por dinheiro. Pacotes e baús só com moeda grátis, com as chances à mostra |
| 6 | Pagamentos | Stripe (cartão e Pix) no site; Mercado Pago como alternativa |
| 7 | Oráculo contra humanos | Mostra o melhor lance que o motor prevê para o rival (contra a IA continua garantido) |
| 8 | Ligas | Aprendiz (<1200), Alquimista (1200–1499), Mestre Arcano (1500–1799), Inquisidor da Aurora (1800+), Grão-Mestre Arcano (top 500) |
| 9 | Celular | Site instalável (PWA) primeiro; lojas depois |

## Regras que afetam o código desde já

- O servidor é a autoridade: valida lances e cartas, guarda mãos e grimórios escondidos e sorteia. Por isso o motor de regras (xadrez + Arcano) deve ser um módulo JS puro, sem DOM nem THREE, com estado serializável em JSON e RNG com semente injetável.
- Duas notas Glicko-2 por jogador (Xadrez Puro e Arcano), começando em 1500. Temporadas de 8–10 semanas com redução parcial no fim.
- Filas: amistosa por link, casual, ranqueada Xadrez Puro (10 min ou 3+2), ranqueada Arcano (12 min + 5 s), Aprendiz/treino contra IA. Sem rival em ~30 s, a fila oferece a IA no nível da nota.
- Queda de conexão: 60 s para voltar, depois derrota.
- Moedas: Ouro de Runa (grátis; o nome evita confundir com a Essência das partidas do Arcano), Pó Arcano (crafting), Gemas de Mana (paga, só cosméticos e Passe).
- Maestria das peças destrava só visuais e sons, nunca poder.
- Cadastro pede data de nascimento; compras de menores precisam de consentimento; botão para apagar conta e dados (LGPD).

## Roteiro

0. Arcano offline (em andamento): motor, 42 cartas, IA com cartas, balanceamento IA x IA. Passa quando nenhuma carta ou deck vencer mais de 55% e o motor rodar sem gráficos.
1. Beta online: convidado + Google/Discord, partida por link, filas casual e ranqueada de Xadrez Puro, Glicko-2, ligas, reconexão, IA de reserva. Passa com 50–100 testadores por uma semana sem erros de servidor e com menos de 2% de quedas.
2. Engajamento: Grimório e decks, ranqueada Arcano, perfil com estatísticas, histórico e replays, temporadas, missões diárias, desafio do dia.
3. Monetização: Gemas, loja de cosméticos, Passe Arcano, maestria, pacotes por Ouro, Stripe com Pix, termos e privacidade. Passa só com parecer jurídico sobre compras e menores (Lei 15.211/2025, ECA Digital) e pagamento testado no modo de teste do Stripe.
4. Depois: apps nas lojas, torneios, clãs, espectador online.

## Fase 1 — decisões de implementação (06/11/2026, aprovadas de antemão pelo usuário)

Ordem de entrega: (a) convidado + partida por link + relógio + reconexão; (b) Glicko-2, ligas, filas casual e ranqueada de Xadrez Puro, IA de reserva; (c) Google e Discord com o convidado virando conta; (d) cliente online no jogo.

| # | Tema | Decisão |
|---|---|---|
| F1 | Motor no servidor | O servidor usa `engine/arcano-rules.js` sem cópia. O Xadrez Puro é o mesmo motor com `create({ pure:true })`: sem cartas, essência, espólio nem runas, e o turno fecha sozinho depois do lance. Conferido contra o chess.js (200 partidas, 60.900 lances, 0 divergências) |
| F2 | Sessão | Ficha assinada com HMAC-SHA256 (`SESSION_SECRET` só como segredo do Worker), válida por 90 dias. O convidado ganha um id `g_…` e um nome (3 a 20 caracteres, só letras, números, espaço, ponto, hífen e sublinhado; sem nome vira "Convidado 1234") |
| F3 | WebSocket | A ficha vai na 1ª mensagem (`hello`), nunca na URL |
| F4 | Sala por link | Id de 8 caracteres sem letras ambíguas. O criador escolhe a cor (ou sorteio) e, no Arcano, o grimório; o rival recebe outro grimório. Quem chega depois dos dois lugares assiste. Link: `arcanechess.pages.dev/#sala=<id>` |
| F5 | Ritmos | Xadrez Puro 10+0 (padrão), 3+2 e 5+3; Arcano 12+5 (padrão); amistosa também "livre" (sem relógio). O relógio do Arcano corre na fase de lance e na de cartas de quem age; o incremento entra quando a vez passa |
| F6 | Primeiro lance | O relógio só começa no 1º lance. Se as Brancas não lançarem em 60 s, a partida é cancelada sem resultado. Desistir antes do 1º lance também só cancela |
| F7 | Tempo esgotado | Perde quem zerou. No Xadrez Puro vira empate se o vencedor não tiver material para dar mate (só Rei ou uma peça menor), como no xadrez |
| F8 | Reconexão | Ao cair, o jogador tem 60 s para voltar ao mesmo lugar (outra aba conta). Se os dois caírem, perde quem caiu primeiro; se os prazos vencerem juntos, empate |
| F9 | Informação escondida | Cada jogador recebe `viewFor` do motor. Os eventos também são filtrados: compras e queimas do rival, qual armadilha foi armada e onde, e a previsão do Oráculo chegam mascaradas. O espectador não vê mão nem armadilha de ninguém |
| F10 | Registro | Toda partida terminada (ou cancelada) vai para a tabela `games` do D1 com resultado, motivo, número de lances e o SAN (replay básico) |
| F11 | IA de reserva | Roda no aparelho do jogador (o mesmo motor e a mesma IA do jogo offline) e não vale nota. Assim não gasta CPU do Worker, que tem limite curto por requisição |
| F12 | Origem | O Worker só aceita chamadas de `arcanechess.pages.dev` e do servidor local de teste (CORS) |
| F13 | Glicko-2 | Cada partida ranqueada é um período. Antes dela o desvio cresce com os dias parados (σ por dia), entre 45 e 350; τ = 0,5. Nota provisória (mostrada com "?") enquanto o desvio passar de 110. Conferido contra o exemplo do artigo de Glickman (1464,05 / 151,52 / 0,06) |
| F14 | Ligas | Pela nota: Aprendiz < 1200, Alquimista 1200–1499, Mestre Arcano 1500–1799, Inquisidor da Aurora 1800+. Grão-Mestre Arcano: os 500 primeiros entre contas com nota firme. O convidado joga a ranqueada e leva a nota quando virar conta, mas não entra no ranking nem no topo |
| F15 | Filas | Ranqueada de Xadrez Puro 10+0 e 3+2; casual 10+0, 3+2 e 5+3 (a casual também pareia pela nota, mas não mexe nela). Janela de nota: 150 pontos, +25 por segundo de espera; na ranqueada até 500, na casual sem limite depois de 20 s. Cores sorteadas. A mesma pessoa em duas abas: fica a mais nova |
| F16 | IA de reserva | Aos 30 s sem rival a fila oferece a IA pelo nível da nota (Recruta < 1300, Veterano < 1700, Mestre acima) e continua procurando; aceitar sai da fila e joga no aparelho, sem nota |
| F17 | Sala da fila | Os dois têm 30 s para entrar; se um não aparece, a sala é cancelada sem nota. Na ranqueada contam mate, tempo, abandono, desistência e empates; partida cancelada não conta |
| F18 | Arcano ranqueado | Fica para a fase 2 (plano). A nota do Arcano já existe separada, começando em 1500 |
| F19 | Endereço do servidor | Uma constante no jogo: `ONLINE_API` (hoje `https://arcane-chess-api.arcanechess.workers.dev`). Para teste local vale `?api=http://127.0.0.1:8787`, aceito só para localhost/127.0.0.1 |
| F20 | Sem servidor | O menu "Jogar online" mostra "Servidor indisponível" com "Tentar de novo"; nada mais muda. No Artifact a CSP bloqueia a conexão e cai no mesmo aviso. Os outros modos não tocam na rede |
| F21 | Autoridade no cliente | O lance (e a carta, e o fim do turno) só anda na tela quando o servidor confirma; a vez do rival entra pelo mesmo caminho da IA, com as mesmas animações. Qualquer diferença (reconexão, mensagem perdida) reconstrói a cena a partir do estado do servidor |
| F22 | Link e reconexão | Link `<página>#sala=<código>`; o código também pode ser colado (maiúsculas ou minúsculas). Ao cair, o jogo reconecta sozinho (1, 2, 4… até 15 s) e a barra mostra "Reconectando"; recarregar a página com o link volta à partida |
| F23 | Durante a partida | Barra online com os dois jogadores, presença (caiu, volta em 0:45), prazo do 1º lance, oferecer/aceitar empate e desistir com confirmação. "Nova partida" abre o menu online sem sair (Voltar à partida retoma); começar outro modo encerra a conexão (e o servidor conta abandono depois de 60 s). Sem desfazer e sem salvar a partida online no aparelho |
| F24 | Fila e IA | A fila mostra espera, tamanho e janela; aos 30 s aparece "Jogar contra a IA (nível), sem nota", que abre o Modo Padrão no aparelho. O nome pode ser trocado no menu sem perder a nota (`POST /api/name`) |
| F25 | Login | Google (escopos `openid profile`) e Discord (`identify`), código de autorização com `state` de uso único (10 min) e PKCE S256; a troca do código acontece no Worker com o segredo. Não pedimos e-mail: guardamos só o identificador do provedor (LGPD: o mínimo) |
| F26 | Volta ao jogo | O provedor volta ao Worker, que manda o navegador para a página do jogo com `#login=<código>` de uso único (2 min); o jogo troca esse código pela ficha em `POST /api/auth/exchange`. A ficha nunca passa por URL. A página de volta precisa estar numa origem de `ALLOWED_ORIGINS` (sem redirecionamento aberto) |
| F27 | Convidado vira conta | Primeiro login: o próprio convidado vira conta (mesmo id, mesma nota e histórico); o nome padrão "Convidado 1234" dá lugar ao nome do provedor, e um nome escolhido é mantido. Login de um convidado numa conta que já existe: ele é fundido nela — em cada modo fica a nota com mais partidas (empate: a de menor desvio), as partidas somam, o histórico passa para a conta e a ficha antiga deixa de valer |
| F28 | Data de nascimento | Pedida no menu depois do primeiro login (campo de data; não aparece para ninguém); aceita idades de 3 a 120 anos. Necessária para as regras de compra de menores da fase 3 |
| F29 | Sair | "Sair da conta" esquece a ficha neste aparelho e volta a convidado novo; a conta e a nota ficam no servidor |
