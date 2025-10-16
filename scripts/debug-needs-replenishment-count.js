#!/usr/bin/env node

/**
 * Script para diagnosticar la discrepancia entre dashboard y export
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Variables de entorno de Supabase no configuradas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCount() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DIAGNÓSTICO: NEEDS_REPLENISHMENT');
    console.log('='.repeat(80) + '\n');

    try {
        // 1. Contar TODOS los productos con status NEEDS_REPLENISHMENT
        console.log('📊 1. Conteo total de productos NEEDS_REPLENISHMENT...');
        const { count: totalCount, error: totalError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'NEEDS_REPLENISHMENT');

        if (totalError) {
            console.error('❌ Error:', totalError.message);
            return;
        }

        console.log(`   Total: ${totalCount} productos`);

        // 2. Obtener recordatorios activos
        console.log('\n📅 2. Conteo de recordatorios activos...');
        const today = new Date().toISOString().split('T')[0];
        const { data: reminders, error: remindersError } = await supabase
            .from('replenishment_reminders')
            .select('*')
            .eq('is_active', true)
            .gt('reminder_date', today);

        if (remindersError) {
            console.error('❌ Error:', remindersError.message);
            return;
        }

        const reminderSkus = new Set((reminders || []).map(r => r.sku));
        console.log(`   Recordatorios activos: ${reminderSkus.size}`);

        // 3. Contar productos NEEDS_REPLENISHMENT que NO tienen recordatorio
        console.log('\n🔍 3. Productos NEEDS_REPLENISHMENT sin recordatorio...');
        const { data: allNeedsRep, error: allError } = await supabase
            .from('products')
            .select('sku, descripcion, desconsiderado')
            .eq('status', 'NEEDS_REPLENISHMENT');

        if (allError) {
            console.error('❌ Error:', allError.message);
            return;
        }

        const sinRecordatorio = allNeedsRep.filter(p => !reminderSkus.has(p.sku));
        const conRecordatorio = allNeedsRep.filter(p => reminderSkus.has(p.sku));
        const desconsiderados = allNeedsRep.filter(p => p.desconsiderado === true);
        const sinRecordatorioNiDesconsiderados = sinRecordatorio.filter(p => p.desconsiderado !== true);

        console.log(`   Total NEEDS_REPLENISHMENT: ${allNeedsRep.length}`);
        console.log(`   - Sin recordatorio: ${sinRecordatorio.length}`);
        console.log(`   - Con recordatorio: ${conRecordatorio.length}`);
        console.log(`   - Desconsiderados: ${desconsiderados.length}`);
        console.log(`   - Sin recordatorio NI desconsiderados: ${sinRecordatorioNiDesconsiderados.length}`);

        // 4. Verificar si hay desconsiderados en NEEDS_REPLENISHMENT
        console.log('\n⚠️  4. Productos desconsiderados en NEEDS_REPLENISHMENT...');
        const { count: desconsideradosCount, error: descError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'NEEDS_REPLENISHMENT')
            .eq('desconsiderado', true);

        if (!descError) {
            console.log(`   Desconsiderados con status NEEDS_REPLENISHMENT: ${desconsideradosCount}`);
        }

        // 5. Simular lo que hace el export
        console.log('\n📥 5. Simulación de export...');
        console.log(`   Query: status = NEEDS_REPLENISHMENT`);
        console.log(`   Filtro 1: Excluir ${reminderSkus.size} SKUs con recordatorio`);
        console.log(`   Resultado esperado: ${sinRecordatorio.length} productos`);

        // 6. Verificar cache
        console.log('\n💾 6. Verificando cache del dashboard...');
        const { count: cacheCount, error: cacheError } = await supabase
            .from('dashboard_analysis_cache')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'NEEDS_REPLENISHMENT')
            .gt('expires_at', new Date().toISOString());

        if (!cacheError && cacheCount) {
            console.log(`   Cache válido encontrado: ${cacheCount} registros`);

            // Obtener SKUs del cache
            const { data: cacheData } = await supabase
                .from('dashboard_analysis_cache')
                .select('sku')
                .eq('status', 'NEEDS_REPLENISHMENT')
                .gt('expires_at', new Date().toISOString());

            const cacheSkus = new Set((cacheData || []).map(c => c.sku));
            const cacheSinRecordatorio = Array.from(cacheSkus).filter(sku => !reminderSkus.has(sku));

            console.log(`   SKUs en cache sin recordatorio: ${cacheSinRecordatorio.length}`);
        } else {
            console.log(`   No hay cache válido o error: ${cacheError?.message || 'No cache'}`);
        }

        // 7. Mostrar resumen
        console.log('\n' + '='.repeat(80));
        console.log('📋 RESUMEN');
        console.log('='.repeat(80));
        console.log(`Dashboard dice: ${totalCount} productos`);
        console.log(`Export debería dar: ${sinRecordatorio.length} productos`);
        console.log(`Diferencia: ${totalCount - sinRecordatorio.length} (estos son los recordatorios)`);

        if (sinRecordatorio.length !== 662) {
            console.log(`\n⚠️  ADVERTENCIA: Se esperaban 662 productos en el export pero el cálculo da ${sinRecordatorio.length}`);
            console.log(`   Puede haber otro filtro o el cache está desactualizado`);
        }

        // 8. Mostrar ejemplos de cada categoría
        console.log('\n📋 EJEMPLOS (primeros 5 de cada categoría):\n');

        console.log('Sin recordatorio (deberían exportarse):');
        sinRecordatorio.slice(0, 5).forEach(p => {
            console.log(`   - ${p.sku}: ${p.descripcion?.substring(0, 50) || 'Sin descripción'}`);
        });

        console.log('\nCon recordatorio (NO se exportan):');
        conRecordatorio.slice(0, 5).forEach(p => {
            console.log(`   - ${p.sku}: ${p.descripcion?.substring(0, 50) || 'Sin descripción'}`);
        });

        if (desconsiderados.length > 0) {
            console.log('\nDesconsiderados (anomalía - no deberían estar en NEEDS_REPLENISHMENT):');
            desconsiderados.slice(0, 5).forEach(p => {
                console.log(`   - ${p.sku}: ${p.descripcion?.substring(0, 50) || 'Sin descripción'}`);
            });
        }

        console.log('\n' + '='.repeat(80) + '\n');

    } catch (error) {
        console.error('\n❌ Error inesperado:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Ejecutar
debugCount();
