// pages/api/clean-attention-products.js - Limpiar productos que requieren atención
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Obtener todos los productos con paginación
    let allProducts = [];
    let pageSize = 1000;
    let currentPage = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: productsPage, error } = await supabase
        .from('products')
        .select('sku, status, descripcion')
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

      if (error) throw new Error('Error: ' + error.message);

      if (productsPage && productsPage.length > 0) {
        allProducts = allProducts.concat(productsPage);
        if (productsPage.length < pageSize) {
          hasMore = false;
        } else {
          currentPage++;
        }
      } else {
        hasMore = false;
      }
    }

    // Filtrar productos que requieren atención
    const attentionStatuses = ['QUOTE_REQUESTED', 'QUOTED', 'ANALYZING', 'PURCHASE_APPROVED'];
    const attentionProducts = allProducts.filter(p => attentionStatuses.includes(p.status));

    // Agrupar por status
    const grouped = {
      QUOTE_REQUESTED: [],
      QUOTED: [],
      ANALYZING: [],
      PURCHASE_APPROVED: []
    };

    attentionProducts.forEach(p => {
      if (grouped[p.status]) {
        grouped[p.status].push(p);
      }
    });

    // Si es GET, solo mostrar
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        total: attentionProducts.length,
        byStatus: {
          QUOTE_REQUESTED: { count: grouped.QUOTE_REQUESTED.length, products: grouped.QUOTE_REQUESTED },
          QUOTED: { count: grouped.QUOTED.length, products: grouped.QUOTED },
          ANALYZING: { count: grouped.ANALYZING.length, products: grouped.ANALYZING },
          PURCHASE_APPROVED: { count: grouped.PURCHASE_APPROVED.length, products: grouped.PURCHASE_APPROVED }
        }
      });
    }

    // Si es POST, limpiar
    const { action, newStatus } = req.body;

    if (action === 'reset_all') {
      const targetStatus = newStatus || 'NO_REPLENISHMENT_NEEDED';

      console.log(`🧹 Limpiando ${attentionProducts.length} productos a ${targetStatus}...`);

      // Actualizar todos los SKUs
      const skusToUpdate = attentionProducts.map(p => p.sku);

      const { data: updated, error: updateError } = await supabase
        .from('products')
        .update({ status: targetStatus })
        .in('sku', skusToUpdate)
        .select('sku, status');

      if (updateError) {
        throw new Error('Error actualizando: ' + updateError.message);
      }

      console.log(`✅ ${updated.length} productos actualizados`);

      return res.status(200).json({
        success: true,
        message: `${updated.length} productos actualizados a ${targetStatus}`,
        updated: updated.length,
        newStatus: targetStatus
      });
    }

    if (action === 'reset_by_status') {
      const { fromStatus, toStatus } = req.body;

      if (!fromStatus || !toStatus) {
        return res.status(400).json({ error: 'fromStatus y toStatus son requeridos' });
      }

      const productsToUpdate = grouped[fromStatus] || [];

      if (productsToUpdate.length === 0) {
        return res.status(200).json({
          success: true,
          message: `No hay productos con status ${fromStatus}`,
          updated: 0
        });
      }

      console.log(`🧹 Actualizando ${productsToUpdate.length} productos de ${fromStatus} a ${toStatus}...`);

      const skusToUpdate = productsToUpdate.map(p => p.sku);

      const { data: updated, error: updateError } = await supabase
        .from('products')
        .update({ status: toStatus })
        .in('sku', skusToUpdate)
        .select('sku, status');

      if (updateError) {
        throw new Error('Error: ' + updateError.message);
      }

      return res.status(200).json({
        success: true,
        message: `${updated.length} productos actualizados de ${fromStatus} a ${toStatus}`,
        updated: updated.length,
        fromStatus,
        toStatus
      });
    }

    return res.status(400).json({ error: 'Acción no válida' });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
