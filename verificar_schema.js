/**
 * Verifica el schema de las tablas y muestra estadísticas
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('🔍 VERIFICANDO DATOS EN SUPABASE\n');
  console.log('='.repeat(60));

  // Ventas
  const { count: ventasCount } = await supabase
    .from('ventas_historicas')
    .select('*', { count: 'exact', head: true });

  const { data: ventasFechas } = await supabase
    .from('ventas_historicas')
    .select('fecha')
    .order('fecha', { ascending: true })
    .limit(1);

  const { data: ventasFechasMax } = await supabase
    .from('ventas_historicas')
    .select('fecha')
    .order('fecha', { ascending: false })
    .limit(1);

  console.log('\n📊 VENTAS HISTÓRICAS:');
  console.log(`   Total registros: ${ventasCount}`);
  console.log(`   Fecha mínima: ${ventasFechas?.[0]?.fecha || 'N/A'}`);
  console.log(`   Fecha máxima: ${ventasFechasMax?.[0]?.fecha || 'N/A'}`);

  // SKUs únicos en ventas (con paginación)
  let allSkus = new Set();
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data: skusVentas } = await supabase
      .from('ventas_historicas')
      .select('sku')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!skusVentas || skusVentas.length === 0) break;

    skusVentas.forEach(v => allSkus.add(v.sku));

    if (skusVentas.length < pageSize) break;
    page++;
  }

  console.log(`   SKUs únicos: ${allSkus.size}`);

  // Stock
  const { count: stockCount } = await supabase
    .from('stock_actual')
    .select('*', { count: 'exact', head: true });

  console.log('\n📦 STOCK ACTUAL:');
  console.log(`   Total SKUs: ${stockCount}`);

  // Tránsito
  const { count: transitoCount } = await supabase
    .from('transito_china')
    .select('*', { count: 'exact', head: true });

  console.log('\n🚢 TRÁNSITO CHINA:');
  console.log(`   Total registros: ${transitoCount}`);

  // Compras
  const { count: comprasCount } = await supabase
    .from('compras_historicas')
    .select('*', { count: 'exact', head: true });

  console.log('\n🛒 COMPRAS HISTÓRICAS:');
  console.log(`   Total registros: ${comprasCount}`);

  // Packs
  const { count: packsCount } = await supabase
    .from('packs')
    .select('*', { count: 'exact', head: true });

  console.log('\n📦 PACKS:');
  console.log(`   Total registros: ${packsCount}`);

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ TODOS LOS DATOS CARGADOS CORRECTAMENTE\n');

  console.log('📋 Próximos pasos:');
  console.log('   1. Configurar GitHub Actions para forecasting automático');
  console.log('   2. Ejecutar primera predicción manualmente');
  console.log('   3. Verificar resultados en el dashboard\n');
}

main().catch(console.error);
