// Script simplificado para crear solo la tabla daily_sales_analysis
const { supabase } = require('../lib/supabaseClient');

async function createTable() {
  console.log('🚀 Creando tabla daily_sales_analysis...');

  try {
    // Intentar crear la tabla directamente
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS daily_sales_analysis (
        sku VARCHAR(255) PRIMARY KEY,
        venta_diaria DECIMAL(10,4) NOT NULL DEFAULT 0,
        fecha_calculo DATE NOT NULL DEFAULT CURRENT_DATE,
        metodo_calculo VARCHAR(50) DEFAULT 'real_data',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    console.log('📋 Intentando crear tabla...');

    // Como no podemos usar execute_sql, verificamos si ya existe consultándola
    const { data: testQuery, error: testError } = await supabase
      .from('daily_sales_analysis')
      .select('*')
      .limit(1);

    if (testError && testError.message.includes('does not exist')) {
      console.log('❌ La tabla no existe y no podemos crearla directamente desde Node.js');
      console.log('📋 INSTRUCCIONES MANUALES:');
      console.log('1. Ve a tu dashboard de Supabase');
      console.log('2. Ve a SQL Editor');
      console.log('3. Ejecuta esta consulta:');
      console.log('\n' + createTableSQL + '\n');

      return { success: false, needsManualCreation: true };
    } else {
      console.log('✅ La tabla daily_sales_analysis ya existe');

      // Verificar estructura
      const { count } = await supabase
        .from('daily_sales_analysis')
        .select('*', { count: 'exact', head: true });

      console.log(`📊 La tabla tiene ${count || 0} registros`);

      return { success: true, recordCount: count || 0 };
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Ejecutar
if (require.main === module) {
  createTable()
    .then(result => {
      console.log('\n🏁 Resultado:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { createTable };