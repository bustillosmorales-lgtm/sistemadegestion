/**
 * Analiza el Excel para ver qué datos realmente tiene
 */

const XLSX = require('xlsx');

console.log('🔍 ANALIZANDO EXCEL...\n');

const workbook = XLSX.readFile('ventas.xlsx');
const ventasSheet = workbook.Sheets['ventas'];
const ventasData = XLSX.utils.sheet_to_json(ventasSheet, { header: 1 });

console.log(`Total filas en Excel: ${ventasData.length - 1}\n`);

// Analizar primeras 20 filas para ver estructura
console.log('📋 PRIMERAS 5 FILAS DE DATOS:\n');
for (let i = 1; i <= Math.min(5, ventasData.length - 1); i++) {
  const row = ventasData[i];
  console.log(`Fila ${i}:`);
  console.log(`  Empresa (col A): ${row[0]}`);
  console.log(`  Canal (col B): ${row[1]}`);
  console.log(`  Fecha (col F): ${row[5]}`);
  console.log(`  Unidades (col K): ${row[10]}`);
  console.log(`  SKU (col T): ${row[19]}`);
  console.log('');
}

// Contar valores únicos
const empresas = new Set();
const canales = new Set();
const skus = new Set();

for (let i = 1; i < ventasData.length; i++) {
  const row = ventasData[i];
  if (row[0]) empresas.add(row[0].toString().trim());
  if (row[1]) canales.add(row[1].toString().trim());
  if (row[19]) skus.add(row[19].toString().trim());
}

console.log('📊 VALORES ÚNICOS EN EL EXCEL:\n');
console.log(`Empresas únicas: ${empresas.size}`);
console.log(`  ${Array.from(empresas).join(', ')}\n`);

console.log(`Canales únicos: ${canales.size}`);
console.log(`  ${Array.from(canales).join(', ')}\n`);

console.log(`SKUs únicos: ${skus.size}\n`);

// Contar registros por empresa y canal
const conteos = {};
for (let i = 1; i < ventasData.length; i++) {
  const row = ventasData[i];
  const empresa = row[0]?.toString().trim() || 'null';
  const canal = row[1]?.toString().trim() || 'null';
  const clave = `${empresa}|${canal}`;
  conteos[clave] = (conteos[clave] || 0) + 1;
}

console.log('📈 DISTRIBUCIÓN POR EMPRESA + CANAL:\n');
for (const [clave, count] of Object.entries(conteos).sort((a, b) => b[1] - a[1])) {
  const [empresa, canal] = clave.split('|');
  console.log(`  ${empresa} + ${canal}: ${count} registros`);
}
