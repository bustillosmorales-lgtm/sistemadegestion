// scripts/create-product-calc-cache.js - Create product calculations cache table
const { supabase } = require('../lib/supabaseClient');

async function createProductCalcCacheTable() {
  console.log('🏗️ Creating product_calculations_cache table...');

  try {
    // Test if table exists first
    const { data: testData, error: testError } = await supabase
      .from('product_calculations_cache')
      .select('id')
      .limit(1);

    if (!testError) {
      console.log('✅ Table already exists and is accessible');
      return true;
    }

    if (testError.code === '42P01') {
      console.log('📋 Table does not exist. Creating with test insert...');

      // Try to create table by inserting test data (Supabase auto-creates)
      const { error: insertError } = await supabase
        .from('product_calculations_cache')
        .insert({
          sku: 'TEST_CREATION',
          venta_diaria_real: 0.1,
          stock_objetivo: 3,
          stock_en_transito: 0,
          consumo_durante_lead_time: 9,
          stock_proyectado_llegada: -9,
          cantidad_sugerida: 3,
          lead_time_dias: 90,
          stock_saludable_dias: 30,
          calculation_method: 'test',
          config_used: {}
        });

      if (insertError) {
        console.log('⚠️ Auto-creation failed. Please create the table manually in Supabase:');
        console.log(`
CREATE TABLE product_calculations_cache (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(255) UNIQUE NOT NULL,
    venta_diaria_real DECIMAL(10,4) NOT NULL,
    stock_objetivo INTEGER NOT NULL,
    stock_en_transito INTEGER NOT NULL DEFAULT 0,
    consumo_durante_lead_time INTEGER NOT NULL,
    stock_proyectado_llegada INTEGER NOT NULL,
    cantidad_sugerida INTEGER NOT NULL,
    lead_time_dias INTEGER NOT NULL,
    stock_saludable_dias INTEGER NOT NULL,
    calculation_method VARCHAR(100) NOT NULL DEFAULT 'real_time',
    fecha_calculo TIMESTAMP DEFAULT NOW(),
    config_used JSONB
);

CREATE INDEX idx_product_calc_cache_sku ON product_calculations_cache (sku);
CREATE INDEX idx_product_calc_cache_fecha ON product_calculations_cache (fecha_calculo);
        `);
        return false;
      }

      // Remove test record
      await supabase
        .from('product_calculations_cache')
        .delete()
        .eq('sku', 'TEST_CREATION');

      console.log('✅ Table created successfully!');
      return true;
    }

    console.error('❌ Unexpected error:', testError);
    return false;

  } catch (error) {
    console.error('❌ Script error:', error);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  createProductCalcCacheTable().then((success) => {
    if (success) {
      console.log('🏁 Table setup completed successfully');
      process.exit(0);
    } else {
      console.log('⚠️ Please create the table manually in Supabase dashboard');
      process.exit(1);
    }
  }).catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = { createProductCalcCacheTable };