interface Prediccion {
  sugerencia_reposicion: number
  valor_total_sugerencia: number
  alertas: string[]
  clasificacion_abc: string
}

interface Props {
  predicciones: Prediccion[]
}

export default function StatsCards({ predicciones }: Props) {
  const totalSugerencias = predicciones.reduce((sum, p) => sum + p.sugerencia_reposicion, 0)
  const totalValor = predicciones.reduce((sum, p) => sum + p.valor_total_sugerencia, 0)
  const totalAlertas = predicciones.filter(p => p.alertas && p.alertas.length > 0).length
  const skusClaseA = predicciones.filter(p => p.clasificacion_abc === 'A').length

  const stats = [
    {
      name: 'Total a Comprar',
      value: totalSugerencias.toLocaleString('es-CL'),
      suffix: 'unidades',
      icon: '📦',
      color: 'blue'
    },
    {
      name: 'Valor Total',
      value: `$${(totalValor / 1000000).toFixed(1)}M`,
      suffix: 'CLP',
      icon: '💰',
      color: 'green'
    },
    {
      name: 'Alertas Activas',
      value: totalAlertas.toString(),
      suffix: 'productos',
      icon: '⚠️',
      color: totalAlertas > 0 ? 'red' : 'gray'
    },
    {
      name: 'Productos Clase A',
      value: skusClaseA.toString(),
      suffix: 'alta prioridad',
      icon: '⭐',
      color: 'yellow'
    }
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">{stat.icon}</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {stat.name}
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {stat.value}
                    </div>
                    <div className="ml-2 text-sm text-gray-500">
                      {stat.suffix}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
