// pages/api/check-all-status.js - Verificar todos los status en la BD
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  try {
    console.log('🔍 Consultando todos los status únicos...');

    // Obtener todos los status únicos
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('status, sku, descripcion')
      .order('status');

    if (error) {
      throw new Error('Error consultando productos: ' + error.message);
    }

    // Agrupar por status
    const statusGroups = {};
    allProducts.forEach(p => {
      const status = p.status || 'NULL';
      if (!statusGroups[status]) {
        statusGroups[status] = [];
      }
      statusGroups[status].push({
        sku: p.sku,
        descripcion: p.descripcion
      });
    });

    // Crear resumen
    const summary = Object.keys(statusGroups).map(status => ({
      status: status,
      count: statusGroups[status].length,
      examples: statusGroups[status].slice(0, 5) // Primeros 5 ejemplos
    })).sort((a, b) => b.count - a.count);

    console.log(`📊 Total status únicos: ${Object.keys(statusGroups).length}`);

    return res.status(200).json({
      success: true,
      totalProducts: allProducts.length,
      uniqueStatuses: Object.keys(statusGroups).length,
      statusSummary: summary,
      allStatusList: Object.keys(statusGroups).sort()
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
