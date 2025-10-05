// Script para reclasificar productos mal clasificados
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function reclassifyMisclassified() {
  console.log('🔄 Iniciando reclasificación de productos mal clasificados...\n');

  // 1. Obtener config
  const { data: configData } = await supabase
    .from('configuration')
    .select('data')
    .eq('id', 1)
    .single();

  const config = configData?.data || {};
  const tiempoEntrega = config.tiempoEntrega || 90;
  const stockSaludableMinDias = config.stockSaludableMinDias || 90;

  console.log(`⚙️  Config actual:`);
  console.log(`   tiempoEntrega: ${tiempoEntrega} días`);
  console.log(`   stockSaludableMinDias: ${stockSaludableMinDias} días\n`);

  // 2. Obtener TODOS los productos NEEDS_REPLENISHMENT desde el cache
  let allProducts = [];
  let start = 0;
  const limit = 1000;
  let hasMore = true;

  console.log('📥 Obteniendo productos NEEDS_REPLENISHMENT desde cache...');

  while (hasMore) {
    const { data, error } = await supabase
      .from('dashboard_analysis_cache')
      .select('sku, status, cantidad_sugerida, venta_diaria, stock_actual, en_transito')
      .eq('status', 'NEEDS_REPLENISHMENT')
      .range(start, start + limit - 1);

    if (error) {
      console.error('❌ Error:', error);
      break;
    }

    if (data && data.length > 0) {
      allProducts = allProducts.concat(data);
      start += limit;
      process.stdout.write(`\r   Cargados: ${allProducts.length}...`);
    } else {
      hasMore = false;
    }
  }

  console.log(`\n✅ Total productos NEEDS_REPLENISHMENT: ${allProducts.length}\n`);

  // 3. Identificar mal clasificados (cantidad_sugerida = 0)
  const malClasificados = allProducts.filter(p => (p.cantidad_sugerida || 0) === 0);

  console.log(`📊 RESULTADOS:\n`);
  console.log(`   Total NEEDS_REPLENISHMENT: ${allProducts.length}`);
  console.log(`   ✅ Correctamente clasificados (cantidad > 0): ${allProducts.length - malClasificados.length}`);
  console.log(`   ❌ Mal clasificados (cantidad = 0): ${malClasificados.length}\n`);

  if (malClasificados.length === 0) {
    console.log('✅ No hay productos mal clasificados. Todo OK!\n');
    return;
  }

  // 4. Mostrar algunos ejemplos
  console.log('📋 Ejemplos de productos a reclasificar (primeros 10):\n');
  malClasificados.slice(0, 10).forEach(p => {
    console.log(`   ${p.sku}: venta=${p.venta_diaria}, stock=${p.stock_actual}, tránsito=${p.en_transito}, sugerida=0`);
  });

  console.log(`\n⚠️  ¿Deseas reclasificar ${malClasificados.length} productos a NO_REPLENISHMENT_NEEDED?\n`);
  console.log('   Esto actualizará:');
  console.log('   - Campo "status" a NO_REPLENISHMENT_NEEDED');
  console.log('   - Cache de análisis\n');

  // 5. Reclasificar en lotes de 100
  const BATCH_SIZE = 100;
  let reclassified = 0;
  let errors = 0;

  console.log('🔄 Iniciando reclasificación en lotes...\n');

  for (let i = 0; i < malClasificados.length; i += BATCH_SIZE) {
    const batch = malClasificados.slice(i, i + BATCH_SIZE);
    const skus = batch.map(p => p.sku);

    // Actualizar tabla products
    const { error: updateError } = await supabase
      .from('products')
      .update({ status: 'NO_REPLENISHMENT_NEEDED' })
      .in('sku', skus);

    if (updateError) {
      console.error(`❌ Error en lote ${Math.floor(i / BATCH_SIZE) + 1}:`, updateError.message);
      errors += batch.length;
    } else {
      reclassified += batch.length;
      process.stdout.write(`\r   Reclasificados: ${reclassified}/${malClasificados.length}...`);
    }

    // También actualizar el cache
    const { error: cacheError } = await supabase
      .from('dashboard_analysis_cache')
      .update({ status: 'NO_REPLENISHMENT_NEEDED' })
      .in('sku', skus);

    if (cacheError) {
      console.error(`\n⚠️  Error actualizando cache para lote ${Math.floor(i / BATCH_SIZE) + 1}`);
    }
  }

  console.log(`\n\n✅ RECLASIFICACIÓN COMPLETADA:\n`);
  console.log(`   Exitosos: ${reclassified}`);
  console.log(`   Errores: ${errors}\n`);

  // 6. Verificar resultado final
  const { count: newCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'NEEDS_REPLENISHMENT');

  const { count: healthyCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'NO_REPLENISHMENT_NEEDED');

  console.log('📊 DISTRIBUCIÓN FINAL:\n');
  console.log(`   NEEDS_REPLENISHMENT: ${newCount}`);
  console.log(`   NO_REPLENISHMENT_NEEDED: ${healthyCount}\n`);

  console.log('💡 PRÓXIMOS PASOS:\n');
  console.log('   1. Recargar el dashboard para ver los cambios');
  console.log('   2. Exportar Excel para verificar que coincide con el dashboard');
  console.log('   3. El cache se refrescará automáticamente en 24h\n');
}

reclassifyMisclassified().catch(console.error);
