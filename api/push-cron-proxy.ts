import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const EDGE_URL = process.env.SUPABASE_EDGE_FUNCTION_URL; // ex: https://yhcxdcnveyxntfzwaovp.functions.supabase.co/push-cron
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

  if (!EDGE_URL || !ADMIN_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'Missing env SUPABASE_EDGE_FUNCTION_URL or ADMIN_TOKEN',
    });
  }

  try {
    const body = req.method === 'POST' && req.body ? req.body : {};

    const r = await fetch(EDGE_URL, {
      method: 'POST', // sempre POST para a Edge Function
      headers: {
        'content-type': 'application/json',
        'x-admin-token': ADMIN_TOKEN,
        // Se sua Edge AINDA exigir Authorization Bearer, descomente TEMPORARIAMENTE:
        // 'authorization': `Bearer ${process.env.SERVICE_ROLE_KEY ?? ''}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const text = await r.text();
    try {
      const json = JSON.parse(text);
      return res.status(r.status).json(json);
    } catch {
      return res.status(r.status).send(text);
    }
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Proxy error' });
  }
}
