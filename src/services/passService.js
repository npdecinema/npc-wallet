const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');

function generateMemberCode(prefix, id) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(id).padStart(5, '0')}`;
}

function defaultValidUntil() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

async function createMember({ circleId, name, email, plan, validUntil, publicUid }) {
  const tempCode = uuidv4();
  const vUntil = validUntil || defaultValidUntil();
  const token = require('crypto').randomBytes(6).toString('hex');

  const { rows } = await pool.query(
    `INSERT INTO members (circle_id, name, email, plan, valid_until, member_code, validation_token, public_uid)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (circle_id) DO UPDATE
       SET name=$2, email=$3, plan=$4, public_uid=$8, updated_at=NOW()
     RETURNING *`,
    [circleId, name, email, plan || 'Membro', vUntil, tempCode, token, publicUid || null]
  );

  const member = rows[0];

  if (member.member_code === tempCode) {
    const code = generateMemberCode(
      process.env.COMMUNITY_SHORT || 'NPC',
      member.id
    );
    await pool.query(
      'UPDATE members SET member_code=$1 WHERE id=$2',
      [code, member.id]
    );
    member.member_code = code;
  }

  return member;
}

async function getMemberByCircleId(circleId) {
  const { rows } = await pool.query(
    'SELECT * FROM members WHERE circle_id=$1',
    [circleId]
  );
  return rows[0] || null;
}

async function cancelMember(circleId) {
  const { rows } = await pool.query(
    `UPDATE members SET status='inactive', updated_at=NOW()
     WHERE circle_id=$1 RETURNING *`,
    [circleId]
  );
  return rows[0] || null;
}

async function renewMember(circleId, newValidUntil) {
  const vUntil = newValidUntil || defaultValidUntil();
  const { rows } = await pool.query(
    `UPDATE members SET valid_until=$1, status='active', updated_at=NOW()
     WHERE circle_id=$2 RETURNING *`,
    [vUntil, circleId]
  );
  return rows[0] || null;
}

async function getMembersDueForRenewal() {
  const { rows } = await pool.query(
    `SELECT * FROM members
     WHERE status='active'
       AND valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`
  );
  return rows;
}

async function getActiveCircleIds() {
  const { rows } = await pool.query(
    "SELECT circle_id FROM members WHERE status='active'"
  );
  return rows.map(r => r.circle_id);
}

async function expireRenewals() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  const vUntil = d.toISOString().split('T')[0];
  await pool.query(
    "UPDATE members SET valid_until=$1, updated_at=NOW() WHERE status='active' AND valid_until <= CURRENT_DATE + INTERVAL '5 days'",
    [vUntil]
  );
}

async function getMemberByPublicUid(publicUid) {
  const { rows } = await pool.query(
    'SELECT * FROM members WHERE public_uid=$1',
    [publicUid]
  );
  return rows[0] || null;
}

module.exports = { createMember, getMemberByCircleId, getMemberByPublicUid, cancelMember, renewMember, getMembersDueForRenewal, getActiveCircleIds, expireRenewals };