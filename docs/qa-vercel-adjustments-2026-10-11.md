# QA — Ajustes Vercel (manualAPK 3.4) — 2026-10-11

**Diff:** `16b7e4e` (só backend; frontend intocado → sem passada de usabilidade no navegador).
**Resultado: PASS.** 0 HIGH/CRITICAL. 1 MEDIUM de deploy (`prisma` só em devDependencies + `postinstall`), 3 LOW.
**Testes:** `npm test` em `BackEndTorv` → 237/237 (3 execuções seguidas, estável) antes; **239/239** depois de 2 testes novos. Nada na porta 3000; nenhum serviço real chamado.

## Lentes

| # | Lente | Veredito | Evidência |
|---|---|---|---|
| 1 | Semântica do `trustProxy` | PASS | Lido: `fastify/lib/request.js` — número vira `() => false` (fail-closed), função é usada como está; `@fastify/proxy-addr@5.1.1` + `forwarded`: `addrs = [peer, …XFF do último p/ o primeiro]`, `trust(addr, i)` com `i=0` = peer; o laço corta no primeiro não confiável. `(_a, hop) => hop < 1` ⇒ confia só no peer ⇒ `request.ip` = **último item do XFF**. Confirmado rodando o Fastify 5.12.4: `XFF "9.9.9.9"` → ip `9.9.9.9`; `"1.1.1.1, 2.2.2.2, 3.3.3.3"` → `3.3.3.3`; sem XFF → IP do peer; `trustProxy: 1` → sempre o peer (a razão do comentário está certa). |
| 2 | XFF forjado | PASS | Na Vercel: `a, b, c` → ip = `c` (último). Um cliente que forja prefixos não muda o IP contado; só o último valor (escrito pela Vercel) vale. Header duplicado (2 linhas) → também o último. Sem `VERCEL`: `trustProxy:false`, XFF ignorado (`request.ip` = peer) — coberto por teste. Premissa **não verificável aqui**: a Vercel sobrescreve (não anexa) o XFF; a doc dela diz que sim. Se um dia houver outro proxy na frente (Cloudflare etc.), o último item passa a ser o proxy e todo mundo cai no mesmo balde — ajustar `hop`. Com XFF não-IP (`a, b, c`) o `ip` vira a string `c` (só chega assim se o XFF não for da Vercel). |
| 3 | `/health` | PASS | `{status:'ok'}` estático, 200 sem auth, sem versão/env/banco. Não existe rate limit global: o `@fastify/rate-limit` é registrado dentro de `auth.routes` e `groupInvitations.routes` (encapsulado) → `/health` fica **sem limite** (resposta estática, custo desprezível; ver L3). Limites por rota de `/auth/*` e convites continuam valendo. |
| 4 | Multipart global | PASS com L1 | Upload válido 200. Sem arquivo (só campo de texto) → 400 `No image file provided`. 4 MB + 1 → 413 (perfil e capa), sem gravar. JSON/sem corpo em `/groups/:id/cover` → 406 (pré-existente); em `/profile/upload` → 500 (pré-existente, já anotado como L2 em `qa-groups-competition-backend-2026-10-06.md`). **Novo:** 2 arquivos no mesmo POST → 500 (antes: 200 e ignorava o 2º). Nada é gravado (ver L1). |
| 5 | Dependências | PASS | grep case-insensitive de `bcrypt`/`jsonwebtoken` em `BackEndTorv` fora de `node_modules` (src, server.js, prisma/, sql/, scripts, README): 0 ocorrências. `package-lock.json` sem esses pacotes nem `node-gyp-build`; `npm ci --dry-run` → "up to date"; `npm ls` sem `invalid`/`missing`/`extraneous`. |
| 6 | `postinstall` | PASS com M1 | `prisma generate` sem `DATABASE_URL`/`DIRECT_URL` (pasta temporária sem `.env`, `env -u`) → "Generated Prisma Client (v6.4.1)". Não precisa de banco. |
| 7 | Teste novo | PASS com L2 | 3 execuções completas + 1 isolada, 237/237, ~1 s por teste. Porta via `net.listen(0)` (nunca 3000; `PORT` do ambiente vence o `.env` porque o dotenv não sobrescreve). Não toca banco nem rede (`/health` estático; login `{}` → 400 depois de contado no limite). `t.after(() => child.kill())` registrado logo após o `spawn`; conferido sem `node.exe … server.js` órfão depois. |

## Testes novos (2)

- `src/tests/server.test.js`: `VERCEL=1` com XFF forjado `"prefixo, prefixo, 198.51.100.9"` → conta pelo último item (11º = 429); último valor variando → IPs distintos, nenhum 429. Falha se alguém trocar a função por `1`/`true` ou tirar o `hop < 1`.
- `profile.routes.test.js`: 2 arquivos com o multipart global (`files:1`) → status ≥ 400 e nada gravado.

## Achados

| ID | Sev | Local | Achado / cenário |
|---|---|---|---|
| M1 | **MEDIUM** | `package.json` | `prisma` (CLI) está em `devDependencies` e o `postinstall` o chama. Install que omite dev (`npm ci --omit=dev`, `NODE_ENV=production` no passo de install, Docker de produção) → `prisma: command not found` → **instalação falha**. A Vercel instala dev por padrão, então hoje funciona; basta uma env `NODE_ENV=production` no projeto para quebrar. Correção: mover `prisma` para `dependencies`. |
| L1 | LOW | `server.js:22` (`files: 1`) | Request com 2+ arquivos passa a dar **500** (`ERR_STREAM_PREMATURE_CLOSE`, log de erro) em vez de 200/4xx. Reproduzido também em socket real. Só request forjado (o app manda 1 arquivo); nada é gravado, nenhum vazamento. Ideal: 400 — tratar o erro em `readImage` ou subir o limite para 2 e ignorar o excedente. |
| L2 | LOW | `src/tests/server.test.js:16-20` | O `start()` não tem timeout: se o servidor travar sem logar "Server is running" nem sair, o teste fica pendurado para sempre (o runner não tem timeout por teste). Sugestão: `{ timeout: 15000 }` nos testes ou `setTimeout` que mata o filho. Também depende do texto exato do `console.log` do `server.js`. |
| L3 | LOW | `server.js` | `/health` (e qualquer rota fora de `/auth` e convites) sem rate limit; na Vercel o limite fica por instância (memória) de qualquer jeito. Aceitável; só registrar. `HEAD /health` também responde. |

## Veredito

**PASS** — 239/239, Segurança pode seguir. Recomendo corrigir M1 (1 linha) antes do primeiro deploy; L1–L3 podem ficar.
