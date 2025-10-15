# 🚀 Guía Rápida: Deploy en Vercel

## ✅ Requisitos Previos Completados:
- ✅ Código optimizado en GitHub
- ✅ Configuración de Vercel lista (vercel.json)
- ✅ Variables de entorno documentadas

---

## 📋 Pasos para Deploy en Vercel

### **Paso 1: Crear Proyecto en Vercel** (5 minutos)

1. **Ve a**: [vercel.com/new](https://vercel.com/new)

2. **Login con GitHub**:
   - Click en "Continue with GitHub"
   - Autoriza Vercel

3. **Importar Repositorio**:
   - Busca: `bustillosmorales-lgtm/sistemadegestion`
   - Click en "Import"

4. **Configuración del Proyecto**:
   ```
   Project Name: sistemadegestion (o el que prefieras)
   Framework Preset: Next.js (detectado automáticamente)
   Root Directory: ./
   Build Command: npm run build (detectado automáticamente)
   Output Directory: .next (detectado automáticamente)
   ```

5. **NO hagas click en "Deploy" todavía** ⚠️
   - Primero debemos configurar las variables de entorno

---

### **Paso 2: Configurar Variables de Entorno** (10 minutos)

#### **En la misma pantalla de configuración:**

1. Expande la sección **"Environment Variables"**

2. Agrega estas variables **UNA POR UNA**:

#### **Variables Obligatorias de Supabase:**

```env
# 1. NEXT_PUBLIC_SUPABASE_URL
Key: NEXT_PUBLIC_SUPABASE_URL
Value: https://tu-proyecto.supabase.co
Environment: Production, Preview, Development

# 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
Key: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: tu-anon-key-desde-supabase
Environment: Production, Preview, Development

# 3. SUPABASE_URL
Key: SUPABASE_URL
Value: https://tu-proyecto.supabase.co
Environment: Production, Preview, Development

# 4. SUPABASE_ANON_KEY
Key: SUPABASE_ANON_KEY
Value: tu-anon-key-desde-supabase
Environment: Production, Preview, Development

# 5. SUPABASE_SERVICE_KEY (⚠️ MUY IMPORTANTE)
Key: SUPABASE_SERVICE_KEY
Value: tu-service-role-key-desde-supabase
Environment: Production, Preview, Development
```

#### **Dónde obtener valores de Supabase:**
1. Ve a: [supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Settings → API
4. Copia:
   - `URL` → para SUPABASE_URL
   - `anon public` → para ANON_KEY
   - `service_role` → para SERVICE_KEY

#### **Variables de Seguridad (Genera nuevos para producción):**

```bash
# En tu terminal local, genera nuevos secrets:
npm run generate-secrets
```

Copia los valores generados:

```env
# 6. JWT_SECRET
Key: JWT_SECRET
Value: (el generado por generate-secrets)
Environment: Production

# 7. NEXTAUTH_SECRET
Key: NEXTAUTH_SECRET
Value: (el generado por generate-secrets)
Environment: Production

# 8. WEBHOOK_SECRET
Key: WEBHOOK_SECRET
Value: (el generado por generate-secrets)
Environment: Production
```

#### **Variables de Aplicación:**

```env
# 9. NODE_ENV
Key: NODE_ENV
Value: production
Environment: Production

# 10. NEXT_PUBLIC_BASE_URL (⚠️ IMPORTANTE: actualizar después del deploy)
Key: NEXT_PUBLIC_BASE_URL
Value: https://sistemadegestion.vercel.app (o tu dominio)
Environment: Production

# 11. ADMIN_EMAIL
Key: ADMIN_EMAIL
Value: tu-email@dominio.com
Environment: Production, Preview, Development

# 12. NEXT_PUBLIC_ADMIN_EMAIL
Key: NEXT_PUBLIC_ADMIN_EMAIL
Value: tu-email@dominio.com
Environment: Production, Preview, Development
```

#### **Variables de MercadoLibre (si usas ML):**

```env
# 13. ML_CLIENT_ID
Key: ML_CLIENT_ID
Value: 5166684581522596
Environment: Production

# 14. ML_CLIENT_SECRET
Key: ML_CLIENT_SECRET
Value: tu-ml-client-secret
Environment: Production

# 15. ML_API_BASE
Key: ML_API_BASE
Value: https://api.mercadolibre.com
Environment: Production

# 16. ML_AUTH_BASE
Key: ML_AUTH_BASE
Value: https://auth.mercadolibre.cl
Environment: Production

# 17. ML_COUNTRY
Key: ML_COUNTRY
Value: CL
Environment: Production

# 18. ML_REDIRECT_URI (⚠️ IMPORTANTE: actualizar después del deploy)
Key: ML_REDIRECT_URI
Value: https://sistemadegestion.vercel.app/mercadolibre/callback
Environment: Production

# 19. NEXT_PUBLIC_MERCADOLIBRE_APP_ID
Key: NEXT_PUBLIC_MERCADOLIBRE_APP_ID
Value: 5166684581522596
Environment: Production

# 20. MERCADOLIBRE_CLIENT_SECRET
Key: MERCADOLIBRE_CLIENT_SECRET
Value: tu-ml-client-secret
Environment: Production
```

#### **Variables Opcionales:**

```env
# DEFONTANA_API_KEY (solo si usas Defontana)
Key: DEFONTANA_API_KEY
Value: tu-defontana-key
Environment: Production
```

---

### **Paso 3: Deploy Inicial** (2-3 minutos)

1. **Click en "Deploy"**
   - Vercel comenzará el build
   - Verás logs en tiempo real
   - Espera 2-3 minutos

2. **Verificar Build Exitoso**:
   - ✅ Build exitoso: verás "Deployment Ready"
   - ❌ Build fallido: revisa logs de error

3. **Obtener URL**:
   - Copia tu URL: `https://tu-proyecto.vercel.app`

---

### **Paso 4: Actualizar URLs con tu Dominio** (2 minutos)

Ahora que tienes tu URL de Vercel, actualiza estas variables:

1. **Ve a**: Vercel Dashboard → tu proyecto → Settings → Environment Variables

2. **Edita estas variables**:

```env
NEXT_PUBLIC_BASE_URL → https://tu-proyecto.vercel.app
ML_REDIRECT_URI → https://tu-proyecto.vercel.app/mercadolibre/callback
```

3. **Redeploy**:
   - Deployments → Latest → "Redeploy"
   - Esto aplicará las nuevas URLs

---

### **Paso 5: Upgrade a Vercel Pro** (Recomendado para 174K registros)

#### **¿Por qué Pro?**
| Feature | Hobby (Gratis) | Pro ($20/mes) |
|---------|----------------|---------------|
| Function Timeout | 10 segundos | 60 segundos |
| Carga Masiva (174K) | ❌ Timeout | ✅ Funciona |
| Memory | 1 GB | 3 GB |
| Analytics | Básico | Avanzado |

#### **Cómo Actualizar:**
1. Vercel Dashboard → Settings → General
2. Scroll a "Plan"
3. Click "Upgrade to Pro"
4. Ingresa método de pago
5. Confirma upgrade

**Costo**: $20/mes (se cobra mensualmente)

---

### **Paso 6: Verificar Funcionamiento** (5 minutos)

#### **Test 1: Dashboard**
1. Ve a: `https://tu-proyecto.vercel.app/dashboard`
2. Verifica que carga correctamente
3. Login con tus credenciales

#### **Test 2: Carga Masiva (con Pro)**
1. Ve a: `https://tu-proyecto.vercel.app/bulk-upload`
2. Sube un archivo pequeño (100-500 registros)
3. Verifica en consola del navegador (F12):
   ```
   🚀 Procesando X ventas en modo batch optimizado
   ✅ Proceso completado: X nuevos, 0 duplicados
   ```

#### **Test 3: Carga Grande (con Pro)**
1. Sube `template_ventas (3).xlsx` (174,717 registros)
2. Tiempo esperado: 5-7 minutos
3. Debe completarse sin timeout

---

## 🔧 Troubleshooting

### **Error: "Build Failed - Missing Environment Variable"**

**Solución:**
1. Ve a Settings → Environment Variables
2. Verifica que todas las variables obligatorias estén configuradas
3. Redeploy: Deployments → Redeploy

### **Error: "Function Timeout" al cargar datos**

**Solución:**
- **Con Hobby**: Solo puedes cargar ~200 registros
- **Con Pro**: Upgrade a Pro para 60s timeout

### **Error: "Invalid Supabase Credentials"**

**Solución:**
1. Verifica que copiaste correctamente las keys de Supabase
2. No debe haber espacios extra
3. Verifica que el Service Role Key sea correcto

### **Error: CORS en MercadoLibre**

**Solución:**
1. Ve a MercadoLibre Developers
2. Actualiza Redirect URI a: `https://tu-proyecto.vercel.app/mercadolibre/callback`
3. Debe coincidir exactamente con ML_REDIRECT_URI

---

## ✅ Checklist de Deployment

### **Pre-Deploy:**
- [x] Código subido a GitHub
- [x] Variables de entorno documentadas
- [x] .env NO está en Git

### **Durante Deploy:**
- [ ] Proyecto creado en Vercel
- [ ] Variables de entorno configuradas (mínimo 12 obligatorias)
- [ ] Build exitoso (sin errores)
- [ ] URL obtenida

### **Post-Deploy:**
- [ ] URLs actualizadas con dominio real
- [ ] Dashboard funciona
- [ ] Carga masiva probada (archivo pequeño)
- [ ] Upgrade a Pro (si necesitas 174K registros)

---

## 📊 Comparación de Planes

### **¿Qué plan necesito?**

| Tu Caso de Uso | Plan Recomendado | Costo |
|----------------|------------------|-------|
| Testing/Demo | Hobby | Gratis |
| Producción sin carga masiva | Hobby | Gratis |
| Producción con <1000 registros | Hobby o Pro | $0-20/mes |
| Producción con 174K registros | **Pro (obligatorio)** | $20/mes |
| Alta concurrencia | Pro o Enterprise | $20+/mes |

---

## 🎯 Resumen Final

### **Tiempos Estimados:**
- ⏱️ Crear proyecto: 5 min
- ⏱️ Configurar variables: 10 min
- ⏱️ Deploy inicial: 3 min
- ⏱️ Actualizar URLs: 2 min
- ⏱️ Testing: 5 min
- **Total: ~25 minutos**

### **Costos:**
- Hobby (Gratis): $0/mes
- Pro (Recomendado): $20/mes
- Enterprise: Custom

---

## 📚 Recursos

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Vercel Docs**: https://vercel.com/docs
- **Repositorio**: https://github.com/bustillosmorales-lgtm/sistemadegestion

---

## 🆘 Soporte

Si tienes problemas:
1. Revisa los logs en Vercel: Deployments → Latest → View Function Logs
2. Revisa la consola del navegador (F12)
3. Verifica variables de entorno
4. Consulta VERCEL_DEPLOYMENT.md para más detalles

---

**¡Listo para hacer deploy! 🚀**

Comienza aquí: [vercel.com/new](https://vercel.com/new)
