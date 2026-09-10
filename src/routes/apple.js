const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getMemberByCode } = require('../services/passService');
const { buildPassBuffer, authToken } = require('../services/appleWallet');

// Extrai o token do header "Authorization: ApplePass <token>"
function verifyPassAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  req._appleToken = auth.replace('ApplePass ', '').trim();
  next();
}

// 1. Registrar dispositivo para receber atualizações de um pass
router.post('/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber', verifyPassAuth, async (req, res) => {
  try {
    const { deviceId, passTypeId, serialNumber } = req.params;
    const { pushToken } = req.body;

    const member = await getMemberByCode(serialNumber);
    if (!member || authToken(member) !== req._appleToken) {
      return res.status(401).end();
    }

    const existing = await pool.query(
      'SELECT 1 FROM apple_device_registrations WHERE device_id=$1 AND serial_number=$2',
      [deviceId, serialNumber]
    );

    if (existing.rows.length) return res.status(200).end();

    await pool.query(
      `INSERT INTO apple_device_registrations (device_id, pass_type_id, serial_number, push_token)
       VALUES ($1, $2, $3, $4)`,
      [deviceId, passTypeId, serialNumber, pushToken]
    );

    res.status(201).end();
  } catch (err) {
    console.error('Apple register error:', err.message);
    res.status(500).end();
  }
});

// 2. Listar serial numbers atualizados desde X, para um dispositivo
router.get('/v1/devices/:deviceId/registrations/:passTypeId', async (req, res) => {
  try {
    const { deviceId, passTypeId } = req.params;
    const since = req.query.passesUpdatedSince;

    let query = `SELECT m.member_code, m.apple_update_tag FROM apple_device_registrations r
                 JOIN members m ON m.member_code = r.serial_number
                 WHERE r.device_id=$1 AND r.pass_type_id=$2`;
    const params = [deviceId, passTypeId];

    if (since) {
      query += ' AND m.apple_update_tag::text > $3';
      params.push(since);
    }

    const { rows } = await pool.query(query, params);
    if (!rows.length) return res.status(204).end();

    res.json({
      lastUpdated: String(Date.now()),
      serialNumbers: rows.map(r => r.member_code)
    });
  } catch (err) {
    console.error('Apple list updates error:', err.message);
    res.status(500).end();
  }
});

// 3. Retornar o .pkpass atualizado (a Apple chama isso após o push)
router.get('/v1/passes/:passTypeId/:serialNumber', verifyPassAuth, async (req, res) => {
  try {
    const member = await getMemberByCode(req.params.serialNumber);
    if (!member) return res.status(404).end();
    if (authToken(member) !== req._appleToken) return res.status(401).end();

    const buffer = await buildPassBuffer(member);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.send(buffer);
  } catch (err) {
    console.error('Apple get pass error:', err.message);
    res.status(500).end();
  }
});

// 4. Desregistrar dispositivo (usuário removeu o pass do Wallet)
router.delete('/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber', verifyPassAuth, async (req, res) => {
  try {
    const { deviceId, serialNumber } = req.params;
    await pool.query(
      'DELETE FROM apple_device_registrations WHERE device_id=$1 AND serial_number=$2',
      [deviceId, serialNumber]
    );
    res.status(200).end();
  } catch (err) {
    console.error('Apple unregister error:', err.message);
    res.status(500).end();
  }
});

// 5. Log de erros do dispositivo — endpoint exigido pela spec da Apple
router.post('/v1/log', (req, res) => {
  console.log('[apple log]', req.body);
  res.status(200).end();
});

// 6. Download inicial do pass — rota própria (não faz parte da spec da Apple),
//    equivalente à /carteirinha/:publicUid do Google Wallet
router.get('/download/:publicUid', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM members WHERE public_uid=$1', [req.params.publicUid]);
    const member = rows[0];

    if (!member || member.status !== 'active') {
      return res.status(404).send('Carteirinha não encontrada ou inativa.');
    }

    const buffer = await buildPassBuffer(member);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${member.member_code}.pkpass"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.send(buffer);
  } catch (err) {
    console.error('Apple download error:', err.message);
    res.status(500).send('Erro ao gerar carteirinha.');
  }
});

module.exports = router;