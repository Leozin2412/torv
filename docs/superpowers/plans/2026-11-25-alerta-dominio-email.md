# Alerta de domínio de e-mail com erro de digitação — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Neste projeto a execução é pelos recruits do Maestri (`maestri ask`), um por vez, não por subagentes internos** (ver Global Constraints).

**Goal:** no passo 0 do cadastro, avisar quando o domínio do e-mail parece um domínio popular com erro de digitação (ex.: `gmial.com`), com a opção de corrigir ou manter, sem bloquear o cadastro.

**Architecture:**
- **Frontend:** helper puro `src/utils/emailTypo.ts` (lista fixa + distância de Damerau-Levenshtein), testado com `node --test`. O `ConfirmModal` ganha `cancelLabel` opcional. A tela `Register` chama o helper em `handleNext` no passo 0 e abre o modal quando há sugestão.
- **Backend e banco:** nenhuma mudança.

**Tech Stack:** React Native 0.86, Expo 57, react-native-web 0.21, TypeScript 6. Testes `node --test src/utils/*.test.mjs` (type stripping do Node 26) e `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-11-25-alerta-dominio-email-design.md` (commit `174e53c`)

## Global Constraints

- **Branch:** `feature/cadastro-confirmacao-email`. Nada de push até a Task 7.
- **Execução estritamente sequencial:** um recruit por vez, via `maestri ask`. Cada etapa só começa depois da anterior verde.
- **Commits:**
  - Conventional Commits em português, um por task, só os arquivos da task, com pathspec explícito (`git commit -m "..." -- <arquivos>`);
  - nunca entram em commit: `revisar*.md`, qualquer `.env`, `node_modules`, `package-lock.json` (o `npm ci` não deve alterá-lo; se alterar, não commitar e avisar o Maestro);
  - linha final dos commits dos recruits: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Frontend:**
  - antes de qualquer código, ler a doc versionada do Expo (`FrontEndTorv/AGENTS.md`: https://docs.expo.dev/versions/v56.0.0/);
  - textos em pt-BR, exatamente como na spec: título `Confira seu e-mail`, mensagem `Você quis dizer {sugestão}?`, botões `Corrigir` e `Manter como digitei`;
  - nenhum `Alert.alert` novo (não funciona no react-native-web); nenhum componente novo;
  - alvos de toque de 44 px; layout que caiba em 320 px.
- **Utilitário testado** (`emailTypo.ts`) **não importa nada em runtime**: o Node não resolve import relativo sem extensão.
- **Privacidade:** a checagem roda só no aparelho. O e-mail não vai para rede, log ou analytics por causa dela.
- **Ambiente local:** esta máquina está sem `node_modules` no `FrontEndTorv`. Antes da Task 1, o Maestro roda `npm ci` em `FrontEndTorv`. Sem isso, `groupErrors.test.mjs` falha por falta do `axios` (não é bug do código). Nenhum `.env` é necessário: o passo 0 do cadastro não chama a API.
- **Contas de QA:** nenhuma. O fluxo testado para no passo 1 do cadastro, antes de qualquer chamada ao backend.
- **Relatórios:** em `docs/`, um arquivo novo por rodada: `qa-alerta-dominio-email-2026-11-25[-roundN].md` e `security-alerta-dominio-email-2026-11-25[-roundN].md`. Nunca sobrescrever.

## Review Focus

1. **E-mail colado muito longo** (10 000 caracteres): `suggestEmailDomain` devolve `null` na hora, sem travar a tela. Coberto em `emailTypo.test.mjs` (Task 1), pelo descarte por diferença de tamanho antes do cálculo.
2. **Espaços e maiúsculas** (`  JOAO@GMIAL.COM `): a sugestão sai sem espaços, com a parte local como digitada e o domínio da lista (`JOAO@gmail.com`); `joao@Gmail.com` não gera aviso. Coberto na Task 1.
3. **Empate entre domínios** (`col.com.br` está a 1 de `uol.com.br` e de `bol.com.br`): vence o primeiro da lista (`uol.com.br`). Coberto na Task 1.
4. **Fechar o modal sem tocar em botão** (Esc no web, "voltar" no Android): equivale a "Manter como digitei" e avança. Coberto no fluxo 5 da Task 3.
5. **Voltar ao passo 0 depois de decidir:** depois de "Corrigir", o campo mostra o e-mail corrigido e "Continuar" não avisa de novo; depois de "Manter", o aviso aparece de novo (comportamento aceito: só um toque). Coberto nos fluxos 1 e 2 da Task 3.

---

### Task 1: Frontend — helper `suggestEmailDomain`

**Recruit:** Torv Frontend · **Files:**
- Create: `FrontEndTorv/src/utils/emailTypo.ts`
- Test: `FrontEndTorv/src/utils/emailTypo.test.mjs`

**Interfaces:**
- Produces: `export const POPULAR_EMAIL_DOMAINS: readonly string[]` e `export function suggestEmailDomain(email: string): string | null`.

- [ ] **Step 1: Baseline**

Run: `cd FrontEndTorv && node --test src/utils/*.test.mjs`
Expected: tudo PASS (depois do `npm ci`). Anotar o total.

- [ ] **Step 2: Escrever o teste que falha**

```js
// Roda com: node --test src/utils/emailTypo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestEmailDomain, POPULAR_EMAIL_DOMAINS } from './emailTypo.ts';

test('lista na ordem da spec', () => {
  assert.deepEqual([...POPULAR_EMAIL_DOMAINS], [
    'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'yahoo.com', 'icloud.com',
    'live.com', 'hotmail.com.br', 'outlook.com.br', 'uol.com.br', 'bol.com.br', 'terra.com.br',
  ]);
});

test('sugere o domínio popular mais próximo (distância 1 ou 2)', () => {
  assert.equal(suggestEmailDomain('joao@gmial.com'), 'joao@gmail.com');
  assert.equal(suggestEmailDomain('joao@gmail.co'), 'joao@gmail.com');
  assert.equal(suggestEmailDomain('joao@hotmial.com'), 'joao@hotmail.com');
  assert.equal(suggestEmailDomain('joao@outlok.com'), 'joao@outlook.com');
  assert.equal(suggestEmailDomain('joao@yaho.com.br'), 'joao@yahoo.com.br');
  assert.equal(suggestEmailDomain('joao@hotmail.combr'), 'joao@hotmail.com.br');
});

test('transposição conta 1 (Damerau): hotmial.co está a 2 de hotmail.com', () => {
  assert.equal(suggestEmailDomain('joao@hotmial.co'), 'joao@hotmail.com');
});

test('empate: vence o primeiro da lista', () => {
  assert.equal(suggestEmailDomain('joao@col.com.br'), 'joao@uol.com.br');
});

test('espaços e maiúsculas: compara em minúsculas, mantém a parte local', () => {
  assert.equal(suggestEmailDomain('  JOAO@GMIAL.COM '), 'JOAO@gmail.com');
  assert.equal(suggestEmailDomain('joao@Gmail.com'), null);
});

test('sem aviso: domínio exato, desconhecido, distância 3, sem @ ou vazio', () => {
  assert.equal(suggestEmailDomain('joao@gmail.com'), null);
  assert.equal(suggestEmailDomain('joao@bol.com.br'), null);
  assert.equal(suggestEmailDomain('joao@empresa.com.br'), null);
  assert.equal(suggestEmailDomain('joao@gm.com'), null);
  assert.equal(suggestEmailDomain('joao'), null);
  assert.equal(suggestEmailDomain('joao@'), null);
  assert.equal(suggestEmailDomain(''), null);
});

test('entrada enorme não trava', () => {
  const t0 = Date.now();
  assert.equal(suggestEmailDomain('a@' + 'x'.repeat(10000)), null);
  assert.ok(Date.now() - t0 < 50);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd FrontEndTorv && node --test src/utils/emailTypo.test.mjs`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` (o `emailTypo.ts` ainda não existe).

- [ ] **Step 4: Implementar em `FrontEndTorv/src/utils/emailTypo.ts`**

- `POPULAR_EMAIL_DOMAINS` na ordem do teste (é a ordem de desempate).
- `suggestEmailDomain`: `trim`; domínio = depois do último `@`, em minúsculas; sem `@`, parte local vazia ou domínio vazio → `null`; domínio na lista → `null`.
- Para cada domínio da lista, pular se `|tamanho(a) − tamanho(b)| > 2`; senão, distância de Damerau-Levenshtein na variante OSA (inserção, remoção, troca e transposição de vizinhos, custo 1 cada).
- Menor distância entre 1 e 2 vence; empate fica com o primeiro da lista (comparação `<` estrita). Devolve `parteLocal + '@' + domínioDaLista`.
- Comentário de uma linha dizendo por que a lista é fixa (foco no Brasil; ordem = desempate).

- [ ] **Step 5: Rodar e ver passar**

Run: `cd FrontEndTorv && node --test src/utils/*.test.mjs && npx tsc --noEmit`
Expected: PASS (baseline + 7) e `tsc` sem erros.

- [ ] **Step 6: Revisão de segurança da task**

Conferir e anotar no retorno ao Maestro:
- nenhum `import` em runtime, nenhuma chamada de rede, `console.*` ou analytics no helper;
- custo limitado: o descarte por tamanho impede O(n·m) com entrada grande (teste de 10 000 caracteres);
- nenhuma regex com backtracking catastrófico (de preferência, nenhuma regex).

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(cadastro): helper de sugestão para domínio de e-mail com erro de digitação" -- FrontEndTorv/src/utils/emailTypo.ts FrontEndTorv/src/utils/emailTypo.test.mjs
```

---

### Task 2: Frontend — `ConfirmModal.cancelLabel` e aviso no `Register`

**Recruit:** Torv Frontend · **Files:**
- Modify: `FrontEndTorv/src/components/ConfirmModal/index.tsx`
- Modify: `FrontEndTorv/src/screens/Register/index.tsx` (`handleNext` ~L80; render do passo 0 ~L162)

**Interfaces:**
- Consumes: `suggestEmailDomain(email: string): string | null` (Task 1), importado de `../../utils/emailTypo`.
- Produces: prop opcional `cancelLabel?: string` no `ConfirmModal` (padrão `'Cancelar'`).

- [ ] **Step 1: `cancelLabel` no `ConfirmModal`**

Adicionar `cancelLabel?: string` às `Props`, com padrão `'Cancelar'`, usado no título do botão de cancelar. Os 10 usos atuais não mudam.

- [ ] **Step 2: Estado e decisão no `Register`**

- Estado `emailSuggestion: string | null` (inicia `null`).
- Em `handleNext`, no passo 0, depois de `validateStep0()` passar: `const suggestion = suggestEmailDomain(email)`. Com sugestão → guarda no estado e **não** avança. Sem sugestão → avança como hoje.

- [ ] **Step 3: Modal**

Renderizar um `ConfirmModal` com:
- `visible={emailSuggestion !== null}`;
- `title="Confira seu e-mail"`, `message={\`Você quis dizer ${emailSuggestion}?\`}`;
- `confirmLabel="Corrigir"`, `cancelLabel="Manter como digitei"`;
- `onConfirm`: `setEmail(emailSuggestion)`, limpa a sugestão, `setStep(1)`;
- `onCancel`: limpa a sugestão, `setStep(1)` (o `ConfirmModal` liga `onRequestClose` a `onCancel`: Esc/"voltar" = manter).

- [ ] **Step 4: Verificar**

Run: `cd FrontEndTorv && node --test src/utils/*.test.mjs && npx tsc --noEmit`
Expected: mesmo total da Task 1, PASS, e `tsc` sem erros. (A tela não tem teste automatizado no projeto; o comportamento é verificado na Task 3.)

- [ ] **Step 5: Revisão de segurança da task**

Conferir e anotar no retorno ao Maestro:
- a sugestão aparece só em `<Text>` (sem HTML, sem `dangerouslySetInnerHTML`);
- nada novo vai para rede, `console.*`, UXCam ou navegação (`route.params`) por causa do aviso;
- o e-mail enviado ao `/auth/register` continua passando pelo `trim` de `handleRegister`.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(cadastro): aviso de domínio de e-mail com erro de digitação no passo 0" -- FrontEndTorv/src/components/ConfirmModal/index.tsx FrontEndTorv/src/screens/Register/index.tsx
```

---

### Task 3: Teste da feature (automatizados + usabilidade no navegador)

**Recruit:** Torv Review and Tests · **Files:**
- Create: `docs/qa-alerta-dominio-email-2026-11-25.md`

- [ ] **Step 1: Automatizados e revisão multi-lente**

Em `FrontEndTorv`: `node --test src/utils/*.test.mjs` e `npx tsc --noEmit` → verdes; anotar os totais. Revisar `git diff main..HEAD` (correção, legibilidade, casos de borda da Review Focus).

- [ ] **Step 2: Ambiente (Maestro)**

Terminal shell **Expo** no canvas: `cd FrontEndTorv && npx expo start --web` (porta 8081). Portal **TorvWeb** em `http://localhost:8081`. Sem backend e sem `.env`.

- [ ] **Step 3: Fluxos reais, um por um** (Login → "Registre-se"; senhas válidas e iguais em todos)

1. `joao@gmial.com` → Continuar → modal "Confira seu e-mail" / "Você quis dizer joao@gmail.com?" → **Corrigir** → passo 1 "Sobre você". Voltar → campo mostra `joao@gmail.com`; Continuar → sem modal.
2. `joao@hotmial.com` → **Manter como digitei** → passo 1. Voltar → campo mostra `joao@hotmial.com`; Continuar → o modal aparece de novo.
3. `joao@gmail.com` e `joao@empresa.com.br` → Continuar → sem modal, passo 1.
4. E-mail vazio ou senhas diferentes → erros atuais, sem modal.
5. `joao@gmial.com` → modal → **Esc** → passo 1 com `joao@gmial.com` (Review Focus 4).
6. Rede (DevTools): tocar em Continuar no passo 0 não dispara nenhuma requisição.
7. 320 px: o modal cabe, sem rolagem horizontal; os dois botões com pelo menos 44 px de altura.
8. Regressão: um `ConfirmModal` antigo (ex.: excluir rotina, se acessível sem login; senão, conferir no código) ainda mostra "Cancelar".

- [ ] **Step 4: Relatório e commit**

Gravar `docs/qa-alerta-dominio-email-2026-11-25.md` com PASS/FAIL por fluxo, a evidência (árvore de acessibilidade, medidas) e os achados com severidade.

```bash
git commit -m "docs(qa): relatório do alerta de domínio de e-mail" -- docs/qa-alerta-dominio-email-2026-11-25.md
```

**Falha:** o ciclo não avança. O Maestro reabre só a task responsável (1 ou 2), numa rodada `-round2`.

---

### Task 4: Security da feature (só com a Task 3 100% verde)

**Recruit:** Torv Security · **Files:**
- Create: `docs/security-alerta-dominio-email-2026-11-25.md`

- [ ] **Step 1: Revisar `git diff main..HEAD` pela lente do OWASP Top 10**

Pontos obrigatórios:
- **Privacidade/LGPD:** o e-mail não sai do aparelho por causa da checagem; nada em log, analytics (UXCam) ou URL.
- **Negação de serviço no cliente:** custo do helper limitado com entrada grande.
- **Injeção/XSS (web):** a sugestão só aparece como texto.
- **Autorização:** nenhuma mudança no servidor; o aviso não substitui a validação do backend (`format: 'email'`, `maxLength: 254`).
- **Segredos:** nenhum no diff.

- [ ] **Step 2: Relatório e commit**

```bash
git commit -m "docs(security): revisão OWASP do alerta de domínio de e-mail" -- docs/security-alerta-dominio-email-2026-11-25.md
```

**Falha:** volta à Task 1 ou 2 (a apontada), depois Task 3 e 4 em nova rodada `-round2`. A feature só termina com Testing e Security verdes na mesma rodada.

---

### Task 5: Segurança completa da branch (Maestro)

- [ ] `/security-review` e `/code-review` (nível `high`) sobre a branch; achados reais corrigidos com teste (volta à Task 1/2).
- [ ] gitleaks no histórico da branch: instalar se faltar (`winget install Gitleaks.Gitleaks`), depois `gitleaks git --log-opts="main..HEAD" -v` → `no leaks found`.
- [ ] Mocks de autenticação: `git diff main..HEAD | grep -iE "mock|fake|bypass"` sem nada de auth.
- [ ] RLS/roles: sem mudança de servidor ou banco nesta feature (registrar no documento de revisão).
- [ ] Sonar: o repositório não tem configuração do Sonar. Sem acesso informado pelo desenvolvedor, fica em "Não verificado".

### Task 6: Auditoria final de brechas (Maestro, só com a Task 5 limpa)

- [ ] Skill `security-audit` sobre a branch, saída em `~/security-audit-skill/torv/run-N/` (fora do repositório, nunca commitada), sem nenhum `.env` de produção carregado.
- [ ] Achado `confirmed` bloqueia: teste que reproduz → correção → re-rodar (Tasks 3–6). `needs_validation` vai para "Não verificado / pendências".

### Task 7: Fechamento (Maestro)

- [ ] Documentação: sem contrato de API novo (nada em `specs/`). README: uma linha na seção de rotas do front citando o aviso no `Register`. Commit `docs(readme): ...`.
- [ ] `graphify update .` e commit do `graphify-out/`.
- [ ] `revisar-2026-11-25-alerta-dominio-email.md` na raiz (fora do git): o que mudou, como foi testado, segurança (ciclos + auditoria), decisões (sua × minha), achados e o que **não** foi verificado (ex.: aparelho Android físico, Sonar).
- [ ] PR com `superpowers:finishing-a-development-branch`.
- [ ] Relatório de tempo em `~/Downloads/tempo-torv-alerta-dominio-email.html` (fora do repositório).

---

## Acompanhamento no canvas (Maestro, durante toda a execução)

Antes da Task 1, o Maestro:
- recruta **Torv Frontend**, **Torv Review and Tests** e **Torv Security** (preset "Claude Code", `claude --model sonnet --effort high`), mais o terminal shell **Expo** e o portal **TorvWeb**;
- roda `npm ci` em `FrontEndTorv`;
- cria a nota **"Feature- Alerta domínio e-mail"** com a etapa (Edit / Test / Security), o recruit rodando, o resultado da última rodada (link do relatório em `docs/`) e, em retrabalho, a task reaberta e o motivo.

A nota é atualizada a **cada** transição de etapa.
