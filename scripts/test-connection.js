// scripts/test-connection.js
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n')
  
  // Test con cliente normal (anon key)
  console.log('📋 Variables de entorno:')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing')
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing')
  console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing')
  
  // Crear cliente como lo hace la app
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('\n❌ Error: Variables de entorno faltantes')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  try {
    console.log('\n🔌 Testing connection with anon key...')
    
    // Test simple query
    const { data: products, error } = await supabase
      .from('products')
      .select('sku, descripcion')
      .limit(5)
    
    if (error) {
      console.log('❌ Error querying products:', error.message)
      console.log('Error details:', error)
    } else {
      console.log(`✅ Success! Found ${products?.length || 0} products`)
      if (products?.length > 0) {
        console.log('\n📦 Sample products:')
        products.forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.sku}: ${p.descripcion?.substring(0, 50)}...`)
        })
      } else {
        console.log('⚠️ No products found in database')
      }
    }
    
    // Test count
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
    
    if (countError) {
      console.log('❌ Error counting products:', countError.message)
    } else {
      console.log(`📊 Total products in database: ${count}`)
    }
    
  } catch (err) {
    console.log('❌ Connection test failed:', err.message)
  }
}

testConnection()