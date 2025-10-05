const { supabase } = require('./lib/supabaseClient');

async function checkStatusCounts() {
  console.log('📊 Contando productos por status...\n');

  const statuses = [
    'NEEDS_REPLENISHMENT',
    'QUOTE_REQUESTED',
    'QUOTED',
    'ANALYZING',
    'PURCHASE_APPROVED',
    'PURCHASE_CONFIRMED',
    'MANUFACTURED',
    'SHIPPED'
  ];

  for (const status of statuses) {
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);

    if (count > 0) {
      console.log(`${status}: ${count}`);
    }
  }

  process.exit(0);
}

checkStatusCounts();
