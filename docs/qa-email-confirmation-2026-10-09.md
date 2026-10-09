# QA — Confirmação de e-mail por código de 6 dígitos — round 1 — 2026-10-09

**Owner:** Torv Review and Tests · **Diff:** backend `1ecbfe6`, frontend `783f7aa` · **Testes novos:** `BackEndTorv/src/routes/auth.edge.test.js` (7).

## Veredito: FAIL → o ciclo NÃO avança para Security. Rework só no frontend (F1).

| Camada | Falhas |
|---|---|
| Backend | nenhuma bloqueante (1 MEDIUM de desenho, 3 LOW/INFO) |
| Frontend | **F1 MEDIUM (bloqueante)**; 3 LOW |

## Testes

| Checagem | Resultado |
|---|---|
| `BackEndTorv: npm test` | ✅ 196/196 antes dos meus testes; **203/203** com `auth.edge.test.js` |
| `FrontEndTorv: npx tsc --noEmit` | ✅ sem erros |
| `FrontEndTorv: node --test src/utils/*.test.mjs` | ✅ 49/49 |
| Backend vivo (Furnace, GoTrue real, e-mail inexistente) | ✅ `verify-email` 123456 → 400 `{"error":"Invalid or expired code","code":"INVALID_CODE"}`; `resend-code` → 204 sem corpo; corpo vazio → 400 |

Testes novos (todos verdes), cobrindo o que faltava: code com espaço/`\n`/dígitos largos/vazio/curto/longo/letra → 400 sem chamar o provedor e sem `code: INVALID_CODE`; corpo vazio, `{}`, nulos, campo faltando em ambas as rotas → 400; e-mail com espaço (borda ou meio) → 400; `Mix@B.dev`/`MIX@b.dev`/`mix@b.dev` dividem o mesmo contador; só `INVALID_CODE` conta (PROVIDER e RATE_LIMITED não bloqueiam); 429 bloqueado devolve `{error:'Too many requests',code:'RATE_LIMITED'}` e não chama o provedor mesmo com o código certo; 204 do resend sem corpo.

## Backend — revisão crítica

Conferido e correto: mapeamento `email_not_confirmed` (só no signIn, depois da senha), `over_request_rate_limit`/429 → RATE_LIMITED no verify, `over_email_send_rate_limit`/429 → RATE_LIMITED no resend, `email_address_not_authorized` → 502, outros 4xx do resend → 204 uniforme; contagem só em `INVALID_CODE` e zerada no sucesso; limiter (janela fixa na 1ª falha, sweep correto porque a ordem de inserção do Map cresce com `now`, reset reinsere no fim); schema de resposta `code` opcional serializa certo em 403/400/429 (testado); 204 com `Type.Null()` ok; `perMinute` 10/5 por IP testado.

| # | Sev | Achado |
|---|---|---|
| B1 | MEDIUM (desenho, não bloqueia) | Lockout por e-mail permite DoS dirigido: qualquer um manda 5 códigos errados para `vitima@x.com` e a vítima fica 15 min sem confirmar (o código certo também recebe 429). Trade-off consciente contra brute force de 1M combinações. Mitigação futura: contar também por IP+e-mail, ou não bloquear o código certo (comparar antes de contar). Segurança deve avaliar. |
| B2 | LOW | Corrida: N requisições paralelas passam por `isBlocked` antes da 1ª `fail()` (checagem e contagem em volta de um `await`). Teto real = limite por IP (10/min), então só 5 → até 10 palpites/min por IP. |
| B3 | LOW | `resendSignup` engole qualquer 4xx do GoTrue, inclusive 401/403 de `apikey` errada ou provedor desligado: responde 204 e nunca envia. Em `verifyEmail` o mesmo 401 vira `INVALID_CODE` e conta como falha. Sem log, a falha de configuração fica invisível. Sugestão: logar `data.error_code` em `warn` nos 4xx inesperados. |
| B4 | INFO | `resend-code` não é 100% uniforme: para conta existente e não confirmada, o 2º pedido em <60 s volta 429 (`over_email_send_rate_limit`), para e-mail inexistente volta 204. Oráculo de existência, mas `register` já devolve `EMAIL_TAKEN`, então não piora o que existe. |

Padrão do cliente `number` em `code`: o Ajv do Fastify faz coerção, então `{"code":123456}` (número) vira `"123456"` e passa; `012345` como número vira `12345` e é rejeitado. Inofensivo, o app sempre manda string.

## Frontend — revisão e usabilidade no navegador (portal "QA Home", viewport 390x835)

Stub de `XMLHttpRequest` só na página (login → 403 `EMAIL_NOT_CONFIRMED`; verify 400 `INVALID_CODE` ×2, depois 429, `123456` → 200 com sessão falsa; resend 204 e depois 429). Servidor não foi alterado.

| Fluxo | Resultado |
|---|---|
| Login com 403 → tela de código com o e-mail digitado (`Teste.QA@torv.dev`), cooldown 0 | ✅ "Reenviar código" habilitado |
| Campo: `12a3 4-5678` | ✅ vira `123456` (só dígitos, trunca em 6); `maxLength=6`, `inputMode=numeric`, `autocomplete=one-time-code`, foco automático |
| "Confirmar" com 5 dígitos | ✅ desabilitado; com 6 habilitado |
| Código errado ×2 | ✅ "Código inválido ou expirado."; botão volta a ficar utilizável (loading solto) |
| 3ª tentativa (429) | ✅ "Muitas tentativas. Aguarde alguns minutos e tente de novo." |
| Reenviar (cooldown 0) | ✅ "Código reenviado. Confira seu e-mail." + "Reenviar em 60s", conta regressiva 60→57 |
| Reenviar com 429 | ✅ "Aguarde um pouco para pedir outro código." + "Reenviar em 60s" |
| Código `123456` | ✅ sai da tela de código, entra em Home, depois cai no Login quando o `/auth/refresh` com token falso falha (esperado) |
| Layout | ✅ `scrollWidth` 390 = viewport; e-mail de 73 caracteres quebra dentro de 24–366 px; conteúdo termina em ~620 px de 835 |
| Params ausentes | ✅ sem risco hoje: não há `linking` no `NavigationContainer`, então recarregar a página volta ao Login |
| `screenshot` do portal | ⚠️ expira (janela sem renderizar); layout checado por medição de DOM. Teclado virtual não testável no navegador desktop. |

| # | Sev | Achado |
|---|---|---|
| **F1** | **MEDIUM (bloqueante)** | **"← Voltar ao login" empilha um Login novo** em vez de voltar. React Navigation 7: `navigate('Login')` não faz pop para a tela existente (`@react-navigation/native ^7.2.5`). Comprovado: a pilha ficou Login → VerifyEmail → Login#2 → VerifyEmail#2 (6 `input` no DOM). Efeitos: o Login novo vem vazio (o e-mail/senha digitados somem), o botão físico Voltar do Android / gesto do iOS / Voltar do navegador do Login#2 reabre a tela de código (loop), e a pilha cresce a cada ida e volta. **Correção:** `navigation.popTo('Login')` (ou `goBack()`) em `VerifyEmail/index.tsx` no botão "Voltar ao login". |
| F2 | LOW | Enter/"concluir" do teclado não envia: o `Input` não tem `onSubmitEditing`/`returnKeyType`. Comprovado: Enter com 6 dígitos não fez POST. Sugestão: `onSubmitEditing={handleConfirm}` + `returnKeyType="done"`. |
| F3 | LOW | Mensagens de erro/info sem `accessibilityRole="alert"` nem `accessibilityLiveRegion="polite"` (DOM sem `role=alert`/`aria-live`): leitor de tela não anuncia "Código inválido" nem "Código reenviado". |
| F4 | LOW | O e-mail vai cru de Login/Register para a tela de código. Se o campo tiver espaço sobrando (comum em autocomplete de teclado), o backend recusa `verify-email` e `resend-code` com 400 de formato (testado) e o usuário vê só "Não foi possível confirmar" sem saída. Sugestão: `email.trim()` ao navegar. Também `keyboardType="numeric"` no iOS abre o teclado decimal; `number-pad` é mais adequado. |

## Observações

- O working tree tinha `FrontEndTorv/app.json` modificado antes do meu round (não é meu, não commitado).
- Dados de teste: nenhuma conta criada (stub de rede); 3 chamadas ao GoTrue real com `qa.nobody.1009@torvtest.dev` (inexistente).
