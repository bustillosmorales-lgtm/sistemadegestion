'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { useRouter, usePathname } from 'next/navigation'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session && pathname !== '/login') {
        router.push('/login')
        return
      } else if (session && pathname === '/login') {
        router.push('/')
        return
      }
      
      setIsAuthenticated(!!session)
      setIsLoading(false)
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && pathname !== '/login') {
        router.push('/login')
      } else if (session && pathname === '/login') {
        router.push('/')
      }
      setIsAuthenticated(!!session)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [pathname, router, supabase.auth])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  // Si estamos en login, mostrar sin restricciones
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Si no está autenticado y no está en login, no mostrar nada (ya se redirigió)
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
