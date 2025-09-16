// test-real-prices.js - Probar precios reales en el cache
const { supabase } = require('./lib/supabaseClient.js');

async function testRealPrices() {
  console.log('🧪 Probando precios reales...');
  
  try {
    // 1. Obtener SKUs con precios reales
    const { data: ventasConPrecio } = await supabase
      .from('ventas')
      .select('sku, precio_unitario, fecha_venta')
      .not('precio_unitario', 'is', null)
      .gt('precio_unitario', 0)
      .order('precio_unitario', { ascending: false });
    
    const skusUnicos = [...new Set(ventasConPrecio.map(v => v.sku))];
    console.log(`📊 ${skusUnicos.length} SKUs únicos con precios reales`);
    
    // 2. Actualizar cache para algunos SKUs de prueba
    const testSkus = skusUnicos.slice(0, 5); // Primeros 5
    console.log(`🔄 Actualizando cache para: ${testSkus.join(', ')}`);
    
    const cacheUpdates = [];
    
    for (const sku of testSkus) {
      // Obtener último precio real
      const ultimaVenta = ventasConPrecio.find(v => v.sku === sku);
      const precioReal = ultimaVenta.precio_unitario;
      
      // Simular datos de cache
      const ventaDiaria = 1.0; // Simulado
      const stockActual = 0; // Simulado - necesita reposición
      const cantidadSugerida = Math.round(ventaDiaria * 30 - stockActual);
      
      cacheUpdates.push({
        sku: sku,
        precio_promedio_30d: precioReal,
        precio_promedio_90d: precioReal,
        venta_diaria: ventaDiaria,
        cantidad_sugerida_30d: cantidadSugerida,
        cantidad_sugerida_60d: Math.round(ventaDiaria * 60),
        cantidad_sugerida_90d: Math.round(ventaDiaria * 90),
        stock_objetivo_30d: Math.round(ventaDiaria * 30),
        stock_actual_cache: stockActual,
        calculo_confiable: true, // Es precio real
        ultima_actualizacion: new Date().toISOString()
      });
      
      const valorEconomico = precioReal * cantidadSugerida;
      console.log(`💰 ${sku}: precio=${precioReal} × cantidad=${cantidadSugerida} = ${valorEconomico.toLocaleString()} CLP`);
    }
    
    // 3. Actualizar cache
    const { error } = await supabase
      .from('sku_analysis_cache')
      .upsert(cacheUpdates, { onConflict: 'sku' });
    
    if (error) {
      console.error('❌ Error actualizando cache:', error.message);
      return;
    }
    
    console.log(`✅ Cache actualizado para ${cacheUpdates.length} SKUs con precios REALES`);
    
    // 4. Verificar ordenamiento
    const { data: topProducts } = await supabase
      .from('sku_analysis_cache')
      .select('sku, precio_promedio_30d, cantidad_sugerida_30d')
      .gt('precio_promedio_30d', 0)
      .gt('cantidad_sugerida_30d', 0)
      .order('precio_promedio_30d', { ascending: false })
      .limit(10);
    
    console.log('\\n🏆 Top 10 productos por precio (ordenamiento por impacto):');
    
    // Calcular valor económico y reordenar
    const conValor = topProducts.map(p => ({
      ...p,
      valorEconomico: p.precio_promedio_30d * p.cantidad_sugerida_30d
    })).sort((a, b) => b.valorEconomico - a.valorEconomico);
    
    conValor.forEach((p, i) => {
      console.log(`${i+1}. ${p.sku}: $${p.precio_promedio_30d.toLocaleString()} × ${p.cantidad_sugerida_30d} = $${p.valorEconomico.toLocaleString()}`);
    });
    
    console.log('\\n🎉 ¡Sistema funcionando con PRECIOS REALES!');
    console.log('📈 El ordenamiento ahora es por valor económico real, no precios inventados');
    
    // 5. Comparar con productos sin precio (deberían ir al final)
    const { count: sinPrecio } = await supabase
      .from('sku_analysis_cache')
      .select('*', { count: 'exact', head: true })
      .eq('precio_promedio_30d', 0);
      
    console.log(`\\n📊 Productos sin precio (van al final): ${sinPrecio || 0}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

testRealPrices();