'use client'

import { createContext, useContext, useMemo } from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Context para compartir el cliente Supabase
const SupabaseContext = createContext<SupabaseClient | undefined>(undefined)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  // Crear cliente Supabase solo una vez usando useMemo
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    return createClient(supabaseUrl, supabaseAnonKey)
  }, [])

  return (
    <SupabaseContext.Provider value={supabase}>
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
