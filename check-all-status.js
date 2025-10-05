// Script simple para ver distribución de status
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAllStatus() {
  console.log('📊 Verificando distribución de status...\n');

  // Contar por cada status
  const statuses = [
    'NO_REPLENISHMENT_NEEDED',
    'NEEDS_REPLENISHMENT',
    'QUOTE_REQUESTED',
    'QUOTED',
    'QUOTED_PRICE_MODIFIED',
    'ANALYZING',
    'PURCHASE_APPROVED',
    'MANUFACTURING',
    'SHIPPED',
    'DELIVERED'
  ];

  let total = 0;
  const counts = {};

  for (const status of statuses) {
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);

    counts[status] = count || 0;
    total += count || 0;
    console.log(`${status.padEnd(30)}: ${(count || 0).toLocaleString()}`);
  }

  console.log(`\n${'TOTAL'.padEnd(30)}: ${total.toLocaleString()}`);

  // Calcular porcentajes
  console.log(`\n📈 Porcentajes:\n`);
  console.log(`NO_REPLENISHMENT_NEEDED: ${((counts.NO_REPLENISHMENT_NEEDED/total)*100).toFixed(1)}%`);
  console.log(`NEEDS_REPLENISHMENT: ${((counts.NEEDS_REPLENISHMENT/total)*100).toFixed(1)}%`);

  console.log('\n✅ Verificación completada\n');
}

checkAllStatus().catch(console.error);
