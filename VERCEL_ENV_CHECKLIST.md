# ✅ Checklist de Variables de Entorno para Vercel

## Variables Obligatorias (12)

### Supabase (5 variables)

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | https://xxxxx.supabase.co | Production, Preview, Development |
| `SUPABASE_URL` | (mismo que arriba) | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | eyJhbGciOiJIUzI1NiIsInR5... | Production, Preview, Development |
| `SUPABASE_ANON_KEY` | (mismo que arriba) | Production, Preview, Development |
| `SUPABASE_SERVICE_KEY` | eyJhbGciOiJIUzI1NiIsInR5... | Production, Preview, Development |

**Dónde obtenerlas:**
1. https://supabase.com/dashboard
2. Tu proyecto → Settings → API
3. Copiar: URL, anon public, service_role

---

### Secrets (3 variables)

Usa los que generaste con `npm run generate-secrets`:

| Key | Value | Environment |
|-----|-------|-------------|
| `JWT_SECRET` | VNkMlEkk4aAAlilRNN7LGCeQ2L1eC5wYlrbSAKxZWZY= | Production |
| `NEXTAUTH_SECRET` | h0U0bXl9Kk5xl1HwWz+AMUd5l5bv4A4FQsS2Rk75cmY= | Production |
| `WEBHOOK_SECRET` | r3iM600RRMQQRmtSWA3A6GFtBM5+8RLJ | Production |

---

### Application (4 variables)

| Key | Value | Environment |
|-----|-------|-------------|
| `NODE_ENV` | production | Production |
| `NEXT_PUBLIC_BASE_URL` | https://sistemadegestion.vercel.app | Production |
| `ADMIN_EMAIL` | tu-email@dominio.com | Production, Preview, Development |
| `NEXT_PUBLIC_ADMIN_EMAIL` | (mismo que arriba) | Production, Preview, Development |

**⚠️ Nota:** `NEXT_PUBLIC_BASE_URL` se actualizará después del deploy con tu URL real

---

## Variables Opcionales (MercadoLibre)

Solo si usas integración con MercadoLibre:

| Key | Value | Environment |
|-----|-------|-------------|
| `ML_CLIENT_ID` | 5166684581522596 | Production |
| `NEXT_PUBLIC_MERCADOLIBRE_APP_ID` | 5166684581522596 | Production |
| `ML_CLIENT_SECRET` | tu-ml-client-secret | Production |
| `MERCADOLIBRE_CLIENT_SECRET` | (mismo que arriba) | Production |
| `ML_API_BASE` | https://api.mercadolibre.com | Production |
| `ML_AUTH_BASE` | https://auth.mercadolibre.cl | Production |
| `ML_COUNTRY` | CL | Production |
| `ML_REDIRECT_URI` | https://tu-proyecto.vercel.app/mercadolibre/callback | Production |

---

## Configuración Importante

Para **TODAS** las variables:

1. **Sensitive**: ✅ Marca esta opción
   - Esto oculta los valores después de guardar
   - Protege información sensible

2. **Environments**: Selecciona:
   - ✅ Production (obligatorio)
   - ✅ Preview (recomendado)
   - ✅ Development (opcional)

---

## Checklist Final

Antes de hacer Deploy:

- [ ] 12 variables obligatorias configuradas
- [ ] Values de Supabase son correctos (URL + 2 keys)
- [ ] Secrets fueron generados (no uses valores de ejemplo)
- [ ] ADMIN_EMAIL es tu email real
- [ ] Todas marcadas como "Sensitive"
- [ ] Environment "Production" seleccionado
- [ ] Si usas ML, agregaste esas 8 variables adicionales

**Total esperado:**
- Sin MercadoLibre: 12 variables
- Con MercadoLibre: 20 variables

---

## Después del Deploy

Una vez que obtengas tu URL de Vercel:

1. Ve a: Settings → Environment Variables
2. Edita estas 2 variables:
   - `NEXT_PUBLIC_BASE_URL` → tu URL real de Vercel
   - `ML_REDIRECT_URI` → tu-url/mercadolibre/callback (si usas ML)
3. Redeploy: Deployments → ... → Redeploy
