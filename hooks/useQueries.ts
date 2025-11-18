/**
 * React Query hooks for data fetching
 * No caching - always fresh data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPredicciones, fetchCotizaciones } from '@/lib/api-client'
import { getSupabaseClient } from '@/lib/supabase'
import type { Prediccion } from '@/lib/types'

/**
 * Hook to fetch predicciones with React Query (simple version)
 */
export function usePredicciones(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['predicciones', params],
    queryFn: () => fetchPredicciones(params || {}),
    select: (data) => data.data || [],
  })
}

/**
 * Hook to fetch predicciones with filtering (advanced version)
 * Includes SKUs excluded and client-side filtering
 */
export function usePrediccionesWithFilters(
  filtros: { abc: string; busqueda: string; soloAlertas: boolean }
) {
  const supabase = getSupabaseClient()

  return useQuery({
    queryKey: ['predicciones-filtered', filtros],
    queryFn: async () => {
      // 1. Obtener SKUs excluidos
      const { data: skusExcluidosData } = await supabase
        .from('skus_excluidos')
        .select('sku')

      const skusExcluidosSet = new Set(skusExcluidosData?.map(e => e.sku) || [])

      // 2. Preparar params para la API
      const params: Record<string, string> = {}

      if (filtros.abc) {
        params.clasificacion_abc = filtros.abc
      }

      if (filtros.busqueda) {
        params.sku = filtros.busqueda
      }

      // 3. Fetch de la API
      const response = await fetchPredicciones(params)

      if (!response.success || !response.data) {
        return []
      }

      let prediccionesFiltradas = response.data

      // 4. Aplicar filtros en cliente
      // Filtrar SKUs excluidos
      prediccionesFiltradas = prediccionesFiltradas.filter((p: Prediccion) =>
        !skusExcluidosSet.has(p.sku)
      )

      // Filtrar solo alertas si está activado
      if (filtros.soloAlertas) {
        prediccionesFiltradas = prediccionesFiltradas.filter((p: Prediccion) =>
          p.alertas && p.alertas !== '{}' && Object.keys(p.alertas).length > 0
        )
      }

      // Filtrar por búsqueda (búsqueda local más flexible)
      if (filtros.busqueda) {
        prediccionesFiltradas = prediccionesFiltradas.filter((p: Prediccion) =>
          p.sku?.toLowerCase().includes(filtros.busqueda.toLowerCase())
        )
      }

      return prediccionesFiltradas
    },
  })
}

/**
 * Hook to fetch cotizaciones with React Query
 */
export function useCotizaciones(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['cotizaciones', params],
    queryFn: () => fetchCotizaciones(params || {}),
    select: (data) => data.cotizaciones || [],
  })
}

/**
 * Hook to sync Defontana sales
 */
export function useDefontanaSync() {
  const queryClient = useQueryClient()
  const supabase = getSupabaseClient()

  return useMutation({
    mutationFn: async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
      // Get auth token from Supabase
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        throw new Error('No estás autenticado. Por favor inicia sesión.')
      }

      const response = await fetch('/.netlify/functions/defontana-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ dateFrom: startDate, dateTo: endDate }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error syncing Defontana sales')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate predicciones query to refetch after sync
      queryClient.invalidateQueries({ queryKey: ['predicciones'] })
    },
  })
}
