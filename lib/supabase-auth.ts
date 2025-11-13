/**
 * Cliente de Supabase con soporte para autenticación SSR
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Helper para verificar si el usuario está autenticado
export async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Helper para cerrar sesión
export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}
