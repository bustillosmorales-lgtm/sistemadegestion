require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔧 Creando tabla stock_actual...\n')

  // Leer SQL
  const sql = fs.readFileSync('create_stock_table.sql', 'utf8')

  console.log('📝 SQL a ejecutar:')
  console.log(sql.substring(0, 200) + '...\n')

  // Ejecutar SQL en bloques (Supabase no soporta múltiples statements)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`🔄 Ejecutando ${statements.length} statements...\n`)

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]

    if (!statement) continue

    try {
      console.log(`   ${i+1}. ${statement.substring(0, 60)}...`)

      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement
      })

      if (error) {
        // Si no existe la función exec_sql, mostrar mensaje
        if (error.message.includes('exec_sql')) {
          console.log('\n⚠️  La función exec_sql no existe. Por favor ejecuta este SQL manualmente en Supabase SQL Editor:')
          console.log('\nhttps://supabase.com/dashboard/project/' + process.env.SUPABASE_URL.split('.')[0].replace('https://', '') + '/sql')
          console.log('\n' + sql)
          return
        }
        console.log(`      ❌ Error: ${error.message}`)
      } else {
        console.log(`      ✓ Ejecutado`)
      }
    } catch (e) {
      console.log(`      ⚠️  ${e.message}`)
    }
  }

  console.log('\n✅ Proceso completado')
}

main()
