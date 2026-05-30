import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&no-check'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRO_PRICE_BRL = 2990 // R$ 29,90 in centavos
const SYSTEM_CONFIG_PRICE_KEY = 'stripe_pro_price_id'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autorizado' }, 401)

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return json({ error: 'Não autorizado' }, 401)

    const { data: lawyer } = await supabase
      .from('Lawyer')
      .select('id, plan, stripeCustomerId, stripeSubscriptionId, name, email')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (!lawyer) return json({ error: 'Advogado não encontrado' }, 404)

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })

    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    // GET /subscription → plano atual + histórico
    if (req.method === 'GET') {
      const { data: planInfo } = await supabase.rpc('get_plan_info')
      const { data: history } = await supabase
        .from('PlanSubscription')
        .select('*')
        .eq('lawyerId', lawyer.id)
        .order('createdAt', { ascending: false })
        .limit(12)
      return json({ planInfo, history: history ?? [] })
    }

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {}

    // POST /subscription/checkout → cria sessão de checkout Stripe
    if (req.method === 'POST' && path === 'checkout') {
      if (lawyer.plan === 'PRO') return json({ error: 'Você já é Pro' }, 400)

      const priceId = await getOrCreateProPrice(stripe, supabase)
      const customerId = await getOrCreateCustomer(stripe, supabase, lawyer)

      const refCode: string | undefined = body.refCode || undefined

      // Persiste o código de quem indicou, para fallback caso o metadata da sessão se perca
      if (refCode) {
        await supabase.from('Lawyer').update({ referredByCode: refCode }).eq('id', lawyer.id)
      }

      const meta: Record<string, string> = { lawyerId: lawyer.id }
      if (refCode) meta.refCode = refCode

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${Deno.env.get('SITE_URL') ?? 'https://agendar.adv.br'}/my-plan?checkout=success`,
        cancel_url: `${Deno.env.get('SITE_URL') ?? 'https://agendar.adv.br'}/my-plan?checkout=cancelled`,
        metadata: meta,
        subscription_data: { metadata: meta },
        locale: 'pt-BR',
      })

      return json({ url: session.url })
    }

    // POST /subscription/cancel → cancela assinatura
    if (req.method === 'POST' && path === 'cancel') {
      if (lawyer.plan !== 'PRO' || !lawyer.stripeSubscriptionId) {
        return json({ error: 'Sem assinatura ativa' }, 400)
      }

      await stripe.subscriptions.update(lawyer.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })

      return json({ ok: true, message: 'Assinatura cancelada ao fim do período.' })
    }

    // POST /subscription/portal → portal de faturamento Stripe
    if (req.method === 'POST' && path === 'portal') {
      if (!lawyer.stripeCustomerId) return json({ error: 'Sem conta Stripe' }, 400)

      const session = await stripe.billingPortal.sessions.create({
        customer: lawyer.stripeCustomerId,
        return_url: `${Deno.env.get('SITE_URL') ?? 'https://agendar.adv.br'}/my-plan`,
      })

      return json({ url: session.url })
    }

    return json({ error: 'Rota não encontrada' }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: e.message ?? 'Erro interno' }, 500)
  }
})

async function getOrCreateProPrice(stripe: Stripe, supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: cfg } = await supabase
    .from('SystemConfig')
    .select('value')
    .eq('key', SYSTEM_CONFIG_PRICE_KEY)
    .maybeSingle()

  if (cfg?.value) {
    try {
      const existing = await stripe.prices.retrieve(cfg.value)
      if (existing.currency === 'brl') return cfg.value
      // price em moeda errada — recria em BRL
    } catch { /* preço não existe mais, recria */ }
  }

  const product = await stripe.products.create({
    name: 'AgendarAdv Pro',
    description: 'Plano Pro do AgendarAdv — consultas ilimitadas, Google Agenda, Meet e mais.',
  })

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: PRO_PRICE_BRL,
    currency: 'brl',
    recurring: { interval: 'month' },
  })

  await supabase.from('SystemConfig').upsert({
    key: SYSTEM_CONFIG_PRICE_KEY,
    value: price.id,
    updatedAt: new Date().toISOString(),
  })

  return price.id
}

async function getOrCreateCustomer(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  lawyer: { id: string; stripeCustomerId: string | null; name: string; email: string }
): Promise<string> {
  if (lawyer.stripeCustomerId) {
    try {
      const c = await stripe.customers.retrieve(lawyer.stripeCustomerId)
      if (!(c as Stripe.DeletedCustomer).deleted) return lawyer.stripeCustomerId
    } catch { /* recria */ }
  }

  const customer = await stripe.customers.create({
    name: lawyer.name,
    email: lawyer.email,
    metadata: { lawyerId: lawyer.id },
  })

  await supabase
    .from('Lawyer')
    .update({ stripeCustomerId: customer.id })
    .eq('id', lawyer.id)

  return customer.id
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
