// scripts/create-table-via-api.js
// Crear tabla processing_jobs usando Supabase Management API

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTable() {
  console.log('🚀 Creando tabla processing_jobs via RPC...\n');

  try {
    // Ejecutar SQL usando una función RPC (si existe) o usar el método alternativo
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Crear tabla si no existe
        CREATE TABLE IF NOT EXISTS processing_jobs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'queued',
          file_url TEXT,
          parameters JSONB,
          progress INTEGER DEFAULT 0,
          total_items INTEGER,
          processed_items INTEGER DEFAULT 0,
          results JSONB,
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          started_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          created_by VARCHAR(100),
          ip_address INET
        );

        CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_processing_jobs_type ON processing_jobs(type);
        CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at DESC);
      `
    });

    if (error) {
      console.log('⚠️  La función RPC no existe. Usa el método manual:\n');
      console.log('1. Ve a: https://app.supabase.com/project/[tu-project-id]/sql/new');
      console.log('2. Copia el contenido de: scripts/create-processing-jobs-table.sql');
      console.log('3. Ejecuta el SQL\n');
      console.log('O crea la tabla manualmente en Table Editor:\n');
      console.log('Nombre: processing_jobs');
      console.log('Columnas:');
      console.log('  - id: uuid (primary key, default: gen_random_uuid())');
      console.log('  - type: varchar(50)');
      console.log('  - status: varchar(20) (default: queued)');
      console.log('  - file_url: text');
      console.log('  - parameters: jsonb');
      console.log('  - progress: int4 (default: 0)');
      console.log('  - total_items: int4');
      console.log('  - processed_items: int4 (default: 0)');
      console.log('  - results: jsonb');
      console.log('  - error_message: text');
      console.log('  - created_at: timestamptz (default: now())');
      console.log('  - started_at: timestamptz');
      console.log('  - completed_at: timestamptz');
      console.log('  - created_by: varchar(100)');
      console.log('  - ip_address: inet\n');
    } else {
      console.log('✅ Tabla creada exitosamente');
      console.log(data);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTable();
