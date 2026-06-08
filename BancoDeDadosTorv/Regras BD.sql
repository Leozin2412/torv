 use TorvDB;
 --UDFs

--Calculo de consumo de calorias
CREATE FUNCTION fn_GetConsumedCalories (@UserId UNIQUEIDENTIFIER, @TargetDate DATE)
RETURNS INT
AS
BEGIN
    DECLARE @TotalKcal INT;
    
    SELECT @TotalKcal = ISNULL(SUM(calories), 0)
    FROM food_logs
    WHERE user_id = @UserId AND logged_date = @TargetDate;
    
    RETURN @TotalKcal;
END;


--Calculo idade para o TMB
CREATE FUNCTION fn_CalculateAge (@BirthDate DATE)
RETURNS INT
AS
BEGIN
    DECLARE @Age INT;
    SET @Age = DATEDIFF(YEAR, @BirthDate, GETDATE()) - 
               CASE WHEN (MONTH(@BirthDate) > MONTH(GETDATE())) OR 
                         (MONTH(@BirthDate) = MONTH(GETDATE()) AND DAY(@BirthDate) > DAY(GETDATE())) 
               THEN 1 ELSE 0 END;
    RETURN @Age;
END;



 --Views


 --Metas diarias
CREATE VIEW vw_Dashboard_User_Stats AS
SELECT 
    u.id AS user_id,
    p.name,
    p.username,
    p.photo_url,
    s.current_streak,
    s.longest_streak,
    nt.daily_calories AS goal_calories
FROM users u
INNER JOIN user_profiles p ON u.id = p.user_id
LEFT JOIN user_streaks s ON u.id = s.user_id
LEFT JOIN nutrition_targets nt ON u.id = nt.user_id;

select * from vw_Dashboard_User_Stats;

--"Gym rats"
CREATE VIEW vw_Group_Leaderboard AS
SELECT 
    g.id AS group_id,
    g.name AS group_name,
    gr.total_points,
    p.name AS user_name,
    p.photo_url
FROM group_rankings gr
INNER JOIN groups g ON gr.group_id = g.id
INNER JOIN user_profiles p ON gr.user_id = p.user_id;

select * from vw_Group_Leaderboard;



--Procedures

--Registro de User
CREATE PROCEDURE sp_RegisterNewUser
    @Email NVARCHAR(255),
    @PasswordHash NVARCHAR(255),
    @Username NVARCHAR(100),
    @Name NVARCHAR(100)
AS
BEGIN
    BEGIN TRY
        BEGIN TRAN;
            DECLARE @NewUserId UNIQUEIDENTIFIER = NEWID();

            INSERT INTO users (id, email, password_hash, auth_provider)
            VALUES (@NewUserId, @Email, @PasswordHash, 'email');

            INSERT INTO user_profiles (user_id, username, name)
            VALUES (@NewUserId, @Username, @Name);

            INSERT INTO user_streaks (user_id, current_streak, longest_streak)
            VALUES (@NewUserId, 0, 0);

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        ROLLBACK TRAN;
        THROW; -- Retorna o erro para a API
    END CATCH
END;

--Insert food log and return macro balance
CREATE PROCEDURE sp_LogFoodAndReturnRemaining
    @UserId UNIQUEIDENTIFIER,
    @FoodName NVARCHAR(255),
    @Calories INT,
    @MacrosJson NVARCHAR(MAX),
    @Date DATE
AS
BEGIN
    INSERT INTO food_logs (user_id, food_name, calories, macros_json, logged_date)
    VALUES (@UserId, @FoodName, @Calories, @MacrosJson, @Date);

    -- Reuse the summary SP to return the single source of truth balance
    EXEC sp_GetDietSummary @UserId, @Date;
END;
GO
    

--Get full macro summary for a specific day
CREATE PROCEDURE sp_GetDietSummary
    @UserId UNIQUEIDENTIFIER,
    @Date DATE
AS
BEGIN
    DECLARE @GoalCalories INT = 2000, @GoalProtein INT = 150, @GoalCarbs INT = 250, @GoalFat INT = 65;
    
    SELECT 
        @GoalCalories = ISNULL(daily_calories, 2000),
        @GoalProtein = ISNULL(protein_g, 150),
        @GoalCarbs = ISNULL(carbs_g, 250),
        @GoalFat = ISNULL(fat_g, 65)
    FROM nutrition_targets WHERE user_id = @UserId;

    DECLARE @ConsumedCalories INT = 0, @ConsumedProtein INT = 0, @ConsumedCarbs INT = 0, @ConsumedFat INT = 0;

    SELECT 
        @ConsumedCalories = ISNULL(SUM(calories), 0),
        @ConsumedProtein = ISNULL(SUM(CAST(JSON_VALUE(macros_json, '$.protein') AS INT)), 0),
        @ConsumedCarbs = ISNULL(SUM(CAST(JSON_VALUE(macros_json, '$.carbs') AS INT)), 0),
        @ConsumedFat = ISNULL(SUM(CAST(JSON_VALUE(macros_json, '$.fat') AS INT)), 0)
    FROM food_logs
    WHERE user_id = @UserId AND logged_date = @Date;

    SELECT 
        @GoalCalories AS GoalCalories, 
        @ConsumedCalories AS ConsumedCalories, 
        (@GoalCalories - @ConsumedCalories) AS RemainingCalories,
        
        @GoalProtein AS GoalProtein, 
        @ConsumedProtein AS ConsumedProtein, 
        (@GoalProtein - @ConsumedProtein) AS RemainingProtein,
        
        @GoalCarbs AS GoalCarbs, 
        @ConsumedCarbs AS ConsumedCarbs, 
        (@GoalCarbs - @ConsumedCarbs) AS RemainingCarbs,
        
        @GoalFat AS GoalFat, 
        @ConsumedFat AS ConsumedFat, 
        (@GoalFat - @ConsumedFat) AS RemainingFat;
END;
GO



--Triggers

--Analise Streak
CREATE TRIGGER trg_UpdateStreakOnActivity
ON activities
AFTER INSERT
AS
BEGIN
    DECLARE @UserId UNIQUEIDENTIFIER;
    DECLARE @ActivityDate DATE;
    DECLARE @LastActivity DATE;
    DECLARE @CurrentStreak INT;
    DECLARE @LongestStreak INT;

    SELECT @UserId = user_id, @ActivityDate = CAST(start_time AS DATE) FROM inserted;

    SELECT @LastActivity = last_activity, @CurrentStreak = current_streak, @LongestStreak = longest_streak 
    FROM user_streaks WHERE user_id = @UserId;

    IF @LastActivity IS NULL OR DATEDIFF(DAY, @LastActivity, @ActivityDate) = 1
    BEGIN

        SET @CurrentStreak = @CurrentStreak + 1;
    END
    ELSE IF DATEDIFF(DAY, @LastActivity, @ActivityDate) > 1
    BEGIN
                                  
        SET @CurrentStreak = 1;
    END
  
    IF @CurrentStreak > @LongestStreak
        SET @LongestStreak = @CurrentStreak;

    UPDATE user_streaks
    SET current_streak = @CurrentStreak,
        longest_streak = @LongestStreak,
        last_activity = @ActivityDate
    WHERE user_id = @UserId;
END;

--Add Points GymRats
CREATE TRIGGER trg_AddPointsToGroupRanking
ON activities
AFTER INSERT
AS
BEGIN
    DECLARE @UserId UNIQUEIDENTIFIER;
    SELECT @UserId = user_id FROM inserted;

    UPDATE group_rankings
    SET total_points = total_points + 10,
        activities_count = activities_count + 1
    WHERE user_id = @UserId;
END;