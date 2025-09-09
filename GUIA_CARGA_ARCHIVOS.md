# 📋 Guía de Carga de Archivos - Sistema de Gestión

## 🎯 Problemas Solucionados

### ✅ 1. Contenedores - Fecha Real de Llegada
**PROBLEMA**: El sistema pedía fecha real de llegada para todos los contenedores.
**SOLUCIÓN**: 
- Ahora la fecha real de llegada es **OPCIONAL**
- Solo se requiere para contenedores que ya llegaron
- Contenedores en tránsito pueden cargarse sin fecha real
- El sistema automáticamente detecta el estado basado en los datos

### ✅ 2. Productos - Reconocimiento de SKU
**PROBLEMA**: El sistema no reconocía SKUs en diferentes formatos.
**SOLUCIÓN**:
- Mapeo inteligente de columnas mejorado
- Reconoce múltiples variantes de nombres de columna para SKU:
  - `sku`, `SKU`, `codigo`, `código`, `cod`, `id`, `referencia`, `ref`, `modelo`
- Limpieza automática de caracteres especiales en SKUs
- Detección de SKUs sin mapear en los datos originales

## 📁 Formatos de Archivo Soportados

- **Excel**: .xlsx, .xls
- **CSV**: Separado por comas, punto y coma, tabs
- **TSV**: Separado por tabs
- **JSON**: Array de objetos
- **TXT**: Texto delimitado (detección automática)

## 📊 Tipos de Datos y Campos

### 🚢 **Contenedores**
**Campos Requeridos:**
- `container_number` - Número único del contenedor

**Campos Opcionales:**
- `container_type` - Tipo (STD por defecto)
- `max_cbm` - Capacidad (68 por defecto)
- `departure_port` - Puerto de salida
- `arrival_port` - Puerto de llegada
- `estimated_departure` - Fecha estimada de salida
- `estimated_arrival` - Fecha estimada de llegada
- `actual_arrival_date` - **OPCIONAL** - Solo para contenedores llegados
- `shipping_company` - Naviera
- `notes` - Notas

### 📦 **Productos**
**Campos Requeridos:**
- `sku` - Código único del producto

**Campos Opcionales:**
- `descripcion` - Descripción del producto
- `categoria` - Categoría
- `stock_actual` - Stock disponible
- `costo_fob_rmb` - Costo FOB en RMB
- `cbm` - Volumen en metros cúbicos
- `link` - Enlace web
- `status` - Estado (NEEDS_REPLENISHMENT por defecto)

### 🛒 **Compras**
**Campos Requeridos:**
- `sku` - Código del producto
- `cantidad` - Cantidad comprada

**Campos Opcionales:**
- `fecha_compra` - Fecha de compra
- `fecha_llegada_estimada` - Fecha estimada de llegada
- `fecha_llegada_real` - Fecha real (opcional si en tránsito)
- `status_compra` - Estado (en_transito por defecto)
- `container_number` - Número de contenedor
- `proveedor` - Proveedor

### 📈 **Ventas**
**Campos Requeridos:**
- `sku` - Código del producto
- `cantidad` - Cantidad vendida

**Campos Opcionales:**
- `fecha_venta` - Fecha de venta
- `numero_venta` - Número de venta (se genera automáticamente)
- `precio_venta_clp` - Precio de venta

## 🔍 Sistema de Reconocimiento Inteligente

### 📋 **Mapeo Automático de Columnas**
El sistema reconoce automáticamente columnas con nombres similares:

**Para SKU:**
- `sku`, `SKU`, `codigo`, `código`, `cod`, `id`, `referencia`, `ref`, `modelo`, `part_number`

**Para Fechas:**
- `fecha`, `date`, `arrival`, `departure`, `llegada`, `salida`, `eta`, `etd`

**Para Cantidades:**
- `cantidad`, `qty`, `quantity`, `units`, `unidades`, `stock`

### 🎯 **Detección de Tipo de Archivo**
El sistema detecta automáticamente qué tipo de datos contiene tu archivo:
1. **Contenedores**: Si encuentra números de contenedor, puertos, navieras
2. **Compras**: Si encuentra proveedores, fechas de llegada, contenedores
3. **Ventas**: Si encuentra SKU + cantidad sin datos de contenedor/proveedor
4. **Productos**: Si encuentra descripciones, categorías, stock, costos

### ⚠️ **Validaciones Inteligentes**

**Contenedores:**
- ✅ Solo número de contenedor es obligatorio
- ⚠️ Advertencia si falta fecha real (normal para contenedores en tránsito)
- ⚠️ Advertencia si faltan puertos

**Productos:**
- ✅ Solo SKU es obligatorio
- 🔍 Detecta SKUs no mapeados en datos originales
- ⚠️ Valida formato de SKU
- ⚠️ Recomienda incluir descripción

**Compras/Ventas:**
- ✅ SKU y cantidad obligatorios
- 🔍 Busca SKUs no mapeados
- ✅ Genera números de compra/venta automáticamente si no existen

## 📋 **Características Especiales**

### 🔄 **Procesamiento Automático**
- **Productos nuevos**: Se crean automáticamente si no existen
- **Contenedores nuevos**: Se crean automáticamente desde datos de compra
- **Duplicados**: Se detectan y reportan sin crear registros duplicados
- **Fechas**: Conversión automática de múltiples formatos

### 📈 **Reporte de Resultados**
Después de cada carga obtienes:
- ✅ Registros nuevos creados
- 🔄 Registros actualizados/duplicados
- ❌ Errores encontrados
- 📦 Productos nuevos auto-creados
- 🚢 Contenedores nuevos auto-creados

### 🎨 **Flexibilidad Total**
- **Sin encabezados fijos**: El sistema mapea automáticamente
- **Múltiples idiomas**: Reconoce términos en español e inglés
- **Formatos de fecha flexibles**: DD/MM/YYYY, YYYY-MM-DD, números Excel
- **Caracteres especiales**: Limpieza automática de comillas, espacios

## 💡 **Consejos para Mejores Resultados**

1. **Usa nombres descriptivos** en tus columnas (ej: "codigo_producto" es mejor que "col1")
2. **Mantén consistencia** en los formatos de fecha
3. **Revisa las advertencias** - te ayudan a mejorar la calidad de datos
4. **Usa el template de productos** para actualizar productos existentes
5. **Para contenedores en tránsito**, simplemente deja vacía la fecha real de llegada

## 🚀 **Flujo Recomendado**

1. **Descarga el template** correspondiente a tu tipo de datos
2. **Completa los datos** usando los nombres de columna del template
3. **Sube el archivo** - el sistema detectará automáticamente el tipo
4. **Revisa el análisis** de calidad y mapeo automático
5. **Corrige advertencias** si es necesario
6. **Confirma la carga** para procesar los datos

---

*Sistema mejorado con IA para reconocimiento inteligente de datos* 🤖✨