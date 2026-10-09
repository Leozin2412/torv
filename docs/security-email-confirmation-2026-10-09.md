# Security — Confirmação de e-mail por código de 6 dígitos (2026-10-09)

**Escopo:** commits `1ecbfe6` (backend), `783f7aa` + `77896ec` (frontend), `bf32602` e `2099820` (testes e relatórios de QA, só leitura). Arquivos: `BackEndTorv/src/lib/authProvider.js`, `lib/attemptLimiter.js`, `controller/auth.controller.js`, `routes/auth.routes.js`; `FrontEndTorv` `VerifyEmail`, `AuthContext`, `Login`, `Register`, `routes`. Pré-condição atendida: QA round 2 PASS (`docs/qa-email-confirmation-2026-10-09-round2.md`).

**Método:** leitura do diff e do código atual; reprodução do Ajv/Fastify do projeto em script isolado (sem rede); duas chamadas ao backend vivo em `:3000` (não parei nem subi outra instância): uma com e-mail de 200 kB e uma com `code` em array, as duas contra e-mail inexistente; consulta à documentação oficial do Supabase para limites do GoTrue. Nenhuma conta criada, nenhum segredo lido ou impresso (do `.env` só os nomes das variáveis). **Não verificado:** configuração real do projeto Supabase (expiração do OTP, SMTP, limites de auth); o conector Supabase deste ambiente não enxerga o projeto do torv, como nos rounds anteriores. Onde uso um número do GoTrue, ele vem da documentação, não do projeto.

## Veredito: FAIL — 1 MEDIUM (retrabalho no backend), 1 MEDIUM-para-produção/LOW-para-testers (recomendo no mesmo retrabalho), 3 LOW, INFO

Rework **só no backend** (S1 e, de preferência, S2). Frontend e database sem retrabalho. Os pontos de desenho (B1, B4) ficam como decisão registrada, com ressalva em B4 (S3). Depois do retrabalho, o QA reroda só o que mudou e a segurança reavalia S1/S2.

| # | Sev | Camada | Resumo |
|---|---|---|---|
| S1 | **MEDIUM (bloqueante)** | Backend | `email` sem `maxLength`: chave de ≤ ~1 MB fica 15 min no `Map` do limiter; 1 IP enche centenas de MB |
| S2 | MEDIUM (produção) / LOW (3 testers) | Backend | Corrida no contador (`isBlocked` e `fail` separados por um `await`) + contador por instância: o teto "5 por e-mail" não vale contra rajada paralela nem em serverless |
| S3 | LOW | Backend | `resend-code` e `register` têm oráculo de existência (429 em < 60 s); a justificativa do QA para B4 não vale com confirmação ligada |
| S4 | LOW | Database/Backend | Conta não confirmada ocupa `username` para sempre (squatting) |
| S5 | LOW | Backend/Config | E-mail bombing a terceiros e esgotamento da cota de e-mails do projeto |
| S6 | LOW | Config | Um IP derruba a confirmação de todos esgotando o balde `/verify` do GoTrue (IP do backend) |
| — | INFO | vários | ver "INFO" ao final |

---

## 1. Força bruta do código de 6 dígitos

**Limites que existem no fluxo**
- Nosso, por IP: 10 req/min em `/auth/verify-email` (`@fastify/rate-limit`, memória **por instância**).
- Nosso, por e-mail: 5 falhas `INVALID_CODE` em janela fixa de 15 min (`attemptLimiter`, `Map` **por instância**).
- GoTrue, `/auth/v1/verify`: por IP **do backend** (o GoTrue nunca vê o IP do cliente), 360/h com rajada de 30 (documentação oficial). Todos os usuários e atacantes dividem esse balde.
- Expiração do código: `Email OTP Expiration` do projeto (documentação recomenda ≤ 3600 s; máximo permitido 86400 s). **Valor real não verificado.** O GoTrue não limita tentativas por código.
- Cada reenvio gera um código novo e invalida o anterior: palpites passados não acumulam, cada um tem p = 10⁻⁶.

**Probabilidades** (código uniforme, p = 10⁻⁶ por palpite, alvo = um e-mail com código pendente)

| Cenário | Palpites | P(acerto) |
|---|---|---|
| 1 IP, 1 processo (deploy atual, Furnace), limiter funcionando | ≤ 5 por 15 min = 20/h (≤ 40/h com a corrida do S2, limitado por 10/min/IP) | ≈ 2–4 × 10⁻⁵ por hora. Campanha de 24 h com reenvios (cada um manda e-mail à vítima): ≈ 5 × 10⁻⁴ a 10⁻³ |
| Botnet, 1 processo, requisições **sequenciais** | igual: a chave é o e-mail, não o IP | igual ao cenário 1 |
| Botnet, 1 processo, rajada **paralela** (S2) | K requisições passam por `isBlocked` antes da 1ª `fail()`. O GoTrue limita: rajada 30, depois 360/h, **somando todos os e-mails** | ≈ 3 × 10⁻⁵ por rajada de 30; teto ≈ 3,6 × 10⁻⁴ por hora contra um único alvo |
| Botnet, serverless (Vercel), N instâncias, IPs de saída variáveis | Cada instância tem contador próprio (cold start zera) e rate limit próprio; o balde do GoTrue também se multiplica pelos IPs de saída | **Sem teto efetivo do nosso lado.** Ordem de grandeza: 10⁻³ por rajada de 1000, repetível a cada instância nova. Só o GoTrue por IP e a expiração seguram |

Nota: o repositório não tem adaptador serverless (`server.js` faz `listen` em processo longo). O cenário Vercel é o alvo declarado pelo Maestro, não o estado atual.

**Aceitável?**
- **3 testers, processo único:** sim. P ≈ 10⁻⁵ por hora por alvo, e o alvo só existe nos minutos entre cadastro e confirmação. Conta recém-criada não guarda dado.
- **Produção/serverless:** não como está. O contador em memória não é um controle quando há várias instâncias, e a corrida zera o efeito mesmo numa só.

**Menor mitigação**
1. Fechar a corrida (S2): reservar a tentativa antes do `await`. 3 linhas, sem dependência.
2. Para serverless: mover o contador para o Postgres que o backend já usa (tabela `(key, count, reset_at)` com `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count`, atômico entre instâncias). Sem Redis novo. Aplicar o mesmo ao rate limit por IP de `/auth/*` se for para produção.
3. Barato e independente do código: `Email OTP Expiration` para 600 s no painel (reduz a janela de cada código a 10 min).
4. Se precisar de margem maior: OTP de 8 dígitos (o painel permite; exige `CODE_LENGTH`, `pattern`, `maxLength` e `sanitizeCode` nos dois lados). P por palpite cai 100×.

## 2. B1 — lockout de 15 min por e-mail (DoS dirigido)

**Recomendação: aceitar como está. Não travar por (e-mail + IP).**
- A chave por (e-mail + IP) devolve ao atacante 5 palpites **por IP**: um botnet de 1000 IPs testa 5000 códigos por janela contra o mesmo e-mail. Desfaz o controle de brute force, que é o motivo do limiter. Rejeitada.
- "Não bloquear o código certo" exige chamar o GoTrue enquanto bloqueado, o que vira oráculo de palpites. Rejeitada.
- Resetar o contador no reenvio dá a cada código 5 palpites novos a cada 60 s (300/h, 15× pior). Rejeitada.
- Custo do DoS dirigido: a vítima fica 15 min sem confirmar (o atacante gasta 5 requisições por alvo a cada 15 min); sem vazamento de dado, sem tomada de conta. A tela mostra "Aguarde alguns minutos". Para o app atual é incômodo, não risco. **Decisão registrada.**
- Revisar se virar abuso real: bloqueio progressivo e CAPTCHA no `resend`/`register` (o GoTrue aceita `captcha_token`, exigiria repassar do app).

## 3. Enumeração de contas

| Rota | Resultado |
|---|---|
| `POST /auth/login` | **OK.** O GoTrue valida a senha antes de `email_not_confirmed`; 403 só aparece com a senha certa. Sem senha certa, 401 uniforme. |
| `POST /auth/verify-email` | **OK.** Expirado, errado, e-mail inexistente e conta já confirmada viram o mesmo 400 `INVALID_CODE` (`authProvider.js:77-78`; confirmado ao vivo para e-mail inexistente). Não testei conta real existente (exigiria criar conta e ler o e-mail); por leitura do mapeamento, qualquer 4xx do GoTrue colapsa no mesmo código. |
| `POST /auth/resend-code` | **Parcial — ver S3.** |
| `POST /auth/register` | `EMAIL_TAKEN` só sai com a confirmação desligada (hoje ligada). `USERNAME_TAKEN` 409 é oráculo de username (já aceito em `security-groups-competition`, e agora inclui usernames de contas não confirmadas, ver S4). |

### S3 — LOW — B4 é real, e a justificativa do QA não vale
- **B4 real?** Sim. A documentação do Supabase lista "Signup confirmation request — limited by last request — 60 s". Para conta existente e não confirmada, o 2º pedido em < 60 s volta `over_email_send_rate_limit` (429); para e-mail inexistente (ou já confirmado) o GoTrue responde 200 e o backend devolve 204. O 429 também é traduzido em `RATE_LIMITED` pelo backend (`authProvider.js:85`).
- **Por que a justificativa do QA ("`register` já devolve `EMAIL_TAKEN`") falha:** o `EMAIL_TAKEN` só existe com a confirmação **desligada**. Com ela **ligada**, que é o estado em que `resend-code` existe, o GoTrue mascara o signup repetido. Logo B4 não é redundante com `register`: é o único sinal.
- **O mesmo oráculo existe em `register`:** signup repetido de e-mail não confirmado em < 60 s dá 429 do GoTrue, que `signUp()` mapeia para `PROVIDER` (502), enquanto e-mail novo dá 201.
- **Alcance:** só revela "existe, não confirmado e com e-mail enviado há < 60 s", e o atacante dispara o próprio envio à vítima ao testar. Conta não confirmada não guarda dado. Por isso LOW.
- **Correção mínima (opcional para testers):** no controller, um cooldown próprio por e-mail no `attemptLimiter` (1 pedido/60 s, 429 `RATE_LIMITED` **independente** de a conta existir) e engolir o 429 do GoTrue como 204. O app já tem cooldown de 60 s, então a UX não muda. Para o `register`, mapear o 429 do GoTrue para o mesmo `201 confirmation_required: true`.

## 4. Logs e mensagens de erro

- `sendAuthError` loga só `{code}` em `warn` e só para `PROVIDER`; sem e-mail, código, senha ou token. **PASS.**
- Mensagens de erro são fixas (`MESSAGES`); o corpo do GoTrue nunca é propagado (`authProvider.js` cabeçalho + `call`). **PASS.**
- Reprodução em script: erro de validação (`code` fora do padrão) e JSON inválido passam pelo handler com `fastify.log.error(err)`. O log gerado **não contém** o e-mail nem o código; a resposta traz só `body/code must match pattern "^[0-9]{6}$"` e `Body is not valid JSON but content-type is set to 'application/json'`. **PASS.**
- `onResponse` loga `method url status` sem corpo; as rotas novas são POST sem query. **PASS.**
- INFO (B3 do QA): `resendSignup` engole qualquer 4xx do GoTrue, inclusive `apikey` errada (401): o usuário vê 204 e nunca recebe e-mail, sem rastro em log. Sugestão: `request.log.warn({ error_code: data.error_code }, ...)` nos 4xx inesperados (sem e-mail). Não bloqueia.

## 5. Frontend

- **Console:** `VerifyEmail`, `Login`, `Register` e `AuthContext` não logam código nem e-mail nos arquivos do diff. O único `console.log` é o pré-existente `Error loading profile after auth` (`AuthContext.tsx:56`), que imprime o `AxiosError` inteiro (inclui o header `Authorization` no `config`); passa a ser alcançável depois do `verifyEmail`. INFO, pré-existente: imprimir só `error.message`/`status`.
- **Armazenamento:** e-mail e código vivem em `useState` e nos params da navegação em memória; nada vai para `SecureStore`/`localStorage`. A sessão só é gravada em `startSession(data.session)` **depois** do 200 (`AuthContext.tsx:94-97`); qualquer erro lança antes. **PASS.**
- **Deep link e params:** `VerifyEmail` recebe `{ email, cooldownSeconds }` tipado; o código **não** trafega por params. Não há configuração `linking` no `NavigationContainer` (só `expo-linking` importado em `routes/index.tsx` para convites), então a tela não é abrível por URL; recarregar volta ao Login. `cooldownSeconds` vindo de param só afeta o relógio local. **PASS.**
- **Campo:** `number-pad`, `maxLength=6`, `sanitizeCode` só dígitos, `autoComplete=one-time-code`; sem `secureTextEntry` (OTP não é segredo de longo prazo). INFO: quando o UXCam (referenciado em `manualAPK.md`, ainda não integrado no código) entrar, mascarar a tela `VerifyEmail`, que exibe e-mail e código em claro.

## 6. Injeção e validação

- Schema: `email` `format: 'email'`, `code` `pattern ^[0-9]{6}$`. Confirmado em script: `"123456\n"` → 400; letras/curto/longo → 400.
- `coerceTypes` do Fastify (`'array'`): `{"code":123456}` vira `"123456"` e `{"code":["123456"]}` vira `"123456"` (confirmado ao vivo: 400 `INVALID_CODE`, passou pelo schema). Só array de **1** elemento é coagido; não dá para mandar vários palpites numa requisição. Inofensivo.
- Propriedades extras são removidas silenciosamente (o Ajv do Fastify usa `removeAdditional`); não chegam ao provedor. O corpo ao GoTrue é montado campo a campo em `authProvider.js`, sem espalhar `request.body`. **PASS.**
- O `Map` do limiter é indexado por string do cliente: ver S1.

### S1 — MEDIUM (bloqueante) — `email` sem tamanho máximo vira amplificação de memória
- **Onde:** `routes/auth.routes.js` (`verify-email`, `resend-code`: `email: Type.String({ format: 'email' })` sem `maxLength`); `controller/auth.controller.js` (`key = email.trim().toLowerCase()`, `codeFailures.fail(key)`); `server.js` sem `bodyLimit` (padrão 1 MB).
- **Evidência:**
  - Script com o Ajv/Fastify do projeto: e-mail com 900 000 caracteres na parte local passa o `format: 'email'` (200).
  - Backend vivo (`:3000`): e-mail de 200 000 caracteres → **400 `INVALID_CODE`**. O GoTrue devolve 4xx, o backend mapeia para `INVALID_CODE`, e `codeFailures.fail(key)` guarda a chave de 200 kB no `Map` por 15 min.
- **Cenário:** 1 IP, 10 req/min a ~1 MB de e-mail → ~10 MB/min retidos, ~150 MB em 15 min (a janela só reinicia por chave; chaves diferentes não são varridas antes de vencerem). Vários IPs multiplicam. É um processo único que serve toda a API: OOM derruba tudo. Cada requisição também reenvia ~1 MB ao Supabase (amplificação de banda). Não exige conta nem autenticação.
- **Correção mínima:** `maxLength: 254` (limite de e-mail) em `email` nas rotas `verify-email` e `resend-code` (e, por consistência, `register` e `login`, que hoje só têm `minLength: 1` e repassam o valor ao GoTrue). Opcional em defesa em profundidade: limitar o número de chaves do `Map` (ex.: recusar com 429 acima de 10 000 chaves).
- **Reabrir:** Backend.

### S2 — MEDIUM (produção) / LOW (3 testers) — corrida e contador por instância
- **Onde:** `auth.controller.js` `verifyEmail`: `isBlocked(key)` → `await authProvider.verifyEmail` → `fail(key)`. Entre a checagem e a contagem há um `await` de rede (centenas de ms).
- **Evidência (por leitura; B2 do QA, que o minimizou como "teto = 10/min/IP"):** N requisições paralelas (várias fontes) passam todas por `isBlocked` antes da 1ª `fail()`. O teto por IP não limita um botnet; o teto real vira o balde `/verify` do GoTrue (ver tabela do item 1). Em serverless o contador também não é compartilhado (`ponytail:` em `attemptLimiter.js` já documenta isso).
- **Correção mínima (3 linhas, sem estado novo):** contar **antes** do `await`; zerar só no sucesso.
  ```js
  if (codeFailures.isBlocked(key)) return sendAuthError(request, reply, new authProvider.AuthError('RATE_LIMITED'));
  codeFailures.fail(key);              // reserva a tentativa; síncrono, atômico no event loop
  try {
    const session = await authProvider.verifyEmail(email, code);
    codeFailures.reset(key);
    return reply.status(200).send({ session });
  } catch (err) { return sendAuthError(request, reply, err); }
  ```
  Efeito colateral aceito: erros 5xx/429 do GoTrue também consomem tentativa (conservador). A 5ª tentativa com o código certo ainda funciona.
- **Para produção serverless:** contador compartilhado no Postgres (item 1, mitigação 2). Não precisa para os 3 testers.
- **Reabrir:** Backend. Se o Maestro preferir, S2 fica como decisão registrada enquanto o deploy for processo único; S1 não.

## 7. Username squatting (contas não confirmadas)

### S4 — LOW — contas não confirmadas ocupam `username` para sempre
- **Mecanismo:** o trigger `handle_new_user` (`AFTER INSERT ON auth.users`) cria `user_profiles` com o `username` do cadastro **antes** da confirmação (`20260918165833_supabase_auth_link`). `user_profiles.username` é `@unique`. Nada remove contas não confirmadas (o GoTrue não faz purge sozinho). `register` checa `usernameExists` e devolve 409 para quem tentar o mesmo nome.
- **Alcance:** `register` 10/min/IP → ~14 400 contas/dia/IP, cada uma com e-mail sintaticamente válido (não precisa existir) e `username` livre. Um atacante reserva nomes desejados ("leonardo", marcas, nomes de amigos) e os enumera por 409.
- **Efeito colateral:** a tentativa de cadastro com o e-mail **da vítima** cria a linha de perfil com os dados do **atacante** (nome, username, nascimento, medidas); um cadastro posterior da vítima com o mesmo e-mail reutiliza a conta existente e **não** reexecuta o trigger (só dispara em INSERT), então o perfil mantém os dados do atacante até a vítima editar. Inferido pela leitura do trigger; o comportamento exato do GoTrue no signup repetido não foi testado.
- **Severidade:** LOW para 3 testers e para a fase atual (nome não vale nada); sobe para MEDIUM com base de usuários pública.
- **Mitigação mínima:** rotina no banco que apaga `auth.users` com `email_confirmed_at IS NULL` há mais de 24–48 h (o `ON DELETE CASCADE` de `users.id → auth.users.id` já limpa perfil, medidas e streak) e, junto, CAPTCHA no `register` quando houver tráfego público.
- **Reabrir:** Database (rotina) quando for a produção; nenhuma task agora.

## 8. Chave usada

**PASS.** `authProvider.js` envia só `apikey: process.env.PUBLISHABLE_KEY` em `/signup`, `/token`, `/verify`, `/resend`, `/logout`; `logout` usa o Bearer do próprio usuário. `grep` por `SERVICE_ROLE`/`SECRET_KEY`/`service_role` em `BackEndTorv/src` e `server.js`: zero ocorrências. As únicas variáveis lidas pelo código são `PUBLISHABLE_KEY`, `SUPABASE_URL`, `PORT`, `NODE_ENV` (mais as do Prisma). A chave publishable não está no bundle do app (fechado em `security-supabase-anon-exposure`), então o único caminho aos endpoints do GoTrue passa pelo backend; **se essa chave vazar**, o limiter do backend deixa de proteger o `/verify` (cairia só nos limites do GoTrue). Registrar para a rotação de chaves.

## Outros achados

### S5 — LOW — e-mail bombing e esgotamento da cota de e-mails
- `resend-code` (5/min/IP) e `register` (10/min/IP) fazem o GoTrue enviar e-mail a qualquer endereço. O GoTrue limita 1 e-mail/60 s **por usuário**, então uma vítima recebe no máximo ~60/h por mais IPs que o atacante use; e o limite global de e-mails do projeto (SMTP embutido: muito baixo; SMTP próprio: 30 novos usuários/h por padrão) pode ser esgotado por um IP só, e aí nenhum usuário legítimo recebe código.
- **Decisão registrada** para 3 testers. Para produção: SMTP próprio com cota maior e CAPTCHA em `register`/`resend` (o GoTrue aceita `captcha_token`).

### S6 — LOW (disponibilidade) — balde `/verify` do GoTrue é compartilhado
- O GoTrue só vê o IP do backend: 360 verificações/h (rajada 30) para **todos** os usuários. Um IP, com e-mails inexistentes rotativos (o limiter por e-mail não o segura; 10/min/IP > 6/min de reposição), mantém o balde seco: toda confirmação legítima volta `RATE_LIMITED`.
- **Decisão registrada** para testers. Para produção: IP de saída estático ou repassar o IP do cliente quando o GoTrue/provedor suportar, e CAPTCHA.

### INFO
- **I1:** Caminho feliz (`verify-email` com código real) **não foi exercitado contra o GoTrue** em nenhum round (QA usou stub de rede e e-mail inexistente). Falha fechada, sem impacto de segurança; para o Maestro: confirmar com uma conta real que `type: 'email'` aceita o código de **signup** no seu projeto (se não aceitar, o app nunca confirma ninguém).
- **I2:** Rate limit por IP depende de `request.ip`; atrás de proxy/LB sem `trustProxy` todos dividem um balde; com `trustProxy: true` mal configurado o header passa a ser burlável (registrado em `security-groups-competition-2026-10-06-round2`, INFO-1). Vale para estas rotas.
- **I3:** `.env` tem `JWT_SECRET` e `PROJECT_URL` que nenhum código de `src/` ou `server.js` lê. Sobra da migração; remover reduz superfície de vazamento.
- **I4:** Confirmar no painel do Supabase antes de produção: `Email OTP Expiration` (recomendo 600 s), SMTP próprio, limites em `Authentication > Rate Limits`.
- **I5:** `login` tem `email: Type.String({ minLength: 1 })` e `password` sem teto de tamanho, repassados ao GoTrue (mesmo vetor do S1, sem retenção em memória). Incluir `maxLength` no mesmo retrabalho.

## Regressão de segurança no resto do diff
Sem alteração em auth middleware, CORS, uploads, SQL ou schema Prisma. Sem segredo no diff. Testes `auth.edge.test.js`, `attemptLimiter.test.js` e `authProvider.test.js` não contêm chave ou credencial real.

## Limpeza
Nenhuma conta, linha ou arquivo criado. As duas requisições ao backend vivo usaram e-mails inexistentes (`@torvtest.dev`); o `Map` do processo guarda, por até 15 min, uma chave de 200 kB e uma de ~30 caracteres; expiram sozinhas. Scripts de reprodução ficaram no diretório temporário da sessão.
