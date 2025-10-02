// pages/api/force-cache-clear.js - Limpiar cache forzosamente
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  console.log('🔥 Force clearing ALL dashboard cache...');

  try {
    // 1. Delete all cache entries
    const { error: deleteError, count } = await supabase
      .from('dashboard_analysis_cache')
      .delete()
      .gte('id', 0); // Delete all rows

    if (deleteError) {
      console.error('❌ Error deleting cache:', deleteError);
      throw deleteError;
    }

    console.log(`✅ Deleted ${count || 'all'} cache entries`);

    // 2. Also clear sku_analysis_cache for complete refresh
    const { error: skuCacheError, count: skuCount } = await supabase
      .from('sku_analysis_cache')
      .delete()
      .gte('id', 0);

    if (skuCacheError) {
      console.log('⚠️ SKU cache clear failed (might not exist):', skuCacheError.message);
    } else {
      console.log(`✅ Deleted ${skuCount || 'all'} SKU cache entries`);
    }

    return res.status(200).json({
      success: true,
      message: 'Cache cleared successfully',
      dashboardCacheCleared: count || 'all',
      skuCacheCleared: skuCount || 'all',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Force cache clear failed:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}