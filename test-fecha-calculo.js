// Test directo del cálculo de fecha inicio para identificar el problema
// Ejecutar con: node test-fecha-calculo.js

console.log('🔍 TEST: Verificando cálculo de fecha inicio');
console.log('=====================================');

// Simular datos del SKU 120
const hoy = new Date('2025-09-19'); // Simular que HOY es 19 septiembre 2025
console.log(`📅 HOY: ${hoy.toISOString().split('T')[0]}`);

// Simular llegadas (compras) del SKU 120
const skuCompras = [
    { fecha_llegada_real: '2025-05-21' }, // 121 días atrás (≥30 ✅)
    { fecha_llegada_real: '2025-09-05' }, // 14 días atrás (<30 ❌)
    { fecha_llegada_real: '2025-03-15' }, // 188 días atrás (≥30 ✅)
];

console.log('\n📦 COMPRAS SIMULADAS:');
skuCompras.forEach((compra, i) => {
    const fecha = new Date(compra.fecha_llegada_real);
    const dias = Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24));
    console.log(`  ${i+1}. ${fecha.toISOString().split('T')[0]} (${dias} días atrás) ${dias >= 30 ? '✅' : '❌'}`);
});

// LÓGICA ACTUAL DEL CÓDIGO
console.log('\n🧮 EJECUTANDO LÓGICA DEL CÓDIGO:');
let fechaInicio = null;

for (const compra of skuCompras) {
    const fechaLlegada = new Date(compra.fecha_llegada_real);
    const diasDesdeHoy = Math.floor((hoy - fechaLlegada) / (1000 * 60 * 60 * 24));

    console.log(`\n  Evaluando: ${fechaLlegada.toISOString().split('T')[0]}`);
    console.log(`  Días desde hoy: ${diasDesdeHoy}`);
    console.log(`  ¿≥30 días?: ${diasDesdeHoy >= 30 ? 'SÍ' : 'NO'}`);

    if (diasDesdeHoy >= 30) {
        fechaInicio = fechaLlegada;
        console.log(`  ✅ SELECCIONADA como fecha inicio: ${fechaInicio.toISOString().split('T')[0]}`);
        break; // Tomar la más reciente que cumpla ≥30 días
    } else {
        console.log(`  ❌ RECHAZADA (no cumple ≥30 días)`);
    }
}

console.log('\n🎯 RESULTADO FINAL:');
if (fechaInicio) {
    console.log(`Fecha inicio calculada: ${fechaInicio.toISOString().split('T')[0]}`);
    console.log(`¿Es 21/05/2025?: ${fechaInicio.toISOString().split('T')[0] === '2025-05-21' ? 'SÍ ✅' : 'NO ❌'}`);
} else {
    console.log('No se encontró fecha inicio válida');
}

console.log('\n📊 ANÁLISIS:');
console.log('- Si el resultado es 21/05/2025 → El código está CORRECTO');
console.log('- Si el resultado es diferente → Hay ERROR en el código');
console.log('- Si en el dashboard aparece 21/06/2025 → Error en el DISPLAY/FRONTEND');