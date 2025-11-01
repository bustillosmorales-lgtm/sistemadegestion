interface Props {
  filtros: {
    abc: string
    busqueda: string
    soloAlertas: boolean
  }
  setFiltros: (filtros: any) => void
}

export default function Filtros({ filtros, setFiltros }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Búsqueda por SKU */}
        <div>
          <label htmlFor="busqueda" className="block text-sm font-medium text-gray-700 mb-1">
            Buscar SKU
          </label>
          <input
            type="text"
            id="busqueda"
            placeholder="Ej: SKU001"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            value={filtros.busqueda}
            onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
          />
        </div>

        {/* Filtro ABC */}
        <div>
          <label htmlFor="abc" className="block text-sm font-medium text-gray-700 mb-1">
            Clasificación ABC
          </label>
          <select
            id="abc"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            value={filtros.abc}
            onChange={(e) => setFiltros({ ...filtros, abc: e.target.value })}
          >
            <option value="">Todas</option>
            <option value="A">Clase A (Alta prioridad)</option>
            <option value="B">Clase B (Media)</option>
            <option value="C">Clase C (Baja)</option>
          </select>
        </div>

        {/* Filtro Alertas */}
        <div className="flex items-end">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              checked={filtros.soloAlertas}
              onChange={(e) => setFiltros({ ...filtros, soloAlertas: e.target.checked })}
            />
            <span className="ml-2 text-sm text-gray-700">
              Solo con alertas ⚠️
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
