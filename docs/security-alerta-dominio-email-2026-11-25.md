# Seguranca: alerta de dominio de e-mail com erro de digitacao (2026-11-25)

Escopo: `git diff main..HEAD`. Codigo: `FrontEndTorv/src/utils/emailTypo.ts`, `ConfirmModal/index.tsx`, `screens/Register/index.tsx`. Sem mudanca em backend/banco. Task 3 verde (`docs/qa-alerta-dominio-email-2026-11-25.md`).

## Resultado por ponto

| Ponto | Veredito | Evidencia |
|---|---|---|
| Privacidade/LGPD | PASS | `emailTypo.ts` e funcao pura, sem import, rede, log ou storage. Register so ganha `useState` local (`index.tsx:44`) e `ConfirmModal`. Nenhum `console`, track ou UXCam novo; sugestao nao vai a rota/URL. O `navigate('VerifyEmail', { email })` (`index.tsx:133`) e anterior a feature e nao faz parte do diff. |
| DoS no cliente | PASS | `emailTypo.ts:38-40`: descarte por `|len(candidato) - len(dominio)| > 2` antes da matriz O(n*m). Com a lista fixa (max 14 chars) a matriz e no maximo ~14x16; entrada enorme e podada. Unica operacao linear: `trim/lastIndexOf/slice/toLowerCase`. Teste de entrada grande existe em `emailTypo.test.mjs`. |
| Injecao/XSS (web) | PASS | Sugestao entra como filho de `<Text>` via template string (`index.tsx:287`). Sem `dangerouslySetInnerHTML`, `innerHTML`, `eval` ou URL/`Linking`. React escapa o texto. |
| Autorizacao | PASS | Nenhum arquivo de servidor alterado. Backend segue validando: `BackEndTorv/src/routes/auth.routes.js:5` `Type.String({ format: 'email', maxLength: 254 })`. Aviso e so UX; "Manter como digitei" segue ao passo 1 e o servidor valida no envio. |
| Segredos | PASS | Diff sem chave, token, senha ou `.env`; so docs e codigo de UI. |

## OWASP Top 10 (lente rapida)
A01 sem mudanca de acesso. A02/A07 sem auth tocada. A03 sem sink de injecao. A04 aviso nao bloqueia (nao cria bypass nem lockout). A05/A06 sem dependencia nova. A08 sem desserializacao. A09 sem log novo. A10 sem requisicao.

## Achados
- INFO/LOW-1: `message` do modal exibe o e-mail digitado em `<Text>`. `App.tsx:18` usa `RNUxcam.occludeAllTextFields(true)` (campos de input), nao `Text`; se UXCam estiver ativo, o e-mail pode aparecer na gravacao do modal. Mitigacao opcional: `occludeSensitiveView` no texto do modal. Nao bloqueia.
- INFO-2 (fora do diff, preexistente): e-mail vai em route params para `VerifyEmail` (`index.tsx:133`). Reavaliar na revisao da feature de confirmacao.
- Nenhum achado `confirmed` critico/alto/medio.

## Nao verificado
Gravacao real do UXCam (nao rodado); `security-audit` (Cloudflare) e etapa A separada, nao executada aqui.

## Veredito geral: PASS
