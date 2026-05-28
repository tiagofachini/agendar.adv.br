import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const ADMIN_EMAIL = 'emaildogago@gmail.com'

async function loadLawyerData(userId) {
  const { data: lawyerData } = await supabase
    .from('Lawyer').select('*').eq('auth_id', userId).maybeSingle()
  if (!lawyerData) return null
  const { data: settings } = await supabase
    .from('LawyerSettings').select('*').eq('lawyerId', lawyerData.id).maybeSingle()
  return { ...lawyerData, settings }
}

async function fetchPlanInfo() {
  const { data, error } = await supabase.rpc('get_plan_info')
  if (error || !data) return { plan: 'FREE', monthlyCount: 0, monthlyLimit: 20 }
  return data
}

const DEFAULT_PLAN = { plan: 'FREE', monthlyCount: 0, monthlyLimit: 20 }

export function AuthProvider({ children }) {
  // undefined = ainda não verificado; null = sem sessão; objeto = sessão ativa
  const [session, setSession] = useState(undefined)
  const [lawyer, setLawyer] = useState(null)
  const [planInfo, setPlanInfo] = useState(DEFAULT_PLAN)
  const [adminViewPlan, setAdminViewPlanState] = useState(
    () => localStorage.getItem('adminViewPlan') || null
  )

  const setAdminViewPlan = (plan) => {
    if (plan) localStorage.setItem('adminViewPlan', plan)
    else localStorage.removeItem('adminViewPlan')
    setAdminViewPlanState(plan)
  }

  const refreshPlan = useCallback(async () => {
    const info = await fetchPlanInfo()
    setPlanInfo(info)
  }, [])

  useEffect(() => {
    let cancelled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      setSession(session ?? null)
      if (session) {
        loadLawyerData(session.user.id)
          .then(data => { if (!cancelled) setLawyer(data) })
          .catch(() => { if (!cancelled) setLawyer(null) })
        fetchPlanInfo()
          .then(info => { if (!cancelled) setPlanInfo(info) })
          .catch(() => {})
      } else {
        setLawyer(null)
        setPlanInfo(DEFAULT_PLAN)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const logout = () => supabase.auth.signOut()

  const isAdmin = session?.user?.email === ADMIN_EMAIL
  const effectivePlan = isAdmin && adminViewPlan ? adminViewPlan : planInfo.plan

  return (
    <AuthContext.Provider value={{
      session,
      lawyer,
      loading: session === undefined,
      logout,
      setLawyer,
      plan: planInfo.plan,
      monthlyCount: planInfo.monthlyCount,
      monthlyLimit: planInfo.monthlyLimit,
      planExpiresAt: planInfo.planExpiresAt,
      refreshPlan,
      adminViewPlan,
      setAdminViewPlan,
      effectivePlan,
      isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
