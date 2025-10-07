// pages/api/diagnostics.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  try {
    console.log('🔍 DIAGNÓSTICO COMPLETO DEL SISTEMA');
    console.log('=====================================\n');

    // 1. Contar productos
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    console.log(`📦 Total productos: ${productCount}`);

    // 2. Contar ventas
    const { count: ventasCount } = await supabase
      .from('ventas')
      .select('*', { count: 'exact', head: true });
    console.log(`💰 Total ventas: ${ventasCount}`);

    // 3. Contar compras
    const { count: comprasCount } = await supabase
      .from('compras')
      .select('*', { count: 'exact', head: true });
    console.log(`🛒 Total compras: ${comprasCount}`);

    // 4. Contar containers
    const { count: containersCount } = await supabase
      .from('containers')
      .select('*', { count: 'exact', head: true });
    console.log(`🚢 Total containers: ${containersCount}`);

    // 5. Cache dashboard
    const { count: dashboardCacheCount } = await supabase
      .from('dashboard_analysis_cache')
      .select('*', { count: 'exact', head: true });
    console.log(`🗄️ Dashboard cache: ${dashboardCacheCount}`);

    // 6. Cache SKU
    const { count: skuCacheCount } = await supabase
      .from('sku_analysis_cache')
      .select('*', { count: 'exact', head: true });
    console.log(`🗄️ SKU cache: ${skuCacheCount}`);

    // 7. Productos por status
    const { data: statusBreakdown } = await supabase
      .from('products')
      .select('status')
      .order('status');

    const statusCounts = {};
    statusBreakdown?.forEach(p => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });

    console.log('\n📊 PRODUCTOS POR STATUS:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    // 8. Sample de venta_diaria de algunos productos
    const { data: sampleProducts } = await supabase
      .from('products')
      .select('sku, venta_diaria, stock_actual, status')
      .limit(5);

    console.log('\n📋 MUESTRA DE 5 PRODUCTOS:');
    sampleProducts?.forEach(p => {
      console.log(`   ${p.sku}: vd=${p.venta_diaria || 0}, stock=${p.stock_actual || 0}, status=${p.status}`);
    });

    // 9. Verificar si existe sku_venta_diaria_mv (materialized view)
    let mvExists = false;
    try {
      const { count: mvCount } = await supabase
        .from('sku_venta_diaria_mv')
        .select('*', { count: 'exact', head: true });
      mvExists = true;
      console.log(`\n🔍 sku_venta_diaria_mv EXISTS: ${mvCount} registros`);
    } catch (e) {
      console.log(`\n🔍 sku_venta_diaria_mv NO EXISTE`);
    }

    const result = {
      totales: {
        productos: productCount,
        ventas: ventasCount,
        compras: comprasCount,
        containers: containersCount
      },
      caches: {
        dashboard: dashboardCacheCount,
        sku: skuCacheCount
      },
      statusBreakdown: statusCounts,
      muestra: sampleProducts,
      materializedView: mvExists ? 'EXISTS' : 'NOT_FOUND'
    };

    console.log('\n✅ Diagnóstico completado');
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    return res.status(500).json({
      error: error.message,
      details: error
    });
  }
}
