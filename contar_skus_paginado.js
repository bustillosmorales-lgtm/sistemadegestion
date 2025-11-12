/**
 * Cuenta SKUs únicos usando paginación
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('🔍 Contando SKUs únicos con PAGINACIÓN...\n');

  const pageSize = 1000;
  let currentPage = 0;
  let allSkus = new Set();
  let totalRecords = 0;

  while (true) {
    const from = currentPage * pageSize;
    const to = from + pageSize - 1;

    console.log(`Descargando registros ${from}-${to}...`);

    const { data, error } = await supabase
      .from('ventas_historicas')
      .select('sku')
      .range(from, to)
      .order('id', { ascending: true });

    if (error) {
      console.log('❌ Error:', error.message);
      break;
    }

    if (!data || data.length === 0) {
      console.log('✅ No hay más registros.\n');
      break;
    }

    data.forEach(row => allSkus.add(row.sku));
    totalRecords += data.length;

    console.log(`  → ${data.length} registros, ${allSkus.size} SKUs únicos acumulados\n`);

    if (data.length < pageSize) {
      console.log('✅ Última página alcanzada.\n');
      break;
    }

    currentPage++;
  }

  console.log('='.repeat(60));
  console.log(`📊 RESULTADOS FINALES:`);
  console.log(`   Total registros procesados: ${totalRecords}`);
  console.log(`   SKUs únicos: ${allSkus.size}`);
  console.log('='.repeat(60));

  const skusList = Array.from(allSkus).sort();
  console.log('\n📋 Primeros 50 SKUs alfabéticamente:');
  skusList.slice(0, 50).forEach((sku, i) => {
    console.log(`  ${i + 1}. ${sku}`);
  });

  if (skusList.length > 50) {
    console.log('\n📋 Últimos 20 SKUs alfabéticamente:');
    skusList.slice(-20).forEach((sku, i) => {
      console.log(`  ${skusList.length - 20 + i + 1}. ${sku}`);
    });
  }
}

main().catch(console.error);
