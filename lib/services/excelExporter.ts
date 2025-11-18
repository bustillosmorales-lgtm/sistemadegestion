/**
 * Excel Exporter Service
 * Handles all Excel export functionality
 */

import * as XLSX from 'xlsx'
import { fetchDatosBD } from '@/lib/api-client'
import type {
  Prediccion,
  VentaHistorica,
  Stock,
  Transito,
  Compra,
  Pack,
} from '@/lib/types'
import { EXCEL_SHEET_NAMES, COLUMNAS_EXCEL } from '@/lib/constants'
import { handleApiError } from '@/lib/utils/errorHandler'
import { showSuccess, showError } from '@/lib/utils/toast'

/**
 * Transform prediction data for Excel export
 */
function transformPredictionsForExcel(predicciones: Prediccion[]) {
  return predicciones.map((p) => ({
    SKU: p.sku,
    Descripción: p.descripcion || '',
    Clase: `${p.clasificacion_abc}-${p.clasificacion_xyz}`,
    'Venta Diaria': p.venta_diaria_p50.toFixed(1),
    'Precio Unitario': p.precio_unitario,
    'Stock Actual': p.stock_actual,
    'Stock Óptimo': p.stock_optimo,
    'Días Stock': p.dias_stock_actual.toFixed(0),
    'Tránsito China': p.transito_china,
    'Sugerencia Reposición': p.sugerencia_reposicion,
    'Valor Total Sugerencia': p.valor_total_sugerencia,
    'Coef. Variación': p.coeficiente_variacion.toFixed(2),
    Tendencia: p.tendencia,
    Modelo: p.modelo_usado,
    Alertas: p.alertas ? p.alertas.join(', ') : '',
    'MAPE %': p.mape_backtesting ? p.mape_backtesting.toFixed(1) : '',
  }))
}

/**
 * Transform sales data for Excel export
 */
function transformSalesForExcel(ventas: any[]) {
  return ventas.map((v: any) => ({
    Empresa: v.empresa,
    Canal: v.canal,
    Fecha: v.fecha,
    SKU: v.sku,
    MLC: v.mlc || '',
    Descripción: v.descripcion || '',
    Unidades: v.unidades,
    Precio: v.precio,
  }))
}

/**
 * Transform stock data for Excel export
 */
function transformStockForExcel(stock: any[]) {
  return stock.map((s: any) => ({
    SKU: s.sku,
    Descripción: s.descripcion || '',
    'Bodega C': s.bodega_c || 0,
    'Bodega D': s.bodega_d || 0,
    'Bodega E': s.bodega_e || 0,
    'Bodega F': s.bodega_f || 0,
    'Bodega H': s.bodega_h || 0,
    'Bodega J': s.bodega_j || 0,
  }))
}

/**
 * Transform transit data for Excel export
 */
function transformTransitForExcel(transito: any[]) {
  return transito.map((t: any) => ({
    SKU: t.sku,
    Unidades: t.unidades,
    Estado: t.estado,
  }))
}

/**
 * Transform purchase data for Excel export
 */
function transformPurchasesForExcel(compras: any[]) {
  return compras.map((c: any) => ({
    SKU: c.sku,
    'Fecha Compra': c.fecha_compra,
  }))
}

/**
 * Transform pack data for Excel export
 */
function transformPacksForExcel(packs: any[]) {
  return packs.map((p: any) => ({
    'SKU Pack': p.sku_pack,
    'SKU Componente': p.sku_componente,
    Cantidad: p.cantidad,
  }))
}

/**
 * Transform SKUs to exclude for Excel export
 */
function transformExcludedSkusForExcel(desconsiderar: any[]) {
  return desconsiderar.map((d: any) => ({
    SKU: d.sku,
  }))
}

/**
 * Fetch all data needed for complete Excel export
 */
async function fetchAllExportData() {
  console.log('Fetching all data for Excel export...')

  const [
    ventasResponse,
    stockResponse,
    transitoResponse,
    comprasResponse,
    packsResponse,
    desconsiderarResponse,
  ] = await Promise.all([
    fetchDatosBD('ventas').catch(() => ({ data: [] })),
    fetchDatosBD('stock').catch(() => ({ data: [] })),
    fetchDatosBD('transito').catch(() => ({ data: [] })),
    fetchDatosBD('compras').catch(() => ({ data: [] })),
    fetchDatosBD('packs').catch(() => ({ data: [] })),
    fetchDatosBD('desconsiderar').catch(() => ({ data: [] })),
  ])

  return {
    ventas: ventasResponse.data || [],
    stock: stockResponse.data || [],
    transito: transitoResponse.data || [],
    compras: comprasResponse.data || [],
    packs: packsResponse.data || [],
    desconsiderar: desconsiderarResponse.data || [],
  }
}

/**
 * Create Excel workbook with predictions and supporting data
 */
export async function exportForecastingToExcel(
  predicciones: Prediccion[]
): Promise<void> {
  try {
    console.log('Starting Excel export...')

    // Fetch all supporting data
    const {
      ventas,
      stock,
      transito,
      compras,
      packs,
      desconsiderar,
    } = await fetchAllExportData()

    // Transform all data
    const datosPredicciones = transformPredictionsForExcel(predicciones)
    const datosVentas = transformSalesForExcel(ventas)
    const datosStock = transformStockForExcel(stock)
    const datosTransito = transformTransitForExcel(transito)
    const datosCompras = transformPurchasesForExcel(compras)
    const datosPacks = transformPacksForExcel(packs)
    const datosDesconsiderar = transformExcludedSkusForExcel(desconsiderar)

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Sheet 1: Predictions (main sheet)
    const wsPredicciones = XLSX.utils.json_to_sheet(datosPredicciones)
    wsPredicciones['!cols'] = COLUMNAS_EXCEL.PREDICCIONES
    XLSX.utils.book_append_sheet(wb, wsPredicciones, EXCEL_SHEET_NAMES.PREDICCIONES)

    // Sheet 2: Sales
    if (datosVentas.length > 0) {
      const wsVentas = XLSX.utils.json_to_sheet(datosVentas)
      wsVentas['!cols'] = COLUMNAS_EXCEL.VENTAS
      XLSX.utils.book_append_sheet(wb, wsVentas, EXCEL_SHEET_NAMES.VENTAS)
    }

    // Sheet 3: Stock
    if (datosStock.length > 0) {
      const wsStock = XLSX.utils.json_to_sheet(datosStock)
      wsStock['!cols'] = COLUMNAS_EXCEL.STOCK
      XLSX.utils.book_append_sheet(wb, wsStock, EXCEL_SHEET_NAMES.STOCK)
    }

    // Sheet 4: Transit
    if (datosTransito.length > 0) {
      const wsTransito = XLSX.utils.json_to_sheet(datosTransito)
      wsTransito['!cols'] = COLUMNAS_EXCEL.TRANSITO
      XLSX.utils.book_append_sheet(wb, wsTransito, EXCEL_SHEET_NAMES.TRANSITO)
    }

    // Sheet 5: Purchases
    if (datosCompras.length > 0) {
      const wsCompras = XLSX.utils.json_to_sheet(datosCompras)
      wsCompras['!cols'] = COLUMNAS_EXCEL.COMPRAS
      XLSX.utils.book_append_sheet(wb, wsCompras, EXCEL_SHEET_NAMES.COMPRAS)
    }

    // Sheet 6: Packs
    if (datosPacks.length > 0) {
      const wsPacks = XLSX.utils.json_to_sheet(datosPacks)
      wsPacks['!cols'] = COLUMNAS_EXCEL.PACKS
      XLSX.utils.book_append_sheet(wb, wsPacks, EXCEL_SHEET_NAMES.PACKS)
    }

    // Sheet 7: Excluded SKUs
    if (datosDesconsiderar.length > 0) {
      const wsDesconsiderar = XLSX.utils.json_to_sheet(datosDesconsiderar)
      wsDesconsiderar['!cols'] = COLUMNAS_EXCEL.DESCONSIDERAR
      XLSX.utils.book_append_sheet(
        wb,
        wsDesconsiderar,
        EXCEL_SHEET_NAMES.DESCONSIDERAR
      )
    }

    // Generate filename with current date
    const fecha = new Date().toISOString().split('T')[0]
    const filename = `Forecasting_Completo_${fecha}.xlsx`

    // Download file
    XLSX.writeFile(wb, filename)

    // Show success message
    const message = `Excel exportado correctamente con ${wb.SheetNames.length} pestañas\n\n` +
      `Incluye predicciones y datos de BD para validación:\n` +
      `- ${datosVentas.length} ventas\n` +
      `- ${datosStock.length} SKUs en stock\n` +
      `- ${datosTransito.length} en tránsito\n` +
      `- ${datosCompras.length} compras\n` +
      `- ${datosPacks.length} packs\n` +
      `- ${datosDesconsiderar.length} desconsiderados`

    showSuccess(message)
  } catch (error: any) {
    const errorMsg = handleApiError(error, 'export to Excel')
    console.error('Error exporting to Excel:', error)
    showError(`Error al exportar a Excel: ${errorMsg}`)
  }
}

/**
 * Export predictions only (lightweight version)
 */
export async function exportPredictionsOnly(
  predicciones: Prediccion[]
): Promise<void> {
  try {
    const datosPredicciones = transformPredictionsForExcel(predicciones)

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datosPredicciones)
    ws['!cols'] = COLUMNAS_EXCEL.PREDICCIONES

    XLSX.utils.book_append_sheet(wb, ws, EXCEL_SHEET_NAMES.PREDICCIONES)

    const fecha = new Date().toISOString().split('T')[0]
    const filename = `Predicciones_${fecha}.xlsx`

    XLSX.writeFile(wb, filename)

    showSuccess(`${predicciones.length} predicciones exportadas`)
  } catch (error: any) {
    const errorMsg = handleApiError(error, 'export predictions')
    console.error('Error exporting predictions:', error)
    showError(`Error al exportar predicciones: ${errorMsg}`)
  }
}
