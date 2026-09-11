const { listSubscriberIds, getMemberDetails } = require('./circle');
const { createMember, cancelMember, getActiveCircleIds, expireRenewals, updateMemberProfile, getMemberByCircleId } = require('./passService');
const { createPass, deactivatePass } = require('./googleWallet');
const { createOrUpdatePkpass } = require('./appleWallet');
const { pool } = require('../db');

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
    await createOrUpdatePkpass(member).catch(err =>
      console.error('[apple] falha ao criar pass:', err.message)
    );
    criados.push(member.member_code);
  }

  const expirados = [];
  for (const circleId of sairam) {
    const member = await cancelMember(circleId);
    if (member) {
      await deactivatePass(member);
      await createOrUpdatePkpass(member).catch(err =>
        console.error('[apple] falha ao expirar pass:', err.message)
      );
      expirados.push(member.member_code);
    }
  }

  await expireRenewals();
  const { rows } = await pool.query("SELECT * FROM members WHERE status='active' AND valid_until <= CURRENT_DATE + INTERVAL '5 days'");
  for (const m of rows) {
    await createPass(m);
    await createOrUpdatePkpass(m).catch(err =>
      console.error('[apple] falha ao renovar pass:', err.message)
    );
  }

  console.log(`[sync] criados: ${criados.length}, expirados: ${expirados.length}, grupo: ${circleIdsNoGrupo.length}`);
  return { criados, expirados, total_grupo: circleIdsNoGrupo.length };
}

// Roda periodicamente (ver cron em index.js). Atualiza name/email/plan
// de todo membro já ativo, comparando com o Circle. Custa 1 chamada de API
// por membro ativo ao Circle (sem endpoint de lote). Só chama os wallets
// (Google/Apple) para quem teve name ou plan de fato alterado — evita
// reenviar push e reescrever pass pra quem não mudou nada.
async function refreshMemberProfiles() {
  const ativosNoBanco = await getActiveCircleIds();
  let atualizados = 0;
  let walletsAtualizados = 0;

  for (const circleId of ativosNoBanco) {
    try {
      const antes = await getMemberByCircleId(circleId);
      const det = await getMemberDetails(circleId);

      const mudou = det.name !== antes.name || det.plan !== antes.plan;

      const member = await updateMemberProfile(circleId, det);
      atualizados++;

      if (mudou) {
        await createPass(member);
        await createOrUpdatePkpass(member).catch(err =>
          console.error(`[refresh] falha ao atualizar wallet de ${circleId}:`, err.message)
        );
        walletsAtualizados++;
      }
    } catch (err) {
      console.error(`[refresh] falha ao atualizar ${circleId}:`, err.message);
    }
  }

  console.log(`[refresh] perfis atualizados: ${atualizados} de ${ativosNoBanco.length}, wallets reenviados: ${walletsAtualizados}`);
  return { atualizados, walletsAtualizados, total: ativosNoBanco.length };
}

module.exports = { syncSubscribers, refreshMemberProfiles };