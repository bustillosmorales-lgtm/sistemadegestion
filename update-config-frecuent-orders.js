// Script para actualizar config a modelo de compras frecuentes
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function updateConfig() {
  console.log('🔧 Actualizando configuración para modelo de compras frecuentes...\n');

  // 1. Obtener config actual
  const { data: current } = await supabase
    .from('configuration')
    .select('data')
    .eq('id', 1)
    .single();

  const config = current?.data || {};

  console.log('📊 CONFIGURACIÓN ACTUAL:');
  console.log(`   tiempoEntrega: ${config.tiempoEntrega} días`);
  console.log(`   stockSaludableMinDias: ${config.stockSaludableMinDias} días`);

  // 2. Nueva configuración
  const newConfig = {
    ...config,
    tiempoEntrega: 35,           // Tiempo real de llegada de 1 pedido
    stockSaludableMinDias: 60,   // Stock objetivo (2 ciclos)
    stockCriticoDias: 20         // Nivel crítico (re-orden urgente)
  };

  console.log('\n📊 NUEVA CONFIGURACIÓN PROPUESTA:');
  console.log(`   tiempoEntrega: ${newConfig.tiempoEntrega} días`);
  console.log(`   stockSaludableMinDias: ${newConfig.stockSaludableMinDias} días`);
  console.log(`   stockCriticoDias: ${newConfig.stockCriticoDias} días`);

  console.log('\n💡 EXPLICACIÓN:');
  console.log('   - Tiempo de entrega: 35 días (tiempo real que tarda en llegar)');
  console.log('   - Stock objetivo: 60 días (cubre ~2 ciclos de compra)');
  console.log('   - Stock crítico: 20 días (alerta temprana)');

  console.log('\n🎯 BENEFICIOS:');
  console.log('   ✅ Puedes hacer órdenes cada 30-45 días');
  console.log('   ✅ Múltiples órdenes en tránsito simultáneamente');
  console.log('   ✅ Menos productos en NEEDS_REPLENISHMENT');
  console.log('   ✅ Evitas quiebres de stock');

  console.log('\n⚠️  IMPACTO ESPERADO:');
  console.log('   - NEEDS_REPLENISHMENT: de ~5,525 a ~1,500-2,000');
  console.log('   - NO_REPLENISHMENT_NEEDED: de ~193 a ~3,500-4,000');

  console.log('\n⏳ ¿Deseas aplicar estos cambios?');
  console.log('   Para aplicar: node apply-config-frecuent-orders.js');
  console.log('   Para ajustar valores: edita este script\n');
}

updateConfig().catch(console.error);
