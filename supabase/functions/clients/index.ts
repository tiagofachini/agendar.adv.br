import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const RESEND_URL = 'https://api.resend.com/emails'
const FROM_EMAIL = 'AgendarAdv <notificacoes@agendar.adv.br>'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('Unauthorized', { status: 401, headers: cors })

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } }
  )
  const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  // Extrai partes após "clients": /functions/v1/clients[/id[/action]]
  const clientsIdx = parts.lastIndexOf('clients')
  const baseParts = parts.slice(clientsIdx + 1)
  const id = baseParts[0] || null
  const action = baseParts[1] || null

  try {
    // GET /clients/stats
    if (req.method === 'GET' && id === 'stats') {
      const now = new Date()
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      const [
        { count: total },
        { data: past30Appts },
        { data: next30Appts },
      ] = await Promise.all([
        sb.from('Client').select('*', { count: 'exact', head: true }),
        sb.from('Appointment')
          .select('clientId')
          .gte('date', past30.toISOString())
          .lte('date', now.toISOString())
          .neq('status', 'CANCELLED')
          .not('clientId', 'is', null),
        sb.from('Appointment')
          .select('clientId')
          .gte('date', now.toISOString())
          .lte('date', next30.toISOString())
          .not('status', 'in', '("CANCELLED","EXPIRED")')
          .not('clientId', 'is', null),
      ])

      type Row = { clientId: string }
      const past30Count = new Set((past30Appts ?? []).map((a: Row) => a.clientId)).size
      const next30Count = new Set((next30Appts ?? []).map((a: Row) => a.clientId)).size

      return Response.json({ total: total ?? 0, past30: past30Count, next30: next30Count }, { headers: cors })
    }

    // POST /clients/:id/message  (envio de email)
    if (req.method === 'POST' && id && action === 'message') {
      const { subject, body } = await req.json()
      if (!body?.trim()) {
        return Response.json({ error: 'Mensagem obrigatória' }, { status: 400, headers: cors })
      }

      const { data: client, error: clientErr } = await sb
        .from('Client')
        .select('name, email')
        .eq('id', id)
        .single()
      if (clientErr || !client) {
        return Response.json({ error: 'Cliente não encontrado' }, { status: 404, headers: cors })
      }
      if (!client.email) {
        return Response.json({ error: 'Cliente sem email cadastrado' }, { status: 400, headers: cors })
      }

      const RESEND_KEY = Deno.env.get('RESEND_API_KEY_AGENDAR')
      if (!RESEND_KEY) {
        return Response.json({ error: 'Serviço de email não configurado' }, { status: 503, headers: cors })
      }

      const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: client.email,
          subject: subject?.trim() || 'Mensagem do seu advogado',
          html: `<p style="font-family:sans-serif;line-height:1.6">${body.trim().replace(/\n/g, '<br>')}</p>`,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { message?: string }
        throw new Error(errData.message || 'Erro ao enviar email')
      }

      return Response.json({ ok: true }, { headers: cors })
    }

    // GET /clients/:id
    if (req.method === 'GET' && id) {
      const { data, error } = await sb
        .from('Client')
        .select('*, appointments:Appointment(*), payments:Payment(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return Response.json(data, { headers: cors })
    }

    // GET /clients
    if (req.method === 'GET') {
      const search = url.searchParams.get('search') ?? ''
      const page = parseInt(url.searchParams.get('page') ?? '1')
      const limit = parseInt(url.searchParams.get('limit') ?? '30')
      const city = url.searchParams.get('city') ?? ''
      const state = url.searchParams.get('state') ?? ''
      const from = (page - 1) * limit

      let q = sb
        .from('Client')
        .select('*, appointments:Appointment(count)', { count: 'exact' })
        .order('name')
      if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      if (city) q = q.ilike('city', `%${city}%`)
      if (state) q = q.eq('state', state.toUpperCase())

      const { data, error, count } = await q.range(from, from + limit - 1)
      if (error) throw error

      type Row = Record<string, unknown> & { appointments: { count: number }[] }
      const clients = (data ?? []).map(({ appointments, ...c }: Row) => ({
        ...c,
        _count: { appointments: appointments?.[0]?.count ?? 0 },
      }))
      return Response.json(
        { clients, total: count, page, pages: Math.ceil((count ?? 0) / limit) },
        { headers: cors }
      )
    }

    // POST /clients
    if (req.method === 'POST') {
      const { data: lawyerId } = await sb.rpc('get_lawyer_id')
      const body = await req.json()
      const { data, error } = await sb
        .from('Client')
        .insert({ ...body, lawyerId })
        .select()
        .single()
      if (error) throw error
      return Response.json(data, { status: 201, headers: cors })
    }

    // PUT /clients/:id
    if (req.method === 'PUT' && id && id !== 'bulk') {
      const body = await req.json()
      const { data, error } = await sb
        .from('Client')
        .update(body)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return Response.json(data, { headers: cors })
    }

    // DELETE /clients/bulk
    if (req.method === 'DELETE' && id === 'bulk') {
      const { ids } = await req.json()
      if (!Array.isArray(ids) || ids.length === 0) {
        return Response.json({ error: 'ids required' }, { status: 400, headers: cors })
      }
      const { data: lawyerId } = await sb.rpc('get_lawyer_id')
      if (!lawyerId) return Response.json({ error: 'Perfil não encontrado' }, { status: 404, headers: cors })
      const { error } = await sbAdmin.from('Client').delete().in('id', ids).eq('lawyerId', lawyerId)
      if (error) throw error
      return new Response(null, { status: 204, headers: cors })
    }

    // DELETE /clients/:id
    if (req.method === 'DELETE' && id) {
      const { data: lawyerId } = await sb.rpc('get_lawyer_id')
      if (!lawyerId) return Response.json({ error: 'Perfil não encontrado' }, { status: 404, headers: cors })
      const { error } = await sbAdmin.from('Client').delete().eq('id', id).eq('lawyerId', lawyerId)
      if (error) throw error
      return new Response(null, { status: 204, headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500, headers: cors })
  }
})
