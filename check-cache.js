const { supabase } = require('./lib/supabaseClient');

async function checkCache() {
  console.log('🔍 Verificando cache...\n');

  // Verificar si existe cache válido
  const { data: cacheData, count } = await supabase
    .from('dashboard_analysis_cache')
    .select('*', { count: 'exact' })
    .gt('expires_at', new Date().toISOString())
    .limit(5);

  console.log(`Total en cache (válido): ${count || 0}`);

  if (cacheData && cacheData.length > 0) {
    console.log('\nPrimeros 5 registros del cache:');
    cacheData.forEach((item, i) => {
      console.log(`${i+1}. SKU: ${item.sku}`);
      console.log(`   Status: ${item.status}`);
      console.log(`   Venta Diaria: ${item.venta_diaria}`);
      console.log(`   Cantidad Sugerida: ${item.cantidad_sugerida}`);
      console.log(`   Stock Actual: ${item.stock_actual}`);
      console.log('');
    });
  }

  // Verificar productos NEEDS_REPLENISHMENT específicamente
  const { data: needsData, count: needsCount } = await supabase
    .from('dashboard_analysis_cache')
    .select('*', { count: 'exact' })
    .eq('status', 'NEEDS_REPLENISHMENT')
    .gt('expires_at', new Date().toISOString())
    .limit(1);

  console.log(`\nNEEDS_REPLENISHMENT en cache: ${needsCount || 0}`);

  if (needsData && needsData.length > 0) {
    console.log('Ejemplo:', needsData[0]);
  }

  process.exit(0);
}

checkCache();
