# Graph Report - torv  (2026-09-11)

## Corpus Check
- 70 files · ~212,966 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 481 nodes · 625 edges · 34 communities (27 shown, 1 thin omitted)
- Extraction: 83% EXTRACTED · 16% INFERRED · 1% AMBIGUOUS · INFERRED: 99 edges (avg confidence: 0.83)
- Token cost: 1,170,366 input · 0 output

## Community Hubs (Navigation)
- React Native App Shell & Components
- Backend Node Dependencies
- Frontend Expo Dependencies
- Auth Controller (register/login)
- Express Server Bootstrap
- SQL Server Stored Procedures (diet/age)
- Diet Controller (food log CRUD)
- Prisma ORM Layered Architecture (GEMINI.md)
- Frontend/Backend Decoupled Architecture Docs
- Expo App Icon & Splash Config
- Home2 Screen Mockup (feed/explore)
- Frontend Package Metadata
- Activity Picker Screen Mockup
- Onboarding: Fitness Goal Selection Mockup
- Login Screen (social + email) Mockup
- Profile Screen Mockup (watch/stats)
- Home1 Screen Mockup (dashboard)
- Welcome/Login Landing Mockup
- Onboarding: Name/Birthdate Mockup
- Onboarding: Biological Sex Mockup
- Onboarding: Fitness Level Mockup
- Diet Screen Mockup (calories/macros v1)
- Diet Screen Mockup (calories/macros v2)
- Registration Screen Mockup
- Onboarding: Body Measurements Mockup
- Onboarding: Success/Completion Mockup
- Card Component
- TypeScript Config

## God Nodes (most connected - your core abstractions)
1. `users` - 12 edges
2. `Login Screen Mockup (Dark, Mobile)` - 12 edges
3. `expo` - 10 edges
4. `Perfil Screen Mockup (Mobile Fitness App)` - 10 edges
5. `Home Screen Design Mockup (home1.png)` - 10 edges
6. `Fitness Goal Option List` - 9 edges
7. `DietRepository` - 8 edges
8. `Sobre Voce Onboarding Screen Mockup` - 8 edges
9. `Minha Dieta Mobile Screen Mockup` - 8 edges
10. `TORV Login/Welcome Screen Mockup` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Torv Application` --semantically_similar_to--> `TORV Project`  [INFERRED] [semantically similar]
  README.md → GEMINI.md
- `Axios HTTP Requests` --semantically_similar_to--> `Front-End API Client Layer (src/services)`  [INFERRED] [semantically similar]
  README.md → GEMINI.md
- `Expo v56 Versioned Docs Rule` --conceptually_related_to--> `FrontEndTorv (Mobile Front-End)`  [INFERRED]
  FrontEndTorv/AGENTS.md → GEMINI.md
- `Expo v56 Versioned Docs Rule` --rationale_for--> `Expo Toolchain`  [INFERRED]
  FrontEndTorv/AGENTS.md → README.md
- `React Navigation (Stack + Bottom Tabs)` --implements--> `FrontEndTorv (Mobile Front-End)`  [EXTRACTED]
  README.md → GEMINI.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **User Authentication Flow** — readme_auth_register, readme_auth_login, readme_jwt_auth, readme_jwt_secret_env, readme_profile_routes [EXTRACTED 1.00]
- **Diet Tracking and Daily Summary Pipeline** — readme_diet_routes, readme_food_log, readme_diet_targets, readme_diet_summary, readme_stored_procedures [EXTRACTED 1.00]
- **Back-End Data Persistence Stack** — gemini_repository_layer, gemini_prisma_orm, gemini_sqlserver_database, gemini_database_url_env, readme_stored_procedures [INFERRED 0.95]
- **Account Creation Flow: Form, Social Providers, Login Fallback** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180802_registration_form, frontendtorv_inspiration_captura_de_tela_2026_06_04_180802_social_auth, frontendtorv_inspiration_captura_de_tela_2026_06_04_180802_login_link [INFERRED 0.85]
- **Mobile Visual Language: Dark Surface, Green CTA, Dismissible Sheet, PT-BR Copy** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180802_screen, frontendtorv_inspiration_captura_de_tela_2026_06_04_180802_dark_theme_green_accent, frontendtorv_inspiration_captura_de_tela_2026_06_04_180802_dismiss_modal_pattern, frontendtorv_inspiration_captura_de_tela_2026_06_04_180802_ptbr_locale [INFERRED 0.85]
- **Onboarding Step Screen Composition (progress, fields, footer nav)** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180808_segmented_progress_indicator, frontendtorv_inspiration_captura_de_tela_2026_06_04_180808_nome_input_field, frontendtorv_inspiration_captura_de_tela_2026_06_04_180808_data_nascimento_input_field, frontendtorv_inspiration_captura_de_tela_2026_06_04_180808_voltar_continuar_nav_pair [EXTRACTED 1.00]
- **Shared Dark and Lime Visual Language Across Screen Elements** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180808_dark_lime_design_system, frontendtorv_inspiration_captura_de_tela_2026_06_04_180808_sobre_voce_screen, frontendtorv_inspiration_captura_de_tela_2026_06_04_180808_voltar_continuar_nav_pair, frontendtorv_inspiration_captura_de_tela_2026_06_04_180808_mobile_safe_area_layout [INFERRED 0.85]
- **Multi-Step Onboarding Screen Pattern (stepper + form + footer nav)** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180814_onboarding_progress_stepper, frontendtorv_inspiration_captura_de_tela_2026_06_04_180814_body_measurement_inputs, frontendtorv_inspiration_captura_de_tela_2026_06_04_180814_back_continue_footer, frontendtorv_inspiration_captura_de_tela_2026_06_04_180814_seu_corpo_screen [INFERRED 0.85]
- **Onboarding Step Layout Pattern: stepper, title and subtitle, option cards, nav pair** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180821_progress_stepper, frontendtorv_inspiration_captura_de_tela_2026_06_04_180821_biological_sex_step, frontendtorv_inspiration_captura_de_tela_2026_06_04_180821_circular_option_selector, frontendtorv_inspiration_captura_de_tela_2026_06_04_180821_nav_voltar_continuar [INFERRED 0.85]
- **Dark Lime Visual Language Applied Across Controls** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180821_dark_lime_theme, frontendtorv_inspiration_captura_de_tela_2026_06_04_180821_selected_state_lime_ring, frontendtorv_inspiration_captura_de_tela_2026_06_04_180821_progress_stepper, frontendtorv_inspiration_captura_de_tela_2026_06_04_180821_nav_voltar_continuar [INFERRED 0.85]
- **Three-Tier Physical Level Choice Set (color-coded difficulty scale)** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180829_option_iniciante, frontendtorv_inspiration_captura_de_tela_2026_06_04_180829_option_intermediario, frontendtorv_inspiration_captura_de_tela_2026_06_04_180829_option_avancado, frontendtorv_inspiration_captura_de_tela_2026_06_04_180829_fitness_level_selection [EXTRACTED 1.00]
- **Onboarding Step Layout Pattern (progress bar, title and subtitle, option cards, footer nav)** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180829_onboarding_wizard, frontendtorv_inspiration_captura_de_tela_2026_06_04_180829_fitness_level_selection, frontendtorv_inspiration_captura_de_tela_2026_06_04_180829_nav_voltar_continuar, frontendtorv_inspiration_captura_de_tela_2026_06_04_180829_dark_theme_lime_accent [INFERRED 0.85]
- **Onboarding Completion Confirmation Pattern** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180841_step_progress_indicator, frontendtorv_inspiration_captura_de_tela_2026_06_04_180841_success_checkmark_confirmation, frontendtorv_inspiration_captura_de_tela_2026_06_04_180841_comecar_agora_cta, frontendtorv_inspiration_captura_de_tela_2026_06_04_180841_profile_creation_completed [INFERRED 0.85]
- **Three Parallel Authentication Entry Points on One Screen** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180856_email_password_form, frontendtorv_inspiration_captura_de_tela_2026_06_04_180856_google_sign_in, frontendtorv_inspiration_captura_de_tela_2026_06_04_180856_apple_sign_in, frontendtorv_inspiration_captura_de_tela_2026_06_04_180856_ou_divider [EXTRACTED 1.00]
- **Dark Surface plus Lime Pill Visual Language** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180856_dark_theme, frontendtorv_inspiration_captura_de_tela_2026_06_04_180856_lime_accent, frontendtorv_inspiration_captura_de_tela_2026_06_04_180856_pill_button_style [INFERRED 0.85]
- **Secondary Account Actions (Recover, Register, Dismiss)** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180856_forgot_password_link, frontendtorv_inspiration_captura_de_tela_2026_06_04_180856_register_link, frontendtorv_inspiration_captura_de_tela_2026_06_04_180856_dismiss_button [INFERRED 0.75]
- **Gamified Engagement Metrics (streak, monthly volume, social counts)** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180925_streak_card, frontendtorv_inspiration_captura_de_tela_2026_06_04_180925_monthly_volume_card, frontendtorv_inspiration_captura_de_tela_2026_06_04_180925_social_stats_row [INFERRED 0.85]
- **Profile Screen Vertical Section Stack (objetivo, watch, historico)** — frontendtorv_inspiration_captura_de_tela_2026_06_04_180925_objetivo_card, frontendtorv_inspiration_captura_de_tela_2026_06_04_180925_connected_watch_card, frontendtorv_inspiration_captura_de_tela_2026_06_04_180925_historico_de_hoje, frontendtorv_inspiration_captura_de_tela_2026_06_04_180925_card_section_layout [EXTRACTED 1.00]
- **Physical Activity Type Catalog offered on the logging picker** — frontendtorv_inspiration_captura_de_tela_2026_06_04_181454_activity_type_corrida, frontendtorv_inspiration_captura_de_tela_2026_06_04_181454_activity_type_pedalada, frontendtorv_inspiration_captura_de_tela_2026_06_04_181454_activity_type_caminhada, frontendtorv_inspiration_captura_de_tela_2026_06_04_181454_activity_type_natacao, frontendtorv_inspiration_captura_de_tela_2026_06_04_181454_activity_type_esporte_coletivo, frontendtorv_inspiration_captura_de_tela_2026_06_04_181454_activity_type_outra_atividade [EXTRACTED 1.00]
- **Log-something flow: FAB opens picker, picker routes to exercise or nutrition** — frontendtorv_inspiration_captura_de_tela_2026_06_04_181454_bottom_tab_bar, frontendtorv_inspiration_captura_de_tela_2026_06_04_181454_activity_picker_screen, frontendtorv_inspiration_captura_de_tela_2026_06_04_181454_registrar_refeicao_entry, frontendtorv_inspiration_captura_de_tela_2026_06_04_181454_nutricao_tab [INFERRED 0.85]
- **Selected day drives calorie, macro and meal summaries** — frontendtorv_inspiration_captura_de_tela_2026_06_04_181501_week_day_strip, frontendtorv_inspiration_captura_de_tela_2026_06_04_181501_daily_calories_card, frontendtorv_inspiration_captura_de_tela_2026_06_04_181501_macro_cards, frontendtorv_inspiration_captura_de_tela_2026_06_04_181501_meals_list [INFERRED 0.85]
- **Rounded dark cards with lime accents across all sections** — frontendtorv_inspiration_captura_de_tela_2026_06_04_181501_dark_lime_design_language, frontendtorv_inspiration_captura_de_tela_2026_06_04_181501_daily_calories_card, frontendtorv_inspiration_captura_de_tela_2026_06_04_181501_macro_cards, frontendtorv_inspiration_captura_de_tela_2026_06_04_181501_bottom_nav_fab [INFERRED 0.85]
- **Daily Nutrition Tracking Screen Composition** — frontendtorv_inspiration_captura_de_tela_2026_06_04_181509_daily_calorie_card, frontendtorv_inspiration_captura_de_tela_2026_06_04_181509_macro_cards, frontendtorv_inspiration_captura_de_tela_2026_06_04_181509_meals_list, frontendtorv_inspiration_captura_de_tela_2026_06_04_181509_add_meal_cta [INFERRED 0.85]
- **Dark Lime Mobile Design System Signals** — frontendtorv_inspiration_captura_de_tela_2026_06_04_181509_dark_lime_theme, frontendtorv_inspiration_captura_de_tela_2026_06_04_181509_bottom_nav, frontendtorv_inspiration_captura_de_tela_2026_06_04_181509_tab_switcher, frontendtorv_inspiration_captura_de_tela_2026_06_04_181509_goal_vs_actual_pattern [INFERRED 0.75]
- **Onboarding Goal-Selection Step Flow** — frontendtorv_inspiration_obj_screen, frontendtorv_inspiration_obj_onboarding_progress, frontendtorv_inspiration_obj_goal_options, frontendtorv_inspiration_obj_nav_actions [INFERRED 0.85]
- **Fitness Goal Taxonomy Offered at Onboarding** — frontendtorv_inspiration_obj_perder_peso, frontendtorv_inspiration_obj_ganhar_massa_muscular, frontendtorv_inspiration_obj_melhorar_condicionamento, frontendtorv_inspiration_obj_aumentar_resistencia, frontendtorv_inspiration_obj_criar_uma_rotina, frontendtorv_inspiration_obj_saude_bem_estar [EXTRACTED 1.00]
- **Daily Progress At-a-Glance Dashboard** — frontendtorv_inspiration_home1_streak_card, frontendtorv_inspiration_home1_workout_of_day_card, frontendtorv_inspiration_home1_activity_card, frontendtorv_inspiration_home1_calorie_balance_card [INFERRED 0.85]
- **Mobile App Shell Pattern (header, scrollable cards, tab bar)** — frontendtorv_inspiration_home1_greeting_header, frontendtorv_inspiration_home1_card_stack_layout, frontendtorv_inspiration_home1_bottom_tab_nav, frontendtorv_inspiration_home1_dark_lime_theme [INFERRED 0.75]
- **Home Screen Composition: Calories, Feed, Explore** — frontendtorv_inspiration_home2_calorias_de_hoje_card, frontendtorv_inspiration_home2_feed_section, frontendtorv_inspiration_home2_explorar_section, frontendtorv_inspiration_home2_card_stack_layout [EXTRACTED 1.00]
- **Quantified Fitness Metric Surfaces** — frontendtorv_inspiration_home2_calorie_goal_progress_bar, frontendtorv_inspiration_home2_calorie_equivalence_label, frontendtorv_inspiration_home2_activity_stats_triad [INFERRED 0.85]
- **Shared Visual Language: Dark Surfaces, Neon Accent, Pill Controls** — frontendtorv_inspiration_home2_dark_neon_theme, frontendtorv_inspiration_home2_category_filter_chips, frontendtorv_inspiration_home2_bottom_tab_bar, frontendtorv_inspiration_home2_section_ver_tudo_pattern [INFERRED 0.75]
- **TORV Welcome Screen Composition (hero, brand copy, dual CTA)** — frontendtorv_inspiration_login_hero_image_top_half, frontendtorv_inspiration_login_torv_brand_identity, frontendtorv_inspiration_login_ptbr_motivational_copy, frontendtorv_inspiration_login_registrese_primary_cta, frontendtorv_inspiration_login_login_secondary_cta [EXTRACTED 1.00]
- **Auth Entry Decision Point (gate offers register or login)** — frontendtorv_inspiration_login_welcome_auth_gate, frontendtorv_inspiration_login_registrese_primary_cta, frontendtorv_inspiration_login_login_secondary_cta, frontendtorv_inspiration_login_registration_first_hierarchy [INFERRED 0.85]

## Communities (34 total, 1 thin omitted)

### Community 0 - "React Native App Shell & Components"
Cohesion: 0.06
Nodes (36): App(), Button(), ButtonProps, styles, Input(), InputProps, styles, ProgressBar() (+28 more)

### Community 1 - "Backend Node Dependencies"
Cohesion: 0.06
Nodes (32): author, dependencies, bcrypt, cors, dotenv, express, jsonwebtoken, multer (+24 more)

### Community 2 - "Frontend Expo Dependencies"
Cohesion: 0.06
Nodes (31): axios, expo, expo-image-picker, expo-linear-gradient, expo-status-bar, dependencies, axios, expo (+23 more)

### Community 3 - "Auth Controller (register/login)"
Cohesion: 0.06
Nodes (15): AuthController, authRepository, bcrypt, jwt, ProfileController, profileRepository, prisma, { PrismaClient } (+7 more)

### Community 4 - "Express Server Bootstrap"
Cohesion: 0.08
Nodes (20): app, authRoutes, cors, dietRoutes, express, path, profileRoutes, jwt (+12 more)

### Community 5 - "SQL Server Stored Procedures (diet/age)"
Cohesion: 0.16
Nodes (17): vw_Dashboard_User_Stats, vw_Group_Leaderboard, activities, activity_gps_data, exercises, follows, food_logs, group_members (+9 more)

### Community 6 - "Diet Controller (food log CRUD)"
Cohesion: 0.13
Nodes (5): DietController, dietRepository, formatDietSummaryResponse(), DietRepository, prisma

### Community 7 - "Prisma ORM Layered Architecture (GEMINI.md)"
Cohesion: 0.13
Nodes (20): Controller Layer, DATABASE_URL Environment Variable, Prisma ORM, Prisma SQL Server Native Types Rule, Repository Data Access Layer, Microsoft SQL Server Database (torv), POST /auth/login, POST /auth/register (+12 more)

### Community 8 - "Frontend/Backend Decoupled Architecture Docs"
Cohesion: 0.12
Nodes (19): Expo v56 Versioned Docs Rule, FrontEndTorv CLAUDE.md Agent Instructions, Front-End API Client Layer (src/services), BackEndTorv (REST API), Component-Driven Development Pattern, Decoupled Front-End / Back-End Architecture, Node.js + Express Server, FrontEndTorv (Mobile Front-End) (+11 more)

### Community 9 - "Expo App Icon & Splash Config"
Cohesion: 0.11
Nodes (18): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+10 more)

### Community 10 - "Home2 Screen Mockup (feed/explore)"
Cohesion: 0.21
Nodes (15): Home Screen Design Mockup (home2), Activity Post Card with Author and Reactions, Activity Stats Triad (distance / time / kcal), Floating Bottom Tab Bar with Center FAB, Calorias de Hoje Summary Card, Calorie-to-Activity Equivalence Label (kcal = caminhada), Calorie Goal Progress Bar, Vertical Card-Stack Home Layout (+7 more)

### Community 11 - "Frontend Package Metadata"
Cohesion: 0.13
Nodes (14): devDependencies, @types/react, typescript, main, name, private, scripts, android (+6 more)

### Community 12 - "Activity Picker Screen Mockup"
Cohesion: 0.16
Nodes (14): Activity Picker Screen (O que voce quer registrar?), Caminhada (Ao ar livre ou esteira), Corrida (Rua, esteira, trilha), Esporte coletivo (Futebol, basquete), Natacao (Piscina, mar, lago), Outra atividade (Qualquer exercicio) catch-all option, Pedalada (Bike, spinning), Alimentacao Section (+6 more)

### Community 13 - "Onboarding: Fitness Goal Selection Mockup"
Cohesion: 0.20
Nodes (14): Goal: Aumentar Resistencia, Goal: Criar uma Rotina, Dark Theme with Neon Green Accent, Goal: Ganhar Massa Muscular, Fitness Goal Option List, Goal: Melhorar Condicionamento, iOS Mobile Frame Mockup (9:41 Status Bar), Multi-Select Radio Card Pattern (+6 more)

### Community 14 - "Login Screen (social + email) Mockup"
Cohesion: 0.22
Nodes (13): Continuar com a Apple (OAuth Button), Near-Black Dark Theme Surface, Top-Right Close (X) Dismiss Control, Email + Password Credential Form, Esqueceu sua senha? Recovery Link, Continuar com o Google (OAuth Button), Lime Green Accent Color System, Login Screen Mockup (Dark, Mobile) (+5 more)

### Community 15 - "Profile Screen Mockup (watch/stats)"
Cohesion: 0.24
Nodes (12): Bottom Tab Bar with Floating Add FAB (5 slots), Rounded Card Plus Section Heading Layout Pattern, Relogio Conectado Card (Apple Watch Series 9), Dark Theme with Neon Green Accent, Historico de Hoje Activity List (Caminhada, duration, kcal, via relogio), Monthly Volume Card (Este Mes, 14 treinos, +3 vs last month), Objetivo Card (Ganhar Massa Muscular, set at signup), Perfil Screen Mockup (Mobile Fitness App) (+4 more)

### Community 16 - "Home1 Screen Mockup (dashboard)"
Cohesion: 0.26
Nodes (12): Home Screen Design Mockup (home1.png), Wearable Activity Card (Caminhada matinal, Relogio source), Bottom Tab Bar with Central FAB (Home, Treinos, Add, Social, Perfil), Calorias de Hoje Card (Consumidas vs Gastas with Progress Bar), Vertical Rounded-Card Stack Layout Pattern, Dark Theme with Lime-Green Accent, Motivation-Through-Engagement Design Rationale, Personalized Greeting Header with Avatar (+4 more)

### Community 17 - "Welcome/Login Landing Mockup"
Cohesion: 0.31
Nodes (11): Dark Theme with Lime Green Accent, Fitness/Training App Positioning, Full-Bleed Fitness Hero Photo (Top Half), Login Secondary CTA (Outlined Pill Button), Mobile Portrait Device Frame (iOS Status Bar), Portuguese (pt-BR) Motivational Copy, Registration-First Visual Hierarchy Decision, Registre-se Primary CTA (Filled Pill Button) (+3 more)

### Community 18 - "Onboarding: Name/Birthdate Mockup"
Cohesion: 0.38
Nodes (10): Dark Theme with Lime Green Accent Design System, Data de Nascimento Input (DD/MM/AAAA), Mobile Safe-Area Layout with Pinned Footer Actions, Multi-Step Onboarding Flow (5 Steps), Nome Input Field (Como quer ser chamado?), Portuguese (pt-BR) UI Copy, Segmented Progress Indicator, Sobre Voce Onboarding Screen Mockup (+2 more)

### Community 19 - "Onboarding: Biological Sex Mockup"
Cohesion: 0.29
Nodes (10): Biological Sex Onboarding Step, Circular Icon Option Selector (Male / Female), Dark Theme with Lime Green Accent, Rationale: Sex Refines Metabolic Calculations, iPhone Device Frame Mockup (9:41 status bar), Bottom Navigation Pair: Voltar (outline) / Continuar (filled), Five-Segment Progress Stepper (3 of 5 complete), Portuguese (pt-BR) UI Copy (+2 more)

### Community 20 - "Onboarding: Fitness Level Mockup"
Cohesion: 0.29
Nodes (10): Dark Theme with Lime-Green Accent Design Language, Fitness Level Selection (single-choice card list), Footer Navigation Voltar and Continuar (outline back, filled green continue), Multi-Step Onboarding Wizard (5-segment progress bar, step 4 of 5), Option AVANCADO (advanced tier, red accent), Option INICIANTE (beginner tier, blue accent), Option INTERMEDIARIO (intermediate tier, green accent, appears selected), Brazilian Portuguese UI Copy (+2 more)

### Community 21 - "Diet Screen Mockup (calories/macros v1)"
Cohesion: 0.36
Nodes (10): Floating Bottom Nav with Central Green Add FAB, Calorias do Dia Progress Card (1840 / 2400 kcal), Dark Theme with Lime-Green Accent Design Language, Minha Dieta Mobile Screen Mockup, Goal-vs-Actual Progress Bar Pattern (meta vs consumed), Macro Breakdown Cards (Proteina / Carboidrato / Gordura), Refeicoes List (meal rows with time, macros, kcal, chevron), Brazilian Portuguese UI Copy (+2 more)

### Community 22 - "Diet Screen Mockup (calories/macros v2)"
Cohesion: 0.31
Nodes (10): Adicionar Refeicao Dashed CTA, Bottom Tab Bar with Central Green FAB, Daily Calorie Progress Card (1840 / 2400 kcal), Dark Theme with Lime-Green Accent Design Language, Goal-vs-Actual Progress Bar Pattern, Macronutrient Cards (Proteina / Carboidrato / Gordura), Refeicoes Meal List (Cafe da manha, Almoco, Lanche, Jantar), Brazilian Portuguese UI Copy and Metric Units (+2 more)

### Community 23 - "Registration Screen Mockup"
Cohesion: 0.39
Nodes (8): Dark Theme with Lime-Green Accent Design System, Dismissible Modal Sheet (Top-Right X), Existing Account Link (Ja possui uma conta? Entrar), Password Confirmation Field (Confirme a senha), Brazilian Portuguese UI Copy, Email/Password Registration Form, Registre-se Sign-Up Screen Mockup (Mobile, Dark), Social Sign-In (Google + Apple)

### Community 24 - "Onboarding: Body Measurements Mockup"
Cohesion: 0.39
Nodes (8): Voltar / Continuar Footer Navigation Pair, Body Measurement Inputs (Peso kg / Altura cm), Dark Theme with Lime Green Accent Design Language, iOS Mobile Viewport Frame (9:41 status bar), Measurements Collected to Calculate User Metrics, Five-Step Onboarding Progress Stepper (step 2 of 5), Brazilian Portuguese UI Copy and Metric Units, Seu Corpo Onboarding Screen Mockup

### Community 25 - "Onboarding: Success/Completion Mockup"
Cohesion: 0.46
Nodes (8): Primary CTA Button 'Comecar agora', Dark Background + Lime Green Accent Design Language, iOS Mobile Device Frame Mockup (9:41 status bar), Onboarding Success Screen Mockup (Tudo pronto!), Profile Creation Completed State (perfil criado com sucesso), Portuguese (pt-BR) Fitness App Copy, Five-Segment Onboarding Progress Indicator (all complete), Circular Checkmark Success Confirmation

### Community 27 - "TypeScript Config"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

## Ambiguous Edges - Review These
- `Email/Password Registration Form` → `Dark Theme with Lime-Green Accent Design System`  [AMBIGUOUS]
  FrontEndTorv/inspiration/Captura de tela 2026-06-04 180802.png · relation: rationale_for
- `Multi-Step Onboarding Flow (5 Steps)` → `User Profile Data Collection (name, birth date)`  [AMBIGUOUS]
  FrontEndTorv/inspiration/Captura de tela 2026-06-04 180808.png · relation: rationale_for
- `Seu Corpo Onboarding Screen Mockup` → `Measurements Collected to Calculate User Metrics`  [AMBIGUOUS]
  FrontEndTorv/inspiration/Captura de tela 2026-06-04 180814.png · relation: rationale_for
- `Option INTERMEDIARIO (intermediate tier, green accent, appears selected)` → `Dark Theme with Lime-Green Accent Design Language`  [AMBIGUOUS]
  FrontEndTorv/inspiration/Captura de tela 2026-06-04 180829.png · relation: conceptually_related_to
- `Login Screen Mockup (Dark, Mobile)` → `Login Presented as Dismissible Modal Sheet`  [AMBIGUOUS]
  FrontEndTorv/inspiration/Captura de tela 2026-06-04 180856.png · relation: rationale_for
- `Meus Treinos / Minha Dieta Tab Switcher` → `Goal-vs-Actual Progress Bar Pattern`  [AMBIGUOUS]
  FrontEndTorv/inspiration/Captura de tela 2026-06-04 181509.png · relation: conceptually_related_to
- `Activity Post Card with Author and Reactions` → `Floating Bottom Tab Bar with Center FAB`  [AMBIGUOUS]
  FrontEndTorv/inspiration/home2.png · relation: conceptually_related_to
- `Welcome Auth Gate Pattern` → `Mobile Portrait Device Frame (iOS Status Bar)`  [AMBIGUOUS]
  FrontEndTorv/inspiration/login.png · relation: shares_data_with

## Knowledge Gaps
- **143 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+138 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 185 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Email/Password Registration Form` and `Dark Theme with Lime-Green Accent Design System`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **What is the exact relationship between `Multi-Step Onboarding Flow (5 Steps)` and `User Profile Data Collection (name, birth date)`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **What is the exact relationship between `Seu Corpo Onboarding Screen Mockup` and `Measurements Collected to Calculate User Metrics`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **What is the exact relationship between `Option INTERMEDIARIO (intermediate tier, green accent, appears selected)` and `Dark Theme with Lime-Green Accent Design Language`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Login Screen Mockup (Dark, Mobile)` and `Login Presented as Dismissible Modal Sheet`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **What is the exact relationship between `Meus Treinos / Minha Dieta Tab Switcher` and `Goal-vs-Actual Progress Bar Pattern`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Activity Post Card with Author and Reactions` and `Floating Bottom Tab Bar with Center FAB`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._