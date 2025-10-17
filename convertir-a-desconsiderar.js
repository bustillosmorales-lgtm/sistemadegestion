// Script para convertir Excel de "Solicitar Cotizaciones" a formato "Desconsiderar"
// Uso: node convertir-a-desconsiderar.js "ruta/al/archivo.xlsx"

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Obtener ruta del archivo del argumento
const inputFile = process.argv[2];

if (!inputFile) {
  console.log('');
  console.log('❌ Error: Debes proporcionar la ruta del archivo Excel');
  console.log('');
  console.log('📋 Uso:');
  console.log('   node convertir-a-desconsiderar.js "ruta/al/archivo.xlsx"');
  console.log('');
  console.log('Ejemplo:');
  console.log('   node convertir-a-desconsiderar.js "C:\\Users\\franc\\Downloads\\Solicitar_Cotizaciones.xlsx"');
  console.log('');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.log('');
  console.log(`❌ Error: El archivo no existe: ${inputFile}`);
  console.log('');
  process.exit(1);
}

console.log('');
console.log('🔄 Convirtiendo Excel a formato "Desconsiderar"...');
console.log('');
console.log(`📁 Archivo de entrada: ${inputFile}`);

try {
  // Leer archivo Excel
  const workbook = XLSX.readFile(inputFile);

  // Buscar hoja "Datos"
  let sheetName = 'Datos';
  if (!workbook.Sheets[sheetName]) {
    // Si no existe "Datos", usar la primera hoja
    sheetName = workbook.SheetNames[0];
    console.log(`⚠️  Hoja "Datos" no encontrada, usando: ${sheetName}`);
  }

  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`📊 Total de filas encontradas: ${data.length}`);
  console.log('');

  if (data.length === 0) {
    console.log('❌ Error: El archivo no tiene datos');
    process.exit(1);
  }

  // Buscar columna SKU (puede tener diferentes nombres)
  const firstRow = data[0];
  const skuColumn = Object.keys(firstRow).find(col =>
    col.toUpperCase().includes('SKU') || col === 'sku' || col === 'SKU'
  );

  if (!skuColumn) {
    console.log('❌ Error: No se encontró columna SKU en el archivo');
    console.log('Columnas encontradas:', Object.keys(firstRow));
    process.exit(1);
  }

  console.log(`✅ Columna SKU detectada: "${skuColumn}"`);
  console.log('');

  // Crear nuevo array con solo SKU y columna Desconsiderar
  const newData = data.map(row => ({
    'SKU': row[skuColumn],
    '✅ Desconsiderar': 'SI'
  }));

  // Crear nuevo workbook
  const newWorkbook = XLSX.utils.book_new();
  const newWorksheet = XLSX.utils.json_to_sheet(newData);

  // Agregar hoja "Datos"
  XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Datos');

  // Generar nombre de archivo de salida
  const inputDir = path.dirname(inputFile);
  const inputBasename = path.basename(inputFile, path.extname(inputFile));
  const outputFile = path.join(inputDir, `${inputBasename}_DESCONSIDERAR.xlsx`);

  // Guardar archivo
  XLSX.writeFile(newWorkbook, outputFile);

  console.log('✅ Conversión exitosa!');
  console.log('');
  console.log(`📁 Archivo generado: ${outputFile}`);
  console.log(`📊 Total de productos: ${newData.length}`);
  console.log('');
  console.log('📋 Estructura del archivo:');
  console.log('   - Hoja: "Datos"');
  console.log('   - Columnas:');
  console.log('     1. SKU');
  console.log('     2. ✅ Desconsiderar');
  console.log('   - Todas las filas marcadas con "SI"');
  console.log('');
  console.log('🎯 Próximo paso:');
  console.log('   1. Ve a: http://localhost:3012/dashboard');
  console.log('   2. Sube el archivo generado');
  console.log('   3. Espera a que procese (~30-40 segundos)');
  console.log('');

} catch (error) {
  console.log('');
  console.log('❌ Error al procesar archivo:', error.message);
  console.log('');
  process.exit(1);
}
