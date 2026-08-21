import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_BASE = 'https://www.asaas.com/api/v3'
const RESEND_URL = 'https://api.resend.com/emails'
const FROM_EMAIL = 'AgendarAdv <notificacoes@agendar.adv.br>'

function confirmedEmailHtml(p: {
  lawyerName: string; dateStr: string; timeStr: string
  specialty: string; address: string; meetingLink: string | null
  amountStr: string
}) {
  const locationRow = p.meetingLink
    ? `<tr><td style="color:#6b7280;padding:6px 0;width:40%">Reuni&atilde;o online</td><td style="font-weight:600"><a href="${p.meetingLink}" style="color:#2563eb">${p.meetingLink}</a></td></tr>`
    : p.address ? `<tr><td style="color:#6b7280;padding:6px 0;width:40%">Local</td><td style="font-weight:600">${p.address}</td></tr>` : ''

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827">
  <div style="background:#1a1a2e;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
    <h1 style="color:white;margin:0;font-size:20px">AgendarAdv</h1>
    <p style="color:#a0aec0;margin:8px 0 0">Consulta confirmada</p>
  </div>
  <p>Ol&aacute;! Seu pagamento foi aprovado e sua consulta com <strong>${p.lawyerName}</strong> est&aacute; confirmada.</p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:16px 0;text-align:center">
    <p style="color:#16a34a;font-weight:700;margin:0;font-size:15px">&#10003; Pagamento confirmado &mdash; Consulta garantida!</p>
  </div>
  <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #e5e7eb">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="color:#6b7280;padding:6px 0;width:40%">Data</td><td style="font-weight:600">${p.dateStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Hor&aacute;rio</td><td style="font-weight:600">${p.timeStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Advogado</td><td style="font-weight:600">${p.lawyerName}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">&Aacute;rea</td><td style="font-weight:600">${p.specialty}</td></tr>
      ${p.amountStr ? `<tr><td style="color:#6b7280;padding:6px 0">Valor pago</td><td style="font-weight:600;color:#16a34a">${p.amountStr}</td></tr>` : ''}
      ${locationRow}
    </table>
  </div>
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">Enviado automaticamente pelo AgendarAdv. N&atilde;o responda este email.</p>
</body></html>`
}

async function sendEmail(key: string, to: string, subject: string, html: string) {
  await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
}

// ALWAYS return 200 to Asaas — non-2xx causes retries and pauses the webhook queue.
// Process errors are logged internally; the queue is never paused by our side.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }

  // Always respond 200 — even for non-POST or parse errors
  if (req.method !== 'POST') return new Response('ok', { status: 200 })

  let body: { event: string; payment?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return new Response('ok', { status: 200 })
  }

  const { event, payment } = body

  // Ignore events we don't handle
  if (!['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event)) {
    return new Response('ok', { status: 200 })
  }

  const appointmentId = payment?.externalReference as string | undefined
  const asaasId = payment?.id as string | undefined

  // No reference to match — not our payment, ignore
  if (!appointmentId || !asaasId) {
    return new Response('ok', { status: 200 })
  }

  // Process asynchronously; any internal error must NOT propagate as non-2xx
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: appt } = await sb
      .from('Appointment')
      .select('id,lawyerId,clientEmail,clientName,specialty,date,meetingLink,status')
      .eq('id', appointmentId)
      .maybeSingle()

    // Already confirmed or not found — idempotent, nothing to do
    if (!appt || appt.status === 'CONFIRMED') {
      return new Response('ok', { status: 200 })
    }

    const { data: settings } = await sb
      .from('LawyerSettings')
      .select('asaasApiKey,street,number,city,state')
      .eq('lawyerId', appt.lawyerId)
      .maybeSingle()

    // Verify payment status with Asaas API when key is available.
    // If verification fails (network error, rate limit), trust the webhook event and proceed.
    if (settings?.asaasApiKey) {
      try {
        const res = await fetch(`${ASAAS_BASE}/payments/${asaasId}`, {
          headers: { access_token: settings.asaasApiKey },
        })
        if (res.ok) {
          const paymentData = await res.json()
          if (!['RECEIVED', 'CONFIRMED'].includes(paymentData.status)) {
            // Asaas will fire another event when the payment is actually confirmed
            return new Response('ok', { status: 200 })
          }
        }
      } catch {
        // Verification request failed — proceed based on the webhook event itself
      }
    }

    const paidAt = new Date().toISOString()
    await Promise.all([
      sb.from('Payment')
        .update({ status: 'PAID', paidAt })
        .eq('asaasId', asaasId),
      sb.from('Appointment')
        .update({ status: 'CONFIRMED', updatedAt: paidAt })
        .eq('id', appointmentId),
    ])

    const RESEND_KEY = Deno.env.get('RESEND_API_KEY_AGENDAR')
    if (RESEND_KEY && appt.clientEmail) {
      try {
        const { data: lawyer } = await sb.from('Lawyer').select('name').eq('id', appt.lawyerId).maybeSingle()
        const { data: pmtRow } = await sb.from('Payment').select('amount').eq('asaasId', asaasId).maybeSingle()

        const apptDate = new Date(appt.date)
        const dateStr = apptDate.toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        const timeStr = apptDate.toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
        })
        const address = [settings?.street, settings?.number, settings?.city, settings?.state]
          .filter(Boolean).join(', ')
        const amountStr = pmtRow?.amount
          ? `R$ ${Number(pmtRow.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : ''

        await sendEmail(
          RESEND_KEY,
          appt.clientEmail,
          `Consulta confirmada — ${lawyer?.name ?? 'Advogado'}`,
          confirmedEmailHtml({
            lawyerName: lawyer?.name ?? 'Advogado',
            dateStr,
            timeStr,
            specialty: appt.specialty,
            address,
            meetingLink: appt.meetingLink ?? null,
            amountStr,
          })
        )
      } catch (_) {
        // Email failure must not prevent 200 response
      }
    }
  } catch (err) {
    // Log the error but NEVER return non-2xx — that would pause the Asaas queue
    console.error('asaas-webhook processing error:', (err as Error).message)
  }

  return new Response('ok', { status: 200 })
})
