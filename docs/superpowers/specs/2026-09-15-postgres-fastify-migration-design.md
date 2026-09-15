# Migração: SQL Server → Postgres/Supabase + Express → Fastify

**Status:** Aprovado para plano de implementação
**Data:** 2026-09-15
**Escopo:** `BancoDeDadosTorv/`, `BackEndTorv/`. `FrontEndTorv/` fica fora de escopo (contrato de API preservado).

## 1. Objetivo

Migrar o banco de dados do torv de SQL Server (T-SQL) para Postgres, hospedado no Supabase, e migrar a API de Express para Fastify, adaptando o acesso a dados (já feito via Prisma) para o novo banco. O contrato HTTP exposto ao frontend não muda.

Motivação declarada pelo usuário: o projeto pretende escalar e ser monetizado com usuários reais no futuro; o Supabase é escolhido agora pela facilidade de configuração, mas há intenção explícita de possivelmente trocar de hospedagem (AWS, Azure) mais adiante, mantendo Postgres. Isso guia várias decisões abaixo na direção de portabilidade e evitar lock-in em recursos proprietários do Supabase.

## 2. Estado atual

- **Banco**: SQL Server (`TorvDB`). Scripts em `BancoDeDadosTorv/`:
  - `SQL BANCO DE DADOS.sql` — DDL das tabelas.
  - `Regras BD.sql` — 2 UDFs (`fn_GetConsumedCalories`, `fn_CalculateAge`), 2 views (`vw_Dashboard_User_Stats`, `vw_Group_Leaderboard`), 3 stored procedures (`sp_RegisterNewUser`, `sp_LogFoodAndReturnRemaining`, `sp_GetDietSummary`), 2 triggers em `activities` (`trg_UpdateStreakOnActivity`, `trg_AddPointsToGroupRanking`).
  - `Gestao_e_Performance.sql` — logins/roles (`TorvAPI_User` leitura+escrita+execução de procedures, `TorvAnalyst_User` só leitura), índices (`IX_FoodLogs_UserId_Date`, `IX_UserProfiles_UserId`, `IX_Activities_UserId`), manutenção (`DBCC SHRINKDATABASE`).
  - `Mock Dados.sql`, `Testes Procedures e Triggers.sql` — dados de teste e scripts de verificação.
- **Backend**: Express 5 + Prisma 6 (`BackEndTorv/prisma/schema.prisma`, `provider = "sqlserver"`). Autenticação customizada (bcrypt + JWT), upload de foto via `multer` (disco local, servido em `/uploads`). Rotas: `POST /auth/register`, `POST /auth/login`, `GET/POST/PUT/DELETE /diet/*`, `GET/POST/PUT /profile/*`.
- `diet.repository.js` chama as stored procedures via `prisma.$queryRaw` com sintaxe `EXEC sp_...` — é o único lugar com SQL específico de T-SQL na camada de app. `auth.repository.js` e `profile.repository.js` já usam a API idiomática do Prisma (`create`, `findUnique`, `update`) e não precisam de tradução de sintaxe.
- Não há rota/tabela `activities` exposta na API ainda; os triggers de streak/pontos existem no schema mas não são exercitados pela aplicação hoje.
- Sem dados reais a preservar — projeto em desenvolvimento, migração é fresh-start.

## 3. Decisões de design

| Decisão | Escolha | Razão |
|---|---|---|
| Onde fica a lógica de negócio (procedures/functions/triggers) | **Postgres nativo (plpgsql)**, não camada de app | Garantia de integridade independe de qual cliente escreve nas tabelas, e é portável para qualquer host Postgres (AWS RDS, Azure Database for Postgres), ao contrário de lógica presa ao Node |
| Profundidade de adoção do Supabase | **Somente Postgres hospedado** | Evita lock-in em Auth/Storage proprietários do Supabase, alinhado com a intenção de portabilidade futura. Auth continua bcrypt+JWT; fotos continuam em disco local por enquanto |
| Migração de dados | **Nenhuma** (fresh schema) | Ambiente é só de desenvolvimento |
| Roles de banco (least privilege) | **Recriar como roles Postgres padrão**, via migration versionada | Portátil entre provedores de nuvem, não depende do dashboard do Supabase |
| Tooling de schema | **Prisma-first**: `schema.prisma` como fonte da verdade das tabelas; `prisma migrate dev --create-only` + edição manual da migration para functions/views/triggers/roles | Mantém histórico de migrations versionado; é o padrão recomendado pelo Prisma para recursos que ele não modela nativamente |
| Reescrita do backend | **Direta, no mesmo diretório**, sem servidor Fastify paralelo | Projeto pequeno (3 routers, 3 controllers, 1 middleware) — paralelismo não compensa |
| `BancoDeDadosTorv/` | **Mantido e atualizado** com os scripts equivalentes em Postgres/plpgsql | Vira documentação de como o banco é montado; a fonte de execução real passa a ser a migration do Prisma |

## 4. Arquitetura de branches

- `backup/main-pre-postgres` — criada a partir do `main` atual (commit `dc59b02` em diante), nunca recebe commits novos. Ponto de resgate.
- `migration/postgres-fastify-supabase` — toda a migração acontece aqui, nesta ordem:
  1. Banco (schema Postgres + lógica + roles + seed)
  2. Backend (Fastify + adaptação de repositórios + config de conexão)
- Merge para `main` só depois das duas partes migradas e validadas juntas — o backend novo só funciona contra o banco novo, não faz sentido mesclar em partes.

## 5. Migração do banco de dados

### 5.1 Projeto Supabase

Projeto já existente (ref `figlsyikardnbfuykhxq`, host pooler `aws-0-us-east-1.pooler.supabase.com`, Postgres 17), não conectado ao MCP desta sessão — credenciais vieram de uma nota no canvas Maestri. A senha do banco ainda precisa ser confirmada/definida antes do primeiro passo de implementação (item pendente, não bloqueia o restante do spec).

### 5.2 Tradução de tipos (schema.prisma)

| SQL Server | Postgres/Prisma |
|---|---|
| `UNIQUEIDENTIFIER` + `NEWID()` | `String @db.Uuid @default(dbgenerated("gen_random_uuid()"))` |
| `NVARCHAR(n)` | `String @db.VarChar(n)` (mantém o limite onde já existe, ex. email, username) |
| `NVARCHAR(MAX)` | `String @db.Text` |
| `DATETIME2` + `GETDATE()` | `DateTime @db.Timestamptz @default(now())` |
| `DATE` | `DateTime @db.Date` |
| `DECIMAL(p,s)` | `Decimal @db.Decimal(p,s)` (sem mudança) |
| `datasource.provider` | `sqlserver` → `postgresql` |

`gen_random_uuid()` é nativo a partir do Postgres 13 (sem precisar da extensão `pgcrypto`), então nenhuma extensão extra é necessária para os defaults de UUID.

### 5.3 Functions, views e triggers (plpgsql)

Todos viram `CREATE FUNCTION ... LANGUAGE plpgsql` ou `CREATE VIEW`, adicionados à migration do Prisma via `--create-only`:

- `fn_get_consumed_calories(user_id uuid, target_date date) RETURNS int`
- `fn_calculate_age(birth_date date) RETURNS int`
- `vw_dashboard_user_stats`, `vw_group_leaderboard` — mesma lógica, sintaxe idêntica (views são portáveis quase 1:1)
- `fn_get_diet_summary(user_id uuid, target_date date) RETURNS TABLE(...)` — substitui `sp_GetDietSummary`; usa `json_extract_path_text`/`->>` no lugar de `JSON_VALUE`
- `fn_log_food_and_return_remaining(...) RETURNS TABLE(...)` — substitui `sp_LogFoodAndReturnRemaining`; faz o `INSERT` e depois `RETURN QUERY SELECT * FROM fn_get_diet_summary(...)`
- `fn_register_new_user(...)` — substitui `sp_RegisterNewUser`, portado por completude/documentação. **Não muda `auth.repository.js`**: o registro de usuário já usa `create` aninhado do Prisma, que roda em uma transação implícita — equivalente funcional ao que a procedure fazia. A function só existe para manter `BancoDeDadosTorv/` como documentação fiel do banco.
- `trg_update_streak_on_activity`, `trg_add_points_to_group_ranking` — triggers `AFTER INSERT ON activities`, mesma lógica. Não são exercitados pela API hoje (não há rota de `activities`), mas ficam prontos para quando essa feature for construída.

Chamada na app (`diet.repository.js`): troca `` prisma.$queryRaw`EXEC sp_GetDietSummary @UserId=${userId}, @Date=${targetDate}` `` por `` prisma.$queryRaw`SELECT * FROM fn_get_diet_summary(${userId}::uuid, ${targetDate}::date)` ``, e o mesmo padrão para `fn_log_food_and_return_remaining`.

### 5.4 Roles e privilégio mínimo

- `torv_api` — `LOGIN`, `GRANT SELECT, INSERT, UPDATE, DELETE` nas tabelas de aplicação + `GRANT EXECUTE` nas functions acima + `ALTER DEFAULT PRIVILEGES` para que futuras migrations também concedam automaticamente.
- `torv_analyst` — `LOGIN`, apenas `GRANT SELECT` nas duas views (não nas tabelas base, para não expor `password_hash` etc.), preparado para uso futuro (ex. BI), sem nada conectado a ele hoje.
- Índices (`IX_FoodLogs_UserId_Date`, `IX_UserProfiles_UserId`, `IX_Activities_UserId`) recriados como `CREATE INDEX` padrão Postgres, mesmas colunas.
- `DBCC SHRINKDATABASE` **não é portado** — não existe equivalente direto no Postgres gerenciado pelo Supabase (o equivalente seria `VACUUM FULL`, que é uma operação manual e cara, geralmente desnecessária em bases pequenas; fica fora de escopo).
- Conexão da aplicação em runtime passa a usar `torv_api` (não o usuário `postgres` padrão da string de conexão que veio na nota), no formato exigido pelo pooler Supavisor do Supabase: `torv_api.figlsyikardnbfuykhxq` como usuário. `DIRECT_URL` (usada só por `prisma migrate deploy`, que precisa rodar DDL) continua com o usuário `postgres` (privilégios administrativos), já que `torv_api` não deve ter permissão de alterar schema.
- `torv_api` é criada com senha própria (`CREATE ROLE torv_api LOGIN PASSWORD '...'`), gerada nova durante a implementação — **não** reaproveita a senha do usuário `postgres` que veio na nota do Maestri. Essa senha nova é a que entra no `DATABASE_URL`; a senha do `postgres` (da nota) é usada só no `DIRECT_URL`.

### 5.5 `BancoDeDadosTorv/`

Os 5 arquivos existentes são reescritos com o conteúdo equivalente em Postgres/plpgsql (mesmos nomes de arquivo, mesma organização), passando a documentar o schema final. A migration gerada pelo Prisma em `BackEndTorv/prisma/migrations/` é a fonte de execução real.

## 6. Migração do backend

### 6.1 Dependências

- Remove: `express`, `cors`, `multer`
- Adiciona: `fastify`, `@fastify/cors`, `@fastify/multipart` (upload de foto), `@fastify/static` (servir `/uploads`)
- Mantém: `@prisma/client`, `prisma`, `bcrypt`, `jsonwebtoken`, `dotenv`

### 6.2 Estrutura

- `server.js` → bootstrap Fastify (`fastify()`, registra plugins de CORS/static/multipart, registra os 3 routers como plugins, error handler global via `setErrorHandler`).
- `src/routes/*.routes.js` → plugins Fastify (`fastify.get/post/put/delete` dentro de uma função `async function routes(fastify) {...}`).
- `src/middlewares/auth.middleware.js` → vira um `preHandler` hook (`fastify.addHook` ou passado por rota), mesma lógica de verificação de JWT.
- `src/controller/*.js` e `src/repository/*.js` → assinatura de handler muda de `(req, res)` para `(request, reply)` (Fastify), mas a lógica interna e o formato de resposta JSON permanecem idênticos ao atual, preservando o contrato com o frontend.
- Upload de foto: `multer` → `@fastify/multipart`, mesmo destino em disco (`profilePhotos/`), mesmo padrão de nome de arquivo.

### 6.3 Configuração de conexão

`schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
`.env` da branch de migração recebe `DATABASE_URL` (pooled, porta 6543, `torv_api`) e `DIRECT_URL` (direta, porta 5432, `postgres`) — pendente da senha real do banco (ver seção 5.1).

## 7. Testes e verificação

- Smoke test manual de cada endpoint (os 8 existentes) contra o banco novo antes do merge.
- Conferir que as duas queries `$queryRaw` (resumo de dieta e log de comida) retornam o mesmo formato de dados que antes.
- Conferir que `torv_api` de fato não consegue rodar DDL (teste negativo de privilégio).
- Revisão de segurança (lente OWASP) na função responsável por isso no time, focada em: exposição de `password_hash` via `torv_analyst`/views, injeção via `$queryRaw` (os parâmetros já são interpolados via tagged template do Prisma, que escapa corretamente — mas checar após a tradução).

## 8. Fora de escopo

- `FrontEndTorv/` — nenhuma mudança de código; o contrato de API é preservado deliberadamente.
- Migração de dados reais.
- Adoção de Supabase Auth ou Supabase Storage.
- Rota/feature de `activities` (os triggers ficam prontos, mas não há trabalho de API associado neste spec).
- `DBCC SHRINKDATABASE` / manutenção física de armazenamento.

## 9. Itens pendentes antes de iniciar a implementação

1. Senha real do banco Postgres (nota do Maestri está com placeholder `[YOUR-PASSWORD]`) — necessária para preencher `.env` da branch de migração e para criar as roles `torv_api`/`torv_analyst` via `DIRECT_URL`.
2. Confirmar com o usuário se a implementação será orquestrada via os agentes externos do Maestri (Anvil/Cistern/Warden/Loupe) em vez dos subagentes internos.
