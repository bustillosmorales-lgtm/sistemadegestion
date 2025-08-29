// pages/api/analysis.js
import { supabase } from '../../lib/supabaseClient';

// La lógica de cálculo no cambia, pero ahora recibe 'config' y 'transit' como parámetros.
function getFullAnalysis(product, config, transit, precioVenta = null) {
    const precioVentaCLP = precioVenta ? parseFloat(precioVenta) : 0;

    const costoFobUSD = (product.costo_fob_rmb || 0) * (config.rmbToUsd || 0);
    const comisionChinaUSD = costoFobUSD * (config.costosVariablesPct?.comisionChina || 0);
    const costoFobMasComisionUSD = costoFobUSD + comisionChinaUSD;
    const fletePorProductoUSD = ((config.costosFijosUSD?.fleteMaritimo || 0) / (config.containerCBM || 1)) * (product.cbm || 0);
    const baseSeguroUSD = costoFobMasComisionUSD + fletePorProductoUSD;
    const seguroProductoUSD = baseSeguroUSD * (config.costosVariablesPct?.seguroContenedor || 0);
    const valorCifUSD = costoFobMasComisionUSD + fletePorProductoUSD + seguroProductoUSD;

    const totalCostosFijosCLP = Object.values(config.costosFijosCLP || {}).reduce((sum, val) => sum + (val || 0), 0);
    const totalCostosFijosUSD_fromCLP = totalCostosFijosCLP / (config.usdToClp || 1);
    const { fleteMaritimo, ...otrosCostosFijosUSD } = config.costosFijosUSD || {};
    const totalOtrosCostosFijosUSD = Object.values(otrosCostosFijosUSD).reduce((sum, val) => sum + (val || 0), 0);
    const costoLogisticoTotalUSD = totalCostosFijosUSD_fromCLP + totalOtrosCostosFijosUSD;
    const costoLogisticoPorCBM_USD = costoLogisticoTotalUSD / (config.containerCBM || 1);
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
    const consumoDuranteLeadTime = (product.venta_diaria || 0) * (config.tiempoEntrega || 0);
    const stockFinalProyectado = (product.stock_actual || 0) + stockEnTransitoQueLlega - consumoDuranteLeadTime;
    const stockObjetivo = (product.venta_diaria || 0) * (config.stockSaludableMinDias || 0);
    const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - stockFinalProyectado));
    const diasCoberturaLlegada = (product.venta_diaria || 0) > 0 ? stockFinalProyectado / (product.venta_diaria || 1) : 0;
    
    const diasDeVenta = 60;
    const fechaFinal = new Date();
    const fechaInicial = new Date(new Date().setDate(fechaFinal.getDate() - diasDeVenta));
    const unidadesVendidas = Math.round((product.venta_diaria || 0) * diasDeVenta);

    return {
        ...product,
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
            ventaDiaria: product.venta_diaria || 0,
            tiempoEntrega: config.tiempoEntrega || 0,
            diasCoberturaLlegada: (diasCoberturaLlegada || 0).toFixed(0),
            ventaDiariaDetails: {
                fechaInicial: fechaInicial.toISOString().split('T')[0],
                fechaFinal: fechaFinal.toISOString().split('T')[0],
                unidadesVendidas: unidadesVendidas || 0,
                ventaDiariaCalculada: ((product.venta_diaria || 0)).toFixed(2)
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

    // 2. Obtener datos de tránsito (simulado por ahora, idealmente sería otra tabla)
    const transit = []; // Reemplazar con una consulta a la tabla de tránsitos/compras

    if (sku) {
      const { data: product, error: productError } = await supabase.from('products').select('*').eq('sku', sku).single();
      if (productError || !product) return res.status(404).json({ error: 'SKU no encontrado' });
      
      const analysis = getFullAnalysis(product, config, transit, precioVenta);
      return res.status(200).json({ results: [analysis], configActual: config });
    } else {
      const { data: products, error: productsError } = await supabase.from('products').select('*');
      if (productsError) throw new Error('No se pudieron cargar los productos.');

      const results = products.map(product => getFullAnalysis(product, config, transit, product.analysis_details?.sellingPrice));
      return res.status(200).json({ results, configActual: config });
    }
  } catch (error) {
    console.error('Error en API analysis:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
}