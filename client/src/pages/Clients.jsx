import { useState, useCallback, useEffect } from 'react'
import api from '../lib/api'
import { LEGAL_SPECIALTIES } from '../lib/specialties'
import { useAuth } from '../context/AuthContext'

function maskPhone(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function maskCep(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function WhatsAppIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

// ── Mini-mapa via OpenStreetMap (Nominatim geocoding, sem API key) ─────────────
function MiniMap({ street, number, city, state }) {
  const [coords, setCoords] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!city) return
    const query = [street && number ? `${street} ${number}` : street, city, state, 'Brasil']
      .filter(Boolean).join(', ')
    setLoading(true)
    setCoords(null)
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`)
      .then(r => r.json())
      .then(d => { if (d[0]) setCoords({ lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) }) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [street, number, city, state])

  if (!city && !state) return null

  const mapQuery = [street && number ? `${street} ${number}` : street, city, state, 'Brasil']
    .filter(Boolean).join(', ')
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`

  return (
    <div className="space-y-1.5">
      {loading ? (
        <div className="w-full h-32 bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
          <span className="text-xs text-gray-400">Carregando mapa...</span>
        </div>
      ) : coords ? (
        <iframe
          title="mapa"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon - 0.015},${coords.lat - 0.008},${coords.lon + 0.015},${coords.lat + 0.008}&layer=mapnik&marker=${coords.lat},${coords.lon}`}
          className="w-full h-36 rounded-xl border border-gray-200"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
        />
      ) : null}
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
        className="text-xs text-navy-700 hover:underline flex items-center gap-1">
        🗺️ Abrir no Google Maps
      </a>
    </div>
  )
}

// ── Modal de novo/editar cliente ───────────────────────────────────────────────
function ClientModal({ clientId, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', email: '', whatsapp: '',
    cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cepLoading, setCepLoading] = useState(false)

  useEffect(() => {
    if (clientId) {
      api.get(`/clients/${clientId}`).then(r => {
        const { name, email, whatsapp, cep, street, number, complement, neighborhood, city, state } = r.data
        setForm({
          name: name || '', email: email || '', whatsapp: whatsapp || '',
          cep: cep || '', street: street || '', number: number || '',
          complement: complement || '', neighborhood: neighborhood || '',
          city: city || '', state: state || '',
        })
      }).catch(console.error)
    }
  }, [clientId])

  const lookupCep = async () => {
    const digits = form.cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const d = await r.json()
      if (!d.erro) {
        setForm(f => ({
          ...f,
          street: d.logradouro || f.street,
          neighborhood: d.bairro || f.neighborhood,
          city: d.localidade || f.city,
          state: d.uf || f.state,
        }))
      }
    } catch { /* noop */ }
    setCepLoading(false)
  }

  const save = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = clientId
        ? await api.put(`/clients/${clientId}`, form)
        : await api.post('/clients', form)
      onSaved(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    }
    setLoading(false)
  }

  const cls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700'

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-navy-900">{clientId ? 'Editar cliente' : 'Novo cliente'}</h2>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input className={cls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Nome completo" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input className={cls} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input className={cls} value={form.whatsapp}
              onChange={e => setForm({ ...form, whatsapp: maskPhone(e.target.value) })}
              placeholder="(11) 99999-9999" maxLength={15} inputMode="numeric" />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Endereço</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                <div className="flex gap-2">
                  <input className={cls} value={form.cep}
                    onChange={e => setForm({ ...form, cep: maskCep(e.target.value) })}
                    onBlur={lookupCep} placeholder="00000-000" maxLength={9} inputMode="numeric" />
                  <button type="button" onClick={lookupCep} disabled={cepLoading}
                    className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex-shrink-0">
                    {cepLoading ? '...' : 'Buscar'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
                <input className={cls} value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} placeholder="Rua, Av., etc." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                  <input className={cls} value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                  <input className={cls} value={form.complement} onChange={e => setForm({ ...form, complement: e.target.value })} placeholder="Apto, sala..." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                <input className={cls} value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                  <input className={cls} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
                  <input className={cls} value={form.state}
                    onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })}
                    placeholder="SP" maxLength={2} />
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Painel lateral de detalhes ────────────────────────────────────────────────
function ClientDetail({ clientId, onClose, onEdit }) {
  const { effectivePlan } = useAuth()
  const isPro = effectivePlan === 'PRO'
  const [client, setClient] = useState(null)
  const [msgForm, setMsgForm] = useState({ channel: 'email', subject: '', body: '' })
  const [sendLoading, setSendLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setClient(null)
    api.get(`/clients/${clientId}`).then(r => setClient(r.data)).catch(console.error)
  }, [clientId])

  const STATUS_LABEL = { PENDING_PAYMENT: 'Aguardando', CONFIRMED: 'Confirmado', COMPLETED: 'Realizado', CANCELLED: 'Cancelado', EXPIRED: 'Expirado' }
  const STATUS_COLOR = { PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800', CONFIRMED: 'bg-blue-100 text-blue-800', COMPLETED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-800', EXPIRED: 'bg-gray-100 text-gray-600' }

  const sendMsg = async (e) => {
    e.preventDefault()
    setError('')
    if (msgForm.channel === 'whatsapp') {
      if (!client.whatsapp) {
        setError('Este cliente não tem WhatsApp cadastrado')
        return
      }
      const digits = client.whatsapp.replace(/\D/g, '')
      const intlPhone = digits.startsWith('55') ? digits : `55${digits}`
      window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msgForm.body)}`, '_blank')
      setMsgForm(f => ({ ...f, body: '' }))
      return
    }
    setSendLoading(true)
    try {
      await api.post(`/clients/${clientId}/message`, { subject: msgForm.subject, body: msgForm.body })
      setMsgForm(f => ({ ...f, subject: '', body: '' }))
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao enviar mensagem')
    }
    setSendLoading(false)
  }

  if (!client) return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
      </div>
    </div>
  )

  const cls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700'
  const hasAddress = client.city || client.street || client.cep

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-navy-900 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-lg">{client.name}</h2>
            {client.email && <p className="text-gray-300 text-sm">{client.email}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onEdit} className="text-xs border border-white/30 rounded-lg px-3 py-1.5 hover:bg-white/10">Editar</button>
            <button onClick={onClose} className="text-gray-300 hover:text-white text-xl leading-none">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Contato */}
          <div className="space-y-2 text-sm">
            {client.whatsapp && (
              <div className="flex items-center gap-2 text-gray-700">
                <span>📱</span>{client.whatsapp}
              </div>
            )}
          </div>

          {/* Endereço + mini-mapa */}
          {hasAddress && (
            <div className="space-y-3">
              <h3 className="font-semibold text-navy-900">Endereço</h3>
              <div className="text-sm text-gray-600 space-y-0.5 bg-gray-50 rounded-xl p-3">
                {client.street && (
                  <p>{client.street}{client.number ? `, ${client.number}` : ''}{client.complement ? ` — ${client.complement}` : ''}</p>
                )}
                {client.neighborhood && <p>{client.neighborhood}</p>}
                {(client.city || client.state) && (
                  <p className="font-medium text-gray-700">{[client.city, client.state].filter(Boolean).join(' — ')}</p>
                )}
                {client.cep && <p className="text-gray-400 text-xs">CEP {client.cep}</p>}
              </div>
              <MiniMap street={client.street} number={client.number} city={client.city} state={client.state} />
            </div>
          )}

          {/* Histórico de agendamentos */}
          {client.appointments?.length > 0 && (
            <div>
              <h3 className="font-semibold text-navy-900 mb-3">Agendamentos</h3>
              <div className="space-y-2">
                {client.appointments.map(a => (
                  <div key={a.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-sm font-medium text-gray-800">
                          {new Date(a.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          {new Date(a.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[a.status]}`}>
                        {STATUS_LABEL[a.status]}
                      </span>
                    </div>
                    {a.specialty && <p className="text-xs text-gray-500">{a.specialty}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Enviar mensagem */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-200 gap-2.5">
              <WhatsAppIcon className="w-5 h-5 text-green-500" />
              <span className="font-semibold text-navy-900 text-sm">Enviar mensagem</span>
            </div>

            <div className="p-4 space-y-3">
              {/* Seletor de canal — sempre visível */}
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setMsgForm(f => ({ ...f, channel: 'email' }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                    ${msgForm.channel === 'email' ? 'bg-navy-900 text-white border-navy-900' : 'bg-white text-gray-600 border-gray-200 hover:border-navy-300'}`}>
                  Email
                </button>
                <button type="button"
                  onClick={() => setMsgForm(f => ({ ...f, channel: 'whatsapp' }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors flex items-center justify-center gap-1.5
                    ${msgForm.channel === 'whatsapp' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
                  <WhatsAppIcon className="w-4 h-4" /> WhatsApp
                  {!isPro && <span className="text-xs font-bold ml-0.5">⭐</span>}
                </button>
              </div>

              {/* WhatsApp selecionado por usuário Free */}
              {msgForm.channel === 'whatsapp' && !isPro ? (
                <div className="text-center py-3 space-y-3">
                  <p className="text-sm text-gray-500">Envio via WhatsApp disponível no Plano Pro.</p>
                  <a href="/my-plan"
                    className="block w-full py-2.5 text-center rounded-xl text-sm font-semibold bg-amber-400 text-amber-900 hover:bg-amber-500 transition-colors">
                    ⭐ Fazer upgrade para o Plano Pro
                  </a>
                </div>
              ) : (
                <form onSubmit={sendMsg} className="space-y-3">
                  {msgForm.channel === 'email' && (
                    <input className={cls} placeholder="Assunto" value={msgForm.subject}
                      onChange={e => setMsgForm({ ...msgForm, subject: e.target.value })} required />
                  )}
                  <textarea className={`${cls} resize-none`} rows={4} placeholder="Mensagem..."
                    value={msgForm.body} onChange={e => setMsgForm({ ...msgForm, body: e.target.value })} required />
                  {error && <p className="text-red-500 text-xs">{error}</p>}
                  <button type="submit" disabled={sendLoading}
                    className={`w-full py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors
                      ${msgForm.channel === 'whatsapp' ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-navy-900 text-white hover:bg-navy-800'}`}>
                    {sendLoading ? 'Enviando...' : msgForm.channel === 'whatsapp' ? 'Abrir no WhatsApp' : 'Enviar'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card de estatística ───────────────────────────────────────────────────────
function StatCard({ label, value, color, subtitle }) {
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 border-l-4 ${color}`}>
      <div className="text-3xl font-extrabold text-navy-900">{value ?? '—'}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Clients() {
  const [clients, setClients] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bulkError, setBulkError] = useState('')
  const [stats, setStats] = useState(null)

  const loadStats = () => {
    api.get('/clients/stats').then(r => setStats(r.data)).catch(() => {})
  }

  useEffect(() => { loadStats() }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ search, page })
      if (cityFilter) params.set('city', cityFilter)
      if (stateFilter) params.set('state', stateFilter)
      if (specialtyFilter) params.set('specialty', specialtyFilter)
      const { data } = await api.get(`/clients?${params}`)
      setClients(data.clients)
      setTotal(data.total)
    } catch { /* noop */ }
    finally { setLoading(false) }
  }, [search, page, cityFilter, stateFilter, specialtyFilter])

  useEffect(() => { load() }, [load])

  const grouped = clients.reduce((acc, c) => {
    const letter = c.name[0].toUpperCase()
    if (!acc[letter]) acc[letter] = []
    acc[letter].push(c)
    return acc
  }, {})

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const clearSelect = () => setSelected(new Set())

  const bulkDelete = async () => {
    if (!window.confirm(`Excluir ${selected.size} cliente(s)? Esta ação não pode ser desfeita.`)) return
    setBulkError('')
    try {
      await api.delete('/clients/bulk', { data: { ids: [...selected] } })
      setClients(prev => prev.filter(c => !selected.has(c.id)))
      setTotal(t => t - selected.size)
      clearSelect()
      loadStats()
    } catch (err) {
      const msg = err.response?.data?.error
        || (typeof err.response?.data === 'string' ? err.response.data.substring(0, 120) : null)
        || err.message || 'Erro ao excluir clientes'
      setBulkError(msg)
    }
  }

  const hasFilters = cityFilter || stateFilter || specialtyFilter
  const clearFilters = () => { setCityFilter(''); setStateFilter(''); setSpecialtyFilter(''); setPage(1) }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Clientes</h1>
          <p className="text-sm text-gray-500">{total} cliente{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-navy-900 text-white text-sm font-medium rounded-xl hover:bg-navy-800 transition-colors">
          + Novo cliente
        </button>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total de clientes"
          value={stats?.total}
          color="border-l-navy-900"
          subtitle="cadastrados no sistema"
        />
        <StatCard
          label="Últimos 30 dias"
          value={stats?.past30}
          color="border-l-green-500"
          subtitle="clientes com consultas recentes"
        />
        <StatCard
          label="Próximos 30 dias"
          value={stats?.next30}
          color="border-l-blue-500"
          subtitle="clientes com consultas agendadas"
        />
      </div>

      {/* Busca e filtros */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nome ou email..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <input
            value={cityFilter} onChange={e => { setCityFilter(e.target.value); setPage(1) }}
            placeholder="Cidade"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
          />
          <input
            value={stateFilter} onChange={e => { setStateFilter(e.target.value.toUpperCase()); setPage(1) }}
            placeholder="UF (SP, RJ…)"
            maxLength={2}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
          />
          <select
            value={specialtyFilter} onChange={e => { setSpecialtyFilter(e.target.value); setPage(1) }}
            className="col-span-2 sm:col-span-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700 bg-white"
          >
            <option value="">Todas as categorias</option>
            {LEGAL_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-navy-700 hover:underline">
            Limpar filtros ×
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">👥</p>
          <p className="font-medium">{search || hasFilters ? 'Nenhum cliente encontrado com estes filtros' : 'Nenhum cliente cadastrado ainda'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([letter, group]) => (
            <div key={letter}>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{letter}</div>
              <div className="space-y-2">
                {group.map(client => (
                  <div key={client.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                      ${selected.has(client.id) ? 'border-navy-400 bg-navy-50' : 'border-gray-100 hover:border-navy-200 hover:shadow-md'}`}>
                    <input type="checkbox" checked={selected.has(client.id)}
                      onChange={() => toggleSelect(client.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 accent-navy-900 flex-shrink-0" />
                    <div className="flex-1 min-w-0" onClick={() => setSelectedId(client.id)}>
                      <p className="font-medium text-navy-900 truncate">{client.name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {client.email && <p className="text-xs text-gray-500 truncate">{client.email}</p>}
                        {(client.city || client.state) && (
                          <span className="text-xs text-gray-400">· {[client.city, client.state].filter(Boolean).join('/')}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0" onClick={() => setSelectedId(client.id)}>
                      {client._count?.appointments > 0 && (
                        <span className="text-xs bg-navy-100 text-navy-700 px-2 py-0.5 rounded-full">
                          {client._count.appointments} agend.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Paginação */}
          {total > 30 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
              <span className="text-sm text-gray-500">Página {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={clients.length < 30}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Próxima →</button>
            </div>
          )}
        </div>
      )}

      {/* Barra de ações em lote */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-navy-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
          {bulkError && <span className="text-xs text-red-400">{bulkError}</span>}
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <button onClick={() => setSelected(new Set(clients.map(c => c.id)))}
            className="text-xs text-gray-300 hover:text-white underline">Selecionar todos</button>
          <button onClick={bulkDelete}
            className="text-sm bg-red-500 hover:bg-red-400 px-3 py-1 rounded-lg transition-colors">
            Excluir selecionados
          </button>
          <button onClick={clearSelect} className="text-gray-300 hover:text-white text-lg">×</button>
        </div>
      )}

      {/* Modais */}
      {showNew && (
        <ClientModal
          onClose={() => setShowNew(false)}
          onSaved={(c) => {
            setClients(prev => [c, ...prev].sort((a, b) => a.name.localeCompare(b.name)))
            setTotal(t => t + 1)
            setShowNew(false)
            loadStats()
          }}
        />
      )}

      {selectedId && (
        <ClientDetail
          clientId={selectedId}
          onClose={() => setSelectedId(null)}
          onEdit={() => { setEditId(selectedId); setSelectedId(null) }}
        />
      )}

      {editId && (
        <ClientModal
          clientId={editId}
          onClose={() => setEditId(null)}
          onSaved={(c) => {
            setClients(prev => prev.map(x => x.id === c.id ? { ...x, ...c } : x))
            setEditId(null)
          }}
        />
      )}
    </div>
  )
}
