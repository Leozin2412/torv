# QA — alerta de domínio de e-mail com erro de digitação (2026-11-25)

Branch `feature/cadastro-confirmacao-email`, diff `main..HEAD` (e9d3836 helper, 2280183 Register/ConfirmModal).
Navegador: Chrome headless (playwright-core) sobre Expo web em http://localhost:8081, sem backend.

## Automatizados
- `node --test src/utils/*.test.mjs`: 83 testes, 83 pass, 0 fail.
- `npx tsc --noEmit`: sem erros.

## Fluxos (resultado geral: PASS)
| # | Resultado | Evidência |
|---|---|---|
| 1 | PASS | `joao@gmial.com` → texto da página: "Confira seu e-mail / Você quis dizer joao@gmail.com? / Corrigir / Manter como digitei". Corrigir → "Sobre você". Voltar → campo `joao@gmail.com`; novo avanço vai direto ao passo 1, sem modal. |
| 2 | PASS | `joao@hotmial.com` (sugestão `joao@hotmail.com`) → Manter como digitei → "Sobre você". Voltar → campo `joao@hotmial.com`; avançar reabre o modal. |
| 3 | PASS | `joao@gmail.com` e `joao@empresa.com.br` → sem modal, passo 1. |
| 4 | PASS | E-mail vazio → "Informe seu e-mail."; senhas diferentes → "As senhas não conferem."; nenhum modal. |
| 5 | PASS | Esc com modal aberto → fecha, passo 1; Voltar → campo `joao@gmial.com` (mantido). |
| 6 | PASS | `page.on('request')` ativo só durante o toque: 0 requisições após o toque. |
| 7 | PASS | Viewport 320 px: scrollWidth = clientWidth = 320 (sem rolagem horizontal). Botões Corrigir e Manter como digitei: 224 x 50 px (x 48 a 272). Altura >= 44. |
| 8 | PASS (código) | Modal antigo exige login, inacessível no navegador. Verificado no código: nenhum call site existente (GpsActivity, GroupDetail, GroupManage, Home) passa `cancelLabel` (`grep cancelLabel` só acha Register); padrão `cancelLabel = 'Cancelar'` em ConfirmModal/index.tsx. |

## Revisão multi-lente (correção, legibilidade, bordas)
Sem achados bloqueantes. Privacidade: `suggestEmailDomain` é função pura, sem rede, log ou analytics (confirmado pelo fluxo 6).

## Achados
- LOW — O brief e o plano chamam o botão do passo 0 de "Continuar", mas ele se chama "Registre-se" (`Register/index.tsx`, `step === 0 ? "Registre-se" : "Continuar"`). Comportamento anterior à feature; só a documentação diverge. Nenhuma ação no produto.
- LOW — Distância de edição até 2 pode sugerir domínio em e-mails corporativos curtos parecidos com a lista (ex.: dois caracteres de diferença). Não bloqueia o cadastro ("Manter como digitei"); não observado nos fluxos testados.

## Não verificado
Teclado real em dispositivo nativo (Android/iOS), leitor de tela real, `ConfirmModal` antigo renderizado (só no código).
