// pages/api/analysis.js
import { supabase } from '../../lib/supabaseClient';
import cache from '../../lib/cache';

// Optimized batch calculation for venta diaria - reduces DB calls dramatically
async function calculateVentaDiariaBatch(skus) {
  const results = new Map();
  const cacheResults = new Map();
  const uncachedSkus = [];

  // Check cache first
  for (const sku of skus) {
    const cacheKey = `venta_diaria_${sku}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      cacheResults.set(sku, cachedResult);
    } else {
      uncachedSkus.push(sku);
    }
  }

  if (uncachedSkus.length === 0) {
    return cacheResults;
  }

  try {
    // Batch query all sales data for uncached SKUs
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    // Get all compras in one query
    const { data: compras } = await supabase
      .from('compras')
      .select('sku, fecha_llegada_real')
      .in('sku', uncachedSkus)
      .not('fecha_llegada_real', 'is', null)
      .lte('fecha_llegada_real', hace30Dias.toISOString())
      .order('fecha_llegada_real', { ascending: false });

    // Get all ventas in one query  
    const { data: ventas } = await supabase
      .from('ventas')
      .select('sku, fecha_venta, cantidad')
      .in('sku', uncachedSkus)
      .order('fecha_venta', { ascending: true });

    // Process each SKU
    for (const sku of uncachedSkus) {
      try {
        const skuCompras = compras?.filter(c => c.sku === sku) || [];
        const skuVentas = ventas?.filter(v => v.sku === sku) || [];

        let fechaInicio = null;
        
        // Find latest compra older than 30 days
        if (skuCompras.length > 0) {
          fechaInicio = new Date(skuCompras[0].fecha_llegada_real);
        } else if (skuVentas.length > 0) {
          // Use first sale date
          fechaInicio = new Date(skuVentas[0].fecha_venta);
        }

        if (!fechaInicio) {
          const result = { ventaDiaria: 0, fechasAnalisis: null };
          results.set(sku, result);
          cache.set(`venta_diaria_${sku}`, result, 30 * 60 * 1000);
          continue;
        }

        // Calculate end date - use today or last sale date if no stock
        let fechaFin = new Date();
        
        // Calculate days and total sales
        const diffTime = fechaFin.getTime() - fechaInicio.getTime();
        const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        
        const ventasEnPeriodo = skuVentas.filter(v => {
          const ventaDate = new Date(v.fecha_venta);
          return ventaDate >= fechaInicio && ventaDate <= fechaFin;
        });
        
        const totalVendido = ventasEnPeriodo.reduce((sum, venta) => sum + (venta.cantidad || 0), 0);
        const ventaDiaria = totalVendido / diffDays;
        
        const result = {
          ventaDiaria,
          fechasAnalisis: {
            fechaInicio: fechaInicio,
            fechaFin: fechaFin,
            diasPeriodo: diffDays,
            unidadesVendidas: totalVendido
          }
        };

        results.set(sku, result);
        cache.set(`venta_diaria_${sku}`, result, 30 * 60 * 1000);
        
      } catch (skuError) {
        console.error(`Error procesando SKU ${sku}:`, skuError);
        const errorResult = { ventaDiaria: 0, fechasAnalisis: null };
        results.set(sku, errorResult);
        cache.set(`venta_diaria_${sku}`, errorResult, 5 * 60 * 1000);
      }
    }
    
  } catch (error) {
    console.error('Error en cálculo batch venta diaria:', error);
    // Return cached results and empty results for uncached SKUs
    for (const sku of uncachedSkus) {
      if (!results.has(sku)) {
        results.set(sku, { ventaDiaria: 0, fechasAnalisis: null });
      }
    }
  }

  // Merge cached and newly calculated results
  for (const [sku, result] of cacheResults) {
    results.set(sku, result);
  }

  return results;
}

// Legacy function for single SKU compatibility
async function calculateVentaDiaria(sku, currentStock = 0) {
  const batchResults = await calculateVentaDiariaBatch([sku]);
  return batchResults.get(sku) || { ventaDiaria: 0, fechasAnalisis: null };
}

// La lógica de cálculo ahora calcula venta_diaria dinámicamente
function getFullAnalysis(product, config, transit, precioVenta = null, ventaDiariaCalculada = 0, fechasAnalisis = null) {
    const precioVentaCLP = precioVenta ? parseFloat(precioVenta) : 0;

    const costoFobUSD = (product.costo_fob_rmb || 0) * (config.rmbToUsd || 0);
    const comisionChinaUSD = costoFobUSD * (config.costosVariablesPct?.comisionChina || 0);
    const costoFobMasComisionUSD = costoFobUSD + comisionChinaUSD;
    const containerCBM = config.containerCBM || config.cbmContenedorEstandar || 68;
    const fletePorProductoUSD = ((config.costosFijosUSD?.fleteMaritimo || 0) / containerCBM) * (product.cbm || 0);
    const baseSeguroUSD = costoFobMasComisionUSD + fletePorProductoUSD;
    const seguroProductoUSD = baseSeguroUSD * (config.costosVariablesPct?.seguroContenedor || 0);
    const valorCifUSD = costoFobMasComisionUSD + fletePorProductoUSD + seguroProductoUSD;

    const totalCostosFijosCLP = Object.values(config.costosFijosCLP || {}).reduce((sum, val) => sum + (val || 0), 0);
    const totalCostosFijosUSD_fromCLP = totalCostosFijosCLP / (config.usdToClp || 1);
    const { fleteMaritimo, ...otrosCostosFijosUSD } = config.costosFijosUSD || {};
    const totalOtrosCostosFijosUSD = Object.values(otrosCostosFijosUSD).reduce((sum, val) => sum + (val || 0), 0);
    const costoLogisticoTotalUSD = totalCostosFijosUSD_fromCLP + totalOtrosCostosFijosUSD;
    const costoLogisticoPorCBM_USD = costoLogisticoTotalUSD / containerCBM;
    const costoLogisticoProductoUSD = costoLogisticoPorCBM_USD * (product.cbm || 0);

    const valorCifCLP = valorCifUSD * (config.usdToClp || 1);
    const adValoremCLP = valorCifCLP * (config.costosVariablesPct?.derechosAdValorem || 0);
    const baseIvaCLP = valorCifCLP + adValoremCLP;
    const ivaCLP = baseIvaCLP * (config.costosVariablesPct?.iva || 0);
    const costoLogisticoProductoCLP = costoLogisticoProductoUSD * (config.usdToClp || 1);
    const costoFinalBodegaCLP = valorCifCLP + adValoremCLP + ivaCLP + costoLogisticoProductoCLP;

    const ml = config.mercadoLibre || {};
    const comisionML = precioVentaCLP * (ml.comisionPct || 0);
    let recargoML = 0;
    if (precioVentaCLP >= (ml.envioUmbral || 0)) recargoML = ml.costoEnvio || 0;
    else if (precioVentaCLP >= (ml.cargoFijoMedioUmbral || 0)) recargoML = ml.cargoFijoMedio || 0;
    else if (precioVentaCLP > 0) recargoML = ml.cargoFijoBajo || 0;
    const costosVenta = comisionML + recargoML;
    const gananciaNeta = precioVentaCLP - costoFinalBodegaCLP - costosVenta;
    const margen = precioVentaCLP > 0 ? (gananciaNeta / precioVentaCLP) * 100 : 0;

    const hoy = new Date();
    const fechaLlegadaPedidoNuevo = new Date(new Date().setDate(hoy.getDate() + (config.tiempoEntrega || 0)));
    const stockEnTransitoQueLlega = (transit || [])
        .filter(item => item.sku === product.sku && new Date(item.fechaLlegada) < fechaLlegadaPedidoNuevo)
        .reduce((sum, item) => sum + (item.cantidad || 0), 0);
    const consumoDuranteLeadTime = ventaDiariaCalculada * (config.tiempoEntrega || 0);
    const stockFinalProyectado = (product.stock_actual || 0) + stockEnTransitoQueLlega - consumoDuranteLeadTime;
    const stockSaludableMinDias = config.stockSaludableMinDias || 0; // Usar solo el valor de configuración
    const stockObjetivo = ventaDiariaCalculada * stockSaludableMinDias;
    
    // Si stock proyectado es negativo, tratarlo como 0 para el cálculo
    const stockProyectadoParaCalculo = Math.max(0, stockFinalProyectado);
    const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - stockProyectadoParaCalculo));
    
    // Debug: log values
    console.log(`DEBUG ${product.sku}: stockObjetivo=${stockObjetivo}, stockProyectado=${stockFinalProyectado}, stockParaCalculo=${stockProyectadoParaCalculo}, cantidadSugerida=${cantidadSugerida}`);
    const diasCoberturaLlegada = ventaDiariaCalculada > 0 ? stockFinalProyectado / ventaDiariaCalculada : 0;
    
    // Usar las fechas reales del análisis si están disponibles
    let fechaInicial, fechaFinal, diasDeVenta, unidadesVendidas;
    
    if (fechasAnalisis && fechasAnalisis.fechaInicio && fechasAnalisis.fechaFin) {
      fechaInicial = new Date(fechasAnalisis.fechaInicio);
      fechaFinal = new Date(fechasAnalisis.fechaFin);
      diasDeVenta = fechasAnalisis.diasPeriodo;
      unidadesVendidas = fechasAnalisis.unidadesVendidas;
    } else {
      // Fallback a 60 días si no hay fechas reales
      diasDeVenta = 60;
      fechaFinal = new Date();
      fechaInicial = new Date(new Date().setDate(fechaFinal.getDate() - diasDeVenta));
      unidadesVendidas = Math.round(ventaDiariaCalculada * diasDeVenta);
    }

    return {
        ...product,
        venta_diaria: ventaDiariaCalculada,
        enTransito: (transit || []).filter(t => t.sku === product.sku).reduce((sum, item) => sum + (item.cantidad || 0), 0),
        cantidadSugerida,
        costoFinalBodega: costoFinalBodegaCLP || 0,
        costosVenta: costosVenta || 0, 
        gananciaNeta: gananciaNeta || 0, 
        margen: margen || 0,
        breakdown: {
            stockObjetivo: (stockObjetivo || 0).toFixed(0),
            stockActual: product.stock_actual || 0,
            stockEnTransitoQueLlega: stockEnTransitoQueLlega || 0,
            consumoDuranteLeadTime: (consumoDuranteLeadTime || 0).toFixed(0),
            stockFinalProyectado: (stockFinalProyectado || 0).toFixed(0),
            ventaDiaria: ventaDiariaCalculada || 0,
            tiempoEntrega: config.tiempoEntrega || 0,
            diasCoberturaLlegada: (diasCoberturaLlegada || 0).toFixed(0),
            ventaDiariaDetails: {
                fechaInicial: fechaInicial.toISOString().split('T')[0],
                fechaFinal: fechaFinal.toISOString().split('T')[0],
                unidadesVendidas: unidadesVendidas || 0,
                ventaDiariaCalculada: (ventaDiariaCalculada || 0).toFixed(2)
            }
        }
    };
}

// Configurar timeout para evitar 504 errors
export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '10mb',
    },
    externalResolver: true,
  },
  maxDuration: 30, // 30 segundos máximo
}

export default async function handler(req, res) {
  const { sku, precioVenta } = req.query;
  
  // Timeout de 25 segundos para dar tiempo a responder
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      console.log('⚠️ Timeout en analysis API, devolviendo datos básicos');
      res.status(200).json({
        success: false,
        message: 'Análisis parcial por timeout',
        productos: [],
        configuracion: null,
        metadata: {
          total: 0,
          timeout: true
        }
      });
    }
  }, 25000);
  
  try {
    // 1. Obtener la configuración
    const { data: configData, error: configError } = await supabase.from('configuration').select('data').eq('id', 1).single();
    if (configError) throw new Error('No se pudo cargar la configuración.');
    const config = configData.data;

    // 2. Verificar recordatorios pendientes y activarlos
    const today = new Date().toISOString().split('T')[0];
    const { data: pendingReminders } = await supabase
      .from('replenishment_reminders')
      .select('*')
      .eq('is_active', true)
      .lte('reminder_date', today);

    if (pendingReminders && pendingReminders.length > 0) {
      for (const reminder of pendingReminders) {
        try {
          // Activar el recordatorio cambiando el producto a NEEDS_REPLENISHMENT
          await supabase
            .from('products')
            .update({ 
              status: 'NEEDS_REPLENISHMENT',
              updated_at: new Date().toISOString(),
              reminder_activated: true,
              reminder_notes: reminder.notes
            })
            .eq('sku', reminder.sku);

          // Marcar el recordatorio como activado
          await supabase
            .from('replenishment_reminders')
            .update({ 
              is_active: false, 
              activated_at: new Date().toISOString() 
            })
            .eq('id', reminder.id);

          console.log(`✅ Recordatorio activado para SKU: ${reminder.sku}`);
        } catch (reminderError) {
          console.error(`❌ Error activando recordatorio para SKU ${reminder.sku}:`, reminderError);
        }
      }
    }

    // 3. Obtener datos de tránsito - productos PURCHASE_CONFIRMED, MANUFACTURED y SHIPPED
    const { data: transitProducts } = await supabase
      .from('products')
      .select('sku, status, purchase_details, manufacturing_details, shipping_details, estimated_arrival')
      .in('status', ['PURCHASE_CONFIRMED', 'MANUFACTURED', 'SHIPPED']);
    
    const transit = (transitProducts || []).map(product => {
      let cantidad = 0;
      let fechaLlegada = new Date();
      
      // Calcular cantidad y fecha según el estado
      switch (product.status) {
        case 'PURCHASE_CONFIRMED':
          cantidad = product.purchase_details?.confirmedQuantity || 0;
          // Usar fecha de entrega estimada o calcular basado en tiempo de entrega
          if (product.purchase_details?.estimatedDeliveryDate) {
            fechaLlegada = new Date(product.purchase_details.estimatedDeliveryDate);
          } else {
            // Agregar tiempo de entrega predeterminado (60 días)
            fechaLlegada = new Date();
            fechaLlegada.setDate(fechaLlegada.getDate() + (config.tiempoEntrega || 60));
          }
          break;
        case 'MANUFACTURED':
          cantidad = product.manufacturing_details?.manufacturedQuantity || product.purchase_details?.confirmedQuantity || 0;
          // Productos fabricados: tiempo de fabricación + tiempo de entrega
          fechaLlegada = new Date();
          const tiempoFabricacion = config.tiempoPromedioFabricacion || 30;
          const tiempoEntrega = config.tiempoEntrega || 60;
          fechaLlegada.setDate(fechaLlegada.getDate() + tiempoFabricacion + tiempoEntrega);
          break;
        case 'SHIPPED':
          cantidad = product.shipping_details?.shippedQuantity || 0;
          fechaLlegada = new Date(product.shipping_details?.eta || product.estimated_arrival || new Date());
          break;
      }
      
      return {
        sku: product.sku,
        cantidad: cantidad,
        fechaLlegada: fechaLlegada,
        status: product.status
      };
    });

    if (sku) {
      const { data: product, error: productError } = await supabase.from('products').select('*').eq('sku', sku).single();
      if (productError || !product) return res.status(404).json({ error: 'SKU no encontrado' });
      
      const resultadoVenta = await calculateVentaDiaria(sku, product.stock_actual);
      const analysis = getFullAnalysis(product, config, transit, precioVenta, resultadoVenta.ventaDiaria, resultadoVenta.fechasAnalisis);
      return res.status(200).json({ results: [analysis], configActual: config });
    } else {
      // Add pagination to avoid timeout - reducir límite por defecto
      const limit = parseInt(req.query.limit) || 25; // Default 25 products per request
      const offset = parseInt(req.query.offset) || 0;
      
      // Cachear datos básicos de productos
      const productsCacheKey = `products_${offset}_${limit}`;
      let products, count;
      
      const cachedProducts = cache.get(productsCacheKey);
      if (cachedProducts) {
        products = cachedProducts.data;
        count = cachedProducts.count;
      } else {
        const { data: productsData, error: productsError, count: productsCount } = await supabase
          .from('products')
          .select('*', { count: 'exact' })
          .range(offset, offset + limit - 1)
          .order('sku', { ascending: true });
          
        if (productsError) throw new Error('No se pudieron cargar los productos.');
        
        products = productsData;
        count = productsCount;
        
        // Cachear por 10 minutos
        cache.set(productsCacheKey, { data: products, count: count }, 10 * 60 * 1000);
      }

      const results = [];
      const processStartTime = Date.now();
      
      // MAJOR OPTIMIZATION: Batch calculate all venta diaria values in one operation
      console.log(`📊 Processing ${products.length} products with batch optimization`);
      const allSkus = products.map(p => p.sku);
      const ventaDiariaResults = await calculateVentaDiariaBatch(allSkus);
      console.log(`✅ Batch calculation completed for ${allSkus.length} SKUs`);
      
      // Process products with pre-calculated venta diaria
      for (const product of products || []) {
        // Check if we're approaching timeout (20 seconds of 25 second limit - more generous since batch calc is done)
        if (Date.now() - processStartTime > 20000) {
          console.log(`⚠️ Approaching timeout, processed ${results.length} products`);
          break;
        }
        
        const ventaDiariaData = ventaDiariaResults.get(product.sku) || { ventaDiaria: 0, fechasAnalisis: null };
        const analysis = getFullAnalysis(product, config, transit, product.analysis_details?.sellingPrice, ventaDiariaData.ventaDiaria, ventaDiariaData.fechasAnalisis);
        
        // Automatically set NO_REPLENISHMENT_NEEDED status for products with cantidadSugerida = 0
        // Excluir productos recién creados desde formulario y productos nuevos cotizados que necesitan continuar el flujo
        if (analysis.cantidadSugerida === 0 && 
            product.status !== 'NO_REPLENISHMENT_NEEDED' && 
            product.status !== 'SHIPPED' &&
            !(product.status === 'QUOTE_REQUESTED' && product.request_details?.createdFromForm) &&
            !(product.isNewProduct && ['QUOTED', 'ANALYZING', 'PURCHASE_APPROVED'].includes(product.status))) {
          try {
            await supabase
              .from('products')
              .update({ 
                status: 'NO_REPLENISHMENT_NEEDED',
                updated_at: new Date().toISOString()
              })
              .eq('sku', product.sku);
            
            // Update analysis result to reflect new status
            analysis.status = 'NO_REPLENISHMENT_NEEDED';
          } catch (statusUpdateError) {
            console.error(`Error updating status for ${product.sku}:`, statusUpdateError);
          }
        }
        // If cantidadSugerida > 0 and currently in NO_REPLENISHMENT_NEEDED, move to NEEDS_REPLENISHMENT
        // Excluir productos recién creados desde formulario de las fórmulas automáticas
        else if (analysis.cantidadSugerida > 0 && 
                 product.status === 'NO_REPLENISHMENT_NEEDED' &&
                 !(product.status === 'QUOTE_REQUESTED' && product.request_details?.createdFromForm)) {
          try {
            await supabase
              .from('products')
              .update({ 
                status: 'NEEDS_REPLENISHMENT',
                updated_at: new Date().toISOString()
              })
              .eq('sku', product.sku);
            
            // Update analysis result to reflect new status
            analysis.status = 'NEEDS_REPLENISHMENT';
          } catch (statusUpdateError) {
            console.error(`Error updating status for ${product.sku}:`, statusUpdateError);
          }
        }
        // Lógica adicional: crear nueva línea de reposición si hay menos días disponibles del umbral configurado
        // y el producto está en un estado intermedio (no puede cambiar a NEEDS_REPLENISHMENT)
        // Excluir productos recién creados desde formulario de las fórmulas automáticas
        else if (analysis.cantidadSugerida > 0 && 
                 analysis.breakdown && 
                 parseFloat(analysis.breakdown.diasCoberturaLlegada) < (config.diasUmbralNuevaReposicion || 30) &&
                 !['NO_REPLENISHMENT_NEEDED', 'NEEDS_REPLENISHMENT', 'SHIPPED'].includes(product.status) &&
                 !(product.status === 'QUOTE_REQUESTED' && product.request_details?.createdFromForm)) {
          
          try {
            // Crear una nueva entrada del mismo SKU con status NEEDS_REPLENISHMENT
            const newProduct = {
              sku: `${product.sku}-REP-${Date.now()}`, // SKU único para la nueva reposición
              descripcion: `${product.descripcion} (Reposición Adicional)`,
              link: product.link || '',
              costo_fob_rmb: product.costo_fob_rmb || 0,
              cbm: product.cbm || 0,
              stock_actual: 0, // Nueva línea empieza con stock 0
              status: 'NEEDS_REPLENISHMENT',
              desconsiderado: false,
              original_sku: product.sku, // Referencia al SKU original
              is_additional_replenishment: true, // Marca para identificar reposiciones adicionales
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            const { data: newProductData, error: insertError } = await supabase
              .from('products')
              .insert(newProduct)
              .select()
              .single();

            if (!insertError && newProductData) {
              // Calcular análisis para la nueva línea
              const newAnalysis = getFullAnalysis(newProductData, config, transit, null, resultadoVenta.ventaDiaria, resultadoVenta.fechasAnalisis);
              newAnalysis.isNewReplenishment = true; // Marcar como nueva reposición
              
              console.log(`✅ Nueva línea de reposición creada para ${product.sku}: ${newProductData.sku}`);
              results.push(newAnalysis);
            }
          } catch (insertError) {
            console.error(`❌ Error creando nueva línea de reposición para ${product.sku}:`, insertError);
          }
        }
        
        results.push(analysis);
      }
      clearTimeout(timeoutId);
      return res.status(200).json({ 
        results, 
        configActual: config,
        metadata: {
          total: count,
          offset: offset,
          limit: limit,
          processed: results.length,
          hasMore: offset + limit < count,
          config: config // Incluir config en metadata
        }
      });
    }
  } catch (error) {
    console.error('Error en API analysis:', error);
    clearTimeout(timeoutId);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
  }
}