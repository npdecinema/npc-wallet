const TOKEN = process.env.CIRCLE_API_TOKEN;
const GROUP_ID = process.env.CIRCLE_ACCESS_GROUP_ID;
const BASE = 'https://app.circle.so/api/admin/v2';

async function circleGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  if (!res.ok) throw new Error(`Circle API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function listSubscriberIds() {
  const ids = [];
  let page = 1;
  while (true) {
    const data = await circleGet(`/access_groups/${GROUP_ID}/community_members?per_page=100&page=${page}`);
    for (const r of data.records) ids.push(r.community_member_id);
    if (!data.has_next_page) break;
    page++;
  }
  return ids;
}

async function getMemberDetails(communityMemberId) {
  const m = await circleGet(`/community_members/${communityMemberId}`);
  return {
    circleId: String(m.id),
    name: [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Membro',
    email: m.email || '',
    publicUid: m.public_uid || ''
  };
}

module.exports = { listSubscriberIds, getMemberDetails };