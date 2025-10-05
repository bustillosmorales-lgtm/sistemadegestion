# Tests Automatizados - Sistema de Gestión de Inventario

## 📋 Resumen

Este proyecto incluye tests automatizados para validar la lógica de negocio crítica y la integridad de datos.

**Resultados actuales:** ✅ **45 tests pasando** (2 suites)

## 🚀 Comandos de Testing

```bash
# Ejecutar todos los tests
npm test

# Ejecutar solo tests unitarios (rápidos, sin BD)
npm run test:unit

# Ejecutar solo tests de integración (requieren BD)
npm run test:integration

# Ejecutar en modo watch (re-ejecuta al guardar)
npm run test:watch

# Generar reporte de cobertura
npm run test:coverage
```

## 📁 Estructura de Tests

```
__tests__/
├── unit/
│   └── calculations.test.js       # Tests de lógica de negocio
└── integration/
    └── database.test.js            # Tests de integración con BD
```

## 🧪 Tests Unitarios (calculations.test.js)

### Cobertura de Lógica de Negocio

#### 1. Cálculo de Stock Objetivo y Cantidad Sugerida
- **REGLA CRÍTICA:** ventaDiaria = 0 → stockObjetivo = 0
- Cálculo correcto con venta diaria positiva
- Stock en tránsito reduce cantidad sugerida
- Stock suficiente: cantidad sugerida = 0
- Cantidad sugerida nunca es negativa
- Manejo de ventas diarias decimales

**Ejemplo de test crítico:**
```javascript
test('ventaDiaria = 0 debe resultar en stock objetivo = 0', () => {
  const product = { sku: 'TEST-001', stock_actual: 100 };
  const result = calcularCantidadSugerida(product, {}, config, 0);

  expect(result.stockObjetivo).toBe(0);
  expect(result.cantidadSugerida).toBe(0);
});
```

#### 2. Estados de Reposición
- **CRITICAL:** Sin órdenes activas
- **PARTIAL:** Orden parcial - necesita más
- **COVERED:** Completamente cubierto
- **OVER_ORDERED:** Sobre-ordenado

#### 3. Cálculo de Venta Diaria
- Cálculo correcto desde ventas históricas
- Manejo de productos sin ventas
- Formato de fechas (inicio/fin)
- Mínimo 1 día de periodo

#### 4. Validaciones
- Stock objetivo nunca negativo
- No división por cero
- Cantidades redondeadas a enteros

## 🔌 Tests de Integración (database.test.js)

### Verificaciones de Base de Datos

#### Tabla products
- ✅ Lectura de productos
- ✅ Productos con status NEEDS_REPLENISHMENT
- ✅ Stock actual no negativo

#### Tabla ventas
- ✅ Fechas válidas
- ✅ Cantidades positivas
- ✅ Query batch con IN funciona

#### Tabla compras
- ✅ Status 'en_transito' correcto
- ✅ Cantidades positivas

#### Vista Materializada sku_venta_diaria_mv
- ✅ Vista accesible
- ✅ Venta diaria no negativa
- ✅ Formato de fechas correcto

#### Tabla purchase_orders
- ✅ cantidad_solicitada >= cantidad_recibida
- ✅ Órdenes activas excluyen RECEIVED/CANCELLED

#### Performance
- ✅ Query batch de 500 SKUs < 10 segundos

## 📊 Casos de Uso Principales Testeados

### 1. Regla de Negocio Crítica
```javascript
// SI: venta_diaria = 0
// ENTONCES: stock_objetivo = 0 Y cantidad_sugerida = 0
```

Este test previene el bug donde productos sin ventas generaban órdenes de compra incorrectas.

### 2. Cálculo de Reposición
```javascript
stockObjetivo = ventaDiaria × stockSaludableMinDias
cantidadSugerida = stockObjetivo - (stockActual + stockEnTransito)
```

### 3. Venta Diaria desde Histórico
```javascript
ventaDiaria = totalUnidadesVendidas / díasDelPeriodo
díasDelPeriodo = Math.max(1, fechaFin - fechaInicio)
```

## 🎯 Cómo Agregar Nuevos Tests

### Test Unitario
```javascript
// __tests__/unit/calculations.test.js
test('descripción del caso a probar', () => {
  // Arrange - preparar datos
  const input = {...};

  // Act - ejecutar función
  const result = myFunction(input);

  // Assert - verificar resultado
  expect(result).toBe(expectedValue);
});
```

### Test de Integración
```javascript
// __tests__/integration/database.test.js
test('descripción del caso', async () => {
  const { data, error } = await supabase
    .from('tabla')
    .select('*')
    .limit(1);

  expect(error).toBeNull();
  expect(data).toBeDefined();
});
```

## ⚠️ Notas Importantes

### Variables de Entorno
Los tests de integración requieren `.env.local` con:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Si no están presentes, los tests de integración se omitirán automáticamente.

### Timeout
Los tests de integración tienen timeout de 30 segundos (configurado en jest.config.js).

### Tests No Destructivos
Todos los tests de integración son de **solo lectura**. No modifican la base de datos.

## 📈 Próximos Tests Recomendados

1. **Tests de API Endpoints**
   - `/api/export-by-status`
   - `/api/analysis-cached`

2. **Tests de Helpers**
   - `purchaseOrdersHelper.js`
   - Funciones de formato

3. **Tests de Edge Cases**
   - Productos con SKU especiales
   - Fechas en diferentes timezones
   - Números muy grandes/pequeños

4. **Tests de Performance**
   - Tiempo de cálculo para 5,000+ SKUs
   - Uso de memoria

## 🐛 Debugging Tests

### Ver output detallado
```bash
npx jest --verbose
```

### Ejecutar un solo archivo
```bash
npx jest __tests__/unit/calculations.test.js
```

### Ejecutar un solo test
```bash
npx jest -t "ventaDiaria = 0"
```

## 🚛 Regla de Stock en Tránsito

**Importante:** El stock en tránsito incluye **TODAS** las compras desde que se confirma la cotización hasta que llega el contenedor:

```javascript
// Status incluidos en stock en tránsito:
['confirmado', 'en_transito']

// Status NO incluidos (ya recibidos):
['recibido', 'llegado']
```

Esta regla se aplica en:
- `pages/api/export-by-status.js:307`
- `pages/api/analysis-cached.js:267`
- `pages/api/timeline.js:154`

## ✅ Checklist para Pull Requests

Antes de hacer merge, asegúrate de:
- [ ] Todos los tests pasan (`npm test`)
- [ ] No hay warnings en la consola
- [ ] Si modificaste lógica de negocio, agregaste test correspondiente
- [ ] Cobertura de código no disminuyó

## 📚 Documentación Adicional

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)

---

**Última actualización:** 2025-01-04
**Tests totales:** 45 (45 pasando)
**Tiempo de ejecución:** ~3-4 segundos
