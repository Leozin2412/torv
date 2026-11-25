# Segurança — proteção de dados sensíveis (LGPD)

- Data: 2026-11-25
- Branch: `feature/criptografia-dados-sensiveis` · HEAD `b473fce`
- Escopo: `git diff main...HEAD -- BackEndTorv FrontEndTorv` (21 arquivos de código). Spec: `docs/superpowers/specs/2026-11-25-protecao-dados-sensiveis-design.md`. QA verde: `docs/qa-protecao-dados-sensiveis-2026-11-25-round2.md`.
- Método: leitura do diff, grep dos consumidores das colunas cifradas, varredura de segredos. Nenhum `.env` lido; nenhuma ferramenta Supabase/produção usada.

## Veredito: APROVADO

Zero Critical, zero High. Há 1 Medium e 3 Low (abaixo), nenhum bloqueia.

## A02 — Criptografia (`BackEndTorv/src/lib/fieldCrypto.js`)
- AES-256-GCM, `authTagLength: 16` explícito na cifra e na decifra (linhas 18 e 31).
- IV de 12 bytes (`crypto.randomBytes(12)`, l.17), novo a cada chamada; na leitura exige `iv.length === 12` e `tag.length === 16` (l.29).
- Tag verificada: `setAuthTag` + `final()` lança; qualquer falha vira `Error('falha ao decifrar campo')` sem texto, chave ou AAD (l.33-35). `server.js:66-79` converte 5xx em 500 genérico.
- AAD = `tabela.coluna:user_id` (l.11). Todos os usos passam o dono da linha: `profile.repository.js:4`, `diet.repository.js:4-5,104-111`, `gps.repository.js:16`. No GPS é o `userId` do `where` do dono (`getGpsActivity` filtra por `user_id`).
- Chave: só `process.env.DATA_ENCRYPTION_KEY`, 32 bytes, base64 canônico (`toString('base64') !== raw` rejeita lixo, l.8). `assertKey()` em `server.js:2` antes de ouvir; é o único ponto de entrada (Vercel usa `server.js`). Mensagem de erro não inclui o valor.
- Nenhuma leitura/escrita das colunas cifradas fora dos 3 repositórios (grep em `src/`, `server.js`): `gps.controller.js:20-28`, `profile.controller.js`, `nutritionSuggestion.js` só recebem valores já decifrados.
- Migration (`20261125120000_protect_sensitive_data/migration.sql`): bloco `DO $$` aborta se as 3 tabelas tiverem dados (evita `USING NULL` destruir dados); `handle_new_user` continua `SECURITY DEFINER` com `search_path = public`.

## A01 — Controle de acesso
- `deleteUser` (`authProvider.js:105-118`): `userId` vem do retorno do signup desta requisição; chamado só no `catch` do `saveSignupProfile` (`auth.controller.js:62`). Id passa por `encodeURIComponent`; chave secreta só no header.
- Repositórios mantêm `where: { user_id }` em todas as consultas (diff só envolve cifra/decifra).
- `GET /profile`: e-mail vem do claim do JWT validado por JWKS (`auth.middleware.js:22`); nenhuma outra rota lê e-mail.
- RLS: nenhuma tabela nova nem caminho novo de Storage; o diff não toca fotos/Storage.

## A04 / LGPD
- `signUp(email, password)` sem `data` (`authProvider.js:54-56`): nada de perfil em `raw_user_meta_data` nem no JWT. Teste cobre o corpo enviado ao GoTrue.
- `public.users.email` removido (schema + migration); trigger só insere `id, auth_provider, created_at`.
- Gênero e nascimento em texto puro: decisão registrada do desenvolvedor (spec, "Fora do escopo"). Não é falha.
- UXCam: `occlusions: [{ type: OcclusionType.Blur }]` + `occludeAllTextFields(true)` (`App.tsx:16-23`); nenhum `setUserIdentity`.
- Username padrão `user_<8 do id>` em vez do começo do e-mail (`auth.controller.js:52`): fecha um vazamento de e-mail para outros membros.

## A09 — Logs
- Novos logs em `auth.controller.js:46,62,67`: só `error_code`/`code`; nada de corpo, e-mail, senha, id, cifra ou chave.
- `deleteUser` não loga nem anexa resposta/chave ao erro (`AuthError('PROVIDER')` sem detalhes).
- Erro de decifragem tem texto fixo. `request.log.error(error)` nos controllers já existia; erros do Prisma agora, no máximo, carregam texto cifrado nas colunas sensíveis (melhora).

## Segredos
Varredura `git diff main...HEAD | grep -Ei "(secret|key|token|password)\s*[:=]"`: 
- `.env.example` — nomes sem valor (placeholder). 
- `authProvider.js:~108`/`process.env.SUPABASE_SECRET_KEY` — leitura de env, sem valor.
- Testes: `sk_test`, `pw123456`, chaves `randomBytes(32)` geradas na hora — fixtures, não reais.
- `.env` de back e front seguem no `.gitignore`; nenhum arquivo `.env` no diff. Nenhum segredo real encontrado.

## Achados

| # | Sev. | OWASP | Local | Cenário | Correção | Bloqueia |
|---|------|-------|-------|---------|----------|----------|
| 1 | Medium | A01/A04 | `auth.controller.js:46-70`, `profile.repository.js:61-71` | Reenvio de cadastro de conta **não confirmada** (id real devolvido pelo GoTrue) sobrescreve perfil e medida; e, se o `saveSignupProfile` falhar (ex.: username já usado, P2002), `deleteUser` apaga essa conta. Quem souber o e-mail de um cadastro pendente pode, enviando um username ocupado, apagá-lo (DoS) ou trocar seus dados antes da confirmação. Sem leitura de dados, sem tomada de conta confirmada. | Só rollback quando a conta foi criada nesta chamada (ex.: `created_at` ≈ agora / `identities` novas), ou reenvio não escreve perfil se já existir. Comportamento do reenvio é decisão registrada (spec D); revalidar o rollback. | Não |
| 2 | Low | A02 | `profile.repository.js:61-71`, AAD | AAD não inclui o id da linha: um atacante com escrita no banco pode trocar a cifra de uma medida antiga do mesmo usuário (rollback de valor). Cross-user e cross-coluna estão bloqueados. | Incluir `row id` no AAD se o modelo de ameaça passar a incluir escrita no banco. | Não |
| 3 | Low | A02 | `fieldCrypto.js` | Só `v1`; sem ferramenta de rotação. Chave de produção também no `.env` local do desenvolvedor (risco aceito na spec). Perder a chave = perder os dados. | Backup da chave em gerenciador de senhas; criar `v2`/rotação antes de qualquer incidente. | Não |
| 4 | Low | A04 | `gps.repository.js` | Tamanho do texto cifrado de `route`/`splits` revela a quantidade de pontos. Vazamento de metadado irrelevante diante do conteúdo protegido. | Nenhuma. | Não |

## Não verificado
- Execução real: UXCam desfocado em aparelho (precisa da chave do UXCam; o desenvolvedor confere no painel).
- Migration e deploy em produção (só o responsável); ordem exigida: chave na Vercel, migration, deploy do backend. Backend antigo contra o schema novo quebra.
- Comportamento do GoTrue de produção no reenvio de conta não confirmada e no signup de e-mail já confirmado (inferido do código e dos testes, não testado ao vivo).
- RLS/papéis `torv_api` nas colunas alteradas (o diff não muda políticas; não consultei o banco de produção).
- `npm audit` e CVE de dependências: nenhuma dependência nova no diff (`node:crypto`); auditoria completa fica para a `security-audit` final.
- Pontos não cobertos: gitleaks no histórico completo; só o diff foi varrido.
