'use client'

import { memo, useMemo, useState, useEffect } from 'react'
import { createCotizacion } from '@/lib/api-client'
import { showSuccess, showError, showWarning } from '@/lib/utils/toast'

interface Prediccion {
  id: number
  sku: string
  descripcion: string
  sugerencia_reposicion: number
  precio_unitario: number
  valor_total_sugerencia: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  prediccionesSeleccionadas: Prediccion[]
  onSuccess?: () => void
}

function CotizarMasivoModal({ isOpen, onClose, prediccionesSeleccionadas, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)

  // Estado para cantidades editables (Map de SKU -> cantidad)
  const [cantidades, setCantidades] = useState<Map<string, number>>(() => {
    const map = new Map<string, number>()
    prediccionesSeleccionadas.forEach(p => {
      map.set(p.sku, p.sugerencia_reposicion)
    })
    return map
  })

  // Actualizar cantidades cuando cambian las predicciones seleccionadas
  useEffect(() => {
    const map = new Map<string, number>()
    prediccionesSeleccionadas.forEach(p => {
      map.set(p.sku, p.sugerencia_reposicion)
    })
    setCantidades(map)
  }, [prediccionesSeleccionadas])

  // Calcular totales basados en cantidades editadas
  const totales = useMemo(() => {
    let totalUnidades = 0
    let valorTotal = 0

    prediccionesSeleccionadas.forEach(p => {
      const cantidad = cantidades.get(p.sku) || 0
      totalUnidades += cantidad
      valorTotal += cantidad * p.precio_unitario
    })

    return { totalUnidades, valorTotal }
  }, [prediccionesSeleccionadas, cantidades])

  // Función para manejar cambio de cantidad
  const handleCantidadChange = (sku: string, value: string) => {
    const cantidad = value === '' ? 0 : parseInt(value)
    if (!isNaN(cantidad) && cantidad >= 0) {
      setCantidades(prev => {
        const newMap = new Map(prev)
        newMap.set(sku, cantidad)
        return newMap
      })
    }
  }

  // Generar texto para copiar usando cantidades editadas
  const textoCotizacion = useMemo(() => {
    let texto = '📋 SOLICITUD DE COTIZACIÓN MASIVA\n\n'
    texto += `Total de productos: ${prediccionesSeleccionadas.length}\n`
    texto += `Total de unidades: ${totales.totalUnidades.toLocaleString('es-CL')}\n`
    texto += `Valor total estimado: $${totales.valorTotal.toLocaleString('es-CL')}\n\n`
    texto += '─'.repeat(80) + '\n\n'

    prediccionesSeleccionadas.forEach((pred, index) => {
      const cantidad = cantidades.get(pred.sku) || 0
      const valorTotal = cantidad * pred.precio_unitario

      texto += `${index + 1}. SKU: ${pred.sku}\n`
      texto += `   Descripción: ${pred.descripcion || 'Sin descripción'}\n`
      texto += `   Cantidad solicitada: ${cantidad.toLocaleString('es-CL')} unidades\n`
      texto += `   Precio unitario ref.: $${pred.precio_unitario.toLocaleString('es-CL')}\n`
      texto += `   Valor total ref.: $${valorTotal.toLocaleString('es-CL')}\n\n`
    })

    texto += '─'.repeat(80) + '\n'
    texto += `\nTOTAL GENERAL: $${totales.valorTotal.toLocaleString('es-CL')}\n`

    return texto
  }, [prediccionesSeleccionadas, cantidades, totales])

  const handleCrearCotizaciones = async () => {
    setLoading(true)
    try {
      let exitosas = 0
      let fallidas = 0

      // Crear cotizaciones en paralelo usando cantidades editadas
      const promesas = prediccionesSeleccionadas.map(async (pred) => {
        const cantidad = cantidades.get(pred.sku) || 0

        // No crear cotización si cantidad es 0
        if (cantidad === 0) {
          return
        }

        try {
          await createCotizacion({
            sku: pred.sku,
            descripcion: pred.descripcion,
            cantidad_cotizar: cantidad,  // ← Usar cantidad editada
            precio_unitario: pred.precio_unitario,
            notas: cantidad === pred.sugerencia_reposicion
              ? 'Cotización masiva - Cantidad recomendada por sistema'
              : `Cotización masiva - Cantidad ajustada (recomendado: ${pred.sugerencia_reposicion})`
          })
          exitosas++
        } catch (error) {
          console.error(`Error creando cotización para ${pred.sku}:`, error)
          fallidas++
        }
      })

      await Promise.all(promesas)

      if (fallidas === 0) {
        showSuccess(`${exitosas} cotización(es) creadas exitosamente`)
      } else {
        showWarning(`Cotizaciones creadas: ${exitosas}\nFallidas: ${fallidas}`)
      }

      // Llamar callback de éxito para actualizar dashboard
      if (onSuccess) {
        onSuccess()
      }

      onClose()
    } catch (error: any) {
      console.error('Error en cotización masiva:', error)
      showError('Error al crear cotizaciones: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(textoCotizacion)
      showSuccess('Cotización copiada al portapapeles')
    } catch (error) {
      console.error('Error copiando:', error)
      showError('Error al copiar al portapapeles')
    }
  }

  const handleDescargarTxt = () => {
    const blob = new Blob([textoCotizacion], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const fecha = new Date().toISOString().split('T')[0]
    link.download = `Cotizacion_Masiva_${fecha}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                📋 Cotización Masiva
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {prediccionesSeleccionadas.length} producto(s) seleccionado(s) con cantidades recomendadas
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Resumen de totales */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-500 font-medium">Total Productos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {prediccionesSeleccionadas.length}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-500 font-medium">Total Unidades</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {totales.totalUnidades.toLocaleString('es-CL')}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-500 font-medium">Valor Total Estimado</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                ${(totales.valorTotal / 1000000).toFixed(2)}M
              </p>
            </div>
          </div>
        </div>

        {/* Lista de productos */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {prediccionesSeleccionadas.map((pred, index) => (
              <div
                key={pred.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-gray-900">{pred.sku}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 ml-8">
                      {pred.descripcion || 'Sin descripción'}
                    </p>
                    <div className="flex gap-4 mt-3 ml-8 items-center">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Cantidad a Cotizar
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={cantidades.get(pred.sku) || 0}
                            onChange={(e) => handleCantidadChange(pred.sku, e.target.value)}
                            disabled={loading}
                            className="w-32 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                          />
                          <span className="text-sm text-gray-500">unidades</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Recomendado: {pred.sugerencia_reposicion.toLocaleString('es-CL')} un.
                        </p>
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="block text-xs text-gray-400 mb-1">P. Unit.</span>
                        <span className="font-semibold text-gray-700">
                          ${pred.precio_unitario.toLocaleString('es-CL')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Valor Total</p>
                    <p className="text-lg font-bold text-green-600">
                      ${(((cantidades.get(pred.sku) || 0) * pred.precio_unitario) / 1000).toFixed(0)}k
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer con acciones */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCrearCotizaciones}
                disabled={loading}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin">⏳</span>
                    Creando...
                  </>
                ) : (
                  <>
                    ✅ Crear Cotización
                  </>
                )}
              </button>
              <button
                onClick={handleDescargarTxt}
                disabled={loading}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                💾 Descargar TXT
              </button>
              <button
                onClick={handleCopiar}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                📋 Copiar
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            💡 Tip: Puedes ajustar las cantidades antes de crear la cotización. Las cantidades recomendadas se muestran como referencia.
          </p>
        </div>
      </div>
    </div>
  )
}

export default memo(CotizarMasivoModal)
