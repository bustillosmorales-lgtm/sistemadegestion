require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('📋 Creando tabla de configuración del sistema...\n')

  // Leer el archivo SQL
  const sql = fs.readFileSync('create_configuracion_table.sql', 'utf8')

  // Ejecutar SQL (nota: Supabase client no ejecuta SQL directamente desde Node)
  // Necesitamos ejecutarlo manualmente o usar el API REST

  console.log('⚠️  Por favor ejecuta este SQL en el Editor SQL de Supabase:\n')
  console.log('='*60)
  console.log(sql)
  console.log('='*60)

  // Alternativamente, podemos crear los registros directamente
  console.log('\n📝 Creando registros de configuración...')

  const configuraciones = [
    { clave: 'dias_stock_deseado', valor: 90, descripcion: 'Días de stock deseado para mantener en inventario', unidad: 'días', valor_minimo: 30, valor_maximo: 180 },
    { clave: 'dias_transito', valor: 120, descripcion: 'Tiempo de tránsito desde China a bodega', unidad: 'días', valor_minimo: 30, valor_maximo: 180 },
    { clave: 'nivel_servicio', valor: 0.95, descripcion: 'Nivel de servicio objetivo (95% = mantener stock el 95% del tiempo)', unidad: '%', valor_minimo: 0.80, valor_maximo: 0.99 },
    { clave: 'umbral_intermitencia', valor: 0.5, descripcion: 'Umbral para detectar demanda intermitente (% de días sin venta)', unidad: '%', valor_minimo: 0.3, valor_maximo: 0.8 },
    { clave: 'alpha_ewma', valor: 0.3, descripcion: 'Factor de ponderación temporal EWMA (mayor = más peso a datos recientes)', unidad: 'factor', valor_minimo: 0.1, valor_maximo: 0.5 },
    { clave: 'umbral_abc_a', valor: 0.8, descripcion: 'Umbral acumulado para clasificación ABC - Categoría A (top % del valor)', unidad: '%', valor_minimo: 0.6, valor_maximo: 0.9 },
    { clave: 'umbral_abc_b', valor: 0.95, descripcion: 'Umbral acumulado para clasificación ABC - Categoría B', unidad: '%', valor_minimo: 0.85, valor_maximo: 0.98 },
    { clave: 'umbral_xyz_x', valor: 0.5, descripcion: 'Umbral de CV para clasificación XYZ - Categoría X (baja variabilidad)', unidad: 'CV', valor_minimo: 0.3, valor_maximo: 0.7 },
    { clave: 'umbral_xyz_y', valor: 1.0, descripcion: 'Umbral de CV para clasificación XYZ - Categoría Y (media variabilidad)', unidad: 'CV', valor_minimo: 0.7, valor_maximo: 1.5 },
    { clave: 'dias_historico', valor: 180, descripcion: 'Días de historial de ventas a considerar para predicciones', unidad: 'días', valor_minimo: 90, valor_maximo: 365 },
    { clave: 'iqr_multiplicador', valor: 1.5, descripcion: 'Multiplicador IQR para detección de outliers', unidad: 'factor', valor_minimo: 1.0, valor_maximo: 3.0 }
  ]

  // Intentar crear la tabla primero
  console.log('Intentando verificar/crear tabla...')
  const { data: existingData, error: selectError } = await supabase
    .from('configuracion_sistema')
    .select('clave')
    .limit(1)

  if (selectError && selectError.code === 'PGRST116') {
    console.log('❌ La tabla no existe. Por favor ejecuta el SQL en Supabase primero.')
    console.log('\n1. Ve a: https://supabase.com/dashboard/project/[tu-proyecto]/editor')
    console.log('2. Copia y pega el contenido de create_configuracion_table.sql')
    console.log('3. Ejecuta el query')
    console.log('4. Vuelve a ejecutar este script\n')
    return
  }

  // Insertar o actualizar configuraciones
  for (const config of configuraciones) {
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('configuracion_sistema')
      .select('id')
      .eq('clave', config.clave)
      .single()

    if (existing) {
      console.log(`   ⏩ ${config.clave} ya existe, saltando...`)
    } else {
      const { error } = await supabase
        .from('configuracion_sistema')
        .insert(config)

      if (error) {
        console.log(`   ❌ Error insertando ${config.clave}:`, error.message)
      } else {
        console.log(`   ✓ ${config.clave} insertado`)
      }
    }
  }

  console.log('\n✅ Proceso completado')

  // Mostrar configuraciones actuales
  console.log('\n📋 Configuraciones actuales:')
  const { data: allConfigs } = await supabase
    .from('configuracion_sistema')
    .select('*')
    .order('clave')

  if (allConfigs) {
    allConfigs.forEach(c => {
      console.log(`   ${c.clave}: ${c.valor} ${c.unidad || ''}`)
    })
  }
}

main()
