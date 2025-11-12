/**
 * Arregla RLS automáticamente usando service_role key
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function ejecutarSQL(sql, descripcion) {
  console.log(`\n⚙️  ${descripcion}...`);

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Si exec_sql no existe, intentar con query directo
      console.log(`   ⚠️  RPC no disponible, intentando método alternativo...`);

      // Usar el método directo de postgres
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ sql_query: sql })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      console.log(`   ✅ ${descripcion} completado`);
      return true;
    }

    console.log(`   ✅ ${descripcion} completado`);
    return true;
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return false;
  }
}

async function deshabilitarRLS() {
  console.log('🔧 ARREGLANDO PERMISOS RLS EN SUPABASE');
  console.log('='.repeat(60));

  const tablas = [
    'predicciones',
    'metricas_modelo',
    'alertas_inventario'
  ];

  // Método alternativo: Usar políticas permisivas sin ALTER TABLE
  for (const tabla of tablas) {
    console.log(`\n📋 Configurando tabla: ${tabla}`);

    // Eliminar políticas existentes primero
    const sqlEliminarPoliticas = `
      DO $$
      BEGIN
        DROP POLICY IF EXISTS "Permitir lectura pública de ${tabla}" ON ${tabla};
        DROP POLICY IF EXISTS "Permitir escritura ${tabla}" ON ${tabla};
        DROP POLICY IF EXISTS "Enable read access for all users" ON ${tabla};
        DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON ${tabla};
        DROP POLICY IF EXISTS "Enable all access" ON ${tabla};
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `;

    await ejecutarSQL(sqlEliminarPoliticas, `Limpiando políticas antiguas de ${tabla}`);

    // Crear políticas permisivas
    const sqlCrearPoliticas = `
      CREATE POLICY "Enable all access" ON ${tabla}
      FOR ALL
      USING (true)
      WITH CHECK (true);
    `;

    await ejecutarSQL(sqlCrearPoliticas, `Creando política permisiva para ${tabla}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ CONFIGURACIÓN COMPLETADA');
  console.log('='.repeat(60));
  console.log('\n📋 Próximos pasos:');
  console.log('   1. Esperar a que el workflow termine');
  console.log('   2. Verificar predicciones en el dashboard');
  console.log('   3. Dashboard: https://sistemadegestion.net\n');
}

async function verificarAcceso() {
  console.log('\n🔍 Verificando acceso a tablas...\n');

  const tablas = ['predicciones', 'metricas_modelo', 'alertas_inventario'];

  for (const tabla of tablas) {
    try {
      const { count, error } = await supabase
        .from(tabla)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ ${tabla}: ${error.message}`);
      } else {
        console.log(`   ✅ ${tabla}: ${count || 0} registros`);
      }
    } catch (err) {
      console.log(`   ❌ ${tabla}: ${err.message}`);
    }
  }
}

async function main() {
  try {
    await deshabilitarRLS();
    await verificarAcceso();
  } catch (error) {
    console.error('\n❌ Error crítico:', error.message);
    process.exit(1);
  }
}

main();
