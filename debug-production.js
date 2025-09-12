// debug-production.js - Diagnosticar diferencias entre local y producción
const { supabase } = require('./lib/supabaseClient.js');

async function debugProduction() {
  console.log('🔍 Diagnóstico del problema de producción...\n');
  
  try {
    // 1. Verificar configuración de Supabase
    console.log('1. CONFIGURACIÓN DE BASE DE DATOS:');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'No definida';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'No definida';
    
    console.log(`   URL: ${supabaseUrl}`);
    console.log(`   Key: ${supabaseKey.substring(0, 20)}...`);
    
    // 2. Verificar si hay datos en la tabla ventas
    console.log('\n2. DATOS EN TABLA VENTAS:');
    const { data: ventasCount, error: countError } = await supabase
      .from('ventas')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log(`   ❌ Error accediendo tabla ventas: ${countError.message}`);
      return;
    }
    
    console.log(`   📊 Total registros en ventas: ${ventasCount?.length || 0}`);
    
    // 3. Verificar precios importados
    console.log('\n3. PRECIOS IMPORTADOS:');
    const { data: preciosData, error: preciosError } = await supabase
      .from('ventas')
      .select('sku, precio_unitario')
      .not('precio_unitario', 'is', null)
      .gt('precio_unitario', 0)
      .order('precio_unitario', { ascending: false })
      .limit(5);
    
    if (preciosError) {
      console.log(`   ❌ Error obteniendo precios: ${preciosError.message}`);
    } else if (preciosData && preciosData.length > 0) {
      console.log(`   ✅ Precios encontrados: ${preciosData.length}`);
      preciosData.forEach(p => {
        console.log(`      ${p.sku}: $${p.precio_unitario.toLocaleString()}`);
      });
    } else {
      console.log(`   ❌ NO se encontraron precios importados`);
      console.log(`   🔧 SOLUCIÓN: Ejecutar import-prices-by-latest-date.js en producción`);
    }
    
    // 4. Verificar tabla products
    console.log('\n4. TABLA PRODUCTS:');
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('sku, descripcion, precio_venta_sugerido')
      .limit(3);
    
    if (productsError) {
      console.log(`   ❌ Error accediendo products: ${productsError.message}`);
    } else {
      console.log(`   ✅ Products accesible: ${productsData?.length || 0} registros`);
      if (productsData && productsData.length > 0) {
        console.log(`   Ejemplo: ${productsData[0].sku} - $${productsData[0].precio_venta_sugerido || 'sin precio'}`);
      }
    }
    
    // 5. Verificar tabla cache
    console.log('\n5. CACHE DE ANÁLISIS:');
    const { data: cacheData, error: cacheError } = await supabase
      .from('sku_analysis_cache')
      .select('sku, precio_promedio_30d')
      .gt('precio_promedio_30d', 0)
      .limit(3);
    
    if (cacheError) {
      console.log(`   ❌ Error accediendo cache: ${cacheError.message}`);
    } else if (cacheData && cacheData.length > 0) {
      console.log(`   ✅ Cache con precios: ${cacheData.length} registros`);
      cacheData.forEach(c => {
        console.log(`      ${c.sku}: $${c.precio_promedio_30d}`);
      });
    } else {
      console.log(`   ⚠️  Cache sin precios actualizados`);
    }
    
    console.log('\n🎯 DIAGNÓSTICO:');
    
    if (preciosData && preciosData.length > 0) {
      console.log('   ✅ Los precios SÍ están en la base de datos');
      console.log('   🔧 Problema posible: Cache del navegador o API');
      console.log('   📋 Soluciones:');
      console.log('      1. Ctrl+F5 en el navegador');
      console.log('      2. Ventana incógnita');
      console.log('      3. Limpiar cache de Netlify');
    } else {
      console.log('   ❌ Los precios NO están en la base de datos de producción');
      console.log('   🔧 SOLUCIÓN: Ejecutar import-prices-by-latest-date.js');
      console.log('   📋 La base de datos de producción es diferente a la local');
    }
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error.message);
  }
}

// Ejecutar diagnóstico
debugProduction().then(() => {
  console.log('\n✅ Diagnóstico completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Diagnóstico falló:', error);
  process.exit(1);
});