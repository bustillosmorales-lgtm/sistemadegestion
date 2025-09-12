// scripts/update-precio-cache.js - Script para pre-calcular precios históricos
import { supabase } from '../lib/supabaseClient.js';

const BATCH_SIZE = 100; // Procesar SKUs en lotes para evitar timeouts

async function obtenerPrecioProducto(sku, diasPeriodo = 30) {
  try {
    // Obtener información completa del producto
    const { data: product, error } = await supabase
      .from('products')
      .select('precio_venta_sugerido, costo_fob_rmb')
      .eq('sku', sku)
      .single();
    
    if (error) {
      // Si no se encuentra el producto, usar fallback
      return { precioPromedio: 5000, totalVentas: 0 };
    }
    
    // Si tiene precio sugerido válido, usarlo
    if (product && product.precio_venta_sugerido && product.precio_venta_sugerido > 0) {
      return {
        precioPromedio: Math.round(product.precio_venta_sugerido),
        totalVentas: 1 // Indica que hay precio disponible
      };
    }
    
    // Si no hay precio sugerido pero hay costo FOB, estimar precio con margen
    if (product && product.costo_fob_rmb && product.costo_fob_rmb > 0) {
      // Convertir RMB a CLP (aproximadamente 1 RMB = 130 CLP) y aplicar margen de 2.5x
      const costoCLP = product.costo_fob_rmb * 130; // Conversión estimada
      const precioEstimado = costoCLP * 2.5; // Margen típico
      
      return {
        precioPromedio: Math.round(precioEstimado),
        totalVentas: 0 // Indica que es estimación basada en costo
      };
    }
    
    // Fallback si no hay precio ni costo
    return { precioPromedio: 8000, totalVentas: 0 }; // Precio promedio más realista
    
  } catch (error) {
    console.error(`❌ Error obteniendo precio para ${sku}:`, error.message);
    return { precioPromedio: 8000, totalVentas: 0 };
  }
}

// Calcular venta diaria completa para un SKU (replica lógica del analysis.js)
async function calcularVentaDiariaCompleta(sku) {
  try {
    // Obtener compras y ventas del SKU
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const [comprasResult, ventasResult] = await Promise.all([
      supabase
        .from('compras')
        .select('fecha_llegada_real')
        .eq('sku', sku)
        .not('fecha_llegada_real', 'is', null)
        .lte('fecha_llegada_real', hace30Dias.toISOString())
        .order('fecha_llegada_real', { ascending: false })
        .limit(1),
      
      supabase
        .from('ventas')
        .select('fecha_venta, cantidad')
        .eq('sku', sku)
        .order('fecha_venta', { ascending: true })
    ]);

    const compras = comprasResult.data || [];
    const ventas = ventasResult.data || [];

    // Determinar fecha de inicio
    let fechaInicio = null;
    if (compras.length > 0) {
      fechaInicio = new Date(compras[0].fecha_llegada_real);
    } else if (ventas.length > 0) {
      fechaInicio = new Date(ventas[0].fecha_venta);
    }

    if (!fechaInicio) {
      return {
        ventaDiaria: 0,
        unidadesVendidas: 0,
        diasPeriodo: 0,
        fechaInicio: null,
        fechaFin: null,
        tieneHistorial: false,
        confiable: false
      };
    }

    // Calcular período
    const fechaFin = new Date();
    const diffTime = fechaFin.getTime() - fechaInicio.getTime();
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Calcular ventas en período
    const ventasEnPeriodo = ventas.filter(v => {
      const ventaDate = new Date(v.fecha_venta);
      return ventaDate >= fechaInicio && ventaDate <= fechaFin;
    });

    const totalVendido = ventasEnPeriodo.reduce((sum, venta) => sum + (venta.cantidad || 0), 0);
    const ventaDiaria = totalVendido / diffDays;
    
    return {
      ventaDiaria: Math.max(0, ventaDiaria),
      unidadesVendidas: totalVendido,
      diasPeriodo: diffDays,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      tieneHistorial: ventas.length > 0 || compras.length > 0,
      confiable: ventas.length >= 3 && diffDays >= 30 // Criterio: mín 3 ventas y 30 días
    };
    
  } catch (error) {
    console.error(`Error calculando venta diaria para ${sku}:`, error.message);
    return {
      ventaDiaria: 0,
      unidadesVendidas: 0,
      diasPeriodo: 0,
      fechaInicio: null,
      fechaFin: null,
      tieneHistorial: false,
      confiable: false
    };
  }
}

async function actualizarCacheAnalisisCompleto(skuBatch) {
  const cacheData = [];
  
  // Obtener stock actual y precio de todos los SKUs del lote
  const { data: products } = await supabase
    .from('products')
    .select('sku, stock_actual, precio_venta_sugerido')
    .in('sku', skuBatch);
    
  const productMap = new Map();
  (products || []).forEach(p => productMap.set(p.sku, {
    stock_actual: p.stock_actual || 0,
    precio_venta_sugerido: p.precio_venta_sugerido || 5000
  }));
  
  for (const sku of skuBatch) {
    console.log(`📊 Análisis completo para SKU: ${sku}`);
    
    const productData = productMap.get(sku);
    const stockActual = productData?.stock_actual || 0;
    const precioVenta = productData?.precio_venta_sugerido || 5000;
    
    // Calcular venta diaria
    const datosVentaDiaria = await calcularVentaDiariaCompleta(sku);
    
    // Obtener precios reales de diferentes períodos
    const datos30d = await obtenerPrecioProducto(sku, 30);
    const datos90d = await obtenerPrecioProducto(sku, 90);
    
    // Calcular stock objetivo para diferentes períodos
    const stockObjetivo30d = Math.round(datosVentaDiaria.ventaDiaria * 30);
    const stockObjetivo60d = Math.round(datosVentaDiaria.ventaDiaria * 60);
    const stockObjetivo90d = Math.round(datosVentaDiaria.ventaDiaria * 90);
    
    // Calcular cantidad sugerida
    const cantidadSugerida30d = Math.max(0, stockObjetivo30d - stockActual);
    const cantidadSugerida60d = Math.max(0, stockObjetivo60d - stockActual);
    const cantidadSugerida90d = Math.max(0, stockObjetivo90d - stockActual);
    
    cacheData.push({
      sku: sku,
      // Precios
      precio_promedio_30d: datos30d.precioPromedio,
      precio_promedio_90d: datos90d.precioPromedio,
      total_ventas_30d: datos30d.totalVentas,
      total_ventas_90d: datos90d.totalVentas,
      
      // Venta diaria
      venta_diaria: datosVentaDiaria.ventaDiaria,
      unidades_vendidas_periodo: datosVentaDiaria.unidadesVendidas,
      dias_periodo: datosVentaDiaria.diasPeriodo,
      fecha_inicio_analisis: datosVentaDiaria.fechaInicio,
      fecha_fin_analisis: datosVentaDiaria.fechaFin,
      
      // Stock y reposición
      stock_objetivo_30d: stockObjetivo30d,
      stock_objetivo_60d: stockObjetivo60d,
      stock_objetivo_90d: stockObjetivo90d,
      cantidad_sugerida_30d: cantidadSugerida30d,
      cantidad_sugerida_60d: cantidadSugerida60d,
      cantidad_sugerida_90d: cantidadSugerida90d,
      
      // Metadatos
      stock_actual_cache: stockActual,
      tiene_historial_compras: datosVentaDiaria.fechaInicio && datosVentaDiaria.fechaInicio.length > 0,
      tiene_historial_ventas: datosVentaDiaria.unidadesVendidas > 0,
      calculo_confiable: datosVentaDiaria.confiable,
      
      ultima_actualizacion: new Date().toISOString()
    });
  }
  
  // Upsert en lote
  const { error: upsertError } = await supabase
    .from('sku_analysis_cache')
    .upsert(cacheData, { 
      onConflict: 'sku',
      ignoreDuplicates: false 
    });
  
  if (upsertError) {
    console.error('❌ Error actualizando cache análisis:', upsertError.message);
    return false;
  }
  
  console.log(`✅ Cache análisis completo para ${cacheData.length} SKUs`);
  return true;
}

async function main() {
  const startTime = Date.now();
  console.log('🚀 Iniciando actualización de cache de precios...');
  
  try {
    // 1. Obtener todos los SKUs con paginación manual (Supabase límite máximo real es 1000)
    let allSkus = [];
    let offset = 0;
    const pageSize = 1000;
    
    console.log('🔍 Obteniendo todos los SKUs con paginación...');
    
    while (true) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('sku')
        .not('sku', 'is', null)
        .range(offset, offset + pageSize - 1);
      
      if (productsError) {
        throw new Error('Error obteniendo productos: ' + productsError.message);
      }
      
      if (!products || products.length === 0) break;
      
      allSkus.push(...products.map(p => p.sku));
      console.log(`📄 Página ${Math.floor(offset/pageSize) + 1}: ${products.length} SKUs (Total: ${allSkus.length})`);
      
      if (products.length < pageSize) break; // Última página
      offset += pageSize;
    }
    
    console.log(`📝 Total SKUs a procesar: ${allSkus.length}`);
    
    // 2. Procesar en lotes con análisis completo
    let processed = 0;
    for (let i = 0; i < allSkus.length; i += BATCH_SIZE) {
      const batch = allSkus.slice(i, i + BATCH_SIZE);
      console.log(`\n🔄 Procesando lote ${Math.floor(i/BATCH_SIZE) + 1} (SKUs ${i+1}-${Math.min(i+BATCH_SIZE, allSkus.length)})`);
      
      const success = await actualizarCacheAnalisisCompleto(batch);
      if (success) {
        processed += batch.length;
      }
      
      // Pequeña pausa entre lotes para no sobrecargar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const duration = Date.now() - startTime;
    console.log(`\n🎉 ¡Cache actualizado exitosamente!`);
    console.log(`📊 SKUs procesados: ${processed}/${allSkus.length}`);
    console.log(`⏱️  Tiempo total: ${Math.round(duration/1000)}s`);
    
    // 3. Mostrar estadísticas detalladas
    const { data: stats } = await supabase
      .from('sku_analysis_cache')
      .select('sku, precio_promedio_30d, venta_diaria, cantidad_sugerida_30d, calculo_confiable')
      .gt('venta_diaria', 0)
      .order('cantidad_sugerida_30d', { ascending: false })
      .limit(5);
    
    if (stats && stats.length > 0) {
      console.log('\n📈 Top SKUs con mayor cantidad sugerida:');
      stats.forEach(stat => {
        const confianza = stat.calculo_confiable ? '✅' : '⚠️';
        console.log(`  ${stat.sku}: ${stat.cantidad_sugerida_30d} unidades, $${stat.precio_promedio_30d}, ${stat.venta_diaria.toFixed(2)}/día ${confianza}`);
      });
    }
    
    // Estadísticas generales
    const { data: resumen } = await supabase
      .from('sku_analysis_cache')
      .select('calculo_confiable, venta_diaria, cantidad_sugerida_30d');
    
    if (resumen) {
      const confiables = resumen.filter(r => r.calculo_confiable).length;
      const conReposicion = resumen.filter(r => r.cantidad_sugerida_30d > 0).length;
      const ventaTotal = resumen.reduce((sum, r) => sum + (r.venta_diaria || 0), 0);
      
      console.log('\n📊 Resumen del cache:');
      console.log(`  • Cálculos confiables: ${confiables}/${resumen.length}`);
      console.log(`  • SKUs necesitan reposición: ${conReposicion}`);
      console.log(`  • Venta diaria total: ${ventaTotal.toFixed(2)} unidades/día`);
    }
    
  } catch (error) {
    console.error('❌ Error en actualización de cache:', error.message);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (process.argv[1].endsWith('update-precio-cache.js')) {
  main().then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Script falló:', error);
    process.exit(1);
  });
}

export { actualizarCacheAnalisisCompleto, obtenerPrecioProducto, calcularVentaDiariaCompleta };