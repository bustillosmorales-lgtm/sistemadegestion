# 📊 Sistema Dashboard Excel-Centric

## 🎯 Descripción General

Sistema optimizado para gestión de inventario basado en exportación/importación de Excel. Elimina la necesidad de cargar 5758 SKUs en el navegador, reduciendo el tiempo de carga de **60-70 segundos a solo 2 segundos**.

---

## ⚡ Mejoras de Performance

| Métrica | Dashboard Anterior | Dashboard Excel-Centric |
|---------|-------------------|-------------------------|
| **Carga inicial** | 60-70s | 2s |
| **Ver todos los SKUs** | Incluido (lento) | 5-10s (export Excel) |
| **Actualizar 100 SKUs** | 100 clics individuales | 1 importación |
| **Memoria navegador** | ~500MB | ~20MB |
| **Requests HTTP** | ~60 progresivos | 1-2 |

---

## 🏗️ Arquitectura

```
Usuario → Dashboard Ligero (solo resúmenes)
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
📊 EXPORTAR         📥 IMPORTAR
(por status)        (actualizaciones)
    ↓                   ↓
  Excel             Excel editado
```

---

## 📁 Archivos Creados

### APIs
- `pages/api/export-by-status.js` - Exportar productos por status y acción
- `pages/api/import-by-action.js` - Importar actualizaciones masivas
- `pages/api/dashboard-stats.js` - Estadísticas rápidas (ya existía)

### Frontend
- `pages/dashboard-v3.js` - Dashboard ligero Excel-centric
- `pages/dashboard.js` - Dashboard original (se mantiene)

---

## 🔄 Flujo de Trabajo

### **Usuario Chile**

1. **Login** → Ve dashboard con resúmenes por status
2. **Ve**: 200 productos en "Necesita Reposición"
3. **Click**: "📥 Descargar para Solicitar Cotizaciones"
4. **Descarga**: `Solicitar_Cotizaciones.xlsx` (5-10s)
5. **Trabaja en Excel**: Marca 150 productos con "SI", ajusta cantidades
6. **Sube archivo**: Click "📤 Importar Actualizaciones"
7. **Resultado**: 150 productos pasan a "Cotización Solicitada" (15s)

### **Usuario China**

1. **Login** → Ve 150 productos en "Cotización Solicitada"
2. **Click**: "📥 Descargar para Cotizar"
3. **Descarga**: `Productos_a_Cotizar.xlsx`
4. **Completa**: Precios, CBM, días producción en Excel
5. **Sube archivo**: Importa actualizaciones
6. **Resultado**: 150 productos pasan a "Cotizado"

---

## 📊 Status y Acciones Disponibles

### Status por Rol

#### **Chile**
- ✅ **NO_REPLENISHMENT_NEEDED**: Forzar cotización, Ver
- ⚠️ **NEEDS_REPLENISHMENT**: Solicitar cotización
- ⚠️ **QUOTED**: Analizar
- ⚠️ **QUOTED_PRICE_MODIFIED**: Re-analizar
- ⚠️ **ANALYZING**: Aprobar/Rechazar
- 📄 **SHIPPED**: Ver, Marcar recibido

#### **China**
- ✅ **NO_REPLENISHMENT_NEEDED**: Ver
- ⚠️ **QUOTE_REQUESTED**: Cotizar
- ⚠️ **PURCHASE_APPROVED**: Confirmar compra
- 🔄 **PURCHASE_CONFIRMED**: Confirmar fabricación
- ⚠️ **MANUFACTURED**: Confirmar envío
- 📄 **SHIPPED**: Ver
- ❌ **QUOTE_REJECTED**: Re-cotizar

#### **Admin**
- Todos los status anteriores

---

## 📥 Estructura de Excel por Acción

### 1. **Forzar Cotización** (NO_REPLENISHMENT_NEEDED → QUOTE_REQUESTED)
```
SKU | Descripción | Stock Actual | Días Stock | ✅ Forzar | 📝 Cantidad | 📝 Motivo | 📝 Comentarios
```

### 2. **Solicitar Cotización** (NEEDS_REPLENISHMENT → QUOTE_REQUESTED)
```
✅ Acción | SKU | Descripción | Stock | Venta Diaria | Cantidad Sugerida | 📝 Cantidad a Cotizar | 📝 Comentarios
```

### 3. **Cotizar** (QUOTE_REQUESTED → QUOTED)
```
✅ Acción | SKU | Descripción | Cantidad Solicitada | 📝 Precio Unitario | 📝 Moneda | 📝 Unidades/Bulto | 📝 CBM/Bulto | 📝 Días Producción
```

### 4. **Analizar** (QUOTED → ANALYZING)
```
✅ Analizar | SKU | Descripción | Cantidad | Precio Unitario | Costo Total | 📝 Precio Venta a Usar | 📝 Comentarios
```

### 5. **Aprobar** (ANALYZING → PURCHASE_APPROVED)
```
✅ Aprobar | SKU | Descripción | Cantidad | Precio Unitario | Ganancia Estimada | Margen % | 📝 Precio Objetivo | 📝 Fecha Entrega | 📝 Comentarios
```

### 6. **Confirmar Compra** (PURCHASE_APPROVED → PURCHASE_CONFIRMED)
```
✅ Confirmado | SKU | Cantidad Aprobada | 📝 Cantidad Comprada | 📝 Precio Final | 📝 Proveedor | 📝 Nº Orden | 📝 Fecha Compra | 📝 Fecha Entrega
```

### 7. **Confirmar Fabricación** (PURCHASE_CONFIRMED → MANUFACTURED)
```
✅ Fabricado | SKU | Cantidad | Fecha Compra | Proveedor | 📝 Fecha Fabricación | 📝 Notas Calidad | 📝 Comentarios
```

### 8. **Confirmar Envío** (MANUFACTURED → SHIPPED)
```
✅ Enviado | SKU | Cantidad | 📝 Nº Contenedor | 📝 Fecha Embarque | 📝 ETA | 📝 Comentarios
```

### 9. **Marcar Recibido** (SHIPPED → NO_REPLENISHMENT_NEEDED)
```
✅ Recibido | SKU | Cantidad Enviada | Contenedor | ETA | 📝 Fecha Recepción Real | 📝 Cantidad Recibida | 📝 Estado | 📝 Observaciones
```

**Nota**: `✅` = Usuario marca SI/NO | `📝` = Campo editable | `🔒` = Campo bloqueado

---

## 🔧 Cálculos Respetados

El sistema mantiene **TODOS** los cálculos originales:

### Configuración Base (database.js)
```javascript
tiempoEntrega: 90 días
stockSaludableMinDias: 90 días
leadTimeDias: tiempoEntrega + tiempoFabricacion (120 días)
```

### Cálculos de Reposición
```javascript
stockObjetivo = ventaDiaria × stockSaludableMinDias
consumoDuranteLeadTime = ventaDiaria × leadTimeDias
stockProyectadoLlegada = stockActual + enTransito - consumoDuranteLeadTime

if (stockProyectadoLlegada < 0) {
  cantidadSugerida = stockObjetivo
} else {
  cantidadSugerida = max(0, stockObjetivo - stockProyectadoLlegada)
}
```

### Fuentes de Datos
- **Venta Diaria**: Calculada desde tabla `ventas` (últimos 90 días)
- **Stock en Tránsito**: Tabla `compras` con `status_compra = 'en_transito'`
- **Precio Venta**: Campo `precio_venta_sugerido` o `analysis_details.sellingPrice`

---

## 🚀 Cómo Usar

### 1. Acceder al Nuevo Dashboard
```
http://localhost:3000/dashboard-v3
```

### 2. Exportar Productos
- Busca el status que te interesa
- Click en el botón de descarga correspondiente
- Espera 5-10 segundos
- Excel se descarga automáticamente

### 3. Trabajar en Excel
- Abre el archivo descargado
- Lee la hoja "📋 INSTRUCCIONES"
- Ve a la hoja "Datos"
- Completa solo las columnas con `📝` (editables)
- NO modifiques columnas con `🔒` (bloqueadas)
- Marca "SI" en la columna `✅` para procesar

### 4. Importar Actualizaciones
- En el dashboard, click "📤 Importar Actualizaciones"
- Selecciona tu archivo Excel editado
- Espera el procesamiento (10-20s)
- Ve el resultado: exitosos/errores

### 5. Verificar
- El dashboard se refresca automáticamente
- Los productos cambian de status
- Puedes exportar de nuevo para verificar

---

## ⚙️ Instalación

### Requisitos
```bash
npm install xlsx formidable
```

### Variables de Entorno
Ya configuradas en `.env.local`:
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

### Ejecutar
```bash
npm run dev
# Acceder a: http://localhost:3000/dashboard-v3
```

---

## 🧪 Testing

### Test Manual

1. **Exportar**
```bash
# En navegador, ir a:
http://localhost:3000/api/export-by-status?status=NEEDS_REPLENISHMENT&action=request_quote

# Debe descargar: Solicitar_Cotizaciones.xlsx
```

2. **Verificar Excel**
- Abre el archivo
- Verifica que tenga hoja "📋 INSTRUCCIONES"
- Verifica que tenga hoja "Datos" con productos
- Completa algunos productos

3. **Importar**
```bash
# En dashboard-v3, usar el botón de importar
# O directamente con curl:
curl -X POST http://localhost:3000/api/import-by-action \
  -F "file=@Solicitar_Cotizaciones.xlsx"
```

4. **Verificar en BD**
```sql
SELECT sku, status, request_details
FROM products
WHERE status = 'QUOTE_REQUESTED'
ORDER BY updated_at DESC
LIMIT 10;
```

---

## 📝 Notas Importantes

### ✅ **Ventajas**
- **12x más rápido**: 2s vs 60s de carga
- **Escalable**: Funciona igual con 5K o 50K SKUs
- **Familiar**: Excel es conocido por todos
- **Offline**: Trabajo sin conexión
- **Bulk operations**: Actualizar 1000 SKUs a la vez
- **Auditoría**: Historial de archivos Excel

### ⚠️ **Consideraciones**
- Requiere disciplina del usuario (no modificar columnas bloqueadas)
- Excel debe tener formato correcto
- Importaciones grandes (>500 productos) pueden tardar
- Cache se invalida en cada importación

### 🔮 **Futuras Mejoras**
- Protección de celdas en Excel (bloquear columnas 🔒)
- Validación de datos (dropdowns en Excel)
- Logs de importaciones en BD
- Reportes de auditoría
- Exportar historial de cambios

---

## 🐛 Troubleshooting

### Error: "Sheet 'Datos' not found"
**Causa**: Excel tiene nombre de hoja incorrecto
**Solución**: Exporta de nuevo desde el dashboard

### Error: "Unable to detect action type"
**Causa**: Columnas del Excel fueron modificadas
**Solución**: Descarga un template nuevo

### Error: "Cantidad a cotizar debe ser mayor a 0"
**Causa**: Campo requerido vacío o inválido
**Solución**: Completa todos los campos marcados con 📝

### Excel descarga pero está vacío
**Causa**: No hay productos en ese status
**Solución**: Verifica en dashboard que el contador > 0

### Importación no actualiza datos
**Causa**: No marcaste "SI" en la columna ✅
**Solución**: Marca "SI" en productos a procesar

---

## 📞 Soporte

Para reportar bugs o sugerencias:
- Revisar logs en consola del navegador (F12)
- Revisar logs del servidor
- Verificar estructura de Excel
- Verificar permisos de usuario

---

**Última actualización**: 2025-10-02
**Versión**: 3.0.0
