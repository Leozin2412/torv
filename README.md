# Torv

Torv é um aplicativo focado em registro de refeições, metas nutricionais, acompanhamento da saúde e gamificação. O projeto é dividido em uma aplicação **Front-end (Mobile)** e um **Back-end (API Rest)**.

## 🚀 Tecnologias (Stack)

### Front-end (`FrontEndTorv`)
- **React Native** com **Expo**
- **TypeScript**
- **React Navigation** (Navegação em Stack e Bottom Tabs)
- **Axios** para requisições HTTP
- **Lucide React Native** para ícones

### Back-end (`BackEndTorv`)
- **Node.js** com **Express**
- **Prisma ORM** para modelagem e comunicação com o banco de dados
- **Microsoft SQL Server** como banco de dados principal (utilizando recursos nativos como *Stored Procedures* para cálculos complexos)
- **Multer** para upload de arquivos (como fotos de perfil)
- **JWT (JSON Web Token)** para autenticação de usuários e controle de rotas privadas

---

## 🛠️ Configuração Local

### Pré-requisitos
- Node.js instalado
- Microsoft SQL Server rodando localmente
- Expo CLI instalado (para rodar o aplicativo mobile)

### 1. Clonando e Instalando Dependências

Após clonar o repositório, instale as dependências de cada diretório independentemente:

```bash
# Instalando as dependências do Back-end
cd BackEndTorv
npm install

# Instalando as dependências do Front-end
cd ../FrontEndTorv
npm install
```

### 2. Configurando as Variáveis de Ambiente (Back-end)

Dentro da pasta `BackEndTorv`, crie um arquivo chamado `.env` (este arquivo já é ignorado pelo Git por questões de segurança) e configure-o usando o exemplo abaixo:

```env
# Chave secreta para geração dos tokens JWT
JWT_SECRET="sua_chave_secreta_super_segura"

# URL de Conexão com o SQL Server para o Prisma ORM
# Ajuste conforme a autenticação do seu servidor local:
DATABASE_URL="sqlserver://localhost:1433;database=torv;integratedSecurity=true;trustServerCertificate=true;"
```

### 3. Executando o Projeto

Para testar a aplicação localmente, você deve rodar os dois servidores em terminais separados.

**Iniciando o Back-end:**
```bash
cd BackEndTorv
npm run dev # ou node server.js
```

**Iniciando o Front-end:**
```bash
cd FrontEndTorv
npm start # ou expo start
```

---

## 🛣️ Rotas do Back-end

O Back-end está dividido em contextos para facilitar a manutenção. Abaixo está o detalhamento de como cada rota funciona:

### Autenticação (`/auth`)
Gerencia o registro e entrada de usuários.
- `POST /auth/register` - Registra um novo usuário no sistema, criando o login, perfil inicial e as métricas padrão em uma única transação garantida pelo banco.
- `POST /auth/login` - Autentica o usuário validando a senha e retorna o token JWT de acesso.

### Perfil do Usuário (`/profile`)
Rotas para obter e alterar dados do perfil público e privado do usuário.
- `GET /profile/` - Retorna os dados do perfil do usuário atualmente logado.
- `PUT /profile/` - Atualiza informações do perfil, como idade, objetivo e nível de condicionamento.
- `POST /profile/upload` - Realiza o upload da foto de perfil utilizando o *Multer*, que salva o arquivo fisicamente na pasta `profilePhotos` da máquina servidora.

### Alimentação e Dietas (`/diet`)
Conjunto de rotas que lida com o registro de alimentos e acompanhamento das metas (cálculos delegados às Stored Procedures).
- `GET /diet/` - Retorna a lista de alimentos consumidos (logs) pelo usuário em uma data específica.
- `POST /diet/` - Adiciona um novo registro de alimento (Food Log). Ao inserir, o banco de dados interage com as *Stored Procedures* para processar e atualizar as métricas.
- `PUT /diet/targets` - Atualiza as metas de macronutrientes (Proteínas, Carboidratos, Gorduras) e as Calorias Diárias.
- `PUT /diet/:logId` - Atualiza as informações de um alimento previamente registrado (ex: corrigiu a quantidade de calorias).
- `DELETE /diet/:logId` - Remove o registro de um alimento específico.
- `GET /diet/summary` - **Rota principal do módulo**: Retorna o status consolidado do dia. Executa o cálculo que confronta a Meta Calórica com as Calorias Consumidas e retorna o que Resta, juntamente com o balanço de macronutrientes.
