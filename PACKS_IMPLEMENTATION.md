# 📦 Sistema de Descomposición de Packs

## 🎯 Objetivo

Cuando se vende un pack (ej: PACK0001), el sistema debe **descomponer automáticamente** las ventas en los productos individuales que lo componen para:
- ✅ Sumar correctamente las ventas diarias de cada SKU
- ✅ Mantener inventario actualizado
- ✅ Generar reportes precisos

---

## 📊 Ejemplo Práctico

### **Venta de Pack:**
```
Se vende: 2x PACK0003
```

### **Composición del Pack:**
```
PACK0003 contiene:
  - 1x 649762431365-NEG
  - 1x 649762431365-AZU
```

### **Resultado Descompuesto:**
```
Ventas reales:
  - 2x 649762431365-NEG  (2 packs × 1 unidad)
  - 2x 649762431365-AZU  (2 packs × 1 unidad)
```

---

## 🗂️ Estructura de la Solución

### **1. Tabla `packs`**

Almacena la composición de cada pack:

| pack_sku | producto_sku | cantidad |
|----------|--------------|----------|
| PACK0001 | 649762431365-NEG | 2 |
| PACK0003 | 649762431365-NEG | 1 |
| PACK0003 | 649762431365-AZU | 1 |

### **2. Vista `ventas_descompuestas`**

Combina automáticamente:
- Ventas normales (productos individuales)
- Ventas de packs descompuestas

### **3. Función `obtener_ventas_diarias_con_packs()`**

Retorna ventas diarias con 3 columnas:
- `cantidad_total`: Total vendido del SKU
- `ventas_directas`: Vendido como producto individual
- `ventas_por_packs`: Vendido dentro de packs

---

## 🚀 Pasos de Implementación

### **Paso 1: Crear la Tabla en Supabase**

```bash
# Conectarse a Supabase con psql
psql postgresql://tu-conexion-supabase

# Ejecutar el script SQL
\i scripts/create-packs-table.sql
```

O desde el Dashboard de Supabase:
1. SQL Editor
2. Copiar contenido de `scripts/create-packs-table.sql`
3. Run

---

### **Paso 2: Importar Datos del Excel**

```bash
# Asegúrate de tener .env configurado
node scripts/import-packs.js
```

**Salida esperada:**
```
📦 Importando packs a Supabase
✅ Leídos 1068 registros
✅ Tabla "packs" existe
💾 Insertando datos...
✅ Insertados 1068 registros
```

---

### **Paso 3: Verificar la Instalación**

#### **3.1 Verificar datos de packs:**
```sql
SELECT * FROM packs LIMIT 10;
```

**Resultado esperado:**
```
pack_sku  | producto_sku          | cantidad
----------|-----------------------|---------
PACK0001  | 649762431365-NEG      | 2
PACK0002  | 649762431365-AZU      | 2
PACK0003  | 649762431365-NEG      | 1
PACK0003  | 649762431365-AZU      | 1
```

#### **3.2 Probar vista de ventas descompuestas:**
```sql
SELECT * FROM ventas_descompuestas
WHERE fecha_venta::DATE = '2024-10-15'
LIMIT 10;
```

#### **3.3 Probar función de ventas diarias:**
```sql
SELECT * FROM obtener_ventas_diarias_con_packs(
    '2024-10-01',
    '2024-10-31'
)
ORDER BY cantidad_total DESC
LIMIT 10;
```

**Resultado esperado:**
```
sku                 | fecha      | cantidad_total | ventas_directas | ventas_por_packs
--------------------|------------|----------------|-----------------|------------------
649762431365-NEG    | 2024-10-15 | 25             | 15              | 10
649762431365-AZU    | 2024-10-15 | 20             | 12              | 8
```

---

## 🔌 Integración con el Sistema

### **Opción A: Usar la API REST**

```javascript
// GET /api/ventas-descompuestas?fecha_inicio=2024-10-01&fecha_fin=2024-10-31

const response = await fetch('/api/ventas-descompuestas?' + new URLSearchParams({
    fecha_inicio: '2024-10-01',
    fecha_fin: '2024-10-31',
    sku: '649762431365-NEG' // Opcional
}));

const data = await response.json();

console.log(data);
// {
//   fecha_inicio: '2024-10-01',
//   fecha_fin: '2024-10-31',
//   total_registros: 150,
//   ventas_diarias: [...],
//   resumen_por_sku: [
//     {
//       sku: '649762431365-NEG',
//       cantidad_total: 250,
//       ventas_directas: 180,
//       ventas_por_packs: 70,
//       dias_vendidos: 30
//     }
//   ]
// }
```

### **Opción B: Modificar Consultas Existentes**

En lugar de:
```javascript
// ANTES (sin packs)
const { data } = await supabase
    .from('ventas')
    .select('sku, cantidad, fecha_venta')
    .gte('fecha_venta', fecha_inicio)
    .lte('fecha_venta', fecha_fin);
```

Usar:
```javascript
// DESPUÉS (con packs descompuestos)
const { data } = await supabase
    .from('ventas_descompuestas')  // ← Vista que descompone packs
    .select('sku, cantidad, fecha_venta, tipo_venta')
    .gte('fecha_venta', fecha_inicio)
    .lte('fecha_venta', fecha_fin);
```

---

## 📈 Actualizar el Dashboard

### **Modificar `pages/api/analysis-fast.js`**

Busca donde se calculan las ventas y reemplaza con:

```javascript
// ANTES
const { data: ventas } = await supabase
    .from('ventas')
    .select('sku, cantidad, fecha_venta')
    .gte('fecha_venta', fecha_inicio)
    .lte('fecha_venta', fecha_fin);

// DESPUÉS
const { data: ventas } = await supabase
    .rpc('obtener_ventas_diarias_con_packs', {
        p_fecha_inicio: fecha_inicio,
        p_fecha_fin: fecha_fin
    });

// Agrupar por SKU
const ventasPorSku = {};
ventas.forEach(v => {
    if (!ventasPorSku[v.sku]) {
        ventasPorSku[v.sku] = {
            total: 0,
            directas: 0,
            packs: 0
        };
    }
    ventasPorSku[v.sku].total += parseInt(v.cantidad_total);
    ventasPorSku[v.sku].directas += parseInt(v.ventas_directas);
    ventasPorSku[v.sku].packs += parseInt(v.ventas_por_packs);
});
```

---

## 🧪 Testing

### **Test 1: Venta Normal (sin pack)**

```sql
-- Insertar venta normal
INSERT INTO ventas (sku, cantidad, fecha_venta)
VALUES ('649762431365-NEG', 5, '2024-10-15');

-- Verificar en vista descompuesta
SELECT * FROM ventas_descompuestas
WHERE sku = '649762431365-NEG'
  AND fecha_venta::DATE = '2024-10-15';

-- Resultado esperado:
-- sku: 649762431365-NEG, cantidad: 5, tipo_venta: 'producto'
```

### **Test 2: Venta de Pack**

```sql
-- Insertar venta de pack
INSERT INTO ventas (sku, cantidad, fecha_venta)
VALUES ('PACK0003', 3, '2024-10-15');

-- Verificar descomposición
SELECT * FROM ventas_descompuestas
WHERE fecha_venta::DATE = '2024-10-15'
  AND tipo_venta = 'pack_descompuesto';

-- Resultado esperado:
-- sku: 649762431365-NEG, cantidad: 3, tipo_venta: 'pack_descompuesto'
-- sku: 649762431365-AZU, cantidad: 3, tipo_venta: 'pack_descompuesto'
```

### **Test 3: Ventas Diarias con Función**

```sql
SELECT * FROM obtener_ventas_diarias_con_packs(
    '2024-10-15',
    '2024-10-15'
)
WHERE sku = '649762431365-NEG';

-- Resultado esperado:
-- sku: 649762431365-NEG
-- cantidad_total: 8 (5 directas + 3 del pack)
-- ventas_directas: 5
-- ventas_por_packs: 3
```

---

## 📊 Reportes Mejorados

### **Reporte de Productos Más Vendidos (con packs):**

```sql
SELECT
    sku,
    SUM(cantidad_total) as total_vendido,
    SUM(ventas_directas) as vendido_directo,
    SUM(ventas_por_packs) as vendido_en_packs,
    ROUND(
        (SUM(ventas_por_packs)::NUMERIC / NULLIF(SUM(cantidad_total), 0) * 100),
        2
    ) as porcentaje_packs
FROM obtener_ventas_diarias_con_packs('2024-10-01', '2024-10-31')
GROUP BY sku
ORDER BY total_vendido DESC
LIMIT 20;
```

### **Packs Más Vendidos:**

```sql
SELECT
    v.sku as pack_sku,
    COUNT(*) as veces_vendido,
    SUM(v.cantidad) as unidades_vendidas
FROM ventas v
WHERE EXISTS (SELECT 1 FROM packs p WHERE p.pack_sku = v.sku)
  AND v.fecha_venta >= '2024-10-01'
  AND v.fecha_venta < '2024-11-01'
GROUP BY v.sku
ORDER BY unidades_vendidas DESC;
```

---

## 🔄 Mantenimiento

### **Agregar Nuevo Pack:**

```sql
-- Insertar componentes del nuevo pack
INSERT INTO packs (pack_sku, producto_sku, cantidad) VALUES
    ('PACK0999', '649762431365-NEG', 2),
    ('PACK0999', '649762431365-AZU', 1),
    ('PACK0999', '649762435196', 1);
```

### **Actualizar Pack Existente:**

```sql
-- Eliminar pack viejo
DELETE FROM packs WHERE pack_sku = 'PACK0001';

-- Insertar nueva composición
INSERT INTO packs (pack_sku, producto_sku, cantidad) VALUES
    ('PACK0001', '649762431365-NEG', 3),  -- Cambió de 2 a 3
    ('PACK0001', '649762435196', 1);       -- Nuevo producto
```

### **Ver Packs que Contienen un Producto:**

```sql
SELECT DISTINCT pack_sku
FROM packs
WHERE producto_sku = '649762431365-NEG';
```

---

## ⚠️ Consideraciones Importantes

### **1. Los Packs NO deben estar en `products`**
- ✅ Los SKUs de packs solo existen en tabla `packs`
- ✅ Las ventas se registran con el pack_sku en tabla `ventas`
- ✅ El sistema descompone automáticamente

### **2. Validación de Productos**
- Antes de crear un pack, verifica que todos los productos existan:
```sql
SELECT p.producto_sku
FROM packs p
LEFT JOIN products pr ON p.producto_sku = pr.sku
WHERE pr.sku IS NULL;
-- Si retorna filas, hay productos faltantes
```

### **3. Performance**
- Las vistas y funciones están indexadas
- Para grandes volúmenes, considera materializar la vista:
```sql
CREATE MATERIALIZED VIEW ventas_descompuestas_mv AS
SELECT * FROM ventas_descompuestas;

-- Refrescar periódicamente
REFRESH MATERIALIZED VIEW ventas_descompuestas_mv;
```

---

## 📁 Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| `scripts/create-packs-table.sql` | SQL para crear tabla, vista y funciones |
| `scripts/import-packs.js` | Script para importar desde Excel |
| `scripts/analyze-packs.js` | Análisis del archivo Excel |
| `pages/api/ventas-descompuestas.js` | API REST para consultar ventas |
| `PACKS_IMPLEMENTATION.md` | Esta documentación |

---

## ✅ Checklist de Implementación

- [ ] Ejecutar `create-packs-table.sql` en Supabase
- [ ] Ejecutar `node scripts/import-packs.js`
- [ ] Verificar datos: `SELECT * FROM packs LIMIT 10;`
- [ ] Probar vista: `SELECT * FROM ventas_descompuestas LIMIT 10;`
- [ ] Probar función: `SELECT * FROM obtener_ventas_diarias_con_packs(...);`
- [ ] Actualizar consultas del dashboard
- [ ] Probar API: `/api/ventas-descompuestas`
- [ ] Testing con datos reales

---

## 🆘 Troubleshooting

**Problema:** "Error: relation 'packs' does not exist"
**Solución:** Ejecuta `create-packs-table.sql` primero

**Problema:** "Error: function obtener_ventas_diarias_con_packs does not exist"
**Solución:** Verifica que el SQL se ejecutó completamente

**Problema:** Ventas de packs no se descomponen
**Solución:** Verifica que el pack_sku existe en tabla `packs`

---

**Última actualización:** 2025-10-15
**Versión:** 1.0.0
