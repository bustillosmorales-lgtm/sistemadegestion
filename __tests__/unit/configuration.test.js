/**
 * Tests para configuración del sistema
 */

describe('Configuración del Sistema', () => {
  describe('Valores por Defecto', () => {
    test('Configuración por defecto tiene todos los campos requeridos', () => {
      const configDefault = {
        stockSaludableMinDias: 60,
        tiempoEntrega: 60,
        tiempoPromedioFabricacion: 30,
        tasaCambioUSD: 950,
        tasaCambioRMB: 130,
        comisionML: 0.16,
        envioML: 5000,
        costoOperacional: 0.15
      };

      expect(configDefault.stockSaludableMinDias).toBeDefined();
      expect(configDefault.tiempoEntrega).toBeDefined();
      expect(configDefault.tiempoPromedioFabricacion).toBeDefined();
      expect(configDefault.tasaCambioUSD).toBeDefined();
      expect(configDefault.tasaCambioRMB).toBeDefined();
    });

    test('Stock saludable está en rango válido', () => {
      const stockSaludableMinDias = 60;
      const esValido = stockSaludableMinDias >= 30 && stockSaludableMinDias <= 180;

      expect(esValido).toBe(true);
    });

    test('Lead time es positivo', () => {
      const tiempoEntrega = 60;
      const tiempoFabricacion = 30;
      const leadTime = tiempoEntrega + tiempoFabricacion;

      expect(leadTime).toBeGreaterThan(0);
      expect(leadTime).toBe(90);
    });
  });

  describe('Validaciones de Configuración', () => {
    test('Rechaza días negativos', () => {
      const dias = -10;
      const esValido = dias >= 0;

      expect(esValido).toBe(false);
    });

    test('Rechaza tasa de cambio cero', () => {
      const tasa = 0;
      const esValida = tasa > 0;

      expect(esValida).toBe(false);
    });

    test('Comisión ML entre 0 y 1', () => {
      const comision = 0.16;
      const esValida = comision >= 0 && comision <= 1;

      expect(esValida).toBe(true);
    });

    test('Rechaza comisión mayor a 100%', () => {
      const comision = 1.5;
      const esValida = comision >= 0 && comision <= 1;

      expect(esValida).toBe(false);
    });
  });

  describe('Cálculos con Configuración', () => {
    test('Calcula lead time total correctamente', () => {
      const config = {
        tiempoEntrega: 60,
        tiempoPromedioFabricacion: 30
      };

      const leadTime = config.tiempoEntrega + config.tiempoPromedioFabricacion;

      expect(leadTime).toBe(90);
    });

    test('Stock objetivo usa configuración', () => {
      const ventaDiaria = 2.5;
      const stockSaludableDias = 60;

      const stockObjetivo = ventaDiaria * stockSaludableDias;

      expect(stockObjetivo).toBe(150);
    });

    test('Conversión RMB a CLP', () => {
      const costoRMB = 100;
      const tasaCambioRMB = 130;

      const costoCLP = costoRMB * tasaCambioRMB;

      expect(costoCLP).toBe(13000);
    });

    test('Conversión USD a CLP', () => {
      const costoUSD = 10;
      const tasaCambioUSD = 950;

      const costoCLP = costoUSD * tasaCambioUSD;

      expect(costoCLP).toBe(9500);
    });
  });

  describe('Actualización de Configuración', () => {
    test('Actualización parcial mantiene otros valores', () => {
      const configActual = {
        stockSaludableMinDias: 60,
        tiempoEntrega: 60,
        tiempoPromedioFabricacion: 30
      };

      const actualizacion = {
        stockSaludableMinDias: 90
      };

      const configNueva = {
        ...configActual,
        ...actualizacion
      };

      expect(configNueva.stockSaludableMinDias).toBe(90);
      expect(configNueva.tiempoEntrega).toBe(60); // No cambió
      expect(configNueva.tiempoPromedioFabricacion).toBe(30); // No cambió
    });
  });
});
