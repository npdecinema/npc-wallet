const express = require('express');
const router = express.Router();
const { getMembersDueForRenewal } = require('../services/passService');
const { updatePass } = require('../services/googleWallet');

function verifyCronSecret(req, res, next) {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.post('/renew-batch', verifyCronSecret, async (req, res) => {
  try {
    const members = await getMembersDueForRenewal();
    const results = [];

    for (const member of members) {
      try {
        await updatePass(member);
        results.push({ member_code: member.member_code, status: 'updated' });
      } catch (err) {
        results.push({ member_code: member.member_code, status: 'error', error: err.message });
      }
    }

    console.log(`Renovação em lote: ${results.length} passes processados.`);
    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('Erro no batch:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
