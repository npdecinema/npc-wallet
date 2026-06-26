const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');

function generateMemberCode(prefix, id) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(id).padStart(5, '0')}`;
}

function defaultValidUntil() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

async function createMember({ circleId, name, email, plan, validUntil }) {
  const tempCode = uuidv4();
  const vUntil = validUntil || defaultValidUntil();
  const token = require('crypto').randomBytes(6).toString('hex');

  const { rows } = await pool.query(
    `INSERT INTO members (circle_id, name, email, plan, valid_until, member_code, validation_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (circle_id) DO UPDATE
       SET name=$2, email=$3, plan=$4, updated_at=NOW()
     RETURNING *`,
    [circleId, name, email, plan || 'Membro', vUntil, tempCode, token]
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

module.exports = { createMember, getMemberByCircleId, cancelMember, renewMember, getMembersDueForRenewal };
