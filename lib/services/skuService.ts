/**
 * SKU Service
 * Handles all SKU-related operations including exclusions
 */

import { getSupabaseClient } from '@/lib/supabase'
import type { SkuExcluido } from '@/lib/types'
import { handleApiError } from '@/lib/utils/errorHandler'
import { SUCCESS_MESSAGES } from '@/lib/constants'

/**
 * Toggle SKU exclusion status
 * If excluded, reactivates it. If active, excludes it.
 */
export async function toggleSkuExclusion(
  sku: string,
  descripcion: string
): Promise<{ message: string; wasExcluded: boolean }> {
  try {
    const supabase = getSupabaseClient()

    // Check if SKU is currently excluded
    const { data: existing, error: checkError } = await supabase
      .from('skus_excluidos')
      .select('*')
      .eq('sku', sku)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows found
      throw checkError
    }

    if (existing) {
      // SKU is excluded, reactivate it
      const { error: deleteError } = await supabase
        .from('skus_excluidos')
        .delete()
        .eq('sku', sku)

      if (deleteError) throw deleteError

      return {
        message: `${SUCCESS_MESSAGES.SKU_REACTIVATED} (${sku})`,
        wasExcluded: false,
      }
    } else {
      // SKU is active, exclude it
      const { error: insertError } = await supabase
        .from('skus_excluidos')
        .insert({
          sku,
          descripcion,
          motivo: 'Excluido desde dashboard',
          excluido_por: 'usuario',
        })

      if (insertError) throw insertError

      return {
        message: `${SUCCESS_MESSAGES.SKU_EXCLUDED} (${sku})`,
        wasExcluded: true,
      }
    }
  } catch (error) {
    throw new Error(handleApiError(error, 'toggle SKU exclusion'))
  }
}

/**
 * Get all excluded SKUs
 */
export async function getExcludedSkus(): Promise<SkuExcluido[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('skus_excluidos')
      .select('*')
      .order('fecha_exclusion', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error) {
    throw new Error(handleApiError(error, 'fetch excluded SKUs'))
  }
}

/**
 * Get excluded SKUs as a Set for quick lookup
 */
export async function getExcludedSkusSet(): Promise<Set<string>> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('skus_excluidos')
      .select('sku')

    if (error) throw error

    return new Set(data?.map((e) => e.sku) || [])
  } catch (error) {
    throw new Error(handleApiError(error, 'fetch excluded SKUs'))
  }
}

/**
 * Exclude multiple SKUs at once
 */
export async function excludeMultipleSkus(
  skus: Array<{ sku: string; descripcion: string }>
): Promise<{ excluded: number; alreadyExcluded: number; message: string }> {
  try {
    const supabase = getSupabaseClient()

    // Get currently excluded SKUs
    const { data: currentlyExcluded } = await supabase
      .from('skus_excluidos')
      .select('sku')
      .in(
        'sku',
        skus.map((s) => s.sku)
      )

    const alreadyExcludedSet = new Set(
      currentlyExcluded?.map((e) => e.sku) || []
    )

    // Filter out already excluded SKUs
    const skusToExclude = skus
      .filter((s) => !alreadyExcludedSet.has(s.sku))
      .map((s) => ({
        sku: s.sku,
        descripcion: s.descripcion,
        motivo: 'Exclusión masiva desde dashboard',
        excluido_por: 'usuario',
      }))

    if (skusToExclude.length === 0) {
      return {
        excluded: 0,
        alreadyExcluded: alreadyExcludedSet.size,
        message: `ℹ️ Todos los SKUs seleccionados ya están excluidos (${alreadyExcludedSet.size})`,
      }
    }

    // Insert new exclusions
    const { error: insertError } = await supabase
      .from('skus_excluidos')
      .insert(skusToExclude)

    if (insertError) throw insertError

    const message =
      alreadyExcludedSet.size > 0
        ? `✅ ${skusToExclude.length} SKU(s) excluidos\nℹ️ ${alreadyExcludedSet.size} ya estaban excluidos`
        : `✅ ${skusToExclude.length} SKU(s) excluidos del análisis`

    return {
      excluded: skusToExclude.length,
      alreadyExcluded: alreadyExcludedSet.size,
      message,
    }
  } catch (error) {
    throw new Error(handleApiError(error, 'exclude multiple SKUs'))
  }
}

/**
 * Reactivate an excluded SKU
 */
export async function reactivateSku(sku: string): Promise<void> {
  try {
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('skus_excluidos')
      .delete()
      .eq('sku', sku)

    if (error) throw error
  } catch (error) {
    throw new Error(handleApiError(error, 'reactivate SKU'))
  }
}

/**
 * Check if a SKU is excluded
 */
export async function isSkuExcluded(sku: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('skus_excluidos')
      .select('sku')
      .eq('sku', sku)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return !!data
  } catch (error) {
    throw new Error(handleApiError(error, 'check SKU exclusion'))
  }
}
