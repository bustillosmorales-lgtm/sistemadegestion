// pages/api/debug-attention-count.js - Debuggear el contador de "Requieren Atención"
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  try {
    console.log('🔍 Debuggeando contador de "Requieren Atención"...');

    // Obtener todos los productos con paginación
    let allProducts = [];
    let pageSize = 1000;
    let currentPage = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: productsPage, error } = await supabase
        .from('products')
        .select('sku, status, descripcion')
        .order('status')
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

      if (error) {
        throw new Error('Error: ' + error.message);
      }

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

    console.log(`📊 Total productos obtenidos: ${allProducts.length}`);

    // Contar por status relevantes
    const statusGroups = {
      'QUOTE_REQUESTED': [],
      'QUOTED': [],
      'ANALYZING': [],
      'PURCHASE_APPROVED': [],
      'OTHER': []
    };

    allProducts.forEach(p => {
      const status = p.status || 'NULL';
      if (statusGroups.hasOwnProperty(status)) {
        statusGroups[status].push({
          sku: p.sku,
          status: p.status,
          descripcion: p.descripcion
        });
      } else {
        statusGroups['OTHER'].push({
          sku: p.sku,
          status: status,
          descripcion: p.descripcion
        });
      }
    });

    const needsAttentionTotal =
      statusGroups['QUOTE_REQUESTED'].length +
      statusGroups['QUOTED'].length +
      statusGroups['ANALYZING'].length +
      statusGroups['PURCHASE_APPROVED'].length;

    const result = {
      success: true,
      needsAttentionTotal: needsAttentionTotal,
      breakdown: {
        QUOTE_REQUESTED: {
          count: statusGroups['QUOTE_REQUESTED'].length,
          products: statusGroups['QUOTE_REQUESTED']
        },
        QUOTED: {
          count: statusGroups['QUOTED'].length,
          products: statusGroups['QUOTED']
        },
        ANALYZING: {
          count: statusGroups['ANALYZING'].length,
          products: statusGroups['ANALYZING']
        },
        PURCHASE_APPROVED: {
          count: statusGroups['PURCHASE_APPROVED'].length,
          products: statusGroups['PURCHASE_APPROVED']
        }
      },
      otherStatuses: {
        count: statusGroups['OTHER'].length,
        byStatus: {}
      }
    };

    // Agrupar "OTHER" por status
    statusGroups['OTHER'].forEach(p => {
      const st = p.status;
      if (!result.otherStatuses.byStatus[st]) {
        result.otherStatuses.byStatus[st] = {
          count: 0,
          examples: []
        };
      }
      result.otherStatuses.byStatus[st].count++;
      if (result.otherStatuses.byStatus[st].examples.length < 3) {
        result.otherStatuses.byStatus[st].examples.push({
          sku: p.sku,
          descripcion: p.descripcion
        });
      }
    });

    console.log(`📊 Total "Requieren Atención": ${needsAttentionTotal}`);
    console.log(`   - QUOTE_REQUESTED: ${statusGroups['QUOTE_REQUESTED'].length}`);
    console.log(`   - QUOTED: ${statusGroups['QUOTED'].length}`);
    console.log(`   - ANALYZING: ${statusGroups['ANALYZING'].length}`);
    console.log(`   - PURCHASE_APPROVED: ${statusGroups['PURCHASE_APPROVED'].length}`);

    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
