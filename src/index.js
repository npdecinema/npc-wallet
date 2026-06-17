require('dotenv').config();
const express = require('express');
const { initDb } = require('./db');
const passesRouter = require('./routes/passes');
const walletRouter = require('./routes/wallet');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/webhook', passesRouter);
app.use('/cron', walletRouter);

const PORT = process.env.PORT || 3000;

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

start().catch(err => {
  console.error('Erro ao iniciar:', err);
  process.exit(1);
});
