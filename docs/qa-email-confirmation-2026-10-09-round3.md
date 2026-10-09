# QA — Confirmação de e-mail por código de 6 dígitos — round 3 (só backend) — 2026-10-09

**Owner:** Torv Review and Tests · **Rounds anteriores:** `docs/qa-email-confirmation-2026-10-09.md` (FAIL), `...-round2.md` (PASS) · **Rework:** backend `726b9f1` (achados S1/S2/S3/B3 de `docs/security-email-confirmation-2026-10-09.md`). Frontend sem mudança desde o round 2.

## Veredito: PASS (100% verde, nenhuma falha bloqueante) → volta para Security reavaliar S1/S2/S3

| Checagem | Resultado |
|---|---|
| `BackEndTorv: npm test` | ✅ 211/211 (esperado) → **218/218** com 7 testes novos meus em `src/routes/auth.edge.test.js` |
| `FrontEndTorv: npx tsc --noEmit` | ✅ sem erros |
| `FrontEndTorv: node --test src/utils/*.test.mjs` | ✅ 49/49 |
| Backend vivo (Furnace, pid 28456, iniciado 12:16:23) com o código novo | ✅ confirmado por comportamento. O log do Furnace não é legível daqui (`maestri check` não enxerga o terminal), então provei pelo efeito: o cooldown nosso só existe no código novo. |

## Chamadas reais (e-mails inexistentes `@torvtest.dev`, nenhuma conta criada)

| Chamada | Resultado |
|---|---|
| e-mail > 254 (262 chars) em `verify-email`, `resend-code` e `login` | ✅ 400 `body/email must NOT have more than 254 characters`, sem chegar ao provedor |
| `verify-email` com código errado | ✅ 400 `{"error":"Invalid or expired code","code":"INVALID_CODE"}` (GoTrue real) |
| `resend-code` 1ª vez | ✅ 204 |
| `resend-code` 2ª vez, mesmo e-mail com maiúsculas | ✅ 429 `{"error":"Too many requests","code":"RATE_LIMITED"}` (cooldown nosso, chave normalizada) |

## Revisão crítica do diff

| Ponto | Resultado |
|---|---|
| maxLength 254 (e-mail) e 128 (senha) nas 4 rotas | ✅ `Email()` compartilhado em register/verify/resend; login com `maxLength` 254/128. 255 → 400 sem tocar provedor nem limiter (teste dos devs + chamada real). 254 passa o schema. |
| S2 reserva antes do `await` | ✅ `isBlocked` e `fail` são síncronos no mesmo tick, então rajada paralela não passa do teto. Meus testes: rajada de 20 com código **errado** e com código **certo** → exatamente 5 chegam ao provedor (5×200 / 15×429). 4 erros + 5ª certa → 200 e zera: 5 tentativas novas permitidas e a 6ª bloqueia. Exceção inesperada (não `AuthError`) não deixa contador preso: a tentativa é consumida e uma nova com código certo ainda dá 200. O sucesso é o único `reset`. |
| Erro do provedor (5xx/429) consome tentativa | ✅ coerente com o aceito; testado (dev e meu teste combinado). |
| S3a cooldown de 60 s por e-mail no resend | ✅ chave normalizada, reserva antes do `await` (rajada de 5 paralelas, mesmo e-mail → 1 chamada ao provedor, 4×429), bloqueado não chama o provedor, contador independente do de verify (testado). |
| S3b `resendSignup` | ✅ qualquer 4xx (incl. 429 e `over_email_send_rate_limit`) → `{swallowed}` → 204; `email_address_not_authorized`, 5xx e rede → 502. |
| S3c `signUp` com `over_email_send_rate_limit` | ✅ → `null` → 201 `confirmation_required:true`; `over_request_rate_limit` continua `PROVIDER` (502). Ver R1. |
| B3 log sem PII | ✅ `request.log.warn({ error_code }, ...)`; o teste compara os argumentos exatos (sem e-mail). |
| Regressão login/refresh/logout/register | ✅ 401 sem `code`, 502 só com `error`, 409 EMAIL_TAKEN com `code` (testes antigos seguem verdes); schemas de resposta 429 com `code` serializam. Meu teste novo fixa 401/502 de login e 401 de refresh. |
| Testes codificam o comportamento certo (não só passam) | ✅ Os alterados mudaram junto com a regra (ex.: "PROVIDER e RATE_LIMITED consomem tentativa; 6ª → 429, 5 chamadas"). O teste de rajada original só cobria código errado; o meu cobre o certo. |

## Achados (nenhum bloqueante)

| # | Sev | Camada | Achado |
|---|---|---|---|
| R1 | LOW (observabilidade/UX; consequência assumida do S3) | Backend | `signUp` engole `over_email_send_rate_limit` **sem log** (só o resend loga `swallowed`). Se o limite de e-mails do projeto Supabase acabar (SMTP padrão tem teto baixo por hora), um cadastro novo volta 201 `confirmation_required` mesmo sem e-mail enviado e antes dava 502 visível. Nenhum rastro no log para diagnosticar. Sugestão: devolver o sinal também no `signUp` e logar `error_code` no controller (sem e-mail), como no resend. |
| R2 | LOW | Backend/Front | O 502 do provedor também consome o cooldown do resend: depois de "Não foi possível reenviar agora" um novo toque volta 429 ("Aguarde um pouco") por até 60 s, e o front não mostra contagem nesse caso (só após 204 ou 429). Testado. Aceitável; se incomodar, o front pode iniciar o cooldown também no erro 502. |
| R3 | INFO | Backend | Cooldown e contadores são por instância (memória), como o `ponytail:` do código já registra; vale para serverless. Fora do escopo deste round. |
| R4 | INFO | Backend | `refresh_token` e `logout` não têm `maxLength` (corpo limitado só pelo `bodyLimit` de 1 MB do Fastify; não usam chave de limiter). Pré-existente, não é parte do diff. |

Itens abertos de rounds anteriores: B2 (corrida) resolvido pelo S2; B3 (log) resolvido no resend e pendente no signUp (R1); B1 e B4 seguem como decisão de desenho já registrada (B4 agora tratado pelo cooldown uniforme + 204 uniforme).

## Dados de teste

Nenhuma conta criada. 6 chamadas ao backend vivo com `qa.r3.nobody@torvtest.dev` e e-mails longos `aaa…@torvtest.dev` (inexistentes).
