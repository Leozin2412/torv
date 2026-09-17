# QA — Frontend Design Review Fixes, Round 2 (2026-09-17)

Escopo: mesma branch `frontend/design-review-fixes` (sem commit), rework do round 1 (`docs/qa-frontend-design-review-fixes-2026-09-17.md`). Verificação por leitura de código + `tsc --noEmit` + **passada de usabilidade ao vivo completa** nas 5 telas via Maestri portal (`localhost:8081`, 390x835), com `BackEndTorv` rodando na porta 3000 (Furnace).

## Os 4 pontos do rework

| Ponto | Onde | Status |
|---|---|---|
| H1 — Card aninhado em Card | `Home/index.tsx` (exploreCard/placeCard) | ✅ **Fixed**, confirmado ao vivo |
| M1 — emoji restante fora dos icon-containers | `Home/index.tsx` (nameText, feedContent) | ✅ **Fixed**, confirmado ao vivo |
| M2 — `textSecondary` ainda Apple systemGray | `theme/tokens.ts` + `routes/index.tsx` | ✅ **Fixed**, confirmado ao vivo |
| M3 — `Button.danger` acoplado a `outline` | `components/Button/index.tsx` | ✅ **Fixed**, confirmado ao vivo |

### H1 — Card aninhado
`Home/index.tsx:239` — `placeCard` voltou a ser `View` simples dentro do único `<Card style={styles.exploreCard}>`. Confirmado via inspeção da árvore DOM ao vivo: só um nível tem `box-shadow`/`border` (o `Card` externo, `rgb(28,28,30)`); `placeCard` (agora `View`, `rgb(44,44,46)`) não carrega sombra/borda própria. Sem duplicação visual.

### M1 — emoji restante
`grep` por emoji (`\x{1F300}-\x{1FAFF}`, `\x{2600}-\x{27BF}`) em todo `src/` retorna zero arquivos. `nameText` (linha 71) agora usa ícone `Hand` (lucide) ao lado do nome; `feedContent` (linha ~205) usa `Dumbbell` (lucide). Confirmado ao vivo: texto da Home renderizado sem nenhum emoji.

### M2 — paleta
`theme/tokens.ts:10` — `textSecondary: '#8F958A'` (comentário no próprio arquivo: "substitui o systemGray do iOS"). `grep -rn "8E8E93" src/` — zero ocorrências em todo o projeto, incluindo o hardcode que tinha sobrado em `routes/index.tsx`. Cor própria, não mais Apple HIG.

### M3 — Button danger
`components/Button/index.tsx` — `danger` e `outline` agora são independentes: `isSolidDanger = danger && !outline` dá variante sólida (`backgroundColor: colors.error`, texto branco); `isOutlineDanger = outline && danger` mantém a variante outline vermelha para quem precisar. Confirmado ao vivo no modal de exclusão do MyDiet: botão "Excluir" agora é **vermelho sólido** (`rgb(255,69,58)`, texto branco, sem borda) ao lado do "Cancelar" outline verde — visualmente distintos e semanticamente corretos para uma ação destrutiva. Fluxo de exclusão testado ponta a ponta (criar refeição → excluir → modal fecha → lista volta ao empty state) e funciona.

## Reconfirmação dos 10 achados originais

Nenhuma regressão. Sweep em todo `src/` depois do rework:
- `grep -rn "FF3B30" src/` → zero (achado #6 continua ok, erro só usa o token unificado).
- `grep -rn "textTransform: 'uppercase'" src/` → zero (achado #4 continua ok).
- `grep` de emoji em todo `src/` → zero arquivos (achado #7 agora 100%, não só nos 3 pontos originais).

Confirmado ao vivo, tela por tela:
- **Login**: título "Bem-vindo(a) ao TORV!" em cor única, fonte Sora aplicada (#2, #5 ok).
- **Register**: fluxo completo (steps 0-5) testado com cadastro real — ícones `Mars`/`Venus` no step de gênero (#11), níveis "Iniciante/Intermediário/Avançado" sem uppercase (#4), sem highlight de palavra. Cadastro concluído com sucesso, redirecionou para Login.
- **Home**: login efetuado, dados reais carregados (0 kcal consumidas, sem número falso tipo 1840/2400/560 — #9 confirmado no caminho de sucesso), `accessibilityLabel="Mais opções da publicação"` presente (#10), cards compõem `Card` sem duplicar receita visual (#3).
- **MyDiet**: empty state "Nenhuma refeição ainda — Você ainda não registrou nada hoje." idêntico ao do Profile (#12); labels dinâmicos `Editar refeição {nome}`/`Excluir refeição {nome}` presentes e corretos (#10); macros "Proteína"/"Carboidratos"/"Gordura" sem uppercase (#4).
- **Profile**: `accessibilityLabel` em todos os ícone-botões — "Sair da conta", "Alterar foto de perfil", "Editar nome de usuário", "Editar objetivo" (#10); "Este mês" sem uppercase (#4); empty state de refeições idêntico ao MyDiet (#12).

## `tsc --noEmit`

Mesmos 3 erros do round 1, todos pré-existentes em `main` (não neste diff, não tocados pelo rework): `Login/index.tsx:69` (`absoluteFillObject`), `MyDiet/index.tsx:97,99` (`macros.protein`/`macros.fat`). Nenhum erro novo introduzido pelo rework. Seguem fora de escopo, registrados para ticket de limpeza técnica separado.

## Itens LOW do round 1 (não bloqueantes, não pedidos neste rework)

Não verificados novamente neste round por não fazerem parte do escopo pedido — seguem como estavam: `fontWeights` export morto em `tokens.ts` (L1), hex hardcoded `#1F3A15` em `SelectCard` (L2). Nenhum dos dois impede a liberação para Security; podem ser tratados num cleanup futuro.

## Cobertura de testes

Sem mudança desde o round 1 — projeto não tem suíte de testes (`FrontEndTorv`). Gap estrutural pré-existente, não introduzido por este diff, não coberto aqui por estar fora do escopo do rework pedido.

## Veredito

**100% verde neste round.** Os 4 pontos apontados no round 1 foram corrigidos corretamente e confirmados tanto por leitura de código quanto por renderização ao vivo (login real, cadastro real, CRUD de refeição real, navegação pelas 5 telas). Os 10 achados originais continuam intactos, sem regressão. TypeScript sem erros novos.

**Libera para Security.**
