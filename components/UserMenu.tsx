'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export function UserMenu() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    // Usar window.location para recarga completa y asegurar propagación de logout
    window.location.href = '/login'
  }

  if (!user) return null

  return (
    <div className="flex items-center space-x-4">
      <span className="text-sm text-gray-700">
        {user.email}
      </span>
      <button
        onClick={handleSignOut}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
