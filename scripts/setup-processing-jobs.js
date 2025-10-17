// scripts/setup-processing-jobs.js
// Script para crear la tabla processing_jobs en Supabase

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos');
  console.log('Verifica tu archivo .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupProcessingJobs() {
  console.log('🚀 Iniciando setup de tabla processing_jobs...\n');

  try {
    // 1. Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'create-processing-jobs-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Archivo SQL leído correctamente');
    console.log('📊 Ejecutando SQL en Supabase...\n');

    // 2. Ejecutar el SQL (Supabase requiere usar la REST API o pgAdmin)
    // Como la librería de JS no soporta ejecutar SQL directo, damos instrucciones

    console.log('⚠️  IMPORTANTE: Supabase JS no soporta ejecutar SQL directo.\n');
    console.log('Por favor, ejecuta el SQL manualmente:\n');
    console.log('1️⃣  Ve a: https://app.supabase.com/project/[tu-project]/editor');
    console.log('2️⃣  Abre el SQL Editor');
    console.log('3️⃣  Copia y pega el contenido de:');
    console.log(`    ${sqlPath}`);
    console.log('4️⃣  Click en "Run"\n');

    console.log('O usa psql desde la terminal:\n');
    console.log('psql -h [tu-host].supabase.co -U postgres -d postgres -f scripts/create-processing-jobs-table.sql\n');

    // 3. Verificar si la tabla existe (esto sí lo podemos hacer)
    console.log('🔍 Verificando si la tabla existe...\n');

    const { data, error } = await supabase
      .from('processing_jobs')
      .select('count', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ La tabla processing_jobs NO existe todavía');
        console.log('   Ejecuta el SQL manualmente (ver instrucciones arriba)\n');
        process.exit(1);
      } else {
        console.error('❌ Error verificando tabla:', error.message);
        process.exit(1);
      }
    } else {
      console.log('✅ ¡La tabla processing_jobs existe!');
      console.log(`   Registros actuales: ${data?.count || 0}\n`);

      // 4. Crear bucket en Supabase Storage (si no existe)
      console.log('📦 Verificando bucket "job-files" en Storage...');

      const { data: buckets, error: bucketsError } = await supabase
        .storage
        .listBuckets();

      if (bucketsError) {
        console.error('❌ Error listando buckets:', bucketsError.message);
      } else {
        const jobFilesBucket = buckets.find(b => b.name === 'job-files');

        if (jobFilesBucket) {
          console.log('✅ Bucket "job-files" ya existe\n');
        } else {
          console.log('📦 Creando bucket "job-files"...');

          const { error: createError } = await supabase
            .storage
            .createBucket('job-files', {
              public: false, // Privado por seguridad
              fileSizeLimit: 10485760, // 10 MB
              allowedMimeTypes: [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
                'application/vnd.ms-excel', // .xls
                'text/csv' // .csv
              ]
            });

          if (createError) {
            console.error('❌ Error creando bucket:', createError.message);
            console.log('   Créalo manualmente en: Storage > Create Bucket > "job-files"\n');
          } else {
            console.log('✅ Bucket "job-files" creado exitosamente\n');
          }
        }
      }

      // 5. Crear un job de prueba
      console.log('🧪 Creando job de prueba...');

      const { data: testJob, error: testError } = await supabase
        .from('processing_jobs')
        .insert({
          type: 'test',
          status: 'completed',
          parameters: { test: true },
          total_items: 10,
          processed_items: 10,
          results: { message: 'Test job created by setup script' },
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (testError) {
        console.error('❌ Error creando job de prueba:', testError.message);
      } else {
        console.log('✅ Job de prueba creado:');
        console.log(JSON.stringify(testJob, null, 2));
        console.log('');
      }

      console.log('✅ Setup completado exitosamente!\n');
      console.log('📋 Próximos pasos:');
      console.log('   1. Crear endpoint: pages/api/import-by-action-async.js');
      console.log('   2. Crear endpoint: pages/api/job-status.js');
      console.log('   3. Crear worker: scripts/process-import-jobs.js');
      console.log('   4. Actualizar frontend: pages/dashboard.js\n');
    }

  } catch (error) {
    console.error('❌ Error en setup:', error.message);
    console.error(error);
    process.exit(1);
  }
}

setupProcessingJobs();
