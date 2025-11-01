# 🚀 Deploy a Producción (Netlify + GitHub)

## 📋 Resumen

Para correr en producción necesitas:
1. ✅ Subir código a GitHub
2. ✅ Conectar GitHub → Netlify
3. ✅ Configurar variables de entorno en Netlify
4. ✅ Configurar secrets en GitHub Actions
5. ✅ Primer deploy automático

---

## 1️⃣ Subir Código a GitHub

### **Paso 1: Crear repositorio en GitHub**

1. Ve a https://github.com/new
2. Llena:
   - Repository name: `sistema-forecasting-inventario` (o el nombre que quieras)
   - Description: "Sistema ML de forecasting y reposición de inventario"
   - Visibility: **Private** (recomendado por las API keys)
3. **NO marques** "Add a README file" (ya tienes archivos)
4. Click **"Create repository"**

### **Paso 2: Subir tu código**

Abre una terminal en tu carpeta del proyecto:

```bash
cd "C:\Users\franc\OneDrive-mail.udp.cl\Documentos\sistema\nuevo_sistema"

# Inicializar git (si no lo hiciste)
git init

# Agregar todos los archivos
git add .

# Hacer primer commit
git commit -m "Initial commit - Sistema de forecasting ML"

# Conectar con GitHub (reemplaza TU_USUARIO con tu usuario de GitHub)
git remote add origin https://github.com/TU_USUARIO/sistema-forecasting-inventario.git

# Subir a GitHub
git branch -M main
git push -u origin main
```

**Nota:** Asegúrate de que `.env.local` **NO se suba** (ya está en `.gitignore`).

---

## 2️⃣ Conectar GitHub con Netlify

### **Paso 1: Ir a Netlify**

1. Ve a https://app.netlify.com
2. Login con tu cuenta
3. Click **"Add new site"** → **"Import an existing project"**

### **Paso 2: Conectar repositorio**

1. Click **"Deploy with GitHub"**
2. Autoriza Netlify a acceder a tu GitHub (si es primera vez)
3. Busca y selecciona tu repositorio: `sistema-forecasting-inventario`

### **Paso 3: Configurar build settings**

Netlify debería detectar automáticamente Next.js. Verifica:

```
Build command: npm run build
Publish directory: .next
Functions directory: netlify/functions
```

**NO hagas deploy todavía** - primero configura las variables de entorno.

---

## 3️⃣ Configurar Variables de Entorno en Netlify

### **Ir a Site settings → Environment variables**

En Netlify, ve a:
```
Site settings → Environment variables → Add a variable
```

**Agrega estas 8 variables:**

#### **Variables Públicas (Frontend):**

```
NEXT_PUBLIC_SUPABASE_URL
Valor: https://ugabltnuwwtbpyqoptdg.supabase.co
Scopes: Production, Deploy Previews, Branch deploys
```

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
Valor: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnYWJsdG51d3d0YnB5cW9wdGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTM4NjYsImV4cCI6MjA3MTk4OTg2Nn0.iCxJkGWB24Y0bcL27l5XlqNn5QV-66VGknv-YETgO9s
Scopes: Production, Deploy Previews, Branch deploys
```

#### **Variables Privadas (Backend/Functions):**

```
SUPABASE_URL
Valor: https://ugabltnuwwtbpyqoptdg.supabase.co
Scopes: Production, Deploy Previews, Branch deploys
```

```
SUPABASE_SERVICE_KEY
Valor: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnYWJsdG51d3d0YnB5cW9wdGRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQxMzg2NiwiZXhwIjoyMDcxOTg5ODY2fQ.UadJZDDy1ovJkNJ6EtyIFUasVECrNm4bHPPYXSJqbuE
Scopes: Production, Deploy Previews, Branch deploys
⚠️ MUY IMPORTANTE: Esta es la service key, nunca la compartas
```

#### **Variables de MercadoLibre (Opcionales por ahora):**

```
ML_CLIENT_ID
Valor: 5166684581522596

ML_CLIENT_SECRET
Valor: OTmz6Hsh7lCjdovoFZf3RauEfD4gjgc0

ML_REDIRECT_URI
Valor: https://TU-SITIO.netlify.app/mercadolibre/callback
(Reemplaza TU-SITIO con el nombre de tu sitio en Netlify)

ML_API_BASE
Valor: https://api.mercadolibre.com

ML_AUTH_BASE
Valor: https://auth.mercadolibre.cl
```

### **Guardar todas las variables**

Click **"Save"** después de agregar cada una.

---

## 4️⃣ Configurar GitHub Actions Secrets

Para que el forecasting automático funcione, necesitas configurar secrets en GitHub.

### **Ir a GitHub Secrets**

1. Ve a tu repositorio en GitHub
2. Click **"Settings"** (del repositorio)
3. Sidebar: **"Secrets and variables"** → **"Actions"**
4. Click **"New repository secret"**

### **Agregar estos 2 secrets:**

```
Name: SUPABASE_URL
Value: https://ugabltnuwwtbpyqoptdg.supabase.co
```

```
Name: SUPABASE_SERVICE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnYWJsdG51d3d0YnB5cW9wdGRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQxMzg2NiwiZXhwIjoyMDcxOTg5ODY2fQ.UadJZDDy1ovJkNJ6EtyIFUasVECrNm4bHPPYXSJqbuE
```

Estos secrets permiten que GitHub Actions ejecute el forecasting diario a las 2am.

---

## 5️⃣ Hacer el Deploy

### **Opción A: Deploy desde Netlify UI**

1. Ve a Netlify → Tu sitio → **"Deploys"**
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Espera 2-5 minutos

### **Opción B: Push a GitHub (automático)**

```bash
# Hacer un cambio (ej: actualizar README)
git add .
git commit -m "Deploy a producción"
git push
```

Netlify detectará el push y deployará automáticamente.

---

## 6️⃣ Verificar que Funciona

### **Tu sitio estará en:**
```
https://TU-SITIO.netlify.app
```

Netlify te asigna un nombre aleatorio (ej: `luminous-biscuit-abc123.netlify.app`).

**Puedes cambiarlo:** Site settings → Domain management → Change site name

### **Verificar:**

1. **Frontend carga:** Abre `https://TU-SITIO.netlify.app`
2. **Subir Excel funciona:** Prueba el botón de carga masiva
3. **Functions funcionan:** Verifica en Netlify → Functions que veas:
   - `alertas`
   - `predicciones`
   - `procesar-excel`

### **Ver logs en tiempo real:**

Netlify → Functions → Click en `procesar-excel` → Ver logs

---

## 7️⃣ Configurar Dominio Personalizado (Opcional)

Si tienes `sistemadegestion.net` configurado:

1. Netlify → Domain management → Add custom domain
2. Agregar `sistemadegestion.net` y `www.sistemadegestion.net`
3. Configurar DNS:
   ```
   A Record: @ → 75.2.60.5 (Netlify Load Balancer)
   CNAME: www → TU-SITIO.netlify.app
   ```
4. Netlify provee SSL automático (Let's Encrypt)

---

## 8️⃣ Verificar GitHub Actions

### **Primera ejecución manual:**

1. Ve a tu repo en GitHub
2. Click **"Actions"** (pestaña superior)
3. Selecciona el workflow **"Daily Inventory Forecast"**
4. Click **"Run workflow"** → **"Run workflow"**
5. Espera 5-10 minutos
6. Verifica que terminó exitosamente (✅ verde)

### **Verificar ejecución automática:**

GitHub Actions ejecutará automáticamente **todos los días a las 2am UTC**.

Para verificar que está configurado:
- Actions → Daily Inventory Forecast → Deberías ver el cron: `'0 2 * * *'`

---

## 🎯 Checklist Final de Producción

```
GitHub:
[ ] Código subido a repositorio privado
[ ] SUPABASE_URL configurado en Secrets
[ ] SUPABASE_SERVICE_KEY configurado en Secrets
[ ] GitHub Actions ejecutó exitosamente (manual test)

Netlify:
[ ] Sitio conectado a GitHub
[ ] NEXT_PUBLIC_SUPABASE_URL configurado
[ ] NEXT_PUBLIC_SUPABASE_ANON_KEY configurado
[ ] SUPABASE_SERVICE_KEY configurado
[ ] Build exitoso (verde)
[ ] Sitio cargando en https://TU-SITIO.netlify.app
[ ] Funciones cargadas (alertas, predicciones, procesar-excel)

Supabase:
[ ] RLS deshabilitado en tablas (para desarrollo)
[ ] Bucket excel-uploads creado y público
[ ] Tablas creadas (9 tablas)

Funcionalidad:
[ ] Frontend carga correctamente
[ ] Upload de Excel funciona
[ ] Datos se cargan en Supabase
[ ] Forecasting manual en GitHub Actions funciona
```

---

## 📊 URLs Importantes

**Tu sistema:**
```
Frontend: https://TU-SITIO.netlify.app
API Predicciones: https://TU-SITIO.netlify.app/api/predicciones
API Alertas: https://TU-SITIO.netlify.app/api/alertas
API Procesar Excel: https://TU-SITIO.netlify.app/api/procesar-excel
```

**Dashboards:**
```
Netlify: https://app.netlify.com/sites/TU-SITIO
GitHub: https://github.com/TU-USUARIO/sistema-forecasting-inventario
Supabase: https://supabase.com/dashboard/project/ugabltnuwwtbpyqoptdg
```

---

## 🔄 Workflow de Trabajo

### **Desarrollo Local:**
```bash
npx netlify dev
# Abre http://localhost:8888
# Prueba cambios
```

### **Deploy a Producción:**
```bash
git add .
git commit -m "Descripción de cambios"
git push
# Netlify hace deploy automático
```

### **Ver Logs:**
- Netlify → Functions → Ver logs en tiempo real
- GitHub → Actions → Ver ejecuciones del forecasting

---

## 🚨 Troubleshooting Común

### **Error: "Function failed to load"**
➡️ Verifica que `netlify.toml` tiene:
```toml
[functions]
  node_bundler = "esbuild"
```

### **Error: "SUPABASE_SERVICE_KEY is not defined"**
➡️ Verifica variables en Netlify → Site settings → Environment variables

### **Build falla en Netlify**
➡️ Verifica que `package.json` tiene:
```json
"scripts": {
  "build": "next build"
}
```

### **Excel upload falla en producción**
➡️ Verifica:
1. Bucket `excel-uploads` existe en Supabase
2. Bucket es público
3. RLS deshabilitado en tablas

---

## 🎉 ¡Todo Listo!

Una vez completados estos pasos, tendrás:

✅ Frontend corriendo en Netlify con dominio personalizado
✅ API Functions procesando Excel automáticamente
✅ GitHub Actions ejecutando forecasting diariamente a las 2am
✅ Datos sincronizados en Supabase
✅ Deploy automático con cada push a GitHub

---

## 📞 Datos que Necesito para Ayudarte

Si quieres que te ayude a configurarlo, necesito:

1. **Usuario de GitHub:** Para verificar el repo
2. **Nombre del sitio en Netlify:** Para revisar configuración
3. **Confirmar que ejecutaste los SQL scripts** en Supabase

---

**¿Quieres que empecemos con el paso 1 (subir a GitHub)?**
