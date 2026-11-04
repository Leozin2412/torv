# Security — Importador de GPX, round 2 — 2026-10-14

**Owner:** Torv Security · **Branch:** `feat/perfil-terceiros-gpx` · **HEAD revisado:** `a3116d2` · **Escopo:** só o que mudou desde o round 1 (`a30f74e..HEAD`): `65331c9` (F2, fixtures sintéticas), `bbf8b8e` (F1, parser linear) e `a3116d2` (relatório QA, só doc) · **Round 1:** `docs/security-gpx-import-2026-10-14.md` · **QA:** `docs/qa-gpx-import-frontend-2026-10-14-round3.md` (PASS) · **Ambiente:** medição em processo (Node 24), nada no Furnace, nenhuma conta, nenhum dado escrito. O `.gpx` original (raiz, fora do git) foi lido só para comparar; **este relatório não reproduz nenhuma coordenada, só `arquivo:linha`.**

## Veredito: **FAIL** (1 Médio, 1 Baixo novo, 4 Informativos)

- **F1 (parser):** os vetores do round 1 estão **corrigidos**. Sobra um caso denso que ainda leva 10 s a 25 MB (linear, não ilimitado): **BAIXO** (F1b), correção de 4 linhas já testada.
- **F2 (fixtures):** as **fixtures** estão limpas, mas o HEAD **ainda carrega coordenada real e coordenada derivável** em 4 documentos (spec, plano, QA round 3 e o meu relatório do round 1). **MÉDIO** (F2b), correção só de texto, **sem reescrever histórico**.
- Backend: nenhum código de produção mudou desde o round 1 (só valores esperados em 5 arquivos de teste). Nada a reabrir lá.

Rework: F2b → Maestro (spec, plano, QA r3 e o meu r1 são docs dele/dos recruits); F1b → Frontend (opcional, a critério do Maestro).

## Resultado

| # | Ponto | Resultado | Evidência |
|---|---|---|---|
| 1 | F2 — fixtures `run-sample.json` e `run-sample.gpx` | **PASS** | Nenhum par lat/lon das 2.875 coordenadas originais (3 casas) aparece nas duas fixtures. Primeiro ponto, caixa de coordenadas e trilha totalmente fora da região original (deslocamento de >8° em cada eixo). Direção sem relação com o percurso: nos 2.756 passos com variação de latitude, mesmo sinal em 45% e correlação **−0,12** (acaso). |
| 2 | F2 — fixtures não permitem recuperar o local pelas outras colunas | **ACEITO (Info I1)** | Elevação, FC, cadência, horário e comprimento de cada passo são **idênticos ao original** (elevação igual em 2.875/2.875). Só serviria para casar perfil de altitude com mapa de relevo: teórico. |
| 3 | F2 — HEAD sem coordenada real nem derivável | **FAIL → F2b** | Varredura de todos os arquivos versionados no HEAD, par a par (3 casas): **coordenada real** em `docs/superpowers/specs/2026-10-14-gpx-import-design.md:162`; **coordenada do deslocamento antigo** em `docs/superpowers/plans/2026-10-14-gpx-import.md:97,109,391,1012,1371,1383,1759` e `docs/qa-gpx-import-frontend-2026-10-14-round3.md:27`; e o **valor do deslocamento** em `docs/security-gpx-import-2026-10-14.md:88` (meu relatório do round 1). Qualquer um dos dois últimos grupos, somado ao deslocamento, devolve a coordenada real. |
| 4 | F2 — mensagem de commit e plano sem a constante | **PARCIAL** | `65331c9` e o texto do passo 1 do plano (linha 131) já não trazem a constante. Mas ela continua no meu r1 (linha 88), no histórico (`cf10061`) e a coordenada deslocada continua no plano (itens acima). |
| 5 | F1 — arquivo legítimo de 25 MB | **PASS** | 28.263 pontos em 0,77 s (era 0,49 s); 1 ponto por segundo, 28.008 pontos em 1,2 s. |
| 6 | F1 — os vetores do round 1 (25 MB) | **PASS** | `<trkpt>` sem fechar 0,96 s (era >60 s); `<trkpt ` sem `>` 0,19 s; `<time>` sem fechar 24 ms; `<time ` sem `>` 31 ms; `<name>` no cabeçalho 25 ms; `<trk>` sem fechar 42 ms; CDATA/entidades/atributos ≤ 20 ms. A 1 MB: todos ≤ 40 ms. Saída na amostra **idêntica** ao parser do round 1 (testado com `JSON.stringify`) e `gpx.test.mjs` 10/10. |
| 7 | F1 — vetores novos que mirem os limites de 4 KB | **FAIL (leve) → F1b** | `<trkpt>` (7 bytes) repetido sem fechar: **10,1 s a 25 MB** (371 ms a 1 MB), linear. Os demais densos: `<trkpt` colado 0,48 s; atributo com `<` 0,25 s; 480 `<time>` num ponto 51 ms; fechamento a 4 KB 36 ms. |
| 8 | Backend | **PASS (sem código novo)** | `git diff a30f74e..HEAD -- BackEndTorv` = 5 arquivos de teste, só números novos da amostra sintética (`8670,74 → 8671,66`, parcial 9 `671 → 672`, rota `104 → 69` pontos). `src/` intocado. |

### Tempos do parser (Node 24, arquivos gerados fora do repositório e apagados no fim)

| Caso (25 MB) | Round 1 | `bbf8b8e` | Com a correção sugerida (F1b) |
|---|---|---|---|
| legítimo | 0,49 s | 0,77 s | 0,88 s |
| `<trkpt>` sem fechar (60 B/unidade) | > 60 s | 0,96 s | 15 ms |
| **`<trkpt>` sem fechar (7 B/unidade)** | > 60 s | **10,1 s** | **19 ms** |
| `<trkpt ` sem `>` | > 60 s | 0,19 s | — |
| `<time>`/`<name>`/`<trk>` sem fechar | > 60 s | ≤ 42 ms | — |
| fechamento a ~4 KB | — | 36 ms | 87 ms |

## Achados

### F2b — **MÉDIO** — O HEAD ainda contém a coordenada real do treino e o necessário para derivá-la (A02/A04, LGPD)
- **Camada / arquivo:** Docs (Maestro e recruits) · `docs/superpowers/specs/2026-10-14-gpx-import-design.md:162` · `docs/superpowers/plans/2026-10-14-gpx-import.md:97,109,391,1012,1371,1383,1759` · `docs/qa-gpx-import-frontend-2026-10-14-round3.md:27` · `docs/security-gpx-import-2026-10-14.md:88`.
- **O que é:** a linha 162 da spec é o exemplo de resposta `route` com a **coordenada real de partida** (5 casas, ~1 m). As linhas do plano e do QA r3 são as mesmas coordenadas da fixture antiga (deslocadas), e a linha 88 do r1 escreve o deslocamento. Não é preciso olhar o histórico: com os arquivos do HEAD já se tem o ponto de partida do treino (e, para o início, nada mais). Os arquivos de código e as fixtures estão limpos.
- **Impacto:** o ponto de saída de uma corrida é, muitas vezes, a casa. Hoje o repositório é privado ao usuário e a branch não foi enviada; o dano só acontece com o push (ou compartilhamento do clone).
- **Correção (só texto, sem reescrever histórico):** trocar nesses 10 pontos os números pelos da fixture sintética nova (primeiro ponto `[-10.5, -52.5]`, `route[0]` idem) e, no r1, trocar o valor do deslocamento por "constante fixa registrada na mensagem do commit `cf10061`". Conferir de novo com a varredura por par de coordenadas (volto a rodar no round 3 se quiser). O r1 é meu e eu mesmo o corrigiria, mas a regra do ciclo é nunca reescrever relatório de round anterior; fica a critério do Maestro.
- **Risco residual (histórico, conforme combinado — não é falha deste round):** `cf10061` (mensagem com o deslocamento e a fixture antiga), a versão antiga do plano e a versão atual da spec (commit `2354153`, linha 162) estão no histórico local. Condição: **antes do primeiro push**, reescrever esses commits (`rebase`/`filter-repo`) ou mandar a branch só por squash; depois do push vira vazamento (reescrever e forçar push + pedir limpeza do host). A decisão é do usuário. Confirmar com `git log -p -S'<valor>'` em cada commit, sem colar o valor em documento.

### F1b — **BAIXO** — `<trkpt>` curto sem fechamento ainda custa ~0,4 s por MB (A04)
- **Camada / arquivo:** Frontend · `FrontEndTorv/src/utils/gpx.ts` (laço dos pontos, trecho `rest = xml.slice(open.end, open.end + ELEMENT_MAX)` + `indexOf('</trkpt>')`).
- **Causa:** para cada `<trkpt>` sem fechamento o parser copia e varre uma janela de 4 KB. Com 7 bytes por abertura são ~3,6 milhões de janelas em 25 MB (14 G de caracteres): **10 s no Node**; no Hermes de um celular, de vários a dezenas de vezes mais. É linear (limitado), mas o app fica sem resposta de novo, agora só para um arquivo feito de propósito com `<trkpt>` repetido.
- **Cenário:** arquivo malicioso de ~25 MB enviado a uma pessoa; ela trava o app ao importar.
- **Correção testada (protótipo fora do repo, `gpx_r2.ts`):** fazer **uma** busca de fechamento reaproveitada: `let closeAt = -1;` antes do laço e, dentro dele, `if (closeAt < open.end) closeAt = xml.indexOf('</trkpt>', open.end); if (closeAt === -1) break; if (closeAt - open.end > ELEMENT_MAX) continue; body = xml.slice(open.end, closeAt); pos = closeAt;`. Resultado a 25 MB: pior caso 19 ms; legítimo 0,88 s; amostra idêntica; `gpx.test.mjs` 10/10. O teste de regressão do round 3 (6 casos de 1 MB) não pega este caso porque as unidades dele têm 15 a 60 bytes: incluir `'<trkpt>'.repeat(...)` com 1 MB (hoje 371 ms; com a correção ~1 ms) e baixar o teto do teste para algo como 150 ms.
- **Classificação:** Baixo (negação de serviço local, limitada, exige arquivo artesanal).

## Informativos

- **I1 — Fixtures sintéticas preservam a parte "não geográfica" do treino.** Elevação, FC, cadência, horários e comprimento de cada passo são os do treino real (2.875/2.875 elevações idênticas); o primeiro ponto, a altitude absoluta (que já é comum a milhares de lugares) e o desenho são outros. Casar o perfil de altitude contra um mapa de relevo é, em tese, possível, mas exige o arquivo inteiro de 2.875 pontos e dá região, não ponto. Aceitável; se quiser fechar, embaralhar a elevação com uma curva sintética.
- **I2 — O parser agora descarta pontos grandes demais.** Um `<trkpt>` com mais de 4.096 caracteres entre a abertura e o fechamento (extensões enormes) é ignorado sem aviso, como o QA L1 apontou e o Maestro aceitou como Baixo. Do ponto de vista de segurança é o comportamento correto (falha fechada); só afeta arquivos com extensões incomuns.
- **I3 — Backend sem alteração de produção.** Os 5 arquivos de teste mudam apenas valores esperados da fixture; nenhum teste foi enfraquecido (as asserções continuam `deepEqual` nos mesmos campos).
- **I4 — L1, L2 e L3 do round 1 seguem como aceitos pelo Maestro** (rate limit por IP, dado forjado e dedupe por instante exato, autenticação em `preHandler`) e vão para a decisão do usuário. Nenhum deles foi reavaliado aqui; nada no diff muda sua classificação.

## O que não foi verificado
- Hermes (celular): os tempos são de Node 24; o padrão linear vale igual, a constante é maior.
- A varredura de coordenadas compara pares com 3 casas (~100 m) em arquivos versionados de texto; não olhei binários nem o histórico (feito à parte, sem listar valores).
- Nenhuma conta, nenhuma escrita no banco, nada no Furnace. `BackEndTorv/package-lock.json` fora do commit. Arquivos temporários de 25 MB gerados e apagados fora do repositório.
