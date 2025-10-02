// pages/api/test-cached.js - Test simple de la API cache
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  console.log('🧪 Testing cached API...');

  try {
    // Test básico de conexión
    const { data: testData, error: testError } = await supabase
      .from('products')
      .select('sku, descripcion')
      .limit(3);

    if (testError) {
      console.error('❌ Basic test failed:', testError);
      return res.status(500).json({
        error: 'Database connection failed',
        details: testError.message
      });
    }

    // Test de tabla cache
    let cacheTest = 'Cache table not available';
    try {
      const { data: cacheData, error: cacheError } = await supabase
        .from('dashboard_analysis_cache')
        .select('sku')
        .limit(1);

      if (!cacheError) {
        cacheTest = `Cache table exists with ${cacheData?.length || 0} test entries`;
      } else {
        cacheTest = `Cache table error: ${cacheError.message}`;
      }
    } catch (error) {
      cacheTest = `Cache table exception: ${error.message}`;
    }

    return res.status(200).json({
      success: true,
      basicProducts: testData?.length || 0,
      cacheStatus: cacheTest,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Test failed:', error);
    return res.status(500).json({
      error: 'Test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}