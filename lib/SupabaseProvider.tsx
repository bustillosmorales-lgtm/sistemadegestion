'use client'

import { createContext, useContext, useMemo, useEffect, useState } from 'react'
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js'

// Context para compartir el cliente Supabase
interface SupabaseContextType {
  client: SupabaseClient
  session: Session | null
  user: User | null
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)

  // Crear cliente Supabase solo una vez usando useMemo
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    return createClient(supabaseUrl, supabaseAnonKey)
  }, [])

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    // Escuchar cambios en la sesión
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return (
    <SupabaseContext.Provider value={{ client: supabase, session, user }}>
      {children}
    </SupabaseContext.Provider>
  )
}

// Hook personalizado para usar Supabase
export function useSupabase() {
  const context = useContext(SupabaseContext)

  if (context === undefined) {
    throw new Error('useSupabase debe usarse dentro de SupabaseProvider')
  }

  return context
}
