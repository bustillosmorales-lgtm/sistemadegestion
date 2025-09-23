// lib/exactCalculations.js - Shared exact calculation logic
import { supabase } from './supabaseClient';

// Helper function for venta diaria calculation (same as product-quote-info)
async function getVentaDiariaDetails(sku, ventaDiaria, ventaDiariaCalculada) {
  console.log(`🔄 Calculating real-time venta diaria for SKU ${sku}...`);

  try {
    // Import the analysis function
    const analysisModule = await import('../pages/api/analysis.js');
    console.log(`📦 Analysis module imported for SKU ${sku}`);

    // Get the complete product for calculation
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('sku', sku)
      .single();

    if (product) {
      console.log(`👤 Product obtained for SKU ${sku}, calling calculateVentaDiariaBatch...`);
      // Call batch calculation to get real dates
      const ventaDiariaResults = await analysisModule.calculateVentaDiariaBatch([product]);
      const result = ventaDiariaResults.get(sku);

      if (result && result.fechasAnalisis) {
        console.log(`✅ Real dates obtained for SKU ${sku}: ${result.fechasAnalisis.fechaInicio} - ${result.fechasAnalisis.fechaFin}`);
        return {
          fechaInicial: result.fechasAnalisis.fechaInicio,
          fechaFinal: result.fechasAnalisis.fechaFin,
          unidadesVendidas: result.fechasAnalisis.unidadesVendidas,
          ventaDiariaCalculada: result.ventaDiaria.toFixed(2),
          esCalculoReal: true,
          realTimeVentaDiaria: parseFloat(result.ventaDiaria.toFixed(2))
        };
      }
    }
  } catch (error) {
    console.error(`Error calculating real-time venta diaria for ${sku}:`, error);
  }

  // Fallback - this should rarely happen in a mathematically correct system
  console.log(`⚠️ Using fallback for SKU ${sku} - this indicates missing data`);
  return {
    fechaInicial: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    fechaFinal: new Date().toISOString().split('T')[0],
    ventaDiariaCalculada: ventaDiaria,
    esCalculoReal: ventaDiariaCalculada,
    realTimeVentaDiaria: parseFloat(ventaDiaria),
    mensaje: ventaDiariaCalculada ? 'Venta diaria from cache' : 'Fallback value'
  };
}

// Main exact calculation function (same logic as product-quote-info)
export async function calculateExactQuoteInfo(sku, config = null) {
  console.log(`🧮 Starting exact calculation for SKU ${sku}`);

  try {
    // 1. Get basic product info
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('sku, descripcion, stock_actual, precio_venta_sugerido, link, status')
      .eq('sku', sku)
      .single();

    if (productError || !product) {
      throw new Error('Product not found');
    }

    // 2. Get configuration if not provided
    if (!config) {
      const { data: configData, error: configError } = await supabase
        .from('configuration')
        .select('data')
        .eq('id', 1)
        .single();

      if (configError) {
        throw new Error('Configuration not found');
      }
      config = configData.data;
    }

    const stockDias = config.stockSaludableMinDias || 30;
    const tiempoEntrega = config.tiempoEntrega || 60;
    const tiempoFabricacion = config.tiempoPromedioFabricacion || 30;
    const leadTimeDias = tiempoEntrega + tiempoFabricacion;

    // 3. Get stock en tránsito
    const { data: comprasData } = await supabase
      .from('compras')
      .select('cantidad')
      .eq('sku', sku)
      .eq('status_compra', 'en_transito');

    const stockEnTransito = comprasData?.reduce((sum, compra) => sum + (compra.cantidad || 0), 0) || 0;

    // 4. Get real-time venta diaria
    let ventaDiaria = null;
    let ventaDiariaCalculada = false;

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
      ventaDiaria = 0.1; // Minimum fallback
      console.log(`No venta diaria data available for SKU ${sku}, using minimum fallback`);
    }

    // Get real-time venta diaria for accurate calculation
    const ventaDiariaDetails = await getVentaDiariaDetails(sku, ventaDiaria, ventaDiariaCalculada);
    const realTimeVentaDiaria = ventaDiariaDetails.realTimeVentaDiaria || ventaDiaria;

    // 5. Calculate all values using real-time data
    const stockActual = product.stock_actual || 0;
    const stockObjetivo = Math.round(realTimeVentaDiaria * stockDias);
    const consumoDuranteLeadTime = Math.round(realTimeVentaDiaria * leadTimeDias);
    const stockProyectadoLlegada = stockActual + stockEnTransito - consumoDuranteLeadTime;

    // Apply exact logic
    let cantidadSugerida = 0;
    if (stockProyectadoLlegada < 0) {
      cantidadSugerida = stockObjetivo;
    } else {
      cantidadSugerida = Math.max(0, stockObjetivo - stockProyectadoLlegada);
    }

    const result = {
      sku: sku,
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

    console.log(`✅ Exact calculation completed for SKU ${sku}: cantidadSugerida=${cantidadSugerida}`);
    return result;

  } catch (error) {
    console.error(`❌ Error in exact calculation for SKU ${sku}:`, error);
    throw error;
  }
}

// Function to save calculation to cache
export async function saveCalculationToCache(calculation) {
  try {
    const { error } = await supabase
      .from('product_calculations_cache')
      .upsert({
        sku: calculation.sku,
        venta_diaria_real: calculation.venta_diaria_real,
        stock_objetivo: calculation.stock_objetivo,
        stock_en_transito: calculation.stock_en_transito,
        consumo_durante_lead_time: calculation.consumo_durante_lead_time,
        stock_proyectado_llegada: calculation.stock_proyectado_llegada,
        cantidad_sugerida: calculation.cantidad_sugerida,
        lead_time_dias: calculation.lead_time_dias,
        stock_saludable_dias: calculation.stock_saludable_dias,
        calculation_method: calculation.calculation_method,
        config_used: calculation.config_used,
        fecha_calculo: new Date().toISOString()
      });

    if (error) {
      console.error('Error saving calculation to cache:', error);
    } else {
      console.log(`💾 Saved exact calculation for SKU ${calculation.sku} to cache`);
    }
  } catch (error) {
    console.error('Error in saveCalculationToCache:', error);
  }
}

// Function to get calculation from cache
export async function getCalculationFromCache(sku) {
  try {
    const { data, error } = await supabase
      .from('product_calculations_cache')
      .select('*')
      .eq('sku', sku)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if calculation is recent (less than 24 hours old)
    const calculationAge = Date.now() - new Date(data.fecha_calculo).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (calculationAge > maxAge) {
      console.log(`⏰ Cached calculation for SKU ${sku} is stale (${Math.round(calculationAge / 1000 / 60 / 60)} hours old)`);
      return null;
    }

    console.log(`📋 Using cached exact calculation for SKU ${sku}`);
    return data;
  } catch (error) {
    console.error('Error getting calculation from cache:', error);
    return null;
  }
}