// Ver configuración actual
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkConfig() {
  const { data } = await supabase
    .from('configuration')
    .select('data')
    .eq('id', 1)
    .single();

  const config = data?.data || {};

  console.log('⚙️  CONFIGURACIÓN ACTUAL:\n');
  console.log('📦 STOCK:');
  console.log(`   stockSaludableMinDias: ${config.stockSaludableMinDias || 'NO DEFINIDO'}`);
  console.log(`   tiempoEntrega: ${config.tiempoEntrega || 'NO DEFINIDO'}`);
  console.log(`   stockCriticoDias: ${config.stockCriticoDias || 'NO DEFINIDO'}`);

  console.log('\n💱 TASAS:');
  console.log(`   rmbToUsd: ${config.rmbToUsd || 'NO DEFINIDO'}`);
  console.log(`   usdToClp: ${config.usdToClp || 'NO DEFINIDO'}`);

  console.log('\n');
}

checkConfig().catch(console.error);
