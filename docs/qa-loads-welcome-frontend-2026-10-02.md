# QA — Carga por série, período, senha e boas-vindas — etapa Frontend — 2026-10-02

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module` · **Escopo:** Task 6 do plano `docs/superpowers/plans/2026-10-02-loads-period-welcome.md` (spec `docs/superpowers/specs/2026-10-02-loads-period-welcome-design.md`).

Commits da etapa: `c40c20f` (API no celular), `2a7cf11` (senha), `45f48f9` (boas-vindas), `7971d90` (estado do treino com cargas), `3e3f43c` (controle de carga), `46e8f61` (resumo e card), `214a50d` (limites do período), `348f2c2` (chips de período), `d351263` (passada de design).

## Ambiente

- **Servidores:** Expo web em `http://localhost:8081` e backend no Furnace. Não subi nem parei nada.
- **`FrontEndTorv/.env`:** vazio (1 byte, só uma quebra de linha) e não editado.
- **Sem ajuste na página:** nenhum shim, nem reescrita de host. O bundle falou direto com `http://127.0.0.1:3000`, e o cadastro, o login e todas as telas funcionaram (ver "API no celular").
- **Portal:** "Torv Mobile #2", em 412×915 e 320×915, fuso `America/Sao_Paulo`, sex 02/10/2026 por volta das 16h.
  - A sessão original do portal foi guardada em outra chave do `localStorage` e restaurada no fim, sem `/auth/logout`. O token nunca saiu do navegador.
  - Os dados de teste (treinos e rotinas) foram criados com `fetch` dentro da página, com o token só em memória.
- **Contas novas** (não usei nenhuma conta antiga):
  - `qa.lwf.u1.1790967079547@torvtest.dev`: criada pela **tela de Cadastro** (os 5 passos). Fica com 34 treinos semeados e 2 rotinas com carga ("QA Cargas A" e "QA Cargas B").
  - `qa.lwf.u2.1790967079547@torvtest.dev`: criada por `POST /auth/register` e usada só para a mensagem de boas-vindas em 320, no 1º acesso.
- **Medidas:** pelo DOM (`getBoundingClientRect`, `scrollWidth`, `getComputedStyle`) e pelas requests do `performance`. **Desvio registrado:**
  - o screenshot do portal só mostrava uma faixa do rodapé da página ou dava timeout;
  - o agent-browser headless não respondeu em 120 s, e eu o fechei (`No active sessions`) sem usar nada dele;
  - por isso o relatório não tem imagens, e as bolinhas da senha foram provadas pela fonte computada, como o plano pede.

## Veredito: PASS (9/9)

Nenhuma falha bloqueante. Há só observações de usabilidade (abaixo), nenhuma delas é regressão.

| Item | Resultado |
|---|---|
| Automatizados | ✅ PASS |
| 1. Boas-vindas | ✅ PASS (412 e 320) |
| 2. Senha | ✅ PASS (412 e 320) |
| 3. Carga no treino | ✅ PASS (412 e 320) |
| 4. Resumo | ✅ PASS (412 e 320) |
| 5. Histórico | ✅ PASS (412 e 320) |
| 6. Resumo antigo | ✅ PASS, com ressalva: não havia treino real anterior a `57d5834` (ver o item) |
| 7. Console | ✅ PASS |
| API no celular | ✅ PASS |

## Automatizados

| Item | Resultado |
|---|---|
| `FrontEndTorv: npx tsc --noEmit` | ✅ exit 0 |
| `FrontEndTorv: node --test "src/**/*.test.mjs"` | ✅ **32/32** |

## 1. Boas-vindas

| Item | 412 | 320 |
|---|---|---|
| Aparece no 1º acesso, com o **primeiro nome** | ✅ Conta U1, logo depois do cadastro: "Bem-vindo(a) ao Torv, **Marina**!" (cadastro como "Marina Teste Silva"), com os 3 pontos e "Começar" | ✅ Conta U2, 1º login: "Bem-vindo(a) ao Torv, **Rafael**!" |
| Geometria | ✅ Caixa em x 24–388, botão 316 × 50, sem overflow (`scrollWidth` 412) | ✅ x 24–296 (272 de largura) e 554 de altura, botão 224 × 50, sem overflow |
| "Começar" fecha | ✅ | ✅ |
| **Recarregar** a página | ✅ não volta, esperei 5 s | ✅ não volta |
| **Logout e login** | ✅ não volta, esperei 9 s | ✅ não volta |

## 2. Senha

A bolinha é a do sistema quando a fonte computada do input mascarado é a pilha do sistema, e não a Sora.

| Tela e estado | `type` | `font-family` computada | 412 | 320 |
|---|---|---|---|---|
| Login, senha oculta com texto | `password` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto…` | ✅ | ✅ |
| Cadastro, "Sua senha" e "Confirme a senha" ocultas | `password` | pilha do sistema | ✅ | ✅ |
| **Olho** aberto (Login e Cadastro) | `text` | **`Sora_400Regular`** | ✅ | ✅ |
| Olho fechado de novo | `password` | pilha do sistema | ✅ | — |
| Campo de senha **vazio** (placeholder) | `password` | `Sora_400Regular` | ✅ | — |
| E-mail | `email` | `Sora_400Regular` (não mudou) | ✅ | ✅ |

Os campos de senha têm 272 px de largura em 320, sem overflow.

## 3. Carga no treino

Rotina "QA Cargas A": exercício 1 com 3 séries (20, 20, sem carga) e exercício 2 com 2 séries (10, 10).

| Item | Resultado |
|---|---|
| Mostra a carga da rotina ao abrir | ✅ "20 kg" |
| **−/+** | ✅ 20 → 17,5 → 15 → 17,5 → 20 → 22,5, sempre com vírgula |
| **De 2,5 vai para "Sem carga" e volta** | ✅ Desci de 22,5 até 2,5 com 8 toques no "−" (mostrava "2,5 kg"). O 9º toque deu "**Sem carga**", com o "−" desabilitado. O "+" voltou a "**2,5 kg**" |
| Digitar **"7,5"** | ✅ vira "7,5 kg" |
| Digitar **"7,"** | ✅ é ignorado: depois do Enter continua "7,5 kg" |
| Digitar **"1000"** | ✅ vira "**999,99 kg**", com o "+" desabilitado |
| **Apagar** | ✅ "Sem carga" |
| Texto inválido ("abc", "12.345") | ✅ não muda a carga |
| **"Terminei a série" com o campo aberto** | ✅ Digitei "30" sem sair do campo e toquei em "Terminei a série": o rascunho gravou a série 1 com **30** |
| Série seguinte | ✅ mostra "20 kg", a carga da rotina, e não a ajustada. **Esperado**, por decisão do usuário. Na série 3, "Sem carga" |
| Rotina padrão sem carga ("Dia 1") | ✅ "Sem carga" |
| **Sair e "Continuar treino"** | ✅ Ajustei a série 2 para 22,5, saí pelo X e toquei em "Continuar": volta na série 2 com "22,5 kg", e o rascunho tem `[30, 22.5, null]` e `planned_weights` intacto |
| 320 | ✅ "−" 44×44, valor 122×44, "+" 44×44, `scrollWidth` 320. O texto mais largo, "999,99 kg", ocupa 98 px dos 122 e não corta. No 320 também conferi o digitar com "Terminei a série" com o campo aberto (35) e a carga da série seguinte |

## 4. Resumo

Treino de "QA Cargas A" com as séries 30, 22,5, sem carga, 10 e 12,5:

| Item | Resultado |
|---|---|
| Carga em cada série | ✅ "30 kg", "22,5 kg", "10 kg", "12,5 kg". A série sem carga não mostra texto |
| **O card lista as diferenças** | ✅ "Cargas diferentes da rotina" com 3 linhas: "Abdominal crunch (solo) · série 1: 20 kg → 30 kg", "… série 2: 20 kg → 22,5 kg" e "Abdominal na polia (ajoelhado) · série 2: 10 kg → 12,5 kg". A série 3, de "Sem carga" para "Sem carga", não aparece |
| **"Atualizar rotina"** | ✅ "Rotina atualizada" |
| **Editor da rotina depois do PATCH** | ✅ No `RoutineEditor`, "Carga da série" 1, 2 e 3 do exercício 1 = `30`, `22,5` e vazio, e as do exercício 2 = `10` e `12,5` |
| **Outro treino: "Manter"** | ✅ O card some, e a rotina "QA Cargas B" continua `[[20,20,null],[10,10]]` (conferido pela API da página) |
| **Treino sem mudança** ("Dia 1", 1 série sem mexer na carga) | ✅ sem card e sem texto de carga |
| Extra: rotina editada no meio do treino | ✅ Com o PUT invertendo os exercícios depois de acabar o treino, "Atualizar rotina" mostra "**A rotina mudou e as cargas não foram aplicadas.**" |
| 320 | ✅ Card com 1 linha, botões 246 × 50 (x 37–283), `scrollWidth` 320. "Rotina atualizada" e o editor com `35`, `22,5` e vazio |

## 5. Histórico

Conta U1, com 34 treinos semeados (3 dos últimos 6 dias, 28 de 8 a 89 dias atrás e 3 mais antigos, de 95, 130 e 200 dias) mais os que fiz no teste, 4 deles hoje na hora de medir os períodos.

| Item | Resultado |
|---|---|
| **As duas linhas de chips** | ✅ Linha de tipo (Todos, Musculação) e linha de período (Tudo, 7 dias, 30 dias, 3 meses, Personalizado), todos com 44 px de altura e `aria-selected` acompanhando |
| **7 dias** | ✅ `from=2026-09-26T03:00:00Z` (hoje − 6 dias, 00:00 local) → **7** treinos (4 de hoje e 3 de 2, 4 e 6 dias atrás). O de 8 dias fica de fora |
| **30 dias** | ✅ `from=2026-09-03T03:00:00Z` → **15** treinos, o último em 03/09 |
| **3 meses** | ✅ `from=2026-07-02T03:00:00Z` → 1ª página de 20 |
| **Tudo** | ✅ sem `from` → 20 na 1ª página, mais os mais antigos |
| **Personalizado 09/09–18/09** | ✅ O chip vira "**09/09 – 18/09**" e a request leva `from=…09-09T03:00Z&before=…09-19T03:00Z` (o fim é inclusivo). Voltam **4** treinos: 18, 15, 12 e 09/09 |
| **Cancelar no 1º passo** | ✅ mantém o filtro (3 meses), sem nenhuma request nova |
| **Cancelar no 2º passo** ("Até quando?") | ✅ mantém o filtro, sem nenhuma request nova. Nesse passo os dias antes do início vêm desabilitados |
| **Período sem treino** (10/09–11/09) | ✅ "**Nenhum treino nesse período**" e **sem** o botão "Ver meus treinos" |
| **Tipo + período juntos** | ✅ Musculação + 10/09–11/09 → `type=STRENGTH&from=…&before=…`, vazio. Musculação + 30 dias → `type=STRENGTH&from=2026-09-03…`, 15 treinos. Voltar para Todos + 30 dias → 15 treinos |
| **Rolar até paginar dentro do período** | ✅ Em "3 meses": 2ª request `from=2026-07-02T03:00:00Z&limit=20&before=2026-08-19T15:00:00Z`, mesmo `from` e `before` = cursor. Total **35** treinos, o último em 05/07, sem nada anterior a 02/07 (os de 95, 130 e 200 dias não entram) |
| **Abrir um treino e voltar mantém a posição** | ✅ Com "3 meses" e a 2ª página carregada, abri o item 22 (`scrollTop` 2386, item a 504 px do topo) e voltei pela seta: os mesmos 2386 / 504, 35 itens, mesmo chip selecionado, sem spinner |
| 320 | ✅ Os 5 períodos, a paginação (35), o Personalizado com cancelar nos 2 passos (0 requests novas), o período vazio e Musculação + 7 dias (`type=STRENGTH&from=2026-09-26…`, 7 treinos), tudo igual ao 412. `scrollWidth` 320 |

## 6. Resumo antigo

- **Não havia um treino real gravado antes de `57d5834` ao meu alcance:** as contas de teste anteriores não têm senha guardada, e a conta do portal não é minha para abrir. Por isso o treino real antigo **não foi verificado**.
- **O que fiz no lugar:** semeei o treino de 28/09 pela API **sem o campo `weight_kg`**. É o mesmo estado gravado no banco (`NULL`) de um treino anterior à mudança. Abri esse treino pelo Histórico.
- **Resultado:** ✅ o resumo mostra "Treino livre", os tempos e as séries, **sem nenhum texto de carga** (a página não tem a string "kg"), sem o card e sem erro. A seta de voltar funciona.
- **Cobertura do código:** o teste unitário de `summaryFromDetail` (`workoutSession.test.mjs`, 32/32 verdes) cobre o `weight_kg` nulo.

## 7. Console

| Janela | Resultado |
|---|---|
| 320: login da U2, boas-vindas, recarregar, logout e login | ✅ só `props.pointerEvents is deprecated. Use style.pointerEvents`, que já existia |
| 412: login da U1, Histórico (5 períodos, Personalizado, abrir e voltar), treino, resumo e "Atualizar rotina" | ✅ nenhum erro nem aviso novo |
| 320: Histórico, treino, resumo e editor | ✅ nenhum erro |

Reiniciei a captura (`logs-start`) depois de cada navegação ou recarga, que descartam o buffer.

## API no celular

| Item | Resultado |
|---|---|
| `curl -H "expo-platform: android" -H "accept: application/expo+json,application/json" http://192.168.15.179:8081/` | ✅ `extra.expoClient.hostUri` = **`192.168.15.179:8081`** |
| O mesmo com o outro IP do PC (`192.168.137.1`) | ✅ `hostUri` = `192.168.137.1:8081` |
| O mesmo com `localhost` | ✅ `hostUri` = `127.0.0.1:8081` |
| Backend alcançável pelo IP da rede | ✅ `POST http://192.168.15.179:3000/auth/login` com corpo vazio → 400 (quem responde é a API) |
| **No web, a API é chamada** | ✅ Todas as requests foram para **`http://127.0.0.1:3000`**: no web não há `hostUri`, então vale o fallback `127.0.0.1` do `api.ts`. O cadastro pela tela, o login e todas as telas funcionaram **sem nenhum ajuste na página** |
| `FrontEndTorv/.env` | ✅ continua vazio |

A prova final no Expo Go, com o celular na rede, é do usuário (o plano já diz isso): daqui só dá para provar o manifest e que a API responde no IP da rede.

## Observações

- **INFO (usabilidade):** a linha de chips de período é um `ScrollView` horizontal sem indicador.
  - **412:** "Personalizado" ocupa x 330–450, e a tela tem 412, então aparece cortado.
  - **320:** ele fica **fora da tela** (330–449) e "3 meses" já aparece cortado em 2 px.
  - **Consequência:** quem não rolar a linha pode não achar "Personalizado". Se isso incomodar, as saídas são encurtar os rótulos ou deixar a linha quebrar. Não é regressão do commit, é o desenho da linha.
- **INFO:** ao reabrir o Personalizado, o seletor já vem no mês e no dia do período atual. Se a pessoa só confirmar, o período vira um único dia (testei: 09/09–18/09 virou 09/09 – 09/09).
- **INFO (componente existente):** as células do `DatePickerModal` têm 38 px em 412 e 33 px em 320, abaixo dos 44 px dos chips. É um componente que já existia, e este commit só o reaproveita.
- **INFO:** no web, o campo da carga digitada mostra "7," enquanto a carga continua 7,5, até a pessoa sair do campo. É o desenho (texto inválido não muda a carga).
- **INFO do portal (não é do app):**
  - o toque do portal no valor da carga fechava o campo na hora, e o campo abriu com `click()` via JS;
  - disparei a sequência completa de eventos de ponteiro (`pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click`) e o campo ficou aberto, então o app não fecha sozinho;
  - o que sobrou é a janela do portal sem foco do sistema.
- **INFO (já existia, fora do diff):** a Home de uma conta recém-criada mostra "Streak 12 dias seguidos" e um feed com dados fixos de exemplo.
- **Sem backfill, como na spec:** depois de restaurar a sessão original, o portal abriu a Home da conta do usuário, e essa conta **mostrou a mensagem de boas-vindas** (`welcome_pending: true`). Eu não toquei no "Começar", então ela aparece até a pessoa fechar.
- **Não coberto:** o estado de erro do "Atualizar rotina" ("Não foi possível atualizar." + "Tentar de novo"). Sem um jeito de falhar o PATCH sem mexer na página, e o item não está na lista da Task 6.
- **Treino já concluído:** ao iniciar uma rotina feita nos últimos 7 dias, aparece o modal "Treino já concluído" (já existia). Usei "Treinar mesmo assim" nos testes.
- **Dados de teste:** as contas `qa.lwf.u1.1790967079547@torvtest.dev` e `qa.lwf.u2.1790967079547@torvtest.dev` continuam no banco, porque não existe endpoint para apagar conta. Portal: restaurado para a sessão original, na Home, em 412×906.
