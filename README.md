# CRM SaaS Profissional

Estrutura inicial de um sistema CRM SaaS profissional com backend em Node.js + Express, banco PostgreSQL e frontend em HTML, CSS e JavaScript com Bootstrap.

## Estrutura do projeto

```bash
/frontend
/backend
/database
```

## Backend

O backend foi organizado com separação por responsabilidade:

- `server.js`: inicialização da API Express.
- `config/db.js`: conexão com PostgreSQL usando `pg`.
- `routes/`: rotas separadas para `auth`, `clientes`, `visitas` e `vendas`.
- `controllers/`: regras de negócio iniciais para cada módulo.
- `middlewares/authMiddleware.js`: validação do JWT para proteger rotas e reaproveitar o `empresa_id` do usuário autenticado.

### Autenticação JWT

O fluxo de autenticação agora funciona assim:

1. O usuário envia `email` e `password` para `POST /api/auth/login`.
2. O backend consulta o usuário no PostgreSQL e valida a senha com `bcrypt`.
3. Em caso de sucesso, o backend gera um token JWT com `empresa_id`, `id`, `email` e `nivel`.
4. O frontend salva o token no `localStorage`.
5. As rotas protegidas usam `Authorization: Bearer <token>` e o backend sempre utiliza o `empresa_id` do token para isolar os dados da empresa logada.

## Frontend

O frontend contém:

- `index.html`: tela de login.
- `dashboard.html`: dashboard profissional com filtros por período, cards executivos, gráficos Chart.js e notificações de follow-up.
- `clientes.html`: módulo central de clientes com cadastro, busca, filtro, paginação e edição/exclusão.
- `cliente_detalhe.html`: ficha detalhada com timeline cronológica completa do cliente.
- `visitas.html`: módulo mobile-friendly de visitas de campo com seleção de cliente, captura de imagem e listagem com miniaturas.
- `vendas.html`: tela simples do módulo de vendas com formulário, filtro por status, listagem e ações de edição/exclusão.
- `orcamentos.html`: módulo de orçamentos com vínculo opcional a visitas e conversão direta em venda.
- `followups.html`: painel mobile-friendly para follow-ups pendentes, atrasados e disparo rápido via WhatsApp.
- `notificacoes.html`: central de notificações inteligentes com prioridades, tempo relativo e ação rápida para marcar como lida.
- `css/styles.css`: customizações visuais.
- `js/app.js`, `js/dashboard.js`, `js/clientes.js`, `js/cliente_detalhe.js`, `js/visitas.js`, `js/vendas.js`, `js/orcamentos.js`, `js/followups.js`, `js/notificacoes.js` e `js/navbar.js`: interações do login, dashboard analítico, módulos operacionais e contador global de notificações.

## Banco de dados

O arquivo `database/schema.sql` cria a base inicial com suporte multiempresa.

O schema agora segue exatamente a estrutura pedida para o CRM SaaS:

- `empresas`: `id`, `nome`, `plano`, `data_criacao`
- `usuarios`: `id`, `empresa_id`, `nome`, `email`, `senha_hash`, `nivel`
- `clientes`: `id`, `empresa_id`, `nome`, `telefone`, `email`, `cidade`, `endereco`, `endereco_fiscal`, `cpf`, `cnpj`, `tipo`, `origem_lead`, `status_pipeline`, `observacoes`, `criado_em`
- `visitas`: `id`, `empresa_id`, `cliente_id`, `data_visita`, `tipo_visita`, `imagem_desenho_url`, `imagem_local_url`, `observacoes`, `resultado`, `criado_em`
- `orcamentos`: `id`, `empresa_id`, `cliente_id`, `visita_id`, `descricao`, `valor`, `status`, `data_criacao`, `data_validade`
- `follow_ups`: `id`, `empresa_id`, `cliente_id`, `tipo`, `referencia_id`, `data_criacao`, `data_proxima_acao`, `status`, `mensagem`, `responsavel_id`
- `vendas`: `id`, `empresa_id`, `cliente_id`, `orcamento_id`, `valor`, `status`, `forma_pagamento`, `data_venda`, `criado_em`
- `notificacoes`: `id`, `empresa_id`, `usuario_id`, `tipo`, `titulo`, `mensagem`, `referencia_id`, `referencia_tipo`, `lida`, `prioridade`, `data_criacao`

As relações usam foreign keys e, em `visitas` e `vendas`, a referência composta `(cliente_id, empresa_id)` garante que os registros sempre pertençam à mesma empresa/tenant.

## Como rodar localmente

### 1. Configurar o PostgreSQL

Crie um banco chamado `crm_saas` e depois execute o schema:

```bash
psql -U postgres -d crm_saas -f database/schema.sql
```

### 2. Instalar dependências do backend

```bash
cd backend
npm install
```

### 3. Revisar variáveis de ambiente

O arquivo `.env` na raiz já foi criado com valores iniciais:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_saas
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=supersecretkey
JWT_EXPIRES_IN=8h
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./backend/google-service-account.json
GOOGLE_DRIVE_DESENHOS_FOLDER_ID=
GOOGLE_DRIVE_IMAGENS_FOLDER_ID=
```

Ajuste conforme o seu ambiente.


### 3.1 Criar usuário de teste com senha em bcrypt

Como o login compara a senha com `bcrypt`, grave `senha_hash` no banco já criptografada. Exemplo para gerar um hash localmente:

```bash
cd backend
node -e "require('bcrypt').hash('123456', 10).then(console.log)"
```

Use o resultado no campo `senha_hash` da tabela `usuarios`.

### 4. Iniciar o backend

```bash
cd backend
npm run dev
```

ou

```bash
cd backend
npm start
```

A API ficará disponível em:

```bash
http://localhost:3000
```

### 5. Abrir o frontend

Abra o arquivo `frontend/index.html` no navegador ou sirva a pasta frontend com um servidor estático.

## Endpoints iniciais

- `POST /api/auth/login`
- `GET /api/auth/me` (protegida por JWT)
- `GET /api/dashboard` (protegida por JWT, aceita `?periodo=hoje|7_dias|30_dias|mes_atual`)
- `GET /api/followups` (protegida por JWT, lista follow-ups do usuário, aceita `status` e `atrasados=true`)
- `POST /api/followups` (protegida por JWT)
- `PUT /api/followups/:id` (protegida por JWT, conclui/cancela follow-up)
- `GET /api/notificacoes` (protegida por JWT, aceita `?limit=` e `?nao_lidas=true`)
- `PUT /api/notificacoes/:id/lida` (protegida por JWT)
- `POST /api/clientes` (protegida por JWT)
- `GET /api/clientes` (protegida por JWT, aceita `busca`, `status`, `page`, `limit`, `order`)
- `GET /api/clientes/:id` (protegida por JWT)
- `GET /api/clientes/:id/timeline` (protegida por JWT, aceita `?limit=`)
- `PUT /api/clientes/:id` (protegida por JWT, aceita dados fiscais)
- `DELETE /api/clientes/:id` (protegida por JWT)
- `POST /api/visitas` (protegida por JWT, multipart com upload de imagem)
- `GET /api/visitas` (protegida por JWT)
- `GET /api/visitas/:id` (protegida por JWT)
- `DELETE /api/visitas/:id` (protegida por JWT)
- `POST /api/orcamentos` (protegida por JWT)
- `GET /api/orcamentos` (protegida por JWT, aceita `?status=` e `?cliente_id=`)
- `GET /api/orcamentos/:id` (protegida por JWT)
- `PUT /api/orcamentos/:id` (protegida por JWT)
- `DELETE /api/orcamentos/:id` (protegida por JWT)
- `POST /api/orcamentos/:id/convert` (protegida por JWT)
- `POST /api/vendas` (protegida por JWT)
- `GET /api/vendas` (protegida por JWT, aceita filtro `?status=`)
- `GET /api/vendas/total` (protegida por JWT)
- `GET /api/vendas/:id` (protegida por JWT)
- `GET /api/vendas/cliente/:cliente_id` (protegida por JWT)
- `PUT /api/vendas/:id` (protegida por JWT)
- `DELETE /api/vendas/:id` (protegida por JWT)
- `GET /api/health`

## Próximos passos recomendados

- Criar endpoint de cadastro/convite de usuários com geração de senha usando `bcrypt.hash`.
- Adicionar refresh token e política de logout.
- Criar migrations e seed inicial.
- Evoluir o frontend para SPA ou framework moderno, se necessário.

## Como testar a timeline do cliente

### O que aparece na timeline

A timeline unifica eventos de:
- criação do cliente
- visitas
- criação de orçamento
- atualização de orçamento
- vendas
- criação de follow-up
- conclusão de follow-up

### No navegador

1. Faça login em `frontend/index.html`.
2. Acesse `frontend/clientes.html`.
3. Clique em **Timeline** em qualquer cliente.
4. Valide se o topo mostra os dados do cliente.
5. Clique em cada evento para expandir os detalhes.

### Via API

```http
GET /api/clientes/1/timeline
Authorization: Bearer <token>
```

### Como validar cenários

- **Cliente com visitas**: crie uma visita para o cliente e confirme o evento `Visita realizada`.
- **Cliente com venda**: crie um orçamento, converta em venda e confirme o evento `Venda realizada` com destaque visual.
- **Cliente sem histórico**: crie um cliente novo e verifique se aparece apenas `Cliente criado`.
- **Orçamento atualizado**: edite um orçamento existente e confirme o evento `Orçamento atualizado`.
- **Follow-up concluído**: conclua um follow-up em `followups.html` e confirme o evento `Follow-up concluído`.

## Como testar notificações inteligentes

### Regras automáticas implementadas

- **Follow-up atrasado**: gera alerta de prioridade alta para o responsável quando `data_proxima_acao < agora`.
- **Visita do dia**: gera alerta para usuários da empresa no dia da visita.
- **Visita atrasada**: gera alerta quando a visita ficou com resultado `retorno` e a data já passou.
- **Orçamento sem resposta**: gera alerta de prioridade alta quando o orçamento pendente passa de 3 dias.
- **Venda recente**: gera alerta automático ao registrar uma venda.
- **Cliente inativo**: gera alerta quando não há interação há mais de 10 dias.

### Fluxo no frontend

1. Faça login em `frontend/index.html`.
2. Observe o sino 🔔 na navbar com o contador de não lidas.
3. Clique no sino para abrir `frontend/notificacoes.html`.
4. Valide prioridade, tempo relativo e o botão **Marcar como lida**.
5. Clique em **Abrir contexto** para navegar para cliente, visita ou orçamento relacionado.

### Simular follow-up atrasado

1. Crie um follow-up pendente para um cliente.
2. No banco, ajuste `data_proxima_acao` para um horário anterior ao atual.
3. Aguarde a rotina automática ou reinicie o backend.
4. Consulte `GET /api/notificacoes?nao_lidas=true` e confirme o título `Follow-up atrasado`.

### Simular orçamento parado

1. Crie um orçamento com status `pendente`.
2. No banco, ajuste `data_criacao` para mais de 3 dias atrás.
3. Aguarde a rotina automática.
4. Verifique em `GET /api/notificacoes` a entrada `Orçamento sem resposta`.

### Verificar notificações geradas

- `GET /api/notificacoes` lista apenas notificações do usuário autenticado e da `empresa_id` do token.
- `PUT /api/notificacoes/:id/lida` marca uma notificação como lida e o contador do sino diminui.
- Para testar cliente inativo, ajuste `criado_em`/interações para mais de 10 dias atrás e aguarde a rotina.
- Para testar venda recente, crie uma venda em `frontend/vendas.html` ou converta um orçamento em venda.

## Como testar o sistema de follow-up automático

### Automação implementada

- Ao criar um **orçamento**, o sistema gera um follow-up automático para **+2 dias**.
- Ao criar uma **visita sem orçamento** (`resultado != orcamento`), o sistema gera um follow-up para **+1 dia**.
- A rotina automática roda em background (intervalo padrão de 5 minutos, configurável por `FOLLOWUP_CRON_MINUTES`) e cria um novo follow-up para **orçamentos pendentes com mais de 3 dias**.

### Estrutura da API

A rota principal do módulo é `GET /api/followups`, com suporte também a:
- `POST /api/followups`
- `PUT /api/followups/:id`

### Como simular a criação de orçamento

1. Faça login no sistema.
2. Acesse `frontend/orcamentos.html`.
3. Crie um orçamento com status `pendente`.
4. Consulte `frontend/followups.html` ou `GET /api/followups`.
5. Confirme se surgiu um follow-up automático com tipo `orcamento`.

### Como simular a geração automática de follow-up

#### Caso 1: visita sem orçamento

1. Acesse `frontend/visitas.html`.
2. Crie uma visita com `resultado` diferente de `orcamento` (por exemplo `retorno` ou `sem_interesse`).
3. Abra `frontend/followups.html`.
4. Confirme se o follow-up foi criado com a mensagem `Podemos dar sequência no seu projeto?`.

#### Caso 2: orçamento pendente há mais de 3 dias

1. Crie um orçamento `pendente`.
2. No banco, ajuste `data_criacao` do orçamento para mais de 3 dias atrás.
3. Aguarde a rotina automática ou reinicie o backend para disparar a checagem inicial.
4. Consulte `GET /api/followups` e confirme o novo follow-up de reengajamento.

### Como simular a execução da automação

- O backend executa a rotina automaticamente na inicialização e depois a cada `FOLLOWUP_CRON_MINUTES`.
- Para acelerar o teste, defina no `.env` algo como:

```env
FOLLOWUP_CRON_MINUTES=1
```

- Depois inicie o backend com `npm run dev` e observe os logs do servidor quando houver follow-ups pendentes para ação ou novos follow-ups gerados.

### Como testar o WhatsApp

1. Acesse `frontend/followups.html`.
2. Clique em **💬 WhatsApp** em qualquer follow-up que tenha telefone cadastrado.
3. Confirme se o navegador abre `https://wa.me/...` com a mensagem pronta.

### Como testar dashboard + alertas

1. Acesse `frontend/dashboard.html`.
2. Verifique os cards `Follow-ups pendentes` e `Follow-ups atrasados`.
3. Confira a lista `Notificações de follow-up`.
4. Clique em **Abrir follow-ups** para ir à tela operacional.

## Como testar o dashboard profissional

### Filtros disponíveis

O dashboard aceita `periodo` com os valores:
- `hoje`
- `7_dias`
- `30_dias`
- `mes_atual`

### Métricas exibidas

A API `GET /api/dashboard` retorna:
- `clientes`
- `visitas_mes`
- `orcamentos_mes`
- `vendas_mes`
- `faturamento`
- `ticket_medio`
- `conversao_visita_orcamento`
- `conversao_orcamento_venda`
- `grafico_vendas`
- `funil`
- `vendas_por_status`

### No navegador

1. Faça login em `frontend/index.html`.
2. Acesse `frontend/dashboard.html`.
3. Troque o filtro de período entre **Hoje**, **7 dias**, **30 dias** e **Mês atual**.
4. Confira se os cards do topo atualizam imediatamente.
5. Valide se o gráfico **Vendas por mês** mostra os últimos 6 meses.
6. Valide se o gráfico **Funil comercial** reflete `visitas`, `orcamentos` e `vendas` do período.
7. Valide se o gráfico **Vendas por status** muda conforme o filtro e os dados cadastrados.

### Via API

#### Dashboard do mês atual

```http
GET /api/dashboard
Authorization: Bearer <token>
```

#### Dashboard dos últimos 7 dias

```http
GET /api/dashboard?periodo=7_dias
Authorization: Bearer <token>
```

### Como testar cada métrica

- **Total de clientes**: cadastre clientes em `clientes.html` e confirme o aumento do campo `clientes`.
- **Total de visitas no período**: crie visitas com `data_visita` dentro e fora do período selecionado e valide `visitas_mes`.
- **Total de orçamentos no período**: crie orçamentos e confirme o contador `orcamentos_mes`.
- **Total de vendas no período**: crie vendas com `data_venda` correspondente ao período e valide `vendas_mes`.
- **Faturamento mensal/período**: some manualmente os valores das vendas do período e compare com `faturamento`.
- **Ticket médio**: divida `faturamento` por `vendas_mes` e confirme o valor retornado em `ticket_medio`.
- **Conversão Visitas → Orçamentos**: compare `orcamentos_mes / visitas_mes * 100` com `conversao_visita_orcamento`.
- **Conversão Orçamentos → Vendas**: compare `vendas_mes / orcamentos_mes * 100` com `conversao_orcamento_venda`.
- **Gráfico de vendas por mês**: crie vendas em meses distintos no banco e valide cada item de `grafico_vendas`.
- **Funil**: confira se os totais do array `funil` são iguais aos cards do período.
- **Pizza por status**: crie vendas com status `em_andamento` e `fechado` e valide `vendas_por_status`.

## Como testar o módulo de clientes

### No navegador

1. Faça login em `frontend/index.html`.
2. Acesse `frontend/clientes.html`.
3. Cadastre um cliente preenchendo os campos do formulário.
4. Use a busca por nome, o filtro por `status_pipeline` e a ordenação por data de criação.
5. Navegue pelas páginas usando os botões **Anterior** e **Próxima**.
6. Clique em **Editar** para carregar o cliente no formulário e atualizar os dados.
7. Clique em **Excluir** para remover o cliente da empresa autenticada.

### Via Postman ou Insomnia

1. Faça login em `POST /api/auth/login` e copie o token JWT.
2. Configure o header `Authorization: Bearer <token>`.
3. Teste os endpoints abaixo em JSON.

#### Criar cliente

```http
POST /api/clientes
Content-Type: application/json
Authorization: Bearer <token>

{
  "nome": "Cliente Exemplo",
  "telefone": "11999999999",
  "email": "cliente@empresa.com",
  "cidade": "São Paulo",
  "endereco": "Av. Central, 100",
  "tipo": "comercial",
  "origem_lead": "Instagram",
  "status_pipeline": "lead",
  "observacoes": "Primeiro contato via anúncio"
}
```

#### Listar com busca, filtro e paginação

```http
GET /api/clientes?busca=Cliente&status=lead&page=1&limit=10&order=desc
Authorization: Bearer <token>
```

#### Buscar cliente por ID

```http
GET /api/clientes/1
Authorization: Bearer <token>
```

#### Atualizar cliente

```http
PUT /api/clientes/1
Content-Type: application/json
Authorization: Bearer <token>

{
  "nome": "Cliente Atualizado",
  "telefone": "11988888888",
  "email": "novo@empresa.com",
  "cidade": "Campinas",
  "endereco": "Rua Nova, 200",
  "tipo": "residencial",
  "origem_lead": "WhatsApp",
  "status_pipeline": "negociacao",
  "observacoes": "Cliente avançou no pipeline"
}
```

#### Excluir cliente

```http
DELETE /api/clientes/1
Authorization: Bearer <token>
```

O backend nunca aceita `empresa_id` vindo do frontend: o tenant é sempre derivado do JWT. Esse módulo fica pronto para ser reutilizado por visitas, vendas e futuro histórico do cliente.

## Como testar upload e listagem de visitas

### Preparação do Google Drive

1. Crie uma Service Account no Google Cloud com acesso à API do Google Drive.
2. Salve o JSON de credenciais em `backend/google-service-account.json`.
3. Compartilhe as pastas de desenhos e imagens com o e-mail da Service Account.
4. Preencha no `.env`:
   - `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`
   - `GOOGLE_DRIVE_DESENHOS_FOLDER_ID`
   - `GOOGLE_DRIVE_IMAGENS_FOLDER_ID`

### No navegador

1. Faça login em `frontend/index.html`.
2. Acesse `frontend/visitas.html` no celular ou navegador com câmera.
3. Selecione o cliente e a data.
4. Tire a foto do desenho usando o campo `accept="image/*" capture="environment"`.
5. Opcionalmente, envie a foto do local.
6. Preencha observações/resultado e clique em **Salvar visita**.
7. Verifique se a visita aparece na lista com miniatura.
8. Toque em **📍 Maps** para abrir o endereço da visita no Google Maps.
9. Toque em **💬 WhatsApp** para abrir a conversa com mensagem pronta.
10. Toque em **🚀 Iniciar visita** para abrir Maps e, alguns segundos depois, o WhatsApp.

### Via Postman ou Insomnia

1. Faça login em `POST /api/auth/login` e copie o token JWT.
2. Configure `Authorization: Bearer <token>`.
3. Faça uma requisição `POST /api/visitas` como `form-data` com os campos:
   - `cliente_id`
   - `data_visita`
   - `tipo_visita`
   - `resultado`
   - `observacoes`
   - `imagem_desenho` (tipo File, obrigatório)
   - `imagem_local` (tipo File, opcional)
4. Depois teste:
   - `GET /api/visitas` para listar
   - `GET /api/visitas/:id` para visualizar detalhes
   - No navegador, use os botões `📍 Maps`, `💬 WhatsApp` e `🚀 Iniciar visita`
   - `DELETE /api/visitas/:id` para excluir

Exemplo de criação via `curl`:

```bash
curl -X POST http://localhost:3000/api/visitas \
  -H "Authorization: Bearer $TOKEN" \
  -F "cliente_id=1" \
  -F "data_visita=2026-03-25" \
  -F "tipo_visita=orcamento" \
  -F "resultado=orcamento" \
  -F "observacoes=Desenho registrado em campo" \
  -F "imagem_desenho=@/caminho/desenho.jpg" \
  -F "imagem_local=@/caminho/local.jpg"
```

As URLs salvas no banco vêm do Google Drive, e o backend mantém o isolamento por `empresa_id` usando o JWT do usuário autenticado.


### Compatibilidade desktop e celular

- **Android (Chrome)**: o botão `💬 WhatsApp` tende a abrir o app instalado; `📍 Maps` abre o Google Maps ou navegador.
- **iPhone (Safari)**: o link `wa.me` abre o WhatsApp se instalado; o Maps abre no navegador/Google Maps conforme o aparelho.
- **Desktop**: os botões abrem novas abas com Google Maps e WhatsApp Web. Se houver bloqueio de pop-up, permita pop-ups para o domínio local.

## Como testar o módulo de orçamentos

### Criar orçamento

1. Faça login em `frontend/index.html`.
2. Acesse `frontend/orcamentos.html`.
3. Escolha um cliente ou selecione uma visita para puxar automaticamente o cliente.
4. Preencha descrição, valor, status e data de validade.
5. Salve o orçamento e confirme se ele aparece na lista.

### Converter em venda

1. Na lista de orçamentos, clique em **Converter em venda**.
2. Informe a forma de pagamento quando solicitado.
3. O sistema cria a venda, vincula `orcamento_id` e muda o status do orçamento para `aprovado`.

### Validar dados fiscais

Antes da conversão, o cliente precisa ter:
- `cpf` ou `cnpj`
- `endereco_fiscal`

Se faltar qualquer um desses campos, a API retorna a mensagem: `Preencha os dados fiscais para concluir a venda`.

### Via Postman ou Insomnia

#### Criar orçamento

```http
POST /api/orcamentos
Content-Type: application/json
Authorization: Bearer <token>

{
  "cliente_id": 1,
  "visita_id": null,
  "descricao": "Orçamento de instalação completa",
  "valor": 12500.00,
  "status": "pendente",
  "data_validade": "2026-04-10"
}
```

#### Converter em venda

```http
POST /api/orcamentos/1/convert
Content-Type: application/json
Authorization: Bearer <token>

{
  "forma_pagamento": "PIX",
  "data_venda": "2026-03-26"
}
```

#### Listar vendas geradas

```http
GET /api/vendas
Authorization: Bearer <token>
```

## Como testar o módulo de vendas

### No navegador

1. Faça login em `frontend/index.html`.
2. Acesse `frontend/vendas.html`.
3. Preencha o formulário com `cliente_id`, `valor`, `status`, `forma_pagamento` e `data_venda`.
4. Use o seletor de status para filtrar a listagem.
5. Clique em **Editar** para carregar uma venda no formulário e salvar alterações.
6. Clique em **Excluir** para remover a venda da empresa logada.

### Via API

Depois de obter um JWT em `POST /api/auth/login`, use o token nas requisições abaixo:

```bash
TOKEN="seu_jwt_aqui"
```

#### Criar venda

```bash
curl -X POST http://localhost:3000/api/vendas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cliente_id":1,"valor":15000.50,"status":"negociacao","forma_pagamento":"PIX","data_venda":"2026-03-22"}'
```

#### Listar vendas da empresa

```bash
curl http://localhost:3000/api/vendas \
  -H "Authorization: Bearer $TOKEN"
```

#### Listar vendas com filtro por status

```bash
curl "http://localhost:3000/api/vendas?status=fechado" \
  -H "Authorization: Bearer $TOKEN"
```

#### Buscar venda por ID

```bash
curl http://localhost:3000/api/vendas/1 \
  -H "Authorization: Bearer $TOKEN"
```

#### Listar vendas por cliente

```bash
curl http://localhost:3000/api/vendas/cliente/1 \
  -H "Authorization: Bearer $TOKEN"
```

#### Atualizar venda

```bash
curl -X PUT http://localhost:3000/api/vendas/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cliente_id":1,"valor":18000,"status":"fechado","forma_pagamento":"Boleto","data_venda":"2026-03-23"}'
```

#### Excluir venda

```bash
curl -X DELETE http://localhost:3000/api/vendas/1 \
  -H "Authorization: Bearer $TOKEN"
```

#### Obter total de vendas

```bash
curl http://localhost:3000/api/vendas/total \
  -H "Authorization: Bearer $TOKEN"
```

O backend valida o `empresa_id` a partir do JWT e também confirma que o `cliente_id` informado pertence à mesma empresa antes de criar ou atualizar uma venda.
