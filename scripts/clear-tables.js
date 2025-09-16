// scripts/clear-tables.js
// Script para vaciar las tablas principales del sistema

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurar cliente de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Variables de entorno de Supabase no encontradas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Tablas a limpiar en orden específico (para evitar conflictos de foreign keys)
const TABLES_TO_CLEAR = [
    'ai_predictions',
    'temporal_alerts', 
    'ventas',
    'compras',
    'containers',
    'products'
];

async function clearTables() {
    try {
        console.log('🧹 Iniciando limpieza de tablas del sistema...\n');

        // Mostrar estadísticas antes de limpiar
        console.log('📊 Estadísticas ANTES de limpiar:');
        for (const table of TABLES_TO_CLEAR) {
            try {
                const { count, error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });

                if (error) {
                    console.log(`   ${table}: Error - ${error.message}`);
                } else {
                    console.log(`   ${table}: ${count} registros`);
                }
            } catch (e) {
                console.log(`   ${table}: Error - ${e.message}`);
            }
        }

        console.log('\n🗑️  Limpiando tablas...\n');

        // Limpiar cada tabla
        for (const table of TABLES_TO_CLEAR) {
            try {
                console.log(`   Limpiando tabla: ${table}`);
                
                // Obtener todos los registros primero
                const { data: records } = await supabase
                    .from(table)
                    .select('*')
                    .limit(1000);
                
                if (records && records.length > 0) {
                    // Eliminar por lotes usando la primera columna como referencia
                    const { error } = await supabase
                        .from(table)
                        .delete()
                        .gte(Object.keys(records[0])[0], 0); // Usar la primera columna
                } else {
                    console.log(`   ℹ️  ${table} ya está vacía`);
                    continue;
                }

                if (error) {
                    console.log(`   ❌ Error limpiando ${table}: ${error.message}`);
                } else {
                    console.log(`   ✅ ${table} limpiada exitosamente`);
                }
            } catch (e) {
                console.log(`   ❌ Error limpiando ${table}: ${e.message}`);
            }
        }

        // Mostrar estadísticas después de limpiar
        console.log('\n📊 Estadísticas DESPUÉS de limpiar:');
        for (const table of TABLES_TO_CLEAR) {
            try {
                const { count, error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });

                if (error) {
                    console.log(`   ${table}: Error - ${error.message}`);
                } else {
                    console.log(`   ${table}: ${count} registros`);
                }
            } catch (e) {
                console.log(`   ${table}: Error - ${e.message}`);
            }
        }

        console.log('\n🎉 Limpieza completada!');
        console.log('\n📋 TABLAS NO TOCADAS (preservadas):');
        console.log('   - users (usuarios del sistema)');
        console.log('   - configuration (configuración)');
        console.log('   - reminders (recordatorios)');
        console.log('\n💡 Ahora puedes cargar tus datos frescos sin conflictos.');

    } catch (error) {
        console.error('❌ Error general:', error.message);
        process.exit(1);
    }
}

// Ejecutar el script
clearTables();