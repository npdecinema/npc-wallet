# NPC Wallet — Carteirinhas digitais

Servidor Node.js para gerar carteirinhas Google Wallet para membros do Circle.so.

## Setup local

### 1. Pré-requisitos
- Node.js 18+ instalado ([nodejs.org](https://nodejs.org))
- PostgreSQL local ou uma instância no Railway

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
```bash
cp .env.example .env
```
Edite o `.env` com suas credenciais.

### 4. Rodar localmente
```bash
npm run dev
```

O servidor sobe em `http://localhost:3000`.

### 5. Testar o webhook de criação
```bash
curl -X POST http://localhost:3000/webhook/member/created \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: sua_senha_aqui" \
  -d '{
    "id": "123",
    "name": "Marina Fonseca",
    "email": "marina@exemplo.com",
    "membership_level": { "name": "Pro" }
  }'
```

### 6. Testar cancelamento
```bash
curl -X POST http://localhost:3000/webhook/member/cancelled \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: sua_senha_aqui" \
  -d '{ "id": "123" }'
```

## Deploy no Railway

1. Crie uma conta em [railway.app](https://railway.app) e conecte ao GitHub
2. New Project → Deploy from GitHub repo → selecione este repositório
3. Add Plugin → PostgreSQL (o Railway preenche DATABASE_URL automaticamente)
4. Variables → adicione todas as variáveis do `.env.example`
5. O deploy acontece automaticamente a cada push na branch `main`

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /health | Status do servidor |
| POST | /webhook/member/created | Novo membro no Circle.so |
| POST | /webhook/member/cancelled | Membro cancelou |
| POST | /webhook/member/renewed | Renovação manual |
| POST | /cron/renew-batch | Atualiza passes próximos do vencimento |

## Fluxo Make

Configure no Make os seguintes módulos após o trigger do Circle.so:
- **HTTP Request** → `POST /webhook/member/created` com header `x-webhook-secret`
- A resposta inclui `wallet_url` — adicione ao e-mail de boas-vindas do membro

## Cron job de renovação (500 membros/mês)

No Railway, crie um Cron Job:
- Comando: `curl -X POST $RAILWAY_PUBLIC_DOMAIN/cron/renew-batch -H "x-webhook-secret: $WEBHOOK_SECRET"`
- Schedule: `0 9 1 * *` (todo dia 1 do mês às 9h)
