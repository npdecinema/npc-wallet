const { google } = require('googleapis');
const jwt = require('jsonwebtoken');

// Roda direto do seu Mac. Precisa das env vars abaixo no seu .env local:
//   GOOGLE_APPLICATION_CREDENTIALS_JSON  (conteúdo completo do JSON da service account)
//   GOOGLE_WALLET_ISSUER_ID
//   GOOGLE_WALLET_CLASS_ID               (ex: npc_pass_v2, sem ponto)
//   RAILWAY_PUBLIC_DOMAIN                (ex: npdecinema.up.railway.app — precisa ser um
//                                          domínio público de verdade, porque o Google
//                                          busca as imagens de logo/hero do lado do servidor
//                                          deles; localhost não funciona aqui)
//
// Uso: node preview-google-pass.js
//
// Isso cria/atualiza um objeto de teste no issuer REAL de vocês (não é um sandbox
// separado), mas com um member_code isolado (TESTE-PREVIEW-001) — não mexe na tabela
// members do Postgres, então não conflita com membros de verdade.

require('dotenv').config();

let credentials;
try {
  credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
} catch (e) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON ausente ou inválido no .env local.');
  process.exit(1);
}

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID;
const CLASS_ID = `${ISSUER_ID}.${process.env.GOOGLE_WALLET_CLASS_ID || 'npc_generic'}`;
const BASE_URL = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SERVER_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'http://localhost:3000';

// Dados de teste — mude à vontade
const member = {
  member_code: 'TESTE-PREVIEW-001',
  name: 'Gustavo Rosa de Moura',
  plan: 'Membro',
  member_since: '2026-06-30',
  valid_until: '2026-07-30',
  validation_token: 'abc123token',
  status: 'active'
};

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
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Google Wallet API error ${res.status}: ${err}`);
  }

  return { status: res.status, data: res.status !== 204 ? await res.json() : null };
}

function buildPassObject(objectId) {
  const bgColor = process.env.CARD_BG_COLOR || '#AA170F';
  const validStr = new Date(member.valid_until).toLocaleDateString('pt-BR');
  const sinceStr = new Date(member.member_since).toLocaleDateString('pt-BR');

  return {
    id: objectId,
    classId: CLASS_ID,
    genericType: 'GENERIC_TYPE_UNSPECIFIED',
    state: 'ACTIVE',
    cardTitle: { defaultValue: { language: 'pt-BR', value: process.env.COMMUNITY_NAME || 'Nosso Podcast de Cinema' } },
    subheader: { defaultValue: { language: 'pt-BR', value: member.plan } },
    header: { defaultValue: { language: 'pt-BR', value: member.name } },
    hexBackgroundColor: bgColor,
    logo: {
      sourceUri: { uri: `${SERVER_URL}/images/logo_circulo.png` },
      contentDescription: { defaultValue: { language: 'pt-BR', value: 'Logo' } }
    },
    heroImage: {
      sourceUri: { uri: `${SERVER_URL}/images/google-io-hero-npc.jpg` },
      contentDescription: { defaultValue: { language: 'pt-BR', value: 'Hero Image Nosso Podcast de Cinema' } }
    },
    validTimeInterval: { end: { date: new Date(member.valid_until).toISOString() } },
    textModulesData: [
      { id: 'member_since', header: 'Membro desde', body: sinceStr },
      { id: 'valid_until', header: 'Válido até', body: validStr }
    ],
    barcode: {
      type: 'QR_CODE',
      value: `${SERVER_URL}/v/${member.member_code}/${member.validation_token}`,
      alternateText: `Validade: ${validStr}`
    }
  };
}

async function main() {
  const objectId = `${CLASS_ID}.${member.member_code}`;
  const passObject = buildPassObject(objectId);

  const { status } = await apiRequest('GET', `/genericObject/${encodeURIComponent(objectId)}`);

  if (status === 404) {
    await apiRequest('POST', '/genericObject', passObject);
    console.log('Objeto criado no Google Wallet.');
  } else {
    await apiRequest('PATCH', `/genericObject/${encodeURIComponent(objectId)}`, passObject);
    console.log('Objeto atualizado no Google Wallet.');
  }

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

  const url = `https://pay.google.com/gp/v/save/${token}`;
  console.log('\nAbra este link no navegador (ou envie pro celular):\n');
  console.log(url);
}

main().catch(err => {
  console.error('Erro ao gerar preview:', err.message);
  process.exit(1);
});