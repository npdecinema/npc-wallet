const express = require('express');
const router = express.Router();
const { createMember, getMemberByCircleId, cancelMember, renewMember } = require('../services/passService');
const { createPass, updatePass, deactivatePass } = require('../services/googleWallet');

function verifySecret(req, res, next) {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.post('/member/created', verifySecret, async (req, res) => {
  try {
    const { id, name, email, membership_level, created_at } = req.body;

    const member = await createMember({
      circleId: String(id),
      name,
      email,
      plan: membership_level?.name || 'Membro'
    });

    const walletUrl = await createPass(member);

    console.log(`Carteirinha criada: ${member.member_code} — ${name}`);
    res.json({ success: true, member_code: member.member_code, wallet_url: walletUrl });
  } catch (err) {
    console.error('Erro ao criar carteirinha:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/member/cancelled', verifySecret, async (req, res) => {
  try {
    const { id } = req.body;

    const member = await cancelMember(String(id));
    if (!member) return res.status(404).json({ error: 'Membro não encontrado' });

    await deactivatePass(member);

    console.log(`Carteirinha cancelada: ${member.member_code}`);
    res.json({ success: true, member_code: member.member_code });
  } catch (err) {
    console.error('Erro ao cancelar carteirinha:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/member/renewed', verifySecret, async (req, res) => {
  try {
    const { id, valid_until } = req.body;

    const member = await renewMember(String(id), valid_until);
    if (!member) return res.status(404).json({ error: 'Membro não encontrado' });

    const walletUrl = await updatePass(member);

    console.log(`Carteirinha renovada: ${member.member_code}`);
    res.json({ success: true, member_code: member.member_code, wallet_url: walletUrl });
  } catch (err) {
    console.error('Erro ao renovar carteirinha:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
