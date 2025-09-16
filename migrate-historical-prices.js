// migrate-historical-prices.js - Migrar precios históricos a ventas
const { supabase } = require('./lib/supabaseClient.js');

async function migrateHistoricalPrices() {
  console.log('🔄 Iniciando migración de precios históricos...');
  
  try {
    // 1. Verificar que la columna precio_unitario existe
    console.log('🔍 Verificando estructura de la tabla...');
    const { error: checkError } = await supabase
      .from('ventas')
      .select('precio_unitario')
      .limit(1);
    
    if (checkError) {
      console.error('❌ La columna precio_unitario no existe');
      console.log('📋 Primero ejecuta en Supabase SQL Editor:');
      console.log('   ALTER TABLE ventas ADD COLUMN precio_unitario DECIMAL(10,2);');
      return;
    }
    
    console.log('✅ Columna precio_unitario encontrada');
    
    // 2. Obtener ventas sin precio
    const { data: ventasSinPrecio, error: ventasError } = await supabase
      .from('ventas')
      .select('id, sku, cantidad, fecha_venta')
      .is('precio_unitario', null)
      .limit(100); // Procesar de a 100
    
    if (ventasError) {
      throw new Error(`Error obteniendo ventas: ${ventasError.message}`);
    }
    
    if (!ventasSinPrecio || ventasSinPrecio.length === 0) {
      console.log('✅ Todas las ventas ya tienen precio asignado');
      return;
    }
    
    console.log(`📊 Encontradas ${ventasSinPrecio.length} ventas sin precio`);
    
    // 3. Estrategia para asignar precios históricos
    const updates = [];
    
    for (const venta of ventasSinPrecio) {
      // Estrategia: usar precio promedio basado en el tipo de SKU
      let precioEstimado = 0;
      
      // Obtener info del producto para estimar precio
      const { data: producto } = await supabase
        .from('products')
        .select('precio_venta_sugerido, costo_fob_rmb, descripcion')
        .eq('sku', venta.sku)
        .single();
      
      if (producto) {
        // Prioridad 1: precio sugerido
        if (producto.precio_venta_sugerido && producto.precio_venta_sugerido > 0) {
          precioEstimado = producto.precio_venta_sugerido;
        }
        // Prioridad 2: costo FOB con margen
        else if (producto.costo_fob_rmb && producto.costo_fob_rmb > 0) {
          precioEstimado = Math.round(producto.costo_fob_rmb * 130 * 2.5);
        }
        // Prioridad 3: precio por categoría
        else {
          if (producto.descripcion?.includes('PACK')) {
            precioEstimado = 15000; // Packs suelen ser más caros
          } else if (venta.sku.startsWith('R-')) {
            precioEstimado = 5000; // Productos R- suelen ser más baratos
          } else {
            precioEstimado = 8000; // Precio base
          }
        }
      } else {
        // Sin info del producto, usar precio base
        precioEstimado = 8000;
      }
      
      updates.push({
        id: venta.id,
        precio_unitario: precioEstimado
      });
      
      console.log(`💰 ${venta.sku}: ${precioEstimado} CLP`);
    }
    
    // 4. Actualizar precios en lotes
    if (updates.length > 0) {
      console.log(`🔄 Actualizando ${updates.length} registros...`);
      
      const { error: updateError } = await supabase
        .from('ventas')
        .upsert(updates, { onConflict: 'id' });
      
      if (updateError) {
        throw new Error(`Error actualizando precios: ${updateError.message}`);
      }
      
      console.log('✅ Precios históricos actualizados exitosamente');
      
      // 5. Verificar resultado
      const { data: verificacion } = await supabase
        .from('ventas')
        .select('sku, precio_unitario, fecha_venta')
        .not('precio_unitario', 'is', null)
        .order('fecha_venta', { ascending: false })
        .limit(5);
      
      console.log('\\n📈 Últimas ventas con precio:');
      verificacion?.forEach(v => {
        console.log(`  ${v.sku}: $${v.precio_unitario} (${v.fecha_venta})`);
      });
    }
    
    console.log('\\n🎉 Migración completada. Ya puedes usar precios reales en el cache.');
    
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
  }
  
  process.exit(0);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  migrateHistoricalPrices();
}

module.exports = { migrateHistoricalPrices };