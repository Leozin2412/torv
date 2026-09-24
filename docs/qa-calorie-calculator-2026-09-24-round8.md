# QA — Calculadora de Calorias e Macros (rodada 8)

**Data:** 2026-09-24
**Recruta:** Torv Review and Tests
**Escopo:** só o commit `75df47f` — *docs(db): replace test password with placeholder in trigger test script*

**Veredito: PASS** — mudou exatamente a linha esperada e não sobrou senha literal em `BancoDeDadosTorv/`.

---

## 1. Só essa linha mudou ✅

```
BancoDeDadosTorv/Testes Procedures e Triggers.sql | 2 +-
1 file changed, 1 insertion(+), 1 deletion(-)
```

A alteração, dentro de um comentário do script:

```diff
---     email: 'carlos.teste@torv.com', password: 'senhaSegura123', email_confirm: true,
+--     email: 'carlos.teste@torv.com', password: '<senha de teste>', email_confirm: true,
```

Conferido também que **nada mais** mexeu no diretório desde a rodada 7:

- `git log f11b372..HEAD -- BancoDeDadosTorv/` → só `75df47f`.
- `git diff --stat f11b372 HEAD -- BancoDeDadosTorv/` → 1 arquivo, 1 linha.
- `git status --short BancoDeDadosTorv/` → vazio (árvore limpa, sem sobra não commitada).

Nenhum outro arquivo, nenhuma migration e nenhum código de produção foram tocados.

## 2. Não sobrou senha literal ✅

Varredura em **todos os 7 arquivos** de `BancoDeDadosTorv/`, incluindo a subpasta `bckp/` que a rodada 7 não tinha coberto:

**Busca por `password|senha|passwd|pwd|secret|token|api_key|credential` (case-insensitive)** — 11 ocorrências, todas legítimas:

| Onde | O que é |
|---|---|
| `Gestao_e_Performance.sql:27,39` | `CREATE ROLE … PASSWORD '<set-at-deploy-time>'` — placeholder |
| `Gestao_e_Performance.sql:14,21,22,36` | prosa, incluindo o aviso de nunca escrever a senha real no arquivo |
| `Mock Dados.sql:18` | `password: '<senha de teste>'` — placeholder (já era) |
| `Mock Dados.sql:32`, `Regras BD.sql:81` | `password_hash` citado como **nome de coluna removida** |
| `SQL BANCO DE DADOS.sql:12` | prosa |
| `Testes Procedures e Triggers.sql:16` | `password: '<senha de teste>'` — a linha corrigida por este commit |
| `bckp/*.sql` | nenhuma ocorrência |

**Busca por credencial sem a palavra "senha/password"** — strings de conexão (`postgres://`, `mysql://`, `sqlserver://`, `mongodb://`), JWT (`eyJ…`), chaves `sk-…`, blobs base64 de 40+ caracteres e `supabase.co`: **nenhum resultado**. O único acerto do padrão foi a palavra `service_role` em prosa no `Mock Dados.sql:14`, explicando qual role usar na Admin API — não é uma chave.

**Busca por literal atribuído a password/senha que não seja placeholder** (`(password|senha)\s*[:=]\s*'[^<]…'`): **nenhum resultado**.

`grep -rn "senhaSegura123" BancoDeDadosTorv/` → não encontrado na árvore atual.

## Observações

- **Falha do meu scan da rodada 7.** Lá eu procurei por `password\s*'[^<]`, padrão que só pega `PASSWORD 'literal'` colado — e por isso passou batido em `password: 'senhaSegura123'`, que usa dois-pontos. A varredura desta rodada é mais larga (palavras-chave + padrões de credencial + subpasta `bckp/`) e não achou mais nada.
- O valor removido continua no histórico do git, como qualquer commit anterior. Era a senha de um usuário de exemplo num comentário de script de teste, não uma credencial de ambiente real — não há nada para rotacionar. Se algum dia tiver sido reutilizada numa conta de verdade, aí sim valeria trocar; isso é decisão do usuário, não algo que este commit resolva.

## Decisão

**PASS.** Escopo exato (1 arquivo, 1 linha, dentro de comentário), árvore limpa e `BancoDeDadosTorv/` sem nenhuma senha ou credencial literal.
