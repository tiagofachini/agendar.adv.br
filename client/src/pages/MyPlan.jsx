import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { supabase } from '../lib/supabase'

const PLAN_FEATURES = [
  { label: 'Agenda e compromissos',                 free: true,  pro: true  },
  { label: 'Cadastro de clientes',                   free: true,  pro: true  },
  { label: 'Agendador público personalizado',        free: true,  pro: true  },
  { label: 'Dashboard e módulo financeiro',          free: true,  pro: true  },
  { label: 'Pagamento via PIX manual',               free: true,  pro: true  },
  { label: 'Listagem no diretório de advogados',     free: true,  pro: true  },
  { label: 'Alertas por email',                      free: true,  pro: true  },
  { label: 'Consultas ilimitadas',                   free: false, pro: true  },
  { label: 'Sem anúncios na plataforma',             free: false, pro: true  },
  { label: 'Cartão de crédito/débito via Stripe',    free: false, pro: true  },
  { label: 'Integração com Google Agenda',           free: false, pro: true  },
  { label: 'Videochamada via Google Meet',           free: false, pro: true  },
  { label: 'Transcrição automática por IA',          free: false, pro: true  },
  { label: 'Alertas por WhatsApp',                   free: false, pro: true  },
]

export default function MyPlan() {
  const { effectivePlan, plan, monthlyCount, monthlyLimit, planExpiresAt, refreshPlan, logout } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [checkoutMsg, setCheckoutMsg] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    window.history.replaceState({}, '', '/my-plan')
    if (checkout === 'success') {
      setCheckoutMsg('success')
      refreshPlan()
    } else if (checkout === 'cancelled') {
      setCheckoutMsg('cancelled')
    }
  }, [refreshPlan])

  useEffect(() => {
    setHistoryLoading(true)
    api.get('/subscription')
      .then(r => setHistory(r.data?.history ?? []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [])

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/subscription/checkout')
      if (data.url) window.location.href = data.url
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao iniciar checkout. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancelar sua assinatura?\n\nVocê continuará com acesso Pro até o fim do período já pago.')) return
    setCancelLoading(true)
    try {
      await api.post('/subscription/cancel')
      await refreshPlan()
      alert('Assinatura cancelada. Seu acesso Pro continua até o fim do período pago.')
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao cancelar assinatura.')
    } finally {
      setCancelLoading(false)
    }
  }

  const handlePortal = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/subscription/portal')
      if (data.url) window.location.href = data.url
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao abrir portal de faturamento.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm(
      'Excluir permanentemente sua conta?\n\nTodos os seus dados, clientes, compromissos e configurações serão apagados. Esta ação não pode ser desfeita.'
    )) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await api.delete('/settings/account')
      logout()
      navigate('/')
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.message || 'Erro ao excluir conta')
      setDeleteLoading(false)
    }
  }

  const usagePercent = monthlyLimit ? Math.min((monthlyCount / monthlyLimit) * 100, 100) : 0
  const isBlocked = monthlyLimit && monthlyCount >= monthlyLimit

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy-900">Meu Plano</h1>
        <p className="text-sm text-gray-500">Gerencie sua assinatura e veja os benefícios disponíveis</p>
      </div>

      {/* Banner de checkout */}
      {checkoutMsg === 'success' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-green-500 text-xl">✓</span>
          <p className="text-green-800 font-medium text-sm">Assinatura Pro ativada! Bem-vindo ao Plano Pro.</p>
        </div>
      )}
      {checkoutMsg === 'cancelled' && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-amber-800 text-sm">Checkout cancelado. Sua assinatura não foi alterada.</p>
        </div>
      )}

      {/* Plano atual */}
      {effectivePlan === 'FREE' ? (
        <FreePlanCard
          monthlyCount={monthlyCount}
          monthlyLimit={monthlyLimit}
          usagePercent={usagePercent}
          isBlocked={isBlocked}
          onUpgrade={handleUpgrade}
          loading={loading}
        />
      ) : (
        <ProPlanCard
          planExpiresAt={planExpiresAt}
          onCancel={handleCancel}
          onPortal={handlePortal}
          cancelLoading={cancelLoading}
          loading={loading}
        />
      )}

      {/* Tabela comparativa */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-100">
          <div className="px-5 py-4 text-sm font-semibold text-gray-600">Funcionalidade</div>
          <div className="px-5 py-4 text-center">
            <span className="text-sm font-bold text-gray-700">Gratuito</span>
            <p className="text-xs text-gray-400 font-normal">R$ 0/mês</p>
          </div>
          <div className="px-5 py-4 text-center bg-navy-900/5">
            <span className="text-sm font-bold text-navy-900">Pro ⭐</span>
            <p className="text-xs text-gray-500 font-normal">R$ 29,90/mês</p>
          </div>
        </div>
        {PLAN_FEATURES.map(({ label, free, pro }) => (
          <div key={label} className="grid grid-cols-3 border-b border-gray-50 last:border-0">
            <div className="px-5 py-3 text-sm text-gray-700">{label}</div>
            <div className="px-5 py-3 text-center text-sm">
              {free ? <span className="text-green-500 font-bold">✓</span> : <span className="text-gray-300">—</span>}
            </div>
            <div className="px-5 py-3 text-center text-sm bg-navy-900/[0.02]">
              {pro ? <span className="text-green-500 font-bold">✓</span> : <span className="text-gray-300">—</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Histórico de pagamentos (Pro) */}
      {plan === 'PRO' && (
        <div className="bg-white rounded-2xl shadow-sm mb-6">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="font-bold text-navy-900">Histórico de pagamentos</h3>
          </div>
          {historyLoading ? (
            <div className="p-6 animate-pulse text-gray-400 text-sm">Carregando...</div>
          ) : history.length === 0 ? (
            <div className="p-6 text-sm text-gray-400">Nenhum pagamento registrado.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-navy-900">
                      {item.periodStart
                        ? `${format(new Date(item.periodStart), 'MMM yyyy', { locale: ptBR })} — ${format(new Date(item.periodEnd), 'MMM yyyy', { locale: ptBR })}`
                        : format(new Date(item.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-gray-400">Plano Pro</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-navy-900">
                      R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Pago</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Zona do Perigo */}
      <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-3 bg-red-600">
          <svg className="w-3.5 h-3.5 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-bold text-white uppercase tracking-widest">Zona do Perigo</span>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-sm mb-2">Excluir conta permanentemente</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Esta ação remove de forma definitiva e irreversível todos os dados associados à sua conta:
                perfil, clientes, compromissos, configurações, integrações e histórico financeiro.
                Após a exclusão, não é possível recuperar nenhuma informação nem desfazer a operação.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
              className="flex-shrink-0 px-4 py-2 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors disabled:opacity-40 self-start"
            >
              {deleteLoading ? 'Excluindo...' : 'Excluir minha conta'}
            </button>
          </div>
          {deleteError && (
            <p className="mt-4 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{deleteError}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function FreePlanCard({ monthlyCount, monthlyLimit, usagePercent, isBlocked, onUpgrade, loading }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold uppercase tracking-wide mb-2">
            Plano Gratuito
          </span>
          <p className="text-gray-500 text-sm">Você está no plano gratuito.</p>
        </div>
        <span className="text-3xl font-extrabold text-navy-900">R$ 0</span>
      </div>

      {monthlyLimit && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Consultas este mês</span>
            <span className={`text-sm font-bold ${isBlocked ? 'text-red-600' : 'text-navy-900'}`}>
              {monthlyCount} / {monthlyLimit}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isBlocked ? 'bg-red-500' : usagePercent > 75 ? 'bg-amber-400' : 'bg-green-500'}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          {isBlocked && (
            <p className="mt-2 text-xs text-red-600 font-medium">
              Limite atingido — novos agendamentos pelo link público estão bloqueados até o próximo mês.
            </p>
          )}
        </div>
      )}

      <button
        onClick={onUpgrade}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-navy-900 text-white font-bold text-sm hover:bg-navy-800 transition-colors disabled:opacity-50"
      >
        {loading ? 'Aguarde...' : '⭐ Fazer upgrade para o Pro — R$ 29,90/mês'}
      </button>
    </div>
  )
}

function ProPlanCard({ planExpiresAt, onCancel, onPortal, cancelLoading, loading }) {
  return (
    <div className="bg-navy-900 rounded-2xl p-6 mb-6 text-white">
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-wide mb-2">
            ⭐ Plano Pro
          </span>
          <p className="text-gray-300 text-sm">Você tem acesso completo a todas as funcionalidades.</p>
        </div>
        <span className="text-3xl font-extrabold text-white">R$ 29,90</span>
      </div>

      {planExpiresAt && (
        <div className="bg-white/10 rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm">
          <span className="text-gray-300">Próxima renovação:</span>
          <span className="font-semibold text-white">
            {format(new Date(planExpiresAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onPortal}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {loading ? 'Aguarde...' : 'Gerenciar assinatura →'}
        </button>
        <button
          onClick={onCancel}
          disabled={cancelLoading}
          className="py-2.5 px-4 rounded-xl border border-red-400/40 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          {cancelLoading ? 'Cancelando...' : 'Cancelar'}
        </button>
      </div>
    </div>
  )
}
