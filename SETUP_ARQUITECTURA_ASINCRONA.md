# 🚀 Setup: Arquitectura Asíncrona para Netlify Free

## ✅ Archivos Creados

### 1. **Base de Datos**
- ✅ `scripts/create-processing-jobs-table.sql` - SQL para crear tabla
- ✅ `scripts/setup-processing-jobs.js` - Script de setup automatizado
- ✅ Bucket `job-files` en Supabase Storage (creado automáticamente)

### 2. **Backend (API)**
- ✅ `pages/api/import-by-action-async.js` - Endpoint para iniciar jobs
- ✅ `pages/api/job-status.js` - Endpoint para consultar status
- ✅ `scripts/process-import-jobs.js` - Worker de procesamiento

### 3. **Frontend**
- ✅ `pages/dashboard.js` - Actualizado con polling y UI de progreso

---

## 📋 Pasos para Completar el Setup

### Paso 1: Crear la Tabla en Supabase ⚠️ **REQUERIDO**

La tabla `processing_jobs` aún no existe. Tienes 2 opciones:

#### **Opción A: SQL Editor (Recomendado)**

1. Ve a: https://app.supabase.com/project/[tu-project-id]/sql/new
2. Copia el contenido de: `scripts/create-processing-jobs-table.sql`
3. Pega en el SQL Editor
4. Click en **"Run"**

#### **Opción B: Table Editor (Manual)**

1. Ve a: https://app.supabase.com/project/[tu-project-id]/editor
2. Click en **"New Table"**
3. Nombre: `processing_jobs`
4. Agregar estas columnas:

| Nombre | Tipo | Default | Nullable |
|--------|------|---------|----------|
| `id` | uuid | `gen_random_uuid()` | NO (PK) |
| `type` | varchar(50) | - | NO |
| `status` | varchar(20) | `'queued'` | NO |
| `file_url` | text | - | YES |
| `parameters` | jsonb | - | YES |
| `progress` | int4 | `0` | YES |
| `total_items` | int4 | - | YES |
| `processed_items` | int4 | `0` | YES |
| `results` | jsonb | - | YES |
| `error_message` | text | - | YES |
| `created_at` | timestamptz | `now()` | YES |
| `started_at` | timestamptz | - | YES |
| `completed_at` | timestamptz | - | YES |
| `created_by` | varchar(100) | - | YES |
| `ip_address` | inet | - | YES |

5. Crear índices:
```sql
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_type ON processing_jobs(type);
CREATE INDEX idx_processing_jobs_created_at ON processing_jobs(created_at DESC);
```

---

### Paso 2: Verificar que el Bucket Existe ✅ **YA CREADO**

El bucket `job-files` ya fue creado automáticamente. Verifica en:
https://app.supabase.com/project/[tu-project-id]/storage/buckets

Si no existe, créalo manualmente:
- Nombre: `job-files`
- Público: NO (privado)
- File size limit: 10 MB
- Allowed MIME types: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv`

---

### Paso 3: Iniciar el Worker de Procesamiento

El worker (`process-import-jobs.js`) procesa los jobs en segundo plano.

#### **En Desarrollo (Local)**

```bash
# Terminal separada
node scripts/process-import-jobs.js
```

Esto iniciará el worker que:
- Verifica jobs cada 10 segundos
- Procesa hasta 3 jobs simultáneamente
- Muestra progreso en consola

#### **En Producción (Netlify)**

Tienes 3 opciones:

**Opción A: Netlify Background Functions** (Recomendado si tienes Pro)
- Crear `netlify/functions/process-jobs-background.js`
- Configurar como background function
- Se ejecuta automáticamente

**Opción B: Scheduled Functions** (Netlify cualquier plan)
- Usar Netlify Scheduled Functions
- Se ejecuta cada X minutos automáticamente

**Opción C: Servicio Externo**
- Ejecutar worker en servidor separado (DigitalOcean, Heroku, etc.)
- Más complejo pero más control

---

## 🧪 Probar el Flujo Completo

### 1. **Preparar Archivo de Prueba**

Crea un Excel con una hoja llamada "Datos" y estas columnas:

| SKU | ✅ Acción | 📝 Cantidad a Cotizar | 📝 Comentarios |
|-----|-----------|----------------------|----------------|
| TEST-001 | SI | 100 | Prueba async |
| TEST-002 | SI | 50 | Segunda prueba |

### 2. **Iniciar Worker** (en terminal separada)

```bash
node scripts/process-import-jobs.js
```

Deberías ver:
```
🚀 Iniciando worker de procesamiento de jobs...
📊 Configuración:
   - Polling interval: 10s
   - Max concurrent jobs: 3
   - Batch size: 100
```

### 3. **Subir Archivo en Dashboard**

1. Abre: http://localhost:3012/dashboard
2. Click en **"Subir Excel con Acciones"**
3. Selecciona tu archivo de prueba
4. Deberías ver:
   - "Procesando archivo en segundo plano..."
   - Barra de progreso azul animada
   - Progreso actualizándose cada 3 segundos

### 4. **Verificar en Worker**

En la terminal del worker deberías ver:

```
📦 Encontrados 1 job(s) pendiente(s)

🚀 Procesando job: abc123-def456...
   Tipo: import_by_action
   Archivo: mi-archivo.xlsx
📥 Descargando archivo...
✅ Archivo descargado
📖 Leyendo Excel...
📊 Encontradas 2 filas
🔍 Acción detectada: request_quote
📦 Procesando batch 1/1
✅ Cache invalidado
✅ Job completado en 3s
   Éxitos: 2, Errores: 0
```

### 5. **Verificar en Dashboard**

Después de 3-6 segundos, deberías ver:
- ✅ "¡Importación completada exitosamente!"
- Progreso: 100%
- Total: 2 | Exitosos: 2 | Errores: 0

---

## 🔍 Troubleshooting

### Error: "Could not find the table 'public.processing_jobs'"

**Causa**: La tabla no existe en Supabase

**Solución**: Ejecuta el SQL del Paso 1

---

### Error: "Bucket job-files does not exist"

**Causa**: El bucket no fue creado

**Solución**:
```bash
node scripts/setup-processing-jobs.js
```

O créalo manualmente en Supabase Storage.

---

### Worker no procesa jobs

**Causa**: Worker no está corriendo

**Solución**:
```bash
# Verificar que el worker esté corriendo
ps aux | grep process-import-jobs

# Si no está corriendo, iniciarlo
node scripts/process-import-jobs.js
```

---

### Jobs se quedan en "queued" forever

**Causas posibles**:

1. **Worker no corriendo**
   ```bash
   node scripts/process-import-jobs.js
   ```

2. **Error en worker** - Ver logs en terminal del worker

3. **Archivo no descargable** - Verificar permisos del bucket

---

### Polling se detiene

**Causa**: Error en frontend o timeout

**Solución**: Refrescar página y revisar console (F12)

---

## 📊 Monitoring

### Ver Jobs en Supabase

```sql
-- Jobs pendientes
SELECT * FROM processing_jobs
WHERE status = 'queued'
ORDER BY created_at ASC;

-- Jobs en proceso
SELECT * FROM processing_jobs
WHERE status = 'processing';

-- Jobs completados hoy
SELECT * FROM processing_jobs
WHERE status = 'completed'
  AND created_at >= CURRENT_DATE;

-- Jobs fallidos
SELECT * FROM processing_jobs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- Estadísticas
SELECT
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds
FROM processing_jobs
WHERE completed_at IS NOT NULL
GROUP BY status;
```

### Limpiar Jobs Antiguos

```sql
-- Manualmente (mayores a 30 días)
DELETE FROM processing_jobs
WHERE created_at < NOW() - INTERVAL '30 days'
  AND status IN ('completed', 'failed');

-- Usando función
SELECT clean_old_processing_jobs();
```

---

## 🎯 Próximos Pasos

### Corto Plazo

1. ✅ Probar localmente
2. ⏳ Deploy a Netlify
3. ⏳ Configurar worker en Netlify (Scheduled Function o Background)

### Mediano Plazo

4. Extender a otros endpoints largos:
   - `/api/export-by-status` → `/api/export-by-status-async`
   - `/api/bulk-upload` → Ya usa batches, evaluar si necesita async

5. Agregar notificaciones:
   - Email cuando job completa
   - Webhook a Slack/Discord

### Largo Plazo

6. Dashboard de jobs:
   - Ver todos los jobs activos
   - Cancelar jobs
   - Reintent failed jobs

7. Métricas:
   - Tiempo promedio de procesamiento
   - Tasa de éxito/error
   - Jobs por hora

---

## 📚 Referencias

- [Netlify Background Functions](https://docs.netlify.com/functions/background-functions/)
- [Netlify Scheduled Functions](https://docs.netlify.com/functions/scheduled-functions/)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Job Queue Pattern](https://www.patterns.dev/posts/job-queue-pattern)

---

## ✅ Checklist de Implementación

- [ ] Tabla `processing_jobs` creada en Supabase
- [ ] Bucket `job-files` existe en Supabase Storage
- [ ] Worker local funcionando (`node scripts/process-import-jobs.js`)
- [ ] Upload de archivo de prueba exitoso
- [ ] Progreso visible en dashboard
- [ ] Job procesado y completado
- [ ] Worker configurado en Netlify (producción)

---

**Última actualización**: 17 de octubre de 2025
**Versión**: 1.0
**Status**: ✅ IMPLEMENTACIÓN COMPLETA - LISTO PARA TESTING
