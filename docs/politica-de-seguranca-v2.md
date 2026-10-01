# Política de Segurança — TORV

Versão 2.0 · 2026-09-21 · Responsável: Leonard Monteiro

Descreve como o TORV protege os dados dos usuários e como vulnerabilidades devem ser reportadas. Esta versão cobre também os módulos previstos no modelo de dados (`BancoDeDadosTorv/`).

Legenda: **[Ativo]** implementado · **[Planejado]** ainda não implementado · **[Módulo futuro]** funcionalidade prevista no schema, ainda sem tela/rota completa.

## 1. Escopo

- App mobile (`FrontEndTorv`, React Native/Expo).
- API (`BackEndTorv`, Fastify + Prisma).
- PostgreSQL e autenticação no Supabase.
- Módulos do schema: Usuário, Social, Tracking (atividades/GPS), Musculação, Nutrição.

## 2. Dados tratados e classificação

| Módulo | Tabelas | Dados | Sensibilidade |
|---|---|---|---|
| Usuário | `users`, `user_profiles`, `user_measurements` | e-mail, nome, usuário, data de nascimento, gênero, peso, altura, objetivo, foto | **Alta** (saúde e corpo) |
| Nutrição | `nutrition_targets`, `food_logs` | metas calóricas, macros, alimentos consumidos por dia | **Alta** (saúde) |
| Tracking | `activities`, `activity_gps_data` | tipo, duração, calorias, distância, **rota GPS** | **Alta** (localização precisa: revela casa, trabalho e rotina) |
| Musculação | `workout_routines`, `exercises`, `routine_exercises` | rotinas e séries por dia da semana | Média |
| Social | `follows`, `groups`, `group_members`, `group_rankings`, `user_streaks` | quem segue quem, grupos, pontos, streaks | Média (revela relações e hábitos) |

Princípios: coletar só o necessário; dados de saúde e de localização são dados pessoais sensíveis (LGPD, art. 5º, II) e exigem consentimento específico.

## 3. Controles de segurança

### 3.1 Autenticação e sessão
- **[Ativo]** Autenticação delegada ao Supabase Auth. Toda rota protegida exige `Authorization: Bearer <JWT>`; a API valida assinatura (JWKS) e `issuer` a cada requisição ([auth.middleware.js](../BackEndTorv/src/middlewares/auth.middleware.js)).
- **[Ativo]** O `userId` vem sempre do token (`sub`), nunca do corpo da requisição.
- **[Planejado]** Remover a coluna `users.password_hash`, herdada da fase pré-Supabase e sem uso: o app não deve guardar hash de senha.
- **[Planejado]** Verificação de e-mail e exigência de senha forte (configurar no Supabase).

### 3.2 Autorização
- **[Ativo]** Consultas filtram pelo `userId` do token.
- **[Planejado]** Row Level Security (RLS) em todas as tabelas com `user_id`, como segunda barreira contra falha de filtro na API.
- **[Módulo futuro] Social** — regras de visibilidade explícitas:
  - Perfil e atividades privados por padrão; compartilhados só com quem o usuário aprovar (`follows`).
  - Peso, altura, dieta e metas nutricionais **nunca** aparecem para outros usuários.
  - Ranking de grupo expõe apenas `username`, foto e pontos.
  - Só membros veem o grupo; só o criador o administra. Bloquear e remover seguidor devem funcionar.
  - Evitar enumeração: busca de usuários com rate limit e sem retornar e-mail.
- **[Módulo futuro] Tracking** — o dono é o único que lê `activity_gps_data`. Ao compartilhar uma atividade, a rota é mostrada com **zona de privacidade** (ocultar início/fim, por exemplo 200 m ao redor de casa) e o compartilhamento é desligado por padrão.
- **[Módulo futuro] Musculação** — `exercises` é catálogo compartilhado somente leitura para usuários comuns; `workout_routines` pertencem ao criador.

### 3.3 Integridade da pontuação (gamificação)
As regras de streak e ranking rodam em triggers no banco (`trg_update_streak_on_activity`, `trg_add_points_to_group_ranking`), o que exige proteção contra fraude:
- **[Planejado]** Validar plausibilidade de atividades (duração, distância e calorias dentro de limites; datas não futuras; velocidade coerente com o tipo) antes de aceitar.
- **[Planejado]** Impedir duplicatas (mesmo usuário, mesmo `start_time`) para não inflar pontos.
- **[Planejado]** Cliente nunca envia pontos ou streak; só o servidor/trigger calcula.
- Datas retroativas (filtro retroativo já existente) têm limite máximo de antiguidade.

### 3.4 Uploads
- **[Ativo]** Foto de perfil: lista fechada de tipos (JPEG, PNG, WebP), verificação de assinatura real do arquivo e nome gerado no servidor.
- **[Planejado]** Limite de tamanho, remoção de metadados EXIF (podem conter GPS) e storage privado com URLs assinadas em vez de disco local (`profilePhotos/`).
- **[Módulo futuro]** Importação de rotas (GPX/FIT): validar formato e tamanho, sem executar conteúdo, e aplicar limite de pontos por rota.

### 3.5 Transporte e API
- **[Ativo]** CORS restrito às origens configuradas; HTTPS em produção.
- **[Planejado]** Rate limiting (login, busca de usuários, criação de atividades), `@fastify/helmet`, validação de esquema em todas as entradas e limite de corpo da requisição.
- **[Planejado]** Logs sem dados sensíveis (sem tokens, e-mails completos, coordenadas ou dados de saúde).

### 3.6 Banco de dados
- **[Ativo]** Prisma com consultas parametrizadas; alterações de schema só por migrations versionadas.
- **[Ativo, definido em `Gestao_e_Performance.sql`]** Princípio do menor privilégio:
  - `torv_api`: DML nas tabelas e execução de funções; a API **não** usa `postgres`/superuser.
  - `torv_analyst`: somente leitura das views (`vw_dashboard_user_stats`, `vw_group_leaderboard`), sem acesso às tabelas base.
- **[Planejado]** Confirmar no ambiente real que essas roles existem e são as usadas em `DATABASE_URL`.
- **[Planejado]** As views devem expor dados agregados/pseudonimizados: sem e-mail, data de nascimento ou coordenadas. Revisar antes de conectar BI.
- **[Planejado]** Rota GPS (`route_json`) e `macros_json` são `TEXT`: validar o JSON na API antes de gravar. Avaliar criptografia em nível de coluna para GPS.
- Exclusão em cascata (`ON DELETE`) garante que apagar o usuário remove todos os seus dados relacionados.
- Senhas reais do banco ficam só em `.env` e cofre de segredos, nunca em arquivos versionados (os `.sql` usam placeholder).

### 3.7 Backup e recuperação
- **[Planejado]** Os scripts em `BancoDeDadosTorv/bckp/` são da fase SQL Server (`C:\SQLBackups\`) e **não se aplicam** ao Postgres/Supabase. Substituir por backups gerenciados do Supabase (diários, com PITR se disponível).
- Backups contêm dados sensíveis: armazenar criptografados, com acesso restrito, e nunca em pasta versionada.
- **[Planejado]** Teste de restauração periódico (trimestral) e meta de RPO/RTO definida.
- **Retenção:** backups mantidos por 30 dias; dados excluídos a pedido do usuário saem dos backups no ciclo de expiração.
- Ambiente de teste/mocks (`Mock Dados.sql`) usa apenas dados fictícios: nunca restaurar dados reais em ambiente de teste sem anonimizar.

### 3.8 Segredos
- Chaves e URLs em `.env`, fora do git; rotacionar imediatamente em caso de vazamento.
- A chave `service_role` do Supabase nunca vai para o app mobile.

### 3.9 App mobile
- **[Planejado]** Tokens de sessão em armazenamento seguro do sistema (Keychain/Keystore), não em armazenamento comum.
- **[Módulo futuro]** Permissão de localização pedida só ao iniciar uma atividade, com explicação clara do uso; localização em segundo plano apenas durante a gravação.
- Nenhum dado de saúde em logs, analytics ou notificações push (o texto de uma notificação aparece na tela bloqueada).

### 3.10 Desenvolvimento
- Cada recurso passa por testes e revisão de segurança (OWASP Top 10) antes de ser dado como concluído; relatórios ficam em `docs/`.
- **[Planejado]** `npm audit` na rotina e atualização periódica de dependências.

## 4. Privacidade e direitos do usuário (LGPD)

- **Consentimento:** pedido separado e revogável para dados de saúde e de localização. O uso de cada dado é explicado no cadastro.
- **Direitos:** acesso, correção, portabilidade (exportar em formato aberto) e exclusão de conta e dados, pelo contato da seção 7. Prazo alvo de resposta: 15 dias.
- **Exclusão:** ao apagar a conta, dados de todos os módulos, fotos e rotas GPS são removidos (cascata no banco + arquivos no storage). Ficam apenas registros com obrigação legal de retenção.
- **Rankings:** ao sair de um grupo ou apagar a conta, o usuário deixa de aparecer no ranking.
- **Menores:** o app não é destinado a menores de 13 anos; usuários de 13 a 17 exigem consentimento do responsável (LGPD, art. 14). `birth_date` deve ser validada no cadastro.
- **Compartilhamento com terceiros:** os dados não são vendidos. Terceiros são apenas operadores de infraestrutura (Supabase e futura nuvem).
- **Integrações futuras** (ex.: Strava, relógios, Apple Health/Google Fit): autorização explícita por integração, escopo mínimo, tokens de terceiros criptografados e revogação a qualquer momento.

## 5. Uso responsável de conteúdo e saúde

- Metas de calorias e macros são apoio informativo, não orientação médica ou nutricional. O app deve avisar isso e limitar metas a faixas seguras (evitar incentivo a déficits extremos).
- **[Módulo futuro]** Campos livres (nome de grupo, título de atividade, nome de rotina) são sanitizados na exibição e sujeitos a denúncia/moderação.

## 6. Resposta a incidentes

1. **Detectar e conter:** revogar chaves e sessões afetadas, isolar o componente.
2. **Avaliar:** quais dados e quantos usuários foram afetados (vazamento de GPS e de saúde é gravidade máxima).
3. **Corrigir:** aplicar correção e verificar com testes.
4. **Notificar:** usuários afetados e a ANPD, em prazo razoável, se houver risco relevante (LGPD, art. 48).
5. **Registrar:** causa raiz e ações preventivas em `docs/`.

## 7. Reporte de vulnerabilidades

Envie para **leonardommonteiro2004@gmail.com** com descrição e impacto, passos para reproduzir e versão/plataforma afetada.

Compromissos: confirmação em até 3 dias úteis, correção priorizada por gravidade e crédito ao reportante, se desejado. Pedimos divulgação responsável: não acesse dados de terceiros, não degrade o serviço e aguarde a correção antes de publicar.

## 8. Roteiro de prioridades

Ordem sugerida, por risco × esforço:
1. RLS + confirmar roles `torv_api`/`torv_analyst` em uso.
2. Remover `users.password_hash`; validar JSON de GPS/macros.
3. Rate limiting, helmet e validação de esquema.
4. Storage privado para fotos + EXIF + limite de tamanho.
5. Backups gerenciados do Supabase e teste de restauração.
6. Antes do lançamento do módulo Social/Tracking: regras de visibilidade (3.2), zona de privacidade e validação anti-fraude (3.3).

## 9. Revisão

Revisada a cada mudança relevante de arquitetura (ex.: migração de infraestrutura), a cada novo módulo lançado e ao menos a cada 6 meses.
