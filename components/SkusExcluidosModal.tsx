'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

interface SkuExcluido {
  id: number
  sku: string
  descripcion: string | null
  motivo: string | null
  excluido_por: string | null
  fecha_exclusion: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onReactivar?: () => void
}

export default function SkusExcluidosModal({ isOpen, onClose, onReactivar }: Props) {
  const [skus, setSkus] = useState<SkuExcluido[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      cargarSkusExcluidos()
    }
  }, [isOpen])

  async function cargarSkusExcluidos() {
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('skus_excluidos')
        .select('*')
        .order('fecha_exclusion', { ascending: false })

      if (error) throw error

      setSkus(data || [])
    } catch (error: any) {
      console.error('Error cargando SKUs excluidos:', error)
      alert('Error cargando SKUs excluidos: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function reactivarSku(sku: string) {
    if (!confirm(`¿Reactivar SKU ${sku} en el análisis?`)) return

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('skus_excluidos')
        .delete()
        .eq('sku', sku)

      if (error) throw error

      alert(`✅ SKU ${sku} reactivado`)
      await cargarSkusExcluidos()
      if (onReactivar) onReactivar()
    } catch (error: any) {
      console.error('Error reactivando SKU:', error)
      alert('Error reactivando SKU: ' + error.message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">🚫 SKUs Excluidos del Análisis</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Estos SKUs no se incluyen en los cálculos de forecasting
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-gray-500">Cargando SKUs excluidos...</div>
            </div>
          ) : skus.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No hay SKUs excluidos.</p>
              <p className="text-sm text-gray-500">
                Usa el checkbox en la tabla principal para excluir SKUs del análisis.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Motivo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Exclusión
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {skus.map((sku) => (
                    <tr key={sku.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {sku.sku}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {sku.descripcion || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {sku.motivo || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(sku.fecha_exclusion).toLocaleDateString('es-CL')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => reactivarSku(sku.sku)}
                          className="text-green-600 hover:text-green-800 font-medium text-sm"
                        >
                          ✓ Reactivar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Total: {skus.length} SKU{skus.length !== 1 ? 's' : ''} excluido{skus.length !== 1 ? 's' : ''}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
