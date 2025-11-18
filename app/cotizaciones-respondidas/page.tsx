'use client'

import { useEffect, useState } from 'react'
import { fetchCotizaciones, updateCotizacion, deleteCotizacion } from '@/lib/api-client'
import AprobarCotizacionesMasivo from '@/components/AprobarCotizacionesMasivo'
import { handleApiError } from '@/lib/utils/errorHandler'
import { showSuccess, showError } from '@/lib/utils/toast'
import { CotizacionesTableSkeleton } from '@/components/TableSkeleton'
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog'

interface Cotizacion {
  id: number
  sku: string
  descripcion: string | null
  cantidad_cotizar: number
  precio_unitario: number
  valor_total: number
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'recibida' | 'respondida'
  fecha_cotizacion: string
  notas: string | null
  // Campos de respuesta del proveedor
  costo_proveedor: number | null
  moneda: string | null
  cantidad_minima_venta: number | null
  unidades_por_embalaje: number | null
  metros_cubicos_embalaje: number | null
  tiempo_entrega_dias: number | null
  fecha_respuesta: string | null
  notas_proveedor: string | null
}

export default function CotizacionesRespondidasPage() {
  const confirmDialog = useConfirmDialog()
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  useEffect(() => {
    cargarCotizaciones()
  }, [filtroEstado])

  async function cargarCotizaciones() {
    setLoading(true)
    try {
      const params: any = {}
      if (filtroEstado) {
        params.estado = filtroEstado
      }

      const response = await fetchCotizaciones(params)
      if (response.success) {
        setCotizaciones(response.cotizaciones)
      }
    } catch (error: any) {
      console.error('Error cargando cotizaciones:', error)
      showError(handleApiError(error, 'cargar cotizaciones'))
    } finally {
      setLoading(false)
    }
  }

  async function handleAprobar(id: number, sku: string) {
    confirmDialog.confirm({
      title: 'Aprobar cotización',
      description: `¿Aprobar cotización de ${sku}?`,
      variant: 'default',
      onConfirm: async () => {
        try {
          await updateCotizacion(id, { estado: 'aprobada' })
          showSuccess('Cotización aprobada')
          await cargarCotizaciones()
        } catch (error: any) {
          showError(handleApiError(error, 'aprobar cotización'))
        }
      }
    })
  }

  async function handleRechazar(id: number, sku: string) {
    confirmDialog.confirm({
      title: 'Rechazar cotización',
      description: `¿Rechazar cotización de ${sku}?`,
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await updateCotizacion(id, { estado: 'rechazada' })
          showError('Cotización rechazada')
          await cargarCotizaciones()
        } catch (error: any) {
          showError(handleApiError(error, 'rechazar cotización'))
        }
      }
    })
  }

  async function handleEliminar(id: number, sku: string) {
    confirmDialog.confirm({
      title: 'Eliminar cotización',
      description: `¿Eliminar cotización de ${sku}?`,
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteCotizacion(id)
          showSuccess('Cotización eliminada')
          await cargarCotizaciones()
        } catch (error: any) {
          showError(handleApiError(error, 'eliminar cotización'))
        }
      }
    })
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800'
      case 'respondida': return 'bg-green-100 text-green-800'
      case 'aprobada': return 'bg-blue-100 text-blue-800'
      case 'rechazada': return 'bg-red-100 text-red-800'
      case 'recibida': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const calcularMargen = (precioUnitario: number, costoProveedor: number | null) => {
    if (!costoProveedor || costoProveedor === 0) return null
    const margen = ((precioUnitario - costoProveedor) / precioUnitario) * 100
    return margen
  }

  const resumen = {
    respondida: cotizaciones.filter(c => c.estado === 'respondida').length,
    aprobada: cotizaciones.filter(c => c.estado === 'aprobada').length,
    rechazada: cotizaciones.filter(c => c.estado === 'rechazada').length,
    recibida: cotizaciones.filter(c => c.estado === 'recibida').length,
    total: cotizaciones.length,
    valorTotal: cotizaciones.reduce((sum, c) => sum + (c.costo_proveedor || 0) * c.cantidad_cotizar, 0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cotizaciones Respondidas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Dashboard del Dueño - Vista Completa con Costos y Márgenes
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{resumen.total}</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <p className="text-sm text-green-600">Respondidas</p>
          <p className="text-2xl font-bold text-green-700">{resumen.respondida}</p>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <p className="text-sm text-blue-600">Aprobadas</p>
          <p className="text-2xl font-bold text-blue-700">{resumen.aprobada}</p>
        </div>
        <div className="bg-purple-50 rounded-lg shadow p-4">
          <p className="text-sm text-purple-600">Recibidas</p>
          <p className="text-2xl font-bold text-purple-700">{resumen.recibida}</p>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4">
          <p className="text-sm text-red-600">Rechazadas</p>
          <p className="text-2xl font-bold text-red-700">{resumen.rechazada}</p>
        </div>
        <div className="bg-orange-50 rounded-lg shadow p-4">
          <p className="text-sm text-orange-600">Valor Total</p>
          <p className="text-xl font-bold text-orange-700">
            ${(resumen.valorTotal / 1000).toFixed(0)}k
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4 items-center">
          <label className="text-sm font-medium text-gray-700">Filtrar por estado:</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            <option value="respondida">Respondidas</option>
            <option value="aprobada">Aprobadas</option>
            <option value="recibida">Recibidas</option>
            <option value="rechazada">Rechazadas</option>
          </select>
        </div>
      </div>

      {/* Aprobar/Rechazar Cotizaciones Masivamente */}
      <AprobarCotizacionesMasivo onSuccess={cargarCotizaciones} />

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Cotizaciones Completas
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {cotizaciones.length} cotizaciones con información completa
          </p>
        </div>

        {loading ? (
          <CotizacionesTableSkeleton rows={10} />
        ) : cotizaciones.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No hay cotizaciones respondidas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-orange-600 uppercase">Precio Unit.</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-green-600 uppercase">Costo</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-green-600 uppercase">Moneda</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-purple-600 uppercase">Margen %</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-blue-600 uppercase">Cant. Mín.</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-blue-600 uppercase">Und/Caja</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-blue-600 uppercase">m³/Caja</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notas Proveedor</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cotizaciones.map((cot) => {
                  const margen = calcularMargen(cot.precio_unitario, cot.costo_proveedor)
                  return (
                    <tr key={cot.id} className="hover:bg-gray-50">
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {cot.sku}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-700 max-w-xs">
                        {cot.descripcion || '—'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-semibold">
                        {cot.cantidad_cotizar.toLocaleString('es-CL')}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-sm text-orange-600 font-medium">
                        ${cot.precio_unitario.toLocaleString('es-CL')}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-sm text-green-600 font-semibold">
                        {cot.costo_proveedor ? `${cot.costo_proveedor.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-medium">
                        {cot.moneda || '—'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-bold">
                        {margen !== null ? (
                          <span className={margen > 30 ? 'text-green-600' : margen > 15 ? 'text-yellow-600' : 'text-red-600'}>
                            {margen.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                        {cot.cantidad_minima_venta || '—'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                        {cot.unidades_por_embalaje || '—'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                        {cot.metros_cubicos_embalaje ? cot.metros_cubicos_embalaje.toFixed(4) : '—'}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-600 max-w-xs">
                        {cot.notas_proveedor || '—'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(cot.estado)}`}>
                          {cot.estado}
                        </span>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center text-sm">
                        {cot.estado === 'respondida' ? (
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => handleAprobar(cot.id, cot.sku)}
                              className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium"
                              title="Aprobar cotización"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => handleRechazar(cot.id, cot.sku)}
                              className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                              title="Rechazar cotización"
                            >
                              ✗
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEliminar(cot.id, cot.sku)}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs"
                          >
                            Eliminar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
