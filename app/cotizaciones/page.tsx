'use client'

import { useEffect, useState } from 'react'
import { fetchCotizaciones, updateCotizacion, deleteCotizacion } from '@/lib/api-client'

interface Cotizacion {
  id: number
  sku: string
  descripcion: string | null
  cantidad_cotizar: number
  precio_unitario: number
  valor_total: number
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'recibida'
  fecha_cotizacion: string
  fecha_actualizacion: string
  notas: string | null
}

export default function CotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<string>('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<{
    precio_unitario: number
    estado: string
    notas: string
  }>({ precio_unitario: 0, estado: '', notas: '' })

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
      precio_unitario: cot.precio_unitario,
      estado: cot.estado,
      notas: cot.notas || ''
    })
  }

  async function saveEdit(id: number) {
    try {
      await updateCotizacion(id, {
        precio_unitario: editData.precio_unitario,
        estado: editData.estado as any,
        notas: editData.notas.trim() || undefined
      })
      alert('Cotización actualizada')
      setEditingId(null)
      await cargarCotizaciones()
    } catch (error: any) {
      console.error('Error actualizando:', error)
      alert('Error: ' + error.message)
    }
  }

  function cancelEdit() {
    setEditingId(null)
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800'
      case 'aprobada': return 'bg-green-100 text-green-800'
      case 'rechazada': return 'bg-red-100 text-red-800'
      case 'recibida': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const resumen = {
    pendiente: cotizaciones.filter(c => c.estado === 'pendiente').length,
    aprobada: cotizaciones.filter(c => c.estado === 'aprobada').length,
    rechazada: cotizaciones.filter(c => c.estado === 'rechazada').length,
    recibida: cotizaciones.filter(c => c.estado === 'recibida').length,
    total: cotizaciones.length,
    valorTotal: cotizaciones.reduce((sum, c) => sum + c.valor_total, 0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Cotizaciones</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestión de productos en cotización
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
          <p className="text-sm text-green-600">Aprobadas</p>
          <p className="text-2xl font-bold text-green-700">{resumen.aprobada}</p>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4">
          <p className="text-sm text-red-600">Rechazadas</p>
          <p className="text-2xl font-bold text-red-700">{resumen.rechazada}</p>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <p className="text-sm text-blue-600">Recibidas</p>
          <p className="text-2xl font-bold text-blue-700">{resumen.recibida}</p>
        </div>
        <div className="bg-purple-50 rounded-lg shadow p-4">
          <p className="text-sm text-purple-600">Valor Total</p>
          <p className="text-xl font-bold text-purple-700">
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
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="recibida">Recibidas</option>
          </select>
        </div>
      </div>

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
            <p className="text-sm text-gray-400 mt-2">
              Crea cotizaciones desde el dashboard principal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio Unit.</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notas</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cotizaciones.map((cot) => (
                  <tr key={cot.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {cot.sku}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {cot.descripcion || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {cot.cantidad_cotizar.toLocaleString('es-CL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {editingId === cot.id ? (
                        <input
                          type="number"
                          value={editData.precio_unitario}
                          onChange={(e) => setEditData({ ...editData, precio_unitario: parseFloat(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right rounded border-gray-300"
                        />
                      ) : (
                        <span className="text-blue-600 font-medium">
                          ${cot.precio_unitario.toLocaleString('es-CL')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-green-600">
                      ${cot.valor_total.toLocaleString('es-CL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {editingId === cot.id ? (
                        <select
                          value={editData.estado}
                          onChange={(e) => setEditData({ ...editData, estado: e.target.value })}
                          className="px-2 py-1 rounded border-gray-300"
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="aprobada">Aprobada</option>
                          <option value="rechazada">Rechazada</option>
                          <option value="recibida">Recibida</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(cot.estado)}`}>
                          {cot.estado}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(cot.fecha_cotizacion).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {editingId === cot.id ? (
                        <input
                          type="text"
                          value={editData.notas}
                          onChange={(e) => setEditData({ ...editData, notas: e.target.value })}
                          className="w-full px-2 py-1 rounded border-gray-300"
                          placeholder="Notas..."
                        />
                      ) : (
                        cot.notas || '—'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      {editingId === cot.id ? (
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => saveEdit(cot.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => startEdit(cot)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(cot.id, cot.sku)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Eliminar
                          </button>
                        </div>
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
