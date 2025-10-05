// Script para analizar TODOS los productos en NEEDS_REPLENISHMENT
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeNeedsReplenishment() {
  console.log('🔍 Analizando productos en NEEDS_REPLENISHMENT...\n');

  // 1. Obtener config
  const { data: configData } = await supabase
    .from('configuration')
    .select('data')
    .eq('id', 1)
    .single();

  const config = configData?.data || {};
  const stockSaludableMinDias = config.stockSaludableMinDias || 90;
  const tiempoEntrega = config.tiempoEntrega || 90;

  console.log(`⚙️  Config: stockSaludable=${stockSaludableMinDias} días, tiempoEntrega=${tiempoEntrega} días\n`);

  // 2. Obtener TODOS los productos en NEEDS_REPLENISHMENT (en batches)
  let allProducts = [];
  let start = 0;
  const limit = 1000;
  let hasMore = true;

  console.log('📥 Obteniendo productos...');

  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select('sku, stock_actual, venta_diaria, status')
      .eq('status', 'NEEDS_REPLENISHMENT')
      .range(start, start + limit - 1);

    if (error) {
      console.error('Error:', error);
      break;
    }

    if (data && data.length > 0) {
      allProducts = allProducts.concat(data);
      start += limit;
      process.stdout.write(`\r   Cargados: ${allProducts.length}...`);
    } else {
      hasMore = false;
    }
  }

  console.log(`\n✅ Total productos cargados: ${allProducts.length}\n`);

  // 3. Obtener stock en tránsito para TODOS
  console.log('🚛 Calculando stock en tránsito...');

  const skus = allProducts.map(p => p.sku);
  const BATCH_SIZE = 500;
  let allTransit = [];

  for (let i = 0; i < skus.length; i += BATCH_SIZE) {
    const batch = skus.slice(i, i + BATCH_SIZE);
    const { data } = await supabase
      .from('compras')
      .select('sku, cantidad')
      .in('sku', batch)
      .in('status_compra', ['confirmado', 'en_transito']);

    if (data) allTransit = allTransit.concat(data);
    process.stdout.write(`\r   Procesados: ${Math.min(i + BATCH_SIZE, skus.length)}/${skus.length}...`);
  }

  console.log('\n');

  // Agrupar por SKU
  const transitMap = {};
  allTransit.forEach(t => {
    if (!transitMap[t.sku]) transitMap[t.sku] = 0;
    transitMap[t.sku] += t.cantidad || 0;
  });

  // 4. Calcular cantidadSugerida para cada producto
  console.log('🧮 Calculando cantidad sugerida...\n');

  let conSugerencia = 0;
  let sinSugerencia = 0;
  let sinVentas = 0;
  let stockSuficiente = 0;

  const malClasificados = [];

  allProducts.forEach(p => {
    const ventaDiaria = p.venta_diaria || 0;
    const stockActual = p.stock_actual || 0;
    const enTransito = transitMap[p.sku] || 0;

    // Cálculo EXACTO de cantidadSugerida
    const consumoDuranteLeadTime = ventaDiaria * tiempoEntrega;
    const stockFinalProyectado = stockActual + enTransito - consumoDuranteLeadTime;
    const stockObjetivo = ventaDiaria * stockSaludableMinDias;
    const stockProyectadoParaCalculo = Math.max(0, stockFinalProyectado);
    const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - stockProyectadoParaCalculo));

    if (cantidadSugerida > 0) {
      conSugerencia++;
    } else {
      sinSugerencia++;

      // Clasificar el motivo
      if (ventaDiaria === 0) {
        sinVentas++;
      } else {
        stockSuficiente++;
      }

      // Guardar para análisis
      if (malClasificados.length < 20) {
        malClasificados.push({
          sku: p.sku,
          ventaDiaria,
          stockActual,
          enTransito,
          stockObjetivo,
          cantidadSugerida,
          motivo: ventaDiaria === 0 ? 'Sin ventas' : 'Stock suficiente'
        });
      }
    }
  });

  // 5. Resultados
  console.log('📊 RESULTADOS:\n');
  console.log(`Total productos analizados: ${allProducts.length}`);
  console.log(`\n✅ Con sugerencia > 0: ${conSugerencia} (${((conSugerencia/allProducts.length)*100).toFixed(1)}%)`);
  console.log(`❌ Con sugerencia = 0: ${sinSugerencia} (${((sinSugerencia/allProducts.length)*100).toFixed(1)}%)`);

  if (sinSugerencia > 0) {
    console.log(`\n   Desglose de los ${sinSugerencia} mal clasificados:`);
    console.log(`   📉 Sin ventas (venta_diaria=0): ${sinVentas}`);
    console.log(`   ✅ Stock suficiente: ${stockSuficiente}`);
  }

  if (malClasificados.length > 0) {
    console.log(`\n📋 Ejemplos de productos mal clasificados (primeros ${malClasificados.length}):\n`);
    malClasificados.forEach(p => {
      console.log(`   ${p.sku}: ${p.motivo}`);
      console.log(`      Venta diaria: ${p.ventaDiaria}`);
      console.log(`      Stock actual: ${p.stockActual}`);
      console.log(`      En tránsito: ${p.enTransito}`);
      console.log(`      Stock objetivo: ${p.stockObjetivo}`);
      console.log(`      ➜ Cantidad sugerida: ${p.cantidadSugerida} (debería ser 0)`);
      console.log('');
    });
  }

  console.log('\n💡 RECOMENDACIONES:\n');

  if (sinSugerencia > 1000) {
    console.log(`   ⚠️  CRÍTICO: ${sinSugerencia} productos mal clasificados (>${Math.round(sinSugerencia/allProducts.length*100)}%)`);
    console.log('   📌 Ejecutar script de reclasificación masiva URGENTE');
    console.log('   📌 Comando: node reclassify-all.js');
  } else if (sinSugerencia > 100) {
    console.log(`   ⚠️  ${sinSugerencia} productos mal clasificados`);
    console.log('   📌 Ejecutar reclasificación recomendada');
  } else if (sinSugerencia > 0) {
    console.log(`   ℹ️  ${sinSugerencia} productos se reclasificarán automáticamente`);
    console.log('   📌 Al cargar el dashboard se corregirá');
  } else {
    console.log('   ✅ PERFECTO: Todos los productos están correctamente clasificados');
  }

  console.log('\n✅ Análisis completado\n');
}

analyzeNeedsReplenishment().catch(console.error);
