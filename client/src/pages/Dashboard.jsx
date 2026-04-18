// Implementado no Passo 5
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { lawyer, logout } = useAuth()
  return (
    <div>
      <h1>Olá, {lawyer?.name}</h1>
      <button onClick={logout}>Sair</button>
    </div>
  )
}
