# 🚀 Deploy a Producción (Netlify)

## ⚠️ Situación Actual

**Producción** (sistemadegestion.net):
- ❌ Tiene el código viejo (endpoint síncrono)
- ❌ Error 504 porque excede 10 segundos
- ❌ NO tiene arquitectura asíncrona

**Local** (localhost:3012):
- ✅ Tiene arquitectura asíncrona implementada
- ✅ Endpoints async creados
- ⚠️ Falta fix de permisos de Storage

---

## 📋 Pasos para Deploy

### Paso 1: Commit de Cambios

```bash
# Ver qué archivos cambiaron
git status

# Agregar todos los archivos nuevos
git add .

# Commit con mensaje descriptivo
git commit -m "feat: Implementar arquitectura asíncrona para evitar 504 en Netlify

- Crear tabla processing_jobs en Supabase
- Nuevo endpoint /api/import-by-action-async (< 10s)
- Endpoint /api/job-status para consultar progreso
- Worker scripts/process-import-jobs.js
- Frontend con polling y barra de progreso
- Fix permisos de Storage con SQL

Fixes #504 - Timeout en imports largos"

# Push a GitHub/GitLab
git push origin main
```

### Paso 2: Netlify Auto-Deploy

Netlify detectará el push automáticamente y:
1. Comenzará build (~2-3 minutos)
2. Ejecutará `npm run build`
3. Desplegará automáticamente

**Monitorear en**: https://app.netlify.com/sites/[tu-sitio]/deploys

### Paso 3: Configurar Variables de Entorno en Netlify

Asegúrate de que Netlify tenga TODAS estas variables:

```bash
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# MercadoLibre (si usas)
ML_CLIENT_ID=
ML_CLIENT_SECRET=

# Otros
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://sistemadegestion.net
```

**Configurar en**: Netlify Dashboard → Site Settings → Environment Variables

### Paso 4: Ejecutar SQL en Supabase (Producción)

Los mismos SQL que ejecutaste en local:

#### A. Crear tabla `processing_jobs`

```sql
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

CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_type ON processing_jobs(type);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at DESC);
```

#### B. Configurar bucket `job-files`

```sql
-- Hacer público para que service_role pueda usarlo
UPDATE storage.buckets
SET public = true
WHERE name = 'job-files';
```

**Si el bucket no existe**, créalo en: Storage → New Bucket → "job-files"

### Paso 5: Configurar Worker en Netlify

El worker necesita correr para procesar los jobs. Tienes 3 opciones:

#### **Opción A: Netlify Scheduled Functions** (Recomendado)

Crear archivo `netlify/functions/scheduled-jobs.js`:

```javascript
const { schedule } = require('@netlify/functions');
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Ejecutar cada 5 minutos
exports.handler = schedule('*/5 * * * *', async () => {
  console.log('🚀 Procesando jobs...');

  try {
    // Buscar jobs pendientes
    const { data: jobs, error } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(3);

    if (error || !jobs || jobs.length === 0) {
      console.log('No hay jobs pendientes');
      return { statusCode: 200 };
    }

    console.log(`Procesando ${jobs.length} jobs`);

    // Procesar cada job
    for (const job of jobs) {
      await processJob(job);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ processed: jobs.length })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
});

async function processJob(job) {
  // Implementar lógica de procesamiento
  // (simplificada - ver scripts/process-import-jobs.js para versión completa)

  await supabase
    .from('processing_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', job.id);

  // ... procesar archivo ...

  await supabase
    .from('processing_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      results: { success: true }
    })
    .eq('id', job.id);
}
```

Luego:
```bash
git add netlify/functions/scheduled-jobs.js
git commit -m "feat: Agregar scheduled function para procesar jobs"
git push
```

#### **Opción B: Servidor Externo** (Más Simple)

Ejecutar `scripts/process-import-jobs.js` en un servidor 24/7:

**Railway** (Gratis):
1. Ir a: https://railway.app
2. New Project → Deploy from GitHub
3. Seleccionar tu repo
4. Configurar variables de entorno
5. Start command: `node scripts/process-import-jobs.js`

**Render** (Gratis):
1. Ir a: https://render.com
2. New → Background Worker
3. Seleccionar repo
4. Start command: `node scripts/process-import-jobs.js`

**DigitalOcean** ($5/mes):
```bash
# SSH al droplet
ssh root@tu-ip

# Clonar repo
git clone https://github.com/tu-usuario/tu-repo.git
cd tu-repo

# Instalar dependencias
npm install

# Configurar .env
nano .env.local
# (pegar variables de entorno)

# Instalar PM2
npm install -g pm2

# Iniciar worker
pm2 start scripts/process-import-jobs.js --name "jobs-worker"
pm2 save
pm2 startup
```

#### **Opción C: Sin Worker** (Testing)

Para testing temporal, puedes procesar jobs manualmente desde tu PC:

```bash
# En tu PC
node scripts/process-import-jobs.js
```

Pero esto NO es para producción (se detiene cuando cierras la terminal).

---

## ✅ Verificar Deploy

### 1. Verificar Build Exitoso

https://app.netlify.com/sites/[tu-sitio]/deploys

Debería mostrar: ✅ Published

### 2. Probar Endpoint Async

```bash
# Debería responder en < 3s
curl -X GET https://sistemadegestion.net/api/job-status?job_id=test
```

Respuesta esperada:
```json
{
  "error": "Job not found",
  "job_id": "test"
}
```

Esto confirma que el endpoint existe y funciona.

### 3. Probar Upload

1. Ir a: https://sistemadegestion.net/dashboard
2. Hard refresh: `Ctrl + Shift + R`
3. Subir archivo Excel
4. Deberías ver:
   - ⏳ "Procesando archivo en segundo plano..."
   - Barra de progreso animada
   - NO error 504

### 4. Verificar Job en DB

```sql
SELECT * FROM processing_jobs
ORDER BY created_at DESC
LIMIT 5;
```

Deberías ver el job con:
- `status = 'queued'` (si worker no está corriendo)
- `status = 'processing'` o `'completed'` (si worker está corriendo)

---

## 🔧 Troubleshooting

### Error: "Could not find table processing_jobs"

**Solución**: Ejecutar SQL del Paso 4A en Supabase

### Error: "new row violates row-level security policy"

**Solución**: Ejecutar SQL del Paso 4B en Supabase

### Jobs se quedan en "queued" forever

**Causa**: Worker no está corriendo

**Solución**:
- Opción A: Configurar Scheduled Function
- Opción B: Iniciar servidor externo
- Opción C: Correr worker local temporalmente

### Build falla en Netlify

Ver logs en: Netlify Dashboard → Deploys → [último deploy] → Deploy log

Causas comunes:
- Falta dependencia en `package.json`
- Error de sintaxis en código
- Variables de entorno faltantes

---

## 📊 Monitoreo Post-Deploy

### Netlify Functions Logs

Ver en: Netlify Dashboard → Functions → [función] → Logs

### Supabase Logs

Ver en: Supabase Dashboard → Logs

### Jobs en DB

```sql
-- Estadísticas hoy
SELECT
  status,
  COUNT(*) as total,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds
FROM processing_jobs
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY status;

-- Últimos 10 jobs
SELECT
  id,
  type,
  status,
  progress,
  created_at,
  completed_at
FROM processing_jobs
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 Checklist de Deploy

- [ ] Commit y push de todos los cambios
- [ ] Build exitoso en Netlify
- [ ] Variables de entorno configuradas
- [ ] Tabla `processing_jobs` creada en Supabase
- [ ] Bucket `job-files` configurado (público)
- [ ] Worker configurado (Scheduled Function o servidor externo)
- [ ] Hard refresh del navegador (Ctrl + Shift + R)
- [ ] Probar upload de archivo
- [ ] Verificar job en DB
- [ ] Verificar que worker procesa jobs

---

## 🎉 Resultado Esperado

Después del deploy:

1. **Usuario sube archivo** → < 3s
2. **Job creado en DB** → `status = 'queued'`
3. **Frontend muestra progreso** → Barra animada
4. **Worker procesa job** → Actualiza progreso cada lote
5. **Job completa** → `status = 'completed'`
6. **Frontend muestra resultados** → ✅ Éxitos y errores

**SIN ERROR 504** ✅

---

**Próximo paso**: Hacer commit y push para iniciar deploy.

¿Necesitas ayuda con alguno de estos pasos?
