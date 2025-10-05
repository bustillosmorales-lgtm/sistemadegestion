const { supabase } = require('./lib/supabaseClient');

async function checkSkus() {
  const testSkus = [
    '649762434915-AMA',
    '649762433567',
    '649762433703',
    'PACK0037',
    '649762430726-TUR'
  ];

  console.log('🔍 Verificando SKUs procesados...\n');

  for (const sku of testSkus) {
    const { data, error } = await supabase
      .from('products')
      .select('sku, status, request_details')
      .eq('sku', sku)
      .single();

    if (error) {
      console.log(`❌ SKU ${sku}: NO ENCONTRADO (${error.message})`);
    } else {
      console.log(`✅ SKU ${sku}:`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Request details: ${JSON.stringify(data.request_details || {})}`);
    }
    console.log('');
  }

  process.exit(0);
}

checkSkus();
