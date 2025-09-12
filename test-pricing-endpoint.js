// test-pricing-endpoint.js - Test current pricing in the analysis endpoint
const { supabase } = require('./lib/supabaseClient.js');

async function testPricingEndpoint() {
  console.log('🧪 Testing pricing endpoint...');
  
  try {
    // Get a product that we know has real pricing data
    const testSku = '649762431419'; // This SKU has price 54980 based on our import
    
    // Test 1: Check if the database has the real price
    console.log(`\n1. Checking database for SKU ${testSku}:`);
    const { data: ventaData } = await supabase
      .from('ventas')
      .select('precio_unitario, fecha_venta')
      .eq('sku', testSku)
      .not('precio_unitario', 'is', null)
      .gt('precio_unitario', 0)
      .order('fecha_venta', { ascending: false })
      .limit(1);
    
    if (ventaData && ventaData.length > 0) {
      console.log(`✅ Real price found: $${ventaData[0].precio_unitario} CLP`);
    } else {
      console.log(`❌ No real price found for ${testSku}`);
    }
    
    // Test 2: Check what the analysis-fast function returns
    console.log(`\n2. Testing analysis-fast logic directly:`);
    
    // Get product data
    const { data: product } = await supabase
      .from('products')
      .select('sku, descripcion, status, stock_actual, precio_venta_sugerido')
      .eq('sku', testSku)
      .single();
    
    if (product) {
      console.log(`Product found: ${product.descripcion}`);
      console.log(`Stock actual: ${product.stock_actual}`);
      console.log(`Precio sugerido: ${product.precio_venta_sugerido}`);
      
      // Test the fallback logic from analysis-fast.js
      const { data: ultimaVenta } = await supabase
        .from('ventas')
        .select('precio_unitario')
        .eq('sku', testSku)
        .not('precio_unitario', 'is', null)
        .gt('precio_unitario', 0)
        .order('fecha_venta', { ascending: false })
        .limit(1);
      
      let precioPromedio = 0;
      if (ultimaVenta && ultimaVenta.length > 0) {
        precioPromedio = ultimaVenta[0].precio_unitario;
        console.log(`✅ Analysis will use real price: $${precioPromedio} CLP`);
      } else {
        console.log(`❌ Analysis will use fallback price (this is the problem)`);
      }
      
      // Calculate suggested quantity (simple logic)
      const stockObjetivo = 0.5 * 30; // Conservative estimate
      const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - (product.stock_actual || 0)));
      const valorTotal = precioPromedio * cantidadSugerida;
      
      console.log(`\n📊 Analysis Result:`);
      console.log(`  - Cantidad sugerida: ${cantidadSugerida}`);
      console.log(`  - Precio promedio: $${precioPromedio}`);
      console.log(`  - Valor total: $${valorTotal.toLocaleString()}`);
      
    } else {
      console.log(`❌ Product ${testSku} not found`);
    }
    
    console.log(`\n🎯 The issue might be:`);
    console.log(`   1. Cache is not updated yet`);
    console.log(`   2. Production database is different from local`);
    console.log(`   3. Frontend is cached`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run test
testPricingEndpoint().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});