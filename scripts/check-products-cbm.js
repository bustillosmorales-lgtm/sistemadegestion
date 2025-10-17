#!/usr/bin/env node

/**
 * Script para verificar si los productos tienen CBM
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

async function checkProductsCBM() {
    console.log('\n📊 Verificando CBM en tabla products\n');
    console.log('═'.repeat(80));

    try {
        // 1. Contar total de productos
        const { count: totalProducts, error: countError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('❌ Error contando productos:', countError);
            return;
        }

        console.log(`\n📦 Total de productos: ${totalProducts}`);

        // 2. Obtener TODOS los productos y filtrar en código
        const { data: todosProductos, error: cbmError } = await supabase
            .from('products')
            .select('sku, cbm');

        if (cbmError) {
            console.error('❌ Error obteniendo productos:', cbmError);
            return;
        }

        // Filtrar en código JavaScript
        const productosConCBM = todosProductos?.filter(p => {
            const cbm = parseFloat(p.cbm);
            return !isNaN(cbm) && cbm > 0;
        }) || [];

        const conCBM = productosConCBM.length;
        const sinCBM = totalProducts - conCBM;
        const porcentaje = ((conCBM / totalProducts) * 100).toFixed(1);

        console.log(`✅ Productos CON CBM: ${conCBM} (${porcentaje}%)`);
        console.log(`⚠️  Productos SIN CBM: ${sinCBM}`);

        // 3. Mostrar ejemplos de productos CON CBM
        console.log('\n📋 Ejemplos de productos CON CBM:');
        console.log('─'.repeat(80));

        const ejemplosConCBM = productosConCBM.slice(0, 10);
        ejemplosConCBM.forEach(p => {
            console.log(`  ${p.sku}: ${p.cbm} CBM`);
        });

        // 4. Mostrar ejemplos de productos SIN CBM (filtrados en código)
        const productosSinCBM = todosProductos?.filter(p => {
            const cbm = parseFloat(p.cbm);
            return isNaN(cbm) || cbm <= 0;
        }).slice(0, 10) || [];

        if (productosSinCBM.length > 0) {
            console.log('\n⚠️  Ejemplos de productos SIN CBM:');
            console.log('─'.repeat(80));

            productosSinCBM.forEach(p => {
                console.log(`  ${p.sku}: CBM = ${p.cbm || 'NULL/vacío'}`);
            });
        }

        // 5. Estadísticas de CBM (usar datos ya obtenidos)
        if (productosConCBM.length > 0) {
            const cbmValues = productosConCBM.map(p => parseFloat(p.cbm));
            const min = Math.min(...cbmValues);
            const max = Math.max(...cbmValues);
            const avg = cbmValues.reduce((a, b) => a + b, 0) / cbmValues.length;

            console.log('\n📊 Estadísticas de CBM:');
            console.log('─'.repeat(80));
            console.log(`  Mínimo: ${min.toFixed(4)} CBM`);
            console.log(`  Máximo: ${max.toFixed(4)} CBM`);
            console.log(`  Promedio: ${avg.toFixed(4)} CBM`);
        }

        // 6. Verificar productos específicos de AMA001
        console.log('\n🔍 Verificando productos del contenedor AMA001:');
        console.log('─'.repeat(80));

        const { data: comprasAMA001, error: comprasError } = await supabase
            .from('compras')
            .select('sku, cantidad')
            .eq('container_number', 'AMA001')
            .limit(5);

        if (!comprasError && comprasAMA001) {
            for (const compra of comprasAMA001) {
                const { data: producto, error: prodError } = await supabase
                    .from('products')
                    .select('sku, cbm, descripcion')
                    .eq('sku', compra.sku)
                    .single();

                if (!prodError && producto) {
                    const cbmTotal = (parseFloat(producto.cbm) || 0) * compra.cantidad;
                    console.log(`  ${producto.sku}:`);
                    console.log(`    - CBM unitario: ${producto.cbm || 'NULL'}`);
                    console.log(`    - Cantidad: ${compra.cantidad}`);
                    console.log(`    - CBM total: ${cbmTotal.toFixed(4)}`);
                    console.log(`    - Descripción: ${producto.descripcion || 'N/A'}`);
                }
            }
        }

        console.log('\n' + '═'.repeat(80));
        console.log('✅ Verificación completada\n');

    } catch (error) {
        console.error('\n❌ Error general:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Ejecutar
checkProductsCBM();
