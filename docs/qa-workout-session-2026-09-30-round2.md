# QA — Módulo de treinos, entrega 2 (execução do treino) — round 2 — 2026-09-30

**Owner:** Torv Review and Tests (Loupe) · **Round anterior:** `docs/qa-workout-session-2026-09-30.md` (FAIL: F1 `<button>` dentro de `<button>` na aba Treinos) · **Rework:** frontend `d6bdbc1` (Workouts, WorkoutSession, WorkoutSummary, Profile).

**Escopo:** só o que mudou + regressão nos arquivos tocados. Os demais itens do round 1 (contrato, RF3/RF4/RF5, IDOR, limites) não foram refeitos; o backend não mudou.

## Veredito: PASS (100% verde) → pode seguir para Security (Task 15)

| # | Checagem | Resultado |
|---|---|---|
| 1 | `BackEndTorv: npm test` | ✅ 80/80 |
| 1 | `FrontEndTorv: node --test src/utils/*.test.mjs` / `npx tsc --noEmit` | ✅ 14/14 / sem erros |
| 2 | Aba Treinos sem botão aninhado | ✅ `[role=button] [role=button]` e `button button` = 0, em 412 e 320 |
| 2 | Layout card + ▶ | ✅ 412: "Editar" 21–327, ▶ 327–375; 320: "Editar" 21–235, ▶ 235–283; `scrollWidth` = viewport |
| 2 | Toque real (coordenada) no card → editor; no ▶ → só a sessão | ✅ 412 e 320: card → `RoutineEditor`; ▶ → `WorkoutSession`; sair da sessão volta para Treinos (sem editor empilhado) |
| 2 | Com rascunho: ▶ escondido e banner funcionando | ✅ ▶ some (o card "Editar" ocupa 21–391 / 21–299, com chevron); banner "Treino em andamento / QA R2 Sessão / Continuar / Descartar" (320: 40–157 / 165–283). Continuar → sessão; Descartar → confirmação → rascunho apagado, ▶ volta (4) |
| 3 | Pular série + Próximo exercício até o fim **sem série** | ✅ abre "Descartar treino? Nenhuma série foi feita…"; **Cancelar** → continua na sessão (no último exercício, botão acessível por `elementFromPoint`); de novo → **Descartar** → volta para Treinos, **nenhum POST** (log de XHR vazio), sessões 6→6, rascunho apagado |
| 3 | 1 série feita, depois Próximo exercício até o fim | ✅ vai para o resumo, `POST /workouts/sessions` → 201, 1 série; sessões 6→7 |
| 4 | Singulares | ✅ "A seguir: Abdominal na polia (ajoelhado) · 1 série"; Perfil "30/09 · 1 min · 1 série"; plural mantido ("6 exercícios · 18 séries", "2 exercícios · 3 séries") |
| 5 | Selo "Treino concluído" | ✅ `saved` → aparece; `retry` (hook de rede) → não aparece, "Tentar de novo" visível; `invalid` (hook troca o corpo por `{}` → 400 real) → não aparece, "Não foi possível salvar este treino." + Descartar; Descartar → rascunho apagado, sessões continuam 7 |
| 6 | Console durante todos os fluxos | ✅ nenhum `[error]` (o erro de `<button>` aninhado do round 1 sumiu) |

## Revisão do diff `d6bdbc1`

- O guard `next.phase === 'done' && next.sets.length === 0` em `WorkoutSession/index.tsx:68` roda antes de `setState`/`saveDraft`. O rascunho fica no último estado válido e o "Cancelar" mantém o treino. A máquina de estados pura (`workoutSession.ts`) não mudou, então os testes `.mjs` continuam valendo.
- `Workouts/index.tsx`: card e ▶ são irmãos dentro do `Card`. Sem rascunho, o ▶ aparece; com rascunho, aparece o chevron no card. É o mesmo comportamento do round 1, sem aninhamento.
- `WorkoutSummary/index.tsx:89`: o selo só aparece com `status === 'saved'`, e o histórico também não mostra selo (igual ao round 1).

## Checagens feitas só no navegador

Itens 2 a 6. A ausência de POST no item 3 e os estados `retry`/`invalid` do item 5 foram comprovados com hooks de XHR **só na página** (o servidor não foi alterado nem parado). As contagens de sessão vieram de `GET /workouts/sessions` via `fetch` na página. O `screenshot` do portal não renderiza com a janela minimizada, então o layout foi conferido por medição de DOM.

## Dados de teste

Conta `qa.workout.SC.1790813845583@torvtest.dev`. A rotina "QA R2 Sessão" foi criada e apagada. A sessão salva no item 3 continua no banco (não há endpoint de exclusão), só nessa conta de teste. Os rascunhos foram limpos e a sessão original do portal foi restaurada.
