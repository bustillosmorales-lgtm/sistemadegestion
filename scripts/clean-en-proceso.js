const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function cleanEnProcesoStatus() {
  const client = await pool.connect();

  try {
    console.log('🔍 Buscando SKUs con status "en proceso"...\n');

    // Consultar SKUs en proceso
    const checkQuery = `
      SELECT sku, status, updated_at
      FROM productos
      WHERE status = 'en proceso'
      ORDER BY sku;
    `;

    const result = await client.query(checkQuery);

    if (result.rows.length === 0) {
      console.log('✅ No hay SKUs con status "en proceso"');
      return;
    }

    console.log(`📊 Total SKUs en proceso: ${result.rows.length}\n`);
    console.log('SKUs encontrados:');
    result.rows.forEach(row => {
      console.log(`  - ${row.sku} (actualizado: ${row.updated_at})`);
    });

    console.log('\n🧹 ¿Qué status deberían tener estos productos?');
    console.log('Opciones comunes:');
    console.log('  1. "activo" - si están disponibles para venta');
    console.log('  2. "desconsiderar" - si no deben aparecer en análisis');
    console.log('  3. "agotado" - si no tienen stock');

    console.log('\n💡 Para este script, los cambiaré a "activo" por defecto.');
    console.log('Si necesitas otro status, puedes modificar el script.\n');

    // Actualizar a "activo"
    const updateQuery = `
      UPDATE productos
      SET status = 'activo', updated_at = NOW()
      WHERE status = 'en proceso'
      RETURNING sku, status;
    `;

    const updateResult = await client.query(updateQuery);

    console.log(`✅ ${updateResult.rows.length} SKUs actualizados a "activo":\n`);
    updateResult.rows.forEach(row => {
      console.log(`  ✓ ${row.sku} -> ${row.status}`);
    });

    // Verificar que no queden SKUs en proceso
    const verifyQuery = `SELECT COUNT(*) as count FROM productos WHERE status = 'en proceso';`;
    const verifyResult = await client.query(verifyQuery);

    console.log(`\n🔍 Verificación final: ${verifyResult.rows[0].count} SKUs en proceso`);

    if (verifyResult.rows[0].count === '0') {
      console.log('✅ ¡Limpieza completada! No quedan SKUs en proceso.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanEnProcesoStatus()
  .then(() => {
    console.log('\n🎉 Script finalizado exitosamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
