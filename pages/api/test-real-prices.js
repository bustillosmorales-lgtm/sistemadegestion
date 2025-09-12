// pages/api/test-real-prices.js - Endpoint de prueba para verificar precios reales
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  try {
    console.log('🧪 TEST ENDPOINT - Verificando precios reales');
    
    // 1. Obtener productos con precios más altos
    const { data: products, error } = await supabase
      .from('products')
      .select('sku, descripcion, precio_venta_sugerido, stock_actual')
      .not('precio_venta_sugerido', 'is', null)
      .gt('precio_venta_sugerido', 0)
      .order('precio_venta_sugerido', { ascending: false })
      .limit(10);
      
    if (error) throw new Error(`DB Error: ${error.message}`);
    
    // 2. Calcular impacto económico simple
    const results = products.map(product => {
      const stockObjetivo = 30; // Días de stock objetivo
      const cantidadSugerida = Math.max(0, stockObjetivo - (product.stock_actual || 0));
      const valorTotal = product.precio_venta_sugerido * cantidadSugerida;
      
      return {
        sku: product.sku,
        descripcion: product.descripcion?.substring(0, 50) + '...',
        precioReal: product.precio_venta_sugerido,
        stockActual: product.stock_actual || 0,
        cantidadSugerida,
        valorTotal: Math.round(valorTotal),
        prioridad: valorTotal > 500000 ? 'CRÍTICA' : valorTotal > 200000 ? 'ALTA' : 'MEDIA'
      };
    });
    
    // 3. Ordenar por valor total (mayor impacto primero)
    results.sort((a, b) => b.valorTotal - a.valorTotal);
    
    const response = {
      success: true,
      message: 'PRECIOS REALES VERIFICADOS',
      timestamp: new Date().toISOString(),
      totalProducts: results.length,
      results: results,
      summary: {
        precioMasAlto: results[0]?.precioReal || 0,
        valorTotalMasAlto: results[0]?.valorTotal || 0,
        rangoPrecios: `$${Math.min(...results.map(r => r.precioReal)).toLocaleString()} - $${Math.max(...results.map(r => r.precioReal)).toLocaleString()}`
      }
    };
    
    // Headers para evitar cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Error en test-real-prices:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}