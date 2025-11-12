/**
 * Script para cargar ventas deduplicadas a Supabase
 * Agrupa ventas duplicadas por SKU+fecha+canal sumando unidades
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

// Insertar en lotes
async function insertarBatch(tabla, datos, batchSize = 100) {
  if (!datos || datos.length === 0) return 0;

  const total = datos.length;
  let insertados = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = datos.slice(i, i + batchSize);

    const { error } = await supabase.from(tabla).insert(batch);

    if (error) {
      console.log(`  ❌ Error insertando batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
      console.log(`     Primeros registros del batch:`, batch.slice(0, 2));
      continue; // Continuar con siguiente batch
    }

    insertados += batch.length;
    console.log(`  ✓ ${insertados}/${total} registros insertados...`);
  }

  return insertados;
}

async function procesarVentas() {
  console.log('\n======================================================================');
  console.log('  📊 CARGA DE VENTAS DEDUPLICADAS');
  console.log('======================================================================\n');

  const archivoExcel = 'ventas.xlsx';

  if (!fs.existsSync(archivoExcel)) {
    console.log(`  ❌ Archivo ${archivoExcel} no encontrado`);
    return;
  }

  console.log('📖 Leyendo archivo Excel...');
  const workbook = XLSX.readFile(archivoExcel);

  if (!workbook.SheetNames.includes('ventas')) {
    console.log('  ❌ Hoja "ventas" no encontrada');
    return;
  }

  const ventasSheet = workbook.Sheets['ventas'];
  const ventasData = XLSX.utils.sheet_to_json(ventasSheet, { header: 1 });

  console.log(`   Total de filas en Excel: ${ventasData.length}\n`);

  // Usar Map para deduplicar por clave compuesta: sku+fecha+canal
  const ventasMap = new Map();

  console.log('🔄 Procesando y deduplicando ventas...');

  // Saltar header (fila 0)
  for (let i = 1; i < ventasData.length; i++) {
    const row = ventasData[i];

    if (i % 10000 === 0) {
      console.log(`   Procesando fila ${i}...`);
    }

    const empresa = row[0]?.toString().trim();
    const canal = row[1]?.toString().trim();

    // Solo TLT + MELI
    if (!empresa || !canal) continue;
    if (empresa.toUpperCase() !== 'TLT' || canal.toUpperCase() !== 'MELI') continue;

    const sku = row[19]?.toString().trim();
    const unidades = parseFloat(row[10]) || 0;
    const fecha = excelDateToJSDate(row[5]);

    if (!sku || !fecha || unidades <= 0) continue;

    // Crear clave única: sku+fecha+canal
    const clave = `${sku}|${fecha}|${canal}`;

    if (ventasMap.has(clave)) {
      // Si ya existe, sumar las unidades
      const existente = ventasMap.get(clave);
      existente.unidades += unidades;
    } else {
      // Si no existe, agregar nuevo
      ventasMap.set(clave, {
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
  }

  const registros = Array.from(ventasMap.values());

  console.log(`\n📊 Resumen:`);
  console.log(`   Filas originales: ${ventasData.length - 1}`);
  console.log(`   Ventas únicas (deduplicadas): ${registros.length}`);
  console.log(`   Duplicados eliminados: ${ventasData.length - 1 - registros.length}\n`);

  if (registros.length > 0) {
    console.log('💾 Insertando en Supabase...\n');
    const insertados = await insertarBatch('ventas_historicas', registros);
    console.log(`\n✅ ${insertados} ventas insertadas en Supabase`);
  }

  console.log('\n======================================================================');
  console.log('  🎉 ¡PROCESO COMPLETADO!');
  console.log('======================================================================\n');
}

procesarVentas().catch(console.error);
