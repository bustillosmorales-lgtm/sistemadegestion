// pages/api/export-by-status.js
import { supabase } from '../../lib/supabaseClient';
import XLSX from 'xlsx';

// Función para calcular cantidadSugerida EXACTAMENTE como analysis.js (líneas 260-267)
function calcularCantidadSugerida(product, transitMap, config, ventaDiariaReal) {
  // IMPORTANTE: Usar ventaDiariaReal del cálculo correcto, NO del cache
  const ventaDiaria = ventaDiariaReal !== undefined ? ventaDiariaReal : (product.venta_diaria || 0);
  const stockActual = product.stock_actual || 0;
  const enTransito = transitMap[product.sku] || 0;
  const tiempoEntrega = config.tiempoEntrega || 90;
  const stockSaludableMinDias = config.stockSaludableMinDias || 90;

  // Fórmula EXACTA de analysis.js líneas 260-267
  const hoy = new Date();
  const fechaLlegadaPedidoNuevo = new Date(new Date().setDate(hoy.getDate() + tiempoEntrega));

  // Filtrar solo stock en tránsito que llegará antes del nuevo pedido
  const stockEnTransitoQueLlega = enTransito; // Simplificado - en analysis.js se filtra por fecha

  const consumoDuranteLeadTime = ventaDiaria * tiempoEntrega;
  const stockFinalProyectado = stockActual + stockEnTransitoQueLlega - consumoDuranteLeadTime;
  const stockObjetivo = ventaDiaria * stockSaludableMinDias;

  // Si stock proyectado es negativo, tratarlo como 0 para el cálculo
  const stockProyectadoParaCalculo = Math.max(0, stockFinalProyectado);
  const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - stockProyectadoParaCalculo));

  return {
    cantidadSugerida,
    stockObjetivo,
    stockProyectadoLlegada: stockFinalProyectado,
    consumoDuranteLeadTime
  };
}

// Función para calcular rentabilidad EXACTAMENTE como analysis.js (líneas 217-253)
function getFullAnalysisSimple(product, quote, config) {
  console.log(`🧮 getFullAnalysisSimple called for SKU ${product.sku}:`);
  console.log(`   precio_venta_sugerido: ${product.precio_venta_sugerido}`);
  console.log(`   product.costo_fob_rmb: ${product.costo_fob_rmb}`);
  console.log(`   quote.unitPrice: ${quote.unitPrice}`);

  // Calcular todos los costos EXACTAMENTE como en analysis.js
  const precioVentaCLP = parseFloat(product.precio_venta_sugerido) || 0;

  // CORRECCIÓN: Para productos en workflow (ANALYZING, QUOTED, etc.), usar quote.unitPrice
  // Solo usar product.costo_fob_rmb si tiene un valor > 0 (guardado previamente)
  const costoFobRMB = (parseFloat(product.costo_fob_rmb) > 0) ?
    parseFloat(product.costo_fob_rmb) :
    parseFloat(quote.unitPrice) || 0;

  const costoFobUSD = costoFobRMB * (config.rmbToUsd || 0);
  const comisionChinaUSD = costoFobUSD * (config.costosVariablesPct?.comisionChina || 0);
  const costoFobMasComisionUSD = costoFobUSD + comisionChinaUSD;

  const containerCBM = config.containerCBM || config.cbmContenedorEstandar || 68;

  // CBM por unidad: calcular desde quote si product.cbm es 0 o no existe
  const unitsPerBox = parseFloat(quote.unitsPerBox) || 1;
  const cbmPerBox = parseFloat(quote.cbmPerBox) || 0;
  const cbmFromQuote = cbmPerBox > 0 ? cbmPerBox / unitsPerBox : 0;

  const cbmProducto = (parseFloat(product.cbm) > 0) ?
    parseFloat(product.cbm) :
    cbmFromQuote;

  const fletePorProductoUSD = ((config.costosFijosUSD?.fleteMaritimo || 0) / containerCBM) * cbmProducto;
  const baseSeguroUSD = costoFobMasComisionUSD + fletePorProductoUSD;
  const seguroProductoUSD = baseSeguroUSD * (config.costosVariablesPct?.seguroContenedor || 0);
  const valorCifUSD = costoFobMasComisionUSD + fletePorProductoUSD + seguroProductoUSD;

  const totalCostosFijosCLP = Object.values(config.costosFijosCLP || {}).reduce((sum, val) => sum + (val || 0), 0);
  const totalCostosFijosUSD_fromCLP = totalCostosFijosCLP / (config.usdToClp || 1);
  const { fleteMaritimo, ...otrosCostosFijosUSD } = config.costosFijosUSD || {};
  const totalOtrosCostosFijosUSD = Object.values(otrosCostosFijosUSD).reduce((sum, val) => sum + (val || 0), 0);
  const costoLogisticoTotalUSD = totalCostosFijosUSD_fromCLP + totalOtrosCostosFijosUSD;
  const costoLogisticoPorCBM_USD = costoLogisticoTotalUSD / containerCBM;
  const costoLogisticoProductoUSD = costoLogisticoPorCBM_USD * cbmProducto;

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

  return {
    // Básicos
    costoFobRMB,
    costoFobUSD,
    comisionChinaUSD,
    costoFobMasComisionUSD,

    // CBM y prorate
    cbmProducto,
    containerCBM,

    // Flete y seguro
    fletePorProductoUSD,
    seguroProductoUSD,
    valorCifUSD,

    // Conversión a CLP
    valorCifCLP,
    adValoremCLP,
    ivaCLP,

    // Logística
    costoLogisticoTotalUSD,
    costoLogisticoPorCBM_USD,
    costoLogisticoProductoUSD,
    costoLogisticoProductoCLP,

    // Totales
    costoFinalBodegaCLP,

    // Mercado Libre
    comisionML,
    recargoML,
    costosVenta,

    // Resultado
    gananciaNeta,
    margen
  };
}

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  maxDuration: 60,
}

export default async function handler(req, res) {
  const { status, action } = req.query;

  if (!status || !action) {
    return res.status(400).json({ error: 'Status and action are required' });
  }

  try {
    console.log(`📥 Exporting status: ${status}, action: ${action}`);

    // Manejo especial para Recordatorios y Desconsiderados
    if (status === 'REMINDERS') {
      return await exportReminders(req, res);
    }
    if (status === 'DISREGARDED') {
      return await exportDisregarded(req, res);
    }

    // 1️⃣ Obtener configuración para cálculos
    const { data: configData } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();

    const config = configData?.data || {};

    // 2️⃣ Obtener productos por status desde cache si existe
    let products = [];
    let useCache = false;

    // IMPORTANTE: Para NEEDS_REPLENISHMENT siempre usar query directa
    // El cache puede estar desactualizado o no incluir todos los productos
    const forceDirectQuery = (status === 'NEEDS_REPLENISHMENT');

    if (!forceDirectQuery) {
      try {
        // Obtener TODOS los productos de este status - usar paginación si es necesario
        let allCachedData = [];
        let pageSize = 1000;
        let currentPage = 0;
        let hasMore = true;

        while (hasMore) {
          const { data: cachedData, error: cacheError, count } = await supabase
            .from('dashboard_analysis_cache')
            .select('*', { count: 'exact' })
            .eq('status', status)
            .gt('expires_at', new Date().toISOString())
            .order('impacto_economico->valorTotal', { ascending: false, nullsLast: true })
            .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

          if (cacheError) {
            console.log('Cache error:', cacheError.message);
            break;
          }

          if (cachedData && cachedData.length > 0) {
            allCachedData = allCachedData.concat(cachedData);
            console.log(`📥 Página ${currentPage + 1}: ${cachedData.length} productos (total acumulado: ${allCachedData.length})`);

            // Si obtuvimos menos de pageSize, ya no hay más
            if (cachedData.length < pageSize) {
              hasMore = false;
            } else {
              currentPage++;
            }
          } else {
            hasMore = false;
          }
        }

        if (allCachedData.length > 0) {
          products = allCachedData;
          useCache = true;
          console.log(`✅ Using cache: ${products.length} productos totales del status ${status}`);
        }
      } catch (error) {
        console.log('Cache not available, using direct query');
      }
    } else {
      console.log(`🔄 NEEDS_REPLENISHMENT: Forzando query directa (no usar cache)`);
    }

    // Si no hay cache, query directo con paginación
    if (!useCache) {
      let allDirectData = [];
      let pageSize = 1000;
      let currentPage = 0;
      let hasMore = true;

      // Para NEEDS_REPLENISHMENT: obtener SKUs con recordatorios activos
      let reminderSkus = new Set();
      if (status === 'NEEDS_REPLENISHMENT') {
        const today = new Date().toISOString().split('T')[0];
        const { data: reminders } = await supabase
          .from('replenishment_reminders')
          .select('sku')
          .eq('is_active', true)
          .gt('reminder_date', today);

        reminderSkus = new Set((reminders || []).map(r => r.sku));
        console.log(`🔍 Filtrando ${reminderSkus.size} SKUs con recordatorios activos`);
      }

      while (hasMore) {
        let query = supabase
          .from('products')
          .select('*')
          .eq('status', status)
          .eq('desconsiderado', false); // ✅ Filtrar productos desconsiderados

        const { data: directData, error: directError } = await query
          .order('sku')
          .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

        if (directError) {
          console.log('Direct query error:', directError.message);
          break;
        }

        if (directData && directData.length > 0) {
          // Filtrar recordatorios si es NEEDS_REPLENISHMENT
          const filteredData = status === 'NEEDS_REPLENISHMENT'
            ? directData.filter(p => !reminderSkus.has(p.sku))
            : directData;

          allDirectData = allDirectData.concat(filteredData);
          console.log(`📥 Página ${currentPage + 1}: ${filteredData.length} productos (total acumulado: ${allDirectData.length})`);

          if (directData.length < pageSize) {
            hasMore = false;
          } else {
            currentPage++;
          }
        } else {
          hasMore = false;
        }
      }

      products = allDirectData;
      console.log(`📊 Direct query completado: ${products.length} productos totales`);
    }

    // 3️⃣ Obtener todos los SKUs (cache o directo)
    const skus = products.map(p => p.sku);

    // Obtener details + campos de rentabilidad si no están en cache
    let detailsMap = {};
    if (needsDetails(action)) {
      // IMPORTANTE: Si viene del cache, también necesitamos costo_fob_rmb y cbm para calcular rentabilidad
      const { data: details } = await supabase
        .from('products')
        .select('sku, costo_fob_rmb, cbm, precio_venta_sugerido, request_details, quote_details, analysis_details, approval_details, purchase_details, manufacturing_details, shipping_details')
        .in('sku', skus);

      detailsMap = Object.fromEntries(
        (details || []).map(d => [d.sku, d])
      );
    }

    // Obtener stock en tránsito
    // Incluye desde que se confirma la cotización hasta que llega el contenedor
    const { data: transitData } = await supabase
      .from('compras')
      .select('sku, cantidad')
      .in('sku', skus)
      .in('status_compra', ['confirmado', 'en_transito']);

    const transitMap = {};
    (transitData || []).forEach(item => {
      if (!transitMap[item.sku]) transitMap[item.sku] = 0;
      transitMap[item.sku] += item.cantidad || 0;
    });

    // 4️⃣ CALCULAR VENTA DIARIA DIRECTAMENTE DESDE VENTAS - SIEMPRE SE EJECUTA
    // IMPORTANTE: Esto se ejecuta SIEMPRE, incluso si usamos cache del dashboard
    // porque el cache NO tiene las fechas de análisis, solo la venta_diaria
    console.log(`📊 Calculando venta diaria directamente para ${skus.length} SKUs...`);

    // SOLUCIÓN: Dividir en lotes para evitar error 414 Request-URI Too Large
    const BATCH_SIZE = 500; // Máximo 500 SKUs por query
    let todasVentas = [];

    for (let i = 0; i < skus.length; i += BATCH_SIZE) {
      const batch = skus.slice(i, i + BATCH_SIZE);
      console.log(`📊 Consultando ventas para lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(skus.length / BATCH_SIZE)} (${batch.length} SKUs)...`);

      const { data: ventasBatch, error: ventasError } = await supabase
        .from('ventas')
        .select('sku, fecha_venta, cantidad')
        .in('sku', batch)
        .order('sku', { ascending: true })
        .order('fecha_venta', { ascending: true });

      if (ventasError) {
        console.error(`❌ Error consultando ventas lote ${Math.floor(i / BATCH_SIZE) + 1}:`, ventasError);
      } else if (ventasBatch) {
        todasVentas = todasVentas.concat(ventasBatch);
      }
    }

    console.log(`📈 Obtenidas ${todasVentas?.length || 0} ventas totales de todos los lotes`);

    // 5️⃣ Obtener llegadas y fechas de quiebre para cálculo preciso (MISMA LÓGICA QUE VISTA MATERIALIZADA)
    console.log(`📦 Obteniendo llegadas válidas (≥30 días) para ${skus.length} SKUs...`);

    // Obtener llegadas válidas en lotes
    let todasLlegadas = [];
    for (let i = 0; i < skus.length; i += BATCH_SIZE) {
      const batch = skus.slice(i, i + BATCH_SIZE);
      const { data: llegadasBatch } = await supabase
        .from('compras')
        .select('sku, fecha_llegada_real')
        .in('sku', batch)
        .not('fecha_llegada_real', 'is', null)
        .lte('fecha_llegada_real', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('sku', { ascending: true })
        .order('fecha_llegada_real', { ascending: false });

      if (llegadasBatch) {
        todasLlegadas = todasLlegadas.concat(llegadasBatch);
      }
    }

    // Mapa de última llegada válida por SKU
    const llegadasMap = {};
    todasLlegadas.forEach(l => {
      if (!llegadasMap[l.sku]) {
        llegadasMap[l.sku] = l.fecha_llegada_real;
      }
    });

    console.log(`✅ ${Object.keys(llegadasMap).length} SKUs con llegadas válidas`);

    // Agrupar ventas por SKU
    const ventasPorSku = {};
    (todasVentas || []).forEach(v => {
      if (!ventasPorSku[v.sku]) {
        ventasPorSku[v.sku] = [];
      }
      ventasPorSku[v.sku].push(v);
    });

    // Calcular venta diaria y fechas para cada SKU (LÓGICA EXACTA DE sku_venta_diaria_mv)
    const fechasMap = {};

    skus.forEach(sku => {
      const ventas = ventasPorSku[sku];
      const producto = products.find(p => p.sku === sku);

      // SI NO HAY VENTAS NI LLEGADAS, MARCAR COMO SIN DATOS
      if ((!ventas || ventas.length === 0) && !llegadasMap[sku]) {
        fechasMap[sku] = {
          ventaDiaria: 0,
          fechaInicio: null,
          fechaFin: null,
          diasPeriodo: 0,
          unidadesVendidas: 0
        };
        return;
      }

      // FECHA INICIO: Llegada válida > Primera venta
      let fechaInicio;
      if (llegadasMap[sku]) {
        fechaInicio = llegadasMap[sku];
      } else {
        fechaInicio = ventas[0].fecha_venta;
      }

      // FECHA FIN: Fecha de quiebre > Última venta > Hoy
      let fechaFin;
      const stockActual = useCache ? producto?.stock_actual : (producto?.stock_actual || 0);
      const last_stockout_date = producto?.last_stockout_date;

      if (stockActual <= 0 && last_stockout_date) {
        fechaFin = last_stockout_date;
      } else if (stockActual <= 0 && ventas && ventas.length > 0) {
        fechaFin = ventas[ventas.length - 1].fecha_venta;
      } else {
        fechaFin = new Date().toISOString();
      }

      // Filtrar ventas dentro del periodo
      const ventasEnPeriodo = (ventas || []).filter(v =>
        v.fecha_venta >= fechaInicio && v.fecha_venta <= fechaFin
      );

      const totalVendido = ventasEnPeriodo.reduce((sum, v) => sum + (v.cantidad || 0), 0);
      const dias = Math.max(1, Math.ceil((new Date(fechaFin) - new Date(fechaInicio)) / (1000 * 60 * 60 * 24)));
      const ventaDiaria = dias > 0 ? totalVendido / dias : 0;

      // Formatear fechas (quitar timestamp)
      const formatearFecha = (fecha) => {
        if (!fecha) return null;
        const fechaStr = String(fecha);
        return fechaStr.split('T')[0].split(' ')[0];
      };

      fechasMap[sku] = {
        ventaDiaria: parseFloat(ventaDiaria.toFixed(4)),
        fechaInicio: formatearFecha(fechaInicio),
        fechaFin: formatearFecha(fechaFin),
        diasPeriodo: dias,
        unidadesVendidas: totalVendido
      };
    });

    console.log(`✅ Venta diaria calculada para ${Object.keys(fechasMap).length} SKUs`);
    console.log(`   - Con ventas: ${Object.values(fechasMap).filter(f => f.unidadesVendidas > 0).length}`);
    console.log(`   - Sin ventas: ${Object.values(fechasMap).filter(f => f.unidadesVendidas === 0).length}`);

    // DEBUG: Mostrar primeros 3 SKUs con datos
    const skusConDatos = Object.entries(fechasMap).filter(([_, f]) => f.unidadesVendidas > 0).slice(0, 3);
    if (skusConDatos.length > 0) {
      console.log(`\n📋 Primeros 3 SKUs con datos calculados:`);
      skusConDatos.forEach(([sku, datos]) => {
        console.log(`   ${sku}: vd=${datos.ventaDiaria.toFixed(2)}, inicio=${datos.fechaInicio}, fin=${datos.fechaFin}, unidades=${datos.unidadesVendidas}`);
      });
    }

    // 5️⃣ Formatear datos según la acción
    const excelData = formatByAction(action, products, detailsMap, transitMap, config, useCache, fechasMap);

    console.log(`📊 Productos procesados: ${products.length}`);
    console.log(`📋 Productos en Excel después de filtros: ${excelData.length}`);

    // 5️⃣ Crear Excel con instrucciones
    const wb = XLSX.utils.book_new();

    // Hoja de instrucciones
    const instructions = getInstructions(action);
    const wsInst = XLSX.utils.json_to_sheet(instructions);
    XLSX.utils.book_append_sheet(wb, wsInst, '📋 INSTRUCCIONES');

    // Hoja de datos
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Aplicar formato
    applyExcelFormatting(ws, excelData);

    XLSX.utils.book_append_sheet(wb, ws, 'Datos');

    // 6️⃣ Enviar archivo
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = getFilename(action, status);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

    console.log(`✅ Export completed: ${filename}`);

  } catch (error) {
    console.error('❌ Error exporting by status:', error);
    res.status(500).json({ error: error.message });
  }
}

// Determinar si necesita detalles adicionales
function needsDetails(action) {
  return !['view', 'force_request_quote'].includes(action);
}

// Formatear datos según acción
function formatByAction(action, products, detailsMap, transitMap, config, useCache, fechasMap) {
  const formatters = {
    // Ver productos (solo lectura)
    view: (products) => products.map(p => {
      const stockActual = useCache ? p.stock_actual : p.stock_actual || 0;
      const fechasAnalisis = fechasMap[p.sku] || { ventaDiaria: 0, fechaInicio: null, fechaFin: null, diasPeriodo: 0, unidadesVendidas: 0 };
      const ventaDiaria = fechasAnalisis.ventaDiaria;
      const enTransito = useCache ? p.en_transito : (transitMap[p.sku] || 0);
      const diasDeStock = ventaDiaria > 0 ? Math.round((stockActual + enTransito) / ventaDiaria) : 999;

      return {
        'SKU': p.sku,
        'Descripción': useCache ? p.descripcion : p.descripcion,
        'Stock Actual': stockActual,
        'En Tránsito': enTransito,
        'Venta Diaria': ventaDiaria.toFixed(2),
        'Días de Stock': diasDeStock,
        'Fecha Inicial Análisis': fechasAnalisis.fechaInicio || '',
        'Fecha Final Análisis': fechasAnalisis.fechaFin || '',
        'Días del Periodo': fechasAnalisis.diasPeriodo,
        'Unidades Vendidas': fechasAnalisis.unidadesVendidas,
        'Status': p.status
      };
    }),

    // Forzar cotización
    force_request_quote: (products) => products.map(p => {
      const stockActual = useCache ? p.stock_actual : p.stock_actual || 0;
      const fechasAnalisis = fechasMap[p.sku] || { ventaDiaria: 0, fechaInicio: null, fechaFin: null, diasPeriodo: 0, unidadesVendidas: 0 };
      const ventaDiaria = fechasAnalisis.ventaDiaria;
      const enTransito = useCache ? p.en_transito : (transitMap[p.sku] || 0);
      const stockObjetivo = useCache ? p.stock_objetivo : Math.round(ventaDiaria * (config.stockSaludableMinDias || 90));
      const diasDeStock = ventaDiaria > 0 ? Math.round((stockActual + enTransito) / ventaDiaria) : 999;

      return {
        'SKU': p.sku,
        'Descripción': useCache ? p.descripcion : p.descripcion,
        'Stock Actual': stockActual,
        'En Tránsito': enTransito,
        'Stock Total Disponible': stockActual + enTransito,
        'Venta Diaria': ventaDiaria.toFixed(2),
        'Días de Stock Actual': diasDeStock,
        'Stock Objetivo Sistema': stockObjetivo,
        'Fecha Inicial Análisis': fechasAnalisis.fechaInicio || '',
        'Fecha Final Análisis': fechasAnalisis.fechaFin || '',
        'Días del Periodo': fechasAnalisis.diasPeriodo,
        'Unidades Vendidas': fechasAnalisis.unidadesVendidas,
        '✅ Forzar Cotización': '',
        '📝 Cantidad a Cotizar': '',
        '📝 Motivo': '',
        '📝 Comentarios': '',
        '🔒 Status Actual': p.status
      };
    }),

    // Solicitar cotización
    request_quote: (products) => products
      .map(p => {
      const stockActual = useCache ? p.stock_actual : p.stock_actual || 0;
      const fechasAnalisis = fechasMap[p.sku] || { ventaDiaria: 0, fechaInicio: null, fechaFin: null, diasPeriodo: 0, unidadesVendidas: 0 };
      const ventaDiaria = fechasAnalisis.ventaDiaria;
      const enTransito = useCache ? p.en_transito : (transitMap[p.sku] || 0);

      // SIEMPRE recalcular con la venta diaria REAL (nunca usar valores del cache)
      // Esto garantiza que si ventaDiaria = 0, entonces stockObjetivo = 0
      const calculos = calcularCantidadSugerida(p, transitMap, config, ventaDiaria);

      const cantidadSugerida = calculos.cantidadSugerida;
      const stockObjetivo = calculos.stockObjetivo;
      const stockProyectado = calculos.stockProyectadoLlegada;
      const consumoLeadTime = calculos.consumoDuranteLeadTime;

      const impacto = useCache ? p.impacto_economico : { valorTotal: 0, prioridad: 'N/A' };
      const diasDeStock = ventaDiaria > 0 ? Math.round(stockActual / ventaDiaria) : 999;

      // Cálculo de días disponibles (igual que modal)
      const diasDisponibles = ventaDiaria > 0 ? Math.round(stockProyectado / ventaDiaria) : 999;

      // DEBUG: Log primeros 3 productos
      if (products.indexOf(p) < 3) {
        console.log(`🔍 DEBUG SKU ${p.sku}:`);
        console.log(`   ventaDiaria:`, ventaDiaria);
        console.log(`   fechaInicio:`, fechasAnalisis.fechaInicio);
        console.log(`   fechaFin:`, fechasAnalisis.fechaFin);
        console.log(`   unidadesVendidas:`, fechasAnalisis.unidadesVendidas);
        console.log(`   stockObjetivo:`, stockObjetivo);
        console.log(`   cantidadSugerida:`, cantidadSugerida);
      }

      return {
        '✅ Acción': '',
        'SKU': p.sku,
        'Descripción': useCache ? p.descripcion : p.descripcion,
        'Link Referencia': p.link || 'N/A',

        // CÁLCULO VENTA DIARIA (mismo orden que modal)
        'Fecha Inicial Análisis': fechasAnalisis.fechaInicio || '',
        'Fecha Final Análisis': fechasAnalisis.fechaFin || '',
        'Unidades Vendidas Periodo': fechasAnalisis.unidadesVendidas,
        'Días del Periodo': fechasAnalisis.diasPeriodo,
        'Venta Diaria Promedio': ventaDiaria.toFixed(2),

        // CÁLCULO REPOSICIÓN (mismo orden que modal)
        'Stock Objetivo': stockObjetivo || 0,
        '(+) Stock Actual': stockActual,
        '(+) Stock En Tránsito': enTransito,
        '(-) Consumo Proyectado': consumoLeadTime || 0,
        '(=) Stock Proyectado Llegada': stockProyectado || 0,
        'Cantidad Reposición Sugerida': cantidadSugerida,

        // URGENCIA
        'Días Disponibles': diasDisponibles,
        'Estado': diasDisponibles < 0 ? 'URGENTE - Riesgo Quiebre' : 'Normal',

        // IMPACTO
        'Impacto Económico': impacto?.valorTotal || 0,
        'Prioridad': impacto?.prioridad || 'N/A',

        // CAMPOS EDITABLES
        '📝 Cantidad a Cotizar': cantidadSugerida,
        '📝 Comentarios': '',
        '📝 Recuérdame (Fecha)': '',
        '📝 Desconsiderar': '',

        '🔒 Status Actual': p.status,
      };
    }),
    // NOTA: No filtrar por cantidadSugerida > 0 porque el usuario quiere ver TODOS los productos
    // del status NEEDS_REPLENISHMENT, incluso los que tienen cantidad = 0

    // Cotizar
    quote: (products) => products.map(p => {
      const detail = detailsMap[p.sku] || {};
      const requestDetails = detail.request_details || {};
      const approvalDetails = detail.approval_details || {};

      // Si fue rechazado, mostrar precio objetivo y comentarios del rechazo
      const isRejected = p.status === 'QUOTE_REJECTED';
      const targetPrice = approvalDetails.targetPurchasePrice;
      const rejectionComments = approvalDetails.comments;

      return {
        '✅ Acción': '',
        'SKU': p.sku,
        'Descripción': useCache ? p.descripcion : p.descripcion,

        // Información de solicitud
        'Cantidad Solicitada': requestDetails.quantityToQuote || '',
        'Comentarios Solicitud': requestDetails.comments || '',

        // Si fue rechazado, mostrar info del rechazo
        ...(isRejected && targetPrice ? {
          '🎯 Precio Objetivo Aprobación': targetPrice,
          '💬 Comentarios Rechazo': rejectionComments || '',
          '⚠️ INSTRUCCIÓN': 'Cotizar precio ≤ al objetivo para aprobación automática'
        } : {}),

        // Campos editables
        '📝 Precio Unitario': '',
        '📝 Moneda': 'RMB',
        '📝 Unidades por Bulto': '',
        '📝 CBM por Bulto': '',
        '📝 Días de Producción': 30,
        '📝 Comentarios Cotización': '',

        '🔒 Status Actual': p.status
      };
    }),

    // Analizar
    analyze: (products) => products.map(p => {
      const detail = detailsMap[p.sku] || {};
      const quote = detail.quote_details || {};
      const stockActual = useCache ? p.stock_actual : (p.stock_actual || 0);
      const ventaDiaria = useCache ? p.venta_diaria : (p.venta_diaria || 0);

      // Calcular cantidadSugerida usando la fórmula correcta
      const calculos_cantidad = useCache ?
        { cantidadSugerida: p.cantidad_sugerida } :
        calcularCantidadSugerida(p, transitMap, config);

      const cantidadSugerida = calculos_cantidad.cantidadSugerida;
      const precioUnitario = parseFloat(quote.unitPrice) || 0;
      const moneda = quote.currency || 'RMB';

      // Obtener precio de venta actual del producto
      const precioVentaActual = useCache ? (detail.precio_venta_sugerido || p.precio_venta_sugerido) : (p.precio_venta_sugerido || 0);

      // Usar los cálculos exactos del módulo de análisis
      // Si viene del cache, necesitamos agregar costo_fob_rmb y cbm del detail
      const productForCalc = useCache ?
        { ...p, precio_venta_sugerido: precioVentaActual, costo_fob_rmb: detail.costo_fob_rmb, cbm: detail.cbm } :
        { ...p, precio_venta_sugerido: precioVentaActual };

      const calculos = getFullAnalysisSimple(productForCalc, quote, config) || {
        costoFobUSD: 0,
        costoFinalBodegaCLP: 0,
        costosVenta: 0,
        gananciaNeta: 0,
        margen: 0
      };

      // Datos de unidades y CBM - usar datos del producto o de la cotización
      const unidadesPorBulto = parseInt(quote.unitsPerBox) || 1;
      const cbmPorBulto = parseFloat(quote.cbmPerBox) || 0;

      // Calcular CBM por unidad y CBM total
      const cbmPorUnidad = useCache ?
        (detail.cbm || (cbmPorBulto > 0 ? cbmPorBulto / unidadesPorBulto : 0)) :
        (p.cbm || (cbmPorBulto > 0 ? cbmPorBulto / unidadesPorBulto : 0));

      const bultosNecesarios = unidadesPorBulto > 0 ? Math.ceil(cantidadSugerida / unidadesPorBulto) : 0;
      const cbmTotal = cantidadSugerida * cbmPorUnidad;

      // Obtener precio FOB del producto o de la cotización
      const costoFobRMB = useCache ?
        (detail.costo_fob_rmb || precioUnitario) :
        (p.costo_fob_rmb || precioUnitario);

      return {
        '✅ Analizar': '',
        'SKU': p.sku,
        'Descripción': useCache ? p.descripcion : p.descripcion,
        'Stock Actual': stockActual,
        'Venta Diaria': ventaDiaria?.toFixed(2) || '0.00',
        'Cantidad Sugerida': cantidadSugerida,
        'Precio Unitario RMB': Math.round(costoFobRMB * 100) / 100, // 2 decimales máximo
        'Moneda': moneda,
        'Unidades/Bulto': unidadesPorBulto || 'N/A',
        'CBM/Bulto': cbmPorBulto ? cbmPorBulto.toFixed(4) : 'N/A',
        'CBM/Unidad': cbmPorUnidad ? cbmPorUnidad.toFixed(4) : 'N/A',
        'Bultos Necesarios': bultosNecesarios || 'N/A',
        'CBM Total': cbmTotal ? cbmTotal.toFixed(3) : 'N/A',
        'Días Producción': quote.productionDays || '',
        'Costo FOB USD': calculos.costoFobUSD ? calculos.costoFobUSD.toFixed(2) : '0.00',
        'Costo Final Bodega CLP': Math.round(calculos.costoFinalBodegaCLP || 0),
        'Costos Venta ML': Math.round(calculos.costosVenta || 0),
        'Precio Venta Actual': precioVentaActual,
        'Ganancia Neta (Ref)': Math.round(calculos.gananciaNeta || 0),
        'Margen % (Ref)': (calculos.margen || 0).toFixed(1) + '%',
        'Comentarios Proveedor': quote.comments || '',
        '📝 Precio de Venta a Usar': precioVentaActual,
        '📝 Comentarios Análisis': '',
        '🔒 Status Actual': p.status
      };
    }),

    // Aprobar
    approve: (products) => products.map(p => {
      const detail = detailsMap[p.sku] || {};
      const quote = detail.quote_details || {};
      const analysis = detail.analysis_details || {};
      const stockActual = useCache ? p.stock_actual : (p.stock_actual || 0);
      const ventaDiaria = useCache ? p.venta_diaria : (p.venta_diaria || 0);

      // Calcular cantidadSugerida usando la fórmula correcta
      const calculos_cantidad = useCache ?
        { cantidadSugerida: p.cantidad_sugerida } :
        calcularCantidadSugerida(p, transitMap, config);

      const cantidadSugerida = calculos_cantidad.cantidadSugerida;

      // Datos de cotización y producto
      const precioUnitario = parseFloat(quote.unitPrice) || 0;
      const moneda = quote.currency || 'RMB';
      const unidadesPorBulto = parseInt(quote.unitsPerBox) || 1;
      const cbmPorBulto = parseFloat(quote.cbmPerBox) || 0;

      // Calcular CBM por unidad y CBM total
      const cbmPorUnidad = useCache ?
        (detail.cbm || (cbmPorBulto > 0 ? cbmPorBulto / unidadesPorBulto : 0)) :
        (p.cbm || (cbmPorBulto > 0 ? cbmPorBulto / unidadesPorBulto : 0));

      const bultosNecesarios = unidadesPorBulto > 0 ? Math.ceil(cantidadSugerida / unidadesPorBulto) : 0;
      const cbmTotal = cantidadSugerida * cbmPorUnidad;

      // Obtener precio FOB del producto o de la cotización
      const costoFobRMB = useCache ?
        (detail.costo_fob_rmb || precioUnitario) :
        (p.costo_fob_rmb || precioUnitario);

      // Precio de venta del análisis (el que ingresó el usuario)
      const precioVenta = parseFloat(analysis.sellingPrice) || 0;

      // Calcular usando la misma lógica que analysis.js
      // Si viene del cache, necesitamos agregar costo_fob_rmb y cbm del detail
      const productForCalc = useCache ?
        { ...p, precio_venta_sugerido: precioVenta, costo_fob_rmb: detail.costo_fob_rmb, cbm: detail.cbm } :
        { ...p, precio_venta_sugerido: precioVenta };

      const calculos = getFullAnalysisSimple(productForCalc, quote, config) || {
        costoFobUSD: 0,
        costoFinalBodegaCLP: 0,
        costosVenta: 0,
        gananciaNeta: 0,
        margen: 0
      };

      return {
        '✅ Aprobar': '',
        'SKU': p.sku,
        'Descripción': useCache ? p.descripcion : p.descripcion,
        'Stock Actual': stockActual,
        'Venta Diaria': ventaDiaria?.toFixed(2) || '0.00',
        'Cantidad Sugerida': cantidadSugerida,

        // DATOS COTIZACIÓN
        'Precio Unitario Cotizado (RMB)': Math.round(calculos.costoFobRMB * 100) / 100,
        'Moneda': moneda,
        'Unidades/Bulto': unidadesPorBulto || 'N/A',
        'CBM/Bulto': cbmPorBulto ? cbmPorBulto.toFixed(4) : 'N/A',
        'CBM/Unidad': cbmPorUnidad ? cbmPorUnidad.toFixed(4) : 'N/A',
        'Bultos Necesarios': bultosNecesarios || 'N/A',
        'CBM Total Orden': cbmTotal ? cbmTotal.toFixed(3) : 'N/A',
        'Días Producción': quote.productionDays || '',

        // COSTOS EN USD
        '1. Costo FOB USD': calculos.costoFobUSD ? calculos.costoFobUSD.toFixed(2) : '0.00',
        '2. Comisión China USD': calculos.comisionChinaUSD ? calculos.comisionChinaUSD.toFixed(2) : '0.00',
        '3. FOB + Comisión USD': calculos.costoFobMasComisionUSD ? calculos.costoFobMasComisionUSD.toFixed(2) : '0.00',

        // PRORATE POR CBM
        'Container CBM': calculos.containerCBM || 0,
        'Costo Logístico Total USD': calculos.costoLogisticoTotalUSD ? calculos.costoLogisticoTotalUSD.toFixed(2) : '0.00',
        'Costo Logístico por CBM USD': calculos.costoLogisticoPorCBM_USD ? calculos.costoLogisticoPorCBM_USD.toFixed(2) : '0.00',
        '4. Flete Producto USD': calculos.fletePorProductoUSD ? calculos.fletePorProductoUSD.toFixed(2) : '0.00',
        '5. Seguro USD': calculos.seguroProductoUSD ? calculos.seguroProductoUSD.toFixed(2) : '0.00',
        '6. Valor CIF USD': calculos.valorCifUSD ? calculos.valorCifUSD.toFixed(2) : '0.00',

        // COSTOS EN CLP
        '7. Valor CIF CLP': Math.round(calculos.valorCifCLP || 0),
        '8. Ad Valorem CLP': Math.round(calculos.adValoremCLP || 0),
        '9. IVA CLP': Math.round(calculos.ivaCLP || 0),
        '10. Logística Producto USD': calculos.costoLogisticoProductoUSD ? calculos.costoLogisticoProductoUSD.toFixed(2) : '0.00',
        '11. Logística Producto CLP': Math.round(calculos.costoLogisticoProductoCLP || 0),
        '12. COSTO FINAL BODEGA CLP': Math.round(calculos.costoFinalBodegaCLP || 0),

        // TOTALES DE ORDEN
        'Costo Total Orden': Math.round((calculos.costoFinalBodegaCLP || 0) * cantidadSugerida),

        // ANÁLISIS RENTABILIDAD
        'Precio Venta Analizado': precioVenta,
        '13. Comisión ML': Math.round(calculos.comisionML || 0),
        '14. Recargo ML': Math.round(calculos.recargoML || 0),
        '15. Total Costos Venta ML': Math.round(calculos.costosVenta || 0),
        'Ganancia Neta Por Unidad': Math.round(calculos.gananciaNeta || 0),
        'Ganancia Total Orden': Math.round((calculos.gananciaNeta || 0) * cantidadSugerida),
        'Margen %': (calculos.margen || 0).toFixed(1) + '%',

        // COMENTARIOS Y ACCIÓN
        'Comentarios Análisis': analysis.comments || '',
        '📝 Cantidad Final a Comprar': cantidadSugerida,
        '📝 Precio Objetivo (Negociar)': '',
        '📝 Fecha Entrega Deseada': '',
        '📝 Comentarios Aprobación': '',
        '🔒 Status Actual': p.status
      };
    }),

    // Confirmar compra
    confirm_purchase: (products) => products.map(p => {
      const detail = detailsMap[p.sku] || {};
      const quote = detail.quote_details || {};
      const approval = detail.approval_details || {};

      // La cantidad aprobada viene de approval_details
      // Si no existe (productos aprobados antes del cambio), calcular cantidad sugerida
      let cantidadAprobada = parseInt(approval.approvedQuantity);

      if (!cantidadAprobada || cantidadAprobada === 0) {
        // Fallback: calcular cantidad sugerida
        const calculos_cantidad = useCache ?
          { cantidadSugerida: p.cantidad_sugerida } :
          calcularCantidadSugerida(p, transitMap, config);
        cantidadAprobada = calculos_cantidad.cantidadSugerida || 0;
      }

      return {
        '✅ Confirmado': '',
        'SKU': p.sku,
        'Descripción': useCache ? p.descripcion : p.descripcion,
        'Cantidad Aprobada': cantidadAprobada,
        'Precio Objetivo': approval.targetPurchasePrice || quote.unitPrice || '',
        '📝 Cantidad Comprada': cantidadAprobada,
        '📝 Precio Final': '',
        '📝 Proveedor': '',
        '📝 Número de Orden': '',
        '📝 Fecha de Compra': new Date().toISOString().split('T')[0],
        '📝 Fecha Entrega Estimada': '',
        '📝 Comentarios': '',
        '🔒 Status Actual': p.status
      };
    }),

    // Confirmar fabricación
    confirm_manufacturing: (products) => products.map(p => {
      const detail = detailsMap[p.sku] || {};
      const purchase = detail.purchase_details || {};

      return {
        '✅ Fabricado': '',
        'SKU': p.sku,
        'Descripción': useCache ? p.descripcion : p.descripcion,
        'Cantidad en Producción': purchase.quantity || '',
        'Fecha Compra': purchase.purchaseDate || '',
        'Proveedor': purchase.supplier || '',
        '📝 Fecha Fabricación Completa': '',
        '📝 Notas de Calidad': '',
        '📝 Comentarios': '',
        '🔒 Status Actual': p.status
      };
    }),

    // Confirmar envío
    confirm_shipping: (products) => products.map(p => {
      const detail = detailsMap[p.sku] || {};
      const manufacturing = detail.manufacturing_details || {};
      const purchase = detail.purchase_details || {};

      return {
        '✅ Enviado': '',
        'SKU': p.sku,
        'Descripción': useCache ? p.descripcion : p.descripcion,
        'Cantidad': purchase.quantity || '',
        'Fecha Fabricación': manufacturing.completionDate || '',
        '📝 Número de Contenedor': '',
        '📝 Fecha de Embarque': '',
        '📝 ETA (Llegada Estimada)': '',
        '📝 Comentarios': '',
        '🔒 Status Actual': p.status
      };
    }),

    // Marcar como recibido
    mark_received: (products) => products.map(p => {
      const detail = detailsMap[p.sku] || {};
      const shipping = detail.shipping_details || {};
      const purchase = detail.purchase_details || {};

      return {
        '✅ Recibido': '',
        'SKU': p.sku,
        'Descripción': useCache ? p.descripcion : p.descripcion,
        'Cantidad Enviada': purchase.quantity || '',
        'Contenedor': shipping.containerNumber || '',
        'Fecha Embarque': shipping.shippingDate || '',
        'ETA Original': shipping.eta || '',
        '📝 Fecha Recepción Real': '',
        '📝 Cantidad Recibida': purchase.quantity || '',
        '📝 Estado del Producto': 'Bueno',
        '📝 Observaciones': '',
        '🔒 Status Actual': p.status
      };
    })
  };

  const formatter = formatters[action];
  if (!formatter) {
    throw new Error(`Unknown action: ${action}`);
  }

  return formatter(products);
}

// Instrucciones por acción
function getInstructions(action) {
  const instructions = {
    view: [
      { '📋 INSTRUCCIONES': 'VER PRODUCTOS' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': 'Este archivo es SOLO LECTURA' },
      { '📋 INSTRUCCIONES': 'Contiene la lista de productos en este status' }
    ],

    force_request_quote: [
      { '📋 INSTRUCCIONES': '⚡ FORZAR SOLICITUD DE COTIZACIÓN' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '1. Estos productos tienen STOCK SALUDABLE según el sistema' },
      { '📋 INSTRUCCIONES': '2. Marca "SI" en "✅ Forzar Cotización" para los que desees cotizar' },
      { '📋 INSTRUCCIONES': '3. Define la cantidad en "📝 Cantidad a Cotizar"' },
      { '📋 INSTRUCCIONES': '4. IMPORTANTE: Indica el motivo:' },
      { '📋 INSTRUCCIONES': '   • Oportunidad Mercado' },
      { '📋 INSTRUCCIONES': '   • Promoción Especial' },
      { '📋 INSTRUCCIONES': '   • Stock Preventivo' },
      { '📋 INSTRUCCIONES': '   • Temporada Alta' },
      { '📋 INSTRUCCIONES': '5. Guarda y sube el archivo' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '⚠️ NO MODIFICAR columnas con 🔒' }
    ],

    request_quote: [
      { '📋 INSTRUCCIONES': 'SOLICITAR COTIZACIONES' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '1. Marca "SI" en "✅ Acción" para solicitar cotización' },
      { '📋 INSTRUCCIONES': '2. Verifica/ajusta "📝 Cantidad a Cotizar"' },
      { '📋 INSTRUCCIONES': '3. Agrega comentarios si es necesario' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '⏰ RECORDATORIO:' },
      { '📋 INSTRUCCIONES': '4. Si deseas posponer: ingresa fecha en "📝 Recuérdame (Fecha)"' },
      { '📋 INSTRUCCIONES': '   Formato: DD-MM-YYYY (ej: 15-10-2025)' },
      { '📋 INSTRUCCIONES': '   El producto reaparecerá en esta lista en esa fecha' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '🚫 DESCONSIDERAR:' },
      { '📋 INSTRUCCIONES': '5. Si NO quieres comprar este producto nunca más:' },
      { '📋 INSTRUCCIONES': '   Marca "SI" en "📝 Desconsiderar"' },
      { '📋 INSTRUCCIONES': '   El producto NO aparecerá más en Necesita Reposición' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '6. Guarda y sube el archivo' }
    ],

    quote: [
      { '📋 INSTRUCCIONES': 'COTIZAR PRODUCTOS' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '1. Marca "SI" en "✅ Acción"' },
      { '📋 INSTRUCCIONES': '2. Completa TODOS los campos con 📝:' },
      { '📋 INSTRUCCIONES': '   • Precio Unitario (por unidad individual)' },
      { '📋 INSTRUCCIONES': '   • Moneda (RMB o USD)' },
      { '📋 INSTRUCCIONES': '   • Unidades por Bulto' },
      { '📋 INSTRUCCIONES': '   • CBM por Bulto (volumen en m³)' },
      { '📋 INSTRUCCIONES': '   • Días de Producción' },
      { '📋 INSTRUCCIONES': '3. Guarda y sube el archivo' }
    ],

    analyze: [
      { '📋 INSTRUCCIONES': 'ANALIZAR COTIZACIONES' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '1. Revisa el Costo Total Estimado' },
      { '📋 INSTRUCCIONES': '2. Marca "SI" en "✅ Analizar"' },
      { '📋 INSTRUCCIONES': '3. Ingresa "📝 Precio de Venta a Usar"' },
      { '📋 INSTRUCCIONES': '4. Agrega comentarios del análisis' },
      { '📋 INSTRUCCIONES': '5. Guarda y sube el archivo' }
    ],

    approve: [
      { '📋 INSTRUCCIONES': 'APROBAR COMPRAS' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '1. Revisa Ganancia Estimada y Margen %' },
      { '📋 INSTRUCCIONES': '2. Marca "SI" en "✅ Aprobar" para aprobar' },
      { '📋 INSTRUCCIONES': '3. Opcional: Ingresa precio objetivo para negociar' },
      { '📋 INSTRUCCIONES': '4. Opcional: Indica fecha entrega deseada' },
      { '📋 INSTRUCCIONES': '5. Guarda y sube el archivo' }
    ],

    confirm_purchase: [
      { '📋 INSTRUCCIONES': 'CONFIRMAR COMPRAS' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '1. Marca "SI" en "✅ Confirmado"' },
      { '📋 INSTRUCCIONES': '2. Completa datos de la compra:' },
      { '📋 INSTRUCCIONES': '   • Cantidad comprada' },
      { '📋 INSTRUCCIONES': '   • Precio final negociado' },
      { '📋 INSTRUCCIONES': '   • Proveedor' },
      { '📋 INSTRUCCIONES': '   • Número de orden' },
      { '📋 INSTRUCCIONES': '   • Fechas' },
      { '📋 INSTRUCCIONES': '3. Guarda y sube el archivo' }
    ],

    confirm_manufacturing: [
      { '📋 INSTRUCCIONES': 'CONFIRMAR FABRICACIÓN' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '1. Marca "SI" en "✅ Fabricado"' },
      { '📋 INSTRUCCIONES': '2. Ingresa fecha de fabricación completa' },
      { '📋 INSTRUCCIONES': '3. Agrega notas de calidad si aplica' },
      { '📋 INSTRUCCIONES': '4. Guarda y sube el archivo' }
    ],

    confirm_shipping: [
      { '📋 INSTRUCCIONES': 'CONFIRMAR ENVÍO' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '1. Marca "SI" en "✅ Enviado"' },
      { '📋 INSTRUCCIONES': '2. Completa datos del envío:' },
      { '📋 INSTRUCCIONES': '   • Número de contenedor' },
      { '📋 INSTRUCCIONES': '   • Fecha de embarque' },
      { '📋 INSTRUCCIONES': '   • ETA (fecha llegada estimada)' },
      { '📋 INSTRUCCIONES': '3. Guarda y sube el archivo' }
    ],

    mark_received: [
      { '📋 INSTRUCCIONES': 'MARCAR COMO RECIBIDO' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '1. Marca "SI" en "✅ Recibido"' },
      { '📋 INSTRUCCIONES': '2. Ingresa fecha de recepción real' },
      { '📋 INSTRUCCIONES': '3. Confirma cantidad recibida' },
      { '📋 INSTRUCCIONES': '4. Indica estado del producto (Bueno/Malo/Dañado)' },
      { '📋 INSTRUCCIONES': '5. Agrega observaciones si es necesario' },
      { '📋 INSTRUCCIONES': '6. Guarda y sube el archivo' },
      { '📋 INSTRUCCIONES': '' },
      { '📋 INSTRUCCIONES': '⚠️ Esto actualizará el stock actual en el sistema' }
    ]
  };

  return instructions[action] || [
    { '📋 INSTRUCCIONES': 'Completa los campos editables (📝)' }
  ];
}

function getFilename(action, status) {
  const timestamp = new Date().toISOString().split('T')[0];
  const names = {
    view: `Ver_${status}_${timestamp}.xlsx`,
    force_request_quote: `Forzar_Cotizaciones_${timestamp}.xlsx`,
    request_quote: `Solicitar_Cotizaciones_${timestamp}.xlsx`,
    quote: `Cotizar_Productos_${timestamp}.xlsx`,
    analyze: `Analizar_Cotizaciones_${timestamp}.xlsx`,
    approve: `Aprobar_Compras_${timestamp}.xlsx`,
    confirm_purchase: `Confirmar_Compras_${timestamp}.xlsx`,
    confirm_manufacturing: `Confirmar_Fabricacion_${timestamp}.xlsx`,
    confirm_shipping: `Confirmar_Envios_${timestamp}.xlsx`,
    mark_received: `Marcar_Recibidos_${timestamp}.xlsx`
  };
  return names[action] || `Export_${status}_${timestamp}.xlsx`;
}

function applyExcelFormatting(ws, data) {
  if (!data || data.length === 0) return;

  // Calcular anchos de columna basados en contenido
  const colWidths = Object.keys(data[0]).map(key => {
    const maxLen = Math.max(
      key.length,
      ...data.slice(0, 100).map(row => String(row[key] || '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });

  ws['!cols'] = colWidths;
}

// Función para exportar Recordatorios
async function exportReminders(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: products, error } = await supabase
      .from('products')
      .select('sku, descripcion, stock_actual, remind_me_date, remind_me_comments, status')
      .not('remind_me_date', 'is', null)
      .gt('remind_me_date', today)
      .order('remind_me_date', { ascending: true });

    if (error) throw error;

    const excelData = products.map(p => ({
      'SKU': p.sku,
      'Descripción': p.descripcion,
      'Stock Actual': p.stock_actual,
      'Fecha Recordatorio': p.remind_me_date,
      'Comentarios': p.remind_me_comments || '',
      'Status Actual': p.status,
      '📝 Cancelar Recordatorio': '' // Columna para marcar SI si quieren cancelar
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    applyExcelFormatting(ws, excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Recordatorios');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Recordatorios_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    console.log(`✅ Export completed: ${filename}`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error exporting reminders:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Función para exportar Desconsiderados
async function exportDisregarded(req, res) {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('sku, descripcion, stock_actual, status')
      .eq('desconsiderado', true)
      .order('sku');

    if (error) throw error;

    const excelData = products.map(p => ({
      'SKU': p.sku,
      'Descripción': p.descripcion,
      'Stock Actual': p.stock_actual,
      'Status Actual': p.status,
      '📝 Reactivar': '' // Columna para marcar SI si quieren reactivar
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    applyExcelFormatting(ws, excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Desconsiderados');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Desconsiderados_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    console.log(`✅ Export completed: ${filename}`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error exporting disregarded:', error);
    return res.status(500).json({ error: error.message });
  }
}
