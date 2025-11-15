'use client'

import { memo, useMemo } from 'react'

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
}

function CotizarMasivoModal({ isOpen, onClose, prediccionesSeleccionadas }: Props) {
  // Calcular totales
  const totales = useMemo(() => {
    const totalUnidades = prediccionesSeleccionadas.reduce(
      (sum, p) => sum + p.sugerencia_reposicion,
      0
    )
    const valorTotal = prediccionesSeleccionadas.reduce(
      (sum, p) => sum + p.valor_total_sugerencia,
      0
    )
    return { totalUnidades, valorTotal }
  }, [prediccionesSeleccionadas])

  // Generar texto para copiar
  const textoCotizacion = useMemo(() => {
    let texto = '📋 SOLICITUD DE COTIZACIÓN MASIVA\n\n'
    texto += `Total de productos: ${prediccionesSeleccionadas.length}\n`
    texto += `Total de unidades: ${totales.totalUnidades.toLocaleString('es-CL')}\n`
    texto += `Valor total estimado: $${totales.valorTotal.toLocaleString('es-CL')}\n\n`
    texto += '─'.repeat(80) + '\n\n'

    prediccionesSeleccionadas.forEach((pred, index) => {
      texto += `${index + 1}. SKU: ${pred.sku}\n`
      texto += `   Descripción: ${pred.descripcion || 'Sin descripción'}\n`
      texto += `   Cantidad solicitada: ${pred.sugerencia_reposicion.toLocaleString('es-CL')} unidades\n`
      texto += `   Precio unitario ref.: $${pred.precio_unitario.toLocaleString('es-CL')}\n`
      texto += `   Valor total ref.: $${pred.valor_total_sugerencia.toLocaleString('es-CL')}\n\n`
    })

    texto += '─'.repeat(80) + '\n'
    texto += `\nTOTAL GENERAL: $${totales.valorTotal.toLocaleString('es-CL')}\n`
    texto += `\nNota: Las cantidades indicadas son las recomendadas por el sistema de forecasting.\n`

    return texto
  }, [prediccionesSeleccionadas, totales])

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(textoCotizacion)
      alert('✅ Cotización copiada al portapapeles')
    } catch (error) {
      console.error('Error copiando:', error)
      alert('❌ Error al copiar al portapapeles')
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
                    <div className="flex gap-4 mt-2 ml-8 text-sm">
                      <span className="text-gray-500">
                        Cantidad: <span className="font-semibold text-blue-600">
                          {pred.sugerencia_reposicion.toLocaleString('es-CL')} un.
                        </span>
                      </span>
                      <span className="text-gray-500">
                        P. Unit.: <span className="font-semibold text-gray-700">
                          ${pred.precio_unitario.toLocaleString('es-CL')}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Valor Total</p>
                    <p className="text-lg font-bold text-green-600">
                      ${(pred.valor_total_sugerencia / 1000).toFixed(0)}k
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
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleDescargarTxt}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors flex items-center gap-2"
              >
                💾 Descargar TXT
              </button>
              <button
                onClick={handleCopiar}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-2"
              >
                📋 Copiar al Portapapeles
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Las cantidades indicadas son las recomendadas automáticamente por el sistema de forecasting
          </p>
        </div>
      </div>
    </div>
  )
}

export default memo(CotizarMasivoModal)
