# 🎯 Instrucciones Finales - Arquitectura Asíncrona

## ✅ Lo que ya está hecho

1. ✅ Bucket `job-files` creado en Supabase Storage
2. ✅ Endpoint asíncrono: `/api/import-by-action-async.js`
3. ✅ Endpoint de status: `/api/job-status.js`
4. ✅ Worker de procesamiento: `scripts/process-import-jobs.js`
5. ✅ Frontend actualizado con polling y barra de progreso
6. ✅ Documentación completa

## ⚠️ LO QUE FALTA: Crear la tabla en Supabase

La tabla `processing_jobs` necesita ser creada manualmente en Supabase.

---

## 📋 OPCIÓN 1: Copiar y Pegar SQL (MÁS FÁCIL)

### Paso 1: Abrir SQL Editor de Supabase

1. Ve a: https://supabase.com
2. Selecciona tu proyecto
3. Click en **"SQL Editor"** (icono </>)  en el menú lateral izquierdo
4. Click en **"+ New query"**

### Paso 2: Copiar este SQL

```sql
-- Crear tabla processing_jobs
CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  file_url TEXT,
  parameters JSONB,
  progress INTEGER DEFAULT 0,
  total_items INTEGER,
  processed_items INTEGER DEFAULT 0,
  results JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(100),
  ip_address INET
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_type ON processing_jobs(type);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at DESC);

-- Verificar
SELECT 'Tabla creada exitosamente' as mensaje;
```

### Paso 3: Ejecutar

1. Pega el SQL en el editor
2. Click en **"Run"** (o presiona Ctrl+Enter)
3. Deberías ver: ✅ "Success. No rows returned"

---

## 📋 OPCIÓN 2: Table Editor (Interfaz Gráfica)

Si prefieres usar la interfaz gráfica:

### Paso 1: Crear Tabla

1. Ve a: **"Table Editor"** en Supabase
2. Click en **"New Table"**
3. Nombre: `processing_jobs`
4. Descripción: "Jobs asíncronos para imports"
5. **NO marcar** "Enable Row Level Security" (por ahora)

### Paso 2: Agregar Columnas

Haz click en **"Add Column"** para cada una:

| Nombre | Tipo | Default | Nullable | Primary Key |
|--------|------|---------|----------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | ❌ | ✅ |
| `type` | `varchar` | - | ❌ | ❌ |
| `status` | `varchar` | `'queued'` | ❌ | ❌ |
| `file_url` | `text` | - | ✅ | ❌ |
| `parameters` | `jsonb` | - | ✅ | ❌ |
| `progress` | `int4` | `0` | ✅ | ❌ |
| `total_items` | `int4` | - | ✅ | ❌ |
| `processed_items` | `int4` | `0` | ✅ | ❌ |
| `results` | `jsonb` | - | ✅ | ❌ |
| `error_message` | `text` | - | ✅ | ❌ |
| `created_at` | `timestamptz` | `now()` | ✅ | ❌ |
| `started_at` | `timestamptz` | - | ✅ | ❌ |
| `completed_at` | `timestamptz` | - | ✅ | ❌ |
| `created_by` | `varchar` | - | ✅ | ❌ |
| `ip_address` | `inet` | - | ✅ | ❌ |

### Paso 3: Crear Índices

Después de crear la tabla, ve al SQL Editor y ejecuta:

```sql
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_type ON processing_jobs(type);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at DESC);
```

---

## ✅ Verificar que Todo Funciona

### 1. Verificar Tabla

```bash
node scripts/setup-processing-jobs.js
```

Deberías ver:
```
✅ ¡La tabla processing_jobs existe!
   Registros actuales: 0
✅ Bucket "job-files" ya existe
✅ Setup completado exitosamente!
```

### 2. Iniciar Worker (Terminal separada)

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

### 3. Probar Upload

1. Abre: http://localhost:3012/dashboard
2. Crea un archivo Excel de prueba con:
   - Hoja llamada "Datos"
   - Columnas: `SKU`, `✅ Acción`, `📝 Cantidad a Cotizar`
   - Ejemplo:
     ```
     SKU          | ✅ Acción | 📝 Cantidad a Cotizar
     TEST-001     | SI        | 100
     TEST-002     | SI        | 50
     ```
3. Click en **"Subir Excel con Acciones"**
4. Selecciona tu archivo
5. Deberías ver:
   - ⏳ "Procesando archivo en segundo plano..."
   - Barra de progreso azul animada
   - Progreso: 0% → 50% → 100%
   - ✅ "¡Importación completada exitosamente!"

### 4. Verificar en Worker

En la terminal del worker deberías ver:

```
📦 Encontrados 1 job(s) pendiente(s)

🚀 Procesando job: abc-123-def...
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

---

## 🚨 Troubleshooting

### "Could not find the table 'processing_jobs'"

**Solución**: La tabla no está creada. Ejecuta el SQL del paso 2 arriba.

---

### Worker no procesa jobs

**Solución**: Asegúrate de que el worker está corriendo:

```bash
# Ver procesos
ps aux | grep process-import-jobs

# Si no está corriendo
node scripts/process-import-jobs.js
```

---

### Jobs se quedan en "queued"

**Causas**:
1. Worker no está corriendo → Iniciarlo
2. Error en worker → Ver logs en terminal
3. Tabla no existe → Crear tabla

---

## 🚀 Deploy a Producción (Netlify)

Una vez que todo funcione localmente:

### 1. Commit y Push

```bash
git add .
git commit -m "feat: Implementar arquitectura asíncrona para Netlify Free"
git push origin main
```

### 2. Configurar Worker en Netlify

**Opción A: Scheduled Function** (Recomendado)

Crear `netlify/functions/process-jobs.js`:

```javascript
const { schedule } = require('@netlify/functions');
const { processJobs } = require('../../scripts/process-import-jobs');

exports.handler = schedule('*/5 * * * *', async () => {
  // Ejecuta cada 5 minutos
  await processJobs();
  return { statusCode: 200 };
});
```

**Opción B: Servidor Externo**

Ejecutar `scripts/process-import-jobs.js` en:
- DigitalOcean ($5/mes)
- Heroku (gratis con dyno)
- Railway (gratis)
- Render (gratis)

---

## 📊 Queries Útiles

```sql
-- Ver jobs pendientes
SELECT * FROM processing_jobs
WHERE status = 'queued'
ORDER BY created_at ASC;

-- Ver jobs en progreso
SELECT * FROM processing_jobs
WHERE status = 'processing';

-- Ver últimos 10 jobs completados
SELECT * FROM processing_jobs
WHERE status = 'completed'
ORDER BY completed_at DESC
LIMIT 10;

-- Estadísticas
SELECT
  status,
  COUNT(*) as total,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds
FROM processing_jobs
WHERE completed_at IS NOT NULL
GROUP BY status;

-- Limpiar jobs antiguos (más de 30 días)
DELETE FROM processing_jobs
WHERE created_at < NOW() - INTERVAL '30 days'
  AND status IN ('completed', 'failed');
```

---

## 📚 Archivos de Referencia

| Archivo | Propósito |
|---------|-----------|
| `CREATE_TABLE_SIMPLE.sql` | SQL para crear tabla (usa este) |
| `DIAGNOSTICO_NETLIFY_504.md` | Análisis del problema original |
| `SETUP_ARQUITECTURA_ASINCRONA.md` | Guía completa de arquitectura |
| `pages/api/import-by-action-async.js` | Endpoint async (backend) |
| `pages/api/job-status.js` | Consultar progreso (backend) |
| `scripts/process-import-jobs.js` | Worker de procesamiento |

---

## ✅ Checklist Final

- [ ] Tabla `processing_jobs` creada en Supabase
- [ ] Verificación con `node scripts/setup-processing-jobs.js` exitosa
- [ ] Worker corriendo: `node scripts/process-import-jobs.js`
- [ ] Servidor Next.js corriendo: `PORT=3012 npm run dev`
- [ ] Upload de archivo de prueba exitoso
- [ ] Progreso visible en dashboard
- [ ] Job procesado correctamente
- [ ] Resultados mostrados en UI

---

**¡Listo para usar!** 🎉

Una vez que completes el checklist, el sistema funcionará tanto en Netlify Free como localmente sin problemas de timeout.

---

**Última actualización**: 17 de octubre de 2025
**Status**: ⚠️ FALTA CREAR TABLA EN SUPABASE
