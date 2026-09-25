# QA — Latência da API (rodada 1)

**Data:** 2026-09-25
**Recruta:** Torv Review and Tests
**Branch:** `perf/api-latency`
**Diff:** `630c2c0..HEAD`
**Commits:**
- `b33d2be`: docs, redige a senha vazada do plano de migração
- `3ed4b54`: front, Profile busca os dados em paralelo
- `76f2998`: backend, queries independentes em paralelo

**Fora do diff, mas parte da feature:** `BackEndTorv/.env` local (gitignored). O `DATABASE_URL` saiu do pooler em modo transação (porta 6543, com `pgbouncer=true`) e foi pro modo sessão (porta 5432, sem `pgbouncer`, `connection_limit=5`).

**Veredito: PASS nos testes.**
- As rotas alteradas caíram de **1,5–4 s para 0,15–0,45 s** quando o servidor já estava aquecido.
- O contrato HTTP e os shapes das respostas não mudaram, e não houve regressão funcional no navegador.
- **1 HIGH de segurança pré-existente**, que não foi introduzido por este diff: o `b33d2be` só redige a senha no HEAD, e ela continua no histórico de um repositório **público**. Isso vai para o Security e para o usuário (rotação).

---

## Achados (por severidade)

| # | Sev. | Camada | Onde | Achado |
|---|---|---|---|---|
| 1 | **HIGH** (pré-existente) | Infra/DB | `docs/superpowers/plans/2026-09-15-postgres-fastify-migration.md`, histórico (`faf2fb3`) | Veja o detalhe abaixo da tabela. |
| 2 | LOW | Back (env) | `DATABASE_URL` com `connection_limit=5` | Veja o detalhe abaixo da tabela. |
| 3 | LOW (aceito pelo Maestro) | Front | `FrontEndTorv/src/screens/Profile/index.tsx` (`loadData`) | Veja o detalhe abaixo da tabela. |

**#1: senha do `postgres` ainda exposta no histórico público**
- O `b33d2be` troca a senha literal do role `postgres` por `<postgres-password>`, mas só no HEAD.
- O commit `faf2fb3`, que ainda tem a senha, está em `origin/main` e em `origin/feat/calorie-macro-calculator`, e `github.com/Leozin2412/torv` é **PUBLIC**.
- **Cenário de falha:** qualquer pessoa lê a senha no histórico do GitHub e, se ela ainda for válida, conecta como `postgres`, o dono do schema, com BYPASSRLS. Isso anula todo o lockdown do `fix/supabase-anon-exposure`.
- **Ação:** rotacionar a senha do `postgres` no Supabase e atualizar `DIRECT_URL` e as notas.
- Reescrever o histórico é opcional: depois da rotação, a senha exposta deixa de ter valor.
- Não testei se a senha ainda é válida, porque não uso credencial vazada.

**#2: pool de 5 conexões menor que o pico da tela Profile**
- A tela Profile dispara `/diet/summary` e `/profile` ao mesmo tempo, o que dá **6 queries simultâneas**.
- No navegador, o `/profile` dessa tela às vezes pagou +1 RTT: 430–454 ms, contra 150 ms quando roda sozinho.
- Não gerou erro: uma rajada de 10 requests (~30 queries) terminou em 1,0 s, tudo 200.
- **Sugestão:** `connection_limit=8`, se o pool size do modo sessão no Supabase comportar.

**#3: se só o `/profile` falhar, a lista de refeições não é preenchida**
- Com `Promise.all`, se o `/profile` falha, o `setFoodLogs` não roda. Antes do diff, os logs eram setados primeiro.
- Confirmado lendo o código: a rejeição cai direto no `catch`.
- A recíproca já era verdade antes: se o `/diet/summary` falhasse, o perfil também não era setado.

Oportunidades fora do escopo, sem achado:
- `PUT /diet/:logId` continua sendo a rota mais lenta, com ~5 RTT (768 ms com o servidor aquecido). Ela faz `getFoodLogById` + `updateMany` antes do summary.
- O MyDiet refaz o `GET /diet/summary` depois de PUT e DELETE, mesmo com essas rotas já devolvendo o summary. Isso custa +1 request (~290 ms) por edição ou exclusão.

---

## 1. Testes automatizados ✅

- `BackEndTorv`: `npm test` → **45/45 pass**, 0 fail.
- `FrontEndTorv`: `npx tsc --noEmit` → **exit 0**.

## 2. Revisão multi-lente ✅

| Ponto | Resultado |
|---|---|
| **`getUserProfile`**: shape | O `include` antigo foi trocado por 4 `findUnique`/`findFirst` em paralelo. `user_profiles` e `user_streaks` são relações 1:1 opcionais (`?` no schema), então `null` continua `null`. `user_measurements` vira `[m]` ou `[]`, igual ao `take: 1`. O `GET /profile` ao vivo devolve as mesmas 18 chaves. |
| **`getUserProfile`**: user inexistente | `if (!user) return null` → o controller continua devolvendo 404. Verificado só por leitura: não dá pra reproduzir sem apagar `public.users`. |
| **`getUserProfile`**: consistência | As 4 leituras não rodam numa transação. Uma escrita concorrente entre elas pode misturar estados, mas numa tela de leitura o impacto é desprezível. |
| **`buildSuggestion`**: sem meta | Busca `saved` e `calc` em paralelo. Se não há meta, cria com `calc` e devolve `has_suggestion: false`, igual ao comportamento antigo (`ensureTargets` → a meta nasce com o basis atual → diff vazio). |
| **`buildSuggestion`**: P2002 | O `createTargets` engole o P2002, como antes. Teste novo cobre. |
| **`buildSuggestion`**: sem dados de perfil | Não cria meta e devolve `false`. Teste novo cobre. |
| **`buildSuggestion`**: recarimbo do basis | O trecho `sameNumbers → updateTargetsBasis` não mudou. Confirmei no navegador: depois de "Manter atual" na mudança de nível, a próxima mudança (peso/altura) listou só "peso mudou" e "altura mudou", sem "nível". |
| **`getDietSummary`** | `ensureTargets → summary` roda encadeado e em paralelo com os logs. A ordem entre meta e summary está preservada, porque a função SQL lê a meta. |
| **Corrida na abertura do MyDiet** (`ensureTargets` ∥ `buildSuggestion`) | Numa conta nova, os dois foram disparados ao mesmo tempo: os dois deram **200**, `has_suggestion: false`, e a meta (2224) é a mesma nas duas leituras seguintes. O pior caso é o P2002, que é engolido. |
| **`PUT /profile`** | `updateProfile`/`getProfileRow` roda em paralelo com `getLatestMeasurement`: são leituras e escritas independentes. O P2002 de username continua indo para 409, porque o `Promise.all` rejeita com o mesmo erro. |
| **update/delete/targets/accept** | Só trocam `summary` + `logs` sequenciais por paralelos. As respostas têm o mesmo shape. |
| **Front `Profile`** | `Promise.all` com o mesmo processamento das respostas. O efeito colateral é o achado #3. |
| **Pico de paralelismo** | Por rota: `/profile` 4, `/diet/summary` 2, suggestion 3. Por tela: MyDiet 5, Profile 6. Ver achado #2. |
| **`b33d2be`** | Redige a senha corretamente no HEAD. O histórico continua com ela: achado #1. |

## 3. Medição HTTP (Furnace :3000)

- O "antes" é o baseline do log do Furnace, informado pelo Maestro (código antigo + pooler em modo transação).
- O "depois" é código novo + `.env` novo, com N = 10 repetições aquecidas após 1 primeira request, via `fetch` no node em localhost. A mediana por LAN IP foi igual (~290 ms no summary).
- RTT com o banco ≈ 145 ms (o piso do `/profile`).

| Rota | Antes (baseline) | Depois: 1ª request | Depois: aquecido (mediana, min–max) | RTT hoje |
|---|---|---|---|---|
| `GET /profile` | 1,5–3,5 s | 285 ms | **151 ms** (145–287) | 1 |
| `GET /diet/summary` | 2–4 s | 839 ms¹ | **286 ms** (282–423) | 2 |
| `GET /diet/targets/suggestion` | ~2,2–3,3 s | 284 ms | **146 ms** (143–204) | 1 |
| `PUT /profile` (nível) | ~3,4 s | 422 ms | **294 ms** (284–442) | 2 |
| `PUT /profile` (peso) | ~3,4 s | 568 ms | **438 ms** (427–576) | 3 |
| `POST /diet/targets/suggestion/accept` | ~3,6 s | 567 ms | **433 ms** (425–568) | 3 |
| `PUT /diet/targets` | — | 431 ms | **433 ms** (422–440) | 3 |
| `PUT /diet/:logId` | — | 851 ms | **768 ms** (705–1046) | ~5 |
| `DELETE /diet/:logId` | — | 579 ms | **435 ms** (428–493) | 3 |
| `POST /diet` (referência, não alterada) | — | 290 ms | 366 ms (288–475) | 2–3 |
| Tela Profile (summary ∥ profile) | — | 286 ms | **290 ms** (287–499) | 2 |

¹ É a 1ª request da conta, que cria a meta (`ensureTargets` → compute → upsert).

**Corrida numa conta nova** (summary ∥ suggestion): 742 ms / 1575 ms, os dois 200.

**Rajada** (pool de 5), `/profile` e `/diet/summary` alternados:

| Requests simultâneas | Tempo total | Status |
|---|---|---|
| 1 | 295 ms | 200 |
| 3 | 432 ms | 200 |
| 5 | 592 ms | 200 |
| 10 | 1004 ms | 200 |

**Atribuição do ganho:** não dá pra rodar o código antigo com o `.env` novo sem subir outro servidor, o que foi proibido. Por contagem de RTT, a estimativa é esta:
- `/profile`: 4 RTT → 1 (~580 → 150 ms)
- summary: 3 → 2 (~435 → 290 ms)
- suggestion: 3 → 1 (~435 → 150 ms)
- `PUT /profile` peso: 6 → 3 (~870 → 440 ms)

Ou seja, a maior parte do ganho (segundos → centenas de ms) veio do `.env`, que cortou ~5 RTT por query para 1. O paralelismo tira mais 30–75% em cima disso.

## 4. Usabilidade no navegador (portal TorvWeb, Expo web) ✅

Conta usada: `qa.perf.1790379707832b@torvtest.dev`. A API é acessada pelo LAN IP `192.168.29.66:3000`, do `EXPO_PUBLIC_API_URL`. Tempos de Resource Timing no navegador:

| Fluxo | Resultado | Tempo das chamadas |
|---|---|---|
| Login → Home | ✅ | login 491 ms, `/profile` 1338 ms² e summary 574 ms |
| Abas Home / MyDiet / Profile (3 voltas) | ✅ | summary 282–565 ms, suggestion 148–296 ms, `/profile` 294–462 ms |
| MyDiet: trocar dia (24 → 25) | ✅ | 282–286 ms |
| MyDiet: adicionar refeição (550 kcal) | ✅ o total vai para 550/2510 e P/C/G batem | POST 572 ms + summary 429 ms |
| MyDiet: editar refeição (600 kcal, nome) | ✅ o modal abre preenchido e o total vai para 600 | PUT 1296 ms + summary 292 ms |
| MyDiet: excluir refeição (modal de confirmação) | ✅ volta para 0 e "Nenhuma refeição ainda" | DELETE 846 ms + summary 290 ms |
| Profile: nível Avançado → Iniciante | ✅ modal "Nova meta sugerida • Seu nível físico mudou" (2510 → 1626) | PUT 586 ms |
| Sugestão: "Manter atual" | ✅ o modal fecha | dismiss 714 ms |
| Profile: peso/altura 78,5/176 → 82/178 | ✅ modal "Seu peso mudou • Sua altura mudou", sem "nível", ou seja, o recarimbo funcionou | PUT 1146 ms |
| Sugestão: "Aplicar nova meta" | ✅ o MyDiet mostra 0/1683 kcal | accept 814 ms |
| MyDiet com sugestão pendente (nível alterado via API) | ✅ banner "Nova meta sugerida — toque para ver" | suggestion 309 ms ∥ summary 310 ms |

² É a 1ª chamada autenticada da sessão, que concorre com o summary.

**Sensação de carregamento:**
- Mudou claramente: as telas preenchem em ~0,3–0,6 s depois da troca de aba, contra os 2–4 s do baseline.
- As escritas continuam perceptíveis: editar ~1,3 s e excluir ~0,85 s mais o refetch, por causa das oportunidades fora do escopo.
- Os tempos no navegador ficaram 1–2 RTT acima dos do node em algumas chamadas. Isso é concorrência entre as requests da mesma tela no pool de 5 (achado #2), não o preflight de CORS (2 ms) nem o LAN IP (igual ao localhost).
- Observação de UI, que não foi introduzida pelo diff: com o conteúdo sem rolar, o botão "Editar peso e altura" fica embaixo da tab bar (y = 851) e o clique cai na aba. Rolando, funciona.

## 5. Ponto aceito pelo Maestro: confirmado

No Profile, se só o `/profile` falhar, o `Promise.all` rejeita e o `setFoodLogs` não roda, então a lista de refeições fica com o estado anterior (vazia no primeiro foco). Antes do diff os logs eram setados. É o achado #3, confirmado lendo o código.

## 6. Contas de teste desta rodada

| Conta | Criada por | Uso |
|---|---|---|
| `qa.perf.1790379707832a@torvtest.dev` | Review and Tests | corrida summary ∥ suggestion em conta nova |
| `qa.perf.1790379707832b@torvtest.dev` | Review and Tests | medição de todas as rotas, rajada e fluxo no navegador. Terminou com 0 refeições, meta 1683 e 1 sugestão pendente (nível) |
| `qa.perf.1790379502518@torvtest.dev` | Torv Backend | medição do Backend (lista informada pelo Maestro) |
| `qa.perf.1790379525847@torvtest.dev` | Torv Backend | medição do Backend (lista informada pelo Maestro) |

- Nenhuma refeição `qa-perf*` criada nesta rodada ficou sobrando: as 11 da medição foram apagadas via `DELETE /diet/:id`.
