// Script simplificado para poblar daily_sales_analysis con datos reales
// Usando CommonJS para evitar problemas de módulos ES6

const { supabase } = require('../lib/supabaseClient');

// Función simplificada de cálculo de venta diaria (sin cache, sin imports ES6)
async function calculateVentaDiariaSimple(product) {
  try {
    const sku = product.sku;
    const hoy = new Date();

    // 1. Obtener compras para este SKU
    const { data: compras } = await supabase
      .from('compras')
      .select('sku, fecha_llegada_real')
      .eq('sku', sku)
      .not('fecha_llegada_real', 'is', null)
      .order('fecha_llegada_real', { ascending: false });

    // 2. Obtener ventas para este SKU
    const { data: ventas } = await supabase
      .from('ventas')
      .select('sku, fecha_venta, cantidad')
      .eq('sku', sku)
      .order('fecha_venta', { ascending: true });

    let fechaInicio = null;

    // 3. Buscar llegada más reciente que tenga ≥30 días desde HOY
    if (compras && compras.length > 0) {
      for (const compra of compras) {
        const fechaLlegada = new Date(compra.fecha_llegada_real);
        const diasDesdeHoy = Math.floor((hoy - fechaLlegada) / (1000 * 60 * 60 * 24));

        if (diasDesdeHoy >= 30) {
          fechaInicio = fechaLlegada;
          break;
        }
      }
    }

    // 4. Si no hay llegadas válidas, usar primera venta
    if (!fechaInicio && ventas && ventas.length > 0) {
      fechaInicio = new Date(ventas[0].fecha_venta);
    }

    // 5. Si no hay datos, usar período por defecto
    if (!fechaInicio) {
      fechaInicio = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 días atrás
    }

    // 6. Calcular fecha fin basada en stock
    let fechaFin = new Date();

    if ((product.stock_actual || 0) <= 0) {
      if (product.last_stockout_date) {
        fechaFin = new Date(product.last_stockout_date);
      } else if (ventas && ventas.length > 0) {
        fechaFin = new Date(ventas[ventas.length - 1].fecha_venta);
      }
    }

    // 7. Calcular días y total vendido
    const diffTime = fechaFin.getTime() - fechaInicio.getTime();
    const totalDias = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    let totalVendido = 0;
    if (ventas && ventas.length > 0) {
      const ventasEnPeriodo = ventas.filter(v => {
        const fechaVenta = new Date(v.fecha_venta);
        return fechaVenta >= fechaInicio && fechaVenta <= fechaFin;
      });

      totalVendido = ventasEnPeriodo.reduce((sum, v) => sum + (parseFloat(v.cantidad) || 0), 0);
    }

    const ventaDiaria = totalVendido / totalDias;

    return {
      ventaDiaria: Math.round(ventaDiaria * 10000) / 10000, // 4 decimales
      fechasAnalisis: {
        fechaInicio: fechaInicio.toISOString().split('T')[0],
        fechaFin: fechaFin.toISOString().split('T')[0],
        totalDias,
        totalVendido
      },
      metodo: 'real_data'
    };

  } catch (error) {
    console.error(`❌ Error calculando SKU ${product.sku}:`, error.message);
    return {
      ventaDiaria: 0,
      fechasAnalisis: null,
      metodo: 'error'
    };
  }
}

async function populateDailySalesTable() {
  console.log('🚀 Iniciando población de daily_sales_analysis...');
  const startTime = Date.now();

  try {
    // 1. Obtener todos los productos activos
    console.log('📦 Obteniendo productos...');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('sku, descripcion, stock_actual, last_stockout_date, status')
      .neq('status', 'DESCONSIDERADO')
      .order('sku');

    if (productsError) {
      throw new Error(`Error obteniendo productos: ${productsError.message}`);
    }

    console.log(`📊 Procesando ${products.length} productos`);

    // 2. Procesar en lotes pequeños
    const BATCH_SIZE = 10; // Más pequeño para debug
    const results = [];
    let processedCount = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      console.log(`📦 Lote ${Math.floor(i/BATCH_SIZE) + 1}: procesando SKUs ${batch[0].sku} - ${batch[batch.length-1].sku}`);

      // Procesar cada producto en el lote
      for (const product of batch) {
        const calculation = await calculateVentaDiariaSimple(product);

        const result = {
          sku: product.sku,
          venta_diaria: calculation.ventaDiaria || 0,
          fecha_calculo: new Date().toISOString().split('T')[0],
          dias_historicos: calculation.fechasAnalisis?.totalDias || 0,
          metodo_calculo: calculation.metodo,
          created_at: new Date().toISOString()
        };

        // Debug para SKU específico
        if (product.sku === '649762430948') {
          console.log(`🔍 DEBUG ${product.sku}: venta_diaria=${result.venta_diaria}, método=${result.metodo_calculo}`);
        }

        results.push(result);
        processedCount++;
      }

      // Guardar lote en BD
      if (results.length > 0) {
        const { error: upsertError } = await supabase
          .from('daily_sales_analysis')
          .upsert(results.slice(-batch.length), {
            onConflict: 'sku',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error('❌ Error guardando lote:', upsertError.message);
        } else {
          console.log(`✅ Lote guardado: ${batch.length} productos`);
        }
      }

      // Pausa entre lotes
      if (i + BATCH_SIZE < products.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    // 3. Resumen final
    console.log('\n🎉 POBLACIÓN COMPLETADA');
    console.log('=======================');
    console.log(`📊 Productos procesados: ${processedCount}`);
    console.log(`⏱️ Tiempo total: ${duration} segundos`);

    // 4. Verificar datos con SKU específico
    const { data: testData } = await supabase
      .from('daily_sales_analysis')
      .select('*')
      .eq('sku', '649762430948')
      .single();

    if (testData) {
      console.log(`\n🔍 TEST SKU 649762430948: venta_diaria=${testData.venta_diaria}`);
    }

    // 5. Estadísticas finales
    const { count: totalRecords } = await supabase
      .from('daily_sales_analysis')
      .select('*', { count: 'exact', head: true });

    const { count: withSales } = await supabase
      .from('daily_sales_analysis')
      .select('*', { count: 'exact', head: true })
      .gt('venta_diaria', 0);

    console.log(`\n📈 ESTADÍSTICAS:`);
    console.log(`📊 Total registros: ${totalRecords || 0}`);
    console.log(`💰 Con ventas (>0): ${withSales || 0}`);
    console.log(`🚫 Sin ventas (=0): ${(totalRecords || 0) - (withSales || 0)}`);

    return {
      success: true,
      processed: processedCount,
      totalRecords: totalRecords || 0,
      withSales: withSales || 0,
      duration
    };

  } catch (error) {
    console.error('❌ ERROR FATAL:', error);
    return {
      success: false,
      error: error.message,
      duration: Math.round((Date.now() - startTime) / 1000)
    };
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  populateDailySalesTable()
    .then(result => {
      console.log('\n🏁 Proceso finalizado:', result.success ? 'ÉXITO' : 'ERROR');
      if (!result.success) {
        console.error('Error:', result.error);
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { populateDailySalesTable };