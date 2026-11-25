# QA rodada 2 — alerta de domínio de e-mail (2026-11-25)

Escopo: diff 2157a7b..5acd9ee (73adc3c correção do "null" no fade-out; 5acd9ee remoção de `dist >= 1`). Rodada 1: `qa-alerta-dominio-email-2026-11-25.md`.

## Resultado geral: PASS

## Revisão de código (só o diff da correção)
- `Register/index.tsx`: `visible={showSuggestion}`; `emailSuggestion` mantém o texto ao fechar, então o fade-out não mostra "null". `setEmailSuggestion(suggestion)` e `setShowSuggestion(true)` rodam no mesmo handler (batch), então reabrir com outro typo já abre com o texto novo. Corrigir: troca e-mail e vai ao passo 1; Manter/Esc (`onCancel`): mantém e-mail e vai ao passo 1. Conforme a spec. PASS
- `emailTypo.ts`: `dist >= 1` é redundante porque domínio idêntico a popular já retorna `null` antes do laço. Comportamento igual. PASS

## Automatizado
- `node --test src/utils/*.test.mjs`: 83 testes, 83 pass, 0 fail. PASS
- `npx tsc --noEmit`: sem erros. PASS

## Navegador (localhost:8081, Chrome headless, playwright-core)
| # | Check | Resultado |
|---|---|---|
| F1 | Corrigir: e-mail vira `joao@gmail.com`, vai ao passo 1, sem modal; voltar e avançar: sem modal | PASS |
| F2 | Manter + voltar: e-mail `joao@gmial.com` mantido; avançar de novo: modal reaparece | PASS |
| F5 | Esc (após `[role=dialog]` ativo): fecha, passo 1, e-mail mantido | PASS |
| N1-N3 | Sem "null"/"undefined" no texto da página por 30 amostras a cada 20 ms após fechar por Corrigir / Manter / Esc | PASS (3/3) |
| S1 | Texto antigo: `joao@gmial.com` → Manter → voltar → `joao@hotmial.com` → avançar: mensagem "Você quis dizer joao@hotmail.com?", `joao@gmail.com?` nunca aparece | PASS |

Total navegador: 12/12 asserções PASS. Total geral: 0 FAIL.

## Achados
- CRITICAL/HIGH/MEDIUM: nenhum.
- LOW: nenhum.

## Não verificado
Dispositivo nativo (iOS/Android) e leitor de tela; só web (react-native-web). Scripts de QA ficam fora do repositório.
