# QA — Proteção de dados sensíveis (rodada 6)

**Data:** 2026-11-25
**Recruta:** Torv Review and Tests
**Branch:** `feature/criptografia-dados-sensiveis`
**HEAD testado:** `9d3a766`
**Ambiente:** Supabase local (Docker), backend local (porta 3999), API + SQL, Mailpit na porta 54324. Produção não foi tocada.
**Escopo:** diff `bcd77e0..9d3a766` (`2074be9` deduplica objetivos, `afb0521` recusa NUL em name/username, `9d3a766` amplia `user_profiles.goal` para varchar(255)). Brief: `task-10-fix-brief.md`.

**Veredito: PASS**

## Revisão do diff — PASS
- `profileValidation.js`: `[...new Set(goals)].join(', ')` mantém a ordem e remove repetidos; vale também para o `PUT /profile` (mesma função).
- `auth.routes.js`: `pattern: '^[^\u0000]*$'` em `name` e `username` (opcional) devolve 400 na validação, antes de `usernameExists` e `signUp`. Os dois testes novos conferem 400 e zero chamadas.
- Migration: `ALTER COLUMN goal TYPE varchar(255)`, igual ao `schema.prisma`. Seis objetivos = 119 caracteres, com folga. Teste de 119 caracteres usa `GOAL_NAMES`, não um literal.
- Sem regressão vista: os demais campos do cadastro não mudaram.
- Fora do escopo, só registro: `gender` e `fitness_level` são validados contra listas fechadas, então NUL não chega ao banco por eles.

## Suíte
Backend `npm test`: `tests 349 / pass 349 / fail 0`.

## Checks de ponta a ponta
Coluna `goal` no banco local: tamanho máximo 255 (migration aplicada). Contas `qa-r6-*@torvtest.dev`.

| Check | Resultado |
|---|---|
| (a) cadastro com os seis objetivos | PASS: 201; `goal` gravado com 119 caracteres, igual à lista enviada; medidas com prefixo `v1.` (3 de 3) |
| (b) `Perder Peso,Perder Peso,Perder Peso` | PASS: 201; `goal` gravado = `Perder Peso` (11 caracteres) |
| (c) NUL em `name` e depois em `username` | PASS: 400 nos dois; `auth.users` sem linha dessas contas (0) |
| (d) oráculo fechado (corpo com seis objetivos; e-mail novo e e-mail pendente cadastrado 62 s antes) | PASS: 201 nos dois, corpos idênticos |
| (e) `PUT /profile` com os seis objetivos, após login | PASS: 200 |
| (f) regressão: register -> verify-email -> login -> GET /profile | PASS: 201 -> 200 -> 200 -> 200 |

- Log do backend: 0 ocorrências de 502 ou `save failed`.

## Limpeza
Contas `qa-r6-*` apagadas do Supabase local (`auth.users` = 0; perfis e medidas órfãos = 0). Backend local parado (porta 3999 sem resposta).
