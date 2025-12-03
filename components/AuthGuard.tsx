'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/lib/SupabaseProvider'
import { useRouter, usePathname } from 'next/navigation'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const { session } = useSupabase()

  // Rutas públicas que no requieren autenticación
  const publicRoutes = ['/login', '/auth/callback', '/setup']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  useEffect(() => {
    // Esperar un momento para que la sesión se cargue
    const timer = setTimeout(() => {
      setIsLoading(false)

      // Si no hay sesión y no estamos en ruta pública, redirigir a login
      if (!session && !isPublicRoute) {
        console.log('AuthGuard: No session, redirecting to login')
        router.push('/login')
      }
      // Si hay sesión y estamos en login, redirigir a home
      else if (session && pathname === '/login') {
        console.log('AuthGuard: Session exists, redirecting to home')
        router.push('/')
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [session, pathname, router, isPublicRoute])

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

  // Si estamos en ruta pública, mostrar sin restricciones
  if (isPublicRoute) {
    return <>{children}</>
  }

  // Si no está autenticado y no está en ruta pública, no mostrar nada (ya se redirigió)
  if (!session) {
    return null
  }

  return <>{children}</>
}
