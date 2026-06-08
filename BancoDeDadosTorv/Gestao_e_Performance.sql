-- =======================================================================
-- ARQUIVO: Gestão de Usuários e Controle de Performance
-- OBJETIVO: Demonstrar os entregáveis acadêmicos aplicados ao escopo atual
-- =======================================================================

USE TorvDB;
GO

-- =======================================================================
-- 1. GESTÃO DE USUÁRIOS DO BANCO DE DADOS
-- =======================================================================
-- Explicação para a apresentação:
-- Mesmo o projeto estando no início, a arquitetura de segurança já foi desenhada.
-- Não utilizaremos o usuário 'sa' (System Admin) na conexão da API por motivos de segurança.
-- Criamos usuários com o Princípio do Menor Privilégio.

-- Passo 1.1: Criar os Logins no SQL Server (Nível de Servidor)
-- Nota: Caso já existam, você pode ignorar ou apagar antes
CREATE LOGIN TorvAPI_User WITH PASSWORD = 'StrongPassword123!';
CREATE LOGIN TorvAnalyst_User WITH PASSWORD = 'StrongPassword123!';
GO

-- Passo 1.2: Criar os Usuários mapeados no banco TorvDB
CREATE USER TorvAPI_User FOR LOGIN TorvAPI_User;
CREATE USER TorvAnalyst_User FOR LOGIN TorvAnalyst_User;
GO

-- Passo 1.3: Atribuição de Permissões (Roles)
-- O usuário da API (que o Prisma ORM usará no .env) precisa ler, escrever e deletar.
ALTER ROLE db_datareader ADD MEMBER TorvAPI_User;
ALTER ROLE db_datawriter ADD MEMBER TorvAPI_User;
ALTER ROLE db_ddladmin ADD MEMBER TorvAPI_User; -- Necessário apenas se o Prisma for rodar migrations

-- Permissão explícita para a API conseguir rodar nossas Stored Procedures e Functions
GRANT EXECUTE TO TorvAPI_User;

-- O usuário Analista (que poderia conectar um PowerBI no futuro) só pode LER dados,
-- e o ideal é que leia apenas as Views, protegendo os dados sensíveis (senhas).
ALTER ROLE db_datareader ADD MEMBER TorvAnalyst_User;
-- Para um nível mais avançado na apresentação:
-- DENY SELECT ON users TO TorvAnalyst_User; 
-- GRANT SELECT ON vw_Dashboard_User_Stats TO TorvAnalyst_User;
GO


-- =======================================================================
-- 2. CONTROLE DE PERFORMANCE (REVISÃO SGBD)
-- =======================================================================
-- Explicação para a apresentação:
-- Como a regra de negócio central (cálculo de calorias) roda todo dia e consulta
-- a tabela 'food_logs' filtrando por 'user_id' e 'logged_date', essa tabela sofreria
-- problemas de lentidão quando a base crescesse (Table Scan).
-- Para prevenir isso, aplicamos controle de performance através de Índices e da 
-- própria utilização de Stored Procedures (que pré-compilam o plano de execução).

-- Passo 2.1: Criar Índice Composto (Non-Clustered) para a tabela de Consumo (food_logs)
-- Este índice cobre exatamente o filtro usado na nossa Stored Procedure 'sp_GetDietSummary'
-- e na function 'fn_GetConsumedCalories'.
CREATE NONCLUSTERED INDEX IX_FoodLogs_UserId_Date 
ON food_logs (user_id, logged_date)
INCLUDE (calories); -- O 'INCLUDE' melhora muito a performance pois evita buscar na tabela física (Key Lookup)
GO

-- Passo 2.2: Criar Índice nas Chaves Estrangeiras (Foreign Keys)
-- O SQL Server não cria índices automaticamente para chaves estrangeiras.
-- Criá-los melhora drasticamente a performance dos JOINs (por exemplo, na view 'vw_Dashboard_User_Stats')
CREATE NONCLUSTERED INDEX IX_UserProfiles_UserId 
ON user_profiles (user_id);
GO

CREATE NONCLUSTERED INDEX IX_Activities_UserId 
ON activities (user_id);
GO

-- =======================================================================
-- 3. GESTÃO DE ARMAZENAMENTO FÍSICO (MANUTENÇÃO)
-- =======================================================================
-- Explicação para a apresentação:
-- Quando os usuários deletarem refeições antigas ou contas, o SQL Server não
-- diminui o tamanho do arquivo no disco automaticamente (o espaço fica vazio).
-- A função SHRINKDATABASE serve para recuperar esse espaço físico perdido.
-- Em produção, isso rodaria em um "Job" automático (ex: 1 vez por semana de madrugada).

-- Recupera o espaço físico em disco não utilizado do banco de dados
DBCC SHRINKDATABASE (TorvDB);
GO

-- FIM DO SCRIPT
