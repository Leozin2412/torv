# QA — Home com dados reais (GET /activities/summary) — 2026-10-06

Diff: `688de02` (rota + repository), `23072d2` (Home streak/gastas), `6b6b510` (data local no diet/summary).
Branch `feat/workout-module`. Round 1.

## Resultado: ✅ PASS (0 CRITICAL, 0 HIGH, 0 MEDIUM, 3 LOW) — liberado para Security

| # | Item | Resultado |
|---|---|---|
| 1 | SQL cru `strengthDays` + aggregate de calorias contra o Postgres real | ✅ PASS (com ressalva de cobertura, ver 1.4) |
| 2 | Usabilidade no browser (Expo web) | ✅ PASS |
| 3 | Suíte automática e tipos | ✅ `node --test` 100/100; `tsc --noEmit` limpo |

## 1. Banco real

Acesso: Prisma do `BackEndTorv` com o `.env` (Supabase), rota exercitada com `fastify.inject` (sem subir servidor, **nada na porta 3000**), auth stub só no middleware, repository e SQL reais.

### 1.1 Risco conhecido `make_interval(mins => $n::int)` com parâmetro Prisma — ✅ não dá 500
`strengthDays` real executado com `tzOffsetMin` = -180, 0, 540, 840, -840: todos rodam. A rota responde 200 em ±840 e 400 em 841, `1.5`, ausente, `date=2026-02-31`, `date=abc`.

### 1.2 Bucket de fuso (mesma expressão SQL, parâmetros Prisma) — ✅ 8/8
| start_time (UTC) | tz | dia local | ok |
|---|---|---|---|
| 2026-10-06T02:30Z (23:30 do dia 05 em BRT) | -180 | 10-05 | ✅ |
| 2026-10-07T02:59:59Z | -180 | 10-06 | ✅ |
| 2026-10-07T03:00:00Z | -180 | 10-07 | ✅ |
| 2026-10-06T02:30Z | 0 | 10-06 | ✅ |
| 2026-10-06T15:00Z / 14:59:59Z | +540 | 10-07 / 10-06 | ✅ |
| 2026-10-06T00:00Z | -840 | 10-05 | ✅ |
| 2026-10-06T23:59:59Z | +840 | 10-07 | ✅ |

### 1.3 Dados reais: API vs cálculo independente — ✅ 169/169
6 usuários reais com mais treinos (405 atividades STRENGTH no banco, todas `start_time` preenchido). Para cada usuário, até 14 dias com treino mais D+1 e D+2 (cobre "hoje", "só ontem", "morta", gaps e virada de mês). Comparação: `streak_days` e `calories_burned` da rota contra SQL independente em `America/Sao_Paulo` (`::date`) + loop de streak em JS separado. Streak máximo visto: 20; 133 casos com streak > 0. Cada usuário bate com a própria consulta, então o isolamento por usuário também aparece (6 resultados distintos, nenhum vaza). Usuário sem dados: `{0,0}`.

### 1.4 Ressalva de cobertura (por que não é FAIL)
Tentei semear usuários sintéticos com `INSERT` em `auth.users` do banco real (cenário "treino 23:30 local + borda 02:59:59/03:00:00 + RUNNING no gap + calorias não nulas"). O classificador do Claude Code negou a escrita e **não contornei**. Ficaram sem prova no banco real:
- soma de `calories` com valor > 0 e `null` contando 0 (**0 de 405 atividades têm `calories`**; o aggregate só foi provado devolvendo 0, e o filtro `[from, before)` só pelo bucket 1.2 e pelos testes com mock);
- atividade não-STRENGTH como gap do streak (não existe nenhuma no banco).
Caminho Prisma `aggregate` com `_sum` é padrão e o `where` é simples; risco baixo. Se quiser fechar isso, o Torv Database pode semear/limpar em `auth.users` (ou me autorize a escrever só nesse teste).
O 23:30 local (02:30Z) foi provado no browser, ver 2 (conta criada pelo cadastro normal, treino por `POST /workouts/sessions`).

## 2. Usabilidade no browser (portal "QA Home", Expo web `localhost:8081`, 412 px, fuso do browser -03)

Conta nova pelo cadastro de 5 passos (`qa-home-*@example.com`), treinos gravados por `POST /workouts/sessions` de dentro do portal. Evidência por `innerText`/XHR (sem screenshots).

| Cenário | Esperado | Resultado |
|---|---|---|
| Conta sem treino | `0` + "dias seguidos", Gastas `0` | ✅ |
| Só treino de ontem 23:30 local | streak `1`, texto singular "**dia seguido**" (viva por ontem; 23:30 local ficou no dia local certo) | ✅ |
| + treino hoje 08:00 | `2` "dias seguidos" | ✅ |
| `/activities/summary` falha (XHR reescrito para `date=bad` → 400) e voltar para a aba Home | Streak `–` e Gastas `–`; **Consumidas continua `0 kcal` e "2.323 kcal restantes para sua meta"** (diet carregou, tela não caiu, sem estado de erro geral) | ✅ |
| Chamadas na Home | `GET /diet/summary?date=2026-10-06` e `GET /activities/summary?date=2026-10-06&tz_offset_min=-180` | ✅ data local, offset = -getTimezoneOffset |
| Rótulo | "kcal = atividades" | ✅ |

Só no browser: a virada de dia (UTC ≠ local) do `diet/summary` não pôde ser reproduzida (UTC e BRT estavam no mesmo dia às 16:4x). A correção é de uma linha e usa o mesmo `toISODate` local que o resumo de atividades; considerada provada por leitura de código + URL observada. Comportamento nativo (Android/iOS, `toLocaleString('pt-BR')` no Hermes) é com o usuário, como combinado.

## 3. Achados (ranqueados)

| Sev | Local | Achado | Cenário concreto |
|---|---|---|---|
| LOW | `activities.repository.js` / produto | Nada grava `activities.calories` (0/405 linhas; o `POST /workouts/sessions` não envia calorias). "Gastas" mostrará `0` para todo mundo até existir um escritor | Usuário treina todo dia, Home: streak 20, Gastas 0 kcal. Esperado enquanto não houver estimativa de kcal; decisão do Maestro |
| LOW | `Home/index.tsx` (card "Caminhada matinal 3.2km · 180kcal") | Card mockado ainda mostra 180 kcal fixos, contradiz "Gastas 0" ao lado | Conta nova: Gastas `0` e card com 180 kcal. Fora do diff, só registro |
| LOW | `Home/index.tsx:loadActivitySummary` | Sem proteção contra resposta fora de ordem e sem refresh na virada da meia-noite com a tela aberta (só refaz no foco) | App aberto 23:59 → 00:01 na Home mostra streak/gastas do dia anterior até trocar de aba |

Sem achados de segurança: `user_id` vem só do token, SQL parametrizado (`$queryRaw` tagged template), `tz_offset_min` limitado a ±840 e inteiro, `date` validado por regex + ida e volta (rejeita `2026-02-31`).

Cobertura de testes da rota (6 testes novos em `activities.routes.test.js`: só ontem, gap/virada de mês e ano, fuso, soma, 400s, isolamento) cobre os caminhos; eles mockam o repository, e a lacuna do SQL cru foi coberta por 1.1 a 1.3 acima. Não há teste de integração versionado contra o banco (os scripts desta rodada ficaram só no scratchpad).

## Limpeza
- Conta de teste `qa-home-*` + 2 atividades STRENGTH ficaram no Supabase (criadas pelo cadastro/API normais). Nenhuma escrita direta no banco. Portal "QA Home" aberto na canvas.
