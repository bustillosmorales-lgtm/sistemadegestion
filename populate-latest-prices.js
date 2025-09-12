// populate-latest-prices.js - Poblar tabla latest_prices con últimos precios
const { supabase } = require('./lib/supabaseClient.js');

async function populateLatestPrices() {
  console.log('💰 Poblando tabla latest_prices...\n');
  
  try {
    // 1. Obtener todos los SKUs únicos que tienen precios
    console.log('🔍 Obteniendo SKUs con precios...');
    const { data: skusConPrecio } = await supabase
      .from('ventas')
      .select('sku')
      .not('precio_unitario', 'is', null)
      .gt('precio_unitario', 0);
    
    const skusUnicos = [...new Set(skusConPrecio.map(v => v.sku))];
    console.log(`   📋 SKUs únicos con precio: ${skusUnicos.length}`);
    
    // 2. Para cada SKU, obtener el último precio
    const latestPricesData = [];
    console.log('\n📊 Calculando últimos precios...');
    
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
        latestPricesData.push({
          sku: sku,
          latest_price: ultimaVenta[0].precio_unitario,
          price_date: ultimaVenta[0].fecha_venta,
          updated_at: new Date().toISOString()
        });
        
        console.log(`   ✅ ${sku}: $${ultimaVenta[0].precio_unitario}`);
      }
      
      // Progreso cada 10 SKUs
      if ((i + 1) % 10 === 0) {
        console.log(`   📊 Progreso: ${i + 1}/${skusUnicos.length}`);
      }
    }
    
    console.log(`\n💾 Insertando ${latestPricesData.length} precios en latest_prices...`);
    
    // 3. Limpiar tabla y insertar nuevos datos
    const { error: deleteError } = await supabase
      .from('latest_prices')
      .delete()
      .neq('sku', 'NEVER_EXISTS'); // Borra todo
    
    if (deleteError) {
      console.log(`   ⚠️ Error borrando datos previos: ${deleteError.message}`);
    }
    
    // Insertar en lotes de 100
    const BATCH_SIZE = 100;
    let insertados = 0;
    
    for (let i = 0; i < latestPricesData.length; i += BATCH_SIZE) {
      const batch = latestPricesData.slice(i, i + BATCH_SIZE);
      
      const { error: insertError } = await supabase
        .from('latest_prices')
        .insert(batch);
      
      if (insertError) {
        console.error(`   ❌ Error insertando lote: ${insertError.message}`);
      } else {
        insertados += batch.length;
        console.log(`   ✅ Lote ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} precios`);
      }
    }
    
    console.log(`\n🎉 ¡${insertados} precios insertados en latest_prices!`);
    
    // 4. Verificar resultado
    const { data: verificacion } = await supabase
      .from('latest_prices')
      .select('sku, latest_price')
      .order('latest_price', { ascending: false })
      .limit(5);
    
    console.log('\n💰 Top 5 precios más altos:');
    verificacion?.forEach(p => {
      console.log(`   ${p.sku}: $${p.latest_price.toLocaleString()}`);
    });
    
    console.log('\n✅ ARQUITECTURA MEJORADA:');
    console.log('   🚀 API ahora puede consultar latest_prices directamente');
    console.log('   ⚡ Sin necesidad de buscar en 12K+ registros de ventas');
    console.log('   🎯 Consulta ultrarápida por SKU');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

populateLatestPrices().then(() => {
  console.log('\n✅ Población completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});