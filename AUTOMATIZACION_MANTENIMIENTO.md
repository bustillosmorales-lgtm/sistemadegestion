# 🤖 AUTOMATIZACIÓN DEL MANTENIMIENTO DIARIO

## ✅ Script Unificado Creado

He creado `scripts/daily-maintenance.js` que ejecuta automáticamente:
1. Refresca la vista materializada de venta diaria
2. Pobla el cache del dashboard con todos los SKUs

**Ejecutar manualmente:**
```bash
npm run daily-maintenance
```

---

## 📅 OPCIONES DE AUTOMATIZACIÓN

### **OPCIÓN 1: Windows Task Scheduler** (Recomendado para desarrollo local)

#### Paso 1: Crear archivo batch
Crea el archivo `C:\Users\franc\daily-maintenance.bat`:

```batch
@echo off
cd /d "C:\Users\franc\OneDrive-mail.udp.cl\Documentos\sistema\sistemadegestion-main-main"
call npm run daily-maintenance >> C:\Users\franc\logs\maintenance.log 2>&1
```

#### Paso 2: Configurar Task Scheduler
1. Abre **Task Scheduler** (Programador de tareas)
2. Click derecho en "Task Scheduler Library" → **Create Basic Task**
3. Nombre: `Dashboard Daily Maintenance`
4. Trigger: **Daily** a las **3:00 AM**
5. Action: **Start a program**
   - Program/script: `C:\Users\franc\daily-maintenance.bat`
6. ✅ Marcar "Run whether user is logged on or not"
7. ✅ Marcar "Run with highest privileges"

#### Verificar logs:
```
C:\Users\franc\logs\maintenance.log
```

---

### **OPCIÓN 2: Node-cron** (Recomendado para servidor siempre activo)

Si tienes un servidor Node.js corriendo 24/7:

#### Instalar node-cron:
```bash
npm install node-cron
```

#### Crear `scripts/cron-scheduler.js`:
```javascript
const cron = require('node-cron');
const dailyMaintenance = require('./daily-maintenance');

// Ejecutar todos los días a las 3:00 AM
cron.schedule('0 3 * * *', async () => {
  console.log('⏰ Ejecutando mantenimiento diario programado...');
  await dailyMaintenance();
});

console.log('🤖 Scheduler iniciado - Mantenimiento diario a las 3:00 AM');
```

#### Ejecutar:
```bash
node scripts/cron-scheduler.js
```

---

### **OPCIÓN 3: Supabase Edge Functions + pg_cron** (Recomendado para producción)

#### Paso 1: Crear Edge Function en Supabase

En Supabase Dashboard → **Edge Functions** → Create new function:

```javascript
// supabase/functions/daily-maintenance/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // 1. Refrescar vista materializada
    await supabase.rpc('refresh_venta_diaria_mv')

    // 2. Llamar a tu API de Next.js para poblar cache
    const response = await fetch('https://tu-dominio.com/api/trigger-cache-populate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('CRON_SECRET')}`
      }
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

#### Paso 2: Configurar pg_cron en Supabase

En Supabase SQL Editor:

```sql
-- Habilitar extensión pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programar ejecución diaria a las 3 AM
SELECT cron.schedule(
  'dashboard-daily-maintenance',
  '0 3 * * *', -- 3 AM todos los días
  $$
  -- Primero refrescar vista materializada
  REFRESH MATERIALIZED VIEW CONCURRENTLY sku_venta_diaria_mv;

  -- Luego llamar Edge Function para poblar cache
  SELECT
    net.http_post(
      url := 'https://tu-proyecto.supabase.co/functions/v1/daily-maintenance',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
    );
  $$
);

-- Verificar cron jobs
SELECT * FROM cron.job;
```

---

### **OPCIÓN 4: GitHub Actions** (Para repositorios en GitHub)

Crea `.github/workflows/daily-maintenance.yml`:

```yaml
name: Daily Dashboard Maintenance

on:
  schedule:
    - cron: '0 3 * * *' # 3 AM UTC diariamente
  workflow_dispatch: # Permite ejecución manual

jobs:
  maintenance:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run daily maintenance
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: npm run daily-maintenance
```

---

### **OPCIÓN 5: Netlify Scheduled Functions** (Si usas Netlify)

Crea `netlify/functions/scheduled-maintenance.js`:

```javascript
const { schedule } = require('@netlify/functions');
const dailyMaintenance = require('../../scripts/daily-maintenance');

const handler = schedule('0 3 * * *', async () => {
  await dailyMaintenance();
  return {
    statusCode: 200
  };
});

module.exports = { handler };
```

Configura en `netlify.toml`:

```toml
[functions]
  directory = "netlify/functions"

[[plugins]]
  package = "@netlify/plugin-scheduled-functions"
```

---

## 🎯 COMPARACIÓN DE OPCIONES

| Opción | Pros | Contras | Mejor Para |
|--------|------|---------|------------|
| **Task Scheduler** | ✅ Gratis<br>✅ Fácil setup<br>✅ Local | ❌ PC debe estar encendida<br>❌ Solo Windows | Desarrollo local |
| **node-cron** | ✅ Gratis<br>✅ Flexible | ❌ Servidor debe estar activo 24/7 | Servidores propios |
| **Supabase pg_cron** | ✅ Serverless<br>✅ Confiable<br>✅ No requiere servidor | ⚠️ Requiere configuración SQL | **Producción (recomendado)** |
| **GitHub Actions** | ✅ Gratis<br>✅ Integrado con repo | ❌ Límite de minutos gratis | CI/CD ya existente |
| **Netlify Scheduled** | ✅ Serverless<br>✅ Fácil | ❌ Solo si usas Netlify | Proyectos en Netlify |

---

## 🚀 RECOMENDACIÓN

### Para **Desarrollo Local**:
```bash
# Configurar Windows Task Scheduler (ver arrarriba)
```

### Para **Producción**:
```bash
# Usar Supabase pg_cron + Edge Function (más confiable)
```

### Para **Testing rápido**:
```bash
# Ejecutar manualmente
npm run daily-maintenance
```

---

## 📊 MONITOREO

### Ver logs de ejecución:
```bash
# Windows Task Scheduler logs:
C:\Users\franc\logs\maintenance.log

# Supabase pg_cron logs:
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'dashboard-daily-maintenance')
ORDER BY start_time DESC LIMIT 10;
```

### Verificar última actualización del cache:
```sql
SELECT
  MAX(created_at) as ultima_actualizacion,
  COUNT(*) as total_skus
FROM dashboard_analysis_cache;
```

---

## ⚙️ CONFIGURACIÓN RECOMENDADA

1. **Producción**: Supabase pg_cron (ejecuta en el servidor, 100% confiable)
2. **Desarrollo**: Windows Task Scheduler (tu PC local)
3. **Backup manual**: `npm run daily-maintenance` (por si algo falla)

---

## 🐛 TROUBLESHOOTING

### Si el cron no se ejecuta:
```bash
# Verificar que el script funciona manualmente
npm run daily-maintenance

# Ver logs del Task Scheduler
# Event Viewer → Windows Logs → Application

# Verificar pg_cron en Supabase
SELECT * FROM cron.job WHERE jobname = 'dashboard-daily-maintenance';
```

### Si falla la ejecución:
```bash
# Verificar variables de entorno
echo $NEXT_PUBLIC_SUPABASE_URL

# Verificar permisos de Supabase
# Dashboard → Settings → API → Service Role Key
```

---

## ✅ PRÓXIMOS PASOS

1. Elige la opción de automatización según tu entorno
2. Configura según las instrucciones de arriba
3. Ejecuta manualmente primero: `npm run daily-maintenance`
4. Verifica que funcione automáticamente al día siguiente
5. Monitorea los logs regularmente

**El mantenimiento diario garantiza que tu dashboard siempre tenga datos actualizados!** 🎯
