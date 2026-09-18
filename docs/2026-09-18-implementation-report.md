# Relatório de Implementação — 2026-09-18

Três subsistemas brainstormados na mesma sessão, implementados sequencialmente (Edit → Test → Security por subsistema, conforme `CLAUDE.md` seção 5). Nenhum dos dois branches abaixo foi mergeado em `main` — merge é ação manual do usuário via UI do Maestri.

## 1. Retroativo e Filtro de Datas — ✅ concluído

**Branch:** `frontend/retroactive-date-filter` (5 commits) · **Plano:** `docs/superpowers/plans/2026-09-18-retroactive-date-filter.md`

**O que mudou** (5 arquivos, +136/−13): `FrontEndTorv/src/screens/MyDiet/{index.tsx,styles.ts}` ganharam um filtro de data (ícone + date picker) que recalcula a tira de dias pra mostrar a semana domingo-sábado de uma data escolhida, mantendo o modo padrão (últimos 5 dias) intocado; chip "Hoje" reseta o filtro; `POST /diet` passou a mandar `logged_date` (bug pré-existente que impedia o retroativo de funcionar mesmo com a UI certa). Nova dependência: `@react-native-community/datetimepicker`.

**Test:** round 1 **FAIL** — CRITICAL (o picker não tem build web, e web é a plataforma usada pro QA — filtro virava no-op ali), 2 HIGH (fuso horário no valor inicial do picker; chip "Hoje" não resetava o dia selecionado). Rework corrigiu os 3 num commit (`2eefafb`, incluindo suporte web via `Platform.select` + `<input type="date">`). Round 2 **PASS**, sem achados novos. Relatórios: `docs/qa-retroactive-date-filter-2026-09-18{,-round2}.md`.

**Security:** **PASS**, sem achados. `userId` sempre vem do JWT, nunca do body — `logged_date` arbitrário não permite poluir dados de outro usuário.

## 2. Supabase Auth Migration — ✅ concluído

**Branch:** `feature/supabase-auth-migration` (11 commits, 3 camadas) · **Plano:** `docs/superpowers/plans/2026-09-18-supabase-auth-migration.md` · **Spec:** `docs/superpowers/specs/2026-09-18-supabase-auth-migration-design.md`

**O que mudou** (18 arquivos, +331/−398): auth própria (bcrypt + JWT de 7 dias sem refresh, guardado em `AsyncStorage` sem criptografia) substituída pelo Supabase Auth. RN fala direto com o Supabase (`@supabase/supabase-js` + `expo-secure-store`, equivalente mobile de httpOnly); backend só valida o JWT (via JWKS, não mais secret próprio); `POST /auth/login` e `/auth/register` removidos; trigger Postgres `handle_new_user` cria as linhas de perfil/medidas/streak no signup. Access token 15min, refresh 30 dias, multi-dispositivo — tudo nativo do Supabase Auth, sem tabela própria de refresh token.

**Desvios do plano original**, todos documentados nas specs/relatórios correspondentes:
- Projeto Supabase já usa chaves assimétricas (ECC P-256), não o secret HS256 assumido no design inicial — corrigido pra verificação via JWKS (`jose`) antes de despachar a implementação.
- `prisma migrate dev`/`--create-only` quebrado nesse projeto (shadow DB compartilha cluster com o banco real, role já existe — P3006, vai bloquear migrations futuras também). Contornado escrevendo a migration à mão; **não corrigido na raiz** (editar a migration inicial já aplicada mudaria seu checksum) — fica registrado aqui como débito técnico.
- `expo-secure-store` não tem build web — mesma classe de bug do subsistema 1. Pego proativamente pelo `torv-frontend` antes do QA, corrigido com fallback pro `localStorage` (padrão que o próprio `supabase-js` já suporta).
- Dados de teste existentes foram resetados (`TRUNCATE`), confirmado com o usuário antes de executar contra o banco real.
- Config do projeto Supabase precisou de ajuste manual durante o QA: "Confirm email" estava ligado, o que impedia sessão imediata pós-cadastro (comportamento assumido pelo design, igual ao app antigo). Usuário desligou via dashboard.

**Test:** **PASS** (`docs/qa-supabase-auth-migration-2026-09-18.md`) após o ajuste de config acima. Roteiro completo: cadastro → login automático → perfil correto (prova que a trigger funciona), logout/login, sessão persistindo, `MyDiet`/`Profile` passando pelo middleware novo sem 401/403, senha errada tratada.

**Security:** **PASS**, sem achados bloqueantes. Verificado: issuer do JWT validado (não só assinatura), JWKS não falsificável via header/claim, sem SQL injection na trigger (inserts parametrizados), sem caminho novo de RN direto pro Postgres (RLS ausente não é problema porque só o backend fala com o banco), nenhum secret real commitado.

**Achados não-bloqueantes, ainda abertos** (não implementados nesta rodada, por decisão de escopo):
- Register não valida peso/altura no client antes de mandar pro Supabase — o `CHECK` do banco pega, mas com mensagem genérica "Falha ao criar conta" em vez de erro específico. UX, não segurança.
- `jsonwebtoken` e `bcrypt` continuam no `package.json` do backend sem nenhum importador (dependências mortas da auth antiga).
- `jwtVerify` não passa `audience`/`algorithms` allowlist explícitos — redundante hoje (o `issuer` já escopa pro projeto certo), mas seria defesa em profundidade barata.

## 3. XSS Hardening — encerrado, não aplicável

**Doc:** `docs/superpowers/specs/2026-09-18-xss-hardening-not-applicable.md`

Sem código. Investigação antes do design achou que não existe superfície de XSS hoje: RN não renderiza HTML, sem `WebView`, backend só retorna JSON, e o upload de foto de perfil já é hardened contra o vetor clássico (allowlist de mimetype + validação de assinatura de arquivo, sem SVG). CSRF (pedido junto no escopo original) também ficou fora — não aplicável enquanto a auth for via header `Authorization`, nunca cookie.

## Pendências pra quem for mergear

1. **Merge dos 2 branches** — sem conflito esperado entre eles (arquivos completamente disjuntos), qualquer ordem serve. Feito manualmente pelo usuário via UI do Maestri.
2. **Reset de dados**: a migration do subsistema 2 já rodou contra o banco real e resetou os usuários de teste — qualquer conta usada antes de hoje precisa ser recriada.
3. **Shadow DB quebrado** (P3006) vai bloquear a próxima `prisma migrate dev` que alguém tentar rodar nesse projeto — precisa de correção separada (tornar o `CREATE ROLE` da migration inicial idempotente não é seguro de fazer editando uma migration já aplicada; melhor abordagem fica pra quando surgir a próxima migration real).
4. Os 3 achados não-bloqueantes do subsistema 2 (lista acima) — nenhum é urgente, mas ficam registrados pra não se perderem.
