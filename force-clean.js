// force-clean.js - Script standalone para limpiar todo
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Falta configuración de Supabase en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function forceClean() {
  console.log('\n🔥 LIMPIEZA FORZADA DE TODOS LOS CACHES Y DATOS');
  console.log('==============================================\n');

  try {
    // 1. Dashboard cache
    console.log('1️⃣ Limpiando dashboard_analysis_cache...');
    const { error: e1 } = await supabase.from('dashboard_analysis_cache').delete().neq('id', 0);
    if (e1) console.log('   ❌', e1.message);
    else console.log('   ✅ Limpiado');

    // 2. SKU cache
    console.log('2️⃣ Limpiando sku_analysis_cache...');
    const { error: e2 } = await supabase.from('sku_analysis_cache').delete().neq('sku', '');
    if (e2) console.log('   ❌', e2.message);
    else console.log('   ✅ Limpiado');

    // 3. Vista materializada (SKIP - no se puede modificar directamente)
    console.log('3️⃣ sku_venta_diaria_mv...');
    console.log('   ⏭️  Saltado (es una vista materializada, se regenerará automáticamente)');

    // 4. Actualizar venta_diaria a 0
    console.log('4️⃣ Actualizando venta_diaria de productos a 0...');
    const { error: e4 } = await supabase
      .from('products')
      .update({ venta_diaria: 0 })
      .neq('sku', '');
    if (e4) console.log('   ❌', e4.message);
    else console.log('   ✅ Actualizado');

    // 5. Mover productos a NO_REPLENISHMENT_NEEDED
    console.log('5️⃣ Moviendo productos de NEEDS_REPLENISHMENT a NO_REPLENISHMENT_NEEDED...');
    const { data, error: e5 } = await supabase
      .from('products')
      .update({ status: 'NO_REPLENISHMENT_NEEDED' })
      .eq('status', 'NEEDS_REPLENISHMENT')
      .select('sku');

    if (e5) console.log('   ❌', e5.message);
    else console.log(`   ✅ ${data?.length || 0} productos movidos a NO_REPLENISHMENT_NEEDED`);

    console.log('\n✅ LIMPIEZA COMPLETADA\n');
    console.log('Ahora ve al dashboard y haz un hard refresh (Ctrl+Shift+R)');

  } catch (error) {
    console.error('\n❌ Error general:', error.message);
  }
}

forceClean();
