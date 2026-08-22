import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const PROBLEMS = [
  'Agenda bagunçada e compromissos esquecidos',
  'Clientes te chamando no WhatsApp a qualquer hora',
  'Dificuldade de saber quanto vai receber no mês',
  'Histórico de atendimentos espalhado em papéis e planilhas',
  'Ferramentas caras que não se encaixam na advocacia',
  'Sem visão clara da rentabilidade do escritório',
]

const BENEFITS = [
  { icon: '📅', title: 'Agenda Organizada', desc: 'Visualize todos os seus compromissos como no Google Calendar, com status e alertas.' },
  { icon: '💰', title: 'Mais Faturamento', desc: 'Receba pagamentos antecipados pelas consultas direto no app, sem intermediários.' },
  { icon: '📊', title: 'Visão de Gestão', desc: 'Dashboard com recebíveis, novos clientes e compromissos do dia — tudo em um painel.' },
  { icon: '👥', title: 'Histórico de Clientes', desc: 'Cada cliente com seu histórico de atendimentos, demandas e status financeiro.' },
  { icon: '🔗', title: 'Link de Agendamento', desc: 'Seu cliente agenda e paga sozinho pela sua URL personalizada, sem te ligar.' },
  { icon: '📱', title: 'Você no Controle pelo WhatsApp', desc: 'Receba alertas de novos agendamentos e cancelamentos — sem o cliente precisar te chamar.' },
]

const FEATURES = [
  { icon: '🗓️', title: 'Agenda Inteligente', desc: 'Sincronize com Google Calendar ou use a agenda nativa. Defina dias e horários disponíveis para agendamento.' },
  { icon: '🔗', title: 'Agendador Público', desc: 'Página mobile com sua identidade. O cliente escolhe o horário, descreve o problema e paga — tudo online.' },
  { icon: '👤', title: 'Módulo de Clientes', desc: 'Cadastro completo com histórico de atendimentos, demandas ativas e status financeiro de cada cliente.' },
  { icon: '💳', title: 'Módulo Financeiro', desc: 'Gerencie cobranças, veja saldo, recebidos e a receber com gráfico de evolução. Aceite PIX, boleto e cartão via Asaas.' },
  { icon: '📈', title: 'Dashboard de Gestão', desc: 'Compromissos de hoje e amanhã, countdown pro próximo cliente, recebíveis e indicadores do período.' },
  { icon: '⚙️', title: 'Configurações Completas', desc: 'Personalize seu escritório, especialidades, horários, integração com Google e muito mais.' },
]

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700'

export default function LandingPage() {
  const navigate = useNavigate()
  const { lawyer } = useAuth()
  const [modal, setModal] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '' })

  useEffect(() => { if (lawyer) navigate('/dashboard') }, [lawyer, navigate])

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleMagicLink = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: form.email,
      options: {
        emailRedirectTo: 'https://agendar.adv.br',
        data: modal === 'register' ? { name: form.name, whatsapp: form.whatsapp } : undefined,
      },
    })
    if (error) setError(error.message)
    else setMagicLinkSent(true)
    setLoading(false)
  }

  const openModal = (type) => {
    setModal(type); setError(''); setMagicLinkSent(false)
    setForm({ name: '', email: '', whatsapp: '' })
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-navy-900 shadow-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AgendarAdv" className="h-9 w-9 object-contain" />
            <span className="text-white font-bold text-xl tracking-tight">
              Agendar<span className="text-brand-500">Adv</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/advogados" className="text-gray-300 text-sm font-medium hover:text-white transition-colors hidden sm:block">
              Encontrar advogado
            </Link>
            <button
              onClick={() => openModal('login')}
              className="px-5 py-2 rounded-lg border border-brand-500 text-brand-400 text-sm font-medium hover:bg-brand-500 hover:text-white transition-colors"
            >
              Entrar
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-navy-900 pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-brand-500/20 text-brand-400 text-sm font-medium">
            100% gratuito — sem cartão, sem prazo, sem pegadinha
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-6">
            Mais consultas.<br />
            <span className="text-brand-400">Menos caos.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
            Centralize agenda, clientes, cobranças e histórico em uma só ferramenta.
            Seu cliente agenda e paga sozinho — você só aparece na consulta.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => openModal('register')}
              className="px-8 py-4 rounded-xl bg-brand-500 text-white font-bold text-lg hover:bg-brand-400 transition-colors shadow-lg"
            >
              Começar Grátis
            </button>
            <button
              onClick={() => openModal('login')}
              className="px-8 py-4 rounded-xl border-2 border-white/20 text-white font-semibold text-lg hover:border-white/50 transition-colors"
            >
              Já tenho conta
            </button>
          </div>
          <p className="mt-6 text-sm text-gray-500">Sem cartão de crédito. Sem contrato. Comece em segundos.</p>
        </div>
      </section>

      {/* Problemas */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-navy-900 mb-3">Reconhece algum desses problemas?</h2>
          <p className="text-center text-gray-500 mb-12">Se sim, você está no lugar certo.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PROBLEMS.map((p) => (
              <div key={p} className="bg-white rounded-xl p-5 flex items-start gap-3 shadow-sm border border-gray-100">
                <span className="text-2xl mt-0.5">😔</span>
                <p className="text-gray-700 text-sm leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-navy-900 mb-3">Com o AgendarAdv, tudo muda</h2>
          <p className="text-center text-gray-500 mb-12">Uma ferramenta. Tudo resolvido.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-navy-900 rounded-2xl p-6 text-white">
                <div className="text-4xl mb-4">{b.icon}</div>
                <h3 className="font-bold text-lg mb-2">{b.title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-navy-900 mb-3">Tudo que seu escritório precisa</h2>
          <p className="text-center text-gray-500 mb-12">Sem precisar de 5 ferramentas diferentes.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-navy-800 mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gratuito */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-navy-900 mb-3">Gratuito de verdade.</h2>
          <p className="text-gray-500 mb-10 text-lg">
            Sem planos, sem asterisco, sem cartão. Todas as funcionalidades disponíveis desde o primeiro dia.
          </p>

          <div className="bg-white rounded-2xl border-2 border-brand-500 p-8 text-left shadow-sm">
            <div className="flex items-end gap-2 mb-2">
              <span className="text-6xl font-extrabold text-navy-900">R$ 0</span>
              <span className="text-gray-400 text-base mb-3">/mês</span>
            </div>
            <p className="text-gray-500 text-sm mb-7">Todas as funcionalidades, sem limites de consultas.</p>

            <ul className="space-y-3 text-sm mb-8">
              {[
                'Agenda e controle de compromissos ilimitados',
                'Cadastro de clientes com histórico completo',
                'Agendador público personalizado com sua marca',
                'Dashboard e módulo financeiro',
                'Recebimento de consultas via Asaas (PIX, boleto e cartão)',
                'Integração com Google Calendar e Google Meet',
                'Confirmação automática de pagamento via webhook',
                'Listagem no diretório de advogados',
                'Notificações por email e WhatsApp',
              ].map((text) => (
                <li key={text} className="flex items-start gap-2.5 text-gray-700">
                  <span className="mt-0.5 font-bold flex-shrink-0 text-green-500">✓</span>
                  {text}
                </li>
              ))}
            </ul>

            <button
              onClick={() => openModal('register')}
              className="w-full py-3.5 rounded-xl bg-navy-900 text-white font-bold hover:bg-navy-800 transition-colors text-base"
            >
              Criar conta grátis →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-900 border-t border-white/10 pt-10 pb-8 px-6">
        <div className="max-w-5xl mx-auto">

          {/* Parceiros */}
          <div className="text-center mb-8">
            <p className="text-gray-500 text-xs uppercase tracking-widest font-semibold mb-4">Conheça também</p>
            <div className="flex items-center justify-center">
              <a
                href="https://sumulando.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-3 transition-colors group"
              >
                <span className="text-xl">📚</span>
                <div className="text-left">
                  <p className="text-white font-semibold text-sm group-hover:text-brand-400 transition-colors">sumulando.com.br</p>
                  <p className="text-gray-500 text-xs">Súmulas e jurisprudência</p>
                </div>
              </a>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <span>© {new Date().getFullYear()} AgendarAdv — Feito para advogados brasileiros</span>
            <div className="flex gap-4">
              <Link to="/termos" className="hover:text-gray-300 transition-colors">Termos de Uso</Link>
              <Link to="/privacidade" className="hover:text-gray-300 transition-colors">Política de Privacidade</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-navy-900 px-8 py-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
                  <span className="text-white font-bold text-xl">
                    Agendar<span className="text-brand-400">Adv</span>
                  </span>
                </div>
                <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
              </div>
              <p className="text-gray-300 text-sm">
                {modal === 'register' ? 'Crie sua conta grátis em segundos' : 'Bem-vindo de volta'}
              </p>
            </div>

            <div className="p-8">
              {magicLinkSent ? (
                <div className="text-center py-4">
                  <div className="text-5xl mb-4">📬</div>
                  <h3 className="font-bold text-navy-900 text-lg mb-2">Você não precisa mais de senha.</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6">
                    Enviamos um link de acesso para <strong>{form.email}</strong>. Basta clicar no link deste email para entrar no AgendarAdv.
                  </p>
                  <button onClick={() => setMagicLinkSent(false)} className="text-navy-700 text-sm font-medium hover:underline">
                    Usar outro email
                  </button>
                </div>
              ) : (
                <>
                  <form onSubmit={handleMagicLink} className="space-y-4">
                    {modal === 'register' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                          <input name="name" value={form.name} onChange={update} required placeholder="Dr. João Silva" className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                          <input name="whatsapp" value={form.whatsapp} onChange={update} placeholder="(11) 99999-9999" className={inputCls} />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input name="email" type="email" value={form.email} onChange={update} required placeholder="joao@escritorio.adv.br" className={inputCls} />
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button
                      type="submit" disabled={loading}
                      className="w-full py-3 rounded-xl bg-navy-900 text-white font-bold hover:bg-navy-800 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Enviando...' : 'Enviar link de acesso'}
                    </button>
                    <p className="text-xs text-center text-gray-400">Sem senha. Um link seguro será enviado para seu email.</p>
                  </form>

                  <p className="text-center text-sm text-gray-500 mt-6">
                    {modal === 'register' ? (
                      <>Já tem conta?{' '}
                        <button onClick={() => openModal('login')} className="text-navy-700 font-medium hover:underline">Entrar</button>
                      </>
                    ) : (
                      <>Ainda não tem conta?{' '}
                        <button onClick={() => openModal('register')} className="text-navy-700 font-medium hover:underline">Criar grátis</button>
                      </>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
