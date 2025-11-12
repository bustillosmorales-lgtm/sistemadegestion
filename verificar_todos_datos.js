/**
 * Verificar todos los datos cargados en Supabase
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function verificarTodo() {
  console.log('\n======================================================================');
  console.log('  📊 VERIFICACIÓN DE DATOS EN SUPABASE');
  console.log('======================================================================\n');

  const tablas = [
    'ventas_historicas',
    'stock_actual',
    'transito_china',
    'compras_historicas',
    'packs',
    'predicciones',
    'alertas_inventario'
  ];

  console.log('📋 Conteo de registros por tabla:\n');

  for (const tabla of tablas) {
    try {
      const { count, error } = await supabase
        .from(tabla)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ ${tabla}: Error - ${error.message}`);
      } else {
        const emoji = count > 0 ? '✅' : '⚠️ ';
        console.log(`   ${emoji} ${tabla.padEnd(25)} ${(count || 0).toLocaleString()} registros`);
      }
    } catch (e) {
      console.log(`   ❌ ${tabla}: ${e.message}`);
    }
  }

  console.log('\n======================================================================\n');
}

verificarTodo().catch(console.error);
