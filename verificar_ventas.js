/**
 * Verifica cuántos registros hay en ventas_historicas
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('🔍 Verificando tabla ventas_historicas...\n');

  const { count, error } = await supabase
    .from('ventas_historicas')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  console.log(`📊 Registros actuales en ventas_historicas: ${count}`);

  if (count > 0) {
    console.log('\n⚠️  La tabla NO está vacía.');
    console.log('\n📋 Ejecuta este SQL en Supabase para limpiarla:');
    console.log('   TRUNCATE TABLE ventas_historicas RESTART IDENTITY CASCADE;');
  } else {
    console.log('\n✅ La tabla está vacía y lista para cargar datos.');
  }
}

main().catch(console.error);
