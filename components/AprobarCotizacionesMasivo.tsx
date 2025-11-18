'use client'

import { useState, useRef } from 'react'
import { useSupabase } from '@/lib/SupabaseProvider'
import { fetchCotizaciones, updateCotizacion } from '@/lib/api-client'
import { showSuccess, showError, showInfo } from '@/lib/utils/toast'

interface Props {
  onSuccess?: () => void
}

export default function AprobarCotizacionesMasivo({ onSuccess }: Props) {
  const supabase = useSupabase()
  const [loading, setLoading] = useState(false)
  const fileInputAprobacion = useRef<HTMLInputElement>(null)

  const descargarTemplateCotizacionesRespondidas = async () => {
    try {
      setLoading(true)
      const XLSX = await import('xlsx')

      // Obtener cotizaciones respondidas (listas para aprobar/rechazar)
      const response = await fetchCotizaciones({ estado: 'respondida' })

      if (!response.success || !response.cotizaciones || response.cotizaciones.length === 0) {
        showInfo('No hay cotizaciones respondidas para aprobar/rechazar')
        return
      }

      const cotizaciones = response.cotizaciones

      // Preparar datos para el template
      const datos = cotizaciones.map(c => ({
        'ID Cotización': c.id,
        'SKU': c.sku,
        'Descripción': c.descripcion || '',
        'Cantidad Cotizada': c.cantidad_cotizar,
        'Costo Proveedor': c.costo_proveedor || '',
        'Moneda': c.moneda || '',
        'Cantidad Mínima': c.cantidad_minima_venta || '',
        'Unidades/Embalaje': c.unidades_por_embalaje || '',
        'CBM': c.metros_cubicos_embalaje || '',
        'Tiempo Entrega (días)': c.tiempo_entrega_dias || '',
        'Notas Proveedor': c.notas_proveedor || '',
        'Decisión': '', // A LLENAR: "aprobada" o "rechazada"
        'Notas de Decisión': '' // Opcional: comentarios sobre la decisión
      }))

      // Crear workbook
      const ws = XLSX.utils.json_to_sheet(datos)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Aprobar Cotizaciones')

      // Ajustar anchos de columna
      ws['!cols'] = [
        { wch: 12 }, // ID
        { wch: 20 }, // SKU
        { wch: 40 }, // Descripción
        { wch: 12 }, // Cantidad
        { wch: 15 }, // Costo Proveedor
        { wch: 10 }, // Moneda
        { wch: 15 }, // Cantidad Mínima
        { wch: 18 }, // Unidades/Embalaje
        { wch: 10 }, // CBM
        { wch: 18 }, // Tiempo Entrega
        { wch: 30 }, // Notas Proveedor
        { wch: 15 }, // Decisión
        { wch: 35 }  // Notas de Decisión
      ]

      // Descargar
      const fecha = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `Cotizaciones_Respondidas_${fecha}.xlsx`)

      showSuccess(`Template descargado con ${cotizaciones.length} cotización(es)\n\nInstrucciones:\n1. Revisa los datos del proveedor (columnas 5-11)\n2. En "Decisión" escribe: aprobada o rechazada\n3. Opcionalmente agrega "Notas de Decisión"\n4. Guarda y sube el archivo`)
    } catch (error: any) {
      console.error('Error descargando template:', error)
      showError('Error al descargar template: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const procesarAprobacionesCotizacion = async (file: File) => {
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
        const decision = (row['Decisión'] || '').toString().toLowerCase().trim()
        const notasDecision = row['Notas de Decisión'] || null

        // Validar
        if (!idCotizacion) {
          errores.push(`Fila sin ID de Cotización`)
          fallidas++
          continue
        }

        if (!decision) {
          errores.push(`ID ${idCotizacion}: Decisión es obligatoria`)
          fallidas++
          continue
        }

        // Validar que la decisión sea válida
        if (decision !== 'aprobada' && decision !== 'rechazada') {
          errores.push(`ID ${idCotizacion}: Decisión debe ser "aprobada" o "rechazada" (encontrado: "${decision}")`)
          fallidas++
          continue
        }

        // Actualizar cotización usando API endpoint
        try {
          const updateData: any = {
            estado: decision as 'aprobada' | 'rechazada'
          }

          // Solo agregar notas si hay contenido
          if (notasDecision) {
            updateData.notas = notasDecision
          }

          await updateCotizacion(idCotizacion, updateData)
          exitosas++
        } catch (error: any) {
          errores.push(`Error en ID ${idCotizacion}: ${error.message}`)
          fallidas++
        }
      }

      // Mostrar resultado
      let mensaje = `Procesamiento completado\n\n`
      mensaje += `Total filas procesadas: ${jsonData.length}\n`
      mensaje += `Cotizaciones actualizadas: ${exitosas}\n`
      mensaje += `Fallidas: ${fallidas}\n`

      if (fallidas > 0) {
        mensaje += `\nErrores:\n${errores.slice(0, 10).join('\n')}`
        if (errores.length > 10) {
          mensaje += `\n... y ${errores.length - 10} más`
        }
      }

      if (exitosas > 0) {
        mensaje += `\n\nEl dashboard se actualizará automáticamente`
      }

      if (fallidas > 0 && exitosas > 0) {
        showInfo(mensaje)
      } else if (fallidas > 0) {
        showError(mensaje)
      } else {
        showSuccess(mensaje)
      }

      // Llamar callback SIEMPRE para actualizar dashboard
      if (onSuccess) {
        onSuccess()
      }

      // Limpiar input
      if (fileInputAprobacion.current) {
        fileInputAprobacion.current.value = ''
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
        <span className="text-3xl">✅</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Aprobar/Rechazar Cotizaciones Masivamente
          </h2>
          <p className="text-sm text-gray-600">
            Descarga las cotizaciones respondidas, decide aprobar o rechazar y sube el archivo
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <div className="space-y-3">
          <button
            onClick={descargarTemplateCotizacionesRespondidas}
            disabled={loading}
            className="w-full px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Cargando cotizaciones respondidas...
              </>
            ) : (
              <>
                📥 Descargar Cotizaciones Respondidas
              </>
            )}
          </button>

          <div>
            <input
              ref={fileInputAprobacion}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) procesarAprobacionesCotizacion(file)
              }}
              className="hidden"
              disabled={loading}
            />
            <button
              onClick={() => fileInputAprobacion.current?.click()}
              disabled={loading}
              className="w-full px-5 py-3 bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Procesando decisiones...
                </>
              ) : (
                <>
                  📤 Subir Decisiones
                </>
              )}
            </button>
          </div>
        </div>

        {/* Instrucciones */}
        <div className="mt-4 p-4 bg-white rounded-lg border border-blue-300">
          <h4 className="font-semibold text-blue-900 mb-2">📋 Cómo usar:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
            <li>Descarga el Excel con cotizaciones respondidas</li>
            <li>Revisa los datos del proveedor (costo, tiempo de entrega, etc.)</li>
            <li>En la columna <span className="font-semibold">"Decisión"</span> escribe: <span className="font-mono bg-green-100 px-1">aprobada</span> o <span className="font-mono bg-red-100 px-1">rechazada</span></li>
            <li>Opcionalmente agrega comentarios en "Notas de Decisión"</li>
            <li>Guarda el archivo Excel</li>
            <li>Súbelo usando el botón azul</li>
            <li>Las cotizaciones cambiarán a estado "aprobada" o "rechazada"</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
