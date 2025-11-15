'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/lib/SupabaseProvider'

interface ContenedorItem {
  id: number
  sku: string
  descripcion: string | null
  unidades: number
  numero_contenedor: string | null
  fecha_carga: string
  origen: 'cotizacion' | 'carga_masiva'
  estado: string
}

export default function ContenedoresPage() {
  const supabase = useSupabase()
  const [items, setItems] = useState<ContenedorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    contenedor: '',
    sku: '',
    descripcion: ''
  })
  const [editingItem, setEditingItem] = useState<ContenedorItem | null>(null)
  const [editData, setEditData] = useState({
    sku: '',
    numero_contenedor: '',
    fecha_carga: '',
    unidades: 0
  })

  useEffect(() => {
    cargarDatos()
  }, [filtros])

  async function cargarDatos() {
    setLoading(true)
    try {
      // 1. Cargar cotizaciones cargadas en contenedor
      let queryCotizaciones = supabase
        .from('cotizaciones')
        .select('id, sku, descripcion, cantidad_cotizar, numero_contenedor, fecha_carga_contenedor')
        .not('fecha_carga_contenedor', 'is', null)
        .not('numero_contenedor', 'is', null)

      if (filtros.contenedor) {
        queryCotizaciones = queryCotizaciones.ilike('numero_contenedor', `%${filtros.contenedor}%`)
      }
      if (filtros.sku) {
        queryCotizaciones = queryCotizaciones.ilike('sku', `%${filtros.sku}%`)
      }
      if (filtros.descripcion) {
        queryCotizaciones = queryCotizaciones.ilike('descripcion', `%${filtros.descripcion}%`)
      }

      const { data: cotizaciones, error: errorCot } = await queryCotizaciones

      // 2. Cargar tránsito desde carga masiva
      let queryTransito = supabase
        .from('transito_china')
        .select('id, sku, descripcion, unidades, numero_contenedor, estado, fecha_contenedor, created_at')
        .eq('estado', 'en_transito')

      if (filtros.contenedor) {
        queryTransito = queryTransito.ilike('numero_contenedor', `%${filtros.contenedor}%`)
      }
      if (filtros.sku) {
        queryTransito = queryTransito.ilike('sku', `%${filtros.sku}%`)
      }
      if (filtros.descripcion) {
        queryTransito = queryTransito.ilike('descripcion', `%${filtros.descripcion}%`)
      }

      const { data: transito, error: errorTra } = await queryTransito

      // 3. Combinar ambas fuentes
      const combined: ContenedorItem[] = []

      if (cotizaciones && !errorCot) {
        cotizaciones.forEach(cot => {
          combined.push({
            id: cot.id,
            sku: cot.sku,
            descripcion: cot.descripcion,
            unidades: cot.cantidad_cotizar,
            numero_contenedor: cot.numero_contenedor,
            fecha_carga: cot.fecha_carga_contenedor!,
            origen: 'cotizacion',
            estado: 'en_transito'
          })
        })
      }

      if (transito && !errorTra) {
        transito.forEach(tra => {
          combined.push({
            id: tra.id,
            sku: tra.sku,
            descripcion: tra.descripcion,
            unidades: tra.unidades,
            numero_contenedor: tra.numero_contenedor,
            fecha_carga: tra.fecha_contenedor || tra.created_at,
            origen: 'carga_masiva',
            estado: tra.estado
          })
        })
      }

      // 4. Ordenar por fecha (menor a mayor) y luego por contenedor
      combined.sort((a, b) => {
        const dateA = new Date(a.fecha_carga).getTime()
        const dateB = new Date(b.fecha_carga).getTime()
        if (dateA !== dateB) {
          return dateA - dateB // Menor a mayor (más antiguos primero)
        }
        // Si misma fecha, ordenar por contenedor
        const contA = a.numero_contenedor || ''
        const contB = b.numero_contenedor || ''
        return contA.localeCompare(contB)
      })

      setItems(combined)
    } catch (error) {
      console.error('Error cargando contenedores:', error)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(item: ContenedorItem) {
    setEditingItem(item)
    setEditData({
      sku: item.sku,
      numero_contenedor: item.numero_contenedor || '',
      fecha_carga: item.fecha_carga.split('T')[0], // Solo la fecha
      unidades: item.unidades
    })
  }

  async function saveEdit() {
    if (!editingItem) return

    try {
      if (editingItem.origen === 'cotizacion') {
        // Actualizar en cotizaciones
        const { error } = await supabase
          .from('cotizaciones')
          .update({
            numero_contenedor: editData.numero_contenedor || null,
            fecha_carga_contenedor: editData.fecha_carga || null,
            cantidad_cotizar: editData.unidades
          })
          .eq('id', editingItem.id)

        if (error) throw error
      } else {
        // Actualizar en transito_china
        const { error } = await supabase
          .from('transito_china')
          .update({
            sku: editData.sku,
            numero_contenedor: editData.numero_contenedor || null,
            fecha_contenedor: editData.fecha_carga || null,
            unidades: editData.unidades
          })
          .eq('id', editingItem.id)

        if (error) throw error
      }

      alert('✅ Registro actualizado exitosamente')
      setEditingItem(null)
      await cargarDatos()
    } catch (error: any) {
      console.error('Error actualizando:', error)
      alert('Error: ' + error.message)
    }
  }

  async function deleteItem(item: ContenedorItem) {
    const confirmMsg = `¿Eliminar ${item.sku} del contenedor ${item.numero_contenedor}?`
    if (!confirm(confirmMsg)) return

    try {
      if (item.origen === 'cotizacion') {
        // En cotizaciones, solo limpiamos los campos de contenedor
        const { error } = await supabase
          .from('cotizaciones')
          .update({
            numero_contenedor: null,
            fecha_carga_contenedor: null
          })
          .eq('id', item.id)

        if (error) throw error
      } else {
        // En transito_china, eliminamos el registro
        const { error } = await supabase
          .from('transito_china')
          .delete()
          .eq('id', item.id)

        if (error) throw error
      }

      alert('✅ Registro eliminado exitosamente')
      await cargarDatos()
    } catch (error: any) {
      console.error('Error eliminando:', error)
      alert('Error: ' + error.message)
    }
  }

  const resumen = {
    total: items.length,
    totalUnidades: items.reduce((sum, item) => sum + item.unidades, 0),
    contenedores: new Set(items.map(i => i.numero_contenedor).filter(Boolean)).size,
    deCotizacion: items.filter(i => i.origen === 'cotizacion').length,
    deCargaMasiva: items.filter(i => i.origen === 'carga_masiva').length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contenedores en Tránsito</h1>
        <p className="text-sm text-gray-500 mt-1">
          Seguimiento de mercadería cargada desde cotizaciones y carga masiva
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Items</p>
          <p className="text-2xl font-bold text-gray-900">{resumen.total}</p>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <p className="text-sm text-blue-600">Contenedores</p>
          <p className="text-2xl font-bold text-blue-700">{resumen.contenedores}</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <p className="text-sm text-green-600">Total Unidades</p>
          <p className="text-2xl font-bold text-green-700">{resumen.totalUnidades.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-purple-50 rounded-lg shadow p-4">
          <p className="text-sm text-purple-600">De Cotizaciones</p>
          <p className="text-2xl font-bold text-purple-700">{resumen.deCotizacion}</p>
        </div>
        <div className="bg-orange-50 rounded-lg shadow p-4">
          <p className="text-sm text-orange-600">Carga Masiva</p>
          <p className="text-2xl font-bold text-orange-700">{resumen.deCargaMasiva}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N° Contenedor</label>
            <input
              type="text"
              value={filtros.contenedor}
              onChange={(e) => setFiltros({ ...filtros, contenedor: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Buscar por contenedor..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
            <input
              type="text"
              value={filtros.sku}
              onChange={(e) => setFiltros({ ...filtros, sku: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Buscar por SKU..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input
              type="text"
              value={filtros.descripcion}
              onChange={(e) => setFiltros({ ...filtros, descripcion: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Buscar por descripción..."
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Mercadería en Tránsito
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} items en {resumen.contenedores} contenedores
          </p>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Cargando datos...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No hay contenedores en tránsito.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Carga</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Contenedor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unidades</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Origen</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item, idx) => (
                  <tr key={`${item.origen}-${item.id}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(item.fecha_carga).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                      {item.numero_contenedor || '—'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.sku}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 max-w-xs">
                      {item.descripcion || '—'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-semibold text-green-600">
                      {item.unidades.toLocaleString('es-CL')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        item.origen === 'cotizacion'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {item.origen === 'cotizacion' ? 'Cotización' : 'Carga Masiva'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {item.estado}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => startEdit(item)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteItem(item)}
                          className="text-red-600 hover:text-red-800 font-medium text-sm"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edición */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Editar Registro - {editingItem.origen === 'cotizacion' ? 'Cotización' : 'Carga Masiva'}
            </h3>

            <div className="space-y-4">
              {/* SKU (solo editable si es carga masiva) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  type="text"
                  value={editData.sku}
                  onChange={(e) => setEditData({ ...editData, sku: e.target.value })}
                  disabled={editingItem.origen === 'cotizacion'}
                  className={`w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                    editingItem.origen === 'cotizacion' ? 'bg-gray-100' : ''
                  }`}
                />
                {editingItem.origen === 'cotizacion' && (
                  <p className="text-xs text-gray-500 mt-1">No se puede editar SKU en cotizaciones</p>
                )}
              </div>

              {/* Unidades */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidades</label>
                <input
                  type="number"
                  value={editData.unidades}
                  onChange={(e) => setEditData({ ...editData, unidades: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Número de Contenedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° Contenedor</label>
                <input
                  type="text"
                  value={editData.numero_contenedor}
                  onChange={(e) => setEditData({ ...editData, numero_contenedor: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Fecha de Carga */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Carga</label>
                <input
                  type="date"
                  value={editData.fecha_carga}
                  onChange={(e) => setEditData({ ...editData, fecha_carga: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveEdit}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
              >
                Guardar
              </button>
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
