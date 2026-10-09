# Security — Confirmação de e-mail por código de 6 dígitos — ROUND 2 (2026-10-09)

**Escopo:** só o retrabalho. Commit `726b9f1` (S1 `maxLength`, S2 reserva antes do `await`, S3a/b/c, B3) e testes `982f645`. Round 1: `docs/security-email-confirmation-2026-10-09.md` (FAIL: S1 MEDIUM, S2 MEDIUM/LOW, S3–S6 LOW), não alterado. Pré-condição atendida: QA round 3 PASS (`docs/qa-email-confirmation-2026-10-09-round3.md`, 218/218). Arquivos lidos por inteiro no estado atual: `routes/auth.routes.js`, `controller/auth.controller.js`, `lib/authProvider.js`, `lib/attemptLimiter.js`, `lib/profileValidation.js`.

**Método:** leitura do diff e do código atual; script isolado com o Ajv/Fastify do projeto (variantes de e-mail); três testes ao vivo no backend em `:3000` (não parei nem subi outra instância), todos com e-mails inexistentes `@torvtest.dev`: rajada de 20 `verify-email` paralelos, `refresh` com token de 900 kB e `register` com senha de 129 caracteres. Nenhuma conta criada. Nenhum segredo lido (do `.env` só os nomes das variáveis). **Não verificado:** configuração real do projeto Supabase (OTP, SMTP, limites de auth). Números do GoTrue vêm da documentação oficial.

## Veredito: PASS — 0 CRITICAL, 0 HIGH, 0 MEDIUM abertos; S1, S2 e S3 fechados. 2 LOW novos, 3 decisões registradas, lista pré-produção ao final

Nada exige retrabalho para fechar a feature. N1 (teto no `refresh_token`) e N2 (log no `signUp`) são melhorias de uma e três linhas que recomendo no mesmo commit de ajuste, antes dos testers receberem o app.

| # | Sev | Camada | Resumo | Ação |
|---|---|---|---|---|
| S1 | — | Backend | **Fechado** | — |
| S2 | — | Backend | **Fechado** (processo único) | contador compartilhado só para serverless |
| S3 | — | Backend | **Fechado** com resíduos (timing; SMTP embutido) | decisão registrada |
| N1 | LOW | Backend | `refresh_token` sem `maxLength` chega ao provedor (provado ao vivo) | `maxLength: 512` |
| N2 | LOW | Backend | Cota de e-mail do Supabase acabando vira buraco negro silencioso (R1 do QA) | melhoria: logar no `signUp` |
| N3 | INFO | Backend | Senha > 128 de conta antiga deixa de logar | aceito |
| B1 | — | Backend | Lockout por e-mail (agora também o cooldown do resend) | decisão registrada |
| R2 | — | Backend/Front | 502 do provedor consome o cooldown do resend | decisão registrada |

---

## 1. S1 — teto de tamanho: fechado para o limiter; sobra um campo no provedor (N1)

**Verificado**
- `Email()` (`format: 'email'`, `maxLength: 254`) em `register`, `verify-email`, `resend-code`; `login` tem `minLength: 1, maxLength: 254`. Senha: `register` 6–128, `login` 1–128. Ao vivo (QA e meu script): 255 caracteres → 400 antes do provedor e do limiter; `register` com senha de 129 → 400 `body/password must NOT have more than 128 characters`.
- A chave do limiter é só `emailKey(email)` (≤ 254 caracteres após o schema). Nenhum outro campo de string vira chave de `Map`. Pior caso de memória: ~150 chaves por IP por janela × ~350 B ≈ 50 kB por IP (era ~150 MB). Só um botnet de dezenas de milhares de IPs enche o `Map`; opcional limitar o número de chaves (INFO).
- Variantes de e-mail testadas no Ajv "fast" do projeto: aspas, `Nome <a@b>`, ponto final no domínio, IP literal, Unicode, NUL, espaço/`\n` nas pontas, comentário → todas 400. Só ASCII sem espaço passa, então não há variante que o GoTrue normalize para o mesmo usuário e que gere **outra** chave no limiter (maiúsculas e minúsculas já convergem em `toLowerCase`).

**Resíduo — N1, LOW:** `POST /auth/refresh` ainda aceita `refresh_token: Type.String({ minLength: 1 })` sem teto e repassa ao GoTrue. Provado ao vivo: token de 900 kB → o backend encaminhou e o GoTrue respondeu 401 em 543 ms. Não retém memória (não vira chave), mas gasta banda de saída e do Supabase: até 30/min/IP × ~1 MB. Os demais campos de `register` que não têm teto (`gender`, `fitness_level`, `goal`) são validados contra listas fixas **antes** de qualquer chamada ao provedor (`profileValidation.js`, `GENDERS`, `ACTIVITY_FACTORS`, `GOAL_NAMES`), então um valor grande é recusado em 400. `name` e `username` têm teto 100. `logout` lê o header `Authorization`, limitado pelo Node (~16 kB). Correção: `maxLength: 512` em `refresh_token`. Camada: Backend. Não bloqueia.

## 2. S2 — a reserva antes do `await` está correta; nenhum caminho sem contagem chega ao GoTrue

- `verifyEmail` faz `isBlocked(key)` e `fail(key)` seguidos, ambos síncronos e sem `await` entre eles: atômico no event loop do Node. O `reset` só roda no sucesso.
- **Ao vivo (rajada de 20 paralelos, mesmo e-mail inexistente):** `5×400 INVALID_CODE` (chegaram ao GoTrue), `5×429 RATE_LIMITED` (nosso limiter por e-mail) e `10×429` sem `code` (limite por IP, 10/min). Ou seja, **exatamente 5** palpites chegaram ao provedor; antes eram todos que passassem por `isBlocked`.
- **Caminhos até o GoTrue que não contam tentativa:** nenhum encontrado. `/auth/v1/verify` só é chamado por `authProvider.verifyEmail`, que só `AuthController.verifyEmail` chama, depois da reserva. `login` fala com `/token`, `register` com `/signup`, `resend` com `/resend`: nenhum valida OTP. Corpo `multipart` ou `urlencoded` não chega (não há parser JSON alternativo registrado para essas rotas; sem `request.body` o schema devolve 400). Uma exceção inesperada depois da reserva fica contada (testado pelo QA).
- **Novas brechas da reserva:** (a) quem esgota as 5 tentativas da vítima é o B1, já aceito; (b) como todo erro do provedor consome tentativa (5xx e 429 incluídos), a soma com S6 (um IP esvazia o balde `/verify` do GoTrue) faz o GoTrue devolver 429 a usuários legítimos, e cada um desses 429 gasta uma das 5 tentativas deles; depois de 5 o usuário fica 15 min bloqueado mesmo com o balde já recuperado. É o mesmo efeito de B1/S6, só amarrado: **decisão registrada**. Se incomodar, devolver a tentativa quando o erro for `RATE_LIMITED`/`PROVIDER` (o código não foi avaliado pelo GoTrue) é seguro e custa 2 linhas, mas hoje não é necessário.
- **Janela fixa:** o teto é "5 por janela de 15 min que começa na 1ª tentativa". Cinco tentativas no fim de uma janela e cinco no início da seguinte dão 10 seguidas; a média continua 20/h.

## 3. S3 — o oráculo de existência: eliminado nos sinais de status; sobram dois resíduos

**Eliminado**
- `resend-code`: qualquer 4xx do GoTrue (e-mail inexistente, conta já confirmada, `over_email_send_rate_limit`, 429) vira 204. O único 429 `RATE_LIMITED` vem do **nosso** cooldown de 60 s por e-mail (`resendCooldown`, reserva síncrona antes do `await`, chave normalizada), igual para conta existente ou inexistente, ou do limite por IP. QA ao vivo: 1º pedido 204, 2º com outra caixa de letras 429.
- `register`: `signUp` mapeia `over_email_send_rate_limit` para `null`, ou seja, 201 `confirmation_required: true`, igual a cadastro novo. Cobre o 429 por usuário (reenvio em < 60 s de conta não confirmada).
- `verify-email` e `login` não mudaram: 400 uniforme; 403 só depois da senha certa.

**O que sobrou**
1. **Timing (LOW/INFO, não medido).** Conta existente e não confirmada faz o GoTrue enviar e-mail na própria requisição; e-mail inexistente responde rápido. A diferença pode ser observável em `resend-code` e em `register`. Atacante limitado a 5/min/IP e 1 por 60 s por e-mail; só revela "existe e não confirmada". Mitigação, se virar problema: responder 204 sem aguardar o provedor (perde o 502 visível). **Decisão registrada.**
2. **Dependente do SMTP.** Com o SMTP embutido do Supabase, que só entrega a endereços da equipe, o GoTrue devolve `email_address_not_authorized` ao tentar enviar. O mapeamento transforma isso em 502 (`resendSignup`, `signUp`). No resend, conta existente e não confirmada (tenta enviar) dá 502 enquanto e-mail inexistente (nem tenta) dá 204; no register, e-mail novo dá 502 enquanto conta já confirmada (não envia) dá 201. Por leitura do código, **sem teste** do comportamento exato do GoTrue. Some com SMTP próprio, que já está na lista pré-produção. **Decisão registrada.**
3. `EMAIL_TAKEN` (só com a confirmação desligada) e `USERNAME_TAKEN` seguem como aceitos nos rounds anteriores.

## 4. Achados do QA R1 e R2

### R1 → N2, LOW, melhoria (não falha de segurança)
`signUp` engole `over_email_send_rate_limit` sem log, e esse código **não distingue** o limite por usuário (60 s) do limite **global** de e-mails do projeto. Se a cota global acabar, o cadastro devolve 201, o app abre a tela de código, provavelmente nenhum usuário é criado (o limite global de e-mails costuma ser checado antes de criar a conta; não testado) e o "Reenviar" também responde 204 ("Código reenviado") sem enviar nada. Antes do rework a falha aparecia como 502. Não há vulnerabilidade, mas há um buraco negro de disponibilidade, e com o **SMTP embutido** (teto muito baixo por hora) é plausível durante o teste. O rastro existe no painel do Supabase (logs de Auth), não no log do backend. O swallow em si é necessário (é o que remove o oráculo): **decisão registrada**. A melhoria é pequena: devolver o sinal também em `signUp` (ex.: `{ session: null, swallowed }`) e logar `request.log.warn({ error_code }, ...)` no controller, sem e-mail, como já faz o resend. Opcional e mais completo: um cooldown nosso compartilhado entre `register` e `resend`; um `over_email_send_rate_limit` fora dele indica cota global e deve virar 502 visível.

### R2 → decisão registrada
O 502 do provedor consome o cooldown do resend: o usuário espera até 60 s para tentar de novo, o que também poupa um provedor que está falhando. É UX; o front pode iniciar o contador também no erro 502 se incomodar. Não é falha.

## 5. Regressão introduzida pelo rework

- **N3, INFO:** `login` agora recusa senha > 128 (`maxLength: 128`). Conta criada antes do teto com senha maior não consegue entrar. Improvável com os 3 testers; o `register` anterior não tinha teto. Aceito.
- Sem regressão em `login`/`refresh`/`logout` (respostas 401/502 sem `code`), em `register` (409 com `code`), nem nos schemas de resposta 429 (QA R3). Nenhuma alteração de frontend, auth middleware, CORS, SQL ou schema Prisma. Nenhum segredo ou chave no diff; `grep` por `service_role`/`SECRET_KEY` continua vazio e só `PUBLISHABLE_KEY` entra no fluxo.
- O cooldown do resend é novo vetor de B1: quem manda um `resend-code` para a vítima ocupa o cooldown dela por 60 s e **invalida o código anterior** (cada reenvio gera um novo). Atacante pode manter a vítima sem um código válido por tentativa de reenvio. Mesmo perfil de DoS dirigido do B1 (sem vazamento de dado), limitado por 5/min/IP. **Decisão registrada.**

## 6. Brute force — números atualizados (corrida fechada)

Premissa: p = 10⁻⁶ por palpite; cada reenvio gera código novo (palpites antigos não acumulam).

| Cenário | Palpites/alvo | P(acerto) |
|---|---|---|
| 1 IP, processo único (deploy atual) | ≤ 5 por janela de 15 min = 20/h (25 contando a borda) | ≤ 2,5 × 10⁻⁵ por hora; ≤ 4,8 × 10⁻⁴ por dia |
| Botnet de qualquer tamanho, processo único | igual: a chave é o e-mail e a reserva é síncrona | **igual ao anterior** (antes: ~3,6 × 10⁻⁴ por hora, limitado só pelo GoTrue) |
| Todos os alvos juntos, processo único com IP de saída fixo | o GoTrue limita `/verify` a 360/h por IP do backend, somando todos os e-mails | ≤ 8 640 palpites/dia → ≤ 8,6 × 10⁻³ de acertar **algum** alvo por dia (≈ 1 acerto a cada 116 dias de ataque saturado, que também derruba as confirmações legítimas, S6) |
| Serverless, N instâncias | cada instância conta sozinha | N × o valor do processo único; o balde do GoTrue também multiplica com IPs de saída variáveis |

**Impacto de um acerto:** o atacante cadastra o e-mail da vítima com a senha dele, adivinha o código e confirma a conta (pré-sequestro). Só vale contra e-mails de terceiros que ele mesmo cadastrar; o limite de e-mails do projeto (30 usuários novos/h com SMTP próprio, por padrão) limita quantas contas pendentes ele cria.

**Efeito da expiração do OTP:** reduzir de 3600 s para 600 s ajuda pouco contra um atacante ativo, porque ele mesmo pede reenvio (a cada 60 s) e mantém sempre um código válido. Fica como higiene, não como controle.

**Aceitável?** Para 3 testers e processo único: sim, com folga (≈ 10⁻⁵ por hora e por alvo). Para produção: o limiter por instância só vale com uma instância; o que realmente reduz o risco é (a) contador compartilhado no Postgres (mantém o valor do processo único em serverless) e (b) um teto **por conta e por dia** (ex.: 15 falhas em 24 h por e-mail → ≤ 1,5 × 10⁻⁵ por dia por alvo) ou OTP de 8 dígitos (÷100), com alerta de volume de `RATE_LIMITED`.

## 7. O que fazer antes de produção

| Pri. | Item | Camada | Observação |
|---|---|---|---|
| 1 | Contador compartilhado no Postgres (tentativas de verify e cooldown do resend; de preferência também o rate limit por IP de `/auth/*`) | Database + Backend | `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`; sem ele, serverless multiplica o teto por N |
| 2 | Teto por conta e por dia (15 falhas/24 h) **ou** OTP de 8 dígitos | Backend (+ Front se 8) | Fecha o pré-sequestro por brute force lento |
| 3 | Purge de contas não confirmadas (> 24–48 h) | Database | Fecha o squatting de `username` (S4) e libera e-mail de terceiros cadastrado por atacante; `ON DELETE CASCADE` já limpa perfil/medidas/streak |
| 4 | SMTP próprio com cota adequada | Config | Elimina o limite baixo do embutido (N2), o oráculo `email_address_not_authorized` (3.2) e reduz o e-mail bombing (S5) |
| 5 | CAPTCHA em `register` e `resend-code` | Backend + Front | Repassar `captcha_token` ao GoTrue; mitiga squatting, e-mail bombing e S6 |
| 6 | Logar o swallow do `signUp` (N2) e monitorar volume de `RATE_LIMITED` e de `swallowed` | Backend | Detecta cota de e-mail esgotada e ataque ao `/verify` |
| 7 | `maxLength: 512` em `refresh_token` (N1) | Backend | Uma linha |
| 8 | Confirmar `type: 'email'` com o **caminho feliz real** (cadastro real → código por e-mail → sessão) | QA | Nenhum round exercitou o GoTrue real com código válido; se o tipo estiver errado, ninguém confirma (falha fechada, mas a feature não funciona) |
| 9 | `Email OTP Expiration` para 600 s e conferir `Authentication > Rate Limits` no painel | Config | Higiene (item 6) |
| 10 | Remover `JWT_SECRET` e `PROJECT_URL` do `.env` | Config | Confirmado: nenhum código de `src/`, `server.js` ou `prisma.config.js` os lê |
| 11 | `trustProxy` com número de saltos (`trustProxy: 1`), nunca `true` sem proxy que limpe `X-Forwarded-For`; IP de saída estático ou repasse do IP do cliente ao GoTrue | Deploy | O limite por IP e o balde `/verify` dependem disso (S6, INFO-1 do round anterior) |
| 12 | Mascarar a tela `VerifyEmail` quando o UXCam entrar; trocar o `console.log(error)` de `AuthContext.tsx:56` por status/mensagem | Front | O `AxiosError` inteiro inclui o `Authorization` |
| 13 | Opcional: limitar o número de chaves dos `Map` e devolver a tentativa em `RATE_LIMITED`/`PROVIDER` | Backend | Defesa em profundidade |

## Limpeza
Nenhuma conta, linha ou arquivo criado no projeto. Ao vivo: 20 requisições de rajada e uma de `refresh` com token de 900 kB (ambas com dados inexistentes) e uma de `register` recusada no schema. O `Map` do processo guarda por até 15 min uma chave de e-mail inexistente. Scripts de reprodução ficaram no diretório temporário da sessão.
