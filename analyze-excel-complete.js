// analyze-excel-complete.js - Analizar Excel completo para encontrar precios perdidos
const XLSX = require('xlsx');
const { supabase } = require('./lib/supabaseClient.js');

async function analyzeExcelComplete() {
  console.log('📊 ANALIZANDO EXCEL COMPLETO...\n');
  
  try {
    // 1. Leer Excel actualizado
    const excelPath = 'C:/Users/franc/Downloads/sistemadegestion-main/ventas/ventas.xlsx';
    console.log(`📁 Leyendo: ${excelPath}`);
    
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Total registros en Excel: ${data.length}`);
    
    // 2. Ver estructura del Excel
    if (data.length > 0) {
      console.log('\n📋 COLUMNAS EN EXCEL:');
      const columnas = Object.keys(data[0]);
      columnas.forEach(col => console.log(`   - ${col}`));
      
      console.log('\n📝 EJEMPLO DE REGISTRO:');
      console.log(JSON.stringify(data[0], null, 2));
    }
    
    // 3. Analizar SKUs únicos en Excel con precio
    console.log('\n🔍 ANALIZANDO SKUs CON PRECIO EN EXCEL...');
    
    const skusConPrecio = new Set();
    const ejemplosPrecios = [];
    
    data.forEach(row => {
      // Determinar qué columnas usar (adaptable)
      const sku = row['SKU'] || row['sku'] || row['Sku'];
      const precio = row['precio'] || row['Precio'] || row['PRECIO'] || 
                     row['precio_unitario'] || row['Precio Unitario'] || 
                     row['Precio unitario de venta de la publicación (CLP)'];
      
      if (sku && precio && precio > 0) {
        const skuString = String(sku).trim();
        skusConPrecio.add(skuString);
        
        // Guardar ejemplos
        if (ejemplosPrecios.length < 10) {
          ejemplosPrecios.push({ sku: skuString, precio: precio });
        }
      }
    });
    
    console.log(`✅ SKUs únicos con precio en Excel: ${skusConPrecio.size}`);
    
    console.log('\n💰 EJEMPLOS DE PRECIOS EN EXCEL:');
    ejemplosPrecios.forEach(e => {
      console.log(`   ${e.sku}: $${e.precio.toLocaleString()}`);
    });
    
    // 4. Comparar con lo que tenemos en la BD
    console.log('\n🔍 COMPARANDO CON BASE DE DATOS...');
    
    const { data: productsBD } = await supabase
      .from('products')
      .select('sku')
      .not('sku', 'is', null);
    
    const skusBD = new Set(productsBD?.map(p => String(p.sku).trim()) || []);
    console.log(`📋 SKUs en base de datos: ${skusBD.size}`);
    
    // 5. Ver cuántos SKUs del Excel coinciden con BD
    const coincidenciasExactas = new Set();
    const noCoinciden = new Set();
    
    skusConPrecio.forEach(skuExcel => {
      if (skusBD.has(skuExcel)) {
        coincidenciasExactas.add(skuExcel);
      } else {
        noCoinciden.add(skuExcel);
      }
    });
    
    console.log(`✅ Coincidencias exactas: ${coincidenciasExactas.size}`);
    console.log(`❌ No coinciden: ${noCoinciden.size}`);
    
    // 6. Buscar coincidencias numéricas (ej: "123" vs 123)
    const coincidenciasNumericas = new Set();
    noCoinciden.forEach(skuExcel => {
      const skuNumber = parseFloat(skuExcel);
      if (!isNaN(skuNumber)) {
        // Buscar como número en BD
        if (skusBD.has(skuNumber.toString()) || 
            Array.from(skusBD).some(skuBD => parseFloat(skuBD) === skuNumber)) {
          coincidenciasNumericas.add(skuExcel);
        }
      }
    });
    
    console.log(`🔢 Coincidencias numéricas: ${coincidenciasNumericas.size}`);
    
    const totalCoincidencias = coincidenciasExactas.size + coincidenciasNumericas.size;
    console.log(`\n🎯 TOTAL COINCIDENCIAS POSIBLES: ${totalCoincidencias}/${skusConPrecio.size}`);
    console.log(`📊 Ratio de coincidencias: ${Math.round((totalCoincidencias/skusConPrecio.size)*100)}%`);
    
    // 7. Ver algunos que no coinciden
    console.log('\n❌ EJEMPLOS QUE NO COINCIDEN:');
    Array.from(noCoinciden).slice(0, 10).forEach(sku => {
      const ejemplo = data.find(row => String(row['SKU'] || row['sku']).trim() === sku);
      if (ejemplo) {
        const precio = ejemplo['precio'] || ejemplo['Precio'] || ejemplo['Precio unitario de venta de la publicación (CLP)'];
        console.log(`   ${sku}: $${precio} (no está en BD)`);
      }
    });
    
    console.log('\n🔍 DIAGNÓSTICO:');
    if (totalCoincidencias > 100) {
      console.log('   ✅ Hay muchos más precios disponibles en Excel');
      console.log('   🔧 Necesitamos mejorar el script de importación');
      console.log('   💡 Problema: matching de SKUs no está funcionando bien');
    } else {
      console.log('   ⚠️  Pocos precios en Excel coinciden con BD');
      console.log('   💡 Posible problema: diferentes formatos de SKU');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

analyzeExcelComplete().then(() => {
  console.log('\n✅ Análisis completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});