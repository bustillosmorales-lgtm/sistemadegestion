# 📦 Sistema de Packs - Documentación Completa

## 🎯 Objetivo

Asegurar que las **ventas de packs se descompongan automáticamente** en unidades individuales para análisis de venta diaria preciso.

---

## 📊 Ejemplo: Pack de 50 Rollos Térmicos

### Escenario:
- **Pack SKU**: `PACK-ROLLOS-50`
- **Contiene**: 50 unidades de rollo térmico (SKU: `ROLLO-TERMICO-80MM`)
- **Venta**: Se vendió 1 pack

### ✅ Comportamiento Correcto:
Cuando se vende 1 pack, el sistema debe registrar:
- **50 unidades** de `ROLLO-TERMICO-80MM` en el análisis de ventas diarias

---

## 🏗️ Arquitectura del Sistema

### 1. **Tabla `packs`** (Composición)
Define qué productos y cantidades contiene cada pack.

```sql
SELECT * FROM packs WHERE pack_sku = 'PACK-ROLLOS-50';
```

**Resultado:**
| pack_sku | producto_sku | cantidad |
|----------|--------------|----------|
| PACK-ROLLOS-50 | ROLLO-TERMICO-80MM | 50 |

### 2. **Tabla `ventas`** (Ventas Registradas)
Registra las ventas, tanto de packs como de productos individuales.

```sql
SELECT * FROM ventas WHERE sku = 'PACK-ROLLOS-50';
```

**Resultado:**
| sku | cantidad | fecha_venta |
|-----|----------|-------------|
| PACK-ROLLOS-50 | 2 | 2025-10-15 |

### 3. **Vista `ventas_descompuestas`** (Descomposición Automática)
Automáticamente descompone packs en productos individuales.

```sql
SELECT * FROM ventas_descompuestas WHERE sku = 'ROLLO-TERMICO-80MM';
```

**Resultado:**
| sku | cantidad | fecha_venta | tipo_venta |
|-----|----------|-------------|------------|
| ROLLO-TERMICO-80MM | 50 | 2025-10-15 | producto |
| ROLLO-TERMICO-80MM | 100 | 2025-10-15 | pack_descompuesto |

**Total**: 150 unidades (50 directas + 100 de 2 packs)

### 4. **Vista Materializada `sku_venta_diaria_mv`** (Cálculo de Venta Diaria)
Calcula la venta diaria promedio **incluyendo packs descompuestos**.

```sql
SELECT * FROM sku_venta_diaria_mv WHERE sku = 'ROLLO-TERMICO-80MM';
```

**Resultado:**
| sku | venta_diaria | dias_con_ventas | cantidad_total_vendida | calculo_confiable |
|-----|--------------|-----------------|------------------------|-------------------|
| ROLLO-TERMICO-80MM | 5.67 | 45 | 510 | true |

---

## 🔄 Flujo Completo

### Paso 1: Cargar Composición del Pack
```sql
-- Ejecutar solo una vez por pack
INSERT INTO packs (pack_sku, producto_sku, cantidad) VALUES
('PACK-ROLLOS-50', 'ROLLO-TERMICO-80MM', 50);
```

O usar **Carga Masiva**:
1. Ir a `Carga Masiva`
2. Seleccionar tipo: `🎁 Packs`
3. Subir Excel con columnas:
   - `IDPack`: PACK-ROLLOS-50
   - `IDProducto`: ROLLO-TERMICO-80MM
   - `Cantidad`: 50

### Paso 2: Registrar Venta de Pack
```sql
-- Se registra igual que cualquier venta
INSERT INTO ventas (sku, cantidad, fecha_venta) VALUES
('PACK-ROLLOS-50', 2, '2025-10-15');
```

O usar **MercadoLibre API** que registra automáticamente.

### Paso 3: Sistema Descompone Automáticamente
La vista `ventas_descompuestas` automáticamente descompone:
- 2 packs × 50 unidades = **100 unidades de ROLLO-TERMICO-80MM**

### Paso 4: Actualizar Análisis (Diariamente)
```bash
npm run refresh-venta-diaria
```

O se actualiza automáticamente cada noche.

---

## ✅ Verificación del Sistema

### 1. Verificar que el Pack Existe
```sql
SELECT * FROM packs WHERE pack_sku = 'PACK-ROLLOS-50';
```

**Esperado**: 1 fila con cantidad = 50

### 2. Verificar Ventas del Pack
```sql
SELECT
    fecha_venta::DATE,
    SUM(cantidad) as packs_vendidos
FROM ventas
WHERE sku = 'PACK-ROLLOS-50'
GROUP BY fecha_venta::DATE
ORDER BY fecha_venta DESC;
```

### 3. Verificar Descomposición
```sql
SELECT
    fecha_venta::DATE,
    tipo_venta,
    SUM(cantidad) as unidades
FROM ventas_descompuestas
WHERE sku = 'ROLLO-TERMICO-80MM'
GROUP BY fecha_venta::DATE, tipo_venta
ORDER BY fecha_venta DESC;
```

**Esperado**:
- `producto`: Ventas directas del rollo
- `pack_descompuesto`: Ventas provenientes de packs

### 4. Verificar Venta Diaria Final
```sql
SELECT
    sku,
    venta_diaria,
    dias_con_ventas,
    cantidad_total_vendida,
    calculo_confiable
FROM sku_venta_diaria_mv
WHERE sku = 'ROLLO-TERMICO-80MM';
```

**Esperado**: `venta_diaria` debe incluir TODAS las unidades (directas + packs)

---

## 🚨 Problemas Comunes

### ❌ Problema 1: Venta Diaria Baja
**Síntoma**: El análisis muestra venta diaria muy baja para productos que se venden por packs.

**Causa**: Vista materializada no actualizada o no incluye packs.

**Solución**:
```bash
# 1. Actualizar vista materializada
npm run refresh-venta-diaria

# 2. O ejecutar SQL manualmente:
# scripts/update-venta-diaria-with-packs.sql
```

### ❌ Problema 2: Pack No Se Descompone
**Síntoma**: Ventas de pack no aparecen en análisis del producto individual.

**Causa**: Pack no registrado en tabla `packs`.

**Solución**:
```sql
-- Verificar si el pack existe
SELECT * FROM packs WHERE pack_sku = 'TU-PACK-SKU';

-- Si no existe, agregarlo
INSERT INTO packs (pack_sku, producto_sku, cantidad) VALUES
('TU-PACK-SKU', 'PRODUCTO-SKU', 50);
```

### ❌ Problema 3: Venta Diaria No Actualiza
**Síntoma**: Dashboard muestra datos antiguos.

**Causa**: Cache no actualizado o vista materializada obsoleta.

**Solución**:
```sql
-- 1. Refrescar vista materializada
SELECT refresh_venta_diaria_mv();

-- 2. Limpiar cache de dashboard
DELETE FROM dashboard_analysis_cache;
```

---

## 📋 Scripts Disponibles

### 1. Actualizar Vista Materializada
```bash
npm run refresh-venta-diaria
```

### 2. Verificar Packs en Base de Datos
```sql
-- Ver todos los packs
SELECT
    pack_sku,
    COUNT(*) as productos_en_pack,
    SUM(cantidad) as unidades_totales
FROM packs
GROUP BY pack_sku;
```

### 3. Ver Ventas Descompuestas del Último Mes
```sql
SELECT
    fecha_venta::DATE,
    sku,
    tipo_venta,
    SUM(cantidad) as cantidad
FROM ventas_descompuestas
WHERE fecha_venta >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY fecha_venta::DATE, sku, tipo_venta
ORDER BY fecha_venta DESC, sku;
```

---

## 🎯 Checklist para Productos que Solo se Venden por Packs

Si tienes productos como **rollos térmicos** que **SOLO se venden por packs de 50**:

1. ✅ **Crear el pack en la tabla `packs`**
   ```sql
   INSERT INTO packs (pack_sku, producto_sku, cantidad) VALUES
   ('PACK-ROLLOS-50', 'ROLLO-TERMICO-80MM', 50);
   ```

2. ✅ **Registrar ventas con el SKU del PACK** (no del producto individual)
   ```sql
   INSERT INTO ventas (sku, cantidad, fecha_venta) VALUES
   ('PACK-ROLLOS-50', 3, CURRENT_DATE);
   ```

3. ✅ **Actualizar vista materializada** después de cargar ventas
   ```bash
   npm run refresh-venta-diaria
   ```

4. ✅ **Verificar que el dashboard muestre correctamente**
   - Buscar el producto individual (ROLLO-TERMICO-80MM)
   - Verificar que venta diaria = (total de packs × 50) / días

---

## 📊 Ejemplo Real Completo

### Día 1: Configurar Pack
```sql
INSERT INTO packs (pack_sku, producto_sku, cantidad) VALUES
('PACK-ROLLOS-50', 'ROLLO-80MM', 50),
('PACK-ROLLOS-50', 'CINTA-ADHESIVA', 2);  -- El pack incluye 2 cintas gratis
```

### Día 2: Vender Packs
```sql
-- Se vendieron 3 packs
INSERT INTO ventas (sku, cantidad, fecha_venta) VALUES
('PACK-ROLLOS-50', 3, '2025-10-15');
```

### Día 3: Verificar Descomposición
```sql
-- Ver qué se registró en ventas_descompuestas
SELECT * FROM ventas_descompuestas WHERE fecha_venta = '2025-10-15';
```

**Resultado**:
| sku | cantidad | fecha_venta | tipo_venta |
|-----|----------|-------------|------------|
| ROLLO-80MM | 150 | 2025-10-15 | pack_descompuesto |
| CINTA-ADHESIVA | 6 | 2025-10-15 | pack_descompuesto |

### Día 4: Actualizar Análisis
```bash
npm run refresh-venta-diaria
```

### Día 5: Ver en Dashboard
- **ROLLO-80MM**: Venta diaria incluye las 150 unidades
- **CINTA-ADHESIVA**: Venta diaria incluye las 6 unidades

---

## 🔧 Mantenimiento

### Actualización Diaria Automática
El sistema debe ejecutar automáticamente cada noche:
```bash
npm run refresh-venta-diaria
```

### Actualización Manual
Si necesitas actualizar inmediatamente:
```sql
SELECT refresh_venta_diaria_mv();
```

---

## 📞 Soporte

Si tienes problemas:
1. Verificar que el pack esté en la tabla `packs`
2. Verificar que las ventas estén en la tabla `ventas`
3. Ejecutar `npm run refresh-venta-diaria`
4. Limpiar cache: `DELETE FROM dashboard_analysis_cache`
5. Revisar logs de la API en Netlify

---

**Fecha de actualización**: 2025-10-16
**Versión del sistema**: 2.0 con soporte completo de packs
