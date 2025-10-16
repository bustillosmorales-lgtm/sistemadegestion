#!/usr/bin/env node

/**
 * Script para verificar que el sistema de packs funciona correctamente
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

async function verifyPacksSystem() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 VERIFICACIÓN DEL SISTEMA DE PACKS');
    console.log('='.repeat(80) + '\n');

    try {
        // 1. Verificar que la tabla packs existe y tiene datos
        console.log('📦 1. Verificando tabla PACKS...');
        const { data: packs, error: packsError, count: packsCount } = await supabase
            .from('packs')
            .select('*', { count: 'exact' });

        if (packsError) {
            console.error('❌ Error: Tabla packs no encontrada o error:', packsError.message);
            return;
        }

        console.log(`✅ Tabla packs existe con ${packsCount || 0} registros`);

        if (packsCount > 0) {
            console.log('\n📋 Packs registrados:');
            const packsSummary = {};
            packs.forEach(p => {
                if (!packsSummary[p.pack_sku]) {
                    packsSummary[p.pack_sku] = {
                        productos: 0,
                        unidades_totales: 0
                    };
                }
                packsSummary[p.pack_sku].productos += 1;
                packsSummary[p.pack_sku].unidades_totales += p.cantidad;
            });

            Object.entries(packsSummary).forEach(([pack_sku, info]) => {
                console.log(`   - ${pack_sku}: ${info.productos} productos, ${info.unidades_totales} unidades totales`);
            });
        } else {
            console.log('⚠️  No hay packs registrados. Usa carga masiva para agregar packs.');
        }

        // 2. Verificar que la vista ventas_descompuestas existe
        console.log('\n📊 2. Verificando vista VENTAS_DESCOMPUESTAS...');
        const { data: ventasDesc, error: ventasDescError, count: ventasDescCount } = await supabase
            .from('ventas_descompuestas')
            .select('*', { count: 'exact', head: true });

        if (ventasDescError) {
            console.error('❌ Error: Vista ventas_descompuestas no encontrada:', ventasDescError.message);
            return;
        }

        console.log(`✅ Vista ventas_descompuestas existe con ${ventasDescCount || 0} registros`);

        // 3. Verificar vista materializada sku_venta_diaria_mv
        console.log('\n📈 3. Verificando vista materializada SKU_VENTA_DIARIA_MV...');
        const { data: ventaDiariaMV, error: ventaDiariaError, count: ventaDiariaCount } = await supabase
            .from('sku_venta_diaria_mv')
            .select('*', { count: 'exact' });

        if (ventaDiariaError) {
            console.error('❌ Error: Vista sku_venta_diaria_mv no encontrada:', ventaDiariaError.message);
            return;
        }

        console.log(`✅ Vista sku_venta_diaria_mv existe con ${ventaDiariaCount || 0} SKUs`);

        if (ventaDiariaCount > 0) {
            const confiables = ventaDiariaMV.filter(v => v.calculo_confiable).length;
            const noConfiables = ventaDiariaCount - confiables;

            console.log(`   - SKUs con cálculo confiable: ${confiables} (${Math.round(confiables/ventaDiariaCount*100)}%)`);
            console.log(`   - SKUs con datos insuficientes: ${noConfiables} (${Math.round(noConfiables/ventaDiariaCount*100)}%)`);

            // Mostrar top 5 por venta diaria
            const top5 = ventaDiariaMV
                .sort((a, b) => parseFloat(b.venta_diaria) - parseFloat(a.venta_diaria))
                .slice(0, 5);

            console.log('\n   📊 Top 5 SKUs por venta diaria:');
            top5.forEach((v, i) => {
                console.log(`      ${i+1}. ${v.sku}: ${v.venta_diaria} unidades/día (${v.dias_con_ventas} días con ventas)`);
            });
        }

        // 4. Verificar si hay ventas de packs descompuestas
        console.log('\n🎁 4. Verificando ventas de PACKS DESCOMPUESTAS...');
        const { data: ventasPacks, error: ventasPacksError, count: ventasPacksCount } = await supabase
            .from('ventas_descompuestas')
            .select('*', { count: 'exact' })
            .eq('tipo_venta', 'pack_descompuesto');

        if (ventasPacksError) {
            console.error('❌ Error obteniendo ventas de packs:', ventasPacksError.message);
            return;
        }

        console.log(`✅ Ventas de packs descompuestas: ${ventasPacksCount || 0} registros`);

        if (ventasPacksCount > 0) {
            // Agrupar por SKU para ver resumen
            const packsSummary = {};
            ventasPacks.forEach(v => {
                if (!packsSummary[v.sku]) {
                    packsSummary[v.sku] = 0;
                }
                packsSummary[v.sku] += v.cantidad;
            });

            console.log('\n   📦 Unidades vendidas por packs (últimos 90 días):');
            Object.entries(packsSummary)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .forEach(([sku, cantidad]) => {
                    console.log(`      - ${sku}: ${cantidad} unidades`);
                });
        } else {
            console.log('⚠️  No hay ventas de packs descompuestas en los últimos 90 días.');
            console.log('   Esto es normal si:');
            console.log('   - No se han vendido packs recientemente');
            console.log('   - Los packs no están registrados en la tabla packs');
        }

        // 5. Comparar ventas directas vs ventas por packs
        console.log('\n📊 5. Comparación VENTAS DIRECTAS vs VENTAS POR PACKS...');

        const { data: ventasDirectas, count: directasCount } = await supabase
            .from('ventas_descompuestas')
            .select('*', { count: 'exact', head: true })
            .eq('tipo_venta', 'producto');

        const totalVentas = ventasDescCount || 0;
        const ventasPorPacks = ventasPacksCount || 0;
        const ventasDirect = directasCount || 0;

        console.log(`   Total de registros de ventas: ${totalVentas}`);
        console.log(`   - Ventas directas: ${ventasDirect} (${Math.round(ventasDirect/totalVentas*100)}%)`);
        console.log(`   - Ventas por packs: ${ventasPorPacks} (${Math.round(ventasPorPacks/totalVentas*100)}%)`);

        // 6. Verificar función refresh_venta_diaria_mv
        console.log('\n🔄 6. Verificando función REFRESH_VENTA_DIARIA_MV...');
        console.log('   Ejecutando refresh de la vista materializada...');

        const { data: refreshResult, error: refreshError } = await supabase
            .rpc('refresh_venta_diaria_mv');

        if (refreshError) {
            console.error('❌ Error ejecutando refresh:', refreshError.message);
        } else {
            console.log('✅ Vista materializada actualizada correctamente');
        }

        // Resumen final
        console.log('\n' + '='.repeat(80));
        console.log('📋 RESUMEN DE VERIFICACIÓN');
        console.log('='.repeat(80));

        const checks = [
            { name: 'Tabla packs', status: !packsError },
            { name: 'Vista ventas_descompuestas', status: !ventasDescError },
            { name: 'Vista materializada sku_venta_diaria_mv', status: !ventaDiariaError },
            { name: 'Función refresh_venta_diaria_mv', status: !refreshError },
            { name: 'Packs registrados', status: packsCount > 0 },
            { name: 'Ventas de packs descompuestas', status: ventasPacksCount > 0 }
        ];

        checks.forEach(check => {
            const icon = check.status ? '✅' : '⚠️';
            console.log(`${icon} ${check.name}`);
        });

        const allGood = checks.every(c => c.status);

        if (allGood) {
            console.log('\n🎉 ¡Sistema de packs funcionando perfectamente!');
        } else {
            console.log('\n⚠️  Hay algunos elementos que requieren atención:');
            if (packsCount === 0) {
                console.log('   - Agregar packs a la tabla usando carga masiva');
            }
            if (ventasPacksCount === 0) {
                console.log('   - Verificar que las ventas de packs tengan SKUs registrados en tabla packs');
            }
        }

        console.log('\n' + '='.repeat(80) + '\n');

    } catch (error) {
        console.error('\n❌ Error inesperado:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Ejecutar
verifyPacksSystem();
