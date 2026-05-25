import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { publicApi } from '../lib/api'

const STATE_COORDS = {
  AC: [-8.77, -70.55], AL: [-9.71, -35.73], AM: [-3.07, -61.66], AP: [1.41, -51.77],
  BA: [-12.97, -38.50], CE: [-3.72, -38.54], DF: [-15.78, -47.93], ES: [-19.19, -40.34],
  GO: [-16.35, -48.95], MA: [-2.53, -44.30], MG: [-19.92, -43.94], MS: [-20.44, -54.65],
  MT: [-15.60, -56.10], PA: [-1.45, -48.50], PB: [-7.12, -34.86], PE: [-8.05, -34.88],
  PI: [-5.09, -42.80], PR: [-25.43, -49.27], RJ: [-22.91, -43.17], RN: [-5.79, -35.21],
  RO: [-8.76, -63.90], RR: [2.82, -60.67], RS: [-30.03, -51.23], SC: [-27.60, -48.55],
  SE: [-10.91, -37.07], SP: [-23.55, -46.63], TO: [-10.25, -48.32],
}

const STATES = Object.keys(STATE_COORDS).sort()

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function LawyerCard({ lawyer }) {
  const brand = /^#[0-9a-fA-F]{6}$/.test(lawyer.brandColor1) ? lawyer.brandColor1 : '#1a1a2e'
  const location = [lawyer.city, lawyer.state].filter(Boolean).join(' — ')
  return (
    <a
      href={`https://agendar.adv.br/${lawyer.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3 group"
      itemScope
      itemType="https://schema.org/LegalService"
    >
      <div className="flex items-center gap-3">
        {lawyer.logoUrl ? (
          <img src={lawyer.logoUrl} alt={lawyer.lawyerName} className="h-12 w-12 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${brand}` }} itemProp="image" />
        ) : (
          <div className="h-12 w-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: brand }}>
            {lawyer.lawyerName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-navy-900 text-sm truncate group-hover:text-navy-700 transition-colors" itemProp="name">
            {lawyer.lawyerName}
          </p>
          {location && (
            <p className="text-xs text-gray-400 mt-0.5" itemProp="address">📍 {location}</p>
          )}
        </div>
      </div>

      {lawyer.highlightMessage && (
        <p className="text-xs text-gray-500 italic border-l-2 pl-2 line-clamp-2" style={{ borderColor: brand }}>
          {lawyer.highlightMessage}
        </p>
      )}

      {lawyer.specialties?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {lawyer.specialties.slice(0, 3).map(s => (
            <span key={s} className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: brand + '18', color: brand }}>
              {s}
            </span>
          ))}
          {lawyer.specialties.length > 3 && (
            <span className="text-xs text-gray-400 self-center">+{lawyer.specialties.length - 3}</span>
          )}
        </div>
      )}

      <div className="mt-auto pt-2 border-t border-gray-100">
        <span className="text-xs font-semibold" style={{ color: brand }}>
          Agendar consulta →
        </span>
      </div>
    </a>
  )
}

export default function Directory() {
  const [lawyers, setLawyers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [userCoords, setUserCoords] = useState(null)
  const [geoTried, setGeoTried] = useState(false)

  const hasFilters = !!(q || city || state || specialty)

  const fetchLawyers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (city) params.set('city', city)
      if (state) params.set('state', state)
      if (specialty) params.set('specialty', specialty)
      const { data } = await publicApi.get(`/scheduler/directory?${params}`)
      setLawyers(data.lawyers ?? [])
    } catch {
      setLawyers([])
    } finally {
      setLoading(false)
    }
  }, [q, city, state, specialty])

  useEffect(() => {
    fetchLawyers()
  }, [fetchLawyers])

  useEffect(() => {
    if (geoTried || hasFilters) return
    if (!navigator.geolocation) { setGeoTried(true); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoTried(true) },
      () => setGeoTried(true),
      { timeout: 5000 }
    )
  }, [geoTried, hasFilters])

  useEffect(() => {
    document.title = 'Diretório de Advogados | AgendarAdv'

    let canonical = document.querySelector("link[rel='canonical']")
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical) }
    canonical.href = 'https://agendar.adv.br/advogados'

    let metaRobots = document.querySelector("meta[name='robots']")
    if (!metaRobots) { metaRobots = document.createElement('meta'); metaRobots.name = 'robots'; document.head.appendChild(metaRobots) }
    metaRobots.content = hasFilters ? 'noindex, follow' : 'index, follow'

    return () => { canonical?.remove(); metaRobots?.remove() }
  }, [hasFilters])

  useEffect(() => {
    if (loading || lawyers.length === 0) return
    const existing = document.getElementById('dir-schema')
    if (existing) existing.remove()
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'dir-schema'
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Diretório de Advogados — AgendarAdv',
      description: 'Advogados cadastrados no AgendarAdv com agendamento online em todo o Brasil.',
      url: 'https://agendar.adv.br/advogados',
      numberOfItems: lawyers.length,
      itemListElement: lawyers.slice(0, 50).map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'LegalService',
          name: l.lawyerName,
          url: `https://agendar.adv.br/${l.slug}`,
          ...(l.city || l.state ? { address: { '@type': 'PostalAddress', addressLocality: l.city, addressRegion: l.state, addressCountry: 'BR' } } : {}),
          ...(l.specialties?.length ? { knowsAbout: l.specialties } : {}),
        },
      })),
    })
    document.head.appendChild(script)
    return () => { document.getElementById('dir-schema')?.remove() }
  }, [lawyers, loading])

  const sorted = hasFilters
    ? lawyers
    : userCoords
    ? [...lawyers].sort((a, b) => {
        const ca = STATE_COORDS[a.state]; const cb = STATE_COORDS[b.state]
        if (!ca && !cb) return a.lawyerName.localeCompare(b.lawyerName, 'pt-BR')
        if (!ca) return 1; if (!cb) return -1
        const da = haversineKm(userCoords.lat, userCoords.lng, ca[0], ca[1])
        const db = haversineKm(userCoords.lat, userCoords.lng, cb[0], cb[1])
        return da !== db ? da - db : a.lawyerName.localeCompare(b.lawyerName, 'pt-BR')
      })
    : lawyers

  const allSpecialties = [...new Set(lawyers.flatMap(l => l.specialties ?? []))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-navy-900 shadow-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="AgendarAdv" className="h-9 w-9 object-contain" />
            <span className="text-white font-bold text-xl tracking-tight">
              Agendar<span className="text-brand-500">Adv</span>
            </span>
          </Link>
          <Link to="/" className="text-brand-400 text-sm font-medium hover:text-brand-300 transition-colors">
            Sou advogado →
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-navy-900 mb-2">Diretório de Advogados</h1>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">
            Advogados com agendamento online em todo o Brasil. Marque uma consulta diretamente, sem intermediários.
          </p>
          {!geoTried && !hasFilters && (
            <p className="text-xs text-gray-400 mt-2 animate-pulse">Detectando sua localização...</p>
          )}
          {geoTried && userCoords && !hasFilters && (
            <p className="text-xs text-green-600 mt-2">📍 Exibindo advogados mais próximos de você</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar por nome ou área..."
              className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
            />
            <input
              value={city} onChange={e => setCity(e.target.value)}
              placeholder="Cidade"
              className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700"
            />
            <select value={state} onChange={e => setState(e.target.value)}
              className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700 bg-white">
              <option value="">Todos os estados</option>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={specialty} onChange={e => setSpecialty(e.target.value)}
              className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-700 bg-white">
              <option value="">Todas as especialidades</option>
              {allSpecialties.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {hasFilters && (
            <button onClick={() => { setQ(''); setCity(''); setState(''); setSpecialty('') }}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline">
              Limpar filtros
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <div className="h-5 bg-gray-100 rounded-full w-20" />
                  <div className="h-5 bg-gray-100 rounded-full w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-lg font-medium mb-1">Nenhum advogado encontrado</p>
            {hasFilters && <p className="text-sm">Tente ajustar os filtros de busca.</p>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" itemScope itemType="https://schema.org/ItemList">
              {sorted.map(l => <LawyerCard key={l.slug} lawyer={l} />)}
            </div>
            <p className="text-center text-xs text-gray-400 mt-6">
              {sorted.length} advogado{sorted.length !== 1 ? 's' : ''} encontrado{sorted.length !== 1 ? 's' : ''}
              {!hasFilters && userCoords ? ' · ordenados por proximidade' : ''}
            </p>
          </>
        )}
      </div>

      <footer className="border-t border-gray-200 mt-12 py-8 text-center text-xs text-gray-400">
        <p>
          <Link to="/" className="hover:text-gray-600">AgendarAdv</Link>
          {' · '}
          <Link to="/termos" className="hover:text-gray-600">Termos</Link>
          {' · '}
          <Link to="/privacidade" className="hover:text-gray-600">Privacidade</Link>
        </p>
        <p className="mt-2">É advogado? <Link to="/" className="text-navy-700 hover:underline font-medium">Cadastre-se gratuitamente →</Link></p>
      </footer>
    </div>
  )
}
