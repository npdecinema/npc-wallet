# NPC Wallet — Carteirinhas digitais

Servidor Node.js que gera e mantém atualizadas carteirinhas digitais
(**Google Wallet** e **Apple Wallet**) para assinantes da comunidade "Nosso
Podcast de Cinema" no Circle.so.

## Setup local

### 1. Pré-requisitos
- Node.js 18+ instalado ([nodejs.org](https://nodejs.org))
- PostgreSQL local ou uma instância no Railway
- Conta de service account do Google Cloud com acesso à Wallet Objects API
- Certificado Pass Type ID + WWDR (geração **RSA**, ex: G4 — a G6 é ECC e
  incompatível com a lib usada) da Apple Developer, pra Apple Wallet

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
```bash
cp .env.example .env
```
Edite o `.env` com suas credenciais. Variáveis principais:

```
DATABASE_URL=
WEBHOOK_SECRET=                          # protege POST /sync/subscribers

GOOGLE_APPLICATION_CREDENTIALS_JSON=     # JSON da service account, em uma linha
GOOGLE_WALLET_ISSUER_ID=
GOOGLE_WALLET_CLASS_ID=                  # sem ponto no nome (ex: npc_pass_v2)

APPLE_PASS_TYPE_ID=
APPLE_TEAM_ID=
APPLE_WWDR_CERT_B64=
APPLE_SIGNER_CERT_B64=
APPLE_SIGNER_KEY_B64=

RAILWAY_PUBLIC_DOMAIN=                   # domínio público, usado nas URLs de imagem/QR
COMMUNITY_NAME=
CARD_BG_COLOR=
```

**Importante**: confirma que os valores de `GOOGLE_WALLET_ISSUER_ID` e
`GOOGLE_WALLET_CLASS_ID` no `.env` local batem com os do Railway.

(Localmente, os certificados Apple também podem ficar como arquivo em
`src/services/certs/` em vez de base64 — ver fallback em `appleWallet.js`.)

### 4. Rodar localmente
```bash
npm run dev
```

O servidor sobe em `http://localhost:3000`.

### 5. Disparar a sincronização manualmente
```bash
curl -X POST http://localhost:3000/sync/subscribers \
  -H "x-webhook-secret: sua_senha_aqui"
```

Isso roda a mesma lógica do cron automático (ver seção abaixo), na hora,
sem esperar os 15 minutos.

### Preview local sem tocar em produção
- `node preview-apple-pass.js` — gera um `.pkpass` de teste (Apple), sem precisar de banco
- `node preview-google-pass.js` — gera um pass de teste real no Google Wallet, isolado por
 um `member_code` de teste, sem tocar na tabela `members`

## Deploy no Railway

1. Crie uma conta em [railway.app](https://railway.app) e conecte ao GitHub
2. New Project → Deploy from GitHub repo → selecione este repositório
3. Add Plugin → PostgreSQL (o Railway preenche `DATABASE_URL` automaticamente)
4. Variables → adicione todas as variáveis listadas acima
5. O deploy acontece automaticamente a cada push na branch `master`

## Sincronização automática

Esse mecanismo mantém as carteirinhas em dia. Não usamos webhook porque o plano 
que assinamos no Circle não permite automações usando webhooks). Um cron interno 
(dentro do próprio `src/index.js`) roda a cada 15 minutos e:
- compara quem está no grupo de acesso "Assinantes" do Circle com quem está
  no banco local
- cria carteirinha (Google + Apple) pra quem entrou
- desativa quem saiu, expirando `valid_until` para a data atual e notificando o Apple Wallet via push
- renova (+1 mês) quem está a 5 dias ou menos de vencer

`POST /sync/subscribers` roda essa mesma lógica sob demanda, fora do
cronograma — útil pra testar sem esperar o próximo ciclo.

Um segundo cron roda semanalmente (domingo às 3h) e atualiza 
nome/e-mail/plano de todo membro ativo, comparando com o Circle. Só reenvia 
os passes (Google/Apple) para quem teve `name` ou `plan` de fato alterado — 
evita reescrever e notificar todo mundo à toa. `POST /sync/refresh-profiles` 
dispara isso manualmente.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status do servidor |
| GET | `/carteirinha/:publicUid` | Página de entrega — gera os dois passes e mostra os botões de "Adicionar" |
| GET | `/v/:code/:token` | Validação do QR code (ATIVO/INATIVO) |
| POST | `/sync/subscribers` | Dispara a sincronização manualmente, fora do cron |
| POST | `/sync/refresh-profiles` | Dispara o refresh de perfil manualmente, fora do cron |
| GET | `/apple/download/:publicUid` | Download inicial do `.pkpass` |
| * | `/apple/v1/...` | Web service do Apple Wallet (spec da Apple — registro de device, checagem de updates, reenvio do pass) |

## Estrutura e responsabilidades dos arquivos

### `src/index.js`
Ponto de entrada. Registra as rotas, inicializa o banco (`initDb`) e liga o
cron interno (a cada 15 min) que roda `syncSubscribers()`.

### `src/db/`
- `index.js` — pool de conexão com o Postgres, exporta `pool` e `initDb`
- `schema.sql` — definição das tabelas (`members`, `apple_device_registrations`)

### `src/services/`

| Arquivo | Responsabilidade |
|---|---|
| `passService.js` | Faz queries na tabela `members` — criar, buscar (por `circle_id`, `public_uid` ou `member_code`), renovar, cancelar. |
| `googleWallet.js` | Cria/atualiza/desativa o pass no Google Wallet via Wallet Objects API, incluindo a `genericClass` compartilhada. |
| `appleWallet.js` | Gera o `.pkpass` (via `passkit-generator`) e dispara push (via APNs) pra atualizar passes já instalados. |
| `circle.js` | Cliente da Admin API v2 do Circle.so — lista assinantes do grupo de acesso e busca detalhes de membro. |
| `syncService.js` | Orquestra o cron de 15 min (criação, expiração, renovação), chamando `googleWallet.js` e `appleWallet.js`. Também expõe `refreshMemberProfiles()`, usada pelo cron de atualização de perfil. |

### `src/routes/`

| Arquivo | Rota base | Responsabilidade |
|---|---|---|
| `carteirinha.js` | `/carteirinha` | Página de entrega |
| `apple.js` | `/apple` | Web service da Apple + download inicial |
| `validate.js` | `/v` | Validação do QR code |
| `sync.js` | `/sync` | Disparo manual da sincronização |

### `src/pass-models/npc.pass/`
Modelo do Apple Wallet: `pass.json` + imagens com nomes exigidos pela Apple
(`icon.png`, `logo.png`, `strip.png`, variantes `@2x`/`@3x`). Lido apenas
internamente pelo `appleWallet.js` — não é servido por HTTP.

### `public/`
Assets servidos publicamente via `express.static` (montado em `/images`) —
usados pelo Google Wallet (busca do lado do servidor deles) e pela página de
entrega (badges oficiais de "Adicionar à Carteira").