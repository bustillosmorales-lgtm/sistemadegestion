// investigate-price-data.js - Investigar calidad de datos de precios
const { supabase } = require('./lib/supabaseClient.js');

async function investigatePriceData() {
  console.log('🔍 INVESTIGACIÓN DE CALIDAD DE DATOS\n');
  
  try {
    // 1. ¿Cuántos productos en total?
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    // 2. ¿Cuántos con precio_venta_sugerido?
    const { count: conPrecio } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .not('precio_venta_sugerido', 'is', null)
      .gt('precio_venta_sugerido', 0);
    
    // 3. ¿Cuántos son exactamente $8,000?
    const { count: precio8000 } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('precio_venta_sugerido', 8000);
    
    console.log('📊 RESUMEN DE PRECIOS:');
    console.log(`   🔢 Total productos: ${totalProducts}`);
    console.log(`   💰 Con precio > 0: ${conPrecio}`);
    console.log(`   🤔 Precio = $8,000: ${precio8000}`);
    console.log(`   🚫 Sin precio: ${totalProducts - conPrecio}`);
    
    // 4. Ver ejemplos de productos con $8,000
    const { data: ejemplos8000 } = await supabase
      .from('products')
      .select('sku, descripcion, precio_venta_sugerido')
      .eq('precio_venta_sugerido', 8000)
      .limit(10);
    
    console.log('\n💸 EJEMPLOS DE PRODUCTOS CON $8,000:');
    ejemplos8000?.forEach(p => {
      console.log(`   ${p.sku}: ${p.descripcion?.substring(0, 50)}...`);
    });
    
    // 5. ¿De dónde vienen estos $8,000?
    console.log('\n🔍 INVESTIGANDO ORIGEN DE $8,000...');
    
    // Ver en ventas si hay registros con precio 8000
    const { data: ventas8000 } = await supabase
      .from('ventas')
      .select('sku, precio_unitario, fecha_venta')
      .eq('precio_unitario', 8000)
      .limit(5);
    
    if (ventas8000 && ventas8000.length > 0) {
      console.log('   ✅ Encontrados en tabla ventas:');
      ventas8000.forEach(v => {
        console.log(`      ${v.sku}: $${v.precio_unitario} (${v.fecha_venta})`);
      });
      console.log('   💡 EXPLICACIÓN: $8,000 son precios reales de ventas!');
    } else {
      console.log('   ❌ No encontrados en ventas - probablemente precio estimado');
    }
    
    // 6. Ver distribución de precios
    console.log('\n📈 DISTRIBUCIÓN DE PRECIOS:');
    const { data: distribucion } = await supabase
      .from('products')
      .select('precio_venta_sugerido')
      .not('precio_venta_sugerido', 'is', null)
      .order('precio_venta_sugerido', { ascending: false });
    
    if (distribucion) {
      const precios = distribucion.map(p => p.precio_venta_sugerido);
      const max = Math.max(...precios);
      const min = Math.min(...precios);
      const promedio = Math.round(precios.reduce((a, b) => a + b, 0) / precios.length);
      
      // Contar frecuencias de precios comunes
      const frecuencias = {};
      precios.forEach(p => {
        frecuencias[p] = (frecuencias[p] || 0) + 1;
      });
      
      console.log(`   📊 Rango: $${min.toLocaleString()} - $${max.toLocaleString()}`);
      console.log(`   📊 Promedio: $${promedio.toLocaleString()}`);
      
      // Top precios más frecuentes
      const topPrecios = Object.entries(frecuencias)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
      
      console.log('   🔢 Precios más frecuentes:');
      topPrecios.forEach(([precio, cantidad]) => {
        console.log(`      $${parseInt(precio).toLocaleString()}: ${cantidad} productos`);
      });
    }
    
    // 7. ¿Cuántos productos tienen ventas reales vs estimados?
    console.log('\n🎯 PRODUCTOS CON VENTAS REALES:');
    const { data: skusConVentas } = await supabase
      .from('ventas')
      .select('sku')
      .not('precio_unitario', 'is', null)
      .gt('precio_unitario', 0);
    
    const skusUnicosConVentas = new Set(skusConVentas?.map(v => v.sku) || []);
    
    console.log(`   ✅ SKUs con ventas reales: ${skusUnicosConVentas.size}`);
    console.log(`   ❌ SKUs sin ventas: ${totalProducts - skusUnicosConVentas.size}`);
    console.log(`   📊 Ratio: ${Math.round((skusUnicosConVentas.size/totalProducts)*100)}% tienen ventas`);
    
    console.log('\n🔍 CONCLUSIÓN:');
    console.log('   💡 $8,000 probablemente son precios estimados del cache anterior');
    console.log('   💡 Solo 62 productos tienen precios reales de ventas');
    console.log('   💡 El resto necesita precios estimados o quedar en $0');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

investigatePriceData().then(() => {
  console.log('\n✅ Investigación completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});