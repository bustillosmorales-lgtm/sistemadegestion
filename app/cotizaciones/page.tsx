'use client'

import { useEffect, useState } from 'react'
import { fetchCotizaciones, updateCotizacion, deleteCotizacion } from '@/lib/api-client'
import ResponderCotizacionesMasivo from '@/components/ResponderCotizacionesMasivo'

interface Cotizacion {
  id: number
  sku: string
  descripcion: string | null
  cantidad_cotizar: number
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'recibida' | 'respondida'
  fecha_cotizacion: string
  notas: string | null
  // Campos de respuesta del proveedor
  costo_proveedor: number | null
  moneda: string | null
  cantidad_minima_venta: number | null
  unidades_por_embalaje: number | null
  metros_cubicos_embalaje: number | null
  notas_proveedor: string | null
  // Campos de seguimiento de contenedores
  fecha_confirmacion_compra: string | null
  fecha_carga_contenedor: string | null
  numero_contenedor: string | null
}

export default function CotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<string>('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<{
    costo_proveedor: number
    moneda: string
    cantidad_minima_venta: number
    unidades_por_embalaje: number
    metros_cubicos_embalaje: number
    notas_proveedor: string
  }>({
    costo_proveedor: 0,
    moneda: 'USD',
    cantidad_minima_venta: 1,
    unidades_por_embalaje: 1,
    metros_cubicos_embalaje: 0,
    notas_proveedor: ''
  })

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
    } catch (error) {
      console.error('Error cargando cotizaciones:', error)
      alert('Error al cargar cotizaciones')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number, sku: string) {
    if (!confirm(`¿Eliminar cotización de ${sku}?`)) return

    try {
      await deleteCotizacion(id)
      alert('Cotización eliminada')
      await cargarCotizaciones()
    } catch (error: any) {
      console.error('Error eliminando:', error)
      alert('Error: ' + error.message)
    }
  }

  function startEdit(cot: Cotizacion) {
    setEditingId(cot.id)
    setEditData({
      costo_proveedor: cot.costo_proveedor || 0,
      moneda: cot.moneda || 'USD',
      cantidad_minima_venta: cot.cantidad_minima_venta || 1,
      unidades_por_embalaje: cot.unidades_por_embalaje || 1,
      metros_cubicos_embalaje: cot.metros_cubicos_embalaje || 0,
      notas_proveedor: cot.notas_proveedor || ''
    })
  }

  async function saveResponse(id: number) {
    try {
      await updateCotizacion(id, {
        costo_proveedor: editData.costo_proveedor,
        moneda: editData.moneda,
        cantidad_minima_venta: editData.cantidad_minima_venta,
        unidades_por_embalaje: editData.unidades_por_embalaje,
        metros_cubicos_embalaje: editData.metros_cubicos_embalaje,
        notas_proveedor: editData.notas_proveedor.trim() || undefined,
        estado: 'respondida'
      })
      alert('✅ Cotización respondida exitosamente')
      setEditingId(null)
      await cargarCotizaciones()
    } catch (error: any) {
      console.error('Error respondiendo:', error)
      alert('Error: ' + error.message)
    }
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleConfirmarCompra(id: number, sku: string) {
    if (!confirm(`¿Confirmar recepción de orden de compra para ${sku}?`)) return

    try {
      await updateCotizacion(id, {
        fecha_confirmacion_compra: true as any
      })
      alert('✅ Orden de compra confirmada')
      await cargarCotizaciones()
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error: ' + error.message)
    }
  }

  async function handleCargarContenedor(id: number, sku: string) {
    const numeroContenedor = prompt(`Ingresa el número de contenedor para ${sku}:`)
    if (!numeroContenedor) return

    try {
      await updateCotizacion(id, {
        fecha_carga_contenedor: true as any,
        numero_contenedor: numeroContenedor.trim()
      })
      alert(`✅ Mercadería cargada en contenedor ${numeroContenedor}\n\nSe creó registro automático en Tránsito China.`)
      await cargarCotizaciones()
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error: ' + error.message)
    }
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

  const resumen = {
    pendiente: cotizaciones.filter(c => c.estado === 'pendiente').length,
    respondida: cotizaciones.filter(c => c.estado === 'respondida').length,
    aprobada: cotizaciones.filter(c => c.estado === 'aprobada').length,
    recibida: cotizaciones.filter(c => c.estado === 'recibida').length,
    total: cotizaciones.length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cotizaciones por Responder</h1>
        <p className="text-sm text-gray-500 mt-1">
          Dashboard del Proveedor
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{resumen.total}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <p className="text-sm text-yellow-600">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-700">{resumen.pendiente}</p>
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
        <div className="bg-orange-50 rounded-lg shadow p-4">
          <p className="text-sm text-orange-600">En Proceso</p>
          <p className="text-2xl font-bold text-orange-700">
            {resumen.pendiente + resumen.respondida + resumen.aprobada + resumen.recibida}
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
            <option value="pendiente">Pendientes</option>
            <option value="respondida">Respondidas</option>
            <option value="aprobada">Aprobadas</option>
            <option value="recibida">Recibidas</option>
          </select>
        </div>
      </div>

      {/* Responder Cotizaciones Masivamente */}
      <ResponderCotizacionesMasivo onSuccess={cargarCotizaciones} />

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Cotizaciones
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {cotizaciones.length} cotizaciones
          </p>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Cargando cotizaciones...</p>
          </div>
        ) : cotizaciones.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No hay cotizaciones.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notas Cliente</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase">Costo</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 uppercase">Moneda</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase">Cant. Mín.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase">Und/Caja</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase">m³/Caja</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-blue-600 uppercase">Notas Proveedor</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cotizaciones.map((cot) => (
                  <tr key={cot.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {cot.sku}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 max-w-xs">
                      {cot.descripcion || '—'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-semibold">
                      {cot.cantidad_cotizar.toLocaleString('es-CL')}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 max-w-xs">
                      {cot.notas || '—'}
                    </td>

                    {/* Campos de respuesta del proveedor */}
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                      {editingId === cot.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editData.costo_proveedor}
                          onChange={(e) => setEditData({ ...editData, costo_proveedor: parseFloat(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right rounded border-gray-300"
                          placeholder="0.00"
                        />
                      ) : (
                        <span className="text-blue-600 font-medium">
                          {cot.costo_proveedor ? cot.costo_proveedor.toFixed(2) : '—'}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-center text-sm">
                      {editingId === cot.id ? (
                        <select
                          value={editData.moneda}
                          onChange={(e) => setEditData({ ...editData, moneda: e.target.value })}
                          className="px-2 py-1 rounded border-gray-300"
                        >
                          <option value="USD">USD</option>
                          <option value="CLP">CLP</option>
                          <option value="CNY">CNY</option>
                          <option value="EUR">EUR</option>
                        </select>
                      ) : (
                        cot.moneda || '—'
                      )}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                      {editingId === cot.id ? (
                        <input
                          type="number"
                          value={editData.cantidad_minima_venta}
                          onChange={(e) => setEditData({ ...editData, cantidad_minima_venta: parseInt(e.target.value) || 1 })}
                          className="w-20 px-2 py-1 text-right rounded border-gray-300"
                        />
                      ) : (
                        cot.cantidad_minima_venta || '—'
                      )}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                      {editingId === cot.id ? (
                        <input
                          type="number"
                          value={editData.unidades_por_embalaje}
                          onChange={(e) => setEditData({ ...editData, unidades_por_embalaje: parseInt(e.target.value) || 1 })}
                          className="w-20 px-2 py-1 text-right rounded border-gray-300"
                        />
                      ) : (
                        cot.unidades_por_embalaje || '—'
                      )}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                      {editingId === cot.id ? (
                        <input
                          type="number"
                          step="0.0001"
                          value={editData.metros_cubicos_embalaje}
                          onChange={(e) => setEditData({ ...editData, metros_cubicos_embalaje: parseFloat(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right rounded border-gray-300"
                          placeholder="0.0000"
                        />
                      ) : (
                        cot.metros_cubicos_embalaje ? cot.metros_cubicos_embalaje.toFixed(4) : '—'
                      )}
                    </td>

                    <td className="px-4 py-4 text-sm max-w-xs">
                      {editingId === cot.id ? (
                        <textarea
                          value={editData.notas_proveedor}
                          onChange={(e) => setEditData({ ...editData, notas_proveedor: e.target.value })}
                          className="w-full px-2 py-1 rounded border-gray-300"
                          rows={2}
                          placeholder="Notas adicionales..."
                        />
                      ) : (
                        <span className="text-gray-600">{cot.notas_proveedor || '—'}</span>
                      )}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(cot.estado)}`}>
                        {cot.estado}
                      </span>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-center text-sm">
                      {editingId === cot.id ? (
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => saveResponse(cot.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
                          >
                            ✓ Enviar
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : cot.estado === 'pendiente' ? (
                        <button
                          onClick={() => startEdit(cot)}
                          className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                        >
                          📋 Responder
                        </button>
                      ) : cot.estado === 'aprobada' ? (
                        <div className="flex flex-col gap-1">
                          {!cot.fecha_confirmacion_compra ? (
                            <button
                              onClick={() => handleConfirmarCompra(cot.id, cot.sku)}
                              className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium whitespace-nowrap"
                              title="Confirmar recepción de orden de compra"
                            >
                              ✓ PO Recibida
                            </button>
                          ) : (
                            <span className="text-xs text-green-600 font-medium">
                              ✓ PO {new Date(cot.fecha_confirmacion_compra).toLocaleDateString('es-CL')}
                            </span>
                          )}
                          {cot.fecha_confirmacion_compra && !cot.fecha_carga_contenedor ? (
                            <button
                              onClick={() => handleCargarContenedor(cot.id, cot.sku)}
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium whitespace-nowrap"
                              title="Marcar como cargado en contenedor"
                            >
                              📦 Cargar
                            </button>
                          ) : cot.fecha_carga_contenedor ? (
                            <span className="text-xs text-blue-600 font-medium">
                              📦 {cot.numero_contenedor}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(cot)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
