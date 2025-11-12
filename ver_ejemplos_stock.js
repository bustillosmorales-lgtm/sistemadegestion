const XLSX = require('xlsx')

console.log('📊 Ejemplos de stock en otros_datos.xlsx...\n')

const workbook = XLSX.readFile('otros_datos.xlsx')
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]
const data = XLSX.utils.sheet_to_json(sheet)

// Filtrar registros que tienen CodArticulo
const conSKU = data.filter(row => row.CodArticulo && row.CodArticulo !== '')

console.log(`✅ Registros con SKU: ${conSKU.length}/${data.length}`)

console.log('\n📦 Primeros 10 ejemplos con STOCK:')
conSKU.slice(0, 10).forEach((row, i) => {
  const stockTotal = (row['TLT BODEGACENTRAL'] || 0) +
                     (row['FULL TLT MELI'] || 0) +
                     (row['FULL LMC MELI'] || 0)

  console.log(`\n${i+1}. SKU: ${row.CodArticulo}`)
  console.log(`   TLT BODEGACENTRAL: ${row['TLT BODEGACENTRAL'] || 0}`)
  console.log(`   FULL TLT MELI: ${row['FULL TLT MELI'] || 0}`)
  console.log(`   FULL LMC MELI: ${row['FULL LMC MELI'] || 0}`)
  console.log(`   STOCK TOTAL: ${stockTotal}`)
})

// Ver si estos SKUs están en las predicciones actuales
console.log('\n\n📊 SKUs disponibles en otros_datos:')
console.log(`   Total: ${conSKU.length}`)

// Ejemplos de SKUs con stock alto
const conStockAlto = conSKU.filter(row => {
  const stockTotal = (row['TLT BODEGACENTRAL'] || 0) +
                     (row['FULL TLT MELI'] || 0) +
                     (row['FULL LMC MELI'] || 0)
  return stockTotal > 100
})

console.log(`   Con stock > 100: ${conStockAlto.length}`)

if (conStockAlto.length > 0) {
  console.log('\n💰 Top 5 SKUs con más stock:')
  conStockAlto
    .map(row => ({
      sku: row.CodArticulo,
      stock: (row['TLT BODEGACENTRAL'] || 0) +
             (row['FULL TLT MELI'] || 0) +
             (row['FULL LMC MELI'] || 0)
    }))
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5)
    .forEach((item, i) => {
      console.log(`   ${i+1}. ${item.sku}: ${item.stock} unidades`)
    })
}
