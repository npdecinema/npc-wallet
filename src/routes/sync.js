const express = require('express');
const router = express.Router();
const { syncSubscribers, refreshMemberProfiles } = require('../services/syncService');

function verifySecret(req, res, next) {
  if (req.headers['x-webhook-secret'] !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.post('/subscribers', verifySecret, async (req, res) => {
  try {
    const result = await syncSubscribers();
    res.json(result);
  } catch (err) {
    console.error('Sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Dispara a atualização de perfil manualmente, sem esperar o cron periodico
router.post('/refresh-profiles', verifySecret, async (req, res) => {
  try {
    const result = await refreshMemberProfiles();
    res.json(result);
  } catch (err) {
    console.error('Refresh error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;