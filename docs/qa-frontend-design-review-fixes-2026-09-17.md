# QA — Frontend Design Review Fixes (2026-09-17)

Escopo: diff não commitado em `frontend/design-review-fixes` (vs `main`) implementando os 12 achados de `docs/frontend-design-review-2026-09-17.md`. Revisão multi-lente (correctness, framework/RN, a11y+security) + `tsc --noEmit` + passada de usabilidade via Maestri portal (`localhost:8081`, viewport 390x844).

## Resultado por achado

| # | Achado | Status |
|---|---|---|
| 1 | Paleta própria (theme/tokens.ts) | **Parcial** — ver M2 |
| 2 | Fonte Sora | ✅ Fixed, verificado ao vivo |
| 3 | Telas compõem `Card` existente | ✅ Fixed (com ressalva — ver H1) |
| 4 | Remoção de uppercase labels | ✅ Fixed |
| 5 | Login sem palavra destacada no título | ✅ Fixed, verificado ao vivo |
| 6 | Vermelho de erro unificado | ✅ Fixed |
| 7 | Emoji → lucide em icon-containers | **Parcial** — ver M1 |
| 8 | Inline style → styles.ts + `Button danger` | ✅ Fixed (prop funciona — ver M3) |
| 9 | Home: erro real em vez de fallback falso | ✅ Fixed, código verificado |
| 10 | `accessibilityLabel` em icon-buttons | ✅ Fixed, todos os pontos cobertos |
| 11 | Register gênero com ícone lucide | ✅ Fixed, verificado ao vivo |
| 12 | Empty state MyDiet | ✅ Fixed, condição correta |

10/12 completos e limpos. 2 parciais (não bloqueantes, mas na mesma linha do achado original — devem ser fechados antes de considerar o item "resolvido").

## Findings ranqueados

### HIGH

**H1 — Card aninhado dentro de Card, sombra/borda duplicada**
`FrontEndTorv/src/screens/Home/index.tsx:223,239`
`<Card style={styles.exploreCard}>` envolve `<Card style={styles.placeCard}>`. `Card/styles.ts` dá sombra (`shadowColor/Offset/Opacity/elevation`) + `borderWidth:1` a toda instância — algo que as antigas `View`s planas não tinham. O Card interno passa a "flutuar" com sombra própria sobre o mesmo `colors.surface` do Card externo — artefato visual novo, não existia antes da migração para `Card`. `exploreCard` também define `overflow:'hidden'`, o que corta a própria sombra do Card externo no iOS — estilo morto, mas inofensivo.
Cenário: usuário abre Home → seção "Explorar" mostra um card com borda/sombra visível dentro de outro card idêntico visualmente, parecendo elemento desalinhado.
Sugestão: não envolver `placeCard` em `Card`, ou dar ao `Card` uma prop para desligar sombra/borda em uso aninhado.

### MEDIUM

**M1 — Emoji ainda presentes ao lado de ícones lucide (achado #7 incompleto)**
`FrontEndTorv/src/screens/Home/index.tsx:71,203`
`{primeiroNome}👋` (linha 71) e "Corrida matinal feita! 💪 Cada km conta." (linha 203) continuam com emoji cru na mesma tela que usa `Flame`/`Play`/`Activity` (lucide). Os 3 pontos citados no doc original (STREAK🔥, TREINO DE HOJE, Total Calorias⚡) foram corrigidos, mas o problema de fundo — mistura de sistemas de ícone — continua presente em outros dois pontos do mesmo arquivo. `Profile.tsx` está 100% limpo.
Sugestão: mesma correção, aplicada às linhas 71 e 203.

**M2 — Cor de apoio ainda copiada do Apple HIG (achado #1 incompleto)**
`FrontEndTorv/src/theme/tokens.ts:10`
`textSecondary: '#8E8E93'` é o `systemGray` do iOS, byte a byte — exatamente o token que o doc de review cita nominalmente para substituição, junto com os outros 6 que foram trocados. É a cor de texto secundário usada no app inteiro (labels, legendas), então é o token de maior visibilidade que ficou para trás.
Sugestão: definir um cinza próprio da paleta TORV para `textSecondary`.

**M3 — `Button danger` acoplado a `outline`, sem variante sólida**
`FrontEndTorv/src/components/Button/index.tsx:14`
`const outlined = outline || danger;` — não existe caminho para um botão vermelho preenchido/sólido, só outline vermelho. Funciona no único call site atual (`MyDiet/index.tsx:329`, modal de exclusão, onde o botão ao lado também é outline) mas a prop não é documentada como "outline-only" e diverge da semântica independente/composável de `outline`. Qualquer CTA destrutivo sólido futuro não dá pra construir com essa prop sem refatorar.

### LOW

**L1 — `fontWeights` export morto em tokens.ts**
`FrontEndTorv/src/theme/tokens.ts:35-39`
Zero importadores no `src/` inteiro — todo lugar usa `fontFamily.regular/semiBold/extraBold` diretamente. Não é bug, só código sem uso.

**L2 — Cor hardcoded não tokenizada em SelectCard**
`FrontEndTorv/src/components/SelectCard/index.tsx:24`
`'#1F3A15'` (início do gradiente) não é um token; visualmente próximo mas distinto de `colors.brandTint` (`#1F2916`). Provavelmente intencional (tom ligeiramente diferente para o gradiente), mas vale uma confirmação de 1 linha com quem escolheu.

## Fora de escopo (pré-existente, não introduzido por este diff)

`tsc --noEmit` acusa 3 erros reais de compilação, mas os 3 já existiam em `main` antes deste branch (confirmado via `git show main:<arquivo>`) e não fazem parte dos 12 achados nem foram tocados pelo diff:
- `Login/index.tsx:69` — `StyleSheet.absoluteFillObject` não existe (é `absoluteFill`).
- `MyDiet/index.tsx:97,99` — acesso a `macros.protein`/`macros.fat` num objeto tipado só com `proteins`/`fats`.

Não bloqueiam este round, mas ficam registrados para não se perderem — recomenda-se um ticket de limpeza técnica separado.

## Cobertura de testes

Não existe suíte de testes no `FrontEndTorv` (sem script `test` no `package.json`, zero arquivos `*.test.*` no repositório). Gap pré-existente, não uma regressão deste diff. Não escrevi uma suíte nova aqui (fora de escopo do que foi pedido — feature de UI/estilo, sem lógica nova além do estado de erro do Home) mas fica registrado como lacuna estrutural do projeto.

## Passada de usabilidade (Maestri portal, `localhost:8081`, 390x844)

Fluxo Login → Register testado ao vivo:
- **Login (landing)**: renderiza corretamente, fonte `Sora_800ExtraBold` carregada e aplicada, título em cor única sem palavra destacada isolada. Confirma achados #2 e #5.
- **Login (formulário)**: renderiza sem problemas.
- **Register (steps 0–3)**: todos os campos renderizam com a fonte correta; no step 3 (gênero), ícones `Mars`/`Venus` (lucide) aparecem a 64×64px, centralizados via flexbox (`justifyContent/alignItems: center`), sem hack de margem manual. Confirma achado #11.

**Não foi possível** completar o cadastro nem alcançar Home/MyDiet/Profile ao vivo: o `BackEndTorv` não está rodando (porta 3000 inacessível) e essas telas exigem autenticação. A verificação de Home/MyDiet/Profile (Card, estado de erro #9, empty state #12, labels de acessibilidade #10) foi feita por leitura de código pelas lentes de correctness/framework, não por renderização ao vivo. **Isso é uma lacuna real desta rodada** — recomenda-se repetir a passada visual dessas 3 telas assim que o backend estiver disponível, antes de considerar a usabilidade 100% validada.

## Veredito

**Não avança para Security ainda.** H1 é um bug visual real introduzido pela própria migração para `Card` (item 3), e M1/M2 são achados do doc original que ficaram incompletos — mesma categoria do problema que o doc pediu para resolver. Rework fica escopado ao Frontend:
- H1: desaninhar Card em Home (linhas 223/239).
- M1: trocar 👋/💪 por ícone lucide em Home (linhas 71/203).
- M2: tokenizar `textSecondary`.
- M3: opcional neste round, mas recomendo desacoplar `danger` de `outline` no Button antes de outro call site depender do comportamento atual.

Depois do rework: novo round de teste (`-round2`) cobrindo só os pontos acima + a passada visual pendente de Home/MyDiet/Profile com backend ativo.
