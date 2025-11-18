/**
 * Cotización Service
 * Handles all quotation-related operations
 */

import {
  fetchCotizaciones,
  createCotizacion,
  updateCotizacion,
  deleteCotizacion,
} from '@/lib/api-client'
import type { Cotizacion, CotizacionFilterState } from '@/lib/types'
import { handleApiError } from '@/lib/utils/errorHandler'
import { SUCCESS_MESSAGES } from '@/lib/constants'

/**
 * Get cotizaciones with optional filters
 */
export async function getCotizaciones(
  filters?: Partial<CotizacionFilterState>
): Promise<Cotizacion[]> {
  try {
    const params: Record<string, string> = {}

    if (filters?.estado) {
      params.estado = filters.estado
    }

    if (filters?.proveedor) {
      params.proveedor = filters.proveedor
    }

    if (filters?.busqueda) {
      params.sku = filters.busqueda
    }

    const response = await fetchCotizaciones(params)

    if (!response.success) {
      return []
    }

    return response.cotizaciones || []
  } catch (error) {
    throw new Error(handleApiError(error, 'fetch cotizaciones'))
  }
}

/**
 * Create a new cotización
 */
export async function createNewCotizacion(data: {
  sku: string
  descripcion: string
  cantidad: number
  proveedor: string
  observaciones?: string
}): Promise<{ success: boolean; message: string }> {
  try {
    const response = await createCotizacion(data)

    if (!response.success) {
      throw new Error(response.error || 'Error creating cotización')
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.CREATED,
    }
  } catch (error) {
    throw new Error(handleApiError(error, 'create cotización'))
  }
}

/**
 * Update an existing cotización
 */
export async function updateExistingCotizacion(
  id: number,
  updates: Partial<Cotizacion>
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await updateCotizacion(id, updates)

    if (!response.success) {
      throw new Error(response.error || 'Error updating cotización')
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.UPDATED,
    }
  } catch (error) {
    throw new Error(handleApiError(error, 'update cotización'))
  }
}

/**
 * Delete a cotización
 */
export async function deleteExistingCotizacion(
  id: number
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await deleteCotizacion(id)

    if (!response.success) {
      throw new Error(response.error || 'Error deleting cotización')
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.DELETED,
    }
  } catch (error) {
    throw new Error(handleApiError(error, 'delete cotización'))
  }
}

/**
 * Filter cotizaciones on the client side
 */
export function filterCotizaciones(
  cotizaciones: Cotizacion[],
  filters: CotizacionFilterState
): Cotizacion[] {
  let filtered = cotizaciones

  if (filters.estado) {
    filtered = filtered.filter((c) => c.estado === filters.estado)
  }

  if (filters.proveedor) {
    filtered = filtered.filter((c) => c.proveedor === filters.proveedor)
  }

  if (filters.busqueda) {
    const searchTerm = filters.busqueda.toLowerCase()
    filtered = filtered.filter(
      (c) =>
        c.sku?.toLowerCase().includes(searchTerm) ||
        c.descripcion?.toLowerCase().includes(searchTerm)
    )
  }

  return filtered
}

/**
 * Calculate summary statistics for cotizaciones
 */
export function calculateCotizacionSummary(cotizaciones: Cotizacion[]) {
  const pending = cotizaciones.filter((c) => c.estado === 'pendiente').length
  const responded = cotizaciones.filter((c) => c.estado === 'respondida').length
  const approved = cotizaciones.filter((c) => c.estado === 'aprobada').length
  const rejected = cotizaciones.filter((c) => c.estado === 'rechazada').length

  const totalValue = cotizaciones.reduce((sum, c) => {
    const price = c.precio_unitario || 0
    const quantity = c.cantidad || 0
    return sum + price * quantity
  }, 0)

  return {
    total: cotizaciones.length,
    pending,
    responded,
    approved,
    rejected,
    totalValue,
  }
}

/**
 * Get unique providers from cotizaciones
 */
export function getUniqueProviders(cotizaciones: Cotizacion[]): string[] {
  const providers = new Set<string>()

  cotizaciones.forEach((c) => {
    if (c.proveedor) {
      providers.add(c.proveedor)
    }
  })

  return Array.from(providers).sort()
}

/**
 * Sort cotizaciones by various criteria
 */
export function sortCotizaciones(
  cotizaciones: Cotizacion[],
  sortBy: 'date' | 'sku' | 'estado' | 'proveedor' = 'date',
  order: 'asc' | 'desc' = 'desc'
): Cotizacion[] {
  const sorted = [...cotizaciones]

  sorted.sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'date':
        comparison =
          new Date(a.fecha_creacion).getTime() -
          new Date(b.fecha_creacion).getTime()
        break
      case 'sku':
        comparison = a.sku.localeCompare(b.sku)
        break
      case 'estado':
        comparison = a.estado.localeCompare(b.estado)
        break
      case 'proveedor':
        comparison = (a.proveedor || '').localeCompare(b.proveedor || '')
        break
    }

    return order === 'asc' ? comparison : -comparison
  })

  return sorted
}
