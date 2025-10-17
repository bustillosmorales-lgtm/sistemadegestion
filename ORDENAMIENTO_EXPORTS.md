# 📊 Ordenamiento de Productos en Exports

## 🎯 Criterio Principal: VALOR TOTAL

Los productos en los exports se ordenan de **MAYOR a MENOR** valor total, no por prioridad alfabética o cantidad.

---

## 📐 Fórmula de Valor Total

```
Valor Total = Cantidad Sugerida × Precio Venta ML
```

### Ejemplo:

| Producto | Cantidad Sugerida | Precio ML | Cálculo | Valor Total |
|----------|-------------------|-----------|---------|-------------|
| LAMP-001 | 400 unidades | $12,990 | 400 × $12,990 | **$5,196,000** |
| TABLE-001 | 85 unidades | $29,990 | 85 × $29,990 | **$2,549,150** |
| CUSHION-001 | 500 unidades | $5,990 | 500 × $5,990 | **$2,995,000** |

---

## 🔢 Ordenamiento Correcto

**Excel/CSV exportado se ordena así:**

```
ORDER BY valor_total DESC
```

**Resultado:**

| Posición | SKU | Cantidad | Precio | Valor Total | Etiqueta |
|----------|-----|----------|--------|-------------|----------|
| **1º** | LAMP-001 | 400 | $12,990 | **$5,196,000** | CRÍTICA |
| **2º** | CUSHION-001 | 500 | $5,990 | **$2,995,000** | CRÍTICA |
| **3º** | TABLE-001 | 85 | $29,990 | **$2,549,150** | CRÍTICA |

---

## ❓ ¿Por qué ordenar por Valor Total?

### 1. **Decisiones de Inversión Informadas**
Al ver primero los productos con mayor valor total, sabes inmediatamente dónde se irá la mayor parte de tu presupuesto.

**Ejemplo:**
```
Presupuesto disponible: $8,000,000 CLP

Con ordenamiento por Valor Total:
✅ Ves inmediatamente que LAMP-001 ($5.2M) consume 65% del presupuesto
✅ Puedes decidir: ¿compro todo o distribuyo el presupuesto?
```

### 2. **Priorización de Presupuesto Limitado**
Si no tienes presupuesto para todo, el ordenamiento te muestra qué productos requieren más capital.

**Escenario:**
```
Presupuesto: $5,000,000 CLP

Opción A (orden por Valor Total):
- LAMP-001: $5,196,000 → No alcanza, evaluar alternativas
- Considerar: ¿compro menos cantidad? ¿espero a próximo mes?

Opción B (sin orden):
- Comprarías varios productos pequeños
- Descubrirías tarde que no alcanza para LAMP-001
- LAMP-001 podría ser crítico para ventas
```

### 3. **Negociación con Proveedores**
Conocer los valores totales te ayuda a negociar mejor.

**Ejemplo:**
```
LAMP-001: $5.2M → Pedido grande, puedes negociar descuento por volumen
CUSHION-001: $3M → Segundo producto más caro, combinar con LAMP-001 para mejor precio
```

### 4. **Planificación de Flujo de Caja**
Sabes cuándo necesitas tener el dinero disponible.

**Timeline:**
```
Mes 1:
- LAMP-001: $5.2M (pagar al confirmar orden)

Mes 2:
- CUSHION-001: $3M
- TABLE-001: $2.5M
Total: $5.5M

Proyección financiera clara
```

---

## 🏷️ Etiquetas de Prioridad (Visuales)

Las etiquetas son **complementarias** al ordenamiento por valor total.

| Etiqueta | Criterio | Color | Propósito |
|----------|----------|-------|-----------|
| **CRÍTICA** | Valor > $500K | 🔴 Rojo | Identificación visual rápida de alto impacto |
| **ALTA** | Valor > $200K | 🟠 Naranja | Inversión moderada |
| **MEDIA** | Valor > $100K | 🔵 Azul | Inversión baja |
| **BAJA** | Valor < $100K | ⚪ Gris | Complementarios |

**Nota:** Aunque un producto tenga etiqueta "BAJA", si su valor total es mayor que otro "ALTA", aparecerá primero en la lista.

---

## 📋 Ejemplo Completo de Export

### Datos de entrada:

| SKU | Cantidad Sugerida | Precio ML | Estado |
|-----|-------------------|-----------|--------|
| SOFA-2P | 20 | $89,990 | CRITICAL |
| LAMP-LED | 400 | $12,990 | CRITICAL |
| TABLE-AUX | 85 | $29,990 | CRITICAL |
| CUSHION-VEL | 500 | $5,990 | PARTIAL |
| FRAME-PIC | 200 | $3,990 | CRITICAL |

### Cálculo de Valor Total:

| SKU | Cálculo | Valor Total | Etiqueta |
|-----|---------|-------------|----------|
| SOFA-2P | 20 × $89,990 | $1,799,800 | CRÍTICA |
| LAMP-LED | 400 × $12,990 | $5,196,000 | CRÍTICA |
| TABLE-AUX | 85 × $29,990 | $2,549,150 | CRÍTICA |
| CUSHION-VEL | 500 × $5,990 | $2,995,000 | CRÍTICA |
| FRAME-PIC | 200 × $3,990 | $798,000 | CRÍTICA |

### Excel Exportado (ordenado por Valor Total DESC):

| Pos | SKU | Cantidad | Precio | Valor Total | % del Total | Acumulado |
|-----|-----|----------|--------|-------------|-------------|-----------|
| **1** | LAMP-LED | 400 | $12,990 | $5,196,000 | 39.5% | $5,196,000 |
| **2** | CUSHION-VEL | 500 | $5,990 | $2,995,000 | 22.8% | $8,191,000 |
| **3** | TABLE-AUX | 85 | $29,990 | $2,549,150 | 19.4% | $10,740,150 |
| **4** | SOFA-2P | 20 | $89,990 | $1,799,800 | 13.7% | $12,539,950 |
| **5** | FRAME-PIC | 200 | $3,990 | $798,000 | 6.1% | $13,337,950 |

**Total a Invertir: $13,337,950 CLP**

---

## 💡 Casos de Uso

### Caso 1: Presupuesto Ilimitado
```
Acción: Comprar todo en orden
Beneficio: Los productos más valiosos se ordenan primero
```

### Caso 2: Presupuesto Limitado ($8M)
```
Con ordenamiento por Valor Total:

✅ Opción A: LAMP-LED ($5.2M) + CUSHION-VEL ($3M) = $8.2M
   → Levemente sobre presupuesto, negociar descuento

✅ Opción B: LAMP-LED ($5.2M) + TABLE-AUX ($2.5M) = $7.7M
   → Dentro del presupuesto, sobran $300K para emergencias

❌ Sin ordenamiento:
   → Comprarías varios productos pequeños
   → Descubrirías tarde que no alcanza para LAMP-LED
   → LAMP-LED podría quedarse sin stock
```

### Caso 3: Distribución por Proveedor
```
Proveedor A (China):
- LAMP-LED: $5.2M
- CUSHION-VEL: $3M
Total: $8.2M → Negociar descuento por volumen

Proveedor B (Vietnam):
- TABLE-AUX: $2.5M
- SOFA-2P: $1.8M
Total: $4.3M → Orden separada
```

---

## 🔧 Implementación en el Sistema

### SQL Query para Export:

```sql
SELECT
    p.sku,
    p.descripcion,
    a.cantidad_sugerida,
    p.precio_venta_ml,
    (a.cantidad_sugerida * p.precio_venta_ml) as valor_total,
    a.estado,
    CASE
        WHEN (a.cantidad_sugerida * p.precio_venta_ml) > 500000 THEN 'CRÍTICA'
        WHEN (a.cantidad_sugerida * p.precio_venta_ml) > 200000 THEN 'ALTA'
        WHEN (a.cantidad_sugerida * p.precio_venta_ml) > 100000 THEN 'MEDIA'
        ELSE 'BAJA'
    END as prioridad
FROM analysis a
JOIN products p ON a.sku = p.sku
WHERE a.cantidad_sugerida > 0
  AND p.desconsiderado = FALSE
ORDER BY valor_total DESC;  -- ← CLAVE: Ordenar por valor total descendente
```

### JavaScript (Frontend):

```javascript
// Ordenar productos por valor total
const productosOrdenados = productos
    .map(p => ({
        ...p,
        valorTotal: p.cantidadSugerida * p.precioVentaML
    }))
    .sort((a, b) => b.valorTotal - a.valorTotal);  // DESC

// Asignar etiquetas de prioridad
productosOrdenados.forEach(p => {
    if (p.valorTotal > 500000) p.etiqueta = 'CRÍTICA';
    else if (p.valorTotal > 200000) p.etiqueta = 'ALTA';
    else if (p.valorTotal > 100000) p.etiqueta = 'MEDIA';
    else p.etiqueta = 'BAJA';
});
```

---

## ✅ Checklist de Verificación

Al exportar, verifica que:

- [ ] Columna "Valor Total" existe y está calculada correctamente
- [ ] Productos están ordenados de MAYOR a MENOR valor total
- [ ] Primer producto tiene el mayor valor total
- [ ] Último producto tiene el menor valor total
- [ ] Etiquetas de prioridad son consistentes con valores totales
- [ ] Suma total de valores es correcta

---

## 📊 Ejemplo de Validación

**Export correcto:**
```
1. LAMP-LED: $5,196,000    ✅ Mayor valor
2. CUSHION-VEL: $2,995,000 ✅
3. TABLE-AUX: $2,549,150   ✅
4. SOFA-2P: $1,799,800     ✅
5. FRAME-PIC: $798,000     ✅ Menor valor
```

**Export incorrecto:**
```
1. CUSHION-VEL: $2,995,000 ❌ No es el mayor
2. LAMP-LED: $5,196,000    ❌ Debería ser primero
3. FRAME-PIC: $798,000     ❌ Orden aleatorio
4. TABLE-AUX: $2,549,150   ❌
5. SOFA-2P: $1,799,800     ❌
```

---

## 🎯 Resumen

1. **Criterio de ordenamiento:** Valor Total (Cantidad × Precio)
2. **Dirección:** MAYOR a MENOR (DESC)
3. **Propósito:** Decisiones de inversión informadas
4. **Etiquetas:** Visuales, complementarias al ordenamiento
5. **Implementación:** `ORDER BY valor_total DESC`

**El ordenamiento por Valor Total te da control sobre dónde va tu dinero.** 💰

---

**Fecha:** 16 de enero de 2025
**Versión:** 1.0
