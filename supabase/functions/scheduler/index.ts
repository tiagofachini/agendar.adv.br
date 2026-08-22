import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const RESEND_URL = 'https://api.resend.com/emails'
const FROM_EMAIL = 'Agendar.ADV <notificacoes@agendar.adv.br>'
const ASAAS_BASE = 'https://www.asaas.com/api/v3'

// Returns UTC offset in ms for the given IANA timezone at a reference date.
// Positive value means the TZ is behind UTC (e.g. America/Sao_Paulo UTC-3 → +10_800_000).
function tzOffsetMs(tz: string, ref: Date): number {
  const tzMs  = new Date(ref.toLocaleString('en-US', { timeZone: tz })).getTime()
  const utcMs = new Date(ref.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
  return utcMs - tzMs
}

// Returns the UTC timestamp (ms) of midnight in the given timezone for the given date string.
function tzMidnightMs(dateStr: string, tz: string): number {
  const ref = new Date(`${dateStr}T12:00:00Z`) // use noon to avoid DST edge cases
  return new Date(`${dateStr}T00:00:00Z`).getTime() + tzOffsetMs(tz, ref)
}

// Returns the day-of-week (0=Sun…6=Sat) in the given timezone for a given UTC ms timestamp.
function tzDayOfWeek(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
    .formatToParts(new Date(utcMs))
  const name = parts.find(p => p.type === 'weekday')?.value ?? ''
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[name] ?? 0
}

async function asaasReq(apiKey: string, method: string, path: string, body?: object) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', access_token: apiKey },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas ${res.status}`)
  return data
}

function clientEmailHtml(p: {
  lawyerName: string; dateStr: string; timeStr: string
  specialty: string; address: string; meetingLink: string | null
  asaasPaymentUrl?: string | null; amountStr?: string | null
}) {
  const locationRow = p.meetingLink
    ? `<tr><td style="color:#6b7280;padding:6px 0;width:40%">Reunião online</td><td style="font-weight:600"><a href="${p.meetingLink}" style="color:#2563eb">${p.meetingLink}</a></td></tr>`
    : p.address ? `<tr><td style="color:#6b7280;padding:6px 0;width:40%">Local</td><td style="font-weight:600">${p.address}</td></tr>` : ''

  const statusBlock = p.asaasPaymentUrl
    ? `<p style="color:#d97706;font-weight:600">⏳ Agendamento recebido! Para confirmar seu horário, realize o pagamento.</p>
       <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:12px 0;text-align:center">
         ${p.amountStr ? `<p style="margin:0 0 12px;color:#92400e;font-size:15px">Valor: <strong>${p.amountStr}</strong></p>` : ''}
         <a href="${p.asaasPaymentUrl}" style="display:inline-block;background:#2563eb;color:white;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px">Pagar agora →</a>
       </div>
       <p style="color:#6b7280;font-size:13px">Você receberá um email de confirmação assim que o pagamento for aprovado.</p>`
    : `<p style="color:#16a34a;font-weight:600">✓ Agendamento confirmado! Você receberá os detalhes em breve.</p>`

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827">
  <div style="background:#0a2070;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
    <div style="display:inline-flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px">
      <img src="https://agendar.adv.br/logo.png" alt="Agendar.ADV" style="height:36px;width:36px;object-fit:contain;vertical-align:middle" />
      <span style="color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;vertical-align:middle">Agendar.<span style="color:#48b828">ADV</span></span>
    </div>
    <p style="color:#a0aec0;margin:0;font-size:14px">Agendamento recebido</p>
  </div>
  <p>Olá! Seu agendamento com <strong>${p.lawyerName}</strong> foi recebido.</p>
  <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #e5e7eb">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="color:#6b7280;padding:6px 0;width:40%">Data</td><td style="font-weight:600">${p.dateStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Horário</td><td style="font-weight:600">${p.timeStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Advogado</td><td style="font-weight:600">${p.lawyerName}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Área</td><td style="font-weight:600">${p.specialty}</td></tr>
      ${locationRow}
    </table>
  </div>
  ${statusBlock}
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">Enviado automaticamente pelo Agendar.ADV. Não responda este email.</p>
</body></html>`
}

function lawyerEmailHtml(p: {
  clientName: string; clientEmail: string; clientWhatsapp: string
  dateStr: string; timeStr: string; specialty: string; description: string; meetingLink: string | null
  asaasPending?: boolean; amountStr?: string | null
}) {
  const locationRow = p.meetingLink
    ? `<tr><td style="color:#6b7280;padding:6px 0;width:40%">Reunião online</td><td style="font-weight:600"><a href="${p.meetingLink}">${p.meetingLink}</a></td></tr>`
    : ''

  const pixAlert = p.asaasPending
    ? `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-top:12px">
         <p style="margin:0;color:#854d0e;font-size:13px;font-weight:600">⏳ Aguardando confirmação de pagamento via Asaas</p>
         ${p.amountStr ? `<p style="margin:4px 0 0;color:#92400e;font-size:12px">Valor: ${p.amountStr}</p>` : ''}
         <p style="margin:4px 0 0;color:#92400e;font-size:12px">O agendamento será confirmado automaticamente após aprovação do pagamento.</p>
       </div>`
    : ''

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827">
  <div style="background:#0a2070;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
    <div style="display:inline-flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px">
      <img src="https://agendar.adv.br/logo.png" alt="Agendar.ADV" style="height:36px;width:36px;object-fit:contain;vertical-align:middle" />
      <span style="color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;vertical-align:middle">Agendar.<span style="color:#48b828">ADV</span></span>
    </div>
    <p style="color:#a0aec0;margin:0;font-size:14px">Novo agendamento recebido</p>
  </div>
  <p>Você tem um novo agendamento!</p>
  <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #e5e7eb">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="color:#6b7280;padding:6px 0;width:40%">Cliente</td><td style="font-weight:600">${p.clientName}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Email</td><td style="font-weight:600">${p.clientEmail}</td></tr>
      ${p.clientWhatsapp ? `<tr><td style="color:#6b7280;padding:6px 0">WhatsApp</td><td style="font-weight:600">${p.clientWhatsapp}</td></tr>` : ''}
      <tr><td style="color:#6b7280;padding:6px 0">Data</td><td style="font-weight:600">${p.dateStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Horário</td><td style="font-weight:600">${p.timeStr}</td></tr>
      <tr><td style="color:#6b7280;padding:6px 0">Área</td><td style="font-weight:600">${p.specialty}</td></tr>
      ${locationRow}
    </table>
    ${p.description ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb">
      <p style="color:#6b7280;margin:0 0 4px 0;font-size:13px">Descrição do caso:</p>
      <p style="margin:0;font-style:italic">"${p.description}"</p>
    </div>` : ''}
    ${pixAlert}
  </div>
  <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">Enviado automaticamente pelo Agendar.ADV.</p>
</body></html>`
}

async function sendEmail(key: string, to: string, subject: string, html: string) {
  await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`
  if (digits.length === 11 || digits.length === 10) return `+55${digits}`
  return `+${digits}`
}

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN')
  const rawFrom    = Deno.env.get('TWILIO_WHATSAPP_FROM')
  if (!accountSid || !authToken || !rawFrom) return
  const from = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`
  const toWa = `whatsapp:${toE164(to)}`
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
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.message || `Twilio HTTP ${res.status}`)
  }
}

async function getGoogleAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Falha ao renovar token Google')
  return data.access_token
}

async function createCalendarEvent(accessToken: string, p: {
  summary: string; description: string; startISO: string; endISO: string
  location?: string; attendeeEmail?: string; withMeet: boolean
}): Promise<{ eventId: string; meetingLink: string | null }> {
  const body: Record<string, unknown> = {
    summary: p.summary,
    description: p.description,
    start: { dateTime: p.startISO, timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: p.endISO,   timeZone: 'America/Sao_Paulo' },
  }
  if (p.location)      body.location  = p.location
  if (p.attendeeEmail) body.attendees = [{ email: p.attendeeEmail }]
  if (p.withMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }
  const qs = p.withMeet ? '?conferenceDataVersion=1&sendUpdates=none' : '?sendUpdates=none'
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events${qs}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody?.error?.message || `Google Calendar HTTP ${res.status}`)
  }
  const event = await res.json()
  const entry = (event?.conferenceData?.entryPoints ?? [])
    .find((e: { entryPointType: string; uri: string }) => e.entryPointType === 'video')
  return { eventId: event.id as string, meetingLink: entry?.uri ?? null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const schedulerIdx = parts.indexOf('scheduler')
  const slug   = schedulerIdx >= 0 ? parts[schedulerIdx + 1] : parts[0]
  const action = schedulerIdx >= 0 ? parts[schedulerIdx + 2] : parts[1]

  if (!slug) return new Response('Not Found', { status: 404, headers: cors })

  // Diretório público — não precisa de slug de advogado
  if (slug === 'directory' && req.method === 'GET') {
    try {
      const sbAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      const q            = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
      const cityFilter   = url.searchParams.get('city')?.trim().toLowerCase() ?? ''
      const stateFilter  = url.searchParams.get('state')?.trim().toUpperCase() ?? ''
      const specFilter   = url.searchParams.get('specialty')?.trim() ?? ''

      const { data: settings, error: sErr } = await sbAdmin
        .from('LawyerSettings')
        .select('schedulerSlug, city, state, specialties, brandColor1, brandColor2, logoUrl, highlightMessage, lawyerId')
        .eq('listedInDirectory', true)
        .not('schedulerSlug', 'is', null)
        .neq('schedulerSlug', '')
      if (sErr) throw sErr

      type SRow = {
        schedulerSlug: string; city: string | null; state: string | null
        specialties: string[] | null; brandColor1: string | null; brandColor2: string | null
        logoUrl: string | null; highlightMessage: string | null; lawyerId: string
      }

      const rows = (settings ?? []) as SRow[]
      const ids = rows.map(r => r.lawyerId).filter(Boolean)

      const { data: lawyers } = ids.length > 0
        ? await sbAdmin.from('Lawyer').select('id, name').in('id', ids)
        : { data: [] as { id: string; name: string }[] }

      const nameMap: Record<string, string> = Object.fromEntries(
        (lawyers ?? []).map(l => [l.id, l.name])
      )

      let results = rows
        .filter(r => r.schedulerSlug && nameMap[r.lawyerId])
        .map(r => ({
          slug: r.schedulerSlug,
          lawyerName: nameMap[r.lawyerId],
          city: r.city ?? '',
          state: r.state ?? '',
          specialties: r.specialties ?? [],
          brandColor1: r.brandColor1 ?? null,
          brandColor2: r.brandColor2 ?? null,
          logoUrl: r.logoUrl ?? null,
          highlightMessage: r.highlightMessage ?? null,
        }))

      if (q) results = results.filter(r =>
        r.lawyerName.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.specialties.some(s => s.toLowerCase().includes(q))
      )
      if (cityFilter) results = results.filter(r => r.city.toLowerCase().includes(cityFilter))
      if (stateFilter) results = results.filter(r => r.state.toUpperCase() === stateFilter)
      if (specFilter)  results = results.filter(r => r.specialties.includes(specFilter))

      results.sort((a, b) => a.lawyerName.localeCompare(b.lawyerName, 'pt-BR'))

      return Response.json({ lawyers: results }, { headers: cors })
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: cors })
    }
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { data: s, error: sErr } = await sb
      .from('LawyerSettings')
      .select('*')
      .ilike('schedulerSlug', slug.toLowerCase())
      .maybeSingle()

    if (sErr || !s) {
      return Response.json({ error: 'Agenda não encontrada' }, { status: 404, headers: cors })
    }

    const { data: lawyerRow } = await sb
      .from('Lawyer')
      .select('id,name,email,whatsapp')
      .eq('id', s.lawyerId)
      .maybeSingle()

    if (!lawyerRow) {
      return Response.json({ error: 'Agenda não encontrada' }, { status: 404, headers: cors })
    }

    const lawyer = lawyerRow as {
      id: string; name: string; email: string; whatsapp: string
    }

    if (req.method === 'GET' && !action) {
      const hasAsaas = !!(s.asaasApiKey)

      type DayConfig = { day: number; active: boolean }
      const workDays = s.workSchedule && Array.isArray(s.workSchedule)
        ? (s.workSchedule as DayConfig[]).filter(d => d.active).map(d => d.day)
        : (s.workDays ?? [1, 2, 3, 4, 5])

      return Response.json(
        {
          lawyerName: lawyer.name,
          specialties: s.specialties ?? [],
          slotDuration: s.slotDuration ?? 60,
          workDays,
          workStartTime: s.workStartTime ?? '09:00',
          workEndTime: s.workEndTime ?? '18:00',
          highlightMessage: s.highlightMessage ?? null,
          hourlyRate: s.hourlyRate ?? null,
          specialtyRates: s.specialtyRates ?? [],
          hasAsaas,
          logoUrl: s.logoUrl ?? null,
          street: s.street ?? '',
          number: s.number ?? '',
          city: s.city ?? '',
          state: s.state ?? '',
          brandColor1: s.brandColor1 ?? null,
          brandColor2: s.brandColor2 ?? null,
        },
        { headers: cors }
      )
    }

    if (req.method === 'GET' && action === 'slots') {
      const date = url.searchParams.get('date')
      if (!date) return Response.json({ error: 'date required' }, { status: 400, headers: cors })

      const tz = s.timezone || 'America/Sao_Paulo'
      const dayStartMs = tzMidnightMs(date, tz)
      const dayEndMs   = dayStartMs + 86_400_000
      const dayOfWeek  = tzDayOfWeek(dayStartMs + 12 * 3_600_000, tz)

      // Determina janela de trabalho para este dia específico
      type DayCfg = { day: number; active: boolean; start: string; end: string; lunchStart?: string; lunchEnd?: string }
      let startMin: number
      let endMin: number
      let lunchStartMin: number | null = null
      let lunchEndMin:   number | null = null

      if (s.workSchedule && Array.isArray(s.workSchedule)) {
        const dc = (s.workSchedule as DayCfg[]).find(d => d.day === dayOfWeek)
        if (!dc || !dc.active) return Response.json({ slots: [] }, { headers: cors })
        const [sh, sm] = dc.start.split(':').map(Number)
        const [eh, em] = dc.end.split(':').map(Number)
        startMin = sh * 60 + sm
        endMin   = eh * 60 + em
        if (dc.lunchStart && dc.lunchEnd && dc.lunchStart !== dc.lunchEnd) {
          const [lsh, lsm] = dc.lunchStart.split(':').map(Number)
          const [leh, lem] = dc.lunchEnd.split(':').map(Number)
          lunchStartMin = lsh * 60 + lsm
          lunchEndMin   = leh * 60 + lem
        }
      } else {
        if (!(s.workDays ?? [1, 2, 3, 4, 5]).includes(dayOfWeek)) {
          return Response.json({ slots: [] }, { headers: cors })
        }
        const [sh, sm] = (s.workStartTime ?? '09:00').split(':').map(Number)
        const [eh, em] = (s.workEndTime ?? '18:00').split(':').map(Number)
        startMin = sh * 60 + sm
        endMin   = eh * 60 + em
      }

      const dayStartISO = new Date(dayStartMs).toISOString()
      const dayEndISO   = new Date(dayEndMs).toISOString()

      const { data: booked } = await sb
        .from('Appointment')
        .select('date,duration')
        .eq('lawyerId', lawyer.id)
        .gte('date', dayStartISO)
        .lt('date', dayEndISO)
        .neq('status', 'CANCELLED')

      const busyIntervals: { start: number; end: number }[] = (booked ?? []).map(
        (a: { date: string; duration: number }) => ({
          start: new Date(a.date).getTime(),
          end:   new Date(a.date).getTime() + (a.duration ?? 60) * 60_000,
        })
      )

      // Intervalo de almoço como período bloqueado
      if (lunchStartMin !== null && lunchEndMin !== null && lunchStartMin < lunchEndMin) {
        busyIntervals.push({
          start: dayStartMs + lunchStartMin * 60_000,
          end:   dayStartMs + lunchEndMin   * 60_000,
        })
      }

      if (s.googleCalendarConnected && s.googleCalendarRefreshToken) {
        try {
          const accessToken = await getGoogleAccessToken(s.googleCalendarRefreshToken)
          const fbRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeMin: dayStartISO, timeMax: dayEndISO, items: [{ id: 'primary' }] }),
          })
          if (fbRes.ok) {
            const fbData = await fbRes.json()
            for (const period of fbData?.calendars?.primary?.busy ?? []) {
              busyIntervals.push({
                start: new Date(period.start).getTime(),
                end:   new Date(period.end).getTime(),
              })
            }
          }
        } catch (_) { /* fallback: usa apenas agenda interna */ }
      }

      const dur = s.slotDuration ?? 60
      const slots: string[] = []
      for (let minOffset = startMin; minOffset + dur <= endMin; minOffset += dur) {
        const slotStart = dayStartMs + minOffset * 60_000
        const slotEnd   = slotStart + dur * 60_000
        const taken = busyIntervals.some(({ start, end }) => slotStart < end && slotEnd > start)
        if (!taken) {
          const h = Math.floor(minOffset / 60)
          const m = minOffset % 60
          slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        }
      }

      return Response.json({ slots }, { headers: cors })
    }

    if (req.method === 'GET' && action === 'appointment') {
      const apptId = url.searchParams.get('apptId')
      if (!apptId) return Response.json({ error: 'apptId required' }, { status: 400, headers: cors })
      const { data: appt } = await sb
        .from('Appointment')
        .select('id,date,duration,specialty,status,meetingLink')
        .eq('id', apptId)
        .eq('lawyerId', lawyer.id)
        .maybeSingle()
      if (!appt) return Response.json({ error: 'Not found' }, { status: 404, headers: cors })
      return Response.json({
        id: appt.id, date: appt.date, duration: appt.duration,
        specialty: appt.specialty, status: appt.status,
        meetingLink: appt.meetingLink, lawyerName: lawyer.name,
      }, { headers: cors })
    }

    if (req.method === 'POST' && action === 'book') {
      const body = await req.json()
      const { clientName, clientEmail, clientWhatsapp, clientDocument,
              clientCep, clientStreet, clientNumber, clientCity, clientState,
              specialty, description, selectedDate, selectedSlot } = body

      if (!clientName || !clientEmail || !specialty || !selectedDate || !selectedSlot) {
        return Response.json({ error: 'Campos obrigatórios ausentes' }, { status: 400, headers: cors })
      }

      const hourlyRate = parseFloat(s.hourlyRate ?? '0')
      const hasAsaas = !!(s.asaasApiKey && hourlyRate > 0)

      type SpecialtyRate = { specialty: string; rate: number | string }
      const specialtyRatesList: SpecialtyRate[] = Array.isArray(s.specialtyRates) ? s.specialtyRates : []
      const matchedRate = specialtyRatesList.find((r: SpecialtyRate) => r.specialty === specialty)
      const effectiveHourlyRate = matchedRate ? parseFloat(String(matchedRate.rate)) : hourlyRate
      const amountBRL = effectiveHourlyRate > 0 ? (effectiveHourlyRate * (s.slotDuration ?? 60)) / 60 : 0
      const amountStr = amountBRL > 0 ? `R$ ${amountBRL.toFixed(2).replace('.', ',')}` : null

      const { data: existing } = await sb
        .from('Client')
        .select('id,cpfCnpj')
        .eq('lawyerId', lawyer.id)
        .eq('email', clientEmail)
        .maybeSingle()

      const addressPatch = {
        ...(clientCep    ? { cep:    clientCep }    : {}),
        ...(clientStreet ? { street: clientStreet } : {}),
        ...(clientNumber ? { number: clientNumber } : {}),
        ...(clientCity   ? { city:   clientCity }   : {}),
        ...(clientState  ? { state:  clientState }  : {}),
      }

      let clientId: string
      if (existing) {
        clientId = existing.id
        const patch: Record<string, unknown> = { ...addressPatch }
        if (clientDocument && !existing.cpfCnpj) patch.cpfCnpj = clientDocument
        if (Object.keys(patch).length > 0) {
          try { await sb.from('Client').update(patch).eq('id', clientId) } catch (_) {}
        }
      } else {
        const { data: nc, error: ncErr } = await sb
          .from('Client')
          .insert({
            id: crypto.randomUUID(),
            lawyerId: lawyer.id,
            name: clientName,
            email: clientEmail,
            whatsapp: clientWhatsapp,
            ...(clientDocument ? { cpfCnpj: clientDocument } : {}),
            ...addressPatch,
            updatedAt: new Date().toISOString(),
          })
          .select('id')
          .single()
        if (ncErr) throw ncErr
        clientId = nc.id
      }

      const tz = s.timezone || 'America/Sao_Paulo'
      const slotDayStart = tzMidnightMs(selectedDate, tz)
      const [slotH, slotM] = selectedSlot.split(':').map(Number)
      const apptDate = new Date(slotDayStart + (slotH * 60 + slotM) * 60_000).toISOString()
      const apptId = crypto.randomUUID()
      const hasAddress = !!(s.street && s.city)

      let meetingLink: string | null = null
      let googleCalendarEventId: string | undefined
      if (s.googleCalendarConnected && s.googleCalendarRefreshToken) {
        try {
          const accessToken = await getGoogleAccessToken(s.googleCalendarRefreshToken)
          const endISO = new Date(new Date(apptDate).getTime() + (s.slotDuration ?? 60) * 60_000).toISOString()
          const location = hasAddress
            ? [s.street, s.number, s.city, s.state].filter(Boolean).join(', ')
            : undefined
          const calResult = await createCalendarEvent(accessToken, {
            summary: `Consulta jurídica: ${specialty} — ${clientName}`,
            description: description ? `Descrição: ${description}` : `Consulta com ${clientName}`,
            startISO: apptDate,
            endISO,
            location,
            attendeeEmail: clientEmail,
            withMeet: true,
          })
          meetingLink = calResult.meetingLink
          googleCalendarEventId = calResult.eventId
        } catch (_) { /* fallback below */ }
      }
      if (!meetingLink && !hasAddress) {
        meetingLink = s.customMeetingUrl?.trim() || `https://meet.jit.si/agendaradv${apptId.replace(/-/g, '')}`
      }

      // Create Asaas payment if configured
      let asaasPaymentUrl: string | null = null
      let asaasPaymentId: string | null = null
      if (hasAsaas && amountBRL > 0) {
        const custList = await asaasReq(s.asaasApiKey, 'GET', `/customers?email=${encodeURIComponent(clientEmail)}&limit=1`)
        let asaasCustomerId: string
        const cpfCnpj = clientDocument ? clientDocument.replace(/\D/g, '') : undefined
        if (custList.data?.length > 0) {
          asaasCustomerId = custList.data[0].id
          if (cpfCnpj && !custList.data[0].cpfCnpj) {
            await asaasReq(s.asaasApiKey, 'PUT', `/customers/${asaasCustomerId}`, {
              name: clientName, cpfCnpj,
            }).catch(() => {})
          }
        } else {
          const newCust = await asaasReq(s.asaasApiKey, 'POST', '/customers', {
            name: clientName,
            email: clientEmail,
            ...(cpfCnpj ? { cpfCnpj } : {}),
            ...(clientWhatsapp ? { mobilePhone: clientWhatsapp.replace(/\D/g, '') } : {}),
            ...(clientCep    ? { postalCode: clientCep.replace(/\D/g, '') } : {}),
            ...(clientStreet ? { address: clientStreet } : {}),
            ...(clientNumber ? { addressNumber: clientNumber } : {}),
            ...(clientCity   ? { city: clientCity } : {}),
            ...(clientState  ? { state: clientState } : {}),
          })
          asaasCustomerId = newCust.id
        }
        const dueDate = selectedDate
        const pmt = await asaasReq(s.asaasApiKey, 'POST', '/payments', {
          customer: asaasCustomerId,
          billingType: 'UNDEFINED',
          value: amountBRL,
          dueDate,
          description: `Consulta jurídica: ${specialty} — ${lawyer.name}`,
          externalReference: apptId,
          callbackSuccessUrl: `https://agendar.adv.br/${slug}?payment_done=1&apptId=${apptId}`,
          callbackAbortUrl: `https://agendar.adv.br/${slug}`,
        })
        asaasPaymentUrl = pmt.invoiceUrl ?? null
        asaasPaymentId = pmt.id ?? null
      }

      const apptStatus = (hasAsaas && amountBRL > 0) ? 'PENDING_PAYMENT' : 'CONFIRMED'

      const { error: apptErr } = await sb
        .from('Appointment')
        .insert({
          id: apptId,
          lawyerId: lawyer.id,
          clientId,
          clientName,
          clientEmail,
          clientWhatsapp,
          specialty,
          description,
          date: apptDate,
          duration: s.slotDuration ?? 60,
          status: apptStatus,
          source: 'SCHEDULER',
          meetingLink,
          googleCalendarEventId,
          updatedAt: new Date().toISOString(),
        })
      if (apptErr) throw apptErr

      if (asaasPaymentId) {
        await sb.from('Payment').insert({
          id: crypto.randomUUID(),
          lawyerId: lawyer.id,
          clientId,
          appointmentId: apptId,
          amount: amountBRL,
          status: 'PENDING',
          asaasId: asaasPaymentId,
          asaasUrl: asaasPaymentUrl,
          dueDate: new Date(slotDayStart + 86_400_000 - 1000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      const RESEND_KEY = Deno.env.get('RESEND_API_KEY_AGENDAR')
      if (RESEND_KEY) {
        try {
          const apptDateObj = new Date(apptDate)
          const dateStr = apptDateObj.toLocaleDateString('pt-BR', {
            timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })
          const timeStr = apptDateObj.toLocaleTimeString('pt-BR', {
            timeZone: tz, hour: '2-digit', minute: '2-digit',
          })
          const address = [s.street, s.number, s.city, s.state].filter(Boolean).join(', ')
          const isPending = apptStatus === 'PENDING_PAYMENT'
          await sendEmail(
            RESEND_KEY, clientEmail,
            `Agendamento recebido — ${lawyer.name}`,
            clientEmailHtml({
              lawyerName: lawyer.name, dateStr, timeStr, specialty, address, meetingLink,
              asaasPaymentUrl: isPending ? asaasPaymentUrl : null,
              amountStr: isPending ? amountStr : null,
            })
          )
          if (s.newBookingByEmail !== false && lawyer.email) {
            await sendEmail(
              RESEND_KEY, lawyer.email,
              isPending ? `Novo agendamento (aguardando pagamento) — ${clientName}` : `Novo agendamento — ${clientName}`,
              lawyerEmailHtml({
                clientName, clientEmail, clientWhatsapp, dateStr, timeStr, specialty, description, meetingLink,
                asaasPending: isPending,
                amountStr: isPending ? amountStr : null,
              })
            )
          }
          if (s.newBookingByWhatsapp && lawyer.whatsapp) {
            const pmtNote = isPending && amountStr ? `\n💸 Aguardando pagamento: ${amountStr}` : ''
            await sendWhatsApp(
              lawyer.whatsapp,
              `📅 Novo agendamento!\n\nCliente: ${clientName}\nData: ${dateStr}\nHorário: ${timeStr}\nÁrea: ${specialty}${clientWhatsapp ? `\nWhatsApp: ${clientWhatsapp}` : ''}${pmtNote}`
            )
          }
          if (clientWhatsapp) {
            const pmtWaNote = isPending && asaasPaymentUrl
              ? `\n\n💳 Para confirmar, realize o pagamento:\n${asaasPaymentUrl}`
              : ''
            await sendWhatsApp(
              clientWhatsapp,
              `${isPending ? '⏳' : '✅'} Agendamento ${isPending ? 'recebido!' : 'confirmado!'}\n\nOlá, ${clientName}! Sua consulta foi ${isPending ? 'recebida e aguarda confirmação de pagamento' : 'agendada com sucesso'}.\n\n📅 Data: ${dateStr}\n⏰ Horário: ${timeStr}\n⚖️ Área: ${specialty}${meetingLink ? `\n🔗 Reunião: ${meetingLink}` : address ? `\n📍 Local: ${address}` : ''}${pmtWaNote}\n\n${lawyer.name}`
            )
          }
        } catch (_) {}
      }

      return Response.json(
        { appointmentId: apptId, meetingLink, asaasPaymentUrl, amount: amountBRL > 0 ? amountBRL : null, pending: apptStatus === 'PENDING_PAYMENT' },
        { status: 201, headers: cors }
      )
    }

    if (req.method === 'POST' && action === 'detect') {
      const { description } = await req.json()

      if (!description || description.length < 30) {
        return Response.json({ specialty: '' }, { headers: cors })
      }

      const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')
      if (!ANTHROPIC_KEY) {
        return Response.json({ specialty: '' }, { headers: cors })
      }

      const SPECIALTIES = [
        'Direito Civil','Direito Penal','Direito Trabalhista','Direito de Família',
        'Direito do Consumidor','Direito Tributário','Direito Previdenciário',
        'Direito Administrativo','Direito Empresarial / Comercial','Direito Imobiliário',
        'Direito Ambiental','Direito Digital e Tecnologia','Direito Internacional',
        'Direito Eleitoral','Direito Constitucional','Direito Bancário',
        'Direito de Trânsito','Direito Médico e da Saúde','Direito Agrário',
        'Direito Sucessório / Inventário','Direito Contratual','Recuperação de Crédito','Outro',
      ]

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 64,
            messages: [{
              role: 'user',
              content: `Classifique o texto abaixo em UMA das áreas jurídicas listadas. Responda APENAS o nome exato da área, sem pontuação, sem explicação.\n\nÁreas:\n${SPECIALTIES.join('\n')}\n\nTexto: "${description.slice(0, 500)}"`,
            }],
          }),
        })
        const data = await res.json()
        const raw = (data?.content?.[0]?.text ?? '').trim()
        const matched = SPECIALTIES.find(s => s.toLowerCase() === raw.toLowerCase()) ?? ''
        return Response.json({ specialty: matched }, { headers: cors })
      } catch (_) {
        return Response.json({ specialty: '' }, { headers: cors })
      }
    }

    return new Response('Not Found', { status: 404, headers: cors })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: cors })
  }
})
