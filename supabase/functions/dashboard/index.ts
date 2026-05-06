import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  const period = url.searchParams.get('period') ?? 'day'

  try {
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const tomorrow = new Date(today.getTime() + 86_400_000)
    const dayAfter = new Date(tomorrow.getTime() + 86_400_000)

    let periodStart: Date
    let periodEnd: Date

    if (period === 'week') {
      const dow = today.getUTCDay()
      periodStart = new Date(today.getTime() - dow * 86_400_000)
      periodEnd = new Date(periodStart.getTime() + 7 * 86_400_000 - 1)
    } else if (period === 'month') {
      periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
    } else {
      periodStart = today
      periodEnd = new Date(today.getTime() + 86_400_000 - 1)
    }

    const [todayRes, tomorrowRes, receivablesRes, newClientsRes, newApptRes, nextApptRes] =
      await Promise.all([
        sb.from('Appointment')
          .select('id', { count: 'exact', head: true })
          .gte('date', today.toISOString())
          .lt('date', tomorrow.toISOString()),

        sb.from('Appointment')
          .select('id', { count: 'exact', head: true })
          .gte('date', tomorrow.toISOString())
          .lt('date', dayAfter.toISOString()),

        sb.from('Payment')
          .select('amount')
          .eq('status', 'PENDING')
          .gte('createdAt', periodStart.toISOString())
          .lte('createdAt', periodEnd.toISOString()),

        sb.from('Client')
          .select('id', { count: 'exact', head: true })
          .gte('createdAt', periodStart.toISOString())
          .lte('createdAt', periodEnd.toISOString()),

        sb.from('Appointment')
          .select('id', { count: 'exact', head: true })
          .gte('date', periodStart.toISOString())
          .lte('date', periodEnd.toISOString()),

        sb.from('Appointment')
          .select('*, client:Client(name)')
          .gt('date', now.toISOString())
          .not('status', 'eq', 'CANCELLED')
          .not('status', 'eq', 'COMPLETED')
          .order('date')
          .limit(1)
          .maybeSingle(),
      ])

    const receivables = (receivablesRes.data ?? []).reduce(
      (sum: number, p: { amount: string }) => sum + parseFloat(p.amount),
      0
    )

    return Response.json(
      {
        todayCount: todayRes.count ?? 0,
        tomorrowCount: tomorrowRes.count ?? 0,
        receivables,
        newClients: newClientsRes.count ?? 0,
        newAppointments: newApptRes.count ?? 0,
        nextAppointment: nextApptRes.data ?? null,
      },
      { headers: cors }
    )
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
