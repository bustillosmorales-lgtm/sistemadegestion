/**
 * Verifica si las predicciones fueron generadas
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('🔍 Verificando predicciones en Supabase...\n');

  // Contar predicciones
  const { count, error } = await supabase
    .from('predicciones')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  console.log(`📊 Total predicciones: ${count || 0}`);

  if (count && count > 0) {
    // Obtener última fecha de cálculo
    const { data: ultimaPrediccion } = await supabase
      .from('predicciones')
      .select('fecha_calculo')
      .order('fecha_calculo', { ascending: false })
      .limit(1);

    if (ultimaPrediccion && ultimaPrediccion.length > 0) {
      console.log(`📅 Última predicción: ${ultimaPrediccion[0].fecha_calculo}\n`);
    }

    // Obtener top 10 por valor
    const { data: top10 } = await supabase
      .from('predicciones')
      .select('sku, valor_total_sugerencia, sugerencia_reposicion, clasificacion_abc')
      .order('valor_total_sugerencia', { ascending: false })
      .limit(10);

    if (top10 && top10.length > 0) {
      console.log('💰 TOP 10 PRODUCTOS POR VALOR:\n');
      top10.forEach((pred, i) => {
        console.log(`  ${i + 1}. ${pred.sku} [${pred.clasificacion_abc}]`);
        console.log(`     Sugerencia: ${pred.sugerencia_reposicion} unidades`);
        console.log(`     Valor: $${pred.valor_total_sugerencia.toLocaleString()}\n`);
      });
    }

    // Contar alertas
    const { data: alertas } = await supabase
      .from('alertas_inventario')
      .select('severidad, estado')
      .eq('estado', 'activa');

    if (alertas) {
      const criticas = alertas.filter(a => a.severidad === 'critica').length;
      const altas = alertas.filter(a => a.severidad === 'alta').length;
      const medias = alertas.filter(a => a.severidad === 'media').length;

      console.log('🚨 ALERTAS ACTIVAS:\n');
      console.log(`  🔴 Críticas: ${criticas}`);
      console.log(`  🟠 Altas: ${altas}`);
      console.log(`  🟡 Medias: ${medias}`);
      console.log(`  📊 Total: ${alertas.length}\n`);
    }

    console.log('✅ Predicciones disponibles en el dashboard');
    console.log('   👉 https://sistemadegestion.net\n');

  } else {
    console.log('⚠️  No hay predicciones aún.');
    console.log('   Verifica el estado del workflow en GitHub Actions.');
    console.log('   👉 https://github.com/bustillosmorales-lgtm/sistemadegestion/actions\n');
  }
}

main().catch(console.error);
