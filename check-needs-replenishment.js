// Script para verificar productos en NEEDS_REPLENISHMENT con cantidadSugerida = 0
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkNeedsReplenishment() {
  console.log('🔍 Verificando productos en NEEDS_REPLENISHMENT...\n');

  // 1. Contar total en NEEDS_REPLENISHMENT
  const { count: totalNeeds } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'NEEDS_REPLENISHMENT');

  console.log(`📊 Total en NEEDS_REPLENISHMENT: ${totalNeeds}\n`);

  // 2. Verificar en cache cuántos tienen cantidadSugerida = 0
  const { data: cached } = await supabase
    .from('dashboard_analysis_cache')
    .select('sku, status, cantidad_sugerida, venta_diaria, stock_actual, stock_en_transito')
    .eq('status', 'NEEDS_REPLENISHMENT')
    .gt('expires_at', new Date().toISOString());

  if (!cached || cached.length === 0) {
    console.log('⚠️  No hay datos en cache. El cache puede estar vacío o expirado.');
    console.log('💡 Solución: Cargar el dashboard para regenerar el cache.\n');
    return;
  }

  console.log(`📦 Productos en cache: ${cached.length}\n`);

  // Analizar cuántos tienen cantidad_sugerida = 0
  const conCero = cached.filter(p => {
    const cantSug = p.cantidad_sugerida?.cantidad_sugerida || 0;
    return cantSug === 0;
  });

  const conSugerencia = cached.filter(p => {
    const cantSug = p.cantidad_sugerida?.cantidad_sugerida || 0;
    return cantSug > 0;
  });

  console.log(`✅ Con cantidad sugerida > 0: ${conSugerencia.length}`);
  console.log(`❌ Con cantidad sugerida = 0: ${conCero.length}\n`);

  if (conCero.length > 0) {
    console.log('⚠️  PROBLEMA DETECTADO:');
    console.log(`   ${conCero.length} productos en NEEDS_REPLENISHMENT tienen cantidadSugerida = 0`);
    console.log(`   Estos deberían estar en NO_REPLENISHMENT_NEEDED\n`);

    // Mostrar ejemplos
    console.log('📋 Primeros 10 ejemplos:');
    conCero.slice(0, 10).forEach(p => {
      console.log(`   ${p.sku}:`);
      console.log(`      Venta diaria: ${p.venta_diaria || 0}`);
      console.log(`      Stock actual: ${p.stock_actual || 0}`);
      console.log(`      En tránsito: ${p.stock_en_transito || 0}`);
      console.log(`      Cantidad sugerida: ${p.cantidad_sugerida?.cantidad_sugerida || 0}`);
    });
  }

  // 3. Verificar si hay productos que realmente necesitan reposición
  if (conSugerencia.length > 0) {
    console.log(`\n✅ Productos que SÍ necesitan reposición: ${conSugerencia.length}`);

    // Estadísticas
    const totalSugerido = conSugerencia.reduce((sum, p) =>
      sum + (p.cantidad_sugerida?.cantidad_sugerida || 0), 0);

    const promedio = Math.round(totalSugerido / conSugerencia.length);

    console.log(`   Total unidades a reponer: ${totalSugerido.toLocaleString()}`);
    console.log(`   Promedio por producto: ${promedio}`);
  }

  // 4. Recomendaciones
  console.log('\n💡 RECOMENDACIONES:');

  if (conCero.length > 100) {
    console.log(`   ⚠️  Hay ${conCero.length} productos mal clasificados`);
    console.log('   📌 Solución: Ejecutar script de reclasificación masiva');
    console.log('   📌 Comando: node reclassify-products.js');
  } else if (conCero.length > 0) {
    console.log(`   ℹ️  Hay ${conCero.length} productos que se reclasificarán automáticamente`);
    console.log('   📌 Se corregirá al recargar el dashboard');
  } else {
    console.log('   ✅ Todos los productos en NEEDS_REPLENISHMENT tienen sugerencia > 0');
  }

  console.log('\n✅ Verificación completada\n');
}

checkNeedsReplenishment().catch(console.error);
