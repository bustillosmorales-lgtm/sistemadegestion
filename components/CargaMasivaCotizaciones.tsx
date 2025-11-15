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
  const fileInputRespuesta = useRef<HTMLInputElement>(null)

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

  // ============================================
  // 2. RESPONDER COTIZACIONES (Proveedor)
  // ============================================

  const descargarTemplateRespuesta = async () => {
    try {
      setLoading(true)
      const XLSX = await import('xlsx')

      // Obtener cotizaciones pendientes
      const { data: cotizaciones, error } = await supabase
        .from('cotizaciones')
        .select('*')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!cotizaciones || cotizaciones.length === 0) {
        alert('ℹ️ No hay cotizaciones pendientes para responder')
        return
      }

      // Preparar datos para el template
      const datos = cotizaciones.map(c => ({
        'ID Cotización': c.id,
        'SKU': c.sku,
        'Descripción': c.descripcion || '',
        'Cantidad': c.cantidad_cotizar,
        'Precio Unitario': '', // A llenar por proveedor
        'CBM': '', // A llenar por proveedor
        'Embalaje': '', // A llenar por proveedor
        'Tiempo Entrega (días)': '', // A llenar por proveedor
        'Observaciones': ''
      }))

      // Crear workbook
      const ws = XLSX.utils.json_to_sheet(datos)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Respuesta Cotización')

      // Ajustar anchos de columna
      ws['!cols'] = [
        { wch: 15 }, // ID
        { wch: 20 }, // SKU
        { wch: 40 }, // Descripción
        { wch: 10 }, // Cantidad
        { wch: 15 }, // Precio
        { wch: 10 }, // CBM
        { wch: 15 }, // Embalaje
        { wch: 20 }, // Tiempo Entrega
        { wch: 30 }  // Observaciones
      ]

      // Descargar
      const fecha = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `Cotizaciones_Pendientes_${fecha}.xlsx`)

      alert(`✅ Template descargado con ${cotizaciones.length} cotización(es)\n\n💡 Instrucciones:\n1. Llena precio, CBM, embalaje y tiempo de entrega\n2. Agrega observaciones si es necesario\n3. Guarda y sube el archivo`)
    } catch (error: any) {
      console.error('Error descargando template:', error)
      alert('Error al descargar template: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const procesarRespuestaCotizacion = async (file: File) => {
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
        const idCotizacion = row['ID Cotización']
        const precioUnitario = parseFloat(row['Precio Unitario']) || null
        const cbm = parseFloat(row['CBM']) || null
        const embalaje = row['Embalaje'] || null
        const tiempoEntrega = parseInt(row['Tiempo Entrega (días)']) || null
        const observaciones = row['Observaciones'] || null

        // Validar
        if (!idCotizacion) {
          errores.push(`Fila sin ID de Cotización`)
          fallidas++
          continue
        }

        if (!precioUnitario || precioUnitario <= 0) {
          errores.push(`ID ${idCotizacion}: Precio unitario inválido`)
          fallidas++
          continue
        }

        // Actualizar cotización
        try {
          const { error } = await supabase
            .from('cotizaciones')
            .update({
              precio_cotizado: precioUnitario,
              cbm: cbm,
              embalaje: embalaje,
              tiempo_entrega_dias: tiempoEntrega,
              observaciones_proveedor: observaciones,
              estado: 'respondida',
              fecha_respuesta: new Date().toISOString()
            })
            .eq('id', idCotizacion)
            .eq('estado', 'pendiente') // Solo actualizar si está pendiente

          if (error) throw error
          exitosas++
        } catch (error: any) {
          errores.push(`Error en ID ${idCotizacion}: ${error.message}`)
          fallidas++
        }
      }

      // Mostrar resultado
      let mensaje = `✅ Procesamiento completado\n\n`
      mensaje += `Cotizaciones actualizadas: ${exitosas}\n`
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
      if (fileInputRespuesta.current) {
        fileInputRespuesta.current.value = ''
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
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        📁 Carga Masiva de Cotizaciones
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Solicitar Cotizaciones */}
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
        </div>

        {/* 2. Responder Cotizaciones */}
        <div className="border border-green-200 rounded-lg p-5 bg-green-50">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">💰</span>
            <h3 className="text-lg font-semibold text-green-900">
              Responder Cotizaciones
            </h3>
          </div>

          <p className="text-sm text-green-700 mb-4">
            Descarga las cotizaciones pendientes, llena precios y datos del proveedor, y sube el archivo para actualizarlas.
          </p>

          <div className="space-y-3">
            <button
              onClick={descargarTemplateRespuesta}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Cargando...
                </>
              ) : (
                <>
                  📥 Descargar Cotizaciones Pendientes
                </>
              )}
            </button>

            <div>
              <input
                ref={fileInputRespuesta}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) procesarRespuestaCotizacion(file)
                }}
                className="hidden"
                disabled={loading}
              />
              <button
                onClick={() => fileInputRespuesta.current?.click()}
                disabled={loading}
                className="w-full px-4 py-2.5 bg-white border-2 border-green-600 text-green-600 hover:bg-green-50 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Procesando...
                  </>
                ) : (
                  <>
                    📤 Subir Respuestas de Proveedor
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Instrucciones */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-2">📋 Instrucciones</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <p className="font-medium text-blue-900 mb-1">Solicitar Cotizaciones:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Descarga el template Excel</li>
              <li>Edita la columna "Cantidad a Cotizar"</li>
              <li>Guarda el archivo</li>
              <li>Súbelo usando el botón azul</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-green-900 mb-1">Responder Cotizaciones:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Descarga las cotizaciones pendientes</li>
              <li>Llena precio, CBM, embalaje, tiempo entrega</li>
              <li>Guarda el archivo</li>
              <li>Súbelo usando el botón verde</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
