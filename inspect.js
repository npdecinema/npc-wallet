require('dotenv').config();
const { google } = require('googleapis');
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
const ISSUER = process.env.GOOGLE_WALLET_ISSUER_ID;
const CLASS = process.env.GOOGLE_WALLET_CLASS_ID;

(async () => {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'] });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  const res = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${ISSUER}.${CLASS}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('STATUS:', res.status);
  console.log('TEMPLATE:', JSON.stringify(data.classTemplateInfo, null, 2));
})();
