/**
 * Script Node.js para cargar Excel directamente a Supabase
 * Sin límites de tiempo
 */

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.log('❌ Error: Faltan variables SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Helper: Convertir fecha de Excel a ISO
function excelDateToJSDate(excelDate) {
  if (!excelDate) return null;

  // Si ya es string de fecha
  if (typeof excelDate === 'string') {
    const date = new Date(excelDate);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  }

  // Si es Date object
  if (excelDate instanceof Date) {
    return excelDate.toISOString().split('T')[0];
  }

  // Si es número de Excel (días desde 1900-01-01)
  if (typeof excelDate === 'number') {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  return null;
}

// Insertar en lotes
async function insertarBatch(tabla, datos, batchSize = 50) {
  if (!datos || datos.length === 0) return 0;

  const total = datos.length;
  let insertados = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = datos.slice(i, i + batchSize);

    const { error } = await supabase.from(tabla).insert(batch);

    if (error) {
      console.log(`  ❌ Error insertando batch: ${error.message}`);
      return insertados;
    }

    insertados += batch.length;
    console.log(`  ✓ ${insertados}/${total} registros insertados...`);
  }

  return insertados;
}

// Procesar ventas
async function procesarVentas(archivoExcel) {
  console.log('\n📊 Procesando VENTAS...');

  if (!fs.existsSync(archivoExcel)) {
    console.log(`  ⚠️  Archivo ${archivoExcel} no encontrado`);
    return;
  }

  const workbook = XLSX.readFile(archivoExcel);

  if (!workbook.SheetNames.includes('ventas')) {
    console.log('  ⚠️  Hoja "ventas" no encontrada');
    return;
  }

  const ventasSheet = workbook.Sheets['ventas'];
  const ventasData = XLSX.utils.sheet_to_json(ventasSheet, { header: 1 });

  const registros = [];

  // Saltar header (fila 0)
  for (let i = 1; i < ventasData.length; i++) {
    const row = ventasData[i];

    if (i % 5000 === 0) {
      console.log(`  Leyendo fila ${i}...`);
    }

    const empresa = row[0]?.toString().trim();
    const canal = row[1]?.toString().trim();

    // Solo TLT + MELI
    if (!empresa || !canal) continue;
    if (empresa.toUpperCase() !== 'TLT' || canal.toUpperCase() !== 'MELI') continue;

    const sku = row[19]?.toString().trim();
    const unidades = parseFloat(row[10]) || 0;

    if (!sku || unidades <= 0) continue;

    registros.push({
      empresa,
      canal,
      fecha: excelDateToJSDate(row[5]),
      unidades,
      sku,
      mlc: row[20]?.toString().trim() || '',
      descripcion: row[21]?.toString().trim() || '',
      precio: parseFloat(row[23]) || 0
    });
  }

  console.log(`  📝 ${registros.length} ventas válidas encontradas`);

  if (registros.length > 0) {
    const insertados = await insertarBatch('ventas_historicas', registros);
    console.log(`  ✅ ${insertados} ventas insertadas en Supabase`);
  }
}

// Procesar stock
async function procesarStock(archivoExcel) {
  console.log('\n📦 Procesando STOCK...');

  if (!fs.existsSync(archivoExcel)) {
    console.log(`  ⚠️  Archivo ${archivoExcel} no encontrado`);
    return;
  }

  const workbook = XLSX.readFile(archivoExcel);

  if (!workbook.SheetNames.includes('Stock')) {
    console.log('  ⚠️  Hoja "Stock" no encontrada');
    return;
  }

  const stockSheet = workbook.Sheets['Stock'];
  const stockData = XLSX.utils.sheet_to_json(stockSheet, { header: 1 });

  const registros = [];

  for (let i = 1; i < stockData.length; i++) {
    const row = stockData[i];
    const sku = row[0]?.toString().trim();

    if (!sku) continue;

    registros.push({
      sku,
      descripcion: row[1]?.toString().trim() || '',
      bodega_c: parseFloat(row[2]) || 0,
      bodega_d: parseFloat(row[3]) || 0,
      bodega_e: parseFloat(row[4]) || 0,
      bodega_f: parseFloat(row[5]) || 0,
      bodega_h: parseFloat(row[7]) || 0,
      bodega_j: parseFloat(row[9]) || 0
    });
  }

  console.log(`  📝 ${registros.length} SKUs encontrados`);

  if (registros.length > 0) {
    // Usar upsert para stock
    for (let i = 0; i < registros.length; i += 50) {
      const batch = registros.slice(i, i + 50);
      const { error } = await supabase.from('stock_actual').upsert(batch);
      if (error) {
        console.log(`  ❌ Error: ${error.message}`);
        break;
      }
      console.log(`  ✓ ${Math.min(i + 50, registros.length)}/${registros.length} SKUs insertados...`);
    }
    console.log(`  ✅ ${registros.length} SKUs insertados en Supabase`);
  }
}

// Procesar tránsito
async function procesarTransito(archivoExcel) {
  console.log('\n🚢 Procesando TRÁNSITO CHINA...');

  if (!fs.existsSync(archivoExcel)) {
    console.log(`  ⚠️  Archivo ${archivoExcel} no encontrado`);
    return;
  }

  const workbook = XLSX.readFile(archivoExcel);

  if (!workbook.SheetNames.includes('transito china')) {
    console.log('  ⚠️  Hoja "transito china" no encontrada');
    return;
  }

  const transitoSheet = workbook.Sheets['transito china'];
  const transitoData = XLSX.utils.sheet_to_json(transitoSheet, { header: 1 });

  const registros = [];

  for (let i = 1; i < transitoData.length; i++) {
    const row = transitoData[i];
    const sku = row[3]?.toString().trim();
    const unidades = parseFloat(row[7]) || 0;

    if (!sku || unidades <= 0) continue;

    registros.push({
      sku,
      unidades,
      estado: 'en_transito'
    });
  }

  console.log(`  📝 ${registros.length} registros encontrados`);

  if (registros.length > 0) {
    const insertados = await insertarBatch('transito_china', registros);
    console.log(`  ✅ ${insertados} registros insertados en Supabase`);
  }
}

// Procesar compras
async function procesarCompras(archivoExcel) {
  console.log('\n🛒 Procesando COMPRAS...');

  if (!fs.existsSync(archivoExcel)) {
    console.log(`  ⚠️  Archivo ${archivoExcel} no encontrado`);
    return;
  }

  const workbook = XLSX.readFile(archivoExcel);

  if (!workbook.SheetNames.includes('compras')) {
    console.log('  ⚠️  Hoja "compras" no encontrada');
    return;
  }

  const comprasSheet = workbook.Sheets['compras'];
  const comprasData = XLSX.utils.sheet_to_json(comprasSheet, { header: 1 });

  const registros = [];

  for (let i = 1; i < comprasData.length; i++) {
    const row = comprasData[i];
    const sku = row[0]?.toString().trim();
    const fecha = excelDateToJSDate(row[3]);

    if (!sku || !fecha) continue;

    registros.push({
      sku,
      fecha_compra: fecha
    });
  }

  console.log(`  📝 ${registros.length} compras encontradas`);

  if (registros.length > 0) {
    const insertados = await insertarBatch('compras_historicas', registros);
    console.log(`  ✅ ${insertados} compras insertadas en Supabase`);
  }
}

// Procesar packs
async function procesarPacks(archivoExcel) {
  console.log('\n📦 Procesando PACKS...');

  if (!fs.existsSync(archivoExcel)) {
    console.log(`  ⚠️  Archivo ${archivoExcel} no encontrado`);
    return;
  }

  const workbook = XLSX.readFile(archivoExcel);

  if (!workbook.SheetNames.includes('Packs')) {
    console.log('  ⚠️  Hoja "Packs" no encontrada');
    return;
  }

  const packsSheet = workbook.Sheets['Packs'];
  const packsData = XLSX.utils.sheet_to_json(packsSheet, { header: 1 });

  const registros = [];

  for (let i = 1; i < packsData.length; i++) {
    const row = packsData[i];
    const sku_pack = row[0]?.toString().trim();
    const sku_componente = row[1]?.toString().trim();
    const cantidad = parseFloat(row[2]) || 1;

    if (!sku_pack || !sku_componente) continue;

    registros.push({
      sku_pack,
      sku_componente,
      cantidad
    });
  }

  console.log(`  📝 ${registros.length} packs encontrados`);

  if (registros.length > 0) {
    const insertados = await insertarBatch('packs', registros);
    console.log(`  ✅ ${insertados} packs insertados en Supabase`);
  }
}

// Main
async function main() {
  console.log('='.repeat(70));
  console.log('  📊 CARGA DE DATOS EXCEL A SUPABASE');
  console.log('='.repeat(70));

  const archivoVentas = 'ventas.xlsx';
  const archivoOtros = 'otros_datos.xlsx';

  // Verificar archivos
  const ventasExiste = fs.existsSync(archivoVentas);
  const otrosExiste = fs.existsSync(archivoOtros);

  if (!ventasExiste && !otrosExiste) {
    console.log('\n❌ No se encontraron los archivos divididos.');
    console.log('   Necesitas tener:');
    console.log('   - ventas.xlsx (solo hoja "ventas")');
    console.log('   - otros_datos.xlsx (Stock, transito, compras, Packs)');
    return;
  }

  console.log('\n✅ Archivos encontrados:');
  if (ventasExiste) console.log(`   - ${archivoVentas}`);
  if (otrosExiste) console.log(`   - ${archivoOtros}`);

  console.log(`\n🔗 Conectando a Supabase: ${SUPABASE_URL}`);

  // Procesar archivos
  if (ventasExiste) await procesarVentas(archivoVentas);
  if (otrosExiste) {
    await procesarStock(archivoOtros);
    await procesarTransito(archivoOtros);
    await procesarCompras(archivoOtros);
    await procesarPacks(archivoOtros);
  }

  console.log('\n' + '='.repeat(70));
  console.log('  🎉 ¡PROCESO COMPLETADO!');
  console.log('='.repeat(70));
  console.log('\nVerifica los datos en Supabase:');
  console.log(`${SUPABASE_URL.replace('/rest/v1', '')}/project/default/editor`);
}

main().catch(console.error);
