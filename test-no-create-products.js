#!/usr/bin/env node

const PORT = 3012;
const BASE_URL = `http://localhost:${PORT}`;

// Test 1: Intentar cargar ventas con productos que NO existen
async function testVentasConProductosInexistentes() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('TEST 1: Cargar ventas con productos que NO EXISTEN');
    console.log('═══════════════════════════════════════════════════════════\n');

    const data = {
        tableType: 'ventas',
        user: { role: 'admin' },
        data: [
            {
                sku: 'PRODUCTO-NO-EXISTE-001',
                cantidad: 10,
                fecha_venta: '2025-01-15 00:00:00'
            },
            {
                sku: 'PRODUCTO-NO-EXISTE-002',
                cantidad: 5,
                fecha_venta: '2025-01-15 00:00:00'
            }
        ]
    };

    try {
        const response = await fetch(`${BASE_URL}/api/bulk-upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        console.log('📊 Respuesta del servidor:');
        console.log(JSON.stringify(result, null, 2));

        console.log('\n📋 Resumen:');
        console.log(`   - Nuevos: ${result.resumen?.nuevos || 0}`);
        console.log(`   - Duplicados: ${result.resumen?.duplicados || 0}`);
        console.log(`   - Errores: ${result.resumen?.errores || 0}`);
        console.log(`   - Productos nuevos creados: ${result.resumen?.productosNuevos || 0}`);

        if (result.detalles?.errores?.length > 0) {
            console.log('\n❌ Errores encontrados:');
            result.detalles.errores.forEach((err, i) => {
                console.log(`   ${i + 1}. SKU: ${err.sku || 'N/A'}`);
                console.log(`      Error: ${err.error}`);
            });
        }

        // Verificar que el comportamiento es correcto
        if (result.resumen?.errores === 2 && result.resumen?.productosNuevos === 0) {
            console.log('\n✅ TEST PASADO: Los productos NO se crearon automáticamente');
            console.log('   Se reportaron correctamente como errores.');
            return true;
        } else {
            console.log('\n❌ TEST FALLIDO: Comportamiento inesperado');
            return false;
        }

    } catch (error) {
        console.error('❌ Error en la petición:', error.message);
        return false;
    }
}

// Test 2: Cargar producto válido primero
async function testCargarProductoValido() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('TEST 2: Cargar producto válido primero');
    console.log('═══════════════════════════════════════════════════════════\n');

    const data = {
        tableType: 'productos',
        user: { role: 'admin' },
        data: [
            {
                sku: 'TEST-PRODUCTO-001',
                descripcion: 'Producto de prueba 001',
                stock_actual: 0,
                costo_fob_rmb: 10.5,
                cbm: 0.05,
                status: 'NEEDS_REPLENISHMENT'
            }
        ]
    };

    try {
        const response = await fetch(`${BASE_URL}/api/bulk-upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        console.log('📊 Respuesta del servidor:');
        console.log(JSON.stringify(result, null, 2));

        console.log('\n📋 Resumen:');
        console.log(`   - Nuevos: ${result.resumen?.nuevos || 0}`);
        console.log(`   - Errores: ${result.resumen?.errores || 0}`);

        if (result.resumen?.nuevos > 0 || result.resumen?.duplicados > 0) {
            console.log('\n✅ TEST PASADO: Producto creado/actualizado correctamente');
            return true;
        } else {
            console.log('\n❌ TEST FALLIDO: No se pudo crear el producto');
            return false;
        }

    } catch (error) {
        console.error('❌ Error en la petición:', error.message);
        return false;
    }
}

// Test 3: Ahora cargar ventas con el producto que existe
async function testVentasConProductosExistentes() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('TEST 3: Cargar ventas con productos que SÍ EXISTEN');
    console.log('═══════════════════════════════════════════════════════════\n');

    const data = {
        tableType: 'ventas',
        user: { role: 'admin' },
        data: [
            {
                sku: 'TEST-PRODUCTO-001',
                cantidad: 15,
                fecha_venta: '2025-01-16 00:00:00'
            }
        ]
    };

    try {
        const response = await fetch(`${BASE_URL}/api/bulk-upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        console.log('📊 Respuesta del servidor:');
        console.log(JSON.stringify(result, null, 2));

        console.log('\n📋 Resumen:');
        console.log(`   - Nuevos: ${result.resumen?.nuevos || 0}`);
        console.log(`   - Errores: ${result.resumen?.errores || 0}`);

        if (result.resumen?.nuevos > 0 && result.resumen?.errores === 0) {
            console.log('\n✅ TEST PASADO: Venta creada correctamente con producto existente');
            return true;
        } else {
            console.log('\n❌ TEST FALLIDO: No se pudo crear la venta');
            return false;
        }

    } catch (error) {
        console.error('❌ Error en la petición:', error.message);
        return false;
    }
}

// Ejecutar todos los tests
async function runAllTests() {
    console.log('\n🧪 EJECUTANDO SUITE DE TESTS');
    console.log('Verificando que el sistema NO crea productos automáticamente\n');

    const results = [];

    // Test 1: Productos inexistentes deben generar error
    results.push(await testVentasConProductosInexistentes());

    // Pausa entre tests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Crear producto manualmente
    results.push(await testCargarProductoValido());

    // Pausa entre tests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Ahora la venta debe funcionar
    results.push(await testVentasConProductosExistentes());

    // Resumen final
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('RESUMEN FINAL DE TESTS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log(`Tests pasados: ${passed}/${total}`);

    if (passed === total) {
        console.log('\n✅ TODOS LOS TESTS PASARON');
        console.log('El sistema ahora solo trabaja con productos existentes.\n');
    } else {
        console.log('\n⚠️ ALGUNOS TESTS FALLARON');
        console.log('Revise los logs anteriores para más detalles.\n');
    }
}

// Ejecutar
runAllTests().catch(console.error);
