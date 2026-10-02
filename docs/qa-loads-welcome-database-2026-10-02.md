# QA — Carga por série e boas-vindas — etapa Database — 2026-10-02

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module`, código em `57d5834` · **Escopo:** Task 2 do plano `docs/superpowers/plans/2026-10-02-loads-period-welcome.md` (spec `docs/superpowers/specs/2026-10-02-loads-period-welcome-design.md`).

Migration testada: `BackEndTorv/prisma/migrations/20261002120000_loads_welcome/migration.sql`.
- `workout_sets.weight_kg DECIMAL(6,2)` com `CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0 AND 999.99)`.
- `user_profiles.welcomed_at TIMESTAMPTZ`.

## Ambiente

- **Acesso ao banco:** pelo Prisma do `BackEndTorv`, com a `DIRECT_URL` do `.env` (o conector do Supabase está ligado a outro projeto, o Portal Tradsul, e não foi usado).
- **Scripts:** descartáveis, fora do repo (scratchpad), todos terminam com `$disconnect()`.
- **Papel da conexão:** `postgres`, com privilégio `TEMP` no banco. Por isso o teste do CHECK pôde usar tabela temporária e nenhuma tabela real foi tocada.
- **Backend:** não foi subido nem parado. `.env` intocado.

## Veredito: PASS (5/5)

| # | Item | Resultado |
|---|---|---|
| 1 | `prisma migrate status` | ✅ PASS |
| 2 | Catálogo: CHECK e colunas | ✅ PASS |
| 3 | Comportamento do CHECK | ✅ PASS |
| 4 | `npm test` do backend | ✅ PASS (83/83) |
| 5 | Diff do commit `57d5834` | ✅ PASS (só os 4 arquivos) |

## 1. `prisma migrate status`

```
8 migrations found in prisma/migrations
Database schema is up to date!
```

A 8ª é `20261002120000_loads_welcome`.

## 2. Catálogo

| Consulta | Resultado |
|---|---|
| `pg_get_constraintdef` de `workout_sets_weight_kg_check` | ✅ `CHECK (((weight_kg IS NULL) OR ((weight_kg >= (0)::numeric) AND (weight_kg <= 999.99))))`, igual à migration e a `Regras BD.sql` |
| `workout_sets.weight_kg` | ✅ `numeric(6,2)`, `is_nullable = YES`, sem default |
| `user_profiles.welcomed_at` | ✅ `timestamp with time zone`, `is_nullable = YES`, sem default |

O CHECK segue o mesmo padrão do `routine_exercise_sets_weight_kg_check` (`Regras BD.sql:323`).

## 3. Comportamento do CHECK (sem tocar dados de usuário)

**Método:** uma transação interativa do Prisma por caso, com `CREATE TEMP TABLE t (LIKE workout_sets INCLUDING CONSTRAINTS) ON COMMIT DROP`. Dentro dela, o `INSERT` só na tabela temporária, e depois um `throw` proposital para dar ROLLBACK. Cada transação confirmou antes que o CHECK `workout_sets_weight_kg_check` foi copiado para `t`.

| `weight_kg` | Esperado | Resultado |
|---|---|---|
| `-1` | falha | ✅ **23514** `violates check constraint "workout_sets_weight_kg_check"` |
| `1000` | falha | ✅ **23514** |
| `0` | passa | ✅ gravou `0.00` |
| `999.99` | passa | ✅ gravou `999.99` |
| `NULL` | passa | ✅ gravou `NULL` |
| Extra: `999.995` | falha | ✅ **23514**. O `numeric(6,2)` arredonda para `1000.00` antes do CHECK |
| Extra: `0.00` | passa | ✅ gravou `0.00` |

**Prova de que nada ficou no banco:**
- Contagem de linhas de `workout_sets` antes e depois: **628 e 628**. É só `count(*)`; nenhum conteúdo foi lido.
- Tabelas temporárias `t` restantes: **0**.

**Ajuste do meu script (não é falha do banco):**
- A 1ª execução falhou em todos os casos com **23502**.
- **Causa:** `INCLUDING CONSTRAINTS` não copia o `DEFAULT gen_random_uuid()` da coluna `id`, que continua `NOT NULL`.
- **Correção:** o `INSERT` passou a informar o `id`.
- Os resultados da tabela acima são da 2ª execução.

## 4. Testes do backend

`cd BackEndTorv && npm test`: ✅ **83/83**, 0 falhas.

## 5. Diff do commit `57d5834`

`git show --stat 57d5834`: 4 arquivos, 20 inserções e 3 remoções.

| Arquivo | Conteúdo | Resultado |
|---|---|---|
| `BackEndTorv/prisma/migrations/20261002120000_loads_welcome/migration.sql` | Colunas e CHECK | ✅ |
| `BackEndTorv/prisma/schema.prisma` | `welcomed_at DateTime? @db.Timestamptz` e `weight_kg Decimal? @db.Decimal(6, 2)` | ✅ |
| `BancoDeDadosTorv/Regras BD.sql` | CHECK `workout_sets_weight_kg_check` | ✅ |
| `BancoDeDadosTorv/SQL BANCO DE DADOS.sql` | Cabeçalho, `welcomed_at` e `weight_kg`, com comentários | ✅ |

Nenhum arquivo proibido (`api.ts`, `Login/index.tsx`, `tsconfig.json`, `revisar.md`) entrou no commit.

## Observações

- **Dados de teste:** nenhum. Não foram criadas contas nem linhas, e nada de usuário foi lido ou alterado.
- **Papel da conexão:** os testes rodaram como `postgres`. O CHECK vale para qualquer papel, então o resultado não depende disso. O caminho do `torv_api` (RLS e grants) é exercitado na etapa Backend.
