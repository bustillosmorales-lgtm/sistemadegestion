'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

interface Configuracion {
  id: number
  clave: string
  valor: number
  descripcion: string
  unidad: string | null
  valor_minimo: number | null
  valor_maximo: number | null
  updated_at: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function ConfiguracionModal({ isOpen, onClose }: Props) {
  const [configuraciones, setConfiguraciones] = useState<Configuracion[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editedValues, setEditedValues] = useState<Record<string, number>>({})

  useEffect(() => {
    if (isOpen) {
      cargarConfiguraciones()
    }
  }, [isOpen])

  async function cargarConfiguraciones() {
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('configuracion_sistema')
        .select('*')
        .order('clave')

      if (error) throw error

      setConfiguraciones(data || [])

      // Inicializar valores editados
      const initial: Record<string, number> = {}
      data?.forEach(c => {
        initial[c.clave] = c.valor
      })
      setEditedValues(initial)
    } catch (error: any) {
      console.error('Error cargando configuraciones:', error)
      alert('Error cargando configuraciones: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function guardarConfiguraciones() {
    setSaving(true)
    try {
      const supabase = getSupabaseClient()

      // Actualizar cada configuración modificada
      for (const config of configuraciones) {
        const newValue = editedValues[config.clave]
        if (newValue !== config.valor) {
          // Validar rango
          if (config.valor_minimo !== null && newValue < config.valor_minimo) {
            throw new Error(`${config.clave}: Valor mínimo es ${config.valor_minimo}`)
          }
          if (config.valor_maximo !== null && newValue > config.valor_maximo) {
            throw new Error(`${config.clave}: Valor máximo es ${config.valor_maximo}`)
          }

          const { error } = await supabase
            .from('configuracion_sistema')
            .update({ valor: newValue })
            .eq('id', config.id)

          if (error) throw error
        }
      }

      alert('✅ Configuración guardada correctamente')
      await cargarConfiguraciones()
      onClose()
    } catch (error: any) {
      console.error('Error guardando configuraciones:', error)
      alert('Error guardando configuraciones: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  function handleValueChange(clave: string, value: string) {
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      setEditedValues(prev => ({
        ...prev,
        [clave]: numValue
      }))
    }
  }

  function formatClave(clave: string): string {
    return clave
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">⚙️ Configuración del Sistema</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Ajusta los parámetros del algoritmo de forecasting
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-gray-500">Cargando configuraciones...</div>
            </div>
          ) : configuraciones.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No hay configuraciones disponibles.</p>
              <p className="text-sm text-gray-500">
                Ejecuta el SQL de create_configuracion_table.sql en Supabase primero.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Parámetros de Stock */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                  📦 Parámetros de Inventario
                </h3>
                <div className="space-y-4">
                  {configuraciones
                    .filter(c =>
                      c.clave.includes('dias_stock') ||
                      c.clave.includes('dias_transito') ||
                      c.clave.includes('nivel_servicio') ||
                      c.clave.includes('dias_historico')
                    )
                    .map(config => (
                      <ConfiguracionItem
                        key={config.id}
                        config={config}
                        value={editedValues[config.clave] || config.valor}
                        onChange={(v) => handleValueChange(config.clave, v)}
                      />
                    ))}
                </div>
              </div>

              {/* Parámetros de Algoritmo */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                  🤖 Parámetros de Algoritmo
                </h3>
                <div className="space-y-4">
                  {configuraciones
                    .filter(c =>
                      c.clave.includes('umbral_intermitencia') ||
                      c.clave.includes('alpha_ewma') ||
                      c.clave.includes('iqr_multiplicador')
                    )
                    .map(config => (
                      <ConfiguracionItem
                        key={config.id}
                        config={config}
                        value={editedValues[config.clave] || config.valor}
                        onChange={(v) => handleValueChange(config.clave, v)}
                      />
                    ))}
                </div>
              </div>

              {/* Clasificación ABC-XYZ */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                  📊 Clasificación ABC-XYZ
                </h3>
                <div className="space-y-4">
                  {configuraciones
                    .filter(c => c.clave.includes('umbral_abc') || c.clave.includes('umbral_xyz'))
                    .map(config => (
                      <ConfiguracionItem
                        key={config.id}
                        config={config}
                        value={editedValues[config.clave] || config.valor}
                        onChange={(v) => handleValueChange(config.clave, v)}
                      />
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={guardarConfiguraciones}
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            disabled={saving || loading || configuraciones.length === 0}
          >
            {saving ? 'Guardando...' : '💾 Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfiguracionItem({
  config,
  value,
  onChange
}: {
  config: Configuracion
  value: number
  onChange: (value: string) => void
}) {
  const step = config.unidad === '%' || config.unidad === 'factor' || config.unidad === 'CV' ? 0.01 : 1

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700">
          {formatClave(config.clave)}
        </label>
        <p className="text-xs text-gray-500 mt-1">{config.descripcion}</p>
      </div>
      <div className="flex items-center gap-2 sm:w-48">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          step={step}
          min={config.valor_minimo || undefined}
          max={config.valor_maximo || undefined}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {config.unidad && (
          <span className="text-sm text-gray-600 whitespace-nowrap">
            {config.unidad}
          </span>
        )}
      </div>
    </div>
  )
}

function formatClave(clave: string): string {
  return clave
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
