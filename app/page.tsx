'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSupabase } from '@/lib/SupabaseProvider'
import { useDebounce } from '@/hooks/useDebounce'
import { useModalState, useModalWithData } from '@/hooks/useModalState'
import { usePrediccionesWithFilters } from '@/hooks/useQueries'
import { useQueryClient } from '@tanstack/react-query'
import { PageGuard } from '@/components/auth/PageGuard'
import PrediccionesTable from '@/components/PrediccionesTable'
import Filtros from '@/components/Filtros'
import UploadExcel from '@/components/UploadExcel'
import ConfiguracionModal from '@/components/ConfiguracionModal'
import SkusExcluidosModal from '@/components/SkusExcluidosModal'
import CotizarModal from '@/components/CotizarModal'
import ResumenModal from '@/components/ResumenModal'
import CotizarMasivoModal from '@/components/CotizarMasivoModal'
import CargaMasivaCotizaciones from '@/components/CargaMasivaCotizaciones'
import { PrediccionesTableSkeleton } from '@/components/TableSkeleton'
import type { Prediccion } from '@/lib/types'
import { exportForecastingToExcel } from '@/lib/services/excelExporter'
import { toggleSkuExclusion, excludeMultipleSkus } from '@/lib/services/skuService'
import { handleApiError } from '@/lib/utils/errorHandler'
import { showSuccess, showError, showWarning } from '@/lib/utils/toast'
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog'

export default function Home() {
  return (
    <PageGuard allowedRoles={['ADMIN', 'GERENTE', 'COMPRADOR']}>
      <DashboardContent />
    </PageGuard>
  )
}

function DashboardContent() {
  const { client: supabase } = useSupabase()
  const confirmDialog = useConfirmDialog()
  const queryClient = useQueryClient()
  const [filtros, setFiltros] = useState({
    abc: '',
    busqueda: '',
    soloAlertas: false
  })

  // Debouncing en búsqueda para evitar queries excesivas
  const debouncedBusqueda = useDebounce(filtros.busqueda, 300)

  // Use React Query with debounced search
  const filtrosDebounced = {
    ...filtros,
    busqueda: debouncedBusqueda
  }

  const { data: predicciones = [], isLoading: loading, error, refetch } = usePrediccionesWithFilters(filtrosDebounced)

  // Estado para selección múltiple
  const [skusSeleccionados, setSkusSeleccionados] = useState<Set<string>>(new Set())

  // Modal states usando hooks
  const configuracionModal = useModalState()
  const excluidosModal = useModalState()
  const resumenModal = useModalState()
  const cotizarModal = useModalWithData<Prediccion>()
  const cotizarMasivoModal = useModalState()

  // Pre-cargar datos de modales para apertura instantánea
  const [configuraciones, setConfiguraciones] = useState<any[]>([])
  const [skusExcluidos, setSkusExcluidos] = useState<any[]>([])
  const [loadingModalData, setLoadingModalData] = useState(true)

  const cargarDatosModales = useCallback(async () => {
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
  }, [supabase])

  // Pre-cargar datos de modales al montar el componente
  useEffect(() => {
    cargarDatosModales()
  }, [cargarDatosModales])

  async function exportarAExcel() {
    await exportForecastingToExcel(predicciones)
  }

  const handleCotizar = useCallback((prediccion: Prediccion) => {
    cotizarModal.openWith(prediccion)
  }, [cotizarModal])

  const handleExcludeToggle = useCallback(async (sku: string, descripcion: string) => {
    try {
      const result = await toggleSkuExclusion(sku, descripcion)
      showSuccess(result.message)
      await Promise.all([
        refetch(),
        cargarDatosModales()
      ])
    } catch (error: any) {
      showError(handleApiError(error, 'cambiar estado de exclusión'))
    }
  }, [refetch, cargarDatosModales])

  // Funciones para selección múltiple
  const handleToggleSeleccion = useCallback((sku: string) => {
    setSkusSeleccionados(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sku)) {
        newSet.delete(sku)
      } else {
        newSet.add(sku)
      }
      return newSet
    })
  }, [])

  const handleToggleTodos = useCallback(() => {
    if (skusSeleccionados.size === predicciones.length) {
      // Si todos están seleccionados, deseleccionar todos
      setSkusSeleccionados(new Set())
    } else {
      // Seleccionar todos
      setSkusSeleccionados(new Set(predicciones.map(p => p.sku)))
    }
  }, [predicciones, skusSeleccionados.size])

  const handleExcluirSeleccionados = useCallback(async () => {
    if (skusSeleccionados.size === 0) {
      showWarning('No hay SKUs seleccionados')
      return
    }

    confirmDialog.confirm({
      title: 'Excluir SKUs',
      description: `¿Deseas excluir ${skusSeleccionados.size} SKU(s) del análisis?`,
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const skusToExclude = predicciones
            .filter(p => skusSeleccionados.has(p.sku))
            .map(p => ({ sku: p.sku, descripcion: p.descripcion }))

          const result = await excludeMultipleSkus(skusToExclude)
          showSuccess(result.message)

          setSkusSeleccionados(new Set())
          await Promise.all([
            refetch(),
            cargarDatosModales()
          ])
        } catch (error: any) {
          showError(handleApiError(error, 'excluir SKUs'))
        }
      }
    })
  }, [skusSeleccionados, predicciones, refetch, cargarDatosModales, confirmDialog])

  const handleCotizarSeleccionados = useCallback(() => {
    if (skusSeleccionados.size === 0) {
      showWarning('No hay SKUs seleccionados')
      return
    }
    cotizarMasivoModal.open()
  }, [skusSeleccionados.size])

  // Show error if query fails
  useEffect(() => {
    if (error) {
      showError(handleApiError(error, 'cargar predicciones'))
    }
  }, [error])

  return (
    <div className="space-y-6">
      {/* Barra de acciones superior */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <UploadExcel />
        <div className="flex gap-2">
          <button
            onClick={resumenModal.open}
            className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            📊 Resumen Gerencial
          </button>
          <button
            onClick={exportarAExcel}
            className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
            disabled={predicciones.length === 0}
          >
            📄 Exportar Excel
          </button>
          <button
            onClick={excluidosModal.open}
            className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            🚫 SKUs Excluidos
          </button>
          <button
            onClick={configuracionModal.open}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            ⚙️ Configuración
          </button>
        </div>
      </div>

      {/* Filtros */}
      <Filtros filtros={filtros} setFiltros={setFiltros} />

      {/* Carga Masiva de Cotizaciones */}
      <CargaMasivaCotizaciones
        predicciones={predicciones}
        onSuccess={() => refetch()}
      />

      {/* Tabla de Predicciones */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Sugerencias de Reposición
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {predicciones.length} productos · Ordenados por valor
                {skusSeleccionados.size > 0 && (
                  <span className="ml-2 text-blue-600 font-medium">
                    · {skusSeleccionados.size} seleccionado{skusSeleccionados.size !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>

            {/* Botones de acción masiva */}
            {skusSeleccionados.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handleCotizarSeleccionados}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  📋 Cotizar Seleccionados ({skusSeleccionados.size})
                </button>
                <button
                  onClick={handleExcluirSeleccionados}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  🚫 Excluir Seleccionados ({skusSeleccionados.size})
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <PrediccionesTableSkeleton rows={10} />
        ) : predicciones.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No se encontraron predicciones.</p>
            <p className="text-sm text-gray-400 mt-2">
              Ejecuta el forecasting en GitHub Actions para generar datos.
            </p>
          </div>
        ) : (
          <PrediccionesTable
            predicciones={predicciones}
            onExcludeToggle={handleExcludeToggle}
            onCotizar={handleCotizar}
            skusSeleccionados={skusSeleccionados}
            onToggleSeleccion={handleToggleSeleccion}
            onToggleTodos={handleToggleTodos}
          />
        )}
      </div>

      {/* Modal de Configuración */}
      <ConfiguracionModal
        isOpen={configuracionModal.isOpen}
        onClose={configuracionModal.close}
        configuraciones={configuraciones}
        onSave={cargarDatosModales}
      />

      {/* Modal de SKUs Excluidos */}
      <SkusExcluidosModal
        isOpen={excluidosModal.isOpen}
        onClose={excluidosModal.close}
        skusExcluidos={skusExcluidos}
        onReactivar={() => {
          cargarDatosModales()
          refetch()
        }}
      />

      {/* Modal de Cotización */}
      {cotizarModal.data && (
        <CotizarModal
          isOpen={cotizarModal.isOpen}
          onClose={cotizarModal.close}
          sku={cotizarModal.data.sku}
          descripcion={cotizarModal.data.descripcion}
          sugerenciaReposicion={cotizarModal.data.sugerencia_reposicion}
          precioUnitario={cotizarModal.data.precio_unitario}
          onSuccess={() => {
            // Opcional: recargar cotizaciones si es necesario
          }}
        />
      )}

      {/* Modal de Resumen Gerencial */}
      <ResumenModal
        isOpen={resumenModal.isOpen}
        onClose={resumenModal.close}
      />

      {/* Modal de Cotización Masiva */}
      <CotizarMasivoModal
        isOpen={cotizarMasivoModal.isOpen}
        onClose={cotizarMasivoModal.close}
        prediccionesSeleccionadas={predicciones.filter(p => skusSeleccionados.has(p.sku))}
        onSuccess={() => {
          refetch()
          setSkusSeleccionados(new Set()) // Limpiar selección después de cotizar
        }}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={confirmDialog.close}
        onConfirm={confirmDialog.config.onConfirm}
        title={confirmDialog.config.title}
        description={confirmDialog.config.description}
        variant={confirmDialog.config.variant}
        confirmText={confirmDialog.config.confirmText}
        cancelText={confirmDialog.config.cancelText}
      />
    </div>
  )
}
