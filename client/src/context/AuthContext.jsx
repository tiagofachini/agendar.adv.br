import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function loadLawyerData(userId) {
  const { data: lawyerData } = await supabase
    .from('Lawyer').select('*').eq('auth_id', userId).maybeSingle()
  if (!lawyerData) return null
  const { data: settings } = await supabase
    .from('LawyerSettings').select('*').eq('lawyerId', lawyerData.id).maybeSingle()
  return { ...lawyerData, settings }
}

export function AuthProvider({ children }) {
  // undefined = ainda não verificado; null = sem sessão; objeto = sessão ativa
  const [session, setSession] = useState(undefined)
  const [lawyer, setLawyer] = useState(null)

  useEffect(() => {
    let cancelled = false

    // onAuthStateChange cobre TODOS os eventos: INITIAL_SESSION (inclui retorno
    // de OAuth e magic link), SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.
    // Não chamamos getSession() separadamente para evitar corrida com a troca PKCE.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      setSession(session ?? null)
      if (session) {
        loadLawyerData(session.user.id)
          .then(data => { if (!cancelled) setLawyer(data) })
          .catch(() => { if (!cancelled) setLawyer(null) })
      } else {
        setLawyer(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const logout = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{
      session,
      lawyer,
      loading: session === undefined,
      logout,
      setLawyer,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

