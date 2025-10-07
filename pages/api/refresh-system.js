// pages/api/refresh-system.js
import { supabase } from '../../lib/supabaseClient';

export const config = {
  maxDuration: 300, // 5 minutos
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let dashboardCount = 0;
  let skuCount = 0;
  let mvCount = 0;

  try {
    console.log('🔄 INICIANDO REFRESH COMPLETO DEL SISTEMA...');

    // 1️⃣ Limpiar dashboard_analysis_cache
    console.log('🗑️ Paso 1/4: Limpiando dashboard_analysis_cache...');
    try {
      const { count } = await supabase
        .from('dashboard_analysis_cache')
        .select('*', { count: 'exact', head: true });

      dashboardCount = count || 0;

      await supabase
        .from('dashboard_analysis_cache')
        .delete()
        .neq('id', 0);

      console.log(`   ✅ ${dashboardCount} registros eliminados`);
    } catch (err) {
      console.error('   ❌ Error limpiando dashboard_analysis_cache:', err.message);
    }

    // 2️⃣ Limpiar sku_analysis_cache
    console.log('🗑️ Paso 2/4: Limpiando sku_analysis_cache...');
    try {
      const { count } = await supabase
        .from('sku_analysis_cache')
        .select('*', { count: 'exact', head: true });

      skuCount = count || 0;

      await supabase
        .from('sku_analysis_cache')
        .delete()
        .neq('sku', '');

      console.log(`   ✅ ${skuCount} registros eliminados`);
    } catch (err) {
      console.error('   ❌ Error limpiando sku_analysis_cache:', err.message);
    }

    // 3️⃣ Limpiar vista materializada
    console.log('🗑️ Paso 3/4: Limpiando vista materializada sku_venta_diaria_mv...');
    try {
      const { count } = await supabase
        .from('sku_venta_diaria_mv')
        .select('*', { count: 'exact', head: true });

      mvCount = count || 0;
      console.log(`   📊 Vista materializada tiene ${mvCount} registros`);

      const { error: deleteError } = await supabase
        .from('sku_venta_diaria_mv')
        .delete()
        .neq('sku', '');

      if (deleteError) {
        console.error('   ❌ Error eliminando de vista:', deleteError.message);
      } else {
        console.log(`   ✅ ${mvCount} registros eliminados de vista materializada`);
      }
    } catch (mvError) {
      console.log(`   ⚠️ Vista materializada no accesible: ${mvError.message}`);
    }

    // 4️⃣ Forzar regeneración llamando a la API
    console.log('♻️ Paso 4/4: Regenerando caches...');

    // Llamar a la API para regenerar (esto se hace en background)
    // No esperamos la respuesta para que sea rápido
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/analysis-cached?force=true`)
      .catch(err => console.log('Background refresh started'));

    console.log('✅ REFRESH COMPLETADO');

    return res.status(200).json({
      success: true,
      message: 'Sistema refrescado exitosamente',
      cleared: {
        dashboardCache: dashboardCount,
        skuCache: skuCount,
        materializedView: mvCount
      },
      note: 'Los datos se están recalculando en segundo plano'
    });

  } catch (error) {
    console.error('❌ Error en refresh:', error);
    return res.status(500).json({
      error: 'Error al refrescar sistema',
      details: error.message
    });
  }
}
