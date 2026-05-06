import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ASAAS_URL = 'https://api.asaas.com/v3'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('Unauthorized', { status: 401, headers: cors })

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } }
  )

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const isBalance = parts.at(-1) === 'balance'

  try {
    if (isBalance) {
      const { data: s } = await sb.from('LawyerSettings').select('asaasApiKey').maybeSingle()
      if (!s?.asaasApiKey) return Response.json({ balance: null }, { headers: cors })

      const res = await fetch(`${ASAAS_URL}/finance/balance`, {
        headers: { access_token: s.asaasApiKey },
      })
      const json = await res.json()
      return Response.json({ balance: json.balance ?? null }, { headers: cors })
    }

    // ── Payment list ─────────────────────────────────────────────────────────
    const status = url.searchParams.get('status')
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const pageSize = 20
    const from = (page - 1) * pageSize

    let q = sb
      .from('Payment')
      .select('*, client:Client(name,email), appointment:Appointment(specialty,date)', { count: 'exact' })
      .order('createdAt', { ascending: false })
    if (status && status !== 'all') q = q.eq('status', status)

    const { data: payments, error, count } = await q.range(from, from + pageSize - 1)
    if (error) throw error

    // ── Totals (all statuses) ────────────────────────────────────────────────
    const { data: all } = await sb.from('Payment').select('status,amount')
    const totals = { paid: 0, pending: 0, overdue: 0, cancelled: 0 }
    for (const p of all ?? []) {
      const amt = parseFloat(p.amount)
      if (p.status === 'PAID') totals.paid += amt
      else if (p.status === 'PENDING') totals.pending += amt
      else if (p.status === 'OVERDUE') totals.overdue += amt
      else if (p.status === 'CANCELLED') totals.cancelled += amt
    }

    // ── Chart: last 6 months of PAID payments ────────────────────────────────
    const sixAgo = new Date()
    sixAgo.setMonth(sixAgo.getMonth() - 6)
    const { data: paid } = await sb
      .from('Payment')
      .select('amount,paidAt')
      .eq('status', 'PAID')
      .gte('paidAt', sixAgo.toISOString())

    const byMonth: Record<string, number> = {}
    for (const p of paid ?? []) {
      const month = (p.paidAt as string)?.slice(0, 7)
      if (month) byMonth[month] = (byMonth[month] ?? 0) + parseFloat(p.amount)
    }
    const chartData = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }))

    return Response.json(
      {
        payments,
        total: totals,
        chartData,
        pagination: { page, total: count ?? 0, pages: Math.ceil((count ?? 0) / pageSize) },
      },
      { headers: cors }
    )
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
