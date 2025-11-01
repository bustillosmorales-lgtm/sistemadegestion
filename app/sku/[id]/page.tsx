'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

export async function generateStaticParams() {
  return []
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Prediccion {
  sku: string
  descripcion: string
  venta_diaria_promedio: number
  venta_diaria_p50: number
  venta_diaria_p75: number
  venta_diaria_p90: number
  desviacion_estandar: number
  coeficiente_variacion: number
  tendencia: string
  tasa_crecimiento_mensual: number
  stock_actual: number
  stock_optimo: number
  stock_seguridad: number
  dias_stock_actual: number
  transito_china: number
  sugerencia_reposicion: number
  sugerencia_reposicion_p75: number
  sugerencia_reposicion_p90: number
  precio_unitario: number
  valor_total_sugerencia: number
  periodo_inicio: string
  periodo_fin: string
  dias_periodo: number
  unidades_totales_periodo: number
  clasificacion_abc: string
  clasificacion_xyz: string
  es_demanda_intermitente: boolean
  modelo_usado: string
  observaciones: string
  alertas: string[]
  mape_backtesting: number | null
  componente_tendencia?: number
  componente_anual?: number
  componente_semanal?: number
  componente_eventos?: number
}

export default function SKUDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sku = params.id as string

  const [prediccion, setPrediccion] = useState<Prediccion | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDetalle()
  }, [sku])

  async function cargarDetalle() {
    setLoading(true)
    try {
      const { data: latest } = await supabase
        .from('predicciones')
        .select('fecha_calculo')
        .order('fecha_calculo', { ascending: false })
        .limit(1)
        .single()

      if (!latest) return

      const { data, error } = await supabase
        .from('predicciones')
        .select('*')
        .eq('sku', sku)
        .eq('fecha_calculo', latest.fecha_calculo)
        .single()

      if (error) throw error

      setPrediccion(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-500 mt-4">Cargando detalles...</p>
      </div>
    )
  }

  if (!prediccion) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No se encontró información para el SKU {sku}</p>
        <Link href="/" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          ← Volver al dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">
            ← Volver al dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{prediccion.sku}</h1>
          {prediccion.descripcion && (
            <p className="text-gray-500 mt-1">{prediccion.descripcion}</p>
          )}
        </div>
        <div className="text-right">
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
            prediccion.clasificacion_abc === 'A' ? 'bg-red-100 text-red-800' :
            prediccion.clasificacion_abc === 'B' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            Clase {prediccion.clasificacion_abc}-{prediccion.clasificacion_xyz}
          </span>
        </div>
      </div>

      {/* Alertas */}
      {prediccion.alertas && prediccion.alertas.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Alertas Activas</h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  {prediccion.alertas.map((alerta, idx) => (
                    <li key={idx}>{alerta}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sugerencia Principal */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-lg font-semibold mb-4">📦 Sugerencia de Compra</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-blue-100 text-sm">Conservadora (P50)</p>
            <p className="text-3xl font-bold">{prediccion.sugerencia_reposicion.toLocaleString('es-CL')}</p>
            <p className="text-blue-100 text-sm mt-1">unidades</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Media (P75)</p>
            <p className="text-3xl font-bold">{prediccion.sugerencia_reposicion_p75.toLocaleString('es-CL')}</p>
            <p className="text-blue-100 text-sm mt-1">unidades</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Pesimista (P90)</p>
            <p className="text-3xl font-bold">{prediccion.sugerencia_reposicion_p90.toLocaleString('es-CL')}</p>
            <p className="text-blue-100 text-sm mt-1">unidades</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-400">
          <p className="text-lg">
            Valor Total: <span className="font-bold">${prediccion.valor_total_sugerencia.toLocaleString('es-CL')}</span>
          </p>
        </div>
      </div>

      {/* Métricas de Venta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Venta Diaria</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Promedio:</span>
              <span className="font-semibold">{prediccion.venta_diaria_promedio.toFixed(2)} un/día</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">P50 (Mediana):</span>
              <span className="font-semibold">{prediccion.venta_diaria_p50.toFixed(2)} un/día</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">P90 (Pesimista):</span>
              <span className="font-semibold">{prediccion.venta_diaria_p90.toFixed(2)} un/día</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Desviación estándar:</span>
              <span className="font-semibold">{prediccion.desviacion_estandar.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Variabilidad (CV):</span>
              <span className={`font-semibold ${
                prediccion.coeficiente_variacion < 0.5 ? 'text-green-600' :
                prediccion.coeficiente_variacion < 1.0 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {(prediccion.coeficiente_variacion * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Stock Actual</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Stock en Chile:</span>
              <span className="font-semibold">{prediccion.stock_actual.toLocaleString('es-CL')} un</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Días de stock:</span>
              <span className={`font-semibold ${
                prediccion.dias_stock_actual < 60 ? 'text-red-600' :
                prediccion.dias_stock_actual < 120 ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {prediccion.dias_stock_actual.toFixed(0)} días
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tránsito China:</span>
              <span className="font-semibold">{prediccion.transito_china.toLocaleString('es-CL')} un</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Stock óptimo:</span>
              <span className="font-semibold">{prediccion.stock_optimo.toLocaleString('es-CL')} un</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Stock seguridad:</span>
              <span className="font-semibold text-blue-600">{prediccion.stock_seguridad.toLocaleString('es-CL')} un</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tendencia y Modelo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📉 Tendencia</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Estado:</span>
              <span className="flex items-center font-semibold">
                {prediccion.tendencia === 'creciente' ? '📈' : prediccion.tendencia === 'decreciente' ? '📉' : '➡️'}
                <span className="ml-2 capitalize">{prediccion.tendencia}</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Crecimiento mensual:</span>
              <span className={`font-semibold ${
                prediccion.tasa_crecimiento_mensual > 0 ? 'text-green-600' :
                prediccion.tasa_crecimiento_mensual < 0 ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {prediccion.tasa_crecimiento_mensual > 0 ? '+' : ''}
                {prediccion.tasa_crecimiento_mensual.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Demanda intermitente:</span>
              <span className="font-semibold">{prediccion.es_demanda_intermitente ? 'Sí' : 'No'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🤖 Modelo & Datos</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Modelo usado:</span>
              <span className="font-semibold uppercase">{prediccion.modelo_usado}</span>
            </div>
            {prediccion.mape_backtesting !== null && (
              <div className="flex justify-between">
                <span className="text-gray-600">Accuracy (MAPE):</span>
                <span className={`font-semibold ${
                  prediccion.mape_backtesting < 10 ? 'text-green-600' :
                  prediccion.mape_backtesting < 20 ? 'text-blue-600' :
                  prediccion.mape_backtesting < 30 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {prediccion.mape_backtesting.toFixed(1)}%
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Periodo analizado:</span>
              <span className="font-semibold">{prediccion.dias_periodo} días</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Unidades vendidas:</span>
              <span className="font-semibold">{prediccion.unidades_totales_periodo.toLocaleString('es-CL')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Componentes Prophet (si existe) */}
      {(prediccion.componente_tendencia || prediccion.componente_anual || prediccion.componente_semanal || prediccion.componente_eventos) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🔬 Componentes de Predicción (Prophet)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {prediccion.componente_tendencia !== undefined && (
              <div className="text-center">
                <p className="text-gray-600 text-sm">Tendencia</p>
                <p className="text-2xl font-bold text-gray-900">{prediccion.componente_tendencia.toFixed(1)}</p>
              </div>
            )}
            {prediccion.componente_anual !== undefined && (
              <div className="text-center">
                <p className="text-gray-600 text-sm">Anual (estacional)</p>
                <p className={`text-2xl font-bold ${prediccion.componente_anual > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {prediccion.componente_anual > 0 ? '+' : ''}{prediccion.componente_anual.toFixed(1)}
                </p>
              </div>
            )}
            {prediccion.componente_semanal !== undefined && (
              <div className="text-center">
                <p className="text-gray-600 text-sm">Semanal</p>
                <p className="text-2xl font-bold text-gray-900">{prediccion.componente_semanal.toFixed(1)}</p>
              </div>
            )}
            {prediccion.componente_eventos !== undefined && (
              <div className="text-center">
                <p className="text-gray-600 text-sm">Eventos especiales</p>
                <p className="text-2xl font-bold text-purple-600">{prediccion.componente_eventos.toFixed(1)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Observaciones */}
      {prediccion.observaciones && (
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">📝 Observaciones</h3>
          <p className="text-gray-700">{prediccion.observaciones}</p>
        </div>
      )}
    </div>
  )
}
