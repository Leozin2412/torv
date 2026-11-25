# QA — Proteção de dados sensíveis (cifra de campos + cadastro sem metadados)

**Data:** 2026-11-25
**Recruta:** Torv Review and Tests
**Branch:** `feature/criptografia-dados-sensiveis`
**HEAD:** `91a8bd0`
**Ambiente:** Supabase local (Docker; API :54321, DB :54322, Mailpit :54324), confirmação de e-mail LIGADA; backend local (`node server.js`) com `.env` local e chave de cifra descartável. Produção não foi tocada.

**Desvio do roteiro:** não há Furnace nem portal TorvWeb. O ponta a ponta rodou **no nível de API + SQL** (requisições HTTP contra o backend local, SQL via `psql` no container). Os itens "pelo app / na tela" foram verificados pelas respostas da API que as telas consomem (mesmo contrato). Nenhuma tela foi aberta.

**Veredito: FAIL (1 item)** — o check 8 devolve 502 em vez de 409 na corrida de username (a conta é desfeita, mas o status está errado). Os demais itens passam.

---

## Resumo

| # | Item | Resultado |
|---|---|---|
| 1 | Cadastro, código no Mailpit, confirmação, sessão | PASS |
| 2 | SQL: medidas `v1.`, `raw_user_meta_data` limpo, `public.users` sem `email` | PASS |
| 3 | JWT: `user_metadata` sem dado de perfil; claim `email` presente | PASS |
| 4 | Perfil mostra e-mail/peso/altura; editar peso grava nova linha `v1.` | PASS |
| 5 | Dieta: calorias iguais ao cálculo direto; `basis_json` em `v1.` | PASS |
| 6 | GPS com FC: FC, parciais e rota no detalhe; colunas `v1.` | PASS |
| 7 | Cadastro sem username -> `user_xxxxxxxx` | PASS |
| 8 | Corrida de username -> 409 `USERNAME_TAKEN` e nenhuma conta sobrando | **FAIL** (conta desfeita, mas 502) |
| 9 | Valor adulterado -> `GET /profile` 500 genérico, sem cifra no corpo/log | PASS |
| 10 | Sem `DATA_ENCRYPTION_KEY` o backend não sobe, mensagem sem valor | PASS |
| RF2 | Campos opcionais nulos continuam `NULL` | PASS |
| RF4 | Cadastro refeito de conta não confirmada -> uma medida só | PASS |

---

## Evidência

### 1–3 e 7 — cadastro, SQL e JWT
- `POST /auth/register` -> 201 `{confirmation_required:true, session:null}`; código lido no Mailpit; `POST /auth/verify-email` -> 200 com sessão.
- `weight_kg` e `height_cm` em `user_measurements`: `v1.…` (49 caracteres, 1 linha).
- `auth.users.raw_user_meta_data` = só `sub`, `email`, `email_verified`, `phone_verified`. Chaves proibidas (`name, username, birth_date, gender, weight, height, fitness_level, goal`): contagem **0**.
- `public.users` colunas: `id, auth_provider, created_at`; coluna `email`: **0**.
- Perfil gravado pelo backend e streak criada (1 linha). Sem username no corpo -> `user_78053a9d` (`user_` + 8 primeiros do id).
- JWT (só o payload): `user_metadata` com chaves `email, email_verified, phone_verified, sub` (nada de perfil); claim `email` presente.

### 4 — perfil
- `GET /profile` -> 200 com `email` do JWT, `weight_kg: 72.5`, `height_cm: 178`.
- `PUT /profile {weight_kg:80.5}` -> 200; SQL: 2 linhas, ambas `v1.` (49 caracteres); `GET /profile` -> `weight_kg: 80.5`.

### 5 — dieta
- `GET /diet/summary` -> metas 2740 kcal / 171 P / 308 C / 91 G. `calculateTargets` chamado direto com os mesmos dados (80,5 kg, 178 cm, 31 anos, M, INTERMEDIÁRIO) -> 2740 / 171 / 308 / 91. Igual.
- `nutrition_targets.basis_json` começa com `v1.`.

### 6 — GPS
- Fixture `run-sample.json` (2875 pontos, todos com FC) via `POST /workouts/routines` (RUN) + `POST /activities/gps` -> 201: `avg_hr 151`, `max_hr 169`, 9 parciais, rota de 69 pontos, 8671,66 m.
- SQL: `avg_hr, max_hr, splits, route` todos `v1.`; `avg_cadence` (não cifrada) = 175.
- `GET /activities/gps/:id` -> 200, corpo idêntico ao da criação.

### 8 — corrida de username (FAIL)
- Caminho sequencial (pre-check): 409 `USERNAME_TAKEN`, 0 contas sobrando. OK.
- Dois cadastros simultâneos (e-mails diferentes, mesmo username novo), 3 tentativas: **201 + 502** nas 3. Nenhum 409.
  - Após cada tentativa: contas no Auth do par = 1, perfis com o username = 1; consulta `auth.users` sem `user_profiles` -> **0**. A conta perdedora foi desfeita.
  - Log do backend: `code P2002, msg "register profile save failed"` e `auth provider failure`.
- Causa (reproduzida com o Prisma real): o `P2002` chega com `meta = {modelName:"user_profiles", target:null}`. O teste unitário simula `target` como array `["username"]` ou string `"user_profiles_username_key"`, formato que este Prisma/driver não gera. O ramo 409 nunca dispara.

### 9 — valor adulterado
- `update user_measurements` trocando `weight_kg` por `v1.AAAA…` (lixo) -> `GET /profile` -> **500** `{"error":"Internal server error fetching profile"}`. Corpo sem `v1.` e sem user_id.
- Log: mensagem `falha ao decifrar campo` + stack (caminhos de arquivo). Contagem no log de: trecho adulterado 0, user_id 0, `v1.` 0, e-mail 0.
- Valor original restaurado -> `GET /profile` 200, `weight_kg 80.5`.

### 10 — sem chave
- `DATA_ENCRYPTION_KEY` vazia -> processo sai com código 1: `Error: DATA_ENCRYPTION_KEY ausente ou inválida: precisa de 32 bytes em base64`. Porta não abre. Mesmo resultado com valor inválido; a mensagem não repete o valor.

### RF2 — nulos
- GPS sem FC (mesmos pontos com FC = null): 201, `avg_hr:null, max_hr:null`; SQL `avg_hr is null` e `max_hr is null` = true, 0 linhas com valor cifrado; `splits`/`route` em `v1.`; `GET` devolve `null`.
- Medida sem altura (via `addMeasurement` do repositório, pois a API exige altura): SQL `height_cm is null` = true; decifrado volta `height_cm: null`; peso `v1.`. Nunca a cifra de `"null"`.

### RF4 — cadastro refeito
- 1º cadastro (70 kg, nome "Primeiro") -> 1 medida.
- 2º cadastro imediato (<60 s, 90 kg): o GoTrue limita o reenvio -> resposta 201 igual à de cadastro novo; **nada é regravado** (continua 1 medida, nome "Primeiro"). Comportamento esperado do ramo `swallowed`.
- 3º cadastro após 62 s (90 kg, 185 cm, "Terceiro") -> 201; SQL: **1** medida, nome atualizado; decifrada: 90 / 185.
- Extra: recadastrar e-mail de conta **confirmada** -> 409 `EMAIL_TAKEN`; medidas (3) e nome intactos (o `deleteMany` do `saveSignupProfile` não atinge conta confirmada).

---

## Automatizados

- Backend `npm test`: `tests 340 / pass 340 / fail 0`.
- Front `npx tsc --noEmit`: sem erros (exit 0).
- Front `node --test src/utils/*.test.mjs`: `tests 76 / pass 76 / fail 0`.

## Revisão do diff (`main..HEAD`) com a Review Focus

| Sev. | Local | Achado | Cenário de falha |
|---|---|---|---|
| MÉDIA | `BackEndTorv/src/controller/auth.controller.js:63-64` | Detecta username por `err.meta.target`, que o Prisma real devolve `null` no P2002 | Dois cadastros simultâneos com o mesmo username: o perdedor recebe 502 "provider" em vez de 409 `USERNAME_TAKEN`; o app mostra erro genérico em vez de pedir outro nome. Confirmado no check 8. |
| MÉDIA | `BackEndTorv/src/routes/tests/auth.routes.test.js:27,54-62` | O teste mocka `meta.target` num formato que o Prisma/driver em uso não produz; por isso 340/340 passam com o bug acima | Regressão da Review Focus 5 não é detectada pela suíte. Falta teste com o formato real (`target: null`) ou de integração. |
| BAIXA | `BackEndTorv/src/repository/profile.repository.js` (`saveSignupProfile`) | Reenvio de signup (após 60 s) de conta não confirmada sobrescreve perfil e medidas | Quem conhece o e-mail de uma conta ainda não confirmada pode trocar nome/peso gravados; o dono confirma depois e vê dados trocados. Conta confirmada -> 409, não afetada. |
| BAIXA | `BackEndTorv/src/controller/auth.controller.js:67` | Falha de gravação que não é username cai em 502 genérico | Observação: o rollback `deleteUser` funcionou (0 contas sem perfil). |

Review Focus 1, 2, 3 e 4 conferidos sem achado (1 e 3 por teste unitário e check 9; peso 72,5 e 80,5 voltam como número no `GET /profile`).

## O que NÃO foi verificado

- Nenhuma tela real: app Expo, dispositivo físico, fluxo de cadastro em 6 passos na UI; só o contrato da API.
- UXCam (`OcclusionType.Blur` em `App.tsx`): requer build nativo e a chave do UXCam.
- Configuração de produção: chave `DATA_ENCRYPTION_KEY` real, migration aplicada em produção, Vercel, rate limit atrás de proxy.
- Importação de arquivo `.gpx` real: o app converte o GPX em pontos; foi usada a fixture JSON de pontos.
- Rotação de chave, backup/restore e desempenho da cifra sob carga.

## Limpeza

Apagadas as contas `qa-*@torvtest.dev` do Supabase local (5 contas); contagem final 0 (e 0 em `user_profiles` e `user_measurements`). Backend local parado.
