# Revisão de Design — FrontEndTorv (2026-09-17)

Revisão de todas as 5 telas (`Login`, `Register`, `Home`, `MyDiet`, `Profile`) e dos 5 componentes compartilhados (`Button`, `Card`, `Input`, `ProgressBar`, `SelectCard`), usando a lente do skill `frontend-design`. Escopo: estética, consistência entre telas, usabilidade básica. Nenhum código foi alterado.

## Achados priorizados

### 1. A paleta é o Apple HIG dark mode, não uma identidade TORV
`#FF3B30` (systemRed), `#FF9500` (systemOrange), `#FFCC00` (systemYellow), `#AF52DE` (systemPurple), `#0A84FF` (systemBlue), `#FF2D55` (systemPink), `#8E8E93` (systemGray) — todas as cores de apoio do app são os tokens de sistema do iOS copiados, não escolhas feitas para o TORV. Só o verde `#8CC63F` é uma cor própria. Resultado: qualquer app com esse conjunto de cores parece a mesma coisa.
- Onde: `src/screens/*/styles.ts` (macros em `MyDiet`, erro em quase toda tela, gênero em `Register`)
- Sugestão: definir uma paleta de apoio própria (2-3 cores de status/dado) e manter só o `#8CC63F` como âncora reconhecível.

### 2. Nenhuma escolha tipográfica — é a fonte default do sistema
Não há `fontFamily` em nenhum arquivo `styles.ts`. Toda a hierarquia é feita só variando `fontSize`/`fontWeight` (`'bold'`, `'500'`, `'600'`, `'900'` misturados sem escala definida) sobre a fonte padrão da plataforma (San Francisco/Roboto).
- Onde: todos os `screens/*/styles.ts`
- Sugestão: escolher 1 família de display expo-google-fonts (ex: algo com personalidade fitness/energia) e definir uma escala de peso (400/600/800) usada de forma consistente.

### 3. "SaaS-card kit" repetido em vez do componente `Card` já existente
Existe um componente `Card` (`components/Card`) com `bg #1C1C1E, radius 16, padding 16, shadow`. Ele é usado por praticamente ninguém — em vez disso, cada tela redefine a mesma receita visual localmente: `streakCard`, `workoutCard`, `walkCard`, `caloriesSection`, `feedCard`, `exploreCard`, `placeCard` (Home), `mealCard`, `mainCaloriesCard`, `macroCard`, `dateItem` (MyDiet), `gridCard`, `listCard` (Profile) — mais de 12 variações do mesmo cartão cinza-escuro com cantos arredondados, sem hierarquia entre elas.
- Onde: `src/screens/Home/styles.ts`, `src/screens/MyDiet/styles.ts`, `src/screens/Profile/styles.ts`
- Sugestão: fazer essas telas comporem o `Card` existente (com props de variante quando preciso), em vez de duplicar o estilo. Reduz também o raio de canto inconsistente (12/16/20/24/25/90 usados sem escala).

### 4. Label em CAIXA ALTA — tell clássico de design genérico
`textTransform: 'uppercase'` em `streakTitle`, `workoutTitle`, `gridCardTitle`; strings literais em caixa alta como "STREAK🔥", "TREINO DE HOJE", "ESTE MÊS", "INICIANTE"/"INTERMEDIÁRIO"/"AVANÇADO".
- Onde: `Home/styles.ts:53-59,79-85`, `Profile/styles.ts:173-179`, `Register/index.tsx:198-217`
- Sugestão: usar peso/tamanho para hierarquia em vez de caixa alta; reservar isso só se o conteúdo for de fato uma categoria/etiqueta técnica.

### 5. Palavra destacada em cor dentro do título — outro tell direto
"Bem-vindo(a) ao **TORV!**" na landing do Login, com "TORV!" em verde de destaque dentro da frase — exatamente o padrão que o skill lista como tell mais comum de headline gerado.
- Onde: `Login/index.tsx:72`, `Login/styles.ts:59-61` (`landingTitleHighlight`)
- Sugestão: ou o título inteiro assume o peso visual, ou o destaque vem de tipografia/tamanho, não de uma palavra colorida isolada.

### 6. Vermelho de erro inconsistente entre telas
`#FF3B30` é usado para erros/delete em `Login`, `Register`, `MyDiet` (textos de erro, botão excluir); mas o componente `Input` usa `#FF453A` para a borda e o texto de erro do próprio campo. Duas cores diferentes para o mesmo significado semântico.
- Onde: `components/Input/styles.ts:28` vs. `screens/*/index.tsx` (inline `{ color: '#FF3B30' }`)
- Sugestão: um único token de erro.

### 7. Emoji funcionando como ícone, ao lado de ícones vetoriais (lucide)
`Home` e `Profile` usam `lucide-react-native` para a maioria dos ícones, mas também usam emoji cru (🔥 👋 🍗 🥖 🍔 💪 ⌚ 🚶‍♂️ 🍽️ ⚡) dentro dos mesmos containers de ícone (`listCardIconContainer`, títulos de card). Emoji renderiza diferente por SO/dispositivo e quebra a consistência visual (peso, cor, alinhamento) que os ícones lucide têm.
- Onde: `Home/index.tsx:82,88,249` (STREAK🔥, TREINO DE HOJE, Total Calorias ⚡), `Profile/index.tsx:217-265` (grid e list cards)
- Sugestão: escolher um sistema só; se emoji for intencional (tom mais descontraído), não misturar com ícones vetoriais no mesmo papel visual.

### 8. Estilo inline espalhado, fora do padrão `index.tsx`/`styles.ts` do projeto
O `CLAUDE.md` do projeto define `styles.ts` como dono de todo `StyleSheet`, mas há blocos grandes de estilo inline direto no JSX — ex.: os botões do modal de confirmação de exclusão em `MyDiet` (linhas 401-415) reimplementam do zero um botão outline e um botão destrutivo em vez de usar o componente `Button` já existente.
- Onde: `MyDiet/index.tsx:130,251,312,391-416`, `Home/index.tsx` (vários `style={{...}}`), `Profile/index.tsx:190,230-234,300-306`
- Sugestão: mover para `styles.ts`; usar `Button` (com uma variante "danger"/outline) em vez de recriar o botão inline.

### 9. Fallback silencioso para dados falsos quando a API falha
Em `Home`, se `GET /diet/summary` falhar, o `catch` preenche a tela com números fixos e plausíveis (`1840/2400/560 kcal`) sem nenhuma indicação de erro — o usuário vê dados que parecem reais mas não são, sem saber que a chamada falhou.
- Onde: `Home/index.tsx:41-46`
- Sugestão: tratar como estado de erro visível (ex: "não foi possível carregar", com retry), nunca mascarar com número inventado.

### 10. Botões/ícones sem rótulo de acessibilidade
Botões só-ícone (editar avatar, fechar modal `X`, "mais opções" `MoreHorizontal`) não têm `accessibilityLabel`/`accessibilityRole`, então leitores de tela não anunciam sua função.
- Onde: `Profile/index.tsx:185,321,360`, `Home/index.tsx:165`, `MyDiet/index.tsx:326,363`
- Sugestão: adicionar `accessibilityLabel` nos `TouchableOpacity` só-ícone.

### 11. Botões de gênero (Register) com centralização manual frágil
Círculos de 180×180 usando glyphs unicode ♂/♀ em `fontSize: 90`, com `marginLeft:-8, marginTop:-8` para "compensar" o glifo do símbolo masculino — hack visual que pode desalinhar em fontes/dispositivos diferentes.
- Onde: `Register/index.tsx:181`, `Register/styles.ts:69-73`
- Sugestão: usar um ícone vetorial (lucide já está na dependência) em vez do glifo de texto.

### 12. Estado vazio inconsistente entre telas que mostram as mesmas refeições
`Profile` tem uma mensagem de vazio cuidada ("Nenhuma refeição ainda — Você ainda não registrou nada hoje."); `MyDiet`, que lista os mesmos dados, não tem nenhum estado vazio — a lista some e só o botão "Adicionar Refeição" fica visível, sem explicação.
- Onde: `MyDiet/index.tsx:287-318`
- Sugestão: replicar a mensagem de vazio do `Profile` em `MyDiet`.

## Achados menores
- Texto secundário `#8E8E93` sobre fundo `#121212`/`#1C1C1E` em `fontSize: 12` é o tamanho mais comum do app para labels — contraste está no limite para leitura confortável em telas pequenas.
- Nenhum token central de cor/raio — `#8CC63F` e `#121212` estão hardcoded dezenas de vezes em 10 arquivos `styles.ts` diferentes; mudar a cor de marca hoje exige editar tudo manualmente.
- Raio de canto sem escala: 12, 16, 20, 24, 25 e 90 (círculo) coexistem sem critério aparente de quando usar cada um.

## Resumo
O app tem uma base funcional consistente (fundo escuro, verde de marca reconhecível, componentes básicos existem), mas a identidade visual em si é majoritariamente "default": paleta emprestada do iOS, sem tipografia própria, e o padrão de cartão genérico repetido em vez do componente `Card` já existente no projeto. Prioridade sugerida se for para implementação: itens 1-3 (paleta, tipografia, reuso de `Card`) resolvem a maior parte da sensação "genérica"; item 9 é o único achado com risco real (dado falso mascarando erro de API).
