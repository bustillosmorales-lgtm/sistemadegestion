#!/usr/bin/env node

const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\franc\\Downloads\\packs\\packs.xlsx';

console.log('\n📊 Analizando archivo: packs.xlsx\n');
console.log('═'.repeat(80));

try {
    // Leer el archivo Excel
    const workbook = XLSX.readFile(filePath);

    console.log('\n📋 INFORMACIÓN GENERAL:');
    console.log('─'.repeat(80));
    console.log(`Hojas encontradas: ${workbook.SheetNames.length}`);
    console.log(`Nombres de hojas: ${workbook.SheetNames.join(', ')}`);

    // Analizar cada hoja
    workbook.SheetNames.forEach((sheetName, index) => {
        console.log('\n' + '═'.repeat(80));
        console.log(`\n📄 HOJA ${index + 1}: "${sheetName}"`);
        console.log('─'.repeat(80));

        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Información básica
        console.log(`\nFilas totales: ${data.length}`);

        if (data.length > 0) {
            // Headers (primera fila)
            const headers = data[0];
            console.log(`\nColumnas (${headers.length}):`);
            headers.forEach((header, i) => {
                console.log(`  ${i + 1}. ${header || '(vacío)'}`);
            });

            // Primeras 5 filas de datos
            console.log(`\n📊 PRIMERAS 5 FILAS DE DATOS:`);
            console.log('─'.repeat(80));

            const dataRows = data.slice(1, 6);
            dataRows.forEach((row, i) => {
                console.log(`\nFila ${i + 2}:`);
                headers.forEach((header, j) => {
                    if (row[j] !== undefined && row[j] !== null && row[j] !== '') {
                        console.log(`  ${header}: ${row[j]}`);
                    }
                });
            });

            // Convertir a JSON para análisis
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            console.log(`\n📈 ESTADÍSTICAS:`);
            console.log('─'.repeat(80));
            console.log(`Registros de datos (sin header): ${jsonData.length}`);

            if (jsonData.length > 0) {
                // Análisis de campos
                const firstRecord = jsonData[0];
                console.log(`\nCampos por registro: ${Object.keys(firstRecord).length}`);

                // Detectar tipo de datos
                console.log(`\n🔍 ANÁLISIS DE CONTENIDO:`);
                console.log('─'.repeat(80));

                const campos = Object.keys(firstRecord);
                campos.forEach(campo => {
                    const valores = jsonData.slice(0, 10).map(r => r[campo]).filter(v => v !== undefined && v !== null);
                    const tipoValor = typeof valores[0];
                    const valorEjemplo = valores[0];

                    console.log(`\n${campo}:`);
                    console.log(`  Tipo: ${tipoValor}`);
                    console.log(`  Ejemplo: ${valorEjemplo}`);
                    console.log(`  Valores únicos (primeros 10): ${new Set(valores).size}`);
                });

                // Guardar muestra en JSON para inspección
                const sample = jsonData.slice(0, 10);
                const outputPath = path.join(__dirname, '../packs-sample.json');
                const fs = require('fs');
                fs.writeFileSync(outputPath, JSON.stringify(sample, null, 2), 'utf8');
                console.log(`\n💾 Muestra guardada en: packs-sample.json`);
            }
        }
    });

    console.log('\n' + '═'.repeat(80));
    console.log('\n✅ Análisis completado\n');

} catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
}
