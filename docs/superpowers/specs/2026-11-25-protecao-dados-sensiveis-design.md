# Proteção de dados sensíveis (LGPD) — design

Data: 2026-11-25 · Branch: `feature/criptografia-dados-sensiveis` · Status: aprovado pelo desenvolvedor em 2026-11-25 (com o UXCam incluído)

## Intenção
O desenvolvedor quer o TORV de acordo com a LGPD ("a questão é a LGPD mesmo e quero estar de acordo").
Dados de saúde e de localização não podem ficar legíveis para quem chega ao banco sem passar pela API:
dump, backup, painel do Supabase, `DATABASE_URL` vazada ou injeção de SQL. Também não podem existir
cópias em texto puro fora do nosso controle, como os metadados do Supabase Auth, que vão dentro de todo JWT.

## Estado atual (o que este trabalho muda)
- **Cadastro:** `POST /auth/register` manda nome, username, nascimento, gênero, peso, altura, nível e
  objetivo como `data` (metadados) no signup do GoTrue. Esses dados ficam em `auth.users.raw_user_meta_data`,
  vão no claim `user_metadata` de todo token e são copiados para `user_profiles` / `user_measurements` /
  `user_streaks` pelo trigger SQL `handle_new_user`.
- **E-mail:** duplicado em `public.users.email` (o trigger copia de `auth.users`). Só o `GET /profile` lê.
- **Cópia escondida:** `nutrition_targets.basis_json` guarda peso, altura, idade e gênero da última conta de calorias.
- **Banco:** produção zerada em 2026-11-25 (todas as contas apagadas). Só restam o catálogo de
  exercícios (71) e `workout_template_slots` (101). Não há dado antigo para converter.

## Objetivos
1. **Sem metadados de perfil no Auth:** o signup não envia mais nenhum dado de perfil ao GoTrue.
   `raw_user_meta_data` e o JWT ficam só com o que o próprio Supabase põe (`email`, `email_verified`, `sub`...).
2. **E-mail só em `auth.users`:** a coluna `public.users.email` sai. O `GET /profile` lê o e-mail do claim `email` do token.
3. **Criptografia no backend (AES-256-GCM)** destes campos:
   - `user_measurements.weight_kg`, `user_measurements.height_cm`;
   - `activity_gps_data.avg_hr`, `activity_gps_data.max_hr`, `activity_gps_data.splits`, `activity_gps_data.route`;
   - `nutrition_targets.basis_json` (inteiro).
4. **Contrato da API inalterado:** mesmas rotas, corpos e respostas.
5. **UXCam sem dado pessoal nas gravações:** todas as telas gravadas com desfoque (ver H).

## Fora do escopo
- **Gênero e data de nascimento** continuam legíveis em `user_profiles` (decisão do desenvolvedor: análises
  futuras; não são dados sensíveis no art. 5º, II da LGPD). Eles saem dos metadados/JWT como todo o perfil.
- Distância, calorias, durações, elevação, cadência, dieta (`food_logs`, metas) e cargas de treino: ficam
  como estão (o ranking e os totais somam no SQL; não estão na lista).
- Política de privacidade e consentimento para o UXCam (texto jurídico, não código).
- Ferramenta de rotação de chave (só o prefixo de versão agora).
- Projeto Supabase separado para desenvolvimento.

## Anti-objetivos
- Chave no banco, no Supabase (Vault/pgcrypto), no código, no git, em log ou no chat.
- Falha silenciosa: sem chave válida o backend não sobe; falha ao decifrar vira erro 500 genérico, nunca
  texto cifrado, zero ou `null` na resposta.
- Conta no Auth sem perfil no banco (já aconteceu: eram 8 contas e 7 perfis).
- Mudar o formato das respostas da API.

## Restrições
- Um só projeto Supabase (`torv`), que é a produção. O backend local do desenvolvedor também aponta para ele
  quando ele testa no smartphone, então a chave de produção fica no `.env` local dele além da Vercel (risco aceito).
- **Testes que criam usuários** rodam no Supabase local (Supabase CLI + Docker), nunca na produção. No fim,
  o backend local volta a apontar para a produção para o teste real no smartphone (pedido do desenvolvedor).
- Prisma só pelos repositórios; schema e migration são do recruit Torv Database; migration em produção só
  com o responsável.
- Sem dependência nova: `node:crypto`.
- O papel `torv_api` não é criado pelas migrations (já existe na produção); o ambiente local precisa criá-lo.

## Abordagens consideradas
1. **Tirar as cópias em texto puro** (metadados do Auth, `public.users.email`). Escolhida.
2. **Criptografia na aplicação** (backend, AES-256-GCM, chave só no ambiente). Escolhida.
3. **Criptografia no Postgres** (pgcrypto / Supabase Vault). Rejeitada: a chave fica no banco ou ao lado
   dele, e um vazamento do banco expõe os dados.

O desenvolvedor escolheu 1 + 2.

## Design

### A. Módulo `BackEndTorv/src/lib/fieldCrypto.js`
- Chave em `DATA_ENCRYPTION_KEY`: 32 bytes em base64. Validada no boot do `server.js`; ausente ou com
  tamanho errado → o processo não sobe, com mensagem que não mostra o valor.
- `encryptField(value, aad)` → `null` se `value` for `null`/`undefined` (a coluna fica NULL); senão
  `JSON.stringify(value)` cifrado com IV aleatório de 12 bytes, no formato `v1.<iv>.<tag>.<cifra>` (base64url).
- `decryptField(text, aad)` → `null` para `null`; versão desconhecida, tag inválida ou AAD errado → lança erro.
- **AAD** = `<tabela>.<coluna>:<user_id do dono da linha>` (no GPS, o `user_id` da atividade, não o de
  quem está vendo). Impede copiar a cifra de um usuário para outro ou de uma coluna para outra.
- `v1` = a chave atual. Rotação futura cria `v2` sem migrar o formato.

### B. Repositórios cifram na escrita e decifram na leitura
Controllers e libs continuam recebendo números, arrays e objetos, como hoje:
- `profile.repository`: `getUserProfile`, `getLatestMeasurement`, `addMeasurement`;
- `diet.repository`: leitura da medida e as três escritas/leituras de `basis_json`;
- `gps.repository`: gravação e leitura de `activity_gps_data`.

### C. Banco (migration nova)
- `user_measurements.weight_kg` e `height_cm` → `TEXT`; saem os CHECKs `user_measurements_weight_kg_check`
  e `user_measurements_height_cm_check`.
- `activity_gps_data.avg_hr` e `max_hr` → `TEXT`; `splits` e `route` → `TEXT NOT NULL`; sai o CHECK
  `activity_gps_data_hr_check`.
- `nutrition_targets.basis_json` → `TEXT`.
- `users.email` e seu índice único saem.
- `handle_new_user` passa a inserir só `public.users (id, auth_provider, created_at)`.
- As tabelas estão vazias: troca de tipo sem conversão de dados.
- As faixas dos CHECKs removidos continuam na aplicação: `profileValidation` (peso 20–300, altura 50–250)
  e `gpsValidation` (FC 20–250 por ponto).

### D. Cadastro
- `authProvider.signUp(email, password)` sem `data`; devolve também o id do usuário criado
  (com confirmação de e-mail o GoTrue responde o usuário sem sessão).
- Depois do signup, o backend grava numa transação: `user_profiles` (upsert: username, nome, nascimento,
  gênero, nível, objetivo), a medida cifrada (substitui a anterior, se houver) e `user_streaks` (upsert).
  Reenvio de cadastro de conta não confirmada atualiza os dados; conta confirmada já recebe 409 antes.
- Sem `username`, o backend gera `user_<8 primeiros caracteres do id>`. Hoje o trigger usa o começo do
  e-mail, que fica visível para outros membros.
- Falha ao gravar o perfil → o backend apaga a conta no Auth (API admin com a chave secreta) e o cadastro
  pode ser refeito. Nunca é uma conta confirmada: essa recebe 409 do GoTrue antes. O Supabase local precisa
  da confirmação de e-mail ligada, como a produção. Username duplicado nessa hora → 409
  `USERNAME_TAKEN` (fecha a corrida de hoje); outra falha → 502.
- Signup engolido por rate limit (sem id) → não grava nada; o perfil da primeira tentativa continua.

### E. `GET /profile`
O e-mail vem de `request.user.email` (claim do token). O resto da resposta não muda.

### F. Chave e implantação
- O desenvolvedor gera a chave na máquina dele
  (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), guarda num gerenciador de
  senhas e a cadastra na Vercel (Production e Preview) e no `.env` local. Ela nunca passa pelo chat.
- **Perder a chave = perder para sempre os dados cifrados.**
- `.env.example` do backend documenta `DATA_ENCRYPTION_KEY` sem valor.
- Ordem: chave na Vercel → migration em produção (responsável) → deploy do backend.

### G. Testes
- `fieldCrypto`: ida e volta de número, array, objeto e `null`; IV diferente a cada chamada; tag alterada,
  AAD trocado ou chave errada → erro; chave ausente ou curta → erro no carregamento.
- Repositórios: o Prisma recebe texto `v1.` (nunca o valor puro) e a leitura devolve o valor original.
- Cadastro: o GoTrue não recebe `data`; o perfil nasce pelo Prisma; falha → apaga a conta no Auth;
  username duplicado → 409.
- `GET /profile`: e-mail vindo do token.
- **Ponta a ponta no Supabase local (Docker):** cadastro com confirmação pelo e-mail capturado localmente;
  no SQL, as colunas mostram `v1.`, `raw_user_meta_data` não tem chave de perfil e o JWT não traz perfil;
  as telas mostram os valores certos. Contas apagadas no fim.
- Os testes atuais de acesso negado continuam passando.

### H. UXCam
- Hoje: `App.tsx` liga `occludeAllTextFields(true)` e a gravação de vídeo; o texto exibido (peso, e-mail,
  nomes, fotos, rota desenhada) aparece nas gravações enviadas ao UXCam. O SDK 6.0.25 não tem opção para
  esconder todo texto exibido, só campos de digitação, a tela inteira ou views marcadas.
- Decisão (minha): desfoque em **todas** as telas, passando `occlusions: [new UXBlur()]` em
  `startWithConfiguration`. Continua mantendo `occludeAllTextFields(true)`. O painel segue com nomes de
  tela, fluxo e toques; nenhuma tela nova vaza por esquecimento.
- Rejeitadas: marcar cada view sensível com `UXCamOccludedView` (fácil esquecer uma) e esconder só uma
  lista de telas (quase toda tela mostra nome, foto ou dado de saúde).
- O comentário de `App.tsx` que pede mascaramento no painel é atualizado.
- O UXCam continua sem identificar o usuário (nenhum `setUserIdentity`).
- Verificação: só em aparelho com a chave do UXCam; o desenvolvedor confere no painel que a gravação
  sai desfocada.

## Deixado para o construtor
- Nomes internos dos helpers nos repositórios e o SQL exato da migration.
- A descrição da rota `/register` no Swagger (hoje cita o trigger) acompanha a mudança.
- Como o ambiente local cria o papel `torv_api` e aplica as migrations do Prisma no Supabase local.
