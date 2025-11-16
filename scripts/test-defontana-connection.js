/**
 * Script para probar conexión con Defontana sin sincronizar
 * Ejecutar: node scripts/test-defontana-connection.js
 *
 * IMPORTANTE: Configura tus credenciales en .env.local primero
 */

require('dotenv').config({ path: '.env.local' });

// CONFIGURA TUS CREDENCIALES AQUÍ (o en .env.local)
const DEFONTANA_API_KEY = process.env.DEFONTANA_API_KEY || 'TU_API_KEY_AQUI';
const DEFONTANA_COMPANY_ID = process.env.DEFONTANA_COMPANY_ID || 'TU_COMPANY_ID_AQUI';
const ENVIRONMENT = process.env.DEFONTANA_ENVIRONMENT || 'production';

const baseUrl = ENVIRONMENT === 'sandbox'
  ? 'https://sandbox-api.defontana.com'
  : 'https://api.defontana.com';

async function testConnection() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 Test de Conexión con Defontana');
  console.log('='.repeat(80) + '\n');

  console.log('Configuración:');
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Company ID: ${DEFONTANA_COMPANY_ID}`);
  console.log(`  API Key: ${DEFONTANA_API_KEY.substring(0, 10)}...`);
  console.log('');

  // Test 1: Health check (si existe)
  console.log('📡 Test 1: Verificando salud de la API...');
  try {
    const healthUrl = `${baseUrl}/api/v1/companies/${DEFONTANA_COMPANY_ID}/health`;
    console.log(`  URL: ${healthUrl}`);

    const response = await fetch(healthUrl, {
      headers: {
        'Authorization': `Bearer ${DEFONTANA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`  Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log('  ✅ Conexión exitosa!');
      console.log('  Respuesta:', JSON.stringify(data, null, 2));
    } else {
      console.log('  ⚠️  Health check no disponible o falló');
      const errorText = await response.text();
      console.log('  Error:', errorText);
    }
  } catch (error) {
    console.log('  ⚠️  Error en health check:', error.message);
  }

  console.log('');

  // Test 2: Intentar obtener 1 venta de prueba
  console.log('📊 Test 2: Intentando obtener ventas de prueba...');
  try {
    // Últimos 7 días
    const dateTo = new Date().toISOString().split('T')[0];
    const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const salesUrl = `${baseUrl}/api/v1/companies/${DEFONTANA_COMPANY_ID}/sales?` +
      `dateFrom=${dateFrom}&dateTo=${dateTo}&page=1&pageSize=1`;

    console.log(`  URL: ${salesUrl}`);
    console.log(`  Rango: ${dateFrom} a ${dateTo}`);

    const response = await fetch(salesUrl, {
      headers: {
        'Authorization': `Bearer ${DEFONTANA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`  Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log('  ✅ Respuesta recibida!');
      console.log('  Estructura de respuesta:');
      console.log(JSON.stringify(data, null, 2));

      console.log('\n📋 Análisis de estructura:');
      console.log('  - ¿Tiene campo "sales"?', 'sales' in data);
      console.log('  - ¿Tiene campo "data"?', 'data' in data);
      console.log('  - ¿Tiene campo "items"?', 'items' in data);
      console.log('  - Campos disponibles:', Object.keys(data).join(', '));

      if (data.sales && data.sales.length > 0) {
        console.log('\n  Primera venta encontrada:');
        console.log('    Campos:', Object.keys(data.sales[0]).join(', '));

        if (data.sales[0].items && data.sales[0].items.length > 0) {
          console.log('    Primer item:');
          console.log('      Campos:', Object.keys(data.sales[0].items[0]).join(', '));
        }
      }
    } else {
      const errorText = await response.text();
      console.log('  ❌ Error obteniendo ventas');
      console.log('  Respuesta:', errorText);

      console.log('\n⚠️  POSIBLES CAUSAS:');
      console.log('  1. El endpoint de ventas podría ser diferente');
      console.log('  2. Los parámetros podrían ser diferentes');
      console.log('  3. Necesitas permisos adicionales en Defontana');
      console.log('  4. La estructura de la URL es incorrecta');
    }
  } catch (error) {
    console.log('  ❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📚 PRÓXIMOS PASOS:');
  console.log('='.repeat(80) + '\n');
  console.log('1. Revisa la documentación oficial de la API de Defontana');
  console.log('2. Verifica el endpoint correcto para obtener ventas');
  console.log('3. Confirma la estructura de la respuesta');
  console.log('4. Ajusta el código de defontana-sync.js si es necesario');
  console.log('');
  console.log('📖 Documentación: Busca en tu panel de Defontana → API Docs');
  console.log('');
}

testConnection().catch(console.error);
