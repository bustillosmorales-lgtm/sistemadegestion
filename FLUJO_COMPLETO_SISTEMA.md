# 📋 Flujo Completo del Sistema de Gestión de Inventario

## 🎯 Objetivo del Sistema
Sistema para gestionar inventario de productos importados, optimizando decisiones de compra basadas en:
- Ventas históricas
- Stock actual y en tránsito
- Configuración de días de stock saludable
- Tiempo de lead time (fabricación + envío)
- Rentabilidad por producto

---

## 🔄 Flujo Principal del Sistema

### 1️⃣ CARGA DE DATOS INICIAL

#### 1.1 Carga de Productos (OBLIGATORIO - PRIMERO)
```
Usuario (Admin/Chile) → Subir Excel de Productos
   ↓
/api/bulk-upload (tableType: 'productos')
   ↓
Validaciones:
   - SKU único requerido
   - Descripción, CBM, Costo FOB
   - Status inicial: NEEDS_REPLENISHMENT
   ↓
INSERT/UPDATE en tabla 'products'
   ↓
✅ Productos disponibles en el sistema
```

**Importante**: Los productos DEBEN existir antes de cargar ventas/compras.

#### 1.2 Carga de Packs (Opcional)
```
Usuario → Subir Excel de Packs
   ↓
/api/bulk-upload (tableType: 'packs')
   ↓
Validaciones:
   - IDPack, IDProducto, Cantidad
   - Productos del pack DEBEN existir en 'products'
   ↓
INSERT en tabla 'packs'
   ↓
✅ Packs registrados para descomposición en ventas
```

#### 1.3 Carga de Ventas Históricas
```
Usuario → Subir Excel de Ventas
   ↓
/api/bulk-upload (tableType: 'ventas')
   ↓
Validaciones:
   - SKU debe existir en 'products' ❌ Si no existe → ERROR
   - Cantidad > 0
   - Fecha válida
   ↓
Verificar productos existentes (NO crear automáticamente)
   ↓
Filtrar solo ventas con productos válidos
   ↓
INSERT en tabla 'ventas'
   ↓
✅ Historial de ventas registrado
```

**Cambio reciente**: Ya NO se crean productos automáticamente al cargar ventas.

#### 1.4 Carga de Compras
```
Usuario → Subir Excel de Compras
   ↓
/api/bulk-upload (tableType: 'compras')
   ↓
Validaciones:
   - SKU debe existir en 'products' ❌ Si no existe → ERROR
   - Cantidad > 0
   - Status: en_transito, llegado, etc.
   - Container number (opcional)
   ↓
Verificar productos existentes
   ↓
Crear containers faltantes automáticamente
   ↓
INSERT en tabla 'compras'
   ↓
✅ Compras registradas con stock en tránsito
```

#### 1.5 Carga de Containers (Opcional)
```
Usuario → Subir Excel de Containers
   ↓
/api/bulk-upload (tableType: 'containers')
   ↓
Datos:
   - Container Number
   - Fechas estimadas/reales
   - Capacidad CBM
   - Status: CREATED, IN_TRANSIT, DELIVERED
   ↓
INSERT en tabla 'containers'
   ↓
✅ Containers registrados
```

---

### 2️⃣ CONFIGURACIÓN DEL SISTEMA

```
Usuario Admin → Ir a Configuración
   ↓
/api/config (GET) - Obtener configuración actual
   ↓
Modificar parámetros:
   - stockSaludableMinDias: 30-90 días
   - tiempoEntrega: días de envío
   - tiempoPromedioFabricacion: días de fabricación
   - tasaCambioUSD, tasaCambioRMB
   - comisionML, envioML, etc.
   ↓
/api/config (POST/PUT) - Guardar cambios
   ↓
UPDATE tabla 'configuration'
   ↓
✅ Configuración actualizada
   ↓
Afecta todos los cálculos subsecuentes
```

---

### 3️⃣ ANÁLISIS Y CÁLCULOS AUTOMÁTICOS

#### 3.1 Cálculo de Venta Diaria
```
Proceso Automático (Diario o Manual)
   ↓
/api/refresh-materialized-view
   ↓
Vista Materializada: sku_venta_diaria_mv
   ↓
Lógica:
   1. Buscar fecha inicio:
      - Última compra llegada hace ≥30 días
      - O primera venta
      - O hace 90 días (default)

   2. Buscar fecha fin:
      - Si stock = 0 → fecha de quiebre
      - Si stock > 0 → HOY

   3. Descomposición de packs:
      - Ventas de packs se multiplican por cantidad en pack
      - Ej: 1 venta de PACK0001 = 2 ventas de PROD-A

   4. Calcular:
      - dias_periodo = fecha_fin - fecha_inicio
      - total_vendido = SUM(cantidad) en período
      - venta_diaria = total_vendido / dias_periodo
      - calculo_confiable = (total_vendido > 0 AND dias_periodo >= 30)
   ↓
✅ Venta diaria calculada por SKU
```

#### 3.2 Análisis de Dashboard
```
Usuario → Ver Dashboard
   ↓
/api/analysis-cached (o /api/background-analyzer)
   ↓
Para cada producto:
   1. Obtener venta_diaria desde cache/MV

   2. Stock Objetivo:
      stock_objetivo = venta_diaria × stockSaludableMinDias

   3. Stock en Tránsito:
      SUM(compras.cantidad WHERE status IN ('en_transito', 'confirmado'))

   4. Lead Time:
      lead_time_dias = tiempoEntrega + tiempoFabricacion

   5. Consumo Durante Lead Time:
      consumo_lead_time = venta_diaria × lead_time_dias

   6. Stock Proyectado a Llegada:
      stock_proyectado = stock_actual + stock_transito - consumo_lead_time

   7. Cantidad Sugerida:
      SI stock_proyectado < 0:
         cantidad_sugerida = stock_objetivo
      SINO:
         cantidad_sugerida = MAX(0, stock_objetivo - stock_proyectado)

   8. Impacto Económico:
      valor_total = cantidad_sugerida × precio_venta_sugerido
      prioridad = (CRÍTICA > 500k, ALTA > 200k, MEDIA > 100k, BAJA)
   ↓
Guardar en 'dashboard_analysis_cache'
   ↓
✅ Dashboard actualizado con recomendaciones
```

---

### 4️⃣ EXPORTACIÓN Y TOMA DE DECISIONES

#### 4.1 Exportar "Necesita Reposición"
```
Usuario → Exportar → Necesita Reposición
   ↓
/api/export-by-status?status=NEEDS_REPLENISHMENT
   ↓
Filtros:
   - cantidad_sugerida > 0
   - NOT desconsiderado
   - Ordenar por prioridad (valor_total DESC)
   ↓
Calcular para cada producto:
   - Venta diaria (incluye packs descompuestos)
   - Cantidad sugerida
   - Precio estimado
   - CBM total
   - Rentabilidad estimada
   ↓
Generar Excel con columnas:
   - SKU, Descripción
   - Venta Diaria
   - Stock Actual, En Tránsito
   - Cantidad Sugerida
   - CBM Total
   - Precio Unitario, Total
   - Rentabilidad
   - Link del producto
   ↓
✅ Archivo Excel descargado
```

#### 4.2 Exportar "En Proceso"
```
Usuario → Exportar → En Proceso
   ↓
/api/export-by-status?status=IN_PROCESS
   ↓
Productos con órdenes de compra activas
   ↓
Mostrar:
   - Cantidad en proceso
   - Cantidad pendiente (sugerida - en proceso)
   - Status de replenishment: CRITICAL, PARTIAL, COVERED, OVER_ORDERED
   ↓
✅ Archivo Excel con productos en proceso
```

#### 4.3 Exportar "Suficiente Stock"
```
Usuario → Exportar → Suficiente Stock
   ↓
/api/export-by-status?status=SUFFICIENT_STOCK
   ↓
Productos donde:
   - stock_proyectado >= stock_objetivo
   - cantidad_sugerida = 0
   ↓
✅ Archivo Excel con productos OK
```

---

### 5️⃣ PROCESO DE COMPRA

#### 5.1 Crear Orden de Compra
```
Usuario → Crear Orden desde Dashboard
   ↓
/api/purchase-orders (POST)
   ↓
Datos:
   - SKUs seleccionados
   - Cantidades solicitadas
   - Proveedor (opcional)
   - Notas
   ↓
Generar número de orden: ORD-YYYYMMDD-XXXXX
   ↓
INSERT en tabla 'purchase_orders'
   - order_number
   - sku
   - cantidad_solicitada
   - cantidad_recibida = 0
   - status = 'PENDING'
   - created_at
   ↓
✅ Orden de compra creada
   ↓
Producto pasa a status: IN_PROCESS
```

#### 5.2 Actualizar Cantidad Recibida
```
Usuario → Actualizar Orden
   ↓
/api/purchase-orders (PUT)
   ↓
Validaciones:
   - cantidad_recibida <= cantidad_solicitada
   ↓
UPDATE 'purchase_orders'
   ↓
SI cantidad_recibida = cantidad_solicitada:
   status = 'RECEIVED'
   ↓
UPDATE 'products' SET stock_actual += cantidad_recibida
   ↓
✅ Stock actualizado
```

---

### 6️⃣ GESTIÓN DE CONTAINERS

#### 6.1 Ver Utilización de Container
```
Usuario → Ver Containers
   ↓
/api/containers-utilization?container_number=XXX
   ↓
Calcular:
   1. Obtener compras en el container
   2. SUM(compras.cantidad × products.cbm)
   3. cbm_usado / container.max_cbm × 100 = % utilización
   ↓
Alertas:
   - 🟢 < 80%: OK
   - 🟡 80-100%: Cerca del límite
   - 🔴 > 100%: SOBRE CAPACIDAD
   ↓
✅ Reporte de utilización
```

#### 6.2 Actualizar Fecha de Llegada
```
Container llega a bodega
   ↓
Usuario → Actualizar Container
   ↓
/api/containers (PUT)
   ↓
SET:
   - fecha_efectiva_llegada = HOY
   - status = 'DELIVERED'
   ↓
UPDATE todas las compras del container:
   - status_compra = 'llegado'
   - fecha_llegada_real = HOY
   ↓
UPDATE productos:
   - stock_actual += cantidad de la compra
   ↓
✅ Stock actualizado, container cerrado
```

---

### 7️⃣ INTEGRACIONES EXTERNAS (Opcional)

#### 7.1 MercadoLibre
```
Usuario → Configurar ML
   ↓
/api/mercadolibre/auth → OAuth
   ↓
/api/mercadolibre/sync-all
   ↓
Para cada producto en ML:
   1. Verificar SKU existe en 'products'
   2. SI NO existe → ⚠️ Advertencia, OMITIR
   3. SI existe → UPDATE stock_actual
   ↓
/api/mercadolibre/sync-orders
   ↓
Importar órdenes de ML como ventas
   ↓
✅ Sincronización completa
```

#### 7.2 Defontana
```
Similar a ML, sincroniza stock y órdenes
```

---

### 8️⃣ MANTENIMIENTO Y CACHE

#### 8.1 Limpieza de Cache
```
Automático (Diario) o Manual
   ↓
/api/refresh-system
   ↓
1. Limpiar cache expirado (dashboard_analysis_cache)
2. Limpiar cache de precios (sku_analysis_cache)
3. Refresh vista materializada (sku_venta_diaria_mv)
4. Recalcular análisis de dashboard
   ↓
✅ Sistema optimizado
```

#### 8.2 Diagnóstico del Sistema
```
Usuario Admin → Ver Diagnóstico
   ↓
/api/diagnostics
   ↓
Verificar:
   - Tablas accesibles
   - Vistas materializadas actualizadas
   - Cache funcionando
   - Configuración válida
   - Performance de queries
   ↓
✅ Reporte de salud del sistema
```

---

## 🔐 Control de Acceso por Rol

### Admin
- ✅ Acceso completo a todo
- ✅ Configuración del sistema
- ✅ Gestión de usuarios
- ✅ Purgar datos

### Chile
- ✅ Carga masiva de datos
- ✅ Ver dashboard
- ✅ Exportar datos
- ✅ Crear órdenes de compra
- ❌ NO puede cambiar configuración

### Proveedor
- ✅ Ver solo productos asignados
- ✅ Ver órdenes de compra propias
- ❌ NO puede ver todo el inventario
- ❌ NO puede cargar datos

---

## 📊 Flujo Visual Simplificado

```
┌─────────────────────────────────────────────────────────────┐
│                  INICIO - CARGA DE DATOS                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    1. Cargar PRODUCTOS ✅
                              ↓
                    2. Cargar PACKS (opcional)
                              ↓
                    3. Cargar VENTAS
                              ↓
                    4. Cargar COMPRAS
                              ↓
                    5. Configurar SISTEMA
                              ↓
┌─────────────────────────────────────────────────────────────┐
│               PROCESAMIENTO AUTOMÁTICO                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
              Calcular Venta Diaria (con packs)
                              ↓
              Calcular Cantidad Sugerida
                              ↓
              Calcular Impacto Económico
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  TOMA DE DECISIONES                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
              Ver Dashboard → Exportar
                              ↓
              Crear Órdenes de Compra
                              ↓
              Gestionar Containers
                              ↓
              Recibir Mercadería
                              ↓
              Actualizar Stock
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    CICLO CONTINUO                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Puntos Críticos del Sistema

### ✅ Funcionando Correctamente
1. Cálculos de cantidad sugerida
2. Sistema de packs y descomposición
3. Validación de productos existentes
4. Exportación de datos
5. Cache de análisis

### ⚠️ Áreas de Atención
1. Vista materializada puede tener estructura diferente en diferentes DBs
2. Integraciones externas requieren validación constante
3. Timeouts en Netlify para procesamiento masivo

### 🔴 Reglas de Negocio Críticas
1. **NUNCA crear productos automáticamente** - Solo desde carga masiva
2. **SIEMPRE verificar SKU existe** antes de cargar ventas/compras
3. **Venta diaria = 0** si no hay suficientes datos (< 30 días)
4. **Cantidad sugerida >= 0** siempre
5. **Cantidad recibida <= solicitada** en órdenes

---

## 📈 KPIs del Sistema

1. **Productos con reposición requerida**: COUNT(cantidad_sugerida > 0)
2. **Valor total de compras sugeridas**: SUM(cantidad_sugerida × precio)
3. **Productos en proceso**: COUNT(status = IN_PROCESS)
4. **Tasa de acierto**: % de productos que no se quedan sin stock
5. **Utilización promedio de containers**: AVG(cbm_usado / max_cbm)

---

Este documento representa el flujo completo y actualizado del sistema al 16 de octubre de 2025.
