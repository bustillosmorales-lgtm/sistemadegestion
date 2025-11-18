'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { createCotizacion } from '@/lib/api-client'
import { showSuccess, showError } from '@/lib/utils/toast'

interface CotizarModalProps {
  isOpen: boolean
  onClose: () => void
  sku: string
  descripcion: string
  sugerenciaReposicion: number
  precioUnitario: number
  onSuccess?: () => void
}

function CotizarModal({
  isOpen,
  onClose,
  sku,
  descripcion,
  sugerenciaReposicion,
  precioUnitario,
  onSuccess
}: CotizarModalProps) {
  const [cantidadCotizar, setCantidadCotizar] = useState(sugerenciaReposicion)
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)

  // Memoizar cálculo del valor total
  const valorTotal = useMemo(() => {
    return cantidadCotizar * precioUnitario
  }, [cantidadCotizar, precioUnitario])

  // Optimizar handlers con useCallback
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await createCotizacion({
        sku,
        descripcion,
        cantidad_cotizar: cantidadCotizar,
        precio_unitario: precioUnitario,
        notas: notas.trim() || undefined
      })

      showSuccess(`Cotización creada para ${sku}\nCantidad: ${cantidadCotizar} unidades`)

      if (onSuccess) {
        onSuccess()
      }

      onClose()
    } catch (error: any) {
      console.error('Error creando cotización:', error)
      showError('Error al crear cotización: ' + error.message)
    } finally {
      setLoading(false)
    }
  }, [sku, descripcion, cantidadCotizar, precioUnitario, notas, onSuccess, onClose])

  const handleCantidadChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Actualizar directamente sin parsear, el parsing se hace al enviar
    if (value === '' || /^\d+$/.test(value)) {
      setCantidadCotizar(value === '' ? 0 : parseInt(value))
    }
  }, [])

  const handleNotasChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotas(e.target.value)
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                  <span className="text-2xl">📋</span>
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                  <h3 className="text-base font-semibold leading-6 text-gray-900">
                    Crear Cotización
                  </h3>
                  <div className="mt-4 space-y-4">
                    {/* SKU y Descripción */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        SKU
                      </label>
                      <p className="mt-1 text-sm text-gray-900 font-semibold">{sku}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Descripción
                      </label>
                      <p className="mt-1 text-sm text-gray-600">{descripcion || '—'}</p>
                    </div>

                    {/* Cantidad a Cotizar */}
                    <div>
                      <label htmlFor="cantidad" className="block text-sm font-medium text-gray-700">
                        Cantidad a Cotizar
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <input
                          type="number"
                          id="cantidad"
                          min="1"
                          max={sugerenciaReposicion}
                          value={cantidadCotizar}
                          onChange={handleCantidadChange}
                          className="block w-full rounded-md border-gray-300 pr-16 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          required
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">unidades</span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Sugerencia total: {sugerenciaReposicion.toLocaleString('es-CL')} unidades
                      </p>
                    </div>

                    {/* Precio Unitario */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Precio Unitario
                      </label>
                      <p className="mt-1 text-sm text-gray-900">
                        ${precioUnitario.toLocaleString('es-CL')}
                      </p>
                    </div>

                    {/* Valor Total */}
                    <div className="bg-blue-50 p-3 rounded-md">
                      <label className="block text-sm font-medium text-blue-900">
                        Valor Total Cotización
                      </label>
                      <p className="mt-1 text-lg font-bold text-blue-600">
                        ${valorTotal.toLocaleString('es-CL')}
                      </p>
                    </div>

                    {/* Notas */}
                    <div>
                      <label htmlFor="notas" className="block text-sm font-medium text-gray-700">
                        Notas (opcional)
                      </label>
                      <textarea
                        id="notas"
                        rows={3}
                        value={notas}
                        onChange={handleNotasChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Agregar observaciones..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
              <button
                type="submit"
                disabled={loading || cantidadCotizar < 1 || cantidadCotizar > sugerenciaReposicion}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed sm:w-auto"
              >
                {loading ? 'Creando...' : 'Crear Cotización'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 sm:mt-0 sm:w-auto"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Exportar con memo para evitar re-renders innecesarios
export default memo(CotizarModal)
