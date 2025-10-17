# 📋 Cómo Desconsiderar Productos

## ⚠️ Problema que tuviste

Intentaste usar el botón **"📤 Importar Actualizaciones"** para desconsiderar productos, pero ese botón es para **actualizar** datos (ventas, compras, stock), NO para desconsiderar.

Por eso obtuviste el error: "Cantidad inválida" para los 1180 productos.

---

## ✅ Soluciones Disponibles

Ahora tienes **3 formas** de desconsiderar productos:

### **Opción 1: Usar SQL Directamente** (Más Rápido - Recomendado)

Si tienes muchos productos (1180 como mencionaste), usa SQL.

1. **Descarga el Excel** de "Necesita Reposición"
2. **Copia la columna SKU** completa
3. **Abre Supabase SQL Editor**
4. **Ejecuta este SQL**:

```sql
UPDATE products
SET desconsiderado = true
WHERE sku IN (
  '010918VE',
  '01HR3309',
  '0',
  -- ... pega aquí todos los SKUs, separados por comas
  'SKU-N'
);
```

**CONSEJO**: Para convertir los SKUs del Excel a formato SQL:
1. En Excel, crea una nueva columna con la fórmula: `="'" & A2 & "',"`
2. Copia toda esa columna
3. Pégala en el SQL entre los paréntesis
4. Ejecuta el UPDATE

**Archivo de ayuda**: `DESCONSIDERAR_PRODUCTOS_MASIVO.sql` tiene ejemplos completos

---

### **Opción 2: Usar Excel con Botón Correcto** (Nuevo - Implementado Ahora)

He agregado la funcionalidad para desconsiderar desde el dashboard.

#### Paso 1: Preparar Excel

1. Descarga el Excel de "Necesita Reposición"
2. **Elimina TODAS las columnas** excepto `SKU`
3. **Agrega una nueva columna**: `✅ Desconsiderar`
4. **Marca "SI"** en cada fila que quieras desconsiderar

**Ejemplo**:

| SKU       | ✅ Desconsiderar |
|-----------|------------------|
| 010918VE  | SI               |
| 01HR3309  | SI               |
| 0         | SI               |

5. **Guarda el archivo** con hoja llamada "Datos"

#### Paso 2: Subir en el Dashboard

1. Ve a: http://localhost:3012/dashboard (o producción)
2. **Busca el botón**: NO uses "Importar Actualizaciones"
3. **Busca**: Botón de upload async (el que creamos para evitar 504)
4. Sube tu Excel preparado
5. El sistema detectará automáticamente la acción "mark_desconsiderado"
6. Procesará en segundo plano

---

### **Opción 3: Desconsiderar por Condiciones** (SQL Avanzado)

Si quieres desconsiderar según criterios, usa estas queries:

#### Productos sin ventas en 90 días

```sql
UPDATE products
SET desconsiderado = true
WHERE sku NOT IN (
  SELECT DISTINCT sku
  FROM sales
  WHERE sale_date >= CURRENT_DATE - INTERVAL '90 days'
);
```

#### Productos con stock muy alto

```sql
UPDATE products
SET desconsiderado = true
WHERE stock > 1000;
```

#### Productos con CBM alto

```sql
UPDATE products
SET desconsiderado = true
WHERE cbm > 0.5;
```

---

## 🔄 Re-considerar (Volver a Activos)

Si desconsideraste productos por error:

```sql
-- Re-considerar productos específicos
UPDATE products
SET desconsiderado = false
WHERE sku IN (
  'SKU-001',
  'SKU-002'
);

-- Re-considerar TODOS
UPDATE products
SET desconsiderado = false;
```

---

## ✅ Verificar Resultados

Después de desconsiderar, verifica con estas queries:

### Ver cuántos desconsideraste

```sql
SELECT
  COUNT(*) as total_desconsiderados
FROM products
WHERE desconsiderado = true;
```

### Ver lista de desconsiderados

```sql
SELECT
  sku,
  description,
  stock,
  desconsiderado
FROM products
WHERE desconsiderado = true
ORDER BY sku
LIMIT 50;
```

### Resumen completo

```sql
SELECT
  CASE
    WHEN desconsiderado = true THEN '❌ Desconsiderados'
    WHEN desconsiderado = false THEN '✅ Activos'
    ELSE '⚠️ Sin definir (NULL)'
  END as estado,
  COUNT(*) as total
FROM products
GROUP BY desconsiderado
ORDER BY desconsiderado;
```

---

## 🎯 Comparación de Métodos

| Método | Velocidad | Facilidad | Cuando Usar |
|--------|-----------|-----------|-------------|
| SQL directo | ⚡⚡⚡ Muy rápido | Requiere SQL | Muchos productos (1000+) |
| Excel + Dashboard | ⚡ Normal | Fácil | Pocos productos (< 100) |
| SQL por condiciones | ⚡⚡ Rápido | Requiere lógica | Criterios específicos |

---

## 📋 Ejemplo Práctico Completo

**Escenario**: Desconsiderar 1180 productos de "Necesita Reposición"

### Método 1 (SQL - Recomendado):

1. Descarga Excel de "Necesita Reposición"
2. Abre Excel
3. En columna B, escribe: `="'" & A2 & "',"`
4. Arrastra fórmula hasta fila 1181
5. Copia toda la columna B
6. Abre Supabase SQL Editor
7. Escribe:
   ```sql
   UPDATE products
   SET desconsiderado = true
   WHERE sku IN (
   ```
8. Pega los SKUs copiados
9. Agrega `);` al final
10. Ejecuta

**Resultado**: 1180 productos desconsiderados en < 5 segundos

### Método 2 (Excel):

1. Descarga Excel
2. Elimina todas las columnas excepto SKU
3. Agrega columna `✅ Desconsiderar`
4. Marca "SI" en todas las filas
5. Sube en dashboard con botón async
6. Espera máximo 5-10 minutos

**Resultado**: 1180 productos desconsiderados (toma más tiempo)

---

## ⚠️ Importante

### ❌ NO uses estos botones:
- **"Importar Actualizaciones"** → Es para actualizar ventas/stock
- Cualquier botón que pida columnas de cantidad/precio

### ✅ USA:
- **SQL directo** para 1000+ productos
- **Botón async** con Excel preparado para < 100 productos

---

## 🔧 Troubleshooting

### "Cantidad inválida" al subir Excel

**Causa**: Estás usando el botón equivocado o tu Excel tiene columnas incorrectas

**Solución**:
1. Verifica que tu Excel SOLO tenga: `SKU` y `✅ Desconsiderar`
2. Usa el botón async correcto
3. O mejor aún: usa SQL directo

### Productos siguen apareciendo en "Necesita Reposición"

**Causa**: Cache del dashboard o desconsiderado = NULL

**Solución**:
1. Hard refresh: `Ctrl + Shift + R`
2. Ejecuta el fix de NULL:
   ```sql
   UPDATE products
   SET desconsiderado = false
   WHERE desconsiderado IS NULL;
   ```

### No encuentro el botón async en dashboard

**Causa**: Código viejo o no desplegado

**Solución**: Usa SQL directo (Opción 1)

---

## 📊 Archivos de Ayuda

1. **`DESCONSIDERAR_PRODUCTOS_MASIVO.sql`**
   - Ejemplos de SQL completos
   - Copy-paste ready

2. **`FIX_DESCONSIDERADO_NULL.sql`**
   - Fix para productos con NULL

3. **`VERIFICAR_SETUP_PRODUCCION.sql`**
   - Verificar sistema completo

---

## 🎉 Resumen

Para tus 1180 productos:

1. **Más rápido**: SQL directo (< 5 segundos)
2. **Más fácil**: Excel + SQL converter (< 1 minuto)
3. **Más visual**: Excel + Dashboard (5-10 minutos)

**Recomendación**: Usa **SQL directo** con la fórmula de Excel para convertir SKUs.

---

**Creado**: 17 de octubre de 2025
**Funcionalidad agregada**: Acción "mark_desconsiderado" en workers
