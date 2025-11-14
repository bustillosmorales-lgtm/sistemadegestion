/**
 * Script para procesar Excel en GitHub Actions (sin límites de timeout)
 * Se ejecuta cuando se dispara el workflow process-excel.yml
 */

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function processExcel() {
  const filePath = process.env.FILE_PATH;

  if (!filePath) {
    throw new Error('FILE_PATH no proporcionado');
  }

  console.log(`📥 Descargando archivo: ${filePath}`);

  // 1. Descargar archivo de Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('excel-uploads')
    .download(filePath);

  if (downloadError) {
    throw new Error(`Error descargando: ${downloadError.message}`);
  }

  console.log('✅ Archivo descargado');

  // 2. Leer Excel
  console.log('📖 Leyendo Excel...');
  const buffer = Buffer.from(await fileData.arrayBuffer());
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellNF: false,
    cellStyles: false,
    sheetStubs: false
  });

  console.log(`📊 Hojas encontradas: ${workbook.SheetNames.join(', ')}`);

  const resultados = {
    ventas_cargadas: 0,
    stock_cargado: 0,
    transito_cargado: 0,
    compras_cargadas: 0,
    packs_cargados: 0,
    desconsiderar_cargados: 0
  };

  // 3. Procesar TODAS las hojas en PARALELO
  const processingPromises = [];

  // VENTAS
  if (workbook.SheetNames.includes('ventas')) {
    processingPromises.push((async () => {
      console.log('🔄 Procesando hoja: ventas');
      const ventasSheet = workbook.Sheets['ventas'];
      const ventasData = XLSX.utils.sheet_to_json(ventasSheet, { header: 1 });

      // Usar Map para detectar y consolidar duplicados
      const ventasUnicas = new Map(); // Key: empresa+canal+fecha+sku, Value: registro

      for (let i = 1; i < ventasData.length; i++) {
        const row = ventasData[i];
        const empresa = row[0]?.toString().trim();
        const canal = row[1]?.toString().trim();

        if (empresa?.toUpperCase() !== 'TLT' || canal?.toUpperCase() !== 'MELI') {
          continue;
        }

        const sku = row[19]?.toString().trim();
        const unidades = parseFloat(row[10]) || 0;
        const fecha = excelDateToJSDate(row[5]);

        // Saltar si falta SKU, unidades o fecha
        if (!sku || unidades <= 0 || !fecha) continue;

        const registro = {
          empresa,
          canal,
          fecha,
          unidades,
          sku,
          mlc: row[20]?.toString().trim() || '',
          descripcion: row[21]?.toString().trim() || '',
          precio: parseFloat(row[23]) || 0
        };

        // Crear clave única para detectar duplicados
        const key = `${empresa}|${canal}|${fecha}|${sku}`;

        // Si ya existe, sumar unidades (o tomar el más reciente)
        if (ventasUnicas.has(key)) {
          const existente = ventasUnicas.get(key);
          existente.unidades += registro.unidades; // Sumar unidades duplicadas
        } else {
          ventasUnicas.set(key, registro);
        }
      }

      // Convertir Map a Array (ya sin duplicados)
      const ventasRegistros = Array.from(ventasUnicas.values());

      const totalOriginal = ventasData.length - 1; // Menos header
      const duplicadosEliminados = totalOriginal - ventasRegistros.length;

      if (duplicadosEliminados > 0) {
        console.log(`  🔍 Duplicados consolidados: ${duplicadosEliminados} registros (unidades sumadas)`);
      }

      if (ventasRegistros.length > 0) {
        console.log(`  ⏳ Insertando ${ventasRegistros.length} ventas únicas en lotes de 500...`);

        // Limpiar TODAS las ventas anteriores (el Excel contiene historial completo)
        await supabase.from('ventas_historicas').delete().neq('sku', '');
        console.log(`  🗑️ TODAS las ventas anteriores eliminadas (carga completa)`);

        for (let i = 0; i < ventasRegistros.length; i += 500) {
          const batch = ventasRegistros.slice(i, i + 500);
          const { error } = await supabase.from('ventas_historicas').insert(batch);
          if (error) throw new Error(`Error insertando ventas: ${error.message}`);
          resultados.ventas_cargadas += batch.length;
          console.log(`  ✓ Ventas: ${resultados.ventas_cargadas}/${ventasRegistros.length}`);
        }
      }
      console.log(`✅ Ventas completadas: ${resultados.ventas_cargadas}`);
    })());
  }

  // STOCK
  if (workbook.SheetNames.includes('Stock')) {
    processingPromises.push((async () => {
      console.log('🔄 Procesando hoja: Stock');
      const stockSheet = workbook.Sheets['Stock'];
      const stockData = XLSX.utils.sheet_to_json(stockSheet, { header: 1 });
      const stockRegistros = [];

      for (let i = 1; i < stockData.length; i++) {
        const row = stockData[i];
        const sku = row[0]?.toString().trim();
        if (!sku) continue;

        stockRegistros.push({
          sku,
          descripcion: row[1]?.toString().trim() || '',
          bodega_c: parseFloat(row[2]) || 0,
          bodega_d: parseFloat(row[3]) || 0,
          bodega_e: parseFloat(row[4]) || 0,
          bodega_f: parseFloat(row[5]) || 0,
          bodega_h: parseFloat(row[7]) || 0,
          bodega_j: parseFloat(row[9]) || 0
        });
      }

      if (stockRegistros.length > 0) {
        console.log(`  ⏳ Insertando ${stockRegistros.length} SKUs...`);

        // Limpiar TODO el stock anterior (el Excel contiene stock completo actual)
        await supabase.from('stock_actual').delete().neq('sku', '');
        console.log(`  🗑️ TODO el stock anterior eliminado (carga completa)`);

        const { error } = await supabase.from('stock_actual').insert(stockRegistros);
        if (error) throw new Error(`Error insertando stock: ${error.message}`);
        resultados.stock_cargado = stockRegistros.length;
      }
      console.log(`✅ Stock completado: ${resultados.stock_cargado}`);
    })());
  }

  // TRÁNSITO CHINA
  if (workbook.SheetNames.includes('transito china')) {
    processingPromises.push((async () => {
      console.log('🔄 Procesando hoja: transito china');
      const transitoSheet = workbook.Sheets['transito china'];
      const transitoData = XLSX.utils.sheet_to_json(transitoSheet, { header: 1 });
      const transitoRegistros = [];

      for (let i = 1; i < transitoData.length; i++) {
        const row = transitoData[i];
        const sku = row[3]?.toString().trim();
        const unidades = parseFloat(row[7]) || 0;

        if (!sku || unidades <= 0) continue;

        transitoRegistros.push({
          sku,
          unidades,
          estado: 'en_transito'
        });
      }

      if (transitoRegistros.length > 0) {
        console.log(`  ⏳ Insertando ${transitoRegistros.length} registros en tránsito...`);

        // Limpiar TODO el tránsito anterior (el Excel contiene datos completos actuales)
        await supabase.from('transito_china').delete().neq('sku', '');
        console.log(`  🗑️ TODO el tránsito anterior eliminado (carga completa)`);

        const { error } = await supabase.from('transito_china').insert(transitoRegistros);
        if (error) throw new Error(`Error insertando tránsito: ${error.message}`);
        resultados.transito_cargado = transitoRegistros.length;
      }
      console.log(`✅ Tránsito completado: ${resultados.transito_cargado}`);
    })());
  }

  // COMPRAS
  if (workbook.SheetNames.includes('compras')) {
    processingPromises.push((async () => {
      console.log('🔄 Procesando hoja: compras');
      const comprasSheet = workbook.Sheets['compras'];
      const comprasData = XLSX.utils.sheet_to_json(comprasSheet, { header: 1 });

      // Usar Map para deduplicar (mismo SKU + fecha)
      const comprasUnicas = new Map();

      for (let i = 1; i < comprasData.length; i++) {
        const row = comprasData[i];
        const sku = row[0]?.toString().trim();
        const fecha = excelDateToJSDate(row[3]);

        if (!sku || !fecha) continue;

        const key = `${sku}|${fecha}`;

        // Solo agregar si no existe (tomar el primero)
        if (!comprasUnicas.has(key)) {
          comprasUnicas.set(key, {
            sku,
            fecha_compra: fecha
          });
        }
      }

      const comprasRegistros = Array.from(comprasUnicas.values());

      if (comprasRegistros.length > 0) {
        console.log(`  ⏳ Insertando ${comprasRegistros.length} compras en lotes de 500...`);

        // Limpiar TODAS las compras anteriores (el Excel contiene historial completo)
        await supabase.from('compras_historicas').delete().neq('sku', '');
        console.log(`  🗑️ TODAS las compras anteriores eliminadas (carga completa)`);

        for (let i = 0; i < comprasRegistros.length; i += 500) {
          const batch = comprasRegistros.slice(i, i + 500);
          const { error } = await supabase.from('compras_historicas').insert(batch);
          if (error) throw new Error(`Error insertando compras: ${error.message}`);
          resultados.compras_cargadas += batch.length;
          console.log(`  ✓ Compras: ${resultados.compras_cargadas}/${comprasRegistros.length}`);
        }
      }
      console.log(`✅ Compras completadas: ${resultados.compras_cargadas}`);
    })());
  }

  // PACKS
  if (workbook.SheetNames.includes('Packs')) {
    processingPromises.push((async () => {
      console.log('🔄 Procesando hoja: Packs');
      const packsSheet = workbook.Sheets['Packs'];
      const packsData = XLSX.utils.sheet_to_json(packsSheet, { header: 1 });
      const packsRegistros = [];

      for (let i = 1; i < packsData.length; i++) {
        const row = packsData[i];
        const sku_pack = row[0]?.toString().trim();
        const sku_componente = row[1]?.toString().trim();
        const cantidad = parseFloat(row[2]) || 1;

        if (!sku_pack || !sku_componente) continue;

        packsRegistros.push({
          sku_pack,
          sku_componente,
          cantidad
        });
      }

      if (packsRegistros.length > 0) {
        console.log(`  ⏳ Insertando ${packsRegistros.length} packs...`);

        // Limpiar TODOS los packs anteriores (el Excel contiene configuración completa)
        await supabase.from('packs').delete().neq('sku_pack', '');
        console.log(`  🗑️ TODOS los packs anteriores eliminados (carga completa)`);

        const { error } = await supabase.from('packs').insert(packsRegistros);
        if (error) throw new Error(`Error insertando packs: ${error.message}`);
        resultados.packs_cargados = packsRegistros.length;
      }
      console.log(`✅ Packs completados: ${resultados.packs_cargados}`);
    })());
  }

  // DESCONSIDERAR
  if (workbook.SheetNames.includes('desconsiderar')) {
    processingPromises.push((async () => {
      console.log('🔄 Procesando hoja: desconsiderar');
      const descSheet = workbook.Sheets['desconsiderar'];
      const descData = XLSX.utils.sheet_to_json(descSheet, { header: 1 });
      const descRegistros = [];

      for (let i = 1; i < descData.length; i++) {
        const row = descData[i];
        const sku = row[0]?.toString().trim();

        if (!sku) continue;

        descRegistros.push({ sku });
      }

      if (descRegistros.length > 0) {
        console.log(`  ⏳ Insertando ${descRegistros.length} SKUs a desconsiderar...`);

        // Limpiar TODOS los SKUs a desconsiderar anteriores (el Excel contiene lista completa)
        await supabase.from('skus_desconsiderar').delete().neq('sku', '');
        console.log(`  🗑️ TODOS los SKUs a desconsiderar anteriores eliminados (carga completa)`);

        const { error } = await supabase.from('skus_desconsiderar').insert(descRegistros);
        if (error) throw new Error(`Error insertando desconsiderar: ${error.message}`);
        resultados.desconsiderar_cargados = descRegistros.length;
      }
      console.log(`✅ Desconsiderar completado: ${resultados.desconsiderar_cargados}`);
    })());
  }

  // Esperar a que TODAS las hojas se procesen
  console.log('\n⏳ Procesando todas las hojas en paralelo...');
  await Promise.all(processingPromises);

  // Eliminar archivo temporal
  console.log('\n🗑️ Eliminando archivo temporal...');
  await supabase.storage.from('excel-uploads').remove([filePath]);

  console.log('\n✅ PROCESAMIENTO COMPLETADO');
  console.log('📊 RESUMEN:');
  console.log(`   - Ventas: ${resultados.ventas_cargadas}`);
  console.log(`   - Stock: ${resultados.stock_cargado}`);
  console.log(`   - Tránsito: ${resultados.transito_cargado}`);
  console.log(`   - Compras: ${resultados.compras_cargadas}`);
  console.log(`   - Packs: ${resultados.packs_cargados}`);
  console.log(`   - Desconsiderar: ${resultados.desconsiderar_cargados}`);
}

// Helper: Convertir fecha de Excel a JS Date
function excelDateToJSDate(excelDate) {
  if (!excelDate) return null;

  if (typeof excelDate === 'string') {
    const date = new Date(excelDate);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  }

  if (typeof excelDate === 'number') {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  return null;
}

// Ejecutar
processExcel()
  .then(() => {
    console.log('\n🎉 Script finalizado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
