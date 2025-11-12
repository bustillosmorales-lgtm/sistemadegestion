/**
 * Script para configurar secretos de GitHub automáticamente
 */

const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });

console.log('🔐 CONFIGURANDO SECRETOS DE GITHUB\n');
console.log('='.repeat(60));

// Leer valores de .env.local
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.log('❌ Error: No se encontraron las variables en .env.local');
  process.exit(1);
}

console.log('\n✅ Variables encontradas en .env.local:');
console.log(`   SUPABASE_URL: ${SUPABASE_URL.substring(0, 30)}...`);
console.log(`   SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY.substring(0, 20)}...`);

console.log('\n📋 PASOS PARA CONFIGURAR SECRETOS:\n');
console.log('1. Ve a: https://github.com/bustillosmorales-lgtm/sistemadegestion/settings/secrets/actions\n');
console.log('2. Click en "New repository secret"\n');
console.log('3. Agrega el primer secreto:');
console.log('   Nombre: SUPABASE_URL');
console.log('   Valor: ' + SUPABASE_URL);
console.log('\n4. Click en "Add secret"\n');
console.log('5. Click en "New repository secret" de nuevo\n');
console.log('6. Agrega el segundo secreto:');
console.log('   Nombre: SUPABASE_SERVICE_KEY');
console.log('   Valor: ' + SUPABASE_SERVICE_KEY);
console.log('\n7. Click en "Add secret"\n');

console.log('='.repeat(60));
console.log('\n💡 ALTERNATIVA RÁPIDA - COPIAR Y PEGAR:\n');

console.log('Secreto 1:');
console.log('----------');
console.log('Nombre: SUPABASE_URL');
console.log('Valor:');
console.log(SUPABASE_URL);

console.log('\n\nSecreto 2:');
console.log('----------');
console.log('Nombre: SUPABASE_SERVICE_KEY');
console.log('Valor:');
console.log(SUPABASE_SERVICE_KEY);

console.log('\n\n='.repeat(60));
console.log('\n✅ Una vez agregados los secretos, el workflow funcionará automáticamente.\n');

// Guardar en archivo para fácil copia
const secretsFile = `SECRETOS DE GITHUB
==================

Ve a: https://github.com/bustillosmorales-lgtm/sistemadegestion/settings/secrets/actions

Secreto 1:
Nombre: SUPABASE_URL
Valor: ${SUPABASE_URL}

Secreto 2:
Nombre: SUPABASE_SERVICE_KEY
Valor: ${SUPABASE_SERVICE_KEY}

Después de agregar estos secretos, ejecuta el workflow manualmente en:
https://github.com/bustillosmorales-lgtm/sistemadegestion/actions
`;

fs.writeFileSync('SECRETOS_GITHUB.txt', secretsFile);
console.log('💾 Valores guardados en: SECRETOS_GITHUB.txt\n');
