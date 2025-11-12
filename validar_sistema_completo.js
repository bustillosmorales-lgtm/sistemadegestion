/**
 * Validación completa del sistema
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function validarDatosBase() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 VALIDACIÓN DE DATOS BASE');
  console.log('='.repeat(70));

  // 1. VENTAS
  console.log('\n1️⃣  VENTAS HISTÓRICAS:');

  const { count: ventasCount } = await supabase
    .from('ventas_historicas')
    .select('*', { count: 'exact', head: true });

  console.log(`   ✓ Total registros: ${ventasCount?.toLocaleString()}`);

  // Contar SKUs únicos con paginación
  let allSkus = new Set();
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('ventas_historicas')
      .select('sku')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!data || data.length === 0) break;
    data.forEach(v => allSkus.add(v.sku));
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`   ✓ SKUs únicos: ${allSkus.size.toLocaleString()}`);

  // Rango de fechas
  const { data: fechaMin } = await supabase
    .from('ventas_historicas')
    .select('fecha')
    .order('fecha', { ascending: true })
    .limit(1);

  const { data: fechaMax } = await supabase
    .from('ventas_historicas')
    .select('fecha', { ascending: false })
    .order('fecha')
    .limit(1);

  console.log(`   ✓ Rango: ${fechaMin?.[0]?.fecha} → ${fechaMax?.[0]?.fecha}`);

  // Distribución por empresa y canal
  const { data: ventas } = await supabase
    .from('ventas_historicas')
    .select('empresa, canal')
    .limit(10000);

  const distribucion = {};
  ventas?.forEach(v => {
    const key = `${v.empresa}-${v.canal}`;
    distribucion[key] = (distribucion[key] || 0) + 1;
  });

  console.log(`   ✓ Distribución:`);
  Object.entries(distribucion).forEach(([key, count]) => {
    console.log(`     - ${key}: ${count.toLocaleString()} registros`);
  });

  // 2. STOCK
  console.log('\n2️⃣  STOCK ACTUAL:');

  const { count: stockCount } = await supabase
    .from('stock_actual')
    .select('*', { count: 'exact', head: true });

  console.log(`   ✓ Total SKUs: ${stockCount?.toLocaleString()}`);

  // Stock total
  const { data: stockData } = await supabase
    .from('stock_actual')
    .select('bodega_c, bodega_d, bodega_e, bodega_f, bodega_h, bodega_j')
    .limit(10000);

  let stockTotal = 0;
  stockData?.forEach(s => {
    stockTotal += (s.bodega_c || 0) + (s.bodega_d || 0) + (s.bodega_e || 0) +
                  (s.bodega_f || 0) + (s.bodega_h || 0) + (s.bodega_j || 0);
  });

  console.log(`   ✓ Unidades totales en stock: ${stockTotal.toLocaleString()}`);

  // 3. TRÁNSITO
  console.log('\n3️⃣  TRÁNSITO CHINA:');

  const { count: transitoCount } = await supabase
    .from('transito_china')
    .select('*', { count: 'exact', head: true });

  const { data: transitoData } = await supabase
    .from('transito_china')
    .select('unidades');

  const transitoTotal = transitoData?.reduce((sum, t) => sum + (t.unidades || 0), 0) || 0;

  console.log(`   ✓ Registros: ${transitoCount?.toLocaleString()}`);
  console.log(`   ✓ Unidades en tránsito: ${transitoTotal.toLocaleString()}`);

  // 4. COMPRAS
  console.log('\n4️⃣  COMPRAS HISTÓRICAS:');

  const { count: comprasCount } = await supabase
    .from('compras_historicas')
    .select('*', { count: 'exact', head: true });

  console.log(`   ✓ Registros: ${comprasCount?.toLocaleString()}`);

  // 5. PACKS
  console.log('\n5️⃣  PACKS:');

  const { count: packsCount } = await supabase
    .from('packs')
    .select('*', { count: 'exact', head: true });

  const { data: packsData } = await supabase
    .from('packs')
    .select('sku_pack')
    .limit(10000);

  const skusPack = new Set(packsData?.map(p => p.sku_pack));

  console.log(`   ✓ Registros: ${packsCount?.toLocaleString()}`);
  console.log(`   ✓ SKUs pack únicos: ${skusPack.size.toLocaleString()}`);

  return {
    ventas: ventasCount,
    skus: allSkus.size,
    stock: stockCount,
    transito: transitoCount,
    compras: comprasCount,
    packs: packsCount
  };
}

async function validarPredicciones() {
  console.log('\n' + '='.repeat(70));
  console.log('🔮 VALIDACIÓN DE PREDICCIONES ML');
  console.log('='.repeat(70));

  const { count: predCount } = await supabase
    .from('predicciones')
    .select('*', { count: 'exact', head: true });

  if (!predCount || predCount === 0) {
    console.log('\n⚠️  No hay predicciones aún. Workflow en progreso...');
    return null;
  }

  console.log(`\n✓ Total predicciones: ${predCount.toLocaleString()}`);

  // Última fecha de cálculo
  const { data: ultima } = await supabase
    .from('predicciones')
    .select('fecha_calculo')
    .order('fecha_calculo', { ascending: false })
    .limit(1);

  console.log(`✓ Última actualización: ${new Date(ultima[0].fecha_calculo).toLocaleString()}`);

  // Distribución ABC
  const { data: todasPred } = await supabase
    .from('predicciones')
    .select('*')
    .limit(10000);

  const abc = { A: 0, B: 0, C: 0 };
  const xyz = { X: 0, Y: 0, Z: 0 };
  let totalValor = 0;
  let totalUnidades = 0;

  todasPred?.forEach(p => {
    abc[p.clasificacion_abc] = (abc[p.clasificacion_abc] || 0) + 1;
    xyz[p.clasificacion_xyz] = (xyz[p.clasificacion_xyz] || 0) + 1;
    totalValor += p.valor_total_sugerencia || 0;
    totalUnidades += p.sugerencia_reposicion || 0;
  });

  console.log(`\n📊 Clasificación ABC:`);
  console.log(`   A: ${abc.A || 0} SKUs (${((abc.A || 0) / predCount * 100).toFixed(1)}%)`);
  console.log(`   B: ${abc.B || 0} SKUs (${((abc.B || 0) / predCount * 100).toFixed(1)}%)`);
  console.log(`   C: ${abc.C || 0} SKUs (${((abc.C || 0) / predCount * 100).toFixed(1)}%)`);

  console.log(`\n📊 Clasificación XYZ (variabilidad):`);
  console.log(`   X (baja): ${xyz.X || 0} SKUs`);
  console.log(`   Y (media): ${xyz.Y || 0} SKUs`);
  console.log(`   Z (alta): ${xyz.Z || 0} SKUs`);

  console.log(`\n💰 Sugerencias de reposición:`);
  console.log(`   Total unidades: ${totalUnidades.toLocaleString()}`);
  console.log(`   Valor total: $${totalValor.toLocaleString()}`);

  // Top 10
  const { data: top10 } = await supabase
    .from('predicciones')
    .select('sku, clasificacion_abc, venta_diaria_promedio, stock_actual, dias_stock_actual, sugerencia_reposicion, valor_total_sugerencia')
    .order('valor_total_sugerencia', { ascending: false })
    .limit(10);

  console.log(`\n🏆 TOP 10 PRODUCTOS POR VALOR:`);
  top10?.forEach((p, i) => {
    console.log(`\n   ${i + 1}. ${p.sku} [${p.clasificacion_abc}]`);
    console.log(`      Venta diaria: ${p.venta_diaria_promedio.toFixed(2)} unidades/día`);
    console.log(`      Stock actual: ${p.stock_actual} unidades (${p.dias_stock_actual} días)`);
    console.log(`      Sugerencia: ${p.sugerencia_reposicion.toLocaleString()} unidades`);
    console.log(`      Valor: $${p.valor_total_sugerencia.toLocaleString()}`);
  });

  // Alertas
  const { count: alertasCount } = await supabase
    .from('alertas_inventario')
    .select('*', { count: 'exact', head: true });

  console.log(`\n🚨 ALERTAS:`);
  console.log(`   Total: ${alertasCount || 0}`);

  const { data: alertas } = await supabase
    .from('alertas_inventario')
    .select('severidad')
    .eq('estado', 'activa');

  const sevCounts = {
    critica: alertas?.filter(a => a.severidad === 'critica').length || 0,
    alta: alertas?.filter(a => a.severidad === 'alta').length || 0,
    media: alertas?.filter(a => a.severidad === 'media').length || 0
  };

  console.log(`   🔴 Críticas: ${sevCounts.critica}`);
  console.log(`   🟠 Altas: ${sevCounts.alta}`);
  console.log(`   🟡 Medias: ${sevCounts.media}`);

  return { predCount, totalValor, totalUnidades };
}

async function validarIntegridad() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 VALIDACIÓN DE INTEGRIDAD');
  console.log('='.repeat(70));

  // SKUs en ventas vs predicciones
  const { data: ventasSkus } = await supabase
    .from('ventas_historicas')
    .select('sku')
    .limit(10000);

  const { data: predSkus } = await supabase
    .from('predicciones')
    .select('sku')
    .limit(10000);

  const ventasSet = new Set(ventasSkus?.map(v => v.sku));
  const predSet = new Set(predSkus?.map(p => p.sku));

  console.log(`\n✓ SKUs en ventas: ${ventasSet.size.toLocaleString()}`);
  console.log(`✓ SKUs con predicción: ${predSet.size.toLocaleString()}`);

  if (predSet.size > 0) {
    const cobertura = (predSet.size / ventasSet.size * 100).toFixed(1);
    console.log(`✓ Cobertura: ${cobertura}%`);
  }
}

async function main() {
  console.log('\n🔎 VALIDACIÓN COMPLETA DEL SISTEMA');
  console.log('Iniciado: ' + new Date().toLocaleString());

  try {
    // 1. Validar datos base
    const stats = await validarDatosBase();

    // 2. Validar predicciones
    const predStats = await validarPredicciones();

    // 3. Validar integridad
    if (predStats) {
      await validarIntegridad();
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ VALIDACIÓN COMPLETADA');
    console.log('='.repeat(70));

    if (predStats) {
      console.log('\n📋 RESUMEN:');
      console.log(`   ✓ ${stats.ventas.toLocaleString()} ventas históricas`);
      console.log(`   ✓ ${stats.skus.toLocaleString()} SKUs únicos`);
      console.log(`   ✓ ${predStats.predCount.toLocaleString()} predicciones generadas`);
      console.log(`   ✓ $${predStats.totalValor.toLocaleString()} valor total sugerido`);
      console.log('\n   🌐 Dashboard: https://sistemadegestion.net');
    } else {
      console.log('\n⏳ Esperando predicciones del workflow ML...');
      console.log('   📋 https://github.com/bustillosmorales-lgtm/sistemadegestion/actions');
    }

    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
