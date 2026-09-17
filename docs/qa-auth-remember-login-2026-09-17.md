# QA — Remember Login & Auto-Login (2026-09-17)

Escopo: diff não commitado em `auth/remember-login-and-auto-login` (vs `main`, pós-merge de `frontend/design-review-fixes`). 5 arquivos: `AuthContext.tsx`, `App.tsx`, `Register/index.tsx` (frontend) + `auth.controller.js`, `auth.routes.js` (backend). Revisão de código completa + `tsc --noEmit` + verificação de sintaxe do backend + passada de usabilidade ao vivo via Maestri portal (`localhost:8081`) com `BackEndTorv` rodando na porta 3000.

## Revisão de código

**Backend — `/auth/register` agora emite token (auth.controller.js:70-91)**
Mirror exato do que `login()` já fazia: mesmo `jwt.sign` (mesmo secret, mesmo `expiresIn: '7d'`), mesmo shape de `user` (`id/email/name/username/photo_url/profile`). Verificado em `auth.repository.js:createUser` que o `include: { user_profiles: true }` já populava a relação — `name`/`username` no retorno do registro são os valores reais recém-criados, não `null` por relação não carregada.

**Backend — `registerSchema` 201 (auth.routes.js:34-45)**
Schema atualizado bate exatamente com o novo retorno do controller e é idêntico ao `loginSchema` 200 (mesmo `userProfileSchema` compartilhado). Bug de serialização Fastify do meio do ciclo (schema antigo só esperava `message`+`userId`, contrato quebraria em runtime com o objeto novo) — confirmado corrigido.

**Frontend — `AuthContext.tsx`**: `loading` inicia `true`, só vira `false` depois que a Promise do `AsyncStorage.getItem` resolve (achou ou não achou sessão) — os dois caminhos cobertos, sem branch que deixe `loading` preso em `true`. `login()`/`logout()` não mexem em `loading`, então o gate só afeta o boot inicial, não pisca de novo em ações do usuário depois.

**Frontend — `App.tsx`**: gate (`if (loading) return <LoadingScreen />`) fica antes de montar `<Routes />`, reaproveitando o mesmo spinner que já existia para `fontsLoaded`. `Routes` (que decide `signed ? AppRoutes : AuthRoutes`) só monta depois que a sessão já foi restaurada (ou confirmada como inexistente) — elimina a janela em que `Routes` montaria com `signed=false` transitório antes do `AsyncStorage` resolver.

**Frontend — `Register/index.tsx:105-118`**: troca `navigation.goBack()` por `login(response.data.token, response.data.user)`, mesmo padrão que `Login/index.tsx:45` já usa. Nenhuma divergência de uso.

**Nenhum bug encontrado no diff.** Único ponto de nota, não bloqueante:
- **LOW — duplicação do fallback de `JWT_SECRET`**: `auth.controller.js:72` e `:119` (login) repetem o mesmo literal hardcoded `'uma_frase_longa_com_letras_numeros_e_simbolos_bem_aleatorios'` como default caso `process.env.JWT_SECRET` falte. Pré-existente em `login()` (confirmado via `git show main`), este diff só copiou o padrão para `register()` em vez de extrair para uma constante compartilhada. Não é uma regressão nova, mas duplicar em vez de fatorar era a chance de resolver — sugestão de limpeza futura, não bloqueia este round.

## `tsc --noEmit` / sintaxe backend

- Frontend: mesmos 3 erros pré-existentes de rounds anteriores (`Login/index.tsx:69`, `MyDiet/index.tsx:97,99`), nenhum novo, nenhum nos arquivos deste diff.
- Backend: `node -c` limpo nos dois arquivos alterados.

## Passada de usabilidade ao vivo (Maestri portal, `localhost:8081`, backend ativo na 3000)

**(a) Reload com sessão salva → sem flash de Login.** Confirmado com evidência direta: snapshot imediatamente após reload capturou o app em `title: "FrontEndTorv"` mostrando só o spinner (`LoadingScreen`); snapshot seguinte (+1s) já mostra `title: "Home"` com dados carregados. Em nenhum momento entre as duas capturas o título ou conteúdo foi `Login` — a transição é spinner → Home direto.

**(b) Cadastro completo (e-mail novo) → cai direto na Home, sem passar por Login.** Fluxo completo testado via UI (steps 0-5, e-mail `qa-authflow-*@example.com`): ao submeter o step final, tela vai direto para `Home` com tab bar visível — nunca passa pela tela de Login. Saudação mostra o primeiro nome do cadastro ("Boa tarde, QA"), confirmando que `login(token, user)` populou o contexto corretamente.

**(c) Login normal continua funcionando.** Logout da conta recém-criada + login manual com o mesmo e-mail/senha → volta pra Home normalmente, mesmo fluxo de sempre.

**(d) Logout continua funcionando.** "Sair da conta" no Profile → volta pra tela de Login/landing, tab bar some.

**(e) Token do registro funciona para chamada autenticada real.** Verificação extra via `curl` direto no backend (fora da UI, prova mais forte que inferência via app):
```
POST /auth/register → 201, token JWT válido retornado
GET /diet/summary com "Authorization: Bearer <token do registro>" → 200 OK
{"date":"2026-09-17","targets":{...},"consumed":{...},"remaining":{...},"logs":[]}
```
Sem 401, sem erro de assinatura/formato — o token emitido no registro é aceito pelo middleware de autenticação exatamente como o token de login. Confirmado também indiretamente pela UI: a Home carregou dados reais (não estado de erro, não fallback) imediatamente após o cadastro, usando esse mesmo token.

## Veredito

**100% verde.** Nenhum achado bloqueante. Diff pequeno e correto: reaproveita exatamente o padrão já existente no login (mesmo shape de token/user, mesmo componente de loading), sem introduzir superfície nova de risco. Único ponto anotado (duplicação do fallback de `JWT_SECRET`) é cosmético/DRY, não funcional nem de segurança nova (já existia em login).

**Libera para Security.**
