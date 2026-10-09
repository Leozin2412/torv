# QA — Confirmação de e-mail por código de 6 dígitos — round 2 — 2026-10-09

**Owner:** Torv Review and Tests · **Round anterior:** `docs/qa-email-confirmation-2026-10-09.md` (FAIL: F1 "Voltar ao login" empilhava outro Login) · **Rework:** frontend `77896ec`. Backend sem mudança desde o round 1.

**Escopo:** só o que mudou (`Login`, `Register`, `VerifyEmail`) + regressão do fluxo da tela de código.

## Veredito: PASS (100% verde) → o ciclo avança para Security

| Checagem | Resultado |
|---|---|
| `BackEndTorv: npm test` | ✅ 203/203 |
| `FrontEndTorv: npx tsc --noEmit` | ✅ sem erros |
| `FrontEndTorv: node --test src/utils/*.test.mjs` | ✅ 49/49 |

## Usabilidade no navegador (portal "QA Home", 390x835, stub de rede só na página)

Mesmo stub do round 1, mais `POST /auth/register` → 201 `{session:null, confirmation_required:true}`. O servidor não foi alterado.

| Item | Resultado |
|---|---|
| **F1** Login 403 → código → "Voltar ao login" | ✅ volta ao Login **uma vez só**: 3 `input` no DOM na tela de código (2 do Login + código), 2 depois de voltar (antes eram 6 e a pilha crescia). Digitado (e-mail e senha) é mantido: `["Teste.QA@torv.dev","senha123"]`. Sem VerifyEmail montado atrás, então "voltar de novo" não reabre a tela de código. O histórico do navegador tem 1 entrada (sem `linking`), então o botão Voltar do sistema não foi testado na web; a ausência de tela montada cobre o caso. |
| Register (wizard completo, 6 passos) → `confirmation_required` | ✅ abre a tela de código com `novo.qa@torv.dev`, botão "Reenviar" desabilitado ("Reenviar código em 59 segundos", cooldown 60). Corpo do POST `/auth/register` correto (`birth_date` 1995-04-10, `goal` "Saúde & Bem-estar"). |
| Register → código → "Voltar ao login" | ✅ cai no Login (2 `input`); `popTo` também desempilha o Register. |
| **F2** Enter no campo | ✅ com 6 dígitos envia `POST /auth/verify-email` (`123456`) e sai da tela; com 5 dígitos não envia nada. `enterkeyhint=done`. |
| **F3** a11y | ✅ erro "Código inválido ou expirado." e info "Código reenviado. Confira seu e-mail." agora em `role=alert` com `aria-live=polite`. |
| **F4** teclado | ✅ `number-pad` → `inputmode=numeric` na web. |
| **F4** `email.trim()` | ✅ no diff (`Login` e `Register` limpam o e-mail antes do POST e antes de navegar; a subtítulo da tela de código mostra o e-mail limpo). ⚠️ Não dá para exercitar no navegador: `<input type=email>` já remove espaços nas pontas, então o corpo do stub nunca recebe espaços de qualquer jeito. Conferido só pelo diff; o caso real é teclado nativo com autocomplete. |
| Regressões | ✅ nenhuma: dígitos só/trunca em 6, Confirmar desabilitado <6, INVALID_CODE, 429, reenvio com contagem 60→, sucesso sai da tela (Home → Login quando o refresh com token falso falha, esperado), `scrollWidth` 390. |

Observação não bloqueante: no `Login`, o guard `!email` usa o valor cru; um e-mail só de espaços passa o guard e vai ao backend como `""` (400 → "Falha ao realizar login"). Só em teclado nativo; sem impacto de segurança.

`screenshot` do portal continua indisponível (janela sem renderizar; em parte do round os cliques do portal também foram recusados e usei eventos de DOM; os fluxos acima voltaram a funcionar com clique real). Layout conferido por medição de DOM.

## Itens de desenho registrados (não são falhas)

| # | Decisão | Registro |
|---|---|---|
| B1 | Após 5 falhas de código por e-mail em 15 min o e-mail fica bloqueado por 15 min (inclusive para o código certo). Permite travar um terceiro (DoS dirigido), em troca de limitar brute force de 1M combinações. | Decisão de desenho do Maestro, registrada aqui; **Torv Security deve reavaliar** (alternativas: contar por IP+e-mail, ou não bloquear o código certo). |
| B4 | `resend-code` devolve 429 em <60 s para conta existente não confirmada e 204 para inexistente (oráculo de existência). | Registrado como decisão: `register` já devolve `EMAIL_TAKEN`, então não amplia o que já é público. |
| B2/B3 | LOW (corrida em paralelo limitada pelo limite por IP; `resend` engole 4xx de configuração sem log) | Seguem abertos como LOW; não bloqueiam. |

## Dados de teste

Nenhuma conta criada (stub de rede). Nenhuma chamada a GoTrue neste round.
