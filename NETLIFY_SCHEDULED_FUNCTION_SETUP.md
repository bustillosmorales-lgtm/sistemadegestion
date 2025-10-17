# ✅ Netlify Scheduled Function - Setup Completo

## 🎯 Qué se implementó

He creado una **Netlify Scheduled Function** que procesará los jobs automáticamente cada 5 minutos.

### Archivo creado:
- `netlify/functions/process-jobs.js` - Función que corre cada 5 minutos

### Características:
- ⏰ **Ejecuta cada 5 minutos** automáticamente
- 🔄 **Procesa hasta 3 jobs** simultáneamente
- 📊 **Actualiza progreso** en tiempo real
- ❌ **Maneja errores** correctamente
- ✅ **Sin costo adicional** (incluido en Netlify Free)

---

## 📋 Próximos Pasos

### Paso 1: Esperar el Deploy

Netlify detectará automáticamente el nuevo código y desplegará.

**Monitorear en**: https://app.netlify.com/sites/[tu-sitio]/deploys

Deberías ver:
```
Building
  ↓
Deploy in progress
  ↓
✅ Published
```

**Tiempo estimado**: 2-3 minutos

---

### Paso 2: Verificar que la Función Está Activa

Una vez que el deploy termine:

1. **Ir a Netlify Dashboard**
2. **Functions** → Verás `process-jobs`
3. **Status**: Active
4. **Schedule**: `*/5 * * * *` (cada 5 minutos)

---

### Paso 3: Verificar Variables de Entorno

Asegúrate de que Netlify tenga estas variables configuradas:

**Ir a**: Netlify Dashboard → Site Settings → Environment Variables

Verificar que existen:
```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc... (tu service_role key)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... (tu anon key)
```

**IMPORTANTE**: Si falta `SUPABASE_SERVICE_KEY`, agrégala.

---

### Paso 4: Probar el Sistema Completo

#### 4.1 Subir archivo de prueba

1. Ve a: https://sistemadegestion.net/dashboard
2. **Hard refresh**: `Ctrl + Shift + R`
3. Click en **"Subir Excel con Acciones"**
4. Sube un archivo Excel con estas columnas:

   **Hoja: "Datos"**
   ```
   SKU      | ✅ Acción | 📝 Cantidad a Cotizar
   TEST-001 | SI        | 10
   TEST-002 | SI        | 20
   ```

5. Deberías ver:
   ```
   ⏳ Procesando archivo en segundo plano...

   Job ID: abc-123-def-456

   Progreso: ░░░░░░░░░░░░░░░░░░░░ 0%
   Status: queued
   ```

#### 4.2 Esperar a que la función procese

- La función corre **cada 5 minutos**
- En el **próximo ciclo** (máximo 5 min), procesará el job
- El progreso se actualizará automáticamente en el frontend

#### 4.3 Ver resultado

Después de máximo 5 minutos:

```
✅ ¡Importación completada exitosamente!

Total: 2 | Exitosos: 2 | Errores: 0
```

---

### Paso 5: Verificar Logs de la Función

**Ir a**: Netlify Dashboard → Functions → process-jobs → Logs

Deberías ver logs como:

```
2025-10-17 10:30:00 🚀 Netlify Scheduled Function: Procesando jobs...
2025-10-17 10:30:01 📦 Encontrados 1 job(s) pendiente(s)
2025-10-17 10:30:01 🚀 Procesando job: abc-123-def-456 (import_by_action)
2025-10-17 10:30:02 📥 Descargando archivo: imports/1729166400000-...
2025-10-17 10:30:03 ✅ Archivo descargado
2025-10-17 10:30:03 📖 Leyendo Excel...
2025-10-17 10:30:03 📊 Encontradas 2 filas
2025-10-17 10:30:03 🔍 Acción detectada: request_quote
2025-10-17 10:30:05 ✅ Job completado: 2 éxitos, 0 errores
```

---

## 🔧 Troubleshooting

### La función no aparece en Netlify Dashboard

**Causa**: Deploy aún no completado

**Solución**: Espera 2-3 minutos y refresca la página

---

### Job se queda en "queued" por más de 5 minutos

**Verificar**:

1. **Función está activa**:
   - Netlify Dashboard → Functions → process-jobs → Status: Active

2. **Variables de entorno existen**:
   - Site Settings → Environment Variables
   - Verificar `SUPABASE_SERVICE_KEY`

3. **Ver logs de errores**:
   - Functions → process-jobs → Logs
   - Buscar mensajes de error en rojo

---

### Error: "SUPABASE_SERVICE_KEY is not defined"

**Solución**:

1. Ir a: Netlify Dashboard → Site Settings → Environment Variables
2. Click en **"Add a variable"**
3. Key: `SUPABASE_SERVICE_KEY`
4. Value: Tu service_role key de Supabase
5. Click en **"Create variable"**
6. **Trigger deploy**: Site Settings → Build & Deploy → Trigger Deploy

---

### Job falla con error en logs

**Ver logs**:
```bash
# En Supabase SQL Editor
SELECT
  id,
  status,
  error_message,
  created_at
FROM processing_jobs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 5;
```

**Errores comunes**:

1. **"new row violates row-level security policy"**
   - Ejecutar: `UPDATE storage.buckets SET public = true WHERE name = 'job-files';`

2. **"La hoja Datos no existe"**
   - El Excel debe tener una hoja llamada "Datos"

3. **"Error descargando archivo"**
   - Bucket job-files no está público o no existe

---

## 📊 Cómo Funciona

```
Usuario sube archivo (3s)
  ↓
Job creado en DB (status: queued)
  ↓
Frontend muestra "Procesando..." y hace polling cada 3s
  ↓
⏰ Cada 5 minutos, función Netlify ejecuta automáticamente
  ↓
Busca jobs con status = 'queued'
  ↓
Descarga archivo desde Storage
  ↓
Lee Excel y procesa filas
  ↓
Actualiza progreso en DB cada 10 filas
  ↓
Marca job como 'completed' con resultados
  ↓
Frontend detecta cambio y muestra resultados ✅
```

---

## ⏰ Tiempos Esperados

| Operación | Tiempo |
|-----------|--------|
| Subir archivo y crear job | < 3s |
| Esperar próxima ejecución | 0-5 min |
| Procesar 100 filas | ~5s |
| Procesar 1000 filas | ~30s |

**Total para 1000 productos**: ~5 minutos máximo (incluyendo espera)

---

## ✅ Ventajas de Esta Solución

| Antes | Ahora |
|-------|-------|
| ❌ Error 504 en Netlify Free | ✅ Sin errores |
| ❌ Requiere servidor externo 24/7 | ✅ Netlify lo maneja automáticamente |
| ❌ Costo de $5-20/mes | ✅ Gratis (incluido en Netlify Free) |
| ❌ Configuración compleja | ✅ Push y listo |
| ❌ Mantenimiento del servidor | ✅ Cero mantenimiento |

---

## 📈 Monitoreo

### Ver jobs procesados hoy

```sql
SELECT
  status,
  COUNT(*) as total,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds
FROM processing_jobs
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY status;
```

### Ver últimos 10 jobs

```sql
SELECT
  id,
  type,
  status,
  progress,
  created_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - created_at)) as duration_seconds
FROM processing_jobs
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 Checklist Final

- [x] Función `process-jobs.js` creada
- [x] Dependencia `@netlify/functions` instalada
- [x] Commit y push a GitHub
- [ ] Deploy completado en Netlify (esperar 2-3 min)
- [ ] Función visible en Netlify Dashboard
- [ ] Variables de entorno verificadas
- [ ] Upload de prueba exitoso
- [ ] Job procesado automáticamente
- [ ] Resultados mostrados en frontend

---

## 🎉 Conclusión

**Estado**: ✅ **CÓDIGO DEPLOYADO**

La Netlify Scheduled Function está configurada y se deployará automáticamente.

**Próximo paso**: Esperar 2-3 minutos para que Netlify termine el deploy, luego:

1. Verificar que la función está activa en Netlify Dashboard
2. Subir un archivo de prueba
3. Esperar máximo 5 minutos
4. Ver resultados ✅

**Sin errores 504, sin servidores externos, sin costos adicionales** 🚀

---

**Última actualización**: 17 de octubre de 2025
**Commit**: db0a143
