# 🔧 Guía de Migración de Base de Datos

## ❌ Error Actual
```
Error: Could not find the 'categoria' column of 'products' in the schema cache
```

## 🎯 Solución: Agregar Columnas Faltantes

El sistema de carga inteligente requiere campos adicionales en la tabla `products` que no existen actualmente.

### 📋 Campos a Agregar:

1. **`categoria`** (TEXT) - Categoría del producto
2. **`precio_venta_sugerido`** (DECIMAL) - Precio sugerido en CLP
3. **`proveedor`** (TEXT) - Nombre del proveedor
4. **`notas`** (TEXT) - Notas adicionales
5. **`codigo_interno`** (TEXT) - Código interno de la empresa

## 🚀 Métodos de Migración

### Opción 1: SQL Directo en Supabase (Recomendado)

1. Ve al **SQL Editor** en tu dashboard de Supabase
2. Copia y pega el contenido de `scripts/migrate-products-table.sql`
3. Ejecuta el script

### Opción 2: Usando la API de Migración

1. Desde tu aplicación como **admin**
2. Haz una petición POST a `/api/migrate-database`
3. El script se ejecutará automáticamente

### Opción 3: Manual por Columna

Si prefieres agregar una por una:

```sql
-- Agregar categoria
ALTER TABLE products ADD COLUMN categoria TEXT;

-- Agregar precio_venta_sugerido  
ALTER TABLE products ADD COLUMN precio_venta_sugerido DECIMAL(10,2);

-- Agregar proveedor
ALTER TABLE products ADD COLUMN proveedor TEXT;

-- Agregar notas
ALTER TABLE products ADD COLUMN notas TEXT;

-- Agregar codigo_interno
ALTER TABLE products ADD COLUMN codigo_interno TEXT;
```

## ✅ Verificación

Después de ejecutar la migración, verifica que las columnas existan:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN ('categoria', 'precio_venta_sugerido', 'proveedor', 'notas', 'codigo_interno')
ORDER BY column_name;
```

## 🔄 Después de la Migración

Una vez completada la migración:

1. ✅ Los archivos de productos podrán incluir todos los campos
2. ✅ Las actualizaciones sobrescribirán correctamente los valores
3. ✅ El mapeo inteligente reconocerá las nuevas columnas
4. ✅ El error de "columna no encontrada" desaparecerá

## 📊 Campos Soportados Post-Migración

**Campos Básicos:**
- `sku` ⭐ (obligatorio)
- `descripcion`
- `stock_actual`
- `costo_fob_rmb`
- `cbm`
- `link`
- `status`
- `desconsiderado`

**Campos Nuevos:**
- `categoria` 🆕
- `precio_venta_sugerido` 🆕
- `proveedor` 🆕
- `notas` 🆕
- `codigo_interno` 🆕

## 🛡️ Seguridad

- La migración es **segura** y no afecta datos existentes
- Solo **AGREGA** columnas, no modifica ni elimina nada
- Incluye verificaciones para evitar duplicar columnas
- Compatible con datos existentes

---

**Nota:** Esta migración es necesaria para usar el sistema de carga inteligente completo con todos los campos soportados.