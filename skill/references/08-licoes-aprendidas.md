# 08 — Lições aprendidas (leia antes de começar)

## Conceito
- Confirme cedo se as regras são as do jogo original ou mecânicas próprias. A primeira versão (PV, dano, níveis, habilidades) foi descartada quando o usuário disse "as regras são as mesmas do xadrez, apenas os gráficos do RPG".
- Defina se os dois lados usam os mesmos modelos. Isso corta o custo de assets pela metade.
- Pergunte o "poder" de cada personagem antes de gerar a arte: ele muda o design (a Torre virou torre com arqueiro e o Cavalo virou cavaleiro montado depois da primeira leva).

## Créditos
- Leia o saldo do Meshy pela API antes de cada leva: 48 créditos sumiram usados fora da API (no site).
- Gere **um** personagem de teste e aprove antes de gerar o resto.
- Não humanoides sem rig custam ~15 créditos em vez de ~29.
- Na geração a partir da imagem, a caminhada vem grátis com o rig; pague só parado, ataque e morte.
- O Meshy renova os créditos mensais numa data fixa (`monthly_resets_at` no endpoint de saldo). Dá para agendar a geração para depois dela.

## Arte e modelos
- Texto direto no Meshy perde detalhes (elmo, escudo, lança). Imagem do Gemini como entrada dá modelos fiéis.
- Gere a primeira arte, aprove e use-a como referência de estilo das outras.
- O A-pose do Meshy remove armas e itens das mãos; recoloque-os como adereços nos ossos.
- Armadura Meshy em escala 0,01: meça pelos vértices deformados, não pelo bounding box.
- `pose_mode: "a-pose"` estraga modelos não humanoides; use `""`.

## Artifact
- `.glb` não é servido: converta para `.gltf.json`.
- A CSP bloqueia `fetch(blob:)`: carregue texturas por `<img>` (patch do `ImageBitmapLoader`).
- O painel do navegador do app pode não estar logado no claude.ai. Para ver o jogo publicado, use o Chrome do usuário (Claude in Chrome).
- Quem estava com a página aberta durante uma atualização pode precisar recarregar.
- Áudio só depois do primeiro gesto; nada pode travar a jogabilidade esperando áudio ou modelo.

## Chaves
- Guarde as chaves no Keychain com `security add-generic-password ... -w` e **cole só quando o terminal pedir**. Uma chave digitada solta foi para o histórico do shell.
- Os scripts leem a chave do Keychain e nunca a imprimem; verificações mostram só o tamanho e o prefixo.
- O servidor MCP do Meshy por `npx` travou num cache corrompido. Instalado numa pasta própria e chamado com `node`, ficou estável.

## Processo
- Tarefas longas em segundo plano (geração em paralelo) e um "monitor" que avisa quando todas terminam.
- Tarefas agendadas por um laço de espera morrem se o app fechar; confira e reinicie.
- Os arquivos de uma sessão sem pasta ficam numa pasta temporária do app: mova o projeto para uma pasta permanente cedo.

## Lições da segunda etapa (arenas, modos e cartas)
- O usuário manda imagens de referência para ilustrar a ideia, não para copiar: melhore a composição e mantenha o tabuleiro legível.
- Tingir os exércitos com a cor do tema destrói a leitura das peças. As peças ficam sempre com a textura e a cor da facção, e o tema muda o entorno e os efeitos.
- Blocos cinza sem textura deixam a arena com cara de rascunho. Menos objetos e mais bem feitos.
- Todas as peças se mexendo ao mesmo tempo cansa. Anime só a peça selecionada.
- Torre e Cavalo pequenos demais perto do Peão: componha (torre + arqueiro do tamanho do Peão, cavalo + cavaleiro proporcional) e teste a altura total contra as peças vizinhas.
- Uma lança fundida no modelo não abaixa. Gere o modelo com a mão vazia e faça a lança no jogo.
- Um dragão "no céu" com a câmera inclinada demais quase não aparece: ponha os dragões voando na faixa visível, acompanhando a câmera.
- Imagens coladas só no chat não viram arquivo: descreva-as em texto para o subagente.
- O subagente não lê documentos Claude Docs: exporte as decisões para `data/*.md` e `data/*.json`.
- A conexão com o Gemini cai em lotes grandes ("Broken pipe"): repita por item e retome de onde parou.
- O Gemini (Interactions API) só devolve `image/jpeg` em `response_format`.
- Publicar um arquivo de outro caminho sem `url` cria um Artifact novo. Para atualizar, passe a `url`.
