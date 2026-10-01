# Política de Segurança — TORV

Versão 1.0 · 2026-09-21 · Responsável: Leonard Monteiro

Este documento descreve como o TORV protege os dados dos usuários e como vulnerabilidades devem ser reportadas. Itens marcados **[Planejado]** ainda não estão implementados.

## 1. Escopo

- App mobile (`FrontEndTorv`, React Native/Expo).
- API (`BackEndTorv`, Fastify + Prisma).
- Banco de dados PostgreSQL e autenticação no Supabase.

## 2. Dados tratados

| Categoria | Exemplos | Sensibilidade |
|---|---|---|
| Conta | e-mail, identificador do usuário | Alta |
| Saúde e corpo | peso, altura, metas calóricas, dieta, atividades | Alta |
| Social | streaks, atividade, amigos | Média |
| Mídia | foto de perfil | Média |

Coletamos apenas o necessário para o funcionamento do app. Dados de saúde são tratados como dados pessoais sensíveis (LGPD, art. 5º, II).

## 3. Controles de segurança

### 3.1 Autenticação e sessão
- Autenticação delegada ao Supabase Auth; o app não armazena senhas.
- Toda rota protegida exige `Authorization: Bearer <JWT>`. A API valida assinatura (JWKS do Supabase) e o `issuer` a cada requisição ([auth.middleware.js](../BackEndTorv/src/middlewares/auth.middleware.js)).
- O identificador do usuário vem sempre do token (`sub`), nunca do corpo da requisição.

### 3.2 Autorização
- Cada usuário acessa somente os próprios dados; consultas filtram pelo `userId` do token.
- **[Planejado]** Row Level Security no Postgres como segunda barreira.

### 3.3 Uploads (foto de perfil)
- Tipos permitidos por lista fechada (JPEG, PNG, WebP).
- Verificação da assinatura real do arquivo (magic bytes), não só do `mimetype`.
- Nome do arquivo gerado no servidor; o nome enviado pelo cliente é ignorado.
- **[Planejado]** Migrar de disco local para storage privado com URLs assinadas.

### 3.4 Transporte e API
- Toda comunicação em produção deve usar HTTPS/TLS.
- CORS restrito às origens configuradas.
- **[Planejado]** Rate limiting em login e rotas sensíveis, cabeçalhos de segurança (`@fastify/helmet`) e validação de esquema em todas as entradas.

### 3.5 Segredos
- Chaves e URLs ficam em `.env`, fora do versionamento.
- Nunca commitar credenciais; se uma chave vazar, deve ser rotacionada imediatamente.
- A chave `service_role` do Supabase nunca vai para o app mobile.

### 3.6 Banco de dados
- Acesso por Prisma (consultas parametrizadas, sem SQL concatenado).
- Alterações de schema somente por migrations versionadas.
- **[Planejado]** Backups automáticos e teste periódico de restauração.

### 3.7 Desenvolvimento
- Todo recurso passa por revisão/testes e revisão de segurança (OWASP Top 10) antes de ser considerado concluído.
- Relatórios ficam em `docs/`.
- **[Planejado]** `npm audit` na rotina e atualização periódica de dependências.

## 4. Direitos do usuário (LGPD)

O usuário pode solicitar acesso, correção, portabilidade e exclusão dos seus dados e da sua conta, pelo contato da seção 6. Prazo de resposta alvo: 15 dias. Ao excluir a conta, dados pessoais e fotos são removidos, salvo obrigação legal de retenção.

## 5. Resposta a incidentes

1. **Detectar e conter** — revogar chaves/sessões afetadas, isolar o componente.
2. **Avaliar** — quais dados e quantos usuários foram afetados.
3. **Corrigir** — aplicar correção e verificar com testes.
4. **Notificar** — usuários afetados e a ANPD, em prazo razoável, se houver risco relevante (LGPD, art. 48).
5. **Registrar** — causa raiz e ações preventivas em `docs/`.

## 6. Reporte de vulnerabilidades

Encontrou uma falha? Envie para **leonardommonteiro2004@gmail.com** com:
- descrição e impacto,
- passos para reproduzir,
- versão/plataforma afetada.

Compromissos: confirmação em até 3 dias úteis, correção priorizada por gravidade e crédito ao reportante, se desejado. Pedimos divulgação responsável: não acesse dados de terceiros, não degrade o serviço e aguarde a correção antes de publicar.

## 7. Revisão

Este documento é revisado a cada mudança relevante de arquitetura (ex.: migração de infraestrutura) e ao menos a cada 6 meses.
