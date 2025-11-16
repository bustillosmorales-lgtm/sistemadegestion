'use client'

import { useState, useRef } from 'react'
import { useSupabase } from '@/lib/SupabaseProvider'
import { fetchCotizaciones, updateCotizacion } from '@/lib/api-client'

interface Props {
  onSuccess?: () => void
}

export default function ResponderCotizacionesMasivo({ onSuccess }: Props) {
  const supabase = useSupabase()
  const [loading, setLoading] = useState(false)
  const fileInputRespuesta = useRef<HTMLInputElement>(null)

  const descargarTemplateCotizaciones = async () => {
    try {
      setLoading(true)
      const XLSX = await import('xlsx')

      // Usar API endpoint para obtener cotizaciones pendientes
      const response = await fetchCotizaciones({ estado: 'pendiente' })

      if (!response.success || !response.cotizaciones || response.cotizaciones.length === 0) {
        alert('ℹ️ No hay cotizaciones pendientes para responder')
        return
      }

      const cotizaciones = response.cotizaciones

      // Preparar datos para el template
      const datos = cotizaciones.map(c => ({
        'ID Cotización': c.id,
        'SKU': c.sku,
        'Descripción': c.descripcion || '',
        'Cantidad': c.cantidad_cotizar,
        'Costo Proveedor': '', // A llenar por proveedor (sin moneda en el nombre)
        'Moneda': 'RMB', // Pre-llenado con RMB (moneda predeterminada)
        'Cantidad Mínima Venta': '', // A llenar por proveedor
        'Unidades por Embalaje': '', // A llenar por proveedor
        'CBM por Embalaje': '', // A llenar por proveedor
        'Tiempo Entrega (días)': '', // A llenar por proveedor
        'Notas Proveedor': ''
      }))

      // Crear workbook
      const ws = XLSX.utils.json_to_sheet(datos)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Respuesta Cotización')

      // Ajustar anchos de columna
      ws['!cols'] = [
        { wch: 12 }, // ID
        { wch: 20 }, // SKU
        { wch: 40 }, // Descripción
        { wch: 10 }, // Cantidad
        { wch: 20 }, // Costo Proveedor
        { wch: 10 }, // Moneda
        { wch: 20 }, // Cantidad Mínima
        { wch: 20 }, // Unidades por Embalaje
        { wch: 18 }, // CBM
        { wch: 20 }, // Tiempo Entrega
        { wch: 30 }  // Notas
      ]

      // Descargar
      const fecha = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `Cotizaciones_Pendientes_${fecha}.xlsx`)

      alert(`✅ Template descargado con ${cotizaciones.length} cotización(es)\n\n💡 Instrucciones:\n1. Llena todos los campos del proveedor\n2. Costo Proveedor es OBLIGATORIO\n3. Guarda y sube el archivo`)
    } catch (error: any) {
      console.error('Error descargando template:', error)
      alert('Error al descargar template: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const procesarRespuestasCotizacion = async (file: File) => {
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
        const costoProveedor = parseFloat(row['Costo Proveedor']) || null
        const moneda = row['Moneda'] || 'RMB'
        const cantidadMinima = parseInt(row['Cantidad Mínima Venta']) || null
        const unidadesPorEmbalaje = parseInt(row['Unidades por Embalaje']) || null
        const cbm = parseFloat(row['CBM por Embalaje']) || null
        const tiempoEntrega = parseInt(row['Tiempo Entrega (días)']) || null
        const notasProveedor = row['Notas Proveedor'] || null

        // Validar
        if (!idCotizacion) {
          errores.push(`Fila sin ID de Cotización`)
          fallidas++
          continue
        }

        if (!costoProveedor || costoProveedor <= 0) {
          errores.push(`ID ${idCotizacion}: Costo Proveedor es obligatorio`)
          fallidas++
          continue
        }

        // Actualizar cotización usando API endpoint
        try {
          await updateCotizacion(idCotizacion, {
            estado: 'respondida',
            costo_proveedor: costoProveedor,
            moneda: moneda,
            cantidad_minima_venta: cantidadMinima,
            unidades_por_embalaje: unidadesPorEmbalaje,
            metros_cubicos_embalaje: cbm,
            notas_proveedor: notasProveedor
          })
          exitosas++
        } catch (error: any) {
          errores.push(`Error en ID ${idCotizacion}: ${error.message}`)
          fallidas++
        }
      }

      // Mostrar resultado
      let mensaje = `✅ Procesamiento completado\n\n`
      mensaje += `Total filas procesadas: ${jsonData.length}\n`
      mensaje += `Cotizaciones actualizadas: ${exitosas}\n`
      mensaje += `Fallidas: ${fallidas}\n`

      if (fallidas > 0) {
        mensaje += `\n❌ Errores:\n${errores.slice(0, 10).join('\n')}`
        if (errores.length > 10) {
          mensaje += `\n... y ${errores.length - 10} más`
        }
      }

      if (exitosas > 0) {
        mensaje += `\n\n✅ El dashboard se actualizará automáticamente`
      }

      alert(mensaje)

      // Llamar callback SIEMPRE para actualizar dashboard
      if (onSuccess) {
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
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">💰</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Responder Cotizaciones Masivamente
          </h2>
          <p className="text-sm text-gray-600">
            Descarga las cotizaciones pendientes, llena los datos del proveedor y sube el archivo
          </p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-5">
        <div className="space-y-3">
          <button
            onClick={descargarTemplateCotizaciones}
            disabled={loading}
            className="w-full px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Cargando cotizaciones pendientes...
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
                if (file) procesarRespuestasCotizacion(file)
              }}
              className="hidden"
              disabled={loading}
            />
            <button
              onClick={() => fileInputRespuesta.current?.click()}
              disabled={loading}
              className="w-full px-5 py-3 bg-white border-2 border-green-600 text-green-600 hover:bg-green-50 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Procesando respuestas...
                </>
              ) : (
                <>
                  📤 Subir Respuestas del Proveedor
                </>
              )}
            </button>
          </div>
        </div>

        {/* Instrucciones */}
        <div className="mt-4 p-4 bg-white rounded-lg border border-green-300">
          <h4 className="font-semibold text-green-900 mb-2">📋 Cómo usar:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
            <li>Descarga el Excel con cotizaciones pendientes</li>
            <li>Llena: <span className="font-semibold">Costo Proveedor (obligatorio)</span>, Cantidad Mínima, Unidades/Embalaje, CBM, Tiempo Entrega</li>
            <li>Guarda el archivo Excel</li>
            <li>Súbelo usando el botón verde</li>
            <li>Las cotizaciones cambiarán a estado "respondida"</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
