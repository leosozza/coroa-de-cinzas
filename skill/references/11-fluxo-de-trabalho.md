# 11 — Fluxo de trabalho: subagente, publicação e GitHub

## Trabalhar com o subagente

- **Um único subagente** (design-squad-ui-engineer) constrói o jogo, retomado com `SendMessage` a cada pedido. Ele conhece o arquivo inteiro, e isso vale mais do que começar do zero.
- **Ele trabalha numa cópia** e só sobrescreve o arquivo principal quando os testes passam. Assim o arquivo nunca fica pela metade quando você publica.
- **Peça relatório por fase,** ou a cada duas arenas, para publicar aos poucos.
- **Toda mensagem lembra as correções que não podem voltar:** a ordem `.gltf.json` no carregador e o `__viaImg` do `ImageBitmapLoader`. Numa rodada sem esse lembrete, ele desfez a ordem e os modelos sumiram do Artifact.
- **Pedidos do usuário vão na hora,** mesmo com o agente trabalhando (ficam na fila). Correções visuais têm prioridade sobre funcionalidade nova.
- **Paralelismo:** o jogo é um arquivo só, então só um agente escreve nele. Assets (Gemini, Meshy, ElevenLabs) rodam em paralelo, em segundo plano.

## Publicar

1. Copie o arquivo do jogo para um **snapshot** no scratchpad, porque o agente pode estar editando o original.
2. Embrulhe o snapshot com doctype e sirva com `scripts/servidor_csp.py` junto com os assets publicados (só os `.gltf.json`).
3. Teste no navegador a 1280 px e, quando mudar o layout, a 375 px:
   - troque para as arenas novas;
   - olhe o console filtrando por `Uncaught|TypeError|Content Security`.
4. Publique o **snapshot** no Artifact existente passando `url`. Publicar um caminho de arquivo diferente sem `url` cria outro Artifact.
5. Mande nos `files` só os assets novos. Os anteriores ficam.

## GitHub (o usuário pediu push automático a cada versão publicada)

```bash
git add -A -- . ':!coroa-de-cinzas.html'
BLOB=$(git hash-object -w "$SNAP"); git update-index --cacheinfo 100644,$BLOB,coroa-de-cinzas.html   # versiona o snapshot publicado
git grep --cached -nIE "AIza[0-9A-Za-z_-]{20,}|msy_[0-9A-Za-z]{10,}|sk_[0-9a-f]{20,}|gho_[0-9A-Za-z]{20,}|Bearer [0-9A-Za-z_-]{30,}" -- . ':!*.json' ':!*.glb' && exit 1
git commit -m "<o que mudou>" && git push origin main
```
- O primeiro push de ~50 MB caiu ("unexpected disconnect"). `git config http.postBuffer 524288000` resolveu.
- O repositório é privado, com o README atualizado a cada versão (arenas e recursos).

## Tarefas agendadas e créditos

- **O Meshy renova os créditos** em `monthly_resets_at`. Um laço em segundo plano espera o horário, confere o saldo e gera as peças em paralelo.
- **Se o app fechar, o laço morre:** confira no reinício e recomece. O agendamento reiniciado sobrescreve o anterior: pare o antigo com TaskStop.
- **Antes de gastar:** mostre o custo, confira o saldo e peça a aprovação.
