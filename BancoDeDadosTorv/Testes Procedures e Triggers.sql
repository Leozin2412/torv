-- Postgres (Supabase) — documentation copy of manual smoke-test queries, translated
-- from the original SQL Server test script. Calling convention matches Task 6/7's
-- verification: functions are called with SELECT / SELECT * FROM, not EXEC (Postgres
-- has no stand-alone stored-procedure EXEC syntax — everything here is a function).

--Teste Functions

--register
SELECT fn_register_new_user(
  'carlos.teste@torv.com',
  'senhaSegura123',
  '@carlinhos',
  'Carlos Teste'
);

SELECT 'USERS' as Tabela, email FROM users WHERE email = 'carlos.teste@torv.com';
SELECT 'PROFILES' as Tabela, username, name FROM user_profiles WHERE username = '@carlinhos';
SELECT 'STREAKS' as Tabela, current_streak FROM user_streaks
WHERE user_id = (SELECT id FROM users WHERE email = 'carlos.teste@torv.com');

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
