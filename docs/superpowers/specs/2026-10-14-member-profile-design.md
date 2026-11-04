# Perfil de membro, streak unificado e calendário de atividade — Design

**Data:** 2026-10-14 · **Branch:** `feat/perfil-terceiros-gpx` · **Base:** `activities` (módulo de treinos), grupos e ranking (`group_members`, `group_rankings`). Primeiro de dois subprojetos; o segundo é o importador de GPX (`2026-10-14-gpx-import-design.md`).

## Objetivo

1. No grupo, tocar num membro abre o **perfil dele**: nome, foto, nível físico, streak, atividades do mês, um **calendário de dias ativos** no estilo do GitHub e o histórico de atividades.
2. O **streak** passa a ter uma conta só, que vale para a Home, o Perfil próprio e o perfil dos outros e conta qualquer tipo de atividade. Hoje são duas contas que divergem:
   - a Home calcula na hora, só com musculação e no fuso local;
   - o Perfil lê `user_streaks`, preenchida por um trigger em UTC que não recalcula quando um treino é apagado.
3. O Perfil próprio ganha o mesmo calendário e o mesmo card do mês. O "+0 vs mês passado", que hoje é fixo no código, vira o número real.

## Decisões (do brainstorm com o usuário)

| Tema | Decisão |
|---|---|
| Quem vê | O próprio usuário, ou quem é **membro de pelo menos um grupo em comum** com ele agora. Qualquer outro caso, inclusive usuário inexistente, recebe **404**. |
| Entradas | Linha do ranking (`GroupDetail`) e lista de membros (`GroupManage`). Tocar na própria linha abre a mesma tela. |
| O que mostra | Foto, nome, @username, nível físico, streak atual e recorde, card do mês, calendário de 12 meses e histórico com rolagem infinita. |
| O que nunca mostra | E-mail, peso, altura, idade, gênero, objetivo e data de nascimento. Quando o GPX existir, também rota, FC, cadência e calorias. |
| Streak | Dias locais **seguidos** com pelo menos 1 atividade de **qualquer tipo**. Fica vivo se houve atividade hoje ou ontem. O recorde é a maior sequência de toda a história. |
| Fuso | Dia local = `start_time` em UTC + `tz_offset_min` enviado pelo app **de quem está vendo**, como a Home já faz. |
| Card do mês | Mês corrente local, do dia 1 até hoje. Mostra os dois números: `active_days` (dias distintos, mesma régua do ranking) e `activities` (contagem). |
| "vs mês passado" | `active_days` deste mês até hoje − `active_days` do mês anterior **do dia 1 até o mesmo dia** (limitado ao último dia do mês anterior). Exemplo: em 31/03 compara 01–31/03 com 01–28/02 (29/02 em ano bissexto). |
| Calendário | 53 colunas (semanas de domingo a sábado, como o `DatePickerModal`), terminando na semana de hoje. Dias depois de hoje ficam sem quadrado. A cor segue o número de atividades do dia: 0, 1, 2, 3 ou mais (4 níveis). Tocar num dia mostra "12 de out. · 2 atividades". Rolagem horizontal que abre no fim (semana atual), **sem** seletor de ano. |
| Histórico do membro | Lista com resumo, igual ao item do Histórico próprio (tipo, título, data e hora, duração, séries; distância quando o GPX existir). **Não abre detalhe.** Páginas de 20, cursor `before`. |
| Perfil próprio | Streak e recorde, card do mês e calendário vêm do endpoint novo. "Atividade Física" lista os 5 últimos de **qualquer tipo**. O número "treinos" da linha de stats passa a ser o total de atividades. |
| `GET /profile` | Perde `streak`, `longest_streak`, `workouts_in_month` e `total_workouts`. Também saem a leitura de `user_streaks` e as duas contagens, que não têm mais quem as use. |
| `user_streaks` e trigger | Ficam no banco, sem uso. Nada é apagado; a limpeza fica como pendência no `revisar5.md`. |

## Banco de dados

**Sem migration.** O índice `activities (user_id, start_time)` já cobre as consultas novas.

## Backend

Padrão atual: `routes → controller → repository`, TypeBox, JWT em todas as rotas e `userId` sempre do token. Resposta negada é **404**, nunca 403.

### Rotas novas — `users.routes.js`, `prefix: '/users'`

| Rota | Quem | Efeito |
|---|---|---|
| `GET /users/:id/profile?date=&tz_offset_min=` | o próprio ou membro de grupo em comum | Cabeçalho, streak, mês, total e calendário (contrato abaixo) |
| `GET /users/:id/activities?before=&limit=` | idem | Mesma página do `GET /activities`, sem os filtros `type` e `from` |

- `date`: dia local de quem vê, `YYYY-MM-DD`, validado como data real de calendário (mesma checagem de ida e volta do `/activities/summary`).
- `tz_offset_min`: inteiro de −840 a 840.
- `id`: o `Uuid` estrito de `workout.schemas.js`.
- `limit`: de 1 a 50, padrão 20. `before`: `date-time`.

**Contrato de `GET /users/:id/profile` (200):**

```json
{
  "user": { "id": "uuid", "name": "Ana", "username": "ana", "photo_url": "https://...", "fitness_level": "INTERMEDIÁRIO" },
  "is_me": false,
  "streak": { "current": 3, "longest": 12 },
  "month": { "active_days": 9, "activities": 11, "active_days_delta": 2 },
  "total_activities": 57,
  "calendar": {
    "start": "2025-10-12",
    "end": "2026-10-14",
    "days": [{ "date": "2026-10-12", "count": 2 }]
  }
}
```

- `photo_url` e `fitness_level` podem ser `null`. `photo_url` sai absoluta, com a mesma conversão (`images.publicUrl`) do ranking.
- `calendar.days` traz só os dias com atividade dentro de `[start, end]`, em ordem crescente.
  - `start` = domingo da semana de `date` − 52 semanas;
  - `end` = `date`.
- `total_activities` conta todas as atividades com dia local até `date`.
- O schema de resposta é uma lista branca: o Fastify descarta qualquer campo fora dele (defesa extra contra vazamento).

**Item de atividade** (vale para `GET /activities` e para `GET /users/:id/activities`): ganha `distance_m: number | null`, que vem de `activities.distance_m`. Na musculação é `null`; o GPX preenche.

### Regras e cálculo

- **Acesso** (`users.repository.sharesGroup(viewerId, targetId)`): existe `group_members` do alvo num grupo em que o viewer também é membro.
  - `viewerId === targetId` sempre pode, mesmo sem grupo.
  - Alvo sem `user_profiles` → 404.
- **Dias com contagem** (`activities.repository.dayCounts(userId, { before, tzOffsetMin })`): uma única consulta devolve `[{ day: 'YYYY-MM-DD', count }]` em ordem crescente, só com as atividades que têm `start_time < before`. `before` é a meia-noite **seguinte** ao dia local `date`, convertida para UTC, para que nada datado no futuro entre na conta.

  ```sql
  SELECT to_char((start_time AT TIME ZONE 'UTC') + make_interval(mins => ${tz}::int), 'YYYY-MM-DD') AS day,
         COUNT(*)::int AS count
  FROM activities
  WHERE user_id = ${userId}::uuid AND start_time IS NOT NULL AND start_time < ${before}::timestamptz
  GROUP BY 1 ORDER BY 1
  ```

  Sem `LIMIT`. O `strengthDays` atual (LIMIT 1000, só `STRENGTH`) sai.
- **Funções puras** (`lib/activityStats.js`), sobre strings `YYYY-MM-DD`:
  - `currentStreak(days, today)`: o `streakFrom` atual, movido do controller.
  - `longestStreak(days)`: a maior sequência de dias consecutivos.
  - `monthSummary(dayCounts, today)` → `{ active_days, activities, active_days_delta }`.
  - `calendarWindow(today)` → `{ start, end }`.
  - `totalActivities(dayCounts)`.
- **Home** (`GET /activities/summary`): o streak passa a usar `dayCounts`, com qualquer tipo de atividade. O contrato não muda (`streak_days`, `calories_burned`); só a descrição do Swagger.
- **`GET /profile`:** saem os 4 campos e as consultas que os alimentavam (`user_streaks` e as duas contagens de `STRENGTH`).

## Frontend

O `FrontEndTorv/AGENTS.md` exige ler a doc versionada do Expo antes de codar. Telas novas passam por `/frontend-design`. Toda a UI segue estas regras:
- texto em pt-BR;
- alvo de toque de 44 px, exceto os quadrados do calendário (abaixo);
- nada cortado em 320 px;
- confirmações só no `ConfirmModal`.

### Navegação

`AppStackParamList.MemberProfile: { userId: string }`, empilhada como as outras telas.

### Peças

| Peça | O quê |
|---|---|
| `services/users.ts` | `usersApi.profile(id, { date, tz_offset_min })` e `usersApi.activities(id, { before, limit })`, com os tipos do contrato. `ActivityItem` (em `services/activities.ts`) ganha `distance_m: number \| null`. |
| `utils/heatmap.ts` + `heatmap.test.mjs` | `buildHeatmap(start, end, days)` devolve 53 semanas × 7 dias (célula `{ date, count, level }`, ou `null` depois de `end`) e os rótulos de mês com a coluna em que cada mês começa. `heatLevel(count)` dá 0, 1, 2 ou 3. |
| `utils/profileStats.ts` + teste | `deltaLabel(n)`: "+2 vs mês passado", "−1 vs mês passado" ou "Igual ao mês passado". |
| `components/ActivityHeatmap` | Grade com rolagem horizontal que abre na semana atual; meses no topo; "Seg", "Qua" e "Sex" nas linhas 1, 3 e 5, como no GitHub (fixos à esquerda, fora da rolagem); legenda "Menos ■■■■ Mais". |
| `screens/MemberProfile` | Cabeçalho com voltar, foto, nome, @username e nível físico; cards de **Streak** (atual e "Recorde: N dias") e **Este mês** ("N dias ativos", "M atividades" e o delta); **Calendário**; **Histórico** com rolagem infinita, itens sem toque. Estados: carregando; "Perfil indisponível" (404); erro com "Tentar de novo". Puxar para atualizar. |
| `GroupDetail` | Cada linha do ranking vira botão: `accessibilityLabel` "Ver perfil de <nome>", navega para `MemberProfile`. |
| `GroupManage` | Nome e foto do membro abrem `MemberProfile`. O botão de remover fica **irmão**, não dentro, porque botão dentro de botão quebra no web. |
| `Profile` | Busca `usersApi.profile(user.id, ...)` junto com o que já carrega. Streak e recorde, "Este mês" com o delta real e uma seção **Calendário** nova. "Atividade Física" chama `activitiesApi.list({ limit: 5 })` sem filtro de tipo, e só musculação abre o `WorkoutSummary`. O número "treinos" passa a ser `total_activities`. |

**Detalhes do calendário:**
- **Quadrados:** ~12 px, com 3 px de espaço.
- **Cores**, por nível:

  | Nível | Atividades no dia | Cor |
  |---|---|---|
  | 0 | nenhuma | `surfaceAlt` |
  | 1 | 1 | verde escuro, derivado da marca |
  | 2 | 2 | `brandDark` |
  | 3 | 3 ou mais | `brand` |

- **Toque:** os quadrados ficam abaixo de 44 px, e esta é a única exceção aceita. Por isso o toque é tratado na grade inteira, que descobre a célula pela posição, e não com 371 botões. O texto do dia escolhido aparece numa linha fixa abaixo da grade.
- **Leitor de tela:** a grade expõe um resumo: "N dias ativos nos últimos 12 meses".

## Segurança

- **IDOR:**
  - `userId` sempre vem do token;
  - o acesso exige grupo em comum;
  - a negação é 404, igual para usuário inexistente, para não permitir enumeração.
- **Minimização:**
  - o schema de resposta é lista branca;
  - nenhum dado de saúde, contato ou corpo vai para os outros membros.
- **Entrada:** `date`, `tz_offset_min`, `before` e `limit` têm faixas, e o `id` usa o padrão estrito de UUID.
- **SQL:** só `Prisma.sql` ou template parametrizado, e nenhum identificador vem do cliente.

## Testes

- **Backend**, no padrão do repositório (`node:test`, repositórios mockados nas rotas e Prisma falso nos repositórios):
  - `activityStats`:
    - streak vivo hoje, vivo ontem, quebrado, vazio, virada de mês e de ano;
    - recorde;
    - delta em 31/03 (fevereiro de 28 e de 29 dias) e no dia 1;
    - janela do calendário quando hoje é domingo, quarta e sábado.
  - `users.routes`:
    - 200 para o próprio usuário e para membro de grupo em comum;
    - 404 sem grupo em comum e para usuário inexistente;
    - 400 com data inválida e com `tz` fora da faixa;
    - resposta sem campos extras;
    - paginação com `next_before`.
  - `activities.routes`: o summary conta qualquer tipo.
  - `profile.routes`: os 4 campos saíram.
  - Repositórios: os parâmetros do `dayCounts` e o `sharesGroup`.
- **Frontend:** `heatmap.test.mjs`, teste do `deltaLabel` e `tsc`.
- **Usabilidade no Expo web**, com duas contas no mesmo grupo:
  - abrir o perfil pelo ranking e pelo Gerenciar;
  - conferir os números contra o banco;
  - calendário: rolagem e toque no dia;
  - histórico com rolagem;
  - a própria linha abre o perfil;
  - "Perfil indisponível" depois que o outro sai do grupo;
  - Perfil próprio: calendário e delta;
  - a Home conta o mesmo streak;
  - layout em 320 px.

## Fora do escopo

Seguir/seguidores, perfil público fora de grupos, seletor de ano no calendário, detalhe da atividade de outra pessoa, apagar `user_streaks` e o trigger antigo.
