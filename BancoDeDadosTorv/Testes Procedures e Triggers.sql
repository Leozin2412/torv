-- Postgres (Supabase) — documentation copy of manual smoke-test queries, translated
-- from the original SQL Server test script. Calling convention matches Task 6/7's
-- verification: functions are called with SELECT / SELECT * FROM, not EXEC (Postgres
-- has no stand-alone stored-procedure EXEC syntax — everything here is a function).

--Teste Functions

--register
-- fn_register_new_user não existe mais (removida em 20260918165833_supabase_auth_link).
-- O cadastro agora nasce no Supabase Auth, então este teste não é mais uma chamada
-- SQL: crie o usuário pelo Auth (dashboard, signUp no app, ou Admin API) e depois
-- rode os SELECTs abaixo para conferir que a trigger on_auth_user_created propagou
-- as linhas para o schema public.
--
--   await supabase.auth.admin.createUser({
--     email: 'carlos.teste@torv.com', password: 'senhaSegura123', email_confirm: true,
--     user_metadata: { username: '@carlinhos', name: 'Carlos Teste' }
--   })

SELECT 'USERS' as Tabela, email FROM users WHERE email = 'carlos.teste@torv.com';
SELECT 'PROFILES' as Tabela, username, name FROM user_profiles WHERE username = '@carlinhos';
SELECT 'STREAKS' as Tabela, current_streak FROM user_streaks
WHERE user_id = (SELECT id FROM users WHERE email = 'carlos.teste@torv.com');
SELECT 'MEASUREMENTS' as Tabela, weight_kg, height_cm FROM user_measurements
WHERE user_id = (SELECT id FROM users WHERE email = 'carlos.teste@torv.com');
-- users.id tem que bater com auth.users.id (FK users_id_fkey):
SELECT 'AUTH LINK' as Tabela, u.id = a.id AS ids_batem
FROM users u JOIN auth.users a ON a.email = u.email
WHERE u.email = 'carlos.teste@torv.com';

-- calorias
-- Note: plain SQL scripts have no T-SQL-style session variable (no equivalent to
-- `DECLARE @Hoje DATE = GETDATE();` outside a DO block) — CURRENT_DATE is inlined
-- directly below instead.
-- Note: the original T-SQL test omitted @MacrosJson entirely when calling
-- sp_LogFoodAndReturnRemaining, which had no default for that parameter — that
-- call would not actually have run as written. fn_log_food_and_return_remaining
-- has the same non-optional p_macros_json parameter, so a real value is supplied
-- here to make this test runnable.
SELECT * FROM fn_log_food_and_return_remaining(
  'A1000000-0000-0000-0000-000000000001',
  'Sanduíche Natural',
  400,
  '{"protein":20,"carbs":45,"fat":10}',
  CURRENT_DATE
);

-- GoalCalories: 2400 | ConsumedCalories: 960 (560 + 400) | RemainingCalories: 1440


--Triggers

-- 1. Consultando o estado ANTES do treino
SELECT current_streak AS "Streak do João ANTES" FROM user_streaks WHERE user_id = 'A1000000-0000-0000-0000-000000000001';
SELECT total_points AS "Pontos do João ANTES" FROM group_rankings WHERE user_id = 'A1000000-0000-0000-0000-000000000001' AND group_id = 'B2000000-0000-0000-0000-000000000001';

-- 2. O João acabou de finalizar um treino no App hoje! (A Trigger é ativada aqui)
INSERT INTO activities (user_id, activity_type, title, start_time, duration_sec, calories)
VALUES ('A1000000-0000-0000-0000-000000000001', 'Musculação', 'Treino de Peito & Tríceps', now(), 3300, 420);

-- 3. Consultando o estado DEPOIS do treino
SELECT current_streak AS "Streak do João DEPOIS (Tem que ser 13)" FROM user_streaks WHERE user_id = 'A1000000-0000-0000-0000-000000000001';
SELECT total_points AS "Pontos do João DEPOIS (Tem que ser +10)" FROM group_rankings WHERE user_id = 'A1000000-0000-0000-0000-000000000001' AND group_id = 'B2000000-0000-0000-0000-000000000001';
