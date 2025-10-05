const { supabase } = require('./lib/supabaseClient');

async function checkQuoteRequested() {
  console.log('🔍 Verificando productos en QUOTE_REQUESTED...\n');

  // Contar total
  const { data, count } = await supabase
    .from('products')
    .select('sku, status, request_details, updated_at', { count: 'exact' })
    .eq('status', 'QUOTE_REQUESTED')
    .order('updated_at', { ascending: false })
    .limit(20);

  console.log(`Total en QUOTE_REQUESTED: ${count || 0}\n`);

  if (data && data.length > 0) {
    console.log('Últimos 20 productos actualizados:');
    data.forEach((p, i) => {
      const qty = p.request_details?.quantityToQuote || 'N/A';
      const comments = p.request_details?.comments || '';
      const date = new Date(p.updated_at).toLocaleString();
      console.log(`${i+1}. SKU: ${p.sku}`);
      console.log(`   Cantidad: ${qty}`);
      console.log(`   Comentarios: ${comments}`);
      console.log(`   Actualizado: ${date}`);
      console.log('');
    });
  }

  // Verificar también el cache
  const { count: cacheCount } = await supabase
    .from('dashboard_analysis_cache')
    .select('*', { count: 'exact' })
    .eq('status', 'QUOTE_REQUESTED')
    .gt('expires_at', new Date().toISOString());

  console.log(`\nEn cache (QUOTE_REQUESTED): ${cacheCount || 0}`);

  process.exit(0);
}

checkQuoteRequested();
