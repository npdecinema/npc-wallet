const express = require('express');
const router = express.Router();
const { listSubscriberIds, getMemberDetails } = require('../services/circle');
const { createMember, cancelMember, renewMember, getActiveCircleIds, expireRenewals } = require('../services/passService');
const { createPass, deactivatePass } = require('../services/googleWallet');
const { pool } = require('../db');

function verifySecret(req, res, next) {
  if (req.headers['x-webhook-secret'] !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.post('/subscribers', verifySecret, async (req, res) => {
  try {
    const circleIdsNoGrupo = (await listSubscriberIds()).map(String);
    const ativosNoBanco = await getActiveCircleIds();

    const novos = circleIdsNoGrupo.filter(id => !ativosNoBanco.includes(id));
    const sairam = ativosNoBanco.filter(id => !circleIdsNoGrupo.includes(id));

    const criados = [];
    for (const circleId of novos) {
      const det = await getMemberDetails(circleId);
      const member = await createMember(det);
      await createPass(member);
      criados.push(member.member_code);
    }

    const expirados = [];
    for (const circleId of sairam) {
      const member = await cancelMember(circleId);
      if (member) { await deactivatePass(member); expirados.push(member.member_code); }
    }

    // renova validade mensal de quem continua ativo
    await expireRenewals();
    const { rows } = await pool.query("SELECT * FROM members WHERE status='active' AND valid_until <= CURRENT_DATE + INTERVAL '5 days'");
    for (const m of rows) await createPass(m);

    res.json({ criados, expirados, total_grupo: circleIdsNoGrupo.length });
  } catch (err) {
    console.error('Sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
