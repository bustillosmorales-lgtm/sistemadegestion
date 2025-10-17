/**
 * Tests para lógica de descomposición de packs
 * Prioridad: CRÍTICA
 */

describe('Sistema de Packs - Descomposición', () => {
  describe('Descomposición de Ventas', () => {
    test('Venta de pack se descompone correctamente', () => {
      const ventas = [
        { sku: 'PACK0001', cantidad: 1, fecha_venta: '2025-01-15' }
      ];

      const packs = [
        { pack_sku: 'PACK0001', producto_sku: 'PROD-A', cantidad: 2 },
        { pack_sku: 'PACK0001', producto_sku: 'PROD-B', cantidad: 1 }
      ];

      // Descomponer
      const ventasDescompuestas = [];

      ventas.forEach(venta => {
        const componentes = packs.filter(p => p.pack_sku === venta.sku);

        if (componentes.length > 0) {
          // Es un pack
          componentes.forEach(componente => {
            ventasDescompuestas.push({
              sku: componente.producto_sku,
              cantidad: venta.cantidad * componente.cantidad,
              fecha_venta: venta.fecha_venta
            });
          });
        } else {
          // Venta individual
          ventasDescompuestas.push(venta);
        }
      });

      expect(ventasDescompuestas).toHaveLength(2);
      expect(ventasDescompuestas[0]).toEqual({
        sku: 'PROD-A',
        cantidad: 2,
        fecha_venta: '2025-01-15'
      });
      expect(ventasDescompuestas[1]).toEqual({
        sku: 'PROD-B',
        cantidad: 1,
        fecha_venta: '2025-01-15'
      });
    });

    test('Venta de múltiples packs multiplica cantidades correctamente', () => {
      const ventas = [
        { sku: 'PACK0001', cantidad: 3, fecha_venta: '2025-01-15' }
      ];

      const packs = [
        { pack_sku: 'PACK0001', producto_sku: 'PROD-A', cantidad: 2 },
        { pack_sku: 'PACK0001', producto_sku: 'PROD-B', cantidad: 1 }
      ];

      const ventasDescompuestas = [];

      ventas.forEach(venta => {
        const componentes = packs.filter(p => p.pack_sku === venta.sku);

        if (componentes.length > 0) {
          componentes.forEach(componente => {
            ventasDescompuestas.push({
              sku: componente.producto_sku,
              cantidad: venta.cantidad * componente.cantidad,
              fecha_venta: venta.fecha_venta
            });
          });
        } else {
          ventasDescompuestas.push(venta);
        }
      });

      // 3 packs × 2 PROD-A = 6
      expect(ventasDescompuestas[0].cantidad).toBe(6);
      // 3 packs × 1 PROD-B = 3
      expect(ventasDescompuestas[1].cantidad).toBe(3);
    });

    test('Venta individual NO se descompone', () => {
      const ventas = [
        { sku: 'PROD-INDIVIDUAL', cantidad: 5, fecha_venta: '2025-01-15' }
      ];

      const packs = [
        { pack_sku: 'PACK0001', producto_sku: 'PROD-A', cantidad: 2 }
      ];

      const ventasDescompuestas = [];

      ventas.forEach(venta => {
        const componentes = packs.filter(p => p.pack_sku === venta.sku);

        if (componentes.length > 0) {
          componentes.forEach(componente => {
            ventasDescompuestas.push({
              sku: componente.producto_sku,
              cantidad: venta.cantidad * componente.cantidad,
              fecha_venta: venta.fecha_venta
            });
          });
        } else {
          ventasDescompuestas.push(venta);
        }
      });

      expect(ventasDescompuestas).toHaveLength(1);
      expect(ventasDescompuestas[0]).toEqual({
        sku: 'PROD-INDIVIDUAL',
        cantidad: 5,
        fecha_venta: '2025-01-15'
      });
    });

    test('Mix de ventas de packs e individuales', () => {
      const ventas = [
        { sku: 'PACK0001', cantidad: 2, fecha_venta: '2025-01-15' },
        { sku: 'PROD-INDIVIDUAL', cantidad: 3, fecha_venta: '2025-01-15' },
        { sku: 'PACK0002', cantidad: 1, fecha_venta: '2025-01-15' }
      ];

      const packs = [
        { pack_sku: 'PACK0001', producto_sku: 'PROD-A', cantidad: 2 },
        { pack_sku: 'PACK0001', producto_sku: 'PROD-B', cantidad: 1 },
        { pack_sku: 'PACK0002', producto_sku: 'PROD-C', cantidad: 5 }
      ];

      const ventasDescompuestas = [];

      ventas.forEach(venta => {
        const componentes = packs.filter(p => p.pack_sku === venta.sku);

        if (componentes.length > 0) {
          componentes.forEach(componente => {
            ventasDescompuestas.push({
              sku: componente.producto_sku,
              cantidad: venta.cantidad * componente.cantidad,
              fecha_venta: venta.fecha_venta
            });
          });
        } else {
          ventasDescompuestas.push(venta);
        }
      });

      expect(ventasDescompuestas).toHaveLength(4);
      // PACK0001: 2 × 2 PROD-A, 2 × 1 PROD-B
      // PROD-INDIVIDUAL: 3
      // PACK0002: 1 × 5 PROD-C
      expect(ventasDescompuestas.find(v => v.sku === 'PROD-A').cantidad).toBe(4);
      expect(ventasDescompuestas.find(v => v.sku === 'PROD-B').cantidad).toBe(2);
      expect(ventasDescompuestas.find(v => v.sku === 'PROD-INDIVIDUAL').cantidad).toBe(3);
      expect(ventasDescompuestas.find(v => v.sku === 'PROD-C').cantidad).toBe(5);
    });
  });

  describe('Consolidación de Ventas Descompuestas', () => {
    test('Suma correctamente ventas del mismo producto', () => {
      const ventasDescompuestas = [
        { sku: 'PROD-A', cantidad: 2, fecha_venta: '2025-01-15' },
        { sku: 'PROD-A', cantidad: 3, fecha_venta: '2025-01-16' },
        { sku: 'PROD-B', cantidad: 1, fecha_venta: '2025-01-15' }
      ];

      // Consolidar por SKU
      const ventasConsolidadas = ventasDescompuestas.reduce((acc, venta) => {
        if (!acc[venta.sku]) {
          acc[venta.sku] = 0;
        }
        acc[venta.sku] += venta.cantidad;
        return acc;
      }, {});

      expect(ventasConsolidadas['PROD-A']).toBe(5); // 2 + 3
      expect(ventasConsolidadas['PROD-B']).toBe(1);
    });
  });

  describe('Validaciones de Packs', () => {
    test('Pack sin componentes es inválido', () => {
      const pack_sku = 'PACK0003';
      const packs = [
        { pack_sku: 'PACK0001', producto_sku: 'PROD-A', cantidad: 2 }
      ];

      const componentes = packs.filter(p => p.pack_sku === pack_sku);

      expect(componentes.length).toBe(0);
    });

    test('Componente con cantidad cero es inválido', () => {
      const componente = { pack_sku: 'PACK0001', producto_sku: 'PROD-A', cantidad: 0 };

      const esValido = componente.cantidad > 0;

      expect(esValido).toBe(false);
    });

    test('Pack puede tener múltiples componentes', () => {
      const packs = [
        { pack_sku: 'PACK0001', producto_sku: 'PROD-A', cantidad: 2 },
        { pack_sku: 'PACK0001', producto_sku: 'PROD-B', cantidad: 1 },
        { pack_sku: 'PACK0001', producto_sku: 'PROD-C', cantidad: 3 }
      ];

      const componentes = packs.filter(p => p.pack_sku === 'PACK0001');

      expect(componentes.length).toBe(3);
    });
  });

  describe('Cálculo de Venta Diaria con Packs', () => {
    test('Venta diaria incluye ventas descompuestas de packs', () => {
      const ventas = [
        { sku: 'PACK0001', cantidad: 10, fecha_venta: '2025-01-01' },
        { sku: 'PROD-A', cantidad: 5, fecha_venta: '2025-01-02' }
      ];

      const packs = [
        { pack_sku: 'PACK0001', producto_sku: 'PROD-A', cantidad: 2 }
      ];

      // Descomponer
      const ventasDescompuestas = [];
      ventas.forEach(venta => {
        const componentes = packs.filter(p => p.pack_sku === venta.sku);

        if (componentes.length > 0) {
          componentes.forEach(componente => {
            ventasDescompuestas.push({
              sku: componente.producto_sku,
              cantidad: venta.cantidad * componente.cantidad,
              fecha_venta: venta.fecha_venta
            });
          });
        } else {
          ventasDescompuestas.push(venta);
        }
      });

      // Consolidar PROD-A
      const totalPRODA = ventasDescompuestas
        .filter(v => v.sku === 'PROD-A')
        .reduce((sum, v) => sum + v.cantidad, 0);

      // 10 packs × 2 = 20, más 5 individuales = 25 total
      expect(totalPRODA).toBe(25);

      // Venta diaria (asumiendo 2 días de período)
      const dias = 2;
      const ventaDiaria = totalPRODA / dias;

      expect(ventaDiaria).toBe(12.5);
    });
  });
});
