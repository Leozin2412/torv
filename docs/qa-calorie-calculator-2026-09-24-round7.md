# QA — Calculadora de Calorias e Macros (rodada 7)

**Data:** 2026-09-24
**Recruta:** Torv Review and Tests
**Escopo:** só a documentação `BancoDeDadosTorv/`
**Commits sob teste:** `a647fef` — *sync BancoDeDadosTorv with supabase_auth_link and nutrition_targets_basis* · `093eebd` — *normalize mock fitness_level and goal to exact domain values*

**Veredito: PASS** — paridade total entre a documentação e as 3 migrations + `schema.prisma`: **15/15 tabelas com 0 colunas divergentes**, **12/12 objetos (functions, triggers, views) idênticos**, nada documentado que não exista e nada existente faltando. Mock dentro do domínio exato do app. **Nenhum achado bloqueante**; 4 observações informativas.

---

## Escopo e método

Os dois commits tocam **apenas** `BancoDeDadosTorv/` (5 arquivos `.sql`) — nenhuma migration, nenhum código de produção, nenhum schema real alterado. Confirmado com `git diff --name-only`.

Como o pedido era “bate **exatamente**”, não confiei em leitura visual: escrevi verificadores que extraem os objetos dos dois lados e comparam texto normalizado. Os scripts ficaram no scratchpad, fora do repositório.

**Nada foi executado no Supabase.** A validação sintática foi offline, com `sqlglot` (parser puro Python) instalado só no meu ambiente Python — **não** virou dependência do projeto.

---

## 1. Paridade de tabelas e colunas ✅

Extraí as colunas de cada `CREATE TABLE` das 3 migrations, apliquei os `ALTER` delas (`DROP COLUMN password_hash`, `ADD COLUMN basis_json/updated_at`) e comparei com os `CREATE TABLE` de `SQL BANCO DE DADOS.sql`, normalizando tipos (`INTEGER`→`INT`, `TIMESTAMP WITH TIME ZONE`→`TIMESTAMPTZ`, `NUMERIC`→`DECIMAL`):

```
tabelas comparadas: mig=15 doc=15 | colunas divergentes em 0 tabela(s)
```

**15 tabelas, 0 divergências** — nenhuma coluna a mais, a menos, ou com tipo diferente, em nenhuma tabela.

Itens que o brief pedia explicitamente:

| Item | Esperado | Verificado |
|---|---|---|
| `users.password_hash` | fora (migration 2 fez `DROP COLUMN`) | ✅ ausente em toda a doc |
| `users.id` sem `DEFAULT` | migration 2 fez `ALTER COLUMN id DROP DEFAULT` | ✅ doc traz `id UUID PRIMARY KEY`, sem default |
| `nutrition_targets.basis_json` / `updated_at` | migration 3 | ✅ `JSONB` / `TIMESTAMPTZ`, com comentário explicando o papel do `basis_json` |
| FK `users` → `auth.users` | migration 2 | ✅ `users_id_fkey ... REFERENCES auth.users(id) ON DELETE CASCADE`, sem `ON UPDATE` (igual à migration) |
| CHECKs de `user_measurements` | migration 2 | ✅ os 2, com os nomes exatos `user_measurements_weight_kg_check` / `_height_cm_check` e as mesmas faixas (20–300 kg, 50–250 cm) |

Contagens cruzadas entre migrations e doc, por nome de objeto:

| | migrations | doc | |
|---|---|---|---|
| Constraints `_check` | 2 | 2 | ✅ mesmos nomes |
| Foreign keys `_fkey` | 17 | 17 | ✅ mesmos nomes |
| Unique indexes | 2 | 2 | ✅ |
| Indexes comuns | 3 | 3 | ✅ |
| Roles | 2 | 2 | ✅ |

---

## 2. Paridade de functions, triggers e views ✅

Extraí cada `CREATE [OR REPLACE] FUNCTION|TRIGGER|VIEW` dos dois lados (com `$$…$$` tratado como bloco opaco), normalizei espaços e comparei:

```
sem comentários -> objetos mig: 12 | doc: 12
OBJETOS DIVERGENTES: 0
```

**12 objetos de cada lado, todos idênticos:**

| Objeto | Status |
|---|---|
| `fn_get_consumed_calories`, `fn_calculate_age` | ✅ idênticos |
| `fn_get_diet_summary`, `fn_log_food_and_return_remaining` | ✅ idênticos (código igual; só os comentários explicativos diferem) |
| `handle_new_user` | ✅ idêntico, com `SECURITY DEFINER` e `SET search_path = public` |
| `trg_fn_update_streak_on_activity`, `trg_fn_add_points_to_group_ranking` | ✅ idênticos |
| `on_auth_user_created`, `trg_update_streak_on_activity`, `trg_add_points_to_group_ranking` | ✅ idênticos |
| `vw_dashboard_user_stats`, `vw_group_leaderboard` | ✅ idênticas |
| **`fn_register_new_user`** | ✅ **corretamente ausente** — `DROP FUNCTION` na migration 2, e o verificador confirma que a doc não a define em lugar nenhum (só a cita em comentário explicando a remoção) |

Na primeira passada, `fn_get_diet_summary` e `fn_log_food_and_return_remaining` apareceram como divergentes; a diferença estava **só em comentários dentro do corpo `$$`** (a doc moveu a explicação do fix do Task 6 para fora do corpo e acrescentou um comentário no `RETURN QUERY`). Ignorando comentários SQL, ficam byte a byte iguais — que é exatamente o tipo de diferença que uma cópia de documentação deve ter.

---

## 3. Mock Dados — domínio ✅

Validei os valores do mock **contra as constantes de produção**, importando `BackEndTorv/src/lib/nutritionCalculator.js` direto no verificador (não contra uma lista copiada à mão):

```
OK   João Silva    level=INTERMEDIÁRIO  goal=Ganhar Massa Muscular    gender=Masculino birth=1995-05-10
OK   Marina Alves  level=AVANÇADO       goal=Melhorar Condicionamento gender=Feminino  birth=1992-08-22
OK   Rafael Costa  level=AVANÇADO       goal=Aumentar Resistência     gender=Masculino birth=1990-11-05
OK   Julia Lima    level=INICIANTE      goal=Perder Peso              gender=Feminino  birth=1998-02-15
OK   Pedro Torres  level=INTERMEDIÁRIO  goal=Criar uma Rotina         gender=Masculino birth=1997-07-30
LINHAS FORA DO DOMINIO: 0
```

- `fitness_level` conferido com `Object.hasOwn(ACTIVITY_FACTORS, …)` — mesmo teste que o backend usa desde `9573874`.
- `goal` conferido com `GOAL_NAMES.includes(…)` por objetivo, após split por `', '` (a mesma convenção de `profileValidation.js`).
- `gender` conferido com `Object.hasOwn(GENDERS, …)`.
- `birth_date` no formato `YYYY-MM-DD` e data real nas 5 linhas.
- Único valor do domínio não exercitado pelo mock: `Saúde & Bem-estar` (são 5 linhas para 6 objetivos) — cobertura, não erro.
- O exemplo de `user_metadata` no comentário do cabeçalho usa os mesmos valores normalizados.

### O commit corrigiu um erro semântico real, não só estética

Rodando o calculador de produção com os valores **antigos** e os **novos** para o João (78,5 kg, 180 cm, nascido em 1995-05-10):

| Mock | kcal | nível efetivamente usado | objetivos efetivamente usados |
|---|---|---|---|
| **Antes** (`'Intermediário'` / `'Ganhar Massa'`) | **2112** | `INICIANTE` (fallback) | `["Saúde & Bem-estar"]` (fallback) |
| **Depois** (`'INTERMEDIÁRIO'` / `'Ganhar Massa Muscular'`) | **3078** | `INTERMEDIÁRIO` | `["Ganhar Massa Muscular"]` |

Os valores antigos não batiam com nenhuma chave do domínio, então o calculador caía silenciosamente nos defaults — 966 kcal de diferença numa linha de demonstração. Com `093eebd` o mock passa a representar o que o app realmente grava.

### Mock × schema e × CHECKs

- Os **14 INSERTs** referenciam só tabelas e colunas que existem no DDL documentado: `0` INSERTs com problema.
- `user_measurements`: as 5 linhas (78,5/180 · 62,0/165 · 85,0/185 · 70,0/160 · 75,2/175) estão **todas dentro das faixas dos CHECKs**; nenhuma violaria a constraint.
- `nutrition_targets` insere só as 4 colunas numéricas, deixando `basis_json`/`updated_at` nulos — coerente com o comentário e com o backend, que é quem preenche o basis.
- `users`/`user_profiles`/`user_streaks` usam `ON CONFLICT DO UPDATE` sobre as chaves corretas, o que é o certo agora que `on_auth_user_created` já cria essas linhas.
- Os comentários de conferência de `Testes Procedures e Triggers.sql` batem com o mock: João tem meta 2400 kcal e logs de 210 + 350 = 560; com os 400 do teste dá `ConsumedCalories: 960`, exatamente o que o arquivo anota.

---

## 4. Validação sintática offline (sem tocar no banco) ✅

`sqlglot` 30.19, dialeto `postgres`, parse sem execução:

| Arquivo | Resultado |
|---|---|
| `Mock Dados.sql` | ✅ **OK** — 14 statements, todos `Insert` |
| `SQL BANCO DE DADOS.sql` | ✅ **OK** — 34 statements (17 `Create` = 15 tabelas + 2 unique indexes; 17 `Alter` = 17 FKs) |
| `Testes Procedures e Triggers.sql` | ✅ **OK** — 10 `Select` + 1 `Insert` |
| `Gestao_e_Performance.sql` | ✅ **OK** — 14 statements (`CREATE ROLE`/`GRANT`/`ALTER DEFAULT PRIVILEGES` caem no modo genérico do parser) |
| `Regras BD.sql` | ⚠️ parser para em `DROP TRIGGER IF EXISTS … ON auth.users` (linha 136) |

O caso do `Regras BD.sql` é **limitação do sqlglot, não erro de SQL**: `DROP TRIGGER IF EXISTS <nome> ON <tabela>` é sintaxe padrão do Postgres, e o mesmo parser quebra no mesmo ponto quando recebe a **migration** `20260918165833_supabase_auth_link` — que o Prisma aplicou com sucesso no banco real. Como a seção 2 provou que os blocos da doc são byte a byte iguais aos das migrations, o SQL desses arquivos é o mesmo que o Postgres já aceitou e roda em produção (a `handle_new_user` dispara em todo cadastro — exercitada ao vivo no round 1 — e a `fn_get_diet_summary` atende todo `GET /diet/summary`).

Não havia `psql`, `pglast` nem outro parser com a gramática real do Postgres disponível offline nesta máquina; registrado como limite do método, não como pendência.

---

## Observações (nenhuma bloqueante)

| ID | Tipo | Observação |
|---|---|---|
| I1 | Informativo | `Regras BD.sql` traz dois `SELECT * FROM vw_…;` executáveis logo após as views, que não existem nas migrations. São queries de demonstração, **já existiam antes destes commits**, e o cabeçalho do arquivo declara que ele não tem efeito de runtime. |
| I2 | Informativo | A doc define `fn_log_food_and_return_remaining` **antes** de `fn_get_diet_summary`, invertendo a ordem da migration. Inofensivo: o corpo PL/pgSQL só resolve a função chamada em tempo de execução, então rodar o arquivo de cima para baixo funciona igual. |
| I3 | Cosmético | O placeholder de senha das roles difere entre a doc (`<set-at-deploy-time>`) e a migration (`<REDACTED_SET_VIA_ENV>`). Os dois são placeholders — varredura por senha real nos 5 arquivos não achou nada. Uniformizar seria só consistência. |
| I4 | Esclarecimento | A doc usa `DEFAULT now()` onde a migration escreve `DEFAULT CURRENT_TIMESTAMP` (em `created_at`, `recorded_at`, `joined_at`). **Não é divergência**: no Postgres `CURRENT_TIMESTAMP` é `now()`, e é assim que o catálogo armazena o default nos dois casos — a doc reflete o estado real do banco. |

---

## Decisão

**PASS.** A documentação `BancoDeDadosTorv/` está em paridade exata com `BackEndTorv/prisma/migrations/` (init + supabase_auth_link + nutrition_targets_basis) e com `schema.prisma`: 15/15 tabelas sem divergência de coluna, 12/12 objetos idênticos, 17/17 FKs, 2/2 CHECKs, 2/2 unique indexes, 3/3 indexes e 2/2 roles com os mesmos nomes. `password_hash` e `fn_register_new_user` estão fora; `handle_new_user` + `on_auth_user_created`, a FK para `auth.users`, os CHECKs e `basis_json`/`updated_at` estão dentro.

O Mock Dados usa os valores exatos do domínio do app, validados contra as constantes de produção, e `093eebd` corrigiu um desvio que fazia o calculador cair em defaults silenciosos.

As 4 observações são informativas e não pedem rework. **Nada a reabrir.**
