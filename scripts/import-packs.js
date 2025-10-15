#!/usr/bin/env node

/**
 * Script para importar packs desde packs.xlsx a Supabase
 * Uso: node scripts/import-packs.js
 */

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const PACKS_FILE = 'C:\\Users\\franc\\Downloads\\packs\\packs.xlsx';

// Configurar Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Variables de entorno de Supabase no configuradas');
    console.error('Asegúrate de tener .env con:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importarPacks() {
    console.log('\n📦 Importando packs a Supabase\n');
    console.log('═'.repeat(80));

    try {
        // 1. Leer archivo Excel
        console.log('\n📄 Leyendo archivo Excel...');
        const workbook = XLSX.readFile(PACKS_FILE);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log(`✅ Leídos ${data.length} registros`);

        // 2. Verificar si la tabla existe
        console.log('\n🔍 Verificando tabla "packs"...');
        const { error: tableError } = await supabase
            .from('packs')
            .select('id')
            .limit(1);

        if (tableError) {
            console.error('❌ Error: La tabla "packs" no existe');
            console.error('Ejecuta primero: psql -f scripts/create-packs-table.sql');
            process.exit(1);
        }

        console.log('✅ Tabla "packs" existe');

        // 3. Limpiar datos existentes (opcional)
        console.log('\n🗑️  ¿Limpiar datos existentes?');
        const { count: existingCount } = await supabase
            .from('packs')
            .select('*', { count: 'exact', head: true });

        if (existingCount > 0) {
            console.log(`   Hay ${existingCount} registros existentes`);
            console.log('   Eliminándolos...');

            const { error: deleteError } = await supabase
                .from('packs')
                .delete()
                .neq('id', 0); // Eliminar todos

            if (deleteError) {
                console.error('❌ Error eliminando datos:', deleteError.message);
            } else {
                console.log('✅ Datos anteriores eliminados');
            }
        }

        // 4. Preparar datos para insertar
        console.log('\n📊 Preparando datos...');
        const packsParaInsertar = data.map(row => ({
            pack_sku: row.IDPack,
            producto_sku: row.IDProducto.toString(),
            cantidad: row.Cantidad
        }));

        console.log(`✅ ${packsParaInsertar.length} registros preparados`);

        // 5. Insertar en batches de 500
        console.log('\n💾 Insertando datos en Supabase...');
        const BATCH_SIZE = 500;
        let insertados = 0;
        let errores = 0;

        for (let i = 0; i < packsParaInsertar.length; i += BATCH_SIZE) {
            const batch = packsParaInsertar.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(packsParaInsertar.length / BATCH_SIZE);

            console.log(`   Batch ${batchNum}/${totalBatches} (${batch.length} registros)...`);

            const { data: insertedData, error } = await supabase
                .from('packs')
                .insert(batch)
                .select();

            if (error) {
                console.error(`   ❌ Error en batch ${batchNum}:`, error.message);
                errores += batch.length;
            } else {
                insertados += insertedData.length;
                console.log(`   ✅ Batch ${batchNum} insertado`);
            }
        }

        // 6. Resumen
        console.log('\n' + '═'.repeat(80));
        console.log('\n📈 RESUMEN:');
        console.log('─'.repeat(80));
        console.log(`Total registros: ${data.length}`);
        console.log(`Insertados: ${insertados}`);
        console.log(`Errores: ${errores}`);

        // 7. Estadísticas
        console.log('\n📊 ESTADÍSTICAS:');
        console.log('─'.repeat(80));

        const { count: totalPacks } = await supabase
            .from('packs')
            .select('pack_sku', { count: 'exact', head: true });

        const { data: packsUnicos } = await supabase
            .from('packs')
            .select('pack_sku')
            .limit(1000);

        const uniquePacks = new Set(packsUnicos?.map(p => p.pack_sku) || []).size;

        console.log(`Total registros en BD: ${totalPacks}`);
        console.log(`Packs únicos: ${uniquePacks}`);

        // 8. Ejemplos
        console.log('\n📦 EJEMPLOS DE PACKS:');
        console.log('─'.repeat(80));

        const { data: ejemplos } = await supabase
            .from('packs')
            .select('*')
            .limit(5);

        ejemplos?.forEach(pack => {
            console.log(`\n${pack.pack_sku}:`);
            console.log(`  - ${pack.cantidad}x ${pack.producto_sku}`);
        });

        console.log('\n' + '═'.repeat(80));
        console.log('\n✅ Importación completada exitosamente\n');

        console.log('💡 Próximos pasos:');
        console.log('   1. Verifica los datos: SELECT * FROM packs LIMIT 10;');
        console.log('   2. Prueba la vista: SELECT * FROM ventas_descompuestas LIMIT 10;');
        console.log('   3. Usa la función: SELECT * FROM obtener_ventas_diarias_con_packs(\'2024-10-01\', \'2024-10-31\');');
        console.log('');

    } catch (error) {
        console.error('\n❌ Error general:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Ejecutar
importarPacks();
