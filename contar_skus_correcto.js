/**
 * Cuenta SKUs únicos usando SQL agregado
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('🔍 Contando SKUs únicos con SQL...\n');

  // Usar RPC o SQL directo para contar SKUs únicos
  const { data, error } = await supabase
    .rpc('count_unique_skus');

  if (error) {
    console.log('⚠️  RPC no disponible, usando método alternativo...\n');

    // Alternativa: Obtener todos los SKUs únicos con select distinct
    const { data: skusData, error: skusError } = await supabase
      .from('ventas_historicas')
      .select('sku')
      .limit(100000); // Límite alto para obtener todos

    if (skusError) {
      console.log('❌ Error:', skusError.message);
      return;
    }

    console.log(`Registros descargados: ${skusData.length}`);
    const skusUnicos = new Set(skusData.map(v => v.sku));
    console.log(`✅ SKUs únicos: ${skusUnicos.size}\n`);

    // Estadísticas adicionales
    const skusList = Array.from(skusUnicos).sort();
    console.log('📋 Primeros 20 SKUs alfabéticamente:');
    skusList.slice(0, 20).forEach((sku, i) => {
      console.log(`  ${i + 1}. ${sku}`);
    });

    console.log('\n📋 Últimos 20 SKUs alfabéticamente:');
    skusList.slice(-20).forEach((sku, i) => {
      console.log(`  ${skusList.length - 20 + i + 1}. ${sku}`);
    });

    return;
  }

  console.log('✅ SKUs únicos:', data);
}

main().catch(console.error);
