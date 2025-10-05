// __tests__/unit/calculations.test.js
// Tests para lógica de negocio crítica del sistema

describe('Cálculo de Stock Objetivo y Cantidad Sugerida', () => {
  const config = {
    stock_saludable_min_dias: 20,
    stock_critico_dias: 7
  };

  // Función extraída de export-by-status.js para testing
  function calcularCantidadSugerida(product, transitMap, config, ventaDiariaReal) {
    const sku = product.sku;
    const ventaDiaria = ventaDiariaReal !== undefined ? ventaDiariaReal : (product.venta_diaria || 0);
    const stockActual = product.stock_actual || 0;
    const stockEnTransito = transitMap[sku] || 0;

    const stockSaludableMinDias = config.stock_saludable_min_dias || 20;
    const stockCriticoDias = config.stock_critico_dias || 7;

    // REGLA DE NEGOCIO CRÍTICA: si ventaDiaria = 0, entonces stock objetivo = 0
    const stockObjetivo = ventaDiaria > 0 ? ventaDiaria * stockSaludableMinDias : 0;
    const stockCritico = ventaDiaria * stockCriticoDias;

    const stockProyectadoParaCalculo = stockActual + stockEnTransito;
    const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - stockProyectadoParaCalculo));

    const diasInventarioActual = ventaDiaria > 0 ? stockProyectadoParaCalculo / ventaDiaria : 0;

    return {
      stockObjetivo: Math.round(stockObjetivo),
      stockCritico: Math.round(stockCritico),
      cantidadSugerida: cantidadSugerida,
      diasInventarioActual: parseFloat(diasInventarioActual.toFixed(1))
    };
  }

  test('REGLA CRÍTICA: ventaDiaria = 0 debe resultar en stock objetivo = 0', () => {
    const product = { sku: 'TEST-001', stock_actual: 100 };
    const transitMap = {};

    const result = calcularCantidadSugerida(product, transitMap, config, 0);

    expect(result.stockObjetivo).toBe(0);
    expect(result.cantidadSugerida).toBe(0);
    expect(result.stockCritico).toBe(0);
  });

  test('REGLA CRÍTICA: ventaDiaria = 0 con stock en tránsito no debe sugerir compra', () => {
    const product = { sku: 'TEST-002', stock_actual: 50 };
    const transitMap = { 'TEST-002': 100 };

    const result = calcularCantidadSugerida(product, transitMap, config, 0);

    expect(result.stockObjetivo).toBe(0);
    expect(result.cantidadSugerida).toBe(0);
  });

  test('Cálculo correcto con venta diaria positiva', () => {
    const product = { sku: 'TEST-003', stock_actual: 10 };
    const transitMap = {};
    const ventaDiaria = 5;

    const result = calcularCantidadSugerida(product, transitMap, config, ventaDiaria);

    expect(result.stockObjetivo).toBe(100); // 5 * 20
    expect(result.stockCritico).toBe(35); // 5 * 7
    expect(result.cantidadSugerida).toBe(90); // 100 - 10
    expect(result.diasInventarioActual).toBe(2.0); // 10 / 5
  });

  test('Stock en tránsito reduce cantidad sugerida', () => {
    const product = { sku: 'TEST-004', stock_actual: 10 };
    const transitMap = { 'TEST-004': 50 };
    const ventaDiaria = 5;

    const result = calcularCantidadSugerida(product, transitMap, config, ventaDiaria);

    expect(result.stockObjetivo).toBe(100); // 5 * 20
    expect(result.cantidadSugerida).toBe(40); // 100 - 10 - 50
    expect(result.diasInventarioActual).toBe(12.0); // (10 + 50) / 5
  });

  test('Stock suficiente: cantidad sugerida = 0', () => {
    const product = { sku: 'TEST-005', stock_actual: 150 };
    const transitMap = {};
    const ventaDiaria = 5;

    const result = calcularCantidadSugerida(product, transitMap, config, ventaDiaria);

    expect(result.stockObjetivo).toBe(100);
    expect(result.cantidadSugerida).toBe(0); // Ya tiene suficiente
    expect(result.diasInventarioActual).toBe(30.0); // 150 / 5
  });

  test('Cantidad sugerida nunca es negativa', () => {
    const product = { sku: 'TEST-006', stock_actual: 200 };
    const transitMap = { 'TEST-006': 100 };
    const ventaDiaria = 5;

    const result = calcularCantidadSugerida(product, transitMap, config, ventaDiaria);

    expect(result.cantidadSugerida).toBe(0); // No negativo
  });

  test('Stock vacío con venta alta genera sugerencia grande', () => {
    const product = { sku: 'TEST-007', stock_actual: 0 };
    const transitMap = {};
    const ventaDiaria = 10;

    const result = calcularCantidadSugerida(product, transitMap, config, ventaDiaria);

    expect(result.stockObjetivo).toBe(200); // 10 * 20
    expect(result.cantidadSugerida).toBe(200);
    expect(result.diasInventarioActual).toBe(0);
  });

  test('Venta diaria decimal se maneja correctamente', () => {
    const product = { sku: 'TEST-008', stock_actual: 20 };
    const transitMap = {};
    const ventaDiaria = 3.5; // Venta promedio de 3.5 unidades/día

    const result = calcularCantidadSugerida(product, transitMap, config, ventaDiaria);

    expect(result.stockObjetivo).toBe(70); // 3.5 * 20 = 70
    expect(result.stockCritico).toBe(25); // 3.5 * 7 = 24.5 ≈ 25
    expect(result.cantidadSugerida).toBe(50); // 70 - 20
    expect(result.diasInventarioActual).toBe(5.7); // 20 / 3.5
  });
});

describe('Cálculo de Estado de Reposición', () => {
  // Función extraída de purchaseOrdersHelper.js
  function calculateReplenishmentStatus(cantidadTotalNecesaria, cantidadEnProceso) {
    const cantidadPendiente = Math.max(0, cantidadTotalNecesaria - cantidadEnProceso);

    let status = 'OK';
    let needsAction = false;

    if (cantidadPendiente > 0 && cantidadEnProceso > 0) {
      status = 'PARTIAL';
      needsAction = true;
    } else if (cantidadPendiente > 0 && cantidadEnProceso === 0) {
      status = 'CRITICAL';
      needsAction = true;
    } else if (cantidadEnProceso > cantidadTotalNecesaria) {
      status = 'OVER_ORDERED';
      needsAction = false;
    } else if (cantidadPendiente === 0 && cantidadEnProceso > 0) {
      status = 'COVERED';
      needsAction = false;
    }

    return {
      cantidadTotalNecesaria,
      cantidadEnProceso,
      cantidadPendiente,
      status,
      needsAction,
      percentageCovered: cantidadTotalNecesaria > 0
        ? Math.round((cantidadEnProceso / cantidadTotalNecesaria) * 100)
        : 0
    };
  }

  test('CRITICAL: Sin órdenes activas', () => {
    const result = calculateReplenishmentStatus(100, 0);

    expect(result.status).toBe('CRITICAL');
    expect(result.cantidadPendiente).toBe(100);
    expect(result.needsAction).toBe(true);
    expect(result.percentageCovered).toBe(0);
  });

  test('PARTIAL: Orden parcial - necesita más', () => {
    const result = calculateReplenishmentStatus(100, 60);

    expect(result.status).toBe('PARTIAL');
    expect(result.cantidadPendiente).toBe(40);
    expect(result.needsAction).toBe(true);
    expect(result.percentageCovered).toBe(60);
  });

  test('COVERED: Completamente cubierto por órdenes', () => {
    const result = calculateReplenishmentStatus(100, 100);

    expect(result.status).toBe('COVERED');
    expect(result.cantidadPendiente).toBe(0);
    expect(result.needsAction).toBe(false);
    expect(result.percentageCovered).toBe(100);
  });

  test('OVER_ORDERED: Sobre-ordenado', () => {
    const result = calculateReplenishmentStatus(100, 150);

    expect(result.status).toBe('OVER_ORDERED');
    expect(result.cantidadPendiente).toBe(0);
    expect(result.needsAction).toBe(false);
    expect(result.percentageCovered).toBe(150);
  });

  test('Cantidad pendiente nunca es negativa', () => {
    const result = calculateReplenishmentStatus(50, 100);

    expect(result.cantidadPendiente).toBe(0);
    expect(result.cantidadPendiente).toBeGreaterThanOrEqual(0);
  });
});

describe('Cálculo de Venta Diaria desde Ventas', () => {
  // Función extraída de export-by-status.js
  function calcularVentaDiaria(ventas) {
    if (!ventas || ventas.length === 0) {
      return {
        ventaDiaria: 0,
        fechaInicio: null,
        fechaFin: null,
        diasPeriodo: 0,
        unidadesVendidas: 0
      };
    }

    const fechaInicio = ventas[0].fecha_venta;
    const fechaFin = ventas[ventas.length - 1].fecha_venta;
    const totalVendido = ventas.reduce((sum, v) => sum + (v.cantidad || 0), 0);

    const dias = Math.max(1, Math.ceil((new Date(fechaFin) - new Date(fechaInicio)) / (1000 * 60 * 60 * 24)));
    const ventaDiaria = dias > 0 ? totalVendido / dias : 0;

    const formatearFecha = (fecha) => {
      if (!fecha) return null;
      return String(fecha).split('T')[0].split(' ')[0];
    };

    return {
      ventaDiaria: parseFloat(ventaDiaria.toFixed(4)),
      fechaInicio: formatearFecha(fechaInicio),
      fechaFin: formatearFecha(fechaFin),
      diasPeriodo: dias,
      unidadesVendidas: totalVendido
    };
  }

  test('Sin ventas retorna valores vacíos', () => {
    const result = calcularVentaDiaria([]);

    expect(result.ventaDiaria).toBe(0);
    expect(result.fechaInicio).toBe(null);
    expect(result.fechaFin).toBe(null);
    expect(result.diasPeriodo).toBe(0);
    expect(result.unidadesVendidas).toBe(0);
  });

  test('Calcula correctamente con múltiples ventas', () => {
    const ventas = [
      { fecha_venta: '2024-01-01', cantidad: 10 },
      { fecha_venta: '2024-01-15', cantidad: 20 },
      { fecha_venta: '2024-01-31', cantidad: 30 }
    ];

    const result = calcularVentaDiaria(ventas);

    expect(result.unidadesVendidas).toBe(60);
    expect(result.diasPeriodo).toBe(30);
    expect(result.ventaDiaria).toBeCloseTo(2, 1); // 60/30 = 2
    expect(result.fechaInicio).toBe('2024-01-01');
    expect(result.fechaFin).toBe('2024-01-31');
  });

  test('Mismo día: mínimo 1 día de periodo', () => {
    const ventas = [
      { fecha_venta: '2024-01-01', cantidad: 10 },
      { fecha_venta: '2024-01-01', cantidad: 5 }
    ];

    const result = calcularVentaDiaria(ventas);

    expect(result.diasPeriodo).toBe(1);
    expect(result.ventaDiaria).toBe(15); // 15 unidades / 1 día
  });

  test('Formatea fechas correctamente', () => {
    const ventas = [
      { fecha_venta: '2024-01-01T00:00:00', cantidad: 10 },
      { fecha_venta: '2024-12-31T23:59:59', cantidad: 10 }
    ];

    const result = calcularVentaDiaria(ventas);

    expect(result.fechaInicio).toBe('2024-01-01');
    expect(result.fechaFin).toBe('2024-12-31');
  });
});

describe('Formato de Fechas', () => {
  function formatearFecha(fecha) {
    if (!fecha) return null;
    return String(fecha).split('T')[0].split(' ')[0];
  }

  test('Fecha con timestamp', () => {
    expect(formatearFecha('2024-01-15T10:30:00')).toBe('2024-01-15');
  });

  test('Fecha sin timestamp', () => {
    expect(formatearFecha('2024-01-15')).toBe('2024-01-15');
  });

  test('Fecha null retorna null', () => {
    expect(formatearFecha(null)).toBe(null);
  });

  test('Fecha undefined retorna null', () => {
    expect(formatearFecha(undefined)).toBe(null);
  });

  test('Fecha con espacio en lugar de T', () => {
    expect(formatearFecha('2024-01-15 10:30:00')).toBe('2024-01-15');
  });
});

describe('Validaciones de Negocio', () => {
  test('Stock objetivo nunca es negativo', () => {
    const ventaDiaria = -5; // Valor inválido
    const stockSaludableMinDias = 20;

    const stockObjetivo = Math.max(0, ventaDiaria * stockSaludableMinDias);

    expect(stockObjetivo).toBe(0);
  });

  test('Días de inventario con venta 0 no causa división por cero', () => {
    const stockActual = 100;
    const ventaDiaria = 0;

    const diasInventario = ventaDiaria > 0 ? stockActual / ventaDiaria : 0;

    expect(diasInventario).toBe(0);
    expect(diasInventario).not.toBe(Infinity);
  });

  test('Cantidad sugerida redondeada es entero', () => {
    const stockObjetivo = 123.7;
    const stockActual = 20.3;

    const cantidadSugerida = Math.round(stockObjetivo - stockActual);

    expect(cantidadSugerida).toBe(103);
    expect(Number.isInteger(cantidadSugerida)).toBe(true);
  });
});
