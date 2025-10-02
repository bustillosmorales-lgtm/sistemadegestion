// scripts/populate-dashboard-cache.js
// Script para poblar el cache de dashboard con todos los SKUs calculados
// Ejecutar diariamente con: npm run populate-dashboard-cache

const { supabase } = require('../lib/supabaseClient');

async function populateDashboardCache() {
  console.log('📊 Poblando cache de dashboard...');
  const startTime = Date.now();

  try {
    // 1. Obtener configuración
    const { data: configData } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();

    const config = configData?.data || {};
    const stockSaludableMinDias = config.stockSaludableMinDias || 30;
    const tiempoEntrega = config.tiempoEntrega || 60;
    const tiempoFabricacion = config.tiempoPromedioFabricacion || 30;
    const leadTimeDias = tiempoEntrega + tiempoFabricacion;

    console.log(`⚙️  Configuración: stockSaludableMin=${stockSaludableMinDias}d, leadTime=${leadTimeDias}d`);

    // 2. Obtener TODOS los productos (sin límite de 1000)
    console.log('📥 Obteniendo todos los productos de la base de datos...');

    let allProducts = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: productsBatch, error } = await supabase
        .from('products')
        .select('sku, descripcion, status, stock_actual, precio_venta_sugerido')
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('❌ Error obteniendo productos:', error);
        throw error;
      }

      if (!productsBatch || productsBatch.length === 0) {
        hasMore = false;
        break;
      }

      allProducts = [...allProducts, ...productsBatch];
      console.log(`   📦 Cargados ${allProducts.length} productos...`);

      if (productsBatch.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }

    const products = allProducts;

    if (!products || products.length === 0) {
      console.log('⚠️  No hay productos para procesar');
      process.exit(0);
    }

    console.log(`✅ Total productos obtenidos: ${products.length}`);

    // 3. Obtener venta_diaria desde vista materializada (con paginación)
    console.log('📊 Obteniendo venta diaria de vista materializada...');

    let allVentaDiariaData = [];
    let ventaOffset = 0;
    let hasMoreVenta = true;

    while (hasMoreVenta) {
      const { data: ventaBatch, error: ventaError } = await supabase
        .from('sku_venta_diaria_mv')
        .select('*')
        .range(ventaOffset, ventaOffset + batchSize - 1);

      if (ventaError) {
        console.error('❌ Error obteniendo venta diaria:', ventaError);
        throw ventaError;
      }

      if (!ventaBatch || ventaBatch.length === 0) {
        hasMoreVenta = false;
        break;
      }

      allVentaDiariaData = [...allVentaDiariaData, ...ventaBatch];
      console.log(`   📈 Cargados ${allVentaDiariaData.length} registros de venta diaria...`);

      if (ventaBatch.length < batchSize) {
        hasMoreVenta = false;
      } else {
        ventaOffset += batchSize;
      }
    }

    const ventaDiariaData = allVentaDiariaData;
    const ventaDiariaMap = new Map();
    let datosConfiables = 0;
    let datosInsuficientes = 0;

    ventaDiariaData?.forEach(row => {
      ventaDiariaMap.set(row.sku, {
        ventaDiaria: row.venta_diaria,
        confiable: row.calculo_confiable,
        fechasAnalisis: {
          fechaInicio: row.fecha_inicio,
          fechaFin: row.fecha_fin,
          diasPeriodo: row.dias_periodo,
          unidadesVendidas: row.total_vendido
        }
      });
      if (row.calculo_confiable) {
        datosConfiables++;
      } else {
        datosInsuficientes++;
      }
    });

    console.log(`✅ Venta diaria: ${datosConfiables} confiables, ${datosInsuficientes} insuficientes`);

    // 4. Obtener stock en tránsito (batch query)
    const { data: stockEnTransitoData } = await supabase
      .from('compras')
      .select('sku, cantidad')
      .eq('status_compra', 'en_transito');

    const stockEnTransitoMap = new Map();
    stockEnTransitoData?.forEach(item => {
      const current = stockEnTransitoMap.get(item.sku) || 0;
      stockEnTransitoMap.set(item.sku, current + (item.cantidad || 0));
    });

    console.log(`🚛 Stock en tránsito: ${stockEnTransitoMap.size} SKUs`);

    // 5. Calcular para cada producto
    const cacheEntries = [];
    let productsWithData = 0;
    let productsWithoutData = 0;

    for (const product of products) {
      const ventaDiariaInfo = ventaDiariaMap.get(product.sku);
      const precioVenta = product.precio_venta_sugerido || 0;

      // Si no hay datos confiables, marcar como insuficiente
      if (!ventaDiariaInfo || !ventaDiariaInfo.confiable) {
        cacheEntries.push({
          sku: product.sku,
          descripcion: product.descripcion,
          status: product.status,
          stock_actual: product.stock_actual || 0,
          venta_diaria: 0,
          venta_diaria_calculada: false,
          datos_insuficientes: true,
          en_transito: stockEnTransitoMap.get(product.sku) || 0,
          cantidad_sugerida: null,
          stock_objetivo: null,
          stock_proyectado_llegada: null,
          consumo_durante_lead_time: null,
          lead_time_dias: leadTimeDias,
          impacto_economico: {
            valorTotal: 0,
            precioPromedioReal: 0,
            prioridad: 'N/A',
            mensaje: '⚠️ Datos insuficientes para cálculo'
          },
          essential: true,
          from_cache: true,
          config_usado: config,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
        });
        productsWithoutData++;
        continue;
      }

      const ventaDiaria = ventaDiariaInfo.ventaDiaria;
      const stockActual = product.stock_actual || 0;
      const stockEnTransito = stockEnTransitoMap.get(product.sku) || 0;

      // Cálculos (lógica exacta de analysis-cached.js)
      const stockObjetivo = Math.round(ventaDiaria * stockSaludableMinDias);
      const consumoDuranteLeadTime = Math.round(ventaDiaria * leadTimeDias);
      const stockProyectadoLlegada = stockActual + stockEnTransito - consumoDuranteLeadTime;

      let cantidadSugerida = 0;
      if (precioVenta > 0) {
        if (stockProyectadoLlegada < 0) {
          cantidadSugerida = stockObjetivo;
        } else {
          cantidadSugerida = Math.max(0, stockObjetivo - stockProyectadoLlegada);
        }
      }

      const valorTotal = precioVenta * cantidadSugerida;

      cacheEntries.push({
        sku: product.sku,
        descripcion: product.descripcion,
        status: product.status,
        stock_actual: stockActual,
        venta_diaria: ventaDiaria,
        venta_diaria_calculada: true,
        datos_insuficientes: false,
        en_transito: stockEnTransito,
        cantidad_sugerida: cantidadSugerida,
        stock_objetivo: stockObjetivo,
        stock_proyectado_llegada: stockProyectadoLlegada,
        consumo_durante_lead_time: consumoDuranteLeadTime,
        lead_time_dias: leadTimeDias,
        impacto_economico: {
          valorTotal: Math.round(valorTotal),
          precioPromedioReal: Math.round(precioVenta),
          prioridad: valorTotal > 500000 ? 'CRÍTICA' :
                     valorTotal > 200000 ? 'ALTA' :
                     valorTotal > 100000 ? 'MEDIA' : 'BAJA'
        },
        essential: true,
        from_cache: true,
        config_usado: config,
        calculated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
      });
      productsWithData++;
    }

    console.log(`📊 Resultados: ${productsWithData} con datos, ${productsWithoutData} sin datos suficientes`);

    // 6. Limpiar cache antiguo
    console.log('🧹 Limpiando cache antiguo...');
    const { error: deleteError } = await supabase
      .from('dashboard_analysis_cache')
      .delete()
      .neq('id', 0); // Delete all

    if (deleteError) {
      console.error('⚠️  Error limpiando cache:', deleteError.message);
    }

    // 7. Insertar nuevos datos en lotes de 500
    const insertBatchSize = 500;
    let totalInserted = 0;

    for (let i = 0; i < cacheEntries.length; i += insertBatchSize) {
      const batch = cacheEntries.slice(i, i + insertBatchSize);

      const { error } = await supabase
        .from('dashboard_analysis_cache')
        .insert(batch);

      if (error) {
        console.error(`❌ Error en lote ${i}-${i+insertBatchSize}:`, error.message);
      } else {
        totalInserted += batch.length;
        console.log(`✅ Insertados ${batch.length} productos (${totalInserted}/${cacheEntries.length})`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n📈 RESUMEN:');
    console.log(`   ✅ Cache poblado: ${totalInserted} productos`);
    console.log(`   📊 Con datos confiables: ${productsWithData}`);
    console.log(`   ⚠️  Datos insuficientes: ${productsWithoutData}`);
    console.log(`   ⏱️  Tiempo de ejecución: ${duration}s`);
    console.log(`   📅 Válido hasta: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString()}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  populateDashboardCache();
}

module.exports = populateDashboardCache;
