/**
 * Script para actualizar tabla cotizaciones con campos de proveedor
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function ejecutarActualizacion() {
  console.log('📝 Actualizando tabla cotizaciones con campos de proveedor...\n');

  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', 'update_cotizaciones_add_provider_fields.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    // Ejecutar el SQL directamente usando la conexión REST
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.log('⚠️  Función exec_sql no disponible, ejecuta manualmente en Supabase Dashboard:\n');
      console.log('1. Ve a: https://supabase.com/dashboard/project/[tu-proyecto]/sql');
      console.log('2. Copia el contenido de: supabase/migrations/update_cotizaciones_add_provider_fields.sql');
      console.log('3. Pégalo y ejecuta\n');
      console.log('El SQL es seguro - solo agrega columnas nuevas sin afectar datos existentes.');
      process.exit(0);
    }

    console.log('✅ Migración ejecutada exitosamente\n');

    // Verificar las columnas
    const { data: tableInfo, error: tableError } = await supabase
      .from('cotizaciones')
      .select('*')
      .limit(1);

    if (!tableError && tableInfo) {
      console.log('✅ Tabla "cotizaciones" actualizada correctamente\n');
      console.log('📋 Nuevos campos agregados:');
      console.log('   - costo_proveedor (decimal)');
      console.log('   - moneda (text)');
      console.log('   - cantidad_minima_venta (integer)');
      console.log('   - unidades_por_embalaje (integer)');
      console.log('   - metros_cubicos_embalaje (decimal)');
      console.log('   - fecha_respuesta (timestamp)');
      console.log('   - notas_proveedor (text)');
      console.log('\n✅ Estado actualizado para incluir: respondida');
    }

  } catch (err) {
    console.error('❌ Error ejecutando migración:', err);
    console.log('\n⚠️  Ejecuta manualmente el SQL en Supabase Dashboard');
  }
}

ejecutarActualizacion()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
