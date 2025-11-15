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

  // Pre-cargar datos de modales para apertura instantánea
  const [configuraciones, setConfiguraciones] = useState<any[]>([])
  const [skusExcluidos, setSkusExcluidos] = useState<any[]>([])
  const [loadingModalData, setLoadingModalData] = useState(true)

  useEffect(() => {
    cargarPredicciones()
  }, [filtros])

  // Pre-cargar datos de modales al montar el componente
  useEffect(() => {
    cargarDatosModales()
  }, [])

  async function cargarDatosModales() {
    setLoadingModalData(true)
    try {
      // Cargar configuraciones y SKUs excluidos en paralelo
      const [configData, excluidosData] = await Promise.all([
        supabase.from('configuracion_sistema').select('*').order('clave'),
        supabase.from('skus_excluidos').select('*').order('fecha_exclusion', { ascending: false })
      ])

      if (configData.data) setConfiguraciones(configData.data)
      if (excluidosData.data) setSkusExcluidos(excluidosData.data)
    } catch (error) {
      console.error('Error pre-cargando datos de modales:', error)
    } finally {
      setLoadingModalData(false)
    }
  }

  async function exportarAExcel() {
    try {
      // Mostrar mensaje de carga
      const loadingMessage = 'Exportando datos... Por favor espera.'
      console.log(loadingMessage)

      // Importar xlsx y fetchDatosBD dinámicamente
      const XLSX = await import('xlsx')
      const { fetchDatosBD } = await import('@/lib/api-client')

      // 1. Preparar datos de predicciones
      const datosPredicciones = predicciones.map(p => ({
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

      // 2. Obtener datos de la BD para validación
      console.log('Obteniendo datos de ventas...')
      const ventasResponse = await fetchDatosBD('ventas')
      const datosVentas = ventasResponse.data.map((v: any) => ({
        'Empresa': v.empresa,
        'Canal': v.canal,
        'Fecha': v.fecha,
        'SKU': v.sku,
        'MLC': v.mlc || '',
        'Descripción': v.descripcion || '',
        'Unidades': v.unidades,
        'Precio': v.precio
      }))

      console.log('Obteniendo datos de stock...')
      const stockResponse = await fetchDatosBD('stock')
      const datosStock = stockResponse.data.map((s: any) => ({
        'SKU': s.sku,
        'Descripción': s.descripcion || '',
        'Bodega C': s.bodega_c || 0,
        'Bodega D': s.bodega_d || 0,
        'Bodega E': s.bodega_e || 0,
        'Bodega F': s.bodega_f || 0,
        'Bodega H': s.bodega_h || 0,
        'Bodega J': s.bodega_j || 0
      }))

      console.log('Obteniendo datos de tránsito...')
      const transitoResponse = await fetchDatosBD('transito')
      const datosTransito = transitoResponse.data.map((t: any) => ({
        'SKU': t.sku,
        'Unidades': t.unidades,
        'Estado': t.estado
      }))

      console.log('Obteniendo datos de compras...')
      const comprasResponse = await fetchDatosBD('compras')
      const datosCompras = comprasResponse.data.map((c: any) => ({
        'SKU': c.sku,
        'Fecha Compra': c.fecha_compra
      }))

      console.log('Obteniendo datos de packs...')
      const packsResponse = await fetchDatosBD('packs')
      const datosPacks = packsResponse.data.map((p: any) => ({
        'SKU Pack': p.sku_pack,
        'SKU Componente': p.sku_componente,
        'Cantidad': p.cantidad
      }))

      console.log('Obteniendo datos de SKUs desconsiderados...')
      const desconsiderarResponse = await fetchDatosBD('desconsiderar')
      const datosDesconsiderar = desconsiderarResponse.data.map((d: any) => ({
        'SKU': d.sku
      }))

      // 3. Crear libro de Excel
      const wb = XLSX.utils.book_new()

      // Hoja 1: Predicciones (principal)
      const wsPredicciones = XLSX.utils.json_to_sheet(datosPredicciones)
      wsPredicciones['!cols'] = [
        { wch: 15 }, { wch: 40 }, { wch: 8 }, { wch: 12 }, { wch: 15 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
        { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 10 }
      ]
      XLSX.utils.book_append_sheet(wb, wsPredicciones, 'Predicciones')

      // Hoja 2: Ventas (para validación)
      if (datosVentas.length > 0) {
        const wsVentas = XLSX.utils.json_to_sheet(datosVentas)
        wsVentas['!cols'] = [
          { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
          { wch: 40 }, { wch: 10 }, { wch: 12 }
        ]
        XLSX.utils.book_append_sheet(wb, wsVentas, 'BD - Ventas')
      }

      // Hoja 3: Stock
      if (datosStock.length > 0) {
        const wsStock = XLSX.utils.json_to_sheet(datosStock)
        wsStock['!cols'] = [
          { wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
          { wch: 10 }, { wch: 10 }, { wch: 10 }
        ]
        XLSX.utils.book_append_sheet(wb, wsStock, 'BD - Stock')
      }

      // Hoja 4: Tránsito
      if (datosTransito.length > 0) {
        const wsTransito = XLSX.utils.json_to_sheet(datosTransito)
        wsTransito['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }]
        XLSX.utils.book_append_sheet(wb, wsTransito, 'BD - Tránsito')
      }

      // Hoja 5: Compras
      if (datosCompras.length > 0) {
        const wsCompras = XLSX.utils.json_to_sheet(datosCompras)
        wsCompras['!cols'] = [{ wch: 15 }, { wch: 12 }]
        XLSX.utils.book_append_sheet(wb, wsCompras, 'BD - Compras')
      }

      // Hoja 6: Packs
      if (datosPacks.length > 0) {
        const wsPacks = XLSX.utils.json_to_sheet(datosPacks)
        wsPacks['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 10 }]
        XLSX.utils.book_append_sheet(wb, wsPacks, 'BD - Packs')
      }

      // Hoja 7: SKUs Desconsiderados
      if (datosDesconsiderar.length > 0) {
        const wsDesconsiderar = XLSX.utils.json_to_sheet(datosDesconsiderar)
        wsDesconsiderar['!cols'] = [{ wch: 15 }]
        XLSX.utils.book_append_sheet(wb, wsDesconsiderar, 'BD - Desconsiderar')
      }

      // 4. Descargar archivo
      const fecha = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `Forecasting_Completo_${fecha}.xlsx`)

      alert(`✅ Excel exportado correctamente con ${wb.SheetNames.length} pestañas\n\n` +
            `📊 Incluye predicciones y datos de BD para validación:\n` +
            `- ${datosVentas.length} ventas\n` +
            `- ${datosStock.length} SKUs en stock\n` +
            `- ${datosTransito.length} en tránsito\n` +
            `- ${datosCompras.length} compras\n` +
            `- ${datosPacks.length} packs\n` +
            `- ${datosDesconsiderar.length} desconsiderados`)
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

      // Recargar predicciones y datos de modales
      await Promise.all([
        cargarPredicciones(),
        cargarDatosModales()
      ])
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

      // Supabase con ANON_KEY tiene límite máximo de 1000 registros
      // Necesitamos hacer múltiples requests para obtener todos los datos
      let allData: any[] = []
      let currentOffset = 0
      const batchSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: batch, error } = await query
          .range(currentOffset, currentOffset + batchSize - 1)

        if (error) throw error

        if (batch && batch.length > 0) {
          allData = [...allData, ...batch]
          currentOffset += batchSize
          hasMore = batch.length === batchSize
        } else {
          hasMore = false
        }
      }

      let resultados = allData

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
        configuraciones={configuraciones}
        onSave={cargarDatosModales}
      />

      {/* Modal de SKUs Excluidos */}
      <SkusExcluidosModal
        isOpen={excluidosOpen}
        onClose={() => setExcluidosOpen(false)}
        skusExcluidos={skusExcluidos}
        onReactivar={() => {
          cargarDatosModales()
          cargarPredicciones()
        }}
      />
    </div>
  )
}
