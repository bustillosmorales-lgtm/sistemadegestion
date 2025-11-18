/**
 * Defontana Sales Sync Component
 * Allows users to sync sales data from Defontana
 */

'use client'

import { useState } from 'react'
import { useDefontanaSync } from '@/hooks/useQueries'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { showSuccess, showError, showInfo } from '@/lib/utils/toast'

export default function DefontanaSync() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const defontanaSync = useDefontanaSync()

  // Set default dates: last 30 days
  useState(() => {
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)

    setEndDate(today.toISOString().split('T')[0])
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0])
  })

  const handleSync = async () => {
    if (!startDate || !endDate) {
      showError('Por favor selecciona un rango de fechas')
      return
    }

    showInfo('Sincronizando ventas desde Defontana...')

    try {
      const result = await defontanaSync.mutateAsync({ startDate, endDate })

      showSuccess(
        `✅ ${result.salesImported} ventas importadas exitosamente\n` +
        `${result.skusUpdated} SKUs actualizados\n` +
        `Tiempo: ${result.timeElapsed}`
      )
    } catch (error: any) {
      showError(`Error al sincronizar: ${error.message}`)
    }
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">
        🔄 Sincronizar Ventas desde Defontana
      </h3>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <Button
          onClick={handleSync}
          disabled={defontanaSync.isPending || !startDate || !endDate}
          className="w-full"
        >
          {defontanaSync.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sincronizando...
            </>
          ) : (
            '🔄 Sincronizar Ventas'
          )}
        </Button>

        {defontanaSync.isSuccess && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              Última sincronización exitosa
            </p>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          <p className="font-medium mb-2">ℹ️ Información:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Las ventas se sincronizarán automáticamente en la base de datos</li>
            <li>Los datos duplicados serán ignorados automáticamente</li>
            <li>Las predicciones se actualizarán con los nuevos datos</li>
            <li>Recomendado: Sincronizar diariamente para mejores resultados</li>
          </ul>
        </div>
      </div>
    </Card>
  )
}
