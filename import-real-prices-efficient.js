// import-real-prices-efficient.js - Versión más eficiente para importar precios
const XLSX = require('xlsx');
const { supabase } = require('./lib/supabaseClient.js');

async function importRealPricesEfficient() {
  console.log('📊 Importando precios reales (versión eficiente)...');
  
  try {
    // 1. Leer Excel
    const excelPath = 'C:/Users/franc/Downloads/sistemadegestion-main/ventas/ventas.xlsx';
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Total registros en Excel: ${data.length}`);
    
    // 2. Obtener todos los SKUs de la BD una vez
    console.log('🔍 Obteniendo todos los SKUs de la base de datos...');
    const { data: allVentasBD } = await supabase
      .from('ventas')
      .select('id, sku, precio_unitario')
      .order('id');
    
    console.log(`📋 SKUs en BD: ${allVentasBD?.length || 0}`);
    
    // 3. Crear mapa de SKUs para búsqueda rápida
    const skuMap = new Map();
    allVentasBD?.forEach(venta => {
      const skuString = String(venta.sku).trim();
      const skuNumber = parseFloat(venta.sku);
      
      // Agregar como string
      if (!skuMap.has(skuString)) {
        skuMap.set(skuString, []);
      }
      skuMap.get(skuString).push(venta);
      
      // Si es número válido, también agregar por número
      if (!isNaN(skuNumber)) {
        const numKey = skuNumber.toString();
        if (!skuMap.has(numKey)) {
          skuMap.set(numKey, []);
        }
        skuMap.get(numKey).push(venta);
      }
    });
    
    console.log(`🗂️ Mapa de búsqueda creado con ${skuMap.size} claves`);
    
    // 4. Procesar Excel y hacer matches
    const skuColumn = 'SKU';
    const precioColumn = 'Precio unitario de venta de la publicación (CLP)';
    
    const updates = [];
    const matched = new Set(); // Para evitar duplicados
    
    console.log('🔄 Procesando matches...');
    
    for (let i = 0; i < Math.min(data.length, 2000); i++) {
      const row = data[i];
      const skuExcel = String(row[skuColumn] || '').trim();
      const precio = parseFloat(row[precioColumn]) || 0;
      
      if (!skuExcel || precio <= 0) continue;
      
      // Buscar en el mapa
      let ventasEncontradas = skuMap.get(skuExcel);
      
      // Si no encuentra como string, buscar como número
      if (!ventasEncontradas) {
        const skuAsNumber = parseFloat(skuExcel);
        if (!isNaN(skuAsNumber)) {
          ventasEncontradas = skuMap.get(skuAsNumber.toString());
        }
      }
      
      // Si encuentra matches
      if (ventasEncontradas && ventasEncontradas.length > 0) {
        // Usar solo la primera venta encontrada para evitar duplicados
        const venta = ventasEncontradas[0];
        if (!matched.has(venta.id)) {
          updates.push({
            id: venta.id,
            precio_unitario: precio
          });
          matched.add(venta.id);
          console.log(`✅ ${skuExcel} → ${venta.sku}: $${precio} CLP`);
        }
      }
      
      if (i % 500 === 0 && i > 0) {
        console.log(`📊 Progreso: ${i}/${Math.min(data.length, 2000)} - Matches: ${updates.length}`);
      }
    }
    
    console.log(`\\n🎯 Total matches encontrados: ${updates.length}`);
    
    // 5. Actualizar en lotes
    if (updates.length > 0) {
      console.log('💾 Actualizando base de datos...');
      
      const BATCH_SIZE = 100;
      let actualizados = 0;
      
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        const { error } = await supabase
          .from('ventas')
          .upsert(batch, { onConflict: 'id' });
        
        if (error) {
          console.error(`❌ Error actualizando lote:`, error.message);
        } else {
          actualizados += batch.length;
          console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} registros`);
        }
      }
      
      console.log(`\\n🎉 ¡${actualizados} precios reales importados exitosamente!`);
      
      // 6. Verificar algunos resultados
      const { data: verificacion } = await supabase
        .from('ventas')
        .select('sku, precio_unitario')
        .not('precio_unitario', 'is', null)
        .gt('precio_unitario', 0)
        .order('precio_unitario', { ascending: false })
        .limit(10);
      
      console.log('\\n💰 Top 10 precios más altos importados:');
      verificacion?.forEach(v => {
        console.log(`  ${v.sku}: $${v.precio_unitario.toLocaleString()} CLP`);
      });
      
    } else {
      console.log('⚠️ No se encontraron matches para actualizar');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

// Ejecutar
importRealPricesEfficient();