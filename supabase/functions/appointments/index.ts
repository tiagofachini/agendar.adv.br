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
  const parts = url.pathname.split('/').filter(Boolean)
  // last segment is the ID if it isn't the function name
  const id = parts.at(-1) !== 'appointments' ? parts.at(-1) : null

  try {
    if (req.method === 'GET') {
      const start = url.searchParams.get('start')
      const end = url.searchParams.get('end')
      let q = sb
        .from('Appointment')
        .select('*, client:Client(name,email,whatsapp)')
        .order('date')
      if (start) q = q.gte('date', start)
      if (end) q = q.lte('date', end)
      const { data, error } = await q
      if (error) throw error
      return Response.json(data, { headers: cors })
    }

    if (req.method === 'POST') {
      const { data: lawyerId } = await sb.rpc('get_lawyer_id')
      const body = await req.json()
      const { data, error } = await sb
        .from('Appointment')
        .insert({ ...body, lawyerId })
        .select()
        .single()
      if (error) throw error
      return Response.json(data, { status: 201, headers: cors })
    }

    if (req.method === 'PUT' && id) {
      const body = await req.json()
      const { data, error } = await sb
        .from('Appointment')
        .update(body)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return Response.json(data, { headers: cors })
    }

    if (req.method === 'DELETE' && id) {
      const { error } = await sb.from('Appointment').delete().eq('id', id)
      if (error) throw error
      return new Response(null, { status: 204, headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
