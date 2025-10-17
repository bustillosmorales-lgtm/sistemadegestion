# 🗺️ Diagrama de Procesos del Sistema

## 📊 Vista General del Sistema

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          SISTEMA DE GESTIÓN DE INVENTARIO                 │
│                                                                           │
│   Objetivo: Optimizar decisiones de compra de productos importados       │
│   basadas en ventas históricas, stock y configuración dinámica          │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              ┌─────▼─────┐   ┌───────▼───────┐   ┌────▼────┐
              │  ENTRADA  │   │  PROCESAMIENTO │   │  SALIDA │
              │ DE DATOS  │   │   Y CÁLCULOS   │   │   Y     │
              │           │   │                │   │ ACCIONES│
              └───────────┘   └────────────────┘   └─────────┘
```

---

## 1️⃣ MÓDULO DE ENTRADA DE DATOS

### A. Carga Masiva de Productos (OBLIGATORIO PRIMERO)

```
┌─────────────────────────────────────────────────────────────┐
│                    CARGA DE PRODUCTOS                       │
└─────────────────────────────────────────────────────────────┘

Usuario Admin/Chile
       │
       ├─► Prepara Excel con columnas:
       │   • SKU (único, requerido)
       │   • Descripción
       │   • CBM
       │   • Costo FOB (RMB)
       │   • Precio Venta Sugerido
       │   • Link del producto
       │   • Categoría (opcional)
       │
       ▼
   Sube archivo a /api/bulk-upload
   (tableType: 'productos')
       │
       ├─► Validaciones:
       │   ✓ SKU no vacío
       │   ✓ SKU único (no duplicado)
       │   ✓ Descripción presente
       │   ✓ CBM > 0
       │   ✓ Costo FOB > 0
       │
       ├─► Procesamiento:
       │   • Mapeo automático de columnas mal nombradas
       │   • Normalización de SKUs (trim, sin comillas)
       │   • Batch insert/update de 100 en 100
       │
       ▼
   Resultado:
   ✅ Nuevos: X productos creados
   🔄 Actualizados: Y productos modificados
   ❌ Errores: Z productos rechazados
       │
       ▼
   Tabla 'products' poblada
   ✅ Sistema listo para recibir ventas/compras
```

### B. Carga de Packs (Opcional)

```
┌─────────────────────────────────────────────────────────────┐
│                    CARGA DE PACKS                           │
└─────────────────────────────────────────────────────────────┘

Usuario
       │
       ├─► Prepara Excel con columnas:
       │   • IDPack (ej: PACK0001)
       │   • IDProducto (SKU del componente)
       │   • Cantidad (unidades en el pack)
       │
       ▼
   Sube archivo a /api/bulk-upload
   (tableType: 'packs')
       │
       ├─► Validaciones:
       │   ✓ IDPack no vacío
       │   ✓ IDProducto EXISTE en 'products' ❌ Si no → ERROR
       │   ✓ Cantidad > 0
       │
       ├─► Ejemplo:
       │   PACK0001 | PROD-A | 2
       │   PACK0001 | PROD-B | 1
       │   → 1 venta de PACK0001 = 2 PROD-A + 1 PROD-B
       │
       ▼
   Tabla 'packs' poblada
   ✅ Packs listos para descomposición en ventas
```

### C. Carga de Ventas

```
┌─────────────────────────────────────────────────────────────┐
│                    CARGA DE VENTAS                          │
└─────────────────────────────────────────────────────────────┘

Usuario
       │
       ├─► Prepara Excel con columnas:
       │   • SKU
       │   • Cantidad
       │   • Fecha Venta
       │
       ▼
   Sube archivo a /api/bulk-upload
   (tableType: 'ventas')
       │
       ├─► VALIDACIÓN CRÍTICA:
       │   ┌──────────────────────────────────────┐
       │   │ SKU DEBE EXISTIR en 'products'       │
       │   │ Si NO existe → ❌ ERROR               │
       │   │ NO se crea automáticamente           │
       │   └──────────────────────────────────────┘
       │
       ├─► Verificar SKUs:
       │   • Consultar todos los SKUs únicos en 'products'
       │   • Filtrar solo ventas con SKUs válidos
       │   • Reportar SKUs inválidos como errores
       │
       ├─► Filtrar duplicados:
       │   • Buscar ventas existentes por (sku, fecha_venta)
       │   • Omitir duplicados
       │
       ▼
   INSERT en 'ventas' (solo válidas)
       │
       ▼
   Resultado:
   ✅ Nuevos: X ventas insertadas
   🔄 Duplicados: Y ventas omitidas
   ❌ Errores: Z ventas rechazadas (productos inexistentes)
```

### D. Carga de Compras

```
┌─────────────────────────────────────────────────────────────┐
│                    CARGA DE COMPRAS                         │
└─────────────────────────────────────────────────────────────┘

Usuario
       │
       ├─► Prepara Excel con columnas:
       │   • SKU
       │   • Cantidad
       │   • Fecha Compra
       │   • Container Number (opcional)
       │   • Status: en_transito, llegado, etc.
       │   • CBM (opcional)
       │
       ▼
   Sube archivo a /api/bulk-upload
   (tableType: 'compras')
       │
       ├─► VALIDACIÓN CRÍTICA:
       │   ✓ SKU DEBE EXISTIR en 'products' ❌ Si no → ERROR
       │   ✓ Cantidad > 0
       │
       ├─► Auto-crear Containers:
       │   SI container_number no existe:
       │      CREATE container automáticamente
       │      status = 'CREATED' o 'DELIVERED' según llegada
       │
       ▼
   INSERT en 'compras'
       │
       ▼
   Stock en tránsito actualizado
   ✅ Compras registradas
```

---

## 2️⃣ MÓDULO DE PROCESAMIENTO Y CÁLCULOS

### A. Cálculo de Venta Diaria (Automático)

```
┌─────────────────────────────────────────────────────────────┐
│          CÁLCULO DE VENTA DIARIA CON PACKS                  │
└─────────────────────────────────────────────────────────────┘

Trigger: Diario (cron) o Manual (/api/refresh-materialized-view)
       │
       ▼
   PASO 1: Determinar Período de Análisis
       │
       ├─► Fecha INICIO:
       │   1. Última compra llegada hace ≥30 días
       │   2. O primera venta registrada
       │   3. O hace 90 días (fallback)
       │
       ├─► Fecha FIN:
       │   1. Si stock_actual = 0 → last_stockout_date
       │   2. Si stock_actual > 0 → HOY
       │
       ▼
   PASO 2: Descomponer Ventas de Packs
       │
       ├─► Para cada venta:
       │   • SI es venta de pack (existe en tabla 'packs'):
       │       ┌─────────────────────────────────────┐
       │       │ Venta: 1x PACK0001                  │
       │       │ Pack contiene: 2x PROD-A, 1x PROD-B │
       │       │ Descomponer en:                     │
       │       │   - 2 ventas de PROD-A              │
       │       │   - 1 venta de PROD-B               │
       │       └─────────────────────────────────────┘
       │   • SI es venta individual:
       │       Mantener cantidad original
       │
       ▼
   PASO 3: Sumar Ventas en Período
       │
       ├─► total_vendido = SUM(cantidad_descompuesta)
       │                   WHERE fecha BETWEEN inicio AND fin
       │
       ▼
   PASO 4: Calcular Venta Diaria
       │
       ├─► dias_periodo = fecha_fin - fecha_inicio
       │   venta_diaria = total_vendido / MAX(dias_periodo, 1)
       │
       ├─► calculo_confiable = (total_vendido > 0 AND dias_periodo >= 30)
       │
       ▼
   INSERT/UPDATE en 'sku_venta_diaria_mv'
       │
       ▼
   ✅ Venta diaria calculada para todos los SKUs
```

### B. Análisis de Dashboard (Cantidad Sugerida)

```
┌─────────────────────────────────────────────────────────────┐
│           CÁLCULO DE CANTIDAD SUGERIDA                      │
└─────────────────────────────────────────────────────────────┘

Trigger: Usuario ve Dashboard o Exporta datos
       │
       ▼
   Para CADA producto:
       │
   ┌───▼────────────────────────────────────────────────┐
   │ PASO 1: Obtener Venta Diaria                       │
   │   • Desde 'sku_venta_diaria_mv'                    │
   │   • O calcular en tiempo real si no hay cache      │
   └────────────────────────────────────────────────────┘
       │
   ┌───▼────────────────────────────────────────────────┐
   │ PASO 2: Obtener Configuración                      │
   │   • stockSaludableMinDias (30-90 días)             │
   │   • tiempoEntrega (ej: 60 días)                    │
   │   • tiempoPromedioFabricacion (ej: 30 días)        │
   └────────────────────────────────────────────────────┘
       │
   ┌───▼────────────────────────────────────────────────┐
   │ PASO 3: Calcular Stock Objetivo                    │
   │                                                     │
   │   stock_objetivo = venta_diaria × stockSaludableDias│
   │                                                     │
   │   Ejemplo:                                          │
   │   venta_diaria = 2.5 unidades/día                   │
   │   stockSaludableDias = 60 días                      │
   │   stock_objetivo = 2.5 × 60 = 150 unidades          │
   └────────────────────────────────────────────────────┘
       │
   ┌───▼────────────────────────────────────────────────┐
   │ PASO 4: Calcular Stock en Tránsito                 │
   │                                                     │
   │   stock_transito = SUM(compras.cantidad)            │
   │   WHERE status IN ('en_transito', 'confirmado')     │
   │                                                     │
   │   Incluye: compras aún no llegadas                  │
   └────────────────────────────────────────────────────┘
       │
   ┌───▼────────────────────────────────────────────────┐
   │ PASO 5: Calcular Lead Time y Consumo               │
   │                                                     │
   │   lead_time_dias = tiempoEntrega + tiempoFabricacion│
   │                  = 60 + 30 = 90 días                │
   │                                                     │
   │   consumo_lead_time = venta_diaria × lead_time_dias│
   │                     = 2.5 × 90 = 225 unidades       │
   │                                                     │
   │   (Cuánto se venderá mientras llega el pedido)     │
   └────────────────────────────────────────────────────┘
       │
   ┌───▼────────────────────────────────────────────────┐
   │ PASO 6: Proyectar Stock al Llegar Pedido           │
   │                                                     │
   │   stock_proyectado = stock_actual                   │
   │                    + stock_transito                 │
   │                    - consumo_lead_time              │
   │                                                     │
   │   Ejemplo:                                          │
   │   stock_actual = 50                                 │
   │   stock_transito = 100                              │
   │   consumo_lead_time = 225                           │
   │   stock_proyectado = 50 + 100 - 225 = -75          │
   │                      (¡Nos quedaremos sin stock!)   │
   └────────────────────────────────────────────────────┘
       │
   ┌───▼────────────────────────────────────────────────┐
   │ PASO 7: Calcular Cantidad Sugerida                 │
   │                                                     │
   │   SI stock_proyectado < 0:                          │
   │      cantidad_sugerida = stock_objetivo             │
   │      (Necesitamos stock objetivo completo)          │
   │                                                     │
   │   SI NO:                                            │
   │      cantidad_sugerida = stock_objetivo             │
   │                        - stock_proyectado           │
   │      cantidad_sugerida = MAX(0, cantidad_sugerida)  │
   │                                                     │
   │   Ejemplo (caso crítico):                           │
   │   stock_proyectado = -75                            │
   │   cantidad_sugerida = 150 (stock objetivo)          │
   └────────────────────────────────────────────────────┘
       │
   ┌───▼────────────────────────────────────────────────┐
   │ PASO 8: Calcular Impacto Económico                 │
   │                                                     │
   │   valor_total = cantidad_sugerida × precio_venta    │
   │                                                     │
   │   Prioridad:                                        │
   │   • CRÍTICA: valor_total > $500,000                 │
   │   • ALTA:    valor_total > $200,000                 │
   │   • MEDIA:   valor_total > $100,000                 │
   │   • BAJA:    valor_total <= $100,000                │
   └────────────────────────────────────────────────────┘
       │
       ▼
   Guardar en 'dashboard_analysis_cache'
       │
       ▼
   ✅ Dashboard actualizado con recomendaciones
```

---

## 3️⃣ MÓDULO DE SALIDA Y ACCIONES

### A. Exportación de Datos

```
┌─────────────────────────────────────────────────────────────┐
│              EXPORTAR "NECESITA REPOSICIÓN"                 │
└─────────────────────────────────────────────────────────────┘

Usuario → Click "Exportar Necesita Reposición"
       │
       ▼
   /api/export-by-status?status=NEEDS_REPLENISHMENT
       │
       ├─► Filtrar productos:
       │   • cantidad_sugerida > 0
       │   • NOT desconsiderado
       │   • Ordenar por prioridad DESC (valor total)
       │
       ├─► Calcular para cada producto:
       │   • Venta diaria (con packs descompuestos)
       │   • Stock actual, en tránsito
       │   • Cantidad sugerida
       │   • CBM total = cantidad_sugerida × cbm
       │   • Precio total = cantidad_sugerida × precio
       │   • Rentabilidad estimada
       │
       ▼
   Generar Excel:
   ┌──────────────────────────────────────────────────┐
   │ SKU | Descripción | Venta Diaria | Stock Actual │
   │ En Tránsito | Cantidad Sugerida | CBM Total    │
   │ Precio Unit | Total | Rentabilidad | Link       │
   └──────────────────────────────────────────────────┘
       │
       ▼
   ✅ Archivo descargado
   Usuario puede revisar y decidir qué comprar
```

### B. Creación de Orden de Compra

```
┌─────────────────────────────────────────────────────────────┐
│              CREAR ORDEN DE COMPRA                          │
└─────────────────────────────────────────────────────────────┘

Usuario → Selecciona productos desde Dashboard
       │
       ├─► Revisa cantidades sugeridas
       ├─► Ajusta cantidades si es necesario
       ├─► Agrega proveedor, notas
       │
       ▼
   /api/purchase-orders (POST)
       │
       ├─► Generar número de orden:
       │   ORD-20251016-12345
       │   (ORD-YYYYMMDD-XXXXX aleatorio)
       │
       ├─► Para cada SKU seleccionado:
       │   INSERT INTO purchase_orders:
       │   • order_number
       │   • sku
       │   • cantidad_solicitada
       │   • cantidad_recibida = 0
       │   • status = 'PENDING'
       │   • proveedor, notas
       │   • created_at
       │
       ▼
   UPDATE products:
   • status = 'IN_PROCESS'
   • has_active_orders = true
   • total_cantidad_en_proceso += cantidad_solicitada
       │
       ▼
   ✅ Orden creada
   ✉️ Puede enviar orden al proveedor
```

### C. Recepción de Mercadería

```
┌─────────────────────────────────────────────────────────────┐
│              RECIBIR MERCADERÍA                             │
└─────────────────────────────────────────────────────────────┘

Container llega a bodega
       │
   ┌───▼────────────────────────────────────────────┐
   │ PASO 1: Actualizar Container                   │
   │   /api/containers (PUT)                        │
   │   • fecha_efectiva_llegada = HOY               │
   │   • status = 'DELIVERED'                       │
   └────────────────────────────────────────────────┘
       │
   ┌───▼────────────────────────────────────────────┐
   │ PASO 2: Actualizar Compras del Container       │
   │   UPDATE compras                                │
   │   WHERE container_number = XXX                  │
   │   SET:                                          │
   │     • status_compra = 'llegado'                │
   │     • fecha_llegada_real = HOY                  │
   └────────────────────────────────────────────────┘
       │
   ┌───▼────────────────────────────────────────────┐
   │ PASO 3: Actualizar Stock de Productos          │
   │   Para cada compra en el container:            │
   │   UPDATE products                               │
   │   SET stock_actual += cantidad                  │
   │   WHERE sku = compra.sku                        │
   └────────────────────────────────────────────────┘
       │
   ┌───▼────────────────────────────────────────────┐
   │ PASO 4: Actualizar Órdenes de Compra           │
   │   /api/purchase-orders (PUT)                   │
   │   • cantidad_recibida += cantidad              │
   │   • SI cantidad_recibida = cantidad_solicitada: │
   │       status = 'RECEIVED'                       │
   └────────────────────────────────────────────────┘
       │
       ▼
   ✅ Stock actualizado
   📊 Dashboard refleja nuevo stock
   🔄 Cantidad sugerida recalculada
```

---

## 4️⃣ CICLO CONTINUO

```
┌─────────────────────────────────────────────────────────────┐
│                    CICLO OPERATIVO                          │
└─────────────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────┐
   │ 1. MONITOREO DIARIO                        │
   │    • Refresh vista materializada (venta    │
   │      diaria)                                │
   │    • Limpiar cache expirado                │
   │    • Recalcular dashboard                   │
   └────────────────────────────────────────────┘
                      │
                      ▼
   ┌────────────────────────────────────────────┐
   │ 2. REVISIÓN SEMANAL                        │
   │    • Exportar "Necesita Reposición"        │
   │    • Analizar prioridades                   │
   │    • Revisar productos en proceso          │
   └────────────────────────────────────────────┘
                      │
                      ▼
   ┌────────────────────────────────────────────┐
   │ 3. DECISIÓN DE COMPRA                      │
   │    • Crear órdenes según prioridad         │
   │    • Optimizar containers                   │
   │    • Enviar órdenes a proveedores          │
   └────────────────────────────────────────────┘
                      │
                      ▼
   ┌────────────────────────────────────────────┐
   │ 4. SEGUIMIENTO                             │
   │    • Rastrear containers en tránsito       │
   │    • Actualizar fechas estimadas            │
   │    • Alertas de llegada próxima            │
   └────────────────────────────────────────────┘
                      │
                      ▼
   ┌────────────────────────────────────────────┐
   │ 5. RECEPCIÓN                               │
   │    • Registrar llegada de containers       │
   │    • Actualizar stock                       │
   │    • Cerrar órdenes completadas            │
   └────────────────────────────────────────────┘
                      │
                      ▼
           ┌─────────┴─────────┐
           │   REPETIR CICLO   │
           └───────────────────┘
```

---

## 🔑 Puntos Clave del Sistema

### ✅ Flujo Correcto
1. **Productos primero** → Luego ventas/compras
2. **Validación estricta** → No crear datos automáticamente
3. **Descomposición de packs** → Cálculo preciso de venta diaria
4. **Proyección inteligente** → Considera lead time y consumo
5. **Priorización económica** → Enfoque en productos críticos

### ⚠️ Errores Comunes a Evitar
1. ❌ Cargar ventas antes que productos
2. ❌ No considerar packs en cálculos
3. ❌ Ignorar stock en tránsito
4. ❌ No actualizar configuración según realidad
5. ❌ No validar capacidad de containers

### 📊 Métricas de Éxito
- **Tasa de quiebre de stock < 5%**
- **Utilización de containers > 85%**
- **Precisión de pronóstico > 80%**
- **ROI de inventario > 20%**

---

Este diagrama representa el flujo operativo completo del sistema actualizado al 16/10/2025.
