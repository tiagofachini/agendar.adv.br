import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Server-side callback URL — avoids Supabase JS intercepting ?code= in the SPA
const REDIRECT_URI = 'https://nfgexlsfmyfypueslzxo.supabase.co/functions/v1/google-calendar/callback'
const APP_SETTINGS_URL = 'https://agendar.adv.br/settings'
const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const url = new URL(req.url)
  const action = url.pathname.split('/').filter(Boolean).at(-1)

  // ── GET /google-calendar/callback — chamado pelo Google após autorização ────
  // Não exige Authorization header: usa state para identificar o advogado
  if (req.method === 'GET' && action === 'callback') {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code || !state) {
      return Response.redirect(`${APP_SETTINGS_URL}?calendar=error&reason=missing_params`, 302)
    }

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: settings, error: stateErr } = await sbAdmin.from('LawyerSettings')
      .select('lawyerId')
      .eq('googleOAuthState', state)
      .maybeSingle()

    if (stateErr) {
      return Response.redirect(`${APP_SETTINGS_URL}?calendar=error&reason=db_error&detail=${encodeURIComponent(stateErr.message)}`, 302)
    }

    if (!settings) {
      return Response.redirect(`${APP_SETTINGS_URL}?calendar=error&reason=state_not_found`, 302)
    }

    try {
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      })

      const tokens = await tokenRes.json()

      if (!tokens.refresh_token) {
        const detail = tokens.error ? `${tokens.error}:${tokens.error_description}` : 'no_refresh_token'
        return Response.redirect(`${APP_SETTINGS_URL}?calendar=error&reason=token_exchange&detail=${encodeURIComponent(detail)}`, 302)
      }

      await sbAdmin.from('LawyerSettings').update({
        googleCalendarRefreshToken: tokens.refresh_token,
        googleCalendarConnected: true,
        googleOAuthState: null,
      }).eq('lawyerId', settings.lawyerId)

      return Response.redirect(`${APP_SETTINGS_URL}?calendar=success`, 302)
    } catch (err) {
      return Response.redirect(`${APP_SETTINGS_URL}?calendar=error&reason=exception&detail=${encodeURIComponent(err.message)}`, 302)
    }
  }

  // ── Todas as demais rotas exigem autenticação ─────────────────────────────
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

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

  try {
    const { data: lawyer } = await sb.from('Lawyer').select('id').maybeSingle()
    if (!lawyer) return Response.json({ error: 'Perfil não encontrado' }, { status: 404, headers: cors })

    // ── POST /google-calendar/auth-url ──────────────────────────────────────
    if (action === 'auth-url') {
      const state = crypto.randomUUID()

      const { data: existing } = await sbAdmin.from('LawyerSettings')
        .select('id')
        .eq('lawyerId', lawyer.id)
        .maybeSingle()

      const { error: upsertErr } = await sbAdmin.from('LawyerSettings').upsert(
        {
          id: existing?.id ?? crypto.randomUUID(),
          lawyerId: lawyer.id,
          googleOAuthState: state,
          ...(existing ? {} : { workDays: [1, 2, 3, 4, 5] }),
        },
        { onConflict: 'lawyerId' }
      )

      if (upsertErr) return Response.json({ error: upsertErr.message }, { status: 500, headers: cors })

      const params = new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: CALENDAR_SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        state,
      })

      return Response.json({ url: `${GOOGLE_AUTH_BASE}?${params}` }, { headers: cors })
    }

    // ── POST /google-calendar/disconnect ────────────────────────────────────
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
