// scripts/test-single-insert.js
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://ugabltnuwwtbpyqoptdg.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnYWJsdG51d3d0YnB5cW9wdGRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQxMzg2NiwiZXhwIjoyMDcxOTg5ODY2fQ.UadJZDDy1ovJkNJ6EtyIFUasVECrNm4bHPPYXSJqbuE'

const supabaseAdmin = createClient(supabaseUrl, serviceKey)

async function testInserts() {
  console.log('🧪 Probando inserciones individuales...\n')
  
  // Test compra
  console.log('🛒 Probando inserción de compra:')
  const testCompra = {
    sku: '649762439422',
    cantidad: 500,
    fecha_compra: new Date().toISOString(),
    fecha_llegada_estimada: null,
    fecha_llegada_real: null,
    status_compra: 'pendiente'
  }
  
  console.log('Datos a insertar:', testCompra)
  
  const { data: compraResult, error: compraError } = await supabaseAdmin
    .from('compras')
    .insert([testCompra])
    .select()
  
  if (compraError) {
    console.log('❌ Error insertando compra:', compraError)
  } else {
    console.log('✅ Compra insertada:', compraResult)
  }
  
  // Test venta
  console.log('\n💰 Probando inserción de venta:')
  const testVenta = {
    sku: '649762433758',
    cantidad: 1,
    fecha_venta: new Date().toISOString()
  }
  
  console.log('Datos a insertar:', testVenta)
  
  const { data: ventaResult, error: ventaError } = await supabaseAdmin
    .from('ventas')
    .insert([testVenta])
    .select()
  
  if (ventaError) {
    console.log('❌ Error insertando venta:', ventaError)
  } else {
    console.log('✅ Venta insertada:', ventaResult)
  }
  
  // Test con upsert
  console.log('\n🔄 Probando UPSERT de compra:')
  const { data: upsertResult, error: upsertError } = await supabaseAdmin
    .from('compras')
    .upsert([{
      sku: '649762439439',
      cantidad: 200,
      fecha_compra: new Date().toISOString(),
      status_compra: 'pendiente'
    }])
    .select()
  
  if (upsertError) {
    console.log('❌ Error en upsert:', upsertError)
  } else {
    console.log('✅ Upsert exitoso:', upsertResult)
  }
}

testInserts()