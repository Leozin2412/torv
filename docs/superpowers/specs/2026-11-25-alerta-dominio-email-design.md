# Alerta de domínio de e-mail com erro de digitação — design (curto)

Data: 2026-11-25 · Branch: `feature/cadastro-confirmacao-email` · Status: aprovado pelo desenvolvedor em 2026-11-25

## Intenção
No cadastro, quem digita `joao@gmial.com` cria a conta, mas nunca recebe o código de confirmação.
Queremos avisar sobre erros de digitação em domínios de e-mail populares **antes de continuar**,
sem impedir o cadastro.

## Objetivos
- Detectar erro de digitação em domínios populares no passo 0 do cadastro (`Register`).
- Mostrar um aviso com a sugestão; o usuário decide se corrige ou mantém.

## Fora do escopo
- Validar se o domínio existe (DNS/MX) ou se a caixa de e-mail existe.
- Aviso na tela de Login ou em outras telas.
- Erros de TLD em domínios fora da lista (ex.: `empresa.con`).
- Qualquer mudança no back-end.

## Anti-objetivos
- Bloquear o cadastro por causa do aviso.
- Enviar o e-mail digitado para qualquer serviço externo para checagem.

## Abordagens consideradas
1. **Helper local no front + `ConfirmModal` (escolhida).** Lista fixa de domínios + distância de edição.
   Sem rede, sem dependência nova, testável com `node --test`.
2. Biblioteca pronta (ex.: mailcheck). Faz o mesmo, mas adiciona dependência para poucas linhas de código.
3. Checagem no back-end. Exigiria ida ao servidor antes de "Continuar" e mexeria no contrato da API
   sem necessidade: o aviso é só de usabilidade.

## Design
- **`FrontEndTorv/src/utils/emailTypo.ts`** exporta `suggestEmailDomain(email: string): string | null`.
  - Domínios conhecidos (ordem = prioridade no empate): `gmail.com`, `hotmail.com`, `outlook.com`,
    `yahoo.com.br`, `yahoo.com`, `icloud.com`, `live.com`, `hotmail.com.br`, `outlook.com.br`,
    `uol.com.br`, `bol.com.br`, `terra.com.br`.
  - Compara o domínio (depois do último `@`, com `trim` e minúsculas) usando distância de
    Damerau-Levenshtein (transposição conta 1).
  - Domínio exatamente na lista → `null`. Menor distância entre 1 e 2 → devolve o e-mail sugerido
    (parte local como foi digitada + domínio da lista). Distância > 2, sem `@` ou domínio vazio → `null`.
- **`FrontEndTorv/src/utils/emailTypo.test.mjs`**: casos `gmial.com`, `gmail.co`, `hotmial.com`,
  `outlok.com`, `yaho.com.br`, maiúsculas, domínio exato, domínio desconhecido, sem `@`, parte local preservada.
- **`ConfirmModal`** ganha a prop opcional `cancelLabel` (padrão `'Cancelar'`); as telas atuais não mudam.
- **`Register`, passo 0:** em `handleNext`, depois que `validateStep0()` passa, chama `suggestEmailDomain(email)`.
  Com sugestão, abre o `ConfirmModal`:
  - título "Confira seu e-mail", mensagem "Você quis dizer {sugestão}?";
  - **Corrigir** (botão principal): troca o e-mail pela sugestão e avança para o passo 1;
  - **Manter como digitei** (`cancelLabel`): avança com o e-mail como está.
  Sem sugestão, avança como hoje.

```
┌──────────────────────────────┐
│ Confira seu e-mail           │
│ Você quis dizer              │
│ joao@gmail.com?              │
│ [ Corrigir ]                 │
│ [ Manter como digitei ]      │
└──────────────────────────────┘
```

## Decisões
- Do desenvolvedor: só aviso, nunca bloqueio; foco em domínios famosos.
- Minhas (o desenvolvedor pode corrigir):
  - Botão **Corrigir** que troca o domínio (poupa redigitar).
  - Lista com foco no Brasil e limite de distância 2.
  - Fechar o modal pelo "voltar" do Android equivale a "Manter como digitei" (o `ConfirmModal` liga
    `onRequestClose` a `onCancel`). O e-mail aparece de novo na tela de confirmação de código.
  - Domínio real parecido com um da lista (ex.: `love.com`) recebe o aviso; o usuário toca em "Manter".

## Segurança e LGPD
- O e-mail não sai do aparelho por causa desta checagem e não é logado.
- Nenhuma dependência nova. Nada muda na autorização ou no servidor.

## Deixado para o construtor
- Nomes internos de estado/handlers no `Register`.
- Estilo segue o `ConfirmModal` existente; sem componente novo.
