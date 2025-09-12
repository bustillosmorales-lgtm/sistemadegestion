// import-real-prices.js - Importar precios reales desde Excel
const XLSX = require('xlsx');
const { supabase } = require('./lib/supabaseClient.js');

async function importRealPrices() {
  console.log('📊 Importando precios reales desde Excel...');
  
  try {
    // 1. Leer archivo Excel
    const excelPath = 'C:/Users/franc/Downloads/sistemadegestion-main/ventas/ventas.xlsx';
    console.log(`📁 Leyendo: ${excelPath}`);
    
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log(`📋 Procesando hoja: ${sheetName}`);
    
    // 2. Convertir a JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log(`📊 Total registros en Excel: ${data.length}`);
    
    if (data.length === 0) {
      console.log('⚠️ No hay datos en el Excel');
      return;
    }
    
    // 3. Mostrar estructura del Excel
    console.log('📋 Columnas encontradas:');
    Object.keys(data[0]).forEach((col, index) => {
      console.log(`  ${index + 1}. ${col}`);
    });
    
    console.log('\\n📝 Primeros 3 registros de ejemplo:');
    data.slice(0, 3).forEach((row, index) => {
      console.log(`\\nRegistro ${index + 1}:`);
      Object.entries(row).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    });
    
    // 4. Identificar columnas relevantes automáticamente
    const columns = Object.keys(data[0]);
    let skuColumn = null;
    let precioColumn = null;
    let fechaColumn = null;
    let cantidadColumn = null;
    
    // Buscar columnas por nombres comunes
    columns.forEach(col => {
      const colLower = col.toLowerCase();
      
      if (colLower.includes('sku') || colLower.includes('codigo')) {
        skuColumn = col;
      } else if (colLower.includes('precio') || colLower.includes('valor') || colLower.includes('price')) {
        precioColumn = col;
      } else if (colLower.includes('fecha') || colLower.includes('date')) {
        fechaColumn = col;
      } else if (colLower.includes('cantidad') || colLower.includes('qty') || colLower.includes('quantity')) {
        cantidadColumn = col;
      }
    });
    
    console.log('\\n🔍 Columnas identificadas automáticamente:');
    console.log(`  SKU: ${skuColumn || 'NO ENCONTRADA'}`);
    console.log(`  Precio: ${precioColumn || 'NO ENCONTRADA'}`);
    console.log(`  Fecha: ${fechaColumn || 'NO ENCONTRADA'}`);
    console.log(`  Cantidad: ${cantidadColumn || 'NO ENCONTRADA'}`);
    
    if (!skuColumn || !precioColumn) {
      console.log('\\n❌ No se pudieron identificar las columnas necesarias');
      console.log('🔧 Por favor, verifica que el Excel tenga columnas para:');
      console.log('   - SKU/Codigo del producto');
      console.log('   - Precio/Valor unitario');
      return;
    }
    
    // 5. Procesar datos y actualizar base de datos
    console.log('\\n🔄 Procesando datos para actualización...');
    
    let actualizados = 0;
    let errores = 0;
    
    for (let i = 0; i < Math.min(data.length, 500); i++) { // Procesar máximo 500 para empezar
      const row = data[i];
      
      // Normalizar SKU para comparación (remover espacios, convertir a string)
      const skuOriginal = row[skuColumn];
      let sku = String(skuOriginal || '').trim();
      const precio = parseFloat(row[precioColumn]) || 0;
      
      if (!sku || precio <= 0) {
        console.log(`⚠️ Registro ${i+1}: SKU "${sku}" o precio "${precio}" inválido`);
        errores++;
        continue;
      }
      
      try {
        // Buscar venta existente con diferentes formatos de SKU
        let ventasExistentes = null;
        
        // 1. Buscar exacto (como string)
        const { data: ventasString } = await supabase
          .from('ventas')
          .select('id, precio_unitario')
          .eq('sku', sku)
          .order('fecha_venta', { ascending: false })
          .limit(1);
        
        if (ventasString && ventasString.length > 0) {
          ventasExistentes = ventasString;
        } else {
          // 2. Si no encuentra, buscar como número (convirtiendo BD a number)
          const { data: allSimilarSkus } = await supabase
            .from('ventas')
            .select('id, sku, precio_unitario')
            .order('fecha_venta', { ascending: false });
          
          // Comparar convertido a número si es posible
          const skuAsNumber = parseFloat(sku);
          if (!isNaN(skuAsNumber)) {
            const foundSku = allSimilarSkus?.find(v => {
              const dbSkuAsNumber = parseFloat(v.sku);
              return !isNaN(dbSkuAsNumber) && dbSkuAsNumber === skuAsNumber;
            });
            
            if (foundSku) {
              ventasExistentes = [foundSku];
            }
          }
        }
        
        if (ventasExistentes && ventasExistentes.length > 0) {
          // Actualizar precio de venta existente
          const { error: updateError } = await supabase
            .from('ventas')
            .update({ precio_unitario: precio })
            .eq('id', ventasExistentes[0].id);
          
          if (updateError) {
            console.log(`❌ Error actualizando ${sku}:`, updateError.message);
            errores++;
          } else {
            console.log(`✅ ${sku}: $${precio} CLP`);
            actualizados++;
          }
        } else {
          console.log(`⚠️ No se encontró venta para SKU: ${sku}`);
        }
        
      } catch (error) {
        console.log(`❌ Error procesando ${sku}:`, error.message);
        errores++;
      }
      
      // Pausa pequeña para no sobrecargar
      if (i % 50 === 0 && i > 0) {
        console.log(`📊 Progreso: ${i}/${Math.min(data.length, 500)} procesados`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('\\n📊 Resumen de importación:');
    console.log(`  ✅ Precios actualizados: ${actualizados}`);
    console.log(`  ❌ Errores: ${errores}`);
    console.log(`  📊 Total procesado: ${actualizados + errores} de ${Math.min(data.length, 500)}`);
    
    if (actualizados > 0) {
      console.log('\\n🎉 ¡Precios reales importados exitosamente!');
      console.log('🔄 Ya puedes actualizar el cache con precios reales');
    }
    
  } catch (error) {
    console.error('❌ Error importando precios:', error.message);
  }
  
  process.exit(0);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  importRealPrices();
}

module.exports = { importRealPrices };