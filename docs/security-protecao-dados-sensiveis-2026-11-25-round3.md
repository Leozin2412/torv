# Segurança — proteção de dados sensíveis (LGPD) — rodada 3

- Data: 2026-11-25 · Branch: `feature/criptografia-dados-sensiveis` · HEAD `b0cf1af`
- Escopo: `git diff 4d01fb4..b0cf1af -- BackEndTorv` (commits `3ede456`, `f1dd21b`, `1911442`, `0c4ad25` + testes). Rodadas anteriores inalteradas: `docs/security-protecao-dados-sensiveis-2026-11-25.md` e `-round2.md`. QA: `docs/qa-protecao-dados-sensiveis-2026-11-25-round4.md` e `-round5.md`.
- Método: leitura do diff; nenhum `.env` lido, nenhuma ferramenta Supabase usada, suíte não executada (confio no QA).

## Veredito: APROVADO
Zero Critical/High/Medium. Dois Low e dois Info, nenhum bloqueia.

## Notas por mudança

### 3ede456 — re-signup de conta pendente não grava (`auth.controller.js:48-49`)
- `if (userId && !(await profileRepository.profileExists(userId)))`: endpoint sem auth deixa de sobrescrever o perfil de outra pessoa. Fecha a pendência "atualização de perfil de conta pendente" da rodada 2.
- Rollback (`:62`) agora só roda para conta sem perfil criada/recuperada nesta requisição; o DoS da rodada 1 continua fechado (a conta com perfil nunca chega ao `deleteUser`).
- Recuperação: conta órfã (perfil não gravado e `deleteUser` falhou) tem `profileExists=false`, então o re-signup completa o perfil. Sem trava permanente.
- Efeito funcional (não é brecha): quem reenviar o cadastro de conta pendente com dados diferentes tem os novos ignorados; e reenviar o mesmo `username` do 1º cadastro cai no pré-check `usernameExists` (409 `USERNAME_TAKEN`, `:40`) antes do signup. Username já é público (grupos), então não é oráculo de e-mail.
- Persiste o Low da rodada 2: `profileExists` roda fora do `try` (`:48`); se falhar, conta nova fica sem perfil, sem rollback, e é recuperável por novo cadastro.

### f1dd21b — usuário falso do GoTrue (`authProvider.js:56-59`)
- `identities` vazio e array → `{ session: null, userId: null }`; controller devolve o mesmo 201 `{ session: null, confirmation_required: true }` sem gravar nem apagar.
- Atacante não consegue fazer um cadastro novo parecer `identities: []`: a resposta vem do GoTrue (servidor, HTTPS), não da requisição; o corpo da requisição não influencia esse campo. Conta nova sempre traz 1 identity. Se uma versão futura do GoTrue devolvesse `identities` vazio para conta real, o efeito seria conta sem perfil (falha segura, sem exposição) e confirmação por e-mail normal; fica coberto pelo teste `identities: [{id}]` → userId real.
- Oráculo de e-mail: novo, pendente e confirmado agora respondem o mesmo 201 e o mesmo corpo (testes `auth.routes.test.js` e `authProvider.test.js`). Restam apenas canais laterais (ver achados 1 e 2).

### 1911442 — peso com 2 casas (`profileValidation.js:27`)
- `Number(w.toFixed(2))` depois da checagem `20 <= w <= 300` (NaN já recusado). Sem risco; mantém o contrato do `Decimal(5,2)` antigo.

### 0c4ad25 — `trim()` da chave (`fieldCrypto.js:8`)
- `trim()` só remove espaço/quebra de linha nas pontas; a validação de 32 bytes e de base64 canônico (`toString('base64') !== raw`) continua sobre o valor aparado, então espaço interno, base64 não canônico e 33 bytes seguem recusados (teste com 33 bytes + `\n`). Não enfraquece a chave (mesmos 256 bits de entropia). Erro continua sem mostrar o valor.

## Achados

| # | Sev. | OWASP | Local | Cenário | Correção | Bloqueia |
|---|------|-------|-------|---------|----------|----------|
| 1 | Low | A07 | `auth.controller.js:41-70`, `authProvider.js:56` | Canal de tempo: cadastro novo faz signup + gravações no banco; e-mail confirmado/pendente só chama o GoTrue (e não grava). A resposta é idêntica, mas a latência difere; só ajuda quem mede com muitas tentativas e já limitado por `perMinute(10)`. | Aceitar (rate limit presente) ou igualar o tempo. | Não |
| 2 | Low | A07 | `authProvider.js:60-62` | O ramo `user_already_exists`/`email_exists` → 409 `EMAIL_TAKEN` continua no código. Com confirmação ligada o GoTrue não deveria usá-lo, mas se algum dia ocorrer (ex.: configuração sem confirmação) volta a ser oráculo de e-mail, diferente do 201 uniforme. | Decidir: unificar em 201 ou documentar que o ramo é só para ambiente sem confirmação. | Não |
| 3 | Info | A04 | `auth.controller.js:48` | `profileExists` fora do `try` (herdado da rodada 2): falha de banco deixa conta nova sem perfil; recuperável por novo cadastro. | Opcional. | Não |
| 4 | Info | A01 | `auth.controller.js:48-49` | Check-then-save não atômico: duas requisições simultâneas de cadastro novo; pior caso um `deleteUser` extra de conta criada nesta janela (404 aceito). | Nenhuma. | Não |

Nenhum log novo com valor, e-mail, id ou chave. Nenhum segredo no diff (só fixtures de teste).

## Não verificado
- Comportamento real do GoTrue de produção para e-mail confirmado (`200` com `identities: []`), para reenvio de conta pendente (se altera a senha) e tempos de resposta: inferido do código/testes e da documentação do GoTrue, não testado ao vivo.
- Mesmos itens das rodadas 1 e 2 (UXCam em aparelho, RLS/`torv_api`, migration em produção, gitleaks no histórico completo).
