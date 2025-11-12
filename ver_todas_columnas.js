require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Viendo todas las columnas disponibles en predicciones...\n')

  const { data } = await supabase
    .from('predicciones')
    .select('*')
    .gte('fecha_calculo', '2025-11-12')
    .limit(1)

  if (data && data.length > 0) {
    const pred = data[0]

    console.log('📊 Datos disponibles para mostrar:\n')
    console.log(`SKU: ${pred.sku}`)
    console.log(`Descripción: ${pred.descripcion}`)
    console.log(`\n💰 PRECIOS Y VALORES:`)
    console.log(`  - Precio unitario: $${pred.precio_unitario?.toLocaleString('es-CL') || 0}`)
    console.log(`  - Valor total sugerencia: $${(pred.valor_total_sugerencia/1000).toFixed(0)}k`)
    console.log(`\n📈 VENTAS:`)
    console.log(`  - Venta diaria promedio: ${pred.venta_diaria_promedio?.toFixed(1)}`)
    console.log(`  - Venta diaria P50 (mediana): ${pred.venta_diaria_p50?.toFixed(1)}`)
    console.log(`  - Venta diaria P75: ${pred.venta_diaria_p75?.toFixed(1)}`)
    console.log(`  - Venta diaria P90: ${pred.venta_diaria_p90?.toFixed(1)}`)
    console.log(`  - Desviación estándar: ${pred.desviacion_estandar?.toFixed(1)}`)
    console.log(`  - Coeficiente variación: ${pred.coeficiente_variacion?.toFixed(2)}`)
    console.log(`\n📦 STOCK:`)
    console.log(`  - Stock actual: ${pred.stock_actual}`)
    console.log(`  - Stock óptimo: ${pred.stock_optimo}`)
    console.log(`  - Stock seguridad: ${pred.stock_seguridad}`)
    console.log(`  - Días stock actual: ${pred.dias_stock_actual}`)
    console.log(`\n🚢 TRÁNSITO Y REPOSICIÓN:`)
    console.log(`  - Tránsito China: ${pred.transito_china}`)
    console.log(`  - Sugerencia reposición P50: ${pred.sugerencia_reposicion}`)
    console.log(`  - Sugerencia reposición P75: ${pred.sugerencia_reposicion_p75}`)
    console.log(`  - Sugerencia reposición P90: ${pred.sugerencia_reposicion_p90}`)
    console.log(`\n📊 CLASIFICACIÓN:`)
    console.log(`  - ABC: ${pred.clasificacion_abc}`)
    console.log(`  - XYZ: ${pred.clasificacion_xyz}`)
    console.log(`  - Tendencia: ${pred.tendencia}`)
    console.log(`  - Tasa crecimiento mensual: ${(pred.tasa_crecimiento_mensual * 100).toFixed(1)}%`)
    console.log(`  - Demanda intermitente: ${pred.es_demanda_intermitente ? 'Sí' : 'No'}`)
    console.log(`\n🎯 MODELO:`)
    console.log(`  - Modelo usado: ${pred.modelo_usado}`)
    console.log(`  - MAPE backtesting: ${pred.mape_backtesting ? (pred.mape_backtesting * 100).toFixed(1) + '%' : 'N/A'}`)
  }
}

main()
