'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/lib/SupabaseProvider'
import StatsCards from '@/components/StatsCards'
import PrediccionesTable from '@/components/PrediccionesTable'
import Filtros from '@/components/Filtros'
import UploadExcel from '@/components/UploadExcel'
import ConfiguracionModal from '@/components/ConfiguracionModal'
import SkusExcluidosModal from '@/components/SkusExcluidosModal'

interface Prediccion {
  id: number
  sku: string
  descripcion: string
  venta_diaria_p50: number
  stock_actual: number
  stock_optimo: number
  dias_stock_actual: number
  transito_china: number
  sugerencia_reposicion: number
  valor_total_sugerencia: number
  precio_unitario: number
  coeficiente_variacion: number
  clasificacion_abc: string
  clasificacion_xyz: string
  tendencia: string
  modelo_usado: string
  alertas: string[]
  mape_backtesting: number | null
}

export default function Home() {
  const supabase = useSupabase()
  const [predicciones, setPredicciones] = useState<Prediccion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    abc: '',
    busqueda: '',
    soloAlertas: false
  })
  const [configuracionOpen, setConfiguracionOpen] = useState(false)
  const [excluidosOpen, setExcluidosOpen] = useState(false)

  useEffect(() => {
    cargarPredicciones()
  }, [filtros])

  async function exportarAExcel() {
    try {
      // Importar xlsx dinámicamente (solo en cliente)
      const XLSX = await import('xlsx')

      // Preparar datos para Excel
      const datosExcel = predicciones.map(p => ({
        'SKU': p.sku,
        'Descripción': p.descripcion || '',
        'Clase': `${p.clasificacion_abc}-${p.clasificacion_xyz}`,
        'Venta Diaria': p.venta_diaria_p50.toFixed(1),
        'Precio Unitario': p.precio_unitario,
        'Stock Actual': p.stock_actual,
        'Stock Óptimo': p.stock_optimo,
        'Días Stock': p.dias_stock_actual.toFixed(0),
        'Tránsito China': p.transito_china,
        'Sugerencia Reposición': p.sugerencia_reposicion,
        'Valor Total Sugerencia': p.valor_total_sugerencia,
        'Coef. Variación': p.coeficiente_variacion.toFixed(2),
        'Tendencia': p.tendencia,
        'Modelo': p.modelo_usado,
        'Alertas': p.alertas ? p.alertas.join(', ') : '',
        'MAPE %': p.mape_backtesting ? p.mape_backtesting.toFixed(1) : ''
      }))

      // Crear libro de Excel
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(datosExcel)

      // Ajustar ancho de columnas
      const colWidths = [
        { wch: 15 }, // SKU
        { wch: 40 }, // Descripción
        { wch: 8 },  // Clase
        { wch: 12 }, // Venta Diaria
        { wch: 15 }, // Precio
        { wch: 12 }, // Stock Actual
        { wch: 12 }, // Stock Óptimo
        { wch: 12 }, // Días Stock
        { wch: 12 }, // Tránsito
        { wch: 18 }, // Sugerencia
        { wch: 18 }, // Valor Total
        { wch: 12 }, // CV
        { wch: 12 }, // Tendencia
        { wch: 12 }, // Modelo
        { wch: 30 }, // Alertas
        { wch: 10 }  // MAPE
      ]
      ws['!cols'] = colWidths

      // Agregar hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, 'Predicciones')

      // Descargar archivo
      const fecha = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `Forecasting_${fecha}.xlsx`)

      alert('✅ Dashboard exportado a Excel correctamente')
    } catch (error: any) {
      console.error('Error exportando a Excel:', error)
      alert('Error al exportar a Excel: ' + error.message)
    }
  }

  async function handleExcludeToggle(sku: string, descripcion: string) {
    try {
      // Verificar si ya está excluido
      const { data: existing, error: checkError } = await supabase
        .from('skus_excluidos')
        .select('*')
        .eq('sku', sku)
        .single()

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw checkError
      }

      if (existing) {
        // Si existe, eliminarlo (reactivar)
        const { error: deleteError } = await supabase
          .from('skus_excluidos')
          .delete()
          .eq('sku', sku)

        if (deleteError) throw deleteError
        alert(`✅ SKU ${sku} reactivado en el análisis`)
      } else {
        // Si no existe, agregarlo (excluir)
        const { error: insertError } = await supabase
          .from('skus_excluidos')
          .insert({
            sku,
            descripcion,
            motivo: 'Excluido desde dashboard',
            excluido_por: 'usuario'
          })

        if (insertError) throw insertError
        alert(`⚠️ SKU ${sku} excluido del análisis`)
      }

      // Recargar predicciones
      await cargarPredicciones()
    } catch (error: any) {
      console.error('Error toggle exclusión:', error)
      alert('Error al cambiar estado de exclusión: ' + error.message)
    }
  }

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

      const { data, error } = await query.limit(5000)

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
      {/* Barra de acciones superior */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <UploadExcel />
        <div className="flex gap-2">
          <button
            onClick={exportarAExcel}
            className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
            disabled={predicciones.length === 0}
          >
            📊 Exportar Excel
          </button>
          <button
            onClick={() => setExcluidosOpen(true)}
            className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            🚫 SKUs Excluidos
          </button>
          <button
            onClick={() => setConfiguracionOpen(true)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            ⚙️ Configuración
          </button>
        </div>
      </div>

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
          <PrediccionesTable predicciones={predicciones} onExcludeToggle={handleExcludeToggle} />
        )}
      </div>

      {/* Modal de Configuración */}
      <ConfiguracionModal
        isOpen={configuracionOpen}
        onClose={() => setConfiguracionOpen(false)}
      />

      {/* Modal de SKUs Excluidos */}
      <SkusExcluidosModal
        isOpen={excluidosOpen}
        onClose={() => setExcluidosOpen(false)}
        onReactivar={cargarPredicciones}
      />
    </div>
  )
}
