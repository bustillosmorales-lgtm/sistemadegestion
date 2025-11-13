/**
 * Netlify Function: Procesar Excel y cargar a Supabase
 * POST /api/procesar-excel
 */

const { createClient } = require('@supabase/supabase-js');
const { verifyAuth, getCorsHeaders } = require('./lib/auth');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);



exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  const origin = event.headers.origin || '';
  const headers = getCorsHeaders(origin);

  // Verificar autenticación
  const auth = await verifyAuth(event);
  if (!auth.authenticated) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Unauthorized'
      })
    };
  }


  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {// REMOVED: console.log// REMOVED: console.log

    const { filePath } = JSON.parse(event.body);// REMOVED: console.log

    if (!filePath) {
      throw new Error('filePath requerido');
    }

    // 1. Descargar archivo de Supabase Storage// REMOVED: console.log
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('excel-uploads')
      .download(filePath);

    if (downloadError) {
      console.error('Error en download:', downloadError);
      throw new Error(`Error descargando: ${downloadError.message}`);
    }// REMOVED: console.log

    // 2. Leer Excel con opciones optimizadas// REMOVED: console.log
    const buffer = Buffer.from(await fileData.arrayBuffer());// REMOVED: console.log

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
    if (workbook.SheetNames.includes('ventas')) {// REMOVED: console.log
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
      if (ventasRegistros.length > 0) {// REMOVED: console.log
        for (let i = 0; i < ventasRegistros.length; i += 50) {
          const batch = ventasRegistros.slice(i, i + 50);
          const { error: insertError } = await supabase.from('ventas_historicas').insert(batch);
          if (insertError) {
            console.error('Error insertando ventas:', insertError);
            throw new Error(`Error insertando ventas: ${insertError.message}`);
          }
          resultados.ventas_cargadas += batch.length;
          // Log progreso cada 500 registros
          if ((i + 50) % 500 === 0) {// REMOVED: console.log
          }
        }// REMOVED: console.log
      }

      // Liberar memoria de la hoja procesada
      delete workbook.Sheets['ventas'];// REMOVED: console.log
    }

    // 4. Procesar hoja "Stock"
    if (workbook.SheetNames.includes('Stock')) {// REMOVED: console.log
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

      if (stockRegistros.length > 0) {// REMOVED: console.log
        for (let i = 0; i < stockRegistros.length; i += 50) {
          const batch = stockRegistros.slice(i, i + 50);
          const { error: insertError } = await supabase.from('stock_actual').upsert(batch);
          if (insertError) {
            console.error('Error insertando stock:', insertError);
            throw new Error(`Error insertando stock: ${insertError.message}`);
          }
          resultados.stock_cargado += batch.length;
        }// REMOVED: console.log
      }

      // Liberar memoria
      delete workbook.Sheets['Stock'];// REMOVED: console.log
    }

    // 5. Procesar "transito china"
    if (workbook.SheetNames.includes('transito china')) {// REMOVED: console.log
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

      if (transitoRegistros.length > 0) {// REMOVED: console.log
        const { error: insertError } = await supabase.from('transito_china').insert(transitoRegistros);
        if (insertError) {
          console.error('Error insertando tránsito:', insertError);
          throw new Error(`Error insertando tránsito: ${insertError.message}`);
        }
        resultados.transito_cargado = transitoRegistros.length;// REMOVED: console.log
      }

      // Liberar memoria
      delete workbook.Sheets['transito china'];// REMOVED: console.log
    }

    // 6. Procesar "compras"
    if (workbook.SheetNames.includes('compras')) {// REMOVED: console.log
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

      if (comprasRegistros.length > 0) {// REMOVED: console.log
        for (let i = 0; i < comprasRegistros.length; i += 50) {
          const batch = comprasRegistros.slice(i, i + 50);
          const { error: insertError } = await supabase.from('compras_historicas').insert(batch);
          if (insertError) {
            console.error('Error insertando compras:', insertError);
            throw new Error(`Error insertando compras: ${insertError.message}`);
          }
          resultados.compras_cargadas += batch.length;
        }// REMOVED: console.log
      }

      // Liberar memoria
      delete workbook.Sheets['compras'];// REMOVED: console.log
    }

    // 7. Procesar "Packs"
    if (workbook.SheetNames.includes('Packs')) {// REMOVED: console.log
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

      if (packsRegistros.length > 0) {// REMOVED: console.log
        const { error: insertError } = await supabase.from('packs').insert(packsRegistros);
        if (insertError) {
          console.error('Error insertando packs:', insertError);
          throw new Error(`Error insertando packs: ${insertError.message}`);
        }
        resultados.packs_cargados = packsRegistros.length;// REMOVED: console.log
      }

      // Liberar memoria
      delete workbook.Sheets['Packs'];// REMOVED: console.log
    }

    // 8. Procesar "desconsiderar" (opcional)
    if (workbook.SheetNames.includes('desconsiderar')) {// REMOVED: console.log
      const descSheet = workbook.Sheets['desconsiderar'];
      const descData = XLSX.utils.sheet_to_json(descSheet, { header: 1 });

      const descRegistros = [];

      for (let i = 1; i < descData.length; i++) {
        const row = descData[i];
        const sku = row[0]?.toString().trim();

        if (!sku) continue;

        descRegistros.push({ sku });
      }

      if (descRegistros.length > 0) {// REMOVED: console.log
        const { error: insertError } = await supabase.from('skus_desconsiderar').insert(descRegistros);
        if (insertError) {
          console.error('Error insertando desconsiderar:', insertError);
          throw new Error(`Error insertando desconsiderar: ${insertError.message}`);
        }
        resultados.desconsiderar_cargados = descRegistros.length;// REMOVED: console.log
      }

      // Liberar memoria
      delete workbook.Sheets['desconsiderar'];// REMOVED: console.log
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


