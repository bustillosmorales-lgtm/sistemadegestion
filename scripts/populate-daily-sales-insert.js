// Script alternativo que usa INSERT directo para evitar problemas de cache del schema
const { supabase } = require('../lib/supabaseClient');

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

async function populateWithInserts() {
  console.log('🚀 Iniciando población con INSERT directo...');
  const startTime = Date.now();

  try {
    // 1. Limpiar tabla existente
    console.log('🧹 Limpiando datos existentes...');
    const { error: deleteError } = await supabase
      .from('daily_sales_analysis')
      .delete()
      .neq('sku', '');

    if (deleteError) {
      console.log('⚠️ Error limpiando tabla (normal si está vacía):', deleteError.message);
    }

    // 2. Obtener productos
    console.log('📦 Obteniendo productos...');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('sku, descripcion, stock_actual, last_stockout_date, status')
      .neq('status', 'DESCONSIDERADO')
      .order('sku')
      .limit(50); // Límite pequeño para test

    if (productsError) {
      throw new Error(`Error obteniendo productos: ${productsError.message}`);
    }

    console.log(`📊 Procesando ${products.length} productos`);

    // 3. Procesar uno por uno con INSERT
    let successCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        const calculation = await calculateVentaDiariaSimple(product);

        // Usar INSERT directo en lugar de upsert
        const { error: insertError } = await supabase
          .from('daily_sales_analysis')
          .insert({
            sku: product.sku,
            venta_diaria: calculation.ventaDiaria || 0,
            fecha_calculo: new Date().toISOString().split('T')[0],
            dias_historicos: calculation.fechasAnalisis?.totalDias || 0,
            metodo_calculo: calculation.metodo
          });

        if (insertError) {
          console.error(`❌ Error insertando ${product.sku}:`, insertError.message);
          errorCount++;
        } else {
          successCount++;
          if (successCount % 10 === 0) {
            console.log(`✅ Procesados: ${successCount}`);
          }
        }

        // Debug para SKU específico
        if (product.sku === '649762430948') {
          console.log(`🔍 DEBUG ${product.sku}: venta_diaria=${calculation.ventaDiaria}`);
        }

      } catch (error) {
        console.error(`💥 Error procesando ${product.sku}:`, error.message);
        errorCount++;
      }

      // Pausa pequeña
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    // 4. Resumen final
    console.log('\n🎉 POBLACIÓN COMPLETADA');
    console.log('=======================');
    console.log(`✅ Éxitos: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`⏱️ Tiempo: ${duration} segundos`);

    // 5. Verificar datos
    const { count: totalRecords } = await supabase
      .from('daily_sales_analysis')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Total registros en tabla: ${totalRecords || 0}`);

    return {
      success: true,
      inserted: successCount,
      errors: errorCount,
      totalRecords: totalRecords || 0,
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
  populateWithInserts()
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

module.exports = { populateWithInserts };