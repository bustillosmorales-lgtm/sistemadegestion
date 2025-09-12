// import-prices-by-latest-date.js - Importar precios usando fecha más reciente
const XLSX = require('xlsx');
const { supabase } = require('./lib/supabaseClient.js');

async function importPricesByLatestDate() {
  console.log('📊 Importando precios por fecha más reciente...');
  
  try {
    // 1. Obtener todos los SKUs únicos de la tabla ventas (BD)
    console.log('🔍 Obteniendo SKUs de la base de datos...');
    const { data: ventasBD } = await supabase
      .from('ventas')
      .select('sku')
      .order('sku');
    
    const skusUnicos = [...new Set(ventasBD.map(v => v.sku))];
    console.log(`📋 SKUs únicos en BD: ${skusUnicos.length}`);
    
    // 2. Leer Excel completo
    console.log('📁 Leyendo Excel completo...');
    const excelPath = 'C:/Users/franc/Downloads/sistemadegestion-main/ventas/ventas.xlsx';
    const workbook = XLSX.readFile(excelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const excelData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Registros en Excel: ${excelData.length}`);
    
    // 3. Procesar cada SKU de la BD
    const updates = [];
    let procesados = 0;
    let encontrados = 0;
    
    for (const skuBD of skusUnicos) {
      procesados++;
      
      // Normalizar SKU de BD
      const skuBDString = String(skuBD).trim();
      const skuBDNumber = parseFloat(skuBD);
      
      // Buscar TODAS las coincidencias en Excel para este SKU
      const coincidencias = excelData.filter(row => {
        const skuExcel = row['SKU'];
        if (!skuExcel) return false;
        
        const skuExcelString = String(skuExcel).trim();
        const skuExcelNumber = parseFloat(skuExcel);
        
        // Comparar como string
        if (skuBDString === skuExcelString) return true;
        
        // Comparar como número si ambos son válidos
        if (!isNaN(skuBDNumber) && !isNaN(skuExcelNumber)) {
          return skuBDNumber === skuExcelNumber;
        }
        
        return false;
      });
      
      if (coincidencias.length > 0) {
        // Buscar la venta más reciente por fecha
        let ventaMasReciente = null;
        let fechaMasReciente = null;
        
        for (const venta of coincidencias) {
          const fechaVenta = venta['Fecha de venta'];
          if (!fechaVenta) continue;
          
          // Convertir fecha de Excel (puede ser número de días desde 1900 o string)
          let fecha = null;
          if (typeof fechaVenta === 'number') {
            // Excel almacena fechas como número de días desde 1900-01-01
            fecha = new Date((fechaVenta - 25569) * 86400 * 1000);
          } else {
            fecha = new Date(fechaVenta);
          }
          
          if (!isNaN(fecha.getTime()) && (!fechaMasReciente || fecha > fechaMasReciente)) {
            fechaMasReciente = fecha;
            ventaMasReciente = venta;
          }
        }
        
        if (ventaMasReciente) {
          const precio = parseFloat(ventaMasReciente['Precio unitario de venta de la publicación (CLP)']) || 0;
          
          if (precio > 0) {
            // Buscar el ID de la venta más reciente en BD para este SKU
            const { data: ventaBDMasReciente } = await supabase
              .from('ventas')
              .select('id')
              .eq('sku', skuBD)
              .order('fecha_venta', { ascending: false })
              .limit(1);
            
            if (ventaBDMasReciente && ventaBDMasReciente.length > 0) {
              updates.push({
                id: ventaBDMasReciente[0].id,
                precio_unitario: precio
              });
              
              encontrados++;
              console.log(`✅ ${skuBD}: $${precio.toLocaleString()} CLP (${fechaMasReciente.toLocaleDateString()})`);
            }
          }
        }
      }
      
      // Progreso cada 100 SKUs
      if (procesados % 100 === 0) {
        console.log(`📊 Progreso: ${procesados}/${skusUnicos.length} - Encontrados: ${encontrados}`);
      }
    }
    
    console.log(`\\n🎯 Resumen de búsqueda:`);
    console.log(`  📋 SKUs procesados: ${procesados}`);
    console.log(`  ✅ Precios encontrados: ${encontrados}`);
    console.log(`  📈 Tasa de éxito: ${Math.round((encontrados/procesados)*100)}%`);
    
    // 4. Actualizar base de datos en lotes
    if (updates.length > 0) {
      console.log(`\\n💾 Actualizando ${updates.length} precios en la base de datos...`);
      
      const BATCH_SIZE = 100;
      let actualizados = 0;
      
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        const { error } = await supabase
          .from('ventas')
          .upsert(batch, { onConflict: 'id' });
        
        if (error) {
          console.error(`❌ Error actualizando lote ${Math.floor(i/BATCH_SIZE) + 1}:`, error.message);
        } else {
          actualizados += batch.length;
          console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} registros actualizados`);
        }
        
        // Pausa pequeña entre lotes
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`\\n🎉 ¡${actualizados} precios importados exitosamente!`);
      
      // 5. Verificar los precios más altos importados
      const { data: topPrecios } = await supabase
        .from('ventas')
        .select('sku, precio_unitario')
        .not('precio_unitario', 'is', null)
        .gt('precio_unitario', 0)
        .order('precio_unitario', { ascending: false })
        .limit(10);
      
      console.log('\\n💰 Top 10 precios más altos importados:');
      topPrecios?.forEach((v, i) => {
        console.log(`  ${i+1}. ${v.sku}: $${v.precio_unitario.toLocaleString()} CLP`);
      });
      
    } else {
      console.log('⚠️ No se encontraron coincidencias para actualizar');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

// Ejecutar
importPricesByLatestDate();