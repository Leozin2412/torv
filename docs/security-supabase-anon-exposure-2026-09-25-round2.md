# Security Review — Supabase anon exposure / auth pelo backend (Round 2)

- **Data:** 2026-09-25
- **Branch:** `fix/supabase-anon-exposure`
- **Escopo:** só o delta que respondeu à rodada 1 (`security-supabase-anon-exposure-2026-09-25.md`):
  - `275c6db`: *fix(db): revoke global PUBLIC EXECUTE default on functions* (MEDIUM #1)
  - `16f9174`: *fix(front): refresh expiring token before logout revoke* (LOW #3)
- **Pré-condição:** QA `qa-supabase-anon-exposure-2026-09-25-round3.md`: PASS
- **Veredito: PASS.** O MEDIUM #1 e o LOW #3 estão fechados e o delta não abre nada novo. Com Testing (round 3) e Security (round 2) verdes, o ciclo da feature pode ser fechado.

---

## MEDIUM #1: EXECUTE default de PUBLIC em funções futuras (**FECHADO**)

`BackEndTorv/prisma/migrations/20260925210000_revoke_global_function_execute/migration.sql`

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
```

A correção é a recomendada: é global, sem `IN SCHEMA`. O comentário da migration explica corretamente por que a versão por schema não tinha efeito.

### Prova no catálogo (feita por este recruta)

Consulta só de leitura em `pg_default_acl`, via Prisma com o `DATABASE_URL` (`torv_api`, sem privilégio de dono; o catálogo é legível por qualquer role):

| role | schema | ACL default de funções |
|---|---|---|
| `postgres` | **global (ns 0)** | `{postgres=X/postgres}`: **sem `=X/postgres` para PUBLIC** ✅ |
| `postgres` | `public` | `{postgres, service_role, torv_api}`: sem `anon` nem `authenticated` ✅ |

- Uma função nova criada pelo `postgres` no `public` recebe a união do default global com o do schema: `postgres`, `service_role` e `torv_api`.
  - `anon`/`authenticated` não recebem EXECUTE, nem direto nem pelo PUBLIC.
  - O `torv_api` continua recebendo EXECUTE pelo `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO torv_api` (`init_postgres/migration.sql:449`, conferido).
- O resultado é determinístico pela semântica do Postgres, por isso não criei uma função descartável para testar.
- A consulta a `_prisma_migrations` como `torv_api` voltou vazia. Isso é esperado: a tabela está com RLS e sem policy desde a rodada 1. O efeito da migration está provado pelo catálogo, que é o que importa.
- O QA round 3 provou o lado prático: as 4 funções RPC chamadas com a publishable key dão 401/42501, e o `torv_api` continua executando `fn_log_food_and_return_remaining` via `POST /diet`.

### O revoke global abre ou quebra algo em outros schemas ou extensões?

Ele só remove o PUBLIC de funções **futuras** cujo dono é o `postgres`. As funções existentes não mudam.

- **Não abre nada.** O efeito é só restritivo (fail-closed).
- **Extensões:** no Supabase, `CREATE EXTENSION` de extensão privilegiada roda como `supabase_admin` (supautils). Os objetos ficam com o `supabase_admin` como dono, e o default global do `postgres` não se aplica a eles. Se uma extensão futura acabar com o `postgres` como dono, o sintoma é o `torv_api` não conseguir chamar a função fora do `public`. Isso é um erro visível e seguro, que se resolve com `GRANT EXECUTE … TO torv_api`.
- **Trigger functions:** o EXECUTE só é checado no `CREATE TRIGGER` (feito pelo dono), não quando a trigger dispara. O `handle_new_user` e as triggers de streak não são afetados.
- **Schema `auth` (hooks futuros):** o Supabase já exige `GRANT EXECUTE … TO supabase_auth_admin` explícito para hooks. Não muda nada.
- **Schema `storage`:** o `postgres` ainda tem um default por schema que dá EXECUTE a `anon`/`authenticated` em funções criadas ali. Isso é pré-existente (default do Supabase) e não vem deste delta, e o `storage` não é exposto via `/rest/v1`. **INFO para o futuro:** quando o adapter de foto de perfil for para o Supabase Storage, qualquer função criada em `storage` herda EXECUTE para anon. Isso deve ser revisado junto com as policies de RLS do bucket.

### Paridade da documentação

Os 3 arquivos de `BancoDeDadosTorv/` foram atualizados (cabeçalho e passo 1.3, com a explicação do no-op). A linha documentada é idêntica à da migration. ✅

---

## LOW #3: logout com access token expirado não revogava (**FECHADO**)

`FrontEndTorv/src/contexts/AuthContext.tsx` (`logout`)

```ts
let current = await getSession();
if (current && current.expires_at - Date.now() / 1000 < 60) {
  current = await refreshSession().catch(() => null);
}
```

- **Sem loop.**
  - O `refreshSession()` usa o `authApi`, a instância sem interceptor, então um refresh que falha não dispara outro refresh.
  - É o mesmo controle de "um refresh por vez" do interceptor: se um refresh já estiver em curso, o logout espera o mesmo promise, e não roda um segundo.
  - Uma request do `api` que volte 401 depois do logout chama `refreshSession`, recebe `getSession() = null` e retorna `null` sem chamar a rede.
- **Sem vazamento de token.**
  - O refresh token só vai no corpo do `POST /auth/refresh` para o próprio backend (`baseURL`).
  - Não há `console.log` nem log de token no delta, e o backend só loga `{ code }`.
  - A sessão rotacionada é gravada e logo depois apagada pelo `clearSession()`. O `await` garante essa ordem.
- **Falhas.**
  - Refresh rejeitado (400/401): `refreshSession` limpa a sessão e chama `onSessionExpired`. O logout pula a revogação, e não há nada a revogar, porque o token já é inválido.
  - Rede, 5xx ou 429: `.catch(() => null)` pula a revogação e o logout local acontece mesmo assim. Nesse caso (offline), o refresh token continua válido no servidor até expirar ou rotacionar. É um resíduo aceitável: a revogação é best-effort por contrato, e o cliente descarta o token.
- **Prova do QA round 3:** partindo de um access token expirado, o XHR fica `refresh 200 → logout 204`, e **tanto o refresh token antigo quanto o novo** dão 401 depois.

---

## Backlog (sem mudança nesta rodada, só anotado)

| # | Sev | Camada | Item |
|---|---|---|---|
| 2 | LOW | Backend | Cota por IP do GoTrue compartilhada via IP do backend: revisar os Rate Limits de Auth no dashboard |
| 4 | LOW | Backend | Rate limit só por IP e em memória: no deploy, usar `trustProxy` com CIDR do LB (nunca `true`) e uma chave por e-mail no login |
| 5 | INFO | Backend | 409 `EMAIL_TAKEN`/`USERNAME_TAKEN` aceito. Remover o de e-mail se a confirmação de e-mail for ligada |
| 6 | INFO | Database | Default ACL do `supabase_admin` no `public` inclui `anon` (confirmado de novo no catálogo). Aceito, porque as migrations rodam como `postgres` |
| 7 | INFO | Frontend | Sessão em `localStorage` no web |
| 8 | INFO | Backend | CORS `*` sem cookies |
| 9 | INFO | Backend | `jwtVerify` sem `audience` (pré-existente) |
| novo | INFO | Database | Default do `postgres` no schema `storage` dá EXECUTE a `anon`/`authenticated`: revisar quando o Storage entrar |
