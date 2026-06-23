const { google } = require('googleapis');
const jwt = require('jsonwebtoken');

let credentials;
try {
  credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
} catch (e) {
  console.warn('Google Wallet: credenciais não configuradas ainda.');
}

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID;
const CLASS_ID = `${ISSUER_ID}.${process.env.GOOGLE_WALLET_CLASS_ID || 'npc_generic'}`;
const BASE_URL = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SERVER_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'http://localhost:3000';

async function getAccessToken() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

async function apiRequest(method, path, body) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Google Wallet API error ${res.status}: ${err}`);
  }

  return { status: res.status, data: res.status !== 204 ? await res.json() : null };
}

async function ensureClass() {
  const { status } = await apiRequest('GET', `/genericClass/${encodeURIComponent(CLASS_ID)}`);

  if (status === 404) {
    await apiRequest('POST', '/genericClass', {
      id: CLASS_ID,
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              twoItems: {
                startItem: { firstValue: { fields: [{ fieldPath: 'object.textModulesData["member_since"]' }] } },
                endItem:   { firstValue: { fields: [{ fieldPath: 'object.textModulesData["valid_until"]' }] } }
              }
            }
          ]
        }
      }
    });
    console.log('Google Wallet generic class criada:', CLASS_ID);
  }
}

function buildPassObject(member, objectId) {
  const bgColor = process.env.CARD_BG_COLOR || '#8a197e';
  const validStr = new Date(member.valid_until).toLocaleDateString('pt-BR');
  const sinceStr = new Date(member.member_since).toLocaleDateString('pt-BR');

  return {
    id: objectId,
    classId: CLASS_ID,
    genericType: 'GENERIC_TYPE_UNSPECIFIED',
    state: member.status === 'active' ? 'ACTIVE' : 'INACTIVE',
    cardTitle: {
      // defaultValue: { language: 'pt-BR', value: process.env.COMMUNITY_NAME || 'Nosso Podcast de Cinema' }
      defaultValue: { language: 'pt-BR', value: 'cardTitle' }
    },
    subheader: {
      defaultValue: { language: 'pt-BR', value: member.plan }
    },
    header: {
      defaultValue: { language: 'pt-BR', value: member.name }
    },
    hexBackgroundColor: bgColor,
    logo: {
      sourceUri: { uri: `${SERVER_URL}/images/logo_circulo.png` },
      contentDescription: { defaultValue: { language: 'pt-BR', value: 'Capa Nosso Podcast de Cinema' } }
    },
    // heroImage: {
    //   sourceUri: { uri: `${SERVER_URL}/images/titulo.png` },
    //   contentDescription: { defaultValue: { language: 'pt-BR', value: 'Banner do podcast' } }
    // },
    textModulesData: [
      { id: 'member_since', header: 'Membro desde', body: sinceStr },
      { id: 'valid_until', header: 'Válido até', body: validStr }
    ]
  };
}

async function createPass(member) {
  if (!credentials) throw new Error('Google Wallet não configurado.');

  await ensureClass();

  const objectId = `${CLASS_ID}.${member.member_code}`;
  const passObject = buildPassObject(member, objectId);

  const { status } = await apiRequest('GET', `/genericObject/${encodeURIComponent(objectId)}`);

  if (status === 404) {
    await apiRequest('POST', '/genericObject', passObject);
  } else {
    await apiRequest('PATCH', `/genericObject/${encodeURIComponent(objectId)}`, passObject);
  }

  await require('../db').pool.query(
    'UPDATE members SET google_object_id=$1 WHERE id=$2',
    [objectId, member.id]
  );

  const token = jwt.sign(
    {
      iss: credentials.client_email,
      aud: 'google',
      origins: [],
      typ: 'savetowallet',
      payload: { genericObjects: [{ id: objectId }] }
    },
    credentials.private_key,
    { algorithm: 'RS256' }
  );

  return `https://pay.google.com/gp/v/save/${token}`;
}

async function updatePass(member) {
  return createPass(member);
}

async function deactivatePass(member) {
  if (!credentials || !member.google_object_id) return;

  await apiRequest('PATCH', `/genericObject/${encodeURIComponent(member.google_object_id)}`, {
    state: 'INACTIVE'
  });
}

module.exports = { createPass, updatePass, deactivatePass };