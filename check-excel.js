const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/franc/Downloads/ejemplo/Solicitar_Cotizaciones (3).xlsx');
const sheet = wb.Sheets['Datos'];
const data = XLSX.utils.sheet_to_json(sheet, {defval: ''});

console.log('Muestreo de 10 productos:');
for(let i=0; i<Math.min(10, data.length); i++) {
  const row = data[i];
  console.log(`${i+1}. SKU: ${row.SKU}`);
  console.log(`   Venta Diaria: ${row['Venta Diaria']}`);
  console.log(`   Días Stock: ${row['Días de Stock']}`);
  console.log(`   Cantidad Sugerida: ${row['Cantidad Sugerida']}`);
  console.log(`   Periodo Análisis: ${row['Periodo Análisis']}`);
  console.log(`   Días del Periodo: ${row['Días del Periodo']}`);
  console.log('');
}

// Contar cuántos tienen venta diaria > 0
const conVentas = data.filter(r => parseFloat(r['Venta Diaria']) > 0).length;
const conCantidad = data.filter(r => parseFloat(r['Cantidad Sugerida']) > 0).length;
console.log(`\nEstadísticas:`);
console.log(`Total productos: ${data.length}`);
console.log(`Con venta diaria > 0: ${conVentas}`);
console.log(`Con cantidad sugerida > 0: ${conCantidad}`);
