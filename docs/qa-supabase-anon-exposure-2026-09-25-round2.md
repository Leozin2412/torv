# QA — Auth pelo backend + bloqueio do schema public (rodada 2)

**Data:** 2026-09-25
**Recruta:** Torv Review and Tests
**Branch:** `fix/supabase-anon-exposure`
**Escopo:** só os commits novos desde a rodada 1 (`docs/qa-supabase-anon-exposure-2026-09-25.md`):
- `b8a17c5` — *fix(front): JSON body on logout, cap name/username length*
- `90b5cb2` — *fix(auth): cap register name/username at 100 chars*

**Veredito: PASS.** O MEDIUM da rodada 1 (o logout dava 415 e não revogava o refresh token) está fechado. O LOW de `maxLength` está fechado no back e no front. O LOW de `trustProxy` ficou documentado no código.

---

## 1. Revisão do diff ✅

| Arquivo | Mudança | Avaliação |
|---|---|---|
| `FrontEndTorv/src/contexts/AuthContext.tsx` | `authApi.post('/auth/logout', null, …)` → `{}` | É o fix mínimo recomendado. Agora o body vai como JSON e o Fastify aceita. |
| `FrontEndTorv/src/screens/Register/index.tsx` | `maxLength={100}` nos `Input` de nome e username | Bate com `VarChar(100)` no banco. |
| `BackEndTorv/src/routes/auth.routes.js` | `maxLength: 100` em `name` e `username`, mais um comentário `ponytail:` sobre `trustProxy` | O Ajv conta code points, igual ao `varchar(n)` do Postgres. O limite fica coerente. |
| `BackEndTorv/src/routes/auth.routes.test.js` | +2 casos (`name`/`username` com 101 caracteres) no teste de 400 | Continua criando um app novo por caso, então não estoura o rate-limit. |

Nenhum achado novo.

## 2. Testes automatizados ✅

- `BackEndTorv`: `npm test` → **41/41 pass**, 0 fail. Os casos novos entraram dentro de um teste que já existia, por isso a contagem não mudou.
- `FrontEndTorv`: `npx tsc --noEmit` → **exit 0**.

## 3. Register: limite de 100 caracteres ✅

HTTP ao vivo (Furnace :3000):

| Caso | Resultado |
|---|---|
| `name` com 101 caracteres | **400** `body/name must NOT have more than 100 characters` |
| `username` com 101 caracteres | **400** `body/username must NOT have more than 100 characters` |
| `name` e `username` com exatamente 100 caracteres (limite) | **201** com a sessão, conta `qa.auth.1790343827b@torvtest.dev` criada |

No navegador (portal TorvWeb, passo 2 do cadastro):
- O DOM tem `maxlength=100` nos dois inputs. O de data continua com 10.
- Inserir 105 caracteres por inserção nativa de texto (`execCommand('insertText')`, que se comporta como digitar ou colar) deixa **100** caracteres em cada campo.
- O `portal type`/`fill` preenche o valor por script, sem passar pelo `maxlength`, então 105 caracteres entram. Isso é limite da ferramenta, não do app.

## 4. Logout revoga de verdade ✅

Fluxo no navegador: login com `qa.auth.1790343236@torvtest.dev` → hook no XHR → "Sair da conta".

```json
{"u":"http://192.168.15.179:3000/auth/logout","st":204,
 "h":{"Content-Type":"application/json","Authorization":"<bearer>"},"sent":"{}"}
```

- A tela volta pro Login e o `torv.session` fica `null`.
- `POST /auth/refresh` com o refresh token salvo **antes** do logout → **401** `Invalid refresh token`. Na rodada 1 esse mesmo teste dava 200.

## 5. Catálogo do banco — verificado pelo Maestro

Esta checagem ficou pendente na rodada 1, porque a consulta direta ao catálogo foi bloqueada pelo classificador de permissões. **Quem executou foi o Maestro, e não este recruta**, via `DIRECT_URL`, só leitura:

- As 16 tabelas do `public` estão com RLS ligado.
- `anon` e `authenticated` não têm nenhum privilégio em tabelas, views e nas 7 funções.
- `torv_api` tem a policy `torv_api_full_access` nas 15 tabelas do app e `EXECUTE` nas funções.
- Os default privileges do `postgres` no `public` não incluem `anon` nem `authenticated`.
- **Resíduo:** o default ACL do `supabase_admin` ainda inclui `anon`. Isso só vale para objetos criados pelo `supabase_admin`, e as migrations do Prisma rodam como `postgres`, então não afeta o app hoje. Anotado, sem ação nesta branch.

---

## Estado da feature

- Testes: **verdes nesta rodada**. Os itens da rodada 1 que não mudaram (contrato `/auth`, sondagem anon/authenticated, bundle web, refresh transparente e regressão da calculadora) não foram retestados, porque os commits novos não mexem neles.
- Próximo passo do ciclo: **Security**.
