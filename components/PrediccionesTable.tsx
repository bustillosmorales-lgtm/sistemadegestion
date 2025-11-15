'use client'

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

interface Props {
  predicciones: Prediccion[]
  onExcludeToggle: (sku: string, descripcion: string) => Promise<void>
  onCotizar: (prediccion: Prediccion) => void
}

export default function PrediccionesTable({ predicciones, onExcludeToggle, onCotizar }: Props) {
  const getClaseABCColor = (clase: string) => {
    switch (clase) {
      case 'A': return 'bg-red-100 text-red-800'
      case 'B': return 'bg-yellow-100 text-yellow-800'
      case 'C': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTendenciaTexto = (tendencia: string) => {
    switch (tendencia) {
      case 'creciente': return 'Creciente'
      case 'decreciente': return 'Decreciente'
      case 'estable': return 'Estable'
      default: return 'Desconocida'
    }
  }

  const getTendenciaColor = (tendencia: string) => {
    switch (tendencia) {
      case 'creciente': return 'text-green-600'
      case 'decreciente': return 'text-red-600'
      case 'estable': return 'text-gray-600'
      default: return 'text-gray-400'
    }
  }

  const getDiasStockColor = (dias: number) => {
    if (dias < 60) return 'text-red-600 font-semibold'
    if (dias < 120) return 'text-yellow-600'
    return 'text-gray-600'
  }

  return (
    <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
          <tr>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Excluir
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-blue-600 uppercase tracking-wider">
              Cotizar
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              SKU
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Descripción
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Clase
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Venta/Día
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Precio Unit.
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stock Actual
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stock Óptimo
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Días Stock
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tránsito 🚢
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sugerencia
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Valor Total
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Volatilidad
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tendencia
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Modelo
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Alertas
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {predicciones.map((pred) => (
            <tr key={pred.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-3 whitespace-nowrap text-center">
                <input
                  type="checkbox"
                  onChange={() => onExcludeToggle(pred.sku, pred.descripcion)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded cursor-pointer"
                  title="Excluir este SKU del análisis"
                />
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-center">
                <button
                  onClick={() => onCotizar(pred)}
                  className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                  title="Crear cotización para este producto"
                >
                  📋 Cotizar
                </button>
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-900">
                  {pred.sku}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-700 line-clamp-2">
                  {pred.descripcion || '—'}
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getClaseABCColor(pred.clasificacion_abc)}`}>
                  {pred.clasificacion_abc}-{pred.clasificacion_xyz}
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                {pred.venta_diaria_p50.toFixed(1)}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right text-sm text-blue-600 font-medium">
                ${pred.precio_unitario.toLocaleString('es-CL')}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                {pred.stock_actual.toLocaleString('es-CL')}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                {pred.stock_optimo.toLocaleString('es-CL')}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right text-sm">
                <span className={getDiasStockColor(pred.dias_stock_actual)}>
                  {pred.dias_stock_actual.toFixed(0)} días
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right text-sm text-orange-600">
                {pred.transito_china.toLocaleString('es-CL')}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                {pred.sugerencia_reposicion.toLocaleString('es-CL')}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-semibold text-green-600">
                ${(pred.valor_total_sugerencia / 1000).toFixed(0)}k
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-center text-sm">
                <span className={pred.coeficiente_variacion > 1 ? 'text-red-600 font-semibold' : pred.coeficiente_variacion > 0.5 ? 'text-yellow-600' : 'text-green-600'} title="Coeficiente de Variación (volatilidad)">
                  {pred.coeficiente_variacion.toFixed(2)}
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-center text-sm">
                <span className={`font-medium ${getTendenciaColor(pred.tendencia)}`}>
                  {getTendenciaTexto(pred.tendencia)}
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-center text-xs">
                <span className="inline-flex px-2 py-1 rounded-full bg-purple-100 text-purple-800 font-medium" title={`Modelo de predicción: ${pred.modelo_usado}`}>
                  {pred.modelo_usado}
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-center">
                {pred.alertas && pred.alertas.length > 0 ? (
                  <span
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                    title={pred.alertas.join('\n')}
                  >
                    ⚠️ {pred.alertas.length}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
