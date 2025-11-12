const XLSX = require('xlsx')

console.log('📊 Analizando estructura de otros_datos.xlsx...\n')

const workbook = XLSX.readFile('otros_datos.xlsx')
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]
const data = XLSX.utils.sheet_to_json(sheet)

console.log(`✅ Archivo leído correctamente`)
console.log(`   Sheet: ${sheetName}`)
console.log(`   Total registros: ${data.length}`)

if (data.length > 0) {
  console.log('\n📋 Columnas disponibles:')
  Object.keys(data[0]).forEach(col => {
    console.log(`   - ${col}`)
  })

  // Buscar columnas relacionadas con stock
  const stockCols = Object.keys(data[0]).filter(col =>
    col.toLowerCase().includes('stock') ||
    col.toLowerCase().includes('inventario') ||
    col.toLowerCase().includes('existencia')
  )

  if (stockCols.length > 0) {
    console.log('\n📦 Columnas de STOCK encontradas:')
    stockCols.forEach(col => console.log(`   ✅ ${col}`))

    console.log('\n📊 Ejemplos de datos (primeros 5):')
    data.slice(0, 5).forEach((row, i) => {
      console.log(`\n   ${i+1}. SKU: ${row.SKU || row.sku || 'N/A'}`)
      stockCols.forEach(col => {
        console.log(`      ${col}: ${row[col]}`)
      })
    })

    // Estadísticas
    const conStock = data.filter(row => {
      return stockCols.some(col => row[col] && row[col] > 0)
    })

    console.log(`\n📈 Estadísticas:`)
    console.log(`   Registros con stock > 0: ${conStock.length}/${data.length}`)
    console.log(`   Registros con stock = 0 o null: ${data.length - conStock.length}/${data.length}`)
  } else {
    console.log('\n⚠️  No se encontraron columnas de stock')
  }
}
