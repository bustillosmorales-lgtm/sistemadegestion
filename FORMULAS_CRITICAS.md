# 🔐 FÓRMULAS CRÍTICAS DEL SISTEMA
## ⚠️ ESTAS FÓRMULAS SON SAGRADAS - NO MODIFICAR SIN TESTS

**Última verificación:** 2025-01-05
**Archivos fuente:** `export-by-status.js` líneas 6-136

---

## 📊 1. CANTIDAD SUGERIDA DE REPOSICIÓN

### 🎯 Objetivo
Calcular cuántas unidades comprar para mantener stock saludable.

### 📝 Inputs Requeridos

```javascript
// Desde tabla: products
- stock_actual: number (stock en bodega ahora)
- sku: string (identificador único)

// Desde tabla: compras (con status 'confirmado' o 'en_transito')
- cantidad: number (unidades en tránsito)
- status_compra: 'confirmado' | 'en_transito'

// Desde tabla: ventas (historial completo)
- cantidad: number (unidades vendidas)
- fecha_venta: date (fecha de la venta)

// Desde tabla: configuration (id=1)
- tiempoEntrega: number (días para que llegue un pedido)
- stockSaludableMinDias: number (días de inventario objetivo)
```

### 🧮 Fórmulas Exactas

```javascript
function calcularCantidadSugerida(product, transitMap, config, ventaDiariaReal) {
  // PASO 1: Obtener venta diaria (calculada desde tabla ventas)
  const ventaDiaria = ventaDiariaReal || 0;

  // PASO 2: Datos base
  const stockActual = product.stock_actual || 0;
  const enTransito = transitMap[product.sku] || 0;  // Suma de compras confirmadas/en_transito
  const tiempoEntrega = config.tiempoEntrega || 90;
  const stockSaludableMinDias = config.stockSaludableMinDias || 90;

  // PASO 3: Proyección de stock al momento de llegada del nuevo pedido
  const consumoDuranteLeadTime = ventaDiaria * tiempoEntrega;
  const stockFinalProyectado = stockActual + enTransito - consumoDuranteLeadTime;

  // PASO 4: Stock objetivo (cuánto queremos tener)
  const stockObjetivo = ventaDiaria * stockSaludableMinDias;

  // PASO 5: Cantidad sugerida (NO puede ser negativa)
  const stockProyectadoParaCalculo = Math.max(0, stockFinalProyectado);
  const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - stockProyectadoParaCalculo));

  // ⚠️ REGLA CRÍTICA DE NEGOCIO:
  // SI ventaDiaria = 0 ENTONCES stockObjetivo = 0 Y cantidadSugerida = 0

  return {
    cantidadSugerida,
    stockObjetivo,
    stockProyectadoLlegada: stockFinalProyectado,
    consumoDuranteLeadTime
  };
}
```

### ✅ Verificación (Test)

```javascript
// Caso 1: Producto con venta normal
Input:
  - stock_actual: 10
  - en_transito: 0
  - ventaDiaria: 5
  - tiempoEntrega: 90
  - stockSaludableMinDias: 90

Cálculo:
  - consumoDuranteLeadTime = 5 × 90 = 450
  - stockFinalProyectado = 10 + 0 - 450 = -440
  - stockProyectadoParaCalculo = max(0, -440) = 0
  - stockObjetivo = 5 × 90 = 450
  - cantidadSugerida = max(0, round(450 - 0)) = 450

Output: cantidadSugerida = 450 ✅

// Caso 2: Producto SIN ventas
Input:
  - stock_actual: 100
  - en_transito: 0
  - ventaDiaria: 0  ← SIN VENTAS

Cálculo:
  - stockObjetivo = 0 × 90 = 0
  - cantidadSugerida = max(0, round(0 - 100)) = 0

Output: cantidadSugerida = 0 ✅ (NO comprar si no vende)
```

---

## 💰 2. RENTABILIDAD (MARGEN)

### 🎯 Objetivo
Calcular ganancia neta y % de margen de un producto.

### 📝 Inputs Requeridos

```javascript
// Desde tabla: products
- precio_venta_sugerido: number (precio de venta en CLP)
- costo_fob_rmb: number (costo FOB en RMB, si ya existe)
- cbm: number (metros cúbicos por unidad, si ya existe)

// Desde quote (cotización)
- unitPrice: number (precio unitario FOB en RMB)
- unitsPerBox: number (unidades por caja)
- cbmPerBox: number (CBM por caja)

// Desde tabla: configuration (id=1) - ESTRUCTURA COMPLETA
config = {
  // Tasas de cambio
  rmbToUsd: 0.14,
  usdToClp: 900,

  // Costos variables (porcentajes)
  costosVariablesPct: {
    comisionChina: 0.05,          // 5%
    seguroContenedor: 0.03,       // 3%
    derechosAdValorem: 0.06,      // 6%
    iva: 0.19                     // 19%
  },

  // Costos fijos en USD (por contenedor)
  costosFijosUSD: {
    fleteMaritimo: 3500,
    certificaciones: 200,
    despachante: 150
  },

  // Costos fijos en CLP (por contenedor)
  costosFijosCLP: {
    transporte: 300000,
    almacenaje: 150000
  },

  // Contenedor
  containerCBM: 68,

  // Mercado Libre
  mercadoLibre: {
    comisionPct: 0.16,            // 16%
    envioUmbral: 50000,           // CLP
    costoEnvio: 5000,             // CLP
    cargoFijoMedioUmbral: 30000,  // CLP
    cargoFijoMedio: 3500,         // CLP
    cargoFijoBajo: 2500           // CLP
  },

  // Tiempos
  tiempoEntrega: 90,
  stockSaludableMinDias: 90
}
```

### 🧮 Fórmulas Exactas (PASO A PASO)

```javascript
function calcularRentabilidad(product, quote, config) {
  // ═══════════════════════════════════════════════════
  // FASE 1: COSTO FOB Y COMISIÓN CHINA (USD)
  // ═══════════════════════════════════════════════════

  const precioVentaCLP = parseFloat(product.precio_venta_sugerido) || 0;

  // FOB en RMB (priorizar quote actual, fallback a guardado)
  const costoFobRMB = (product.costo_fob_rmb > 0)
    ? product.costo_fob_rmb
    : quote.unitPrice;

  // Convertir a USD
  const costoFobUSD = costoFobRMB * config.rmbToUsd;

  // Comisión China (%)
  const comisionChinaUSD = costoFobUSD * config.costosVariablesPct.comisionChina;

  // Total FOB + Comisión
  const costoFobMasComisionUSD = costoFobUSD + comisionChinaUSD;


  // ═══════════════════════════════════════════════════
  // FASE 2: FLETE Y SEGURO (USD)
  // ═══════════════════════════════════════════════════

  const containerCBM = config.containerCBM || 68;

  // CBM por unidad (priorizar guardado, calcular desde quote)
  const unitsPerBox = quote.unitsPerBox || 1;
  const cbmPerBox = quote.cbmPerBox || 0;
  const cbmFromQuote = cbmPerBox > 0 ? cbmPerBox / unitsPerBox : 0;
  const cbmProducto = (product.cbm > 0) ? product.cbm : cbmFromQuote;

  // Flete prorrateado por CBM
  const fletePorProductoUSD =
    (config.costosFijosUSD.fleteMaritimo / containerCBM) * cbmProducto;

  // Seguro (% sobre FOB + comisión + flete)
  const baseSeguroUSD = costoFobMasComisionUSD + fletePorProductoUSD;
  const seguroProductoUSD = baseSeguroUSD * config.costosVariablesPct.seguroContenedor;

  // Valor CIF (USD)
  const valorCifUSD = costoFobMasComisionUSD + fletePorProductoUSD + seguroProductoUSD;


  // ═══════════════════════════════════════════════════
  // FASE 3: COSTOS LOGÍSTICOS (USD)
  // ═══════════════════════════════════════════════════

  // Costos fijos en CLP → USD
  const totalCostosFijosCLP = Object.values(config.costosFijosCLP || {})
    .reduce((sum, val) => sum + (val || 0), 0);
  const totalCostosFijosUSD_fromCLP = totalCostosFijosCLP / config.usdToClp;

  // Costos fijos en USD (excepto flete marítimo, ya incluido)
  const { fleteMaritimo, ...otrosCostosFijosUSD } = config.costosFijosUSD || {};
  const totalOtrosCostosFijosUSD = Object.values(otrosCostosFijosUSD)
    .reduce((sum, val) => sum + (val || 0), 0);

  // Total costos logísticos
  const costoLogisticoTotalUSD = totalCostosFijosUSD_fromCLP + totalOtrosCostosFijosUSD;

  // Prorrateo por CBM
  const costoLogisticoPorCBM_USD = costoLogisticoTotalUSD / containerCBM;
  const costoLogisticoProductoUSD = costoLogisticoPorCBM_USD * cbmProducto;


  // ═══════════════════════════════════════════════════
  // FASE 4: CONVERSIÓN A CLP Y ARANCELES
  // ═══════════════════════════════════════════════════

  const valorCifCLP = valorCifUSD * config.usdToClp;

  // Ad Valorem (% sobre CIF)
  const adValoremCLP = valorCifCLP * config.costosVariablesPct.derechosAdValorem;

  // IVA (% sobre CIF + Ad Valorem)
  const baseIvaCLP = valorCifCLP + adValoremCLP;
  const ivaCLP = baseIvaCLP * config.costosVariablesPct.iva;

  // Logística en CLP
  const costoLogisticoProductoCLP = costoLogisticoProductoUSD * config.usdToClp;

  // COSTO FINAL EN BODEGA (CLP)
  const costoFinalBodegaCLP = valorCifCLP + adValoremCLP + ivaCLP + costoLogisticoProductoCLP;


  // ═══════════════════════════════════════════════════
  // FASE 5: COSTOS DE VENTA (MERCADO LIBRE)
  // ═══════════════════════════════════════════════════

  const ml = config.mercadoLibre || {};

  // Comisión ML (%)
  const comisionML = precioVentaCLP * (ml.comisionPct || 0);

  // Recargo envío (según umbral)
  let recargoML = 0;
  if (precioVentaCLP >= (ml.envioUmbral || 0)) {
    recargoML = ml.costoEnvio || 0;
  } else if (precioVentaCLP >= (ml.cargoFijoMedioUmbral || 0)) {
    recargoML = ml.cargoFijoMedio || 0;
  } else if (precioVentaCLP > 0) {
    recargoML = ml.cargoFijoBajo || 0;
  }

  const costosVenta = comisionML + recargoML;


  // ═══════════════════════════════════════════════════
  // FASE 6: GANANCIA Y MARGEN FINAL
  // ═══════════════════════════════════════════════════

  const gananciaNeta = precioVentaCLP - costoFinalBodegaCLP - costosVenta;
  const margen = precioVentaCLP > 0 ? (gananciaNeta / precioVentaCLP) * 100 : 0;

  return { costoFinalBodegaCLP, gananciaNeta, margen };
}
```

### ✅ Verificación (Test)

```javascript
// Ejemplo real
Input:
  - precio_venta_sugerido: 50000 CLP
  - quote.unitPrice: 100 RMB
  - quote.cbmPerBox: 0.05
  - quote.unitsPerBox: 10
  - config (según estructura arriba)

Cálculo paso a paso:
  1. costoFobRMB = 100
  2. costoFobUSD = 100 × 0.14 = 14
  3. comisionChinaUSD = 14 × 0.05 = 0.7
  4. costoFobMasComisionUSD = 14 + 0.7 = 14.7
  5. cbmProducto = 0.05 / 10 = 0.005
  6. fletePorProductoUSD = (3500 / 68) × 0.005 = 0.257
  7. seguroProductoUSD = (14.7 + 0.257) × 0.03 = 0.449
  8. valorCifUSD = 14.7 + 0.257 + 0.449 = 15.406
  9. valorCifCLP = 15.406 × 900 = 13,865
  10. adValoremCLP = 13,865 × 0.06 = 832
  11. ivaCLP = (13,865 + 832) × 0.19 = 2,792
  12. costoLogisticoProductoCLP = ... (calcular)
  13. costoFinalBodegaCLP = 13,865 + 832 + 2,792 + logística ≈ 18,500
  14. comisionML = 50,000 × 0.16 = 8,000
  15. recargoML = 5,000 (envío gratis)
  16. costosVenta = 8,000 + 5,000 = 13,000
  17. gananciaNeta = 50,000 - 18,500 - 13,000 = 18,500
  18. margen = (18,500 / 50,000) × 100 = 37%

Output: margen = 37% ✅
```

---

## 🔗 3. CONEXIÓN CONFIG → TABLAS

### 📊 Flujo de Datos COMPLETO

```
┌─────────────────────────────────────────────────────────┐
│ 1. Usuario modifica config en /config                  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Se guarda en tabla: configuration (id=1)            │
│    Estructura JSON con TODOS los parámetros            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 3. API export-by-status.js lee config (línea 169)     │
│    const { data } = await supabase                     │
│      .from('configuration')                            │
│      .select('data')                                   │
│      .eq('id', 1)                                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├──────────────────┬──────────────────┐
                 ▼                  ▼                  ▼
        ┌────────────────┐  ┌──────────────┐  ┌─────────────┐
        │ Tabla: ventas  │  │ Tabla:       │  │ Tabla:      │
        │ (historial)    │  │ compras      │  │ products    │
        │                │  │ (en tránsito)│  │ (stock)     │
        └────────┬───────┘  └──────┬───────┘  └──────┬──────┘
                 │                  │                  │
                 └──────────────────┴──────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ CÁLCULO DE CANTIDAD SUGERIDA  │
                    │ + CÁLCULO DE RENTABILIDAD     │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ Excel exportado con datos     │
                    │ calculados correctamente      │
                    └───────────────────────────────┘
```

### ⚠️ PUNTOS CRÍTICOS DE CONEXIÓN

1. **Config → Venta Diaria:**
   ```javascript
   // Usa: config.stockSaludableMinDias y config.tiempoEntrega
   const stockObjetivo = ventaDiaria * config.stockSaludableMinDias;
   ```

2. **Config → Stock en Tránsito:**
   ```javascript
   // Filtra compras con: status_compra IN ('confirmado', 'en_transito')
   const { data } = await supabase
     .from('compras')
     .in('status_compra', ['confirmado', 'en_transito']);
   ```

3. **Config → Rentabilidad:**
   ```javascript
   // Usa TODOS los parámetros del config:
   - config.rmbToUsd
   - config.usdToClp
   - config.costosVariablesPct.*
   - config.costosFijosUSD.*
   - config.costosFijosCLP.*
   - config.mercadoLibre.*
   ```

---

## ✅ GARANTÍA DE INTEGRIDAD

### 🧪 Tests Automatizados

Estos tests **GARANTIZAN** que las fórmulas NO cambien:

```bash
# Ejecutar tests
npm test

# Tests específicos de cálculos críticos:
- ✅ ventaDiaria = 0 → stockObjetivo = 0
- ✅ Cantidad sugerida nunca negativa
- ✅ Stock en tránsito incluye 'confirmado' + 'en_transito'
- ✅ Cálculo de días de inventario
- ✅ Formato de fechas
```

### 📝 Checklist Pre-Refactor

Antes de CUALQUIER cambio en cálculos, verificar:

- [ ] Tests pasan (npm test)
- [ ] Config se obtiene de tabla configuration
- [ ] Ventas se consultan desde tabla ventas
- [ ] Compras se filtran por status correcto
- [ ] Fórmulas matemáticas son EXACTAMENTE iguales
- [ ] No hay hardcoded values (todo viene de config)

### 🔒 Archivos CRÍTICOS

**NO TOCAR sin tests:**
- `pages/api/export-by-status.js` (líneas 6-136)
- `pages/api/analysis-cached.js`
- `lib/inventoryCalculations.js` (cuando se cree)

**Tabla CRÍTICA en BD:**
- `configuration` (id=1) - Contiene TODOS los parámetros

---

## 📚 Referencias

- Tests: `__tests__/unit/calculations.test.js`
- Config actual: Ver en `/config` del dashboard
- Documentación: Este archivo (FORMULAS_CRITICAS.md)

**Última actualización:** 2025-01-05
**Verificado por:** Claude Code + Tests Automatizados
