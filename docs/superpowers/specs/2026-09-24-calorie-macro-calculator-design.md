# Calculadora de Calorias e Macros (metas automáticas + sugestões) — Design

Branch: `feat/calorie-macro-calculator` (segue até aprovação do usuário).

## Contexto

Hoje ninguém cria `nutrition_targets` no cadastro: o cadastro passa pelo Supabase Auth e o trigger `handle_new_user` (migration `20260918165833_supabase_auth_link`) cria `users`, `user_profiles`, `user_measurements` e `user_streaks`, mas não metas nutricionais. Sem linha em `nutrition_targets`, `fn_get_diet_summary` cai no padrão fixo 2000 kcal / 150P / 250C / 65G, que vale igual pra qualquer pessoa.

A fonte da lógica é a planilha `BackEndTorv/calculadora_calorias_macros_app.xlsx` (aba `Macros`), que implementa Mifflin-St Jeor + fator de atividade por nível físico + ajuste calórico por objetivo(s), com trava de segurança por IMC.

Dados de entrada já existentes no banco:
- `user_profiles.birth_date` (DATE): a idade é derivada na hora do cálculo, e é assim que o envelhecimento entra.
- `user_profiles.gender` (`'Masculino'` | `'Feminino'`), `fitness_level` (`'INICIANTE'` | `'INTERMEDIÁRIO'` | `'AVANÇADO'`), `goal` (texto com objetivos separados por `", "`, multi-seleção).
- `user_measurements` (histórico): `weight_kg` DECIMAL(5,2) com CHECK 20–300, `height_cm` INT com CHECK 50–250, `recorded_at`.

## Decisões (via brainstorm)

| Pergunta | Decisão |
|---|---|
| Planilha era de 1 objetivo, app é multi-seleção | Planilha atualizada pelo usuário: **média** dos ajustes efetivos e dos % de macro entre os objetivos marcados; trava do IMC aplicada por objetivo **antes** da média |
| Perder Peso + Ganhar Massa juntos | Não bloqueia; gera alerta de conflito recomendando priorizar um objetivo |
| Como envelhecimento / peso / altura / objetivo / nível afetam a meta salva | **Sempre sugerir**, nunca alterar sozinho. Usuário aceita ou recusa; pode editar manualmente no MyDiet |
| Onde fica o algoritmo | **Módulo JS puro no backend** + criação da meta pelo backend quando faltar (abordagem A). Descartadas: função plpgsql no trigger (difícil de testar, duplicaria lógica pras sugestões) e chamada do front pós-`signUp` (frágil) |
| Fibra (a planilha calcula) | **Fora do escopo**: `food_logs` não registra fibra consumida, a meta não teria comparação. Adicionar quando houver registro de fibra |
| Edição no Perfil | Objetivo (já existe), **nível físico** (novo), **peso e altura** (novo) |

## Algoritmo — `BackEndTorv/src/lib/nutritionCalculator.js`

Função pura, sem I/O:

```
calculateTargets({ gender, birthDate, weightKg, heightCm, fitnessLevel, goals, today })
  → null | { daily_calories, protein_g, carbs_g, fat_g, bmi, bmiClass, warnings, basis }
```

`goals` chega como string do banco (`"Perder Peso, Criar uma Rotina"`) ou array; normalizada para array.

### Tabelas (espelho da planilha)

Nível físico → fator de atividade:

| `fitness_level` | Fator |
|---|---|
| INICIANTE | 1.2 |
| INTERMEDIÁRIO | 1.55 |
| AVANÇADO | 1.9 |

Objetivos:

| Objetivo | Ajuste (kcal/dia) | %P | %C | %G |
|---|---|---|---|---|
| Perder Peso | −450 | 0.30 | 0.40 | 0.30 |
| Ganhar Massa Muscular | +350 | 0.30 | 0.45 | 0.25 |
| Melhorar Condicionamento | 0 | 0.25 | 0.50 | 0.25 |
| Aumentar Resistência | +150 | 0.20 | 0.55 | 0.25 |
| Criar uma Rotina | 0 | 0.25 | 0.45 | 0.30 |
| Saúde & Bem-estar | 0 | 0.25 | 0.45 | 0.30 |

### Passos

1. **Idade** = anos completos entre `birthDate` e `today` (considera mês/dia; `today` é injetável para teste).
2. **IMC** = `round(peso / (altura/100)², 1)`.
3. **Classificação IMC**:
   - idade ≥ 65 (Lipschitz): `< 22` abaixo · `22–27` (inclusive) ideal · `> 27` acima
   - idade < 65 (OMS): `< 18.5` abaixo · `< 25` ideal · `≥ 25` acima (sobrepeso / obesidade I `≥30` / II `≥35` / III `≥40`: a subclasse vai só no rótulo, a regra usa "acima do peso")
4. **TMB** (Mifflin-St Jeor): `10·peso + 6.25·altura − 5·idade + 5` (M) ou `− 161` (F).
5. **TDEE** = TMB × fator do nível.
6. **Ajuste efetivo por objetivo**: Perder Peso com IMC "abaixo do peso" → 0; Ganhar Massa Muscular com IMC "acima do peso" → `round(350/2)` = 175; demais → ajuste da tabela.
7. **Médias** entre objetivos selecionados: ajuste efetivo, %P, %C, %G.
8. **kcal** = TDEE + ajuste médio.
9. **Gramas**: P = kcal·%P/4 · C = kcal·%C/4 · G = kcal·%G/9.
10. **Arredondamento** só no final: `daily_calories`, `protein_g`, `carbs_g`, `fat_g` → inteiro (`Math.round`), porque as colunas são `Int`.
11. **warnings**: `['GOAL_CONFLICT']` se Perder Peso e Ganhar Massa Muscular estiverem ambos selecionados.

### Mapeamentos e bordas

- `gender`: `'Masculino'` → M, `'Feminino'` → F.
- Objetivos com nome fora da tabela são ignorados. Lista vazia após filtro → `['Saúde & Bem-estar']` (a planilha zeraria os %, o que daria macros = 0).
- `fitness_level` nulo/desconhecido → INICIANTE (o mais conservador).
- Falta peso, altura, `birth_date` ou `gender` válido → retorna `null` (não calcula; meta atual não muda).

### `basis` (dados usados no cálculo)

```
{ age, weight_kg, height_cm, gender, fitness_level, goals }   // goals ordenado alfabeticamente
```

Os valores normalizados (fallbacks já aplicados) vão pro `basis`, e `goals` fica ordenado, pra ordem de seleção não gerar sugestão falsa.

## Banco — torv-database

Uma migration Prisma:

- `nutrition_targets.basis_json JSONB NULL`: `basis` que gerou a meta ou que o usuário viu por último (aceitou, recusou ou editou manualmente).
- `nutrition_targets.updated_at TIMESTAMPTZ NULL`

Nada mais muda. Postgres puro, sem feature proprietária do Supabase.

## Backend — torv-backend

### Repository

- `getCalcInputs(userId)`: `user_profiles` (gender, birth_date, fitness_level, goal) + `user_measurements` mais recente (`orderBy recorded_at desc`, take 1).
- `upsertNutritionTargets` passa a aceitar `basis_json` e setar `updated_at`.
- `updateTargetsBasis(userId, basis)`: grava só `basis_json`/`updated_at`.
- `addMeasurement(userId, { weight_kg, height_cm })`: nova linha em `user_measurements`.

### Regra de sugestão (compartilhada)

`buildSuggestion(userId)`: calcula com os dados atuais; se `null` → `{ has_suggestion: false }`. Senão compara `basis` atual com `nutrition_targets.basis_json` salvo (comparação campo a campo). Há sugestão se algum campo difere ou se `basis_json` for nulo. `changed` = lista dos campos que diferem (`age`, `weight_kg`, `height_cm`, `gender`, `fitness_level`, `goals`), ou todos se `basis_json` for nulo.

### Endpoints

| Rota | Comportamento |
|---|---|
| `GET /diet/summary` (e alias `/diet`) | Se o usuário **não tem** linha em `nutrition_targets`: calcula e faz upsert com `basis_json`. Se não der pra calcular, segue com o fallback 2000 do `fn_get_diet_summary`. |
| `GET /diet/targets/suggestion` **(nova)** | `{ has_suggestion, current: {daily_calories, protein_g, carbs_g, fat_g}, suggested: {...} , warnings, changed }` (`current`/`suggested`/`warnings`/`changed` só quando `has_suggestion`). |
| `POST /diet/targets/suggestion/accept` **(nova)** | Recalcula no servidor (ignora qualquer número vindo do cliente), faz upsert da meta + `basis_json`, retorna o diet summary do dia. 409 se não houver dados suficientes pra calcular. |
| `POST /diet/targets/suggestion/dismiss` **(nova)** | Grava só `basis_json` atual (meta inalterada). Retorna `{ message }`. |
| `PUT /diet/targets` | Continua igual e passa a gravar também o `basis_json` atual (se calculável). |
| `PUT /profile` | Aceita também `fitness_level` (enum dos 3 valores), `goal` (cada item precisa ser um dos 6 objetivos; string `", "`-separada, igual hoje), `weight_kg` (20–300), `height_cm` (inteiro 50–250). Valores fora → 400. Peso/altura diferentes da última medição → nova linha em `user_measurements` (se só um mudou, o outro é copiado da última medição). A resposta inclui `nutrition_suggestion` (mesmo formato do GET de sugestão). |
| `GET /profile` | Passa a retornar `weight_kg`, `height_cm` (última medição) e `age`. |

Todas as rotas novas usam o `authenticateToken` já registrado no plugin de `diet`, e têm schema TypeBox como as existentes.

## Front — torv-frontend

### Compartilhado

- `src/utils/profileOptions.ts`: `FITNESS_LEVELS` (movido de `Register`), `GOAL_OPTIONS` (hoje hardcoded em Register e Profile), `hasGoalConflict(goals: string[])`.
- `src/components/NutritionSuggestionModal/` (`index.tsx` + `styles.ts`): recebe a sugestão; mostra atual → sugerida para kcal, proteína, carbo, gordura; motivo a partir de `changed` (`age` → "Você fez aniversário", `weight_kg` → "Seu peso mudou", `height_cm` → "Sua altura mudou", `goals` → "Seu objetivo mudou", `fitness_level` → "Seu nível físico mudou", `gender` → "Seus dados mudaram"); alerta se `warnings` contiver `GOAL_CONFLICT`. Botões **Aplicar nova meta** (`accept`) e **Manter atual** (`dismiss`); callback `onResolved` pra tela recarregar.

### Register

Etapa "Qual seu objetivo?": quando `hasGoalConflict(goals)`, aviso inline abaixo dos cards: "Perder peso e ganhar massa ao mesmo tempo são metas opostas — recomendamos focar em um objetivo por vez." Não bloqueia o avanço.

### Profile

- **Objetivo** (modal existente): mesmo aviso de conflito dentro do modal. Após salvar, se `nutrition_suggestion.has_suggestion` → abre `NutritionSuggestionModal`.
- **Nível físico** (novo): card mostrando o nível atual + modal com os 3 `SelectCard` (mesmo visual do cadastro). Salvar → `PUT /profile { fitness_level }` → sugestão.
- **Peso e altura** (novo): card com os valores atuais + modal com 2 inputs numéricos (peso aceita decimal; altura inteiro), validação 20–300 / 50–250 no cliente também. Salvar → `PUT /profile { weight_kg, height_cm }` → sugestão.

### MyDiet

Ao focar a tela: `GET /diet/targets/suggestion`. Se `has_suggestion` → banner acima dos cards de macro ("Nova meta sugerida — toque para ver") que abre o `NutritionSuggestionModal`. Aceitar → recarrega o summary; recusar → some o banner. É banner, não modal automático, porque aniversário é uma mudança passiva e não deve interromper o uso. "Editar Metas Diárias" continua como está.

## Testes

- **Unitários da calculadora** (`nutritionCalculator`):
  - exemplo da planilha: M, 80 kg, 175 cm, 30 anos, INTERMEDIÁRIO, Perder Peso + Criar uma Rotina → ajuste médio −225; TMB 1748,75; TDEE 2710,5625; kcal 2485,5625 → 2486
  - conflito do usuário: acima do peso com Perder Peso + Ganhar Massa → ajuste −137,5 e `GOAL_CONFLICT`
  - 65+ usando faixa Lipschitz (ex.: IMC 26 = ideal aos 70, acima aos 40)
  - abaixo do peso + Perder Peso → ajuste 0
  - F (−161), idade que muda no dia do aniversário, sem objetivos → Saúde & Bem-estar, nível nulo → 1.2, dado faltando → `null`
- **Endpoints**: criação da meta quando falta; sugestão com `changed` correto (inclusive `goals` e `fitness_level`); accept ignora payload; dismiss não muda meta; `PUT /profile` rejeita valores inválidos e cria medição nova.
- **Usabilidade** (Review and Tests): fluxo real no emulador Android via portal Maestri "Pixel", com `adb logcat`: cadastro com conflito, troca de objetivo/nível/peso no Perfil → modal → aceitar/recusar, banner no MyDiet.

## Ciclo

Conforme `CLAUDE.md` §5, via recrutas Maestri:

1. **Edit**: Torv Database (migration) → Torv Backend (calculadora + endpoints; fixa o contrato) → Torv Frontend (em paralelo ao backend depois que o contrato acima for fixado).
2. **Test**: Torv Review and Tests no diff completo + usabilidade no emulador; relatório `docs/qa-calorie-calculator-2026-09-24[-roundN].md`.
3. **Security**: Torv Security, só com testes 100% verdes.
4. Sticky note do canvas atualizada a cada transição de etapa.

## Fora do escopo

- Meta de fibra (sem registro de fibra consumida).
- Edição de data de nascimento e sexo no Perfil.
- Atualização automática sem confirmação.
- Gráfico/histórico de peso (os dados ficam guardados em `user_measurements`, mas sem UI nesta feature).
