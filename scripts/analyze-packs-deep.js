#!/usr/bin/env node

const XLSX = require('xlsx');

const filePath = 'C:\\Users\\franc\\Downloads\\packs\\packs.xlsx';

console.log('\n🔬 ANÁLISIS PROFUNDO: packs.xlsx\n');
console.log('═'.repeat(80));

try {
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`\n📊 Total de registros: ${data.length}`);

    // Agrupar por IDPack
    const packMap = new Map();

    data.forEach(row => {
        const pack = row.IDPack;
        if (!packMap.has(pack)) {
            packMap.set(pack, []);
        }
        packMap.get(pack).push({
            producto: row.IDProducto,
            cantidad: row.Cantidad
        });
    });

    console.log(`\n📦 Total de packs únicos: ${packMap.size}`);

    // Estadísticas de packs
    const packsArray = Array.from(packMap.entries());

    // Packs por cantidad de productos
    const productosPorPack = packsArray.map(([id, productos]) => ({
        id,
        numProductos: productos.length,
        totalUnidades: productos.reduce((sum, p) => sum + p.cantidad, 0)
    }));

    console.log('\n📈 DISTRIBUCIÓN DE PACKS:');
    console.log('─'.repeat(80));

    const distribucion = {};
    productosPorPack.forEach(p => {
        const key = `${p.numProductos} producto(s)`;
        distribucion[key] = (distribucion[key] || 0) + 1;
    });

    Object.entries(distribucion).forEach(([tipo, cantidad]) => {
        console.log(`  ${tipo}: ${cantidad} packs`);
    });

    // Productos más usados en packs
    const productosCount = new Map();
    data.forEach(row => {
        const prod = row.IDProducto;
        productosCount.set(prod, (productosCount.get(prod) || 0) + 1);
    });

    console.log('\n🏆 TOP 10 PRODUCTOS MÁS USADOS EN PACKS:');
    console.log('─'.repeat(80));

    const topProductos = Array.from(productosCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    topProductos.forEach(([prod, count], i) => {
        console.log(`  ${i + 1}. ${prod}: ${count} veces`);
    });

    // Ejemplos de packs
    console.log('\n📦 EJEMPLOS DE PACKS (primeros 5):');
    console.log('═'.repeat(80));

    packsArray.slice(0, 5).forEach(([id, productos]) => {
        console.log(`\n${id}:`);
        productos.forEach(p => {
            console.log(`  - ${p.cantidad}x ${p.producto}`);
        });
        const total = productos.reduce((sum, p) => sum + p.cantidad, 0);
        console.log(`  Total unidades: ${total}`);
    });

    // Resumen final
    console.log('\n' + '═'.repeat(80));
    console.log('\n📋 RESUMEN:');
    console.log('─'.repeat(80));
    console.log(`Total de registros: ${data.length}`);
    console.log(`Packs únicos: ${packMap.size}`);
    console.log(`Productos únicos: ${productosCount.size}`);

    const avgProductosPorPack = (data.length / packMap.size).toFixed(2);
    console.log(`Promedio productos por pack: ${avgProductosPorPack}`);

    console.log('\n✅ Análisis completado\n');

} catch (error) {
    console.error('\n❌ Error:', error.message);
}
