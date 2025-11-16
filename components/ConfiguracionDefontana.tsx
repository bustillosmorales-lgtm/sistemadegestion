'use client'

import { useState, useEffect } from 'react'

interface Props {
  onSuccess?: () => void
}

export default function ConfiguracionDefontana({ onSuccess }: Props) {
  const [isConfigured, setIsConfigured] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  const [config, setConfig] = useState({
    apiKey: '',
    companyId: '',
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
      const response = await fetch('/.netlify/functions/defontana-config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.configured) {
          setIsConfigured(true)
          setSyncInfo({
            lastSync: data.lastSync || null,
            totalSales: data.totalSales || 0
          })
        }
      }
    } catch (error) {
      console.error('Error verificando configuración:', error)
    }
  }

  async function handleSaveConfig() {
    if (!config.apiKey || !config.companyId) {
      alert('❌ Por favor completa todos los campos obligatorios')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/.netlify/functions/defontana-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(config)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al guardar configuración')
      }

      alert('✅ Configuración de Defontana guardada correctamente')
      setIsConfigured(true)
      setShowConfig(false)
      setConfig({ apiKey: '', companyId: '', environment: 'production' })

      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Error:', error)
      alert('❌ Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSyncSales() {
    if (!confirm('¿Sincronizar ventas desde Defontana? Esto puede tomar varios minutos.')) {
      return
    }

    setSyncing(true)
    try {
      const response = await fetch('/.netlify/functions/defontana-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          syncType: 'sales',
          dateFrom: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Último año
          dateTo: new Date().toISOString().split('T')[0]
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al sincronizar ventas')
      }

      alert(`✅ Sincronización completada\n\n` +
        `Ventas importadas: ${data.salesImported}\n` +
        `SKUs actualizados: ${data.skusUpdated}\n` +
        `Tiempo: ${data.timeElapsed}`)

      setSyncInfo({
        lastSync: new Date().toISOString(),
        totalSales: data.totalSales || 0
      })

      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Error:', error)
      alert('❌ Error al sincronizar: ' + error.message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('¿Desconectar Defontana? Deberás volver a configurar las credenciales.')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/.netlify/functions/defontana-config', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Error al desconectar')
      }

      alert('✅ Defontana desconectado correctamente')
      setIsConfigured(false)
      setSyncInfo({ lastSync: null, totalSales: 0 })
    } catch (error: any) {
      console.error('Error:', error)
      alert('❌ Error: ' + error.message)
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

          {/* Botones de acción */}
          <div className="flex gap-3">
            <button
              onClick={handleSyncSales}
              disabled={syncing}
              className="flex-1 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Sincronizando ventas...
                </>
              ) : (
                <>
                  🔄 Sincronizar Ventas Ahora
                </>
              )}
            </button>

            <button
              onClick={handleDisconnect}
              disabled={loading || syncing}
              className="px-5 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🔌 Desconectar
            </button>
          </div>

          {/* Información */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">ℹ️ Información:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              <li>Las ventas se sincronizan automáticamente cada 6 horas</li>
              <li>Puedes forzar una sincronización manual usando el botón azul</li>
              <li>Se importan ventas del último año por defecto</li>
              <li>Los datos se usan para mejorar las predicciones de demanda</li>
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
                  <li>API Key de Defontana (solicítala en tu panel de Defontana)</li>
                  <li>ID de tu empresa en Defontana</li>
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
                    API Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    placeholder="Tu API Key de Defontana"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Obtén tu API Key desde el panel de administración de Defontana
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID de Empresa <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.companyId}
                    onChange={(e) => setConfig({ ...config, companyId: e.target.value })}
                    placeholder="ID de tu empresa en Defontana"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Encuentra tu ID de empresa en la configuración de Defontana
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
                      setConfig({ apiKey: '', companyId: '', environment: 'production' })
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
