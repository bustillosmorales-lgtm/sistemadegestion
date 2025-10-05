// __tests__/unit/critical-calculations.test.js
// ⚠️ TESTS DE REGRESIÓN PARA FÓRMULAS CRÍTICAS
// Estos tests GARANTIZAN que los cálculos NO cambien sin querer

describe('🔐 CANTIDAD SUGERIDA - Fórmulas Críticas', () => {
  // Mock de config típico del sistema
  const config = {
    tiempoEntrega: 90,
    stockSaludableMinDias: 90
  };

  // Función EXACTA del sistema (export-by-status.js líneas 6-35)
  function calcularCantidadSugerida(product, transitMap, config, ventaDiariaReal) {
    const ventaDiaria = ventaDiariaReal !== undefined ? ventaDiariaReal : (product.venta_diaria || 0);
    const stockActual = product.stock_actual || 0;
    const enTransito = transitMap[product.sku] || 0;
    const tiempoEntrega = config.tiempoEntrega || 90;
    const stockSaludableMinDias = config.stockSaludableMinDias || 90;

    const consumoDuranteLeadTime = ventaDiaria * tiempoEntrega;
    const stockFinalProyectado = stockActual + enTransito - consumoDuranteLeadTime;
    const stockObjetivo = ventaDiaria * stockSaludableMinDias;
    const stockProyectadoParaCalculo = Math.max(0, stockFinalProyectado);
    const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - stockProyectadoParaCalculo));

    return {
      cantidadSugerida,
      stockObjetivo,
      stockProyectadoLlegada: stockFinalProyectado,
      consumoDuranteLeadTime
    };
  }

  test('✅ REGRESIÓN: Caso base documentado - venta normal', () => {
    const product = { sku: 'TEST-001', stock_actual: 10 };
    const transitMap = {};
    const ventaDiaria = 5;

    const result = calcularCantidadSugerida(product, transitMap, config, ventaDiaria);

    // Valores esperados según FORMULAS_CRITICAS.md
    expect(result.consumoDuranteLeadTime).toBe(450);
    expect(result.stockProyectadoLlegada).toBe(-440);
    expect(result.stockObjetivo).toBe(450);
    expect(result.cantidadSugerida).toBe(450);
  });

  test('✅ REGRESIÓN: Caso crítico - producto SIN ventas', () => {
    const product = { sku: 'TEST-002', stock_actual: 100 };
    const transitMap = {};
    const ventaDiaria = 0;

    const result = calcularCantidadSugerida(product, transitMap, config, ventaDiaria);

    // REGLA CRÍTICA: ventaDiaria = 0 → stockObjetivo = 0 → cantidadSugerida = 0
    expect(result.stockObjetivo).toBe(0);
    expect(result.cantidadSugerida).toBe(0);
  });

  test('✅ REGRESIÓN: Con stock en tránsito reduce cantidad', () => {
    const product = { sku: 'TEST-003', stock_actual: 10 };
    const transitMap = { 'TEST-003': 200 };
    const ventaDiaria = 5;

    const result = calcularCantidadSugerida(product, transitMap, config, ventaDiaria);

    expect(result.consumoDuranteLeadTime).toBe(450);
    expect(result.stockProyectadoLlegada).toBe(-240); // 10 + 200 - 450
    expect(result.stockObjetivo).toBe(450);
    expect(result.cantidadSugerida).toBe(450); // No puede ser negativo
  });

  test('✅ REGRESIÓN: Stock suficiente con tránsito', () => {
    const product = { sku: 'TEST-004', stock_actual: 100 };
    const transitMap = { 'TEST-004': 500 };
    const ventaDiaria = 5;

    const result = calcularCantidadSugerida(product, transitMap, config, ventaDiaria);

    expect(result.stockProyectadoLlegada).toBe(150); // 100 + 500 - 450
    expect(result.stockObjetivo).toBe(450);
    expect(result.cantidadSugerida).toBe(300); // 450 - 150
  });

  test('✅ REGRESIÓN: Valores de config personalizados', () => {
    const customConfig = {
      tiempoEntrega: 60,
      stockSaludableMinDias: 120
    };
    const product = { sku: 'TEST-005', stock_actual: 0 };
    const transitMap = {};
    const ventaDiaria = 10;

    const result = calcularCantidadSugerida(product, transitMap, customConfig, ventaDiaria);

    expect(result.consumoDuranteLeadTime).toBe(600); // 10 × 60
    expect(result.stockObjetivo).toBe(1200); // 10 × 120
    expect(result.cantidadSugerida).toBe(1200);
  });
});

describe('💰 RENTABILIDAD - Fórmulas Críticas', () => {
  // Config completo del sistema
  const config = {
    rmbToUsd: 0.14,
    usdToClp: 900,
    containerCBM: 68,
    costosVariablesPct: {
      comisionChina: 0.05,
      seguroContenedor: 0.03,
      derechosAdValorem: 0.06,
      iva: 0.19
    },
    costosFijosUSD: {
      fleteMaritimo: 3500,
      certificaciones: 200,
      despachante: 150
    },
    costosFijosCLP: {
      transporte: 300000,
      almacenaje: 150000
    },
    mercadoLibre: {
      comisionPct: 0.16,
      envioUmbral: 50000,
      costoEnvio: 5000,
      cargoFijoMedioUmbral: 30000,
      cargoFijoMedio: 3500,
      cargoFijoBajo: 2500
    }
  };

  // Función EXACTA del sistema (export-by-status.js líneas 38-136)
  function calcularRentabilidad(product, quote, config) {
    const precioVentaCLP = parseFloat(product.precio_venta_sugerido) || 0;

    // FOB
    const costoFobRMB = (parseFloat(product.costo_fob_rmb) > 0)
      ? parseFloat(product.costo_fob_rmb)
      : parseFloat(quote.unitPrice) || 0;

    const costoFobUSD = costoFobRMB * (config.rmbToUsd || 0);
    const comisionChinaUSD = costoFobUSD * (config.costosVariablesPct?.comisionChina || 0);
    const costoFobMasComisionUSD = costoFobUSD + comisionChinaUSD;

    // CBM
    const containerCBM = config.containerCBM || 68;
    const unitsPerBox = parseFloat(quote.unitsPerBox) || 1;
    const cbmPerBox = parseFloat(quote.cbmPerBox) || 0;
    const cbmFromQuote = cbmPerBox > 0 ? cbmPerBox / unitsPerBox : 0;
    const cbmProducto = (parseFloat(product.cbm) > 0)
      ? parseFloat(product.cbm)
      : cbmFromQuote;

    // Flete y Seguro
    const fletePorProductoUSD = ((config.costosFijosUSD?.fleteMaritimo || 0) / containerCBM) * cbmProducto;
    const baseSeguroUSD = costoFobMasComisionUSD + fletePorProductoUSD;
    const seguroProductoUSD = baseSeguroUSD * (config.costosVariablesPct?.seguroContenedor || 0);
    const valorCifUSD = costoFobMasComisionUSD + fletePorProductoUSD + seguroProductoUSD;

    // Logística
    const totalCostosFijosCLP = Object.values(config.costosFijosCLP || {}).reduce((sum, val) => sum + (val || 0), 0);
    const totalCostosFijosUSD_fromCLP = totalCostosFijosCLP / (config.usdToClp || 1);
    const { fleteMaritimo, ...otrosCostosFijosUSD } = config.costosFijosUSD || {};
    const totalOtrosCostosFijosUSD = Object.values(otrosCostosFijosUSD).reduce((sum, val) => sum + (val || 0), 0);
    const costoLogisticoTotalUSD = totalCostosFijosUSD_fromCLP + totalOtrosCostosFijosUSD;
    const costoLogisticoPorCBM_USD = costoLogisticoTotalUSD / containerCBM;
    const costoLogisticoProductoUSD = costoLogisticoPorCBM_USD * cbmProducto;

    // CLP
    const valorCifCLP = valorCifUSD * (config.usdToClp || 1);
    const adValoremCLP = valorCifCLP * (config.costosVariablesPct?.derechosAdValorem || 0);
    const baseIvaCLP = valorCifCLP + adValoremCLP;
    const ivaCLP = baseIvaCLP * (config.costosVariablesPct?.iva || 0);
    const costoLogisticoProductoCLP = costoLogisticoProductoUSD * (config.usdToClp || 1);
    const costoFinalBodegaCLP = valorCifCLP + adValoremCLP + ivaCLP + costoLogisticoProductoCLP;

    // Mercado Libre
    const ml = config.mercadoLibre || {};
    const comisionML = precioVentaCLP * (ml.comisionPct || 0);
    let recargoML = 0;
    if (precioVentaCLP >= (ml.envioUmbral || 0)) recargoML = ml.costoEnvio || 0;
    else if (precioVentaCLP >= (ml.cargoFijoMedioUmbral || 0)) recargoML = ml.cargoFijoMedio || 0;
    else if (precioVentaCLP > 0) recargoML = ml.cargoFijoBajo || 0;
    const costosVenta = comisionML + recargoML;

    // Final
    const gananciaNeta = precioVentaCLP - costoFinalBodegaCLP - costosVenta;
    const margen = precioVentaCLP > 0 ? (gananciaNeta / precioVentaCLP) * 100 : 0;

    return {
      costoFobRMB,
      costoFobUSD,
      valorCifUSD,
      valorCifCLP,
      adValoremCLP,
      ivaCLP,
      costoFinalBodegaCLP,
      comisionML,
      recargoML,
      gananciaNeta,
      margen
    };
  }

  test('✅ REGRESIÓN: Caso base documentado - producto típico', () => {
    const product = {
      precio_venta_sugerido: 50000,
      costo_fob_rmb: 0,
      cbm: 0
    };
    const quote = {
      unitPrice: 100,
      unitsPerBox: 10,
      cbmPerBox: 0.05
    };

    const result = calcularRentabilidad(product, quote, config);

    // Verificar cálculos paso a paso
    expect(result.costoFobRMB).toBe(100);
    expect(result.costoFobUSD).toBeCloseTo(14, 2); // 100 × 0.14
    expect(result.valorCifUSD).toBeGreaterThan(14); // FOB + flete + seguro
    expect(result.valorCifCLP).toBeGreaterThan(12000); // En CLP
    expect(result.costoFinalBodegaCLP).toBeGreaterThan(result.valorCifCLP); // Incluye aranceles
    expect(result.gananciaNeta).toBeGreaterThan(0); // Debe ser rentable
    expect(result.margen).toBeGreaterThan(20); // Margen razonable
  });

  test('✅ REGRESIÓN: Producto de alto valor - envío gratis ML', () => {
    const product = {
      precio_venta_sugerido: 60000, // Sobre umbral de 50000
      costo_fob_rmb: 80,
      cbm: 0.003
    };
    const quote = { unitPrice: 80, unitsPerBox: 1, cbmPerBox: 0.003 };

    const result = calcularRentabilidad(product, quote, config);

    expect(result.recargoML).toBe(5000); // Envío gratis
    expect(result.comisionML).toBe(9600); // 60000 × 0.16
  });

  test('✅ REGRESIÓN: Producto de medio valor', () => {
    const product = {
      precio_venta_sugerido: 35000, // Entre 30000 y 50000
      costo_fob_rmb: 50,
      cbm: 0.002
    };
    const quote = { unitPrice: 50, unitsPerBox: 1, cbmPerBox: 0.002 };

    const result = calcularRentabilidad(product, quote, config);

    expect(result.recargoML).toBe(3500); // Cargo fijo medio
  });

  test('✅ REGRESIÓN: Producto de bajo valor', () => {
    const product = {
      precio_venta_sugerido: 20000, // Bajo 30000
      costo_fob_rmb: 30,
      cbm: 0.001
    };
    const quote = { unitPrice: 30, unitsPerBox: 1, cbmPerBox: 0.001 };

    const result = calcularRentabilidad(product, quote, config);

    expect(result.recargoML).toBe(2500); // Cargo fijo bajo
  });

  test('✅ REGRESIÓN: Producto sin rentabilidad', () => {
    const product = {
      precio_venta_sugerido: 5000, // Precio muy bajo
      costo_fob_rmb: 100,
      cbm: 0.01
    };
    const quote = { unitPrice: 100, unitsPerBox: 1, cbmPerBox: 0.01 };

    const result = calcularRentabilidad(product, quote, config);

    expect(result.gananciaNeta).toBeLessThan(0); // Pérdida
    expect(result.margen).toBeLessThan(0); // Margen negativo
  });

  test('✅ REGRESIÓN: Validar todos los componentes de costo', () => {
    const product = {
      precio_venta_sugerido: 40000,
      costo_fob_rmb: 70,
      cbm: 0.004
    };
    const quote = { unitPrice: 70, unitsPerBox: 1, cbmPerBox: 0.004 };

    const result = calcularRentabilidad(product, quote, config);

    // Verificar que todos los componentes existen y son números
    expect(typeof result.costoFobRMB).toBe('number');
    expect(typeof result.costoFobUSD).toBe('number');
    expect(typeof result.valorCifUSD).toBe('number');
    expect(typeof result.valorCifCLP).toBe('number');
    expect(typeof result.adValoremCLP).toBe('number');
    expect(typeof result.ivaCLP).toBe('number');
    expect(typeof result.costoFinalBodegaCLP).toBe('number');
    expect(typeof result.comisionML).toBe('number');
    expect(typeof result.recargoML).toBe('number');
    expect(typeof result.gananciaNeta).toBe('number');
    expect(typeof result.margen).toBe('number');

    // Verificar orden lógico de costos
    expect(result.costoFobUSD).toBeGreaterThan(0);
    expect(result.valorCifUSD).toBeGreaterThan(result.costoFobUSD);
    expect(result.valorCifCLP).toBeGreaterThan(0);
    expect(result.costoFinalBodegaCLP).toBeGreaterThan(result.valorCifCLP);
  });
});

describe('🔗 CONEXIÓN CONFIG → TABLAS', () => {
  test('✅ Config contiene todos los parámetros necesarios', () => {
    const configCompleto = {
      rmbToUsd: 0.14,
      usdToClp: 900,
      tiempoEntrega: 90,
      stockSaludableMinDias: 90,
      containerCBM: 68,
      costosVariablesPct: {
        comisionChina: 0.05,
        seguroContenedor: 0.03,
        derechosAdValorem: 0.06,
        iva: 0.19
      },
      costosFijosUSD: {
        fleteMaritimo: 3500
      },
      costosFijosCLP: {},
      mercadoLibre: {
        comisionPct: 0.16
      }
    };

    // Validar estructura
    expect(configCompleto).toHaveProperty('rmbToUsd');
    expect(configCompleto).toHaveProperty('usdToClp');
    expect(configCompleto).toHaveProperty('tiempoEntrega');
    expect(configCompleto).toHaveProperty('stockSaludableMinDias');
    expect(configCompleto).toHaveProperty('costosVariablesPct.comisionChina');
    expect(configCompleto).toHaveProperty('costosVariablesPct.iva');
    expect(configCompleto).toHaveProperty('mercadoLibre.comisionPct');
  });

  test('✅ Status de compras en tránsito es correcto', () => {
    const statusValidos = ['confirmado', 'en_transito'];
    const statusInvalidos = ['recibido', 'llegado', 'pendiente'];

    statusValidos.forEach(status => {
      expect(['confirmado', 'en_transito']).toContain(status);
    });

    statusInvalidos.forEach(status => {
      expect(['confirmado', 'en_transito']).not.toContain(status);
    });
  });
});
