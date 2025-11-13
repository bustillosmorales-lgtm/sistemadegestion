# Instrucciones de Seguridad - Pasos Finales

## URGENTE: Tareas Pendientes

### 1. Rotar Credenciales de Supabase

1. Ve a https://supabase.com/dashboard/project/ugabltnuwwtbpyqoptdg
2. Settings > API
3. Haz clic en "Generate new service key" en la sección "Service Role Key"
4. Copia la nueva key inmediatamente
5. Actualiza tu `.env.local` con la nueva `SUPABASE_SERVICE_KEY`

### 2. Rotar Credenciales de MercadoLibre (si es necesario)

1. Ve al panel de desarrolladores de MercadoLibre
2. Regenera tu `ML_CLIENT_SECRET`
3. Actualiza tu `.env.local` con el nuevo secret

### 3. Limpiar .env.local del Historial de Git (SOLO SI ESTÁ EN EL REPO)

**VERIFICAR PRIMERO:**
```bash
git log --all --full-history -- .env.local
```

Si aparece algo, ejecutar:

```bash
# Opción 1: Usando git filter-repo (recomendado)
git filter-repo --invert-paths --path .env.local

# Opción 2: Usando BFG Repo-Cleaner
# Descargar de https://rbrepo-cleaner.github.io/
java -jar bfg.jar --delete-files .env.local
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Forzar push (CUIDADO: esto reescribe el historial)
git push origin --force --all
```

**IMPORTANTE:** Informar a todos los colaboradores que deben hacer `git clone` nuevamente.

### 4. Configurar GitHub Secrets

Ve a: `https://github.com/TU_USUARIO/TU_REPO/settings/secrets/actions`

Agregar los siguientes secrets:

```
SUPABASE_URL=https://ugabltnuwwtbpyqoptdg.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_KEY=tu_nueva_service_key (la que rotaste)
ML_CLIENT_ID=tu_client_id
ML_CLIENT_SECRET=tu_nuevo_secret (el que rotaste)
```

### 5. Configurar Variables de Entorno en Netlify

1. Ve a https://app.netlify.com/sites/TU_SITIO/settings/env
2. Agregar las mismas variables:

```
SUPABASE_URL
SUPABASE_ANON_KEY  
SUPABASE_SERVICE_KEY
ML_CLIENT_ID
ML_CLIENT_SECRET
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL (tu URL de Netlify)
```

### 6. Ejecutar Políticas RLS en Supabase

1. Ve a https://supabase.com/dashboard/project/ugabltnuwwtbpyqoptdg/editor/sql
2. Abre el archivo `supabase_rls_policies.sql`
3. Copia todo el contenido
4. Pégalo en el SQL Editor de Supabase
5. Haz clic en "Run"
6. Verifica que todas las políticas se crearon correctamente

### 7. Crear tu primer usuario en Supabase

1. Ve a Authentication > Users
2. Haz clic en "Add user"
3. Ingresa email y contraseña
4. Confirma el usuario (si es necesario)

### 8. Probar el sistema localmente

```bash
npm install
npm run dev
```

1. Visita http://localhost:3000
2. Deberías ser redirigido a /login
3. Inicia sesión con el usuario que creaste
4. Verifica que puedes acceder al dashboard

### 9. Desplegar a producción

```bash
git add .
git commit -m "Security: Implementar autenticación y protecciones completas"
git push origin main
```

Netlify desplegará automáticamente.

### 10. Verificar Seguridad en Producción

Ir a https://securityheaders.com y escanear tu sitio.

Verificar que tienes:
- ✅ X-Frame-Options
- ✅ X-Content-Type-Options
- ✅ Strict-Transport-Security
- ✅ Content-Security-Policy

## Resumen de Mejoras Implementadas

### ✅ FASE 1: Autenticación y Control de Acceso
- [x] Autenticación con Supabase Auth
- [x] Middleware de protección de rutas
- [x] Login/logout functionality
- [x] JWT verification en todas las APIs
- [x] CORS restringido a dominio específico

### ✅ FASE 2: Validación y Rate Limiting
- [x] Validación de inputs con Zod
- [x] Rate limiting (100 req/min por usuario)
- [x] Console.logs removidos de producción
- [x] Manejo de errores centralizado

### ✅ FASE 3: Infraestructura de Seguridad
- [x] Row Level Security (RLS) en Supabase
- [x] Security headers (HSTS, CSP, X-Frame-Options, etc)
- [x] npm audit en CI/CD
- [x] Workflow de security audit semanal
- [x] Documentación de Sentry (opcional)

## Archivos Creados/Modificados

### Nuevos archivos:
- `lib/supabase-auth.ts` - Cliente Supabase con auth
- `lib/api-client.ts` - Cliente API con tokens automáticos
- `app/login/page.tsx` - Página de login
- `components/UserMenu.tsx` - Menu de usuario
- `middleware.ts` - Protección de rutas
- `netlify/functions/lib/auth.js` - Helper de autenticación
- `netlify/functions/lib/validation.js` - Esquemas Zod
- `netlify/functions/lib/rate-limit.js` - Rate limiting
- `netlify/functions/lib/error-handler.js` - Manejo de errores
- `supabase_rls_policies.sql` - Políticas RLS
- `.github/workflows/security-audit.yml` - Audit de seguridad
- `SENTRY_SETUP.md` - Guía de Sentry (opcional)

### Archivos modificados:
- `app/layout.tsx` - Agregado UserMenu
- `netlify/functions/predicciones.js` - Auth + validación
- `netlify/functions/alertas.js` - Auth + validación
- `netlify/functions/procesar-excel.js` - Auth + logs removidos
- `netlify.toml` - Headers de seguridad
- `.env.example` - Limpiado de credenciales

## Próximos Pasos Recomendados

1. **Backups automáticos** - Configurar en Supabase
2. **Monitoring** - Habilitar Sentry (ver SENTRY_SETUP.md)
3. **Penetration testing** - Contratar auditoría externa
4. **Compliance** - Revisar GDPR si tienes usuarios EU
5. **Bug bounty** - Considerar programa de recompensas

## Soporte

Si tienes problemas, revisa:
- Logs de Netlify: https://app.netlify.com/sites/TU_SITIO/logs
- Logs de GitHub Actions: https://github.com/TU_USUARIO/TU_REPO/actions
- Database logs en Supabase

## Certificaciones a Considerar

Dependiendo de tus clientes, podrías necesitar:
- SOC 2 Type II ($20k-50k/año)
- ISO 27001 ($30k-100k/año)
- HIPAA (si manejas datos de salud)
- PCI DSS (si procesas pagos)

Para tu caso (SaaS interno/pequeño equipo), las medidas implementadas son suficientes para empezar.
