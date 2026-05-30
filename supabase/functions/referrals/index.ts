import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://agendar.adv.br'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('Unauthorized', { status: 401, headers: cors })

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } }
  )

  try {
    if (req.method === 'GET') {
      const { data: code, error: codeErr } = await sb.rpc('get_or_create_referral_code')
      if (codeErr) throw codeErr

      const { data: stats, error: statsErr } = await sb.rpc('get_referral_stats')
      if (statsErr) throw statsErr

      const row = (stats as { total: number; reward_months: number }[] | null)?.[0]
      return Response.json({
        code,
        link: `${SITE_URL}/?ref=${code}`,
        total: Number(row?.total ?? 0),
        rewardMonths: Number(row?.reward_months ?? 0),
      }, { headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500, headers: cors })
  }
})
