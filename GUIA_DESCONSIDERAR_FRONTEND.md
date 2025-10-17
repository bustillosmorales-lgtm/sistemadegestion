# 📋 Guía: Desconsiderar Productos desde el Frontend

## 🎯 Pasos Completos

### Paso 1: Preparar tu Excel

Toma el Excel que ya tienes (con los 1180 productos) y modifícalo así:

#### **IMPORTANTE: Solo necesitas 2 columnas**

1. **Abre tu Excel actual** (el que tiene los 1180 SKUs)
2. **Elimina TODAS las columnas** excepto `SKU`
3. **Agrega UNA nueva columna** llamada: `✅ Desconsiderar`
4. **Marca "SI"** en cada fila que quieras desconsiderar

#### Ejemplo de cómo debe quedar:

```
| SKU       | ✅ Desconsiderar |
|-----------|------------------|
| 010918VE  | SI               |
| 01HR3309  | SI               |
| 0         | SI               |
| ...       | SI               |
```

#### **MUY IMPORTANTE**:

- ✅ La hoja debe llamarse: **"Datos"**
- ✅ Solo 2 columnas: `SKU` y `✅ Desconsiderar`
- ✅ NO incluyas otras columnas (Cantidad, Precio, etc.)
- ✅ El valor debe ser exactamente: **"SI"** (mayúsculas)

#### Atajo para marcar todos como "SI":

1. En la celda B2 (primera celda de "✅ Desconsiderar"), escribe: **SI**
2. Copia esa celda (Ctrl + C)
3. Selecciona desde B2 hasta B1181 (todas las filas con SKUs)
4. Pega (Ctrl + V)

---

### Paso 2: Guardar el Excel

1. **Archivo → Guardar como...**
2. Nombre sugerido: `Desconsiderar_1180.xlsx`
3. **Importante**: Verificar que la hoja se llama "Datos"
   - Si no, renombra la hoja haciendo clic derecho → Cambiar nombre → "Datos"

---

### Paso 3: Subir en el Dashboard

#### A. Ir al Dashboard

1. Abre tu navegador
2. Ve a: **http://localhost:3012/dashboard**
3. Si no estás logueado, inicia sesión

#### B. Buscar el Botón Correcto

**⚠️ NO uses "Importar Actualizaciones"**

Busca un botón que diga algo como:
- "Subir Excel con Acciones"
- O un botón de upload genérico sin especificar tipo

**Si no ves un botón específico para esto**, usa el de "Importar Actualizaciones" temporalmente, pero SOLO después de verificar que tu Excel tiene exactamente las 2 columnas mencionadas.

#### C. Subir Archivo

1. Click en el botón de upload
2. Selecciona tu archivo: `Desconsiderar_1180.xlsx`
3. Click en "Abrir"

---

### Paso 4: Ver el Progreso

Deberías ver:

```
⏳ Procesando archivo en segundo plano...

Job ID: abc-123-def-456

Progreso: ░░░░░░░░░░░░░░░░░░░░ 0%
Status: queued
Tiempo transcurrido: 00:05
```

**Espera máximo 10-15 segundos** (el worker local está corriendo cada 10s)

Luego verás:

```
⏳ Procesando archivo en segundo plano...

Job ID: abc-123-def-456

Progreso: ████████████████████ 100%
Status: processing
Tiempo transcurrido: 00:45
```

Y finalmente:

```
✅ ¡Importación completada exitosamente!

Total: 1180 | Exitosos: 1180 | Errores: 0

Action: mark_desconsiderado
```

---

### Paso 5: Verificar Resultados

#### A. Refrescar Dashboard

1. Presiona: **Ctrl + Shift + R** (hard refresh)
2. Espera a que cargue

#### B. Verificar "Necesita Reposición"

El número de productos en "Necesita Reposición" debería ser:
- **Antes**: 1180+ productos
- **Después**: 0-50 productos (solo los que realmente necesitan reposición)

#### C. Verificar en Base de Datos (Opcional)

Si quieres confirmar en Supabase:

```sql
SELECT COUNT(*) as total_desconsiderados
FROM products
WHERE desconsiderado = true;

-- Debería mostrar: 1180 (o el número que procesaste)
```

---

## 🎯 Resumen Visual del Proceso

```
1. Tu Excel actual (1180 filas)
   ↓
2. Eliminar columnas (dejar solo SKU)
   ↓
3. Agregar columna "✅ Desconsiderar"
   ↓
4. Marcar "SI" en todas las filas
   ↓
5. Guardar como Excel (hoja "Datos")
   ↓
6. Subir en dashboard (localhost:3012)
   ↓
7. Ver progreso (0% → 100%)
   ↓
8. ✅ Completado!
   ↓
9. Hard refresh (Ctrl + Shift + R)
   ↓
10. Verificar: "Necesita Reposición" con menos productos
```

---

## 📊 Template de Excel

Si quieres empezar desde cero, crea un Excel así:

**Archivo**: `template_desconsiderar.xlsx`
**Hoja**: `Datos`

```
SKU         | ✅ Desconsiderar
------------|------------------
010918VE    | SI
01HR3309    | SI
0           | SI
```

Luego agrega todos tus SKUs en la columna A.

---

## 🔧 Troubleshooting

### "Unknown action type"

**Causa**: El Excel no tiene la columna `✅ Desconsiderar` o está mal escrita

**Solución**:
- Verifica que la columna se llama EXACTAMENTE: `✅ Desconsiderar`
- Incluye el emoji ✅
- Si no tienes el emoji, cópialo de aquí: ✅

### "No marcado para procesar"

**Causa**: Las celdas no tienen "SI"

**Solución**:
- Verifica que todas las filas tengan "SI" en la columna `✅ Desconsiderar`
- Debe ser mayúsculas: **SI** (no "si" ni "Si")

### "SKU missing"

**Causa**: Hay filas sin SKU

**Solución**:
- Elimina las filas vacías
- Verifica que la columna SKU no tenga celdas vacías

### Productos siguen apareciendo

**Causa**: Cache del browser

**Solución**:
- Hard refresh: **Ctrl + Shift + R**
- O cerrar y abrir el navegador

---

## ⏱️ Tiempos Esperados

| Productos | Tiempo de Upload | Tiempo de Procesamiento | Total |
|-----------|------------------|-------------------------|-------|
| 10        | < 3s             | < 5s                    | ~8s   |
| 100       | < 3s             | ~10s                    | ~13s  |
| 1000      | < 3s             | ~30s                    | ~33s  |
| 1180      | < 3s             | ~35s                    | ~38s  |

---

## ✅ Checklist de Pre-Upload

Antes de subir, verifica:

- [ ] Excel tiene SOLO 2 columnas: `SKU` y `✅ Desconsiderar`
- [ ] La hoja se llama "Datos"
- [ ] Todas las filas tienen "SI" en `✅ Desconsiderar`
- [ ] No hay filas vacías
- [ ] El servidor local está corriendo (localhost:3012)
- [ ] El worker está corriendo (ver terminal con logs)

---

## 🎉 Después del Proceso

Una vez que completes el proceso:

1. Los 1180 productos tendrán `desconsiderado = true`
2. NO aparecerán en "Necesita Reposición"
3. NO se generarán cotizaciones para ellos
4. Puedes re-considerarlos cuando quieras con SQL:
   ```sql
   UPDATE products
   SET desconsiderado = false
   WHERE sku IN ('SKU-001', 'SKU-002');
   ```

---

**Creado**: 17 de octubre de 2025
**Servidor Local**: ✅ Corriendo en localhost:3012
**Worker Local**: ✅ Corriendo y procesando jobs
**Estado**: 100% Listo para usar
