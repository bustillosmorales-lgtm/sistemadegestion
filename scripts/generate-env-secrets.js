#!/usr/bin/env node

/**
 * Script para generar secrets seguros para .env
 * Uso: node scripts/generate-env-secrets.js
 */

const crypto = require('crypto');

function generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('base64');
}

console.log('\n🔐 Generador de Secrets para .env\n');
console.log('═'.repeat(60));
console.log('\nAgrega estos valores a tu archivo .env:\n');

console.log('# NEXTAUTH / JWT Secrets');
console.log(`NEXTAUTH_SECRET=${generateSecret(32)}`);
console.log(`JWT_SECRET=${generateSecret(32)}`);
console.log(`WEBHOOK_SECRET=${generateSecret(24)}`);

console.log('\n' + '═'.repeat(60));
console.log('\n✅ Secrets generados exitosamente!');
console.log('\n⚠️  IMPORTANTE:');
console.log('   - Copia estos valores a tu archivo .env');
console.log('   - NUNCA compartas estos secrets públicamente');
console.log('   - Genera nuevos secrets para producción');
console.log('   - Configúralos en Vercel Dashboard → Environment Variables\n');
