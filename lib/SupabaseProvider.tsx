'use client'

import { createContext, useContext, useMemo, useEffect, useState } from 'react'
import { createBrowserClient, SupabaseClient, Session, User } from '@supabase/ssr'

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

  // Crear cliente Supabase con persistencia de cookies
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    return createBrowserClient(supabaseUrl, supabaseAnonKey)
  }, [])

  useEffect(() => {
    // Obtener sesión inicial
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error)
          setSession(null)
          setUser(null)
          return
        }

        console.log('Session loaded:', session ? `User: ${session.user.email}` : 'No session')
        setSession(session)
        setUser(session?.user ?? null)
      } catch (err) {
        console.error('Exception getting session:', err)
        setSession(null)
        setUser(null)
      }
    }

    initSession()

    // Escuchar cambios en la sesión
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session ? `User: ${session.user.email}` : 'No session')
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
