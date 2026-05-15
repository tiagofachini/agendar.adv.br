import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const REDIRECT_URI = 'https://agendar.adv.br/configuracoes'
const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('Unauthorized', { status: 401, headers: cors })

  const url = new URL(req.url)
  const action = url.pathname.split('/').filter(Boolean).at(-1)

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } }
  )
  const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { data: lawyer } = await sb.from('Lawyer').select('id').maybeSingle()
    if (!lawyer) return Response.json({ error: 'Perfil não encontrado' }, { status: 404, headers: cors })

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!

    // ── POST /google-calendar/auth-url ────────────────────────────────────────
    if (action === 'auth-url') {
      const state = crypto.randomUUID()

      await sbAdmin.from('LawyerSettings').upsert(
        { lawyerId: lawyer.id, googleOAuthState: state, workDays: [1, 2, 3, 4, 5] },
        { onConflict: 'lawyerId' }
      )

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: CALENDAR_SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        state,
      })

      return Response.json({ url: `${GOOGLE_AUTH_BASE}?${params}` }, { headers: cors })
    }

    // ── POST /google-calendar/exchange ────────────────────────────────────────
    if (action === 'exchange') {
      const { code, state } = await req.json()
      if (!code || !state) {
        return Response.json({ error: 'code e state são obrigatórios' }, { status: 400, headers: cors })
      }

      const { data: s } = await sb.from('LawyerSettings')
        .select('googleOAuthState')
        .eq('lawyerId', lawyer.id)
        .maybeSingle()

      if (!s?.googleOAuthState || s.googleOAuthState !== state) {
        return Response.json({ error: 'Estado OAuth inválido ou expirado' }, { status: 400, headers: cors })
      }

      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      })

      const tokens = await tokenRes.json()

      if (!tokens.refresh_token) {
        return Response.json(
          { error: 'Token de atualização não recebido. Desconecte e reconecte sua conta Google.' },
          { status: 400, headers: cors }
        )
      }

      await sbAdmin.from('LawyerSettings').update({
        googleCalendarRefreshToken: tokens.refresh_token,
        googleCalendarConnected: true,
        googleOAuthState: null,
      }).eq('lawyerId', lawyer.id)

      return Response.json({ ok: true }, { headers: cors })
    }

    // ── POST /google-calendar/disconnect ─────────────────────────────────────
    if (action === 'disconnect') {
      await sbAdmin.from('LawyerSettings').update({
        googleCalendarRefreshToken: null,
        googleCalendarConnected: false,
      }).eq('lawyerId', lawyer.id)

      return Response.json({ ok: true }, { headers: cors })
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
