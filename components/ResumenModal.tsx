'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/lib/SupabaseProvider'

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface Prediccion {
  sugerencia_reposicion: number
  valor_total_sugerencia: number
  alertas: string[]
  clasificacion_abc: string
}

export default function ResumenModal({ isOpen, onClose }: Props) {
  const supabase = useSupabase()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    totalSugerencias: 0,
    totalValor: 0,
    totalAlertas: 0,
    skusClaseA: 0,
    totalProductos: 0
  })

  useEffect(() => {
    if (isOpen) {
      cargarResumen()
    }
  }, [isOpen])

  async function cargarResumen() {
    setLoading(true)
    try {
      // Obtener última fecha de cálculo
      const { data: latestArray } = await supabase
        .from('predicciones')
        .select('fecha_calculo')
        .order('fecha_calculo', { ascending: false })
        .limit(1)

      if (!latestArray || latestArray.length === 0) {
        setStats({
          totalSugerencias: 0,
          totalValor: 0,
          totalAlertas: 0,
          skusClaseA: 0,
          totalProductos: 0
        })
        return
      }

      const latest = latestArray[0]

      // Cargar TODAS las predicciones para calcular stats
      const { data: predicciones } = await supabase
        .from('predicciones')
        .select('sugerencia_reposicion, valor_total_sugerencia, alertas, clasificacion_abc')
        .eq('fecha_calculo', latest.fecha_calculo)

      if (predicciones) {
        const totalSugerencias = predicciones.reduce((sum: number, p: Prediccion) =>
          sum + (p.sugerencia_reposicion || 0), 0
        )
        const totalValor = predicciones.reduce((sum: number, p: Prediccion) =>
          sum + (p.valor_total_sugerencia || 0), 0
        )
        const totalAlertas = predicciones.filter((p: Prediccion) =>
          p.alertas && p.alertas.length > 0
        ).length
        const skusClaseA = predicciones.filter((p: Prediccion) =>
          p.clasificacion_abc === 'A'
        ).length

        setStats({
          totalSugerencias,
          totalValor,
          totalAlertas,
          skusClaseA,
          totalProductos: predicciones.length
        })
      }
    } catch (error) {
      console.error('Error cargando resumen:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const statsData = [
    {
      name: 'Total a Comprar',
      value: stats.totalSugerencias.toLocaleString('es-CL'),
      unit: 'unidades',
      icon: '📦',
      color: 'bg-blue-50 border-blue-200 text-blue-700'
    },
    {
      name: 'Valor Total',
      value: `$${(stats.totalValor / 1000000).toFixed(1)}M`,
      unit: 'CLP',
      icon: '💰',
      color: 'bg-green-50 border-green-200 text-green-700'
    },
    {
      name: 'Alertas Activas',
      value: stats.totalAlertas.toLocaleString('es-CL'),
      unit: 'productos',
      icon: '⚠️',
      color: 'bg-red-50 border-red-200 text-red-700'
    },
    {
      name: 'Productos Clase A',
      value: stats.skusClaseA.toLocaleString('es-CL'),
      unit: 'alta prioridad',
      icon: '⭐',
      color: 'bg-purple-50 border-purple-200 text-purple-700'
    }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">📊 Resumen Gerencial</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              disabled={loading}
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Vista general de inventario y recomendaciones de compra
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Generando resumen...</p>
                <p className="text-sm text-gray-400 mt-2">
                  Analizando {stats.totalProductos || '...'} productos
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {statsData.map((stat) => (
                  <div
                    key={stat.name}
                    className={`border rounded-lg p-4 ${stat.color}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium opacity-80">
                          {stat.name}
                        </p>
                        <p className="mt-2 text-3xl font-bold">
                          {stat.value}
                        </p>
                        <p className="text-xs opacity-70 mt-1">
                          {stat.unit}
                        </p>
                      </div>
                      <div className="text-4xl opacity-50">
                        {stat.icon}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info adicional */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">📈 Información Adicional</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>Total de productos analizados:</span>
                    <span className="font-semibold">{stats.totalProductos}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Productos con alertas:</span>
                    <span className="font-semibold text-red-600">
                      {stats.totalAlertas} ({stats.totalProductos > 0 ? ((stats.totalAlertas / stats.totalProductos) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Productos Clase A:</span>
                    <span className="font-semibold text-purple-600">
                      {stats.skusClaseA} ({stats.totalProductos > 0 ? ((stats.skusClaseA / stats.totalProductos) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor promedio por unidad:</span>
                    <span className="font-semibold">
                      ${stats.totalSugerencias > 0 ? (stats.totalValor / stats.totalSugerencias).toLocaleString('es-CL', { maximumFractionDigits: 0 }) : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={loading}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
