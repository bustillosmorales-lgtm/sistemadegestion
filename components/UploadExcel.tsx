'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { procesarExcel } from '@/lib/api-client'

export default function UploadExcel() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle')
  const [forecastStatus, setForecastStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle')
  const [runUrl, setRunUrl] = useState<string | null>(null)

  // Solicitar permiso para notificaciones al montar el componente
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  async function checkForecastingStatus() {
    setForecastStatus('processing')
    setProgress(prev => [...prev, '', '⚙️ Ejecutando forecasting...'])

    let attempts = 0
    const maxAttempts = 20 // 3-4 minutos (20 * 10 segundos)

    const interval = setInterval(async () => {
      attempts++

      try {
        // Llamar a GitHub API para obtener el estado del workflow de forecasting
        const response = await fetch('https://api.github.com/repos/bustillosmorales-lgtm/sistemadegestion/actions/runs?workflow_id=daily_forecast.yml&per_page=1')
        const data = await response.json()

        if (data.workflow_runs && data.workflow_runs.length > 0) {
          const latestRun = data.workflow_runs[0]
          const status = latestRun.status
          const conclusion = latestRun.conclusion

          if (status === 'completed') {
            clearInterval(interval)

            if (conclusion === 'success') {
              setForecastStatus('success')
              setProgress(prev => [
                ...prev,
                '',
                '🎉 ¡FORECASTING COMPLETADO!',
                '',
                '✅ Predicciones generadas y alertas creadas',
                '📊 Ya puedes empezar a analizar los resultados',
                '',
                '💡 Revisa las predicciones y alertas en el dashboard'
              ])

              // Notificación del navegador (si está permitido)
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Forecasting Completado', {
                  body: '¡Ya puedes analizar los resultados!',
                  icon: '/favicon.ico'
                })
              }
            } else {
              setForecastStatus('failed')
              setProgress(prev => [
                ...prev,
                '',
                '❌ El forecasting falló',
                `🔗 Revisa los detalles en: ${latestRun.html_url}`
              ])
            }
          } else if (status === 'in_progress' || status === 'queued') {
            setProgress(prev => {
              const newProgress = [...prev]
              if (newProgress[newProgress.length - 1].includes('Ejecutando forecasting')) {
                newProgress[newProgress.length - 1] = `⚙️ Ejecutando forecasting... (${attempts * 10}s)`
              }
              return newProgress
            })
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval)
          setForecastStatus('failed')
          setProgress(prev => [
            ...prev,
            '',
            '⏱️ Timeout verificando forecasting',
            '🔗 Revisa manualmente en GitHub Actions'
          ])
        }
      } catch (err) {
        console.error('Error checking forecast status:', err)
      }
    }, 10000) // Cada 10 segundos
  }

  async function checkProcessingStatus() {
    let attempts = 0
    const maxAttempts = 30 // 5 minutos (30 * 10 segundos)

    const interval = setInterval(async () => {
      attempts++

      try {
        // Llamar a GitHub Actions API para obtener el estado del último workflow
        const response = await fetch('https://api.github.com/repos/bustillosmorales-lgtm/sistemadegestion/actions/runs?event=workflow_dispatch&per_page=1')
        const data = await response.json()

        if (data.workflow_runs && data.workflow_runs.length > 0) {
          const latestRun = data.workflow_runs[0]
          const status = latestRun.status
          const conclusion = latestRun.conclusion

          if (status === 'completed') {
            clearInterval(interval)

            if (conclusion === 'success') {
              setProcessingStatus('success')
              setProgress(prev => [
                ...prev,
                '',
                '✅ PROCESAMIENTO COMPLETADO EXITOSAMENTE',
                '',
                '📊 Los datos han sido cargados a la base de datos',
                '🔄 Iniciando forecasting automáticamente...'
              ])

              // Iniciar monitoreo del forecasting
              setTimeout(() => {
                checkForecastingStatus()
              }, 15000) // Esperar 15 segundos para que inicie el workflow
            } else {
              setProcessingStatus('failed')
              setProgress(prev => [
                ...prev,
                '',
                '❌ El procesamiento falló',
                `🔗 Revisa los detalles en: ${latestRun.html_url}`
              ])
            }
          } else if (status === 'in_progress' || status === 'queued') {
            setProgress(prev => {
              const newProgress = [...prev]
              if (newProgress[newProgress.length - 1].includes('Verificando')) {
                newProgress[newProgress.length - 1] = `   Verificando estado... (${attempts * 10}s)`
              }
              return newProgress
            })
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval)
          setProcessingStatus('failed')
          setProgress(prev => [
            ...prev,
            '',
            '⏱️ Timeout verificando estado',
            '🔗 Revisa manualmente en GitHub Actions'
          ])
        }
      } catch (err) {
        console.error('Error checking status:', err)
      }
    }, 10000) // Cada 10 segundos
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar que sea Excel
    if (!file.name.match(/\.(xlsx|xlsm|xls)$/)) {
      setError('Solo se permiten archivos Excel (.xlsx, .xlsm, .xls)')
      return
    }

    setLoading(true)
    setError(null)
    setProgress(['📁 Subiendo archivo a Supabase Storage...'])

    try {
      // Verificar que el usuario está autenticado
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No hay sesión activa. Por favor inicia sesión nuevamente.')
      }

      // 1. Subir archivo a Supabase Storage
      const timestamp = Date.now()
      // Sanitizar nombre del archivo: remover caracteres especiales y acentos
      const sanitizedName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^a-zA-Z0-9.-]/g, '_')  // Remover caracteres especiales
      const filePath = `uploads/${timestamp}-${sanitizedName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('excel-uploads')
        .upload(filePath, file)

      if (uploadError) {
        // Si el bucket no existe, dar instrucciones
        if (uploadError.message.includes('not found')) {
          throw new Error(
            'Bucket "excel-uploads" no existe. Ve a Supabase → Storage → Create bucket "excel-uploads" (público)'
          )
        }
        throw uploadError
      }

      setProgress(prev => [...prev, '✅ Archivo subido correctamente'])
      setProgress(prev => [...prev, '⏳ Procesando Excel (esto puede tardar 1-2 minutos)...'])

      // 2. Llamar a Netlify Function para procesar (con autenticación automática)
      const result = await procesarExcel(filePath)

      // Mostrar resultados (procesamiento en background)
      setProgress(prev => [
        ...prev,
        '✅ Archivo enviado exitosamente',
        '',
        '⚡ Procesamiento iniciado en GitHub Actions',
        '   Verificando estado...'
      ])

      setProcessingStatus('processing')
      setRunUrl('https://github.com/bustillosmorales-lgtm/sistemadegestion/actions')

      // Limpiar el input
      event.target.value = ''

      // Comenzar a verificar el estado cada 10 segundos
      checkProcessingStatus()

    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Error desconocido')
      setProgress(prev => [...prev, `❌ Error: ${err.message}`])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        📤 Carga Masiva de Datos
      </h3>

      <div className="space-y-4">
        {/* Estado de procesamiento Excel */}
        {processingStatus !== 'idle' && (
          <div className={`border rounded-lg p-4 ${
            processingStatus === 'processing' ? 'bg-yellow-50 border-yellow-200' :
            processingStatus === 'success' ? 'bg-green-50 border-green-200' :
            'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {processingStatus === 'processing' && (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                    <span className="text-sm font-medium text-yellow-800">Procesando Excel...</span>
                  </>
                )}
                {processingStatus === 'success' && (
                  <>
                    <span className="text-green-600 mr-2">✅</span>
                    <span className="text-sm font-medium text-green-800">Excel procesado</span>
                  </>
                )}
                {processingStatus === 'failed' && (
                  <>
                    <span className="text-red-600 mr-2">❌</span>
                    <span className="text-sm font-medium text-red-800">Procesamiento falló</span>
                  </>
                )}
              </div>
              {runUrl && (
                <a
                  href={runUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Ver detalles
                </a>
              )}
            </div>
          </div>
        )}

        {/* Estado de forecasting */}
        {forecastStatus !== 'idle' && (
          <div className={`border rounded-lg p-4 ${
            forecastStatus === 'processing' ? 'bg-blue-50 border-blue-200' :
            forecastStatus === 'success' ? 'bg-green-50 border-green-200' :
            'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {forecastStatus === 'processing' && (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    <span className="text-sm font-medium text-blue-800">Ejecutando forecasting...</span>
                  </>
                )}
                {forecastStatus === 'success' && (
                  <>
                    <span className="text-green-600 mr-2">🎉</span>
                    <span className="text-sm font-medium text-green-800">Forecasting completado - ¡Listo para analizar!</span>
                  </>
                )}
                {forecastStatus === 'failed' && (
                  <>
                    <span className="text-red-600 mr-2">❌</span>
                    <span className="text-sm font-medium text-red-800">Forecasting falló</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Advertencia importante */}
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-amber-600 text-xl mr-2">⚠️</span>
            <div>
              <h4 className="text-sm font-bold text-amber-900 mb-1">
                IMPORTANTE: Carga Completa de Datos
              </h4>
              <p className="text-sm text-amber-800">
                El Excel debe contener <strong>TODO el historial de datos</strong>.
                Al subir un nuevo archivo, <strong>se borrarán TODOS los datos anteriores</strong> de la base de datos
                y se reemplazarán con la información del Excel.
              </p>
            </div>
          </div>
        </div>

        {/* Instrucciones */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">
            📋 Formato del Excel requerido:
          </h4>
          <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
            <li>Hoja <strong>"ventas"</strong>: Columnas A=Empresa, B=Canal, F=Fecha, K=Unidades, T=SKU, U=MLC, V=Descripción, X=Precio</li>
            <li>Hoja <strong>"Stock"</strong>: Columnas A=SKU, B=Descripción, C-J=Stock por bodega</li>
            <li>Hoja <strong>"transito china"</strong>: Columnas D=SKU, H=Total Units</li>
            <li>Hoja <strong>"compras"</strong>: Columnas A=SKU, D=Fecha</li>
            <li>Hoja <strong>"Packs"</strong>: Columnas A=SKU Pack, B=SKU Componente, C=Cantidad</li>
            <li>Hoja <strong>"desconsiderar"</strong> (opcional): Columna A=SKU</li>
          </ul>
        </div>

        {/* Input de archivo */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
          <input
            type="file"
            accept=".xlsx,.xlsm,.xls"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
            id="excel-upload"
          />
          <label
            htmlFor="excel-upload"
            className={`cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="text-4xl mb-2">📊</div>
            <div className="text-sm font-medium text-gray-700">
              {loading ? 'Procesando...' : 'Haz click para seleccionar Excel'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              .xlsx, .xlsm o .xls
            </div>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">❌ {error}</p>
          </div>
        )}

        {/* Progreso */}
        {progress.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Log de procesamiento:</h4>
            <div className="text-xs text-gray-700 font-mono space-y-1">
              {progress.map((msg, idx) => (
                <div key={idx}>{msg}</div>
              ))}
            </div>
          </div>
        )}

        {/* Botón para limpiar log */}
        {progress.length > 0 && !loading && (
          <button
            onClick={() => setProgress([])}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            🗑️ Limpiar log
          </button>
        )}
      </div>
    </div>
  )
}
