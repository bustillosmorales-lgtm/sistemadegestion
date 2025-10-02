// scripts/list-tables.js - Listar todas las tablas en Supabase
const { supabase } = require('../lib/supabaseClient');

async function listTables() {
  console.log('🔍 Listing all tables in Supabase database...\n');

  try {
    // Método 1: Usar query directa de información del esquema
    const { data: tablesData, error: tablesError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT
            table_name,
            table_type,
            is_insertable_into,
            is_typed
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name;
        `
      });

    if (tablesError) {
      console.log('⚠️ RPC method failed, trying alternative approach...');

      // Método 2: Intentar listar tablas conocidas
      const knownTables = [
        'products', 'compras', 'ventas', 'configuration', 'users',
        'sku_analysis_cache', 'dashboard_analysis_cache', 'ai_predictions',
        'reminders', 'ml_auth', 'orders', 'ml_messages', 'ml_items',
        'ml_shipments', 'ml_promotions', 'webhook_logs', 'system_notifications',
        'api_configurations', 'platform_mappings', 'external_orders', 'sync_logs'
      ];

      console.log('📋 Checking known tables:\n');

      for (const tableName of knownTables) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          if (!error) {
            console.log(`✅ ${tableName} - ${data || 0} rows`);
          } else {
            console.log(`❌ ${tableName} - ${error.message}`);
          }
        } catch (err) {
          console.log(`❌ ${tableName} - Exception: ${err.message}`);
        }
      }

    } else {
      console.log('📊 Tables found via RPC:\n');
      tablesData.forEach(table => {
        console.log(`✅ ${table.table_name} (${table.table_type})`);
      });
    }

    // Método 3: Verificar específicamente dashboard_analysis_cache
    console.log('\n🎯 Checking dashboard_analysis_cache specifically:');
    try {
      const { data: cacheData, error: cacheError } = await supabase
        .from('dashboard_analysis_cache')
        .select('*', { count: 'exact', head: true });

      if (!cacheError) {
        console.log(`✅ dashboard_analysis_cache exists with ${cacheData || 0} rows`);
      } else {
        console.log(`❌ dashboard_analysis_cache error: ${cacheError.message}`);
        console.log(`💡 Hint: ${cacheError.hint || 'N/A'}`);
      }
    } catch (err) {
      console.log(`❌ dashboard_analysis_cache exception: ${err.message}`);
    }

    console.log('\n🔧 To create missing tables, run the SQL scripts in the sql/ folder');

  } catch (error) {
    console.error('💥 Error listing tables:', error);
  }
}

// CLI execution
if (require.main === module) {
  listTables()
    .then(() => {
      console.log('\n✅ Table listing completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Failed to list tables:', error);
      process.exit(1);
    });
}

module.exports = listTables;