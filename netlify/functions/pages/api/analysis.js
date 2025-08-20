const database = { 
  products: [
    { 
      sku: '649701', 
      descripcion: 'Producto Ejemplo A', 
      stockActual: 150, 
      costoFOB_RMB: 35.5, 
      cbm: 0.05, 
      comisionMeliPct: 0.16 
    }, 
    { 
      sku: '649702', 
      descripcion: 'Producto Ejemplo B', 
      stockActual: 800, 
      costoFOB_RMB: 70, 
      cbm: 0.1, 
      comisionMeliPct: 0.18 
    }
  ],
  transit: [
    { sku: '649701', cantidad: 100, fechaLlegada: '2025-09-15' }
  ]
};

const config = { 
  rmbToUsd: 0.14, 
  usdToClp: 980, 
  comisionChinaPct: 0.03, 
  adValoremPct: 0, 
  ivaPct: 0.19, 
  comisionBancariaUSD: 600, 
  fleteMaritimoUSD: 1950, 
  seguroContenedorUSD: 60, 
  thcdUSD: 150, 
  blUSD: 60, 
  aperturaManifiestoUSD: 55, 
  gateInUSD: 420.04, 
  movilizacionNacionalCLP: 354408, 
  honorariosCLP: 578240, 
  aforoCLP: 1430963, 
  gastosDespachoCLP: 48047, 
  movilizacionPuertoCLP: 38340, 
  peonetasCLP: 128875, 
  etiquetadoCLP: 1400, 
  containerCBM: 68 
};

function getFullAnalysis(product, precioVentaCLP = 29990) { 
  const costoFobUSD = product.costoFOB_RMB * config.rmbToUsd; 
  const comisionChinaUSD = costoFobUSD * config.comisionChinaPct; 
  const costoTotalContenedorUSD = config.fleteMaritimoUSD + config.seguroContenedorUSD + config.thcdUSD + config.blUSD + config.aperturaManifiestoUSD + config.gateInUSD + config.comisionBancariaUSD; 
  const costoLogisticoProductoUSD = (costoTotalContenedorUSD / config.containerCBM) * product.cbm; 
  const costoCifUSD = costoFobUSD + comisionChinaUSD + costoLogisticoProductoUSD; 
  const costoTotalInternacionCLP = config.movilizacionNacionalCLP + config.honorariosCLP + config.aforoCLP + config.gastosDespachoCLP + config.movilizacionPuertoCLP + config.peonetasCLP + config.etiquetadoCLP; 
  const costoInternacionProductoCLP = (costoTotalInternacionCLP / config.containerCBM) * product.cbm; 
  const costoCifCLP = costoCifUSD * config.usdToClp; 
  const ivaCLP = costoCifCLP * config.ivaPct; 
  const costoFinalBodegaCLP = costoCifCLP + ivaCLP + costoInternacionProductoCLP; 
  
  const ventaDiaria = product.sku === '649701' ? 2.5 : 5.0; 
  const tiempoEntrega = 90; 
  const stockObjetivo = ventaDiaria * tiempoEntrega; 
  const consumoProyectado = ventaDiaria * tiempoEntrega; 
  const enTransito = database.transit.find(t => t.sku === product.sku)?.cantidad || 0; 
  const stockProyectado = (product.stockActual + enTransito) - consumoProyectado; 
  
  let cantidadSugerida; 
  if (stockProyectado < 0) { 
    cantidadSugerida = stockObjetivo; 
  } else { 
    cantidadSugerida = stockObjetivo - stockProyectado; 
  } 
  cantidadSugerida = Math.max(0, Math.round(cantidadSugerida)); 
  
  const diasCoberturaActuales = ventaDiaria > 0 ? product.stockActual / ventaDiaria : 0; 
  let estadoInventario = 'CRITICO'; 
  if (diasCoberturaActuales < 30) estadoInventario = 'CRITICO'; 
  else if (diasCoberturaActuales < 60) estadoInventario = 'ALTO'; 
  else if (diasCoberturaActuales < 90) estadoInventario = 'MEDIO'; 
  else if (diasCoberturaActuales <= 120) estadoInventario = 'SALUDABLE'; 
  else if (diasCoberturaActuales <= 180) estadoInventario = 'STOCK DE 4 A 6 MESES'; 
  else estadoInventario = 'STOCK SUPERIOR A 6 MESES'; 
  
  const comisionMeliCLP = precioVentaCLP * product.comisionMeliPct; 
  let recargoMeliCLP = 0; 
  if (precioVentaCLP < 9990) recargoMeliCLP = 700; 
  else if (precioVentaCLP <= 19899) recargoMeliCLP = 1000; 
  
  const envioCLP = (precioVentaCLP > 19990) ? 3500 : 0; 
  const gananciaNetaCLP = precioVentaCLP - costoFinalBodegaCLP - comisionMeliCLP - recargoMeliCLP - envioCLP; 
  const margen = precioVentaCLP > 0 ? (gananciaNetaCLP / precioVentaCLP) * 100 : 0; 
  
  return { 
    ...product, 
    ventaDiaria, 
    costoFinalBodega: costoFinalBodegaCLP, 
    margen, 
    cantidadSugerida, 
    estadoInventario, 
    enTransito,
    gananciaNetaCLP,
    comisionMeliCLP,
    recargoMeliCLP,
    envioCLP
  }; 
}

export default async function handler(req, res) { 
  const { sku, precioVenta } = req.query; 
  const precio = parseFloat(precioVenta) || 29990; 
  
  if (sku) { 
    const product = database.products.find(p => p.sku === sku); 
    if (product) { 
      const analysis = getFullAnalysis(product, precio); 
      return res.status(200).json({ results: [analysis] }); 
    } else { 
      return res.status(404).json({ error: 'SKU no encontrado' }); 
    } 
  } else { 
    const allProductsAnalysis = database.products.map(p => getFullAnalysis(p, 29990)); 
    return res.status(200).json({ results: allProductsAnalysis }); 
  } 
}
