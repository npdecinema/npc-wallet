const { listSubscriberIds, getMemberDetails } = require('./circle');
const { createMember, cancelMember, getActiveCircleIds, expireRenewals } = require('./passService');
const { createPass, deactivatePass } = require('./googleWallet');
const { pool } = require('../db');
const { sendCarteirinhaEmail } = require('./email');

async function syncSubscribers() {
  const circleIdsNoGrupo = (await listSubscriberIds()).map(String);
  const ativosNoBanco = await getActiveCircleIds();

  const novos = circleIdsNoGrupo.filter(id => !ativosNoBanco.includes(id));
  const sairam = ativosNoBanco.filter(id => !circleIdsNoGrupo.includes(id));

  const criados = [];
  for (const circleId of novos) {
    const det = await getMemberDetails(circleId);
    const member = await createMember(det);
    await createPass(member);
    await sendCarteirinhaEmail(member).catch(e => console.error('[email] falha:', e.message));
    criados.push(member.member_code);
  }

  const expirados = [];
  for (const circleId of sairam) {
    const member = await cancelMember(circleId);
    if (member) { await deactivatePass(member); expirados.push(member.member_code); }
  }

  await expireRenewals();
  const { rows } = await pool.query("SELECT * FROM members WHERE status='active' AND valid_until <= CURRENT_DATE + INTERVAL '5 days'");
  for (const m of rows) await createPass(m);

  console.log(`[sync] criados: ${criados.length}, expirados: ${expirados.length}, grupo: ${circleIdsNoGrupo.length}`);
  return { criados, expirados, total_grupo: circleIdsNoGrupo.length };
}

module.exports = { syncSubscribers };
