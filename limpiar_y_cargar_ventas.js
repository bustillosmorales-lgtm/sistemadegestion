/**
 * Limpia tabla ventas_historicas y recarga datos
 */

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function excelDateToJSDate(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') {
    const date = new Date(excelDate);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  }
  if (excelDate instanceof Date) {
    return excelDate.toISOString().split('T')[0];
  }
  if (typeof excelDate === 'number') {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  return null;
}

async function main() {
  console.log('🗑️  Limpiando tabla ventas_historicas...');

  // Eliminar todos los registros
  const { error: deleteError } = await supabase
    .from('ventas_historicas')
    .delete()
    .neq('id', 0); // Eliminar todos donde id != 0 (todos)

  if (deleteError) {
    console.log(`❌ Error limpiando: ${deleteError.message}`);
    return;
  }

  console.log('✅ Tabla limpiada\n');

  console.log('📊 Cargando ventas desde ventas.xlsx...');

  const workbook = XLSX.readFile('ventas.xlsx');
  const ventasSheet = workbook.Sheets['ventas'];
  const ventasData = XLSX.utils.sheet_to_json(ventasSheet, { header: 1 });

  const registros = [];

  for (let i = 1; i < ventasData.length; i++) {
    const row = ventasData[i];

    if (i % 5000 === 0) {
      console.log(`  Leyendo fila ${i}...`);
    }

    const empresa = row[0]?.toString().trim();
    const canal = row[1]?.toString().trim();
    const sku = row[19]?.toString().trim();
    const unidades = parseFloat(row[10]) || 0;

    // Validar que existan los campos básicos
    if (!empresa || !canal || !sku || unidades <= 0) continue;

    const fecha = excelDateToJSDate(row[5]);

    registros.push({
      empresa,
      canal,
      fecha,
      unidades,
      sku,
      mlc: row[20]?.toString().trim() || '',
      descripcion: row[21]?.toString().trim() || '',
      precio: parseFloat(row[23]) || 0
    });
  }

  console.log(`  📝 ${registros.length} ventas encontradas`);

  // Eliminar duplicados basándose en constraint: (sku, fecha, canal)
  const registrosUnicos = [];
  const vistos = new Set();

  for (const registro of registros) {
    const clave = `${registro.sku}|${registro.fecha}|${registro.canal}`;
    if (!vistos.has(clave)) {
      vistos.add(clave);
      registrosUnicos.push(registro);
    }
  }

  console.log(`  🔧 Duplicados eliminados: ${registros.length - registrosUnicos.length}`);
  console.log(`  ✅ ${registrosUnicos.length} ventas únicas listas para insertar\n`);

  // Insertar en lotes
  let insertados = 0;
  for (let i = 0; i < registrosUnicos.length; i += 50) {
    const batch = registrosUnicos.slice(i, i + 50);
    const { error } = await supabase.from('ventas_historicas').insert(batch);

    if (error) {
      console.log(`  ❌ Error insertando batch: ${error.message}`);
      break;
    }

    insertados += batch.length;
    console.log(`  ✓ ${insertados}/${registrosUnicos.length} ventas insertadas...`);
  }

  console.log(`\n✅ ${insertados} ventas insertadas exitosamente!`);
}

main().catch(console.error);
