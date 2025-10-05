const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testExportLogic() {
  console.log('🧪 Simulando lógica de export-by-status...\n');

  // Obtener del cache (como hace export-by-status línea 187-194)
  const { data: cachedData } = await supabase
    .from('dashboard_analysis_cache')
    .select('*')
    .eq('status', 'NEEDS_REPLENISHMENT')
    .gt('expires_at', new Date().toISOString());

  console.log('📊 Del cache: ' + cachedData.length + ' productos');

  // Filtrar recordatorios (como hace export-by-status línea 234-243)
  const today = new Date().toISOString().split('T')[0];
  const { data: reminders } = await supabase
    .from('replenishment_reminders')
    .select('sku')
    .eq('is_active', true)
    .gt('reminder_date', today);

  const reminderSkus = new Set((reminders || []).map(r => r.sku));
  console.log('🔔 Recordatorios activos: ' + reminderSkus.size);

  const filteredByReminders = cachedData.filter(p => !reminderSkus.has(p.sku));
  console.log('📊 Después de filtrar recordatorios: ' + filteredByReminders.length);

  // Ahora filtrar por cantidad_sugerida > 0 (línea 635)
  const finalFiltered = filteredByReminders.filter(p => (p.cantidad_sugerida || 0) > 0);
  console.log('📊 Con cantidad_sugerida > 0: ' + finalFiltered.length);

  console.log('\n✅ El Excel debería exportar: ' + finalFiltered.length + ' productos');

  // Verificar si el export-by-status está recalculando
  console.log('\n⚠️  IMPORTANTE: Verificar si export-by-status está:');
  console.log('   A) Usando cantidad_sugerida del cache (debería dar ~682)');
  console.log('   B) Recalculando cantidad_sugerida en tiempo real (puede dar diferente)');
}

testExportLogic().catch(console.error);
