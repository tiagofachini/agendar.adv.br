import { useState, useCallback, useEffect } from 'react'
import api from '../lib/api'

// ── Modal de novo/editar cliente ───────────────────────────────────────────────
function ClientModal({ clientId, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (clientId) {
      api.get(`/clients/${clientId}`).then(r => {
        const { name, email, whatsapp } = r.data
        setForm({ name: name || '', email: email || '', whatsapp: whatsapp || '' })
      }).catch(console.error)
    }
  }, [clientId])

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

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700'

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-navy-900 mb-4">{clientId ? 'Editar cliente' : 'Novo cliente'}</h2>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input className={inputCls} value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="Nome completo" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input className={inputCls} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input className={inputCls} value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} placeholder="(11) 99999-9999" />
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
    setSendLoading(true); setError('')
    try {
      await api.post(`/clients/${clientId}/message`, msgForm)
      setMsgForm({ channel: 'email', subject: '', body: '' })
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

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700'

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-navy-900 text-white px-6 py-4 flex items-center justify-between">
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
          {/* Info */}
          <div className="space-y-2 text-sm">
            {client.whatsapp && <div className="flex items-center gap-2 text-gray-700"><span>📱</span>{client.whatsapp}</div>}
          </div>

          {/* Histórico de agendamentos */}
          {client.appointments?.length > 0 && (
            <div>
              <h3 className="font-semibold text-navy-900 mb-3">Agendamentos</h3>
              <div className="space-y-2">
                {client.appointments.map(a => (
                  <div key={a.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800">
                        {new Date(a.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
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
          <div>
            <h3 className="font-semibold text-navy-900 mb-3">Enviar mensagem</h3>
            <form onSubmit={sendMsg} className="space-y-3">
              <select value={msgForm.channel} onChange={e => setMsgForm({...msgForm, channel: e.target.value})}
                className={inputCls}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              {msgForm.channel === 'email' && (
                <input className={inputCls} placeholder="Assunto" value={msgForm.subject}
                  onChange={e => setMsgForm({...msgForm, subject: e.target.value})} required />
              )}
              <textarea className={`${inputCls} resize-none`} rows={4} placeholder="Mensagem..."
                value={msgForm.body} onChange={e => setMsgForm({...msgForm, body: e.target.value})} required />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button type="submit" disabled={sendLoading}
                className="w-full py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50">
                {sendLoading ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────────────
export default function Clients() {
  const [clients, setClients] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bulkError, setBulkError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/clients?search=${encodeURIComponent(search)}&page=${page}`)
      setClients(data.clients)
      setTotal(data.total)
    } catch { /* noop */ }
    finally { setLoading(false) }
  }, [search, page])

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
    } catch (err) {
      const msg = err.response?.data?.error
        || (typeof err.response?.data === 'string' ? err.response.data.substring(0, 120) : null)
        || err.message || 'Erro ao excluir clientes'
      setBulkError(msg)
    }
  }

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

      {/* Busca */}
      <div className="relative mb-6">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar por nome ou email..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">👥</p>
          <p className="font-medium">{search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}</p>
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
                      {client.email && <p className="text-xs text-gray-500 truncate">{client.email}</p>}
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
          {total > 20 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
              <span className="text-sm text-gray-500">Página {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={clients.length < 20}
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
