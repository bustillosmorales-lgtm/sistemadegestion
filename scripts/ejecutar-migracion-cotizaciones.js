/**
 * Script para ejecutar migración de tabla cotizaciones
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function ejecutarMigracion() {
  console.log('📝 Ejecutando migración: create_cotizaciones.sql\n');

  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', 'create_cotizaciones.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    // Ejecutar el SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Si no existe la función exec_sql, ejecutar manualmente cada statement
      console.log('⚠️  Función exec_sql no disponible, ejecutando statements individualmente...\n');

      // Dividir en statements (básico)
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.length > 10) {
          console.log(`Ejecutando: ${statement.substring(0, 60)}...`);
          const { error: stmtError } = await supabase.rpc('exec', { sql: statement });
          if (stmtError) {
            console.error(`  ❌ Error: ${stmtError.message}`);
          } else {
            console.log('  ✅ OK');
          }
        }
      }
    } else {
      console.log('✅ Migración ejecutada exitosamente');
    }

    // Verificar que la tabla existe
    const { data: tableData, error: tableError } = await supabase
      .from('cotizaciones')
      .select('*')
      .limit(1);

    if (!tableError) {
      console.log('\n✅ Tabla "cotizaciones" creada y accesible');
      console.log('\n📋 Estructura de la tabla:');
      console.log('   - id (bigserial)');
      console.log('   - sku (text)');
      console.log('   - descripcion (text)');
      console.log('   - cantidad_cotizar (integer)');
      console.log('   - precio_unitario (decimal)');
      console.log('   - valor_total (decimal, calculado)');
      console.log('   - estado (text: pendiente, aprobada, rechazada, recibida)');
      console.log('   - fecha_cotizacion (timestamp)');
      console.log('   - fecha_actualizacion (timestamp)');
      console.log('   - notas (text)');
      console.log('   - created_at (timestamp)');
    } else {
      console.error('\n❌ No se pudo verificar la tabla:', tableError.message);
      console.log('\n⚠️  Debes ejecutar el SQL manualmente en Supabase Dashboard:');
      console.log('   1. Ve a https://supabase.com/dashboard/project/[tu-proyecto]/sql');
      console.log('   2. Copia el contenido de supabase/migrations/create_cotizaciones.sql');
      console.log('   3. Pégalo y ejecuta');
    }

  } catch (err) {
    console.error('❌ Error ejecutando migración:', err);
    console.log('\n⚠️  Ejecuta manualmente el SQL en Supabase Dashboard');
  }
}

ejecutarMigracion()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
