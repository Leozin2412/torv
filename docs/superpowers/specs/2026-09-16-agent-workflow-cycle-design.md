# Ciclo de desenvolvimento orquestrado + agente de geração de imagem

**Status:** Aprovado para plano de implementação
**Data:** 2026-09-16
**Escopo:** `CLAUDE.md` (raiz do projeto), `.maestri/roles/` (novo role), canvas Maestri (novo terminal conectado ao Frontend).

## 1. Objetivo

Formalizar no `CLAUDE.md` como o Maestro (orquestrador Claude Code) deve escolher entre os recruits Maestri existentes, qual ciclo obrigatório toda feature nova segue (edição → testes → segurança, com retrabalho escopado em caso de falha), e como o progresso é acompanhado em tempo real pelo usuário via sticky note no canvas. Além disso, criar um novo recruit dependente do Frontend, dedicado a gerar imagens/assets visuais via Antigravity.

## 2. Estado atual

- `CLAUDE.md` documenta stack e estrutura de pastas, mas não menciona os recruits Maestri nem nenhum processo de ciclo de desenvolvimento.
- 5 recruits existem em `.maestri/roles/`, todos reportando só ao Maestro, sem conexão entre si: Torv Backend, Torv Frontend, Torv Database, Torv Security, Torv Review and Tests.
- `docs/` já tem relatórios de QA gerados pelo Torv Review and Tests (`qa-torv-mobile-2026-09-15.md`, `qa-torv-mobile-2026-09-16-round2.md`) — o padrão de "um arquivo novo por rodada, nunca sobrescreve" já existe na prática, só não está documentado como regra.
- Não existe tracking de progresso visível no canvas Maestri — nem sticky notes nem outro mecanismo.
- Não existe recruit de geração de imagem.

## 3. Decisões de design

| Decisão | Escolha | Razão |
|---|---|---|
| Onde documentar seleção de agente | `CLAUDE.md`, seção nova, mapa curto (recruit → quando usar) remetendo a `.maestri/roles/` como fonte de verdade dos prompts completos | Evita duplicar/desatualizar os prompts dos roles; CLAUDE.md vira só o índice de decisão rápida |
| Granularidade do ciclo | Feature inteira, não por camada | Camadas de uma feature costumam ter dependência de contrato (ex: rota nova no backend antes do frontend consumir); rodar teste/segurança só uma vez por feature é mais simples de acompanhar e evita testes redundantes por camada |
| Onde ficam os relatórios de teste | `docs/`, um arquivo novo por rodada (nunca sobrescreve), mesmo padrão dos QA reports já existentes | Já é o padrão em uso; só formaliza |
| Escopo do retrabalho quando Security reprova | Só as camadas apontadas na falha voltam pra edição; testes rerodam só sobre o que mudou | Evita retrabalho desnecessário nas camadas que já passaram |
| Onde vive a task list de acompanhamento | Sticky note no canvas Maestri, atualizada pelo Maestro a cada transição de etapa | Visibilidade imediata pro usuário no canvas, sem precisar abrir arquivo; não precisa ser versionado (é estado efêmero de progresso, os relatórios em `docs/` já são o registro permanente) |
| Topologia do novo agente de imagem | Conectado só ao terminal Frontend, não ao Maestro | Frontend é quem sabe quando uma tarefa precisa de asset visual; mantém o padrão de topologia estrela dos outros recruits, mas com um galho a mais |
| Criação do terminal do agente de imagem | Via skill `maestri-manager`, executada nesta sessão após o CLAUDE.md ser commitado | Role/terminal Maestri não é algo que se cria escrevendo texto no CLAUDE.md — é uma ação real no canvas |

## 4. Seleção de agentes (CLAUDE.md)

Nova seção curta com uma tabela: recruit, quando usar, arquivo de role. Não repete os prompts completos (já vivem em `.maestri/roles/<uuid>/role.json`), só indexa.

| Recruit | Quando usar |
|---|---|
| Torv Backend | Rotas, controllers, middlewares, repository code chamando Prisma, migração Express→Fastify |
| Torv Frontend | Telas, componentes, navegação, styling, chamadas de API no client |
| Torv Database | Schema, migrations Prisma, SQL bruto, storage de foto de perfil |
| Torv Frontend Image Gen (novo) | Geração de imagem/asset visual para uma tarefa do Frontend — sempre via delegação do Frontend, nunca chamado direto pelo Maestro |
| Torv Review and Tests | Depois que implementação termina — revisão multi-lente + testes |
| Torv Security | Depois que Review and Tests passa 100% — revisão OWASP do diff |

## 5. Ciclo de desenvolvimento obrigatório (CLAUDE.md)

Para toda feature nova:

1. **Edição** — Maestro identifica quais camadas (backend/frontend/database) a feature precisa e delega, em paralelo ou em sequência conforme dependência real de contrato.
2. **Testes** — Torv Review and Tests roda sobre o diff completo da feature (todas as camadas envolvidas juntas, não uma por vez). Gera relatório novo em `docs/` a cada rodada (nunca sobrescreve o anterior — nomeação segue o padrão já em uso: `qa-<topico>-YYYY-MM-DD[-roundN].md`).
3. Se algum teste falha: relatório registra o que falhou; ciclo **não avança** pra segurança. Maestro decide se o retrabalho é escopo do passo 1 (bug de implementação) e delega de volta só pra camada responsável.
4. Repete 2-3 até todos os testes passarem.
5. **Segurança** — só roda depois de testes 100% verdes. Torv Security revisa o diff completo.
6. Se Security reprova: Maestro reabre edição **só nas camadas que a Security apontou**, não a feature toda. Volta pro passo 1 com esse escopo reduzido, testes rerodam só sobre o que mudou (novo relatório, nova rodada).
7. Feature só é considerada pronta com testes E segurança verdes na mesma rodada.

## 6. Tracking de progresso (CLAUDE.md)

Para cada feature em andamento, o Maestro cria (ou atualiza, se já existir) uma sticky note no canvas Maestri via skill `maestri`, contendo:
- Nome da feature.
- Etapa atual (Edição / Testes / Segurança) e quem está rodando.
- Resultado da última rodada de testes/segurança (passou/falhou, link pro relatório em `docs/` se houver).
- Se em retrabalho: quais camadas foram reabertas e por quê.

A sticky note é atualizada a cada transição de etapa (não só no início/fim), para que o usuário acompanhe em tempo real olhando o canvas. Não substitui os relatórios em `docs/`, que continuam sendo o registro permanente e versionado.

## 7. Novo recruit: Torv Frontend Image Gen

- **Topologia:** conectado só ao terminal Torv Frontend no canvas Maestri (não ao Maestro, não aos outros recruits) — mesmo padrão de "reporta só pra cima" dos demais roles, um nível abaixo.
- **Função:** Frontend delega geração de imagem/asset visual pra ele quando uma tarefa precisa; ele gera via Antigravity e devolve pro Frontend, que decide como/onde usar.
- **role.json:** segue o mesmo formato dos 5 roles existentes (`color`, `icon`, `id`, `name`, `prompt`, `schemaVersion`). Prompt define: caveman mode por padrão, escopo (só gera imagem quando o Frontend pedir), skill/ferramenta principal é Antigravity, reporta só pro Frontend.
- **Criação:** feita via skill `maestri-manager` nesta sessão, depois do `CLAUDE.md` commitado — não é possível "criar" o terminal só editando arquivo de texto, é uma ação real no canvas Maestri.

## 8. Fora de escopo

- Não altera os 5 roles existentes além de mencioná-los na nova seção de seleção de agentes do CLAUDE.md.
- Não define ainda o prompt detalhado de "como" o Antigravity deve ser chamado tecnicamente (fica pro momento da criação do terminal via `maestri-manager`, que tem sua própria skill de setup).
- Não versiona a sticky note (é estado de canvas, não arquivo de repositório).
