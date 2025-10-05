// pages/api/product-quote-info.js - Lightweight endpoint for quote modal
import { supabase } from '../../lib/supabaseClient';

// Función para obtener fechas reales desde la vista materializada
async function getVentaDiariaDetails(sku, ventaDiaria, ventaDiariaCalculada) {
  console.log(`🔄 Obteniendo datos desde vista materializada para SKU ${sku}...`);

  try {
    // Obtener desde la vista materializada que ya tiene las fechas calculadas
    const { data: ventaData } = await supabase
      .from('sku_venta_diaria_mv')
      .select('*')
      .eq('sku', sku)
      .single();

    if (ventaData) {
      console.log(`✅ Fechas obtenidas desde vista materializada para SKU ${sku}`);
      return {
        fechaInicial: ventaData.fecha_inicio,
        fechaFinal: ventaData.fecha_fin,
        unidadesVendidas: ventaData.unidades_vendidas,
        ventaDiariaCalculada: ventaData.venta_diaria_promedio.toFixed(2),
        esCalculoReal: true,
        mensaje: 'Fechas desde vista materializada'
      };
    }
  } catch (error) {
    console.error(`Error obteniendo desde vista materializada para ${sku}:`, error);
  }

  // Fallback a fechas hardcodeadas si falla
  console.log(`🔄 Usando fallback para SKU ${sku}`);
  return {
    fechaInicial: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    fechaFinal: new Date().toISOString().split('T')[0],
    unidadesVendidas: ventaDiariaCalculada ? Math.round(ventaDiaria * 90) : null,
    ventaDiariaCalculada: ventaDiaria,
    esCalculoReal: ventaDiariaCalculada,
    mensaje: ventaDiariaCalculada ? 'Venta diaria obtenida del cache de análisis' : 'Venta diaria no disponible - usando valor mínimo de fallback'
  };
}

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
  maxDuration: 5, // Fast 5 second timeout
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Super fast timeout - 4 seconds
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      console.log('⚠️ Product quote info timeout');
      res.status(200).json({
        success: false,
        message: 'Timeout loading product info',
        results: []
      });
    }
  }, 4000);
  
  try {
    const { sku } = req.query;
    
    if (!sku) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: 'SKU parameter is required' });
    }

    // 1. Get basic product info
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('sku, descripcion, stock_actual, precio_venta_sugerido, link, status')
      .eq('sku', sku)
      .single();
      
    if (productError || !product) {
      clearTimeout(timeoutId);
      return res.status(404).json({ error: 'Product not found' });
    }

    // 2. Get configuration (cached or fast query)
    const { data: configData, error: configError } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();
      
    if (configError) {
      clearTimeout(timeoutId);
      return res.status(500).json({ error: 'Configuration not found' });
    }
    
    const config = configData.data;
    const stockDias = config.stockSaludableMinDias || 30;


    // 3. Get stock en tránsito and calculate proper cantidad sugerida
    const { data: comprasData } = await supabase
      .from('compras')
      .select('cantidad')
      .eq('sku', sku)
      .eq('status_compra', 'en_transito');

    const stockEnTransito = comprasData?.reduce((sum, compra) => sum + (compra.cantidad || 0), 0) || 0;

    // Get venta diaria from cache or indicate calculation not available
    let ventaDiaria = null;
    let ventaDiariaCalculada = false;
    let stockObjetivo = 0;

    try {
      // Try to get from analysis cache first
      const { data: cacheData } = await supabase
        .from('sku_analysis_cache')
        .select('venta_diaria')
        .eq('sku', sku)
        .single();

      if (cacheData && cacheData.venta_diaria > 0) {
        ventaDiaria = cacheData.venta_diaria;
        ventaDiariaCalculada = true;
      }
    } catch (cacheError) {
      console.log('Cache not available for venta diaria calculation');
    }

    // If no venta diaria available, use minimum fallback but indicate it's not calculated
    if (!ventaDiariaCalculada) {
      ventaDiaria = 0.1; // Minimum fallback to avoid division by zero
      console.log(`No venta diaria data available for SKU ${sku}, using minimum fallback`);
    }

    // Get real-time venta diaria for accurate stock objetivo calculation
    const ventaDiariaDetails = await getVentaDiariaDetails(sku, ventaDiaria, ventaDiariaCalculada);
    const realTimeVentaDiaria = parseFloat(ventaDiariaDetails.ventaDiariaCalculada) || ventaDiaria;

    // Calculate stock objetivo using real-time venta diaria
    if (sku === 'R-FMMX015112') {
        console.log(`🔍 DEBUG ${sku}: cachedVentaDiaria=${ventaDiaria}, realTimeVentaDiaria=${realTimeVentaDiaria}, stockDias=${stockDias}`);
    }
    stockObjetivo = Math.round(realTimeVentaDiaria * stockDias);
    if (sku === 'R-FMMX015112') {
        console.log(`🔍 DEBUG ${sku}: stockObjetivo final=${stockObjetivo}`);
    }

    // Calculate lead time consumption using configuration
    const tiempoEntrega = config.tiempoEntrega || 60;
    const tiempoFabricacion = config.tiempoPromedioFabricacion || 30;
    const leadTimeDias = tiempoEntrega + tiempoFabricacion;
    const consumoDuranteLeadTime = Math.round(realTimeVentaDiaria * leadTimeDias);

    // Calculate stock proyectado a la llegada
    const stockActual = product.stock_actual || 0;
    const stockProyectadoLlegada = stockActual + stockEnTransito - consumoDuranteLeadTime;

    // Apply correct logic for cantidad sugerida
    let cantidadSugerida = 0;
    if (stockProyectadoLlegada < 0) {
      // Si el stock proyectado es negativo, necesitamos el stock objetivo completo
      cantidadSugerida = stockObjetivo;
    } else {
      // Si el stock proyectado es positivo, solo necesitamos la diferencia
      cantidadSugerida = Math.max(0, stockObjetivo - stockProyectadoLlegada);
    }

    // Debug specific SKU
    if (sku === '649762430948') {
      console.log(`🔍 QUOTE-INFO DEBUG ${sku}: realTimeVentaDiaria=${realTimeVentaDiaria}, stockActual=${stockActual}, stockEnTransito=${stockEnTransito}`);
      console.log(`🔍 QUOTE-INFO DEBUG ${sku}: stockObjetivo=${stockObjetivo}, consumo=${consumoDuranteLeadTime}, stockProyectado=${stockProyectadoLlegada}`);
      console.log(`🔍 QUOTE-INFO DEBUG ${sku}: stockDias=${stockDias}, leadTimeDias=${leadTimeDias}`);
      console.log(`🔍 QUOTE-INFO DEBUG ${sku}: cantidadSugerida FINAL=${cantidadSugerida}`);
    }

    // 4. Create detailed breakdown for the modal
    const breakdown = {
      stockActual: stockActual,
      stockObjetivo: stockObjetivo,
      ventaDiaria: realTimeVentaDiaria,
      stockEnTransitoQueLlega: stockEnTransito,
      consumoDuranteLeadTime: consumoDuranteLeadTime,
      stockFinalProyectado: stockProyectadoLlegada,
      diasCoberturaLlegada: realTimeVentaDiaria > 0 ? Math.round(stockProyectadoLlegada / realTimeVentaDiaria) : 0,
      ventaDiariaDetails: ventaDiariaDetails
    };

    // 5. Save exact calculation to cache for reuse by dashboard
    const calculationData = {
      sku: product.sku,
      venta_diaria_real: realTimeVentaDiaria,
      stock_objetivo: stockObjetivo,
      stock_en_transito: stockEnTransito,
      consumo_durante_lead_time: consumoDuranteLeadTime,
      stock_proyectado_llegada: stockProyectadoLlegada,
      cantidad_sugerida: cantidadSugerida,
      lead_time_dias: leadTimeDias,
      stock_saludable_dias: stockDias,
      calculation_method: 'real_time',
      config_used: config
    };

    // Note: Cache saving removed - no longer needed
    // The calculation is done in real-time for accuracy

    // 6. Create response
    const result = {
      sku: product.sku,
      descripcion: product.descripcion,
      status: product.status,
      stock_actual: product.stock_actual || 0,
      precio_venta_sugerido: product.precio_venta_sugerido,
      link: product.link,
      cantidadSugerida: cantidadSugerida,
      breakdown: breakdown,
      essential: true,
      fromCache: false
    };

    clearTimeout(timeoutId);
    const processingTime = Date.now() - startTime;
    
    return res.status(200).json({
      success: true,
      results: [result],
      configActual: config,
      metadata: {
        processed: 1,
        fastMode: true,
        simplified: true,
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in product-quote-info:', error);
    clearTimeout(timeoutId);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Error loading product info: ' + error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}