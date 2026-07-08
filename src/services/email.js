const nodemailer = require('nodemailer');
const dns = require('dns').promises;

const SERVER_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'http://localhost:3000';

async function getTransporter() {
  const { address } = await dns.lookup('smtp.gmail.com', { family: 4 });
  return nodemailer.createTransport({
    host: address,
    port: 587,
    secure: false,
    requireTLS: true,
    tls: { servername: 'smtp.gmail.com' },
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_APP_PASSWORD
    }
  });
}

async function sendCarteirinhaEmail(member) {
  if (!member.email) {
    console.log(`[email] membro ${member.member_code} sem e-mail, pulando`);
    return;
  }

  const link = `${SERVER_URL}/carteirinha/${member.public_uid}`;
  const transporter = await getTransporter();

  await transporter.sendMail({
    from: `"Nosso Podcast de Cinema" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: member.email,
    subject: 'Sua carteirinha do Nosso Podcast de Cinema',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#2a1a0e">
        <h2>Olá, ${member.name}!</h2>
        <p>Sua carteirinha de membro está pronta. Toque no botão abaixo para adicioná-la ao Google Wallet:</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${link}" style="display:inline-block;background:#2a1a0e;color:#f5efe6;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:500">Acessar minha carteirinha</a>
        </p>
        <p style="font-size:13px;color:#8a6040">Se o botão não funcionar, copie e cole este link: ${link}</p>
      </div>
    `
  });

  console.log(`[email] enviado para ${member.member_code}`);
}

module.exports = { sendCarteirinhaEmail };