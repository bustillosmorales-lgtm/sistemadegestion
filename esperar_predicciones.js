/**
 * Espera y verifica automáticamente cuando las predicciones estén listas
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const INTERVALO_CHECK = 30000; // 30 segundos
const MAX_INTENTOS = 20; // 10 minutos máximo

async function verificarPredicciones() {
  const { count } = await supabase
    .from('predicciones')
    .select('*', { count: 'exact', head: true });

  return count || 0;
}

async function mostrarResumen() {
  console.log('\n' + '='.repeat(60));
  console.log('✅ ¡PREDICCIONES GENERADAS!');
  console.log('='.repeat(60) + '\n');

  // Total predicciones
  const { count } = await supabase
    .from('predicciones')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total predicciones: ${count}\n`);

  // Última fecha
  const { data: ultimaPrediccion } = await supabase
    .from('predicciones')
    .select('fecha_calculo')
    .order('fecha_calculo', { ascending: false })
    .limit(1);

  if (ultimaPrediccion && ultimaPrediccion.length > 0) {
    const fecha = new Date(ultimaPrediccion[0].fecha_calculo);
    console.log(`📅 Última predicción: ${fecha.toLocaleString()}\n`);
  }

  // Top 10 por valor
  const { data: top10 } = await supabase
    .from('predicciones')
    .select('sku, valor_total_sugerencia, sugerencia_reposicion, clasificacion_abc, dias_stock_actual')
    .order('valor_total_sugerencia', { ascending: false })
    .limit(10);

  if (top10 && top10.length > 0) {
    console.log('💰 TOP 10 PRODUCTOS POR VALOR DE SUGERENCIA:\n');
    top10.forEach((pred, i) => {
      console.log(`  ${i + 1}. ${pred.sku} [${pred.clasificacion_abc}]`);
      console.log(`     📦 Sugerencia: ${pred.sugerencia_reposicion.toLocaleString()} unidades`);
      console.log(`     💵 Valor: $${pred.valor_total_sugerencia.toLocaleString()}`);
      console.log(`     📊 Stock actual: ${pred.dias_stock_actual} días\n`);
    });
  }

  // Estadísticas por clasificación ABC
  const { data: todasPredicciones } = await supabase
    .from('predicciones')
    .select('clasificacion_abc, valor_total_sugerencia, sugerencia_reposicion');

  if (todasPredicciones) {
    const stats = {
      A: { count: 0, valor: 0, unidades: 0 },
      B: { count: 0, valor: 0, unidades: 0 },
      C: { count: 0, valor: 0, unidades: 0 }
    };

    todasPredicciones.forEach(pred => {
      const clase = pred.clasificacion_abc || 'C';
      stats[clase].count++;
      stats[clase].valor += pred.valor_total_sugerencia || 0;
      stats[clase].unidades += pred.sugerencia_reposicion || 0;
    });

    console.log('📈 DISTRIBUCIÓN POR CLASIFICACIÓN ABC:\n');
    console.log(`  🅰️  Clase A: ${stats.A.count} SKUs`);
    console.log(`     💰 Valor: $${stats.A.valor.toLocaleString()}`);
    console.log(`     📦 Unidades: ${stats.A.unidades.toLocaleString()}\n`);

    console.log(`  🅱️  Clase B: ${stats.B.count} SKUs`);
    console.log(`     💰 Valor: $${stats.B.valor.toLocaleString()}`);
    console.log(`     📦 Unidades: ${stats.B.unidades.toLocaleString()}\n`);

    console.log(`  ©️  Clase C: ${stats.C.count} SKUs`);
    console.log(`     💰 Valor: $${stats.C.valor.toLocaleString()}`);
    console.log(`     📦 Unidades: ${stats.C.unidades.toLocaleString()}\n`);

    const totalValor = stats.A.valor + stats.B.valor + stats.C.valor;
    const totalUnidades = stats.A.unidades + stats.B.unidades + stats.C.unidades;

    console.log(`  📊 TOTAL SUGERIDO:`);
    console.log(`     💰 Valor: $${totalValor.toLocaleString()}`);
    console.log(`     📦 Unidades: ${totalUnidades.toLocaleString()}\n`);
  }

  // Alertas
  const { data: alertas } = await supabase
    .from('alertas_inventario')
    .select('severidad, estado')
    .eq('estado', 'activa');

  if (alertas && alertas.length > 0) {
    const criticas = alertas.filter(a => a.severidad === 'critica').length;
    const altas = alertas.filter(a => a.severidad === 'alta').length;
    const medias = alertas.filter(a => a.severidad === 'media').length;

    console.log('🚨 ALERTAS ACTIVAS:\n');
    console.log(`  🔴 Críticas: ${criticas}`);
    console.log(`  🟠 Altas: ${altas}`);
    console.log(`  🟡 Medias: ${medias}`);
    console.log(`  📊 Total: ${alertas.length}\n`);
  }

  console.log('='.repeat(60));
  console.log('✅ Dashboard actualizado en: https://sistemadegestion.net');
  console.log('='.repeat(60) + '\n');
}

async function main() {
  console.log('⏳ Esperando a que el workflow de forecasting termine...\n');
  console.log('📋 Workflow: https://github.com/bustillosmorales-lgtm/sistemadegestion/actions\n');
  console.log(`⏱️  Verificando cada ${INTERVALO_CHECK / 1000} segundos...\n`);

  let intentos = 0;

  const intervalo = setInterval(async () => {
    intentos++;

    const count = await verificarPredicciones();

    if (count > 0) {
      clearInterval(intervalo);
      await mostrarResumen();
      process.exit(0);
    } else {
      const tiempo = Math.floor((intentos * INTERVALO_CHECK) / 1000);
      process.stdout.write(`\r⏳ Esperando... (${tiempo}s) - Predicciones: ${count}     `);
    }

    if (intentos >= MAX_INTENTOS) {
      clearInterval(intervalo);
      console.log('\n\n⚠️  Tiempo máximo de espera alcanzado (10 minutos).');
      console.log('   El workflow puede estar tardando más de lo esperado.');
      console.log('   Verifica el estado en: https://github.com/bustillosmorales-lgtm/sistemadegestion/actions\n');
      process.exit(1);
    }
  }, INTERVALO_CHECK);

  // Primera verificación inmediata
  const count = await verificarPredicciones();
  if (count > 0) {
    clearInterval(intervalo);
    await mostrarResumen();
    process.exit(0);
  }
}

main().catch(console.error);
