# QA — Importador de GPX, fechamento (round 5) — 2026-10-14

**Owner:** Torv Review and Tests · **Branch:** `feat/perfil-terceiros-gpx` · **Testado:** `11d613f` (tirou a linha 24 do relatório do round 3, o M1 do round 4) e `719b503` (o teste do F1b agora usa 5 MB e limite de 500 ms, o L1 do round 4) · **Round anterior:** `docs/qa-gpx-import-frontend-2026-10-14-round4.md` · **Sem navegador, sem contas, sem banco.** Este relatório não traz nenhuma coordenada: só contagens, arquivo e linha.

## Veredito: PASS (0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 1 INFO) → M1 e L1 fechados; pode voltar ao Security

## (1) Automatizados no HEAD (`719b503`)

| Suíte | Resultado |
|---|---|
| `BackEndTorv: npm test` | **310/310**, 0 fail, 0 cancelled, 0 skipped (igual ao round 3) |
| `FrontEndTorv: node --test src/utils/*.test.mjs` | **76/76**, 0 fail, 0 cancelled, 0 skipped (igual ao round 4) |
| `FrontEndTorv: npx tsc --noEmit` | **limpo** |

## (2) O teste novo do F1b pega o parser antigo e passa no atual

Teste: `parseGpx: ~5 MB de <trkpt> curto repetido, sem fechar, termina em tempo linear (security F1b)` (`'<trkpt>'` repetido até ~5 MB, limite de 500 ms). Rodei o **mesmo** `gpx.test.mjs` do HEAD, 5 vezes com cada parser, em pastas fora do repositório: uma com o `gpx.ts` de `bbf8b8e` (cópia via `git show`) e uma com o `gpx.ts` do HEAD, ambas com a fixture `run-sample.gpx`. Tempo é o do teste inteiro (monta a string de 5 MB e chama o parser).

| Execução | `gpx.ts` de `bbf8b8e` | `gpx.ts` do HEAD (`cfd7f90`) |
|---|---|---|
| 1 | **FAIL**, 2.099 ms | PASS, 9,0 ms |
| 2 | **FAIL**, 2.003 ms | PASS, 8,9 ms |
| 3 | **FAIL**, 1.985 ms | PASS, 9,3 ms |
| 4 | **FAIL**, 1.859 ms | PASS, 9,9 ms |
| 5 | **FAIL**, 1.912 ms | PASS, 10,1 ms |

Com `bbf8b8e` o teste falha em 5 de 5, com 1,86–2,10 s (3,7× o limite de 500 ms); no HEAD passa em 5 de 5, com 9–10 ms (50× abaixo do limite). A folga nos dois lados é grande: o teste distingue o parser quadrático do linear mesmo numa máquina de CI uns 3× mais lenta (o antigo ficaria em 5 s ou mais; o atual, em dezenas de ms). O L1 do round 4 (teste de 1 MB que passava no antigo, ~350 ms contra 1.000 ms) está fechado.

## (3) `git grep` no HEAD: coordenada real, deslocamento antigo e nome da cidade

Referência: o `.gpx` da raiz (`/*.gpx` no `.gitignore`, **não versionado**, 2.875 pontos) para a coordenada real, e a fixture antiga de `65331c9^` (o real deslocado por uma constante) para o deslocamento antigo. `git grep -n -I -F -f` no **HEAD inteiro** (todos os arquivos versionados), com arquivos de padrões gerados fora do repositório. Cada valor foi procurado **sem sinal** (cobre o `-` e o sinal tipográfico `−`), com **ponto** e com **vírgula** decimal. Saída só com contagens.

| Busca | Valores distintos | Linhas no HEAD |
|---|---|---|
| Real, 5 casas | 2.378 | **0** |
| Real, 4 casas | 318 | **0** |
| Real, 3 casas | 34 | **0** |
| Deslocamento antigo (fixture de `65331c9^`), 5 casas | 2.389 | **0** |
| Deslocamento antigo, 4 casas | 318 | **0** |
| Deslocamento antigo, 3 casas | 34 | **0** |
| **Valor da constante do deslocamento** (lat e lon), 3 a 6 casas (a constante foi confirmada nos 200 primeiros pontos) | 8 | **0** |
| Nome da cidade (com e sem acento, qualquer caixa) | 6 variantes | 3 linhas, **todas falsos positivos** (ver abaixo) |
| (controle) fixture sintética atual, 5 casas | 2.511 | 119 linhas em 3 arquivos: as duas fixtures (`run-sample.json`, `run-sample.gpx`) e 1 linha do plano |

As 3 linhas do nome da cidade são referências de **fuso horário**, não o local do treino: um comentário em `BackEndTorv/src/lib/nutritionCalculator.js:27` ("aniversário vira às 21h de <nome da cidade, omitido>"), a cópia dele em `docs/superpowers/plans/2026-09-24-calorie-macro-calculator.md:273` e uma frase em `docs/qa-retroactive-date-filter-2026-09-18.md:21` ("horário de <nome da cidade, omitido> (UTC-3)"). São de setembro, anteriores ao importador. Resultado: **0 ocorrências reais e 0 do deslocamento antigo**; a linha que o round 4 apontou (`docs/qa-gpx-import-frontend-2026-10-14-round3.md:24`) foi removida no `11d613f` e as buscas com vírgula e sem sinal, que eram as que a pegavam, agora dão 0. O histórico ainda guarda a versão antiga (sem reescrever histórico, como combinado).

## Achados

| # | Sev | Camada | Achado |
|---|---|---|---|
| I1 | INFO | Cobertura | A varredura procura o que os arquivos versionados contêm hoje: ela não cobre o **histórico** do git (a linha antiga continua em `a3116d2` e nos commits das fixtures anteriores a `65331c9`) nem texto que descreva o local sem usar coordenada ou o nome da cidade. Segue como o Security já registrou (F2b sem reescrever histórico). |

## Dados de teste e limpeza

Sem contas, sem banco, sem navegador, sem servidores. Criei só arquivos temporários no scratchpad (cópias do `gpx.ts` e do teste, a fixture antiga extraída do git e os arquivos de padrões), todos fora do repositório e apagados no fim; o `.gpx` da raiz só foi lido. `git status` do repositório: só o `BackEndTorv/package-lock.json` que já estava modificado antes (não incluído no commit).
