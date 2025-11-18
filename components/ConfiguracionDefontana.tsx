'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { showSuccess, showError, showInfo } from '@/lib/utils/toast'

interface Props {
  onSuccess?: () => void
}

export default function ConfiguracionDefontana({ onSuccess }: Props) {
  const [isConfigured, setIsConfigured] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  const [config, setConfig] = useState({
    email: '',
    password: '',
    environment: 'production' as 'production' | 'sandbox'
  })

  const [syncInfo, setSyncInfo] = useState<{
    lastSync: string | null
    totalSales: number
  }>({
    lastSync: null,
    totalSales: 0
  })

  useEffect(() => {
    checkConfiguration()
  }, [])

  async function checkConfiguration() {
    try {
      const supabase = getSupabaseClient()

      // Check if Defontana is configured in configuracion_sistema
      const { data, error } = await supabase
        .from('configuracion_sistema')
        .select('clave, valor')
        .in('clave', ['defontana_email', 'defontana_password', 'defontana_activo'])

      if (!error && data && data.length > 0) {
        const configMap: Record<string, string> = {}
        data.forEach(item => {
          configMap[item.clave] = item.valor
        })

        if (configMap.defontana_activo === 'true' && configMap.defontana_email) {
          setIsConfigured(true)
        }
      }

      // Get last sync info
      const { data: syncData } = await supabase
        .from('sync_logs')
        .select('created_at, records_imported')
        .eq('integration', 'defontana')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (syncData) {
        setSyncInfo({
          lastSync: syncData.created_at,
          totalSales: syncData.records_imported || 0
        })
      }
    } catch (error) {
      console.error('Error verificando configuración:', error)
    }
  }

  async function handleSaveConfig() {
    if (!config.email || !config.password) {
      showError('Por favor completa todos los campos obligatorios')
      return
    }

    setLoading(true)
    try {
      const supabase = getSupabaseClient()

      // Save Defontana configuration to configuracion_sistema
      const updates = [
        { clave: 'defontana_email', valor: config.email, descripcion: 'Email para Defontana API' },
        { clave: 'defontana_password', valor: config.password, descripcion: 'Password para Defontana API' },
        { clave: 'defontana_activo', valor: 'true', descripcion: 'Defontana activado' }
      ]

      for (const item of updates) {
        const { error } = await supabase
          .from('configuracion_sistema')
          .upsert(item, { onConflict: 'clave' })

        if (error) throw error
      }

      showSuccess('Configuración de Defontana guardada correctamente')
      setIsConfigured(true)
      setShowConfig(false)
      setConfig({ email: '', password: '', environment: 'production' })

      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Error:', error)
      showError('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('¿Desconectar Defontana? Deberás volver a configurar las credenciales.')) {
      return
    }

    setLoading(true)
    try {
      const supabase = getSupabaseClient()

      // Set defontana_activo to false
      const { error } = await supabase
        .from('configuracion_sistema')
        .update({ valor: 'false' })
        .eq('clave', 'defontana_activo')

      if (error) throw error

      showSuccess('Defontana desconectado correctamente')
      setIsConfigured(false)
      setSyncInfo({ lastSync: null, totalSales: 0 })

      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Error:', error)
      showError('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔗</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Integración Defontana
            </h2>
            <p className="text-sm text-gray-600">
              {isConfigured
                ? '✅ Conectado - Sincroniza ventas automáticamente'
                : 'Conecta tu cuenta de Defontana para importar ventas'}
            </p>
          </div>
        </div>

        {isConfigured && (
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isConfigured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {isConfigured ? '● Conectado' : '○ Desconectado'}
            </span>
          </div>
        )}
      </div>

      {isConfigured ? (
        <div className="space-y-4">
          {/* Estado de sincronización */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-blue-600 font-medium">Última Sincronización</p>
                <p className="text-lg font-bold text-blue-900">
                  {syncInfo.lastSync
                    ? new Date(syncInfo.lastSync).toLocaleString('es-CL')
                    : 'Nunca'}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Ventas</p>
                <p className="text-lg font-bold text-blue-900">
                  {syncInfo.totalSales.toLocaleString('es-CL')}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium">Estado</p>
                <p className="text-lg font-bold text-green-700">
                  ✓ Activo
                </p>
              </div>
            </div>
          </div>

          {/* Botón de desconexión */}
          <div className="flex justify-end">
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="px-5 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🔌 Desconectar
            </button>
          </div>

          {/* Información */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Configuración Activa:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
              <li>Defontana está configurado y listo para sincronizar</li>
              <li>Usa el botón "Sincronizar Ventas" más abajo para importar datos</li>
              <li>Los datos importados mejoran las predicciones de demanda</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {!showConfig ? (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
              <div className="text-center mb-4">
                <p className="text-gray-700 mb-4">
                  Conecta tu cuenta de Defontana para importar ventas históricas y mejorar las predicciones de demanda.
                </p>
                <button
                  onClick={() => setShowConfig(true)}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium transition-colors"
                >
                  🔐 Configurar Conexión
                </button>
              </div>

              <div className="mt-4 p-4 bg-white rounded-lg border border-purple-300">
                <h4 className="font-semibold text-purple-900 mb-2">📋 Requisitos:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                  <li>Cuenta activa de Defontana en Chile</li>
                  <li>Email y contraseña de tu cuenta de Defontana</li>
                  <li>Acceso a la API de Defontana habilitado</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-purple-900 mb-4">
                Configurar Credenciales de Defontana
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={config.email}
                    onChange={(e) => setConfig({ ...config, email: e.target.value })}
                    placeholder="tu-email@empresa.cl"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Email de tu cuenta de Defontana
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={config.password}
                    onChange={(e) => setConfig({ ...config, password: e.target.value })}
                    placeholder="Tu contraseña de Defontana"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Contraseña de tu cuenta de Defontana
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ambiente
                  </label>
                  <select
                    value={config.environment}
                    onChange={(e) => setConfig({ ...config, environment: e.target.value as 'production' | 'sandbox' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="production">Producción</option>
                    <option value="sandbox">Sandbox (Pruebas)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSaveConfig}
                    disabled={loading}
                    className="flex-1 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Guardando...' : '💾 Guardar y Conectar'}
                  </button>
                  <button
                    onClick={() => {
                      setShowConfig(false)
                      setConfig({ email: '', password: '', environment: 'production' })
                    }}
                    disabled={loading}
                    className="px-5 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
