# 🧪 Probar Sistema en Producción

## ✅ Setup Completado

Has ejecutado el SQL en producción. Ahora vamos a verificar que todo funciona.

---

## 📋 Paso 1: Verificar Setup en Supabase

Ejecuta el archivo `VERIFICAR_SETUP_PRODUCCION.sql` en Supabase SQL Editor.

**Resultados Esperados**:
```
Verificación                     | Estado
---------------------------------|------------------
Tabla processing_jobs            | ✅ EXISTE
Columnas de processing_jobs      | 15 columnas
Índices de processing_jobs       | 3 índices
Bucket job-files                 | ✅ PÚBLICO
Productos con desconsiderado NULL| ✅ SIN NULLS (0)
```

Si ves estos resultados, continúa al Paso 2.

Si ves errores:
- ❌ "Tabla NO EXISTE" → Vuelve a ejecutar `SETUP_PRODUCCION_COMPLETO.sql`
- ❌ "Bucket PRIVADO" → Ejecuta solo la línea: `UPDATE storage.buckets SET public = true WHERE name = 'job-files';`

---

## 📋 Paso 2: Probar Upload en Producción

### 2.1 Preparar archivo de prueba Excel

Crea un archivo Excel simple con estas columnas:

**Hoja: "Datos"**

| SKU       | ✅ Acción | 📝 Cantidad a Cotizar |
|-----------|-----------|----------------------|
| TEST-001  | SI        | 10                   |
| TEST-002  | SI        | 20                   |

Guárdalo como `test-upload.xlsx`

### 2.2 Ir al Dashboard

1. Abre: https://sistemadegestion.net/dashboard
2. **IMPORTANTE**: Haz hard refresh → `Ctrl + Shift + R`
3. Espera a que cargue completamente

### 2.3 Subir archivo

1. Click en **"Subir Excel con Acciones"**
2. Selecciona `test-upload.xlsx`
3. Click en "Abrir"

### 2.4 Ver resultado

**Caso A: ✅ Éxito**

Deberías ver:

```
⏳ Procesando archivo en segundo plano...

Job ID: abc-123-def-456

Progreso: ████████░░░░░░░░░░ 45%
Tiempo transcurrido: 00:15
```

Y luego al completar:

```
✅ ¡Importación completada exitosamente!

Total: 2 | Exitosos: 2 | Errores: 0
```

**Caso B: ⚠️ Job en cola**

```
⏳ Procesando archivo en segundo plano...

Job ID: abc-123-def-456

Progreso: ░░░░░░░░░░░░░░░░░░░░ 0%
Status: queued
```

Esto es NORMAL si el worker no está corriendo. El job se procesará cuando inicies el worker.

**Caso C: ❌ Error**

Si ves:
```
❌ Error creating job
```

El setup SQL no se ejecutó correctamente. Vuelve al Paso 1.

---

## 📋 Paso 3: Verificar Job en Base de Datos

Ejecuta en Supabase SQL Editor:

```sql
SELECT
  id,
  type,
  status,
  progress,
  created_at,
  file_url
FROM processing_jobs
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado Esperado**:

```
id                  | type              | status   | progress | created_at
--------------------|-------------------|----------|----------|------------------
abc-123-def-456     | import_by_action  | queued   | 0        | 2025-10-17 10:30
```

Si ves el job con `status = 'queued'`, ¡perfecto! El sistema está funcionando.

El job esperará hasta que configures el worker (Paso 4).

---

## 📋 Paso 4: Configurar Worker en Producción

El worker es el que procesa los jobs. Tienes 3 opciones:

### **Opción A: Railway (Gratis, Recomendado)**

1. Ir a: https://railway.app
2. Sign up con GitHub
3. New Project → Deploy from GitHub repo
4. Seleccionar tu repositorio
5. Agregar variables de entorno:
   ```
   SUPABASE_URL=tu-url
   SUPABASE_SERVICE_KEY=tu-service-key
   ```
6. En "Start Command", poner:
   ```
   node scripts/process-import-jobs.js
   ```
7. Deploy

El worker correrá 24/7 gratis (hasta 500 horas/mes).

### **Opción B: Render (Gratis)**

1. Ir a: https://render.com
2. Sign up con GitHub
3. New → Background Worker
4. Conectar repo
5. Configurar:
   - Name: `jobs-worker`
   - Build Command: `npm install`
   - Start Command: `node scripts/process-import-jobs.js`
6. Agregar Environment Variables:
   ```
   SUPABASE_URL=tu-url
   SUPABASE_SERVICE_KEY=tu-service-key
   ```
7. Create Background Worker

### **Opción C: Netlify Scheduled Functions**

Crear archivo `netlify/functions/process-jobs.js`:

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
      return { statusCode: 200, body: 'No jobs' };
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
  // Marcar como processing
  await supabase
    .from('processing_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', job.id);

  // Descargar archivo
  const { data: fileData } = await supabase.storage
    .from('job-files')
    .download(job.file_url.split('/job-files/')[1]);

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets['Datos'];
  const data = XLSX.utils.sheet_to_json(worksheet);

  // Procesar filas
  const results = { success: [], errors: [] };

  for (const row of data) {
    try {
      const sku = row['SKU'] || row['sku'];
      const accion = (row['✅ Acción'] || row['Acción'] || '').trim().toUpperCase();

      if (accion === 'SI') {
        const cantidad = parseInt(row['📝 Cantidad a Cotizar'] || row['Cantidad a Cotizar'] || 0);

        // Insertar en purchase_order_details
        await supabase
          .from('purchase_order_details')
          .insert({
            sku: sku,
            quantity_requested: cantidad,
            status: 'pending'
          });

        results.success.push(sku);
      }
    } catch (error) {
      results.errors.push({ sku: row['SKU'], error: error.message });
    }
  }

  // Marcar como completado
  await supabase
    .from('processing_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: 100,
      results: results
    })
    .eq('id', job.id);
}
```

Luego:
```bash
git add netlify/functions/process-jobs.js
git commit -m "feat: Agregar Netlify scheduled function para procesar jobs"
git push origin main
```

### **Opción D: Temporal (Solo Testing)**

Desde tu PC local:

```bash
cd C:\Users\franc\OneDrive-mail.udp.cl\Documentos\sistema\sistemadegestion-main-main

# Asegúrate de tener las variables de entorno de PRODUCCIÓN
node scripts/process-import-jobs.js
```

**IMPORTANTE**: Esto solo funciona mientras la terminal esté abierta. No es para producción.

---

## 📋 Paso 5: Verificar Worker Funcionando

Una vez que hayas configurado el worker (cualquier opción), vuelve a subir el archivo de prueba.

Ahora deberías ver:

1. **Subir archivo** → Job creado (`status = 'queued'`)
2. **Esperar 10-30 segundos** → Worker detecta job
3. **Progreso actualiza** → `status = 'processing'`, progress: 0% → 100%
4. **Completado** → `status = 'completed'`, resultados mostrados

---

## ✅ Checklist Final

- [ ] Ejecutar `VERIFICAR_SETUP_PRODUCCION.sql` → Todo ✅
- [ ] Hard refresh del dashboard (`Ctrl + Shift + R`)
- [ ] Subir archivo de prueba
- [ ] Ver mensaje "Procesando archivo en segundo plano..."
- [ ] Job creado en DB (`status = 'queued'`)
- [ ] Configurar worker (Railway, Render, o Netlify)
- [ ] Job procesado (`status = 'completed'`)
- [ ] Resultados mostrados en frontend

---

## 🎯 Resultado Final Esperado

**SIN error 504** ✅
**SIN error 500** ✅
**Uploads funcionando sin límite de tiempo** ✅
**Progreso en tiempo real** ✅

---

## 🔧 Troubleshooting

### "Error creating job"
→ Setup SQL no ejecutado. Vuelve a ejecutar `SETUP_PRODUCCION_COMPLETO.sql`

### Job se queda en "queued" forever
→ Worker no está corriendo. Configura worker (Paso 4)

### "new row violates row-level security policy"
→ Bucket no es público. Ejecuta: `UPDATE storage.buckets SET public = true WHERE name = 'job-files';`

### Frontend no muestra progreso
→ Hard refresh: `Ctrl + Shift + R`

---

**Siguiente paso**: Ejecuta `VERIFICAR_SETUP_PRODUCCION.sql` y comparte los resultados.
