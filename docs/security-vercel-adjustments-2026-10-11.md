# Security — Ajustes Vercel (manualAPK 3.4) — 2026-10-11

**Diff:** `git diff 3b0f7ac..HEAD -- BackEndTorv` (`16b7e4e`, `6b1d3b1`, `2f84224`, `d9dea15`, `75c1f03`). QA lido (`qa-vercel-adjustments-2026-10-11.md`; M1 já corrigido em `2f84224`). Revisão estática + `npm audit --omit=dev` (com rede). Sem servidor na 3000, sem serviço real.
**Resultado: PASS.** 0 CRITICAL/HIGH/MEDIUM no código novo. 2 LOW + 3 INFO. Sem rework de camada.

## Pontos de atenção

| # | Ponto | Veredito | Evidência |
|---|---|---|---|
| 1 | `trustProxy` / XFF | PASS (L1) | `VERCEL ? (_a, hop) => hop < 1 : false`. Confia só no peer (hop 0) ⇒ `request.ip` = **último** item do XFF, o que a Vercel escreve (a doc dela diz que sobrescreve, não anexa). Prefixos forjados `a, b, <real>` não mudam o IP contado; coberto por teste (`server.test.js`). Fora da Vercel (`VERCEL` ausente): `false`, XFF ignorado. `.env` local não define `VERCEL`/`NODE_ENV`. `request.ip` é a chave dos limiters (`auth.routes`, `groupInvitations.routes`; sem `keyGenerator` custom). Nada usa `request.protocol/hostname/host` nem `x-forwarded-*` (grep limpo): `trustProxy` não afeta URLs/redirects. Ver L1 (`VERCEL` setado fora da Vercel) e I1 (limite por instância). |
| 2 | `/health` | PASS | `{status:'ok'}` estático, sem auth: sem versão, env, banco ou hora. Sem acesso a Prisma/rede ⇒ custo desprezível; não amplifica DoS além do que qualquer 404 já custa. Sem rate limit (encapsulado nos plugins de auth/convites), igual ao resto fora de `/auth`. Protege-se pela Vercel (limites da plataforma). |
| 3 | Multipart global (`fileSize` 4 MB, `files:1`) | PASS (L2) | Teto global fecha o buraco de rota multipart esquecida. 2 arquivos ⇒ 500 pelo `setErrorHandler`: corpo `An unexpected error occurred`, sem stack/caminho/segredo na resposta. Só estética + 1 linha de log de erro por request forjado (ruído de log, não vazamento). Nada é gravado. |
| 4 | Dependências | PASS (M-none; ver I2/I3) | `bcrypt`/`jsonwebtoken`: 0 ocorrências fora de `node_modules` (src, server.js, prisma/, scripts) e fora do lock ⇒ superfície menor (adeus binário nativo `node-gyp-build`). `prisma` (CLI) em `dependencies` por causa do `postinstall` (`prisma generate`): `^6.4.1` travado no lock, script próprio do projeto, sem rede de segredo. Custo: `prisma` + `esbuild` agora no install de produção (superfície de supply chain um pouco maior; aceito). `npm audit --omit=dev` abaixo. |
| 5 | Auth com `import('jose')` | PASS (L3) | `issuer: ${SUPABASE_URL}/auth/v1` e JWKS remoto (`/auth/v1/.well-known/jwks.json`) inalterados; `jwtVerify` idêntico, ainda dentro do try/catch ⇒ token inválido/expirado = 403, sem detalhe. Chaves assimétricas via JWKS ⇒ sem confusão de algoritmo (HS256 legado não verifica no JWKS). Falha ao carregar a lib fica fora do try ⇒ 500 pelo `setErrorHandler` genérico, sem vazar. Memoização `??=` guarda a promessa. Ver L3. |
| 6 | Env/segredo em logs e respostas (`server.js`) | PASS | `onResponse` loga `método url -> status (ms)`; nenhuma rota carrega segredo/código em query string (grep de `request.query`/`querystring` com token/code/key: vazio); credenciais vão no body e headers (não logados, `disableRequestLogging`). `console.error(err)`/`log.error(err)` só recebem erros que já são sanitizados (Storage = só status). Respostas 5xx genéricas; 4xx do Fastify só mensagem curta. Swagger só com `NODE_ENV !== 'production'` (Vercel define `production` em runtime; ver I3). Nenhuma leitura de env em resposta. |

## `npm audit --omit=dev` (3 vulns, todas sem alcance de runtime)

| Pacote | Sev | Caminho | Alcançável? |
|---|---|---|---|
| `brace-expansion` 5.0.6 (6 advisories DoS) | high | `@fastify/swagger-ui` → `@fastify/static` → `glob` → `minimatch` | Não: swagger-ui só registra fora de produção; `glob` roda sobre paths do servidor, não entrada do usuário. |
| `esbuild` 0.28.0 (leitura de arquivo no *dev server* Windows) | low | `prisma` CLI | Não: só o servidor de dev do esbuild; não é usado, Vercel é Linux. |
| `fastify` 5.12.4 (<5.12.5, DoS por exceção em trailer **HTTP/2**) | moderate | direta | Não hoje: HTTP/1 (Vercel termina HTTP/2 na borda). Mas é dependência direta com correção. |

## Achados

| ID | Sev | Local | Achado | Correção sugerida |
|---|---|---|---|---|
| L1 | LOW | `server.js:9` | Se `VERCEL` for setada num host **sem** proxy da Vercel (ex.: `.env` copiado, Furnace, Docker), o servidor confia no último item do XFF, que o próprio atacante controla ⇒ muda o header a cada request e **zera** os limiters por IP (login/register/verify/resend). Só por má configuração; hoje `.env` não tem a variável. | Nunca definir `VERCEL` fora da plataforma (a Vercel já injeta). Opcional: comentário no `.env.example`/README. |
| L2 | LOW | `server.js` multipart | 2+ arquivos ⇒ 500 em vez de 4xx + log de erro por request (inundação de log por request forjado). | Tratar em `readImage` (erro `FST_*`/stream fechada ⇒ 400) ou `files: 2` e ignorar o excedente. |
| L3 | LOW | `auth.middleware.js` `loadVerifier` | Se o `import('jose')` falhar uma vez (cold start com falha transitória), a **promessa rejeitada fica memoizada**: todo request autenticado dá 500 até a instância reciclar. Disponibilidade, não confidencialidade. | Limpar no erro: `.catch((e) => { verifier = undefined; throw e; })`. |
| I1 | INFO | limiters | Limite em memória é por instância serverless: um atacante distribuído por várias instâncias soma mais tentativas que o `max` por IP. Rate limit de login/OTP continua sendo defesa em profundidade; o teto real é o do Supabase Auth. Para limite global, store compartilhado (Redis/KV). | Aceito; reavaliar se houver abuso. |
| I2 | INFO | deps | Atualizar `fastify` para ≥5.12.5 (`npm audit fix`; moderate). Não bloqueia. | `npm i fastify@^5.12.5`. |
| I3 | INFO | `auth.middleware.js` / `server.js` | `jwtVerify` sem `audience` (Supabase usa `authenticated`) — pré-existente, sem exploração com JWKS assimétrico. Swagger depende de `NODE_ENV=production` na Vercel; conferir que o projeto não sobrescreve. | `audience: 'authenticated'` opcional; conferir env do projeto. |

## Veredito

**PASS.** Testing (239/239) e Security verdes na mesma rodada. Pré-deploy recomendado: I2 (bump do fastify), L3 (1 linha); L1 é regra operacional (não setar `VERCEL` fora da Vercel).
