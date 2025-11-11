'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import StatsCards from '@/components/StatsCards'
import PrediccionesTable from '@/components/PrediccionesTable'
import Filtros from '@/components/Filtros'
import UploadExcel from '@/components/UploadExcel'

interface Prediccion {
  id: number
  sku: string
  venta_diaria_p50: number
  stock_actual: number
  dias_stock_actual: number
  sugerencia_reposicion: number
  valor_total_sugerencia: number
  clasificacion_abc: string
  clasificacion_xyz: string
  tendencia: string
  alertas: string[]
  mape_backtesting: number | null
}

export default function Home() {
  const [predicciones, setPredicciones] = useState<Prediccion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    abc: '',
    busqueda: '',
    soloAlertas: false
  })

  useEffect(() => {
    cargarPredicciones()
  }, [filtros])

  async function cargarPredicciones() {
    setLoading(true)
    try {
      // Obtener última fecha de cálculo
      const { data: latestArray, error: latestError } = await supabase
        .from('predicciones')
        .select('fecha_calculo')
        .order('fecha_calculo', { ascending: false })
        .limit(1)

      // Si hay error o no hay datos, salir temprano
      if (latestError || !latestArray || latestArray.length === 0) {
        setPredicciones([])
        setLoading(false)
        return
      }

      const latest = latestArray[0]

      // Query con filtros
      let query = supabase
        .from('predicciones')
        .select('*')
        .eq('fecha_calculo', latest.fecha_calculo)
        .order('valor_total_sugerencia', { ascending: false })

      // Aplicar filtros
      if (filtros.abc) {
        query = query.eq('clasificacion_abc', filtros.abc)
      }

      if (filtros.busqueda) {
        query = query.ilike('sku', `%${filtros.busqueda}%`)
      }

      const { data, error } = await query.limit(100)

      if (error) throw error

      let resultados = data || []

      // Filtrar por alertas en cliente (Supabase no soporta array contains fácilmente)
      if (filtros.soloAlertas) {
        resultados = resultados.filter((p: Prediccion) => p.alertas && p.alertas.length > 0)
      }

      setPredicciones(resultados)
    } catch (error) {
      console.error('Error cargando predicciones:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Excel */}
      <UploadExcel />

      {/* Stats Cards */}
      <StatsCards predicciones={predicciones} />

      {/* Filtros */}
      <Filtros filtros={filtros} setFiltros={setFiltros} />

      {/* Tabla de Predicciones */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Sugerencias de Reposición
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {predicciones.length} productos · Ordenados por valor
          </p>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Cargando predicciones...</p>
          </div>
        ) : predicciones.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No se encontraron predicciones.</p>
            <p className="text-sm text-gray-400 mt-2">
              Ejecuta el forecasting en GitHub Actions para generar datos.
            </p>
          </div>
        ) : (
          <PrediccionesTable predicciones={predicciones} />
        )}
      </div>
    </div>
  )
}
