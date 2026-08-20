import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = 'emaildogago@gmail.com'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY_AGENDAR') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const { data: lawyer } = await sbAdmin
    .from('Lawyer')
    .select('id, name, email, referralCode')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!lawyer?.referralCode) return json({ error: 'Sem código de indicação' }, 400)

  const { data: points } = await sbAdmin.rpc('count_valid_referrals', { referral_code: lawyer.referralCode })
  if (Number(points ?? 0) < 10) return json({ error: 'Pontos insuficientes' }, 400)

  const { data: existing } = await sbAdmin
    .from('PrizeRequest')
    .select('id')
    .eq('lawyerId', lawyer.id)
    .eq('status', 'PENDING')
    .maybeSingle()

  if (existing) return json({ error: 'Já existe uma solicitação pendente' }, 409)

  await sbAdmin.from('PrizeRequest').insert({
    lawyerId: lawyer.id,
    lawyerName: lawyer.name,
    lawyerEmail: lawyer.email || user.email,
    points: Number(points),
  })

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'AgendarAdv <notificacoes@agendar.adv.br>',
      to: [ADMIN_EMAIL],
      subject: `[AgendarAdv] Pedido de prêmio — ${lawyer.name}`,
      html: `
        <p><strong>${lawyer.name}</strong> (${lawyer.email || user.email}) solicitou o voucher de R$300.</p>
        <p>Pontos de indicação válidos: <strong>${points}</strong></p>
        <p>Acesse o <a href="https://agendar.adv.br/admin">painel administrativo</a> para processar.</p>
      `,
    }),
  })

  return json({ ok: true })
})
