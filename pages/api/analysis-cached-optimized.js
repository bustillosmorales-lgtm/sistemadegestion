// pages/api/analysis-cached-optimized.js - Versión optimizada usando daily_sales_analysis
// Sin fallbacks - Solo datos reales pre-calculados

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
  const startTime = Date.now();

  console.log('🚀 OPTIMIZED ANALYSIS-CACHED API CALLED');
  console.log('📅 Using daily_sales_analysis pre-calculated data');

  try {
    // Headers anti-cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { limit = 50, offset = 0 } = req.query;
    console.log(`📊 Request: limit=${limit}, offset=${offset}`);

    // 1. Obtener productos con datos pre-calculados mediante JOIN optimizado
    const { data: productsWithSales, error: productsError, count } = await supabase
      .from('products')
      .select(`
        sku,
        descripcion,
        stock_actual,
        precio_venta_sugerido,
        status,
        daily_sales_analysis!left(
          venta_diaria,
          fecha_calculo,
          metodo_calculo,
          dias_historicos
        )
      `, { count: 'exact' })
      .neq('status', 'DESCONSIDERADO')
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
      .order('sku');

    if (productsError) {
      console.error('❌ Error fetching products:', productsError);
      return res.status(500).json({
        success: false,
        error: 'Error fetching products',
        details: productsError.message
      });
    }

    console.log(`📦 Got ${productsWithSales?.length || 0} products`);

    // 2. Obtener configuración
    const { data: configData } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();

    const config = configData?.data || {};
    const stockSaludableMinDias = config.stockSaludableMinDias || 30;
    const leadTimeDias = (config.tiempoEntrega || 60) + (config.tiempoPromedioFabricacion || 30);

    console.log(`⚙️ Config: stockDias=${stockSaludableMinDias}, leadTime=${leadTimeDias}`);

    // 3. Obtener stock en tránsito para todos los SKUs
    const skus = productsWithSales.map(p => p.sku);
    const { data: stockInTransit } = await supabase
      .from('shipments')
      .select('sku, SUM(quantity) as total_quantity')
      .in('sku', skus)
      .in('status', ['EN_TRANSITO', 'CONFIRMED'])
      .group('sku');

    const stockInTransitMap = {};
    if (stockInTransit) {
      stockInTransit.forEach(item => {
        stockInTransitMap[item.sku] = parseFloat(item.total_quantity) || 0;
      });
      console.log(`🚛 Stock en tránsito found for ${Object.keys(stockInTransitMap).length} SKUs`);
    }

    // 4. Procesar productos con cálculos usando datos pre-calculados
    const results = (productsWithSales || []).map(product => {
      const stockActual = product.stock_actual || 0;
      const precioVenta = product.precio_venta_sugerido || 0;
      const stockEnTransito = stockInTransitMap[product.sku] || 0;

      // Usar venta_diaria pre-calculada (DATOS REALES)
      const salesData = product.daily_sales_analysis?.[0];
      const ventaDiaria = salesData?.venta_diaria || 0; // Si no existe = 0 (producto sin ventas)
      const ventaDiariaCalculada = !!salesData; // true si tiene datos pre-calculados

      // Debug para SKU específico
      if (product.sku === '649762430948') {
        console.log(`🔍 DEBUG ${product.sku}: ventaDiaria=${ventaDiaria} (pre-calculada), método=${salesData?.metodo_calculo}`);
      }

      // Cálculos usando datos reales pre-calculados
      const stockObjetivo = Math.round(ventaDiaria * stockSaludableMinDias);
      const consumoDuranteLeadTime = Math.round(ventaDiaria * leadTimeDias);
      const stockProyectadoLlegada = stockActual + stockEnTransito - consumoDuranteLeadTime;

      let cantidadSugerida = 0;
      if (stockProyectadoLlegada < 0) {
        cantidadSugerida = stockObjetivo;
      } else {
        cantidadSugerida = Math.max(0, stockObjetivo - stockProyectadoLlegada);
      }

      return {
        sku: product.sku,
        descripcion: product.descripcion,
        status: product.status,
        stock_actual: stockActual,
        precio_venta_sugerido: precioVenta,
        venta_diaria: ventaDiaria,
        ventaDiariaCalculada,
        enTransito: stockEnTransito,
        cantidadSugerida: cantidadSugerida,
        stockObjetivo: stockObjetivo,
        stockProyectadoLlegada: stockProyectadoLlegada,
        consumoDuranteLeadTime: consumoDuranteLeadTime,
        leadTimeDias: leadTimeDias,
        impactoEconomico: {
          valorTotal: Math.round(precioVenta * cantidadSugerida),
          precioPromedioReal: Math.round(precioVenta),
          prioridad: cantidadSugerida > stockObjetivo * 0.5 ? 'ALTA' :
                    cantidadSugerida > 0 ? 'MEDIA' : 'BAJA',
          estimado: false, // Datos reales pre-calculados
          periodoAnalisis: salesData?.metodo_calculo || 'no_data',
          fechaCalculo: salesData?.fecha_calculo,
          diasHistoricos: salesData?.dias_historicos
        },
        essential: cantidadSugerida > 0,
        fromCache: false,
        calculating: false,
        optimized: true
      };
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Processed ${results.length} products in ${duration}ms using pre-calculated data`);

    // 5. Estadísticas de respuesta
    const withVentaDiaria = results.filter(r => r.venta_diaria > 0).length;
    const withSuggestions = results.filter(r => r.cantidadSugerida > 0).length;
    const totalSuggestedValue = results.reduce((sum, r) => sum + r.impactoEconomico.valorTotal, 0);

    return res.status(200).json({
      success: true,
      results: results,
      metadata: {
        processed: results.length,
        totalCount: count,
        withVentaDiaria,
        withSuggestions,
        totalSuggestedValue,
        fastMode: true,
        optimized: true,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        version: 'OPTIMIZED-WITH-PRECALC',
        config: {
          stockSaludableMinDias,
          leadTimeDias
        }
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Error in optimized analysis-cached:', error);

    return res.status(500).json({
      success: false,
      error: 'Error in optimized analysis: ' + error.message,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  }
}