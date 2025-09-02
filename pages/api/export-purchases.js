// pages/api/export-purchases.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Obtener todas las compras con información relacionada
    const { data: compras, error: comprasError } = await supabase
      .from('compras')
      .select('*')
      .order('fecha_compra', { ascending: false });

    if (comprasError) {
      console.error('Error fetching compras:', comprasError);
      return res.status(500).json({ error: 'Error al obtener datos de compras' });
    }

    // Obtener información de productos para enriquecer los datos
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('sku, descripcion, costo_fob_rmb, cbm');

    if (productsError) {
      console.error('Error fetching products:', productsError);
    }

    // Crear un mapa de productos para búsqueda rápida
    const productMap = {};
    if (products) {
      products.forEach(product => {
        productMap[product.sku] = product;
      });
    }

    // Formatear datos para exportación
    const formattedData = compras.map(compra => {
      const product = productMap[compra.sku] || {};
      
      return {
        'ID Compra': compra.id,
        'SKU': compra.sku,
        'Descripción Producto': product.descripcion || 'N/A',
        'Cantidad Comprada': compra.cantidad || 0,
        'Fecha Compra': compra.fecha_compra ? new Date(compra.fecha_compra).toLocaleDateString('es-CL') : 'N/A',
        'Fecha Llegada Estimada': compra.fecha_llegada_estimada ? new Date(compra.fecha_llegada_estimada).toLocaleDateString('es-CL') : 'N/A',
        'Fecha Llegada Real': compra.fecha_llegada_real ? new Date(compra.fecha_llegada_real).toLocaleDateString('es-CL') : 'Pendiente',
        'Status Compra': compra.status_compra || 'N/A',
        'Costo FOB (RMB)': product.costo_fob_rmb || 0,
        'CBM Unitario': product.cbm || 0,
        'CBM Total': (product.cbm || 0) * (compra.cantidad || 0),
        'Proveedor': compra.proveedor || 'N/A',
        'Número Orden': compra.numero_orden || 'N/A',
        'Notas': compra.notas || '',
        'Creado': compra.created_at ? new Date(compra.created_at).toLocaleString('es-CL') : 'N/A',
        'Actualizado': compra.updated_at ? new Date(compra.updated_at).toLocaleString('es-CL') : 'N/A'
      };
    });

    // Agregar estadísticas generales
    const stats = {
      'Total Compras': compras.length,
      'Compras Llegadas': compras.filter(c => c.fecha_llegada_real).length,
      'Compras Pendientes': compras.filter(c => !c.fecha_llegada_real).length,
      'Compras en Tránsito': compras.filter(c => c.status_compra === 'en_transito').length,
      'Total Unidades Compradas': compras.reduce((sum, c) => sum + (c.cantidad || 0), 0),
      'CBM Total': compras.reduce((sum, c) => {
        const product = productMap[c.sku] || {};
        return sum + ((product.cbm || 0) * (c.cantidad || 0));
      }, 0).toFixed(2)
    };

    return res.status(200).json({
      success: true,
      data: formattedData,
      stats: stats,
      exportDate: new Date().toISOString(),
      totalRecords: compras.length
    });

  } catch (error) {
    console.error('Error in export-purchases:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
}