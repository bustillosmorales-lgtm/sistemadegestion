// Script para APLICAR configuración de compras frecuentes
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function applyConfig() {
  console.log('🔧 APLICANDO configuración de compras frecuentes...\n');

  // 1. Obtener config actual
  const { data: current } = await supabase
    .from('configuration')
    .select('data')
    .eq('id', 1)
    .single();

  const config = current?.data || {};

  console.log('📊 Config ANTES:');
  console.log(`   tiempoEntrega: ${config.tiempoEntrega} días`);
  console.log(`   stockSaludableMinDias: ${config.stockSaludableMinDias} días`);

  // 2. Actualizar config
  const updatedConfig = {
    ...config,
    tiempoEntrega: 35,           // ← AJUSTA SEGÚN TU REALIDAD
    stockSaludableMinDias: 60,   // ← AJUSTA SEGÚN TU REALIDAD
    stockCriticoDias: 20
  };

  const { error } = await supabase
    .from('configuration')
    .update({ data: updatedConfig })
    .eq('id', 1);

  if (error) {
    console.error('❌ Error actualizando:', error);
    return;
  }

  console.log('\n✅ Configuración actualizada!\n');
  console.log('📊 Config DESPUÉS:');
  console.log(`   tiempoEntrega: ${updatedConfig.tiempoEntrega} días`);
  console.log(`   stockSaludableMinDias: ${updatedConfig.stockSaludableMinDias} días`);
  console.log(`   stockCriticoDias: ${updatedConfig.stockCriticoDias} días`);

  console.log('\n⚠️  IMPORTANTE: Próximos pasos');
  console.log('   1. Cargar el dashboard para recalcular todos los productos');
  console.log('   2. Verificar que los números tienen sentido');
  console.log('   3. Si no te gusta, puedes revertir desde /config\n');

  console.log('💡 TIP: Puedes ajustar estos valores en tiempo real desde /config\n');
}

applyConfig().catch(console.error);
