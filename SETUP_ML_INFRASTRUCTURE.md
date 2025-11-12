# 🚀 Setup: Infraestructura ML para Forecasting de Inventario

## 📋 Tabla de Contenidos

1. [Arquitectura](#arquitectura)
2. [Prerequisitos](#prerequisitos)
3. [Configuración Inicial](#configuración-inicial)
4. [Deployment](#deployment)
5. [Uso](#uso)
6. [Troubleshooting](#troubleshooting)

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    ARQUITECTURA COMPLETA                │
└─────────────────────────────────────────────────────────┘

1. DATOS (Supabase PostgreSQL)
   ├── ventas_historicas
   ├── stock_actual
   ├── transito_china
   ├── compras_historicas
   └── packs

2. PROCESAMIENTO (GitHub Actions - Diario 2am)
   ├── Descarga datos de Supabase
   ├── Ejecuta algoritmo ML avanzado
   │   ├── Detección de outliers
   │   ├── Análisis de tendencias
   │   ├── Clasificación ABC-XYZ
   │   ├── Stock de seguridad
   │   └── Croston (demanda intermitente)
   ├── Genera predicciones
   └── Guarda en Supabase

3. API (Netlify Functions - 24/7)
   ├── GET /api/predicciones
   ├── GET /api/alertas
   └── Sirve datos pre-calculados

4. FRONTEND (Next.js - Netlify)
   └── Dashboard con predicciones
```

---

## 📦 Prerequisitos

### 1. Cuentas Necesarias

- ✅ **Supabase** (Ya configurado)
  - URL: `https://ugabltnuwwtbpyqoptdg.supabase.co`
  - Tienes: ANON_KEY + SERVICE_KEY

- ⚠️ **GitHub** (Repositorio del proyecto)
  - Necesitas: Crear secrets para GitHub Actions

- ⚠️ **Netlify** (Hosting + Functions)
  - Necesitas: Conectar repo de GitHub

### 2. Software Local

```bash
# Node.js 18+
node --version  # Debe ser >= 18

# Python 3.11+
python --version  # Debe ser >= 3.11

# Git
git --version
```

---

## ⚙️ Configuración Inicial

### PASO 1: Configurar Base de Datos Supabase

1. Ve a tu proyecto Supabase: https://supabase.com/dashboard/project/ugabltnuwwtbpyqoptdg

2. Ve a **SQL Editor** y ejecuta el archivo `supabase_schema.sql`:

```sql
-- Copia y pega el contenido completo del archivo supabase_schema.sql
-- Esto creará todas las tablas necesarias
```

3. Verifica que se crearon las tablas:
   - ventas_historicas
   - stock_actual
   - transito_china
   - predicciones
   - alertas_inventario
   - metricas_modelo

### PASO 2: Configurar GitHub Secrets

1. Ve a tu repositorio de GitHub

2. Settings → Secrets and variables → Actions → New repository secret

3. Agrega estos secrets:

```
SUPABASE_URL
Valor: https://ugabltnuwwtbpyqoptdg.supabase.co

SUPABASE_SERVICE_KEY
Valor: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnYWJsdG51d3d0YnB5cW9wdGRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQxMzg2NiwiZXhwIjoyMDcxOTg5ODY2fQ.UadJZDDy1ovJkNJ6EtyIFUasVECrNm4bHPPYXSJqbuE
```

### PASO 3: Configurar Netlify

1. Ve a https://app.netlify.com

2. Click en **"Add new site" → "Import an existing project"**

3. Conecta tu repositorio de GitHub

4. Configuración de Build:
   ```
   Build command: npm run build
   Publish directory: .next
   Functions directory: netlify/functions
   ```

5. **Environment Variables** (Settings → Environment variables):
   ```
   SUPABASE_URL = https://ugabltnuwwtbpyqoptdg.supabase.co
   SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

6. Deploy!

### PASO 4: Verificar GitHub Actions

1. Ve a tu repo → Actions

2. Deberías ver el workflow **"Daily Inventory Forecast"**

3. Trigger manual:
   - Click en el workflow
   - Click "Run workflow"
   - Run workflow

4. Espera ~3-5 minutos y verifica que completó exitosamente ✅

---

## 🚀 Deployment

### Deployment Automático

```
PUSH a GitHub (rama main)
  ↓
Netlify detecta cambios
  ↓
Build automático
  ↓
Deploy a producción
  ↓
✅ Live en https://tu-sitio.netlify.app
```

### Deployment Manual

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

---

## 📊 Uso

### 1. Cargar Datos Iniciales

Primero necesitas poblar Supabase con datos de tu Excel.

**Opción A: Script Python** (Recomendado)

```python
# scripts/cargar_datos_excel.py

import pandas as pd
from supabase import create_client
import os

# Conectar a Supabase
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_KEY')
)

# Cargar Excel
excel_path = 'Gestión Full3.xlsm'

# Cargar ventas
ventas_df = pd.read_excel(excel_path, sheet_name='ventas')
ventas_records = ventas_df.to_dict('records')

# Insertar en lotes
batch_size = 100
for i in range(0, len(ventas_records), batch_size):
    batch = ventas_records[i:i+batch_size]
    supabase.table('ventas_historicas').insert(batch).execute()
    print(f"✓ Batch {i//batch_size + 1} cargado")

print("✅ Datos cargados exitosamente")
```

**Opción B: CSV Import en Supabase**

1. Exporta cada hoja del Excel a CSV
2. Ve a Supabase → Table Editor
3. Click en la tabla → Import data → Upload CSV

### 2. Ejecutar Forecasting

**Automático (Recomendado)**
- Se ejecuta diariamente a las 2am UTC automáticamente
- No requiere intervención

**Manual (Para testing)**
```
1. Ve a GitHub → Actions
2. Click "Daily Inventory Forecast"
3. Click "Run workflow"
4. Ajusta parámetros (opcional):
   - Días de stock deseado: 90
   - Nivel de servicio: 0.95
5. Run workflow
```

### 3. Consumir API

```bash
# Obtener todas las predicciones
curl https://tu-sitio.netlify.app/api/predicciones

# Filtrar por SKU
curl https://tu-sitio.netlify.app/api/predicciones?sku=SKU001

# Filtrar por clasificación
curl https://tu-sitio.netlify.app/api/predicciones?clasificacion_abc=A

# Paginación
curl https://tu-sitio.netlify.app/api/predicciones?limit=50&offset=0

# Obtener alertas
curl https://tu-sitio.netlify.app/api/alertas

# Alertas críticas
curl https://tu-sitio.netlify.app/api/alertas?severidad=critica
```

**Ejemplo de Respuesta:**

```json
{
  "success": true,
  "data": [
    {
      "sku": "SKU001",
      "venta_diaria_p50": 12.5,
      "venta_diaria_p75": 15.2,
      "venta_diaria_p90": 18.7,
      "stock_actual": 500,
      "stock_optimo": 1125,
      "stock_seguridad": 85,
      "sugerencia_reposicion": 625,
      "sugerencia_reposicion_p75": 710,
      "sugerencia_reposicion_p90": 795,
      "clasificacion_abc": "A",
      "clasificacion_xyz": "X",
      "tendencia": "creciente",
      "tasa_crecimiento_mensual": 5.2,
      "alertas": [],
      "modelo_usado": "ewma"
    }
  ],
  "count": 1,
  "pagination": {
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## 🔧 Troubleshooting

### Error: "No se encontraron ventas"

**Causa**: La tabla `ventas_historicas` está vacía

**Solución**:
```sql
-- Verificar en Supabase SQL Editor
SELECT COUNT(*) FROM ventas_historicas;

-- Si retorna 0, necesitas cargar datos (ver sección "Cargar Datos Iniciales")
```

### Error: GitHub Action falla con "Module not found"

**Causa**: Dependencias no instaladas

**Solución**:
```yaml
# Verificar que .github/workflows/daily_forecast.yml tenga:
- name: Instalar dependencias
  run: |
    pip install pandas numpy scipy supabase python-dotenv openpyxl
```

### Error: Netlify Function timeout

**Causa**: La función está procesando en lugar de solo consultar

**Solución**: Las Netlify Functions SOLO consultan datos pre-calculados.
El procesamiento pesado se hace en GitHub Actions.

```javascript
// ❌ MAL - Procesamiento en Netlify Function
const predicciones = algoritmo.calcular(...);  // NUNCA HACER ESTO

// ✅ BIEN - Solo consultar
const { data } = await supabase.from('predicciones').select('*');
```

### Error: "SUPABASE_URL is not defined"

**Causa**: Variables de entorno no configuradas

**Solución**:

**GitHub Actions**:
1. GitHub repo → Settings → Secrets → Verificar que existan
2. Deben llamarse exactamente: `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`

**Netlify**:
1. Netlify site → Settings → Environment variables
2. Verificar `SUPABASE_URL` y `SUPABASE_ANON_KEY`

### Predicciones vacías

**Causa**: Puede ser falta de datos o filtros muy restrictivos

**Diagnóstico**:
```sql
-- En Supabase SQL Editor

-- 1. ¿Hay ventas?
SELECT COUNT(*) as total_ventas FROM ventas_historicas;

-- 2. ¿Hay stock?
SELECT COUNT(*) as total_skus FROM stock_actual;

-- 3. ¿Se generaron predicciones?
SELECT COUNT(*) as total_predicciones FROM predicciones;

-- 4. ¿Cuándo fue la última ejecución?
SELECT MAX(fecha_calculo) as ultima_ejecucion FROM predicciones;
```

---

## 📈 Mejoras Futuras

### Corto Plazo (1-2 semanas)
- [ ] Dashboard visual con gráficos
- [ ] Notificaciones por email/Slack
- [ ] Export de sugerencias a Excel/CSV
- [ ] Filtros avanzados en API

### Medio Plazo (1-2 meses)
- [ ] Prophet para forecasting avanzado
- [ ] Backtesting automático
- [ ] Multi-tenant (múltiples clientes)
- [ ] Machine Learning con más features

### Largo Plazo (3-6 meses)
- [ ] App móvil
- [ ] Integración con ERPs
- [ ] Optimización de costos multi-objetivo
- [ ] IA generativa para insights

---

## 📞 Soporte

Si encuentras algún problema:

1. Revisa los logs en:
   - GitHub Actions: Tu repo → Actions → Click en el run
   - Netlify: Site → Deploys → Click en el deploy → Function logs
   - Supabase: Dashboard → Logs

2. Verifica configuración:
   - Variables de entorno correctas
   - Secrets en GitHub configurados
   - Tablas creadas en Supabase

3. Ejecuta manualmente para debug:
   ```bash
   # Localmente
   export SUPABASE_URL="tu_url"
   export SUPABASE_SERVICE_KEY="tu_key"
   python scripts/run_daily_forecast.py
   ```

---

## 📝 Checklist de Deployment

- [ ] Supabase schema ejecutado
- [ ] Datos cargados en ventas_historicas
- [ ] Datos cargados en stock_actual
- [ ] GitHub secrets configurados
- [ ] GitHub Action ejecutado exitosamente
- [ ] Netlify conectado a GitHub
- [ ] Netlify env vars configuradas
- [ ] Netlify deployed exitosamente
- [ ] API /api/predicciones funciona
- [ ] API /api/alertas funciona
- [ ] Dashboard visible

**¡Si todos los checkboxes están marcados, estás 100% operativo! 🎉**
