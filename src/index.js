require('dotenv').config();
const express = require('express');
const { initDb } = require('./db');
const passesRouter = require('./routes/passes');
const walletRouter = require('./routes/wallet');

const app = express();
app.use(express.json());
app.use('/images', express.static('public'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/webhook', passesRouter);
app.use('/cron', walletRouter);
app.use('/v', require('./routes/validate'));
app.use('/sync', require('./routes/sync'));
app.use('/carteirinha', require('./routes/carteirinha'));

const PORT = process.env.PORT || 3000;

const cron = require('node-cron');
const { syncSubscribers } = require('./services/syncService');

// Roda a sincronização a cada 15 minutos
cron.schedule('*/15 * * * *', () => {
  syncSubscribers().catch(err => console.error('[cron] erro:', err.message));
});

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