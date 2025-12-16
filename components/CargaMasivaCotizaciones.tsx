'use client'

import { useState, useRef } from 'react'
import { useSupabase } from '@/lib/SupabaseProvider'
import { createCotizacion } from '@/lib/api-client'
import { showSuccess, showError, showInfo } from '@/lib/utils/toast'

interface Props {
  predicciones: any[]
  onSuccess?: () => void
}

export default function CargaMasivaCotizaciones({ predicciones, onSuccess }: Props) {
  const supabase = useSupabase()
  const [loading, setLoading] = useState(false)
  const fileInputSolicitud = useRef<HTMLInputElement>(null)

  // ============================================
  // 1. SOLICITAR COTIZACIONES (Usuario/Comprador)
  // ============================================

  const descargarTemplateSolicitud = async () => {
    try {
      const XLSX = await import('xlsx')

      // Preparar datos para el template
      const datos = []

      // Si hay predicciones, incluirlas
      if (predicciones && predicciones.length > 0) {
        predicciones.forEach(p => {
          datos.push({
            'SKU': p.sku,
            'Descripción': p.descripcion || '',
            'Stock Actual': p.stock_actual || 0,
            'Días Stock': p.dias_stock_actual || 0,
            'Sugerencia Sistema': p.sugerencia_reposicion || 0,
            'Cantidad a Cotizar': p.sugerencia_reposicion || 0, // Pre-llenado con sugerencia
            'Notas': ''
          })
        })
      }

      // Agregar 20 filas vacías para SKUs manuales
      // NOTA: El usuario puede agregar CUANTAS filas quiera, no hay límite
      const emptyRows = predicciones && predicciones.length > 0 ? 20 : 30
      for (let i = 0; i < emptyRows; i++) {
        datos.push({
          'SKU': '',
          'Descripción': '',
          'Stock Actual': 0,
          'Días Stock': 0,
          'Sugerencia Sistema': 0,
          'Cantidad a Cotizar': 0,
          'Notas': ''
        })
      }

      // Crear workbook
      const ws = XLSX.utils.json_to_sheet(datos)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Solicitud Cotización')

      // Ajustar anchos de columna
      ws['!cols'] = [
        { wch: 20 }, // SKU
        { wch: 40 }, // Descripción
        { wch: 12 }, // Stock Actual
        { wch: 12 }, // Días Stock
        { wch: 18 }, // Sugerencia
        { wch: 18 }, // Cantidad a Cotizar
        { wch: 30 }  // Notas
      ]

      // Descargar
      const fecha = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `Template_Solicitud_Cotizacion_${fecha}.xlsx`)

      const mensaje = predicciones && predicciones.length > 0
        ? 'Template descargado con productos sugeridos\n\nInstrucciones:\n1. Edita la columna "Cantidad a Cotizar"\n2. Puedes agregar SKUs nuevos en las filas vacías\n3. Agrega notas si es necesario\n4. Guarda y sube el archivo'
        : 'Template descargado con filas vacías\n\nInstrucciones:\n1. Completa SKU y Descripción\n2. Define la "Cantidad a Cotizar"\n3. Agrega notas si es necesario\n4. Guarda y sube el archivo\n\nPuedes agregar tantas filas como necesites!'

      showSuccess(mensaje)
    } catch (error: any) {
      console.error('Error descargando template:', error)
      showError('Error al descargar template: ' + error.message)
    }
  }

  const procesarSolicitudCotizacion = async (file: File) => {
    setLoading(true)
    try {
      const XLSX = await import('xlsx')

      // Leer archivo
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      let exitosas = 0
      let fallidas = 0
      const errores: string[] = []

      // Procesar cada fila
      for (const row of jsonData) {
        const sku = row['SKU']
        const cantidad = parseInt(row['Cantidad a Cotizar']) || 0
        const notas = row['Notas'] || ''
        const descripcion = row['Descripción'] || row['Descripcion'] || ''

        // Validar
        if (!sku) {
          errores.push(`Fila sin SKU`)
          fallidas++
          continue
        }

        if (cantidad <= 0) {
          continue // Saltar si cantidad es 0
        }

        // CAMBIO: Ya no requiere que el SKU esté en predicciones
        // Buscar predicción para obtener datos adicionales si existe
        const prediccion = predicciones.find(p => p.sku === sku)

        // Crear cotización con datos del Excel o de predicción si existe
        try {
          await createCotizacion({
            sku: sku,
            descripcion: descripcion || prediccion?.descripcion || `Producto ${sku}`,
            cantidad_cotizar: cantidad,
            precio_unitario: prediccion?.precio_unitario || 0,
            notas: notas || 'Carga masiva - Solicitud de cotización'
          })
          exitosas++
        } catch (error: any) {
          errores.push(`Error en ${sku}: ${error.message}`)
          fallidas++
        }
      }

      // Mostrar resultado
      let mensaje = `Procesamiento completado\n\n`
      mensaje += `Cotizaciones creadas: ${exitosas}\n`
      if (fallidas > 0) {
        mensaje += `Fallidas: ${fallidas}\n\n`
        mensaje += `Errores:\n${errores.slice(0, 5).join('\n')}`
        if (errores.length > 5) {
          mensaje += `\n... y ${errores.length - 5} más`
        }
      }
      if (fallidas > 0 && exitosas > 0) {
        showInfo(mensaje)
      } else if (fallidas > 0) {
        showError(mensaje)
      } else {
        showSuccess(mensaje)
      }

      // Llamar callback de éxito
      if (onSuccess && exitosas > 0) {
        onSuccess()
      }

      // Limpiar input
      if (fileInputSolicitud.current) {
        fileInputSolicitud.current.value = ''
      }
    } catch (error: any) {
      console.error('Error procesando archivo:', error)
      showError('Error al procesar archivo: ' + error.message)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">📤</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Solicitar Cotizaciones Masivamente
          </h2>
          <p className="text-sm text-gray-600">
            Descarga el template (con o sin productos sugeridos), completa los SKUs y cantidades, y súbelo para crear cotizaciones
          </p>
        </div>
      </div>

      <div className="border border-blue-200 rounded-lg p-5 bg-blue-50">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📤</span>
            <h3 className="text-lg font-semibold text-blue-900">
              Solicitar Cotizaciones
            </h3>
          </div>

          <p className="text-sm text-blue-700 mb-4">
            {predicciones && predicciones.length > 0
              ? 'Descarga el template con productos sugeridos, edita cantidades y puedes agregar SKUs nuevos en las filas vacías.'
              : 'Descarga el template vacío para solicitar cotizaciones de cualquier SKU, incluso sin análisis de reposición.'}
          </p>

          <div className="space-y-3">
            <button
              onClick={descargarTemplateSolicitud}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              📥 Descargar Template {predicciones.length > 0 ? `(${predicciones.length} productos + filas vacías)` : '(Solo filas vacías)'}
            </button>

            <div>
              <input
                ref={fileInputSolicitud}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) procesarSolicitudCotizacion(file)
                }}
                className="hidden"
                disabled={loading}
              />
              <button
                onClick={() => fileInputSolicitud.current?.click()}
                disabled={loading}
                className="w-full px-4 py-2.5 bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Procesando...
                  </>
                ) : (
                  <>
                    📤 Subir Excel con Cantidades
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Instrucciones */}
          <div className="mt-4 p-4 bg-white rounded-lg border border-blue-300">
            <h4 className="font-semibold text-blue-900 mb-2">📋 Cómo usar:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
              <li>Descarga el template Excel con productos sugeridos</li>
              <li>Edita la columna "Cantidad a Cotizar" según tus necesidades</li>
              <li><strong>NUEVO:</strong> Puedes agregar SKUs nuevos en las filas vacías (o agregar más filas, sin límite)</li>
              <li>Pon 0 en productos que NO quieras cotizar</li>
              <li>Guarda el archivo Excel</li>
              <li>Súbelo usando el botón azul</li>
              <li>Si el SKU no existe, se creará automáticamente en la base de datos</li>
            </ol>
          </div>
        </div>
      </div>
  )
}
