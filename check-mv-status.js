// Script para verificar el estado de la vista materializada sku_venta_diaria_mv
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkMVStatus() {
  console.log('🔍 Verificando estado de vista materializada sku_venta_diaria_mv...\n');

  // 1. Verificar si existe la vista
  const { data: mvExists, error: existsError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT EXISTS (
        SELECT FROM pg_matviews
        WHERE schemaname = 'public'
        AND matviewname = 'sku_venta_diaria_mv'
      ) as exists;
    `
  }).single();

  if (existsError) {
    console.log('⚠️ No se pudo verificar con RPC, intentando query directo...');

    // Intentar consulta directa
    const { data: sampleData, error: sampleError } = await supabase
      .from('sku_venta_diaria_mv')
      .select('*')
      .limit(5);

    if (sampleError) {
      console.error('❌ La vista materializada NO existe o no es accesible');
      console.error('Error:', sampleError.message);
      console.log('\n📝 Para crearla, ejecuta en Supabase SQL Editor:');
      console.log('   Archivo: sql/create-venta-diaria-mv.sql\n');
      return;
    } else {
      console.log('✅ La vista materializada existe y es accesible\n');

      if (sampleData && sampleData.length > 0) {
        console.log('📊 Muestra de datos:');
        sampleData.forEach(row => {
          console.log(`   SKU: ${row.sku}`);
          console.log(`   Venta Diaria: ${row.venta_diaria}`);
          console.log(`   Fecha Inicio: ${row.fecha_inicio || 'NULL'}`);
          console.log(`   Fecha Fin: ${row.fecha_fin || 'NULL'}`);
          console.log(`   Días Periodo: ${row.dias_periodo || 0}`);
          console.log(`   Total Vendido: ${row.total_vendido || 0}`);
          console.log(`   Actualizado: ${row.actualizado_en || 'NULL'}`);
          console.log('   ---');
        });
      }
    }
  }

  // 2. Contar registros
  const { count, error: countError } = await supabase
    .from('sku_venta_diaria_mv')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`\n📈 Total de SKUs en la vista: ${count}`);
  }

  // 3. Verificar SKUs con fechas NULL
  const { data: nullDates, error: nullError } = await supabase
    .from('sku_venta_diaria_mv')
    .select('sku, fecha_inicio, fecha_fin, dias_periodo, total_vendido')
    .or('fecha_inicio.is.null,fecha_fin.is.null')
    .limit(10);

  if (!nullError && nullDates && nullDates.length > 0) {
    console.log(`\n⚠️ SKUs con fechas NULL (mostrando 10 de ${nullDates.length}):`);
    nullDates.forEach(row => {
      console.log(`   ${row.sku}: inicio=${row.fecha_inicio}, fin=${row.fecha_fin}, total_vendido=${row.total_vendido}`);
    });
  }

  // 4. Verificar última actualización
  const { data: lastUpdate, error: updateError } = await supabase
    .from('sku_venta_diaria_mv')
    .select('actualizado_en')
    .order('actualizado_en', { ascending: false })
    .limit(1)
    .single();

  if (!updateError && lastUpdate) {
    const lastUpdateDate = new Date(lastUpdate.actualizado_en);
    const now = new Date();
    const hoursSince = Math.floor((now - lastUpdateDate) / (1000 * 60 * 60));

    console.log(`\n⏰ Última actualización: ${lastUpdateDate.toLocaleString()}`);
    console.log(`   (hace ${hoursSince} horas)`);

    if (hoursSince > 24) {
      console.log('   ⚠️ La vista tiene más de 24 horas sin refrescar');
      console.log('\n💡 Para refrescar, ejecuta en Supabase SQL Editor:');
      console.log('   REFRESH MATERIALIZED VIEW CONCURRENTLY sku_venta_diaria_mv;');
    }
  }

  // 5. Comparar con venta_diaria en products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('sku, venta_diaria')
    .not('venta_diaria', 'is', null)
    .limit(5);

  if (!productsError && products && products.length > 0) {
    console.log('\n📦 Venta diaria en tabla products (primeros 5 SKUs):');

    for (const product of products) {
      const { data: mvData } = await supabase
        .from('sku_venta_diaria_mv')
        .select('venta_diaria, fecha_inicio, fecha_fin')
        .eq('sku', product.sku)
        .single();

      console.log(`   ${product.sku}:`);
      console.log(`      En products: ${product.venta_diaria}`);
      console.log(`      En MV: ${mvData?.venta_diaria || 'NO EXISTE'}`);
      console.log(`      Fechas MV: ${mvData?.fecha_inicio || 'NULL'} a ${mvData?.fecha_fin || 'NULL'}`);
    }
  }

  console.log('\n✅ Verificación completada\n');
}

checkMVStatus().catch(console.error);
