export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  const APP_ID     = process.env.LARK_APP_ID;
  const APP_SECRET = process.env.LARK_APP_SECRET;
  const APP_TOKEN  = process.env.LARK_APP_TOKEN;
  const TABLE_ID   = process.env.LARK_TABLE_ID;

  try {
    // 1. Get tenant access token
    const tokenRes = await fetch(
      'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET })
      }
    );
    const tokenData = await tokenRes.json();
    const token = tokenData.tenant_access_token;
    if (!token) throw new Error('Failed to get access token');

    // 2. Search Lark Base records by phone number
    let records = [], pageToken = null, hasMore = true;

    while (hasMore) {
      const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/search`
        + (pageToken ? `?page_token=${encodeURIComponent(pageToken)}` : '');

      const searchRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          page_size: 500,
          field_names: ['Name', 'Phone Number', 'Total Price', 'AUTO N/R', 'AUTO VIP', 'LTV sum'],
          filter: {
            conjunction: 'and',
            conditions: [{
              field_name: 'Phone Number',
              operator: 'contains',
              value: [phone]
            }]
          }
        })
      });

      const searchData = await searchRes.json();
      if (searchData.code !== 0) throw new Error(searchData.msg || 'Lark query failed');

      records = records.concat(searchData.data?.items || []);
      hasMore = !!searchData.data?.has_more;
      pageToken = searchData.data?.page_token || null;
    }

    res.status(200).json({ records });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
