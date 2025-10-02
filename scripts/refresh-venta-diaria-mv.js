// scripts/refresh-venta-diaria-mv.js
// Script para refrescar la vista materializada de venta_diaria
// Ejecutar diariamente con: npm run refresh-venta-diaria

const { supabase } = require('../lib/supabaseClient');

async function refreshVentaDiariaMV() {
  console.log('🔄 Refrescando vista materializada sku_venta_diaria_mv...');
  const startTime = Date.now();

  try {
    // Ejecutar refresh de la vista materializada
    const { error } = await supabase.rpc('refresh_venta_diaria_mv');

    if (error) {
      console.error('❌ Error al refrescar vista materializada:', error);
      process.exit(1);
    }

    // Obtener estadísticas de la vista actualizada
    const { count: totalSkus, error: totalError } = await supabase
      .from('sku_venta_diaria_mv')
      .select('*', { count: 'exact', head: true });

    const { count: confiables, error: confiablesError } = await supabase
      .from('sku_venta_diaria_mv')
      .select('*', { count: 'exact', head: true })
      .eq('calculo_confiable', true);

    if (!totalError && !confiablesError) {
      const noConfiables = (totalSkus || 0) - (confiables || 0);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('✅ Vista materializada actualizada exitosamente');
      console.log(`📊 Estadísticas:`);
      console.log(`   - Total SKUs: ${totalSkus || 0}`);
      console.log(`   - Con datos confiables: ${confiables || 0} (${totalSkus ? Math.round((confiables || 0)/totalSkus*100) : 0}%)`);
      console.log(`   - Datos insuficientes: ${noConfiables} (${totalSkus ? Math.round(noConfiables/totalSkus*100) : 0}%)`);
      console.log(`   - Tiempo de ejecución: ${duration}s`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  refreshVentaDiariaMV();
}

module.exports = refreshVentaDiariaMV;
