-- =======================================================================
-- ARQUIVO: Gestão de Usuários e Controle de Performance
-- OBJETIVO: Demonstrar os entregáveis acadêmicos aplicados ao escopo atual
-- Postgres (Supabase) — documentation copy of what's actually deployed.
-- Source of truth: BackEndTorv/prisma/migrations/20260915170948_init_postgres/migration.sql
-- This file has no runtime effect; it exists for readability/presentation only.
-- =======================================================================

-- =======================================================================
-- 1. GESTÃO DE USUÁRIOS DO BANCO DE DADOS
-- =======================================================================
-- Explicação para a apresentação:
-- Mesmo o projeto estando no início, a arquitetura de segurança já foi desenhada.
-- Não utilizaremos o usuário 'postgres' (superuser) na conexão da API por motivos
-- de segurança. Criamos roles com o Princípio do Menor Privilégio.
--
-- Postgres não separa LOGIN e USER como o SQL Server: uma ROLE com a opção LOGIN
-- já cumpre os dois papéis.
--
-- NUNCA escreva a senha real neste arquivo — este é um documento versionado no
-- git. As senhas reais existem apenas em BackEndTorv/.env (gitignored) e na nota
-- Maestri de credenciais; aqui aparecem como placeholder.

-- Passo 1.1: Criar a role da API (usada pelo Prisma via DATABASE_URL)
-- Precisa ler, escrever e executar as functions/triggers da aplicação.
CREATE ROLE torv_api LOGIN PASSWORD '<set-at-deploy-time>';
GRANT USAGE ON SCHEMA public TO torv_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO torv_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO torv_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO torv_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO torv_api;

-- Passo 1.2: Criar a role do Analista (poderia conectar um PowerBI no futuro)
-- Só pode LER, e apenas pelas Views — nunca tabelas diretamente, protegendo
-- dados sensíveis (senhas, e-mails).
CREATE ROLE torv_analyst LOGIN PASSWORD '<set-at-deploy-time>';
GRANT USAGE ON SCHEMA public TO torv_analyst;
GRANT SELECT ON vw_dashboard_user_stats, vw_group_leaderboard TO torv_analyst;


-- =======================================================================
-- 2. CONTROLE DE PERFORMANCE (REVISÃO SGBD)
-- =======================================================================
-- Explicação para a apresentação:
-- Como a regra de negócio central (cálculo de calorias) roda todo dia e consulta
-- a tabela 'food_logs' filtrando por 'user_id' e 'logged_date', essa tabela sofreria
-- problemas de lentidão quando a base crescesse (Sequential Scan).
-- Para prevenir isso, aplicamos controle de performance através de Índices.

-- Passo 2.1: Criar Índice Composto para a tabela de Consumo (food_logs)
-- Este índice cobre exatamente o filtro usado em 'fn_get_diet_summary'
-- e na function 'fn_get_consumed_calories'.
CREATE INDEX ix_food_logs_user_id_date
ON food_logs (user_id, logged_date)
INCLUDE (calories); -- O 'INCLUDE' evita ir até a tabela física (equivalente ao Key Lookup do SQL Server)

-- Passo 2.2: Criar Índice nas Chaves Estrangeiras (Foreign Keys)
-- O Postgres, assim como o SQL Server, não cria índices automaticamente para
-- chaves estrangeiras. Criá-los melhora drasticamente a performance dos JOINs
-- (por exemplo, na view 'vw_dashboard_user_stats').
CREATE INDEX ix_user_profiles_user_id
ON user_profiles (user_id);

CREATE INDEX ix_activities_user_id
ON activities (user_id);

-- =======================================================================
-- 3. GESTÃO DE ARMAZENAMENTO FÍSICO (MANUTENÇÃO)
-- =======================================================================
-- Physical storage reclamation (VACUUM FULL) is out of scope for this migration; Supabase-managed Postgres handles autovacuum automatically.

-- FIM DO SCRIPT
