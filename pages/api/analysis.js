// pages/api/analysis.js
import { supabase } from '../../lib/supabaseClient';

// La lógica de cálculo no cambia, pero ahora recibe 'config' y 'transit' como parámetros.
function getFullAnalysis(product, config, transit, precioVenta = null) {
    const precioVentaCLP = precioVenta ? parseFloat(precioVenta) : 0;

    const costoFobUSD = product.costo_fob_rmb * config.rmbToUsd;
    const comisionChinaUSD = costoFobUSD * config.costosVariablesPct.comisionChina;
    const costoFobMasComisionUSD = costoFobUSD + comisionChinaUSD;
    const fletePorProductoUSD = (config.costosFijosUSD.fleteMaritimo / config.containerCBM) * product.cbm;
    const baseSeguroUSD = costoFobMasComisionUSD + fletePorProductoUSD;
    const seguroProductoUSD = baseSeguroUSD * config.costosVariablesPct.seguroContenedor;
    const valorCifUSD = costoFobMasComisionUSD + fletePorProductoUSD + seguroProductoUSD;

    const totalCostosFijosCLP = Object.values(config.costosFijosCLP).reduce((sum, val) => sum + val, 0);
    const totalCostosFijosUSD_fromCLP = totalCostosFijosCLP / config.usdToClp;
    const { fleteMaritimo, ...otrosCostosFijosUSD } = config.costosFijosUSD;
    const totalOtrosCostosFijosUSD = Object.values(otrosCostosFijosUSD).reduce((sum, val) => sum + val, 0);
    const costoLogisticoTotalUSD = totalCostosFijosUSD_fromCLP + totalOtrosCostosFijosUSD;
    const costoLogisticoPorCBM_USD = costoLogisticoTotalUSD / config.containerCBM;
    const costoLogisticoProductoUSD = costoLogisticoPorCBM_USD * product.cbm;

    const valorCifCLP = valorCifUSD * config.usdToClp;
    const adValoremCLP = valorCifCLP * config.costosVariablesPct.derechosAdValorem;
    const baseIvaCLP = valorCifCLP + adValoremCLP;
    const ivaCLP = baseIvaCLP * config.costosVariablesPct.iva;
    const costoLogisticoProductoCLP = costoLogisticoProductoUSD * config.usdToClp;
    const costoFinalBodegaCLP = valorCifCLP + adValoremCLP + ivaCLP + costoLogisticoProductoCLP;

    const ml = config.mercadoLibre;
    const comisionML = precioVentaCLP * ml.comisionPct;
    let recargoML = 0;
    if (precioVentaCLP >= ml.envioUmbral) recargoML = ml.costoEnvio;
    else if (precioVentaCLP >= ml.cargoFijoMedioUmbral) recargoML = ml.cargoFijoMedio;
    else if (precioVentaCLP > 0) recargoML = ml.cargoFijoBajo;
    const costosVenta = comisionML + recargoML;
    const gananciaNeta = precioVentaCLP - costoFinalBodegaCLP - costosVenta;
    const margen = precioVentaCLP > 0 ? (gananciaNeta / precioVentaCLP) * 100 : 0;

    const hoy = new Date();
    const fechaLlegadaPedidoNuevo = new Date(new Date().setDate(hoy.getDate() + config.tiempoEntrega));
    const stockEnTransitoQueLlega = transit
        .filter(item => item.sku === product.sku && new Date(item.fechaLlegada) < fechaLlegadaPedidoNuevo)
        .reduce((sum, item) => sum + item.cantidad, 0);
    const consumoDuranteLeadTime = product.venta_diaria * config.tiempoEntrega;
    const stockFinalProyectado = product.stock_actual + stockEnTransitoQueLlega - consumoDuranteLeadTime;
    const stockObjetivo = product.venta_diaria * config.stockSaludableMinDias;
    const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - stockFinalProyectado));
    const diasCoberturaLlegada = product.venta_diaria > 0 ? stockFinalProyectado / product.venta_diaria : 0;
    
    const diasDeVenta = 60;
    const fechaFinal = new Date();
    const fechaInicial = new Date(new Date().setDate(fechaFinal.getDate() - diasDeVenta));
    const unidadesVendidas = Math.round(product.venta_diaria * diasDeVenta);

    return {
        ...product,
        enTransito: transit.filter(t => t.sku === product.sku).reduce((sum, item) => sum + item.cantidad, 0),
        cantidadSugerida,
        costoFinalBodega: costoFinalBodegaCLP,
        costosVenta, gananciaNeta, margen,
        breakdown: {
            stockObjetivo: stockObjetivo.toFixed(0),
            stockActual: product.stock_actual,
            stockEnTransitoQueLlega,
            consumoDuranteLeadTime: consumoDuranteLeadTime.toFixed(0),
            stockFinalProyectado: stockFinalProyectado.toFixed(0),
            ventaDiaria: product.venta_diaria,
            tiempoEntrega: config.tiempoEntrega,
            diasCoberturaLlegada: diasCoberturaLlegada.toFixed(0),
            ventaDiariaDetails: {
                fechaInicial: fechaInicial.toISOString().split('T')[0],
                fechaFinal: fechaFinal.toISOString().split('T')[0],
                unidadesVendidas,
                ventaDiariaCalculada: product.venta_diaria.toFixed(2)
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
