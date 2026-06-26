const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/:code/:token', async (req, res) => {
  try {
    const { code, token } = req.params;
    const { rows } = await pool.query(
      'SELECT status FROM members WHERE member_code=$1 AND validation_token=$2',
      [code, token]
    );

    const ativo = rows[0] && rows[0].status === 'active';
    const cor = ativo ? '#1a7a4c' : '#b3261e';
    const texto = ativo ? 'ASSINATURA ATIVA' : 'ASSINATURA INATIVA';
    const icone = ativo ? '&#10003;' : '&#10007;';

    if (!rows[0]) {
      return res.status(404).send(pagina('#b3261e', 'NÃO ENCONTRADO', '&#10007;'));
    }

    res.send(pagina(cor, texto, icone));
  } catch (err) {
    res.status(500).send('Erro');
  }
});

function pagina(cor, texto, icone) {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Validação</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:${cor};font-family:sans-serif;color:#fff;text-align:center">
<div><div style="font-size:80px">${icone}</div>
<div style="font-size:28px;font-weight:bold;margin-top:16px">${texto}</div>
<div style="font-size:14px;opacity:.7;margin-top:24px">Nosso Podcast de Cinema</div></div>
</body></html>`;
}

module.exports = router;
