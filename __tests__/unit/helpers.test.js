// __tests__/unit/helpers.test.js
// Tests para funciones helper del sistema

describe('Purchase Orders Helper - calculateReplenishmentStatus', () => {
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

  test('Status CRITICAL cuando no hay órdenes', () => {
    const result = calculateReplenishmentStatus(100, 0);

    expect(result.status).toBe('CRITICAL');
    expect(result.needsAction).toBe(true);
    expect(result.cantidadPendiente).toBe(100);
  });

  test('Status PARTIAL cuando falta cantidad', () => {
    const result = calculateReplenishmentStatus(100, 60);

    expect(result.status).toBe('PARTIAL');
    expect(result.needsAction).toBe(true);
    expect(result.cantidadPendiente).toBe(40);
  });

  test('Status COVERED cuando está completo', () => {
    const result = calculateReplenishmentStatus(100, 100);

    expect(result.status).toBe('COVERED');
    expect(result.needsAction).toBe(false);
    expect(result.cantidadPendiente).toBe(0);
  });

  test('Status OVER_ORDERED cuando hay exceso', () => {
    const result = calculateReplenishmentStatus(100, 150);

    expect(result.status).toBe('OVER_ORDERED');
    expect(result.needsAction).toBe(false);
    expect(result.cantidadPendiente).toBe(0);
  });
});

describe('Purchase Orders Helper - shouldShowInNeedsReplenishment', () => {
  function shouldShowInNeedsReplenishment(replenishmentStatus) {
    return replenishmentStatus.cantidadPendiente > 0;
  }

  test('Muestra producto cuando hay cantidad pendiente', () => {
    const status = { cantidadPendiente: 50 };
    expect(shouldShowInNeedsReplenishment(status)).toBe(true);
  });

  test('NO muestra producto cuando no hay cantidad pendiente', () => {
    const status = { cantidadPendiente: 0 };
    expect(shouldShowInNeedsReplenishment(status)).toBe(false);
  });

  test('NO muestra producto cuando está sobre-ordenado', () => {
    const status = { cantidadPendiente: 0 };
    expect(shouldShowInNeedsReplenishment(status)).toBe(false);
  });
});

describe('Order Number Generation Format', () => {
  function generateOrderNumberFormat() {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const random = Math.floor(Math.random() * 10000).toString().padStart(5, '0');
    return `ORD-${timestamp.slice(0, 8)}-${random}`;
  }

  test('Formato de orden es correcto', () => {
    const orderNumber = generateOrderNumberFormat();

    expect(orderNumber).toMatch(/^ORD-\d{8}-\d{5}$/);
    expect(orderNumber).toHaveLength(18); // ORD- (4) + date (8) + - (1) + random (5)
  });

  test('Fecha en orden es válida', () => {
    const orderNumber = generateOrderNumberFormat();
    const datePart = orderNumber.split('-')[1];

    expect(datePart).toHaveLength(8);
    expect(parseInt(datePart)).toBeGreaterThan(20240101); // Después de 2024
  });

  test('Parte aleatoria tiene 5 dígitos', () => {
    const orderNumber = generateOrderNumberFormat();
    const randomPart = orderNumber.split('-')[2];

    expect(randomPart).toHaveLength(5);
    expect(randomPart).toMatch(/^\d{5}$/);
  });

  test('Múltiples generaciones son diferentes', () => {
    const orders = new Set();

    for (let i = 0; i < 100; i++) {
      orders.add(generateOrderNumberFormat());
    }

    // Con 100 generaciones y 10,000 posibles randoms,
    // deberíamos tener al menos 95 únicos (probabilidad muy alta)
    expect(orders.size).toBeGreaterThan(95);
  });
});

describe('Export Filters - cantidadSugerida', () => {
  test('Filtro solo incluye productos con cantidadSugerida > 0', () => {
    const products = [
      { sku: 'A', cantidadSugerida: 100 },
      { sku: 'B', cantidadSugerida: 0 },
      { sku: 'C', cantidadSugerida: 50 },
      { sku: 'D', cantidadSugerida: 0 }
    ];

    const filtered = products.filter(p => p.cantidadSugerida > 0);

    expect(filtered).toHaveLength(2);
    expect(filtered.map(p => p.sku)).toEqual(['A', 'C']);
  });

  test('Todos con cantidad 0 resulta en array vacío', () => {
    const products = [
      { sku: 'A', cantidadSugerida: 0 },
      { sku: 'B', cantidadSugerida: 0 }
    ];

    const filtered = products.filter(p => p.cantidadSugerida > 0);

    expect(filtered).toHaveLength(0);
  });
});

describe('Stock Calculations - Días de Inventario', () => {
  function calcularDiasInventario(stockProyectado, ventaDiaria) {
    return ventaDiaria > 0 ? stockProyectado / ventaDiaria : 0;
  }

  test('Cálculo correcto de días', () => {
    expect(calcularDiasInventario(100, 5)).toBe(20);
    expect(calcularDiasInventario(30, 3)).toBe(10);
  });

  test('Venta diaria 0 retorna 0 (no Infinity)', () => {
    expect(calcularDiasInventario(100, 0)).toBe(0);
    expect(calcularDiasInventario(100, 0)).not.toBe(Infinity);
  });

  test('Stock 0 retorna 0', () => {
    expect(calcularDiasInventario(0, 5)).toBe(0);
  });

  test('Decimales se manejan correctamente', () => {
    const dias = calcularDiasInventario(100, 3.5);
    expect(dias).toBeCloseTo(28.57, 2);
  });
});

describe('Status Compra - Transit Validation', () => {
  test('Stock en tránsito incluye confirmado y en_transito', () => {
    const validStatuses = ['confirmado', 'en_transito'];
    const invalidStatuses = ['pendiente', 'recibido', 'llegado'];

    expect(validStatuses).toContain('confirmado');
    expect(validStatuses).toContain('en_transito');
    invalidStatuses.forEach(status => {
      expect(validStatuses).not.toContain(status);
    });
  });

  test('Filtro de compras en tránsito (desde cotización confirmada hasta llegada)', () => {
    const compras = [
      { sku: 'A', status_compra: 'en_transito', cantidad: 100 },
      { sku: 'B', status_compra: 'confirmado', cantidad: 50 },
      { sku: 'C', status_compra: 'en_transito', cantidad: 75 },
      { sku: 'D', status_compra: 'recibido', cantidad: 200 }
    ];

    // Incluye tanto 'confirmado' como 'en_transito'
    const enTransito = compras.filter(c =>
      c.status_compra === 'en_transito' || c.status_compra === 'confirmado'
    );

    expect(enTransito).toHaveLength(3);
    expect(enTransito.map(c => c.sku)).toEqual(['A', 'B', 'C']);

    const totalEnTransito = enTransito.reduce((sum, c) => sum + c.cantidad, 0);
    expect(totalEnTransito).toBe(225); // 100 + 50 + 75
  });

  test('No incluye compras ya recibidas', () => {
    const compras = [
      { sku: 'A', status_compra: 'confirmado', cantidad: 100 },
      { sku: 'B', status_compra: 'recibido', cantidad: 200 },
      { sku: 'C', status_compra: 'llegado', cantidad: 150 }
    ];

    const enTransito = compras.filter(c =>
      ['confirmado', 'en_transito'].includes(c.status_compra)
    );

    expect(enTransito).toHaveLength(1);
    expect(enTransito[0].sku).toBe('A');
  });
});

describe('Batch Size Constants', () => {
  test('BATCH_SIZE de 500 SKUs es razonable', () => {
    const BATCH_SIZE = 500;

    expect(BATCH_SIZE).toBeGreaterThan(0);
    expect(BATCH_SIZE).toBeLessThanOrEqual(1000); // No exceder límites de URL
  });

  test('División en batches funciona correctamente', () => {
    const BATCH_SIZE = 500;
    const totalSkus = 5525; // Total de SKUs del sistema

    const numBatches = Math.ceil(totalSkus / BATCH_SIZE);

    expect(numBatches).toBe(12); // 5525 / 500 = 11.05 → 12 batches
  });

  test('Último batch puede ser más pequeño', () => {
    const BATCH_SIZE = 500;
    const skus = Array.from({ length: 5525 }, (_, i) => `SKU-${i}`);
    const batches = [];

    for (let i = 0; i < skus.length; i += BATCH_SIZE) {
      batches.push(skus.slice(i, i + BATCH_SIZE));
    }

    expect(batches[batches.length - 1].length).toBe(25); // 5525 % 500 = 25
    expect(batches[0].length).toBe(500);
  });
});

describe('Date Period Calculation', () => {
  function calculateDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  }

  test('Mismo día retorna mínimo 1', () => {
    expect(calculateDaysBetween('2024-01-01', '2024-01-01')).toBe(1);
  });

  test('Un mes completo', () => {
    expect(calculateDaysBetween('2024-01-01', '2024-01-31')).toBe(30);
  });

  test('Un año (no bisiesto)', () => {
    expect(calculateDaysBetween('2023-01-01', '2023-12-31')).toBe(364);
  });

  test('Fechas con timestamps', () => {
    const days = calculateDaysBetween('2024-01-01T00:00:00', '2024-01-15T23:59:59');
    expect(days).toBeGreaterThanOrEqual(14);
    expect(days).toBeLessThanOrEqual(15);
  });
});
