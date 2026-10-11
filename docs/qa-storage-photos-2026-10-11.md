# QA — Storage das fotos (manualAPK 2.5) — 2026-10-11

**Diff:** `3b0f7ac` (só backend; frontend não tocado → sem passada de usabilidade no navegador).
**Resultado: PASS** (código). 1 achado MEDIUM de **dados** (fora do diff, bloqueia o deploy, não o merge) + 4 LOW.
**Testes:** `npm test` em `BackEndTorv` → 227/227 antes; **232/232** depois de 5 testes novos. Tudo sem rede (fetch e env falsos); servidor não subido; Supabase real não chamado.

## Lentes

| # | Lente | Veredito | Evidência |
|---|---|---|---|
| 1 | Contrato antigo | PASS | URL `https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<arquivo>` (`publicUrl`, testado em profile/groups/invitations). 413 acima de 4 MB (`readImage` + teste de 4 MB+ via multipart real). Tipo e assinatura validados em `readImage` **antes** de `saveImage`; recusa → 400 sem gravar. Banco guarda só o nome. Cover usa o mesmo limite de 4 MB (antes 5 MB) — esperado. |
| 2 | Falhas | PASS | Storage 403 no save → profile: 500 `Internal server error uploading photo`, sem `getProfileRow`/`updatePhotoUrl`/`deleteImage`; capa: 500, sem `setCover`/`deleteImage`. Corpo sem chave, URL nem status. Erro de `saveImage`/`deleteImage` só carrega o status. Falha ao apagar a antiga: 200 (perfil e capa) e 204 (excluir grupo), só `request.log.warn`. 404 no delete = sucesso. Banco falha depois do save → 500 e a foto antiga **não** é apagada (continua válida). |
| 3 | Callers de `publicUrl` | PASS | grep em `src/` e `server.js`: todos os 10 usos com 1 argumento (profile, groups list/discover/detail/ranking/cover, invitations received/join-preview/members). Nenhuma sobra de `request.protocol`, `/uploads`, `@fastify/static`, `COVER_MAX_BYTES`. Cobertos por testes de rota (`PUB/...`). |
| 4 | Env ausente | PASS (com L1) | `storage()` lê na chamada e lista só os **nomes** faltantes. Upload sem env → 500 genérico, banco intocado (teste novo). `publicUrl(null)` não exige env. |
| 5 | Testes | PASS | `imageUpload.test.js` cobre save/delete/publicUrl/env/limite; rotas cobrem a troca da foto e ordem (lê anterior → update → apaga). Faltavam as falhas: adicionadas abaixo. |

## Testes novos (5)

- `profile.routes.test.js`: Storage 403 → 500 genérico, banco/delete intocados; env ausente → 500 sem vazar nome de env; banco falha após gravar → 500 e antiga não apagada.
- `groups.routes.test.js`: capa com Storage 403 → 500, `setCover`/`deleteImage` não chamados; falha ao apagar a antiga (troca de capa e excluir grupo) → 200 / 204.

## Achados

| ID | Sev | Local | Achado / cenário |
|---|---|---|---|
| M1 | **MEDIUM** | dados (fora do diff) | `BackEndTorv/profilePhotos/` ainda tem as fotos reais (10 arquivos versionados no git) e o banco aponta para esses nomes. Com `/uploads` removido e o bucket vazio, `publicUrl` devolve URL que dá 404 para **todo usuário/grupo que já tinha foto/capa**. Precisa de carga única dos arquivos no bucket (mesmos nomes) antes do deploy. Depois: `git rm` de `profilePhotos/` + `.gitignore` (fotos de usuários no repositório). |
| L1 | LOW | `imageUpload.js:80-84` | `publicUrl` não codifica o nome e não tira `/` final de `SUPABASE_URL` (→ `//storage/...`). Hoje nomes são do servidor (`[A-Za-z0-9-.]`), sem risco; `saveImage` codifica e `publicUrl` não — assimétrico. Também não há checagem de env no boot: env faltando derruba (500) toda listagem/ranking que tenha ao menos uma foto. |
| L2 | LOW | `profile.controller.js:61-66`, `groups.controller.js:130-131` | Save ok + banco falha → blob órfão no bucket (sem compensação). Custo só de espaço; a foto antiga segue válida. Aceitável; limpeza periódica se incomodar. |
| L3 | LOW (não verificado) | `imageUpload.js:51` | Chave enviada como `apikey` + `Authorization: Bearer <chave>`. Docs consultadas só cobrem o gateway self-hosted (troca `Bearer sb_…` por JWT interno); comportamento do projeto hospedado com `sb_secret_…` **não foi confirmado** (proibido chamar o Supabase real). Fazer 1 smoke real (upload + delete) no deploy. Se der 401, usar só `apikey` ou a service_role legada. |
| L4 | LOW | testes de rota | `/groups/:id/cover` e delete não têm `try/catch` e dependem do `setErrorHandler` de `server.js` (500 genérico). Os testes de rota usam o handler padrão do Fastify (devolve a mensagem curta "Image upload failed with status 403" — só status, sem segredo). O handler global em si não é coberto por teste. |

## Veredito

Código: **PASS** (232/232). Segurança pode seguir. **Pendência antes do deploy:** M1 (migrar arquivos legados) e L3 (smoke real do Storage). Nada disso exige rework de camada.
