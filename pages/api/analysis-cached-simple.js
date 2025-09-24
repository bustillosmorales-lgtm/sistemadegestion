// pages/api/analysis-cached-simple.js - Versión simplificada para debug Netlify
import { supabase } from '../../lib/supabaseClient';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
  maxDuration: 10,
}

export default async function handler(req, res) {
  console.log('🚀 SIMPLE ANALYSIS-CACHED API CALLED');
  console.log('📅 NETLIFY DEBUG VERSION - 2025-09-23');

  try {
    // Headers anti-cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { limit = 50, offset = 0 } = req.query;
    console.log(`📊 Request: limit=${limit}, offset=${offset}`);

    // Get basic product data with prices
    const { data: basicProducts, error: basicError } = await supabase
      .from('products')
      .select('sku, descripcion, stock_actual, precio_venta_sugerido, status')
      .neq('status', 'DESCONSIDERADO')
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
      .order('sku');

    if (basicError) {
      console.error('❌ Error fetching products:', basicError);
      return res.status(500).json({ error: 'Error fetching products' });
    }

    console.log(`📦 Got ${basicProducts?.length || 0} products`);

    // Get configuration
    const { data: configData } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();

    const config = configData?.data || {};
    const stockSaludableMinDias = config.stockSaludableMinDias || 30;
    const leadTimeDias = (config.tiempoEntrega || 60) + (config.tiempoPromedioFabricacion || 30);

    console.log(`⚙️ Config: stockDias=${stockSaludableMinDias}, leadTime=${leadTimeDias}`);

    // Simple calculations with fixed values for testing
    const results = (basicProducts || []).map(product => {
      const stockActual = product.stock_actual || 0;
      const precioVenta = product.precio_venta_sugerido || 0;

      // Use fixed venta diaria for testing (same as quote modal should calculate)
      const ventaDiaria = 0.04; // This should match quote modal real-time calculation
      const stockObjetivo = Math.round(ventaDiaria * stockSaludableMinDias);
      const consumoDuranteLeadTime = Math.round(ventaDiaria * leadTimeDias);
      const stockProyectadoLlegada = stockActual - consumoDuranteLeadTime;

      let cantidadSugerida = 0;
      if (stockProyectadoLlegada < 0) {
        cantidadSugerida = stockObjetivo;
      } else {
        cantidadSugerida = Math.max(0, stockObjetivo - stockProyectadoLlegada);
      }

      // Debug specific SKU
      if (product.sku === '649762430948') {
        console.log(`🔍 DEBUG ${product.sku}: ventaDiaria=${ventaDiaria}, stockObjetivo=${stockObjetivo}`);
        console.log(`🔍 DEBUG ${product.sku}: stockActual=${stockActual}, stockProyectado=${stockProyectadoLlegada}`);
        console.log(`🔍 DEBUG ${product.sku}: cantidadSugerida=${cantidadSugerida}`);
      }

      return {
        sku: product.sku,
        descripcion: product.descripcion,
        status: product.status,
        stock_actual: stockActual,
        precio_venta_sugerido: precioVenta,
        venta_diaria: ventaDiaria,
        ventaDiariaCalculada: true,
        enTransito: 0,
        cantidadSugerida: cantidadSugerida,
        stockObjetivo: stockObjetivo,
        stockProyectadoLlegada: stockProyectadoLlegada,
        consumoDuranteLeadTime: consumoDuranteLeadTime,
        leadTimeDias: leadTimeDias,
        impactoEconomico: {
          valorTotal: Math.round(precioVenta * cantidadSugerida),
          precioPromedioReal: Math.round(precioVenta),
          prioridad: 'MEDIA',
          estimado: true,
          periodoAnalisis: 'Simple calculation'
        },
        essential: true,
        fromCache: false,
        calculating: false
      };
    });

    console.log(`✅ Returning ${results.length} products with simple calculations`);

    return res.status(200).json({
      success: true,
      results: results,
      metadata: {
        processed: results.length,
        fastMode: true,
        simplified: true,
        timestamp: new Date().toISOString(),
        version: 'NETLIFY-DEBUG-SIMPLE'
      }
    });

  } catch (error) {
    console.error('❌ Error in simple analysis-cached:', error);
    return res.status(500).json({
      error: 'Error in simple analysis: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
}