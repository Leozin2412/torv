--Teste `Procedures

--register
EXEC sp_RegisterNewUser 
    @Email = 'carlos.teste@torv.com',
    @PasswordHash = 'senhaSegura123',
    @Username = '@carlinhos',
    @Name = 'Carlos Teste';

SELECT 'USERS' as Tabela, email FROM users WHERE email = 'carlos.teste@torv.com';
SELECT 'PROFILES' as Tabela, username, name FROM user_profiles WHERE username = '@carlinhos';
SELECT 'STREAKS' as Tabela, current_streak FROM user_streaks 
WHERE user_id = (SELECT id FROM users WHERE email = 'carlos.teste@torv.com');

-- calorias
DECLARE @Hoje DATE = GETDATE();

EXEC sp_LogFoodAndReturnRemaining 
    @UserId = 'A1000000-0000-0000-0000-000000000001',
    @FoodName = 'Sanduíche Natural',
    @Calories = 400,
    @Date = @Hoje;
    
-- GoalCalories: 2400 | ConsumedCalories: 960 (560 + 400) | RemainingCalories: 1440


--Triggers

-- 1. Consultando o estado ANTES do treino
SELECT current_streak AS 'Streak do João ANTES' FROM user_streaks WHERE user_id = 'A1000000-0000-0000-0000-000000000001';
SELECT total_points AS 'Pontos do João ANTES' FROM group_rankings WHERE user_id = 'A1000000-0000-0000-0000-000000000001' AND group_id = 'B2000000-0000-0000-0000-000000000001';

-- 2. O João acabou de finalizar um treino no App hoje! (A Trigger é ativada aqui)
INSERT INTO activities (user_id, activity_type, title, start_time, duration_sec, calories)
VALUES ('A1000000-0000-0000-0000-000000000001', 'Musculação', 'Treino de Peito & Tríceps', GETDATE(), 3300, 420);

-- 3. Consultando o estado DEPOIS do treino
SELECT current_streak AS 'Streak do João DEPOIS (Tem que ser 13)' FROM user_streaks WHERE user_id = 'A1000000-0000-0000-0000-000000000001';
SELECT total_points AS 'Pontos do João DEPOIS (Tem que ser +10)' FROM group_rankings WHERE user_id = 'A1000000-0000-0000-0000-000000000001' AND group_id = 'B2000000-0000-0000-0000-000000000001';