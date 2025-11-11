'use client'

import { SupabaseProvider } from '@/lib/SupabaseProvider'

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseProvider>
      {children}
    </SupabaseProvider>
  )
}
