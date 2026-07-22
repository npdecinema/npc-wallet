const path = require('path');
const fs = require('fs');
const { PKPass } = require('passkit-generator');

const MODEL_PATH = path.join(__dirname, 'src/pass-models/npc.pass');
const CERTS_DIR = path.join(__dirname, 'src/services/certs');

// Dados de teste — mude à vontade pra simular diferentes membros
const member = {
  member_code: 'NPC-2026-TESTE',
  name: 'Gustavo Rosa de Moura',
  plan: 'Pacote Cinéfilo',
  member_since: '2026-06-30',
  valid_until: '2026-07-30',
  validation_token: 'abc123token'
};

async function main() {
  const certificates = {
    wwdr: fs.readFileSync(path.join(CERTS_DIR, 'wwdr.pem')),
    signerCert: fs.readFileSync(path.join(CERTS_DIR, 'signerCert.pem')),
    signerKey: fs.readFileSync(path.join(CERTS_DIR, 'signerKey.pem'))
  };

  const pass = await PKPass.from(
    { model: MODEL_PATH, certificates },
    {
      serialNumber: member.member_code,
      description: 'Carteirinha Nosso Podcast de Cinema (PREVIEW)',
      organizationName: 'Nosso Podcast de Cinema',
      passTypeIdentifier: 'pass.com.periprod.npdecinema',
      teamIdentifier: '5Q4RMZ7452',
      webServiceURL: 'https://example.com/apple',
      authenticationToken: member.validation_token.padEnd(16, '0')
    }
  );

  pass.type = 'storeCard';

  const validStr = new Date(member.valid_until).toLocaleDateString('pt-BR');
  const sinceStr = new Date(member.member_since).toLocaleDateString('pt-BR');

  pass.primaryFields.push({ key: 'name', label: 'Membro', value: member.name });
  pass.secondaryFields.push({ key: 'since', label: 'Membro desde', value: sinceStr });
  pass.auxiliaryFields.push({ key: 'until', label: 'Válido até', value: validStr });
  pass.backFields.push(
    { key: 'plan', label: 'Plano', value: member.plan },
    { key: 'info', label: 'Mais informações', value: 'https://periprod.com/npdecinema' }
  );

  pass.setBarcodes({
    message: `https://example.com/v/${member.member_code}/${member.validation_token}`,
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
    altText: `Validade: ${validStr}`
  });

  const buffer = await pass.getAsBuffer();
  const outPath = path.join(__dirname, 'preview.pkpass');
  fs.writeFileSync(outPath, buffer);

  console.log(`Gerado: ${outPath}`);
  console.log('Abra com: open preview.pkpass  (ou selecione + barra de espaço no Finder)');
}

main().catch(err => {
  console.error('Erro ao gerar preview:', err.message);
  process.exit(1);
});