# 🚨 Diagnóstico: Errores 504 en Netlify

## 📋 Resumen Ejecutivo

**Problema**: Errores 504 (Gateway Timeout) en endpoints `/api/import-by-action` y otros endpoints de larga duración en Netlify.

**Causa Principal**: **CONFLICTO DE CONFIGURACIÓN** entre `netlify.toml` y `vercel.json` + límites de Netlify Free Tier.

**Severidad**: 🔴 **CRÍTICA** - Los endpoints de importación y exportación no funcionan en producción.

---

## 🔍 Problemas Identificados

### 1. 🎯 **Problema Principal: Configuración Contradictoria**

El proyecto tiene **DOS archivos de configuración incompatibles**:

#### `netlify.toml` (Archivo para Netlify)
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

#### `vercel.json` (Archivo para Vercel)
```json
{
  "functions": {
    "api/bulk-upload.js": {
      "maxDuration": 60
    },
    "api/**/*.js": {
      "maxDuration": 30
    }
  }
}
```

**❌ Problema**: Netlify **NO LEE** `vercel.json`. Los timeouts de 60 segundos no se aplican.

---

### 2. ⏱️ **Límites de Timeout de Netlify**

| Plan | Límite de Timeout por Función |
|------|-------------------------------|
| **Netlify Free** | ⏱️ **10 segundos** |
| Netlify Pro | 26 segundos |
| Netlify Business | 26 segundos |

**🔴 Funciones Afectadas** (exceden 10 segundos):

| Endpoint | Timeout Configurado | Funciona en Netlify Free |
|----------|---------------------|--------------------------|
| `/api/import-by-action` | ❌ No configurado | ❌ NO (504 error) |
| `/api/export-by-status` | 60 segundos (vercel.json) | ❌ NO (504 error) |
| `/api/export-compras` | 60 segundos (vercel.json) | ❌ NO (504 error) |
| `/api/export-contenedores` | 60 segundos (vercel.json) | ❌ NO (504 error) |
| `/api/bulk-upload` | 60 segundos (vercel.json) | ❌ NO (504 error) |
| `/api/background-analyzer` | 30 segundos (vercel.json) | ❌ NO (504 error) |
| `/api/refresh-system` | 300 segundos (vercel.json) | ❌ NO (504 error) |
| `/api/update-cache` | 300 segundos (vercel.json) | ❌ NO (504 error) |

---

### 3. 🎭 **Endpoint Problemático: `import-by-action.js`**

#### Problemas específicos:

```javascript
// pages/api/import-by-action.js
export const config = {
  api: {
    bodyParser: false,  // ✅ Correcto para formidable
  },
  // ❌ FALTA: maxDuration
};
```

**¿Qué hace este endpoint?**

1. Parsea archivo Excel con `formidable`
2. Lee y procesa datos con `XLSX`
3. Detecta tipo de acción (8 tipos posibles)
4. Procesa cada fila con múltiples queries a Supabase
5. Invalida cache completo de dashboard
6. Devuelve resultados

**Tiempo estimado**: 15-60 segundos (depende del tamaño del archivo)

**Límite en Netlify Free**: ⏱️ **10 segundos** → ❌ **TIMEOUT GARANTIZADO**

---

### 4. 🐌 **Operaciones Lentas Detectadas**

#### En `import-by-action.js`:

```javascript
// Líneas 23-28: Parseo de archivo con formidable
const [fields, files] = await new Promise((resolve, reject) => {
  form.parse(req, (err, fields, files) => {
    // ⏱️ 2-5 segundos para archivos grandes
  });
});

// Líneas 36-45: Lectura de Excel
const fileBuffer = fs.readFileSync(file.filepath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
// ⏱️ 1-3 segundos

// Líneas 65: Procesamiento de CADA fila
const results = await processImport(data, action);
// ⏱️ 0.5-1 segundo POR FILA × N filas

// Líneas 69-76: Invalidación de cache
await supabase
  .from('dashboard_analysis_cache')
  .delete()
  .gt('sku', ''); // Eliminar TODO el cache
// ⏱️ 2-5 segundos
```

**Total estimado**: 10-60 segundos → **SIEMPRE excede límite de Netlify Free**

---

## ✅ Soluciones

### 🎯 **Solución 1: Configurar Timeout en Netlify (Recomendado)**

#### Opción A: Actualizar `netlify.toml` con funciones serverless

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "18"

[[plugins]]
  package = "@netlify/plugin-nextjs"

# ✅ NUEVO: Configurar timeouts de funciones
[functions]
  # Endpoints de importación y procesamiento largo
  "api/import-by-action" = { timeout = 30 }
  "api/bulk-upload" = { timeout = 30 }
  "api/background-analyzer" = { timeout = 30 }

  # Endpoints de exportación
  "api/export-by-status" = { timeout = 30 }
  "api/export-compras" = { timeout = 30 }
  "api/export-contenedores" = { timeout = 30 }
  "api/export-ventas" = { timeout = 30 }

  # Endpoints de mantenimiento
  "api/update-cache" = { timeout = 30 }
  "api/refresh-system" = { timeout = 30 }
  "api/refresh-materialized-view" = { timeout = 30 }

# Configuración por defecto para otras funciones
[[headers]]
  for = "/api/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
```

**⚠️ IMPORTANTE**: Esto requiere **Netlify Pro** (26 segundos max) o **Business** (26 segundos max).

Con **Netlify Free** (10 segundos max), necesitas la Solución 2.

---

### 🎯 **Solución 2: Arquitectura Asíncrona (Para Netlify Free)**

#### Paso 1: Crear endpoint de "inicio de job"

```javascript
// pages/api/import-by-action-async.js
export const config = {
  api: { bodyParser: false },
  maxDuration: 10, // 10 segundos - OK para Netlify Free
};

export default async function handler(req, res) {
  // 1. Subir archivo a Supabase Storage (2-3 segundos)
  const fileUrl = await uploadToSupabaseStorage(file);

  // 2. Crear job en tabla "processing_jobs"
  const { data: job } = await supabase
    .from('processing_jobs')
    .insert({
      type: 'import_by_action',
      file_url: fileUrl,
      status: 'queued',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  // 3. Devolver job_id inmediatamente
  return res.status(202).json({
    success: true,
    job_id: job.id,
    message: 'Job creado, procesando en segundo plano'
  });
}
```

#### Paso 2: Crear worker que procesa en background

```javascript
// scripts/process-import-jobs.js
// Ejecutar desde Netlify Functions o como Background Job

async function processJobs() {
  // 1. Buscar jobs pendientes
  const { data: jobs } = await supabase
    .from('processing_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(10);

  for (const job of jobs) {
    // 2. Marcar como "processing"
    await supabase
      .from('processing_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id);

    // 3. Descargar archivo de Supabase Storage
    const fileBuffer = await downloadFromStorage(job.file_url);

    // 4. Procesar (SIN LÍMITE DE TIEMPO)
    const results = await processImport(fileBuffer);

    // 5. Guardar resultados
    await supabase
      .from('processing_jobs')
      .update({
        status: 'completed',
        results: results,
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id);
  }
}

// Ejecutar cada minuto
setInterval(processJobs, 60000);
```

#### Paso 3: Endpoint para consultar estado

```javascript
// pages/api/job-status.js
export const config = {
  maxDuration: 5, // Rápido - OK para Netlify Free
};

export default async function handler(req, res) {
  const { job_id } = req.query;

  const { data: job } = await supabase
    .from('processing_jobs')
    .select('*')
    .eq('id', job_id)
    .single();

  return res.json({
    status: job.status, // "queued" | "processing" | "completed" | "failed"
    progress: job.progress,
    results: job.status === 'completed' ? job.results : null
  });
}
```

#### Paso 4: Actualizar frontend

```javascript
// pages/dashboard.js
async function importFile(file) {
  // 1. Iniciar job
  const response = await fetch('/api/import-by-action-async', {
    method: 'POST',
    body: formData
  });

  const { job_id } = await response.json();

  // 2. Mostrar mensaje al usuario
  setMessage('Procesando archivo en segundo plano...');

  // 3. Polling para verificar estado
  const checkStatus = async () => {
    const statusResponse = await fetch(`/api/job-status?job_id=${job_id}`);
    const { status, progress, results } = await statusResponse.json();

    if (status === 'completed') {
      setMessage('¡Importación completada!');
      setResults(results);
      clearInterval(pollInterval);
    } else if (status === 'failed') {
      setMessage('Error en importación');
      clearInterval(pollInterval);
    } else {
      setMessage(`Procesando... ${progress}%`);
    }
  };

  // Verificar cada 5 segundos
  const pollInterval = setInterval(checkStatus, 5000);
}
```

---

### 🎯 **Solución 3: Migrar a Vercel (Más Simple)**

Vercel tiene mejores límites de timeout:

| Plan | Límite de Timeout |
|------|-------------------|
| **Vercel Hobby (Free)** | ⏱️ **10 segundos** |
| **Vercel Pro** | ⏱️ **60 segundos** |
| Vercel Enterprise | 900 segundos (15 min) |

**Ventajas de Vercel**:
- ✅ Ya tienes `vercel.json` configurado
- ✅ Next.js es de Vercel (mejor integración)
- ✅ Mismos límites en Free, pero 60 segundos en Pro
- ✅ Más fácil de configurar

**Desventajas**:
- Necesitas Vercel Pro ($20/mes) para timeouts de 60 segundos

---

## 🔧 Variables de Entorno Faltantes

Verifica que tengas **TODAS** estas variables en Netlify:

```bash
# Supabase (CRÍTICO)
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# MercadoLibre
ML_CLIENT_ID=
ML_CLIENT_SECRET=
MERCADOLIBRE_CLIENT_SECRET=
ML_API_BASE=https://api.mercadolibre.com
ML_AUTH_BASE=https://auth.mercadolibre.cl
ML_COUNTRY=CL
NEXT_PUBLIC_MERCADOLIBRE_APP_ID=

# Application
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://tu-sitio.netlify.app
ADMIN_EMAIL=
NEXT_PUBLIC_ADMIN_EMAIL=

# Security
NEXTAUTH_URL=https://tu-sitio.netlify.app
NEXTAUTH_SECRET=
JWT_SECRET=
WEBHOOK_SECRET=
```

---

## 📊 Tabla Comparativa de Soluciones

| Solución | Costo | Complejidad | Tiempo Impl. | Funciona en Free |
|----------|-------|-------------|--------------|------------------|
| **1. Netlify Pro** | $19/mes | 🟢 Baja | 30 min | ❌ NO |
| **2. Arquitectura Async** | $0 | 🔴 Alta | 4-6 horas | ✅ SÍ |
| **3. Vercel Pro** | $20/mes | 🟢 Baja | 1 hora | ❌ NO |

---

## 🎯 Recomendaciones

### ✅ **Recomendación Inmediata (Hoy)**

**Opción A: Si tienes presupuesto ($19-20/mes)**
1. Migrar a Vercel Pro o Netlify Pro
2. El sistema funcionará sin cambios de código
3. Tiempo estimado: **1 hora**

**Opción B: Si NO tienes presupuesto (Free tier)**
1. Implementar Solución 2 (Arquitectura Asíncrona)
2. Requiere:
   - Crear tabla `processing_jobs` en Supabase
   - Crear endpoint async
   - Crear worker de procesamiento
   - Actualizar frontend
3. Tiempo estimado: **4-6 horas**

---

### 📋 **Plan de Acción Recomendado**

#### ✅ Corto Plazo (Esta Semana)

1. **Eliminar archivo conflictivo**:
   ```bash
   # Si usas Netlify, eliminar vercel.json
   rm vercel.json

   # Si usas Vercel, eliminar netlify.toml
   rm netlify.toml
   ```

2. **Actualizar `netlify.toml`** con configuración de timeout (Solución 1)

3. **Upgrade a Netlify Pro** ($19/mes) o **Vercel Pro** ($20/mes)

4. **Verificar variables de entorno** en el dashboard de Netlify/Vercel

#### 🎯 Mediano Plazo (Próximo Mes)

5. **Optimizar endpoints lentos**:
   - Reducir invalidación de cache completo
   - Procesar archivos en batches más pequeños
   - Implementar progress indicators

6. **Monitoreo**:
   - Configurar alertas de timeout
   - Logs estructurados con timestamps

#### 🚀 Largo Plazo (Próximos 3 Meses)

7. **Implementar arquitectura async** (Solución 2) para poder volver a Free tier si es necesario

8. **Cache más agresivo**:
   - Evitar invalidación completa
   - Invalidar solo SKUs afectados

---

## 🐛 Debugging: Cómo Reproducir el Error

### En Netlify (Producción):

1. Ir a: `https://tu-sitio.netlify.app/dashboard`
2. Intentar descargar cualquier Excel
3. Ver error 504 en consola del navegador
4. Ver logs de Netlify Functions: timeout después de 10 segundos

### Localmente (Funciona):

```bash
PORT=3012 npm run dev
# Ir a: http://localhost:3012/dashboard
# Funciona porque NO hay límite de tiempo
```

---

## 📞 Próximos Pasos

**Decide cuál solución implementar**:

1. **¿Tienes $20/mes?** → Upgrade a Pro (Netlify o Vercel)
2. **¿NO tienes presupuesto?** → Implementar Solución 2 (Async)
3. **¿No estás seguro?** → Probar localmente con timeout artificial

```javascript
// Agregar a import-by-action.js para simular Netlify Free
setTimeout(() => {
  throw new Error('Timeout simulado (10 segundos)');
}, 10000);
```

---

## 📚 Referencias

- [Netlify Functions Timeout Limits](https://docs.netlify.com/functions/overview/#default-deployment-options)
- [Vercel Serverless Function Limits](https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration)
- [Next.js API Routes Configuration](https://nextjs.org/docs/api-routes/api-middlewares#custom-config)
- [Supabase Storage for Background Jobs](https://supabase.com/docs/guides/storage)

---

**Última actualización**: 17 de octubre de 2025
**Autor**: Sistema de Diagnóstico Automatizado
**Severidad**: 🔴 CRÍTICA
**Estado**: ⚠️ REQUIERE ACCIÓN INMEDIATA
