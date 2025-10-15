# Guía de Configuración de Variables de Entorno (.env)

## 📋 Pasos para Configurar tu .env

### 1. Archivo .env Creado ✅

Ya se creó el archivo `.env` en la raíz del proyecto con todas las variables necesarias.

### 2. Generar Secrets Seguros

```bash
# Ejecuta este comando para generar secrets aleatorios
node scripts/generate-env-secrets.js
```

Esto generará:
- `NEXTAUTH_SECRET`
- `JWT_SECRET`
- `WEBHOOK_SECRET`

Copia estos valores y pégalos en tu archivo `.env`

### 3. Configurar Supabase

Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard):

1. **Project Settings → API**
2. Copia los siguientes valores:

```env
# URL del proyecto
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_URL=https://xxxxx.supabase.co

# anon/public key
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# service_role key (⚠️ SOLO para backend)
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Configurar MercadoLibre API (Opcional)

Si usas integración con MercadoLibre:

1. Ve a [MercadoLibre Developers](https://developers.mercadolibre.cl/)
2. Crea/accede a tu aplicación
3. Copia las credenciales:

```env
ML_CLIENT_ID=5166684581522596
ML_CLIENT_SECRET=tu-client-secret-aqui
ML_REDIRECT_URI=http://localhost:3000/mercadolibre/callback
```

### 5. Configurar URLs Base

**Para desarrollo local:**
```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
ML_REDIRECT_URI=http://localhost:3000/mercadolibre/callback
```

**Para producción (Vercel):**
```env
NEXT_PUBLIC_BASE_URL=https://tu-dominio.vercel.app
NEXTAUTH_URL=https://tu-dominio.vercel.app
ML_REDIRECT_URI=https://tu-dominio.vercel.app/mercadolibre/callback
```

### 6. Configurar Email Administrador

```env
ADMIN_EMAIL=tu-email@dominio.com
NEXT_PUBLIC_ADMIN_EMAIL=tu-email@dominio.com
```

---

## 🚀 Verificar Configuración

### Paso 1: Verificar que .env existe
```bash
ls -la .env
```

### Paso 2: Verificar que no está en Git
```bash
git status
# .env NO debe aparecer en la lista
```

### Paso 3: Probar en desarrollo
```bash
npm run dev
```

Si todo está bien configurado, deberías ver:
```
✓ Ready in 2.3s
○ Local: http://localhost:3000
```

---

## 🔐 Seguridad

### ✅ HACER:
- ✅ Mantén `.env` en `.gitignore`
- ✅ Usa secrets diferentes para dev y producción
- ✅ Regenera secrets si los expones accidentalmente
- ✅ En Vercel, configura variables en Dashboard

### ❌ NO HACER:
- ❌ NUNCA subas `.env` a Git
- ❌ NUNCA compartas `SUPABASE_SERVICE_KEY` públicamente
- ❌ NUNCA uses los mismos secrets en dev y prod
- ❌ NUNCA hardcodees secrets en el código

---

## 📦 Variables por Categoría

### Obligatorias (el sistema no funciona sin ellas):
```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
NODE_ENV
```

### Recomendadas (features importantes):
```env
JWT_SECRET
NEXTAUTH_SECRET
ADMIN_EMAIL
NEXT_PUBLIC_BASE_URL
```

### Opcionales (solo si usas estas integraciones):
```env
ML_CLIENT_ID
ML_CLIENT_SECRET
DEFONTANA_API_KEY
WEBHOOK_SECRET
```

---

## 🌐 Configuración en Vercel

Cuando despliegues en Vercel, configura estas variables en:

**Vercel Dashboard → tu-proyecto → Settings → Environment Variables**

### Variables a configurar:

1. **Production Environment:**
   - Todas las variables del `.env`
   - Cambia URLs de `localhost` por tu dominio Vercel
   - Usa secrets de producción (diferentes a dev)

2. **Preview Environment (opcional):**
   - Puedes usar las mismas que producción
   - O crear un proyecto Supabase separado para testing

3. **Development Environment (opcional):**
   - Usa las mismas que tu `.env` local

### Ejemplo de configuración en Vercel:

```
Key: NEXT_PUBLIC_SUPABASE_URL
Value: https://tu-proyecto.supabase.co
Environment: Production, Preview, Development
```

---

## 🆘 Troubleshooting

### Error: "Missing environment variable"
**Solución:** Verifica que todas las variables obligatorias estén en `.env`

### Error: "Invalid Supabase credentials"
**Solución:**
1. Verifica que copiaste correctamente las keys de Supabase
2. Asegúrate de no tener espacios extras
3. Reinicia el servidor: `Ctrl+C` y luego `npm run dev`

### Error: "CORS error" en MercadoLibre
**Solución:** Verifica que `ML_REDIRECT_URI` coincida con la URL configurada en MercadoLibre Developers

### Variables no se actualizan
**Solución:** Reinicia el servidor de desarrollo después de modificar `.env`

---

## ✅ Checklist Final

Antes de hacer deploy:

- [ ] `.env` está configurado con todos los valores reales
- [ ] Secrets fueron generados con `generate-env-secrets.js`
- [ ] `.env` NO está en Git (verificar con `git status`)
- [ ] El servidor funciona localmente (`npm run dev`)
- [ ] Todas las variables de producción están en Vercel Dashboard
- [ ] URLs cambiadas de `localhost` a dominio de producción

---

## 📚 Recursos Adicionales

- [Supabase Docs - Environment Variables](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Next.js Docs - Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Docs - Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [MercadoLibre Developers](https://developers.mercadolibre.cl/)

---

**Última actualización:** 2025-10-14
**Versión del sistema:** 1.0.1
