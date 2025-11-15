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
        .select('id, sku, unidades, numero_contenedor, estado, created_at')
        .eq('estado', 'en_transito')

      if (filtros.contenedor) {
        queryTransito = queryTransito.ilike('numero_contenedor', `%${filtros.contenedor}%`)
      }
      if (filtros.sku) {
        queryTransito = queryTransito.ilike('sku', `%${filtros.sku}%`)
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
            descripcion: null,
            unidades: tra.unidades,
            numero_contenedor: tra.numero_contenedor,
            fecha_carga: tra.created_at,
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
