// pages/api/analysis-cached.js - API súper rápida usando cache de dashboard
// NETLIFY FORCE BUILD: 2025-09-23
import { supabase } from '../../lib/supabaseClient';
import { getActiveOrdersSummaryBatch, calculateReplenishmentStatus } from '../../lib/purchaseOrdersHelper';

// Función para obtener venta diaria - usa el valor ya calculado desde la vista materializada
async function getVentaDiariaDetails(sku, ventaDiaria, ventaDiariaCalculada) {
  // Simplemente retornar el valor que ya tenemos desde sku_venta_diaria_mv
  // Este valor ya es el cálculo en tiempo real más preciso
  return {
    realTimeVentaDiaria: parseFloat(ventaDiaria),
    esCalculoReal: ventaDiariaCalculada
  };
}

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
  maxDuration: 5, // Mucho más rápido al usar cache
}

export default async function handler(req, res) {
  const startTime = Date.now();

  // Debug log para verificar que se está usando analysis-cached
  console.log('🚀 ANALYSIS-CACHED API CALLED - REAL-TIME CALCULATIONS ENABLED');
  console.log('📅 Build timestamp: 2025-09-23 - NETLIFY FORCE BUILD');

  // Headers anti-cache para responses pero usamos cache interno
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Last-Modified', new Date().toUTCString());

  try {
    const limit = parseInt(req.query.limit) || 15;
    const offset = parseInt(req.query.offset) || 0;

    // 1. Intentar obtener datos desde cache válido
    let cachedData = null;
    let totalCount = 0;
    let cacheAvailable = false;

    try {
      const { data, error: cacheError, count } = await supabase
        .from('dashboard_analysis_cache')
        .select('*', { count: 'exact' })
        .gt('expires_at', new Date().toISOString()) // Solo cache válido
        .order('impacto_economico->valorTotal', { ascending: false, nullsLast: true })
        .range(offset, offset + limit - 1);

      if (!cacheError && data) {
        cachedData = data;
        totalCount = count || 0;
        cacheAvailable = true;
        console.log(`📊 Cache table exists and has ${totalCount} valid entries`);
      } else {
        console.log('📊 Cache table not available or no valid data:', cacheError?.message || 'No data');
      }
    } catch (error) {
      console.log('📊 Cache table might not exist:', error.message);
      cacheAvailable = false;
    }

    // 2. Si tenemos datos en cache válido, usarlos
    if (cacheAvailable && cachedData && cachedData.length > 0) {
      console.log(`🚀 Cache HIT: Serving ${cachedData.length} products from cache`);

      // Get detail fields from original products table
      const skuList = cachedData.map(cached => cached.sku);
      const { data: productDetails } = await supabase
        .from('products')
        .select('sku, request_details, quote_details, analysis_details, approval_details, purchase_details, manufacturing_details, shipping_details')
        .in('sku', skuList);

      // Create lookup map for details
      const detailsMap = {};
      if (productDetails) {
        productDetails.forEach(product => {
          detailsMap[product.sku] = product;
        });
      }

      // Transformar datos del cache al formato esperado por el frontend
      const results = cachedData.map(cached => ({
        sku: cached.sku,
        descripcion: cached.descripcion,
        status: cached.status,
        stock_actual: cached.stock_actual,
        venta_diaria: cached.venta_diaria,
        ventaDiariaCalculada: cached.venta_diaria_calculada,
        enTransito: cached.en_transito,
        cantidadSugerida: cached.cantidad_sugerida,
        stockObjetivo: cached.stock_objetivo,
        stockProyectadoLlegada: cached.stock_proyectado_llegada,
        consumoDuranteLeadTime: cached.consumo_durante_lead_time,
        leadTimeDias: cached.lead_time_dias,
        impactoEconomico: cached.impacto_economico,
        essential: cached.essential,
        fromCache: cached.from_cache,
        cacheCalculatedAt: cached.calculated_at,
        // Include detail fields from products table
        request_details: detailsMap[cached.sku]?.request_details,
        quote_details: detailsMap[cached.sku]?.quote_details,
        analysis_details: detailsMap[cached.sku]?.analysis_details,
        price_modification_details: null, // Column doesn't exist yet
        approval_details: detailsMap[cached.sku]?.approval_details,
        purchase_details: detailsMap[cached.sku]?.purchase_details,
        manufacturing_details: detailsMap[cached.sku]?.manufacturing_details,
        shipping_details: detailsMap[cached.sku]?.shipping_details
      }));

      // Update product status based on cantidadSugerida (cache hit scenario)
      for (const result of results) {
        try {
          // Auto-assign NO_REPLENISHMENT_NEEDED status for products with cantidadSugerida = 0
          if (result.cantidadSugerida === 0 &&
              result.status !== 'NO_REPLENISHMENT_NEEDED' &&
              result.status !== 'SHIPPED' &&
              !(result.status === 'QUOTE_REQUESTED' && result.request_details?.createdFromForm) &&
              !(result.isNewProduct && ['QUOTED', 'ANALYZING', 'PURCHASE_APPROVED'].includes(result.status))) {

            await supabase
              .from('products')
              .update({
                status: 'NO_REPLENISHMENT_NEEDED',
                updated_at: new Date().toISOString()
              })
              .eq('sku', result.sku);

            // Update result to reflect new status
            result.status = 'NO_REPLENISHMENT_NEEDED';
          }
          // If cantidadSugerida > 0 and currently in NO_REPLENISHMENT_NEEDED, move to NEEDS_REPLENISHMENT
          else if (result.cantidadSugerida > 0 &&
                   result.status === 'NO_REPLENISHMENT_NEEDED' &&
                   !(result.status === 'QUOTE_REQUESTED' && result.request_details?.createdFromForm)) {

            await supabase
              .from('products')
              .update({
                status: 'NEEDS_REPLENISHMENT',
                updated_at: new Date().toISOString()
              })
              .eq('sku', result.sku);

            // Update result to reflect new status
            result.status = 'NEEDS_REPLENISHMENT';
          }
        } catch (statusUpdateError) {
          console.error(`Error updating status for ${result.sku}:`, statusUpdateError);
        }
      }

      const processingTime = Date.now() - startTime;

      return res.status(200).json({
        results,
        configActual: cachedData[0]?.config_usado || {},
        metadata: {
          total: totalCount || cachedData.length,
          offset: offset,
          limit: limit,
          processed: results.length,
          hasMore: offset + limit < (totalCount || 0),
          cacheMode: true,
          cacheHitRatio: '100%',
          processingTime: `${processingTime}ms`,
          fromCacheCount: results.length,
          cacheAge: cachedData[0] ? Math.round((Date.now() - new Date(cachedData[0].calculated_at).getTime()) / 1000) : 0,
          timestamp: new Date().toISOString()
        }
      });
    }

    // 3. Si no hay cache válido, fallback a datos básicos inmediatamente
    console.log('⚡ Cache MISS: Returning basic data (cache will be calculated in background)');

    // TODO: En el futuro, trigger background calculation aquí
    // Por ahora, solo devolvemos datos básicos

    // Get total count of products first
    const { count: allProductsCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });


    // Get configuration for calculations
    const { data: configData } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();

    const config = configData?.data || {};
    const stockSaludableMinDias = config.stockSaludableMinDias || 30;
    const tiempoEntrega = config.tiempoEntrega || 60;
    const tiempoFabricacion = config.tiempoPromedioFabricacion || 30;
    const leadTimeDias = tiempoEntrega + tiempoFabricacion;

    // Responder inmediatamente con datos básicos de productos
    const { data: basicProducts, error: productsError } = await supabase
      .from('products')
      .select('sku, descripcion, status, stock_actual, precio_venta_sugerido, request_details, quote_details, analysis_details, approval_details, purchase_details, manufacturing_details, shipping_details')
      .range(offset, offset + limit - 1)
      .order('sku');

    if (productsError) {
      console.error('Basic products query failed:', productsError);
      throw new Error('Products query failed: ' + productsError.message);
    }

    // Get SKU list for batch queries
    const skuList = basicProducts?.map(p => p.sku) || [];

    // DON'T use sku_analysis_cache as it has stale data
    // Instead we'll calculate conservatively like product-quote-info does
    console.log('📊 Skipping sku_analysis_cache (stale data) - using conservative calculation');

    // Batch query: Get stock en transito for all SKUs
    // Incluye desde que se confirma la cotización hasta que llega el contenedor
    const { data: stockEnTransitoData } = await supabase
      .from('compras')
      .select('sku, cantidad')
      .in('sku', skuList)
      .in('status_compra', ['confirmado', 'en_transito']);

    // No ventaDiariaMap - we'll calculate conservatively for each SKU

    const stockEnTransitoMap = {};
    if (stockEnTransitoData) {
      stockEnTransitoData.forEach(item => {
        if (!stockEnTransitoMap[item.sku]) {
          stockEnTransitoMap[item.sku] = 0;
        }
        stockEnTransitoMap[item.sku] += item.cantidad || 0;
      });
    }

    console.log(`📊 Using exact calculations for ${skuList.length} SKUs (product-quote-info logic)`);
    console.log(`🚛 Stock en tránsito found for ${Object.keys(stockEnTransitoMap).length} SKUs`);

    // Obtener órdenes activas para todos los SKUs
    console.log(`📦 Obteniendo órdenes activas para ${skuList.length} SKUs...`);
    const ordersSummaryMap = await getActiveOrdersSummaryBatch(skuList);
    console.log(`✅ Órdenes obtenidas para ${ordersSummaryMap.size} SKUs`);

    // First get real venta diaria data for ALL SKUs in batch
    console.log(`🧮 Getting real venta diaria for ${skuList.length} SKUs from sku_analysis_cache...`);

    const { data: ventaDiariaData } = await supabase
      .from('sku_analysis_cache')
      .select('sku, venta_diaria')
      .in('sku', skuList);

    // Create lookup map for venta diaria
    const ventaDiariaMap = {};
    if (ventaDiariaData) {
      ventaDiariaData.forEach(item => {
        if (item.venta_diaria > 0) {
          ventaDiariaMap[item.sku] = item.venta_diaria;
        }
      });
    }

    console.log(`📊 Found real venta diaria for ${Object.keys(ventaDiariaMap).length} SKUs, using fallback for ${skuList.length - Object.keys(ventaDiariaMap).length} SKUs`);

    const basicResults = await Promise.all((basicProducts || []).map(async product => {
      // Try multiple price sources
      const precioVenta = product.precio_venta_sugerido ||
                         (product.analysis_details?.sellingPrice ? parseInt(product.analysis_details.sellingPrice) : 0) ||
                         0;
      const stockActual = product.stock_actual || 0;

      // Use EXACT same calculation logic as product-quote-info with real data
      let cantidadSugerida = 0;

      // Declare these variables at top level for proper scope
      let ventaDiaria = ventaDiariaMap[product.sku] || null;
      let ventaDiariaCalculada = !!ventaDiariaMap[product.sku];
      let datosInsuficientes = !ventaDiariaCalculada;

      // Si no hay datos suficientes, retornar marcado como insuficiente
      if (datosInsuficientes) {
        return {
          sku: product.sku,
          descripcion: product.descripcion,
          status: product.status,
          stock_actual: stockActual,
          precio_venta_sugerido: precioVenta,
          venta_diaria: null,
          ventaDiariaCalculada: false,
          datosInsuficientes: true,
          enTransito: stockEnTransitoMap[product.sku] || 0,
          cantidadSugerida: null,
          stockObjetivo: null,
          stockProyectadoLlegada: null,
          consumoDuranteLeadTime: null,
          leadTimeDias: leadTimeDias,
          request_details: product.request_details,
          quote_details: product.quote_details,
          analysis_details: product.analysis_details,
          price_modification_details: null,
          approval_details: product.approval_details,
          purchase_details: product.purchase_details,
          manufacturing_details: product.manufacturing_details,
          shipping_details: product.shipping_details,
          impactoEconomico: {
            valorTotal: 0,
            precioPromedioReal: 0,
            prioridad: 'N/A',
            estimado: false,
            mensaje: '⚠️ Datos insuficientes para cálculo'
          },
          essential: true,
          fromCache: false,
          calculating: false
        };
      }

      if (precioVenta > 0) {

        // Get real-time venta diaria (same as quote modal)
        const ventaDiariaDetails = await getVentaDiariaDetails(product.sku, ventaDiaria, ventaDiariaCalculada);
        ventaDiaria = ventaDiariaDetails.realTimeVentaDiaria;
        ventaDiariaCalculada = ventaDiariaDetails.esCalculoReal;

        // Re-check if data is still insufficient after real-time calculation
        if (!ventaDiaria || ventaDiaria <= 0) {
          datosInsuficientes = true;
          return {
            sku: product.sku,
            descripcion: product.descripcion,
            status: product.status,
            stock_actual: stockActual,
            precio_venta_sugerido: precioVenta,
            venta_diaria: null,
            ventaDiariaCalculada: false,
            datosInsuficientes: true,
            enTransito: stockEnTransitoMap[product.sku] || 0,
            cantidadSugerida: null,
            stockObjetivo: null,
            stockProyectadoLlegada: null,
            consumoDuranteLeadTime: null,
            leadTimeDias: leadTimeDias,
            request_details: product.request_details,
            quote_details: product.quote_details,
            analysis_details: product.analysis_details,
            price_modification_details: null,
            approval_details: product.approval_details,
            purchase_details: product.purchase_details,
            manufacturing_details: product.manufacturing_details,
            shipping_details: product.shipping_details,
            impactoEconomico: {
              valorTotal: 0,
              precioPromedioReal: 0,
              prioridad: 'N/A',
              estimado: false,
              mensaje: '⚠️ Datos insuficientes para cálculo'
            },
            essential: true,
            fromCache: false,
            calculating: false
          };
        }

        // Debug for specific SKU
        if (product.sku === '649762430948') {
          console.log(`🔍 ANALYSIS-CACHED REAL-TIME VENTA DIARIA: ${product.sku} = ${ventaDiaria} (calculated: ${ventaDiariaCalculada})`);
        }

        // Get real stock en transito
        const stockEnTransito = stockEnTransitoMap[product.sku] || 0;

        // Calculate stock objetivo using real venta diaria
        const stockObjetivo = Math.round(ventaDiaria * stockSaludableMinDias);

        // Calculate consumo durante lead time using real venta diaria
        const consumoDuranteLeadTime = Math.round(ventaDiaria * leadTimeDias);

        // Calculate stock proyectado a la llegada with real data
        const stockProyectadoLlegada = stockActual + stockEnTransito - consumoDuranteLeadTime;

        // Debug specific SKU - compare configurations
        if (product.sku === '649762430948') {
          console.log(`🔍 ANALYSIS-CACHED CONFIG: stockSaludableMinDias=${stockSaludableMinDias}, leadTimeDias=${leadTimeDias}`);
          console.log(`🔍 ANALYSIS-CACHED VALUES: ventaDiaria=${ventaDiaria}, stockActual=${stockActual}, stockEnTransito=${stockEnTransito}`);
          console.log(`🔍 ANALYSIS-CACHED CALC: stockObjetivo=${stockObjetivo}, consumo=${consumoDuranteLeadTime}, stockProyectado=${stockProyectadoLlegada}`);
        }

        // Apply EXACT same logic as product-quote-info
        if (stockProyectadoLlegada < 0) {
          // Si el stock proyectado es negativo, necesitamos el stock objetivo completo
          cantidadSugerida = stockObjetivo;
        } else {
          // Si el stock proyectado es positivo, solo necesitamos la diferencia
          cantidadSugerida = Math.max(0, stockObjetivo - stockProyectadoLlegada);
        }

        if (product.sku === '649762430948') {
          console.log(`🔍 DEBUG ${product.sku}: cantidadSugerida FINAL=${cantidadSugerida}`);
        }
      }

      // Obtener info de órdenes para este SKU
      const ordersSummary = ordersSummaryMap.get(product.sku) || {
        hasOrders: false,
        totalOrders: 0,
        cantidadEnProceso: 0,
        orders: []
      };

      // Calcular estado de reposición considerando órdenes
      const replenishmentStatus = calculateReplenishmentStatus(
        cantidadSugerida, // cantidad total necesaria
        ordersSummary.cantidadEnProceso // cantidad en proceso
      );

      // For products without prices, don't suggest replenishment
      const valorTotal = precioVenta * cantidadSugerida;

      return {
        sku: product.sku,
        descripcion: product.descripcion,
        status: product.status,
        stock_actual: stockActual,
        precio_venta_sugerido: precioVenta,
        venta_diaria: ventaDiaria,
        ventaDiariaCalculada: ventaDiariaCalculada,
        datosInsuficientes: false, // Datos suficientes para cálculo
        enTransito: stockEnTransitoMap[product.sku] || 0,
        cantidadSugerida: cantidadSugerida,
        // NUEVOS CAMPOS - Sistema de múltiples órdenes
        cantidadTotalNecesaria: replenishmentStatus.cantidadTotalNecesaria,
        cantidadEnProceso: replenishmentStatus.cantidadEnProceso,
        cantidadPendiente: replenishmentStatus.cantidadPendiente,
        replenishmentStatus: replenishmentStatus.status,
        replenishmentAlert: replenishmentStatus.alert,
        needsAdditionalAction: replenishmentStatus.needsAction,
        activeOrders: ordersSummary.orders,
        totalActiveOrders: ordersSummary.totalOrders,
        // FIN NUEVOS CAMPOS
        stockObjetivo: Math.round(ventaDiaria * stockSaludableMinDias),
        stockProyectadoLlegada: stockActual + (stockEnTransitoMap[product.sku] || 0) - Math.round(ventaDiaria * leadTimeDias),
        consumoDuranteLeadTime: Math.round(ventaDiaria * leadTimeDias),
        leadTimeDias: leadTimeDias,
        // Include detail fields for Info button
        request_details: product.request_details,
        quote_details: product.quote_details,
        analysis_details: product.analysis_details,
        price_modification_details: null, // Column doesn't exist yet
        approval_details: product.approval_details,
        purchase_details: product.purchase_details,
        manufacturing_details: product.manufacturing_details,
        shipping_details: product.shipping_details,
        impactoEconomico: {
          valorTotal: Math.round(valorTotal),
          precioPromedioReal: Math.round(precioVenta),
          prioridad: valorTotal > 500000 ? 'CRÍTICA' : valorTotal > 200000 ? 'ALTA' : valorTotal > 100000 ? 'MEDIA' : 'BAJA',
          estimado: true,
          periodoAnalisis: 'Cálculo rápido'
        },
        essential: true,
        fromCache: false,
        calculating: false // Using fast calculation
      };
    }));

    // Filter out errored results
    const validResults = basicResults.filter(r => !r.error);

    // Update product status based on cantidadSugerida
    for (const result of validResults) {
      try {
        // Auto-assign NO_REPLENISHMENT_NEEDED status for products with cantidadSugerida = 0
        if (result.cantidadSugerida === 0 &&
            result.status !== 'NO_REPLENISHMENT_NEEDED' &&
            result.status !== 'SHIPPED' &&
            !(result.status === 'QUOTE_REQUESTED' && result.request_details?.createdFromForm) &&
            !(result.isNewProduct && ['QUOTED', 'ANALYZING', 'PURCHASE_APPROVED'].includes(result.status))) {

          await supabase
            .from('products')
            .update({
              status: 'NO_REPLENISHMENT_NEEDED',
              updated_at: new Date().toISOString()
            })
            .eq('sku', result.sku);

          // Update result to reflect new status
          result.status = 'NO_REPLENISHMENT_NEEDED';
        }
        // If cantidadSugerida > 0 and currently in NO_REPLENISHMENT_NEEDED, move to NEEDS_REPLENISHMENT
        else if (result.cantidadSugerida > 0 &&
                 result.status === 'NO_REPLENISHMENT_NEEDED' &&
                 !(result.status === 'QUOTE_REQUESTED' && result.request_details?.createdFromForm)) {

          await supabase
            .from('products')
            .update({
              status: 'NEEDS_REPLENISHMENT',
              updated_at: new Date().toISOString()
            })
            .eq('sku', result.sku);

          // Update result to reflect new status
          result.status = 'NEEDS_REPLENISHMENT';
        }
      } catch (statusUpdateError) {
        console.error(`Error updating status for ${result.sku}:`, statusUpdateError);
      }
    }

    // Sort by replenishment value (highest first)
    validResults.sort((a, b) => b.impactoEconomico.valorTotal - a.impactoEconomico.valorTotal);

    // Count cache hits
    const fromCacheCount = validResults.filter(r => r.fromCache).length;

    const processingTime = Date.now() - startTime;

    return res.status(200).json({
      results: validResults,
      configActual: {},
      metadata: {
        total: allProductsCount || 0,
        offset: offset,
        limit: limit,
        processed: validResults.length,
        hasMore: offset + limit < (allProductsCount || 0),
        cacheMode: false,
        calculating: false,
        message: 'Usando cálculo exacto igual que \"Pedir Cotización\"',
        processingTime: `${processingTime}ms`,
        fromCacheCount: fromCacheCount,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error en API analysis-cached:', error);

    return res.status(500).json({
      error: 'Error en análisis: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
}