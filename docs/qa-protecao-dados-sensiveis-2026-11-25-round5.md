# QA — Proteção de dados sensíveis (rodada 5)

**Data:** 2026-11-25
**Recruta:** Torv Review and Tests
**Branch:** `feature/criptografia-dados-sensiveis`
**HEAD:** `0c4ad25`
**Ambiente:** Supabase local (Docker), backend local, API + SQL. Produção não foi tocada.
**Escopo:** os três consertos do /code-review (`f1dd21b` usuário falso do GoTrue, `1911442` arredondamento do peso, `0c4ad25` espaço na chave) + regressão (check 8 e cenário C).

**Veredito: PASS**

Os demais checks valem das rodadas 1 a 4: o diff `b716a4c..0c4ad25` em `BackEndTorv/src` tocou só `authProvider.js`, `fieldCrypto.js` e `profileValidation.js` (mais testes).

## Suíte
Backend `npm test`: `tests 345 / pass 345 / fail 0`.

## Usuário falso do GoTrue (`f1dd21b`) — PASS
Para reproduzir o comportamento de produção, `enable_confirmations` da seção sms foi ligado temporariamente no `config.jsonc` do Supabase local (stop/start; volume mantido: `exercises` = 71, bucket `pictures` = 1).
- GoTrue cru, `POST /auth/v1/signup` com e-mail já confirmado: **200**, `has_id: true`, `identities` com **0** itens, sem `error_code` (resposta ofuscada reproduzida).
- Backend: conta nova -> 201, código do Mailpit, confirmação 200. Recadastro do mesmo e-mail (outro nome, username e peso) -> **201** `{"session":null,"confirmation_required":true}`, mesmo formato de cadastro novo.
- Contagens antes e depois idênticas: `auth.users` 1/1, `user_profiles` 1/1, `user_measurements` 2/2. Perfil continua com o nome original; contas sem perfil: 0.
- Log do backend: 0 ocorrências de 502 ou `register profile save failed`.
- Config revertida (`enable_confirmations` = false; arquivo idêntico ao backup), stack reiniciada: `exercises` 71, bucket `pictures` 1, GoTrue e backend respondendo.

## Peso com 2 casas (`1911442`) — PASS
- Cadastro com `weight_kg: 70.129` -> `GET /profile` devolve `70.13`.
- `PUT /profile {weight_kg: 65.456}` -> 200; `GET /profile` devolve `65.46`.

## Chave com espaço/quebra de linha (`0c4ad25`) — PASS
- Chave real mais `\n` no final (lida do `.env` por script, nunca impressa): processo sobe, `/health` = `{"status":"ok"}`.
- Chave de 33 bytes: processo sai com código 1 e a mensagem genérica `DATA_ENCRYPTION_KEY ausente ou inválida: precisa de 32 bytes em base64`, sem o valor.

## Regressão — PASS
- Check 8: **201 + 409 USERNAME_TAKEN**; contas sem perfil 0; contas do par 1.
- Cenário C (reenvio de conta pendente após 62 s, outros dados): 201 com o mesmo corpo; perfil e medidas inalterados (`NomeX/user_b3145484`, 1 medida).

## Limpeza
Contas `qa-*@torvtest.dev` apagadas (contagem 0); backend local parado; config do Supabase local revertida.
