// scripts/check-data.js
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://ugabltnuwwtbpyqoptdg.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnYWJsdG51d3d0YnB5cW9wdGRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQxMzg2NiwiZXhwIjoyMDcxOTg5ODY2fQ.UadJZDDy1ovJkNJ6EtyIFUasVECrNm4bHPPYXSJqbuE'

const supabaseAdmin = createClient(supabaseUrl, serviceKey)

async function checkData() {
  console.log('📊 Verificando datos insertados...\n')
  
  // Verificar cada tabla
  const tables = ['products', 'compras', 'ventas', 'containers']
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })
      
      if (error) {
        console.log(`❌ ${table}: Error - ${error.message}`)
      } else {
        console.log(`📋 ${table}: ${count} registros`)
      }
    } catch (err) {
      console.log(`❌ ${table}: Error - ${err.message}`)
    }
  }
  
  console.log('\n🔍 Mostrando ejemplos de datos insertados:\n')
  
  // Mostrar algunos ejemplos
  try {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('sku, descripcion, stock_actual')
      .limit(3)
    
    if (products?.length) {
      console.log('📦 Ejemplos de productos:')
      products.forEach(p => {
        console.log(`   - ${p.sku}: ${p.descripcion} (Stock: ${p.stock_actual})`)
      })
    }
  } catch (err) {
    console.log('❌ Error obteniendo ejemplos de productos')
  }
  
  try {
    const { data: ventas } = await supabaseAdmin
      .from('ventas')
      .select('sku, cantidad, fecha_venta')
      .limit(3)
    
    if (ventas?.length) {
      console.log('\n💰 Ejemplos de ventas:')
      ventas.forEach(v => {
        console.log(`   - ${v.sku}: ${v.cantidad} unidades (${v.fecha_venta?.substring(0, 10)})`)
      })
    }
  } catch (err) {
    console.log('❌ Error obteniendo ejemplos de ventas')
  }
}

checkData()