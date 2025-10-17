#!/usr/bin/env node

/**
 * Script para preparar variables de entorno para Vercel
 * Uso: node scripts/prepare-vercel-env.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('\n🔧 Preparando Variables de Entorno para Vercel\n');
console.log('═'.repeat(70));

// Generar secrets
function generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('base64');
}

const jwtSecret = generateSecret(32);
const nextauthSecret = generateSecret(32);
const webhookSecret = generateSecret(24);

console.log('\n📝 PASO 1: Copia el siguiente contenido\n');
console.log('═'.repeat(70));
console.log('\n');

const envContent = `# SUPABASE - ⚠️ REEMPLAZA CON TUS VALORES REALES
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-supabase-anon-key-aqui
SUPABASE_ANON_KEY=tu-supabase-anon-key-aqui
SUPABASE_SERVICE_KEY=tu-supabase-service-role-key-aqui

# SECRETS - Ya generados para ti ✅
JWT_SECRET=${jwtSecret}
NEXTAUTH_SECRET=${nextauthSecret}
WEBHOOK_SECRET=${webhookSecret}

# APPLICATION - ⚠️ ACTUALIZA URL después del deploy
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://tu-proyecto.vercel.app
ADMIN_EMAIL=tu-email@dominio.com
NEXT_PUBLIC_ADMIN_EMAIL=tu-email@dominio.com

# MERCADOLIBRE (opcional) - Descomenta si usas ML
# ML_CLIENT_ID=5166684581522596
# NEXT_PUBLIC_MERCADOLIBRE_APP_ID=5166684581522596
# ML_CLIENT_SECRET=tu-mercadolibre-client-secret
# MERCADOLIBRE_CLIENT_SECRET=tu-mercadolibre-client-secret
# ML_API_BASE=https://api.mercadolibre.com
# ML_AUTH_BASE=https://auth.mercadolibre.cl
# ML_COUNTRY=CL
# ML_REDIRECT_URI=https://tu-proyecto.vercel.app/mercadolibre/callback
`;

console.log(envContent);
console.log('\n═'.repeat(70));

// Guardar en archivo
const outputPath = path.join(process.cwd(), '.env.vercel');
fs.writeFileSync(outputPath, envContent, 'utf8');

console.log('\n✅ Contenido guardado en: .env.vercel');
console.log('\n📋 PASO 2: Instrucciones en Vercel\n');
console.log('═'.repeat(70));
console.log(`
1. En Vercel, haz click en "paste the .env contents above"

2. Pega el contenido de arriba (o abre el archivo .env.vercel)

3. IMPORTANTE - Reemplaza estos valores:

   ❌ NEXT_PUBLIC_SUPABASE_URL → Ve a Supabase Dashboard → Settings → API
   ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY → Copia "anon public" key
   ❌ SUPABASE_SERVICE_KEY → Copia "service_role" key
   ❌ NEXT_PUBLIC_BASE_URL → Deja como está, actualizarás después
   ❌ ADMIN_EMAIL → Tu email real

4. Si usas MercadoLibre:
   - Descomenta las líneas ML_*
   - Reemplaza ML_CLIENT_SECRET con tu valor

5. Environment:
   ✅ Marca: Production
   ✅ Marca: Preview (opcional)
   ✅ Marca: Development (opcional)

6. Sensitive:
   ✅ Marca "Sensitive" para proteger los valores

7. Click "Add" o "Save"

8. Click "Deploy" para iniciar el build
`);

console.log('═'.repeat(70));
console.log('\n🔐 IMPORTANTE:\n');
console.log('  - Los secrets ya fueron generados automáticamente');
console.log('  - .env.vercel está en .gitignore (no se subirá a Git)');
console.log('  - Después del deploy, actualiza NEXT_PUBLIC_BASE_URL\n');

console.log('═'.repeat(70));
console.log('\n📚 Ayuda adicional:\n');
console.log('  - Guía completa: VERCEL_QUICK_START.md');
console.log('  - Supabase keys: https://supabase.com/dashboard\n');
