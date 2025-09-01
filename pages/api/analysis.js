// pages/api/analysis.js
import { supabase } from '../../lib/supabaseClient';

// Función para calcular venta diaria basada en fechas reales de llegada y quiebre
async function calculateVentaDiaria(sku, currentStock = 0) {
  try {
    let fechaInicio = null;
    let fechasAnalisis = null;
    
    // 1. Buscar compras que llegaron hace más de 30 días (para evitar stock reciente)
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    
    const { data: comprasAntiguas, error: comprasAntiguasError } = await supabase
      .from('compras')
      .select('fecha_llegada_real')
      .eq('sku', sku)
      .not('fecha_llegada_real', 'is', null)
      .lte('fecha_llegada_real', hace30Dias.toISOString())
      .order('fecha_llegada_real', { ascending: false })
      .limit(1);
    
    if (!comprasAntiguasError && comprasAntiguas && comprasAntiguas.length > 0) {
      // Usar la última compra que llegó hace más de 30 días
      fechaInicio = new Date(comprasAntiguas[0].fecha_llegada_real);
    } else {
      // Si no hay compras antiguas, buscar la primera venta del SKU
      const { data: primeraVenta, error: primeraVentaError } = await supabase
        .from('ventas')
        .select('fecha_venta')
        .eq('sku', sku)
        .order('fecha_venta', { ascending: true })
        .limit(1);
      
      if (primeraVentaError || !primeraVenta || primeraVenta.length === 0) {
        // Si no hay ni compras ni ventas, retornar venta diaria 0
        return { ventaDiaria: 0, fechasAnalisis: null };
      }
      
      fechaInicio = new Date(primeraVenta[0].fecha_venta);
    }
    
    // 2. Determinar fecha fin según stock actual
    let fechaFin = new Date();
    if (currentStock === 0) {
      // Si stock es 0, usar fecha de la última venta
      const { data: ultimaVenta } = await supabase
        .from('ventas')
        .select('fecha_venta')
        .eq('sku', sku)
        .order('fecha_venta', { ascending: false })
        .limit(1);
      
      if (ultimaVenta && ultimaVenta.length > 0) {
        fechaFin = new Date(ultimaVenta[0].fecha_venta);
      }
      // Si no hay ventas, fechaFin sigue siendo hoy
    }
    
    // 3. Calcular días entre fechas
    const diffTime = fechaFin.getTime() - fechaInicio.getTime();
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    // 4. Obtener ventas en ese período
    const { data: ventas, error: ventasError } = await supabase
      .from('ventas')
      .select('cantidad')
      .eq('sku', sku)
      .gte('fecha_venta', fechaInicio.toISOString())
      .lte('fecha_venta', fechaFin.toISOString());
    
    if (ventasError || !ventas || ventas.length === 0) {
      return { ventaDiaria: 0, fechasAnalisis: null };
    }
    
    const totalVendido = ventas.reduce((sum, venta) => sum + (venta.cantidad || 0), 0);
    const ventaDiaria = totalVendido / diffDays;
    
    return {
      ventaDiaria,
      fechasAnalisis: {
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        diasPeriodo: diffDays,
        unidadesVendidas: totalVendido
      }
    };
    
  } catch (error) {
    console.error('Error calculando venta diaria:', error);
    return { ventaDiaria: 0, fechasAnalisis: null };
  }
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

export default async function handler(req, res) {
  const { sku, precioVenta } = req.query;
  
  try {
    // 1. Obtener la configuración
    const { data: configData, error: configError } = await supabase.from('configuration').select('data').eq('id', 1).single();
    if (configError) throw new Error('No se pudo cargar la configuración.');
    const config = configData.data;

    // 2. Obtener datos de tránsito - productos PURCHASE_CONFIRMED, MANUFACTURED y SHIPPED
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
      const { data: products, error: productsError } = await supabase.from('products').select('*');
      if (productsError) throw new Error('No se pudieron cargar los productos.');

      // Filtrar productos desconsiderados y con workflow completado
      const filteredProducts = products.filter(product => 
        !product.desconsiderado && !product.workflow_completed
      );

      const results = [];
      for (const product of filteredProducts) {
        const resultadoVenta = await calculateVentaDiaria(product.sku, product.stock_actual);
        const analysis = getFullAnalysis(product, config, transit, product.analysis_details?.sellingPrice, resultadoVenta.ventaDiaria, resultadoVenta.fechasAnalisis);
        
        // Automatically set NO_REPLENISHMENT_NEEDED status for products with cantidadSugerida = 0
        if (analysis.cantidadSugerida === 0 && product.status !== 'NO_REPLENISHMENT_NEEDED' && product.status !== 'SHIPPED') {
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
        else if (analysis.cantidadSugerida > 0 && product.status === 'NO_REPLENISHMENT_NEEDED') {
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
        else if (analysis.cantidadSugerida > 0 && 
                 analysis.breakdown && 
                 parseFloat(analysis.breakdown.diasCoberturaLlegada) < (config.diasUmbralNuevaReposicion || 30) &&
                 !['NO_REPLENISHMENT_NEEDED', 'NEEDS_REPLENISHMENT', 'SHIPPED'].includes(product.status)) {
          
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
      return res.status(200).json({ results, configActual: config });
    }
  } catch (error) {
    console.error('Error en API analysis:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
}