import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`
  if (digits.length === 11 || digits.length === 10) return `+55${digits}`
  return `+${digits}`
}

async function sendTwilioMessage(to: string, body: string): Promise<string> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
  const rawFrom = Deno.env.get('TWILIO_WHATSAPP_FROM')!
  const from = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`
  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: toWa, Body: body }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Erro Twilio')
  return data.sid
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const action = parts.at(-1)

  // ── Webhook Twilio para mensagens recebidas (sem autenticação) ────────────
  if (req.method === 'POST' && action === 'webhook') {
    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    try {
      const text = await req.text()
      const params = new URLSearchParams(text)
      const from = params.get('From') ?? ''
      const body = params.get('Body') ?? ''
      const twilioSid = params.get('MessageSid') ?? ''

      const fromDigits = from.replace(/\D/g, '')
      if (!fromDigits || !body) return new Response('OK', { status: 200 })

      // Busca client pelo sufixo do número (últimos 9 dígitos)
      const suffix = fromDigits.slice(-9)
      const { data: client } = await sbAdmin
        .from('Client')
        .select('id, lawyerId')
        .ilike('whatsapp', `%${suffix}`)
        .maybeSingle()

      if (client) {
        await sbAdmin.from('WhatsAppMessage').insert({
          lawyerId: client.lawyerId,
          clientId: client.id,
          direction: 'INBOUND',
          body,
          status: 'received',
          twilioSid,
        })
      }
    } catch (_) { /* noop */ }
    return new Response('<?xml version="1.0"?><Response/>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // ── Rotas autenticadas ────────────────────────────────────────────────────
  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('Unauthorized', { status: 401, headers: cors })

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } }
  )

  try {
    // GET /whatsapp?clientId=...
    if (req.method === 'GET') {
      const clientId = url.searchParams.get('clientId')
      if (!clientId) return Response.json({ error: 'clientId required' }, { status: 400, headers: cors })

      const { data, error } = await sb
        .from('WhatsAppMessage')
        .select('*')
        .eq('clientId', clientId)
        .order('createdAt')
      if (error) throw error
      return Response.json(data ?? [], { headers: cors })
    }

    // POST /whatsapp/send  { clientId, message }
    if (req.method === 'POST' && action === 'send') {
      const { clientId, message } = await req.json()
      if (!clientId || !message?.trim()) {
        return Response.json({ error: 'clientId e message obrigatórios' }, { status: 400, headers: cors })
      }

      const { data: client } = await sb
        .from('Client')
        .select('id, whatsapp')
        .eq('id', clientId)
        .maybeSingle()

      if (!client?.whatsapp) {
        return Response.json({ error: 'Cliente sem WhatsApp cadastrado' }, { status: 400, headers: cors })
      }

      const { data: lawyerId } = await sb.rpc('get_lawyer_id')
      const phone = toE164(client.whatsapp)
      const twilioSid = await sendTwilioMessage(phone, message.trim())

      const { data: msg, error } = await sb
        .from('WhatsAppMessage')
        .insert({
          lawyerId,
          clientId,
          direction: 'OUTBOUND',
          body: message.trim(),
          status: 'sent',
          twilioSid,
        })
        .select()
        .single()
      if (error) throw error
      return Response.json(msg, { status: 201, headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
