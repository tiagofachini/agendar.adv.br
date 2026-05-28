import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProGate({ children }) {
  const { effectivePlan } = useAuth()
  const navigate = useNavigate()

  if (effectivePlan === 'PRO') return children

  return (
    <div className="relative group">
      <div className="opacity-40 pointer-events-none select-none">
        {children}
      </div>
      <div
        onClick={() => navigate('/my-plan')}
        className="absolute inset-0 cursor-pointer flex items-center justify-center z-10"
      >
        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-navy-900/90 text-white text-xs font-semibold px-3 py-2 rounded-xl pointer-events-none text-center max-w-xs">
          ⭐ Funcionalidade do Plano Pro — clique para fazer upgrade
        </div>
      </div>
    </div>
  )
}
