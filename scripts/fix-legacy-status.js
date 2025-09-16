// scripts/fix-legacy-status.js - Migrar productos con status "activo" al nuevo workflow
const { supabase } = require('../lib/supabaseClient');

async function fixLegacyStatus() {
  try {
    console.log('🔧 Iniciando migración de status legados...');
    
    // 1. Obtener todos los productos con status "activo"
    const { data: legacyProducts, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'activo');
      
    if (fetchError) {
      console.error('❌ Error obteniendo productos:', fetchError);
      return;
    }
    
    if (!legacyProducts || legacyProducts.length === 0) {
      console.log('✅ No hay productos con status "activo" para migrar');
      return;
    }
    
    console.log(`📦 Encontrados ${legacyProducts.length} productos con status "activo"`);
    console.log('🔄 Iniciando migración...\n');
    
    let migrated = 0;
    let errors = 0;
    
    for (const product of legacyProducts) {
      try {
        // Determinar el nuevo status basándose en la lógica simple
        let newStatus = 'NEEDS_REPLENISHMENT'; // Por defecto
        
        // Si el producto ya está desconsiderado, dejarlo como "sin reposición"
        if (product.desconsiderado) {
          newStatus = 'NO_REPLENISHMENT_NEEDED';
        }
        // Si hay stock muy alto, podría no necesitar reposición
        else if ((product.stock_actual || 0) > 100) {
          newStatus = 'NO_REPLENISHMENT_NEEDED';
        }
        // Si es un producto nuevo creado desde el formulario
        else if (product.request_details?.createdFromForm) {
          newStatus = 'QUOTE_REQUESTED';
        }
        
        // Actualizar solo el status
        const { error: updateError } = await supabase
          .from('products')
          .update({ status: newStatus })
          .eq('sku', product.sku);
          
        if (updateError) {
          console.error(`❌ Error actualizando ${product.sku}:`, updateError);
          errors++;
        } else {
          console.log(`✅ ${product.sku}: "activo" → "${newStatus}"`);
          migrated++;
        }
        
      } catch (productError) {
        console.error(`💥 Error procesando ${product.sku}:`, productError);
        errors++;
      }
    }
    
    console.log('\n📊 Resumen de migración:');
    console.log(`✅ Productos migrados: ${migrated}`);
    console.log(`❌ Errores: ${errors}`);
    console.log(`📦 Total procesados: ${legacyProducts.length}`);
    
    if (migrated > 0) {
      console.log('\n🎉 Migración completada! Los productos ahora usan el nuevo sistema de workflow.');
    }
    
  } catch (error) {
    console.error('💥 Error general en migración:', error);
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  fixLegacyStatus();
}

module.exports = { fixLegacyStatus };