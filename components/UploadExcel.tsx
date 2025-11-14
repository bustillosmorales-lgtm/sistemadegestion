'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { procesarExcel } from '@/lib/api-client'

export default function UploadExcel() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

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
        '⚡ Procesamiento iniciado en segundo plano',
        '',
        '📍 El archivo se está procesando en GitHub Actions',
        '   Esto puede tardar 2-5 minutos dependiendo del tamaño',
        '',
        '🔗 Monitorea el progreso en:',
        result.info || 'GitHub Actions',
        '',
        '💡 Una vez completado, ejecuta el forecasting'
      ])

      // Limpiar el input
      event.target.value = ''

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
