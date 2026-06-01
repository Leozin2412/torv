CREATE DATABASE TorvDB;
USE TorvDB;


--Modulo User
CREATE TABLE users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    auth_provider NVARCHAR(50), 
    created_at DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE user_profiles (
    user_id UNIQUEIDENTIFIER PRIMARY KEY,
    username NVARCHAR(100) NOT NULL UNIQUE,
    name NVARCHAR(100) NOT NULL,
    fitness_level NVARCHAR(50), 
    goal NVARCHAR(100),
    photo_url NVARCHAR(500),
    birth_date DATE,
    gender NVARCHAR(50),
    CONSTRAINT FK_user_profiles_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_measurements (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    weight_kg DECIMAL(5,2),
    height_cm INT,
    recorded_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_user_measurements_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);



--Modulo Social
CREATE TABLE user_streaks (
    user_id UNIQUEIDENTIFIER PRIMARY KEY,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_activity DATE,
    CONSTRAINT FK_user_streaks_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE follows (
    follower_id UNIQUEIDENTIFIER NOT NULL,
    followed_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    PRIMARY KEY (follower_id, followed_id),
    CONSTRAINT FK_follows_follower FOREIGN KEY (follower_id) REFERENCES users(id),
    CONSTRAINT FK_follows_followed FOREIGN KEY (followed_id) REFERENCES users(id)
);

CREATE TABLE groups (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(100) NOT NULL,
    period_type NVARCHAR(50) 
);

CREATE TABLE group_members (
    group_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    joined_at DATETIME2 DEFAULT GETDATE(),
    PRIMARY KEY (group_id, user_id),
    CONSTRAINT FK_group_members_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    CONSTRAINT FK_group_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE group_rankings (
    group_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    total_points INT DEFAULT 0,
    activities_count INT DEFAULT 0,
    PRIMARY KEY (group_id, user_id),
    CONSTRAINT FK_group_rankings_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    CONSTRAINT FK_group_rankings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

--Modulo Tracking(Strava)

CREATE TABLE activities (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    activity_type NVARCHAR(50) NOT NULL, 
    title NVARCHAR(255),
    start_time DATETIME2,
    duration_sec INT,
    calories INT,
    distance_m DECIMAL(10,2),
    CONSTRAINT FK_activities_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE activity_gps_data (
    activity_id UNIQUEIDENTIFIER PRIMARY KEY,
    route_json NVARCHAR(MAX), 
    CONSTRAINT FK_gps_data_activities FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);


--Modulo Musuculação

CREATE TABLE workout_routines (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(100) NOT NULL,
    day_of_week NVARCHAR(50),
    CONSTRAINT FK_workout_routines_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE exercises (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(100) NOT NULL,
    muscle_group NVARCHAR(100)
);

CREATE TABLE routine_exercises (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    routine_id UNIQUEIDENTIFIER NOT NULL,
    exercise_id UNIQUEIDENTIFIER NOT NULL,
    sets INT,
    reps INT,
    CONSTRAINT FK_routine_exercises_routine FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE CASCADE,
    CONSTRAINT FK_routine_exercises_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);


--Modulo Nutrição

CREATE TABLE nutrition_targets (
    user_id UNIQUEIDENTIFIER PRIMARY KEY,
    daily_calories INT,
    protein_g INT,
    carbs_g INT,
    fat_g INT,
    CONSTRAINT FK_nutrition_targets_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE food_logs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    food_name NVARCHAR(255) NOT NULL,
    calories INT NOT NULL,
    macros_json NVARCHAR(MAX), 
    logged_date DATE NOT NULL,
    CONSTRAINT FK_food_logs_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
