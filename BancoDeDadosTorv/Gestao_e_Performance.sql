-- =======================================================================
-- ARQUIVO: Gestão de Usuários e Controle de Performance
-- OBJETIVO: Demonstrar os entregáveis acadêmicos aplicados ao escopo atual
-- Postgres (Supabase) — documentation copy of what's actually deployed.
-- Source of truth: BackEndTorv/prisma/migrations/ (init_postgres + supabase_auth_link
-- + nutrition_targets_basis + lock_down_public_schema); ver o cabeçalho de "SQL BANCO DE DADOS.sql".
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
-- dados sensíveis (e-mails, datas de nascimento). Senha não é mais um risco aqui:
-- desde 20260918165833_supabase_auth_link ela vive só em auth.users, fora do
-- schema public.
CREATE ROLE torv_analyst LOGIN PASSWORD '<set-at-deploy-time>';
GRANT USAGE ON SCHEMA public TO torv_analyst;
GRANT SELECT ON vw_dashboard_user_stats, vw_group_leaderboard TO torv_analyst;

-- Passo 1.3: Fechar o schema public para anon/authenticated
-- (migration 20260925180000_lock_down_public_schema)
-- O Supabase expõe o schema public via PostgREST (/rest/v1) para os roles anon e
-- authenticated, e por padrão eles tinham acesso total a tudo — qualquer um com a
-- chave pública (que vai dentro do app) lia todas as tabelas. Só o backend
-- (torv_api) e o dono (postgres) acessam este schema.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
-- EXECUTE em functions nasce concedido a PUBLIC; torv_api mantém o grant explícito.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO torv_api;
-- Objetos futuros criados pelo postgres (migrations do Prisma) não nascem expostos.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;

-- RLS em todas as tabelas (segunda camada, caso algum GRANT volte por engano).
-- torv_api não é dono das tabelas, então precisa de uma policy explícita.
-- O dono (postgres, BYPASSRLS) não é afetado: as views e a trigger
-- handle_new_user (SECURITY DEFINER) continuam funcionando.
-- _prisma_migrations fica com RLS e sem policy (só o postgres usa).
-- Tabela nova: a migration que a cria precisa do ENABLE RLS + policy também.
ALTER TABLE _prisma_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON users TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON user_profiles TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE user_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON user_measurements TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON user_streaks TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON follows TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON groups TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON group_members TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE group_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON group_rankings TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON activities TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE activity_gps_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON activity_gps_data TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON exercises TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE workout_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON workout_routines TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON routine_exercises TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON food_logs TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE nutrition_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON nutrition_targets TO torv_api USING (true) WITH CHECK (true);


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
