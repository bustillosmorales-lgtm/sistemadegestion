/**
 * Arregla RLS usando el endpoint de Supabase directamente
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Extraer project ref de la URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];

async function ejecutarSQL(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: sql });

    const options = {
      hostname: `${projectRef}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🔧 Deshabilitando RLS en tablas de predicciones...\n');

  const sql = `
    -- Deshabilitar RLS
    ALTER TABLE predicciones DISABLE ROW LEVEL SECURITY;
    ALTER TABLE metricas_modelo DISABLE ROW LEVEL SECURITY;
    ALTER TABLE alertas_inventario DISABLE ROW LEVEL SECURITY;
  `;

  try {
    console.log('   Ejecutando SQL...');
    await ejecutarSQL(sql);
    console.log('   ✅ RLS deshabilitado exitosamente\n');

    console.log('🔍 Verificando acceso...\n');

    // Verificar con fetch normal
    const response = await fetch(`${SUPABASE_URL}/rest/v1/predicciones?select=count`, {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Acceso público funcionando');
      console.log(`   📊 Dashboard puede acceder a ${data.length} predicciones\n`);
    } else {
      console.log(`   ⚠️  Status: ${response.status} - ${response.statusText}\n`);
    }

  } catch (error) {
    console.log('   ❌ Error:', error.message);
    console.log('\n📋 SOLUCIÓN MANUAL:');
    console.log('   1. Ve a: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
    console.log('   2. Ejecuta este SQL:\n');
    console.log('   ALTER TABLE predicciones DISABLE ROW LEVEL SECURITY;');
    console.log('   ALTER TABLE metricas_modelo DISABLE ROW LEVEL SECURITY;');
    console.log('   ALTER TABLE alertas_inventario DISABLE ROW LEVEL SECURITY;\n');
  }
}

main();
