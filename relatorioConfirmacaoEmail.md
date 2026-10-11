# Confirmação de e-mail por código — o que foi feito e como funciona

Escrito em 2026-10-09. Cobre a etapa **1.7 do `manualAPK.md`**. Este texto foi escrito para você **aprender o fluxo**: primeiro a ideia, depois cada peça de código, depois o porquê das decisões e como testar.

> **Estado:** código pronto, testado e revisado em segurança. **Falta você** ligar o "Confirm email" no Supabase (passo 1.8 do manual) e testar com um e-mail real (1.9). Sem isso, nada muda para quem usa o app hoje.

---

## 1. A ideia em 30 segundos

Quando alguém cria uma conta, queremos ter certeza de que o e-mail é **dele**. Para isso:

1. Ele se cadastra.
2. Mandamos um **código de 6 dígitos** para o e-mail.
3. Ele digita o código no app.
4. Se o código estiver certo, o e-mail fica **confirmado** e ele entra.

Quem faz o trabalho pesado é o **Supabase Auth** (o "provedor", internamente chamado GoTrue): ele gera o código, guarda, manda o e-mail (via SMTP) e valida. O **nosso backend** fica no meio, como um porteiro, e o **app** só mostra as telas.

```
App (celular)  ──►  Nosso backend (Fastify)  ──►  Supabase Auth (GoTrue)  ──►  SMTP (Gmail)  ──►  caixa de e-mail
```

**Por que o app não fala direto com o Supabase?** Regra do projeto: o front só chama a nossa API. Assim a chave do Supabase não vai dentro do APK, e nós colocamos limites e regras (rate limit, mensagens de erro padronizadas) antes de a requisição chegar no provedor.

---

## 2. O fluxo completo, passo a passo

### Caminho A — cadastro novo

| # | Quem | O que acontece |
|---|---|---|
| 1 | App | Você preenche o wizard de cadastro e toca em "Continuar" no último passo. O app faz `POST /auth/register`. |
| 2 | Backend | Valida os campos e chama o Supabase `POST /auth/v1/signup`. |
| 3 | Supabase | Cria o usuário **sem confirmar**, dispara o e-mail com o código e responde **sem sessão** (sem token de acesso). |
| 4 | Backend | Responde `201 { session: null, confirmation_required: true }`. |
| 5 | App | Vê `confirmation_required: true` e abre a tela **VerifyEmail** ("Confirme seu e-mail"), com o botão "Reenviar" bloqueado por 60 s. |
| 6 | Você | Abre o e-mail, digita os 6 dígitos e toca em **Confirmar**. |
| 7 | App → Backend | `POST /auth/verify-email { email, code }`. |
| 8 | Backend → Supabase | `POST /auth/v1/verify { type: "email", email, token }`. |
| 9 | Supabase | Código certo: marca o e-mail como confirmado e **devolve a sessão** (tokens). |
| 10 | Backend → App | `200 { session }`. O app guarda a sessão e **entra sozinho** na área logada. |

### Caminho B — a pessoa tenta logar antes de confirmar

1. App faz `POST /auth/login` com e-mail e senha **certos**.
2. O Supabase responde com o erro `email_not_confirmed`.
3. O backend devolve `403 { code: "EMAIL_NOT_CONFIRMED" }`.
4. O app, em vez de mostrar "senha errada", abre a tela VerifyEmail (com "Reenviar" já liberado, porque ela pode ter perdido o primeiro e-mail).

### Caminho C — reenviar o código

1. Toque em "Reenviar código" → `POST /auth/resend-code { email }`.
2. O backend pede ao Supabase um novo código (`/auth/v1/resend`, tipo `signup`). **O código antigo deixa de valer.**
3. Responde `204` (sem corpo) e o app mostra "Código reenviado" e trava o botão por 60 s.

### O que NÃO muda
- Login normal, refresh de token, logout e o cadastro (o contrato do `register` é o mesmo de antes).

---

## 3. O que cada camada faz

### 3.1 Supabase (configuração, sem código nosso)
- **Confirm email** (liga/desliga): quando ligado, o signup não devolve sessão e o login exige confirmação.
- **SMTP** e **template "Confirm signup"** com `{{ .Token }}`: é o que faz o e-mail chegar com o número de 6 dígitos (manual 1.3 e 1.4).

### 3.2 Backend (`BackEndTorv`)

| Arquivo | O que tem |
|---|---|
| `src/lib/authProvider.js` | O "adaptador" que fala com o Supabase. Ganhou `verifyEmail`, `resendSignup` e três erros novos. |
| `src/lib/attemptLimiter.js` (novo) | Um contador de tentativas por chave (usado por e-mail). |
| `src/controller/auth.controller.js` | Lógica das rotas novas e o mapa de códigos de erro → status HTTP. |
| `src/routes/auth.routes.js` | Define as rotas, os formatos aceitos (schemas) e os limites por IP. |
| testes | `auth.routes.test.js`, `auth.edge.test.js`, `lib/tests/authProvider.test.js`, `lib/tests/attemptLimiter.test.js` |

**As três rotas que mudaram ou nasceram**

| Rota | Entrada | Respostas |
|---|---|---|
| `POST /auth/login` (alterada) | `{ email, password }` | `200 { session }` · `401` senha errada · **`403 { code: "EMAIL_NOT_CONFIRMED" }`** · `429` · `502` |
| `POST /auth/verify-email` (nova) | `{ email, code }`, `code` = exatamente 6 dígitos | `200 { session }` · **`400 { code: "INVALID_CODE" }`** (errado **ou** expirado) · `429 { code: "RATE_LIMITED" }` · `502` |
| `POST /auth/resend-code` (nova) | `{ email }` | **`204`** sempre que o pedido é aceito · `429 { code: "RATE_LIMITED" }` · `502` |

**O trecho central, no adaptador** (`authProvider.js`):

```js
// Login: o Supabase só diz "e-mail não confirmado" DEPOIS de validar a senha.
if (isClientError(status) && data.error_code === 'email_not_confirmed')
  throw new AuthError('EMAIL_NOT_CONFIRMED');

// Verificar o código: type "email" + e-mail + token (os 6 dígitos).
async function verifyEmail(email, token) {
  const { status, data } = await call('/verify', { type: 'email', email, token });
  if (status === 200) return toSession(data);              // entra
  if (status === 429 || data.error_code === 'over_request_rate_limit')
    throw new AuthError('RATE_LIMITED');
  // expirado e errado ficam iguais DE PROPÓSITO
  throw new AuthError(isClientError(status) ? 'INVALID_CODE' : 'PROVIDER');
}

// Reenviar: pede um novo código do tipo "signup".
async function resendSignup(email) {
  const { status, data } = await call('/resend', { type: 'signup', email });
  ...
}
```

> Esses nomes (`email_not_confirmed`, `type: 'email'` para o código de cadastro, `type: 'signup'` no reenvio) foram **conferidos na documentação do Supabase** antes de escrever o código.

**O trecho central, no controller** (a proteção contra adivinhar o código):

```js
const codeFailures   = createAttemptLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const resendCooldown = createAttemptLimiter({ max: 1, windowMs: 60 * 1000 });

async verifyEmail(request, reply) {
  const key = emailKey(email);                       // e-mail em minúsculas, sem espaços
  if (codeFailures.isBlocked(key)) return ...429;    // já gastou as 5 tentativas
  codeFailures.fail(key);                            // reserva a tentativa ANTES de perguntar ao Supabase
  try {
    const session = await authProvider.verifyEmail(email, code);
    codeFailures.reset(key);                         // acertou: zera
    return reply.status(200).send({ session });
  } catch (err) { return sendAuthError(request, reply, err); }
}
```

### 3.3 Frontend (`FrontEndTorv`)

| Arquivo | O que mudou |
|---|---|
| `src/screens/VerifyEmail/index.tsx` + `styles.ts` (novos) | A tela do código: campo de 6 dígitos, botão Confirmar, "Reenviar em 42s", mensagens de erro, "← Voltar ao login". |
| `src/utils/emailCode.ts` + `emailCode.test.mjs` (novos) | `sanitizeCode` (só dígitos, no máximo 6) e `isCodeComplete`, com testes. |
| `src/contexts/AuthContext.tsx` | Ganhou `verifyEmail(email, code)` e `resendCode(email)`. O `verifyEmail` já **inicia a sessão**, e por isso o app troca sozinho para a área logada. |
| `src/screens/Register/index.tsx` | Se `confirmation_required`, **navega** para VerifyEmail (antes só mostrava um texto). |
| `src/screens/Login/index.tsx` | Se vier `403 EMAIL_NOT_CONFIRMED`, navega para VerifyEmail. |
| `src/routes/PublicRoutes/index.tsx` e `src/routes/types.ts` | Registra a tela e tipa os parâmetros (`email`, `cooldownSeconds`). |

**Como o app "entra sozinho"** (o ponto que mais confunde): o `AuthContext` guarda `signed`. Quando `verifyEmail` termina, ele chama `startSession`, que salva os tokens e liga `signed = true`. O componente de rotas olha `signed` e troca da pilha pública (Login/Register/VerifyEmail) para a privada. Ninguém precisa navegar manualmente.

---

## 4. Por que foi desenhado assim (as decisões)

1. **Código de 6 dígitos, não link.** O link abre o navegador e precisa voltar para o app (deep link ou site hospedado). O código é digitado no próprio app.
2. **Expirado e errado dão a mesma resposta (`INVALID_CODE`).** Dizer "expirou" só ajudaria quem está tentando adivinhar.
3. **Reenviar sempre responde 204.** Se respondêssemos "esse e-mail não existe", qualquer pessoa descobriria quem tem conta. Resposta igual para todos = ninguém descobre nada.
4. **O 403 do login só aparece depois da senha certa.** Esse é o comportamento do próprio Supabase. Quem não sabe a senha continua vendo "e-mail ou senha incorretos".
5. **Limite de tentativas do código.** São só 1 milhão de combinações. Por isso:
   - 10 tentativas por minuto por IP (rate limit);
   - **5 erros por e-mail a cada 15 min**, e depois disso nem perguntamos mais ao Supabase;
   - o próprio código expira.
   Chance de um atacante acertar o código de um alvo: cerca de **2,5 em 100 mil por hora** (cálculo no relatório de segurança).
6. **A tentativa é contada antes de perguntar ao Supabase.** Sem isso, 20 pedidos simultâneos passariam todos pela checagem antes de o primeiro erro ser contado. Foi um achado real do Security (testado ao vivo: com a correção, exatamente 5 chegam ao Supabase).
7. **Cooldown de 60 s no reenvio, nosso e independente de a conta existir.** O Supabase só limita contas reais, e isso denunciaria quais e-mails têm cadastro.
8. **Tamanho máximo nos campos** (e-mail 254, senha 128, `refresh_token` 512). Sem isso, alguém mandaria e-mails de 1 MB e encheria a memória do servidor (o contador guarda o e-mail como chave). Foi o achado bloqueante do Security.
9. **Logs sem dado pessoal.** Quando engolimos um erro do Supabase (por exemplo cota de e-mails esgotada), logamos só o `error_code`, nunca o e-mail ou o código.
10. **Só a chave publicável** é usada no fluxo. Nenhuma chave secreta entra aqui.

---

## 5. O caminho que o código fez (processo)

Seguiu o fluxo do projeto: Edit → Test → Security, tudo em sequência.

| Etapa | Quem | Resultado | Commit / relatório |
|---|---|---|---|
| Edit backend | Torv Backend | 196 testes verdes | `1ecbfe6` |
| Edit frontend | Torv Frontend | 49 testes, `tsc` limpo | `783f7aa` |
| Test round 1 | Torv Review and Tests | **FAIL**: "Voltar ao login" empilhava outra tela de Login | `docs/qa-email-confirmation-2026-10-09.md` |
| Rework frontend | Torv Frontend | `popTo('Login')`; Enter envia; acessibilidade; `trim()` do e-mail | `77896ec` |
| Test round 2 | Torv Review and Tests | **PASS** (usabilidade no navegador com a API simulada) | `docs/qa-email-confirmation-2026-10-09-round2.md` |
| Security round 1 | Torv Security | **FAIL**: e-mail sem tamanho máximo; corrida no contador | `docs/security-email-confirmation-2026-10-09.md` |
| Rework backend | Torv Backend | tetos de tamanho, reserva antes do `await`, cooldown do reenvio | `726b9f1` |
| Test round 3 | Torv Review and Tests | **PASS** (218 testes) | `docs/qa-email-confirmation-2026-10-09-round3.md` |
| Security round 2 | Torv Security | **PASS** | `docs/security-email-confirmation-2026-10-09-round2.md` |
| Ajustes finais (LOW) | Torv Backend | teto do `refresh_token`; log do cadastro | `f362779` (220 testes) |

Nada foi enviado ao GitHub (sem `push`).

---

## 6. O que você precisa fazer agora

Faça nesta ordem (detalhes no `manualAPK.md`, seções 1.3 a 1.9):

1. **SMTP** (1.3) e **template** com `{{ .Token }}` (1.4). Teste o envio **antes** de ligar a confirmação (1.5).
2. **Reinicie o backend** no Furnace para carregar o código novo, caso ainda não tenha reiniciado.
3. **Ligue "Confirm email"** (1.8).
4. **Teste com um e-mail real** (checklist 1.9).

### ⚠️ O ponto que ninguém testou ainda
Nenhum teste automático conversou com o **Supabase de verdade** para validar o código. Eu sei, pela documentação, que o código de cadastro se verifica com `type: "email"`, mas **só o seu teste real prova**. Se você digitar o código certo e der "Código inválido ou expirado":

- Abra `BackEndTorv/src/lib/authProvider.js`, função `verifyEmail`, e troque `type: 'email'` por `type: 'signup'`. É uma palavra.
- Me avise e eu ajusto o teste.

### Detalhes que vão aparecer na prática
- **Digitou o e-mail errado no cadastro?** A conta já existe, sem confirmar, e o *username* fica "preso" a ela. Se tentar de novo com o mesmo username, vai aparecer "Esse nome de usuário já está em uso". Use outro username, ou apague a conta de teste. No **SQL Editor** do Supabase, trocando pelo e-mail dela:
  ```sql
  delete from auth.users where email = 'teste@exemplo.com' and email_confirmed_at is null;
  ```
  🔍 Isso deve apagar também o perfil (há exclusão em cascata), mas confira numa conta de teste antes de usar com dados reais.
- **Cinco códigos errados** bloqueiam as tentativas daquele e-mail por 15 minutos. É de propósito (item 5 acima). Reiniciar o backend zera o contador.
- **Limite de 30 e-mails por hora** depois de ligar o SMTP próprio (manual 1.3).
- **Spam:** com Gmail, o e-mail pode cair no spam.
- **Cadastrar com um e-mail que já tem conta** abre a tela de código, mas nenhum código chega (o Supabase não revela que a conta existe). O app diz "veja a caixa de spam" e oferece "Voltar ao login".

---

## 7. Como testar (sem e-mail e com e-mail)

**Automático** (já rodou):
```bash
cd BackEndTorv && npm test          # 220 testes
cd FrontEndTorv && npx tsc --noEmit
cd FrontEndTorv && node --test src/utils/*.test.mjs   # 49 testes
```

**Na mão, com `curl`** (backend ligado em `http://localhost:3000`, e-mail inexistente de propósito):
```bash
# código errado → 400 {"code":"INVALID_CODE"}
curl -s -X POST localhost:3000/auth/verify-email -H "Content-Type: application/json" \
  -d '{"email":"naoexiste@torvtest.dev","code":"000000"}'

# reenviar → 204; de novo em menos de 60 s → 429 RATE_LIMITED
curl -i -X POST localhost:3000/auth/resend-code -H "Content-Type: application/json" \
  -d '{"email":"naoexiste@torvtest.dev"}'
```

**No app:** o checklist 1.9 do manual.

---

## 8. Limites conhecidos (decisões registradas, não bugs)

| Limite | Por quê aceitamos | Quando revisar |
|---|---|---|
| Os contadores de tentativa ficam **na memória de cada instância** do backend | Para 3 testers e um processo só, basta. Na Vercel há várias instâncias e cada uma conta sozinha | Antes de ir a produção: contador no Postgres |
| 5 erros bloqueiam o e-mail por 15 min (alguém mal-intencionado poderia travar a confirmação de outra pessoa) | A alternativa (limite por e-mail + IP) devolve tentativas ao atacante e enfraquece a proteção contra adivinhação | Se virar abuso real |
| Contas nunca confirmadas ocupam o username para sempre | Para 3 testers não pesa | Antes de produção: rotina que apaga contas não confirmadas há mais de 24–48 h |
| Se a cota de e-mails do Supabase acabar, o cadastro parece funcionar e nenhum e-mail chega (o log do backend registra `over_email_send_rate_limit`) | É o preço de não revelar quais e-mails existem | Usar SMTP próprio com cota maior |
| Um IP pode esgotar o limite de verificação do Supabase e atrapalhar os outros | Todos os pedidos saem com o IP do backend | Produção: CAPTCHA e IP de saída estável |

**Lista "antes de produção"** (completa, com prioridade, no fim de `docs/security-email-confirmation-2026-10-09-round2.md`): contador no Postgres, purge de contas não confirmadas, SMTP próprio, CAPTCHA, validade do código em 600 s no painel, `trustProxy` ao hospedar, remover `JWT_SECRET` e `PROJECT_URL` do `.env` (não são mais lidas) e mascarar a tela do código se um dia usarmos UXCam.

---

## 9. Mini-glossário

- **SMTP:** o "carteiro" que entrega e-mail. O Supabase usa o SMTP que você configurar.
- **OTP (one-time password):** senha de uso único; aqui, o código de 6 dígitos.
- **Provedor / GoTrue:** o serviço de autenticação do Supabase.
- **Sessão:** o par de tokens (acesso + renovação) que prova que você está logado.
- **Rate limit:** limite de pedidos por tempo.
- **Enumeração de contas:** descobrir quais e-mails têm conta pelas diferenças de resposta. Evitamos respondendo igual para todo mundo.
- **Cooldown:** tempo de espera obrigatório entre dois pedidos iguais.
- **Cascata (`ON DELETE CASCADE`):** apagar o usuário apaga automaticamente os dados ligados a ele.

---

## 10. Arquivos criados e alterados (resumo)

**Criados:** `BackEndTorv/src/lib/attemptLimiter.js`, `BackEndTorv/src/lib/tests/attemptLimiter.test.js`, `BackEndTorv/src/lib/tests/authProvider.test.js`, `BackEndTorv/src/routes/auth.edge.test.js`, `FrontEndTorv/src/screens/VerifyEmail/index.tsx`, `FrontEndTorv/src/screens/VerifyEmail/styles.ts`, `FrontEndTorv/src/utils/emailCode.ts`, `FrontEndTorv/src/utils/emailCode.test.mjs`, 5 relatórios em `docs/` (`qa-email-confirmation-*` ×3 e `security-email-confirmation-*` ×2).

**Alterados:** `BackEndTorv/src/lib/authProvider.js`, `BackEndTorv/src/controller/auth.controller.js`, `BackEndTorv/src/routes/auth.routes.js`, `BackEndTorv/src/routes/auth.routes.test.js`, `FrontEndTorv/src/contexts/AuthContext.tsx`, `FrontEndTorv/src/screens/Login/index.tsx`, `FrontEndTorv/src/screens/Register/index.tsx`, `FrontEndTorv/src/routes/PublicRoutes/index.tsx`, `FrontEndTorv/src/routes/types.ts`.

**Não tocados:** schema, SQL, `register` (contrato), `.env`. `FrontEndTorv/app.json` continua com a sua alteração do ícone, sem commit.
