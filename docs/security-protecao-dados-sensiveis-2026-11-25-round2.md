# Segurança — proteção de dados sensíveis (LGPD) — rodada 2

- Data: 2026-11-25 · Branch: `feature/criptografia-dados-sensiveis` · HEAD `450ee69`
- Escopo: `git diff 0c28569..450ee69 -- BackEndTorv` (correção `b0309e7` + testes). Rodada 1: `docs/security-protecao-dados-sensiveis-2026-11-25.md` (inalterada). QA verde: `docs/qa-protecao-dados-sensiveis-2026-11-25-round3.md`.
- Método: leitura do diff; nenhum `.env` lido, nenhuma ferramenta Supabase usada.

## Veredito: APROVADO

## Achado Medium da rodada 1 — FECHADO
- `auth.controller.js:49-50`: `existed = await profileRepository.profileExists(userId)` antes do `saveSignupProfile`.
- `auth.controller.js:63`: `if (!existed) await authProvider.deleteUser(userId)...`. Conta que já tinha perfil (re-signup de conta pendente) nunca é apagada; o 409 `USERNAME_TAKEN` / 502 continuam saindo.
- `profile.repository.js:48-50`: `profileExists` consulta por `user_id` (chave única) com `select: { user_id: true }`; sem dado pessoal lido.
- Teste novo `auth.routes.test.js:67-80`: com `profileExists=true`, P2002 → 409 e erro genérico → 502, `deleteUser` com 0 chamadas. Teste de repositório cobre true/false e a forma da consulta. O teste de rollback de conta nova (P2002 → deleteUser + 409) continua, com `profileExists=false` no `build`.
- Resultado: o DoS por apagar cadastro pendente via username ocupado não é mais possível. Resta, por decisão do controller (spec D), a atualização do perfil de conta pendente no re-signup: pendência de decisão do desenvolvedor, não achado.

## Novos achados

| # | Sev. | OWASP | Local | Cenário | Correção | Bloqueia |
|---|------|-------|-------|---------|----------|----------|
| 1 | Low | A04 | `auth.controller.js:49-50` | `profileExists` roda fora do `try` interno: se a consulta falhar (banco fora), cai no `catch` externo, sem rollback. Conta recém-criada fica no Auth sem perfil e o cliente recebe erro; novo cadastro com o mesmo e-mail a recupera (upsert). Sem vazamento. | Mover a consulta para dentro do `try` tratando falha como `existed=false`, ou aceitar. | Não |
| 2 | Info | A01 | idem | Check-then-save não atômico: duas requisições simultâneas do mesmo cadastro novo podem ambas ver `existed=false`; pior caso, um `deleteUser` extra de conta criada nesta mesma janela (e `deleteUser` aceita 404). Não alcança conta com perfil já gravado. | Nenhuma. | Não |

Sem novo log: nenhum valor, id ou e-mail adicionado. Sem segredo no diff (varredura visual do diff completo: só fixtures de teste).

## Não verificado
Mesmos itens da rodada 1 (UXCam em aparelho, GoTrue de produção, RLS/`torv_api` nas colunas, migration em produção, gitleaks no histórico completo). Execução da suíte: não rodei; confiei no relatório QA round 3.
