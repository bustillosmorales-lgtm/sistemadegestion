// analyze-architecture.js - Analizar arquitectura actual
const { supabase } = require('./lib/supabaseClient.js');

async function analyzeArchitecture() {
  console.log('🏗️ ANÁLISIS DE ARQUITECTURA ACTUAL\n');
  
  try {
    // 1. Tabla ventas - ¿qué estructura tiene?
    console.log('1. TABLA VENTAS:');
    const { data: ventasExample } = await supabase
      .from('ventas')
      .select('*')
      .limit(1);
    
    if (ventasExample?.[0]) {
      console.log('   Columnas:', Object.keys(ventasExample[0]).join(', '));
      console.log('   Ejemplo:', ventasExample[0]);
    }
    
    // 2. Total de registros en ventas
    const { count: ventasCount } = await supabase
      .from('ventas')
      .select('*', { count: 'exact', head: true });
    console.log(`   Total registros: ${ventasCount}`);
    
    // 3. ¿Cuántos tienen precio_unitario?
    const { count: conPrecio } = await supabase
      .from('ventas')
      .select('*', { count: 'exact', head: true })
      .not('precio_unitario', 'is', null)
      .gt('precio_unitario', 0);
    console.log(`   Con precio real: ${conPrecio}`);
    
    // 4. Tabla products
    console.log('\n2. TABLA PRODUCTS:');
    const { data: productsExample } = await supabase
      .from('products')
      .select('*')
      .limit(1);
    
    if (productsExample?.[0]) {
      console.log('   Columnas:', Object.keys(productsExample[0]).join(', '));
    }
    
    const { count: productsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    console.log(`   Total productos: ${productsCount}`);
    
    // 5. Tabla cache
    console.log('\n3. TABLA SKU_ANALYSIS_CACHE:');
    const { data: cacheExample } = await supabase
      .from('sku_analysis_cache')
      .select('*')
      .limit(1);
    
    if (cacheExample?.[0]) {
      console.log('   Columnas:', Object.keys(cacheExample[0]).join(', '));
    }
    
    const { count: cacheCount } = await supabase
      .from('sku_analysis_cache')
      .select('*', { count: 'exact', head: true });
    console.log(`   Registros en cache: ${cacheCount}`);
    
    // 6. PROBLEMA ACTUAL
    console.log('\n🔍 PROBLEMA ACTUAL:');
    console.log(`   ❌ ${ventasCount} registros en ventas, pero solo ${conPrecio} con precio`);
    console.log('   ❌ API busca precio en ventas EN TIEMPO REAL cada vez');
    console.log('   ❌ No hay tabla de "último precio por SKU"');
    
    console.log('\n💡 SOLUCIÓN PROPUESTA:');
    console.log('   1. Crear tabla "latest_prices" o columna en products');
    console.log('   2. Mantener último precio por SKU automáticamente');
    console.log('   3. API consulta precio directo, no busca en ventas');
    console.log('   4. Actualizar cuando se importan nuevas ventas');
    
    // 7. ¿Existe latest_prices ya?
    try {
      const { data: latestPrices } = await supabase
        .from('latest_prices')
        .select('*')
        .limit(1);
      console.log('\n✅ Tabla latest_prices existe');
    } catch (error) {
      console.log('\n❌ Tabla latest_prices NO existe');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeArchitecture().then(() => {
  console.log('\n✅ Análisis completado');
  process.exit(0);
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});