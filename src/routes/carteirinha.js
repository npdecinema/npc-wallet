const express = require('express');
const router = express.Router();
const { getMemberByPublicUid } = require('../services/passService');
const { createPass } = require('../services/googleWallet');

router.get('/:publicUid', async (req, res) => {
  try {
    const member = await getMemberByPublicUid(req.params.publicUid);

    if (!member) {
      return res.status(404).send(pagina('Carteirinha não encontrada',
        'Se você assinou recentemente, pode demorar até 15 minutos para sua carteirinha ser gerada. Caso o problema persista, entre em contato diretamente conosco: npdecinema@periprod.com.', null));
    }

    if (member.status !== 'active') {
      return res.status(200).send(pagina('Assinatura inativa',
        'Sua assinatura não está ativa no momento.', null));
    }

    const walletUrl = await createPass(member);
    res.send(pagina(`Olá, ${member.name}!`,
      'Sua carteirinha do Nosso Podcast de Cinema está pronta.',
      walletUrl));
  } catch (err) {
    console.error('Carteirinha error:', err.message);
    res.status(500).send(pagina('Erro', 'Algo deu errado. Tente novamente mais tarde.', null));
  }
});

function pagina(titulo, texto, walletUrl) {
  const botao = walletUrl
    ? `<a href="${walletUrl}" style="display:inline-block;background:#2a1a0e;color:#f5efe6;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:16px;font-weight:500">Adicionar ao Google Wallet</a>`
    : '';
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Carteirinha NPdC</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#2a1a0e;font-family:sans-serif;padding:24px">
<div style="max-width:420px;text-align:center;background:#f5efe6;border-radius:20px;padding:32px 24px">
<h1 style="color:#2a1a0e;font-size:22px;margin:0 0 12px">${titulo}</h1>
<p style="color:#8a6040;font-size:15px;line-height:1.5;margin:0 0 24px">${texto}</p>
${botao}
</div></body></html>`;
}

module.exports = router;
