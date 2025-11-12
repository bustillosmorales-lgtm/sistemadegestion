# Configurar Secretos en GitHub Actions

El workflow de forecasting falló porque **faltan los secretos de Supabase** en GitHub.

## Pasos para Configurar:

### 1. Ve a la configuración de Secrets

Abre esta URL:
```
https://github.com/bustillosmorales-lgtm/sistemadegestion/settings/secrets/actions
```

### 2. Agrega el primer secreto

**Click en "New repository secret"**

```
Name: SUPABASE_URL
Secret: https://ugabltnuwwtbpyqoptdg.supabase.co
```

Click **"Add secret"**

### 3. Agrega el segundo secreto

**Click en "New repository secret"** nuevamente

```
Name: SUPABASE_SERVICE_KEY
Secret: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnYWJsdG51d3d0YnB5cW9wdGRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQxMzg2NiwiZXhwIjoyMDcxOTg5ODY2fQ.UadJZDDy1ovJkNJ6EtyIFUasVECrNm4bHPPYXSJqbuE
```

Click **"Add secret"**

### 4. Verifica

Deberías ver 2 secretos listados:
- ✅ SUPABASE_URL
- ✅ SUPABASE_SERVICE_KEY

### 5. Ejecuta el workflow nuevamente

Ve a:
```
https://github.com/bustillosmorales-lgtm/sistemadegestion/actions
```

1. Click en "Daily Inventory Forecast"
2. Click en "Run workflow"
3. Selecciona branch: main
4. Click "Run workflow" (verde)

## Verificación

Después de ~3-5 minutos, verifica:

```bash
node verificar_predicciones.js
```

Deberías ver predicciones generadas para los 2,400 SKUs.
