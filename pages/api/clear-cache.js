// pages/api/clear-cache.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🗑️ Limpiando TODOS los caches del sistema...');

    // 1️⃣ LIMPIAR dashboard_analysis_cache
    const { count: dashboardBeforeCount } = await supabase
      .from('dashboard_analysis_cache')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 dashboard_analysis_cache - Registros antes: ${dashboardBeforeCount}`);

    const { error: deleteDashboardError } = await supabase
      .from('dashboard_analysis_cache')
      .delete()
      .neq('id', 0);

    if (deleteDashboardError) {
      console.error('❌ Error eliminando dashboard_analysis_cache:', deleteDashboardError);
      throw deleteDashboardError;
    }

    // 2️⃣ LIMPIAR sku_analysis_cache
    const { count: skuBeforeCount } = await supabase
      .from('sku_analysis_cache')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 sku_analysis_cache - Registros antes: ${skuBeforeCount}`);

    const { error: deleteSkuError } = await supabase
      .from('sku_analysis_cache')
      .delete()
      .neq('sku', '');

    if (deleteSkuError) {
      console.error('❌ Error eliminando sku_analysis_cache:', deleteSkuError);
      throw deleteSkuError;
    }

    // Verificar
    const { count: dashboardAfterCount } = await supabase
      .from('dashboard_analysis_cache')
      .select('*', { count: 'exact', head: true });

    const { count: skuAfterCount } = await supabase
      .from('sku_analysis_cache')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ dashboard_analysis_cache limpiado: ${dashboardBeforeCount} → ${dashboardAfterCount}`);
    console.log(`✅ sku_analysis_cache limpiado: ${skuBeforeCount} → ${skuAfterCount}`);

    return res.status(200).json({
      success: true,
      message: 'Todos los caches limpiados exitosamente',
      dashboardCache: {
        deleted: dashboardBeforeCount,
        remaining: dashboardAfterCount
      },
      skuCache: {
        deleted: skuBeforeCount,
        remaining: skuAfterCount
      }
    });

  } catch (error) {
    console.error('❌ Error limpiando cache:', error);
    return res.status(500).json({
      error: 'Error al limpiar cache',
      details: error.message
    });
  }
}
