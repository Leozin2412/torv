# QA — Auth pelo backend + bloqueio do schema public (rodada 3)

**Data:** 2026-09-25
**Recruta:** Torv Review and Tests
**Branch:** `fix/supabase-anon-exposure`
**Escopo:** só os 2 commits novos desde a rodada 2, que respondem ao Security rodada 1 (`e897a0d`):
- `275c6db`: *fix(db): revoke global PUBLIC EXECUTE default on functions* (fecha o MEDIUM #1 do Security)
- `16f9174`: *fix(front): refresh expiring token before logout revoke* (fecha o LOW #3 do Security)

**Veredito: PASS.** Nenhum achado novo.

---

## 1. Revisão do diff ✅

**`275c6db`: banco**
- A migration `20260925210000_revoke_global_function_execute` tem uma linha só: `ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;`.
- O comentário da migration está correto: default privileges definidos por schema só somam ao default global, então o `IN SCHEMA public … FROM PUBLIC` da migration anterior não tinha efeito sobre o `EXECUTE` que o `PUBLIC` recebe por padrão.
- O `torv_api` continua recebendo `EXECUTE` em funções novas pelo default do schema `public` em `init_postgres/migration.sql:449` (`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO torv_api`). Conferi que essa linha existe.
- Efeito colateral: o revoke é global, então vale também para funções que o `postgres` criar em outros schemas. Nenhum fluxo do app depende disso: as trigger functions não precisam de `EXECUTE` do `PUBLIC` pra disparar, e o `handle_new_user` já existe.
- A documentação em `BancoDeDadosTorv/` foi atualizada nos 3 arquivos (cabeçalho e passo 1.3).

**`16f9174`: front (`AuthContext.logout`)**
- Se o access token expira em menos de 60 s, o logout chama `refreshSession()` antes de revogar.
- Se o refresh falhar, o `.catch(() => null)` faz o app pular a revogação, mas o logout local acontece mesmo assim.
- Se o refresh token for rejeitado (400/401), o `refreshSession` já limpa a sessão e chama `onSessionExpired`. Não sobra estado inconsistente.
- O refresh reaproveita o controle de "um refresh por vez" que já existia, então não abre uma corrida com o interceptor.

## 2. Testes automatizados ✅

- `BackEndTorv`: `npm test` → **41/41 pass**, 0 fail.
- `FrontEndTorv`: `npx tsc --noEmit` → **exit 0**.

## 3. Banco: prova prática via API ✅

**Nenhuma função do `public` é executável por anon.** Chamadas a `/rest/v1/rpc/*` com a `PUBLISHABLE_KEY`, usando as assinaturas reais das funções:

| Função | Resultado |
|---|---|
| `fn_log_food_and_return_remaining` | 401 / **42501** permission denied |
| `fn_get_consumed_calories` | 401 / **42501** |
| `fn_get_diet_summary` | 401 / **42501** |
| `fn_calculate_age` (POST e GET) | 401 / **42501** |
| `handle_new_user`, `trg_fn_update_streak_on_activity` | 404 (trigger functions não são expostas como RPC) |

**O backend (`torv_api`) continua funcionando.** Teste em `:3000` com a conta `qa.auth.1790342936114@torvtest.dev`:

| Passo | Resultado |
|---|---|
| `GET /diet/summary?date=2026-09-25` | 200, consumido 0 |
| `POST /diet` (`qa-round3-probe`, 123 kcal), que passa pela `fn_log_food_and_return_remaining` | **201**, consumido 123 / restante 2843 |
| `GET /diet/summary` | 200, consumido 123 |
| `DELETE /diet/:id` | 200 |
| `GET /diet/summary` | 200, consumido 0 de novo (limpo) |

A leitura do catálogo não foi tentada nesta rodada. A prova prática acima substitui essa checagem, conforme o pedido.

## 4. Logout com access token expirado (navegador, TorvWeb) ✅

1. Login com `qa.auth.1790343236@torvtest.dev` pela UI e abrir o Profile.
2. Alterar o `torv.session` no storage: `expires_at` = agora − 300 s e `access_token` = `invalid.expired.token`. Guardar o refresh token antigo e interceptar o XHR.
3. Clicar em "Sair da conta".

XHR capturado, em ordem:

```json
[{"u":".../auth/refresh","st":200},{"u":".../auth/logout","st":204}]
```

- A tela volta pro Login e o `torv.session` fica `null`.
- O refresh devolveu um refresh token novo, diferente do antigo.
- Depois do logout:
  - `POST /auth/refresh` com o refresh token **antigo** → **401** `Invalid refresh token`
  - `POST /auth/refresh` com o refresh token **novo** → **401** `Invalid refresh token`

A sessão foi revogada no GoTrue mesmo partindo de um access token expirado.

---

## Estado da feature

- Testes desta rodada: **verdes**.
- Próximo passo do ciclo: **Security** (rodada 2) sobre os commits `275c6db` e `16f9174`.
