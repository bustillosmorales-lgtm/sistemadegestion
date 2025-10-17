# Tests Adicionales Requeridos para el Sistema

## 📊 Estado Actual
- ✅ **85 tests pasando** (unitarios e integración)
- ✅ Cálculos críticos cubiertos
- ✅ Helpers y utilidades cubiertas
- ✅ Base de datos básica cubierta

## 🔴 Áreas sin cobertura de tests

### 1. **API Endpoints Críticos** (Alta prioridad)

#### `/api/bulk-upload` - Carga Masiva
**Estado**: Sin tests automatizados
**Prioridad**: 🔴 CRÍTICA
**Tests necesarios**:
- ✅ Ya validado manualmente: Productos inexistentes generan error
- ⚠️ Falta:
  - [ ] Carga masiva de productos válidos
  - [ ] Carga masiva de ventas con productos existentes
  - [ ] Carga masiva de compras con containers
  - [ ] Manejo de duplicados
  - [ ] Validación de formato Excel
  - [ ] Límites de tamaño (6MB)
  - [ ] Mapeo automático de columnas mal nombradas

#### `/api/export-by-status` - Exportación
**Estado**: Sin tests
**Prioridad**: 🟠 ALTA
**Tests necesarios**:
- [ ] Exportar productos "Necesita Reposición"
- [ ] Exportar productos "En Proceso"
- [ ] Exportar productos "Suficiente Stock"
- [ ] Cálculos correctos de cantidad sugerida
- [ ] Descomposición de packs en exportación
- [ ] Formato Excel correcto
- [ ] Columnas con nombres correctos

#### `/api/purchase-orders` - Órdenes de Compra
**Estado**: Solo tests de DB, no de API
**Prioridad**: 🟠 ALTA
**Tests necesarios**:
- [ ] Crear orden de compra
- [ ] Actualizar cantidad recibida
- [ ] Cambiar status de orden
- [ ] Validar que cantidad recibida <= cantidad solicitada
- [ ] Calcular correctamente stock en proceso
- [ ] Generar número de orden único

#### `/api/analysis-cached` - Análisis con Cache
**Estado**: Sin tests
**Prioridad**: 🟠 ALTA
**Tests necesarios**:
- [ ] Calcular correctamente venta diaria desde cache
- [ ] Calcular stock objetivo según configuración
- [ ] Calcular cantidad sugerida
- [ ] Manejar productos sin ventas históricas
- [ ] Considerar stock en tránsito
- [ ] Usar configuración dinámica

### 2. **Sistema de Packs** (Alta prioridad)

#### Tabla `packs`
**Estado**: Sin tests
**Prioridad**: 🟠 ALTA
**Tests necesarios**:
- [ ] Cargar packs desde Excel
- [ ] Validar que productos del pack existen
- [ ] Descomposición correcta en ventas
- [ ] Cálculo de venta diaria incluyendo packs
- [ ] Evitar doble conteo de ventas

#### `/api/ventas-descompuestas`
**Estado**: Sin tests
**Prioridad**: 🟠 ALTA
**Tests necesarios**:
- [ ] Ventas de packs se descomponen correctamente
- [ ] Multiplicadores de cantidad son correctos
- [ ] Productos individuales mantienen su cantidad
- [ ] No hay productos duplicados

### 3. **Configuración del Sistema** (Media prioridad)

#### `/api/config`
**Estado**: Solo test de lectura
**Prioridad**: 🟡 MEDIA
**Tests necesarios**:
- [ ] Actualizar configuración
- [ ] Validar rangos de valores (ej: días >= 0)
- [ ] Cambios se aplican inmediatamente
- [ ] Configuración por defecto si no existe

### 4. **Autenticación y Autorización** (Media prioridad)

#### `/api/auth`
**Estado**: Sin tests
**Prioridad**: 🟡 MEDIA
**Tests necesarios**:
- [ ] Login con credenciales válidas
- [ ] Login con credenciales inválidas
- [ ] Logout
- [ ] Sesiones expiran correctamente
- [ ] Roles de usuario funcionan (admin, chile, proveedor)

#### `/api/users`
**Estado**: Sin tests
**Prioridad**: 🟡 MEDIA
**Tests necesarios**:
- [ ] Crear usuario
- [ ] Actualizar usuario
- [ ] Cambiar contraseña
- [ ] Listar usuarios según rol
- [ ] No permitir acciones sin permisos

### 5. **Containers y Utilización** (Media prioridad)

#### `/api/containers`
**Estado**: Sin tests de API
**Prioridad**: 🟡 MEDIA
**Tests necesarios**:
- [ ] Crear container
- [ ] Actualizar fecha de llegada
- [ ] Calcular utilización de CBM
- [ ] Listar containers por status
- [ ] Containers con compras asociadas

#### `/api/containers-utilization`
**Estado**: Sin tests
**Prioridad**: 🟡 MEDIA
**Tests necesarios**:
- [ ] Calcular CBM usado correctamente
- [ ] Alertar si se excede capacidad
- [ ] Sumar CBM de productos en compras

### 6. **Integraciones Externas** (Baja prioridad)

#### `/api/sync/inventory`
**Estado**: Sin tests
**Prioridad**: 🟢 BAJA
**Tests necesarios**:
- [ ] Sincronizar con MercadoLibre (mock)
- [ ] Sincronizar con Defontana (mock)
- [ ] Manejar errores de API externa
- [ ] Actualizar stock en plataformas
- [ ] Validar que producto existe antes de importar

#### `/api/mercadolibre/*`
**Estado**: Sin tests
**Prioridad**: 🟢 BAJA
**Tests necesarios**:
- [ ] Autenticación OAuth
- [ ] Importar órdenes
- [ ] Sincronizar stock
- [ ] Manejar webhooks

### 7. **Cache y Performance** (Baja prioridad)

#### `/api/background-analyzer`
**Estado**: Sin tests
**Prioridad**: 🟢 BAJA
**Tests necesarios**:
- [ ] Cache se actualiza correctamente
- [ ] Procesa todos los productos
- [ ] Tiempo de procesamiento aceptable
- [ ] Maneja timeouts de Netlify

#### Vista Materializada `sku_venta_diaria_mv`
**Estado**: Tests básicos
**Prioridad**: 🟢 BAJA
**Tests necesarios**:
- [ ] Refresh funciona correctamente
- [ ] Datos coinciden con cálculos en código
- [ ] Índices mejoran performance

---

## 📝 Tests Prioritarios a Implementar AHORA

### Suite 1: Bulk Upload (CRÍTICO)
```javascript
describe('API /api/bulk-upload', () => {
  test('Rechaza productos inexistentes al cargar ventas');
  test('Carga productos válidos correctamente');
  test('Detecta y reporta duplicados');
  test('Mapea columnas mal nombradas');
  test('Rechaza archivos > 6MB');
});
```

### Suite 2: Export By Status (CRÍTICO)
```javascript
describe('API /api/export-by-status', () => {
  test('Exporta solo productos con cantidad sugerida > 0');
  test('Calcula correctamente cantidad sugerida');
  test('Incluye packs descompuestos');
  test('Formato Excel es válido');
});
```

### Suite 3: Purchase Orders (CRÍTICO)
```javascript
describe('API /api/purchase-orders', () => {
  test('Crea orden con datos válidos');
  test('Actualiza cantidad recibida');
  test('Valida cantidad recibida <= solicitada');
  test('Calcula stock en proceso');
});
```

### Suite 4: Sistema de Packs (CRÍTICO)
```javascript
describe('Sistema de Packs', () => {
  test('Carga packs desde Excel');
  test('Descompone ventas de packs');
  test('Calcula venta diaria con packs');
  test('No duplica conteo');
});
```

---

## 🎯 Roadmap de Tests

### Semana 1 (CRÍTICO)
- [ ] Tests de bulk-upload
- [ ] Tests de export-by-status
- [ ] Tests de purchase-orders

### Semana 2 (ALTO)
- [ ] Tests de sistema de packs
- [ ] Tests de analysis-cached
- [ ] Tests de configuración

### Semana 3 (MEDIO)
- [ ] Tests de autenticación
- [ ] Tests de containers
- [ ] Tests de usuarios

### Semana 4 (BAJO)
- [ ] Tests de integraciones externas
- [ ] Tests de cache y performance
- [ ] Tests de webhooks

---

## 📊 Objetivo de Cobertura

- **Actual**: ~30% (85 tests, principalmente unitarios)
- **Meta**: 70% (estimado 200+ tests)
- **Crítico**: Cubrir flujos principales de negocio primero

---

## 🔧 Herramientas Recomendadas

1. **Jest** - Ya instalado ✅
2. **Supertest** - Para tests de API endpoints
3. **MSW (Mock Service Worker)** - Para mockear APIs externas
4. **@testing-library/react** - Para tests de componentes (si aplica)

---

## 📈 Métricas de Éxito

- ✅ 100% de endpoints críticos con tests
- ✅ 90% de funciones de cálculo con tests
- ✅ 0 errores en producción por falta de validación
- ✅ Tiempo de CI/CD < 5 minutos
