// import-all-excel-prices.js - Importar TODOS los precios del Excel
const XLSX = require('xlsx');
const { supabase } = require('./lib/supabaseClient.js');

async function importAllExcelPrices() {
  console.log('💰 IMPORTANDO TODOS LOS PRECIOS DEL EXCEL...\n');
  
  try {
    // 1. Leer Excel
    const excelPath = 'C:/Users/franc/Downloads/sistemadegestion-main/ventas/ventas.xlsx';
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Total registros en Excel: ${data.length}`);
    
    // 2. Extraer todos los SKUs únicos con sus últimos precios
    console.log('\n🔍 Extrayendo SKUs únicos con precios...');
    
    const skuPrecios = new Map();
    
    data.forEach(row => {
      const sku = row['SKU'];
      const precio = row['Precio unitario de venta de la publicación (CLP)'];
      const fechaVenta = row['Fecha de venta'];
      
      if (sku && precio && precio > 0) {
        const skuString = String(sku).trim();
        
        // Convertir fecha de Excel
        let fecha = null;
        if (typeof fechaVenta === 'number') {
          fecha = new Date((fechaVenta - 25569) * 86400 * 1000);
        } else {
          fecha = new Date(fechaVenta);
        }
        
        // Mantener solo el precio más reciente por SKU
        if (!skuPrecios.has(skuString) || 
            (fecha && skuPrecios.get(skuString).fecha < fecha)) {
          skuPrecios.set(skuString, {
            precio: precio,
            fecha: fecha,
            fechaOriginal: fechaVenta
          });
        }
      }
    });
    
    console.log(`✅ SKUs únicos con precio: ${skuPrecios.size}`);
    
    // 3. Obtener TODOS los productos de la BD (no solo 1000)
    console.log('\n📋 Obteniendo TODOS los productos de BD...');
    
    let allProducts = [];
    let offset = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: products, error } = await supabase
        .from('products')
        .select('sku')
        .range(offset, offset + pageSize - 1);
      
      if (error) throw new Error('Error obteniendo productos: ' + error.message);
      if (!products || products.length === 0) break;
      
      allProducts.push(...products);
      console.log(`   📄 Página ${Math.floor(offset/pageSize) + 1}: ${products.length} productos (Total: ${allProducts.length})`);
      
      if (products.length < pageSize) break;
      offset += pageSize;
    }
    
    console.log(`📋 Total productos en BD: ${allProducts.length}`);
    
    // 4. Hacer matching inteligente
    console.log('\n🔄 Haciendo matching de SKUs...');
    
    const updates = [];
    const skusBD = new Set(allProducts.map(p => String(p.sku).trim()));
    
    let exactMatches = 0;
    let numericMatches = 0;
    
    skuPrecios.forEach((dataPrecio, skuExcel) => {
      let matched = false;
      
      // 1. Matching exacto
      if (skusBD.has(skuExcel)) {
        updates.push({
          sku: skuExcel,
          precio_venta_sugerido: dataPrecio.precio
        });
        exactMatches++;
        matched = true;
      }
      // 2. Matching numérico
      else {
        const skuNumber = parseFloat(skuExcel);
        if (!isNaN(skuNumber)) {
          // Buscar equivalente numérico
          const matchedSku = Array.from(skusBD).find(skuBD => {
            const bdNumber = parseFloat(skuBD);
            return !isNaN(bdNumber) && bdNumber === skuNumber;
          });
          
          if (matchedSku) {
            updates.push({
              sku: matchedSku,
              precio_venta_sugerido: dataPrecio.precio
            });
            numericMatches++;
            matched = true;
          }
        }
      }
    });
    
    console.log(`✅ Matches exactos: ${exactMatches}`);
    console.log(`🔢 Matches numéricos: ${numericMatches}`);
    console.log(`🎯 Total a actualizar: ${updates.length}`);
    
    // 5. Actualizar en la base de datos
    if (updates.length > 0) {
      console.log('\n💾 Actualizando base de datos...');
      
      let actualizados = 0;
      const BATCH_SIZE = 50;
      
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        // Actualizar cada uno individualmente para mejor control
        for (const update of batch) {
          const { error } = await supabase
            .from('products')
            .update({ precio_venta_sugerido: update.precio_venta_sugerido })
            .eq('sku', update.sku);
          
          if (!error) {
            actualizados++;
          }
        }
        
        console.log(`   ✅ Lote ${Math.floor(i/BATCH_SIZE) + 1}: ${Math.min(BATCH_SIZE, batch.length)} productos procesados`);
        
        // Progreso
        if ((i + BATCH_SIZE) % 200 === 0) {
          console.log(`   📊 Progreso: ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`);
        }
      }
      
      console.log(`\n🎉 ¡${actualizados}/${updates.length} productos actualizados exitosamente!`);
      
      // 6. Verificar resultado
      const { data: topPrecios } = await supabase
        .from('products')
        .select('sku, descripcion, precio_venta_sugerido')
        .not('precio_venta_sugerido', 'is', null)
        .gt('precio_venta_sugerido', 10000)
        .order('precio_venta_sugerido', { ascending: false })
        .limit(10);
      
      console.log('\n💰 Top 10 productos con precios más altos:');
      topPrecios?.forEach((p, i) => {
        console.log(`   ${i+1}. ${p.sku}: $${p.precio_venta_sugerido.toLocaleString()} - ${p.descripcion?.substring(0, 40)}...`);
      });
      
      // Resumen final
      const { count: totalConPrecio } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .not('precio_venta_sugerido', 'is', null)
        .gt('precio_venta_sugerido', 0);
      
      console.log(`\n📊 RESULTADO FINAL:`);
      console.log(`   💰 Productos con precio: ${totalConPrecio}/${allProducts.length}`);
      console.log(`   📈 Mejora: de 62 a ${totalConPrecio} productos con precios reales`);
      console.log(`   🚀 Incremento: +${totalConPrecio - 62} productos con precios`);
      
    } else {
      console.log('\n⚠️ No se encontraron coincidencias para actualizar');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

importAllExcelPrices().then(() => {
  console.log('\n✅ Importación masiva completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});