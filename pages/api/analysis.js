// pages/api/analysis.js
import { database, config } from '../../lib/database';

function getFullAnalysis(product, precioVenta = null) {
    const precioVentaCLP = precioVenta ? parseFloat(precioVenta) : 0;

    // --- CÁLCULOS DE COSTOS (SIN CAMBIOS) ---
    const costoFobUSD = product.costoFOB_RMB * config.rmbToUsd;
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

    // --- LÓGICA DE CÁLCULO DE REPOSICIÓN AVANZADA ---
    const hoy = new Date();
    const fechaLlegadaPedidoNuevo = new Date(new Date().setDate(hoy.getDate() + config.tiempoEntrega));

    const stockEnTransitoQueLlega = database.transit
        .filter(item => item.sku === product.sku && new Date(item.fechaLlegada) < fechaLlegadaPedidoNuevo)
        .reduce((sum, item) => sum + item.cantidad, 0);

    const consumoDuranteLeadTime = product.ventaDiaria * config.tiempoEntrega;
    const stockFinalProyectado = product.stockActual + stockEnTransitoQueLlega - consumoDuranteLeadTime;
    const stockObjetivo = product.ventaDiaria * config.stockSaludableMinDias;
    const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - stockFinalProyectado));
    
    const diasCoberturaLlegada = product.ventaDiaria > 0 ? stockFinalProyectado / product.ventaDiaria : 0;

    // --- NUEVO: Simulación de datos para el cálculo de venta diaria ---
    const diasDeVenta = 60; // Simulación: se analizaron 60 días
    const fechaFinal = new Date();
    const fechaInicial = new Date(new Date().setDate(fechaFinal.getDate() - diasDeVenta));
    const unidadesVendidas = Math.round(product.ventaDiaria * diasDeVenta);


    return {
        ...product,
        enTransito: database.transit.filter(t => t.sku === product.sku).reduce((sum, item) => sum + item.cantidad, 0),
        cantidadSugerida,
        costoFinalBodega: costoFinalBodegaCLP,
        costosVenta, gananciaNeta, margen,
        breakdown: {
            costoFobUSD: costoFobUSD.toFixed(2),
            comisionChinaUSD: comisionChinaUSD.toFixed(2),
            fletePorProductoUSD: fletePorProductoUSD.toFixed(2),
            seguroProductoUSD: seguroProductoUSD.toFixed(2),
            valorCifUSD: valorCifUSD.toFixed(2),
            costoLogisticoProductoUSD: costoLogisticoProductoUSD.toFixed(2),
            adValoremCLP: adValoremCLP.toFixed(0),
            ivaCLP: ivaCLP.toFixed(0),
            costoFinalBodegaCLP: costoFinalBodegaCLP.toFixed(0),
            comisionML: comisionML.toFixed(0),
            recargoML: recargoML.toFixed(0),
            totalCostosFijosUSD: (costoLogisticoTotalUSD).toFixed(2),
            totalCostosFijosCLP: totalCostosFijosCLP.toFixed(0),
            stockObjetivo: stockObjetivo.toFixed(0),
            stockActual: product.stockActual,
            stockEnTransitoQueLlega: stockEnTransitoQueLlega,
            consumoDuranteLeadTime: consumoDuranteLeadTime.toFixed(0),
            stockFinalProyectado: stockFinalProyectado.toFixed(0),
            ventaDiaria: product.ventaDiaria,
            tiempoEntrega: config.tiempoEntrega,
            diasCoberturaLlegada: diasCoberturaLlegada.toFixed(0),
            // --- NUEVOS CAMPOS PARA EL DESGLOSE DE VENTA DIARIA ---
            ventaDiariaDetails: {
                fechaInicial: fechaInicial.toISOString().split('T')[0],
                fechaFinal: fechaFinal.toISOString().split('T')[0],
                unidadesVendidas: unidadesVendidas,
                ventaDiariaCalculada: product.ventaDiaria.toFixed(2)
            }
        }
    };
}

export default async function handler(req, res) {
  const { sku, precioVenta } = req.query;
  try {
    if (sku) {
      const product = database.products.find(p => p.sku === sku);
      if (!product) return res.status(404).json({ error: 'SKU no encontrado' });
      const analysis = getFullAnalysis(product, precioVenta);
      return res.status(200).json({ results: [analysis], configActual: config });
    } else {
      const results = database.products.map(product => getFullAnalysis(product, product.analysisDetails?.sellingPrice));
      return res.status(200).json({ results, configActual: config });
    }
  } catch (error) {
    console.error('Error en API analysis:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
