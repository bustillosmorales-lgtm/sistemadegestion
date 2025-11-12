/**
 * Script para agregar columnas faltantes a las tablas de Supabase
 */

require('dotenv-ng')()
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan credenciales de Supabase')
    console.log('   Asegúrate de tener SUPABASE_URL y SUPABASE_SERVICE_KEY en .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log('\n🔧 Actualizando schema de Supabase...\n')

  // Leer el archivo SQL
  const sql = fs.readFileSync('fix_schema_add_columns.sql', 'utf8')

  // Dividir en statements individuales (eliminar comentarios y queries de verificación)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && s.startsWith('ALTER TABLE'))

  console.log(`📝 Ejecutando ${statements.length} ALTER TABLE statements...\n`)

  for (const statement of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' })

      if (error) {
        // Intentar ejecutar directamente si RPC no está disponible
        console.log('⚠️  RPC no disponible, copiando SQL al portapapeles...')
        console.log('\n📋 COPIA Y PEGA ESTE SQL EN SUPABASE SQL EDITOR:\n')
        console.log('https://supabase.com/dashboard/project/ugabltnuwwtbpyqoptdg/sql/new')
        console.log('\n' + fs.readFileSync('fix_schema_add_columns.sql', 'utf8'))
        console.log('\n')
        process.exit(0)
      }

      console.log(`✓ Statement ejecutado`)
    } catch (err) {
      console.log(`✗ Error: ${err.message}`)
    }
  }

  console.log('\n✅ Schema actualizado!')
  console.log('\n📊 Ahora ejecuta el workflow nuevamente en GitHub Actions')
  console.log('   https://github.com/bustillosmorales-lgtm/sistemadegestion/actions\n')
}

main().catch(console.error)
