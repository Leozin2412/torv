# Security — Storage das fotos (manualAPK 2.5) — 2026-10-11

**Diff:** `3b0f7ac` + `dfe7bf4` (só backend). Lente: OWASP Top 10. Revisão estática; Supabase real não chamado, servidor não subido.
**Resultado: PASS.** 0 CRITICAL/HIGH/MEDIUM. 1 LOW + 3 INFO. Nenhum rework de camada.

## Pontos de atenção

| # | Ponto | Veredito | Evidência |
|---|---|---|---|
| 1 | Vazamento de `SUPABASE_SECRET_KEY` | PASS | Chave só em `storage()` → headers `apikey`/`Authorization` do `fetch`. Nunca em URL, nunca em string de erro: `saveImage`/`deleteImage` lançam só `...failed with status N`. `Missing storage env` lista só **nomes** de variável. `setErrorHandler` (`server.js`): 5xx → `An unexpected error occurred`; erros sem `statusCode` não vazam. `fastify.log.error(err)`/`console.error(err)` logam o erro (só status; falha de rede do undici traz host/código, sem header). `disableRequestLogging` ativo; headers de saída do fetch não são logados. `.env` ignorado no git (`BackEndTorv/.env`), `git ls-files` sem `.env`. |
| 2 | Path traversal / sobrescrita / apagar alheio | PASS | `saveImage`: nome 100% do servidor (`profile-<userId do JWT>-<ts>-<rand>.<ext>`, `group-<id>-...`), `encodeURIComponent`. POST sem `x-upsert` → Storage recusa nome existente (sem sobrescrita). `deleteImage`: `path.basename` + `encodeURIComponent`; valor vem de `getProfileRow(userId)` / `setCover` (dono já checado por `getOwned`) / `deleteGroup`; `photo_url`/`cover_url` **não** são graváveis pelo cliente (`validateProfileUpdate` ignora; só `updatePhotoUrl`/`setCover` escrevem, com nome do servidor). Sem IDOR: cada usuário só apaga o próprio anterior. |
| 3 | Validação do upload | PASS | `readImage` antes de gravar: mimetype ∈ {jpeg,png,webp}, assinatura (magic bytes) coerente com o mimetype, limite 4 MB (`limits.fileSize` + `truncated` → 413). Extensão derivada do mimetype validado (não do nome do cliente); `Content-Type` enviado ao bucket vem da extensão do nome do servidor (mapa fixo). SVG/HTML/JS impossíveis: rejeitados por tipo e por assinatura, e servidos com `image/*`. |
| 4 | Bucket público sem policy | PASS | Escrita/delete usam a `sb_secret_` (bypass de RLS, só servidor); leitura é URL pública. Nenhum código usa `anon`/`authenticated` nem a publishable key para Storage → não depende de policy de INSERT. Sem `createSignedUrl`/SDK no cliente. |
| 5 | SSRF | PASS | Base da URL = `process.env.SUPABASE_URL` (operador). Nenhum segmento do host/esquema vem de entrada do usuário; só o nome do arquivo (servidor) entra no *path*. Frontend não fala com o Supabase (cumpre regra do projeto). |
| 6 | `@fastify/static` / `/uploads` | PASS (INFO-1) | Removido de `server.js` e `package.json`; sem rota `/uploads`, sem `request.protocol`/`host` para montar URL (grep limpo em `src/` e `server.js`). Ver INFO-1 sobre o lock. |

## Achados

| ID | Sev | Local | Achado | Correção sugerida |
|---|---|---|---|---|
| L1 | LOW | `imageUpload.js` `publicUrl` | `publicUrl` não codifica o nome (assimetria com `saveImage`) e não tira `/` final de `SUPABASE_URL`. Hoje nomes são `[A-Za-z0-9-.]` gerados pelo servidor → sem exploração. Fica frágil se alguém um dia gravar nome vindo de fora. | `encodeURIComponent(fileName)` e `url.replace(/\/$/, '')`. Opcional, sem urgência. |
| I1 | INFO | `package-lock.json` | `@fastify/static` **continua no lock** como dependência transitiva de `@fastify/swagger` (que `server.js` só registra fora de produção). Não é registrado nem exposto; não há sobra de rota. | Nada a fazer. Mantê-lo em `npm audit` de rotina. |
| I2 | INFO | `profilePhotos/` (git) | 1 foto real de usuário (`profile-<uuid>-…jpeg`) está versionada, embora `BackEndTorv/profilePhotos/` esteja no `.gitignore` (adicionada antes da regra). PII no histórico. (O QA citou 10 arquivos; `git ls-files` mostra 1.) | Após migrar legado ao bucket (M1 do QA): `git rm --cached` do arquivo. Histórico só se quiser limpar de vez (`git filter-repo`). |
| I3 | INFO | design / bucket | Bucket público: qualquer um com a URL lê a foto; nome expõe o `userId` e usa `Math.random` (não é segredo, não é controle de acesso). Aceito pelo desenho (foto de perfil/capa). No dashboard: restringir `allowed_mime_types` (jpeg/png/webp) e `file_size_limit` 4 MB no bucket como defesa em profundidade; **não** criar policy INSERT/UPDATE/DELETE para `anon`/`authenticated`. Swagger de `groups.routes.js:39` ainda diz "até 5 MB" (doc desatualizada). | Config do bucket + corrigir texto do swagger. |

## Notas

- L3 do QA (smoke real do Storage com `sb_secret_`: `apikey` + `Bearer`) é verificação funcional de deploy, não falha de segurança. Se der 401, **não** trocar por `service_role` legada exposta ao frontend; mantê-la só no backend.
- Migração: `sb_secret_` só em env do backend (Vercel/Furnace). Nenhuma ocorrência no frontend, em docs ou no git (`.env` ignorado).
- Sem RLS/Storage policy necessária para o caminho de fotos: nenhuma foto chega ao Storage por cliente com chave publicável.

## Veredito

**PASS.** Testing e Security verdes na mesma rodada. Pendências não-bloqueantes: L1, I2, I3 (+ M1/L3 do QA antes do deploy).
