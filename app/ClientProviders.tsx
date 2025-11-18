'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { SupabaseProvider } from '@/lib/SupabaseProvider'
import { useState } from 'react'

export function ClientProviders({ children }: { children: React.ReactNode }) {
  // Create QueryClient instance - using useState to ensure it's only created once
  // No cache: staleTime: 0, cacheTime: 0 for fresh data always
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0, // Data is immediately stale
        gcTime: 0, // No caching (was cacheTime in v4)
        retry: 1,
        refetchOnWindowFocus: true, // Refetch when window regains focus
        refetchOnMount: true, // Always refetch on mount
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </SupabaseProvider>
    </QueryClientProvider>
  )
}
