const express = require('express');
const router = express.Router();
const { syncSubscribers } = require('../services/syncService');

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

module.exports = router;