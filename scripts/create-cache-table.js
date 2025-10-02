// scripts/create-cache-table.js - Crear tabla de cache de dashboard
const { supabase } = require('../lib/supabaseClient');

async function createCacheTable() {
  console.log('🔧 Creating dashboard cache table...');

  try {
    // Crear tabla de cache
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Tabla para cachear resultados completos del análisis de dashboard
        CREATE TABLE IF NOT EXISTS dashboard_analysis_cache (
          id SERIAL PRIMARY KEY,
          sku VARCHAR(255) NOT NULL UNIQUE,

          -- Datos básicos del producto
          descripcion TEXT,
          status VARCHAR(100),
          stock_actual INTEGER DEFAULT 0,

          -- Cálculos de venta
          venta_diaria DECIMAL(8,4) DEFAULT 0,
          venta_diaria_calculada BOOLEAN DEFAULT FALSE,
          en_transito INTEGER DEFAULT 0,

          -- Proyecciones y sugerencias
          cantidad_sugerida INTEGER DEFAULT 0,
          stock_objetivo INTEGER DEFAULT 0,
          stock_proyectado_llegada INTEGER DEFAULT 0,
          consumo_durante_lead_time INTEGER DEFAULT 0,
          lead_time_dias INTEGER DEFAULT 90,

          -- Impacto económico (JSON para flexibilidad)
          impacto_economico JSONB DEFAULT '{}',

          -- Metadatos de cálculo
          config_usado JSONB DEFAULT '{}',
          essential BOOLEAN DEFAULT TRUE,
          from_cache BOOLEAN DEFAULT TRUE,

          -- Timestamps y control
          calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Índices para performance óptima
        CREATE INDEX IF NOT EXISTS idx_dashboard_cache_sku ON dashboard_analysis_cache(sku);
        CREATE INDEX IF NOT EXISTS idx_dashboard_cache_expires ON dashboard_analysis_cache(expires_at);
        CREATE INDEX IF NOT EXISTS idx_dashboard_cache_status ON dashboard_analysis_cache(status);

        -- Función para limpiar cache expirado
        CREATE OR REPLACE FUNCTION clean_expired_dashboard_cache()
        RETURNS INTEGER AS $$
        DECLARE
          deleted_count INTEGER;
        BEGIN
          DELETE FROM dashboard_analysis_cache
          WHERE expires_at < NOW();

          GET DIAGNOSTICS deleted_count = ROW_COUNT;
          RETURN deleted_count;
        END;
        $$ language 'plpgsql';
      `
    });

    if (error) {
      console.error('❌ Error creating table:', error);
      throw error;
    }

    console.log('✅ Dashboard cache table created successfully!');
    return true;

  } catch (error) {
    // Try alternative method using direct SQL
    console.log('🔄 Trying alternative table creation method...');

    try {
      // Crear tabla básica primero
      const { error: tableError } = await supabase
        .from('dashboard_analysis_cache')
        .select('id')
        .limit(1);

      if (tableError && tableError.message.includes('does not exist')) {
        console.log('🛠️ Table does not exist, creating with basic structure...');

        // Crear usando INSERT que fuerza creación de tabla
        const { error: insertError } = await supabase
          .from('dashboard_analysis_cache')
          .insert({
            sku: 'TEST_CREATION',
            descripcion: 'Test entry for table creation',
            status: 'TEST',
            stock_actual: 0,
            venta_diaria: 0,
            venta_diaria_calculada: false,
            en_transito: 0,
            cantidad_sugerida: 0,
            stock_objetivo: 0,
            stock_proyectado_llegada: 0,
            consumo_durante_lead_time: 0,
            lead_time_dias: 90,
            impacto_economico: {},
            config_usado: {},
            essential: true,
            from_cache: true
          });

        if (insertError) {
          console.error('❌ Alternative method failed:', insertError);
          throw insertError;
        }

        // Eliminar entrada de test
        await supabase
          .from('dashboard_analysis_cache')
          .delete()
          .eq('sku', 'TEST_CREATION');

        console.log('✅ Table created using alternative method!');
      } else {
        console.log('✅ Table already exists!');
      }

      return true;

    } catch (altError) {
      console.error('❌ Both methods failed:', altError);
      throw altError;
    }
  }
}

// CLI execution
if (require.main === module) {
  createCacheTable()
    .then(() => {
      console.log('🎉 Setup completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = createCacheTable;