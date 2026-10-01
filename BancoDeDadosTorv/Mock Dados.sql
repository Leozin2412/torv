-- Postgres (Supabase) — documentation copy of sample seed data, translated from
-- the original SQL Server mock data script. No runtime effect on its own; meant
-- to be run manually against a fresh environment for demos/testing.
-- =================================================================================
-- 1. CARGA DE MOCK DE DADOS (5 LINHAS POR TABELA)
-- =================================================================================
-- Nota: não é necessário nenhum equivalente a SET IDENTITY_INSERT — as colunas de
-- id usam UUID com DEFAULT gen_random_uuid(), e informar o valor explicitamente
-- (como abaixo) simplesmente sobrescreve o default, sem exigir nenhum passo extra.
--
-- PRÉ-REQUISITO (mudou em 20260918165833_supabase_auth_link): users.id agora é FK
-- para auth.users(id) e não tem mais DEFAULT — este script NÃO cria usuários
-- sozinho. Antes de rodá-lo, crie os 5 usuários no Supabase Auth com estes mesmos
-- UUIDs, via Admin API (service_role), por exemplo:
--
--   await supabase.auth.admin.createUser({
--     id: 'A1000000-0000-0000-0000-000000000001',
--     email: 'joao@torv.com', password: '<senha de teste>', email_confirm: true,
--     user_metadata: { username: '@joaosilva', name: 'João Silva',
--                      fitness_level: 'INTERMEDIÁRIO', goal: 'Ganhar Massa Muscular',
--                      birth_date: '1995-05-10', gender: 'Masculino' }
--   })
--
-- Cada createUser dispara a trigger on_auth_user_created (ver "Regras BD.sql"),
-- que já cria as linhas de users, user_profiles, user_measurements e user_streaks.
-- Por isso os INSERTs de users, user_profiles e user_streaks abaixo usam
-- ON CONFLICT DO UPDATE: eles ajustam o que a trigger criou para os valores de
-- demo, e continuam funcionando caso a trigger não esteja instalada no ambiente.
-- user_measurements é o caso à parte, explicado na seção dela.

-- 1.1 Módulo de Autenticação e Perfil
-- Sem password_hash: a senha vive só no Supabase Auth (auth.users), nunca aqui.
-- auth_provider é meramente descritivo; o provedor real é o que foi usado no Auth.
INSERT INTO users (id, email, auth_provider) VALUES
('A1000000-0000-0000-0000-000000000001', 'joao@torv.com', 'email'),
('A1000000-0000-0000-0000-000000000002', 'marina@torv.com', 'google'),
('A1000000-0000-0000-0000-000000000003', 'rafael@torv.com', 'apple'),
('A1000000-0000-0000-0000-000000000004', 'julia@torv.com', 'email'),
('A1000000-0000-0000-0000-000000000005', 'pedro@torv.com', 'google')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, auth_provider = EXCLUDED.auth_provider;

-- Valores de domínio exatos, iguais aos que o app grava:
--   fitness_level: 'INICIANTE' | 'INTERMEDIÁRIO' | 'AVANÇADO'
--   goal: 'Perder Peso', 'Ganhar Massa Muscular', 'Melhorar Condicionamento',
--         'Aumentar Resistência', 'Criar uma Rotina', 'Saúde & Bem-estar'
--         (múltiplos objetivos = uma string só, separados por ', ')
--   gender: 'Masculino' | 'Feminino'
INSERT INTO user_profiles (user_id, username, name, fitness_level, goal, birth_date, gender) VALUES
('A1000000-0000-0000-0000-000000000001', '@joaosilva', 'João Silva', 'INTERMEDIÁRIO', 'Ganhar Massa Muscular', '1995-05-10', 'Masculino'),
('A1000000-0000-0000-0000-000000000002', '@marinalves', 'Marina Alves', 'AVANÇADO', 'Melhorar Condicionamento', '1992-08-22', 'Feminino'),
('A1000000-0000-0000-0000-000000000003', '@rafacosta', 'Rafael Costa', 'AVANÇADO', 'Aumentar Resistência', '1990-11-05', 'Masculino'),
('A1000000-0000-0000-0000-000000000004', '@julialima', 'Julia Lima', 'INICIANTE', 'Perder Peso', '1998-02-15', 'Feminino'),
('A1000000-0000-0000-0000-000000000005', '@pedrotorres', 'Pedro Torres', 'INTERMEDIÁRIO', 'Criar uma Rotina', '1997-07-30', 'Masculino')
ON CONFLICT (user_id) DO UPDATE SET
  username = EXCLUDED.username, name = EXCLUDED.name,
  fitness_level = EXCLUDED.fitness_level, goal = EXCLUDED.goal,
  birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

-- user_measurements é série temporal (PK é o id, não o user_id): a trigger já
-- gravou a medição do cadastro, e estas linhas entram como a medição mais recente.
INSERT INTO user_measurements (user_id, weight_kg, height_cm) VALUES
('A1000000-0000-0000-0000-000000000001', 78.5, 180),
('A1000000-0000-0000-0000-000000000002', 62.0, 165),
('A1000000-0000-0000-0000-000000000003', 85.0, 185),
('A1000000-0000-0000-0000-000000000004', 70.0, 160),
('A1000000-0000-0000-0000-000000000005', 75.2, 175);

-- 1.2 Módulo de Gamificação e Social
INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity) VALUES
('A1000000-0000-0000-0000-000000000001', 12, 21, now() - interval '1 day'), -- Treinou ontem
('A1000000-0000-0000-0000-000000000002', 5, 15, now() - interval '1 day'),
('A1000000-0000-0000-0000-000000000003', 0, 45, now() - interval '5 days'), -- Ofensiva quebrada
('A1000000-0000-0000-0000-000000000004', 2, 2, now() - interval '1 day'),
('A1000000-0000-0000-0000-000000000005', 1, 10, now()) -- Treinou hoje
ON CONFLICT (user_id) DO UPDATE SET
  current_streak = EXCLUDED.current_streak, longest_streak = EXCLUDED.longest_streak,
  last_activity = EXCLUDED.last_activity;

INSERT INTO follows (follower_id, followed_id) VALUES
('A1000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000002'),
('A1000000-0000-0000-0000-000000000002', 'A1000000-0000-0000-0000-000000000001'),
('A1000000-0000-0000-0000-000000000003', 'A1000000-0000-0000-0000-000000000001'),
('A1000000-0000-0000-0000-000000000004', 'A1000000-0000-0000-0000-000000000002'),
('A1000000-0000-0000-0000-000000000005', 'A1000000-0000-0000-0000-000000000003');

INSERT INTO groups (id, name, period_type) VALUES
('B2000000-0000-0000-0000-000000000001', 'Academia Bros', 'Semanal'),
('B2000000-0000-0000-0000-000000000002', 'Corredores SP', 'Mensal'),
('B2000000-0000-0000-0000-000000000003', 'Desafio 30 Dias', 'Mensal'),
('B2000000-0000-0000-0000-000000000004', 'Crossfit Elite', 'Semanal'),
('B2000000-0000-0000-0000-000000000005', 'Yoga Matinal', 'Semanal');

INSERT INTO group_members (group_id, user_id) VALUES
('B2000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000001'),
('B2000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000002'),
('B2000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000003'),
('B2000000-0000-0000-0000-000000000002', 'A1000000-0000-0000-0000-000000000002'),
('B2000000-0000-0000-0000-000000000003', 'A1000000-0000-0000-0000-000000000004');

INSERT INTO group_rankings (group_id, user_id, total_points, activities_count) VALUES
('B2000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000001', 3990, 12),
('B2000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000002', 3450, 10),
('B2000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000003', 4820, 15),
('B2000000-0000-0000-0000-000000000002', 'A1000000-0000-0000-0000-000000000002', 1200, 4),
('B2000000-0000-0000-0000-000000000003', 'A1000000-0000-0000-0000-000000000004', 500, 2);

-- 1.3 Módulo de Tracking e Rotinas
-- Schema de 20260930200000_workout_module + 20261001150000_workout_generator_rules.
-- O catálogo de exercícios (71, com type/min_level/catalog_order) e os 101 slots de
-- workout_template_slots já vêm semeados por essas migrations — este mock NÃO os
-- repete: as rotinas abaixo usam o catálogo pelo slug.
-- Aqui entram só exercícios PRÓPRIOS: owner_user_id preenchido e slug, type,
-- min_level e catalog_order NULL (exercises_catalog_rules_check em "Regras BD.sql").
-- muscle_group tem que ser um dos 12 grupos (exercises_muscle_group_check).
INSERT INTO exercises (id, name, muscle_group, owner_user_id) VALUES
('C3000000-0000-0000-0000-000000000001', 'Rosca 21', 'Bíceps', 'A1000000-0000-0000-0000-000000000001'),
('C3000000-0000-0000-0000-000000000002', 'Agachamento no banco', 'Quadríceps', 'A1000000-0000-0000-0000-000000000002'),
('C3000000-0000-0000-0000-000000000003', 'Remada cavalinho', 'Costas', 'A1000000-0000-0000-0000-000000000003'),
('C3000000-0000-0000-0000-000000000004', 'Supino na máquina articulada', 'Peito', 'A1000000-0000-0000-0000-000000000003'),
('C3000000-0000-0000-0000-000000000005', 'Tríceps coice', 'Tríceps', 'A1000000-0000-0000-0000-000000000004');

-- Rotinas criadas pelo usuário (is_default = false), em ordem (position) por usuário.
-- As rotinas do plano default (is_default = true) o backend gera sozinho no primeiro
-- GET /workouts/routines a partir de workout_template_slots + catálogo; por isso
-- user_profiles.workout_plan_basis fica NULL no mock (plano default nunca gerado).
INSERT INTO workout_routines (id, user_id, name, is_default, position) VALUES
('D4000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000001', 'Peito & Tríceps', false, 1),
('D4000000-0000-0000-0000-000000000002', 'A1000000-0000-0000-0000-000000000001', 'Costas & Bíceps', false, 2),
('D4000000-0000-0000-0000-000000000003', 'A1000000-0000-0000-0000-000000000002', 'Pernas & Glúteos', false, 1),
('D4000000-0000-0000-0000-000000000004', 'A1000000-0000-0000-0000-000000000003', 'Full Body', false, 1),
('D4000000-0000-0000-0000-000000000005', 'A1000000-0000-0000-0000-000000000004', 'Cardio HIIT', false, 1);

-- Reps viram faixa (reps_min..reps_max) e o descanso fica por exercício. Exercício
-- próprio só entra em rotina do próprio dono (o backend valida; ver Rosca 21).
INSERT INTO routine_exercises (id, routine_id, exercise_id, position, reps_min, reps_max, rest_sec) VALUES
('E5000000-0000-0000-0000-000000000001', 'D4000000-0000-0000-0000-000000000001', (SELECT id FROM exercises WHERE slug = 'supino-reto-com-barra'), 1, 8, 10, 120),
('E5000000-0000-0000-0000-000000000002', 'D4000000-0000-0000-0000-000000000001', (SELECT id FROM exercises WHERE slug = 'triceps-testa'), 2, 10, 12, 60),
('E5000000-0000-0000-0000-000000000003', 'D4000000-0000-0000-0000-000000000002', (SELECT id FROM exercises WHERE slug = 'puxada-frontal-na-polia'), 1, 10, 12, 90),
('E5000000-0000-0000-0000-000000000004', 'D4000000-0000-0000-0000-000000000002', 'C3000000-0000-0000-0000-000000000001', 2, 12, 15, 60),
('E5000000-0000-0000-0000-000000000005', 'D4000000-0000-0000-0000-000000000003', (SELECT id FROM exercises WHERE slug = 'agachamento-livre-com-barra'), 1, 6, 8, 120);

-- Uma linha por série (antes era a coluna routine_exercises.sets), com a carga da
-- série. weight_kg NULL = sem carga definida (é como o plano default nasce).
INSERT INTO routine_exercise_sets (routine_exercise_id, set_number, weight_kg)
SELECT v.routine_exercise_id, n, v.weight_kg
FROM (VALUES
  ('E5000000-0000-0000-0000-000000000001'::uuid, 4, 60.00),
  ('E5000000-0000-0000-0000-000000000002'::uuid, 3, 20.00),
  ('E5000000-0000-0000-0000-000000000003'::uuid, 4, 50.00),
  ('E5000000-0000-0000-0000-000000000004'::uuid, 3, NULL),
  ('E5000000-0000-0000-0000-000000000005'::uuid, 4, 80.00)
) v(routine_exercise_id, sets, weight_kg)
CROSS JOIN generate_series(1, v.sets) n;

-- 1.4 Módulo de Nutrição
-- basis_json e updated_at (20260924171548_nutrition_targets_basis) ficam NULL aqui
-- de propósito: são preenchidos pelo backend quando ele calcula ou aceita uma meta,
-- e uma meta de mock não tem um cálculo real por trás.
INSERT INTO nutrition_targets (user_id, daily_calories, protein_g, carbs_g, fat_g) VALUES
('A1000000-0000-0000-0000-000000000001', 2400, 160, 250, 80),
('A1000000-0000-0000-0000-000000000002', 1800, 120, 150, 60),
('A1000000-0000-0000-0000-000000000003', 2800, 180, 300, 90),
('A1000000-0000-0000-0000-000000000004', 1600, 100, 130, 50),
('A1000000-0000-0000-0000-000000000005', 2200, 140, 220, 70);

INSERT INTO food_logs (user_id, food_name, calories, logged_date, macros_json) VALUES
('A1000000-0000-0000-0000-000000000001', 'Ovos Mexidos (3 und)', 210, now(), '{"protein":18,"carbs":2,"fat":15}'),
('A1000000-0000-0000-0000-000000000001', 'Aveia c/ Banana', 350, now(), '{"protein":8,"carbs":60,"fat":5}'),
('A1000000-0000-0000-0000-000000000002', 'Salada de Frango', 400, now(), '{"protein":35,"carbs":10,"fat":20}'),
('A1000000-0000-0000-0000-000000000003', 'Whey Protein', 120, now(), '{"protein":24,"carbs":3,"fat":1}'),
('A1000000-0000-0000-0000-000000000004', 'Maçã', 80, now(), '{"protein":0,"carbs":20,"fat":0}');

-- Inserindo algumas atividades passadas (para não engatilhar as triggers de teste ainda)
INSERT INTO activities (id, user_id, activity_type, title, start_time, duration_sec, calories, distance_m) VALUES
(gen_random_uuid(), 'A1000000-0000-0000-0000-000000000001', 'Caminhada', 'Caminhada Matinal', now() - interval '1 day', 1920, 180, 3200),
(gen_random_uuid(), 'A1000000-0000-0000-0000-000000000002', 'Corrida', 'Corrida ao ar livre', now() - interval '1 day', 1692, 312, 5400),
(gen_random_uuid(), 'A1000000-0000-0000-0000-000000000004', 'Yoga', 'Yoga Flow', now() - interval '1 day', 1800, 150, NULL),
(gen_random_uuid(), 'A1000000-0000-0000-0000-000000000005', 'Ciclismo', 'Pedalada noturna', now(), 3600, 500, 15000);

-- Treino de musculação finalizado no app: activity_type = 'STRENGTH', title = nome da
-- rotina, routine_id = rotina usada. Só um STRENGTH por (user_id, start_time)
-- (activities_strength_user_start_key, em Gestao_e_Performance.sql).
INSERT INTO activities (id, user_id, activity_type, title, start_time, duration_sec, calories, routine_id) VALUES
('F6000000-0000-0000-0000-000000000001', 'A1000000-0000-0000-0000-000000000003', 'STRENGTH', 'Full Body', now() - interval '5 days', 3600, 480, 'D4000000-0000-0000-0000-000000000004');

-- Séries desse treino: só tempos. exercise_name é cópia do nome no momento do treino;
-- rest_before_sec NULL na primeira série.
INSERT INTO workout_sets (activity_id, exercise_id, exercise_name, position, set_number, duration_sec, rest_before_sec) VALUES
('F6000000-0000-0000-0000-000000000001', (SELECT id FROM exercises WHERE slug = 'agachamento-livre-com-barra'), 'Agachamento livre com barra', 1, 1, 50, NULL),
('F6000000-0000-0000-0000-000000000001', (SELECT id FROM exercises WHERE slug = 'agachamento-livre-com-barra'), 'Agachamento livre com barra', 1, 2, 48, 120),
('F6000000-0000-0000-0000-000000000001', 'C3000000-0000-0000-0000-000000000003', 'Remada cavalinho', 2, 1, 40, 150),
('F6000000-0000-0000-0000-000000000001', 'C3000000-0000-0000-0000-000000000003', 'Remada cavalinho', 2, 2, 42, 90),
('F6000000-0000-0000-0000-000000000001', 'C3000000-0000-0000-0000-000000000004', 'Supino na máquina articulada', 3, 1, 38, 140);
