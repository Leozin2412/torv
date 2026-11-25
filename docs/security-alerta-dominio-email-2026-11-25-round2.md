# Segurança (OWASP Top 10) – rodada 2 – alerta de domínio de e-mail

Branch: `feature/cadastro-confirmacao-email`. Escopo: delta `2157a7b..5acd9ee` (73adc3c, 5acd9ee). Rodada 1: `docs/security-alerta-dominio-email-2026-11-25.md` (PASS). QA rodada 2: 100% verde.

## Resultado por ponto
| Ponto | Resultado | Evidência |
|---|---|---|
| Privacidade/LGPD | PASS | `Register/index.tsx:44-46`: sugestão e flag só em `useState` local. Sem `console.*`, UXCam ou chamada de rede no delta. `suggestEmailDomain` é função pura local. A sugestão fica em memória após fechar (`:46`, `:289-291`), mas contém apenas o e-mail que o usuário já digitou e já está em `email`; sem persistência, log ou exposição nova. Descartada ao desmontar a tela. |
| Rota/URL | PASS | Único `navigate` com e-mail é `:136` (VerifyEmail), preexistente e fora do delta; o delta não adiciona params. |
| DoS no cliente | PASS | `emailTypo.ts:40` mantém descarte por tamanho (`> 2`) antes de `osaDistance` (`:41`). A remoção de `dist >= 1` (`:42`) não altera custo; igualdade já retorna `null` na linha 31 (domínio popular exato). |
| Injeção/XSS web | PASS | Sugestão só em template de string passado como `message`, renderizado em `<Text>` (`ConfirmModal/index.tsx:24`). Sem `dangerouslySetInnerHTML`/HTML. |
| Autorização | PASS | Nenhuma mudança de servidor/RLS no delta. |
| Segredos | PASS | Nenhum segredo, chave ou `.env` no diff. |

## Achados
- Crítico: 0. Alto: 0. Médio: 0. Baixo: 0.
- Info: ao fechar, `emailSuggestion` persiste em estado (intencional, evita "null" no fade-out). Sem risco adicional.

## Veredito
PASS. Não verificado: execução em dispositivo real/web; dependências (sem mudança no delta).
