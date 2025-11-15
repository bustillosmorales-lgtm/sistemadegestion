'use client'

import { useState, useRef } from 'react'
import { useSupabase } from '@/lib/SupabaseProvider'
import { createCotizacion } from '@/lib/api-client'

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
      const datos = predicciones.map(p => ({
        'SKU': p.sku,
        'Descripción': p.descripcion || '',
        'Stock Actual': p.stock_actual,
        'Días Stock': p.dias_stock_actual,
        'Sugerencia Sistema': p.sugerencia_reposicion,
        'Cantidad a Cotizar': p.sugerencia_reposicion, // Pre-llenado con sugerencia
        'Notas': ''
      }))

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

      alert('✅ Template descargado\n\n💡 Instrucciones:\n1. Edita la columna "Cantidad a Cotizar"\n2. Agrega notas si es necesario\n3. Guarda y sube el archivo')
    } catch (error: any) {
      console.error('Error descargando template:', error)
      alert('Error al descargar template: ' + error.message)
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

        // Validar
        if (!sku) {
          errores.push(`Fila sin SKU`)
          fallidas++
          continue
        }

        if (cantidad <= 0) {
          continue // Saltar si cantidad es 0
        }

        // Buscar predicción para obtener datos
        const prediccion = predicciones.find(p => p.sku === sku)
        if (!prediccion) {
          errores.push(`SKU ${sku} no encontrado en predicciones`)
          fallidas++
          continue
        }

        // Crear cotización
        try {
          await createCotizacion({
            sku: sku,
            descripcion: prediccion.descripcion,
            cantidad_cotizar: cantidad,
            precio_unitario: prediccion.precio_unitario,
            notas: notas || 'Carga masiva - Solicitud de cotización'
          })
          exitosas++
        } catch (error: any) {
          errores.push(`Error en ${sku}: ${error.message}`)
          fallidas++
        }
      }

      // Mostrar resultado
      let mensaje = `✅ Procesamiento completado\n\n`
      mensaje += `Cotizaciones creadas: ${exitosas}\n`
      if (fallidas > 0) {
        mensaje += `Fallidas: ${fallidas}\n\n`
        mensaje += `Errores:\n${errores.slice(0, 5).join('\n')}`
        if (errores.length > 5) {
          mensaje += `\n... y ${errores.length - 5} más`
        }
      }
      alert(mensaje)

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
      alert('Error al procesar archivo: ' + error.message)
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
            Descarga el template con todos los productos, edita las cantidades y súbelo para crear cotizaciones
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
            Descarga el template con todos los productos, edita las cantidades y súbelo para crear cotizaciones masivamente.
          </p>

          <div className="space-y-3">
            <button
              onClick={descargarTemplateSolicitud}
              disabled={loading || predicciones.length === 0}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              📥 Descargar Template ({predicciones.length} productos)
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
              <li>Descarga el template Excel con todos los productos</li>
              <li>Edita la columna "Cantidad a Cotizar" según tus necesidades</li>
              <li>Pon 0 en productos que NO quieras cotizar</li>
              <li>Guarda el archivo Excel</li>
              <li>Súbelo usando el botón azul</li>
              <li>Las cotizaciones se crearán automáticamente</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
