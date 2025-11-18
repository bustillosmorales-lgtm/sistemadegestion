/**
 * Prediction Service
 * Handles all forecasting prediction operations
 */

import { fetchPredicciones } from '@/lib/api-client'
import type { Prediccion, FilterState } from '@/lib/types'
import { handleApiError } from '@/lib/utils/errorHandler'

/**
 * Fetch predictions with optional filters
 */
export async function getPredictions(
  filters?: Partial<FilterState>
): Promise<Prediccion[]> {
  try {
    const params: Record<string, string> = {}

    if (filters?.abc) {
      params.clasificacion_abc = filters.abc
    }

    if (filters?.busqueda) {
      params.sku = filters.busqueda
    }

    const response = await fetchPredicciones(params)

    if (!response.success || !response.data) {
      return []
    }

    return response.data
  } catch (error) {
    throw new Error(handleApiError(error, 'fetch predictions'))
  }
}

/**
 * Filter predictions based on client-side criteria
 */
export function filterPredictions(
  predictions: Prediccion[],
  filters: FilterState,
  excludedSkus: Set<string>
): Prediccion[] {
  let filtered = predictions

  // Filter out excluded SKUs
  filtered = filtered.filter((p) => !excludedSkus.has(p.sku))

  // Filter by alerts if enabled
  if (filters.soloAlertas) {
    filtered = filtered.filter(
      (p) => p.alertas && p.alertas !== '{}' && Object.keys(p.alertas).length > 0
    )
  }

  // Filter by search term (local search for flexibility)
  if (filters.busqueda) {
    const searchTerm = filters.busqueda.toLowerCase()
    filtered = filtered.filter(
      (p) =>
        p.sku?.toLowerCase().includes(searchTerm) ||
        p.descripcion?.toLowerCase().includes(searchTerm)
    )
  }

  return filtered
}

/**
 * Get predictions filtered by excluded SKUs and client filters
 */
export async function getFilteredPredictions(
  filters: FilterState,
  excludedSkus: Set<string>
): Promise<Prediccion[]> {
  const predictions = await getPredictions(filters)
  return filterPredictions(predictions, filters, excludedSkus)
}

/**
 * Calculate summary statistics for predictions
 */
export function calculatePredictionSummary(predictions: Prediccion[]) {
  const totalValue = predictions.reduce(
    (sum, p) => sum + p.valor_total_sugerencia,
    0
  )
  const totalItems = predictions.reduce(
    (sum, p) => sum + p.sugerencia_reposicion,
    0
  )
  const itemsWithAlerts = predictions.filter(
    (p) => p.alertas && p.alertas.length > 0
  ).length
  const itemsWithoutStock = predictions.filter((p) => p.stock_actual <= 0).length

  const byABC = {
    A: predictions.filter((p) => p.clasificacion_abc === 'A').length,
    B: predictions.filter((p) => p.clasificacion_abc === 'B').length,
    C: predictions.filter((p) => p.clasificacion_abc === 'C').length,
  }

  return {
    totalValue,
    totalItems,
    totalProducts: predictions.length,
    itemsWithAlerts,
    itemsWithoutStock,
    byABC,
  }
}

/**
 * Get prediction by SKU
 */
export async function getPredictionBySku(
  sku: string
): Promise<Prediccion | null> {
  try {
    const response = await fetchPredicciones({ sku })

    if (!response.success || !response.data || response.data.length === 0) {
      return null
    }

    return response.data[0]
  } catch (error) {
    throw new Error(handleApiError(error, 'fetch prediction by SKU'))
  }
}

/**
 * Sort predictions by various criteria
 */
export function sortPredictions(
  predictions: Prediccion[],
  sortBy: 'value' | 'sku' | 'stock' | 'alerts' = 'value',
  order: 'asc' | 'desc' = 'desc'
): Prediccion[] {
  const sorted = [...predictions]

  sorted.sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'value':
        comparison = a.valor_total_sugerencia - b.valor_total_sugerencia
        break
      case 'sku':
        comparison = a.sku.localeCompare(b.sku)
        break
      case 'stock':
        comparison = a.dias_stock_actual - b.dias_stock_actual
        break
      case 'alerts':
        comparison = (a.alertas?.length || 0) - (b.alertas?.length || 0)
        break
    }

    return order === 'asc' ? comparison : -comparison
  })

  return sorted
}
