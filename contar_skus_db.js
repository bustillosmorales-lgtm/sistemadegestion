/**
 * Cuenta SKUs únicos directamente en la base de datos
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('🔍 Contando SKUs en ventas_historicas...\n');

  // Contar registros totales
  const { count: totalRegistros } = await supabase
    .from('ventas_historicas')
    .select('*', { count: 'exact', head: true });

  console.log(`Total registros: ${totalRegistros}\n`);

  // Obtener TODOS los SKUs (sin límite)
  const { data: todosLosDatos, error } = await supabase
    .from('ventas_historicas')
    .select('sku, fecha, canal, unidades')
    .order('fecha', { ascending: false });

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  console.log(`Registros descargados: ${todosLosDatos?.length}\n`);

  // Contar SKUs únicos
  const skusUnicos = new Set(todosLosDatos.map(v => v.sku));
  console.log(`SKUs únicos en la DB: ${skusUnicos.size}\n`);

  // Mostrar algunos ejemplos de SKUs
  const ejemplosSkus = Array.from(skusUnicos).slice(0, 30);
  console.log('📋 Primeros 30 SKUs:');
  ejemplosSkus.forEach((sku, i) => {
    console.log(`  ${i + 1}. ${sku}`);
  });

  // Ver distribución por fecha
  const fechas = new Set(todosLosDatos.map(v => v.fecha));
  console.log(`\n📅 Fechas únicas: ${fechas.size}`);

  const fechasOrdenadas = Array.from(fechas).sort();
  console.log(`Fecha min: ${fechasOrdenadas[0]}`);
  console.log(`Fecha max: ${fechasOrdenadas[fechasOrdenadas.length - 1]}`);

  // Ver registros por canal
  const canales = {};
  todosLosDatos.forEach(v => {
    canales[v.canal] = (canales[v.canal] || 0) + 1;
  });

  console.log('\n📊 Distribución por canal:');
  for (const [canal, count] of Object.entries(canales)) {
    console.log(`  ${canal}: ${count} registros`);
  }
}

main().catch(console.error);
