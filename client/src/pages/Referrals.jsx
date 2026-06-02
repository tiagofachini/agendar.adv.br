import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SITE_URL = 'https://agendar.adv.br'

export default function Referrals() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: code, error: codeErr } = await supabase.rpc('get_or_create_referral_code')
      if (codeErr) { setError(codeErr.message); setLoading(false); return }

      const { data: stats, error: statsErr } = await supabase.rpc('get_referral_stats')
      if (statsErr) { setError(statsErr.message); setLoading(false); return }

      const row = stats?.[0]
      setData({
        code,
        link: `${SITE_URL}/?ref=${code}`,
        total: Number(row?.total ?? 0),
        rewardMonths: Number(row?.reward_months ?? 0),
      })
      setLoading(false)
    }
    load()
  }, [])

  const copy = () => {
    if (!data?.link) return
    navigator.clipboard.writeText(data.link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const whatsappShare = () => {
    if (!data?.link) return
    const text = `Ei! Estou usando o AgendarAdv para gerenciar minha agenda e cobranças. Você pode se cadastrar pelo meu link e, se assinar o Pro, eu ganho um mês grátis 😄 ${data.link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Programa de Indicação</h1>
        <p className="text-sm text-gray-500 mt-1">Ganhe meses grátis no Plano Pro a cada colega que você indicar</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 font-mono break-all">
          {error}
        </div>
      )}

      {/* Como funciona */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
        <h2 className="font-semibold text-amber-900 mb-3">Como funciona</h2>
        <div className="space-y-2.5">
          {[
            ['1', 'Copie seu link de indicação abaixo'],
            ['2', 'Compartilhe com colegas advogados — por WhatsApp, email ou redes sociais'],
            ['3', 'Cada colega que assinar o Plano Pro usando seu link vale 1 mês grátis para você'],
          ].map(([n, text]) => (
            <div key={n} className="flex items-start gap-3">
              <span className="bg-amber-400 text-amber-900 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
              <p className="text-sm text-amber-800">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
          <div className="text-3xl font-extrabold text-navy-900">{loading ? '—' : (data?.total ?? 0)}</div>
          <div className="text-sm text-gray-500 mt-1">Indicações convertidas</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-amber-400 text-center">
          <div className="text-3xl font-extrabold text-navy-900">{loading ? '—' : (data?.rewardMonths ?? 0)}</div>
          <div className="text-sm text-gray-500 mt-1">Meses grátis ganhos</div>
        </div>
      </div>

      {/* Seu link */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-navy-900 mb-3">Seu link de indicação</h2>
        {loading ? (
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                readOnly
                value={data?.link ?? ''}
                onClick={e => e.target.select()}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-navy-700 min-w-0"
              />
              <button
                onClick={copy}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                  copied ? 'bg-green-500 text-white' : 'bg-navy-900 text-white hover:bg-navy-800'
                }`}
              >
                {copied ? '✓ Copiado!' : 'Copiar'}
              </button>
            </div>
            <button
              onClick={whatsappShare}
              className="w-full py-2.5 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Compartilhar no WhatsApp
            </button>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">
          O benefício é aplicado automaticamente quando o colega assinar o Plano Pro a partir do seu link.
        </p>
      </div>
    </div>
  )
}
