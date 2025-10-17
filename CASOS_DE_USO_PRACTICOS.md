# 📚 Casos de Uso Prácticos - Sistema de Gestión de Inventario

## 🎯 Guía Paso a Paso para Usuarios

---

## 📖 Tabla de Contenidos

1. [Caso 1: Primer Uso del Sistema](#caso-1-primer-uso-del-sistema)
2. [Caso 2: Carga Semanal de Ventas](#caso-2-carga-semanal-de-ventas)
3. [Caso 3: Creación de Purchase Order](#caso-3-creación-de-purchase-order)
4. [Caso 4: Gestión de Packs](#caso-4-gestión-de-packs)
5. [Caso 5: Recepción de Mercadería](#caso-5-recepción-de-mercadería)
6. [Caso 6: Análisis de Rentabilidad](#caso-6-análisis-de-rentabilidad)
7. [Caso 7: Optimización de Containers](#caso-7-optimización-de-containers)
8. [Caso 8: Resolución de Problemas Comunes](#caso-8-resolución-de-problemas-comunes)

---

## Caso 1: Primer Uso del Sistema

### 🎬 Escenario
Acabas de implementar el sistema y necesitas cargar todo tu inventario inicial.

### 📋 Pasos Detallados

#### Paso 1: Preparar Excel de Productos

**Archivo:** `productos_inicial.xlsx`

| sku | descripcion | cbm | costo_fob_rmb | stock_actual | precio_venta_ml | proveedor |
|-----|-------------|-----|---------------|--------------|-----------------|-----------|
| LAMP-LED-10W | Lámpara LED 10W Blanca | 0.08 | 45 | 150 | 12990 | Shenzhen Lighting |
| TABLE-AUX-01 | Mesa Auxiliar Moderna | 0.15 | 120 | 50 | 29990 | Guangzhou Furniture |
| CUSHION-VEL-01 | Cojín Terciopelo 45x45 | 0.02 | 15 | 200 | 5990 | Hangzhou Textiles |

**✅ Validaciones antes de cargar:**
- [ ] Todos los SKUs son únicos
- [ ] Todos los CBM son > 0
- [ ] Todos los costos son > 0
- [ ] No hay celdas vacías en campos obligatorios

#### Paso 2: Cargar a través de la interfaz

```
1. Ir a: http://localhost:3000/bulk-upload
2. Seleccionar pestaña "Productos"
3. Elegir archivo: productos_inicial.xlsx
4. Click en "Cargar"
5. Esperar confirmación
```

**📊 Resultado esperado:**
```
✅ Productos cargados exitosamente: 3
✅ SKUs creados: LAMP-LED-10W, TABLE-AUX-01, CUSHION-VEL-01
⏱️ Tiempo de procesamiento: 0.5s
```

#### Paso 3: Cargar Historial de Ventas (últimos 90 días)

**Archivo:** `ventas_historico_90dias.xlsx`

| sku | cantidad | fecha_venta |
|-----|----------|-------------|
| LAMP-LED-10W | 3 | 2024-10-17 |
| LAMP-LED-10W | 5 | 2024-10-18 |
| TABLE-AUX-01 | 1 | 2024-10-18 |
| CUSHION-VEL-01 | 8 | 2024-10-19 |
| LAMP-LED-10W | 2 | 2024-10-19 |

**⚠️ Importante:** Asegúrate de que el período sea >= 30 días para cálculos confiables.

#### Paso 4: Verificar que se calculó venta diaria

```
1. Ir a: http://localhost:3000/analysis
2. Buscar productos cargados
3. Verificar columna "Venta Diaria"
```

**Ejemplo de lo que deberías ver:**

| SKU | Venta Diaria | Días Período | Total Vendido |
|-----|--------------|--------------|---------------|
| LAMP-LED-10W | 3.5 | 90 | 315 |
| TABLE-AUX-01 | 0.8 | 90 | 72 |
| CUSHION-VEL-01 | 2.1 | 90 | 189 |

---

## Caso 2: Carga Semanal de Ventas

### 🎬 Escenario
Cada semana descargas las ventas de MercadoLibre y necesitas actualizar el sistema.

### 📋 Pasos Detallados

#### Paso 1: Exportar ventas de MercadoLibre

```
1. Ir a Seller Center → Ventas → Exportar
2. Rango: Última semana (07/01/2025 - 13/01/2025)
3. Formato: Excel
4. Descargar
```

#### Paso 2: Transformar el archivo

**Archivo de ML:** `ventas_ml_semana2.xlsx`

| Título | SKU | Cantidad | Fecha |
|--------|-----|----------|-------|
| Lámpara LED 10W Blanca | LAMP-LED-10W | 2 | 07/01/2025 |
| Pack Living Room Set | SET-LIVING-01 | 1 | 08/01/2025 |

**Necesitas transformar a formato del sistema:**

| sku | cantidad | fecha_venta |
|-----|----------|-------------|
| LAMP-LED-10W | 2 | 2025-01-07 |
| SET-LIVING-01 | 1 | 2025-01-08 |

**💡 Tip:** Puedes usar una fórmula de Excel para convertir fechas:
```excel
=TEXT(D2,"YYYY-MM-DD")
```

#### Paso 3: Cargar ventas

```
1. Ir a: /bulk-upload
2. Pestaña: "Ventas"
3. Cargar archivo transformado
4. Verificar resultado
```

**📊 Resultado esperado si SET-LIVING-01 es un pack:**
```
✅ Ventas cargadas: 2
✅ Ventas descompuestas de packs: 7
   - SET-LIVING-01 (1 venta) →
     * 2x LAMP-LED-10W
     * 1x TABLE-AUX-01
     * 4x CUSHION-VEL-01

📊 Actualización de venta diaria:
   - LAMP-LED-10W: 3.5 → 3.6 unidades/día
   - TABLE-AUX-01: 0.8 → 0.9 unidades/día
   - CUSHION-VEL-01: 2.1 → 2.3 unidades/día
```

#### Paso 4: Verificar que no haya duplicados

```sql
-- Query para verificar duplicados
SELECT sku, fecha_venta, COUNT(*) as duplicados
FROM ventas
GROUP BY sku, fecha_venta
HAVING COUNT(*) > 1
```

Si encuentras duplicados:
```
⚠️ Encontrado duplicado: LAMP-LED-10W | 2025-01-07 | 2 registros

Acción:
1. Identificar cuál es el registro correcto
2. Eliminar el duplicado manualmente desde Supabase
3. Refrescar vista materializada
```

---

## Caso 3: Creación de Purchase Order

### 🎬 Escenario
El análisis muestra que 15 productos necesitan reposición. Necesitas crear órdenes de compra.

### 📋 Pasos Detallados

#### Paso 1: Ejecutar Análisis

```
1. Ir a: /analysis
2. Configurar parámetros:
   - Lead Time: 90 días
   - Stock Saludable: 60 días
   - Período de análisis: 90 días
3. Click "Analizar"
```

#### Paso 2: Filtrar y Ordenar productos

```
1. En la tabla de resultados, filtrar por:
   - Estado: CRITICAL o PARTIAL
   - Cantidad Sugerida: > 0

2. Sistema ordena automáticamente por VALOR TOTAL (mayor a menor)
   Valor Total = Cantidad Sugerida × Precio Venta ML
```

**Ejemplo de resultados ANTES de ordenar:**

| SKU | Cantidad Sugerida | Precio ML | Valor Total | Estado |
|-----|-------------------|-----------|-------------|--------|
| LAMP-LED-10W | 390 | $12,990 | $5,066,100 | CRITICAL |
| TABLE-AUX-01 | 85 | $29,990 | $2,549,150 | CRITICAL |
| CUSHION-VEL-01 | 45 | $5,990 | $269,550 | PARTIAL |

**Resultado DESPUÉS de ordenar (por Valor Total DESC):**

| Pos. | SKU | Cantidad Sugerida | Valor Total | Prioridad |
|------|-----|-------------------|-------------|-----------|
| **1º** | LAMP-LED-10W | 390 | **$5,066,100** | CRÍTICA |
| **2º** | TABLE-AUX-01 | 85 | **$2,549,150** | CRÍTICA |
| **3º** | CUSHION-VEL-01 | 45 | **$269,550** | MEDIA |

**💡 Razón del ordenamiento:**
- Primero ves los productos que requieren mayor inversión
- Te ayuda a priorizar si tienes presupuesto limitado
- Decisiones de compra más informadas

#### Paso 3: Exportar para Purchase Order

```
1. Seleccionar productos a ordenar (checkboxes)
2. Click "Exportar para PO"
3. Se descarga: purchase_order_2025-01-16.xlsx
```

**Archivo descargado:**

| SKU | Descripción | Cantidad Sugerida | Proveedor | CBM Unitario | CBM Total | Costo Unit | Costo Total |
|-----|-------------|-------------------|-----------|--------------|-----------|------------|-------------|
| LAMP-LED-10W | Lámpara LED 10W | 390 | Shenzhen Lighting | 0.08 | 31.2 | 45 RMB | 17,550 RMB |
| TABLE-AUX-01 | Mesa Auxiliar | 85 | Guangzhou Furniture | 0.15 | 12.75 | 120 RMB | 10,200 RMB |
| CUSHION-VEL-01 | Cojín Terciopelo | 45 | Hangzhou Textiles | 0.02 | 0.9 | 15 RMB | 675 RMB |

**📊 Resumen de la orden:**
- Total Items: 520 unidades
- Total CBM: 44.85 m³
- Total Costo: 28,425 RMB (~$3.7M CLP)
- Container recomendado: 1x 40' HC (68 m³) - Utilización: 66%

#### Paso 4: Agrupar por proveedor

Si tienes múltiples proveedores, crear una PO separada para cada uno:

**PO-001: Shenzhen Lighting**
- LAMP-LED-10W: 390 unidades
- CBM: 31.2 m³

**PO-002: Guangzhou Furniture**
- TABLE-AUX-01: 85 unidades
- CBM: 12.75 m³

**PO-003: Hangzhou Textiles**
- CUSHION-VEL-01: 45 unidades
- CBM: 0.9 m³

#### Paso 5: Crear PO en el sistema

```
1. Ir a: /purchase-orders
2. Click "Nueva Purchase Order"
3. Completar formulario:
   - Proveedor: Shenzhen Lighting
   - Fecha Orden: 2025-01-16
   - Items: Pegar desde Excel
4. Sistema genera: Order Number: ORD-20250116-12345
5. Click "Crear"
```

#### Paso 6: Enviar PO al proveedor

```
1. Exportar PO a PDF
2. Enviar por email al proveedor
3. En el sistema, cambiar estado a "SENT"
```

#### Paso 7: Cuando proveedor confirma

```
1. Cambiar estado PO a "CONFIRMED"
2. Sistema automáticamente crea registros en tabla "compras":
   - SKU: LAMP-LED-10W
   - Cantidad: 390
   - Status: confirmado
   - Fecha Compra: 2025-01-16
   - Purchase Order ID: [ID generado]
```

**✅ Efecto en análisis futuro:**
- Stock en Tránsito de LAMP-LED-10W: 0 → 390
- Cantidad Sugerida: 390 → 0
- Estado: CRITICAL → COVERED

---

## Caso 4: Gestión de Packs

### 🎬 Escenario
Decides crear un pack "Set Living Room" para vender en MercadoLibre, compuesto por varios productos.

### 📋 Pasos Detallados

#### Paso 1: Definir composición del pack

**Pack: SET-LIVING-01**
Componentes:
- 2x LAMP-LED-10W (Lámpara LED)
- 1x TABLE-AUX-01 (Mesa Auxiliar)
- 4x CUSHION-VEL-01 (Cojín)
- 1x RUG-MOD-01 (Alfombra Moderna)

**💡 Análisis de costos:**
```
Costo del pack:
- 2x LAMP-LED-10W: 2 × 45 RMB = 90 RMB
- 1x TABLE-AUX-01: 1 × 120 RMB = 120 RMB
- 4x CUSHION-VEL-01: 4 × 15 RMB = 60 RMB
- 1x RUG-MOD-01: 1 × 80 RMB = 80 RMB
TOTAL: 350 RMB (~$45,500 CLP)

Precio de venta sugerido: $89,990 CLP
Margen: ~50%
```

#### Paso 2: Crear el pack como producto

**Archivo:** `nuevo_pack.xlsx`

| sku | descripcion | cbm | costo_fob_rmb | stock_actual | precio_venta_ml | proveedor |
|-----|-------------|-----|---------------|--------------|-----------------|-----------|
| SET-LIVING-01 | Set Living Room Completo | 0.35 | 350 | 0 | 89990 | Mix |

```
1. Cargar en: /bulk-upload → Productos
```

#### Paso 3: Definir componentes del pack

**Archivo:** `componentes_pack.xlsx`

| pack_sku | producto_sku | cantidad |
|----------|--------------|----------|
| SET-LIVING-01 | LAMP-LED-10W | 2 |
| SET-LIVING-01 | TABLE-AUX-01 | 1 |
| SET-LIVING-01 | CUSHION-VEL-01 | 4 |
| SET-LIVING-01 | RUG-MOD-01 | 1 |

```
1. Cargar en: /bulk-upload → Packs
2. Sistema valida que todos los SKUs existen
```

**✅ Validación exitosa:**
```
✅ Pack creado: SET-LIVING-01
✅ Componentes registrados: 4
✅ Todos los productos componentes existen
```

#### Paso 4: Simular venta del pack

Cuando MercadoLibre reporte una venta de SET-LIVING-01:

**Input (venta de ML):**
```
sku: SET-LIVING-01
cantidad: 3
fecha_venta: 2025-01-16
```

**Proceso automático del sistema:**
```
1. Detecta que SET-LIVING-01 es un pack
2. Lee componentes desde tabla "packs"
3. Descompone la venta:

   3 packs vendidos × componentes:
   - 3 × 2 = 6 unidades de LAMP-LED-10W
   - 3 × 1 = 3 unidades de TABLE-AUX-01
   - 3 × 4 = 12 unidades de CUSHION-VEL-01
   - 3 × 1 = 3 unidades de RUG-MOD-01

4. Inserta ventas descompuestas en tabla "ventas":
```

| sku | cantidad | fecha_venta | origen |
|-----|----------|-------------|--------|
| LAMP-LED-10W | 6 | 2025-01-16 | pack:SET-LIVING-01 |
| TABLE-AUX-01 | 3 | 2025-01-16 | pack:SET-LIVING-01 |
| CUSHION-VEL-01 | 12 | 2025-01-16 | pack:SET-LIVING-01 |
| RUG-MOD-01 | 3 | 2025-01-16 | pack:SET-LIVING-01 |

#### Paso 5: Verificar impacto en venta diaria

**Antes del pack (solo ventas individuales):**

| Producto | Venta Diaria | Stock Objetivo | Cantidad Sugerida |
|----------|--------------|----------------|-------------------|
| LAMP-LED-10W | 3.6 | 540 | 390 |
| TABLE-AUX-01| 0.9 | 135 | 85 |
| CUSHION-VEL-01 | 2.3 | 345 | 145 |
| RUG-MOD-01 | 0.5 | 75 | 25 |

**Después de vender 3 packs en un día:**

| Producto | Venta Diaria | Stock Objetivo | Cantidad Sugerida | Cambio |
|----------|--------------|----------------|-------------------|--------|
| LAMP-LED-10W | 3.67 | 550 | 400 | +10 unidades |
| TABLE-AUX-01 | 0.93 | 139 | 89 | +4 unidades |
| CUSHION-VEL-01 | 2.43 | 364 | 164 | +19 unidades |
| RUG-MOD-01 | 0.53 | 79 | 29 | +4 unidades |

**🔥 Conclusión:** Sin el sistema de packs, habrías sub-ordenado y tendrías quiebre de stock.

---

## Caso 5: Recepción de Mercadería

### 🎬 Escenario
Llega un container con la Purchase Order ORD-20250116-12345. Necesitas registrar la recepción.

### 📋 Pasos Detallados

#### Paso 1: Verificar qué llegó

**PO Original:**
- 390x LAMP-LED-10W
- 85x TABLE-AUX-01
- 45x CUSHION-VEL-01

**Recibido físicamente:**
- 390x LAMP-LED-10W ✅ Completo
- 80x TABLE-AUX-01 ⚠️ Faltante: 5 unidades
- 45x CUSHION-VEL-01 ✅ Completo

#### Paso 2: Registrar recepción en el sistema

```
1. Ir a: /purchase-orders
2. Buscar: ORD-20250116-12345
3. Click "Registrar Recepción"
4. Ingresar cantidades recibidas:
```

| SKU | Ordenado | Recibido | Faltante |
|-----|----------|----------|----------|
| LAMP-LED-10W | 390 | 390 | 0 |
| TABLE-AUX-01 | 85 | 80 | 5 |
| CUSHION-VEL-01 | 45 | 45 | 0 |

```
5. Click "Confirmar Recepción"
```

#### Paso 3: Sistema actualiza automáticamente

**Actualización de stock_actual:**
```sql
UPDATE products
SET stock_actual = stock_actual + cantidad_recibida
WHERE sku IN ('LAMP-LED-10W', 'TABLE-AUX-01', 'CUSHION-VEL-01');
```

**Resultados:**

| SKU | Stock Anterior | + Recibido | = Stock Nuevo |
|-----|----------------|------------|---------------|
| LAMP-LED-10W | 150 | 390 | 540 |
| TABLE-AUX-01| 50 | 80 | 130 |
| CUSHION-VEL-01 | 200 | 45 | 245 |

**Actualización de compras:**
```sql
-- Items recibidos completamente
UPDATE compras
SET status_compra = 'llegado'
WHERE sku = 'LAMP-LED-10W' AND purchase_order_id = [PO_ID];

UPDATE compras
SET status_compra = 'llegado'
WHERE sku = 'CUSHION-VEL-01' AND purchase_order_id = [PO_ID];

-- Item recibido parcialmente
UPDATE compras
SET status_compra = 'llegado',
    cantidad = 80  -- Actualizar a cantidad real recibida
WHERE sku = 'TABLE-AUX-01' AND purchase_order_id = [PO_ID];

-- Crear registro separado para faltante
INSERT INTO compras (sku, cantidad, status_compra, fecha_compra, purchase_order_id)
VALUES ('TABLE-AUX-01', 5, 'confirmado', '2025-01-16', [PO_ID]);
```

**Actualización de Purchase Order:**
```sql
UPDATE purchase_orders
SET status = 'PARTIAL'  -- Porque TABLE-AUX-01 está incompleto
WHERE order_number = 'ORD-20250116-12345';
```

#### Paso 4: Verificar impacto en análisis

**Estado ANTES de recibir:**

| SKU | Stock Actual | Stock Tránsito | Cantidad Sugerida | Estado |
|-----|--------------|----------------|-------------------|--------|
| LAMP-LED-10W | 150 | 390 | 0 | COVERED |
| TABLE-AUX-01| 50 | 85 | 0 | COVERED |
| CUSHION-VEL-01 | 200 | 45 | 100 | PARTIAL |

**Estado DESPUÉS de recibir:**

| SKU | Stock Actual | Stock Tránsito | Cantidad Sugerida | Estado |
|-----|--------------|----------------|-------------------|--------|
| LAMP-LED-10W | 540 | 0 | 0 | SUFFICIENT_STOCK |
| TABLE-AUX-01| 130 | 5 | 0 | COVERED (por los 5 faltantes) |
| CUSHION-VEL-01 | 245 | 0 | 100 | PARTIAL |

#### Paso 5: Seguimiento de faltantes

```
1. Ir a: /purchase-orders/pending-items
2. Verás lista de items pendientes:

   PO: ORD-20250116-12345
   Item: TABLE-AUX-01
   Faltante: 5 unidades
   Estado: En tránsito
   Acción: Contactar proveedor para fecha de envío
```

---

## Caso 6: Análisis de Rentabilidad

### 🎬 Escenario
Antes de ordenar, quieres verificar qué productos son realmente rentables.

### 📋 Pasos Detallados

#### Paso 1: Ejecutar análisis de rentabilidad

```
1. Ir a: /analysis/profitability
2. Seleccionar productos a analizar (o todos)
3. Click "Calcular Rentabilidad"
```

#### Paso 2: Revisar resultados

**Ejemplo: LAMP-LED-10W**

```
📊 ANÁLISIS DE RENTABILIDAD

Producto: LAMP-LED-10W - Lámpara LED 10W Blanca

COSTOS:
├─ Costo FOB: 45 RMB × 130 = $5,850 CLP
├─ Envío: $500,000 (container) / 1,000 unidades = $500 CLP
└─ Costo Total: $6,350 CLP

PRECIO Y COMISIONES:
├─ Precio Venta ML: $12,990 CLP
├─ Comisión ML (16%): $2,078 CLP
├─ Envío ML: $5,000 CLP (< $60,000)
└─ Costo Operacional (15%): $1,949 CLP

MARGEN:
└─ $12,990 - $6,350 - $2,078 - $5,000 - $1,949 = -$2,387 CLP

❌ PRODUCTO NO RENTABLE
ROI: -37.6%

RECOMENDACIÓN:
1. Aumentar precio a $18,990 → Margen: $2,613 (+41% ROI) ✅
2. O reducir costo de envío negociando volumen
3. O descontinuar producto
```

**Ejemplo: TABLE-AUX-01**

```
📊 ANÁLISIS DE RENTABILIDAD

Producto: TABLE-AUX-01 - Mesa Auxiliar Moderna

COSTOS:
├─ Costo FOB: 120 RMB × 130 = $15,600 CLP
├─ Envío: $500,000 / 1,000 = $500 CLP
└─ Costo Total: $16,100 CLP

PRECIO Y COMISIONES:
├─ Precio Venta ML: $29,990 CLP
├─ Comisión ML (16%): $4,798 CLP
├─ Envío ML: $5,000 CLP
└─ Costo Operacional (15%): $4,498 CLP

MARGEN:
└─ $29,990 - $16,100 - $4,798 - $5,000 - $4,498 = -$406 CLP

⚠️ MARGEN NEGATIVO PERO CERCANO A RENTABLE

RECOMENDACIÓN:
1. Aumentar precio a $31,990 → Margen: $1,914 (+11.9% ROI) ✅
2. Producto tiene buen volumen de ventas, vale la pena ajustar
```

**Ejemplo: SET-LIVING-01 (Pack)**

```
📊 ANÁLISIS DE RENTABILIDAD

Producto: SET-LIVING-01 - Set Living Room Completo

COSTOS:
├─ Costo FOB: 350 RMB × 130 = $45,500 CLP
├─ Envío: $500,000 / 1,000 × 0.35 CBM = $175 CLP
└─ Costo Total: $45,675 CLP

PRECIO Y COMISIONES:
├─ Precio Venta ML: $89,990 CLP
├─ Comisión ML (16%): $14,398 CLP
├─ Envío ML: $0 CLP (> $60,000 = Envío Gratis) ✅
└─ Costo Operacional (15%): $13,498 CLP

MARGEN:
└─ $89,990 - $45,675 - $14,398 - $0 - $13,498 = $16,419 CLP

✅ PRODUCTO MUY RENTABLE
ROI: +35.9%
Margen %: 18.2%

RECOMENDACIÓN:
✅ Excelente producto, aumentar stock
✅ Beneficio de envío gratis mejora rentabilidad
✅ Considerar promocionar más en MercadoLibre
```

#### Paso 3: Tomar decisiones

**Tabla resumen de todos los productos:**

| SKU | Precio Actual | Margen | ROI | Acción |
|-----|---------------|--------|-----|--------|
| LAMP-LED-10W | $12,990 | -$2,387 | -37.6% | ⚠️ Aumentar precio a $18,990 |
| TABLE-AUX-01 | $29,990 | -$406 | -2.5% | ⚠️ Aumentar precio a $31,990 |
| CUSHION-VEL-01 | $5,990 | $1,234 | +47.2% | ✅ Mantener |
| RUG-MOD-01 | $24,990 | $3,456 | +28.9% | ✅ Mantener |
| SET-LIVING-01 | $89,990 | $16,419 | +35.9% | ✅ Promover más |

**Acciones a tomar:**
1. ✅ Actualizar precios en MercadoLibre (LAMP y TABLE)
2. ✅ Promover SET-LIVING-01 (muy rentable)
3. ✅ Ordenar más CUSHION y RUG (buenos márgenes)
4. ⚠️ Monitorear ventas después de cambio de precio

---

## Caso 7: Optimización de Containers

### 🎬 Escenario
Tienes una lista de 20 productos para ordenar. Necesitas optimizar cuántos containers usar.

### 📋 Pasos Detallados

#### Paso 1: Lista de productos a ordenar

| SKU | Cantidad | CBM Unit | CBM Total | Prioridad |
|-----|----------|----------|-----------|-----------|
| LAMP-LED-10W | 400 | 0.08 | 32.0 | CRÍTICA |
| TABLE-AUX-01 | 85 | 0.15 | 12.75 | ALTA |
| CUSHION-VEL-01 | 500 | 0.02 | 10.0 | ALTA |
| RUG-MOD-01 | 100 | 0.12 | 12.0 | MEDIA |
| SOFA-2P-01 | 20 | 1.2 | 24.0 | CRÍTICA |
| ... | ... | ... | ... | ... |

**CBM Total: 145 m³**

#### Paso 2: Calcular opciones de containers

```
Opciones disponibles:
1. Container 20': 30 m³ × 5 = 150 m³ (Utilización: 96.7%)
2. Container 40': 60 m³ × 3 = 180 m³ (Utilización: 80.6%)
3. Container 40'HC: 68 m³ × 3 = 204 m³ (Utilización: 71.1%)
4. Mix: 2× 40'HC + 1× 20' = 166 m³ (Utilización: 87.3%)
```

#### Paso 3: Considerar costos

**Supongamos costos de envío:**
- Container 20': $1,200 USD
- Container 40': $2,000 USD
- Container 40'HC: $2,200 USD

**Cálculo de opciones:**

| Opción | Containers | Costo Total | Utilización | Costo/m³ |
|--------|------------|-------------|-------------|----------|
| 1 | 5× 20' | $6,000 | 96.7% | $41.38 |
| 2 | 3× 40' | $6,000 | 80.6% | $41.38 |
| 3 | 3× 40'HC | $6,600 | 71.1% | $45.52 |
| 4 | 2×40'HC + 1×20' | $5,600 | 87.3% | **$38.62** ✅ |

**🏆 Mejor opción: 2× 40'HC + 1× 20'**
- Menor costo total
- Buena utilización
- Menor costo por m³

#### Paso 4: Distribuir productos en containers

**Container 1 (40'HC - 68 m³):**

| SKU | Cantidad | CBM | Prioridad |
|-----|----------|-----|-----------|
| SOFA-2P-01 | 20 | 24.0 | CRÍTICA |
| LAMP-LED-10W | 400 | 32.0 | CRÍTICA |
| RUG-MOD-01 | 100 | 12.0 | MEDIA |
| **Total** | | **68.0** | **100%** ✅ |

**Container 2 (40'HC - 68 m³):**

| SKU | Cantidad | CBM | Prioridad |
|-----|----------|-----|-----------|
| TABLE-AUX-01 | 85 | 12.75 | ALTA |
| CHAIR-MOD-01 | 150 | 45.0 | ALTA |
| CUSHION-VEL-01 | 500 | 10.0 | ALTA |
| **Total** | | **67.75** | **99.6%** ✅ |

**Container 3 (20' - 30 m³):**

| SKU | Cantidad | CBM | Prioridad |
|-----|----------|-----|-----------|
| LAMP-DESK-01 | 80 | 8.0 | BAJA |
| VASE-DEC-01 | 200 | 6.0 | BAJA |
| FRAME-PIC-01 | 300 | 9.0 | BAJA |
| CANDLE-SET-01 | 400 | 4.0 | BAJA |
| **Total** | | **27.0** | **90%** ✅ |

#### Paso 5: Crear Purchase Orders

```
PO-001: Container 1 (40'HC)
- Prioridad: CRÍTICA/ALTA
- Enviar primero
- ETA: 2025-03-15

PO-002: Container 2 (40'HC)
- Prioridad: ALTA
- Enviar junto con PO-001
- ETA: 2025-03-15

PO-003: Container 3 (20')
- Prioridad: BAJA
- Enviar cuando haya espacio
- ETA: 2025-04-01
```

---

## Caso 8: Resolución de Problemas Comunes

### 🔥 Problema 1: "Venta Diaria = 0 pero sé que vendo ese producto"

**Síntomas:**
- Producto aparece con venta diaria = 0
- En MercadoLibre sí hay ventas
- Cantidad sugerida = 0

**Causas posibles:**
1. ✅ Ventas no cargadas en el sistema
2. ✅ SKU diferente en ML vs sistema
3. ✅ Ventas cargadas como parte de un pack no descompuesto

**Solución paso a paso:**

```sql
-- 1. Verificar si existen ventas para ese SKU
SELECT * FROM ventas WHERE sku = 'LAMP-LED-10W';

-- Si no hay resultados:
-- → Cargar ventas desde ML

-- 2. Verificar si el SKU es componente de un pack
SELECT * FROM packs WHERE producto_sku = 'LAMP-LED-10W';

-- Si hay resultados:
-- → Verificar que las ventas del pack se descomponen correctamente

-- 3. Verificar la vista materializada
SELECT * FROM sku_venta_diaria_mv WHERE sku = 'LAMP-LED-10W';

-- Si está desactualizada:
REFRESH MATERIALIZED VIEW CONCURRENTLY sku_venta_diaria_mv;
```

---

### 🔥 Problema 2: "Cantidad Sugerida es negativa"

**Síntomas:**
- Sistema muestra cantidad sugerida = -50
- Lógicamente debería ser 0

**Causa:**
- Bug en cálculo (debería usar MAX(0, valor))

**Solución:**

```javascript
// Código correcto:
const cantidadSugerida = Math.max(0, stockObjetivo - stockActual - stockTransito);

// ❌ Código incorrecto:
const cantidadSugerida = stockObjetivo - stockActual - stockTransito;
```

**Acción inmediata:**
1. Reportar bug al equipo de desarrollo
2. Mientras tanto, interpretar valores negativos como 0
3. Aplicar fix en próximo deploy

---

### 🔥 Problema 3: "Stock en Tránsito no se está restando de Cantidad Sugerida"

**Síntomas:**
- Creaste una PO de 500 unidades
- Estado = CONFIRMED
- Pero Cantidad Sugerida sigue siendo 500 (no bajó a 0)

**Causa:**
- Status de compra incorrecto

**Solución:**

```sql
-- 1. Verificar status de la compra
SELECT sku, cantidad, status_compra, purchase_order_id
FROM compras
WHERE sku = 'LAMP-LED-10W';

-- 2. Si status no es correcto, actualizar:
UPDATE compras
SET status_compra = 'confirmado'  -- o 'en_transito', 'fabricacion'
WHERE purchase_order_id = [TU_PO_ID];

-- 3. Verificar que se contabiliza como stock en tránsito:
SELECT
    sku,
    SUM(cantidad) as stock_transito
FROM compras
WHERE status_compra IN ('confirmado', 'fabricacion', 'fabricacion_completa', 'en_transito')
GROUP BY sku;
```

---

### 🔥 Problema 4: "Duplicados en Ventas"

**Síntomas:**
- Venta diaria anormalmente alta
- Al revisar, encuentras ventas duplicadas (mismo SKU + fecha)

**Solución:**

```sql
-- 1. Identificar duplicados
SELECT sku, fecha_venta, COUNT(*) as cantidad_registros
FROM ventas
GROUP BY sku, fecha_venta
HAVING COUNT(*) > 1
ORDER BY cantidad_registros DESC;

-- 2. Ver detalles de los duplicados
SELECT * FROM ventas
WHERE sku = 'LAMP-LED-10W'
AND fecha_venta = '2025-01-15'
ORDER BY id;

-- 3. Eliminar duplicados (mantener el primero)
DELETE FROM ventas
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY sku, fecha_venta ORDER BY id) as rn
        FROM ventas
    ) t
    WHERE rn > 1
);

-- 4. Refrescar vista materializada
REFRESH MATERIALIZED VIEW CONCURRENTLY sku_venta_diaria_mv;

-- 5. Prevenir futuros duplicados (agregar constraint)
ALTER TABLE ventas ADD CONSTRAINT unique_sku_fecha UNIQUE (sku, fecha_venta);
```

---

### 🔥 Problema 5: "Container Over Capacity"

**Síntomas:**
- Intentas crear PO
- Sistema alerta: "CBM total (75 m³) excede capacidad del container (68 m³)"

**Solución:**

```
Opción 1: Agregar otro container
├─ Container 1: 68 m³ (productos críticos)
└─ Container 2: 20 m³ (productos restantes + otros de baja prioridad)

Opción 2: Reducir cantidades
├─ Priorizar productos CRÍTICOS
├─ Reducir cantidades de productos MEDIA/BAJA
└─ Mover algunos a próxima orden

Opción 3: Optimizar con algoritmo
1. Ir a: /containers/optimize
2. Ingresar lista de productos
3. Sistema sugiere distribución óptima
```

---

## 📚 Checklist de Uso Diario

### ✅ Lunes (Inicio de Semana)
- [ ] Cargar ventas de la semana pasada
- [ ] Refrescar vista materializada
- [ ] Revisar productos en estado CRITICAL
- [ ] Verificar POs pendientes de confirmación

### ✅ Miércoles (Mitad de Semana)
- [ ] Revisar stock actual vs proyecciones
- [ ] Actualizar status de compras en tránsito
- [ ] Contactar proveedores con POs SENT > 3 días

### ✅ Viernes (Fin de Semana)
- [ ] Ejecutar análisis completo
- [ ] Exportar lista de reposición
- [ ] Crear POs para próxima semana
- [ ] Backup de base de datos

### ✅ Mensual
- [ ] Análisis de rentabilidad de todos los productos
- [ ] Limpieza de duplicados
- [ ] Auditoría de stock físico vs sistema
- [ ] Revisión de configuración (lead time, tasas de cambio)

---

**Fecha de Creación:** 16 de enero de 2025
**Versión:** 1.0
**Última Actualización:** 16 de enero de 2025
