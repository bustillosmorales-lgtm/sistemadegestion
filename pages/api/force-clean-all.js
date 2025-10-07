// pages/api/force-clean-all.js
import { supabase } from '../../lib/supabaseClient';

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  // Permitir cualquier método (GET o POST)
  try {
    console.log('\n🔥 LIMPIEZA FORZADA DE TODOS LOS CACHES');
    console.log('=========================================\n');

    const results = {};

    // 1. Dashboard cache
    console.log('1️⃣ Limpiando dashboard_analysis_cache...');
    try {
      await supabase.from('dashboard_analysis_cache').delete().neq('id', 0);
      results.dashboard = 'OK';
      console.log('   ✅ Limpiado');
    } catch (e) {
      results.dashboard = e.message;
      console.log('   ❌', e.message);
    }

    // 2. SKU cache
    console.log('2️⃣ Limpiando sku_analysis_cache...');
    try {
      await supabase.from('sku_analysis_cache').delete().neq('sku', '');
      results.sku = 'OK';
      console.log('   ✅ Limpiado');
    } catch (e) {
      results.sku = e.message;
      console.log('   ❌', e.message);
    }

    // 3. Vista materializada
    console.log('3️⃣ Limpiando sku_venta_diaria_mv...');
    try {
      await supabase.from('sku_venta_diaria_mv').delete().neq('sku', '');
      results.materialized = 'OK';
      console.log('   ✅ Limpiado');
    } catch (e) {
      results.materialized = e.message;
      console.log('   ❌', e.message);
    }

    // 4. Actualizar todos los productos a venta_diaria = 0
    console.log('4️⃣ Actualizando venta_diaria de productos a 0...');
    try {
      const { error } = await supabase
        .from('products')
        .update({
          venta_diaria: 0,
          updated_at: new Date().toISOString()
        })
        .neq('sku', '');

      if (error) throw error;
      results.products_update = 'OK';
      console.log('   ✅ Actualizado');
    } catch (e) {
      results.products_update = e.message;
      console.log('   ❌', e.message);
    }

    // 5. Mover productos de NEEDS_REPLENISHMENT a NO_REPLENISHMENT_NEEDED
    console.log('5️⃣ Moviendo productos a NO_REPLENISHMENT_NEEDED...');
    try {
      const { data, error } = await supabase
        .from('products')
        .update({
          status: 'NO_REPLENISHMENT_NEEDED',
          updated_at: new Date().toISOString()
        })
        .eq('status', 'NEEDS_REPLENISHMENT')
        .select('sku');

      if (error) throw error;
      results.status_update = `${data?.length || 0} productos actualizados`;
      console.log(`   ✅ ${data?.length || 0} productos movidos`);
    } catch (e) {
      results.status_update = e.message;
      console.log('   ❌', e.message);
    }

    console.log('\n✅ LIMPIEZA COMPLETADA\n');
    console.log('Resultados:', results);

    return res.status(200).json({
      success: true,
      message: 'Limpieza forzada completada',
      results
    });

  } catch (error) {
    console.error('❌ Error general:', error);
    return res.status(500).json({
      error: error.message
    });
  }
}
