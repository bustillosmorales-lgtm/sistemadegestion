// Script para calcular venta_diaria de todos los productos
// Se ejecutará como job nocturno para pre-calcular datos reales

const { supabase } = require('../lib/supabaseClient');
const path = require('path');

// Importar la función de cálculo de venta diaria desde analysis.js
const { calculateVentaDiariaBatch } = require('../pages/api/analysis.js');

async function calculateDailySalesForAllProducts() {
  console.log('🚀 Iniciando cálculo nocturno de venta_diaria para todos los productos...');
  const startTime = Date.now();

  try {
    // 1. Obtener todos los productos activos
    console.log('📦 Obteniendo lista de productos...');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('sku, descripcion, status')
      .neq('status', 'DESCONSIDERADO')
      .order('sku');

    if (productsError) {
      throw new Error(`Error obteniendo productos: ${productsError.message}`);
    }

    console.log(`📊 Encontrados ${products.length} productos para procesar`);

    // 2. Procesar en lotes para mejor rendimiento
    const BATCH_SIZE = 100;
    const batches = [];
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      batches.push(products.slice(i, i + BATCH_SIZE));
    }

    console.log(`🔄 Procesando en ${batches.length} lotes de ${BATCH_SIZE} productos cada uno`);

    let processedCount = 0;
    let updatedCount = 0;
    const results = [];

    // 3. Procesar cada lote
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📦 Procesando lote ${batchIndex + 1}/${batches.length} (${batch.length} productos)`);

      const batchResults = await Promise.all(
        batch.map(async (product) => {
          try {
            // Usar la misma lógica exacta que analysis.js (calculateVentaDiariaBatch)
            console.log(`🔍 Calculando venta diaria para SKU: ${product.sku}`);

            const ventaDiariaResults = await calculateVentaDiariaBatch([product]);
            const ventaDiariaResult = ventaDiariaResults.get(product.sku);

            const result = {
              sku: product.sku,
              venta_diaria: ventaDiariaResult?.ventaDiaria || 0,
              dias_historicos: ventaDiariaResult?.fechasAnalisis?.totalDias || 0,
              fecha_inicio: ventaDiariaResult?.fechasAnalisis?.fechaInicio,
              fecha_fin: ventaDiariaResult?.fechasAnalisis?.fechaFin,
              total_vendido: 0, // No disponible en este resultado
              metodo_calculo: ventaDiariaResult ? 'real_data' : 'no_data',
              fecha_calculo: new Date().toISOString().split('T')[0],
            };

            // Debug para SKU específico
            if (product.sku === '649762430948') {
              console.log(`🔍 DEBUG ${product.sku}: venta_diaria=${result.venta_diaria}, método=${result.metodo_calculo}`);
            }

            return result;
          } catch (error) {
            console.error(`❌ Error procesando SKU ${product.sku}:`, error.message);
            return {
              sku: product.sku,
              venta_diaria: 0,
              dias_historicos: 0,
              metodo_calculo: 'error',
              fecha_calculo: new Date().toISOString().split('T')[0],
              error: error.message
            };
          }
        })
      );

      results.push(...batchResults);
      processedCount += batch.length;

      // 4. Guardar resultados del lote en la base de datos
      const validResults = batchResults.filter(r => !r.error);

      if (validResults.length > 0) {
        const { error: upsertError } = await supabase
          .from('daily_sales_analysis')
          .upsert(validResults, {
            onConflict: 'sku',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error(`❌ Error guardando lote ${batchIndex + 1}:`, upsertError.message);
        } else {
          updatedCount += validResults.length;
          console.log(`✅ Lote ${batchIndex + 1} guardado: ${validResults.length} productos`);
        }
      }

      // Pausa pequeña entre lotes para no saturar la base de datos
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    // 5. Resumen final
    console.log('\n🎉 CÁLCULO COMPLETADO');
    console.log('========================');
    console.log(`📊 Productos procesados: ${processedCount}`);
    console.log(`✅ Productos actualizados: ${updatedCount}`);
    console.log(`❌ Errores: ${processedCount - updatedCount}`);
    console.log(`⏱️ Tiempo total: ${duration} segundos`);
    console.log(`🚀 Promedio: ${Math.round(processedCount / duration)} productos/segundo`);

    // 6. Estadísticas finales
    const { data: stats } = await supabase
      .from('daily_sales_analysis')
      .select('metodo_calculo, venta_diaria')
      .gte('venta_diaria', 0);

    if (stats) {
      const metodoCounts = {};
      const ventaStats = {
        total: stats.length,
        conVentas: stats.filter(s => s.venta_diaria > 0).length,
        sinVentas: stats.filter(s => s.venta_diaria === 0).length
      };

      stats.forEach(s => {
        metodoCounts[s.metodo_calculo] = (metodoCounts[s.metodo_calculo] || 0) + 1;
      });

      console.log('\n📈 ESTADÍSTICAS:');
      console.log(`📊 Total registros: ${ventaStats.total}`);
      console.log(`💰 Con ventas (>0): ${ventaStats.conVentas}`);
      console.log(`🚫 Sin ventas (=0): ${ventaStats.sinVentas}`);
      console.log('🔍 Por método:', metodoCounts);
    }

    return {
      success: true,
      processed: processedCount,
      updated: updatedCount,
      duration,
      errors: processedCount - updatedCount
    };

  } catch (error) {
    console.error('❌ ERROR FATAL en cálculo nocturno:', error);
    return {
      success: false,
      error: error.message,
      duration: Math.round((Date.now() - startTime) / 1000)
    };
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  calculateDailySalesForAllProducts()
    .then(result => {
      console.log('\n🏁 Proceso finalizado:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { calculateDailySalesForAllProducts };