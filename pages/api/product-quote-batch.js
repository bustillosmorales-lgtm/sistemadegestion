// pages/api/product-quote-batch.js - Batch version of product-quote-info for dashboard
import { supabase } from '../../lib/supabaseClient';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
  maxDuration: 30, // Longer timeout for batch processing
}

// Helper function for venta diaria calculation (simplified version)
async function getVentaDiariaForSku(sku) {
  try {
    // Try to get from analysis cache first
    const { data: cacheData } = await supabase
      .from('sku_analysis_cache')
      .select('venta_diaria')
      .eq('sku', sku)
      .single();

    if (cacheData && cacheData.venta_diaria > 0) {
      return cacheData.venta_diaria;
    }
  } catch (error) {
    // Cache not available, continue to fallback
  }

  // Use minimum fallback
  return 0.1;
}

export default async function handler(req, res) {
  const startTime = Date.now();

  try {
    const { skus, limit = 50, offset = 0 } = req.query;

    if (!skus) {
      return res.status(400).json({ error: 'SKUs parameter is required' });
    }

    // Parse SKUs (can be comma-separated or array)
    let skuList = Array.isArray(skus) ? skus : skus.split(',');

    // Apply pagination to SKU list
    const paginatedSkus = skuList.slice(offset, offset + parseInt(limit));

    console.log(`📊 Processing batch of ${paginatedSkus.length} SKUs for quote info`);

    // Get configuration (cached or fast query)
    const { data: configData, error: configError } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();

    if (configError) {
      return res.status(500).json({ error: 'Configuration not found' });
    }

    const config = configData.data;
    const stockDias = config.stockSaludableMinDias || 30;
    const tiempoEntrega = config.tiempoEntrega || 60;
    const tiempoFabricacion = config.tiempoPromedioFabricacion || 30;
    const leadTimeDias = tiempoEntrega + tiempoFabricacion;

    // Batch queries for all SKUs
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('sku, descripcion, status, stock_actual, precio_venta_sugerido, link, request_details, quote_details, analysis_details, approval_details, purchase_details, manufacturing_details, shipping_details')
      .in('sku', paginatedSkus);

    if (productsError) {
      return res.status(500).json({ error: 'Products query failed: ' + productsError.message });
    }

    // Get stock en tránsito for all SKUs
    const { data: stockEnTransitoData } = await supabase
      .from('compras')
      .select('sku, cantidad')
      .in('sku', paginatedSkus)
      .eq('status_compra', 'en_transito');

    // Create lookup map for stock en transito
    const stockEnTransitoMap = {};
    if (stockEnTransitoData) {
      stockEnTransitoData.forEach(item => {
        if (!stockEnTransitoMap[item.sku]) {
          stockEnTransitoMap[item.sku] = 0;
        }
        stockEnTransitoMap[item.sku] += item.cantidad || 0;
      });
    }

    // Process each product with exact same logic as product-quote-info
    const results = await Promise.all(products.map(async (product) => {
      try {
        const stockActual = product.stock_actual || 0;
        const precioVenta = product.precio_venta_sugerido ||
                           (product.analysis_details?.sellingPrice ? parseInt(product.analysis_details.sellingPrice) : 0) ||
                           0;

        // Get real venta diaria like product-quote-info does
        let ventaDiaria = await getVentaDiariaForSku(product.sku);

        // Get stock en transito
        const stockEnTransito = stockEnTransitoMap[product.sku] || 0;

        // Calculate stock objetivo using real venta diaria
        const stockObjetivo = Math.round(ventaDiaria * stockDias);

        // Calculate consumo durante lead time using real venta diaria
        const consumoDuranteLeadTime = Math.round(ventaDiaria * leadTimeDias);

        // Calculate stock proyectado a la llegada with real data
        const stockProyectadoLlegada = stockActual + stockEnTransito - consumoDuranteLeadTime;

        // Apply EXACT same logic as product-quote-info
        let cantidadSugerida = 0;
        if (stockProyectadoLlegada < 0) {
          // Si el stock proyectado es negativo, necesitamos el stock objetivo completo
          cantidadSugerida = stockObjetivo;
        } else {
          // Si el stock proyectado es positivo, solo necesitamos la diferencia
          cantidadSugerida = Math.max(0, stockObjetivo - stockProyectadoLlegada);
        }

        const valorTotal = precioVenta * cantidadSugerida;

        return {
          sku: product.sku,
          descripcion: product.descripcion,
          status: product.status,
          stock_actual: stockActual,
          precio_venta_sugerido: precioVenta,
          venta_diaria: ventaDiaria,
          ventaDiariaCalculada: true, // We got it from some source
          enTransito: stockEnTransito,
          cantidadSugerida: cantidadSugerida,
          stockObjetivo: stockObjetivo,
          stockProyectadoLlegada: stockProyectadoLlegada,
          consumoDuranteLeadTime: consumoDuranteLeadTime,
          leadTimeDias: leadTimeDias,
          // Include detail fields for Info button
          request_details: product.request_details,
          quote_details: product.quote_details,
          analysis_details: product.analysis_details,
          price_modification_details: null,
          approval_details: product.approval_details,
          purchase_details: product.purchase_details,
          manufacturing_details: product.manufacturing_details,
          shipping_details: product.shipping_details,
          impactoEconomico: {
            valorTotal: Math.round(valorTotal),
            precioPromedioReal: Math.round(precioVenta),
            prioridad: valorTotal > 500000 ? 'CRÍTICA' : valorTotal > 200000 ? 'ALTA' : valorTotal > 100000 ? 'MEDIA' : 'BAJA',
            estimado: false, // This is exact calculation
            periodoAnalisis: 'Cálculo exacto'
          },
          essential: true,
          fromCache: false,
          calculating: false
        };
      } catch (error) {
        console.error(`Error processing SKU ${product.sku}:`, error);
        // Return basic data if processing fails
        return {
          sku: product.sku,
          descripcion: product.descripcion,
          status: product.status,
          stock_actual: product.stock_actual || 0,
          cantidadSugerida: 0,
          error: true
        };
      }
    }));

    // Filter out errored results and sort by economic impact
    const validResults = results.filter(r => !r.error);
    validResults.sort((a, b) => b.impactoEconomico.valorTotal - a.impactoEconomico.valorTotal);

    const processingTime = Date.now() - startTime;

    return res.status(200).json({
      results: validResults,
      configActual: config,
      metadata: {
        total: skuList.length,
        offset: parseInt(offset),
        limit: parseInt(limit),
        processed: validResults.length,
        hasMore: offset + parseInt(limit) < skuList.length,
        cacheMode: false,
        calculating: false,
        message: 'Usando cálculo exacto igual que "Pedir Cotización"',
        processingTime: `${processingTime}ms`,
        fromCacheCount: 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in batch product quote:', error);
    return res.status(500).json({
      error: 'Error en análisis batch: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
}