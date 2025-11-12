/**
 * Diagnóstico de fechas en el Excel
 */

const XLSX = require('xlsx');

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

console.log('🔍 DIAGNÓSTICO DE FECHAS Y SKUS\n');

const workbook = XLSX.readFile('ventas.xlsx');
const ventasSheet = workbook.Sheets['ventas'];
const ventasData = XLSX.utils.sheet_to_json(ventasSheet, { header: 1 });

// Analizar primeras 20 filas con fechas convertidas
console.log('📅 PRIMERAS 10 FILAS CON FECHAS CONVERTIDAS:\n');
for (let i = 1; i <= Math.min(10, ventasData.length - 1); i++) {
  const row = ventasData[i];
  const empresa = row[0]?.toString().trim();
  const canal = row[1]?.toString().trim();
  const sku = row[19]?.toString().trim();
  const unidades = parseFloat(row[10]) || 0;
  const fechaRaw = row[5];
  const fechaConvertida = excelDateToJSDate(fechaRaw);

  console.log(`Fila ${i}:`);
  console.log(`  Empresa: ${empresa}, Canal: ${canal}`);
  console.log(`  SKU: ${sku}, Unidades: ${unidades}`);
  console.log(`  Fecha RAW: ${fechaRaw} (tipo: ${typeof fechaRaw})`);
  console.log(`  Fecha CONVERTIDA: ${fechaConvertida}`);
  console.log('');
}

// Analizar rango de fechas
const fechas = [];
const skusSet = new Set();
const skusPorFecha = {};

for (let i = 1; i < ventasData.length; i++) {
  const row = ventasData[i];
  const empresa = row[0]?.toString().trim();
  const canal = row[1]?.toString().trim();
  const sku = row[19]?.toString().trim();
  const unidades = parseFloat(row[10]) || 0;

  if (!empresa || !canal || !sku || unidades <= 0) continue;

  const fechaConvertida = excelDateToJSDate(row[5]);
  if (fechaConvertida) {
    fechas.push(fechaConvertida);
    skusSet.add(sku);

    if (!skusPorFecha[fechaConvertida]) {
      skusPorFecha[fechaConvertida] = new Set();
    }
    skusPorFecha[fechaConvertida].add(sku);
  }
}

fechas.sort();
console.log('📊 ESTADÍSTICAS:\n');
console.log(`Total registros procesados: ${fechas.length}`);
console.log(`Fecha mínima: ${fechas[0]}`);
console.log(`Fecha máxima: ${fechas[fechas.length - 1]}`);
console.log(`Total SKUs únicos: ${skusSet.size}\n`);

// Ver cuántos SKUs únicos hay por mes
const skusPorMes = {};
for (const fecha of Object.keys(skusPorFecha)) {
  const mes = fecha.substring(0, 7); // YYYY-MM
  if (!skusPorMes[mes]) {
    skusPorMes[mes] = new Set();
  }
  for (const sku of skusPorFecha[fecha]) {
    skusPorMes[mes].add(sku);
  }
}

console.log('📅 SKUs ÚNICOS POR MES:\n');
const mesesOrdenados = Object.keys(skusPorMes).sort();
for (const mes of mesesOrdenados) {
  console.log(`  ${mes}: ${skusPorMes[mes].size} SKUs únicos`);
}
