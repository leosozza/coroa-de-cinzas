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
