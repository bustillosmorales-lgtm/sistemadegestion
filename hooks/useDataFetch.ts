/**
 * useDataFetch Hook
 * Reusable hook for fetching and managing data with loading and error states
 */

import { useState, useEffect, useCallback } from 'react'
import { handleApiError } from '@/lib/utils/errorHandler'

interface UseDataFetchOptions {
  /** Whether to fetch data immediately on mount */
  immediate?: boolean
  /** Error handler callback */
  onError?: (error: Error) => void
  /** Success handler callback */
  onSuccess?: (data: any) => void
}

interface UseDataFetchReturn<T> {
  /** The fetched data */
  data: T | null
  /** Loading state */
  loading: boolean
  /** Error state */
  error: Error | null
  /** Manually trigger a refresh */
  refresh: () => Promise<void>
  /** Set data manually */
  setData: (data: T | null) => void
}

/**
 * Generic hook for data fetching with automatic loading and error states
 *
 * @example
 * const { data, loading, error, refresh } = useDataFetch(
 *   async () => fetchCotizaciones({ estado: 'pendiente' }),
 *   [estado]
 * )
 */
export function useDataFetch<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = [],
  options: UseDataFetchOptions = {}
): UseDataFetchReturn<T> {
  const { immediate = true, onError, onSuccess } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchFn()
      setData(result)
      setError(null)

      if (onSuccess) {
        onSuccess(result)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setData(null)

      if (onError) {
        onError(error)
      } else {
        console.error('Data fetch error:', error)
      }
    } finally {
      setLoading(false)
    }
  }, [fetchFn, onError, onSuccess])

  useEffect(() => {
    if (immediate) {
      refresh()
    }
  }, [refresh, immediate, ...deps])

  return {
    data,
    loading,
    error,
    refresh,
    setData,
  }
}

/**
 * Hook for fetching data with manual trigger (not immediate)
 *
 * @example
 * const { data, loading, execute } = useLazyDataFetch(
 *   async (id: string) => fetchCotizacion(id)
 * )
 *
 * // Later...
 * execute(cotizacionId)
 */
export function useLazyDataFetch<T, Args extends any[] = []>(
  fetchFn: (...args: Args) => Promise<T>
): UseDataFetchReturn<T> & { execute: (...args: Args) => Promise<void> } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(
    async (...args: Args) => {
      setLoading(true)
      setError(null)

      try {
        const result = await fetchFn(...args)
        setData(result)
        setError(null)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        setData(null)
        console.error('Data fetch error:', error)
      } finally {
        setLoading(false)
      }
    },
    [fetchFn]
  )

  const refresh = useCallback(async () => {
    // For lazy fetch, refresh is not applicable without args
    console.warn('refresh() is not supported for useLazyDataFetch. Use execute() instead.')
  }, [])

  return {
    data,
    loading,
    error,
    refresh,
    execute,
    setData,
  }
}
