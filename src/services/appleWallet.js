const path = require('path');
const fs = require('fs');
const { PKPass } = require('passkit-generator');
const apn = require('apn');
const { pool } = require('../db');

const PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID; // ex: pass.com.periprod.npdecinema
const TEAM_ID = process.env.APPLE_TEAM_ID;
const ORG_NAME = process.env.COMMUNITY_NAME || 'Nosso Podcast de Cinema';

const SERVER_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'http://localhost:3000';

// Modelo do pass: pasta com pass.json + ícones/logo/strip (ver pass-models/npc.pass/)
const MODEL_PATH = path.join(__dirname, '../pass-models/npc.pass');

// Certificados: aceita base64 via env (Railway) ou arquivo local (dev)
function loadCert(envVarBase64, fallbackPath) {
  if (process.env[envVarBase64]) {
    return Buffer.from(process.env[envVarBase64], 'base64');
  }
  return fs.readFileSync(fallbackPath);
}

// certs/ fica dentro de services/, ao lado do próprio appleWallet.js
const CERTS_FALLBACK_DIR = path.join(__dirname, 'certs');

function getCertificates() {
  return {
    wwdr: loadCert('APPLE_WWDR_CERT_B64', path.join(CERTS_FALLBACK_DIR, 'wwdr.pem')),
    signerCert: loadCert('APPLE_SIGNER_CERT_B64', path.join(CERTS_FALLBACK_DIR, 'signerCert.pem')),
    signerKey: loadCert('APPLE_SIGNER_KEY_B64', path.join(CERTS_FALLBACK_DIR, 'signerKey.pem')),
    signerKeyPassphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE
  };
}

// Token de autenticação exigido pela Apple no header "Authorization: ApplePass <token>"
// Usamos o validation_token já existente (mesmo do QR/Google Wallet), preenchido até 16 chars
function authToken(member) {
  return member.validation_token.padEnd(16, '0');
}

async function buildPassBuffer(member) {
  const certificates = getCertificates();

  const pass = await PKPass.from(
    { model: MODEL_PATH, certificates },
    {
      serialNumber: member.member_code,
      description: `Carteirinha ${ORG_NAME}`,
      organizationName: ORG_NAME,
      passTypeIdentifier: PASS_TYPE_ID,
      teamIdentifier: TEAM_ID,
      webServiceURL: `${SERVER_URL}/apple`,
      authenticationToken: authToken(member)
    }
  );

  pass.type = 'storeCard';

  const validStr = new Date(member.valid_until).toLocaleDateString('pt-BR');
  const sinceStr = new Date(member.member_since).toLocaleDateString('pt-BR');

  pass.primaryFields.push({ key: 'name', label: 'Membro', value: member.name });
  pass.secondaryFields.push({ key: 'since', label: 'Membro desde', value: sinceStr });
  pass.auxiliaryFields.push({ key: 'until', label: 'Válido até', value: validStr });
  pass.backFields.push(
    // { key: 'plan', label: 'Plano', value: member.plan },
    { key: 'info', label: 'Mais informações', value: 'https://npdecinema.circle.so/c/descontos' }
  );

  pass.setBarcodes({
    message: `${SERVER_URL}/v/${member.member_code}/${member.validation_token}`,
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
    // altText: `Validade: ${validStr}`
  });

  return pass.getAsBuffer();
}

// Chamado quando o membro é criado/renovado/cancelado — equivalente ao createPass/updatePass do Google
async function createOrUpdatePkpass(member) {
  const buffer = await buildPassBuffer(member);

  await pool.query(
    'UPDATE members SET apple_update_tag = apple_update_tag + 1 WHERE id=$1',
    [member.id]
  );

  await notifyDevices(member.member_code).catch(err =>
    console.error('[apple push] falha ao notificar:', err.message)
  );

  return buffer;
}

// Envia push silencioso (background) pra Apple avisar que o pass mudou.
// O device, ao receber, chama de volta GET /v1/passes/:passTypeId/:serialNumber
async function notifyDevices(serialNumber) {
  const { rows } = await pool.query(
    'SELECT DISTINCT push_token FROM apple_device_registrations WHERE serial_number=$1',
    [serialNumber]
  );

  if (!rows.length) return null;

  const certificates = getCertificates();
  const provider = new apn.Provider({
    cert: certificates.signerCert,
    key: certificates.signerKey,
    passphrase: certificates.signerKeyPassphrase,
    production: process.env.NODE_ENV === 'production'
  });

  const note = new apn.Notification();
  note.topic = PASS_TYPE_ID;
  note.pushType = 'background';
  note.payload = {};

  const result = await provider.send(note, rows.map(r => r.push_token));
  provider.shutdown();
  return result;
}

module.exports = { buildPassBuffer, createOrUpdatePkpass, notifyDevices, authToken };