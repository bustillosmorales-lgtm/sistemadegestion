/**
 * Netlify Function: Procesar Excel y cargar a Supabase
 * POST /api/procesar-excel
 */

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('=== INICIO PROCESAMIENTO ===');
    console.log('Event body:', event.body);

    const { filePath } = JSON.parse(event.body);
    console.log('FilePath recibido:', filePath);

    if (!filePath) {
      throw new Error('filePath requerido');
    }

    // 1. Descargar archivo de Supabase Storage
    console.log('Descargando archivo de Storage...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('excel-uploads')
      .download(filePath);

    if (downloadError) {
      console.error('Error en download:', downloadError);
      throw new Error(`Error descargando: ${downloadError.message}`);
    }

    console.log('Archivo descargado, tamaño:', fileData?.size || 'desconocido');

    // 2. Leer Excel con opciones optimizadas
    console.log('Leyendo Excel...');
    const buffer = Buffer.from(await fileData.arrayBuffer());
    console.log('Buffer creado, tamaño:', buffer.length);

    // Leer solo estructura del workbook primero
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellStyles: false,
      sheetStubs: false  // No crear celdas vacías
    });
    console.log('Excel leído, hojas encontradas:', workbook.SheetNames.join(', '));

    const resultados = {
      ventas_cargadas: 0,
      stock_cargado: 0,
      transito_cargado: 0,
      compras_cargadas: 0,
      packs_cargados: 0,
      desconsiderar_cargados: 0
    };

    // 3. Procesar hoja "ventas"
    if (workbook.SheetNames.includes('ventas')) {
      console.log('Procesando ventas...');
      const ventasSheet = workbook.Sheets['ventas'];
      const ventasData = XLSX.utils.sheet_to_json(ventasSheet, { header: 1 });

      const ventasRegistros = [];

      // Saltar header (fila 0)
      for (let i = 1; i < ventasData.length; i++) {
        const row = ventasData[i];

        const empresa = row[0]?.toString().trim();
        const canal = row[1]?.toString().trim();

        // Solo TLT + MELI
        if (empresa?.toUpperCase() !== 'TLT' || canal?.toUpperCase() !== 'MELI') {
          continue;
        }

        const sku = row[19]?.toString().trim(); // Columna T (índice 19)
        const unidades = parseFloat(row[10]) || 0; // Columna K (índice 10)

        if (!sku || unidades <= 0) continue;

        ventasRegistros.push({
          empresa,
          canal,
          fecha: excelDateToJSDate(row[5]), // Columna F (índice 5)
          unidades,
          sku,
          mlc: row[20]?.toString().trim() || '', // Columna U
          descripcion: row[21]?.toString().trim() || '', // Columna V
          precio: parseFloat(row[23]) || 0 // Columna X
        });
      }

      // Insertar en lotes de 50 (más pequeños para evitar timeout)
      if (ventasRegistros.length > 0) {
        console.log(`Insertando ${ventasRegistros.length} ventas en lotes de 50...`);
        for (let i = 0; i < ventasRegistros.length; i += 50) {
          const batch = ventasRegistros.slice(i, i + 50);
          const { error: insertError } = await supabase.from('ventas_historicas').insert(batch);
          if (insertError) {
            console.error('Error insertando ventas:', insertError);
            throw new Error(`Error insertando ventas: ${insertError.message}`);
          }
          resultados.ventas_cargadas += batch.length;
          // Log progreso cada 500 registros
          if ((i + 50) % 500 === 0) {
            console.log(`  → ${resultados.ventas_cargadas} ventas insertadas...`);
          }
        }
        console.log(`✓ ${resultados.ventas_cargadas} ventas insertadas`);
      }

      // Liberar memoria de la hoja procesada
      delete workbook.Sheets['ventas'];
      console.log('Memoria de hoja ventas liberada');
    }

    // 4. Procesar hoja "Stock"
    if (workbook.SheetNames.includes('Stock')) {
      console.log('Procesando stock...');
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
        console.log(`Insertando ${stockRegistros.length} SKUs de stock...`);
        for (let i = 0; i < stockRegistros.length; i += 50) {
          const batch = stockRegistros.slice(i, i + 50);
          const { error: insertError } = await supabase.from('stock_actual').upsert(batch);
          if (insertError) {
            console.error('Error insertando stock:', insertError);
            throw new Error(`Error insertando stock: ${insertError.message}`);
          }
          resultados.stock_cargado += batch.length;
        }
        console.log(`✓ ${resultados.stock_cargado} SKUs de stock insertados`);
      }

      // Liberar memoria
      delete workbook.Sheets['Stock'];
      console.log('Memoria de hoja Stock liberada');
    }

    // 5. Procesar "transito china"
    if (workbook.SheetNames.includes('transito china')) {
      console.log('Procesando tránsito china...');
      const transitoSheet = workbook.Sheets['transito china'];
      const transitoData = XLSX.utils.sheet_to_json(transitoSheet, { header: 1 });

      const transitoRegistros = [];

      for (let i = 1; i < transitoData.length; i++) {
        const row = transitoData[i];
        const sku = row[3]?.toString().trim(); // Columna D
        const unidades = parseFloat(row[7]) || 0; // Columna H

        if (!sku || unidades <= 0) continue;

        transitoRegistros.push({
          sku,
          unidades,
          estado: 'en_transito'
        });
      }

      if (transitoRegistros.length > 0) {
        console.log(`Insertando ${transitoRegistros.length} registros de tránsito...`);
        const { error: insertError } = await supabase.from('transito_china').insert(transitoRegistros);
        if (insertError) {
          console.error('Error insertando tránsito:', insertError);
          throw new Error(`Error insertando tránsito: ${insertError.message}`);
        }
        resultados.transito_cargado = transitoRegistros.length;
        console.log(`✓ ${resultados.transito_cargado} registros de tránsito insertados`);
      }

      // Liberar memoria
      delete workbook.Sheets['transito china'];
      console.log('Memoria de hoja transito liberada');
    }

    // 6. Procesar "compras"
    if (workbook.SheetNames.includes('compras')) {
      console.log('Procesando compras...');
      const comprasSheet = workbook.Sheets['compras'];
      const comprasData = XLSX.utils.sheet_to_json(comprasSheet, { header: 1 });

      const comprasRegistros = [];

      for (let i = 1; i < comprasData.length; i++) {
        const row = comprasData[i];
        const sku = row[0]?.toString().trim();
        const fecha = excelDateToJSDate(row[3]); // Columna D

        if (!sku || !fecha) continue;

        comprasRegistros.push({
          sku,
          fecha_compra: fecha
        });
      }

      if (comprasRegistros.length > 0) {
        console.log(`Insertando ${comprasRegistros.length} compras...`);
        for (let i = 0; i < comprasRegistros.length; i += 50) {
          const batch = comprasRegistros.slice(i, i + 50);
          const { error: insertError } = await supabase.from('compras_historicas').insert(batch);
          if (insertError) {
            console.error('Error insertando compras:', insertError);
            throw new Error(`Error insertando compras: ${insertError.message}`);
          }
          resultados.compras_cargadas += batch.length;
        }
        console.log(`✓ ${resultados.compras_cargadas} compras insertadas`);
      }

      // Liberar memoria
      delete workbook.Sheets['compras'];
      console.log('Memoria de hoja compras liberada');
    }

    // 7. Procesar "Packs"
    if (workbook.SheetNames.includes('Packs')) {
      console.log('Procesando packs...');
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
        console.log(`Insertando ${packsRegistros.length} packs...`);
        const { error: insertError } = await supabase.from('packs').insert(packsRegistros);
        if (insertError) {
          console.error('Error insertando packs:', insertError);
          throw new Error(`Error insertando packs: ${insertError.message}`);
        }
        resultados.packs_cargados = packsRegistros.length;
        console.log(`✓ ${resultados.packs_cargados} packs insertados`);
      }

      // Liberar memoria
      delete workbook.Sheets['Packs'];
      console.log('Memoria de hoja Packs liberada');
    }

    // 8. Procesar "desconsiderar" (opcional)
    if (workbook.SheetNames.includes('desconsiderar')) {
      console.log('Procesando desconsiderar...');
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
        console.log(`Insertando ${descRegistros.length} SKUs a desconsiderar...`);
        const { error: insertError } = await supabase.from('skus_desconsiderar').insert(descRegistros);
        if (insertError) {
          console.error('Error insertando desconsiderar:', insertError);
          throw new Error(`Error insertando desconsiderar: ${insertError.message}`);
        }
        resultados.desconsiderar_cargados = descRegistros.length;
        console.log(`✓ ${resultados.desconsiderar_cargados} SKUs desconsiderar insertados`);
      }

      // Liberar memoria
      delete workbook.Sheets['desconsiderar'];
      console.log('Memoria de hoja desconsiderar liberada');
    }

    // 9. Eliminar archivo temporal de storage
    await supabase.storage.from('excel-uploads').remove([filePath]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        ...resultados
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// Helper: Convertir fecha de Excel a JS Date
function excelDateToJSDate(excelDate) {
  if (!excelDate) return null;

  // Si ya es string de fecha
  if (typeof excelDate === 'string') {
    const date = new Date(excelDate);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  }

  // Si es número de Excel (días desde 1900-01-01)
  if (typeof excelDate === 'number') {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  return null;
}
