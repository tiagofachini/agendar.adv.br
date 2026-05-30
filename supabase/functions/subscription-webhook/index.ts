import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&no-check'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_SUBSCRIPTION')
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET_SUBSCRIPTION not set')
    return new Response('Webhook secret not configured', { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing stripe-signature', { status: 400 })

  let event: Stripe.Event
  try {
    const body = await req.arrayBuffer()
    event = await stripe.webhooks.constructEventAsync(
      new Uint8Array(body),
      signature,
      webhookSecret,
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const lawyerId = session.metadata?.lawyerId
        if (!lawyerId) break

        const subscriptionId = session.subscription as string
        const customerId = session.customer as string

        await supabase
          .from('Lawyer')
          .update({
            plan: 'PRO',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          })
          .eq('id', lawyerId)

        console.log(`Lawyer ${lawyerId} upgraded to PRO via checkout`)

        // Programa de indicação: concede 1 mês ao indicador se ainda não recompensado
        const refCode = session.metadata?.refCode
        if (refCode) {
          const { data: referee } = await supabase
            .from('Lawyer')
            .select('referralRewardedAt')
            .eq('id', lawyerId)
            .maybeSingle()

          if (referee && !referee.referralRewardedAt) {
            const { data: referrer } = await supabase
              .from('Lawyer')
              .select('id, plan, planExpiresAt')
              .eq('referralCode', refCode)
              .maybeSingle()

            if (referrer && referrer.id !== lawyerId) {
              const base = referrer.plan === 'PRO' && referrer.planExpiresAt && new Date(referrer.planExpiresAt) > new Date()
                ? new Date(referrer.planExpiresAt)
                : new Date()
              base.setDate(base.getDate() + 30)

              await supabase.from('Lawyer')
                .update({ plan: 'PRO', planExpiresAt: base.toISOString() })
                .eq('id', referrer.id)

              await supabase.from('Lawyer')
                .update({ referralRewardedAt: new Date().toISOString() })
                .eq('id', lawyerId)

              console.log(`Referral reward: +30 days to ${referrer.id} (referred by code ${refCode})`)
            }
          }
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string | null
        if (!subscriptionId) break

        const { data: lawyer } = await supabase
          .from('Lawyer')
          .select('id')
          .eq('stripeSubscriptionId', subscriptionId)
          .maybeSingle()

        if (!lawyer) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString()

        await supabase
          .from('Lawyer')
          .update({ plan: 'PRO', planExpiresAt: periodEnd })
          .eq('id', lawyer.id)

        // Registra no histórico (ignora conflito de chave única)
        if (invoice.id) {
          const lineItem = invoice.lines?.data?.[0]
          const periodStart = lineItem?.period?.start
            ? new Date(lineItem.period.start * 1000).toISOString()
            : null
          const periodEndLine = lineItem?.period?.end
            ? new Date(lineItem.period.end * 1000).toISOString()
            : null

          await supabase.from('PlanSubscription').upsert({
            lawyerId: lawyer.id,
            stripeInvoiceId: invoice.id,
            amount: (invoice.amount_paid / 100).toFixed(2),
            status: 'paid',
            periodStart,
            periodEnd: periodEndLine,
          }, { onConflict: 'stripeInvoiceId', ignoreDuplicates: true })
        }

        console.log(`Lawyer ${lawyer.id} plan extended to ${periodEnd}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const { data: lawyer } = await supabase
          .from('Lawyer')
          .select('id')
          .eq('stripeSubscriptionId', subscription.id)
          .maybeSingle()

        if (!lawyer) break

        await supabase
          .from('Lawyer')
          .update({ plan: 'FREE', stripeSubscriptionId: null, planExpiresAt: null })
          .eq('id', lawyer.id)

        console.log(`Lawyer ${lawyer.id} downgraded to FREE`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error('Error processing webhook:', err)
    return new Response('Internal error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
