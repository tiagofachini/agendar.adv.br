import { useState, useEffect } from 'react'
import { differenceInSeconds } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

const PERIODS = [
  { value: 'day',   label: 'Hoje' },
  { value: 'week',  label: 'Semana' },
  { value: 'month', label: 'Mês' },
]

function MetricBlock({ value, label, sub, accent }) {
  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${accent ? 'border-l-4 border-l-brand-500' : ''}`}>
      <div className="text-4xl font-extrabold text-navy-900 mb-1">{value}</div>
      <div className="text-sm font-semibold text-gray-700">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function Countdown({ appointment }) {
  const navigate = useNavigate()
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    if (!appointment) return
    const update = () => {
      const secs = differenceInSeconds(new Date(appointment.date), new Date())
      if (secs <= 0) { setRemaining('Agora!'); return }
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = secs % 60
      setRemaining(h > 0
        ? `${h}h ${m.toString().padStart(2, '0')}m`
        : `${m}m ${s.toString().padStart(2, '0')}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [appointment])

  if (!appointment) return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
      <span className="text-3xl">🎉</span>
      <div>
        <div className="font-semibold text-navy-900">Nenhum compromisso agendado</div>
        <div className="text-sm text-gray-400">Sua agenda está livre</div>
      </div>
    </div>
  )

  const apptDate = new Date(appointment.date)
  const dateStr = apptDate.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const timeStr = apptDate.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })

  const waPhone = appointment.clientWhatsapp ? appointment.clientWhatsapp.replace(/\D/g, '') : null

  const statusLabel = {
    CONFIRMED: 'Confirmado',
    PENDING_PAYMENT: 'Aguard. pagamento',
    CANCELLED: 'Cancelado',
    COMPLETED: 'Concluído',
  }[appointment.status] ?? appointment.status

  const statusColor = {
    CONFIRMED: 'bg-green-500/20 text-green-400',
    PENDING_PAYMENT: 'bg-yellow-500/20 text-yellow-400',
    CANCELLED: 'bg-red-500/20 text-red-400',
    COMPLETED: 'bg-gray-500/20 text-gray-400',
  }[appointment.status] ?? 'bg-white/10 text-gray-400'

  return (
    <div className="bg-navy-900 rounded-2xl shadow-sm text-white overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="text-xs text-brand-400 font-semibold uppercase tracking-wide">Próximo compromisso</div>
          <div className="text-right">
            <div className="text-2xl font-extrabold tabular-nums text-brand-400">{remaining || '—'}</div>
            <div className="text-gray-500 text-xs">para iniciar</div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Dados do cliente */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Dados do cliente</div>
            <div className="bg-white/5 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs w-20 shrink-0">Nome</span>
                <span className="text-white text-sm font-semibold">{appointment.clientName}</span>
              </div>
              {appointment.clientEmail && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs w-20 shrink-0">E-mail</span>
                  <span className="text-gray-300 text-xs truncate">{appointment.clientEmail}</span>
                </div>
              )}
              {appointment.clientWhatsapp && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs w-20 shrink-0">WhatsApp</span>
                  <a
                    href={`https://wa.me/${waPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:underline text-xs">
                    {appointment.clientWhatsapp}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Dados do compromisso */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Dados do compromisso</div>
            <div className="bg-white/5 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-gray-400 text-xs w-20 shrink-0 mt-0.5">Data</span>
                <span className="text-gray-300 text-xs">{dateStr} às {timeStr}</span>
              </div>
              {appointment.specialty && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs w-20 shrink-0">Natureza</span>
                  <span className="text-gray-300 text-xs">{appointment.specialty}</span>
                </div>
              )}
              {appointment.duration && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs w-20 shrink-0">Duração</span>
                  <span className="text-gray-300 text-xs">{appointment.duration} min</span>
                </div>
              )}
              {appointment.status && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs w-20 shrink-0">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                </div>
              )}
              {appointment.description && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 text-xs w-20 shrink-0 mt-0.5">Observação</span>
                  <span className="text-gray-300 text-xs overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {appointment.description}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={() => navigate('/appointments')}
            className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors">
            Ver Detalhes
          </button>
          {appointment.meetingLink && (
            <a
              href={appointment.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 rounded-xl bg-brand-500 text-navy-900 text-sm font-bold text-center hover:bg-brand-400 transition-colors">
              🔗 Acessar Reunião
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function OnboardingBanner() {
  const navigate = useNavigate()
  const [show, setShow] = useState(false)

  useEffect(() => {
    api.get('/settings').then(r => {
      if (!r.data?.financial?.asaasConnected) setShow(true)
    }).catch(() => {})
  }, [])

  if (!show) return null

  return (
    <div className="mb-4 bg-navy-900 rounded-2xl p-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-white text-sm">Ative os pagamentos online</p>
        <p className="text-xs text-gray-400 mt-0.5">Configure sua chave Asaas e receba pagamentos direto no agendamento.</p>
      </div>
      <button onClick={() => navigate('/settings')}
        className="shrink-0 px-4 py-2 rounded-xl bg-brand-500 text-navy-900 text-sm font-semibold hover:bg-brand-400 transition-colors">
        Configurar →
      </button>
    </div>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState('day')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/dashboard?period=${period}`)
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Visão geral do seu escritório</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${period === value ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm animate-pulse h-28" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Onboarding Banner */}
          <OnboardingBanner />

          {/* Countdown */}
          <div className="mb-4">
            <Countdown appointment={data.nextAppointment} />
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricBlock
              value={data.todayCount}
              label="Compromissos hoje"
              accent
            />
            <MetricBlock
              value={data.tomorrowCount}
              label="Compromissos amanhã"
            />
            <MetricBlock
              value={`R$ ${data.receivables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              label="Recebíveis no período"
              sub={PERIODS.find(p => p.value === period)?.label}
              accent
            />
            <MetricBlock
              value={data.newClients}
              label="Novos clientes"
              sub={PERIODS.find(p => p.value === period)?.label}
            />
            <MetricBlock
              value={data.newAppointments}
              label="Novos compromissos"
              sub={PERIODS.find(p => p.value === period)?.label}
            />
          </div>
        </>
      ) : (
        <p className="text-gray-500 text-center py-12">Erro ao carregar dados.</p>
      )}
    </div>
  )
}
