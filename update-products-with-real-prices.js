// update-products-with-real-prices.js - Actualizar products con precios reales
const { supabase } = require('./lib/supabaseClient.js');

async function updateProductsWithRealPrices() {
  console.log('💰 Actualizando products con precios reales...\n');
  
  try {
    // 1. Obtener todos los SKUs únicos que tienen precios reales
    console.log('🔍 Obteniendo SKUs con precios reales...');
    const { data: skusConPrecio } = await supabase
      .from('ventas')
      .select('sku')
      .not('precio_unitario', 'is', null)
      .gt('precio_unitario', 0);
    
    const skusUnicos = [...new Set(skusConPrecio.map(v => v.sku))];
    console.log(`   📋 SKUs únicos con precio: ${skusUnicos.length}`);
    
    // 2. Para cada SKU, obtener último precio y actualizar products
    const updates = [];
    console.log('\n📊 Obteniendo últimos precios...');
    
    for (let i = 0; i < skusUnicos.length; i++) {
      const sku = skusUnicos[i];
      
      // Obtener última venta con precio para este SKU
      const { data: ultimaVenta } = await supabase
        .from('ventas')
        .select('precio_unitario, fecha_venta')
        .eq('sku', sku)
        .not('precio_unitario', 'is', null)
        .gt('precio_unitario', 0)
        .order('fecha_venta', { ascending: false })
        .limit(1);
      
      if (ultimaVenta && ultimaVenta.length > 0) {
        updates.push({
          sku: sku,
          precio_venta_sugerido: ultimaVenta[0].precio_unitario
        });
        
        console.log(`   ✅ ${sku}: $${ultimaVenta[0].precio_unitario}`);
      }
      
      // Progreso cada 10 SKUs
      if ((i + 1) % 10 === 0) {
        console.log(`   📊 Progreso: ${i + 1}/${skusUnicos.length}`);
      }
    }
    
    console.log(`\n💾 Actualizando ${updates.length} productos...`);
    
    // 3. Actualizar products en lotes
    let actualizados = 0;
    for (const update of updates) {
      const { error } = await supabase
        .from('products')
        .update({ precio_venta_sugerido: update.precio_venta_sugerido })
        .eq('sku', update.sku);
      
      if (error) {
        console.log(`   ❌ Error ${update.sku}: ${error.message}`);
      } else {
        actualizados++;
      }
    }
    
    console.log(`\n🎉 ¡${actualizados}/${updates.length} productos actualizados!`);
    
    // 4. Verificar resultado - productos con precios más altos
    const { data: topPrecios } = await supabase
      .from('products')
      .select('sku, descripcion, precio_venta_sugerido')
      .not('precio_venta_sugerido', 'is', null)
      .gt('precio_venta_sugerido', 10000)
      .order('precio_venta_sugerido', { ascending: false })
      .limit(5);
    
    console.log('\n💰 Top 5 productos con precios reales:');
    topPrecios?.forEach(p => {
      console.log(`   ${p.sku}: $${p.precio_venta_sugerido.toLocaleString()} - ${p.descripcion?.substring(0, 40)}...`);
    });
    
    console.log('\n✅ ARQUITECTURA OPTIMIZADA:');
    console.log('   🎯 products.precio_venta_sugerido = precio real de ventas');
    console.log('   🚀 API consulta directamente products (sin joins a ventas)');
    console.log('   ⚡ Consulta ultrarápida por SKU');
    console.log('   🔄 Actualizable cuando se importan nuevas ventas');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

updateProductsWithRealPrices().then(() => {
  console.log('\n✅ Actualización completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});