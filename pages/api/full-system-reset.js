// pages/api/full-system-reset.js - Reset completo del sistema
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const report = {
      inTransit: { before: 0, after: 0, updated: [] },
      reminders: { before: 0, after: 0, deleted: [] },
      activeOrders: { before: 0, after: 0, updated: [] },
      disregarded: { before: 0, after: 0, updated: [] }
    };

    // 1. Verificar productos en tránsito
    const { data: inTransitProducts } = await supabase
      .from('products')
      .select('sku, status, descripcion')
      .in('status', ['PURCHASE_CONFIRMED', 'MANUFACTURED', 'SHIPPED']);

    report.inTransit.before = inTransitProducts?.length || 0;

    // 2. Verificar recordatorios activos
    const { data: activeReminders } = await supabase
      .from('replenishment_reminders')
      .select('*')
      .eq('is_active', true);

    report.reminders.before = activeReminders?.length || 0;

    // 3. Verificar productos con órdenes activas
    const { data: productsWithOrders } = await supabase
      .from('products')
      .select('sku, descripcion, has_active_orders, primary_status')
      .eq('has_active_orders', true);

    report.activeOrders.before = productsWithOrders?.length || 0;

    // 4. Verificar desconsiderados
    const { data: disregardedProducts } = await supabase
      .from('products')
      .select('sku, descripcion, desconsiderado')
      .eq('desconsiderado', true);

    report.disregarded.before = disregardedProducts?.length || 0;

    // Si es GET, solo reportar
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        report: {
          inTransit: {
            count: report.inTransit.before,
            products: inTransitProducts || []
          },
          reminders: {
            count: report.reminders.before,
            reminders: activeReminders || []
          },
          activeOrders: {
            count: report.activeOrders.before,
            products: productsWithOrders || []
          },
          disregarded: {
            count: report.disregarded.before,
            products: disregardedProducts || []
          }
        }
      });
    }

    // Si es POST, ejecutar limpieza
    const { resetInTransit, resetReminders, resetActiveOrders, resetDisregarded } = req.body;

    // 1. Limpiar productos en tránsito
    if (resetInTransit && inTransitProducts && inTransitProducts.length > 0) {
      const skus = inTransitProducts.map(p => p.sku);

      const { data: updated } = await supabase
        .from('products')
        .update({ status: 'NO_REPLENISHMENT_NEEDED' })
        .in('sku', skus)
        .select('sku, status');

      report.inTransit.updated = updated || [];
      report.inTransit.after = 0;
      console.log(`✅ ${updated?.length || 0} productos en tránsito limpiados`);
    }

    // 2. Desactivar recordatorios
    if (resetReminders && activeReminders && activeReminders.length > 0) {
      const { data: deactivated } = await supabase
        .from('replenishment_reminders')
        .update({ is_active: false })
        .eq('is_active', true)
        .select('*');

      report.reminders.deleted = deactivated || [];
      report.reminders.after = 0;
      console.log(`✅ ${deactivated?.length || 0} recordatorios desactivados`);
    }

    // 3. Limpiar productos con órdenes activas
    if (resetActiveOrders && productsWithOrders && productsWithOrders.length > 0) {
      const skus = productsWithOrders.map(p => p.sku);

      const { data: updated } = await supabase
        .from('products')
        .update({
          has_active_orders: false,
          primary_status: null,
          total_cantidad_en_proceso: 0,
          status: 'NO_REPLENISHMENT_NEEDED'
        })
        .in('sku', skus)
        .select('sku, has_active_orders');

      report.activeOrders.updated = updated || [];
      report.activeOrders.after = 0;
      console.log(`✅ ${updated?.length || 0} productos con órdenes activas limpiados`);
    }

    // 4. Limpiar desconsiderados
    if (resetDisregarded && disregardedProducts && disregardedProducts.length > 0) {
      const skus = disregardedProducts.map(p => p.sku);

      const { data: updated } = await supabase
        .from('products')
        .update({
          desconsiderado: false,
          status: 'NO_REPLENISHMENT_NEEDED'
        })
        .in('sku', skus)
        .select('sku, desconsiderado');

      report.disregarded.updated = updated || [];
      report.disregarded.after = 0;
      console.log(`✅ ${updated?.length || 0} productos desconsiderados limpiados`);
    }

    return res.status(200).json({
      success: true,
      message: 'Sistema limpiado exitosamente',
      report: report
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
